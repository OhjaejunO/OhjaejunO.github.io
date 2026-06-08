---
title: "UE5 C++로 스칼렛 넥서스 카렌 보스전 모작하기"
description: "StateTree + DataAsset 기반 보스 AI, 5종 공격 패턴, 컷신 시스템, 글리치 이펙트까지 — 시작 화면부터 엔딩까지 완주한 보스 전투 모작 회고"
date: 2026-04-16
category: 회고
tags: [UE5, UnrealEngine5, C++, StateTree, DataAsset, UMG, MediaPlayer, ScarletNexus, BossAI]
---

Unreal Engine 5와 C++로 스칼렛 넥서스의 **카렌 트래버스(Karen Travers)** 보스전을 모작한 프로젝트입니다. StateTree 기반 AI, DataAsset 가중치 공격 패턴 시스템, 컷신 시스템, 사운드·연출까지 프로젝트 전반을 C++ 중심으로 직접 구현했습니다.

## 목차

1. 프로젝트 개요
2. 시스템 아키텍처
3. 공격 패턴 5종 상세 구현
4. 핵심 연출 시스템
5. 컷신 시스템 (C++ UMG)
6. 시작 화면 UI
7. 사운드 시스템
8. 사망 연출
9. 트러블슈팅 모음
10. 배운 것
11. 프로젝트 회고
12. 플레이 영상

---

## 1. 프로젝트 개요

### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔진 | Unreal Engine 5.7 |
| 언어 | C++ (Blueprint는 최소한으로만 사용) |
| IDE | JetBrains Rider |
| AI 구조 | StateTree + DataAsset 기반 |
| 담당 파트 | 보스 AI, 공격 패턴, 연출, 컷신, UI, 사운드 등 프로젝트 후반부 전반 |

### 게임 흐름

```
시작 화면 → 인트로 컷신(23초) → 필드 레벨 →
보스 등장 컷신(23초) → 보스 전투 →
엔딩 컷신(32초) → 시작 화면
```

### 왜 이 보스를 선택했는가?

원작 스칼렛 넥서스의 카렌 트래버스는 순간이동과 강력한 초뇌력으로 주인공을 압박하는, 시리즈에서 매우 인상적인 보스입니다. 특히:

- **순간이동**으로 공간을 지배하는 플레이 스타일
- **다양한 초뇌력 기반 공격 패턴**
- 플레이어에게 **"지능적으로 대응하는"** 느낌

이런 요소들은 StateTree와 DataAsset을 활용하기에 아주 좋은 소재였습니다. 단순한 공격 로테이션이 아니라 상황에 맞게 판단해서 공격하는 AI를 만들어보고 싶었습니다.

---

## 2. 시스템 아키텍처

### StateTree 기반 보스 AI

보스 AI의 전체 구조는 다음과 같습니다:

```
┌─ Idle ──────────────────
│  회피 / 순찰 / 텔레포트
        │
        ▼
┌─ AttackExecutor ────────
│  DataAsset 가중치 기반 패턴 선택
        │
        ▼
┌─ PhaseTransition ───────
│  HP 체크 후 페이즈 전환
        │
        ▼
┌─ Idle (복귀) ───────────
│  다시 Idle 상태로 복귀
```

### 왜 Behavior Tree 대신 StateTree?

프로젝트 초기에 Behavior Tree와 StateTree를 비교해본 결과 StateTree를 선택했습니다:

| 비교 항목 | Behavior Tree | StateTree |
|-----------|---------------|-----------|
| 상태 전환의 명시성 | 조건 기반, 암시적 | 이벤트 기반, 명시적 |
| 복잡한 상태 관리 | 깊어질수록 읽기 어려움 | 평평하게 유지 가능 |
| 데이터 흐름 | Blackboard 의존 | InstanceData로 구조화 |
| 디버깅 | 실행 중 추적 쉬움 | 현재 상태 명확히 보임 |

특히 이번 프로젝트처럼 공격 패턴이 5가지나 되고, 각 패턴이 여러 하위 단계로 나뉘는 경우 StateTree가 훨씬 관리하기 좋았습니다.

### 핵심 Task 구성

```cpp
// 각 Task는 USTRUCT로 정의
USTRUCT()
struct FSTTask_BossIdle : public FStateTreeTaskCommonBase
{
    GENERATED_BODY()
    // ...
};
```

| Task | 역할 |
|------|------|
| `FSTTask_BossIdle` | 대기, 회피 텔레포트, 순찰 텔레포트, 플레이어 추적 |
| `FSTTask_BossAttackExecutor` | 공격 패턴 선택 및 실행 (5종 스킬 관리) |
| `FSTTask_BossPhaseTransition` | HP 기반 페이즈 전환 트리거 |
| `FSTTask_BossDeath` | 사망 연출 및 레벨 전환 |

### DataAsset 가중치 기반 패턴 선택

공격 패턴은 `UDataAsset`으로 완전히 분리하여, **C++ 코드를 수정하지 않고도 밸런스 조정이 가능**하게 설계했습니다.

```cpp
UENUM(BlueprintType)
enum class EActiveAttackType : uint8
{
    TeleportKick,
    CloneRush,
    AerialElectric,
    IceSpikes,
    ElectricOrbs
};

USTRUCT(BlueprintType)
struct FBossAttackEntry
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EActiveAttackType AttackType;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Weight = 1.0f;              // 선택 가중치

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float MinDistance = 0.0f;         // 최소 사용 거리

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float MaxDistance = 2000.0f;      // 최대 사용 거리

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Cooldown = 3.0f;            // 쿨다운

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 MinPhase = 1;               // 사용 가능한 최소 페이즈
};
```

패턴 선택 로직은 다음과 같이 동작합니다:

1. 모든 패턴을 순회하며 현재 사용 가능한 것만 필터링 (거리, 쿨다운, 페이즈 조건)
2. 필터링된 패턴들의 가중치 합을 구함
3. `FMath::FRandRange(0, TotalWeight)` 값을 뽑아 가중치 누적으로 선택

```cpp
EActiveAttackType FSTTask_BossAttackExecutor::SelectAttackPattern(
    FInstanceDataType& Data, ACharacter* Boss) const
{
    TArray<FBossAttackEntry> AvailableAttacks;
    float TotalWeight = 0.f;

    for (const FBossAttackEntry& Entry : AttackDataAsset->AttackPatterns)
    {
        // 조건 체크: 거리, 쿨다운, 페이즈
        if (IsAttackAvailable(Entry, Data, Boss))
        {
            AvailableAttacks.Add(Entry);
            TotalWeight += Entry.Weight;
        }
    }

    // 가중치 기반 랜덤 선택
    float RandomValue = FMath::FRandRange(0.f, TotalWeight);
    float CurrentSum = 0.f;

    for (const FBossAttackEntry& Entry : AvailableAttacks)
    {
        CurrentSum += Entry.Weight;
        if (RandomValue <= CurrentSum)
        {
            return Entry.AttackType;
        }
    }

    // 기본값
    return EActiveAttackType::TeleportKick;
}
```

