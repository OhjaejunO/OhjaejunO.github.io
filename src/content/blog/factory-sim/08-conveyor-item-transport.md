---
title: "공장 시뮬레이션 게임 개발기 Phase 2.3 — 컨베이어가 아이템을 나르는 법: 이산 슬롯과 풀(pull) 모델"
description: "컨베이어가 출력 포트에서 입력 포트로 아이템을 실어 나르는 이동 모델 기록. 매 프레임 위치를 더하는 연속 이동 대신, 칸 = 슬롯으로 쪼갠 이산 모델을 골랐다. 끝에서부터 당기는(pull) 한 틱과, '빈 슬롯이 있을 때만 당긴다'는 한 줄이 어떻게 별도 코드 없이 자연스러운 정체(backpressure)를 만드는지."
date: 2026-06-08
category: UE5
series: factory-sim
seriesPart: 8
tags: [UE5, C++, 컨베이어, 자동화, 시뮬레이션, backpressure]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 2: 머신 시스템**
> - 6편: [AI 생성 3D 에셋 파이프라인](/blog/factory-sim/06-meshy-glb-asset-pipeline)
> - 7편: [포트 셀 일원화 — 화살표·도킹·그래프를 하나의 진실로](/blog/factory-sim/07-port-cell-unification)
> - **8편: 컨베이어가 아이템을 나르는 법 — 이산 슬롯과 풀(pull) 모델** ← 현재 글
> - (이어지는 편: 컨베이어 시각 보간 / 경로 빌드 — 예정)
>
> *Phase 1 — 그리드 시스템: [1편](/blog/factory-sim/01-grid-system-overview) · [2편](/blog/factory-sim/02-grid-data-structure-and-transaction) · [3편](/blog/factory-sim/03-material-grid-visualization) · [4편](/blog/factory-sim/04-mouse-input-build-controller) · [5편](/blog/factory-sim/05-codex-adversarial-review)*

## 1. 들어가며 — 흐름을 어떻게 모델링할까

[7편](/blog/factory-sim/07-port-cell-unification)에서 머신의 입력·출력 **포트**를 한 함수로 모았습니다. "보이는 화살표 = 붙는 컨베이어"를 보장하는 단계까지 왔죠. 그런데 거기까지는 *연결의 뼈대*일 뿐, 정작 그 위로 자원이 흐르지는 않았어요. 이번 편이 그 흐름입니다 — 출력 포트에서 캔 광석이 컨베이어를 타고 입력 포트로 들어가는, 자동화 장르의 핵심 한 칸.

흐름을 만들려고 처음 떠올린 건 **연속 이동**이었습니다. 아이템마다 위치를 들고, 매 프레임 `위치 += 속도 * DeltaTime`으로 벨트 위를 미끄러뜨리는 방식. 익숙하고 직관적이죠. 그런데 이 게임은 처음부터 **칸(grid) 단위**로 돌아갑니다([2편](/blog/factory-sim/02-grid-data-structure-and-transaction)). 머신도 칸, 포트도 칸, 컨베이어 점유도 칸이에요. 흐름만 연속이면 "이 아이템이 지금 몇 번째 칸에 있나"를 매번 좌표에서 역산해야 하고, 머신에 닿는 판정도 부동소수점 경계에서 흔들립니다.

그래서 **이산(discrete) 슬롯 모델**로 갔습니다. 벨트를 칸으로 쪼개 한 칸을 한 슬롯으로 보고, 아이템은 *틱마다 한 칸씩* 점프하듯 전진해요. 시뮬레이션은 정수 인덱스 위에서만 돌아가니 머신 도착 판정이 깔끔하고, "막힘"도 슬롯이 비었나 아니냐로 단순해집니다. (눈에는 뚝뚝 끊겨 보일 텐데, 그 사이를 부드럽게 메우는 *시각 보간*은 시뮬레이션과 분리해서 다음 편에 따로 다룹니다. 이번 편은 **시뮬레이션 모델**에만 집중해요.)

---

## 2. 양 끝을 머신에 묶기 — 컨베이어는 두 머신을 잇는다

이동 얘기를 하기 전에, 컨베이어가 *어디서 어디로* 나르는지부터. 컨베이어는 허공에 혼자 못 놓습니다. 배치할 때 경로의 **양 끝이 머신 포트에 닿아야** 하고(7편의 그 포트 셀), 거기서 **소스 머신**(출력을 내보내는 쪽)과 **타깃 머신**(입력을 받는 쪽)이 정해져요. 그리드의 배치 함수가 이 둘을 못 찾으면 배치 자체를 거부합니다.

```cpp
if (!SourceMachine || !TargetMachine)
{
    OutReason = TEXT("Conveyor item transfer requires valid machine endpoints.");
    return false;
}
// ... 셀 등록 후
Conveyor->ConfigureTransport(ReservedCells, SourceMachine, TargetMachine);
```

