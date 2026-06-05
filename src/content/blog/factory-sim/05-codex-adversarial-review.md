---
title: "공장 시뮬레이션 게임 개발기 Phase 1.5 — Codex Adversarial Review로 잡은 숨은 버그들"
description: "Phase 1 그리드부터 그 위에 쌓은 입력·배치·컨베이어까지, Codex로 adversarial review를 돌려 잡은 silent bug들의 일지. ghost occupancy 롤백, 양방향 맵 stale 누수, 호버 색이 거짓말하던 버그, 피벗 무관 Z 안착, 비유한 입력 방어, 빌드 진입 시 영구 질주 — AI 도구를 코드 리뷰어로 쓰는 워크플로우 이야기."
date: 2026-06-05
category: AI
series: factory-sim
seriesPart: 5
tags: [AI, Codex, 코드리뷰, UE5, C++, 디버깅]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 1: 그리드 시스템**
> - 1편: [그리드 시스템 개요](/blog/factory-sim/01-grid-system-overview)
> - 2편: [그리드 데이터 구조와 트랜잭션 안전성](/blog/factory-sim/02-grid-data-structure-and-transaction)
> - 3편: [머티리얼로 그리드 시각화하기](/blog/factory-sim/03-material-grid-visualization)
> - 4편: [마우스 입력과 빌드 컨트롤러](/blog/factory-sim/04-mouse-input-build-controller)
> - **5편: Codex Adversarial Review로 잡은 숨은 버그들** ← 현재 글

## 1. 들어가며

1편부터 4편까지의 코드는 전부 *제가 의도한 대로 도는 버전*이었습니다. 컴파일되고, 플레이하면 머신이 놓이고, 격자가 보이고, 회전이 됩니다. 거기서 멈추면 "다 됐다"고 말하기 쉬워요.

이번 글은 거기서 한 걸음 더 간 기록입니다. 짜둔 코드를 AI 도구(**Codex**)에게 **adversarial review** — "이게 잘 도는지 봐줘"가 아니라 **"이걸 어떻게 깨뜨릴 수 있는지 작정하고 찾아봐"** — 로 돌렸고, 그 과정에서 *컴파일도 통과하고 크래시도 안 나는데 게임은 조용히 망가지는* 부류의 버그들이 나왔습니다.

> ℹ️ 범위를 미리 밝혀둘게요. 1~4편은 Phase 1 그리드에 한정했지만, adversarial review는 프로젝트가 자라는 내내 돌렸습니다. 그래서 이 글에는 Phase 1 그리드뿐 아니라 그 위에 쌓은 **입력·배치 보정·컨베이어** 코드에서 잡힌 것들도 섞여 있어요. "Phase 1을 닫는 회고 + 그 이후로 이어진 리뷰 일지" 정도로 읽어주시면 됩니다.

silent bug가 까다로운 이유는 단순합니다. 에러 메시지가 없어요. 한 시간 플레이하다 "어? 여기 뭐가 안 놓이는데 정작 아무것도 안 보이네" 싶을 때, 그제서야 점유 맵을 콘솔로 직접 찍어봐야 보입니다. 그런 걸 *사람이 다시 읽어서* 잡는 건 지치는 일이라, 리뷰어 한 명을 AI로 세워본 거예요.

---

## 2. adversarial review를 어떻게 돌렸나

워크플로우 자체는 거창하지 않습니다.

- 한 덩어리(예: `OJJ_Grid`의 배치 경로, `OJJ_BuildController`의 입력 경로)를 짠다.
- Codex에게 **그 코드를 깨뜨리는 시나리오**를 찾게 한다. "이 함수가 중간에 실패하면? 이 포인터가 죽으면? 음수가 들어오면? 멀티셀·회전·경계에서는?"
- 나온 지적을 **severity(High / Medium / Low)** 로 분류해서, 진짜 결함만 코드에 반영한다.
- 반영한 자리에는 *왜 그렇게 고쳤는지*를 주석으로 남긴다 — 다음에 같은 자리를 건드릴 사람(미래의 나 포함)을 위해.

