---
title: "공장 시뮬레이션 게임 개발기 — 맵 리워크: 웅덩이를 버리고 진짜 강을 흐르게 하다"
description: "경사 컨베이어를 또 미뤘다. 이번엔 맵을 통째로 갈아엎었기 때문이다. 랜드스케이프를 1/4로 줄이고, 수동 배치 웅덩이 대신 Water 플러그인의 진짜 강을 깔고, 바닥 머티리얼은 에디터 유틸리티 코드로 구워냈다. 그런데 강이 흐르자 그리드가 물을 다시 배워야 했다 — 엔진의 침수 질의는 XY 폭 클램프가 없어서 강 수면보다 낮은 평지 전체를 물로 오판했고, Foundation은 강바닥이 아니라 수면 위에 떠야 했고, 빌드모드 진입 순간 맨땅이 파랗게 물들었다. 스플라인 폭 containment, 수면 델타 SnapLift, 색 규칙 분리로 세 사건을 풀어낸 기록."
date: 2026-07-07
category: UE5
series: factory-sim
seriesPart: 22
tags: [UE5, C++, Landscape, Water, 머티리얼, 그리드]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — 맵 리워크**
> - 16편: [물 시스템 — 다중 셀 수원·공유 펌프·경사 통과 파이프](/blog/factory-sim/16-water-system-pump-pipe)
> - 21편: [로봇 포트레이트 파이프라인 — AI 이미지에서 게임 HUD까지](/blog/factory-sim/21-robot-portrait-pipeline)
> - **22편: 맵 리워크 — 웅덩이를 버리고 진짜 강을 흐르게 하다** ← 현재 글

지난 편 말미에 "이번에야말로 경사 컨베이어"라고 썼다. 또 미룬다. 이번엔 이유가 크다 — **맵을 통째로 갈아엎었기 때문이다.** (경사 컨베이어는 바로 다음 편에 진짜로 온다. 시간상으로는 이 리워크보다 먼저 한 작업이라, 순서만 바꿔 싣는 셈이다.)

---

## 1. 왜 갈아엎었나

기존 `L_Planet`은 세 가지가 마음에 안 들었다.

**지형이 너무 넓었다.** 콘텐츠 밀도에 비해 랜드스케이프가 과하게 커서, 걸어도 걸어도 빈 땅이었다.

**물이 가짜였다.** 16편에서 다뤘던 물은 `AWaterArea` — 수동으로 배치한 반투명 박스에 "이 높이보다 낮으면 물"이라는 높이식 판정을 얹은 웅덩이였다. 돌아는 갔지만, 강이라고 부르기엔 민망했다.

**바닥이 단조로웠다.** 텍스처 한 장이 끝없이 타일링되는 지면은 스크린샷 한 장만 찍어도 반복 무늬가 보였다.

그래서 리워크의 목표를 셋으로 잡았다 — **① 지형 축소 + UE Water 플러그인의 진짜 강(WaterBodyRiver) 도입, ② 멀티레이어 바닥 머티리얼, ③ 그리드 재설정.** 이틀 작업이었고, 이 글의 후반부는 전부 "진짜 강"이 몰고 온 후폭풍이다.

---

## 2. 리워크 본체 — 백업부터 그리드 재설정까지

순서는 보수적으로 갔다. 먼저 리워크 전 `L_Planet`을 백업 커밋으로 박아 두고(되돌릴 안전장치), 엔진 Water/Landmass 플러그인을 활성화하고, 메가스캔 지면 텍스처를 임포트한 뒤에야 맵에 손을 댔다.

- **랜드스케이프 1/4 축소** — `.umap` 용량이 7,540,387 → 6,156,206 bytes로 줄었다. 지형이 줄어든 게 파일 크기로 보인다.
- **Water Body River 배치** — 스플라인을 따라 흐르는 진짜 강. 웅덩이 시절과 달리 폭이 구간마다 다르고, 수면 높이도 스플라인이 정의한다.
- **그리드 재설정** — 센터 `(-12600, 12600)`, 크기 **756 × 756 = 571,536셀**, 그리드 평면 Z `+100`. 16편에서 300→1008로 키웠던 그리드를, 줄어든 지형에 맞춰 756²로 다시 조정한 것이다. 베이크 캐시도 강제 재생성.