`ConfigureTransport`가 이번 편의 출발점입니다. 점유 셀 목록과 양끝 머신을 컨베이어에 박아넣고, 슬롯을 초기화하고, 이동 타이머를 켜요.

```cpp
void AConveyor::ConfigureTransport(
    const TArray<FIntPoint>& NewOccupiedGridCells,
    AMachineBase* NewSourceMachine,
    AMachineBase* NewTargetMachine)
{
    OccupiedGridCells = /* NewOccupiedGridCells 중복 제거 복사 */;
    SourceMachine = NewSourceMachine;
    TargetMachine = NewTargetMachine;
    ResetItemSlots();        // 슬롯을 점유 칸 수만큼, 전부 비움
    RestartItemMoveTimer();  // SecondsPerGrid 간격 반복 타이머
    // ... 디버그 텍스트/매니저 통지 생략
}
```

여기서 두 가지가 정해집니다. **(1)** 컨베이어가 나를 자원의 출처와 목적지(`SourceMachine`/`TargetMachine`). **(2)** 벨트의 길이 — `OccupiedGridCells`의 칸 수가 곧 슬롯 수예요. 이 두 개가 다음 절들의 무대 전부입니다.

> 경로를 *어떻게* 깔고 어느 셀을 점유로 잡는지(코너·교차·예약 셀 수집)는 그 자체로 한 편 분량이라 후속편으로 미룹니다. 이번 편은 "양끝 머신이 정해졌다"는 결과만 갖고 출발해요.

---

## 3. 슬롯 모델 — 칸 하나가 슬롯 하나

`ResetItemSlots`가 만드는 건 단순합니다. 점유 칸 수만큼의 배열, 전부 "비어 있음"(`NAME_None`).

```cpp
void AConveyor::ResetItemSlots()
{
    ItemSlots.SetNum(OccupiedGridCells.Num());
    for (FName& ItemSlot : ItemSlots)
    {
        ItemSlot = NAME_None;
    }
    // ... 시각용 ID 배열 초기화는 다음 편
}
```

`ItemSlots`는 `TArray<FName>`이에요. 각 칸에 든 아이템을 **아이템 ID(`FName`) 하나**로만 표현합니다. 무게도, 좌표도, 개체 액터도 없어요. 인덱스 `0`이 소스(들어오는) 쪽 끝, 마지막 인덱스가 타깃(나가는) 쪽 끝. 슬롯 사이를 아이템이 한 칸씩 이동하는 게 전부입니다.

전진은 **타이머**가 굴립니다. `RestartItemMoveTimer`가 `SecondsPerGrid`(기본 1초) 간격으로 `MoveItemsOneGrid`를 반복 호출해요. 단, 자동 이동이 켜져 있고(`bAutoMoveItems`) 슬롯이 있고 **양끝 머신이 둘 다 유효할 때만** 타이머가 돕니다. 한쪽이라도 없으면 벨트는 그냥 멈춰 있어요 — 나를 곳도 받을 곳도 없으니까.

```cpp
void AConveyor::RestartItemMoveTimer()
{
    StopItemMoveTimer();
    if (!bAutoMoveItems || ItemSlots.Num() == 0
        || !SourceMachine.IsValid() || !TargetMachine.IsValid())
    {
        return;  // 조건 미충족 → 타이머 안 돎
    }
    // SecondsPerGrid(최소 0.01s) 간격으로 MoveItemsOneGrid 반복
    World->GetTimerManager().SetTimer(
        ItemMoveTimerHandle, this, &AConveyor::MoveItemsOneGrid,
        FMath::Max(0.01f, SecondsPerGrid), /*bLoop=*/true);
}
```

---

## 4. 핵심 — 한 틱은 "배출 → 시프트 → 인입"

이 게임의 컨베이어가 한 틱에 하는 일은 딱 세 단계입니다. **끝에서부터 당긴다**가 전체를 관통하는 한 문장이에요.

