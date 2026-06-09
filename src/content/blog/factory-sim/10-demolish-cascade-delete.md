---
title: "공장 시뮬레이션 게임 개발기 Phase 2.5 — 머신을 지우면 줄도 따라 끊긴다: 철거 모드와 연쇄 삭제"
description: "지금까지는 전부 '놓는' 얘기였다. 이번엔 무르는 얘기. 무르기는 배치의 역연산이 아니라 별도 서브모드라는 결정, 8편의 두-머신 전제가 강제하는 고아 방지 연쇄 삭제(컨베이어 먼저·머신 나중), 머신 둘레를 훑어 후보를 모으고 Source/Target으로 검증하는 2단 스캔, 그리고 그리드는 점유 장부만 풀고 Destroy는 호출자가 맡는 책임 분리 — '셀 하나로 라인 전체가 정리되는' 메커니즘까지."
date: 2026-06-09
category: UE5
series: factory-sim
seriesPart: 10
tags: [UE5, C++, 철거, 그리드, 컨베이어, 연쇄삭제]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 2: 머신 시스템**
> - 6편: [AI 생성 3D 에셋 파이프라인](/blog/factory-sim/06-meshy-glb-asset-pipeline)
> - 7편: [포트 셀 일원화 — 화살표·도킹·그래프를 하나의 진실로](/blog/factory-sim/07-port-cell-unification)
> - 8편: [컨베이어가 아이템을 나르는 법 — 이산 슬롯과 풀(pull) 모델](/blog/factory-sim/08-conveyor-item-transport)
> - 9편: [한 칸씩 점프하는 진실과 부드럽게 흐르는 그림 — 시뮬과 렌더 분리](/blog/factory-sim/09-conveyor-visual-interpolation)
> - **10편: 머신을 지우면 줄도 따라 끊긴다 — 철거 모드와 연쇄 삭제** ← 현재 글
> - (이어지는 편: 경로 빌드 — 예정)
>
> *Phase 1 — 그리드 시스템: [1편](/blog/factory-sim/01-grid-system-overview) · [2편](/blog/factory-sim/02-grid-data-structure-and-transaction) · [3편](/blog/factory-sim/03-material-grid-visualization) · [4편](/blog/factory-sim/04-mouse-input-build-controller) · [5편](/blog/factory-sim/05-codex-adversarial-review)*

## 1. 들어가며 — 짓는 것의 반대편

7편부터 9편까지, 줄곧 *놓는* 얘기였습니다. 포트 셀을 그래프의 진실로 세우고([7편](/blog/factory-sim/07-port-cell-unification)), 그 위로 아이템을 흘려보내고([8편](/blog/factory-sim/08-conveyor-item-transport)), 그 흐름을 부드럽게 그렸죠([9편](/blog/factory-sim/09-conveyor-visual-interpolation)). 전부 "어떻게 세우느냐"였어요.

그런데 공장은 짓기만 하는 게 아니죠. 잘못 놓으면 무르고, 자리를 바꾸려면 걷어내야 합니다. 이번 편은 그 **무르기** — 철거(Demolish) 모드입니다.

처음엔 단순하게 생각했어요. "배치의 반대니까, 놓는 코드를 거꾸로 돌리면 되겠지." 그런데 막상 손대니 두 군데서 막혔습니다.

- **무르기는 배치의 역연산이 아니더라.** 놓을 땐 "여기 놓을 수 있나"(빈 셀인가, 포트가 맞물리나)를 따지지만, 무를 땐 "여기 *뭐가* 있나"를 따집니다. 묻는 질문 자체가 달라서, 배치 경로를 재활용하면 오히려 꼬여요.
- **머신 하나를 지우면 끝이 아니더라.** [8편](/blog/factory-sim/08-conveyor-item-transport)에서 컨베이어는 *두 머신*을 양끝으로 두고서야 존재했습니다(Source → Target). 그럼 그 한쪽 머신을 지우면? 남은 컨베이어는 한쪽 끝이 허공인 채로 떠버립니다. **고아(orphan)** 가 되는 거죠.