이 구조 덕분에:

- C++ 코드 수정 없이 에디터에서 공격 빈도 조정 가능
- 새로운 패턴 추가가 쉬움
- 테스트 시 특정 패턴만 자주 나오게 설정 가능

---

## 3. 공격 패턴 5종 상세 구현

### 3-1. TeleportKick — 순간이동 돌려차기

카렌의 시그니처 공격입니다. 플레이어 뒤로 순간이동한 뒤 기습적인 킥을 날립니다.

**페이즈 분리:**

```cpp
UENUM()
enum class ETKPhase : uint8
{
    Vanishing,      // 사라지는 중
    Teleporting,    // 순간이동
    Kicking         // 킥 공격
};
```

**Tick 로직:**

```cpp
EStateTreeRunStatus FSTTask_BossAttackExecutor::TickTeleportKick(
    FInstanceDataType& Data, ACharacter* Boss, float DeltaTime) const
{
    Data.PhaseTimer += DeltaTime;

    switch (Data.TKPhase)
    {
    case ETKPhase::Vanishing:
        // 사라지는 몽타주 재생 시간 동안 대기
        if (Data.PhaseTimer >= TK_VanishDuration)
        {
            Boss->SetActorHiddenInGame(true);
            Boss->SetActorEnableCollision(false);

            // 플레이어 뒤쪽으로 순간이동
            Boss->SetActorLocation(Data.TKTarget);

            // 플레이어 바라보기
            if (const ACharacter* P = UGameplayStatics::GetPlayerCharacter(Boss->GetWorld(), 0))
            {
                FVector D = (P->GetActorLocation() - Data.TKTarget).GetSafeNormal();
                if (!D.IsNearlyZero()) Boss->SetActorRotation(D.Rotation());
            }

            Data.TKPhase = ETKPhase::Teleporting;
            Data.PhaseTimer = 0.f;
        }
        break;

    case ETKPhase::Teleporting:
        // 나타나는 딜레이 후 킥 시작
        if (Data.PhaseTimer >= TK_AppearDelay)
        {
            Boss->SetActorHiddenInGame(false);
            Boss->SetActorEnableCollision(true);

            if (ABossCharacterBase* BossBase = Cast<ABossCharacterBase>(Boss))
            {
                BossBase->StopGlitchEffect();
                // 나타나는 몽타주 재생
                // ...
            }

            Data.TKPhase = ETKPhase::Kicking;
            Data.PhaseTimer = 0.f;
        }
        break;

    case ETKPhase::Kicking:
        if (Data.PhaseTimer >= TK_KickDuration)
        {
            // 공격 후 쿨다운 설정 (연속 텔레포트 방지)
            if (ABossCharacterBase* BossBase = Cast<ABossCharacterBase>(Boss))
            {
                BossBase->PostAttackTeleportCooldown = 2.f;
            }
            return EStateTreeRunStatus::Succeeded;
        }
        break;
    }

    return EStateTreeRunStatus::Running;
}
```

**NavMesh 투영으로 유효한 위치 확보:**

```cpp
FVector Target = PlayerLoc - Player->GetActorForwardVector() * TK_TeleportOffset;

if (const UNavigationSystemV1* NavSys =
        FNavigationSystem::GetCurrent<UNavigationSystemV1>(Boss->GetWorld()))
{
    FNavLocation NavLoc;
    if (NavSys->ProjectPointToNavigation(Target, NavLoc, FVector(300.f)))
    {
        Target = NavLoc.Location;
    }
}
```

이 덕분에 보스가 맵 밖이나 접근 불가능한 지역으로 순간이동하지 않습니다.

### 3-2. CloneRush — 분신 돌진

좌우에 분신 2체를 스폰해 플레이어를 동시에 덮칩니다.

**구현 포인트:**

- **메모리 누수 방지**를 위해 `ExitState`에서 반드시 클론 정리
- 분신도 원본과 같은 애니메이션 몽타주 사용

```cpp
void FSTTask_BossAttackExecutor::ExitState(
    FStateTreeExecutionContext& Context,
    const FStateTreeTransitionResult& Transition) const
{
    FInstanceDataType& Data = Context.GetInstanceData(*this);

    // VFX 정리
    for (UNiagaraComponent* VFX : Data.OrbVFXComponents)
    {
        if (VFX && !VFX->IsBeingDestroyed())
        {
            VFX->DestroyComponent();
        }
    }
    Data.OrbVFXComponents.Empty();

    // 클론 정리
    if (Data.LeftClone && !Data.LeftClone->IsActorBeingDestroyed())
        Data.LeftClone->Destroy();
    if (Data.RightClone && !Data.RightClone->IsActorBeingDestroyed())
        Data.RightClone->Destroy();

    Data.LeftClone = nullptr;
    Data.RightClone = nullptr;

    // ... 나머지 로직
}
```

### 3-3. AerialElectric — 공중 전기 낙하

공중으로 솟아올라 플레이어 위치로 전기 공격을 내리찍습니다. 공중 체공 시간과 낙하 속도, 타격 판정 범위를 조절해 피할 수는 있지만 쉽지는 않은 밸런스로 맞췄습니다.

### 3-4. IceSpikes — 얼음 기둥

플레이어 위치와 주변에 얼음 기둥을 소환합니다. 단순한 지점 공격이 아니라 **예측 지점과 현재 위치 두 곳에 동시 생성**되어 회피 방향을 제한합니다.

### 3-5. ElectricOrbs — 전류구 일제 사격

여러 개의 전류구를 공중에 소환한 뒤 순차적으로 발사합니다.

**인덱스 기반 개별 소멸 구현:**

공격 종료 시 전류구가 동시에 펑 하고 사라지면 부자연스러워 보여서, **인덱스 순서대로 0.3초 간격으로 하나씩 사라지게** 했습니다.

```cpp
void FSTTask_BossAttackExecutor::DestroyOrbsSequentially(
    FInstanceDataType& Data, ACharacter* Boss) const
{
    for (int32 i = 0; i < Data.OrbVFXComponents.Num(); i++)
    {
        float DelayTime = i * 0.3f;  // 인덱스 * 0.3초

        FTimerHandle Handle;
        UNiagaraComponent* VFX = Data.OrbVFXComponents[i];

        Boss->GetWorldTimerManager().SetTimer(
            Handle,
            [VFX]()
            {
                if (VFX && !VFX->IsBeingDestroyed())
                {
                    VFX->DestroyComponent();
                }
            },
            DelayTime,
            false
        );
    }
}
```

---

## 4. 핵심 연출 시스템

### 4-1. 글리치 오버레이 이펙트

카렌의 초뇌력 텔레포트를 강조하기 위한 시그니처 이펙트입니다. 이 부분에서 가장 많이 고민했습니다.

