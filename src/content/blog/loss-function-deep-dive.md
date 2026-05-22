---
title: "손실함수 완전 정복 — AI가 학습하는 진짜 원리"
description: "MSE·Cross-Entropy·Focal Loss·Triplet Loss까지, 손실함수의 종류와 선택 기준을 PyTorch·TensorFlow 코드와 함께 정리"
date: 2026-03-26
category: AI
tags: [AI, DeepLearning, LossFunction, PyTorch, TensorFlow, MachineLearning, GradientDescent, CrossEntropy]
---

AI 모델이 "학습한다"는 말, 정확히 무슨 뜻일까요?

사람이 시험을 보고 틀린 문제를 복습하듯, AI 모델도 **자신이 얼마나 틀렸는지를 숫자로 측정**하고, 그 숫자를 줄이는 방향으로 스스로를 교정합니다. 이때 "얼마나 틀렸는지"를 측정하는 함수가 바로 **손실함수(Loss Function)** 입니다.

이 글에서는 손실함수가 AI 학습에서 어떤 역할을 하는지, 어떤 종류가 있고 언제 어떤 걸 써야 하는지를 PyTorch + TensorFlow 코드와 함께 정리합니다.

---

## 1. 손실함수는 AI 학습의 어디에 위치하는가?

AI 모델이 학습하는 과정은 하나의 **루프(loop)** 입니다.

![AI 학습 루프](/images/blog/loss-function-deep-dive/fig01-training-loop.png)

전체 흐름을 풀어쓰면 이렇습니다.

**1단계 — Forward Pass**: 입력 데이터 X가 모델을 통과하면서 예측값 `y_hat`을 만들어냅니다.

**2단계 — Loss 계산**: 예측값 `y_hat`과 실제 정답 `y`를 손실함수에 넣으면, "모델이 얼마나 틀렸는지"를 나타내는 **하나의 숫자(스칼라)** 가 나옵니다. 이 숫자가 바로 **Loss**입니다.

**3단계 — Backpropagation**: Loss를 기반으로 "각 가중치(weight)가 Loss에 얼마나 기여했는지"를 역방향으로 계산합니다. 이것이 **그래디언트(gradient)** 입니다.

**4단계 — Weight Update**: Optimizer(SGD, Adam 등)가 그래디언트를 이용해 가중치를 조금씩 수정합니다. Loss가 줄어드는 방향으로요.

이 루프를 수만~수백만 번 반복하면, 모델의 Loss는 점점 작아지고, 예측은 점점 정확해집니다.

> 핵심은 이것입니다: **손실함수가 없으면 모델은 자기가 틀렸다는 사실 자체를 모릅니다.** 손실함수는 AI 학습의 나침반입니다.

---

## 2. 손실함수의 종류 한눈에 보기

손실함수는 크게 세 카테고리로 나뉩니다.

![손실함수 분류](/images/blog/loss-function-deep-dive/fig02-taxonomy.png)

- **Regression** 계열: 연속적인 숫자를 예측할 때 (집값, 온도, 매출 등)
- **Classification** 계열: 카테고리를 분류할 때 (스팸/정상, 개/고양이/새 등)
- **Advanced** 계열: 임베딩 학습, 생성 모델, 분포 매칭 등 특수한 목적

---

## 3. Regression 손실함수

### MSE (Mean Squared Error)

가장 기본적인 손실함수입니다. 예측값과 실제값의 차이를 **제곱**해서 평균을 냅니다.

$$L = \frac{1}{n}\sum_{i=1}^{n}(y_i - \hat{y}_i)^2$$

**특징**: 큰 오차에 큰 패널티를 줍니다. 오차가 2배가 되면 Loss는 4배가 됩니다. 이상치(outlier)에 민감하다는 뜻이기도 합니다.

```python
# PyTorch
import torch.nn as nn
criterion = nn.MSELoss()
loss = criterion(y_pred, y_true)

# TensorFlow
import tensorflow as tf
loss_fn = tf.keras.losses.MeanSquaredError()
loss = loss_fn(y_true, y_pred)
```

### MAE (Mean Absolute Error)

예측값과 실제값의 차이의 **절대값**을 평균냅니다.

