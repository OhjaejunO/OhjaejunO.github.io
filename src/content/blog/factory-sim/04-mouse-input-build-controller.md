---
title: "공장 시뮬레이션 게임 개발기 Phase 1.4 — 마우스 입력과 빌드 컨트롤러"
description: "Enhanced Input을 가진 플레이어 캐릭터가 빌드 컨트롤러에 입력을 위임하고, GetHitResultUnderCursorByChannel→WorldToGrid로 커서 셀을 받아 '커서=풋프린트 중심'으로 origin을 환산하며, 좌클릭에서 머신을 spawn→TryPlaceMachine하고, B 토글·R 회전을 처리하는 입력 레이어 이야기."
date: 2026-06-05
category: UE5
series: factory-sim
seriesPart: 4
tags: [UE5, C++, EnhancedInput, 라인트레이스, 빌드모드, 컨트롤러]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 1: 그리드 시스템**
> - 1편: [그리드 시스템 개요](/blog/factory-sim/01-grid-system-overview)
> - 2편: [그리드 데이터 구조와 트랜잭션 안전성](/blog/factory-sim/02-grid-data-structure-and-transaction)
> - 3편: [머티리얼로 그리드 시각화하기](/blog/factory-sim/03-material-grid-visualization)
> - **4편: 마우스 입력과 빌드 컨트롤러** ← 현재 글
> - 5편: Codex Adversarial Review로 잡은 숨은 버그들

## 1. 들어가며

[3편](/blog/factory-sim/03-material-grid-visualization) 마지막에서 `SetVisualizationVisible`이 visibility뿐 아니라 **collision까지** 토글한다고 했습니다. 빌드 모드에 들어가면 베이스 그리드 평면이 `ECC_Visibility` 채널만 Block 해서, *마우스 커서 라인 트레이스*만 그 평면을 맞히고 다른 게임플레이 trace는 그리드를 못 본다는 거였죠.

이번 글은 **그 트레이스를 쏘는 쪽** — 입력 레이어입니다. 그런데 실제 코드를 열어보니 입력은 한 액터가 아니라 **두 액터에 나뉘어** 있었어요.

```
플레이어 캐릭터 (AOJJ_Player)        ← Enhanced Input 소유. IMC_Player / IMC_Build
        │ ToggleBuildMode / OnLeftClickPressed / RotateHoverClockwise (위임 호출)
        ▼
빌드 컨트롤러 (AOJJ_BuildController) ← 호버/배치/회전 로직. 자체 Tick으로 호버 갱신
        │ TryPlaceMachine / UpdateHoverPreview / WorldToGrid
        ▼
그리드 (AOJJ_Grid)                   ← 2편(데이터) · 3편(시각화)
```

다룰 동작은 네 가지입니다.

1. **마우스 호버 추적** — 커서가 가리키는 셀에 호버 미리보기를 띄운다.
2. **좌클릭 배치** — 호버 중인 셀에 머신을 실제로 놓는다.
3. **B키 빌드 모드 토글** — 빌드/플레이 상태를 오간다.
4. **R키 회전** — 들고 있는 머신을 90도씩 돌린다.

> ℹ️ 빌드 컨트롤러는 머신 외에 컨베이어·전력 등 여러 배치 모드를 갖고 있지만, 그건 후속 Phase 주제라 이 글에서는 **머신 모드 경로만** 인용합니다. 코드 스니펫에서 다른 모드 분기는 `// (... 생략)`으로 잘라냈어요.

---

## 2. 입력은 누가 갖는가 — 위임 경계

먼저 짚을 게, **빌드 컨트롤러는 입력을 직접 받지 않습니다.** 키 바인딩은 플레이어 캐릭터(`AOJJ_Player`)가 Enhanced Input으로 들고 있고, 빌드 관련 키는 컨트롤러의 public 함수로 *위임 호출*만 합니다.

