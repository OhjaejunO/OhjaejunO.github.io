---
title: "[UE5 C++] 레이싱 게임(스플릿 세컨드) 플레이어 차량 시스템 구현 회고"
description: "UE5 + C++로 아케이드 레이싱 게임을 만들며 구현한 플레이어 차량 시스템 — 드리프트, 부스트, 파괴/리스폰, 카메라 연출까지"
date: 2026-03-19
category: 회고
series: split-second
seriesPart: 1
tags: [UE5, C++, ChaosVehicles, EnhancedInput, Niagara]
---

> 🏎️ 2차 프로젝트로 언리얼 엔진 5 + C++를 사용해 아케이드 레이싱 게임 **"스플릿 세컨드"**를 제작했습니다.
> 저는 **플레이어 차량 시스템** 전반을 담당했고, 이 글에서는 제가 구현한 기능들과 그 과정에서의 고민, 해결 방법을 정리합니다.

---

## 📌 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | Split Second (스플릿 세컨드) |
| 장르 | 아케이드 레이싱 |
| 엔진 | Unreal Engine 5 |
| 언어 | C++ |
| 담당 파트 | 플레이어 차량 시스템 |
| 기반 클래스 | `AWheeledVehiclePawn` (Chaos Vehicle) |

---

## 🧩 내가 구현한 기능 목록

1. **차량 기본 조작** (가속, 브레이크, 조향)
2. **드리프트 시스템** (진입 → 유지 → 탈출 부스트)
3. **파워플레이 게이지 & 부스트**
4. **차량 파괴 & 리스폰 시스템**
5. **카메라 연출** (FOV 변화, 쉐이크, 후방 카메라)
6. **이펙트 & 사운드** (드리프트 연기, 엔진음, 부스트음)
7. **브레이크 라이트 시스템**
8. **타이틀 UI 위젯** (Press Any Key → 로딩 → 맵 전환)

---

## 1. 차량 기본 조작 — Enhanced Input 기반

### 설계 의도

UE5의 **Enhanced Input System**을 활용해 가속, 브레이크, 조향을 바인딩했습니다. `AWheeledVehiclePawn`을 상속받아 `ChaosWheeledVehicleMovementComponent`를 직접 제어하는 구조입니다.

### 입력 바인딩

```cpp
void ARacingCar::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);
    if (UEnhancedInputComponent* EnhancedInputComponent = Cast<UEnhancedInputComponent>(PlayerInputComponent))
    {
        // 가속
        EnhancedInputComponent->BindAction(IA_Throttle, ETriggerEvent::Triggered, this, &ARacingCar::Throttle);
        EnhancedInputComponent->BindAction(IA_Throttle, ETriggerEvent::Completed, this, &ARacingCar::Throttle);
        // 브레이크
        EnhancedInputComponent->BindAction(IA_Brake, ETriggerEvent::Triggered, this, &ARacingCar::Brake);
        EnhancedInputComponent->BindAction(IA_Brake, ETriggerEvent::Completed, this, &ARacingCar::Brake);
        // 조향
        EnhancedInputComponent->BindAction(IA_Steer, ETriggerEvent::Triggered, this, &ARacingCar::Steer);
        EnhancedInputComponent->BindAction(IA_Steer, ETriggerEvent::Completed, this, &ARacingCar::Steer);
    }
}
```

`Triggered`와 `Completed` 두 이벤트를 모두 바인딩한 이유는, 키를 뗐을 때 입력값이 0으로 돌아오도록 하기 위해서입니다.

### 조향 — 물리 기반 회전 보정

단순히 `SetSteeringInput`만 호출하면 차가 팽이처럼 도는 문제가 있었습니다. 이를 해결하기 위해 **각속도 제어**와 **진행 방향 보정(Velocity Alignment)** 두 가지 기법을 적용했습니다.