**첫 번째 시도: SetOverlayMaterial**

```cpp
GetMesh()->SetOverlayMaterial(GlitchOverlayMaterial);  // ❌ 작동 안 함
```

**문제**: UE5의 SetOverlayMaterial은 Translucent 머티리얼을 지원하지 않음. 오버레이 전용 렌더 패스에서 Translucent가 무시되었습니다.

**두 번째 시도: 별도 SkeletalMesh 컴포넌트로 겹치기**

```cpp
GlitchMeshComp = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("GlitchMesh"));
GlitchMeshComp->SetLeaderPoseComponent(GetMesh());
```

이 방식은 원본 위에 Additive 메시를 겹쳐놓는 방식이었는데, 렌더링 이슈가 있었습니다.

**최종 해결: 슬롯 교체 + MID 방식**

원본 머티리얼을 백업해두고, 글리치 재생 중에는 MID(Material Instance Dynamic)로 교체하는 방식입니다.

```cpp
// 헤더
UPROPERTY()
TArray<TObjectPtr<UMaterialInterface>> OriginalMaterials;

UPROPERTY()
TObjectPtr<UMaterialInstanceDynamic> GlitchMID;
```

```cpp
void ABossCharacterBase::StartGlitchEffect()
{
    USkeletalMeshComponent* Mesh = GetMesh();
    if (!Mesh || !GlitchOverlayMaterial) return;

    // MID 생성
    GlitchMID = UMaterialInstanceDynamic::Create(GlitchOverlayMaterial, this);

    // 원본 머티리얼 백업 후 슬롯 교체
    OriginalMaterials.Empty();
    for (int32 i = 0; i < Mesh->GetNumMaterials(); i++)
    {
        OriginalMaterials.Add(Mesh->GetMaterial(i));
        Mesh->SetMaterial(i, GlitchMID);
    }
}

void ABossCharacterBase::StopGlitchEffect()
{
    USkeletalMeshComponent* Mesh = GetMesh();
    if (!Mesh) return;

    // 원본 머티리얼 복원
    for (int32 i = 0; i < OriginalMaterials.Num(); i++)
    {
        Mesh->SetMaterial(i, OriginalMaterials[i]);
    }
    OriginalMaterials.Empty();
    GlitchMID = nullptr;
}
```

이 방식의 장점:

- Translucent 머티리얼 그대로 사용 가능
- MID로 런타임에 파라미터 조절 가능 (시간, 강도 등)
- 원본 머티리얼을 손상시키지 않음

### 4-2. 히트 리액션 — 스킬 도중 끊김 방지

초기 구현에서는 보스가 피격당할 때마다 히트 리액션 몽타주가 재생되어서 카렌의 스킬 몽타주가 중간에 끊기는 심각한 문제가 있었습니다. 특히 텔레포트 킥처럼 여러 단계로 진행되는 스킬에서 더 치명적이었습니다.

**문제 분석:**

```cpp
// 초기 코드 (문제 있음)
bool ABossCharacterBase::ReceiveDamage_Implementation(FDamageInfo DamageInfo)
{
    // HP 감소 처리...

    // 피격 시 무조건 히트 리액션 재생 → 스킬 몽타주를 덮어씀
    PlayDirectionalHitReaction(DamageInfo.DamageCauser);

    CheckPhaseTransition();
    // ...
}
```

**해결: 몽타주 재생 중이면 히트 리액션 스킵**

```cpp
bool ABossCharacterBase::ReceiveDamage_Implementation(FDamageInfo DamageInfo)
{
    if (IDamageable::Execute_IsDead(this)) return false;
    if (CurrentHPValue <= 0.f) return false;

    const float OldHP = CurrentHPValue;
    const float DamageAmount = static_cast<float>(DamageInfo.DamageAmount);
    CurrentHPValue = FMath::Clamp(CurrentHPValue - DamageAmount, 0.f, MaxHPValue);

    OnHPChanged.Broadcast(CurrentHPValue, MaxHPValue, DamageAmount);

    // 핵심: 몽타주 재생 중이면 히트 리액션 스킵
    if (UAnimInstance* AnimInst = GetMesh()->GetAnimInstance())
    {
        if (!AnimInst->IsAnyMontagePlaying())
        {
            PlayDirectionalHitReaction(DamageInfo.DamageCauser);
        }
    }

    CheckPhaseTransition();

    if (CurrentHPValue <= 0.f)
    {
        HandleDeath();
    }

    return true;
}
```

이 한 줄 체크로:

- 스킬 중에는 데미지는 받되 리액션은 스킵 → 스킬 흐름 유지
- 가만히 있을 때는 정상적으로 피격 반응 → 자연스러움
- 유저 경험: "보스가 스킬 중엔 공격을 무시하고 밀어붙인다"는 느낌

### 4-3. 텔레포트 몽타주 랜덤 짝 매칭

텔레포트 시 사라지는 모션과 나타나는 모션을 쌍으로 맞춰야 자연스럽습니다. 무작위로 뽑으면 "A로 사라졌는데 B로 나타나는" 어색함이 생깁니다.

**배열 짝 매칭 구현:**

```cpp
// 보스에 정의
UPROPERTY(EditDefaultsOnly, Category = "Boss|Teleport")
TArray<TObjectPtr<UAnimMontage>> TeleportVanishMontages;

UPROPERTY(EditDefaultsOnly, Category = "Boss|Teleport")
TArray<TObjectPtr<UAnimMontage>> TeleportAppearMontages;

UPROPERTY()
int32 CurrentTeleportMontageIndex = -1;
```

```cpp
// 사라질 때 — 랜덤 인덱스 선택 + 재생
if (BossBase->TeleportVanishMontages.Num() > 0)
{
    BossBase->CurrentTeleportMontageIndex =
        FMath::RandRange(0, BossBase->TeleportVanishMontages.Num() - 1);

    Boss->PlayAnimMontage(
        BossBase->TeleportVanishMontages[BossBase->CurrentTeleportMontageIndex]);
}

// 나타날 때 — 같은 인덱스 사용
if (BossBase->CurrentTeleportMontageIndex >= 0 &&
    BossBase->TeleportAppearMontages.IsValidIndex(BossBase->CurrentTeleportMontageIndex))
{
    Boss->PlayAnimMontage(
        BossBase->TeleportAppearMontages[BossBase->CurrentTeleportMontageIndex]);
}
```

두 배열에서 같은 인덱스끼리 쌍이 되게 BP에서 세팅만 해주면 됩니다. 3쌍 정도 만들어두면 매 텔레포트가 조금씩 다르게 보여 단조롭지 않습니다.

### 4-4. 상하체 분리 — 플레이어를 바라보며 걷기

보스가 항상 정면을 향해서만 움직이면 로봇 같고 재미없어집니다. 상체는 플레이어를, 하체는 이동 방향을 따르게 만들면 훨씬 살아있는 느낌이 듭니다.