여기까지는 에디터 작업이다. 코드가 등장하는 건 다음 장부터다.

---

## 3. 바닥 머티리얼을 코드로 굽다

멀티레이어 랜드스케이프 머티리얼은 보통 머티리얼 에디터에서 노드를 손으로 잇는다. 이번엔 에디터 유틸리티 `UOJJ_LandscapeMaterialFactory`를 만들어 **머티리얼 그래프 자체를 코드로 생성**했다. 지면 레이어와 자갈 레이어를 `LandscapeLayerBlend`로 섞고, 파라미터(NormalIntensity 2.0, MacroVariationAmount 0.4 등)를 인스턴스로 노출하는 구조다.

기술적 하이라이트는 **타일 반복 깨기**다. 같은 텍스처를 서로 다른 두 스케일의 UV로 두 번 샘플해서 절반씩 섞으면, 비정수배(DetailScaleRatio 0.37)로 어긋난 두 무늬가 격자 반복을 시각적으로 지워 준다.

```cpp
// 멀티 스케일 샘플: 같은 텍스처를 UV1/UV2(다른 크기)로 2번 샘플 → Lerp(0.5).
// 비정수배 스케일로 두 무늬가 어긋나 격자 반복이 시각적으로 사라진다. 매크로 베리에이션(밝기)과 보완.
UMaterialExpression* SampleMultiScale(UMaterial* Mat, UTexture* Tex, EMaterialSamplerType SType,
    UMaterialExpression* UV1, UMaterialExpression* UV2, int32 X, int32 Y)
{
    UMaterialExpressionTextureSample* S1 = Sample(Mat, Tex, SType, UV1, X, Y);
    UMaterialExpressionTextureSample* S2 = Sample(Mat, Tex, SType, UV2, X, Y + 130);
    UMaterialExpressionLinearInterpolate* L = LSMakeExpr<UMaterialExpressionLinearInterpolate>(Mat, X + 220, Y + 60);
    LSConn(L->A, S1); LSConn(L->B, S2); L->ConstAlpha = 0.5f;
    return L;
}
```

단, **노멀맵만은 이 트릭에서 제외**했다. 처음엔 노멀도 두 스케일로 섞었다가 지면이 이상하게 밋밋해졌는데, 이유가 명확했다 —

```cpp
//  BaseColor/ORM = 멀티 스케일(타일 반복 깨기, 평균해도 무해).
//  ⚠️ Normal = 단일 스케일(UV1)! 서로 다른 스케일 노멀을 Lerp 평균하면 xy 섭동이 상쇄돼 평탄화됨 → 입체감 소실.
//     노멀은 벡터라 BaseColor와 블렌드 방식이 다름. 단일 샘플로 native 강도 유지.
```

색은 평균해도 색이지만, 노멀은 방향 벡터라 평균하면 서로를 지운다. 텍스처라고 다 같은 텍스처가 아니다.

---

## 4. 강물을 그리드에 가르치기 — 3연전

강이 흐르기 시작하자 진짜 문제가 왔다. 그리드는 여전히 16편의 높이식 판정("이 Z보다 낮으면 물")을 쓰고 있었는데, 진짜 강은 그 가정을 셋 다 깨뜨렸다.

### 4-1. 엔진의 침수 질의에는 폭이 없다

WaterBody가 생겼으니 높이식 대신 엔진의 물 질의를 쓰면 되겠다 싶었다. `TryQueryWaterInfoClosestToWorldLocation`에 위치를 주면 immersion(수면 높이 − 입력 Z)이 나온다. immersion > 0이면 물속이다. 간단하다.

그런데 베이크를 돌려 보니 **강에서 한참 떨어진 평지가 전부 물로 분류됐다.** 엔진의 이 질의는 "가장 가까운 수면"과의 높이 차만 줄 뿐, **그 위치가 강의 XY 폭 안에 있는지는 보지 않는다.** 강 수면보다 고도가 낮은 땅은, 강에서 아무리 멀어도 immersion이 양수다.

해결은 강 스플라인으로 직접 폭 판정을 하는 것이었다. 스플라인 중심선까지의 수평 거리가 그 지점의 강폭 절반 이내일 때만 물로 인정한다.

