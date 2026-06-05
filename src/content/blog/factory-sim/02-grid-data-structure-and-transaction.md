---
title: "공장 시뮬레이션 게임 개발기 Phase 1.2 — 그리드 데이터 구조와 트랜잭션 안전성"
description: "TMap 양방향 매핑으로 점유 셀과 머신을 동시에 추적하고, TryPlaceMachine을 트랜잭션으로 묶어 SetActorLocation이 실패해도 ghost occupancy가 남지 않게 만든 과정."
date: 2026-05-28
category: UE5
series: factory-sim
seriesPart: 2
tags: [UE5, C++, 그리드시스템, TMap, 트랜잭션, 데이터구조]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 1: 그리드 시스템**
> - 1편: [그리드 시스템 개요](/blog/factory-sim/01-grid-system-overview)
> - **2편: 그리드 데이터 구조와 트랜잭션 안전성** ← 현재 글
> - 3편: 머티리얼로 그리드 시각화하기
> - 4편: 마우스 입력과 빌드 컨트롤러
> - 5편: Codex Adversarial Review로 잡은 숨은 버그들

## 1. 들어가며

[1편](/blog/factory-sim/01-grid-system-overview)에서 Phase 1 그리드 시스템을 입력 / 데이터 / 시각화 3축으로 갈라놓았습니다. 이번 글은 그중 가운데 — **데이터 레이어**, 즉 `AOJJ_Grid` 액터의 속살을 봅니다.

저는 팀 프로젝트의 그리드 담당이라, 다른 팀원이 만든 머신 베이스 클래스(`AMachineBase`)는 풋프린트 크기만 받아오는 외부 인터페이스로 다루고, 그리드 쪽 파일(`OJJ_Grid.h` / `OJJ_Grid.cpp`)만 직접 짭니다. 이 글에서 인용하는 코드도 거기까지입니다.

키워드는 두 개예요. **TMap 양방향 매핑**, 그리고 **트랜잭션 안전성**. 둘 다 "머신이 사라지면 셀도 같이 사라져야 한다"는 너무 당연한 명제를 지키기 위해 들인 장치들입니다. 안 지키면 머신은 없는데 셀이 점유돼 있는 좀비 상태 — **ghost occupancy** — 가 남거든요.

---

## 2. 첫 시도와 그 한계

처음 떠올린 데이터 구조는 단순했습니다.

```cpp
TMap<FIntPoint, AMachineBase*> OccupiedCells; // 셀 → 머신 (단방향)
```

배치는 쉬워요. 풋프린트 셀들이 `OccupiedCells`에 들어있는지만 보면 됩니다. 배치할 땐 셀마다 `OccupiedCells.Add(Cell, Machine)`.

문제는 **머신 입장에서 자기 셀을 찾을 일**이 생길 때 터집니다.

- **제거** — 머신을 그리드에서 빼려면, 그 머신이 점유한 셀 좌표들을 알아야 합니다. 단방향 맵에선 *전체 셀을 순회*해야 해요. 그리드가 20×20이면 매번 400회.
- **이동(회전·재배치)** — 같은 문제가 두 배. 옛 셀 찾아 빼고, 새 셀에 넣고.
- **풋프린트가 멀티셀인 경우** — 2×2 머신이면 셀이 네 개. 각각 정확하게 빠져야 ghost occupancy가 안 남습니다.

게임 시뮬레이션은 머신을 자주 깔고, 자주 옮기고, 자주 부숩니다. 그때마다 O(N) 순회는 받아들이기 어렵고, 무엇보다 **실수의 여지가 너무 큽니다**. "이 머신이 어느 셀에 있는지"가 추측의 영역으로 넘어가는 순간, 한 셀이라도 빼먹으면 그게 곧 숨은 버그입니다.

그래서 두 번째 맵이 들어옵니다.

---

## 3. TMap 양방향 매핑

`OJJ_Grid.h`의 실제 멤버는 이렇습니다.