**C++에서 각도 계산:**

```cpp
void ABossCharacterBase::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    const ACharacter* Player = UGameplayStatics::GetPlayerCharacter(GetWorld(), 0);
    if (!Player) return;

    // 플레이어를 향하는 Yaw 각도
    FVector ToPlayer = Player->GetActorLocation() - GetActorLocation();
    float TargetYaw = ToPlayer.Rotation().Yaw;

    // 현재 액터 Yaw와의 차이를 계산 (-180 ~ 180 범위)
    float DeltaYaw = FMath::FindDeltaAngleDegrees(GetActorRotation().Yaw, TargetYaw);

    // ±90도 범위로 클램프 (너무 꺾이는 것 방지)
    DeltaYaw = FMath::Clamp(DeltaYaw, -90.f, 90.f);

    // 부드럽게 보간
    SpineYawOffset = FMath::FInterpTo(SpineYawOffset, DeltaYaw, DeltaTime, 5.f);
}
```

**AnimBP에서 Transform Modify Bone 적용:**

- **Bone to Modify**: `spine_03` (척추 위쪽)
- **Rotation**: `SpineYawOffset` 바인딩
- **Rotation Mode**: Add to Existing
- **Rotation Space**: Component Space

이러면 하체는 MovementComponent가 제어하는 실제 이동 방향으로, 상체만 플레이어를 향해 비틀리게 됩니다. 작은 연출이지만 차이가 큽니다.

---

## 5. 컷신 시스템 (C++ UMG)

게임 시작부터 끝까지를 하나의 경험으로 엮기 위해 컷신 시스템을 직접 구현했습니다. 단순한 영상 재생이 아니라 **텍스트 + 영상 + 페이드**를 조합한 시네마틱 연출이 목표였습니다.

### FCutsceneStep 구조

```cpp
USTRUCT(BlueprintType)
struct FCutsceneStep
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FText DisplayText;      // 이 스텝에서 표시할 텍스트

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 MediaIndex = -1;  // MediaSources 배열 인덱스, -1은 검은 화면

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Duration = 3.0f;  // 이 스텝의 지속 시간
};
```

컷신은 이 구조체의 배열로 정의됩니다. BP에서 세팅하기 때문에 코드 수정 없이 컷신 전체를 재구성할 수 있습니다.

### 위젯 구성 요소

```cpp
UCLASS()
class SCARLETNEXUS_API UCutsceneWidget : public UUserWidget
{
    GENERATED_BODY()

protected:
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UImage> BackgroundImage;      // 영상 표시용 이미지

    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UImage> FadeImage;            // 검은 페이드용 이미지

    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UTextBlock> CutsceneText;     // 텍스트

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cutscene")
    TArray<FCutsceneStep> Steps;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cutscene")
    TArray<TObjectPtr<UMediaSource>> MediaSources;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cutscene")
    TObjectPtr<UMediaPlayer> CutsceneMediaPlayer;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cutscene")
    FName NextLevelName;

    // 상태 변수
    int32 CurrentStep = 0;
    float StepTimer = 0.f;
    float FadeAlpha = 1.f;
    bool bFadingIn = true;
    bool bFadingOut = false;
    bool bCutsceneActive = false;
    FTimerHandle CutsceneTickHandle;
};
```

### 페이드 인/아웃 처리

핵심은 FadeImage의 Color and Opacity 알파값을 조절하는 것입니다. 처음에 RenderOpacity를 써봤는데, 위젯에 머티리얼이 할당되면 제대로 동작하지 않았습니다. `SetColorAndOpacity`가 가장 안정적이었습니다.

```cpp
void UCutsceneWidget::CutsceneTick()
{
    if (!bCutsceneActive || !Steps.IsValidIndex(CurrentStep)) return;

    const FCutsceneStep& Step = Steps[CurrentStep];
    StepTimer += 0.016f;

    // 페이드 인 (1초)
    if (bFadingIn)
    {
        FadeAlpha -= 0.016f / 1.0f;
        if (FadeAlpha <= 0.f)
        {
            FadeAlpha = 0.f;
            bFadingIn = false;

            // 페이드 인 완료 시점에 배경 영상 보이기 (이전 영상 안 보이게)
            const FCutsceneStep& CurrentStepData = Steps[CurrentStep];
            if (CurrentStepData.MediaIndex >= 0 && BackgroundImage)
                BackgroundImage->SetVisibility(ESlateVisibility::Visible);
        }

        if (FadeImage)
            FadeImage->SetColorAndOpacity(
                FLinearColor(0, 0, 0, FMath::Clamp(FadeAlpha, 0.f, 1.f)));

        float TextAlpha = 1.f - FadeAlpha;
        if (CutsceneText)
            CutsceneText->SetColorAndOpacity(
                FSlateColor(FLinearColor(1, 1, 1, TextAlpha)));

        return;
    }

    // 페이드 아웃 (마지막 1초)
    float TimeLeft = Step.Duration - StepTimer;
    if (TimeLeft <= 1.0f && !bFadingOut)
    {
        bFadingOut = true;
        FadeAlpha = 0.f;
    }

    if (bFadingOut)
    {
        FadeAlpha += 0.016f / 1.0f;
        if (FadeImage)
            FadeImage->SetColorAndOpacity(
                FLinearColor(0, 0, 0, FMath::Clamp(FadeAlpha, 0.f, 1.f)));

        float TextAlpha = 1.f - FadeAlpha;
        if (CutsceneText)
            CutsceneText->SetColorAndOpacity(
                FSlateColor(FLinearColor(1, 1, 1, FMath::Clamp(TextAlpha, 0.f, 1.f))));
    }

    // 다음 스텝으로 이동
    if (StepTimer >= Step.Duration)
    {
        CurrentStep++;
        if (CurrentStep >= Steps.Num())
        {
            GetWorld()->GetTimerManager().ClearTimer(CutsceneTickHandle);
            bCutsceneActive = false;
            TransitionToNextLevel();
        }
        else
        {
            ShowStep(CurrentStep);
        }
    }
}
```

### 이전 영상이 잠깐 보이는 문제 해결

처음엔 스텝이 바뀔 때 이전 영상의 마지막 프레임이 살짝 보이는 현상이 있었습니다. 원인은 `OpenSource`로 새 영상을 로드해도 UI Image가 즉시 업데이트되지 않아서 페이드 인 중에 이전 프레임이 보이는 것이었습니다.

**해결 방법**: 페이드 인 중에는 BackgroundImage를 Hidden으로 두고, 페이드 인 완료 시점에 Visible로 전환.