$$L = \frac{1}{n}\sum_{i=1}^{n}|y_i - \hat{y}_i|$$

**특징**: 모든 오차에 동일한 가중치를 줍니다. 이상치에 MSE보다 강건(robust)합니다. 다만 미분이 0에서 불연속이라 최적화가 MSE보다 약간 불안정할 수 있습니다.

```python
# PyTorch
criterion = nn.L1Loss()
loss = criterion(y_pred, y_true)

# TensorFlow
loss_fn = tf.keras.losses.MeanAbsoluteError()
loss = loss_fn(y_true, y_pred)
```

### Huber Loss

MSE와 MAE의 장점을 합친 하이브리드입니다. 오차가 작을 때는 MSE처럼, 클 때는 MAE처럼 동작합니다.

$$L = \begin{cases} \frac{1}{2}(y - \hat{y})^2 & \text{if } |y - \hat{y}| \leq \delta \\ \delta \cdot (|y - \hat{y}| - \frac{1}{2}\delta) & \text{otherwise}\end{cases}$$

**특징**: 이상치에 강건하면서도 작은 오차에서는 매끄럽게 최적화됩니다. `delta` 파라미터로 MSE↔MAE 경계를 조절할 수 있습니다.

```python
# PyTorch
criterion = nn.HuberLoss(delta=1.0)
loss = criterion(y_pred, y_true)

# TensorFlow
loss_fn = tf.keras.losses.Huber(delta=1.0)
loss = loss_fn(y_true, y_pred)
```

### MSE vs MAE vs Huber 비교

![MSE vs MAE vs Huber 비교](/images/blog/loss-function-deep-dive/fig03-mse-mae-huber.png)

슬라이더로 에러 값을 바꿔보면 직관이 잡힙니다. MSE는 에러가 커질수록 **기하급수적으로** Loss가 커지는 반면, MAE는 **선형적으로** 증가합니다. Huber는 그 중간을 부드럽게 이어줍니다.

| 상황 | 추천 |
|------|------|
| 일반적인 회귀 문제 | MSE |
| 이상치가 많은 데이터 | MAE 또는 Huber |
| 안정적 학습 + 이상치 대응 | Huber |

---

## 4. Classification 손실함수

### Binary Cross-Entropy (BCE)

이진 분류(스팸/정상, 양성/음성 등)에 사용합니다.

$$L = -\frac{1}{n}\sum_{i=1}^{n}[y_i \log(\hat{y}_i) + (1-y_i)\log(1-\hat{y}_i)]$$

직관적으로 이해하면: 정답이 1인데 모델이 0.01이라고 예측하면 `-log(0.01) = 4.6`으로 Loss가 크고, 0.99라고 예측하면 `-log(0.99) = 0.01`로 Loss가 거의 없습니다. **확신이 틀리면 크게 벌 받는** 구조입니다.

```python
# PyTorch
criterion = nn.BCEWithLogitsLoss()  # Sigmoid + BCE 통합 (수치 안정적)
loss = criterion(logits, y_true)

# TensorFlow
loss_fn = tf.keras.losses.BinaryCrossentropy(from_logits=True)
loss = loss_fn(y_true, logits)
```

> 💡 **Tip**: `BCELoss`보다 `BCEWithLogitsLoss`(PyTorch) 또는 `from_logits=True`(TF)를 쓰세요. 내부적으로 log-sum-exp 트릭을 사용해 **수치 안정성**이 훨씬 좋습니다.

### Categorical Cross-Entropy (CCE)

3개 이상의 클래스를 분류할 때 사용합니다. BCE를 다중 클래스로 확장한 것입니다.

$$L = -\frac{1}{n}\sum_{i=1}^{n}\sum_{c=1}^{C}y_{i,c}\log(\hat{y}_{i,c})$$

```python
# PyTorch
criterion = nn.CrossEntropyLoss()  # Softmax + NLLLoss 통합
loss = criterion(logits, y_true)  # y_true는 클래스 인덱스 (Long 텐서)

# TensorFlow
loss_fn = tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True)
loss = loss_fn(y_true, logits)  # y_true는 정수 레이블
```