```cpp
void ARacingCar::Steer(const FInputActionValue& Value)
{
    float SteerValue = Value.Get<float>();
    ChaosMovement->SetSteeringInput(SteerValue);
    // 1. 각속도(Yaw) 제어: 팽이 현상 방지
    float MaxYawRate = bISDrifting ? 90.0f : 60.0f;
    float TargetYawRate = SteerValue * MaxYawRate;
    FVector AngularVel = GetMesh()->GetPhysicsAngularVelocityInDegrees();
    float NewYawVel = FMath::FInterpTo(AngularVel.Z, TargetYawRate, GetWorld()->GetDeltaSeconds(), 10.0f);
    GetMesh()->SetPhysicsAngularVelocityInDegrees(FVector(AngularVel.X, AngularVel.Y, NewYawVel));
    // 2. 진행 방향 보정 — 레일 위를 달리는 느낌
    FVector CurrentVelocity = GetVelocity();
    float Speed = CurrentVelocity.Size();
    if (Speed > 1000.0f)
    {
        FVector ForwardVector = GetActorForwardVector();
        float AlignmentStrength = bISDrifting ? 1.5f : 5.0f;
        FVector DesiredVelocity = ForwardVector * Speed;
        FVector NewVelocity = FMath::VInterpTo(CurrentVelocity, DesiredVelocity, GetWorld()->GetDeltaSeconds(), AlignmentStrength);
        NewVelocity.Z = CurrentVelocity.Z; // Z축 보존 (경사로/점프 대응)
        GetMesh()->SetPhysicsLinearVelocity(NewVelocity);
    }
}
```

**핵심 포인트:**

![선형 보간(FInterpTo) 개념](/images/blog/split-second-player-vehicle/fig01-finterp.svg)

> 📐 **선형 보간(FInterpTo) 개념**

- `FInterpTo`를 사용해 각속도를 부드럽게 보간하여 급격한 회전을 방지
- 드리프트 중에는 `AlignmentStrength`를 낮춰(1.5f) 약간 미끄러지는 느낌을, 평소에는 높여(5.0f) 꽉 붙잡는 느낌을 구현
- Z축 속도는 별도 보존하여 경사로나 점프 상황에서도 자연스럽게 동작

---

## 2. 드리프트 시스템

### 전체 흐름

```
드리프트 키 입력 → 뒷바퀴 마찰력 감소 + 토크 부여 (진입)
                → 속도/각도 조건 충족 시 드리프트 상태 전환
                → 게이지 충전 (유지)
                → 키를 떼면 마찰력 복구 + 탈출 부스트 (탈출)
```

### 드리프트 진입

```cpp
void ARacingCar::StartDrift()
{
    bDriftKeyPressed = true;
    // 순간적인 토크로 뒤를 살짝 날려줌
    float EntrySide = ChaosMovement->GetSteeringInput();
    GetMesh()->AddTorqueInDegrees(FVector(0, 0, EntrySide * 50000000.0f), NAME_None, false);
    // 뒷바퀴 마찰력 감소
    ChaosMovement->SetWheelFrictionMultiplier(2, DriftFrictionScale); // 0.05f
    ChaosMovement->SetWheelFrictionMultiplier(3, DriftFrictionScale);
}
```

드리프트 진입 시 조향 방향에 따라 **순간 토크**를 가해서 차 뒤가 자연스럽게 빠지도록 했습니다. 동시에 뒷바퀴(인덱스 2, 3)의 마찰력을 `0.05f`까지 낮춰 미끄러짐을 유도합니다.

### 드리프트 판정 (Tick에서 처리)

```cpp
// Tick 내부
if (bDriftKeyPressed && CurrSpeed > 500.0f)
{
    float Threshold = bISDrifting ? 0.98f : 0.94f; // 히스테리시스 적용
    float CosAngle = FVector::DotProduct(velocity.GetSafeNormal(), Forward);
    if (CosAngle < Threshold)
    {
        bISDrifting = true;
        // 게이지 충전 (부스트 중이 아닐 때만)
        if (!bIsBoosting)
        {
            PowerPlayGauge = FMath::Clamp(PowerPlayGauge + (DriftGaugeRate * DeltaTime), 0.0f, 3.0f);
        }
    }
}
```