```cpp
if (Q.GetImmersionDepth() <= 0.0f) { continue; }  // 지형이 수면 위 → 물 아님

// ⭐ 실제 포함: 강 스플라인 중심선까지 수평 거리 ≤ 강폭/2 + 여유. 강(WaterBodyRiver)만.
if (const UWaterBodyRiverComponent* River = Cast<UWaterBodyRiverComponent>(Comp))
{
    if (const UWaterSplineComponent* Spline = River->GetWaterSpline())
    {
        const float Key = Spline->FindInputKeyClosestToWorldLocation(WorldLoc);
        const FVector Center = Spline->GetLocationAtSplineInputKey(Key, ESplineCoordinateSpace::World);
        const float HalfWidth = River->GetRiverWidthAtSplineInputKey(Key) * 0.5f;
        const float HorizDistSq =
            FMath::Square(Center.X - WorldLoc.X) + FMath::Square(Center.Y - WorldLoc.Y);
        const float MaxDist = HalfWidth + InMargin;
        if (HorizDistSq > MaxDist * MaxDist) { continue; }  // 강 폭 밖 → 물 아님
    }
}
OutSurfaceZ = Q.GetWaterSurfaceLocation().Z;
return true;
```

*(OJJ_Grid.cpp — 앞부분의 바운즈 사전필터·질의 호출부는 생략)*

571,536셀을 전수 질의하므로 컴포넌트 바운즈 박스로 XY 사전필터도 걸었다. 그리고 베이크 분류에서는 WaterBody가 있으면 이 질의를 쓰고, 없는 맵(레거시 WaterArea)은 기존 높이식으로 폴백 — 옛 맵의 동작은 그대로다. 판정 산식이 바뀌었으니 베이크 캐시 버전을 2→3으로 올려 기존 캐시를 강제 무효화했다. 캐시에 버전을 박아 둔 과거의 내가 고마운 순간.

### 4-2. Foundation은 강바닥이 아니라 수면 위에 떠야 한다

Foundation(공장 바닥 데크)은 강 위에도 놓을 수 있어야 한다 — 강을 가로지르는 공장 부지는 이 장르의 로망이다. 그런데 Foundation의 자동 높이(SnapLift)는 셀의 지면 Z(GroundZ)를 기준으로 데크 높이를 잡는다. 강 셀에서 GroundZ는 **강바닥**이다. 그대로 두면 데크가 물속에 잠긴 채 설치된다.

강 셀에서는 강바닥 대신 **수면 델타**를 높이 후보로 쓰도록 했다.

```cpp
const FIntPoint Cell(X, Y);
float Delta = 0.0f;
bool bHas = GetCellGroundZ(Cell, Delta);
// ② 강 위 Foundation: 데크 상판이 수면 위로 뜨게 — 셀이 강이면 강바닥(GroundZ) 대신 수면 델타를 후보로.
//    다리는 별도(라이브 트레이스)로 강바닥까지 닿으므로 무관. 땅 셀은 수면 질의 false → 불변(회귀 0).
float WaterZ = 0.0f;
if (OJJ_WaterSurfaceForCell(Cell, WaterComps, WaterZ))
{
    const float WaterDelta = WaterZ - PlaneZ;
    Delta = bHas ? FMath::Max(Delta, WaterDelta) : WaterDelta;
    bHas = true;
}
```

데크 상판은 수면 위로 뜨고, 다리(기둥)는 라이브 트레이스로 강바닥까지 내려가 닿는다. 땅 셀에서는 수면 질의가 false라 기존 경로가 한 치도 안 변한다 — 물 셀에서만 새 분기가 열리는 구조다.

### 4-3. 빌드모드에 들어가자 맨땅이 파랗게 물들었다

마지막 사건은 시각화였다. 물 셀을 그리드 오버레이에서 구분해 보여 주는 색 규칙을 손보다가, 두 가지를 고쳤다.

하나 — Foundation 배치 모드에서는 물 셀이 **초록(설치 가능)**이어야 한다. 4-2에서 강 위 설치를 허용했으니 색도 따라와야 한다. `OJJ_ClassifyCellColor`의 Foundation 분기는 이미 Foundation이 깔린 셀만 빨강으로 치고, 평지·경사·물을 전부 초록으로 돌려준다.

둘 — 빌드모드에 **진입하는 순간** 맨땅이 파랗게 오표시되는 버그. 원인은 배치 모드가 아직 `None`인 전환 과도기에 raw 지형 색 규칙이 적용된 것이었다.

