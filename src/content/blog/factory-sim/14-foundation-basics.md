---
title: "공장 시뮬레이션 게임 개발기 Phase 4.1 — 울퉁불퉁한 행성에 평평한 땅을 놓다: Foundation 기초"
description: "13편에서 행성에 지면을 깔았더니, 그 땅이 울퉁불퉁했습니다. 격자도 머신도 컨베이어도 '평평한 바닥'을 전제하는데 행성엔 경사와 구덩이가 있죠. 그래서 평평한 건축 기반 — Foundation이 필요해집니다. 직배치물이 경사면에 묻히던 걸 셀 대표높이를 최악점에서 최고점으로 바꿔 해결하고(단, 구덩이·절벽은 일부러 최악점을 유지), GroundZ 의미가 바뀌었는데 캐시가 안 풀리던 함정을 버전 필드로 막고, Foundation을 1m 단위 N단으로 계단처럼 안착시키고(상면 = 평면+Thickness+N×100), Thickness를 왜 하필 45로 잡았는지(캐릭터 MaxStepHeight)까지. 그리고 다음 편 램프를 위한 회전·셀별 높이 포석. Phase 4 — 건축의 시작."
date: 2026-06-11
category: UE5
series: factory-sim
seriesPart: 14
tags: [UE5, C++, Foundation, 건축, 지형, 좌표계]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 4: 건축 — Foundation**
> - **4.1편: 울퉁불퉁한 행성에 평평한 땅을 놓다 — Foundation 기초** ← 현재 글
> - (이어지는 편: 높이 정책 재설계·램프 — 예정)
>
> *Phase 1 — 그리드 시스템 (1~5편) · Phase 2 — 머신과 컨베이어 (6~11편) · Phase 3 — 생산 (12편) · [막간: 행성 하늘](/blog/factory-sim/13-planet-sky-day-night): [시리즈 전체 보기 →](/blog/series/factory-sim)*

## 1. 들어가며 — 땅이 울퉁불퉁하다

[13편](/blog/factory-sim/13-planet-sky-day-night)에서 행성에 지면을 깔았습니다. 눈 덮인 봉우리와 완만한 흙바닥 — 그럴듯한 풍경이 생겼죠. 그런데 그 풍경이 *문제*였어요. 풍경이라는 건 곧 **울퉁불퉁하다**는 뜻이거든요.

1편부터 12편까지 격자 위에 쌓아온 모든 것 — 그리드 셀, 머신, 컨베이어 — 은 사실상 **평평한 바닥**을 전제합니다. 셀은 같은 높이의 평면에 박혀 있고, 머신은 그 위에 똑바로 서고, 컨베이어는 수평으로 흐르죠. 그런데 행성엔 경사가 있고 구덩이가 있고 절벽이 있어요. 평평한 전제와 울퉁불퉁한 현실이 부딪힙니다.

이 충돌을 푸는 표준 답이 자동화 시뮬레이션 장르엔 이미 있어요 — **Foundation(토대).** 새티스팩토리를 해봤다면 알 그것, 지형이 어떻든 그 위에 *평평한 인공 바닥*을 깔고 공장은 그 위에 짓는 거죠. 이번 Phase 4는 그 Foundation을 만드는 이야기고, 이번 편은 그 *기초* — 직배치물이 지형에 묻히는 문제부터, Foundation을 경사지에 계단처럼 안착시키는 높이 스냅까지입니다.

순서대로 가요. 먼저 **묻히는 문제**, 다음 Foundation의 **두께**, 그리고 **계단식 안착**.

---

## 2. 묻히는 문제 — 최악점에서 최고점으로

Foundation을 만들기 전에, 더 근본적인 버그가 있었습니다. 지형 위에 머신을 직접 놓으면(직배치) **그게 땅에 묻혔어요.**

원인은 "셀의 대표 높이를 무엇으로 잡느냐"였습니다. 그리드는 각 셀의 지형 높이를 미리 구워(bake) 두는데 — 셀 하나도 실은 평평하지 않아서, 다섯 점을 샘플해 대표값 하나로 압축합니다. 그동안 그 대표값은 **최악점**(평면에서 가장 멀리 어긋난 점)이었어요. 분류(여기 지을 수 있나)엔 이게 안전합니다. 그런데 *안착 높이*로 쓰면 — 셀 안에서 가장 *낮은* 쪽을 기준으로 액터를 앉히니, 그보다 높은 지형이 액터를 뚫고 올라와 묻혀버린 거죠.