**드리프트 판정의 핵심은 내적(Dot Product)입니다.**

그런데 내적을 하기 전에, 먼저 벡터를 **정규화(Normalize)** 해야 합니다. 속도가 다른 상황에서도 순수한 방향만 비교하기 위해서입니다.

> 📐 **벡터 정규화(Normalize) 개념**

![벡터 정규화 개념](/images/blog/split-second-player-vehicle/fig02-normalize.svg)

정규화된 벡터끼리 내적하면 순수한 각도(cos θ)를 얻을 수 있습니다:

> 📐 **내적(Dot Product) 개념 — 드리프트 판정 원리**

![내적 개념](/images/blog/split-second-player-vehicle/fig03-dot.svg)

- 차의 진행 방향(`Velocity`)과 차가 바라보는 방향(`Forward`)의 내적값이 1.0에 가까우면 직진, 작을수록 옆으로 미끄러지고 있다는 뜻
- **히스테리시스 패턴** 적용: 진입 임계값(0.94)과 유지 임계값(0.98)을 다르게 설정하여 드리프트가 너무 쉽게 풀리지 않도록 처리

내적이 "두 벡터가 얼마나 같은 방향인지"를 알려준다면, **외적(Cross Product)** 은 "두 벡터의 회전 관계"를 알려줍니다.

**외적이란?**

- 두 벡터 A, B를 외적하면 **두 벡터에 모두 수직인 새로운 벡터**가 만들어집니다
- 3D에서 `A × B`의 결과 벡터 방향은 **오른손 법칙**을 따릅니다
- 게임 개발에서는 주로 결과 벡터의 **Z값 부호**만 사용합니다:
  - `Z > 0` → B가 A의 **왼쪽**에 있음 (반시계 방향)
  - `Z < 0` → B가 A의 **오른쪽**에 있음 (시계 방향)
- 즉, Forward와 Velocity를 외적하면 "차가 어느 쪽으로 미끄러지고 있는지"를 알 수 있습니다

> 📐 **외적(Cross Product) 개념 — 드리프트 방향 판별**

![외적 개념](/images/blog/split-second-player-vehicle/fig04-cross.svg)

이를 활용해 Tick 함수에서 드리프트 방향을 판별하고, **자동 카운터스티어**를 적용했습니다:

```cpp
// Tick 내부 — 고속 드리프트 시 카운터스티어
if (ChaosMovement && CurrSpeed > 2000.f)
{
    FVector CrossProduct = FVector::CrossProduct(Forward, velocity.GetSafeNormal());
    float DriftDirection = CrossProduct.Z; // Z > 0: 좌회전, Z < 0: 우회전
    float CounterSteerAmount = DriftDirection * 0.5f;
    ChaosMovement->SetSteeringInput(FMath::Clamp(CurrentSteer + CounterSteerAmount, -1.0f, 1.0f));
}
```

외적의 Z값이 양수면 차가 왼쪽으로 미끄러지고 있으므로 오른쪽으로, 음수면 오른쪽으로 미끄러지고 있으므로 왼쪽으로 카운터스티어를 걸어줍니다. 이렇게 하면 플레이어가 별도 조작 없이도 드리프트가 자연스럽게 유지됩니다.

### 드리프트 탈출 부스트

```cpp
void ARacingCar::StopDrift()
{
    bDriftKeyPressed = false;
    if (bISDrifting && PowerPlayGauge > 0.1f)
    {
        bIsBoosting = true; // 게이지가 쌓여있으면 부스트 발동
    }
    // 마찰력 복구
    for (int32 i = 0; i < 4; i++)
        ChaosMovement->SetWheelFrictionMultiplier(i, 1.0f);
    if (bWasDriftingLastFrame)
        ApplyExitBoost();
}

void ARacingCar::ApplyExitBoost()
{
    FVector BoostDirection = GetActorForwardVector();
    GetMesh()->AddImpulse(BoostDirection * DriftExitBoostForce, NAME_None, true);
}
```

