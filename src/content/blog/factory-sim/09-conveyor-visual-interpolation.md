---
title: "공장 시뮬레이션 게임 개발기 Phase 2.4 — 한 칸씩 점프하는 진실과 부드럽게 흐르는 그림: 시뮬과 렌더 분리"
description: "8편의 이산 슬롯은 틱마다 순간이동한다. 그 끊김을 매 프레임 부드럽게 메우는 시각 보간 기록. 시뮬레이션은 그대로 두고 렌더만 따로 보간하는 분리, '어디서 왔나'를 박제하는 이전 상태 스냅샷, FName만으론 풀리지 않는 정체성 문제와 VisualId, 그리고 두 점 사이를 시간으로 메우는 alpha lerp."
date: 2026-06-09
category: UE5
series: factory-sim
seriesPart: 9
tags: [UE5, C++, 컨베이어, 시각보간, 렌더링, 시뮬레이션]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 2: 머신 시스템**
> - 6편: [AI 생성 3D 에셋 파이프라인](/blog/factory-sim/06-meshy-glb-asset-pipeline)
> - 7편: [포트 셀 일원화 — 화살표·도킹·그래프를 하나의 진실로](/blog/factory-sim/07-port-cell-unification)
> - 8편: [컨베이어가 아이템을 나르는 법 — 이산 슬롯과 풀(pull) 모델](/blog/factory-sim/08-conveyor-item-transport)
> - **9편: 한 칸씩 점프하는 진실과 부드럽게 흐르는 그림 — 시뮬과 렌더 분리** ← 현재 글
> - (이어지는 편: 경로 빌드 — 예정)
>
> *Phase 1 — 그리드 시스템: [1편](/blog/factory-sim/01-grid-system-overview) · [2편](/blog/factory-sim/02-grid-data-structure-and-transaction) · [3편](/blog/factory-sim/03-material-grid-visualization) · [4편](/blog/factory-sim/04-mouse-input-build-controller) · [5편](/blog/factory-sim/05-codex-adversarial-review)*

## 1. 들어가며 — 8편이 남긴 질문

[8편](/blog/factory-sim/08-conveyor-item-transport)에서 컨베이어는 벨트를 칸(슬롯)으로 쪼개고, 아이템을 *틱마다 한 칸씩* 점프시켰습니다. `SecondsPerGrid`(기본 1초)마다 슬롯 `i`의 아이템이 슬롯 `i+1`로 순간이동하죠. 시뮬레이션은 정수 인덱스 위에서만 도니까 머신 도착 판정도 깔끔하고, 막힘(backpressure)도 공짜로 따라 나왔습니다.

대신 *유일한* 대가가 있었어요. **눈에 뚝뚝 끊겨 보인다.** 1초에 한 번, 아이템이 칸에서 칸으로 텔레포트하니까요. 그래서 8편 마지막에 질문을 하나 던졌습니다 — "한 칸씩 점프하는 진실(이산)과 부드럽게 흐르는 그림(연속)을 **어떻게 동시에** 갖느냐."

이번 편이 그 답입니다. 핵심은 한 문장이에요. **시뮬레이션은 손대지 않는다.** 슬롯은 여전히 1초마다 점프하게 두고, *화면에 보이는 위치만* 매 프레임 따로 계산해서 칸과 칸 사이를 미끄러지게 메웁니다. 진실은 이산으로 남고, 그림만 연속으로 덧씌우는 거죠.

8편에서 "시각용이라 다음 편"이라며 슬쩍 숨겨뒀던 조각들 — `ItemVisualIds`, `MoveItemsOneGrid`의 '이전 상태 스냅샷', `GetCurrentMoveAlpha` — 이 편의 주인공이 바로 그것들입니다.

---

## 2. 두 개의 시계 — 시뮬과 렌더를 가른다

먼저 큰 그림. 이 컨베이어에는 **두 개의 시계**가 따로 돕니다.