그래서 이 편의 두 축은 이렇게 잡았습니다. **(1)** 철거는 배치와 분리된 별도 모드로 두고, **(2)** 머신을 지울 땐 거기 매달린 컨베이어를 *먼저* 찾아 같이 지운다 — 연쇄 삭제. 3·4절이 이 두 번째 축을, 그 사이에 끼인 2절이 첫 번째 축을 풉니다. 그리고 5절에서, 정작 "지운다"가 코드로는 무슨 일인지 — 그리드 장부에서 점유를 푸는 일과 액터를 실제로 없애는 일이 어떻게 갈리는지를 봅니다.

---

## 2. 철거는 별도 서브모드다

빌드 컨트롤러에는 이미 모드가 한 무더기 있습니다. 머신 종류별로(Miner, Smelter, Pump…), 컨베이어, 전력선… 전부 `EOJJ_BuildPlacementMode` enum의 값이에요. 철거도 그 옆에 **하나 더** 끼워 넣었습니다.

```cpp
enum class EOJJ_BuildPlacementMode : uint8
{
    // ... (Machine, Conveyor, PowerLine, Miner, Smelter, Warehouse 등 배치 모드들)

    // 철거(Demolish) 모드 — X키. 호버 대상 빨강 하이라이트 + 좌클릭 제거(머신/컨베이어). 광맥/WaterArea 제외.
    Demolish
};
```

별도 값으로 둔 이유는, 호버와 클릭 양쪽에서 **배치 경로로 아예 내려가지 않게** 하기 위해서입니다. 매 프레임 도는 호버 갱신(`UpdateMouseHover`)의 첫머리에서 모드를 갈라요.

```cpp
// 호버 갱신 — Demolish면 전용 경로로 빠지고 배치용 로직은 건너뛴다
if (PlacementMode == EOJJ_BuildPlacementMode::Demolish)
{
    UpdateDemolishHover();
    return;   // ← 아래의 커서 트레이스 / 풋프린트 미리보기 / CanPlace 로 내려가지 않음
}

// (여기 아래는 전부 '놓기' 경로 — 커서 아래 셀에 미리보기 띄우고, 놓을 수 있나 검사)
```

좌클릭도 똑같이 갈립니다.

```cpp
// 좌클릭 — Demolish면 제거, 아니면 배치 라우팅
if (PlacementMode == EOJJ_BuildPlacementMode::Demolish)
{
    DemolishUnderCursor();
    return;
}

// (여기 아래는 TryPlaceMachine / 컨베이어 드래그 확정 등 배치 라우팅)
```

이 `return` 한 줄씩이 이 절의 전부입니다. 호버는 `UpdateDemolishHover`로, 클릭은 `DemolishUnderCursor`로 — 철거 모드의 입력은 배치 코드와 **한 줄도 공유하지 않아요.** "무르기는 배치의 역연산"이라는 첫 직관을 접고, 처음부터 다른 질문을 던지는 별개의 작은 모드로 둔 겁니다.

왜 이게 맞냐면, 두 모드가 커서 아래에서 *원하는 게 정반대*거든요. 배치 모드는 "이 셀이 **비었나** — 놓을 자리인가"를 보고, 철거 모드는 "이 셀에 **뭐가 있나** — 걷어낼 대상인가"를 봅니다. 같은 커서 위치를 정반대로 해석하니, 분기를 섞으면 조건문이 서로를 부정하며 엉켜요. 입구에서 갈라 두는 편이 훨씬 깔끔합니다.

---

## 3. 고아 방지 — 머신을 지우면 컨베이어가 먼저 사라진다

이제 본론. 좌클릭이 부르는 `DemolishUnderCursor`입니다. 커서 셀에 뭐가 있는지 보고, 그게 머신이냐 컨베이어냐에 따라 갈라요.