```cpp
// 점유된 셀 → 머신 (좌표로 머신 조회)
UPROPERTY(Transient)
TMap<FIntPoint, TWeakObjectPtr<AMachineBase>> OccupiedCells;

// 머신 → 점유 셀 목록 (이미 배치 여부 판정, 제거 시 일괄 해제)
TMap<TWeakObjectPtr<AMachineBase>, TArray<FIntPoint>> MachineToCells;
```

두 맵을 항상 같이 들고 다닙니다. 한쪽이 진실이고 다른 쪽이 캐시가 아니라, **둘 다 진실의 동등한 시점**입니다. 그래서 "어느 한쪽만 수정하는" 경로를 코드에서 만들지 않는 게 가장 큰 규칙이에요. 모든 추가·삭제는 반드시 두 맵을 동시에 건드립니다.

### 왜 `TWeakObjectPtr`인가

원시 포인터(`AMachineBase*`) 대신 `TWeakObjectPtr<AMachineBase>`를 씁니다. 이유는 한 줄이에요.

> 머신이 다른 시스템(예: 다른 팀원의 게임플레이 로직)에서 `Destroy`되면, 그리드는 그걸 *모를 수* 있습니다.

원시 포인터를 들고 있으면 그 순간부터 **dangling pointer**가 됩니다. 다음 호출에서 그 포인터를 역참조하는 순간 크래시. `TWeakObjectPtr`는 객체가 GC된 뒤 `IsValid()`가 `false`를 돌려주므로, 그리드가 **자기 정리(self-cleanup)** 를 할 단서를 갖게 됩니다.

이 자기 정리 로직이 곧 `SweepStaleEntries`인데, 잠시 뒤에 봅니다.

---

## 4. `TryPlaceMachine` — 트랜잭션 패턴

머신을 그리드에 놓는 외부 진입점은 `TryPlaceMachine` 하나입니다. 다른 데서 어떤 경로로 호출하든 이 함수를 거쳐야 점유가 기록돼요.

```cpp
bool AOJJ_Grid::TryPlaceMachine(AMachineBase* Machine, FIntPoint Origin, FString& OutReason)
{
    if (!RegisterMachineInternal(Machine, Origin, OutReason))
    {
        return false;
    }

    if (!Machine->SetActorLocation(GridToWorld(Origin)))
    {
        RemoveMachine(Machine);
        OutReason = TEXT("Failed to move machine to target location");
        return false;
    }

    return true;
}
```

짧지만 이 함수가 이 글의 골자입니다. 두 단계로 나뉘어요.

1. **데이터 등록** — `RegisterMachineInternal`이 두 맵에 머신을 올린다.
2. **월드 위치 갱신** — `SetActorLocation`으로 실제 액터를 셀 중심 좌표로 옮긴다.

문제는 2번이 실패할 때입니다. UE5의 `SetActorLocation`은 콜리전 등 이유로 `false`를 돌려줄 수 있어요. 흔치 않지만 *가능*합니다.

만약 2번이 실패해도 1번을 그대로 두면 어떻게 될까요. **머신은 원래 자리에 있는데, 그리드는 새 셀이 점유됐다고 믿고 있는** 상태가 됩니다. 다음 배치 시도 때 누군가가 그 셀에 못 놓고, 정작 그 자리에는 아무것도 없죠. 좀비 점유 — ghost occupancy.

그래서 2번이 실패하면 1번을 **롤백**합니다. `RemoveMachine(Machine)`이 두 맵에서 머신과 그 셀들을 모두 제거해요. 트랜잭션의 마지막 단계가 실패하면 앞 단계를 전부 되돌리는, DB에서 흔히 보는 패턴입니다.

> 💡 단계가 두 개뿐이라 패턴이 명확하지만, 단계가 늘어나도 원칙은 같습니다. **"register-first + 실패 시 unwind."** 등록을 먼저 하고, 뒷단이 깨지면 등록을 되돌린다.

---

