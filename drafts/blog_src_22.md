# 22편 맵 리워크 — 소스 수집 (factory-space)

> 대상 저장소: `C:\Users\user\Desktop\factory-space` (원격 https://github.com/PU3-Lab/factory-space)
> 저자 기여 브랜치: PU3-Lab/OJJ → main 머지
> 수집일 기준 브랜치: main

---

## ⚠️ 블로그 게재 시 일반화 필요 항목

최종 블로그에서 아래는 **일반화하거나 생략**할 것 (프로젝트 식별 가능 부분):

- **모듈/프로젝트명**: `Wanted_Factory`, `Wanted_Factory.Build.cs`, `WANTED_FACTORY_API` → "게임 모듈", "Build.cs" 등으로 일반화
- **소스 경로**: `frontend/Source/Wanted_Factory/Private|Public/...` → `Source/<Module>/...` 로 축약
- 텍스처 원본 에셋 ID(`wkjncjv`, `yd0lacrs`, `Military_Trenches_...`)는 노출해도 무방하나, 원한다면 "메가스캔 지면/자갈 세트"로 뭉뚱그려도 됨

**게재 가능 (이미 공개됨, 프로젝트명 아님)**:
- `AOJJ_*` 클래스 접두사 (`AOJJ_Grid`, `AOJJ_BuildController`, `AOJJ_Foundation`, `AOJJ_RiverLiquidResource`)
- `UOJJ_LandscapeMaterialFactory`
- `/Game/OJJ/...` 에셋 경로

---

## 핵심 커밋 목록 (시간순)

| 짧은 해시 | 날짜(KST) | 저자 | 요약 | PR |
|---|---|---|---|---|
| `4992b5e` | 2026-06-07 18:05 | - | feat(water): M_River 패닝 머티리얼 적용 (강 머티리얼 준비) | - |
| `22a143f` | 2026-06-07 18:05 | - | chore(level): L_GridTest 그리드 센터 배치/GridSize + 강 M_River 인스턴스 | - |
| `2c6d1c0` | 2026-06-16 16:43 | OhjaejunO | feat: water grid/port visibility (water surface Z) — 리워크 前 물 시각화 기반 | - |
| `38c3f35` | 2026-06-21 00:00 | OhjaejunO | feat: Foundation 물 판정을 안 가려진 WaterArea로 통일(5중) + GroundZ 베이크 활성 | #319 |
| `2aec6fa` | 2026-06-29 16:08 | - | feat(build): Water/Landmass 플러그인 활성 (강 작업 선행) | - |
| `4d90a4b` | 2026-06-29 16:08 | - | chore: 맵 리워크 前 L_Planet 백업 | - |
| `0dfdf51` | 2026-06-29 16:11 | - | chore: 메가스캔 바닥 머티리얼 임포트 (wkjncjv 2K PBR) | - |
| `e53e05e` | 2026-06-29 17:01 | ojaejun1995-sys | feat(map): Landscape 축소 + Water Body River 강 배치 (.umap 직렬화) | - |
| **`7ba5d46`** | **2026-06-30 03:27** | **OhjaejunO** | **feat(map): 맵 리워크 — 지형 축소+강+멀티레이어 바닥 머티리얼+그리드 재설정** | **#461** |
| **`373393a`** | **2026-06-30 07:06** | **OhjaejunO** | **feat(grid): 강 물 인식(WaterBody) + 파운데이션 강 설치 + 빌드 색 규칙 수정** | **#461** |
| `06b8bd9` | 2026-06-30 07:34 | OhjaejunO | feat(pump): 펌프 강 배치 — 강 셀에 무한 액체 자원 등록(#3) | #462 |
| `066ac4b` | 2026-06-30 17:51 | - | perf: 빌드모드 진입 hitch 최적화 (그리드 visualization 윈도잉) | - |

> 참고: `#461`(머지 `b75e1a5`, mergedAt 2026-06-29T22:08:18Z UTC)에 `7ba5d46`+`373393a` 두 커밋이 함께 들어감. `#462`(머지 `1bab501`)가 펌프 강 배치.
> `#3`은 GitHub 이슈가 아니라 **PR #461 본문에서 다음 작업(펌프 강 배치)을 가리키는 내부 태스크 번호**. (`gh issue view 3` → 존재하지 않음 확인.)

---

## 서사 구조: 문제 → 시도 → 해결

### 배경 — 왜 맵을 갈아엎었나
기존 `L_Planet`은 Landscape가 과하게 넓었고, 물은 "웅덩이(WaterArea)" 방식(수동 배치한 반투명 박스 + 높이식 판정)이었다. 리워크의 목표는 세 가지: **① 지형 축소 + 진짜 강(UE Water 플러그인 WaterBodyRiver) 도입, ② 멀티레이어 바닥 머티리얼로 지면 퀄리티 상승, ③ 그리드 재설정(센터/크기).**

### 사건 1 — 맵 리워크 본체 (`e53e05e` → `7ba5d46`, 6/29~6/30)

준비 단계 (6/29 16:08~16:11):
- `2aec6fa`: 엔진 **Water/Landmass 플러그인 활성** (강 작업 선행). `.uproject`에 플러그인 참조 확보.
- `4d90a4b`: 리워크 전 `L_Planet` 백업 (되돌릴 안전장치).
- `0dfdf51`: 메가스캔 바닥 머티리얼(wkjncjv 2K PBR) 임포트.

`e53e05e` (6/29 17:01) — 맵 직렬화 변경:
```
- L_Planet Landscape 1/4 축소 + 지형 리워크
- Water 플러그인 Water Body River 강 배치(.umap 직렬화, 비-WP)
- 엔진 Water/Landmass 플러그인 에셋 참조(uproject 2aec6fa로 확보됨)
```
파일 변화: `L_Planet.umap` 7,540,387 → 6,156,206 bytes (지형 축소로 용량 감소).

`7ba5d46` (6/30 03:27) — 리워크 본체. 커밋 메시지 원문:
```
- Landscape 2레이어 블렌드 생성기(OJJ_LandscapeMaterialFactory) + M_Landscape_FactoryGround(+Inst)
  · wkjncjv 바닥 / yd0lacrs(Military_Trenches) 자갈, B/N/ORM(Masks) 패킹
  · 멀티스케일 UV(타일 반복 깨기)·매크로 베리에이션·NormalIntensity·GravelTint/Desaturation
- LI_FactoryGround/Gravel (FinalWeightBlending 가중 블렌딩)
- 메가스캔 바위 5종(Cliff/Cluster/Formation/Ledge/Nordic Beach) + Water River 머티리얼 인스턴스
- L_Planet: 지형 축소, Water Body River, 그리드 재설정(센터 -12600/12600, 756² , 평면Z+100, 트레이스밴드/tolerance, Rebake 캐시)
```
신규 소스: `OJJ_LandscapeMaterialFactory.cpp` (+330줄), `.h`. 신규 에셋: `M_Landscape_FactoryGround(_Inst)`, `LI_FactoryGround`, `LI_FactoryGravel`, `Water_Material_River_Inst`, 메가스캔 바위 6종.

**그리드 재설정 수치 (커밋 메시지 + PR #461 본문):**
- 센터: `(-12600, 12600)`
- 크기: **756 × 756**
- 평면 Z: `+100`
- Rebake 캐시 버전 갱신

### 사건 2 — 멀티레이어 바닥 머티리얼 생성기 (`OJJ_LandscapeMaterialFactory`)

에디터 유틸리티. 두 레이어(Ground=wkjncjv, Gravel=yd0lacrs)를 `LandscapeLayerBlend`로 섞고, **타일 반복이 눈에 띄는 문제**를 멀티스케일 UV + 매크로 노이즈로 해결. 노멀만 단일 스케일로 두는 디테일(아래 코드 참고)이 이 편의 기술적 하이라이트.

### 사건 3 — 물 시스템 3단계 (`373393a`, 6/30 07:06, PR #461)

`373393a` 하나가 세 사건을 모두 담고 있다. 커밋 메시지가 ①②③으로 정리돼 있음:

#### 3a. WaterBody 분류 + 스플라인 폭 containment (핵심 버그 수정)

**문제**: 엔진의 `TryQueryWaterInfoClosestToWorldLocation`은 immersion(수면높이−입력Z)만 주고 **XY 폭 클램프가 없다**. 그래서 immersion>0만으로 물을 판정하면 **강 수면보다 낮은 평지 전체가 물로 오판**됐다.

**해결**: 강(WaterBodyRiver) 스플라인 중심선까지의 수평 거리 vs `GetRiverWidthAtSplineInputKey()/2`로 실제 포함 판정. 커밋 메시지의 ⭐ 항목:
```
⭐ 강 스플라인 폭 containment(GetRiverWidthAtSplineInputKey) — 엔진 immersion이 XY 폭
   클램프가 없어 수면 아래 평지 전체를 물로 오판하던 것 차단
```
- Build.cs에 `Water` 모듈 추가
- 베이크 캐시 버전 **2 → 3** (강제 재베이크)

#### 3b. Foundation 강 위 배치 + SnapLift water-aware

**문제/결정**: Foundation(공장 바닥 데크)은 강 위에도 설치 가능해야 함. 데크 상판은 수면 위로 뜨고, 다리(기둥)는 라이브 트레이스로 강바닥까지 닿는다.

- `CanPlaceFoundation`: water 셀 **거부 제외** (WaterCount를 거부 합산에서 뺌)
- `OJJ_ClassifyCellColor`: Foundation 모드에서 물 셀 → **초록**(설치 가능)
- `OJJ_ComputeFoundationSnapLift`: 셀이 강이면 강바닥(GroundZ) 대신 **수면 델타**를 데크 높이 후보로 사용

#### 3c. 물 셀 그리드 오버레이(시각화) 색 규칙 수정

- `BuildController::UpdateGridColorForCurrentMode`: `None` 모드를 raw=true 그룹에서 분리(raw=false) → **빌드모드 진입 시 맨땅이 파랑으로 오표시되던 버그** 차단
- 물→초록(Foundation), 맨땅 빌드 색 정상화

### 사건 4 — 펌프 강 배치 후속 (`06b8bd9`, 6/30 07:34, PR #462)

**문제**: `WaterBodyRiver`는 UE Water 플러그인 액터라 `AResourceBase`가 아님 → 펌프 `FindAdjacentWater`(`GetLiquidResourceAtCell`)가 강에서 수원을 못 찾아 배치 불가.

**해결**: 신규 `AOJJ_RiverLiquidResource`(비가시 무한 수원, form=liquid, bIsInfinite=true)를 `BeginPlay`에서 스폰하고, WaterCells를 자원 레이어에 등록. codex 교차검증으로 **stale 캐시 가짜 수원 차단**(라이브 WaterBody 재검증) 반영.

### 사건 5 — 756² 그리드가 부른 성능 문제 (`066ac4b`, 6/30 17:51)

맵이 756²로 커지자 빌드모드 진입 때마다 오버레이 전체(**571,536셀**)를 재생성해 진입 hitch 발생. 커밋 메시지 원문 수치:
```
빌드모드 진입마다 그리드 오버레이를 전체(GridSize 756x756 = 571,536셀)
재생성하던 것이 진입 hitch(gridVisual ~3848ms)의 원인. 카메라/플레이어
중심 윈도우(VisibleGridRadius)만 그리도록 한정.
...
- gridVisual 3848ms -> 41ms (약 94배). GridSize/빌드/쿼리 로직 무수정
```
→ **3848ms → 41ms (약 94배)**. 22편 서사의 "리워크의 대가" 마무리로 좋은 소재.

---

## 코드 조각 (실제 소스/diff 원문 인용)

### [코드 1] 강 스플라인 폭 containment — 오판 차단의 핵심
`frontend/Source/Wanted_Factory/Private/OJJ_Grid.cpp` (파일 스코프 익명 네임스페이스, `373393a`에서 신규 추가, 현재 소스와 동일). **일부 생략** — 앞부분 바운즈 사전필터/immersion 질의는 유지하고 강 포함 판정 위주로 인용:

```cpp
// WorldLoc이 수집된 WaterBody(강) 중 하나의 "안 + 수중"인지 + 수면 월드 Z.
// ⚠️ 엔진 TryQueryWaterInfoClosestToWorldLocation은 immersion만(수면높이−입력Z) 주고 XY 폭 클램프가 없다
//    ... 그래서 immersion>0만으로 분류하면 강 수면보다 낮은 평지 전체가 물로 오판된다.
//    → 강 스플라인 중심선 거리 vs RiverWidth/2로 실제 포함 판정.
bool OJJ_QueryWaterAtImpl(const TArray<UWaterBodyComponent*>& Comps, const FVector& WorldLoc,
    float InMargin, float& OutSurfaceZ)
{
    for (UWaterBodyComponent* Comp : Comps)
    {
        if (!Comp) { continue; }
        // XY 사전필터: 컴포넌트 바운즈 밖이면 스킵(571k 셀 대비 비용 절감).
        const FBox CompBox = Comp->Bounds.GetBox();
        if (WorldLoc.X < CompBox.Min.X || WorldLoc.X > CompBox.Max.X ||
            WorldLoc.Y < CompBox.Min.Y || WorldLoc.Y > CompBox.Max.Y) { continue; }

        const EWaterBodyQueryFlags Flags =
            EWaterBodyQueryFlags::ComputeImmersionDepth | EWaterBodyQueryFlags::ComputeLocation;
        const TValueOrError<FWaterBodyQueryResult, EWaterBodyQueryError> Result =
            Comp->TryQueryWaterInfoClosestToWorldLocation(WorldLoc, Flags);
        if (!Result.HasValue()) { continue; }
        const FWaterBodyQueryResult& Q = Result.GetValue();
        if (Q.GetImmersionDepth() <= 0.0f) { continue; }  // 지형이 수면 위 → 물 아님

        // ⭐ 실제 포함: 강 스플라인 중심선까지 수평 거리 ≤ 강폭/2 + 여유. 강(WaterBodyRiver)만.
        if (const UWaterBodyRiverComponent* River = Cast<UWaterBodyRiverComponent>(Comp))
        {
            if (const UWaterSplineComponent* Spline = River->GetWaterSpline())
            {
                const float Key = Spline->FindInputKeyClosestToWorldLocation(WorldLoc);
                const FVector Center = Spline->GetLocationAtSplineInputKey(Key, ESplineCoordinateSpace::World);
                const float HalfWidth = River->GetRiverWidthAtSplineInputKey(Key) * 0.5f;  // UE5.7 정석 API
                const float HorizDistSq =
                    FMath::Square(Center.X - WorldLoc.X) + FMath::Square(Center.Y - WorldLoc.Y);
                const float MaxDist = HalfWidth + InMargin;
                if (HorizDistSq > MaxDist * MaxDist) { continue; }  // 강 폭 밖 → 물 아님
            }
        }
        OutSurfaceZ = Q.GetWaterSurfaceLocation().Z;
        return true;
    }
    return false;
}
```

### [코드 2] 베이크 물 분류 — WaterBody 질의 우선, 높이식 폴백
`OJJ_Grid.cpp` `BakeBuildableCells()`, `373393a` diff. 4단 분류(void > water > blocked > buildable) 중 water 판정 부분:

```cpp
// ① water 판정: WaterBody(강)가 있으면 침수 질의로 정확 분류 — 옛 높이식(오판원) 미사용.
//    WaterBody 없는 맵(레거시/WaterArea)은 높이식 폴백.
bool bWater = false;
if (WaterComps.Num() > 0)
{
    if (bAnyHit)
    {
        const FVector GroundPt(Center.X, Center.Y, PlaneZ + LowestSignedDelta);
        float UnusedWaterZ = 0.0f;
        bWater = OJJ_QueryWaterAtImpl(WaterComps, GroundPt,
            FMath::Max(1.0f, CellSize * 0.5f), UnusedWaterZ);
    }
}
else
{
    bWater = bAnyHit && (LowestSignedDelta < WaterSurfaceZ);  // 레거시 높이식
}
EOJJCellClass CellClass;
if (!bAnyHit)         { CellClass = EOJJCellClass::Void; }
else if (bWater)      { CellClass = EOJJCellClass::Water; }
// ... (blocked/buildable 이하 생략)
```
그리고 캐시 버전 상향 (`OJJ_Grid.h`):
```cpp
// 현재 산식 버전: 2 = GroundZ 대표값 최고점(F2-1). 3 = ① WaterBody 침수 기반 water 분류(높이 임계는 폴백).
// 0/1(필드 도입 전)·2(옛 높이식 water)는 자동 무효 → 강제 재베이크.
static constexpr int32 OJJ_CurrentBakeVersion = 3;
```

### [코드 3] Foundation SnapLift — 강 위 데크는 수면 델타로 리프트
`OJJ_Grid.cpp` `OJJ_ComputeFoundationSnapLift()`, `373393a` diff. 셀 루프 안 물 인식 부분:

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
if (bHas)
{
    MaxGroundZ = FMath::Max(MaxGroundZ, Delta);
}
```

### [코드 4] 색 오버레이 — Foundation 모드 물→초록 & None 모드 파랑 오표시 차단
`OJJ_Grid.cpp` `OJJ_ClassifyCellColor()` (`373393a` diff):
```cpp
// --- Foundation/Ramp 모드: 물·이미foundation 제외 전부 placeable ---
if (bGridColorRuleSet && GridColorMode == EOJJGridColorMode::Foundation)
{
    if (IsCellOnFoundation(Cell)) { return EOJJCellClass::Blocked; }  // 이미 Foundation = 빨강(겹침)
    return EOJJCellClass::Buildable;  // ② 평지·경사·물(강) 모두 초록 — Foundation은 강 위도 설치 가능
}
```
`OJJ_BuildController.cpp` `UpdateGridColorForCurrentMode()` — None 모드를 raw 그룹에서 분리 (`373393a` diff):
```cpp
case EOJJ_BuildPlacementMode::None:
    // ⚠️ None = 빌드모드 아님/모드 전환 과도기 — raw 허용 금지(맨땅 파랑 오표시 방지).
    bRaw = false;
    break;
```

### [코드 5] 멀티레이어 바닥 머티리얼 — 멀티스케일 UV로 타일 반복 깨기
`frontend/Source/Wanted_Factory/Private/OJJ_LandscapeMaterialFactory.cpp` (현재 소스 원문). 타일 반복이 눈에 띄는 문제를 두 스케일로 샘플해 Lerp하는 헬퍼:

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
그리고 **노멀만은 단일 스케일**로 두는 핵심 주석 (같은 파일, `GenerateFactoryGroundMaterial()` 내):
```cpp
//  BaseColor/ORM = 멀티 스케일(타일 반복 깨기, 평균해도 무해).
//  ⚠️ Normal = 단일 스케일(UV1)! 서로 다른 스케일 노멀을 Lerp 평균하면 xy 섭동이 상쇄돼 평탄화됨 → 입체감 소실.
//     노멀은 벡터라 BaseColor와 블렌드 방식이 다름. 단일 샘플로 native 강도 유지.
UMaterialExpression* GroundBaseTex = SampleMultiScale(Mat, GroundB, SAMPLERTYPE_Color, GroundUV1, GroundUV2, -1700, -260);
UMaterialExpression* GroundNormTex = Sample(Mat, GroundN, SAMPLERTYPE_Normal, GroundUV1, -1700, 0);
```

> (선택) DetailScaleRatio 기본값 `0.37f`(비정수배), MacroVariationAmount `0.4f`, NormalIntensity `2.0f`, GravelTint 기본 무채색 `(0.6,0.6,0.6)` 등 파라미터 수치는 같은 파일에서 직접 확인 가능.

---

## 수치/로그 원문 모음

- **그리드**: 센터 `(-12600, 12600)`, 크기 **756 × 756** = **571,536 셀**, 평면 Z `+100`, 베이크 캐시 버전 **2→3** (출처: `7ba5d46`/`373393a` 커밋 메시지, PR #461 본문, `066ac4b` 커밋 메시지)
- **성능**: gridVisual **3848ms → 41ms (약 94배)**, 윈도우 셀 수 ~3721셀 (출처: `066ac4b` 커밋 메시지)
- **맵 용량**: `L_Planet.umap` 7,540,387 → 6,156,206 bytes (e53e05e), 이후 6,095,535 → 5,850,071 bytes (7ba5d46)
- **엔진 API**: `TryQueryWaterInfoClosestToWorldLocation`, `GetRiverWidthAtSplineInputKey`(UE5.7 정석 API), `EWaterBodyQueryFlags::ComputeImmersionDepth|ComputeLocation`
- **머티리얼 파라미터 기본값**: DetailScaleRatio=0.37, MacroVariationAmount=0.4, NormalIntensity=2.0, GravelTint=(0.6,0.6,0.6), GravelDesaturation=0.0, MacroNoise.Scale=0.003
- **PR**: #461 mergedAt `2026-06-29T22:08:18Z` (UTC) / #462

---

## 관련 파일 경로 (인용 원본)

- `frontend/Source/Wanted_Factory/Private/OJJ_Grid.cpp` — WaterBody 질의, 베이크 분류, SnapLift, 강 액체 자원
- `frontend/Source/Wanted_Factory/Public/OJJ_Grid.h` — `OJJ_QueryWaterBodyAt`/`OJJ_WaterSurfaceForCell` 선언, 캐시 버전
- `frontend/Source/Wanted_Factory/Private/OJJ_BuildController.cpp` — 색 규칙 None 모드 분리
- `frontend/Source/Wanted_Factory/Private/OJJ_LandscapeMaterialFactory.cpp` — 멀티레이어 바닥 머티리얼 생성기
- `frontend/Source/Wanted_Factory/Wanted_Factory.Build.cs` — `Water` 모듈 추가
- `frontend/Content/OJJ/Levels/L_Planet.umap` — 맵 직렬화(그리드/강; 바이너리, diff 불가)