```cpp
void AOJJ_BuildController::DemolishUnderCursor()
{
    // ... (그리드 밖 클릭 / 빈 셀 무시 가드 생략)

    AActor* Target = TargetGrid->GetActorAtCell(CursorCell);

    // 광맥/WaterArea(AResourceBase)는 맵 고정물 — 철거 금지
    if (Target->IsA<AResourceBase>())
    {
        return;
    }

    if (AMachineBase* Machine = Cast<AMachineBase>(Target))
    {
        // ↓ 핵심: 머신에 매달린 컨베이어부터 지운다 (4절)
    }
    else if (AConveyor* Conveyor = Cast<AConveyor>(Target))
    {
        // 컨베이어 직접 철거
    }
}
```

`AResourceBase` 가드부터 짚고 갈게요. 광맥과 물(WaterArea)은 플레이어가 **놓은** 게 아니라 맵에 원래 박혀 있는 고정물입니다. 점유 셀을 차지하긴 해도 철거 대상이 아니에요(지우면 그 위에 지을 수도 없게 됩니다). 그래서 머신/컨베이어로 좁히기 전에 `AResourceBase`면 먼저 막습니다. 이 가드는 6절의 호버 쪽에도 똑같이 한 번 더 나옵니다 — 빨간 하이라이트조차 안 뜨게.

진짜 문제는 **머신 분기**입니다. 머신을 그냥 지우면 어떻게 될까요? [8편](/blog/factory-sim/08-conveyor-item-transport)을 떠올려 보죠. 컨베이어는 `SourceMachine`에서 아이템을 *당겨와*(pull) `TargetMachine`으로 보냅니다. 양끝에 머신이 있다는 게 컨베이어의 **존재 전제**였어요. 그 전제 위에서 배출·인입이 굴러갔고요.

그런데 한쪽 머신을 지우면, 컨베이어는 한쪽 끝이 사라진 채로 남습니다. 당겨올 소스가 없거나 보낼 타깃이 없는 — *반쪽짜리 줄.* 이게 고아입니다. 시뮬레이션은 매 틱 없는 머신을 참조하려 들 거고, 화면엔 어디에도 안 닿는 벨트가 덩그러니 남아요.

그래서 순서가 **컨베이어 먼저, 머신 나중**입니다.

```cpp
if (AMachineBase* Machine = Cast<AMachineBase>(Target))
{
    // 1) 이 머신을 끝점으로 둔 컨베이어 라인을 먼저 삭제 (고아 방지)
    for (AConveyor* Conveyor : CollectConveyorsConnectedToMachine(Machine))
    {
        if (const TArray<FIntPoint>* ConvCells = TargetGrid->GetActorCells(Conveyor))
        {
            if (ConvCells->Num() > 0)
            {
                TargetGrid->OJJ_RemoveActorAt((*ConvCells)[0]);   // 라인 전체 점유 해제
            }
        }
        Conveyor->Destroy();   // 액터/비주얼 실제 제거
    }

    // 2) 그 다음 머신 본체
    if (TargetGrid->RemoveMachineAt(CursorCell))
    {
        Machine->Destroy();
    }
}
```

머신을 지우기 *전에* `CollectConveyorsConnectedToMachine`으로 거기 연결된 컨베이어들을 모으고, 하나씩 걷어낸 다음, 마지막에 머신을 지웁니다. 순서를 뒤집으면 — 머신부터 지우면 — 4절의 수집 로직이 기준으로 삼는 머신이 이미 사라져서 "누구에게 연결됐던 컨베이어인지"를 되짚을 수 없게 돼요. 그래서 *반드시* 컨베이어가 먼저입니다.

> 이건 [8편](/blog/factory-sim/08-conveyor-item-transport)의 두-머신 전제가 철거에서 되갚는 빚이에요. "컨베이어는 양끝에 머신이 있어야 존재한다"는 규칙을 세웠으면, 그 끝을 치울 땐 규칙이 깨지지 않게 줄도 같이 거둬야 합니다. 짓는 쪽의 불변식이 무르는 쪽의 순서를 강제하는 거죠.