## 5. `RegisterMachineInternal` — 검증의 단일 진입점

위에서 호출한 `RegisterMachineInternal`은 데이터 변경 전 모든 검증을 모아둔 곳입니다.

```cpp
bool AOJJ_Grid::RegisterMachineInternal(AMachineBase* Machine, FIntPoint Origin, FString& OutReason)
{
    if (!HasAuthority())
    {
        ensureMsgf(false, TEXT("Grid placement called on non-authority"));
        OutReason = TEXT("Not authority");
        return false;
    }

    SweepStaleEntries();

    if (!Machine)
    {
        OutReason = TEXT("Invalid machine");
        return false;
    }

    if (MachineToCells.Contains(Machine))
    {
        OutReason = TEXT("Machine already placed. Use TryMoveMachine for repositioning.");
        return false;
    }

    if (!CanPlaceMachine(Machine, Origin))
    {
        OutReason = TEXT("Cell already occupied");
        return false;
    }

    TArray<FIntPoint> Footprint = CalculateFootprint(Machine, Origin);
    for (const FIntPoint& Cell : Footprint)
    {
        OccupiedCells.Add(Cell, Machine);
    }
    MachineToCells.Add(Machine, MoveTemp(Footprint));

    OutReason.Reset();
    return true;
}
```

검증 순서가 꽤 의도적이라 한 줄씩 풀어둘게요.

1. **`HasAuthority()`** — 서버 전용. 멀티플레이를 가정한 게임이라 클라가 직접 점유 맵을 바꾸면 안 됩니다. 그리고 단순 `return`이 아니라 `ensureMsgf`로 호출 시점을 디버거에 박아둡니다. 클라에서 잘못 부르면 그 자리에서 잡힙니다.
2. **`SweepStaleEntries()`** — 쓰기 진입점에 들어왔을 때 먼저 GC된 엔트리부터 정리. 다음 절에서 자세히 봅니다.
3. **nullptr 가드.** 외부 호출자가 어디서 머신을 잘못 넘기더라도 여기서 차단.
4. **`MachineToCells.Contains(Machine)`** — 같은 머신을 두 번 등록 못 하게. 재배치는 별도 경로(예: `TryMoveMachine`)로 풀어야 한다는 신호.
5. **`CanPlaceMachine`** — 풋프린트 모든 셀의 bounds + 점유 검증.
6. **두 맵에 동시 추가** — 검증을 다 통과해야만 데이터가 바뀐다.

여기서 가장 중요한 한 줄은 6번입니다. **`OccupiedCells`와 `MachineToCells`를 같은 함수 안에서 같이 갱신**한다는 거. 한쪽만 갱신하는 경로를 만들지 않는 게 양방향 맵을 일관되게 유지하는 비결이에요.

> 부가 효과로, `TryPlaceMachine` 외에 사전 배치된 머신을 등록하는 `RegisterExistingMachine`도 같은 `RegisterMachineInternal`을 통과합니다. 입구가 둘이지만 검증은 한 곳.

---

## 6. `SweepStaleEntries` — 자동 정리

`TWeakObjectPtr`를 쓰니까, 머신이 다른 시스템에서 `Destroy`된 뒤에도 그리드 맵에는 **무효해진 키와 값**이 한동안 남습니다. 그걸 매 쓰기 시점에 한 번 훑어 정리해요.

```cpp
void AOJJ_Grid::SweepStaleEntries()
{
    for (auto It = MachineToCells.CreateIterator(); It; ++It)
    {
        if (!It.Key().IsValid())
        {
            for (const FIntPoint& Cell : It.Value())
            {
                const TWeakObjectPtr<AMachineBase>* Found = OccupiedCells.Find(Cell);
                if (Found && !Found->IsValid())
                {
                    OccupiedCells.Remove(Cell);
                }
            }
            It.RemoveCurrent();
        }
    }
}
```

핵심 두 줄.