> 💡 **PyTorch 주의사항**: `nn.CrossEntropyLoss()`는 내부에 Softmax를 포함하고 있습니다. 모델 출력에 Softmax를 이미 적용했다면 **이중 적용**이 되어 학습이 망가집니다. logit(raw output)을 그대로 넘기세요.

### Focal Loss

클래스 불균형이 심할 때 사용합니다. 예를 들어 암 검출에서 양성 샘플이 1%밖에 없는 경우, 일반 Cross-Entropy는 "무조건 음성이라고 예측"하는 것만으로 99% 정확도를 달성합니다. Focal Loss는 **쉬운 샘플(잘 맞추는 것)의 가중치를 줄이고, 어려운 샘플에 집중**합니다.

$$L = -\alpha_t(1-p_t)^{\gamma}\log(p_t)$$

`gamma`가 0이면 일반 Cross-Entropy와 동일합니다. 보통 `gamma=2`를 많이 씁니다.

```python
# PyTorch — 직접 구현
class FocalLoss(nn.Module):
    def __init__(self, alpha=0.25, gamma=2.0):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma

    def forward(self, logits, targets):
        bce = nn.functional.binary_cross_entropy_with_logits(
            logits, targets, reduction='none'
        )
        p_t = torch.exp(-bce)
        focal_weight = self.alpha * (1 - p_t) ** self.gamma
        return (focal_weight * bce).mean()

# TensorFlow
loss_fn = tf.keras.losses.BinaryFocalCrossentropy(
    gamma=2.0, from_logits=True
)
```

---

## 5. 손실함수 어떻게 골라야 할까?

![손실함수 선택 가이드](/images/blog/loss-function-deep-dive/fig04-selection-guide.png)

정리하면:

| 문제 유형 | 기본 선택 | 특수 상황 |
|-----------|-----------|-----------|
| **회귀** (숫자 예측) | MSE | 이상치 있으면 Huber |
| **이진 분류** (2개) | BCE | 불균형 데이터면 Focal |
| **다중 분류** (3+개) | CCE | 불균형이면 가중치 CCE |
| **임베딩 학습** | Triplet / Contrastive | — |
| **생성 모델 (VAE)** | Reconstruction + KL | — |

---

## 6. 손실함수와 Gradient Descent의 관계

손실함수의 역할은 "얼마나 틀렸는지" 알려주는 것이고, **Gradient Descent**는 "어느 방향으로 가중치를 수정해야 Loss가 줄어드는지" 알려줍니다. 둘은 항상 함께 동작합니다.

![Gradient Descent 시각화](/images/blog/loss-function-deep-dive/fig05-gradient-descent.png)

위 시각화에서 보라색 곡선은 Loss 함수 `L(w) = (w-1)²`이고, 주황색 점은 현재 가중치 위치입니다. **Step** 버튼을 누를 때마다 gradient descent가 한 스텝 진행되며, 공이 곡선의 최저점(w=1, Loss=0)을 향해 굴러갑니다.

**Learning Rate의 영향**을 직접 실험해보세요.

- **너무 작으면** (0.01): 수렴은 하지만 엄청 느립니다. 실전에서는 학습 시간이 몇 배로 늘어납니다.
- **적절하면** (0.1): 안정적으로 빠르게 수렴합니다.
- **너무 크면** (0.5): 최저점을 지나쳐서 진동하거나, 심하면 발산합니다.

```python
# PyTorch에서 Optimizer와 Loss 함께 쓰기
model = MyModel()
criterion = nn.MSELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

for epoch in range(100):
    y_pred = model(X)            # Forward pass
    loss = criterion(y_pred, y)  # Loss 계산
    optimizer.zero_grad()        # 그래디언트 초기화
    loss.backward()              # Backpropagation
    optimizer.step()             # 가중치 업데이트
```

```python
# TensorFlow에서 동일한 과정
model = MyModel()
loss_fn = tf.keras.losses.MeanSquaredError()
optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)

for epoch in range(100):
    with tf.GradientTape() as tape:
        y_pred = model(X)              # Forward pass
        loss = loss_fn(y, y_pred)      # Loss 계산
    grads = tape.gradient(loss, model.trainable_variables)  # Backprop
    optimizer.apply_gradients(zip(grads, model.trainable_variables))  # Update
```