```cpp
void UCutsceneWidget::ShowStep(int32 Index)
{
    if (!Steps.IsValidIndex(Index)) return;

    const FCutsceneStep& Step = Steps[Index];
    StepTimer = 0.f;
    FadeAlpha = 1.f;
    bFadingIn = true;
    bFadingOut = false;

    if (FadeImage)
        FadeImage->SetColorAndOpacity(FLinearColor(0, 0, 0, 1.f));

    // 배경 항상 숨기기 — 페이드 인 끝난 시점에 보이게
    if (BackgroundImage)
        BackgroundImage->SetVisibility(ESlateVisibility::Hidden);

    if (CutsceneMediaPlayer)
        CutsceneMediaPlayer->Close();

    if (CutsceneText)
    {
        CutsceneText->SetText(Step.DisplayText);
        CutsceneText->SetColorAndOpacity(FSlateColor(FLinearColor(1, 1, 1, 0)));
    }

    // 영상 미리 로드만 (Play on Open으로 자동 재생됨)
    if (Step.MediaIndex >= 0 &&
        MediaSources.IsValidIndex(Step.MediaIndex) &&
        CutsceneMediaPlayer)
    {
        CutsceneMediaPlayer->OpenSource(MediaSources[Step.MediaIndex]);
    }
}
```

이렇게 하면 완전히 검은 화면 → 페이드 인 시작 → 영상이 보이기 시작 순서로 전환되어 이전 프레임이 절대 보이지 않습니다.

### 스페이스바 스킵

테스트하면서 컷신을 계속 보는 게 불편해서, 스페이스바로 스킵할 수 있게 만들었습니다.

```cpp
FReply UCutsceneWidget::NativeOnKeyDown(const FGeometry& InGeometry, const FKeyEvent& InKeyEvent)
{
    if (InKeyEvent.GetKey() == EKeys::SpaceBar)
    {
        if (bCutsceneActive)
        {
            GetWorld()->GetTimerManager().ClearTimer(CutsceneTickHandle);
            bCutsceneActive = false;
            if (CutsceneMediaPlayer)
                CutsceneMediaPlayer->Close();
            TransitionToNextLevel();
            return FReply::Handled();
        }
    }
    return Super::NativeOnKeyDown(InGeometry, InKeyEvent);
}
```

참고로 FReply 관련 Link 에러가 나면 Build.cs에 `"Slate"`, `"SlateCore"` 모듈 추가해야 합니다.

### 레벨 전환 시 World Leak 방지

가장 애먹었던 부분입니다. 컷신 끝나고 다음 레벨로 전환할 때 아래 에러가 계속 나왔습니다:

```
Fatal error: ====Fatal World Leaks====
(Garbage) WBP_Cutscene_C /Engine/Transient.World_13:WBP_Cutscene_C_0
^ This reference is preventing the old World from being GC'd ^
```

**원인**: 타이머 람다에서 `this`(위젯)를 캡처했는데, 위젯이 이전 World를 참조하고 있어서 GC가 안 되는 거였습니다.

**해결**: `this` 대신 World와 LevelName을 명시적으로 캡처.

```cpp
void UCutsceneWidget::TransitionToNextLevel()
{
    FadeToBlack();

    FName LevelName = NextLevelName;
    UWorld* World = GetWorld();

    FTimerHandle DelayHandle;
    World->GetTimerManager().SetTimer(
        DelayHandle,
        [World, LevelName]()  // this 대신 이렇게!
        {
            UGameplayStatics::OpenLevel(World, LevelName);
        },
        1.0f,
        false
    );
}
```

### 만든 세 가지 컷신

| 컷신 | 길이 | 역할 |
|------|------|------|
| 인트로 (컷신 1) | 약 23초 | 세계관 소개, 주인공 소개 |
| 보스 등장 (컷신 2) | 약 23초 | 카렌 트래버스의 진의, 최종 대결 예고 |
| 엔딩 (컷신 3) | 약 32초 | 승리 후 여운, 동료애, 계속되는 이야기 |

각 컷신은 7~8개의 스텝으로 구성되어 있고, 영상과 검은 화면(텍스트만 보이는)이 섞여서 흐름을 만듭니다.

---

## 6. 시작 화면 UI

게임의 첫 인상을 결정하는 부분이라 신경 써서 만들었습니다.

### 구성 요소

1. **배경 영상** — Media Player로 루프 재생
2. **Game Start / Exit 버튼** — 두 단계 클릭 방식
3. **선택 강조** — 선택된 쪽 텍스트가 흰색 → 빨강으로 페이드
4. **페이드 아웃 → 레벨 전환** — 1.5초 검은 페이드 후 컷신 1으로 이동

### 두 단계 클릭 방식

한 번 누르면 강조만 되고, 다시 누르면 확정되는 방식입니다. 실수로 게임을 시작하거나 종료하는 것을 방지합니다.

```cpp
void UStartMenuWidget::OnGameStart()
{
    // 이미 선택된 상태에서 다시 클릭 → 실제 시작
    if (bGameStartSelected)
    {
        FadeAlpha = 0.f;
        GetWorld()->GetTimerManager().SetTimer(
            FadeTimerHandle, this, &UStartMenuWidget::FadeTick, 0.016f, true);
        return;
    }

    // 첫 클릭 → 강조만
    bGameStartSelected = true;
    bExitSelected = false;
    bFadingGameStart = true;
    bFadingExit = false;
    ColorFadeAlpha = 0.f;

    // Exit은 즉시 흰색 복원
    Text_Exit->SetColorAndOpacity(FSlateColor(FLinearColor::White));
    Text_Exit->SetRenderScale(FVector2D(1.0f, 1.0f));
    Text_GameStart->SetRenderScale(FVector2D(1.1f, 1.1f));

    GetWorld()->GetTimerManager().SetTimer(
        ColorFadeHandle, this, &UStartMenuWidget::ColorFadeTick, 0.016f, true);
}

void UStartMenuWidget::ColorFadeTick()
{
    ColorFadeAlpha += 0.016f / 0.3f;  // 0.3초 동안 변화

    if (ColorFadeAlpha >= 1.f)
    {
        ColorFadeAlpha = 1.f;
        GetWorld()->GetTimerManager().ClearTimer(ColorFadeHandle);
    }

    FLinearColor Color = FMath::Lerp(FLinearColor::White, FLinearColor::Red, ColorFadeAlpha);

    if (bFadingGameStart)
        Text_GameStart->SetColorAndOpacity(FSlateColor(Color));
    else if (bFadingExit)
        Text_Exit->SetColorAndOpacity(FSlateColor(Color));
}
```

### 페이드 아웃 후 레벨 전환

```cpp
void UStartMenuWidget::FadeTick()
{
    FadeAlpha += 0.016f / 1.5f;  // 1.5초에 걸쳐 페이드

    if (FadeImage)
        FadeImage->SetColorAndOpacity(
            FLinearColor(0, 0, 0, FMath::Clamp(FadeAlpha, 0.f, 1.f)));

    if (FadeAlpha >= 1.f)
    {
        GetWorld()->GetTimerManager().ClearTimer(FadeTimerHandle);
        UGameplayStatics::OpenLevel(this, FName("CutsceneLevel1"));
    }
}
```

---