- **시뮬 시계.** 타이머가 굴립니다(`SecondsPerGrid` 간격). `MoveItemsOneGrid` 한 번 = 한 틱. 8편의 그 배출→시프트→인입. 띄엄띄엄, 결정적으로.
- **렌더 시계.** 액터의 `Tick`이 굴립니다. 매 프레임(60fps면 초당 60번). 시뮬 상태를 *읽어서* 화면 위치만 다시 그려요.

```cpp
void AConveyor::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    RefreshItemVisualInstances();   // 매 프레임, 아이템 비주얼을 다시 배치
    if (bShowDebugStateText)
    {
        UpdateDebugTextFacingPlayer();
    }
}
```

`Tick`은 슬롯을 **건드리지 않습니다.** `ItemSlots`를 읽기만 하고, "지금 이 아이템을 화면 어디에 그릴까"만 계산해서 `RefreshItemVisualInstances`로 인스턴스 메시를 다시 깔아요. 슬롯을 바꾸는 건 오직 타이머의 `MoveItemsOneGrid`뿐이고요.

이 분리가 왜 중요하냐면, **결정성을 지키면서 부드러움을 얻기 때문**입니다. 만약 매 프레임 위치를 조금씩 더하는 연속 이동(`위치 += 속도 * DeltaTime`)으로 갔다면, 프레임률이 흔들릴 때마다 누적 오차가 생기고 "지금 몇 번째 칸이냐"를 좌표에서 역산해야 했을 거예요(8편에서 안 가기로 한 길). 지금 구조에선 시뮬은 정수 슬롯 위에서 또박또박 돌고, 렌더는 그 결과를 매 프레임 *다시 계산*할 뿐이라 누적 오차 자체가 없습니다.

> 핵심은 **렌더가 시뮬 상태의 순수 함수**라는 점이에요. 같은 슬롯 상태 + 같은 타이머 진행도를 주면 언제 호출하든 같은 화면 위치가 나옵니다. 렌더는 아무것도 *기억하지* 않고, 매 프레임 바닥부터 다시 그려요(`ClearInstances` 후 재배치). 그래서 프레임을 건너뛰든 느려지든 그림이 어긋날 일이 없습니다.

그럼 렌더가 매 프레임 풀어야 할 문제는 딱 두 개로 좁혀집니다. **(1)** 이 아이템이 *어디서 어디로* 가는 중인가(시작점·끝점). **(2)** 그 사이 *어디까지* 왔나(진행도). 3~5절이 각각 이걸 풉니다.

---

## 3. 이전 상태 스냅샷 — "어디서 왔나"를 박제한다

끝점은 쉽습니다. 아이템이 *지금* 든 슬롯의 중심, 그게 끝점이에요. 문제는 **시작점** — "방금 전 이 아이템이 있던 칸"입니다. 그런데 시뮬이 한 번 점프하고 나면 슬롯은 이미 새 상태로 덮어써졌어요. 옛 위치는 사라지고 없죠.

그래서 점프 *직전에* 옛 상태를 박제해 둡니다. `MoveItemsOneGrid`가 슬롯을 건드리기 전에, 현재 상태를 통째로 `Previous*`에 복사해요.

```cpp
void AConveyor::MoveItemsOneGrid()
{
    // ... (양끝 머신 가드 생략 — 8편)

    // 변경 전 상태를 박제: 렌더가 "어디서 왔나"의 기준으로 쓴다
    PreviousItemSlots     = ItemSlots;
    PreviousItemVisualIds = ItemVisualIds;

    // ... 배출 → 시프트 → 인입 (8편의 그 세 단계)

    LastItemMoveWorldTime = GetWorld()->GetTimeSeconds();   // 이 틱이 일어난 시각에 도장
    RefreshItemVisualInstances();
    UpdateDebugStateText();
}
```

두 줄로 이 틱이 끝나면 그림이 어떻게 나뉘는지 보면:

- `PreviousItemSlots` / `PreviousItemVisualIds` — **점프하기 전**의 슬롯 배치 (= 아이템들의 *출발 칸*)
- `ItemSlots` / `ItemVisualIds` — **점프한 후**의 슬롯 배치 (= 아이템들의 *도착 칸*)
- `LastItemMoveWorldTime` — 이 틱이 일어난 **월드 시각** (= 보간의 *기준 시점*)