반대로 컨베이어를 직접 클릭해 지우는 건 훨씬 단순합니다. 컨베이어가 사라져도 양끝 머신은 멀쩡하니 연쇄가 없어요. 점유만 풀고 없애면 끝입니다(5절). 사라진 줄이 물고 있던 머신 포트는 다시 비게 되는데, 그 빈 포트의 화살표가 도로 돌아오는 처리는 [7편](/blog/factory-sim/07-port-cell-unification)에서 세운 화살표 재적재가 알아서 해줍니다 — 이것도 5절에서.

---

## 4. 누가 이 머신에 매달렸나 — 둘레 스캔과 검증

3절이 미룬 질문: `CollectConveyorsConnectedToMachine`은 "이 머신에 연결된 컨베이어"를 *어떻게* 찾을까요?

순진하게는 모든 컨베이어를 돌며 `GetSourceMachine() == Machine || GetTargetMachine() == Machine`을 물어보면 됩니다. 맞는 답이지만, 그러려면 팩토리 그래프 전체를 조회해야 해요. 여기선 더 국소적인 단서를 씁니다 — **공간.** 컨베이어가 머신에 연결됐다면, 그 컨베이어의 끝 셀은 머신 footprint 바로 *옆*에 붙어 있을 수밖에 없거든요(포트가 맞닿아야 무니까 — [7편](/blog/factory-sim/07-port-cell-unification)). 그러니 머신 둘레만 훑으면 후보가 다 걸립니다.

```cpp
TArray<AConveyor*> AOJJ_BuildController::CollectConveyorsConnectedToMachine(AMachineBase* Machine) const
{
    // ... (머신 점유 셀 목록 MachineCells 조회 — 없으면 빈 결과)

    const TSet<FIntPoint> Footprint(*MachineCells);
    static const FIntPoint Dirs[] = {
        FIntPoint(1, 0), FIntPoint(-1, 0), FIntPoint(0, 1), FIntPoint(0, -1)
    };

    TSet<AConveyor*> Seen;
    TArray<AConveyor*> Result;
    for (const FIntPoint& Cell : Footprint)
    {
        for (const FIntPoint& Dir : Dirs)
        {
            const FIntPoint Neighbor = Cell + Dir;
            if (Footprint.Contains(Neighbor)) { continue; }   // 머신 자기 몸은 건너뜀

            AConveyor* Conveyor = TargetGrid->OJJ_GetConveyorAtCell(Neighbor);
            if (!Conveyor || Seen.Contains(Conveyor)) { continue; }
            Seen.Add(Conveyor);

            // 검증: 정말 이 머신을 끝점으로 갖는 라인만 채택
            if (Conveyor->GetSourceMachine() == Machine || Conveyor->GetTargetMachine() == Machine)
            {
                Result.Add(Conveyor);
            }
        }
    }
    return Result;   // (인접은 있는데 연결 0개일 때의 경고 로그는 생략)
}
```

흐름이 두 단입니다. **둘레 스캔으로 후보를 모으고, 그래프 검증으로 거른다.**

**① 둘레 스캔.** footprint의 *모든* 셀에서 4방향 이웃을 봅니다. 머신이 1×1이면 둘레가 네 칸이지만, 2×2·3×3이면 한 변이 여러 셀이라 둘레 전체를 훑어야 해요(포트가 어느 변에 붙을지 모르니). 이웃이 footprint 안이면(= 머신 자기 몸이면) 건너뛰고, 그 셀에 컨베이어가 있으면 후보로 봅니다. `Seen` 집합으로 중복을 거르고요 — 2×2 머신의 두 셀이 같은 컨베이어를 이웃으로 가리킬 수 있으니까.

```
. . . . .
. M M C .   ← C: 머신(M) 둘레에 붙은 컨베이어 → 후보
. M M . .
. . . . .
```