드리프트를 길게 유지할수록 게이지가 많이 차고, 키를 떼는 순간 쌓인 게이지만큼 부스트가 발동됩니다. 이는 "리스크(드리프트 유지) vs 리워드(부스트)"라는 게임플레이 재미를 만들어줍니다.

---

## 3. 파워플레이 게이지 & 부스트

### 부스트 적용 (Tick)

```cpp
if (bIsBoosting)
{
    if (PowerPlayGauge > 0.0f)
    {
        // 게이지 소모
        PowerPlayGauge = FMath::Max(0.0f, PowerPlayGauge - (BoostConsumptionRate * DeltaTime));
        // 전방으로 강한 힘 적용
        FVector BoostForce = Forward * BoostAccelerationForce;
        GetMesh()->AddForce(BoostForce * GetMesh()->GetMass());
    }
    else
    {
        PowerPlayGauge = 0.0f;
        bIsBoosting = false;
    }
}
```

부스트 시스템의 수치 설계:

- `BoostConsumptionRate`: 초당 1.0 소모 → 게이지 최대(3.0)이면 **3초간 부스트 유지**
- `BoostAccelerationForce`: 3000.0의 힘을 매 프레임 적용
- 질량을 곱해 `AddForce`를 사용함으로써 **차량 무게에 관계없이 일정한 가속감** 보장

---

## 4. 차량 파괴 & 리스폰 시스템

레이싱 게임에서 가장 드라마틱한 순간, 바로 **차량 파괴**입니다. 스플릿 세컨드의 원작처럼 일정 충격 이상이면 차가 터지고, 연출 후 리스폰되는 시스템을 구현했습니다.

### 파괴 판정

```cpp
void ARacingCar::NotifyHit(...)
{
    if (bIsRespawning || bDestroyCar) return; // 중복 방지
    float ImpactForce = NormalImpulse.Size() / GetMesh()->GetMass();
    if (ImpactForce > 3000.0f)
    {
        HandleVehicleDestruction(NormalImpulse, ImpactForce);
    }
}
```

충격량을 질량으로 나눈 값을 기준으로 판정하여, 차량 무게에 관계없이 **일관된 파괴 기준**을 적용했습니다.

### 파괴 연출

```cpp
void ARacingCar::HandleVehicleDestruction(const FVector& NormalImpulse, float ImpactSpeed)
{
    // 1. 파괴 위치 저장 (리스폰용)
    LastDeathLocation = GetActorLocation();
    LastDeathRotation = GetActorRotation();
    LastDeathRotation.Pitch = 0.f;
    LastDeathRotation.Roll = 0.f;
    // 2. 나이아가라 이펙트 + 사운드
    UNiagaraFunctionLibrary::SpawnSystemAttached(DestroyEffect, GetMesh(), ...);
    UGameplayStatics::PlaySound2D(GetWorld(), DestroySound);
    // 3. 차량을 충격 방향으로 날려버리기
    FVector Launch = NormalImpulse.GetSafeNormal() * ImpactSpeed * LaunchMultiplier * 100.0f;
    MeshComp->AddImpulse(Launch, NAME_None, true);
    // 4. 회전력 추가 (뱅글뱅글 돌면서 날아감)
    FVector Torque(FMath::RandRange(-1.f, 1.f), FMath::RandRange(-1.f, 1.f), FMath::RandRange(-1.f, 1.f));
    MeshComp->AddTorqueInRadians(Torque * ImpactSpeed * 50000.f, NAME_None, true);
    // 5. 크래시 영상 재생
    MyMediaPlayer->OpenSource(MyVideoSource);
    VideoWidgetInstance = CreateWidget<UUserWidget>(GetWorld(), VideoWidgetClass);
    VideoWidgetInstance->AddToViewport(99);
}
```