```cpp
void AOJJ_Player::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* EnhancedInput = Cast<UEnhancedInputComponent>(PlayerInputComponent);
    if (!EnhancedInput)
    {
        UE_LOG(LogTemp, Error, TEXT("[OJJ_Player] EnhancedInputComponent 캐스트 실패"));
        return;
    }

    // (이동/시점/줌/점프/스프린트/배치모드전환 바인딩 — 생략)

    if (IA_Build)
    {
        EnhancedInput->BindAction(IA_Build, ETriggerEvent::Started, this, &AOJJ_Player::ToggleBuild);
    }
    if (IA_BuildPlace)
    {
        // 누름=배치/드래그시작, 뗌=드래그커밋, 취소=드래그취소.
        EnhancedInput->BindAction(IA_BuildPlace, ETriggerEvent::Started,   this, &AOJJ_Player::BuildPlace);
        EnhancedInput->BindAction(IA_BuildPlace, ETriggerEvent::Completed, this, &AOJJ_Player::BuildPlaceReleased);
        EnhancedInput->BindAction(IA_BuildPlace, ETriggerEvent::Canceled,  this, &AOJJ_Player::BuildPlaceCanceled);
    }
    if (IA_MachineRotate)
    {
        // 머신 회전은 1회성 토글이라 Started (누를 때 한 번)
        EnhancedInput->BindAction(IA_MachineRotate, ETriggerEvent::Started, this, &AOJJ_Player::BuildRotateMachine);
    }
}
```

그리고 각 핸들러는 컨트롤러로 넘기기만 합니다.

```cpp
void AOJJ_Player::ToggleBuild(const FInputActionValue& Value)
{
    if (!BuildController) { return; }

    // Enter/Exit 자체 가드(같은 상태면 no-op) 덕분에 토글 라우팅만 하면 됨
    BuildController->ToggleBuildMode();

    // BuildController가 단일 진실원 — 실제 전환 결과(early-return 시 미전환)에 맞춰
    // 플레이어측(카메라/가시성)을 적용. TargetGrid 미설정 등으로 Enter가 무산되면
    // 카메라도 안 바뀜(half-state 방지).
    ApplyBuildModeView(BuildController->IsInBuildMode());
}

void AOJJ_Player::BuildPlace(const FInputActionValue& Value)
{
    if (!BuildController) { return; }
    BuildController->OnLeftClickPressed();          // 빌드모드 밖이면 내부 가드로 no-op
}

void AOJJ_Player::BuildRotateMachine(const FInputActionValue& Value)
{
    if (BuildController) { BuildController->RotateHoverClockwise(); }
}
```

이 분리가 주는 게 두 가지예요.

- **컨트롤러는 "입력이 어떻게 들어오는지" 모른다.** `ToggleBuildMode` / `OnLeftClickPressed` / `RotateHoverClockwise`는 전부 `BlueprintCallable`이라, Enhanced Input이든 UMG 버튼이든 테스트 코드든 같은 진입점을 호출하면 됩니다. 입력 소스가 바뀌어도 빌드 로직은 그대로예요.
- **빌드 모드에서 카메라 조작을 끊을 수 있다.** 플레이어는 빌드 모드에 들어갈 때 IMC를 통째로 갈아끼웁니다(`IMC_Player` → `IMC_Build`). 빌드 IMC에는 시점 회전(`IA_Look`)이 **빠져 있어서**, 빌드 중에는 마우스를 움직여도 카메라가 안 돌고 커서로 셀만 가리킬 수 있어요.

> 💡 `ToggleBuild`의 마지막 줄이 미묘하지만 중요합니다. 플레이어는 `ToggleBuildMode()`를 부른 *다음* `IsInBuildMode()`를 **되물어** 그 결과로 카메라/가시성을 적용해요. 컨트롤러가 `TargetGrid` 미설정 등으로 진입을 거부(early-return)하면 `IsInBuildMode()`가 그대로 `false`라, 카메라만 빌드뷰로 넘어가고 로직은 안 넘어간 **half-state**가 안 생깁니다. 상태의 단일 진실원은 끝까지 컨트롤러예요.

---

## 3. 호버 추적 — 빌드모드에서만 도는 Tick

호버 갱신은 컨트롤러의 **자체 Tick**이 굴립니다. 다만 Tick을 항상 돌리지 않고, 빌드 모드일 때만 켭니다.

```cpp
AOJJ_BuildController::AOJJ_BuildController()
{
    // 빌드모드 동안만 호버를 갱신하면 되므로 Tick은 켜두되 기본 비활성.
    // Enter/ExitBuildMode에서 SetActorTickEnabled로 on/off → 빌드모드 밖 0비용.
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.bStartWithTickEnabled = false;

    // (배치 모드별 기본 클래스 설정 — 후속 Phase, 생략)
}

void AOJJ_BuildController::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    // Enter/Exit에서 Tick을 on/off하지만, 방어적으로 모드 가드도 유지
    // (UpdateMouseHover 내부에도 가드 있음).
    if (bIsBuildMode)
    {
        UpdateMouseHover();
    }
}
```