해결은 대표값을 **최고점**으로 바꾸는 것이었습니다. 안착 면을 셀 안 지형의 *가장 높은* 점에 맞추면, 어떤 지형도 그 위로 솟지 못하니 묻힘이 0이 돼요. 직배치 Z를 정하는 `OJJ_GetUniformSurfaceZ`의 지형 경로가 그렇게 바뀝니다.

```cpp
bool AOJJ_Grid::OJJ_GetUniformSurfaceZ(const TArray<FIntPoint>& Cells, float& OutZ) const
{
    // ... (전 셀이 같은 면인지 검사 — Foundation/지형 혼합 걸침 거부, 일부 생략) ...

    // 지형 경로(F2-1): GroundZ 유효 시 풋프린트 최고 셀에 안착. 무효(미베이크)면 평면 폴백(회귀 0).
    if (OJJ_HasValidGroundZData())
    {
        float MaxDelta = -TNumericLimits<float>::Max();
        bool bAllCellsInGrid = true;   // off-grid 포함 풋프린트는 평면 폴백(방어)
        for (const FIntPoint& Cell : Cells)
        {
            if (!IsValidGridCell(Cell)) { bAllCellsInGrid = false; break; }
            MaxDelta = FMath::Max(MaxDelta, (float)CellGroundZQuant[OJJ_CellLinearIndex(Cell, GridSize)]);
        }
        if (bAllCellsInGrid) { OutZ = GetActorLocation().Z + MaxDelta; }
    }
    return true;
}
```

풋프린트(여러 셀에 걸친 물체면 그 셀 전부)의 GroundZ 중 `MaxDelta`(최고점)를 골라 거기에 안착시킵니다. 머신의 BaseZ도, 컨베이어의 경로 높이도 전부 이 함수를 거치니 **소비처 코드를 한 줄도 안 고치고** 묻힘이 사라졌어요.

> **일부러 안 바꾼 것 하나.** 대표값을 최고점으로 바꾼 건 *안착 높이*뿐입니다. "여기 지을 수 있나"를 가르는 **분류 기준은 최악점 그대로** 뒀어요. 왜냐면 구덩이나 절벽 끝 셀을 최고점으로 판정하면 *지을 수 있는 땅*으로 풀려버리고, 그럼 액터가 셀 한쪽 허공에 걸치거든요. 묻힘을 없애려다 *떠 있음*을 만드는 거죠. 그래서 같은 셀이 분류엔 최악점, 안착엔 최고점이라는 *이중 기준*을 씁니다 — 둘은 목적이 다르니까요.

> **숨은 함정 — 캐시가 안 풀린다.** 이걸 바꾸고 잠깐 헤맸어요. GroundZ 값의 *의미*가 최악점→최고점으로 바뀌었는데, 캐시 무효화 시그니처(셀 크기·톨러런스·원점)는 *그대로*였습니다. 그래서 옛 맵을 열면 *예전 의미로 구운 캐시*를 그대로 들고 와 새 코드가 헌 데이터를 먹는 — 조용한 불일치가 났죠. 파라미터가 같아도 *산식*이 바뀌면 캐시를 깨야 합니다. 그래서 시그니처에 `CacheBakeVersion`이라는 버전 정수 한 칸을 새로 박았어요. 산식을 바꿀 때마다 이 숫자를 올리면, 옛 캐시를 든 맵이 자동으로 재베이크를 타게 됩니다.

---

## 3. Foundation의 두께 — 왜 하필 45인가

묻힘을 잡았으니 이제 진짜 Foundation입니다. Foundation은 단순한 슬래브(평판)예요 — 평면 위에 일정 두께(`Thickness`)로 깔리는 인공 바닥. 그 위에 머신을 짓고요.

