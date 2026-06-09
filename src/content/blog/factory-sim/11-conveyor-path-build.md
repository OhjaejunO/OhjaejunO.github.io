---
title: "공장 시뮬레이션 게임 개발기 Phase 2.6 — 손이 그린 자취가 컨베이어가 되기까지: 경로 빌드와 양끝 검증"
description: "9·10편이 '이미 깔려 있다'고 깔고 갔던 그 경로를, 이번엔 직접 깐다. 마우스로 끈 자유로운 자취를 격자 직교 수열로 펴는 일, '출력 포트에서 나와 입력 포트로 들어간다'를 빌드 타임에 못박는 양끝 검증, 사이 칸을 한 칸씩 따져 예약셀을 모으는 all-or-nothing 게이트, 그리고 점유를 등록하고 8편의 운반 모델에 넘겨 컨베이어를 '살리는' 마지막 한 줄까지 — 컨베이어 5부작의 완결."
date: 2026-06-09
category: UE5
series: factory-sim
seriesPart: 11
tags: [UE5, C++, 컨베이어, 그리드, 경로빌드, 검증]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 2: 머신 시스템**
> - 6편: [AI 생성 3D 에셋 파이프라인](/blog/factory-sim/06-meshy-glb-asset-pipeline)
> - 7편: [포트 셀 일원화 — 화살표·도킹·그래프를 하나의 진실로](/blog/factory-sim/07-port-cell-unification)
> - 8편: [컨베이어가 아이템을 나르는 법 — 이산 슬롯과 풀(pull) 모델](/blog/factory-sim/08-conveyor-item-transport)
> - 9편: [한 칸씩 점프하는 진실과 부드럽게 흐르는 그림 — 시뮬과 렌더 분리](/blog/factory-sim/09-conveyor-visual-interpolation)
> - 10편: [머신을 지우면 줄도 따라 끊긴다 — 철거 모드와 연쇄 삭제](/blog/factory-sim/10-demolish-cascade-delete)
> - **11편: 손이 그린 자취가 컨베이어가 되기까지 — 경로 빌드와 양끝 검증** ← 현재 글
>
> *Phase 1 — 그리드 시스템: [1편](/blog/factory-sim/01-grid-system-overview) · [2편](/blog/factory-sim/02-grid-data-structure-and-transaction) · [3편](/blog/factory-sim/03-material-grid-visualization) · [4편](/blog/factory-sim/04-mouse-input-build-controller) · [5편](/blog/factory-sim/05-codex-adversarial-review)*

## 1. 들어가며 — 미뤄둔 한 가지

지난 네 편 내내 컨베이어를 다뤘는데, 정작 **컨베이어가 어떻게 깔리는지**는 한 번도 안 봤습니다. [8편](/blog/factory-sim/08-conveyor-item-transport)은 "이미 깔린" 벨트 위로 아이템을 흘렸고, [9편](/blog/factory-sim/09-conveyor-visual-interpolation)은 그걸 부드럽게 그렸고, [10편](/blog/factory-sim/10-demolish-cascade-delete)은 깔린 걸 걷어냈죠. 전부 "경로는 주어졌다"를 전제로 깔고 갔어요.

이번 편이 그 미뤄둔 한 가지입니다. **플레이어가 마우스로 끈 자유로운 자취 하나를, 어떻게 합법적인 컨베이어로 바꾸느냐.**

이게 왜 한 편을 통째로 쓸 만한 일이냐면, 그 사이에 **번역**과 **검증**이 끼기 때문이에요. 마우스가 그리는 자취는 제멋대로입니다 — 대각선으로 가로지르고, 갔던 길을 되짚고, 격자에 안 맞아요. 반면 컨베이어가 되려면 조건이 빡빡합니다. 격자에 정확히 정렬돼야 하고, 한 칸씩 끊김 없이 이어져야 하고, 무엇보다 **한쪽 머신의 출력 포트에서 나와 다른 머신의 입력 포트로 들어가야** 합니다([8편](/blog/factory-sim/08-conveyor-item-transport)의 풀 모델이 깔고 있던 그 양끝 머신 전제 — 그게 빌드 타임에 강제되는 게 바로 여기예요).

그래서 빌드 과정은 네 단계의 파이프라인이 됩니다.