- `It.Key().IsValid()` — 약참조가 살아있는지 확인. 죽은 머신이면 정리 대상.
- 같은 머신이 점유했던 셀들도, 그 셀의 약참조가 무효라면 `OccupiedCells`에서도 함께 제거.

즉, 머신을 따로 `RemoveMachine`해주지 않아도, 다음 쓰기 호출 시점에 자동으로 청소됩니다. 그게 양방향 맵의 부가 가치 중 하나예요. 한쪽이 GC되면 다른 쪽을 단서 삼아 따라가서 같이 정리할 수 있다는 점.

---

## 7. ghost occupancy의 정의와, 5편 예고

지금까지의 장치들이 막아주는 게 정확히 **ghost occupancy** — *머신은 없는데 셀은 점유돼 있다고 그리드가 믿는 상태* — 입니다. 발생 시나리오 몇 가지만 가볍게 짚고 갈게요.

- **재배치 중 옛 셀을 안 비움** — 머신을 다른 위치로 옮길 때, 옛 셀 정리 빠지면 그쪽이 좀비.
- **`SetActorLocation` 실패 후 unwind 안 함** — 4절에서 본 그 경로. 롤백 없이 빠져나가면 그리드는 새 셀이 점유됐다고 생각.
- **외부에서 `Destroy`된 머신** — `SweepStaleEntries`가 못 잡으면 약참조만 죽고 셀은 남는다.

이런 게 까다로운 이유는 **컴파일 에러도 런타임 크래시도 없이 게임이 조용히 망가지기 때문**입니다. 한 시간쯤 플레이하다가 어느 셀에 뭘 못 놓는데 정작 그 자리엔 아무것도 안 보여요. 디버그 콘솔로 점유 맵을 직접 출력해봐야 보입니다.

이 부류의 버그를 **5편**에서 따로 다룹니다. AI 도구(Codex)로 adversarial review를 돌리면서 *컴파일은 통과하지만 게임은 망가지는* 패턴들을 찾아낸 기록이에요. 거기서 다시 이 트랜잭션 코드가 등장합니다.

---

## 8. `CanPlaceMachine` — 단일 패스 검증

배치 가능 여부 판단은 `CanPlaceMachine` 한 함수에 모았습니다.

```cpp
bool AOJJ_Grid::CanPlaceMachine(AMachineBase* Machine, FIntPoint Origin) const
{
    if (!Machine)
    {
        return false;
    }

    // 모든 placement entry point가 같은 invariant 따르도록 풋프린트 전체 셀에 대해
    // bounds + 점유를 동시에 검사 (단일 패스).
    for (const FIntPoint& Cell : CalculateFootprint(Machine, Origin))
    {
        if (!IsValidGridCell(Cell))
        {
            return false;
        }

        const TWeakObjectPtr<AMachineBase>* Found = OccupiedCells.Find(Cell);
        if (Found && Found->IsValid())
        {
            return false;
        }
    }

    return true;
}
```

설계 포인트가 두 개입니다.

**(a) bounds 검증과 점유 검증을 같은 루프에 둔다.**
풋프린트 셀을 한 번만 순회하면서 *둘 다* 본다. 두 검증을 따로 두 번 돌면 멀티셀 풋프린트에서 미묘한 비대칭이 생길 수 있어요. 예를 들어 한 쪽 함수는 anchor 셀만 보고 통과, 다른 쪽 함수가 풋프린트 전체를 본다든가. 같은 invariant를 동일 패스에 묶어야 그런 게 안 생깁니다.

**(b) 모든 placement 경로가 이 함수를 통과한다.**
`RegisterMachineInternal`이 호출 → 사전 등록(`RegisterExistingMachine`)·새 배치(`TryPlaceMachine`)도 동일한 검증. **단일 진실원(single source of truth).**

`IsValidGridCell`도 짧으니 같이 보여드릴게요.

```cpp
bool AOJJ_Grid::IsValidGridCell(FIntPoint Cell) const
{
    return Cell.X >= 0 && Cell.X < GridSize.X
        && Cell.Y >= 0 && Cell.Y < GridSize.Y;
}
```