**② 그래프 검증.** 여기가 중요합니다. 둘레에 컨베이어가 *붙어 있다고* 해서 이 머신에 **연결된** 건 아니에요. 옆 머신으로 가는 다른 라인이 우연히 이 머신 곁을 스쳐 지날 수 있거든요. 공간적 인접은 후보일 뿐, 진짜 연결은 컨베이어 자신이 압니다 — `GetSourceMachine()` / `GetTargetMachine()`. 그래서 후보마다 "네 양끝 중 하나가 정말 이 머신이냐"를 되물어, 맞는 것만 채택합니다.

이 검증을 빼면 **나란히 지나가는 남의 라인을 오삭제**합니다. 머신 A를 지웠는데 옆 머신 B로 가던 컨베이어가 곁에 붙어 있었다는 이유로 같이 잘려나가는 거죠. `Seen`이 공간 중복을 거르는 1차 필터라면, Source/Target 일치는 "실제로 내 줄이 맞나"를 가리는 2차 필터입니다. *공간으로 좁히고, 그래프로 확정한다* — 그리드를 빠른 후보 추림에, 그래프를 최종 판정에 쓰는 역할 분담이에요.

> (실제 코드엔 보험이 하나 더 있습니다. 둘레에 컨베이어는 있었는데 Source/Target 일치가 0개로 끝나면 — 나란한 남의 라인이면 정상이지만, 아니라면 "연결 기록과 실제 인접이 어긋난" 데이터 이상 신호라 경고 로그를 남깁니다. 본문 흐름에선 곁가지라 위 인용에선 생략했어요.)

---

## 5. 지운다는 것 — 점유 장부와 액터 수명을 가른다

3·4절에서 `OJJ_RemoveActorAt`과 `RemoveMachineAt`을 부르고 *그 다음에* `Destroy()`를 따로 불렀습니다. 왜 한 방에 안 지우고 두 단계로 나눴을까요? 이 절의 주제입니다. 약하게 넘기면 헷갈리는 지점이라 또박또박 풀게요.

"머신을 지운다"는 사실 **서로 다른 두 가지 일**입니다.

- **(가) 그리드 장부에서 점유를 푼다.** 그리드는 "어느 셀을 누가 차지했나"를 맵으로 들고 있습니다. 머신이 사라지면 그 셀들이 *다시 비어야* 해요. 안 그러면 그 자리에 다신 못 짓습니다.
- **(나) 액터 자체를 메모리에서 없앤다.** 언리얼 레벨에 떠 있는 `AActor`를 `Destroy()`로 실제 파괴합니다. 메시·컴포넌트·비주얼이 화면에서 사라지는 게 이쪽이에요([9편](/blog/factory-sim/09-conveyor-visual-interpolation)의 아이템 인스턴스 메시도 액터와 함께 걷힙니다).

이 둘을 **일부러 갈라** 뒀습니다. 그리드 함수(`OJJ_RemoveActorAt`/`RemoveMachine`)는 **(가)만** 합니다 — 장부에서 점유를 풀고, 그래프 엣지를 정리하고, 화살표를 복귀시키는 데까지. **(나)** `Destroy()`는 **호출자(빌드 컨트롤러)의 몫**이에요. 그래서 3·4절에서 `OJJ_RemoveActorAt(...)` 다음 줄에 `Conveyor->Destroy();`가 따로 붙었던 겁니다.

### 셀 하나로 라인 전체가 정리되는 법

먼저 (가)의 메커니즘부터. 3절에서 컨베이어 라인을 지울 때, 라인이 여러 셀을 차지하는데도 **셀 하나만**(`(*ConvCells)[0]`) 넘겼습니다. 그런데 라인 *전체*가 정리돼요. 어떻게?

그리드가 점유를 **두 개의 맵**으로 들고 있기 때문입니다.

- `OccupiedCells` : **셀 → 액터** (이 칸을 누가 차지했나)
- `OJJ_ActorToCells` : **액터 → 그 액터가 차지한 모든 셀**