1. **자취 수집** — 드래그를 격자 셀 수열로 (2절)
2. **양끝 검증** — 출력 포트에서 나와 입력 포트로 끝나나 (3절)
3. **사이 검사** — 경로 본문이 깔 수 있는 땅인가, 예약할 칸은 어디인가 (4절)
4. **커밋** — 점유를 등록하고 8편의 운반 모델에 넘긴다 (5절)

이 파이프라인의 척추는 **검증**이에요. 단계마다 "안 되면 즉시 거절"이고, 끝까지 통과한 자취만 컨베이어가 됩니다. 그리고 이 편은 7편부터 이어온 컨베이어 5부작의 **완결**이기도 합니다.

---

## 2. 손이 그린 자취 — 드래그를 격자 수열로

좌클릭을 누르면 드래그가 시작되고(`BeginConveyorDrag`), 마우스를 끄는 동안 매 프레임 커서 아래 셀이 자취에 쌓이고(`UpdateConveyorDrag`), 좌클릭을 떼면 커밋됩니다(`CommitConveyorDrag`). 자취는 `ConveyorDragCells` — 그냥 `TArray<FIntPoint>`예요.

문제는 마우스가 **띄엄띄엄** 움직인다는 겁니다. 한 프레임에 커서가 세 칸을 건너뛸 수도, 대각선으로 갈 수도 있어요. 그대로 쌓으면 자취에 구멍이 뚫리거나 대각선 점프가 섞입니다. 그래서 새 커서 셀이 들어올 때마다, *직전 셀에서 거기까지를 한 칸씩 직교로 메웁니다.*

```cpp
void AOJJ_BuildController::AppendConveyorPathTo(FIntPoint TargetCell)
{
    // ... (빈 자취면 그냥 추가 / 직전 셀과 같으면 무시 — 생략)

    FIntPoint LastCell = ConveyorDragCells.Last();

    // 먼저 X축으로 한 칸씩
    const int32 StepX = TargetCell.X > LastCell.X ? 1 : -1;
    while (LastCell.X != TargetCell.X)
    {
        LastCell.X += StepX;
        AddConveyorPathCell(LastCell);
    }

    // 그다음 Y축으로 한 칸씩
    const int32 StepY = TargetCell.Y > LastCell.Y ? 1 : -1;
    while (LastCell.Y != TargetCell.Y)
    {
        LastCell.Y += StepY;
        AddConveyorPathCell(LastCell);
    }
}
```

핵심은 **X 먼저, Y 나중**이에요. 직전 셀에서 목표 셀까지, X 차이를 먼저 한 칸씩 걸어 메우고, 그다음 Y 차이를 메웁니다. 그래서 대각선으로 끌어도 자취는 항상 **ㄱ자(직각)** 로 펴져요. 커서가 (0,0)에서 (3,2)로 점프하면 자취는 `(1,0)(2,0)(3,0)(3,1)(3,2)` — 가로로 쭉 간 뒤 세로로 꺾인 직교 경로가 됩니다.

```
목표 ●          드래그: (0,0) → (3,2) 한 번에 점프
    ·   ·   ·   ·          ↓ 자취는 ㄱ자로 메워짐
  시작 ●───●───●───┐       (X축 먼저 → Y축 나중)
                   │
```

여기서 대각선 입력이 자연히 사라지고, 모든 인접 셀이 상하좌우로만 이어지니 *연속성*도 공짜로 따라옵니다. 4절의 "맨해튼 거리 1" 검사가 이 덕에 거의 항상 통과해요.

남은 문제 하나 — **되짚기**. 플레이어가 끌다가 마음을 바꿔 왔던 길을 되돌아오면? 자취에 같은 칸이 두 번 들어가고 줄이 자기 위로 겹칩니다. 그걸 셀 추가 시점에 잘라내요.

```cpp
void AOJJ_BuildController::AddConveyorPathCell(FIntPoint Cell)
{
    int32 ExistingIndex = INDEX_NONE;
    if (ConveyorDragCells.Find(Cell, ExistingIndex))
    {
        ConveyorDragCells.SetNum(ExistingIndex + 1);   // 그 칸 뒤로는 전부 잘라냄
        return;
    }
    ConveyorDragCells.Add(Cell);
}
```

이미 자취에 있는 칸으로 되돌아오면, `SetNum`으로 그 칸 *이후*를 통째로 버립니다. 자취가 그 지점까지 되감기는 거죠. 끌었다 되돌렸다 해도 자취는 늘 자기와 안 겹치는 깔끔한 한 줄로 유지됩니다. 이렇게 2절이 끝나면 `ConveyorDragCells`는 **직교·연속·비중복** 셀 수열 — 검증에 넘길 준비가 된 원재료입니다.

