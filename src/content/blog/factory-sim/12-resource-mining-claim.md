---
title: "공장 시뮬레이션 게임 개발기 Phase 3.1 — 아이템은 어디서 태어나는가: 채굴기·광맥·1자원 1머신 선점"
description: "11편의 컨베이어가 당겨오던 그 아이템은 애초에 어디서 왔나. 공장에 자원이 처음 생겨나는 지점 — 채굴기와 광맥. 맵에 박힌 고정물 광맥, weak 포인터로 '1자원 1머신'을 보장하면서 머신이 죽어도 저절로 풀리는 선점(Claim), 배치하면 묶이고 철거하면 풀리는 대칭 라이프사이클, 그리고 광맥을 깎아 출력 버퍼에 쌓는 채굴 루프와 그 버퍼가 곧 컨베이어의 소스가 되는 이음매까지. Phase 3 — 생산 계통의 시작."
date: 2026-06-09
category: UE5
series: factory-sim
seriesPart: 12
tags: [UE5, C++, 자원, 채굴, 선점, 데이터주도]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 3: 생산 — 자원과 가공**
> - **3.1편: 아이템은 어디서 태어나는가 — 채굴기·광맥·1자원 1머신 선점** ← 현재 글
> - (이어지는 편: 레시피 가공 — 예정)
>
> *Phase 1 — 그리드 시스템: [1편](/blog/factory-sim/01-grid-system-overview) · [2편](/blog/factory-sim/02-grid-data-structure-and-transaction) · [3편](/blog/factory-sim/03-material-grid-visualization) · [4편](/blog/factory-sim/04-mouse-input-build-controller) · [5편](/blog/factory-sim/05-codex-adversarial-review)*
> *Phase 2 — 머신과 컨베이어 (6~11편): [시리즈 전체 보기 →](/blog/series/factory-sim)*

## 1. 들어가며 — 아이템의 출처

[11편](/blog/factory-sim/11-conveyor-path-build)에서 컨베이어를 깔며 한 가지를 당연하게 깔고 갔습니다. 컨베이어는 `SourceMachine`의 **출력**에서 아이템을 당겨와 `TargetMachine`의 입력으로 보낸다고. [8편](/blog/factory-sim/08-conveyor-item-transport)의 풀(pull) 모델이 내내 전제한 것도 "출력에 *뭔가 있다*"였죠.

그런데 그 출력은 *누가* 채웠을까요? 컨베이어는 나르기만 할 뿐 만들지 않아요. 가공 머신도 입력을 받아 바꿀 뿐, 무에서 만들진 못합니다. 사슬을 거슬러 올라가면 결국 **맨 처음 아이템을 세상에 내놓는 무언가**가 있어야 해요. 그게 이번 편의 주인공 — **채굴기**입니다.

11편 끝에서 예고한 "아이템이 *어디서 와서* 어떻게 바뀌는지" 중, 이번 편은 **"어디서 와서"** 입니다. 공장에 자원이 *처음 생겨나는* 지점이죠. 그리고 여기서부터가 Phase 3 — 자원을 캐고 가공하는 **생산 계통**의 시작입니다.

채굴은 단순해 보여요. "광맥 옆에 채굴기 놓으면 자원이 나온다." 그런데 막상 만들면 질문이 줄줄이 딸려 나옵니다. 광맥은 누가 소유하나? 채굴기 둘이 한 광맥을 같이 빨면? 채굴기를 부수면 광맥은 어떻게 되나? 캔 자원은 *무엇*이고 어디에 쌓이나? 이 편은 그 질문들을 따라갑니다.

---

## 2. 광맥과 채굴기 — 붙어야 의미가 생긴다

등장인물은 둘이에요. **광맥**(`AResourceBase`)과 **채굴기**(`AMinerMachine`).

광맥부터. 광맥은 플레이어가 짓는 게 아니라 **맵에 처음부터 박혀 있는 고정물**입니다. [10편](/blog/factory-sim/10-demolish-cascade-delete)에서 철거가 `AResourceBase`를 만나면 손도 못 대게 막았던 그것 — 광맥과 물이 바로 이 클래스예요. 자기 셀을 그리드 점유에 등록하지만, 플레이어의 건설·철거 대상이 아닌 *배경의 일부*입니다.

광맥이 *무엇인지*는 데이터로 정해집니다.