## 7. 사운드 시스템

게임의 몰입감을 위해 사운드를 전방위로 배치했습니다.

### 구성

- **공격 사운드** — 각 스킬 몽타주의 AnimNotify에서 트리거
- **텔레포트 사운드** — 사라질 때와 나타날 때 각각 다른 효과음
- **카렌 음성** — 스킬별로 다른 보이스라인 (공격 예고)
- **발자국** — 이동 애니메이션의 Footstep Notify
- **BGM** — 각 컷신·전투에 맞는 분위기 트랙
- **히트 사운드** — 공격이 맞았을 때 피격 효과
- **사망 연출 사운드** — 몽타주 노티파이 + 효과음 조합

### 구현 팁

대부분의 사운드는 AnimMontage의 AnimNotify로 처리했습니다. 코드로 하는 것보다 애니메이션 타이밍에 정확히 맞출 수 있어서 좋았습니다.

BGM은 레벨 블루프린트에서 Play Sound 2D로 재생하는데, 컷신의 경우 위젯 로딩 시간이 있어서 바로 시작하면 잠깐 끊기는 현상이 있었습니다. Delay 1~2초를 넣어서 해결했습니다.

---

## 8. 사망 연출

보스가 그냥 "픽 쓰러지는" 것이 아니라, **서서히 무너지는** 연출을 만들었습니다.

### 흐름

```
HP 0 도달 → 사망 몽타주 재생 → 마지막 포즈 고정 →
서서히 지면 아래로 가라앉음 → 엔딩 컷신으로 전환
```

### 사망 처리 코드

```cpp
void ABossCharacterBase::HandleDeath()
{
    // 모든 공격 콜리전 컴포넌트 숨기기
    TArray<UBossAttackCollisionComponent*> CollisionComps;
    GetComponents<UBossAttackCollisionComponent>(CollisionComps);
    for (UBossAttackCollisionComponent* Comp : CollisionComps)
    {
        if (Comp)
        {
            Comp->DisableAttackCollision();
            Comp->SetHiddenInGame(true);
        }
    }

    // 글리치 이펙트 정리
    StopGlitchEffect();

    // StateTree에 사망 이벤트 전달 → BossDeath Task 활성화
    if (ABossAIController* BossAI = Cast<ABossAIController>(GetController()))
    {
        BossAI->SendStateTreeEvent(
            FGameplayTag::RequestGameplayTag(FName("Boss.Event.Death")));
    }
}
```

콜리전 컴포넌트를 숨기는 부분은 중요한데, 이것을 빼먹으면 보스가 사망한 뒤에도 공격 판정 컴포넌트가 보이거나 플레이어에게 데미지를 줄 수 있습니다.

### BossDeath Task

StateTree의 BossDeath Task가 이후 연출을 담당합니다:

1. 사망 몽타주 끝까지 재생
2. 마지막 프레임에서 포즈 고정 (MontagePause 또는 StopAllMontages(0.f))
3. 액터를 천천히 아래로 이동 (FMath::FInterpTo로 Z값 감소)
4. 완전히 가라앉으면 엔딩 레벨로 전환

---

## 9. 트러블슈팅 모음

프로젝트를 진행하면서 겪은 주요 문제들과 해결 과정입니다.

### 9-1. World Leak Fatal Error

**증상**: 레벨 전환 시 에디터 크래시

**원인**: 타이머 람다에서 `this`(위젯)를 캡처해서 이전 World가 GC되지 않음

**해결**: `this` 대신 필요한 값들만 명시적으로 캡처

```cpp
// Before
[this]() { UGameplayStatics::OpenLevel(this, NextLevelName); }

// After
UWorld* World = GetWorld();
FName LevelName = NextLevelName;
[World, LevelName]() { UGameplayStatics::OpenLevel(World, LevelName); }
```

### 9-2. Media Player가 영상을 재생하지 않음

**증상**: OpenSource 호출해도 영상이 나오지 않음

**원인들**:

- 파일 경로를 상대 경로(`./Movies/...`)로 지정 → 미지원
- Play on Open 옵션이 꺼져있음 → 자동 재생 안 됨
- MediaAssets 모듈이 Build.cs에 없음

**해결**:

- 절대 경로 사용: `C:/Users/.../Movies/video.mp4`
- Media Player 에셋의 Play on Open 체크
- Build.cs에 `"MediaAssets"` 추가

### 9-3. 히트 리액션이 스킬을 중단시킴

**증상**: 카렌이 스킬 시전 중 피격당하면 스킬이 중간에 끊김

**원인**: PlayDirectionalHitReaction이 현재 재생 중인 몽타주를 덮어쓰기

**해결**: `IsAnyMontagePlaying()`으로 체크하여 몽타주 재생 중엔 스킵

### 9-4. 글리치 이펙트가 인게임에서 안 보임

**증상**: 에디터 프리뷰에서는 보이는데 PIE에서는 안 보임

**원인**: SetOverlayMaterial은 Translucent 머티리얼을 지원하지 않음

**해결**: 슬롯 교체 방식 + MID로 변경 (원본 백업 후 복원)

### 9-5. 텔레포트 후 글리치 이펙트가 남음

**증상**: 상태 전환이 일어나면 글리치가 풀리지 않고 지속됨

**원인**: BossIdle::ExitState에서 StopGlitchEffect() 호출 누락

**해결**: ExitState에서 텔레포트 중이었다면 반드시 글리치 해제

```cpp
void FSTTask_BossIdle::ExitState(...) const
{
    FInstanceDataType& InstanceData = Context.GetInstanceData(*this);
    ACharacter* BossChar = Cast<ACharacter>(InstanceData.ContextActor);
    if (!BossChar) return;

    // 텔레포트 중이었다면 글리치 확실히 해제
    if (InstanceData.bIsEvadeTeleporting || InstanceData.bIsPatrolTeleporting)
    {
        if (ABossCharacterBase* BossBase = Cast<ABossCharacterBase>(BossChar))
            BossBase->StopGlitchEffect();
        BossChar->SetActorHiddenInGame(false);
        BossChar->SetActorEnableCollision(true);
        InstanceData.bIsEvadeTeleporting = false;
        InstanceData.bIsPatrolTeleporting = false;
    }

    if (IDamageable::Execute_IsDead(BossChar)) return;
    // ...
}
```

### 9-6. 새 맵에서 보스가 떨어지거나 사라짐

**증상**: 맵을 새로 만들었는데 보스가 보이지 않거나 바닥으로 떨어짐

**원인**: NavMesh Bounds Volume이 지면보다 아래에 배치됨

**해결**: 볼륨을 맵 바닥에 맞추고, P 키로 녹색 NavMesh 표시 확인

### 9-7. 전류구 히트 VFX가 사각형으로 터짐

**증상**: 히트 이펙트 머티리얼이 원형이 아닌 사각형으로 보임

**원인**: 머티리얼 Blend Mode가 Opaque라 마스크가 적용되지 않음