---

## 3. 양끝이 전부다 — 출력에서 나와 입력으로

자취가 모였으니 이제 진짜 질문. **이 자취가 컨베이어가 될 자격이 있나?** 가장 중요한 조건은 양끝입니다. [8편](/blog/factory-sim/08-conveyor-item-transport)에서 컨베이어는 `SourceMachine`의 출력에서 아이템을 당겨와 `TargetMachine`의 입력으로 보냈죠. 그러니 빌드 타임에 **시작은 출력 포트, 끝은 입력 포트**임을 못박아야 합니다.

먼저 시작점. `OJJ_BuildConveyorPlacementPath`가 자취의 첫 칸을 머신 출력 포트에 **앵커**합니다. 플레이어가 드래그를 시작한 위치가 두 가지일 수 있어서 갈라요.

```cpp
// 경우 A — 자취 첫 칸이 머신 위
if (AMachineBase* StartMachine = OJJ_GetMachineAtCell(OccupiedCells, StartCell))
{
    const FIntPoint OutsideCell = StartCell + OJJ_GetMachineBackStep(StartMachine);
    if (!MachineCells || !OJJ_IsMachineBackOutputPair(this, StartMachine, StartCell, OutsideCell, *MachineCells))
    {
        OutReason = TEXT("Conveyor on a machine must be placed on the back outer output cell.");
        return false;   // 출력 포트 셀이 아니면 거절
    }
    // 첫 칸이 머신이면, 출력이 향하는 바깥 칸을 두 번째 칸으로 강제
    // ... (자취가 1칸뿐이면 OutsideCell을 덧붙이고, 아니면 자취 둘째 칸이 OutsideCell인지 검사 — 생략)
}
// 경우 B — 자취 첫 칸이 머신 옆 빈 칸
else
{
    for (const FIntPoint& Step : OJJ_NeighborSteps)
    {
        AMachineBase* AdjacentMachine = OJJ_GetMachineAtCell(OccupiedCells, StartCell - Step);
        if (AdjacentMachine && OJJ_IsMachineBackOutputPair(this, AdjacentMachine, StartCell - Step, StartCell, *MachineCells))
        {
            OutPathCells.Insert(MachineCell, 0);   // 머신 칸을 자취 맨 앞에 끼워넣음
            break;
        }
    }
    // ... (못 찾으면 "머신 출력 포트 위나 옆에서 시작해야 함" 거절 — 생략)
}
```

두 경우 모두 결과는 같아요 — **정규화된 경로의 0번 칸은 항상 머신 셀, 1번 칸은 그 머신의 출력이 향하는 바깥 칸.** 머신 위에서 끌기 시작했으면 그대로 쓰고, 머신 옆 빈 칸에서 시작했으면 머신 칸을 앞에 끼워 넣어요. 어느 쪽이든 "출력 포트에서 나온다"는 모양으로 맞춰집니다.

여기서 `OJJ_IsMachineBackOutputPair`가 [7편](/blog/factory-sim/07-port-cell-unification)을 그대로 빌려 씁니다. 7편에서 포트 셀을 footprint로부터 대칭 규칙(`OJJ_PortCellsFromFootprint`)으로 뽑아 화살표·도킹·그래프가 한 진실을 공유하게 했죠. 그 *같은* 포트 셀 판정이 여기서 "이 칸이 정말 출력 포트냐"를 가립니다 — 화면에 화살표가 떠 있던 바로 그 칸에서만 컨베이어가 나올 수 있어요. 빌드 검증이 7편의 포트 진실을 재사용하는 거죠.

끝점도 대칭입니다. `OJJ_FindInputMachineAtPathEnd`가 자취의 마지막 칸을 보고, 그게 **다른 머신의 입력 포트**이거나 입력 포트 *바로 앞 칸*인지 확인해요.

```cpp
// 끝 칸이 머신 위라면 — 그 머신의 입력 포트여야
if (!EndMachine || EndMachine == StartMachine
    || EndMachine->GetInputPortCount() <= 0
    || !OJJ_IsMachineFrontInputPair(Grid, EndMachine, EndCell, PreviousCell, *EndMachineCells))
{
    OutReason = TEXT("Conveyor must end at another machine input port.");
    return false;
}
```