문제는 그 *두께*를 얼마로 잡느냐였어요. 처음엔 50으로 했다가 45로 내렸는데, 이게 그냥 취향이 아니라 **걸을 수 있느냐**의 문제였습니다.

UE의 캐릭터 무브먼트엔 `MaxStepHeight`라는 값이 있어요 — 걸어서 오를 수 있는 턱의 최대 높이, 기본값 **45**. 평지에서 Foundation으로 걸어 올라가려면 그 턱(=Thickness)이 45 이하여야 합니다. 두께 50이면 캐릭터가 *Foundation 위로 못 올라가요* — 보이지 않는 벽이 되는 거죠. 그래서 `Thickness = 45`로 못박았습니다. 캐릭터가 평지에서 Foundation으로 자연스럽게 걸어 오를 수 있는 정확한 상한이에요.

> 비슷하게 **톨러런스도 실측으로 정했습니다.** "이 정도 경사까진 평평한 셈 치고 지을 수 있다"는 허용 오차(`BuildableHeightTolerance`)를 50에서 100으로 올렸는데, 근거는 감이 아니라 숫자였어요 — 실제 행성 맵에서 buildable 셀이 tol 50이면 9.1%, tol 100이면 18.3%로 **딱 2배**가 됐고, PIE에서 그때 생기는 뜸(최대 ~100uu)이 눈에 거슬리지 않는 걸 확인하고 100으로 확정했습니다.

---

## 4. 계단처럼 안착 — 1m 단위 N단 높이 스냅

이제 핵심. Foundation을 *경사지*에 놓으면 어떻게 될까요? 그냥 평면 높이에 깔면 경사 위쪽 지형에 묻히고, 경사 아래쪽엔 떠요. 그렇다고 지형을 그대로 따라 기울이면 그건 더 이상 *평평한 바닥*이 아니죠.

답은 **계단**입니다. Foundation 상면을 지형에 연속적으로 맞추는 대신, **1m(100uu) 단위의 단(段)** 으로 띄엄띄엄 끊어 올리는 거예요. 경사를 오를수록 Foundation이 한 단씩 계단처럼 높아지되, 각 Foundation의 윗면은 *완벽히 평평*하게. 이 단 수 N을 계산하는 게 `OJJ_ComputeFoundationSnapLift`입니다.

```cpp
float AOJJ_Grid::OJJ_ComputeFoundationSnapLift(FIntPoint Origin, FIntPoint Size, float Thickness) const
{
    // ... (GroundZ 유효성 검사 + 풋프린트가 전부 그리드 안인지 방어, 일부 생략) ...

    // 풋프린트 안에서 가장 높은 지형점을 찾는다.
    float MaxGroundZ = -TNumericLimits<float>::Max();
    for (int32 X = IterMinX; X < IterEndX; ++X)
    {
        for (int32 Y = IterMinY; Y < IterEndY; ++Y)
        {
            float Delta = 0.0f;
            if (GetCellGroundZ(FIntPoint(X, Y), Delta))
            {
                MaxGroundZ = FMath::Max(MaxGroundZ, Delta);
            }
        }
    }

    // N = ceil((max GroundZ − Thickness) / 100) clamp ≥0. 경계: max == Thickness+k×100이면
    // 상면이 지형 최고점에 정확히 접함(N=k) — "이상" 조건 충족이라 다음 단으로 올리지 않음.
    const int32 SnapSteps = FMath::Max(0, FMath::CeilToInt((MaxGroundZ - Thickness) / OJJ_FoundationSnapStep));
    return SnapSteps * OJJ_FoundationSnapStep;
}
```

수식 한 줄이 전부예요. 상면 높이는 `평면 + Thickness + N×100`이 되고, `N = ceil((풋프린트 최고 지형점 − Thickness) / 100)`을 0 이상으로 clamp합니다. `ceil`(올림)이 핵심 — 상면이 *항상* 지형 최고점 **이상**이 되도록 보장해서 묻힘을 0으로, 그러면서 초과분은 100 미만으로 묶어요. 평탄한 땅에선 `N=0`이라 예전(Foundation 없던 시절)과 똑같이 동작하니 회귀도 0이고요.