파괴 시 단순히 차를 없애는 것이 아니라:

1. **나이아가라 폭발 이펙트**와 **사운드**로 시각/청각적 피드백
2. **물리 임펄스 + 랜덤 토크**로 차가 뱅글뱅글 돌며 날아가는 연출
3. **미디어 플레이어를 통한 크래시 컷씬 영상** 재생
4. 영상 종료 후 자동 리스폰

### 리스폰

```cpp
void ARacingCar::RespawnVehicle()
{
    // 파괴 지점에서 살짝 뒤로 물러난 위치에서 리스폰
    FVector BackwardDirection = -NewRotation.Vector();
    NewLocation += BackwardDirection * 500.0f; // 뒤로 500 유닛
    NewLocation.Z += 50.0f; // 바닥 끼임 방지
    // 물리 상태 완전 초기화
    ChaosMovement->StopMovementImmediately();
    ChaosMovement->ResetVehicleState();
    MeshComp->SetPhysicsLinearVelocity(FVector::ZeroVector);
    MeshComp->SetPhysicsAngularVelocityInDegrees(FVector::ZeroVector);
    // 물리 시뮬레이션 리셋 (튀는 현상 방지)
    MeshComp->SetSimulatePhysics(false);
    MeshComp->SetSimulatePhysics(true);
    // 텔레포트
    GetMesh()->SetWorldLocationAndRotation(NewLocation, NewRotation, false, nullptr, ETeleportType::TeleportPhysics);
}
```

리스폰 시 겪었던 문제와 해결:

- **바닥에 끼는 문제** → Z축에 50 유닛 오프셋 추가
- **리스폰 직후 차가 튀는 문제** → `SetSimulatePhysics(false → true)`로 물리 상태를 완전 리셋
- **리스폰 위치가 벽 안인 문제** → 파괴 지점에서 후방으로 500 유닛 이동하여 안전한 위치 확보
- **Pitch/Roll이 남아있으면 뒤집혀서 리스폰** → `LastDeathRotation`에서 Pitch, Roll을 0으로 초기화

---

## 5. 카메라 연출 시스템

### FOV 동적 변화

```cpp
// Tick 내부
float TargetFOV = bIsBoosting ? BoostFOV : NormalFOV; // 90 → 100
float CurrentFOV = MyCamera->FieldOfView;
MyCamera->SetFieldOfView(FMath::FInterpTo(CurrentFOV, TargetFOV, DeltaTime, 3.0f));
```

부스트 시 FOV를 90°에서 100°로 부드럽게 확장하여 **속도감**을 극대화했습니다. `FInterpTo`를 사용해 급격한 변화 없이 자연스러운 전환을 구현합니다.

### 카메라 쉐이크

```cpp
// 고속 주행 시 은은한 흔들림
if (CurrSpeed > 2500.0f)
{
    if (HighSpeedShakeClass && !ActiveHighSpeedShake && PC->PlayerCameraManager)
        ActiveHighSpeedShake = PC->PlayerCameraManager->StartCameraShake(HighSpeedShakeClass, 0.1f);
}
// 부스트 시 강한 흔들림
if (bIsBoosting && BoostShakeClass && !ActiveBoostShake)
    ActiveBoostShake = PC->PlayerCameraManager->StartCameraShake(BoostShakeClass, 0.3f);
```

3단계 쉐이크를 적용했습니다:

- **고속 주행(2500+)**: 강도 0.1의 은은한 진동 → 속도를 체감하게 해줌
- **부스트**: 강도 0.3의 중간 진동 → 가속의 쾌감 강화
- **충돌**: 단발성 임팩트 쉐이크 → 타격감 전달

### 후방 카메라

```cpp
void ARacingCar::StartLookBack()
{
    FrontCamera->SetActive(false);
    RearCamera->SetActive(true);
}
```

`SpringArmComponent`를 180도 회전시켜 부착하고, 입력 시 전방/후방 카메라를 전환합니다. 뒤쫓아오는 상대를 확인할 수 있는 레이싱 게임의 필수 기능입니다.