여기서 짚을 점. **빌드 모드가 아닐 때는 Tick 자체가 꺼져 있습니다.** `bStartWithTickEnabled = false`로 시작하고, 6절에서 볼 `EnterBuildMode`가 `SetActorTickEnabled(true)`로 켜요. 매 프레임 `if (bIsBuildMode) return`으로 빠져나오는 것도 아니고, *프레임 함수가 아예 호출되지 않는* 0비용 상태입니다. 안쪽 `if (bIsBuildMode)`는 켜고 끄는 타이밍 사이의 방어막일 뿐이에요.

실제 호버는 `UpdateMouseHover`에 있습니다. 머신 모드 경로만 잘라서 봅니다.

```cpp
void AOJJ_BuildController::UpdateMouseHover()
{
    if (!bIsBuildMode) { return; }
    if (!TargetGrid)   { return; }

    APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0);
    if (!PC) { return; }

    FHitResult Hit;
    const bool bHit = PC->GetHitResultUnderCursorByChannel(
        UEngineTypes::ConvertToTraceType(ECC_Visibility),   // ★ 3편의 그 채널
        /*bTraceComplex=*/ false,
        Hit);

    if (!bHit)
    {
        // 트레이스 실패 → stale 미리보기/캐시가 다음 클릭에 잘못 적용되지 않도록 명시적 리셋
        TargetGrid->ClearHoverPreview();
        CurrentHoverCell = FIntPoint(INT_MIN, INT_MIN);
        return;
    }

    const FIntPoint CursorCell = TargetGrid->WorldToGrid(Hit.Location);

    // (Conveyor / PowerLine 모드 분기 — 후속 Phase, 생략)

    TSubclassOf<AMachineBase> ActiveMachineClass = GetActiveMachineClass();
    if (!ActiveMachineClass) { return; }

    // floor 또는 이미 배치된 머신 위에서만 hover 유지.
    // 머신 Cube mesh가 Visibility를 Block해 trace를 가로채도, 머신 위 XY는 점유 셀에
    // 정확히 매핑되므로 그대로 통과 → 점유와 겹친 풋프린트가 빨강으로 표시됨.
    // 그 외 표면(캐릭터/벽 등)은 off-grid이므로 ClearHoverPreview로 차단.
    UPrimitiveComponent* HitComp = Hit.GetComponent();
    AActor* HitActor = Hit.GetActor();
    const bool bHitFloor   = (HitComp == TargetGrid->GetGridFloorMesh());
    const bool bHitMachine = HitActor && HitActor->IsA<AMachineBase>();
    if (!bHitFloor && !bHitMachine)
    {
        TargetGrid->ClearHoverPreview();
        CurrentHoverCell = FIntPoint(INT_MIN, INT_MIN);
        return;
    }

    // Tick마다 호출되는 경로라 동일 셀이면 ISM 리빌드 스킵
    if (CursorCell == CurrentHoverCell) { return; }

    AMachineBase* DefaultMachine = ActiveMachineClass.GetDefaultObject();
    if (!DefaultMachine) { return; }

    // cursor cell → lower-left origin (마우스 = 풋프린트 중심 정책 — 4절)
    const FIntPoint Origin = ComputeOriginFromCursorCell(CursorCell, DefaultMachine, HoverRotationSteps);

    TargetGrid->UpdateHoverPreview(DefaultMachine, Origin, HoverRotationSteps);
    CurrentHoverCell = CursorCell;
}
```

읽기 순서대로 짚습니다.