`EndMachine == StartMachine`을 막는 줄을 눈여겨보세요 — 한 머신에서 나와 *자기 자신*으로 돌아오는 컨베이어는 의미가 없으니 거절합니다. 출력 포트수가 0인 머신(송전탑·발전소 같은)은 애초에 시작점이 못 되고, 입력 포트수가 0이면 끝점이 못 돼요. **포트가 양끝 자격을 정의**하는 겁니다.

> 정리하면, 3절은 자취의 *양 끝*만 봅니다. 시작이 출력 포트에서 나오고 끝이 입력 포트로 들어가는가 — 이 둘이 안 맞으면 사이가 아무리 멀쩡해도 컨베이어는 안 됩니다. 8편이 *런타임에* 전제했던 "출력→입력"을, 11편이 *빌드 타임에* 못박는 셈이에요.

---

## 4. 사이를 검사한다 — 경로 본문과 예약셀

양끝이 합격이면, 이제 그 *사이*를 한 칸씩 훑습니다. `OJJ_CollectConveyorReservedCells`의 본문 루프예요. 두 가지를 동시에 해요 — **칸마다 깔 수 있는지 검사**하고, **컨베이어가 점유할 빈 칸을 모읍니다.**

```cpp
for (int32 Index = 0; Index < PathCells.Num(); ++Index)
{
    const FIntPoint Cell = PathCells[Index];

    if (!Grid->IsValidGridCell(Cell)) { /* 격자 밖 → 거절 */ }

    // 지형 게이트 — 컨베이어는 머신 배치 검사를 안 거치므로 여기서 직접 막는다
    if (!Grid->IsCellBuildable(Cell)) { /* 못 까는 지형 → 거절 */ }

    // 연속성 — 직전 칸과 맨해튼 거리 1 (상하좌우로만 이어져야)
    if (Index > 0 && OJJ_ManhattanDistance(PathCells[Index - 1], Cell) != 1) { /* 끊김 → 거절 */ }

    // 점유 충돌 — 이미 뭔가 있는 칸이면?
    const TWeakObjectPtr<AActor>* Occupant = OccupiedCells.Find(Cell);
    if (Occupant && Occupant->IsValid())
    {
        const bool bAllowedOutputCell = Index == 0 && Occupant->Get() == StartMachine;
        const bool bAllowedInputCell  = bEndsOnMachine && Index == PathCells.Num() - 1 && Occupant->Get() == EndMachine;
        if (!bAllowedOutputCell && !bAllowedInputCell) { /* 가로막힘 → 거절 */ }
        continue;   // 양끝 머신 칸은 점유돼 있는 게 정상 → 예약하지 않고 넘어감
    }

    OutReservedCells.AddUnique(Cell);   // 빈 칸 → 컨베이어가 차지할 예약셀
}
```

네 가지 검사를 칸마다 통과해야 합니다.

- **격자 안인가** (`IsValidGridCell`) — 자취가 격자 밖으로 새지 않았나.
- **깔 수 있는 땅인가** (`IsCellBuildable`) — 지형 높낮이로 건설 불가인 칸을 막아요. 머신은 배치할 때 별도 게이트를 거치지만 컨베이어는 그 경로를 안 타므로, 지형 검사를 *여기서 직접* 합니다.
- **연속인가** (맨해튼 거리 1) — 직전 칸과 상하좌우로 딱 붙어 있나. 2절의 ㄱ자 정규화 덕에 보통은 통과하지만, 마지막 안전망으로 한 번 더 봅니다.
- **가로막히지 않았나** — 이미 다른 게 점유한 칸이면 거절. **단 예외 둘** — 0번(시작 머신 셀)과 마지막(끝 머신 셀)은 머신이 차지한 게 *당연*하므로 허용하되, 예약셀에는 안 넣고 `continue`로 넘어갑니다.

그래서 통과한 **빈 칸들만** `ReservedCells`에 모입니다. 이게 곧 *컨베이어 본체가 점유할 칸들* — 양끝 머신 칸을 뺀, 순수 벨트의 몸이에요. 머신 칸은 머신 거니까 컨베이어가 점유하면 안 되거든요.