```cpp
void AConveyor::MoveItemsOneGrid()
{
    // (앞쪽 가드와 '이전 상태 스냅샷'은 생략 — 스냅샷은 시각 보간용이라 다음 편)

    // 1) 끝 슬롯 → 타깃 머신으로 배출 (받아줄 때만)
    const int32 LastIndex = ItemSlots.Num() - 1;
    const FName LastItem = ItemSlots[LastIndex];
    if (!LastItem.IsNone())
    {
        if (TargetMachine->CanReceiveConveyorItem(LastItem, 1))
        {
            if (TargetMachine->ReceiveConveyorItem(LastItem, 1))
            {
                ItemSlots[LastIndex] = NAME_None;   // 넘겼으니 비운다
            }
        }
    }

    // 2) 슬롯 전체를 끝쪽으로 한 칸 시프트 (빈 칸이 있을 때만 당긴다)
    for (int32 Index = LastIndex; Index > 0; --Index)
    {
        if (ItemSlots[Index].IsNone() && !ItemSlots[Index - 1].IsNone())
        {
            ItemSlots[Index] = ItemSlots[Index - 1];
            ItemSlots[Index - 1] = NAME_None;
        }
    }

    // 3) 시작 슬롯 ← 소스 머신에서 인입
    if (ItemSlots[0].IsNone())
    {
        FName NewItem = NAME_None;
        if (SourceMachine->TryTakeFirstOutputItem(NewItem))
        {
            ItemSlots[0] = NewItem;
        }
    }
}
```

> 실제 코드에는 각 슬롯 이동과 짝지어 `ItemVisualIds`(시각 인스턴스 추적용 ID)도 같이 옮기는 줄들이 있는데, 순수하게 *보여주기* 용이라 위에선 생략했습니다. 시뮬레이션 로직 자체는 위 세 단계가 전부예요.

읽는 순서대로 짚으면:

- **배출(끝).** 마지막 슬롯에 아이템이 있고 타깃 머신이 받을 수 있으면 넘기고, 그 슬롯을 비웁니다. `CanReceiveConveyorItem`으로 먼저 묻고 `ReceiveConveyorItem`으로 실제로 넘긴 다음, *성공했을 때만* 슬롯을 비우는 게 포인트예요 — 받기로 해놓고 못 받으면 아이템이 증발하니까.
- **시프트(중간).** 끝에서부터 0번 쪽으로 훑으면서, **빈 슬롯 바로 뒤(0번 쪽)에 아이템이 있으면** 한 칸 끌어옵니다. 끝→앞 방향으로 한 번만 훑기 때문에 한 틱에 각 아이템은 정확히 한 칸만 전진해요.
- **인입(시작).** 0번 슬롯이 비었으면 소스 머신의 출력 버퍼에서 하나 꺼내(`TryTakeFirstOutputItem`) 채웁니다.

한 틱에 타깃으로 **최대 1개** 배출, 소스에서 **최대 1개** 인입. 그래서 이 벨트의 최대 처리량은 `1아이템 / SecondsPerGrid`로 딱 떨어집니다. 한 아이템이 벨트를 끝까지 통과하는 시간은 `칸 수 × SecondsPerGrid`고요(`GetTravelTimePerItem`).

---

## 5. 막히면 알아서 쌓인다 — backpressure가 공짜인 이유

자동화 게임에서 제일 자주 보는 장면이 *정체*입니다. 제련기가 바빠서 광석을 못 받으면, 그 앞 컨베이어에 광석이 줄줄이 밀려 쌓이는 그림. 보통 이런 걸 구현하려면 "막힘 신호를 뒤로 전파"하는 로직을 따로 짭니다. 그런데 위 4절 코드에는 그런 게 **없어요**. 그런데도 정체가 됩니다. 왜냐하면 시프트 조건이 단 하나 — **"바로 앞 칸(끝쪽)이 비었을 때만 당긴다"** — 이기 때문이에요.

타깃이 막힌 경우를 한 틱 따라가 보면 분명합니다. 벨트가 `[A, B, C]`로 꽉 찼고 타깃이 `C`를 못 받는 상황:

```
1) 배출: CanReceive=false → C 그대로.        [A, B, C]
2) 시프트: 끝(2번)이 안 비었으니 1번도 못 옴.   [A, B, C]
          (모든 칸이 차 있어 당길 빈칸이 없음)
3) 인입: 0번이 안 비었으니 소스에서 안 꺼냄.    [A, B, C]
```

세 단계 모두 *아무 일도 안 일어납니다.* 끝이 안 비니 시프트가 연쇄적으로 막히고, 그게 0번까지 닿아 소스 인입도 자동으로 멈춰요. 막힘이 뒤로 *전파되는 게 아니라*, 애초에 "빈칸 없으면 안 움직인다"는 규칙에서 정체가 **그냥 따라 나오는** 겁니다. 타깃이 다시 받기 시작하면 끝이 비고, 다음 틱부터 시프트가 풀리면서 벨트가 도로 흐르고요.

반쯤 빈 벨트라면 빈칸이 채워질 때까지는 인입이 계속되다가, 꽉 차는 순간 위 상태로 수렴합니다. 즉 **벨트는 용량까지 채운 뒤 알아서 멈춘다.** 딱 원하던 동작이에요.

이 "막혔나"를 밖에서 물어볼 수 있게 한 줄짜리 질의도 있습니다. 디버그 표시나 상위 로직이 쓰는 `IsOutputBlocked`:

```cpp
bool AConveyor::IsOutputBlocked() const
{
    if (ItemSlots.Num() == 0) { return false; }
    const FName LastItem = ItemSlots.Last();
    return !LastItem.IsNone()
        && (!TargetMachine.IsValid() || !TargetMachine->CanReceiveConveyorItem(LastItem, 1));
}
```

끝 슬롯에 아이템이 있는데 타깃이 (사라졌거나) 못 받으면 "막힘". 이동 로직과 *같은 판정*(`CanReceiveConveyorItem`)을 쓰니, 표시되는 "blocked"와 실제로 안 흐르는 상태가 어긋나지 않아요 — 7편에서 반복한 "같은 걸 두 번 계산하지 말자"가 여기서도 그대로입니다.

---

## 6. 컨베이어는 아이템이 뭔지 모른다 — 머신과의 분리

4절에서 컨베이어가 머신을 건드린 통로는 딱 세 개였습니다. 이게 컨베이어와 머신을 갈라놓는 **계약(interface)**이에요. `AMachineBase`에 정의돼 있고, 셋 다 `virtual`이라 머신 종류마다 다르게 구현합니다.

```cpp
// 소스 쪽: 출력 버퍼에서 하나 꺼내기
bool AMachineBase::TryTakeFirstOutputItem(FName& OutItemID)
{
    if (!PeekFirstOutputItem(OutItemID)) { return false; }   // 있나 보고
    if (!TakeOutputItem(OutItemID, 1))   { OutItemID = NAME_None; return false; }  // 실제로 빼고
    return true;
}

// 타깃 쪽: 받을 수 있나 / 실제로 받기
bool AMachineBase::CanReceiveConveyorItem(FName ItemID, int32 Count) const
{
    return CanAddInputItem(ItemID, Count);   // 입력 버퍼에 자리·종류 맞나
}
bool AMachineBase::ReceiveConveyorItem(FName ItemID, int32 Count)
{
    return AddItem(ItemID, Count);           // 입력 버퍼에 넣기 (디버그 텍스트 갱신 한 줄 생략)
}
```

컨베이어는 이 세 함수 너머를 *모릅니다.* 옮기는 게 광석인지 철판인지, 받는 게 제련기인지 창고인지 관심 없어요. 그냥 `FName` 하나를 끝까지 밀 뿐. 그래서 제련기·분쇄기·창고 포트처럼 성격이 전혀 다른 머신들이 이 세 함수만 각자 구현하면, 같은 컨베이어 코드가 전부와 맞물립니다. "받을 수 있나"의 *판단*은 머신이, "한 칸씩 민다"의 *운반*은 컨베이어가 — 책임이 깔끔하게 갈리죠.

이 분리가 4·5절의 단순함을 떠받칩니다. 컨베이어가 머신 내부 버퍼 사정을 알았다면, 막힘 판정이며 종류별 예외가 죄다 이동 루프 안으로 새어 들어왔을 거예요. 계약을 세 줄로 좁혀둔 덕에 `MoveItemsOneGrid`가 "배출·시프트·인입" 세 단계로 끝납니다.

---

## 7. 마치며

이번 편 요약은 셋입니다.

1. **이산 슬롯 모델.** 벨트를 칸으로 쪼개 한 칸을 한 슬롯으로 보고, 아이템(`FName`)이 틱마다 한 칸씩 전진한다. 칸 단위로 도는 게임에 좌표 역산 없이 깔끔하게 맞물린다.
2. **끝에서부터 당기는(pull) 한 틱.** 배출(끝) → 시프트 → 인입(시작). "빈 슬롯이 있을 때만 당긴다"는 조건 하나가, 별도 전파 코드 없이 **자연스러운 정체(backpressure)**를 만든다. 벨트는 용량까지 채우고 알아서 멈춘다.
3. **세 줄짜리 머신 계약.** 컨베이어는 아이템이 뭔지, 머신이 뭔지 모른 채 `FName`만 민다. `TryTakeFirstOutputItem`/`CanReceiveConveyorItem`/`ReceiveConveyorItem` 너머는 머신의 몫 — 운반과 판단의 분리가 이동 루프를 단순하게 지킨다.

이산 모델의 *유일한* 단점은 눈에 뚝뚝 끊겨 보인다는 거예요. 슬롯에서 슬롯으로 순간이동하니까요. 다음 편은 이 끊긴 시뮬레이션을 매 프레임 **부드럽게 보여주는** 이야기입니다 — 시뮬레이션(이산)과 렌더링(연속)을 분리해서, 아이템이 칸 사이를 미끄러지듯 보간하는 방법. "한 칸씩 점프하는 진실"과 "부드럽게 흐르는 그림"을 어떻게 동시에 갖느냐로 가요.

— JJ