1. **`GetHitResultUnderCursorByChannel(ECC_Visibility, ...)`** — 3편에서 베이스 그리드 평면이 Block 하도록 열어둔 바로 그 채널. 두 글이 여기서 맞물립니다. 평면이 `Visibility`만 Block 하니 이 트레이스는 정확히 그리드(와 머신)만 맞히고 캐릭터·카메라 trace와 안 섞여요. `bTraceComplex=false`는 단순 콜리전으로 충분하다는 뜻.
2. **빗맞음 처리** — 커서가 그리드 밖 허공을 가리키면 이전 미리보기를 지우고 `CurrentHoverCell`을 `(INT_MIN, INT_MIN)` 센티넬로 되돌립니다. 이 센티넬은 "유효 호버 셀 없음"의 약속된 표식이에요(클릭 가드에서 다시 씁니다).
3. **`WorldToGrid`로 환산** — 2편에서 만든 함수. `Hit.Location`을 셀 좌표 `FIntPoint`로.
4. **floor / machine hit 필터** — 커서가 그리드 floor 또는 이미 놓인 머신 위일 때만 미리보기를 유지하고, 그 외(캐릭터/벽 등)는 차단. 머신 위를 가리켜도 그 XY는 점유 셀로 매핑되니 자연스럽게 빨강으로 표시됩니다.
5. **셀이 바뀐 프레임에만 갱신** — `CursorCell == CurrentHoverCell`이면 그냥 리턴. 3편 `UpdateHoverPreview`는 매 호출마다 `ClearInstances` → 풋프린트 셀마다 `AddInstance`를 다시 돌기 때문에, 같은 셀 위에서 마우스가 떨릴 때마다 ISM을 통째로 재구축하면 헛일이에요.

> 💡 호버 *판정*(녹/빨)은 컨트롤러가 하지 않습니다. 컨트롤러는 머신과 origin만 넘기고, 점유/out-of-bounds로 녹·빨을 가르는 건 3편 `UpdateHoverPreview` 안쪽 일이에요. 입력 레이어는 끝까지 "어느 셀인지"만 압니다.

---

## 4. 커서 = 풋프린트 중심 — `ComputeOriginFromCursorCell`

위에서 두 번 나온 `ComputeOriginFromCursorCell`이 이번 편에서 새로 등장하는 핵심 변환입니다. 마우스가 가리키는 셀을 **풋프린트의 중심**으로 보고, 거기서 머신의 *lower-left origin*을 역산해요. (2편에서 점유 데이터는 전부 lower-left origin 기준이었죠.)

```cpp
FIntPoint AOJJ_BuildController::ComputeOriginFromCursorCell(
    FIntPoint CursorCell, AMachineBase* Machine, int32 RotationSteps) const
{
    if (!Machine) { return CursorCell; }

    // AOJJ_Grid::CalculateFootprint / GetMachinePlacementLocation과 동일한
    // 정수화·회전 규칙(EffectiveSize). step 0이면 기존과 동일.
    const FIntPoint Size = AOJJ_Grid::EffectiveSize(Machine->GetMachineSize(), RotationSteps);

    // (Size-1)/2 정수 나눗셈 → lower-left bias. 1x1 offset 0 (회귀 없음).
    return FIntPoint(CursorCell.X - (Size.X - 1) / 2, CursorCell.Y - (Size.Y - 1) / 2);
}
```

`(Size - 1) / 2` 정수 나눗셈이 **lower-left bias**를 만듭니다. 헤더 주석에 적어둔 표를 그대로 옮기면:

| 머신 크기 | offset | 마우스가 가리키는 위치 |
|---|---|---|
| 1×1 | 0 | 그 셀 (회귀 없음) |
| 2×2 | 0 | 머신 좌하단 셀 |
| 3×3 | 1 | 정중앙 셀 |
| 4×4 | 1 | 중앙 좌하단 셀 |

홀수 크기는 정확히 가운데가 잡히고, 짝수 크기는 가운데가 없으니 좌하단으로 한 칸 치우치게 두는 정책이에요.

두 가지를 강조하고 싶습니다.

**(a) 회전이 `EffectiveSize` 하나를 거친다.**
`EffectiveSize`는 `AOJJ_Grid`의 static 함수로, 머신 raw 치수를 정수화하고 90° step을 적용합니다. step이 짝수(0·2)면 `(X,Y)`, 홀수(1·3)면 `(Y,X)`로 X/Y를 swap해요. origin 계산도, 풋프린트 계산(`CalculateFootprint`)도, 시각 보정(`GetMachinePlacementLocation`)도 **전부 이 함수 하나**를 통과합니다. 그래서 회전된 2×1이 1×2로 도는 게 모든 경로에서 일관돼요.

**(b) 입력 방향과 시각 보정 방향이 반대지만 같은 규칙을 쓴다.**
`ComputeOriginFromCursorCell`은 *cursor → origin*(입력 방향)이고, 3편에서 잠깐 언급한 머신 메시 배치는 *origin → footprint center*(시각 보정 방향)입니다. 방향은 정반대지만 **같은 `EffectiveSize` 가정** 위에서 돌아야, 호버/배치와 점유/메시 위치가 서로 어긋나지 않습니다. 한쪽만 정수화 규칙이 달라지면 미리보기와 실제 점유가 한 칸씩 밀리는 버그가 나요. (이런 종류가 정확히 5편 주제입니다.)