이제 렌더는 이 세 개만 있으면 "출발 칸 → 도착 칸을, 마지막 틱 이후 흐른 시간만큼" 보간할 수 있습니다. 스냅샷이 *출발점*을, 현재 상태가 *도착점*을, 시각 도장이 *진행도*의 기준을 줍니다.

그런데 여기서 함정이 하나 있어요. `PreviousItemSlots`는 `TArray<FName>`입니다. "이전 틱에 슬롯 1에 철광석이 있었다"는 건 알아요. 그런데 *지금* 슬롯 2에 있는 철광석이 **그때 그 철광석**인지, 아니면 전혀 다른 철광석인지 — 그걸 `FName`만으론 알 수가 없습니다. 다음 절의 주제입니다.

---

## 4. 정체성 문제 — `FName`은 종류만 안다

8편에서 슬롯을 이렇게 정의했죠. `ItemSlots`는 `TArray<FName>`이고, 각 칸은 아이템 **종류**를 ID 하나(`FName`)로만 표현한다고. 무게도, 좌표도, 개체 액터도 없이 `"IronOre"` 같은 이름 하나뿐이라고요.

시뮬레이션엔 이게 **완벽히 충분**합니다. 8편의 배출·시프트·인입 어디를 봐도 "이게 *어느* 철광석인지"는 한 번도 안 물어요. "끝 슬롯에 뭔가 있나(`IsNone`)", "받을 수 있나"만 따지지 개체를 구분할 일이 없거든요. 종류만 알면 끝입니다.

그런데 **렌더는 다릅니다.** 부드러운 이동을 그리려면 "슬롯 2의 이 아이템이 *직전에 어느 칸에 있었나*"를 알아야 해요. 시작점을 찾아야 하니까. 그런데 벨트가 `[IronOre, IronOre, IronOre]`처럼 같은 종류로 채워져 있다고 해봅시다. 이전 스냅샷도 `[IronOre, IronOre, IronOre]`. 지금 슬롯 2의 `IronOre`는 이전 슬롯 1에서 온 걸까요, 슬롯 2에 그대로 있던 걸까요? **`FName`만 봐선 영영 알 수 없습니다.** 셋 다 똑같은 이름이니까요.

이게 정체성 문제예요. **종류(type)는 같아도 개체(identity)는 다르다.** 시뮬은 종류만 알면 되지만, 보간은 개체를 추적해야 합니다. 그래서 슬롯과 *나란히 가는* 두 번째 배열을 따로 둡니다 — `ItemVisualIds`.

```cpp
// 슬롯과 1:1로 짝지어진 평행 배열들
UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Conveyor|Items")
TArray<FName> ItemSlots;          // 종류: 시뮬이 쓴다

UPROPERTY(Transient)
TArray<int32> ItemVisualIds;      // 정체성: 렌더가 쓴다

UPROPERTY(Transient)
TArray<int32> PreviousItemVisualIds;   // 직전 틱의 정체성 배치
```

`ItemVisualIds[i]`는 슬롯 `i`에 든 아이템의 **고유 번호**입니다. 종류가 아니라 개체 도장이에요. 세 군데에서 관리됩니다.

**(1) 인입 — 새 정체성 발급.** 소스 머신에서 막 꺼낸 아이템에 다음 번호를 찍어줍니다(`NextItemVisualId++`). 1, 2, 3, … 단조 증가라 절대 겹치지 않아요.

```cpp
if (ItemSlots[0].IsNone())
{
    FName NewItem = NAME_None;
    if (SourceMachine->TryTakeFirstOutputItem(NewItem))
    {
        ItemSlots[0]     = NewItem;
        ItemVisualIds[0] = NextItemVisualId++;   // ← 새 개체에 도장
    }
}
```