중요한 건 이 검사가 **전부 아니면 전무(all-or-nothing)** 라는 점입니다. 한 칸이라도 걸리면 함수 전체가 `false`로 빠지고, 그때까지 모은 예약셀은 그냥 버려져요. 절반만 깔린 컨베이어 같은 어중간한 상태가 원천적으로 안 생깁니다. 자취 전체가 합법이거나, 아무 일도 없거나 — 둘 중 하나죠. 이 검증은 좌클릭을 떼는 순간(커밋)만이 아니라 **드래그 중 매 프레임 미리보기**(`OJJ_UpdateConveyorPathHoverPreview`)에서도 같은 함수로 돌아서, 깔 수 있는 경로는 초록, 막힌 경로는 손을 떼기 전에 이미 빨갛게 보여요.

---

## 5. 놓고, 넘긴다 — 등록과 인계

자취가 모든 검사를 통과했습니다. 이제 진짜로 놓을 차례 — `OJJ_TryPlaceConveyor`. 마지막 관문을 한 번 더 확인하고, 그리드에 점유를 등록하고, 컨베이어 액터에 모든 걸 넘깁니다.

```cpp
bool AOJJ_Grid::OJJ_TryPlaceConveyor(AConveyor* Conveyor, const TArray<FIntPoint>& PathCells, FString& OutReason)
{
    // ... (경로 정규화 + 예약셀/Source/Target 재수집 — 3·4절 함수 재호출)

    if (ReservedCells.Num() == 0) { /* 점유할 칸이 없으면 거절 */ }
    if (!SourceMachine || !TargetMachine) { /* 양끝 머신이 없으면 거절 */ }

    // 1) 그리드 점유 등록 — 10편 해제의 역연산
    if (!OJJ_RegisterActorCells(Conveyor, ReservedCells))
    {
        OutReason = TEXT("Failed to register conveyor cells on the grid.");
        return false;
    }

    // 2) 컨베이어 액터에 경로/위치를 세팅
    Conveyor->SetPath(PlacementCells, CellSize);
    Conveyor->SetActorLocation(/* 벨트 무게중심을 피벗으로 정렬 — 좌표 보정, 생략 */);

    // 3) 운반 모델에 인계 — 8편으로 넘어가는 지점
    Conveyor->ConfigureTransport(ReservedCells, SourceMachine, TargetMachine);
    return true;
}
```

세 단계예요.

**① 점유 등록.** `OJJ_RegisterActorCells`가 예약셀들을 그리드 장부에 박습니다. 이건 정확히 [10편](/blog/factory-sim/10-demolish-cascade-delete)의 **역연산**이에요. 10편에서 `OJJ_RemoveActorAt`이 `OccupiedCells`(셀→액터)와 `OJJ_ActorToCells`(액터→모든 셀) 두 맵에서 점유를 *풀었다면*, 여기선 같은 두 맵에 점유를 *심습니다.* 이 등록 덕에 다음부터 누가 이 칸들을 조회하면 "이 컨베이어가 차지함"이 나오고, 나중에 10편의 철거가 셀 하나로 라인 전체를 되짚을 수 있게 되죠. 짓기와 무르기가 같은 두 맵을 양방향으로 쓰는 한 쌍입니다.

**② 경로·위치 세팅.** `SetPath`로 정규화된 전체 경로(`PlacementCells`)를 컨베이어에 넘기고, 액터 위치를 맞춰요. (위치 보정은 벨트 무게중심을 피벗으로 옮겨 다른 시스템과 좌표를 정렬하는 세부라, 본문에선 접습니다.)

**③ 운반 모델에 인계.** 그리고 마지막 한 줄, `ConfigureTransport`. 이게 [8편](/blog/factory-sim/08-conveyor-item-transport)으로 넘어가는 **문**입니다.

```cpp
void AConveyor::ConfigureTransport(const TArray<FIntPoint>& NewOccupiedGridCells,
    AMachineBase* NewSourceMachine, AMachineBase* NewTargetMachine)
{
    OccupiedGridCells = NewOccupiedGridCells;   // (AddUnique 루프 — 생략)
    SourceMachine = NewSourceMachine;
    TargetMachine = NewTargetMachine;

    ResetItemSlots();              // 8편의 슬롯 배열 초기화
    RestartItemMoveTimer();        // 8편의 SecondsPerGrid 틱 타이머 가동
    RefreshItemVisualInstances();  // 9편의 비주얼 첫 배치
    UpdateDebugStateText();

    // 팩토리 그래프에 "나 바뀌었다" 통지
    FactoryManager->NotifyConveyorChanged(this);   // (구독 가드 — 생략)
}
```