---

## 7. Advanced 손실함수

### Triplet Loss

임베딩 공간에서 **비슷한 것은 가깝게, 다른 것은 멀게** 만들고 싶을 때 사용합니다. 얼굴 인식(FaceNet), 이미지 검색 등에 핵심적으로 쓰입니다.

$$L = \max(d(a, p) - d(a, n) + \text{margin}, 0)$$

- `a` (anchor): 기준 샘플
- `p` (positive): anchor와 같은 클래스
- `n` (negative): anchor와 다른 클래스

```python
# PyTorch
criterion = nn.TripletMarginLoss(margin=1.0)
loss = criterion(anchor, positive, negative)
```

### Contrastive Loss

SimCLR, CLIP 같은 **자기지도학습(Self-supervised Learning)** 모델의 핵심입니다. 같은 이미지의 두 증강 버전은 가깝게, 다른 이미지와는 멀게 학습합니다.

### KL Divergence

두 확률 분포 간의 차이를 측정합니다. VAE(Variational Autoencoder)에서 잠재 공간의 분포를 정규분포에 가깝게 만들 때 핵심적으로 사용됩니다.

$$D_{KL}(P \| Q) = \sum P(x) \log \frac{P(x)}{Q(x)}$$

```python
# PyTorch
criterion = nn.KLDivLoss(reduction='batchmean')
loss = criterion(log_pred, target)  # log_pred는 log-probabilities

# TensorFlow
loss_fn = tf.keras.losses.KLDivergence()
loss = loss_fn(y_true, y_pred)
```

---

## 8. 실전에서 자주 하는 실수

### 실수 1: Softmax 이중 적용

```python
# ❌ 잘못된 코드
model_output = model(X)
output = torch.softmax(model_output, dim=1)
loss = nn.CrossEntropyLoss()(output, y)  # Softmax가 또 적용됨!

# ✅ 올바른 코드
model_output = model(X)
loss = nn.CrossEntropyLoss()(model_output, y)  # logit을 그대로 전달
```

### 실수 2: Reduction 옵션 무시

PyTorch의 `reduction` 파라미터는 배치 내 Loss를 어떻게 합산할지 결정합니다. 기본값은 `'mean'`이지만, 클래스별 가중치를 직접 적용할 때는 `'none'`으로 두고 수동 처리해야 할 수 있습니다.

### 실수 3: 문제 유형과 손실함수 불일치

회귀 문제에 Cross-Entropy를 쓰거나, 분류 문제에 MSE를 쓰면 학습이 매우 비효율적이거나 아예 수렴하지 않습니다. 문제 유형에 맞는 손실함수를 반드시 확인해야합니다.

### 실수 4: NaN Loss

Loss가 NaN이 되는 가장 흔한 원인은 `log(0)` 입니다. 모델 출력이 정확히 0이나 1이 되면 로그에서 무한대가 나옵니다.

```python
# 해결책 1: from_logits=True 사용 (내부적으로 수치 안정 처리)
# 해결책 2: epsilon 추가
loss = -torch.mean(y * torch.log(y_pred + 1e-7))
```

---

## 마치며

손실함수는 AI 학습의 **나침반**입니다. 모델이 아무리 복잡해도, 결국 학습의 방향은 손실함수가 결정합니다.

정리하면:

- **손실함수 = "얼마나 틀렸는지"를 숫자로 표현하는 함수**
- 회귀는 MSE/MAE/Huber, 분류는 BCE/CCE, 특수 목적은 Triplet/Contrastive/KL
- 손실함수 선택이 잘못되면 모델 구조가 아무리 좋아도 학습이 안 됨
- 실전에서는 Softmax 이중 적용, NaN 발생 등 사소한 실수를 조심

---

## 참고 자료

- [PyTorch Loss Functions Documentation](https://pytorch.org/docs/stable/nn.html#loss-functions)
- [TensorFlow Keras Losses](https://www.tensorflow.org/api_docs/python/tf/keras/losses)
- Lin, T.-Y. et al. (2017). "Focal Loss for Dense Object Detection"
- Schroff, F. et al. (2015). "FaceNet: A Unified Embedding for Face Recognition and Clustering"