```cpp
class AResourceBase : public AActor
{
    // 무엇을 얼마나 품고 있나 — DataTable로 주입되는 스펙
    FDataTableRowHandle ResourceData;   // shape(Ore/...), form(고체/액체) 등 행 데이터

    FName ResourceID;
    int32 Amount    = 100;     // 남은 양
    int32 MaxAmount = 1000;
    bool  bIsInfinite = false; // 무한 자원이면 캐도 안 줄어든다

    // 이 자원을 선점한 머신 (3절) — weak 포인터
    TWeakObjectPtr<AMachineBase> ClaimedBy;
};
```

핵심은 `ResourceData`(DataTable 행)와 `Amount`예요. 광맥의 *종류*(철광석인가, 다른 광석인가)와 *형태*(`shape == Ore`인가)는 코드에 박지 않고 데이터 행에서 읽습니다. 채굴기가 "이게 캘 수 있는 광맥인가"를 판단할 때 쓰는 `HasShape(EResourceShape::Ore)`가 바로 이 행을 조회하는 래퍼고요. 새 광물을 추가하고 싶으면 C++가 아니라 DataTable에 행을 한 줄 더하는 식 — *무엇을 캐느냐*는 데이터의 몫입니다.

채굴기는 그 자체로는 아무것도 못 해요. **광맥에 붙어야** 의미가 생깁니다. 그래서 채굴기에게 가장 중요한 한 가지는 "내가 캘 광맥이 누구냐" — `LinkedResource`입니다. 이 링크가 언제 맺어지고 끊어지는지가 4절, 그 링크로 실제 뭘 하는지가 5절이에요. 그런데 그 전에, 링크보다 먼저 풀어야 할 문제가 있습니다 — **소유권.**

---

## 3. 1자원 1머신 — 선점(Claim)

문제는 이렇습니다. 광맥 하나를 채굴기 *둘*이 동시에 빨면 어떻게 될까요? 둘 다 같은 자원을 깎아 가니 수량이 두 배 빨리 줄고, "누가 이 광맥의 주인이냐"가 모호해집니다. 그래서 규칙을 하나 못박아요 — **한 광맥은 한 채굴기만.** 이걸 강제하는 게 **선점(Claim)** 시스템입니다.

광맥은 자기를 선점한 머신을 `ClaimedBy`로 기억합니다. 그런데 이게 보통 포인터가 아니라 **weak 포인터**(`TWeakObjectPtr`)라는 게 이 절의 묘미예요.

```cpp
bool AResourceBase::IsClaimed() const
{
    // weak 포인터가 유효하면 선점 중. 선점 머신이 사라지면 자동으로 false.
    return ClaimedBy.IsValid();
}

bool AResourceBase::Claim(AMachineBase* Claimant)
{
    if (!Claimant) { return false; }

    // 다른 유효한 머신이 이미 선점 중이면 거부. 같은 머신의 재선점은 멱등 성공.
    if (ClaimedBy.IsValid() && ClaimedBy.Get() != Claimant)
    {
        return false;   // 남이 찜한 광맥
    }

    ClaimedBy = Claimant;
    return true;
}

void AResourceBase::Release(AMachineBase* Claimant)
{
    // 소유자가 일치할 때만 해제 — 남의 선점을 함부로 못 풀게. (null이면 무조건 해제)
    if (Claimant && ClaimedBy.IsValid() && ClaimedBy.Get() != Claimant)
    {
        return;
    }
    ClaimedBy = nullptr;
}
```

세 함수에 규칙이 다 들어 있어요.

- **`Claim`** — 비어 있거나 *내가* 이미 주인이면 성공, 남이 주인이면 거부. "같은 머신의 재선점은 멱등 성공"이라 두 번 호출해도 안전합니다.
- **`Release`** — 아무나 못 풀어요. `Claimant`가 현재 소유자와 같아야 해제됩니다. 옆 채굴기가 실수로 내 광맥을 풀어버리는 사고를 막죠.
- **`IsClaimed`** — 그냥 `ClaimedBy.IsValid()`.

여기서 **weak 포인터**가 똑똑하게 일합니다. 보통 포인터로 소유자를 들고 있었다면, 채굴기가 *비정상적으로* 사라질 때(레벨 전환, 직접 Destroy 등) 광맥은 이미 죽은 채굴기를 계속 "주인"으로 붙들고 있게 돼요 — 댕글링. 그럼 그 광맥은 영영 다시 선점 못 하는 *유령 점유* 상태가 됩니다.