**해결**:

- Blend Mode를 Translucent 또는 Additive로 변경
- Radial Gradient Exponential 노드를 Opacity에 연결

### 9-8. 이전 컷신 영상의 마지막 프레임이 잠깐 보임

**증상**: 스텝 전환 시 이전 영상이 순간적으로 노출

**원인**: OpenSource 후 UI Image가 즉시 업데이트되지 않음

**해결**: 페이드 인 중엔 BackgroundImage를 Hidden으로 두고, 페이드 인 완료 시점에 Visible로 전환

---

## 10. 배운 것

### 10-1. StateTree의 실전 활용

"가만히 기다리는 Idle" 같은 단순한 상태가 아니라, **같은 Idle 안에서도 여러 서브 행동(회피·순찰·추적)이 동적으로 일어나는 것**을 구현해보며 StateTree의 유연성을 실감했습니다. InstanceData로 각 상태별 로컬 변수를 관리하는 패턴도 매우 유용했습니다.

### 10-2. DataAsset 중심 설계의 힘

패턴 가중치·거리·쿨다운을 모두 DataAsset으로 뺐더니 **밸런스 조정이 컴파일 없이 가능**했습니다. 디자이너가 있다면 C++을 몰라도 조정 가능했을 것이고, 혼자 개발하는 입장에서도 반복 테스트가 훨씬 빨랐습니다.

### 10-3. UMG를 C++로 직접 다루기

BP로 UMG를 만들면 타이밍 제어가 불편한데, C++로 직접 다루니 페이드 커브·전환 타이밍·키 입력 처리를 정밀하게 제어할 수 있었습니다. 특히 컷신처럼 여러 요소가 동시에 애니메이션되는 상황에서는 C++이 훨씬 깔끔했습니다.

### 10-4. 연출의 세밀함이 인상을 좌우

글리치 이펙트, 몽타주 짝 매칭, 사망 연출, 페이드 전환 같은 것들은 없어도 동작은 하지만, **있고 없고가 전체 인상을 크게 바꿨습니다**. "보스가 살아있는 느낌"은 이런 작은 부분에서 나옵니다.

### 10-5. 문제를 잘게 쪼개는 연습

"글리치가 안 보인다"는 문제를 해결하려고 할 때, 단순히 "머티리얼 문제인가?"로 접근하면 답이 안 나옵니다. **"렌더가 안 되는 건지 / 머티리얼이 잘못된 건지 / 호출 자체가 안 되는 건지"** 를 로그로 하나씩 확인하면서 원인을 좁혀가는 습관이 생겼습니다.

### 10-6. 완결된 경험의 중요성

이 프로젝트에서 가장 의미 있었던 건 "보스 하나를 만든 것"이 아니라 **시작 화면부터 엔딩까지 하나의 경험으로 엮은 것**이었습니다. 게임은 결국 플레이어의 경험이고, 그 경험은 단일 기능이 아니라 연결에서 나옵니다.

---

## 11. 프로젝트 회고

프로젝트를 마치며 스스로에게 네 가지 질문을 던져봤습니다.

### 🟢 잘한 점 — 무엇을 특히 잘했는가?

**구조적 설계를 처음부터 고민한 것**이 가장 잘한 부분이라고 생각합니다.

단순히 "보스가 공격만 하면 되지"가 아니라, 처음부터 StateTree + DataAsset 구조로 설계해서 확장과 수정이 쉬운 코드를 작성했습니다. 실제로 프로젝트 중반에 공격 패턴을 추가하거나 밸런스를 조정할 때, 기존 코드를 거의 건드리지 않고도 DataAsset만 수정하면 됐습니다.

특히 공격 패턴을 EActiveAttackType enum + DataAsset으로 분리한 결정이 두고두고 도움이 됐습니다. 새 패턴을 추가할 때도 다음 3단계면 됐습니다:

1. enum에 타입 추가
2. AttackExecutor에 해당 타입의 Enter/Tick 함수 추가
3. DataAsset에 등록

두 번째로 잘한 점은 **시작부터 끝까지 완주했다는 것**입니다. 많은 포트폴리오 프로젝트가 "보스만 만들다 끝"나거나 "기능 몇 개만 만들고 마무리 안 됨" 상태로 방치되는데, 시작 화면 → 컷신 → 전투 → 엔딩까지 하나의 흐름으로 연결한 경험은 실제 게임 개발 사이클을 이해하는 데 큰 도움이 됐다고 생각합니다.

### 🟡 부족한 점 — 무엇이 부족했고, 어떻게 극복했는가?

가장 부족했던 건 **UE5의 렌더링 시스템에 대한 이해**였습니다.

글리치 이펙트 구현할 때 SetOverlayMaterial이 Translucent를 지원하지 않는다는 것을 모르고 며칠을 헤맸습니다. "왜 에디터 프리뷰에서는 보이는데 인게임에서는 안 보이지?"라는 질문을 해결하는 데 정말 오랜 시간이 걸렸습니다. 머티리얼의 Blend Mode, Shading Model, 렌더 패스 같은 개념을 그때는 피상적으로만 이해하고 있었던 거죠.

또 UMG의 렌더링 흐름도 부족했습니다. SetColorAndOpacity, SetRenderOpacity, 위젯의 Tint, Color and Opacity 등 비슷해 보이지만 다르게 동작하는 속성들을 구분하지 못해서 페이드 처리에서 헤맸습니다.

이걸 극복하기 위해:

- **공식 문서를 정독**했습니다. 특히 Material Domain과 UMG 관련 문서
- **에러가 날 때마다 원인을 끝까지 추적**했습니다. 단순히 "왜 안 되지?"가 아니라 "어느 단계에서 막히는지" 로그로 추적하는 습관을 들였습니다
- **AI 도구(Claude)의 도움**을 많이 받았습니다. 문제를 설명하고 가능성 있는 원인을 좁혀가는 과정에서 큰 도움이 됐고, 단순히 답을 받는 게 아니라 "왜 그런지"를 이해하며 배우는 방식으로 활용했습니다
- **커뮤니티와 공식 포럼**에서 비슷한 사례를 찾아봤습니다

결과적으로 글리치 이펙트는 세 가지 방법을 시도하고 나서야 "슬롯 교체 + MID" 방식으로 안정화시킬 수 있었고, 이 과정에서 UE5 렌더링에 대한 이해가 훨씬 깊어졌습니다.

### 🔴 직면한 문제와 해결 과정

프로젝트에서 가장 애먹었던 세 가지 문제입니다.

**문제 1: World Leak Fatal Error**

컷신에서 다음 레벨로 전환할 때 에디터가 크래시되는 문제였습니다. 로그를 보니 이전 World가 GC되지 않고 있다는 메시지가 나왔습니다.

```
(Garbage) WBP_Cutscene_C /Engine/Transient.World_13:WBP_Cutscene_C_0
^ This reference is preventing the old World from being GC'd ^
```