**(2) 시프트 — 정체성도 같이 옮긴다.** 8편이 "시각용이라 생략"이라며 숨겨둔 줄이 바로 이겁니다. 슬롯을 한 칸 끌어올 때, `ItemVisualIds`도 똑같이 끌어와요. 아이템이 칸을 옮겨도 *번호는 따라갑니다.*

```cpp
for (int32 Index = LastIndex; Index > 0; --Index)
{
    if (ItemSlots[Index].IsNone() && !ItemSlots[Index - 1].IsNone())
    {
        ItemSlots[Index]     = ItemSlots[Index - 1];
        ItemSlots[Index - 1] = NAME_None;
        ItemVisualIds[Index]     = ItemVisualIds[Index - 1];   // ← 8편이 숨긴 줄
        ItemVisualIds[Index - 1] = INDEX_NONE;
    }
}
```

**(3) 배출 — 정체성 소멸.** 끝 슬롯이 타깃 머신으로 넘어가면 그 번호는 `INDEX_NONE`으로 지웁니다. 벨트를 떠났으니 추적할 개체도 없죠.

이제 정체성 문제가 풀립니다. 슬롯 2의 아이템 번호가 `42`라면, 이전 스냅샷(`PreviousItemVisualIds`)에서 `42`를 찾아봐요. 그게 슬롯 1에 있었으면 "슬롯 1 → 슬롯 2로 움직이는 중", 슬롯 2에 그대로 있었으면 "안 움직임". `FName`이 셋 다 `IronOre`라도, 번호 `42`는 **세상에 하나뿐**이라 어느 칸에서 왔는지 정확히 짚힙니다.

> 정리하면 — `ItemSlots`(`FName`)는 *무엇*을 나르나, `ItemVisualIds`(`int32`)는 *어느 개체*를 그리나. 시뮬과 렌더가 같은 슬롯 배열을 공유하되, 각자 필요한 정보를 평행 배열로 따로 듭니다. 시뮬이 종류로 충분한 자리에서 굳이 개체까지 들지 않고, 렌더가 개체가 필요한 자리에서 따로 챙기는 — 관심사가 깔끔하게 갈린 구조예요.

---

## 5. alpha와 lerp — 두 점 사이를 시간으로 메운다

시작점·끝점·정체성이 다 모였으니, 이제 매 프레임 위치를 그립니다. 두 단계예요.

**먼저 진행도(alpha).** 마지막 틱 이후 얼마나 흘렀나를 0~1로 정규화합니다. 틱 직후면 0(출발 칸), 다음 틱 직전이면 1(도착 칸).

```cpp
float AConveyor::GetCurrentMoveAlpha() const
{
    if (SecondsPerGrid <= KINDA_SMALL_NUMBER) { return 1.0f; }

    const UWorld* World = GetWorld();
    if (!World) { return 1.0f; }

    const float RawAlpha = FMath::Clamp(
        (World->GetTimeSeconds() - LastItemMoveWorldTime) / SecondsPerGrid, 0.0f, 1.0f);

    // (ItemVisualLerpExponent로 살짝 이징 거는 옵션은 생략 — 곁가지)
    return RawAlpha;
}
```

`(지금 시각 − 마지막 틱 시각) / SecondsPerGrid`. 3절에서 찍어둔 `LastItemMoveWorldTime` 도장이 여기서 쓰입니다. 분모가 한 틱의 길이니까, 결과는 "이번 칸 이동을 몇 % 진행했나"가 되죠. `Clamp`로 0~1에 가둬서 타이머가 살짝 늦게 와도 1을 넘지 않게 합니다.

**그다음 보간(lerp).** 매 프레임, 든 아이템마다 시작점→끝점을 alpha만큼 선형 보간해 인스턴스를 깝니다.