weak 포인터는 가리키던 액터가 파괴되면 **자동으로 무효(`IsValid()==false`)** 가 돼요. 그래서 채굴기가 어떻게 죽든, `IsClaimed`는 그 순간 저절로 `false`가 되고 광맥은 *알아서* 자유로워집니다. 명시적인 `Release`를 깜빡해도 시스템이 스스로 치유되는 거죠(self-healing). 물론 4절에서 보듯 **명시 `Release`도 병행**합니다 — 정상 경로에선 즉시 깔끔하게 풀고, weak는 비정상 경로의 안전망으로 두는 이중 방어예요.

> 정리하면, 선점은 두 겹입니다. *정상* 철거·소멸엔 명시 `Release`로 즉시 해제하고, *비정상* 소멸엔 weak 포인터가 자동 무효화로 받아냅니다. 어느 경로로 채굴기가 사라지든 광맥이 유령에게 붙들리는 일은 없어요. "1자원 1머신"이 깨지지 않게 지키는 두 번째 자물쇠인 셈이죠.

---

## 4. 배치가 곧 결속 — 라이프사이클

선점 규칙이 있으니, 이제 그걸 *언제* 걸고 푸느냐. 답은 **머신의 생애와 같이 갑니다.** 배치되면 광맥을 선점하고, 제거되면 풀어요. 세 개의 훅이 이 생애를 잇습니다.

먼저 **배치 자체가 조건부**입니다. 채굴기는 아무 데나 못 놓아요 — 인접에 *캘 수 있는* 광맥이 있어야 합니다.

```cpp
// 배치 가능 판정 — 인접에 미선점 Ore 광맥이 하나라도 있어야 true
bool AMinerMachine::CanPlaceAdditional(const AOJJ_Grid* Grid, FIntPoint Origin, int32 RotationSteps) const
{
    return FindAdjacentUnclaimedOre(Grid, Origin, RotationSteps) != nullptr;
}
```

광맥이 곁에 없으면 배치 단계에서 막힙니다(미리보기가 빨갛게 뜨죠 — 4·7편의 배치 게이트와 같은 결). 광맥 옆이 아니면 채굴기는 존재 이유가 없으니까요.

배치가 확정되면, 그 인접 광맥을 **선점하고 링크**합니다.

```cpp
void AMinerMachine::OnPlacedOnGrid(AOJJ_Grid* Grid, FIntPoint Origin, int32 RotationSteps)
{
    Super::OnPlacedOnGrid(Grid, Origin, RotationSteps);

    AResourceBase* Ore = FindAdjacentUnclaimedOre(Grid, Origin, RotationSteps);
    if (Ore && Ore->Claim(this))      // 3절의 Claim
    {
        SetLinkedResource(Ore);       // "내가 캘 광맥은 이것"
    }
}
```

그리고 제거되면 — [10편](/blog/factory-sim/10-demolish-cascade-delete)에서 머신 철거가 부른다고 했던 그 `OnRemovedFromGrid` 훅(당시 "자원 Release 정리"라고만 짚고 넘어갔죠) — 여기서 **선점을 풉니다.**

```cpp
void AMinerMachine::OnRemovedFromGrid()
{
    Super::OnRemovedFromGrid();
    if (IsValid(LinkedResource))
    {
        LinkedResource->Release(this);   // 3절의 Release
    }
    LinkedResource = nullptr;
}
```

`EndPlay`(레벨 전환 등 그리드를 안 거치는 소멸)에도 똑같이 `Release`를 한 번 더 둡니다. 3절에서 말한 "명시 해제 병행"이 이 두 자리예요. **배치 = Claim, 제거 = Release** — 생애의 양 끝이 거울처럼 대칭이고, 그 사이에서만 채굴기가 광맥을 독점합니다.

남은 건 "인접 광맥을 어떻게 찾나" — `FindAdjacentUnclaimedOre`입니다. 그런데 이 로직, 어디서 본 모양이에요.