여기서 한 가지 조심한 게 있습니다. `GridSize`와 `VisualizationRange`를 분리한 거예요.

- `GridSize` — **실제 placement 영역**. `IsValidGridCell`이 권위 있는 bounds로 사용.
- `VisualizationRange` — **시각화용 floor 평면의 셀 수**. 렌더링 전용.

기본값은 같이 가지만 디자이너가 따로 잡을 수 있게 했습니다. 예를 들어 30칸짜리 바닥 위에 20×20만 실제 배치 가능하게 하는 미적 의도가 가능해요. 이 분리가 없으면 시각화 변경이 곧 placement 영역 변경이 돼서, 시각만 만지려다 게임 로직을 흔드는 사고가 납니다.

---

## 9. `WorldToGrid` / `GridToWorld` — 좌표 변환의 단순함

마우스 입력(4편 주제)과 셀 좌표를 잇는 다리입니다. 두 함수 다 짧아요.

```cpp
FIntPoint AOJJ_Grid::WorldToGrid(FVector WorldPos) const
{
    const FVector Local = WorldPos - GetActorLocation();
    const int32 X = FMath::FloorToInt(Local.X / CellSize);
    const int32 Y = FMath::FloorToInt(Local.Y / CellSize);
    return FIntPoint(X, Y);
}

FVector AOJJ_Grid::GridToWorld(FIntPoint Coord) const
{
    const FVector Origin = GetActorLocation();
    const float WorldX = Origin.X + (Coord.X * CellSize) + (CellSize * 0.5f);
    const float WorldY = Origin.Y + (Coord.Y * CellSize) + (CellSize * 0.5f);
    return FVector(WorldX, WorldY, Origin.Z);
}
```

두 가지만 기억하면 됩니다.

- **`WorldToGrid`는 `FloorToInt`** — 셀의 lower-left이 기준. 음수 좌표도 자연스럽게 처리됩니다 (호버 미리보기에서 풋프린트가 그리드 바깥으로 새는 경우 활용).
- **`GridToWorld`는 셀 중심을 돌려준다** — `(CellSize * 0.5f)` 오프셋. 머신을 셀 중앙에 놓고 싶다는 의도가 함수에 박혀 있는 거예요.

좌표 변환은 부동소수점 함정이 흔한 영역이지만, 여기선 *정수 환산을 먼저 끝내고* 부동소수점을 후처리해서 위험을 거의 없앴습니다. `Local.X / CellSize`가 음수일 때 `FloorToInt`가 `-1` 쪽으로 내려가는 것까지 의도된 동작이에요.

---

## 10. 마치며

요약하면 이번 편은 다음 4가지로 정리됩니다.

1. **TMap 양방향 매핑** — 셀 → 머신, 머신 → 셀들을 둘 다 들고 다닌다. 두 맵은 항상 같이 갱신한다.
2. **`TWeakObjectPtr` + `SweepStaleEntries`** — 외부에서 머신이 죽어도 그리드는 자기 정리할 수 있다.
3. **`TryPlaceMachine`의 트랜잭션** — register-first + 실패 시 unwind. ghost occupancy를 구조적으로 막는다.
4. **`CanPlaceMachine` 단일 검증** — bounds + 점유를 한 루프에서. 모든 placement 경로가 이 함수를 거친다.

다음 **3편**에서는 데이터 레이어를 잠시 떠나, **시각화 레이어** — `M_OJJ_GridFloor` 머티리얼로 격자를 그리고, 호버 미리보기용 머티리얼 인스턴스 두 벌로 녹/빨 셀을 표현하는 — 이야기로 갑니다.

그리고 약속한 **5편** — 위에서 만든 트랜잭션 코드를 AI 도구가 어떻게 부수려고 시도했는지, 그러다 진짜로 잡힌 숨은 버그들이 어떤 것들이었는지 — 도 잊지 않고 갑니다.

— JJ