처음엔 위젯을 RemoveFromParent 하는 타이밍 문제인 줄 알았는데, 진짜 원인은 람다에서 `this`를 캡처한 것이었습니다. 타이머 람다가 위젯을 참조하고 있으니 위젯이 살아있고, 위젯은 이전 World를 참조하고 있으니 World가 GC 안 되는 연쇄 참조였습니다.

**해결**: `this` 대신 필요한 값들만 명시적으로 캡처

```cpp
UWorld* World = GetWorld();
FName LevelName = NextLevelName;
[World, LevelName]() { UGameplayStatics::OpenLevel(World, LevelName); }
```

이 경험을 통해 **람다 캡처 시 생명주기를 반드시 고민해야 한다**는 걸 몸으로 배웠습니다.

**문제 2: 스킬이 피격 시 끊기는 문제**

텔레포트 킥 같은 여러 단계 스킬을 시전 중에 플레이어가 공격하면 스킬이 중간에 끊겨버렸습니다. 보스답지 않게 너무 약해 보였죠.

원인을 찾기 위해 ReceiveDamage를 타고 들어가 보니, 매번 PlayDirectionalHitReaction이 호출되면서 기존 스킬 몽타주를 덮어쓰고 있었습니다.

**해결**: 몽타주 재생 중이면 히트 리액션 스킵

```cpp
if (UAnimInstance* AnimInst = GetMesh()->GetAnimInstance())
{
    if (!AnimInst->IsAnyMontagePlaying())
    {
        PlayDirectionalHitReaction(DamageInfo.DamageCauser);
    }
}
```

단 한 줄 체크로 "스킬 중에는 공격을 무시하고 밀어붙이는 보스" 느낌을 만들 수 있었습니다. 이 경험은 **게임 느낌은 작은 체크 하나로도 크게 달라진다**는 걸 알게 해줬습니다.

**문제 3: 컷신에서 이전 영상이 순간적으로 보임**

스텝이 바뀔 때 이전 영상의 마지막 프레임이 살짝 보이는 현상이었습니다. 유저 입장에서는 "뭔가 이상한데?" 정도였지만 완성도를 떨어뜨리는 요소였습니다.

원인을 찾기 어려웠던 이유는 타이밍 문제라서 재현이 일관되지 않았기 때문입니다. OpenSource는 호출되는데 UI Image에 반영되는 시점이 달라서 페이드 인 중에 이전 프레임이 보였다 안 보였다 했습니다.

**해결**: 페이드 인 중엔 BackgroundImage를 Hidden으로, 페이드 인 완료 시점에 Visible로 전환

단순해 보이지만, 이 순서 하나로 문제가 완전히 사라졌습니다. **"언제 보여줄 것인가"의 타이밍 제어가 UMG에서 얼마나 중요한지** 배웠습니다.

### 🔵 다음 프로젝트에서 개선하고 싶은 것

**1. GameplayAbilitySystem(GAS)으로 스킬 시스템 마이그레이션**

지금은 보스 공격을 StateTree + 직접 구현 방식으로 했는데, 다음엔 GAS를 정식으로 학습하고 적용해보고 싶습니다. 현재 구조는 보스 전용이지만, GAS는 스킬·버프·디버프·데미지 계산을 통일된 방식으로 관리할 수 있어서 플레이어와 적 모두에게 확장 가능합니다. 실제 상용 게임에서도 많이 쓰이는 구조라 반드시 다뤄봐야 한다고 생각합니다.

**2. 네트워크 멀티플레이 지원**

이번 프로젝트는 싱글 플레이 전제로 만들어서 `GetPlayerCharacter(0)`을 많이 사용했습니다. 다음 프로젝트에서는 처음부터 Replication을 고려한 설계를 해보고 싶습니다. 디지털 트윈이나 시뮬레이션 쪽 취업을 목표로 하는 만큼, 멀티유저 환경에서의 동기화 경험이 중요하다고 생각합니다.

**3. 자동화된 테스트 환경 구축**

이번엔 모든 테스트를 PIE로 손으로 했는데, 공격 패턴 하나 바꾸면 전체 흐름을 다시 돌려봐야 해서 시간이 많이 걸렸습니다. 다음엔 UE Automation Framework나 최소한 테스트 레벨/치트 커맨드를 만들어서 특정 상황을 빠르게 재현할 수 있게 하고 싶습니다.

**4. 더 체계적인 문서화**

프로젝트를 하면서 "왜 이렇게 했는지"를 기억하지 못해 한참 고민한 적이 여러 번 있었습니다. 다음엔 **설계 결정 로그(Design Decision Log)** 를 작성하면서 진행하려고 합니다. 예: "왜 GAS 대신 StateTree를 썼는가", "왜 슬롯 교체 방식을 선택했는가" 같은 것들.

**5. 성능 프로파일링**

이번엔 "일단 동작하게" 만드는 데 집중했는데, 다음엔 Unreal Insights와 Stat 커맨드를 적극 활용해서 프레임 드랍 지점을 찾고 최적화하는 경험도 해보고 싶습니다. 특히 글리치 이펙트처럼 머티리얼을 여러 번 교체하는 부분은 성능 영향이 있을 수 있어서 측정이 필요합니다.

**6. 아트·애니메이션 리소스 직접 제작 또는 더 나은 이해**

지금은 에셋을 활용해서 만들었는데, 다음엔 간단한 머티리얼이나 애니메이션 정도는 직접 만들어볼 수 있는 수준까지 가보고 싶습니다. 엔지니어도 아트 파이프라인을 이해하면 커뮤니케이션이 훨씬 수월해진다고 생각합니다.

---

## 12. 플레이 영상

<iframe width="100%" height="450" src="https://www.youtube.com/embed/Pn31MEZNHq4" title="Scarlet Nexus Karen Boss Mock" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

> 초반에 렉이 좀 있으니 양해 부탁드립니다.

---

## 마치며

이 프로젝트는 단순히 기술을 연습하는 것을 넘어서, **하나의 게임 경험을 처음부터 끝까지 완주한 경험**이라는 점에서 개인적으로 큰 의미가 있었습니다.

스칼렛 넥서스 원작에 비하면 많이 부족하지만, UE5에서 StateTree·DataAsset·UMG·Media Player·Animation Blueprint 등 다양한 시스템을 엮어 하나의 완결된 결과물을 만드는 과정에서 정말 많이 배웠습니다.

특히 **"작동하게 만드는 것"과 "좋게 느껴지게 만드는 것"이 전혀 다른 일**이라는 걸 체감했습니다. 보스가 공격을 한다는 것과, 보스가 "강해 보이게" 공격하는 것은 다른 차원의 문제였고, 그 차이를 메우는 것이 연출이었습니다.

앞으로도 이런 프로젝트를 통해 실전 감각을 계속 키워나가고 싶습니다.

긴 글 읽어주셔서 감사합니다.