---

## 5. 좌클릭 — spawn 후 트랜잭션 배치

여기서 한 가지가 제 예상과 달랐어요. 저는 "미리보기용 머신을 들고 다니다가 클릭에서 그걸 확정한다"고 생각했는데, 실제 코드는 **미리보기 동안 머신 액터를 아예 spawn하지 않습니다.** 호버는 클래스의 CDO(`GetDefaultObject`)에서 풋프린트 크기만 읽어 그리고, **진짜 머신은 좌클릭 순간에 spawn**해요. 덕분에 미리보기가 머신의 `BeginPlay`·tick·collision·게임플레이 로직 같은 부작용에서 자유롭습니다.

```cpp
void AOJJ_BuildController::OnLeftClickPressed()
{
    // SP-only contract — 클라이언트에서 호출되면 TryPlaceMachine의 HasAuthority ensure가
    // 트리거되고 spawn된 머신이 orphan으로 남음 → 진입부에서 차단.
    if (!HasAuthority())
    {
        UE_LOG(LogTemp, Warning,
            TEXT("[BuildController] OnLeftClickPressed called on non-authority — SP-only contract"));
        return;
    }
    if (!bIsBuildMode) { return; }

    // (Conveyor / PowerLine 모드 분기 — 후속 Phase, 생략)

    TSubclassOf<AMachineBase> ActiveMachineClass = GetActiveMachineClass();
    if (!TargetGrid || !ActiveMachineClass) { return; }

    // 마우스가 floor 밖이라 호버 갱신이 한 번도 안 됐으면 클릭 무시 (센티넬 가드)
    if (CurrentHoverCell.X == INT_MIN || CurrentHoverCell.Y == INT_MIN) { return; }

    AMachineBase* DefaultMachine = ActiveMachineClass.GetDefaultObject();
    if (!DefaultMachine) { return; }

    // 호버와 같은 변환을 써야 미리보기와 실제 배치가 어긋나지 않음.
    const FIntPoint Origin = ComputeOriginFromCursorCell(CurrentHoverCell, DefaultMachine, HoverRotationSteps);

    if (!TargetGrid->CanPlaceMachine(DefaultMachine, Origin, HoverRotationSteps))
    {
        UE_LOG(LogTemp, Log, TEXT("[BuildController] origin %s 배치 불가 (bounds/점유)"), *Origin.ToString());
        return;     // spawn 전에 거름 — 놓을 수 없으면 머신을 만들지도 않는다
    }

    UWorld* World = GetWorld();
    if (!World) { return; }

    FActorSpawnParameters SpawnParams;
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    SpawnParams.Owner = this;

    AMachineBase* NewMachine = World->SpawnActor<AMachineBase>(
        ActiveMachineClass, FVector::ZeroVector, FRotator::ZeroRotator, SpawnParams);
    if (!NewMachine) { return; }

    FString OutReason;
    if (!TargetGrid->TryPlaceMachine(NewMachine, Origin, OutReason, HoverRotationSteps))
    {
        UE_LOG(LogTemp, Warning, TEXT("[BuildController] TryPlaceMachine 실패: %s"), *OutReason);
        NewMachine->Destroy();      // 등록 실패 → spawn한 머신을 즉시 파괴 (orphan 방지)
        return;
    }

    // 메시 yaw 회전 — TryPlaceMachine이 회전 footprint 중심에 액터를 놓았으므로
    // 그 중심 기준으로 yaw만 돌리면 center-anchor 메시가 회전 footprint와 정렬.
    NewMachine->SetActorRotation(FRotator(0.f, 90.f * HoverRotationSteps, 0.f));

    // 직전 origin이 이제 점유됨 → 다음 호버에서 빨강으로 강제 재표시
    CurrentHoverCell = FIntPoint(INT_MIN, INT_MIN);
}
```

2편에서 만든 트랜잭션이 여기서 빛을 봅니다.