```cpp
void AConveyor::RefreshItemVisualInstances()
{
    ItemVisualInstances->ClearInstances();   // 매 프레임 바닥부터 다시
    if (!HasVisibleItems()) { return; }

    const float MoveAlpha = GetCurrentMoveAlpha();
    // ... 아이템 스케일 계산 생략

    for (int32 SlotIndex = 0; SlotIndex < ItemSlots.Num(); ++SlotIndex)
    {
        if (ItemSlots[SlotIndex].IsNone()) { continue; }

        const FVector StartLocation = ResolveItemVisualStartLocation(SlotIndex);   // 어디서
        const FVector EndLocation   = GetSlotLocalCenter(SlotIndex);               // 어디로
        const FVector ItemLocation  = FMath::Lerp(StartLocation, EndLocation, MoveAlpha);   // 그 사이
        ItemVisualInstances->AddInstance(FTransform(FRotator::ZeroRotator, ItemLocation, /*scale*/ItemVisualScale));
    }
}
```

끝점 `GetSlotLocalCenter(SlotIndex)`는 단순히 현재 슬롯 칸의 월드 중심이에요. 관건은 시작점 — 4절의 정체성 추적이 여기서 일합니다.

```cpp
FVector AConveyor::ResolveItemVisualStartLocation(int32 SlotIndex) const
{
    const FVector CurrentLocation = GetSlotLocalCenter(SlotIndex);

    const int32 VisualId = ItemVisualIds[SlotIndex];   // (유효성 가드 생략)
    if (VisualId == INDEX_NONE) { return CurrentLocation; }

    // 직전 틱에 이 번호가 어느 슬롯에 있었나?
    const int32 PreviousSlotIndex = FindPreviousVisualSlotIndex(VisualId);
    if (PreviousSlotIndex != INDEX_NONE)
    {
        return GetSlotLocalCenter(PreviousSlotIndex);   // 그 칸에서 출발
    }

    if (SlotIndex == 0)
    {
        return GetIncomingItemLocalCenter();            // 막 들어온 아이템 → 벨트 밖에서 (6절)
    }

    return CurrentLocation;
}
```

`FindPreviousVisualSlotIndex`는 그냥 `PreviousItemVisualIds`를 훑어 같은 번호의 인덱스를 찾는 선형 탐색이에요(슬롯 수가 작으니 충분).

```cpp
int32 AConveyor::FindPreviousVisualSlotIndex(int32 VisualId) const
{
    for (int32 Index = 0; Index < PreviousItemVisualIds.Num(); ++Index)
    {
        if (PreviousItemVisualIds[Index] == VisualId)
        {
            return Index;
        }
    }
    return INDEX_NONE;
}
```

이 한 함수에 보간의 전부가 들어 있습니다. 번호 `42`가 직전에 슬롯 1에 있었으면, 시작점 = 슬롯 1 중심, 끝점 = (지금) 슬롯 2 중심. alpha가 0→1로 가는 1초 동안 `Lerp`가 두 칸 사이를 매끄럽게 채우고, 매 프레임 `Tick`이 이걸 다시 계산해 인스턴스를 다시 깝니다. 슬롯은 1초에 한 번 점프하지만, *화면 속 큐브*는 60fps로 미끄러져요. 진실은 이산, 그림은 연속 — 두 시계가 동시에 도는 그림이 완성됩니다.

---

## 6. 가장자리 두 장면 — 인입 슬라이드와 막힘 정지

위 로직이 벨트 가운데에선 깔끔한데, *양 끝*에서 두 가지 특수 상황이 생깁니다. 둘 다 추가 코드 없이 자연스럽게 풀려요.

**① 막 들어온 아이템 — 벨트 밖에서 미끄러져 들어온다.** 소스에서 방금 인입된 아이템은 슬롯 0에 있지만, 이전 스냅샷엔 그 번호가 *없습니다*(직전 틱엔 존재하지 않았으니까). `FindPreviousVisualSlotIndex`가 `INDEX_NONE`을 돌려주죠. 이때 시작점을 슬롯 0 자기 자신으로 잡으면 아이템이 슬롯 0에서 *뿅* 하고 튀어나옵니다 — 보기 싫죠. 그래서 슬롯 0 앞의 *가상 한 칸*을 시작점으로 줍니다.