---

## 6. 이펙트 & 사운드

### 드리프트 연기 (Niagara)

```cpp
// 드리프트 중일 때
if (bISDrifting)
{
    if (DriftSmokeLeft && !DriftSmokeLeft->IsActive()) DriftSmokeLeft->Activate();
    if (DriftSmokeRight && !DriftSmokeRight->IsActive()) DriftSmokeRight->Activate();
}
else
{
    if (DriftSmokeLeft && DriftSmokeLeft->IsActive()) DriftSmokeLeft->Deactivate();
    if (DriftSmokeRight && DriftSmokeRight->IsActive()) DriftSmokeRight->Deactivate();
}
```

양쪽 뒷바퀴에 나이아가라 파티클을 부착하여, 드리프트 상태에 따라 활성/비활성을 전환합니다.

### 엔진 사운드 — 속도 기반 피치 변조

```cpp
float CurrentSpeed = GetVelocity().Size();
FVector2D SpeedRange(0.0f, 3000.0f);
FVector2D PitchRange(0.8f, 2.0f);
float TargetPitch = FMath::GetMappedRangeValueClamped(SpeedRange, PitchRange, CurrentSpeed);
EngineAudio->SetPitchMultiplier(TargetPitch);
```

`GetMappedRangeValueClamped`를 활용해 차량 속도(0~3000)를 피치(0.8~2.0)로 매핑했습니다. 속도가 올라갈수록 엔진음이 높아지며, 별도의 사운드 파일 교체 없이 **하나의 루프 사운드로 현실적인 엔진음 변화**를 구현했습니다.

### 드리프트 사운드 — 미끄러짐 강도 반영

```cpp
float SlipIntensity = FMath::GetMappedRangeValueClamped(
    FVector2D(0.7f, 0.95f), FVector2D(1.2f, 0.0f), CosAngle);
float NormalizedSpeed = FMath::Clamp(CurrSpeed / 3000.0f, 0.5f, 1.5f);
float FinalSkidPower = SlipIntensity * NormalizedSpeed;
DriftAudio->SetFloatParameter(SkidIntensityParam, FinalSkidPower);
DriftAudio->SetPitchMultiplier(0.9f + (FinalSkidPower * 0.4f));
DriftAudio->SetVolumeMultiplier(FMath::Min(FinalSkidPower, 1.0f));
```

단순히 드리프트 ON/OFF로 소리를 재생하는 것이 아니라, **미끄러짐 각도와 속도를 조합**하여 스키드음의 강도, 피치, 볼륨을 실시간으로 조절합니다. 살짝 미끄러지면 작은 소리가, 격렬하게 드리프트하면 강한 소리가 나도록 했습니다.

---

## 7. 브레이크 라이트 시스템

```cpp
void ARacingCar::BeginPlay()
{
    // "Brake" 태그가 달린 PointLight만 수집
    for (UPointLightComponent* Light : AllPointLights)
    {
        if (Light->ComponentHasTag(TEXT("Brake")))
        {
            BrakeLights.Add(Light);
            Light->SetIntensity(NormalBrakeIntensity); // 10.0f
        }
    }
}

void ARacingCar::Brake(const FInputActionValue& Value)
{
    float BrakeInput = Value.Get<float>();
    float TargetIntensity = (BrakeInput > 0.0f) ? ActiveBrakeIntensity : NormalBrakeIntensity;
    for (UPointLightComponent* Light : BrakeLights)
    {
        if (Light) Light->SetIntensity(TargetIntensity);
    }
}
```

블루프린트에서 `Brake` 태그를 붙여놓은 PointLight 컴포넌트들을 코드에서 자동 수집하고, 브레이크 입력에 따라 밝기를 전환합니다. 드리프트 진입 시에도 브레이크 라이트가 켜지도록 하여 시각적 피드백을 강화했습니다.

---

## 8. 타이틀 UI 위젯