- **두 겹 검증** — `CanPlaceMachine`으로 spawn 전에 먼저 거르고, 통과하면 spawn한 뒤 `TryPlaceMachine`으로 실제 등록합니다. spawn 후 등록이 실패하면(`SetActorLocation` 실패 등 2편의 그 경로) `Destroy()`로 머신을 즉시 파괴해 orphan을 안 남겨요. 점유 맵 쪽 롤백은 2편 `TryPlaceMachine`이 내부에서 알아서 합니다 — 컨트롤러는 점유 맵을 한 번도 직접 안 만져요.
- **센티넬 가드** — 호버가 한 번도 유효하지 않았으면(`CurrentHoverCell`이 `INT_MIN`) 클릭을 무시합니다. 3절에서 빗맞음/off-grid일 때 이 값을 센티넬로 박아둔 게 여기서 작동해요.
- **SP-only 정직함** — 맨 위 `HasAuthority` 가드는 이 컨트롤러가 아직 싱글플레이 전용이라는 계약입니다. 헤더에도 멀티플레이 전환 시 "좌클릭 → Server RPC → 서버 spawn/등록 → replication" 으로 가야 한다고 한계를 명시해뒀어요. 멀티는 후속 Phase 숙제로 남겼습니다.

> 📐 (배치 성공/실패 — 녹색 호버에서 좌클릭 → 머신 안착, 빨강에서 좌클릭 → 거부 로그 — 스크린샷 후속 첨부 예정)

---

## 6. B키 — 빌드 모드 토글

빌드 모드 전환은 `EnterBuildMode` / `ExitBuildMode` 두 함수로 나뉘고, `ToggleBuildMode`가 현재 상태를 보고 둘 중 하나로 분기합니다.

```cpp
void AOJJ_BuildController::ToggleBuildMode()
{
    if (bIsBuildMode) { ExitBuildMode(); }
    else              { EnterBuildMode(); }
}

void AOJJ_BuildController::EnterBuildMode()
{
    if (bIsBuildMode) { return; }                  // 이미 빌드모드면 no-op (자체 가드)

    if (!TargetGrid)
    {
        UE_LOG(LogTemp, Warning, TEXT("[BuildController] TargetGrid 미설정 — EnterBuildMode 중단"));
        return;
    }
    // (모드별 클래스 미설정 가드 — 머신 모드는 MachineClass 필요, 그 외 모드 생략)
    if (PlacementMode == EOJJ_BuildPlacementMode::Machine && !MachineClass) { return; }

    TargetGrid->SetVisualizationVisible(true);     // ★ 3편: 시각화 + collision 켜기
    bIsBuildMode = true;
    HoverRotationSteps = 0;                         // 빌드 세션은 항상 미회전으로 시작

    SetActorTickEnabled(true);                      // 빌드모드 동안에만 호버 Tick 가동

    if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
    {
        PC->bShowMouseCursor = true;
        PC->bEnableClickEvents = true;
        PC->bEnableMouseOverEvents = true;
    }

    // 첫 UpdateMouseHover가 무조건 갱신을 트리거하도록 sentinel로 초기화
    CurrentHoverCell = FIntPoint(INT_MIN, INT_MIN);
}

void AOJJ_BuildController::ExitBuildMode()
{
    if (!bIsBuildMode) { return; }                  // 이미 빠져나왔으면 no-op

    if (TargetGrid)
    {
        TargetGrid->SetVisualizationVisible(false); // 시각화 + collision 끄기
        TargetGrid->ClearHoverPreview();
    }
    bIsBuildMode = false;

    SetActorTickEnabled(false);                     // 호버 Tick 정지 (빌드모드 밖 0비용)

    if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
    {
        PC->bShowMouseCursor = false;
    }

    CurrentHoverCell = FIntPoint(INT_MIN, INT_MIN);
    HoverRotationSteps = 0;
    // (드래그 상태 정리 / 전력 그리드 갱신 등 후속 Phase 코드 — 생략)
}
```

설계 포인트가 셋입니다.

**(1) Enter/Exit 자체 가드 — 중복 진입/탈출이 no-op.**
`EnterBuildMode`는 이미 빌드 모드면 첫 줄에서 그냥 리턴, `ExitBuildMode`도 이미 나왔으면 리턴. 그래서 `ToggleBuildMode`는 "지금 상태의 반대 함수를 부른다"만 하면 되고, 어디서 두 번 불려도 상태가 깨지지 않아요. 2편에서 `RegisterMachineInternal`을 단일 진입점으로 둔 것과 같은 결입니다 — 상태를 바꾸는 길을 좁혀서 desync를 구조적으로 막는 거죠.