그래서 소스 곳곳에 `// (Codex 지적: ...)`, `// (Codex [Medium] 대응)`, `// (Codex #2)` 같은 흔적이 남아 있어요. 이 글의 코드 스니펫은 전부 그 실제 소스에서 가져왔습니다.

아래부터는 잡힌 버그를 *증상의 종류*로 묶어 풀어봅니다. 데이터가 새는 것 → 시각이 거짓말하는 것 → 좌표·기하의 함정 → 상태가 고착되는 것 순서로요.

---

## 3. 데이터가 조용히 새는 것

### 3-1. ghost occupancy — 트랜잭션 마지막 단계가 실패하면?

2편에서 다뤘던 그 코드입니다. Codex가 가장 먼저 찌른 지점이기도 했어요. "`TryPlaceMachine`에서 점유 맵에 등록은 했는데, 그 다음 `SetActorLocation`이 `false`를 돌려주면?"

```cpp
bool AOJJ_Grid::TryPlaceMachine(AMachineBase* Machine, FIntPoint Origin, FString& OutReason, int32 RotationSteps)
{
    if (!RegisterMachineInternal(Machine, Origin, OutReason, RotationSteps))
    {
        return false;
    }

    // center anchor 보정. 회전 시 회전된 footprint center로 정렬.
    if (!Machine->SetActorLocation(GetMachinePlacementLocation(Machine, Origin, RotationSteps)))
    {
        RemoveMachine(Machine);                  // ★ 등록을 되돌린다 (unwind)
        OutReason = TEXT("Failed to move machine to target location");
        return false;
    }
    // (배치 후 FactoryManager 알림 — 생략)
    return true;
}
```

등록(`RegisterMachineInternal`)을 먼저 하고, 뒷단(`SetActorLocation`)이 깨지면 `RemoveMachine`으로 등록을 통째로 되돌립니다. **register-first + 실패 시 unwind.** 이걸 안 하면 머신은 원래 자리에 있는데 그리드는 새 셀이 점유됐다고 믿는 — *ghost occupancy* — 상태가 남아요. 컴파일도 되고 크래시도 없지만, 그 셀엔 영영 아무것도 못 놓습니다.

### 3-2. 죽은 머신의 메타데이터가 새지 않게 — 양방향 일관성

2편에서 `OccupiedCells`(셀→머신)와 역방향 맵을 같이 들고 다닌다고 했죠. 그런데 그 사이에 origin을 명시 저장하는 세 번째 맵(`OJJ_ActorToOrigin`)이 추가됐습니다. Codex의 지적은 "맵을 늘렸으면 *정리 경로도 같이 늘려야 한다*"였어요. 안 그러면 머신이 죽었을 때 한 맵에만 좀비 엔트리가 남습니다.

```cpp
void AOJJ_Grid::SweepStaleEntries()
{
    for (auto It = OJJ_ActorToCells.CreateIterator(); It; ++It)
    {
        if (!It.Key().IsValid())
        {
            for (const FIntPoint& Cell : It.Value())
            {
                const TWeakObjectPtr<AActor>* Found = OccupiedCells.Find(Cell);
                if (Found && !Found->IsValid())
                {
                    OccupiedCells.Remove(Cell);
                }
            }
            // origin 맵도 동일 키로 정리 (양방향 일관성 — 신설 맵 누수 방지)
            OJJ_ActorToOrigin.Remove(It.Key());
            It.RemoveCurrent();
        }
    }
}
```

조회 쪽에도 같은 일관성을 박았습니다. 죽은(곧 GC될) 머신의 footprint/origin이 새 나가지 않게, 읽기 함수 진입에서 `IsValid`로 거릅니다.

```cpp
const TArray<FIntPoint>* AOJJ_Grid::GetMachineCells(AMachineBase* Machine) const
{
    // 죽은 머신의 footprint/origin 메타데이터가 새지 않도록 차단 (Codex 지적: 양방향 일관성).
    if (!IsValid(Machine))
    {
        return nullptr;
    }
    return OJJ_ActorToCells.Find(Machine);
}
```

`GetMachineOrigin`도 같은 가드를 둡니다. 핵심은 **"맵을 하나 늘리면, 추가·삭제·조회 세 경로 모두에서 그 맵을 똑같이 다뤄야 한다"** 는 거예요. 한 곳이라도 빠지면 그게 누수입니다.