### Press Any Key → 레이싱 맵 전환

```cpp
FReply UPlayerUserWidget::NativeOnKeyDown(const FGeometry& InGeometry, const FKeyEvent& InKeyEvent)
{
    if (bIsTransitioning) return FReply::Handled(); // 중복 입력 방지
    bIsTransitioning = true;
    // 1. 텍스트 퇴장 애니메이션
    StopAnimation(Text_Glow);
    PlayAnimation(Text_Exit, 0.0f, 1);
    // 2. 카메라 페이드 아웃 (3초)
    PC->PlayerCameraManager->StartCameraFade(0.0f, 1.0f, 3.0f, FColor::Black, false, true);
    // 3. 로딩 UI 애니메이션
    PlayAnimation(Loading_In, 0.0f, 1);
    // 4. 3초 후 맵 전환
    GetWorld()->GetTimerManager().SetTimer(TimerHandle, this, &UPlayerUserWidget::TransitionToRacingMap, 3.0f, false);
    return FReply::Handled();
}
```

타이틀 화면의 흐름:

1. "PRESS ANY KEY" 텍스트가 PingPong 모드로 계속 깜빡임
2. 아무 키를 누르면 텍스트 퇴장 애니메이션 + 화면 페이드 아웃 + 로딩 UI 동시 재생
3. 3초 후 `OpenLevel`로 레이싱 맵으로 전환
4. `bIsTransitioning` 플래그로 중복 입력 완벽 차단

---

## 🔧 트러블슈팅 & 배운 점

### 1. Chaos Vehicle의 팽이 현상

**문제**: 기본 `SetSteeringInput`만 사용하면 차가 제자리에서 팽이처럼 회전
**해결**: 각속도를 `FInterpTo`로 보간 제어하고, Velocity Alignment로 진행 방향을 보정

### 2. 드리프트 ON/OFF 떨림

**문제**: 드리프트 진입/해제 임계값이 같으면 경계에서 상태가 계속 바뀜
**해결**: 히스테리시스 패턴 적용 (진입 0.94, 유지 0.98)

### 3. 리스폰 시 차량이 튀는 현상

**문제**: 텔레포트 후에도 이전 물리 상태가 남아서 차가 튀어오름
**해결**: `SetSimulatePhysics(false → true)` 토글로 물리 엔진을 완전히 리셋

### 4. 엔진 사운드 끊김

**문제**: 매 프레임 Play/Stop을 호출하면 사운드가 뚝뚝 끊김
**해결**: 루프 사운드를 한 번만 Play하고, `SetPitchMultiplier`로 속도에 따라 실시간 변조

---

## 💭 회고

### 잘한 점

- **물리 기반 드리프트 시스템**: 단순 애니메이션이 아닌 실제 물리 엔진을 활용한 드리프트로 자연스러운 핸들링 구현
- **감각적인 피드백 설계**: FOV 변화, 카메라 쉐이크, 사운드 피치 변조 등 여러 요소를 조합하여 "속도감"이라는 하나의 경험으로 통합
- **히스테리시스 같은 설계 패턴 적용**: 게임 개발에서도 소프트웨어 공학적인 사고가 중요하다는 것을 체감

### 아쉬운 점

- 드리프트 물리 수치 튜닝에 많은 시간 소요 → 에디터에서 실시간으로 조절할 수 있는 디버그 UI를 미리 만들었으면 효율적이었을 것
- 파괴/리스폰 로직에서 엣지 케이스(공중에서 파괴, 벽 사이에서 파괴 등) 처리가 부족
- `Tick` 함수가 너무 비대해짐 → 기능별로 분리된 컴포넌트 구조가 더 나았을 것

### 다음에 적용하고 싶은 것

- **GAS(Gameplay Ability System)** 를 활용한 부스트/드리프트 어빌리티 구현
- **네트워크 멀티플레이어** 지원
- **데이터 테이블** 기반 차량 스펙 관리

---

> 읽어주셔서 감사합니다! 🏁