**(2) Tick을 켜고 끈다 — 빌드모드 밖 0비용.**
`SetActorTickEnabled(true/false)`가 3절에서 본 그 토글이에요. 빌드 모드를 나가면 `UpdateMouseHover`를 부르는 Tick 자체가 멈춰서, 빌드 안 할 때 커서 라인 트레이스가 단 한 번도 안 돕니다.

**(3) 3편 collision 격리가 여기서 켜지고 꺼진다.**
`SetVisualizationVisible(true)`가 베이스 그리드 평면의 `Visibility` Block을 살리고(그래야 3절 커서 트레이스가 맞고), `false`가 다시 `NoCollision`으로 되돌립니다. 3편에서 "이 격리는 빌드 모드 동안만 임시로 켜질 걸 전제로 설계됐다"고 했는데, 그 임시성을 보장하는 게 바로 이 Enter/Exit 쌍이에요. 빌드 모드를 나가는 순간 그리드 평면은 어떤 trace에도 안 잡히는 상태로 돌아갑니다.

> 💡 그리고 2절에서 본 플레이어쪽 `ToggleBuild`가 여기에 얹힙니다. 플레이어는 `ToggleBuildMode()`를 부른 뒤 `IsInBuildMode()`를 되물어 카메라/IMC를 적용해요. 위 `EnterBuildMode`가 `TargetGrid` 미설정으로 early-return하면 `bIsBuildMode`가 그대로 `false`라, 플레이어 카메라도 안 넘어갑니다. **상태의 단일 진실원이 컨트롤러**라서 가능한 일이에요.

### 왜 토글인가 — 레벨 BP 자동 진입에서 넘어온 길

사실 이 구조가 처음부터 이랬던 건 아닙니다. 초기엔 빌드 모드 진입을 **레벨 블루프린트**가 맡았어요. 레벨이 시작되면 BP가 자동으로 빌드 모드에 들여보냈죠. Play만 누르면 곧장 격자가 깔려서 머신 배치를 반복하기엔 빨랐습니다.

그런데 세 가지가 걸렸어요.

1. **빠져나갈 길이 없다.** 자동 진입은 "켜는 문"만 있고 "나가는 문"이 없습니다. 라인이 실제로 도는 걸 보거나 캐릭터로 돌아다니려면 빌드 모드를 *벗어나야* 하는데, 그 상태 전이가 아예 없었어요.
2. **3편 collision 격리가 영구화된다.** `SetVisualizationVisible(true)`가 베이스 그리드 평면의 `Visibility` Block을 켠 채로 계속 두면, 다른 시스템의 `Visibility` 트레이스가 *보이지 않는 그리드 평면*에 상시 걸립니다. 3편에서 "이 격리는 빌드 모드 동안만 임시로"라고 설계해놓은 게 뒤집혀요.
3. **호버 Tick이 영원히 돈다.** 빌드할 생각이 없을 때도 매 프레임 커서 트레이스가 돌아 순수 낭비.

게다가 나중에 C++ 쪽에도 입력을 붙이면서, 레벨 BP와 C++ 양쪽에 토글 로직이 생겨 **토글이 이중으로 먹는** 버그까지 났습니다.

그래서 `feat(player): B키 빌드모드 토글 및 그리드 연동` 커밋(`ab94329`)에서 레벨 BP의 입력 로직을 걷어내고 C++ 한 곳으로 일원화했어요. 커밋 메시지 그대로 "레벨 BP의 중복 입력 로직 제거 → C++로 일원화 (이중 토글 해결)". BeginPlay 자동 진입 대신 B키 토글로 바꾸고, 위에서 본 Enter/Exit 자체 가드 + `SetActorTickEnabled` 0비용 + 컨트롤러 단일 진실원 구조로 정리한 게 지금 코드입니다. 자동 진입이 편하다고 상태 전이를 없앤 대가가, 빠져나갈 수 없음·격리 영구화·이중 토글로 한꺼번에 돌아온 셈이에요.

---

## 7. R키 — 회전

멀티셀 머신은 방향이 있습니다. R키로 시계방향 90도씩 돌려요.

```cpp
void AOJJ_BuildController::RotateHoverClockwise()
{
    // 회전은 머신 호버 전용 — 컨베이어 모드 등에선 무시. (모드 가드 일부 생략)
    if (!bIsBuildMode || PlacementMode != EOJJ_BuildPlacementMode::Machine)
    {
        return;
    }

    HoverRotationSteps = (HoverRotationSteps + 1) % 4;      // 0→1→2→3→0

    // 마우스가 같은 셀에 멈춰 있어도 회전이 즉시 미리보기에 반영되도록
    // sentinel 리셋 후 강제 갱신. (UpdateMouseHover는 같은 셀이면 rebuild를 스킵하므로.)
    CurrentHoverCell = FIntPoint(INT_MIN, INT_MIN);
    UpdateMouseHover();
}
```