```cpp
case EOJJ_BuildPlacementMode::None:
    // ⚠️ None = 빌드모드 아님/모드 전환 과도기 — raw 허용 금지(맨땅 파랑 오표시 방지).
    bRaw = false;
    break;
```

한 줄짜리 수정이지만, "모드 전환 과도기"라는 상태가 존재한다는 것 자체가 교훈이었다. 모드 A도 B도 아닌 순간에 어느 쪽 규칙이 적용되는지는, 아무도 정해 주지 않으면 우연이 정한다.

---

## 5. 펌프에게 강은 아직 남이었다

물 3연전이 끝나고 펌프를 강가에 놓아 봤다 — 안 놓였다. 16편의 펌프는 `GetLiquidResourceAtCell`로 인접 셀의 **자원 액터**를 찾는데, `WaterBodyRiver`는 UE Water 플러그인의 액터지 우리 자원 클래스(`AResourceBase`)가 아니다. 그리드는 강을 아는데, 자원 레이어는 모르는 상태.

브릿지를 하나 만들었다. `BeginPlay`에서 보이지 않는 무한 수원 액터 `AOJJ_RiverLiquidResource`를 스폰해 강의 물 셀들을 자원 레이어에 등록한다. 펌프 입장에서는 그냥 "무한 용량 액체 자원"이 하나 더 생긴 것이라 16편의 코드가 그대로 동작한다. 베이크 캐시가 낡아 실제로는 강이 아닌 셀에 가짜 수원이 등록되는 것을 막기 위해, 등록 전에 라이브 WaterBody로 재검증하는 가드도 넣었다(Codex 교차검증에서 잡힌 지적).

---

## 6. 리워크의 청구서

이틀 만에 맵은 몰라보게 좋아졌다. 강이 흐르고, 바닥은 반복 무늬 없이 자연스럽고, Foundation은 강을 가로지른다.

그리고 청구서가 하나 날아왔다. 그리드가 756² = 571,536셀이 되자, **빌드모드에 진입할 때마다 그리드 오버레이 생성에 3,848ms가 걸리기 시작했다.** 4초 프리즈. 이 히치를 어떻게 41ms까지 끌어내렸는지는 — 카메라 이야기와 한 몸이라 — 24편의 클라이맥스로 미룬다.

---

## 7. 정리 — 진짜 물은 판정도 진짜여야 한다

맵 리워크에서 한 것 —

- 랜드스케이프 1/4 축소 + Water 플러그인 WaterBodyRiver 도입, 그리드 756² 재설정
- 멀티레이어 바닥 머티리얼을 에디터 유틸리티 코드로 생성 — 멀티스케일 UV로 타일 반복 깨기, 노멀만 단일 스케일
- 물 판정을 높이식에서 WaterBody 침수 질의 + **스플라인 폭 containment**로 교체 (베이크 캐시 버전 2→3)
- Foundation 강 위 설치 — SnapLift가 강바닥 대신 수면 델타를 쓰도록
- 색 규칙: Foundation 모드 물=초록, `None` 과도기의 파랑 오표시 차단
- 강을 펌프의 수원으로 — 비가시 무한 수원 액터로 자원 레이어에 브릿지

교훈은 두 줄이다.

**엔진 API의 반환값에는 전제가 있다.** immersion은 "폭 안에 있다면"이라는 조건을 숨기고 있었고, 그 전제를 우리 쪽에서 채워 줘야 했다. 문서에 없는 전제는 전수 베이크가 가르쳐 준다.

**가짜를 진짜로 바꾸면, 진짜를 흉내 내던 모든 곳이 청구서를 보낸다.** 웅덩이를 강으로 바꾸는 건 에디터에서 10분이지만, 그 강을 그리드가·Foundation이·펌프가·색 규칙이 각자 다시 배우는 게 리워크의 본체였다.

다음 편은 정말로 경사 컨베이어다. 이번엔 진짜다.

---

*이 글은 factory-space(UE5.7, C++) 맵 리워크 작업(2026-06-29~30, PR #461·#462)을 정리한 것입니다. 코드 스니펫은 실제 구현에서 발췌했으며, 가독성을 위해 일부 축약했습니다.*