```cpp
FVector AConveyor::GetIncomingItemLocalCenter() const
{
    // ... (칸 0개/1개 예외 생략)

    const FVector FirstCenter  = GetSlotLocalCenter(0);
    const FVector SecondCenter = GetSlotLocalCenter(1);
    return FirstCenter - (SecondCenter - FirstCenter);   // 0번 칸 너머, 한 칸 더 바깥
}
```

슬롯 0과 슬롯 1 사이 간격만큼 0번에서 *반대로* 한 칸 더 빼면, 벨트 시작점 바로 바깥의 좌표가 나옵니다. 새 아이템은 거기서 출발해 슬롯 0으로 미끄러져 들어와요 — 소스 머신 쪽에서 자연스럽게 흘러나오는 것처럼.

**② 막힌 아이템 — 보간이 알아서 멈춘다.** 8편의 backpressure를 떠올려 보죠. 타깃이 막히면 아이템은 같은 슬롯에 *머뭅니다.* 그럼 보간은 어떻게 될까요? 번호 `42`가 이번 틱에도 슬롯 2, 직전 틱에도 슬롯 2였으니, 시작점 = 슬롯 2, 끝점 = 슬롯 2. **시작점과 끝점이 같습니다.** `Lerp(같은 점, 같은 점, alpha)`는 alpha가 뭐든 그 자리예요. 아이템은 화면에서도 *딱 멈춰* 있습니다.

별도 분기 하나 없이, 8편의 "막히면 슬롯에 머문다"가 이 편의 "막히면 화면에서 멈춘다"로 그대로 이어집니다. 시뮬의 정지가 렌더의 정지로 *공짜로* 번역돼요 — 7·8편에서 반복한 "같은 진실을 두 번 계산하지 말자"가 시뮬↔렌더 경계에서도 똑같이 통하는 셈입니다.

---

## 7. 마치며

이번 편 요약은 셋입니다.

1. **시뮬과 렌더를 가른다.** 슬롯 점프(이산)는 타이머가, 화면 위치(연속)는 매 프레임 `Tick`이 따로 굴린다. 렌더는 시뮬 상태의 *순수 함수*라 아무것도 기억하지 않고 매 프레임 바닥부터 다시 그린다. 덕분에 결정성을 지키면서 부드러움을 얻는다.
2. **정체성은 종류와 다르다.** 시뮬은 `FName`(종류)만으로 충분하지만, 보간은 "이 아이템이 직전에 어느 칸에 있었나"를 알아야 한다. 같은 종류 둘을 `FName`으론 구분 못 하므로, 슬롯과 평행한 `ItemVisualIds`(개체 도장)를 따로 부여해 추적한다.
3. **두 점을 시간으로 메운다.** 점프 직전 상태를 스냅샷으로 박제(`Previous*`)하고, 마지막 틱 이후 흐른 시간을 alpha(0~1)로 정규화해, 시작 칸→도착 칸을 `Lerp`한다. 인입은 벨트 밖에서 슬라이드로, 막힘은 시작점=끝점이라 자연스러운 정지로 — 가장자리까지 추가 코드 없이 맞아떨어진다.

8편이 "흐름을 *어떻게 모델링*하나"였다면, 이번 편은 "그 모델을 *어떻게 보여주나*"였습니다. 모델은 정수 슬롯 위에서 또박또박 돌고, 그림은 그 위에 매 프레임 덧씌운 얇은 보간 한 겹. 시뮬레이션을 더럽히지 않고 비주얼만 갈아끼울 수 있다는 게 이 분리의 진짜 이득이에요 — 나중에 아이템이 호를 그리며 돌든, 살짝 튕기든, 시뮬 코드는 한 줄도 안 건드리고 렌더만 바꾸면 되니까요.

다음 편은 한 발 물러나서, 지금까지 "이미 정해졌다"고 깔고 갔던 것 — 컨베이어 **경로 자체를 어떻게 까느냐**로 갑니다. 마우스로 끈 자취에서 코너를 펴고, 점유 셀을 모으고, 양끝 포트를 찾아 무는 그 빌드 과정으로요.

— JJ