세 가지만 짚습니다.

- **회전 상태를 컨트롤러가 소유한다.** `HoverRotationSteps`(0~3)는 컨트롤러 멤버예요. 호버는 머신 CDO로 그리는데 CDO에는 인스턴스별 회전을 담을 수 없으니, 회전값을 컨트롤러가 들고 다니며 `ComputeOriginFromCursorCell` · `UpdateHoverPreview` · `CanPlaceMachine` · `TryPlaceMachine`에 **인자로 흘려보냅니다**. 머신 액터를 직접 돌리는 게 아니라 step 정수 하나가 모든 경로를 관통해요.
- **회전 직후 강제 재그리기.** 마우스를 안 움직여도 풋프린트 모양이 바뀐 걸 즉시 봐야 하니, `CurrentHoverCell`을 센티넬로 리셋해 5절의 "같은 셀이면 스킵" 최적화를 일부러 무력화한 뒤 `UpdateMouseHover`를 한 번 직접 부릅니다. 2×1이 1×2로 도는 게 그 자리에서 갱신돼요.
- **호버와 배치가 같은 step을 쓴다.** 5편 떡밥인데, 호버 미리보기와 실제 배치(`OnLeftClickPressed`)가 **둘 다 `HoverRotationSteps`** 를 넘깁니다. 그래서 "보이는 대로 놓인다"가 보장돼요. 풋프린트 셀 계산 자체(회전 반영)는 4절의 `EffectiveSize`를 통해 그리드가 담당하고, 컨트롤러는 step만 일관되게 넘기는 역할입니다.

> 📐 (R키로 2×1 머신을 돌렸을 때 호버 풋프린트가 1×2로 바뀌는 연속 스크린샷 후속 첨부 예정)

---

## 8. 마치며

이번 편 요약은 네 줄입니다.

1. **입력은 플레이어가, 빌드 로직은 컨트롤러가** — 캐릭터의 Enhanced Input이 `ToggleBuildMode`/`OnLeftClickPressed`/`RotateHoverClockwise`로 위임하고, 컨트롤러는 입력 소스를 모른 채 호버/배치/회전만 한다. 상태의 단일 진실원은 컨트롤러.
2. **호버 Tick은 빌드모드에서만 돈다** — `SetActorTickEnabled`로 0비용, `ECC_Visibility` 트레이스(3편) → `WorldToGrid`(2편) → 같은 셀이면 ISM 리빌드 스킵.
3. **커서 = 풋프린트 중심** — `ComputeOriginFromCursorCell`이 `EffectiveSize`로 회전·정수화를 공유해, 호버·배치·점유·메시 위치가 한 칸도 안 밀린다.
4. **배치는 spawn 후 트랜잭션** — 미리보기엔 CDO만 쓰고 진짜 머신은 클릭에서 spawn, `CanPlaceMachine`으로 먼저 거른 뒤 `TryPlaceMachine` 실패 시 `Destroy`. 점유 맵은 끝까지 그리드가 책임진다.

여기까지가 **Phase 1 — 그리드 시스템**의 정공법 코드입니다. 1편(개요) → 2편(데이터/트랜잭션) → 3편(시각화) → 4편(입력)으로, 셀 위에 머신을 미리보고 놓고 돌리는 한 사이클이 완성됐어요.

그런데 이 네 편의 코드는 *제가 의도한 대로 동작하는 버전*입니다. 다음 **5편**은 결이 달라요. 이 코드를 AI 도구(Codex)에게 **adversarial review** — "이걸 어떻게 깨뜨릴 수 있나"를 작정하고 찾게 하는 — 로 돌렸고, 그 과정에서 *컴파일도 통과하고 크래시도 안 나는데 게임은 조용히 망가지는* 부류의 버그들이 나왔습니다. 4절에서 흘린 "정수화 규칙이 한쪽만 달라지면 한 칸씩 밀린다", 5절의 spawn/등록 정합 같은 — 지금까지 "이렇게 막았다"고 적은 장치들이 정말 막고 있었는지를 AI 리뷰어로 되짚는 글입니다.

다음 글에서 이어집니다.

— JJ