그리고 이 설계의 묘미는 **책임 분담**입니다. 그리드는 "몇 단 올려야 하는지"(`N×100`)만 *계산*해서 돌려주고, 액터를 실제로 그만큼 *들어 올리는* 건 빌드 컨트롤러의 몫이에요. 컨트롤러는 배치 위치 Z에 이 리프트를 더하고 Foundation을 통째로 올린 뒤, 저장할 `SurfaceZ`를 `스냅 Z + Thickness`로 넘깁니다. `TryPlaceFoundation`의 시그니처는 *건드리지 않아요* — 원래부터 임의의 SurfaceZ를 받게 돼 있었으니까. 데이터·좌표 계산은 그리드, 액터 이동은 컨트롤러 — 시리즈 내내 지켜온 그 경계가 여기서도 유지됩니다.

---

## 5. 공짜로 얻은 것 — 단차 걸침은 이미 거부된다

높이 스냅을 넣고 나니, *공짜로 따라온* 동작이 하나 있었어요. **서로 다른 단에 걸친 배치는 자동으로 거부됩니다.**

[8편](/blog/factory-sim/08-conveyor-item-transport)·[11편](/blog/factory-sim/11-conveyor-path-build)에서 컨베이어를 깔 때 쓴 그 `OJJ_GetUniformSurfaceZ` — "전 셀이 *같은 높이의 면*이어야 한다"는 규칙 기억하시나요? 2절에서 본 그 함수입니다. 이 규칙이 N단 Foundation을 *그냥* 처리해요. 머신이나 컨베이어가 N=2단 Foundation과 N=3단 Foundation에 걸쳐 놓이려 하면, 두 셀의 저장된 SurfaceZ가 다르니(`100uu` 차이) 함수가 `false`를 뱉고 배치가 막힙니다. 단을 위한 새 코드를 한 줄도 안 짰는데, 기존 "이높이 면 거부" 규칙이 단차를 알아서 거부하는 거죠.

```cpp
// 혼합(지형+Foundation) 또는 이높이 Foundation = 경계 걸침 → 거부.
if (bCellOnFoundation != bOnFoundation
    || (bCellOnFoundation && !FMath::IsNearlyEqual(CellSurfaceZ, SurfaceZ)))
{
    return false;
}
```

[4편](/blog/factory-sim/04-mouse-input-build-controller)·[7편](/blog/factory-sim/07-port-cell-unification)에서 단일 진실원(single source of truth)을 고집했던 게 여기서 이자를 붙여 돌아옵니다. 면 높이를 한 곳에서만 판정하니, 그 한 곳을 안 고쳐도 새로운 상황(N단)이 *옳게* 처리돼요.

> **여기서 멈춘 자리.** 다만 이건 단차를 *거부*하는 것뿐입니다. 단과 단 *사이를 연결*하는 — 경사로 물건을 올려보내거나 캐릭터가 단을 걸어 오르는 — 수단은 아직 없어요. PIE로 검증해보니 바로 이 "단 사이 물류 연결의 부재"가 다음 병목으로 드러났습니다. 그게 다음 편의 주제예요(램프). 지금은 *걸침을 막는* 데까지가 이번 편의 선입니다.

---

## 6. 다음을 위한 포석 — 회전과 셀별 높이

이번 편 막바지는 *당장 눈에 보이진 않지만* 다음 편(램프)을 위해 깔아둔 두 가지 인프라입니다. 지금은 정사각 평판만 있어서 효과가 안 드러나지만, 비정사각·방향성을 가진 램프가 들어오면 비로소 쓰여요.

**하나, 회전.** Foundation도 R키로 90°씩 돌 수 있게 했습니다. 머신 회전과 똑같은 규칙을 따라요 — 회전 단계가 홀수면 풋프린트의 X/Y를 스왑한 `EffSize`(유효 크기)를 쓰고, 액터엔 `yaw = 90°×단계`를 줍니다. 지금의 8×8 정사각 평판은 X/Y를 스왑해도 같은 모양이라 *시각적으로 회귀 0*이지만, 다음 편의 램프는 "어느 방향으로 기우느냐"가 있으니 이 회전이 그때 의미를 갖습니다.