```cpp
AResourceBase* AMinerMachine::FindAdjacentUnclaimedOre(const AOJJ_Grid* Grid, FIntPoint Origin, int32 RotationSteps) const
{
    // 풋프린트 셀 집합 만들기 ... (회전 적용, 생략)

    static const FIntPoint Dirs[] = { {1,0}, {-1,0}, {0,1}, {0,-1} };

    for (const FIntPoint& Cell : Footprint)
    {
        for (const FIntPoint& Dir : Dirs)
        {
            const FIntPoint Neighbor = Cell + Dir;
            if (Footprint.Contains(Neighbor)) { continue; }   // 자기 몸은 건너뜀

            AResourceBase* Resource = Cast<AResourceBase>(Grid->GetActorAtCell(Neighbor));
            if (Resource && !Resource->IsClaimed() && Resource->HasShape(EResourceShape::Ore))
            {
                return Resource;   // 미선점 + Ore 형태인 첫 광맥
            }
        }
    }
    return nullptr;
}
```

[10편](/blog/factory-sim/10-demolish-cascade-delete)에서 머신 둘레를 4방향으로 훑어 연결된 컨베이어를 찾던 그 **둘레 스캔**과 똑같은 패턴입니다. footprint 전 둘레의 인접 셀을 돌며 후보를 보고, 여기선 컨베이어 대신 *광맥*을, 그것도 **미선점(`!IsClaimed`) + Ore 형태(`HasShape`)** 인 것만 고릅니다. 이미 다른 채굴기가 찜한 광맥은 `IsClaimed`에서 걸러지니, "1자원 1머신"이 배치 탐색 단계에서부터 지켜져요. 같은 격자 위에서 같은 둘레 스캔이 *무엇을 찾느냐*만 바꿔 재사용되는 셈입니다.

---

## 5. 채굴 루프 — 광맥을 깎아 버퍼에 쌓는다

링크까지 맺어졌으니, 이제 실제로 캘 차례. 채굴은 **타이머가 굴리는 반복**입니다 — `MineInterval`(기본 2초)마다 `MineResource`가 한 번씩 돌아요. 한 사이클은 단순합니다. **광맥에서 깎아서, 내 출력 버퍼에 쌓는다.**

```cpp
void AMinerMachine::MineResource()
{
    if (!CanMine()) { StopMining(); return; }   // 링크 끊김/Ore 아님 → 정지

    // 광맥의 DataTable 행 이름이 곧 아이템 ID
    const FName ResourceID = LinkedResource->GetResourceRowName();

    // 출력 버퍼가 이미 가득이면 정지 (backpressure)
    const int32 Current = OutputBuffer.FindRef(ResourceID);
    if (Current + MineAmount > MaxBufferPerItem) { StopMining(); return; }

    // 광맥에서 실제로 깎기 — 고갈이면 정지
    if (!LinkedResource->ConsumeResource(MineAmount)) { StopMining(); return; }

    // 깎은 만큼 내 출력 버퍼에 쌓기
    AddOutputItem(ResourceID, MineAmount);
}
```

두 동작이 짝을 이룹니다. **광맥에서 빼고**(`ConsumeResource`) **버퍼에 더한다**(`AddOutputItem`). 그 사이에 세 개의 정지 조건이 있어요.

- **링크가 유효하고 Ore인가** (`CanMine`) — 광맥이 사라졌거나 캘 수 없는 형태면 멈춥니다.
- **버퍼가 가득인가** — 출력 버퍼가 아이템당 상한(`MaxBufferPerItem`)에 닿으면 멈춰요. 캔 걸 둘 데가 없으니까. 이게 [8편](/blog/factory-sim/08-conveyor-item-transport)에서 본 backpressure의 채굴 버전입니다 — 하류(컨베이어·다음 머신)가 안 빼가면 버퍼가 차고, 차면 채굴이 알아서 쉽니다.
- **광맥이 고갈됐나** — `ConsumeResource`가 실패하면(남은 양 부족) 멈춥니다.

깎는 쪽 `ConsumeResource`도 짚고 갈게요.

```cpp
bool AResourceBase::ConsumeResource(int32 ConsumeAmount)
{
    if (ConsumeAmount <= 0)  { return false; }
    if (bIsInfinite)         { return true; }   // 무한 자원은 줄지 않는다
    if (Amount < ConsumeAmount) { return false; } // 모자라면 실패

    Amount -= ConsumeAmount;
    return true;
}
```