`OJJ_RemoveActorAt(Cell)`은 이 둘을 *연달아* 역참조합니다.

```cpp
bool AOJJ_Grid::OJJ_RemoveActorAt(FIntPoint Cell)
{
    // 1) 셀 하나로 점유 액터를 찾는다  (셀 → 액터)
    const TWeakObjectPtr<AActor>* Found = OccupiedCells.Find(Cell);
    if (!Found || !Found->IsValid()) { return false; }
    AActor* Actor = Found->Get();

    // 2) 컨베이어면 팩토리 그래프 엣지부터 끊는다
    if (AConveyor* Conveyor = Cast<AConveyor>(Actor))
    {
        FactoryManager->UnregisterConveyor(Conveyor);
    }

    // 3) 그 액터가 차지한 '모든' 셀을 한꺼번에 비운다  (액터 → 셀들)
    const TArray<FIntPoint>* ActorCells = OJJ_ActorToCells.Find(Actor);
    for (const FIntPoint& C : *ActorCells)
    {
        OccupiedCells.Remove(C);
    }
    OJJ_ActorToCells.Remove(Actor);
    OJJ_ActorToOrigin.Remove(Actor);

    // 4) 빈 포트의 화살표 복귀 (7편)
    if (bPlacedArrowsVisible) { RefreshPlacedMachineArrows(); }

    return true;   // ← 여기까지가 '장부' 정리. 액터 Destroy는 호출자 몫.
}
```

(authority 가드와, 두 맵이 어긋났을 때의 전체 스캔 복구 분기는 생략했습니다.)

흐름을 보면 — 셀 하나로 `OccupiedCells`에서 **액터**를 얻고(①), 그 액터로 `OJJ_ActorToCells`에서 **그 액터의 셀 전부**를 얻어(③) 한 번에 비웁니다. 컨베이어 라인이 다섯 칸이든 열 칸이든, 그 중 *아무 셀 하나*만 알면 액터를 거쳐 나머지 전부에 닿는 거죠. 이게 "1액터 = 다중 셀이라 셀 하나로 전체 정리"의 정체입니다 — 호출자가 라인의 모든 셀을 일일이 모아 넘길 필요가 없어요. 라인이 *한 덩어리 액터*라는 사실과, 그 액터의 셀 목록을 그리드가 이미 들고 있다는 사실이 합쳐져 가능한 일입니다.

머신 쪽 `RemoveMachine`도 구조가 같아요. `OJJ_ActorToCells`에서 머신의 셀 목록을 가져와 `OccupiedCells`에서 전부 비우고, 그 전에 `OnRemovedFromGrid()` 훅으로 자원 선점 같은 걸 정리하고, `FactoryManager->UnregisterMachine`으로 그래프에서 뺍니다. 컨베이어의 `UnregisterConveyor`와 대칭이죠.

### 왜 Destroy를 호출자에게 미뤘나

이제 (나)를 왜 분리했는지. 그리드 함수가 점유만 풀고 `Destroy()`는 안 하는 이유는 셋입니다.

1. **그리드는 '공간 장부'라는 한 가지 일만 한다.** 어느 셀이 찼고 비었나 — 그게 그리드의 책임 전부예요. 액터의 *수명*(언제 메모리에서 사라지나)은 게임플레이 흐름의 문제지 장부의 문제가 아닙니다. 한 함수가 "장부 정리 + 액터 파괴"를 다 떠안으면 관심사가 섞여요.
2. **호출자가 순서를 쥘 수 있다.** 3절의 연쇄 삭제가 딱 이 덕을 봅니다 — 빌드 컨트롤러는 "컨베이어들 점유 해제 → 컨베이어들 Destroy → 머신 점유 해제 → 머신 Destroy"의 순서를 *자기가* 조율해요. 그리드가 점유 해제 안에서 멋대로 Destroy까지 해버리면, 이 연쇄의 타이밍을 호출자가 통제할 수 없습니다.
3. **점유만 풀고 액터는 살리는 길도 열린다.** 지금은 안 쓰지만, 가령 머신을 다른 칸으로 *옮기는* 동작이라면 점유만 풀고 같은 액터를 새 셀에 재등록하면 됩니다. 점유 해제와 파괴가 한 몸이면 이런 재사용이 막혀요.