이 한 번의 호출로 컨베이어가 **살아납니다.** 점유 칸을 받아 자기 몸으로 삼고, 양끝 머신을 소스·타깃으로 기억하고, [8편](/blog/factory-sim/08-conveyor-item-transport)의 슬롯 배열을 초기화하고 틱 타이머를 켜요. 그 순간부터 8편의 풀 모델이 돌기 시작합니다 — 소스에서 당겨오고, 한 칸씩 시프트하고, 타깃으로 배출하는. [9편](/blog/factory-sim/09-conveyor-visual-interpolation)의 비주얼도 첫 배치를 받고요. 11편의 빌드 파이프라인이 끝나는 지점이 정확히 8·9편이 시작하는 지점입니다. 한 줄이 두 편을 잇는 거죠.

> **곁가지 — 형상은 다른 계열의 얘기다.** 컨베이어는 직선 구간과 ㄱ자 코너 구간을 서로 다른 메시로 깔고, 진행 방향에 따라 Yaw로 돌리고 코너는 Roll로 눕혀 격자에 맞춥니다. 그런데 이 *메시 자세 정렬*은 이번 편의 축과 **별개 계열**이에요. 빌드 파이프라인이 다루는 건 "어느 칸을 점유하고 어느 포트에 무느냐"는 **경로 데이터**고, 메시 자세는 "그 경로를 화면에 어떻게 세우느냐"는 **형상**입니다. 같은 `PathCells`를 두고 한쪽은 점유·검증·운반을, 다른 쪽은 시각 형상을 따로 계산해요 — [9편](/blog/factory-sim/09-conveyor-visual-interpolation)에서 시뮬과 렌더를 가른 그 분리가, 경로와 형상 사이에서도 똑같이 그어집니다. 그래서 형상 쪽은 이 편에서 파고들지 않습니다. 경로가 정해지면 형상은 그 위에 덧씌우는 별도 한 겹이니까요.

---

## 6. 마치며 — 5부작을 닫지 않고

이번 편 요약은 셋입니다.

1. **자유로운 자취를 격자 수열로 편다.** 마우스 드래그를 X 먼저·Y 나중으로 한 칸씩 메워 ㄱ자 직교 경로로 만들고(`AppendConveyorPathTo`), 되짚으면 그 지점까지 잘라낸다(`AddConveyorPathCell`). 대각선과 겹침이 입력 단계에서 사라진다.
2. **양끝이 자격을 정한다.** 시작은 출력 포트에서 나오고 끝은 다른 머신의 입력 포트로 들어가야 한다 — 7편의 포트 셀 판정을 그대로 빌려 검증한다. 8편이 런타임에 전제한 "출력→입력"을 빌드 타임에 못박는 자리다.
3. **검증은 전부 아니면 전무다.** 사이 칸을 하나씩 격자·지형·연속·점유로 따져 통과한 빈 칸만 예약셀로 모으고(`OJJ_CollectConveyorReservedCells`), 한 칸이라도 걸리면 전체를 버린다. 통과하면 점유를 등록(10편 해제의 역연산)하고 `ConfigureTransport`로 8편의 운반 모델에 넘겨 컨베이어를 살린다.

7편부터 여기까지, 컨베이어를 다섯 편에 걸쳐 봤습니다. 포트를 진실로 세우고(7), 그 위로 아이템을 흘리고(8), 흐름을 부드럽게 그리고(9), 걷어내고(10), 마침내 *까는* 법(11)까지. 한 바퀴를 돈 셈이에요 — 깔고, 나르고, 보여주고, 무르고, 다시 깔고.

그렇다고 컨베이어가 완전히 닫힌 건 아닙니다. 5절 끝에서 곁가지로 미뤄둔 **메시 자세 정렬**이 그대로 남아 있고 — 경로 데이터와 형상의 분리는 언젠가 따로 펼칠 만한 얘기죠. 그리고 컨베이어는 어디까지나 공장의 *혈관*일 뿐이에요. 혈관이 이었으니, 이제 그 끝에 달린 것들 — 자원을 캐고, 녹이고, 가공하는 **머신 자체의 계통**, 그걸 돌리는 **전력**, 흘러드는 **자원**으로 얘기가 번질 차례입니다.

다음 편은 그중 하나에서 다시 시작합니다. 컨베이어가 *무엇을* 실어 나르는지 — 그 아이템이 어디서 와서 어떻게 바뀌는지로요.

— JJ