`bIsInfinite`면 수량을 건드리지 않고 항상 성공 — 마르지 않는 광맥이죠. 아니면 남은 `Amount`에서 깎고, 모자라면 실패해서 위의 채굴 루프를 정지시킵니다.

그리고 여기서 **아이템의 정체성**이 정해집니다. 캐낸 아이템의 ID는 `GetResourceRowName()` — 광맥의 **DataTable 행 이름**이에요. 즉 "철광석 광맥"에서 캐면 `"IronOre"` 같은 행 이름이 그대로 아이템 ID가 됩니다. [8편](/blog/factory-sim/08-conveyor-item-transport)에서 컨베이어 슬롯이 `FName` 하나로 아이템 종류를 표현했던 그 ID가 *바로 여기서 태어나는* 거예요. 코드가 아이템 종류를 박는 게 아니라, 광맥의 데이터 행이 곧 아이템의 출신 성분이 됩니다 — 2절의 "무엇을 캐느냐는 데이터의 몫"이 여기서 결실을 맺죠.

이렇게 출력 버퍼에 쌓인 아이템 — 그게 [11편](/blog/factory-sim/11-conveyor-path-build)에서 컨베이어가 `SourceMachine`의 출력에서 *당겨가던* 바로 그 버퍼입니다. 채굴기가 채우고, 컨베이어가 빼가요. 1절에서 거슬러 올라갔던 사슬의 맨 끝 — "출력은 누가 채웠나"의 답이 이 `AddOutputItem` 한 줄입니다.

> **솔직한 이음매 하나.** 위 채굴 루프를 *처음 켜는* 스위치는 `StartMining`(타이머를 거는 함수)인데 — 지금 C++ 배치 경로는 거기까지 자동으로 잇지 않습니다. 배치 시 Claim·링크까지는 자동인데, 채굴 타이머의 *시동*은 `BlueprintCallable`로 열어둔 채 아직 C++에서 자동 호출하지 않아요. 루프 자체는 완성돼 자기조절(버퍼 만땅·고갈 시 자동 정지)까지 하지만, 그 시동을 *언제* 걸지(배치 즉시냐, 플레이어 토글이냐, 뒤에 올 전력 연결 시점이냐)는 다음 계통과 함께 정할 이음매로 남겨뒀습니다. 7~11편에서도 그랬듯, 아직 안 정한 자리는 정한 척하지 않고 그대로 둡니다.

---

## 6. 마치며 — 출처가 생겼다

이번 편 요약은 셋입니다.

1. **아이템은 채굴기에서 태어난다.** 컨베이어도 가공 머신도 *만들지는* 못한다. 사슬을 거슬러 오르면 광맥에 붙은 채굴기가 자원을 처음 아이템으로 바꿔 출력 버퍼에 내놓고 — 그 버퍼가 11편 컨베이어가 당겨가던 소스다.
2. **선점이 소유를 지킨다.** 한 광맥은 한 채굴기만(`Claim`). 소유자만 풀 수 있고(`Release`), weak 포인터라 채굴기가 비정상 소멸해도 선점이 저절로 풀린다 — 명시 해제와 자동 무효화의 이중 자물쇠다.
3. **배치가 생애를 연다.** 인접 미선점 Ore가 없으면 배치 불가, 배치되면 Claim+링크, 제거되면 Release — 배치와 철거가 대칭으로 광맥을 묶고 푼다. 그 사이 채굴 루프가 광맥을 깎아(`ConsumeResource`) 버퍼에 쌓고(`AddOutputItem`), 아이템 ID는 광맥의 DataTable 행 이름에서 데이터 주도로 정해진다.

11편까지가 아이템을 *나르고 다루는* 얘기였다면, 이번 편은 그 아이템이 *처음 생겨나는* 자리였습니다. 이제 공장엔 출처가 생겼어요 — 광맥에서 솟아 컨베이어를 타고 흐르는 원료.

다음 편은 그 원료가 *바뀌는* 자리입니다. 채굴기가 단순히 "광맥 → 같은 종류 아이템"이었다면, 가공 머신은 "여러 입력 → 다른 출력"이에요. 레시피를 읽고, 입력 버퍼에 재료가 모이길 기다렸다가, 정해진 시간 동안 돌려 전혀 다른 아이템을 내놓는 — 제련과 가공의 계통으로 갑니다. 11편이 남긴 "어떻게 바뀌는지"의 차례죠.

— JJ