요컨대 그리드는 **"이 셀들 이제 비었다"** 까지만 책임지고, **"이 액터 이제 없앤다"** 는 호출자가 책임집니다. 3·4절에서 본 `RemoveMachineAt(...)` *그리고* `Machine->Destroy()`의 두 줄짜리 리듬은, 이 책임 분리가 호출부에 그대로 드러난 모습이에요.

마지막으로 ④의 화살표 복귀. 컨베이어가 물고 있던 머신 포트가 다시 비면, 숨겨졌던 그 포트의 방향 화살표가 도로 떠야 합니다. `RefreshPlacedMachineArrows`가 [7편](/blog/factory-sim/07-port-cell-unification)에서 세운 "포트 셀 점유 상태로부터 화살표를 다시 그린다"를 그대로 돌려요. 철거 쪽에서 화살표를 따로 손대는 코드는 없습니다 — 점유를 풀면 화살표는 7편의 로직이 알아서 복원합니다. *같은 진실을 두 번 계산하지 않는다*는 7·8편의 원칙이 무르는 쪽에서도 똑같이 통하는 셈이죠.

---

## 6. 빨간 손맛 — 호버 피드백과 연속 철거

기능은 다 됐지만, 쓰기 좋으려면 두 가지가 더 필요했습니다. **(1)** 좌클릭 전에 "지금 뭐가 지워질지" 미리 보이기, **(2)** 연달아 빠르게 지우기.

호버 피드백은 `UpdateDemolishHover`가 맡습니다(2절에서 호버 경로가 여기로 빠졌죠).

```cpp
void AOJJ_BuildController::UpdateDemolishHover()
{
    // ... (커서가 그리드 밖이면 하이라이트 제거 / 동일 셀이면 리빌드 스킵)

    AActor* Target = TargetGrid->GetActorAtCell(CursorCell);

    // 빈 셀 또는 맵 고정물(광맥/WaterArea = AResourceBase)은 대상 아님 → 하이라이트 없음
    if (!Target || Target->IsA<AResourceBase>())
    {
        TargetGrid->ClearHoverPreview();
        return;
    }

    // 제거 가능 대상 → 점유 셀 전체를 빨강
    if (const TArray<FIntPoint>* Cells = TargetGrid->GetActorCells(Target))
    {
        TargetGrid->OJJ_HighlightCellsInvalid(*Cells);
    }
}
```

짚을 점 셋.

- **빨강은 빌려 쓴 색입니다.** `OJJ_HighlightCellsInvalid`는 원래 배치 모드에서 "여기 못 놓는다"를 표시하던 빨간 하이라이트예요. 철거에선 같은 함수를 "여기 지워진다"로 가져다 씁니다. 의미는 다르지만 신호는 같아요 — *빨강 = 주의/파괴적 동작.* 새 색 채널을 만들지 않고 기존 무효 표시를 재사용한 거죠. 그리고 4절의 두 맵 덕에 `GetActorCells(Target)`이 점유 셀 전부를 주니, 2×2 머신이면 네 칸이 통째로 빨갛게 물듭니다 — 좌클릭 한 번에 지워질 범위가 그대로 보여요.
- **`AResourceBase`는 여기서도 막습니다.** 3절 클릭 가드와 같은 줄이에요. 광맥·물 위에선 빨간 하이라이트조차 안 떠서, "여긴 못 지운다"가 손이 가기 전에 눈에 먼저 들어옵니다.
- **같은 셀이면 다시 안 그립니다.** 호버는 매 프레임 도는데, 커서가 같은 셀에 머무는 동안 매번 하이라이트를 새로 까는 건 낭비예요. 직전 호버 셀(`CurrentHoverCell`)을 기억해 두고, 셀이 안 바뀌었으면 그냥 빠집니다.