**둘, 셀별 높이.** 지금까진 Foundation 하나가 *단일 SurfaceZ* 하나를 가졌어요(상면이 평평하니까). 그런데 램프는 셀마다 높이가 달라야 합니다. 그래서 배치 검증·등록 경로를 *셀별 배열*도 받을 수 있게 일반화했어요. 단일값 경로는 "모든 셀이 같은 값"인 특수 케이스로 흡수하고요.

```cpp
bool AOJJ_Grid::TryPlaceFoundation(AActor* Foundation, FIntPoint Origin, FIntPoint Size, float SurfaceZ, FString& OutReason)
{
    // 단일값 = 전 셀 동일 — 검증/커밋은 내부 단일원에 위임(F3-1). 배열 미경유라 할당 0(기존과 동일).
    return OJJ_TryPlaceFoundationInternal(
        Foundation, Origin, Size,
        [SurfaceZ](FIntPoint) { return SurfaceZ; },   // 모든 셀에 같은 값을 주는 람다
        OutReason);
}
```

핵심은 `TFunctionRef`로 "셀 → 높이" 함수를 주입하는 구조예요. 단일값이면 *상수 람다*를, 램프면 *셀별 배열을 읽는 람다*를 넘기면 됩니다. 그리고 셀별 배열을 받을 땐 불변식을 검사해요 — 모든 값이 유한한지, 그리고 (최댓값 − 최솟값)이 단 간격(100)의 *정수배*인지. 액터가 넘긴 배열을 곧이곧대로 믿지 않고, 그리드가 *단 격자 정합*을 한 번 더 검증하는 거죠. 이 등록 API가 다음 편 램프의 토대입니다.

---

## 7. 마치며 — 평평한 땅이 생겼다

이번 편 요약은 셋입니다.

1. **묻힘은 최고점이 푼다.** 셀 대표높이를 최악점→최고점으로 바꿔 직배치 묻힘을 0으로. 단, 구덩이·절벽이 *지을 수 있는 땅*으로 풀리지 않게 **분류는 최악점을 일부러 유지**했고, GroundZ 의미가 바뀐 옛 캐시를 `CacheBakeVersion`으로 자동 무효화했다.
2. **Foundation은 45만큼 두껍고, 단으로 오른다.** 두께는 캐릭터가 걸어 오를 수 있는 `MaxStepHeight`(45)에 맞췄고, 경사지엔 상면 = `평면+Thickness+N×100`으로 계단처럼 안착시켜(`N=ceil((maxGroundZ−Thickness)/100)`) 묻힘 0·초과<100을 보장했다.
3. **단차 거부는 공짜였다.** 기존 "이높이 면 거부" 규칙이 다른 단 걸침을 자동으로 막았다 — 단일 진실원을 고집한 보상. 그리고 회전·셀별 높이 등록 API를 다음 편 램프를 위해 미리 깔았다.

12편까지가 *격자 위의 시스템*, 13편이 *그 격자가 올라앉을 행성*이었다면, 이번 편은 그 울퉁불퉁한 행성 위에 다시 **평평한 인공 바닥**을 까는 일이었습니다. 이제 경사지에도 공장을 지을 수 있어요 — 단, 한 단 안에서만.

다음 편은 그 *한계*를 넘습니다. 이번 편의 N단 높이 스냅은 사실 곧바로 다시 도마에 올랐어요 — "지형에 스냅"하는 방식이 새티스팩토리처럼 자연스럽지 않아서, 높이 정책을 **이웃 Foundation의 높이를 상속**하는 쪽으로 갈아엎게 됩니다. 그리고 5절에서 *거부*만 했던 단과 단 사이를 잇는 **램프 Foundation** 까지. 건축의 두 번째 이야기로 이어집니다.

<!-- TODO: 스크린샷 — 경사지에 계단처럼 N단으로 안착한 Foundation들 (hero 후보) -->
<!-- TODO: 스크린샷 — (좌) 직배치 묻힘 버그 / (우) 최고점 전환 후 안착 비교 -->
<!-- TODO: 스크린샷 — 평지에서 Foundation 위로 걸어 올라가는 캐릭터 (Thickness 45) -->

— JJ