### 3-3. 불변식이 깨졌을 때 — 조용히 넘기지 말고 시끄럽게

컨베이어 등 비머신 액터를 셀에 등록/제거하는 경로(Phase 3에서 추가)에 Codex가 번호를 붙여(#1~#5) 찌른 지점들이 있습니다. 그중 가장 인상 깊었던 건 "양방향 맵이 어긋난 상태를 *만났을 때* 어떻게 할 것인가"였어요.

```cpp
const TArray<FIntPoint>* ActorCells = OJJ_ActorToCells.Find(Actor);
if (!ActorCells)
{
    // 불변식 위반: OccupiedCells엔 있는데 역맵엔 없음.
    // 어중간한 부분 제거 대신 — 그 actor가 점유한 모든 OccupiedCells를 스캔 제거 + origin 제거(완전 정리).
    // 불변식 깨짐을 로그로 가시화(Codex #1/#5).
    UE_LOG(LogTemp, Warning,
        TEXT("[OJJ_Grid] OccupiedCells/OJJ_ActorToCells 불일치 — actor '%s'를 전체 스캔으로 정리."),
        *Actor->GetName());
    for (auto It = OccupiedCells.CreateIterator(); It; ++It)
    {
        if (It.Value().Get() == Actor) { It.RemoveCurrent(); }
    }
    OJJ_ActorToOrigin.Remove(Actor);
    return false;
}
```

"있을 수 없는 상태"를 만났을 때 *조용히 한 칸만 지우고 넘어가면* 다음 버그의 씨앗이 됩니다. 그래서 (a) 경고 로그로 깨짐을 가시화하고, (b) 어중간하게 부분 정리하지 말고 그 액터의 흔적을 전부 스캔 제거합니다. 같은 번호 그룹(#2)에서는 등록 셀 목록을 **dedup**해서 중복 셀이 충돌 검사와 등록에 따로 노는 걸 막고, (#3) 머신을 이 컨베이어 전용 경로에 넣으면 머신 불변식을 우회하므로 **거부**하도록 했어요.

---

## 4. 시각이 거짓말하는 것

### 4-1. 호버 색이 거짓말하던 버그 — 단일 진실원

이게 개인적으로 가장 뜨끔했던 지적입니다. 그리고 3편에서 제가 설명했던 버전이 바로 *고치기 전*의 그 코드예요.

처음 `UpdateHoverPreview`는 **셀마다 따로** "점유됐나 / 그리드 밖인가"를 판정해서 색을 칠했습니다. 그러면 2×2 머신을 그리드 모서리에 가져갔을 때, 어떤 칸은 녹색이고 어떤 칸은 빨강인 — *섞인* 미리보기가 나와요. 사용자는 "녹색 칸도 있으니 놓이겠지" 하고 클릭하는데, 실제 `CanPlaceMachine`은 풋프린트에 한 칸이라도 문제가 있으면 통째로 거부합니다. **시각 피드백이 클릭 결과와 다른 거짓말**을 한 거죠.

Codex의 지적은 "호버 색을 정하는 판정과 클릭 시 배치 판정이 **다른 코드**면, 둘은 반드시 언젠가 어긋난다"였습니다. 그래서 둘을 같은 함수 하나로 묶었어요.

```cpp
void AOJJ_Grid::UpdateHoverPreview(AMachineBase* Machine, FIntPoint Origin, int32 RotationSteps)
{
    ClearHoverPreview();
    if (!Machine) { return; }

    // 단일 진실원: 호버 색 판정과 클릭 시 placement 판정을 같은 함수(CanPlaceMachine)로 결정.
    // 풋프린트 중 한 칸이라도 점유 / out-of-bounds이면 전체 빨강. → "겹친 칸만 빨강,
    // 나머지 녹색" 같은 거짓말 제거. (이전 셀별 판정으로 인한 회귀.)
    const bool bCanPlace = CanPlaceMachine(Machine, Origin, RotationSteps);
    UInstancedStaticMeshComponent* TargetISM = bCanPlace ? ValidHoverISM.Get() : InvalidHoverISM.Get();
    if (!TargetISM) { return; }

    const TArray<FIntPoint> FootprintCells = CalculateFootprint(Machine, Origin, RotationSteps);
    for (const FIntPoint& Cell : FootprintCells)
    {
        const FVector CellCenter = GridToWorld(Cell);
        const FVector InstanceLocation(CellCenter.X, CellCenter.Y, CellCenter.Z + 2.0f);
        const FVector InstanceScale(CellSize / 100.0f, CellSize / 100.0f, 1.0f);
        const FTransform InstanceTransform(FRotator::ZeroRotator, InstanceLocation, InstanceScale);
        TargetISM->AddInstance(InstanceTransform, /*bWorldSpace=*/true);
    }
}
```

지금은 `CanPlaceMachine` **한 번**으로 풋프린트 전체의 색을 정합니다. 클릭 때도 같은 `CanPlaceMachine`을 통과해야 놓이니, *보이는 색 = 실제 결과*가 구조적으로 보장돼요. "한 칸이라도 안 되면 전부 빨강"이 거짓말 안 하는 피드백입니다.

> 💡 3편을 보신 분은 거기서 제가 *셀별 빨강 강제* 로직을 설명한 걸 기억하실 거예요. 그게 바로 이 회귀(regression) 버전이었습니다. 글을 쓸 당시 코드 기준이었는데, 이 리뷰 이후 단일 진실원으로 바뀌었어요. (3편 본문도 추후 현재 코드 기준으로 보정할 예정입니다.)

### 4-2. 머신 위에 올리면 호버가 사라지던 버그

4편 호버 코드(`UpdateMouseHover`)에 floor/machine hit 화이트리스트가 있었죠. 그게 왜 생겼냐면 — 이미 놓인 머신 위에 마우스를 올리면 **호버가 통째로 사라지는** 버그가 있었기 때문입니다.

원인은 3편의 collision 설계와 맞물려요. 머신 Cube 메시가 `Visibility` 채널을 Block 하니까, 커서 라인 트레이스가 *바닥 평면에 닿기 전에 머신을 먼저 맞힙니다*. 그러면 "floor를 못 맞혔네 → `ClearHoverPreview`" 로 빠져서 미리보기가 사라졌어요. 정작 그 머신 위 XY는 점유된 셀에 정확히 매핑되는데도요.

커밋 메시지(`89da165`)에 증상과 처방이 그대로 적혀 있습니다.

> 배치된 머신의 Cube collision이 Visibility 채널을 Block해서 마우스 cursor trace가 floor에 못 닿고 머신을 hit → ClearHoverPreview 되던 문제. UpdateMouseHover의 trace 가드를 floor 단독 → floor + 머신 화이트리스트로 확장.

그래서 4편에서 본 그 가드 — `bHitFloor || bHitMachine`이면 통과 — 가 들어갔고, 이제 점유 머신 위에 올리면 *풋프린트 전체 빨강*으로 "여긴 이미 찼다"를 정직하게 보여줍니다.

---

## 5. 좌표·기하의 함정

### 5-1. 피벗이 어디든 바닥에 안착시키기 (Codex [Medium])

머신을 배치할 때 액터 Z를 어떻게 정할 것인가. 처음엔 단순히 셀 중심 Z(그리드 평면)에 놓았는데, Codex가 [Medium]으로 찌른 게 "**메시 피벗이 바닥이 아니면** 어떻게 되냐"였습니다. 피벗이 메시 중앙이면 머신 절반이 바닥에 박히고, 상단이면 공중에 뜹니다.

처방은 메시 AABB의 최저점을 그리드 평면에 안착시키는 보정이었어요. 그런데 단순히 로컬 AABB만 보면 또 함정이 있습니다 — 메시 컴포넌트의 *상대 위치·회전·스케일(음수 포함)* 을 무시하면 보정이 틀어져요.

```cpp
// Z: 피벗 무관 "바닥 안착". 메시 AABB의 최저점이 그리드 평면에 닿도록 액터 Z를 보정.
// 메시 로컬 AABB를 "MeshComponent→Actor" 상대 트랜스폼으로 변환해 액터 기준 최저점을
// 구하므로, 컴포넌트의 상대 위치·회전·스케일(음수 포함)을 모두 반영(TransformBy가 변환 후 AABB 재산출).
float ZOffset = 0.0f;
if (const UStaticMeshComponent* Mesh = Machine->GetMeshComponent())
{
    if (const UStaticMesh* MeshAsset = Mesh->GetStaticMesh())
    {
        const FTransform CompToActor =
            Mesh->GetComponentTransform().GetRelativeTransform(Machine->GetActorTransform());
        const FBox ActorSpaceBox = MeshAsset->GetBoundingBox().TransformBy(CompToActor);
        ZOffset = -ActorSpaceBox.Min.Z;
    }
}
```

핵심은 `GetRelativeTransform`으로 "메시 컴포넌트 → 액터" 변환을 구하고, 로컬 바운딩박스를 그걸로 `TransformBy` 한다는 것. 변환된 AABB의 `Min.Z`를 뒤집은 게 `ZOffset`이에요. 바닥 피벗 메시(`Min.Z≈0`)는 보정 0이라 기존 머신엔 회귀가 없고, 중앙/상단 피벗만 정확히 끌어올리거나 내립니다. 음수 스케일·틸트까지 `TransformBy`가 알아서 흡수해요.

### 5-2. 비유한 입력 방어 — public 함수의 숙명

컨베이어 방향을 정하는 `CardinalFromVector`(벡터를 상하좌우 한 축으로 스냅)에 Codex가 단 지적은 "이건 `BlueprintPure` public이라 *누가 어떤 값을 넣을지 모른다*"였습니다. NaN이나 거의 0인 벡터가 들어오면?

```cpp
FIntPoint AOJJ_Grid::CardinalFromVector(FVector V)
{
    // 비유한/거의 0인 XY 입력 방어 → 방향 없음(ZeroValue). public/BlueprintPure라 직접 오용 대비 (Codex 지적).
    const double Mag2 = static_cast<double>(V.X) * V.X + static_cast<double>(V.Y) * V.Y;
    if (!FMath::IsFinite(Mag2) || Mag2 < UE_KINDA_SMALL_NUMBER)
    {
        return FIntPoint::ZeroValue;
    }

    // 우세 축 스냅: |X| >= |Y| 면 X축, 아니면 Y축. 대각선 방지 (Codex 검증 반영).
    if (FMath::Abs(V.X) >= FMath::Abs(V.Y)) { /* ... X축 ... */ }
    // ...
}
```

내부 호출 경로(yaw-only 단위 벡터)에서는 절대 NaN이 안 나오지만, **public이면 내부 가정이 깨질 수 있다**는 게 요점이에요. 호출자를 믿지 말고 진입에서 막는다. 그리고 정확히 45°(`|X|==|Y|`) 같은 tie도 결정적으로 X축을 고르게 해서, 같은 입력이 프레임마다 다른 방향으로 튀는 비결정성을 없앴습니다.

### 5-3. Codex가 *놓친* 것 — 포트 0 머신

정직하게 하나 덧붙이면, adversarial review가 만능은 아니었어요. 컨베이어 끝이 머신 입력 포트에 닿는지 판정하는 로직에, **포트가 없는 머신**(송전탑·발전소·차폐장 등)이 endpoint로 잡히는 기하 맹점이 있었습니다. 이건 Codex 리뷰가 아니라 **플레이테스트**에서 "왜 송전탑에 컨베이어가 연결되지?" 하고 발견했어요. 처방은 `GetInputPortCount() <= 0` / `GetOutputPortCount() <= 0` 머신을 배치 단계에서 endpoint 후보에서 제외하는 거였습니다(`99a45db`).

AI 리뷰어는 *코드 안의 불변식*은 잘 찾지만, "이 도메인에서 송전탑은 컨베이어를 받지 않는다" 같은 *도메인 규칙*은 사람이 봐야 보이더라고요.

---

## 6. 상태가 고착되는 것 (Codex [Low])

마지막은 빌드 모드와 무관해 보이지만 빌드 진입에서 터진 상태 고착 버그입니다.

스프린트(Shift)는 누르면 달리기 속도, 떼면 걷기 속도로 돌아옵니다(`Completed` 트리거). 그런데 **Shift를 누른 채로 빌드 모드에 진입**하면? 빌드 진입이 입력 컨텍스트(IMC)를 갈아끼우면서 `IA_Sprint`의 `Completed`(뗌) 이벤트가 유실돼, 걷기로 복귀하는 신호가 영영 안 옵니다. 빌드 갔다 나와도 **영구 질주** 상태로 고착돼요.

처방은 두 겹이었습니다. 하나는 빌드 진입 지점에서 걷기 속도로 강제 복귀시키는 안전장치(4편에서 본 `ApplyBuildModeView` 안의 그 코드).

```cpp
// 안전장치: 빌드모드 진입 시 IMC_Player가 제거되면, Shift를 누른 채였을 경우
// IA_Sprint의 Completed가 오지 않아 MaxWalkSpeed가 SprintSpeed에 고착된다(영구 질주).
// 진입 시 걷기 속도로 강제 복귀해 잔존을 방지.
if (UCharacterMovementComponent* Movement = GetCharacterMovement())
{
    Movement->MaxWalkSpeed = WalkSpeed;
}
```

다른 하나가 Codex의 [Low] 지적이었어요. Hold/Chord 트리거가 붙으면 뗌이 `Completed`가 아니라 `Canceled`로 올 수 있으니, 그것도 같이 바인딩하라는 것.

```cpp
// 뗌이 Completed 대신 Canceled로 와도 질주가 안 남도록 함께 바인딩.
EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Completed, this, &AOJJ_Player::StopSprint);
EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Canceled,  this, &AOJJ_Player::StopSprint);
```

커밋(`ebbf89e`) 메시지에 Codex 판정이 그대로 적혀 있습니다 — "Codex: high/medium 없음. [Low] Canceled 바인딩 반영." 영구 질주의 본 처방은 제가 빌드 진입 안전장치로 잡았고, Codex는 그 옆의 *입력 트리거 누락 경로*를 [Low]로 보탠 셈이에요. 큰 결함은 아니지만, "이벤트가 한 종류로만 온다고 가정하지 마라"는 좋은 습관 지적이었습니다.

---

## 7. 마치며 — AI를 리뷰어로 쓴다는 것

Phase 1을 닫으며, adversarial review를 돌려보고 남은 소감 셋입니다.

1. **AI는 불변식 깨짐을 잘 찾는다.** "맵을 늘렸는데 정리 경로는 그대로네", "호버 판정과 클릭 판정이 다른 함수네", "public인데 입력 검증이 없네" — 코드 안에서 *대칭이 깨진 자리*를 집요하게 짚습니다. 사람은 자기가 짠 코드라 그 비대칭을 잘 못 봐요.
2. **severity 라벨이 있어야 쓸모 있다.** 모든 지적을 다 반영하면 코드가 방어 코드로 뒤덮입니다. High/Medium만 코드에 넣고 Low는 판단해서 취하는 — 그 *분류와 거절*이 리뷰의 절반이었어요. 이번 라운드도 결국 [Medium] 하나(Z 안착), [Low] 몇 개가 실제 반영분이었습니다.
3. **도메인 규칙은 여전히 사람 몫이다.** 포트 0 머신처럼 "이 세계에서 이건 말이 안 된다"는 건 코드만 봐선 안 보입니다. AI 리뷰는 플레이테스트를 대체하는 게 아니라, *플레이테스트 전에 silent bug를 한 겹 걷어내는* 도구더라고요.

그래서 이 시리즈가 단순 UE5 튜토리얼이 아니라고 1편에서 말했던 거예요. 코드를 짜는 것만큼, **AI 도구를 어떻게 협업자로 세울 것인가**가 1인 개발자에게는 같은 무게의 기술입니다.

여기서 **Phase 1 — 그리드 시스템**이 끝납니다. 다음은 **Phase 2 — 머신 시스템**. 격자 위에 놓인 설비가 자원을 입력받아 가공해 내보내기 시작하면, 그때부터 진짜 "공장"이 돌기 시작해요. 거기서 또 만나요.

— JJ