그 `CurrentHoverCell`이 **연속 철거**의 열쇠이기도 합니다. `DemolishUnderCursor`가 뭔가를 지우고 나면, 커서는 같은 자리에 있지만 그 셀은 이제 *비었어요.* 그런데 직전 호버 셀이 그대로면 위의 "같은 셀이면 스킵" 때문에 빨강이 안 걷힙니다 — 이미 없는 걸 가리킨 채로요. 그래서 철거 직후 이 기억을 **일부러 리셋**합니다.

```cpp
// DemolishUnderCursor 끝 — 뭔가 지웠다면
if (bRemoved)
{
    CurrentHoverCell = FIntPoint(INT_MIN, INT_MIN);   // sentinel: '직전 셀 없음'으로 강제
    UpdateMouseHover();                               // 즉시 호버 재계산 → 빈 셀이라 하이라이트 사라짐
}
```

`FIntPoint(INT_MIN, INT_MIN)`은 실제 그리드엔 없는 가짜 좌표 — "직전에 본 셀이 없다"는 sentinel입니다. 이걸로 "같은 셀 스킵" 가드를 무력화하고 호버를 강제로 다시 돌리면, 방금 빈 셀이 재평가돼 빨강이 즉시 걷혀요. 덕분에 머신이 빽빽한 구역에서 좌클릭을 *연타*하면, 한 번 지울 때마다 다음 대상의 빨강이 곧바로 따라붙어 끊김 없이 쓸어낼 수 있습니다.

---

## 7. 마치며

이번 편 요약은 셋입니다.

1. **철거는 배치의 반대가 아니라 별도 모드다.** 같은 커서를 두고 배치는 "비었나", 철거는 "뭐가 있나"를 묻는다 — 정반대 질문이라 호버·클릭 입구에서 `Demolish` 분기로 갈라, 배치 경로와 한 줄도 공유하지 않는다.
2. **두-머신 전제가 연쇄 삭제를 강제한다.** 머신을 지우면 거기 매달린 컨베이어는 반쪽짜리 고아가 되므로, *컨베이어 먼저·머신 나중*으로 거둔다. 어느 컨베이어가 매달렸나는 머신 둘레를 훑어(공간) 후보를 모으고 Source/Target 일치로 확정(그래프)하는 2단 스캔으로 찾는다 — 나란한 남의 라인을 오삭제하지 않으려면 검증이 필수다.
3. **지운다는 건 두 가지 일이고, 일부러 갈랐다.** 그리드는 점유 장부만 푼다(셀→액터→그 액터의 모든 셀, 두 맵을 거쳐 셀 하나로 라인 전체가 비워진다). 액터를 실제로 없애는 `Destroy`는 호출자가 맡는다 — 덕분에 그리드는 공간 장부라는 한 가지 일에 머물고, 호출자가 연쇄의 순서를 쥔다. 빈 포트의 화살표 복귀는 7편 로직이 점유 변화만으로 알아서 한다.

7~9편이 "흐름을 세우고 보여주는" 얘기였다면, 이번 편은 그 흐름을 *되돌리는* 얘기였습니다. 그리고 되돌리기를 만들면서 오히려 앞 편들의 설계가 옳았는지 시험받았어요 — 8편의 두-머신 전제가 깔끔했기에 연쇄 삭제의 조건이 명확했고, 7편의 화살표 재적재가 점유 기반이었기에 철거가 화살표를 따로 손댈 필요가 없었습니다. *무르기는 짓기의 설계를 비추는 거울*이더군요.

다음 편은, 9편 끝에서 예고했고 이번 편 내내 "이미 깔려 있다"고 전제했던 것 — 컨베이어 **경로를 어떻게 까느냐**로 갑니다. 마우스로 끈 자취에서 코너를 펴고, 점유할 셀을 모으고, 양끝 포트를 찾아 무는 그 빌드 과정으로요.

— JJ
