# 블로그 23편 소스 수집 — 경사 컨베이어 · 메시 개편

대상 저장소: `C:\Users\user\Desktop\factory-space` (원격 `PU3-Lab/factory-space`)
소스: `frontend/Source/Wanted_Factory/` (`Public/Conveyor.h`, `Private/Conveyor.cpp`, `Private/OJJ_Grid.cpp`)
저자(OJJ) 커밋 저자명: `ojaejun1995-sys` / `OhjaejunO` (동일 인물)

---

## ⚠️ 블로그 게재 시 일반화 필요 항목

아래는 소스 원문에는 그대로 있으나 **최종 글에서는 일반화/생략**해야 하는 프로젝트 식별 요소:

- **`WANTED_FACTORY_API`** 매크로 (`class WANTED_FACTORY_API AConveyor`) → 생략하거나 일반화
- **`Wanted_Factory`** 경로/모듈명 (`frontend/Source/Wanted_Factory/...`) → "게임 소스 모듈" 등으로 일반화
- 에셋 파일명 중 프로젝트 식별성 있는 것: `BP_Conveyor.uasset`, `L_GridTest.umap`, Meshy 생성물 파일명(`Meshy_AI_Neon_Arc_Hatch_...`) 등은 경로 노출 지양

**그대로 노출 가능(이미 1~3편에서 공개, 프로젝트명 아님):**
- `AConveyor`, `AOJJ_Grid`, `AOJJ_Foundation`, `AOJJ_RampFoundation` 등 **클래스명**
- `OJJ_*` 함수/멤버 접두사, `PathCellLocalZs`, `PathNodeLocalZs` 등 멤버명
- `/Game/OJJ/...` 에셋 경로, `StraightConveyor`/`ConerConveyor` 메시명 (원문 오탈자 "Coner" 그대로임 — 주의)

---

## 전체 서사 요약 (두 개의 축)

23편은 시간상 **두 덩어리**로 나뉜다:

1. **메시 개편 (2026-06-03 ~ 06-05, PR #66)** — 프로그래머식 박스 스케일 세그먼트 →
   GLB 실물 메시(직선/코너)로 교체. 회전·스케일 체계를 "균일 스케일 + 자세 쿼터니언 합성"으로 재정립.
2. **경사 컨베이어 (2026-06-12, PR #181)** — 평면 전제였던 벨트를 램프 경로 위에서 단을 넘도록 확장.
   F3.7-0(인프라) → F3.7-1(그리드 게이트) → F3.7-2(축 버그) → F3.8(쐐기/편차/노드화) → F3.9(포트 코너)
   순으로 "최소 침습 + 회귀 0(수식 항등)" 원칙 아래 단계적 커밋.
3. **후속 개정 (06-16 ~ 06-18)** — raw 지형추종 경사(#249), 경사 끝셀 코너 표시(#265),
   경사 코너 허용→금지 최종 결정(#252).

메시 개편이 경사의 **선행 조건**이다: 세그먼트가 균일 스케일 + 쿼터니언 자세로 정비돼 있어야
"pitch 쿼터니언 1개 삽입"만으로 경사가 성립하기 때문. 이 인과가 23편의 핵심 서사.

---

## 타임라인 — 사건별 정리

### [축 1] 메시 개편 (PR #66)

#### ① 코너 메시 회전 정비 — `93780cf` (2026-06-03)
> `feat(conveyor): 코너 ㄱ자 메시 회전 정비 (90도 매핑 + Roll 눕히기)`

- 문제: 기존 `CornerToYaw`는 진입/진출 방향 합의 **45° 대각** atan2로 코너 메시를 돌렸는데,
  ㄱ자 실물 메시엔 맞지 않음.
- 해결: `CornerToYaw90` — `Next - Prev`의 4사분면으로 코너 4종을 **90° 격자**에 매핑.
  세워진(XZ벽) 메시를 `Roll 90`으로 XY바닥에 눕히고 `YawQuat * RollQuat` 합성.
- 부수: **U턴 직각 가드** 추가(`prev+next==0`은 코너 아님 = 직선 처리), 비균일 스케일 폐기(균일 스케일로 왜곡 제거).

#### ② 직선/코너 GLB 메시 적용 — `940fdd8` (2026-06-04)
> `feat(conveyor): 직선/코너 신규 메시(GLB) 적용 + 직선 균일 스케일·자세 정비`
> (Co-Authored-By: Claude Opus 4.8)

- 이전 직선 세그먼트는 `StraightScaleX/Y`로 박스를 셀 크기만큼 늘려 쓰는 방식이었음(아래 diff에서 삭제됨).
- 코너와 동일하게 **균일 스케일 + Yaw/Roll 쿼터니언 합성** 구조로 통일.
- 튜너블 3종 신설: `StraightScaleMultiplier`(기본 1.0), `StraightBaseYaw`(PIE 확정 90°), `StraightRoll`(90°).
- 파일: `BP_Conveyor.uasset`, `L_GridTest.umap`, Meshy GLB 텍스처/머티리얼 다수(직선 `StraightConveyor`, 코너 `ConerConveyor`).

#### ③ 구 메시 제거 — `3a47e6b` (2026-06-05)
> `chore(asset): 구 컨베이어 메시 제거 (SM_ConveyorBelt 2종 + 전용 머티리얼/텍스처)`
- `SM_ConveyorBelt/_1` 메시 + `MI_Conveyor/_1` 머티리얼 + 텍스처 10종 제거. 외부 참조 0 확인.

> 관련: `a0b4568`(코너 BP/머티리얼 조정, 06-03), `63d2a5b`(건물 메시 일괄 적용, 06-05)

---

### [축 2] 경사 컨베이어 (PR #181, 전부 2026-06-12)

#### ④ 계획 확정 — `ea50f46`
> `docs: F3.7 경사 컨베이어 계획 확정 — 결정점 7건 승인, ㊉ 수식 항등 채택(분기 복제의 이원화 부패 회피)`
- 문서: `frontend/docs/f3_7_slope_conveyor_plan.md` (109줄 신설)
- 전제(문서 원문): **"SSR/Chan에게 벨트 코드 수정 허락받음 — 단 남의 영역이므로 최소 침습 원칙."**
  (벨트 `AConveyor`는 다른 팀원 소유. OJJ는 그리드 소유. → `OJJ_` 접두 = 침습 경계 표식)
- 핵심 발견(문서 원문): *"벨트의 평면 전제는 예상보다 작다 — 보간·외삽은 이미 3D고,
  실전제는 '셀 로컬 Z = 상수' 두 지점뿐."*
- 회귀 0 3겹 보호(문서 §3): ① 게이트 분기(균일 성공 시 신규 코드 도달 0) ② 주입 부재(빈 배열 = 수식 항등)
  ③ 커밋 순서(벨트 인프라를 죽은 코드로 먼저, 그리드 개방을 마지막).

#### ⑤ F3.7-0 벨트 Z 채널 인프라(죽은 코드) — `368169f`
> `feat: F3.7-0 벨트 경사 Z 채널 인프라 — 주입 경로 없는 죽은 코드 (기존 벨트 무변경)`

멤버 1 + 세터 1 + 조회 헬퍼 2 + 소비 수식 2지점. 주입 호출처가 없어 이 커밋만으로는 동작 무변경.
(당시 멤버명은 `PathCellLocalZs` — 이후 F3.8'''에서 `PathNodeLocalZs`로 노드화되며 개명됨.)

#### ⑥ F3.7-1 그리드 게이트 + 셀별 Z 주입 — `24b18ba`
> `feat: F3.7-1 컨베이어 경사 게이트 + 셀별 Z 주입 — 램프 경로 예외 개방 (그리드만)`
- 벨트 인프라의 **첫 호출처 연결**. `OJJ_Grid.cpp`에만 +99/-7.
- `OJJ_ValidateConveyorSlopePath` 신규 — 경사 허용 3조건:
  ① 전 셀 Foundation 커버(혼합 지형 거부) ② 인접 |ΔZ| ≤ 45uu(램프 행간 한계) ③ **방향 전환 셀 양옆 ΔZ=0**(경사 코너 금지).
- 게이트는 균일 검사 **실패 시에만** 경사 분기 → 기존 평면 경로 회귀 0.

#### ⑦ F3.7-2 기울기 축 버그 수정 — `5c33afb`
> `fix: F3.7-2 경사 세그먼트 기울기 축 — 월드 수평축(흐름 수직) 좌측 합성으로 교정`
- 버그: `Yaw*Pitch*Roll` 우측 합성에서 `YawQuat`에 `StraightBaseYaw(+90°)`가 섞여
  pitch가 **90° 돌아간 roll(좌우 기울기)** 로 발현(PIE 확인).
- 해결: 흐름 벡터를 +Z로 드는 **월드 수평축 `(dy, -dx)`** 회전을 **좌측 합성**(`PitchQuat * YawQuat * RollQuat`).

#### ⑧ F3.7' 급경사 프로퍼티화 — `63a789d`, 1칸 램프 직결 — `fc43cdd`
- `63a789d`: 경사 한계를 45° 고정 → 프로퍼티(기본 100)로. `fc43cdd`: 1칸 램프 허용 + Δ1단 벨트 직결 공식화.

#### ⑨ F3.8 쐐기 비주얼 — `9e2a531`
> `feat: F3.8 램프 쐐기 비주얼 — ProceduralMeshComponent 코드 생성 (계단 박스는 폴백)`

#### ⑩ F3.8'' 벨트 반행 편차 — `dcdbce2`
> `fix: F3.8'' 벨트 반행 편차 — 경사 컨베이어 Z 주입을 셀 계단 장부값 → 램프 빗변 보간값으로`
- 원인(계측): 벨트 세그먼트는 **장부(셀 계단 SurfaceZ)** 에 앉는데 램프 면은 **연속 빗변** —
  반행 편차로 세그먼트가 면에서 뜨거나 가라앉음.
- 해결: `AOJJ_Foundation::OJJ_GetVisualSurfaceZAtWorld` 가상 훅. 램프 override가 **빗변 보간 Z** 반환.
  끝 셀(머신 포트)은 장부 기준 유지(앵커).
- 경계 명시(원문): **"데이터=계단, 면·벨트=빗변"**.

#### ⑪ F3.8''' 전환부 부유 → 노드화 — `4039039`
> `fix: F3.8''' 전환부 세그먼트 부유 — 벨트 Z 주입을 셀 중심 N개 → 셀 경계 노드 N+1개로`
- 진단(수치 원문): 면 꺾임점은 항상 셀 경계인데 세그먼트 pitch가 셀 중심 간 델타 휴리스틱이라
  전환부 2곳이 면을 현으로 가로질러 **±행간/4 부유(완경사 ~4uu, 급경사 25uu — 사용자 관찰과 일치)**.
- 해결: 주입 단위를 **셀 경계 노드(N+1)** 로. `PathCellLocalZs` → `PathNodeLocalZs`(개명),
  `OJJ_SetPathNodeLocalZs`, 셀 중심 Z = 양 경계 노드 중점. 세그먼트 수/ISM 인덱스 불변.

#### ⑫ F3.9 포트 방향 코너 인지 — `38b71dc`
> `feat: F3.9 컨베이어 끝 세그먼트 포트 방향 인지 — 옆 접근 시 직선 → 코너`
- 문제: 머신에 옆으로 접근하면 마지막 세그먼트가 직선으로 끝남(포트 꺾임이 경로 밖 = 머신 안).
- 해결: `OJJ_Start/EndPortFlowDir`(Transient, Zero=미주입=기존 동작) + `OJJ_SetPortFlowDirections`.
  끝 셀의 경로 밖 방향을 포트 흐름 방향으로 보충(`EffPrev/EffNext`) → 기존 직각 판정·`CornerToYaw90` 재사용.
  경사 끝 셀(`bCellFlat` false)은 보충 생략(코너 메시 평면 전제 보호 — known limitation).

---

### [축 3] 후속 개정 (06-16 ~ 06-18)

- **`ab480c9`** (06-16, #249, PR #256) `feat: #249 컨베이어 raw 지형추종 경사 주행 (raw 코너 허용, Foundation 동결)`
  - `OJJ_ValidateConveyorSlopePath`를 **all-foundation(100uu) / all-raw(300uu) / 혼합 거부** 3분기로 확장.
  - raw 경로는 corner-flat 게이트 **면제**(코너에서도 GroundZ 따라 꺾임). `OJJ_GetRawTerrainSurfaceZ`,
    `OJJ_IsRawTerrainFollowPath` 신규. Foundation/램프 경로(F3.7~F3.10)는 동결.
- **`7090df9`** (06-17, Closes #265) `fix: 컨베이어 경사 끝셀 코너 메시 표시 (bCellFlat 게이트 분리)`
  - #263 혼합 경사 경로가 끝셀 nodeZs 주입을 유발 → `bCellFlat` 게이트가 닫혀 포트 보충 생략 →
    코너 자리에 직선 오표시. 포트 보충을 게이트에서 분리하고 유효성(`!=Zero`) 체크로 대체.
- **`cc13681`** (06-17, PR #284) `feat: 컨베이어 경사 코너 게이트 tolerance 완화 (boundary+on-a-slope, 50uu)`
  - 코너 3셀 클램프Z span 연속성(≤ tol=50uu)으로 완화 → 빗변연장 단차 램프 코너 허용, 진짜 절벽(~100) 거부.
- **`7a46aa2`** (06-18, #252, PR #287) `feat: 컨베이어 경사 코너 배치 금지 — 평지 코너만 허용 (#252)`  ← **최종 결정**
  - 램프 위에서 컨베이어가 꺾이면 코너 타일이 비스듬히 틀어져 시각상 어색 → **경사 코너 금지, 평지 코너만**.
  - tolerance를 반 단(50uu) → 미세굴곡 epsilon(*0.05 = **5uu**)으로 조임. 코너 pitch 실험 제거,
    `CornerQuat = YawQuat * RollQuat` 단일평면 수평 배치로 복귀.

---

## 코드 조각 (원문 인용 — 재구성 금지)

### 조각 A — 세그먼트를 GLB 균일 스케일로 교체 (`940fdd8` diff)
`frontend/Source/Wanted_Factory/Private/Conveyor.cpp` — 박스 스케일 삭제, 쿼터니언 자세로 전환:

```diff
-		const bool bHorizontal = VisualDirection.X != 0;
-		const FRotator Rotation(0.0f, DirectionToYaw(VisualDirection), 0.0f);
-		const FVector Scale = bHorizontal ? StraightScaleX : StraightScaleY;
-		StraightSegmentInstances->AddInstance(FTransform(Rotation, LocalLocation, Scale));
+		// 직선 메시: 코너와 동일 구조(균일 스케일 + 자세 보정).
+		// 세워진 메시를 Roll로 XY바닥에 눕히고(StraightRoll), 흐름 방향 Yaw(+오프셋)로 정렬.
+		const FQuat YawQuat(FRotator(0.0f, DirectionToYaw(VisualDirection) + StraightBaseYaw, 0.0f));
+		const FQuat RollQuat(FRotator(0.0f, 0.0f, StraightRoll));
+		const FQuat StraightQuat = YawQuat * RollQuat;
+		const float StraightUniform = FMath::Max(0.01f, StraightScaleMultiplier);
+		const FVector StraightScale(StraightUniform, StraightUniform, StraightUniform);
+		StraightSegmentInstances->AddInstance(FTransform(StraightQuat, LocalLocation, StraightScale));
```

### 조각 B — 코너 90° 격자 매핑 (`93780cf` diff, `Conveyor.cpp`)
```cpp
float CornerToYaw90(FIntPoint PreviousDirection, FIntPoint NextDirection)
{
	// 진입(-Prev)+진출(Next) 합 = Next-Prev → 4사분면으로 코너 4종을 구별, 90° 단위 격자 정렬.
	const int32 SX = NextDirection.X - PreviousDirection.X;
	const int32 SY = NextDirection.Y - PreviousDirection.Y;

	if (SX > 0 && SY > 0) { return 0.0f; }
	if (SX < 0 && SY > 0) { return 90.0f; }
	if (SX < 0 && SY < 0) { return 180.0f; }
	return 270.0f;   // SX > 0 && SY < 0
}
```
같은 커밋의 U턴 직각 가드:
```cpp
// 직각만 코너로 인정: prev==next는 직선, prev+next==0은 U턴(반대방향) → 코너 아님(직선 흐름 처리).
const bool bIsRightAngle = PreviousDirection != NextDirection
	&& (PreviousDirection + NextDirection) != FIntPoint::ZeroValue;
const bool bIsCorner = bHasPrevious && bHasNext && bIsRightAngle;
```

### 조각 C — 경사 직선 세그먼트: pitch 쿼터니언 + 빗변 스케일 (현재 소스 최종본)
`frontend/Source/Wanted_Factory/Private/Conveyor.cpp:744-768` (F3.7-0 도입, F3.7-2/F3.8''' 반영된 최종형):

```cpp
// [OJJ F3.8'''] ΔZ = 자기 셀의 경계 노드 델타 — 면의 꺾임점이 항상 셀 경계라 세그먼트가 면과 전 구간 정확 일치.
// [OJJ F3.7-2 fix] 기울기는 "흐름 벡터를 +Z로 들어 올리는 월드 수평축(dy, −dx)" 회전을 **좌측 합성**.
const float DeltaZ = OJJ_GetPathNodeLocalZ(Index + 1) - OJJ_GetPathNodeLocalZ(Index);
const FQuat YawQuat(FRotator(0.0f, DirectionToYaw(VisualDirection) + StraightBaseYaw, 0.0f));
const FVector PitchAxis((float)VisualDirection.Y, -(float)VisualDirection.X, 0.0f);
const FQuat PitchQuat(PitchAxis.GetSafeNormal(), FMath::Atan2(DeltaZ, CellSize));
const FQuat RollQuat(FRotator(0.0f, 0.0f, StraightRoll));
const FQuat StraightQuat = PitchQuat * YawQuat * RollQuat;
const float StraightUniform = FMath::Max(0.01f, StraightScaleMultiplier);
// 빗변 보정은 흐름 축에만 — pitch 제외 합성의 역회전으로 산출(90° 격자 = 주성분 축).
const float SlopeLength = FMath::Sqrt(1.0f + FMath::Square(DeltaZ / CellSize));
const FVector MeshFlowAxis = (YawQuat * RollQuat).UnrotateVector(
	FVector((float)VisualDirection.X, (float)VisualDirection.Y, 0.0f)).GetAbs();
const FVector StraightScale =
	FVector(StraightUniform) * (FVector::OneVector + (SlopeLength - 1.0f) * MeshFlowAxis);
StraightSegmentInstances->AddInstance(FTransform(StraightQuat, LocalLocation, StraightScale));
```
> 빈 배열(평면) → `DeltaZ=0` → PitchQuat 항등·SlopeLength=1 → 기존 결과와 비트 동일(㊉ 수식 항등).

### 조각 D — 노드화된 셀 중심 Z 조회 (현재 소스, `Conveyor.cpp:461-472`)
```cpp
float AConveyor::OJJ_GetPathNodeLocalZ(int32 NodeIndex) const
{
	// 빈 배열(평면 — 기존 전 경로)·무효 인덱스 = 0: 소비 수식이 +0/pitch 0/×1 항등(㊉ 유지).
	return PathNodeLocalZs.IsValidIndex(NodeIndex) ? PathNodeLocalZs[NodeIndex] : 0.0f;
}

float AConveyor::OJJ_GetPathCellLocalZByIndex(int32 PathIndex) const
{
	// 셀 중심 = 양 경계 노드의 중점 — 셀 내 면이 선형(꺾임점은 항상 셀 경계)이라 면의 중심값과 정확히 동일.
	return 0.5f * (OJJ_GetPathNodeLocalZ(PathIndex) + OJJ_GetPathNodeLocalZ(PathIndex + 1));
}
```

### 조각 E — 그리드 경사 게이트 3조건 (`24b18ba` diff, `OJJ_Grid.cpp`)
```cpp
bool OJJ_ValidateConveyorSlopePath(
	const AOJJ_Grid* Grid, const TArray<FIntPoint>& PathCells,
	TArray<float>& OutCellZs, FString& OutReason)
{
	constexpr float MaxSlopeStepZ = 45.0f;
	// ① 전 셀 Foundation 커버 — 혼합 지형 거부
	for (const FIntPoint& Cell : PathCells) {
		float CellSurfaceZ = 0.0f;
		if (!Grid->GetFoundationSurfaceZ(Cell, CellSurfaceZ)) {
			OutReason = TEXT("Conveyor slope path must stay on foundations ...");
			return false;
		}
		OutCellZs.Add(CellSurfaceZ);
	}
	// ② 인접 |ΔZ| ≤ 45uu
	for (int32 Index = 1; Index < OutCellZs.Num(); ++Index) {
		if (FMath::Abs(OutCellZs[Index] - OutCellZs[Index - 1]) > MaxSlopeStepZ + KINDA_SMALL_NUMBER) {
			OutReason = FString::Printf(TEXT("Conveyor slope between adjacent cells exceeds %.0fuu ..."), MaxSlopeStepZ);
			return false;
		}
	}
	// ③ 방향 전환(코너) 셀 양옆 ΔZ=0 — 경사 코너 금지
	for (int32 Index = 1; Index + 1 < PathCells.Num(); ++Index) {
		const FIntPoint PrevDir = PathCells[Index] - PathCells[Index - 1];
		const FIntPoint NextDir = PathCells[Index + 1] - PathCells[Index];
		if (PrevDir != NextDir
			&& (!FMath::IsNearlyEqual(OutCellZs[Index], OutCellZs[Index - 1])
				|| !FMath::IsNearlyEqual(OutCellZs[Index + 1], OutCellZs[Index]))) {
			OutReason = TEXT("Conveyor cannot turn on a slope (corner cells must be on flat surface).");
			return false;
		}
	}
	return true;
}
```
> **일부 생략**: 함수 상단의 긴 설계 주석과 `OutReason` 문자열 일부를 축약했음(로직 자체는 원문 그대로).

### 조각 F — F3.9 포트 방향 코너 보충 (`38b71dc` diff, `Conveyor.cpp` RebuildVisuals)
```cpp
// [OJJ F3.9] 끝 셀의 경로 밖(머신 안) 방향을 포트 흐름 방향으로 채워 코너 판정에 참여.
// 경사 끝 셀(노드 델타 ≠ 0)은 코너 메시가 평면 전제(㊅)라 보충 생략 — 직선 유지.
const bool bCellFlat =
	FMath::Abs(OJJ_GetPathNodeLocalZ(Index + 1) - OJJ_GetPathNodeLocalZ(Index)) <= KINDA_SMALL_NUMBER;
const FIntPoint EffPrevDirection =
	(!bHasPrevious && bCellFlat) ? OJJ_StartPortFlowDir : PreviousDirection;
const FIntPoint EffNextDirection =
	(!bHasNext && bCellFlat) ? OJJ_EndPortFlowDir : NextDirection;
```

---

## 수치 / 로그 원문 (커밋·PR·이슈에서)

- **45uu** — 인접 셀 경사 한계(램프 행간 계단 한계 `OJJ_MaxAutoFitStepPerRow`와 동일 상수). F3.7-1 게이트.
- **100uu** — 정상 평판 간 셀 ΔZ(간격 100 고정). all-foundation 경사 한계(#249에서 `OJJ_MaxConveyorStepZ`).
- **300uu** — all-raw 지형추종 경사 한계 `OJJ_MaxSlopeStepZ` (#249).
- **50uu** — 코너 게이트 완화 tolerance(`OJJ_GetConveyorCornerZTolerance = MaxConveyorStepZ * 0.5`, cc13681).
- **5uu** — 최종 코너 게이트 epsilon(`* 0.05`, 7a46aa2 — 미세굴곡만 허용, 진짜 경사 거부).
- **±행간/4 부유** — F3.8''' 전환부 편차: **완경사 ~4uu, 급경사 25uu** (사용자 관찰과 일치, 커밋 메시지 계측).
- **커밋 메시지 서명**: 메시 개편(#66)은 `Co-Authored-By: Claude Opus 4.8`, 경사(#181)는 대부분 `Claude Fable 5`.

---

## 커밋 / PR / 이슈 색인

**핵심 커밋 (짧은 해시, 시간순):**

| 해시 | 날짜 | 축 | 요지 |
|------|------|----|------|
| `93780cf` | 06-03 | 메시 | 코너 90° 격자 매핑 + Roll 눕히기 + U턴 가드 |
| `a0b4568` | 06-03 | 메시 | 코너 BP/머티리얼 조정 |
| `940fdd8` | 06-04 | 메시 | 직선/코너 GLB 메시 적용 + 균일 스케일 |
| `3a47e6b` | 06-05 | 메시 | 구 컨베이어 메시 제거 |
| `63d2a5b` | 06-05 | 메시 | 건물 메시 일괄 적용 |
| `ea50f46` | 06-12 | 경사 | F3.7 계획 확정 (docs) |
| `368169f` | 06-12 | 경사 | F3.7-0 벨트 Z 채널 인프라(죽은 코드) |
| `24b18ba` | 06-12 | 경사 | F3.7-1 그리드 게이트 + 셀별 Z 주입 |
| `5c33afb` | 06-12 | 경사 | F3.7-2 기울기 축 버그 수정 |
| `63a789d` | 06-12 | 경사 | F3.7' 급경사 프로퍼티화 |
| `fc43cdd` | 06-12 | 경사 | 1칸 램프 + Δ1단 벨트 직결 |
| `9e2a531` | 06-12 | 경사 | F3.8 램프 쐐기 비주얼 |
| `dcdbce2` | 06-12 | 경사 | F3.8'' 반행 편차(장부→빗변) |
| `4039039` | 06-12 | 경사 | F3.8''' 전환부 부유 → 노드화(N+1) |
| `38b71dc` | 06-12 | 경사 | F3.9 포트 방향 코너 인지 |
| `ab480c9` | 06-16 | 후속 | #249 raw 지형추종 경사 |
| `7090df9` | 06-17 | 후속 | 경사 끝셀 코너 메시 표시 (#265) |
| `cc13681` | 06-17 | 후속 | 코너 게이트 tolerance 완화 (50uu) |
| `7a46aa2` | 06-18 | 후속 | 경사 코너 금지 최종 결정 (#252) |

**PR:** #66(메시 개편) · #181(F3.7~F3.9 경사 일괄) · #256(#249 raw) · #284(cc13681) · #287(#252 코너 금지)
**이슈:** #249(raw 지형추종) · #252(경사 코너 시각 글리치) · #263(혼합 경사 경로) · #265(경사 끝셀 코너)

**못 찾은 항목 / 확인 필요:**
- PR #181 본문 원문은 미확인(gh 조회 안 함) — 커밋 메시지로 서사 충분. 필요 시 `gh pr view 181 -R PU3-Lab/factory-space`.
- 이슈 #249/#252/#263/#265 본문 원문 미조회 — 커밋 메시지의 "Closes/#NNN" 참조로 관계만 확정. 상세 재현 스텝 필요 시 gh로 본문 확인 권장.
- 메시 개편의 GLB 원본(Meshy 생성) 파이프라인 세부(생성 프롬프트 등)는 소스에 없음 — 별도 자료 필요.
