---
title: "공장 시뮬레이션 게임 개발기 — 경사 컨베이어: 남의 벨트 코드에 Z축을 심는 법"
description: "16편에서 예고하고 두 번을 더 미룬 경사 컨베이어, 드디어 왔다. 벨트 코드는 다른 팀원 소유라 최소 침습이 절대 조건이었고, 그래서 세운 원칙이 '빈 배열이면 수식이 항등이 되게'였다. 그 전에 선행 조건이 하나 있었다 — 박스를 늘려 쓰던 세그먼트를 GLB 실물 메시와 쿼터니언 자세로 정비하는 메시 개편. 죽은 코드부터 커밋하는 5단계 릴레이, pitch가 roll로 발현된 축 버그, 세그먼트가 면에서 25uu 떠오른 전환부 부유를 셀 중심 N개에서 셀 경계 노드 N+1개로 바꿔 잡은 기록. 그리고 다 만든 경사 코너를 스스로 금지한 결말까지."
date: 2026-07-07
category: UE5
series: factory-sim
seriesPart: 23
tags: [UE5, C++, 컨베이어, 경사, 쿼터니언, 최소침습]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — 경사 컨베이어**
> - 8편: [컨베이어가 아이템을 나르는 법: 이산 슬롯과 풀(pull) 모델](/blog/factory-sim/08-conveyor-item-transport)
> - 22편: [맵 리워크 — 웅덩이를 버리고 진짜 강을 흐르게 하다](/blog/factory-sim/22-map-rework-river-grid)
> - **23편: 경사 컨베이어 — 남의 벨트 코드에 Z축을 심는 법** ← 현재 글

16편에서 예고하고, 21편에서 또 예고하고, 22편에서 한 번 더 미룬 그 편이다. 시간상으로는 맵 리워크보다 먼저 한 작업인데, 사건이 많아 자꾸 순서에서 밀렸다.

15편에서 램프를 만들었다. 플레이어는 램프로 단차를 오르내린다. 그런데 **아이템은 못 오른다** — 컨베이어가 평면 전제이기 때문이다. 램프 위로 벨트를 그으면 세그먼트가 허공에 수평으로 떠 버린다. 이 편은 그 벨트에 Z축을 심는 이야기다. 다만 순서가 있다. 경사 이전에, 메시부터 갈아야 했다.

---

## 1. 선행 작업 — 박스를 버리고 실물 메시로

초기 컨베이어 비주얼은 프로그래머 아트의 정석이었다. 박스 메시를 `StraightScaleX/Y`로 셀 크기만큼 비균일 스케일해서 늘려 쓰는 방식. 돌아는 가는데, Meshy로 뽑은 직선/코너 실물 메시(GLB)로 갈아 끼우려니 이 스케일 체계가 발목을 잡았다. 비균일 스케일은 실물 메시를 찌그러뜨린다.

그래서 메시 개편의 핵심은 메시 교체가 아니라 **자세 체계의 재정립**이었다 — 비균일 스케일을 폐기하고, "균일 스케일 + 자세 쿼터니언 합성"으로 통일한다.

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

GLB 메시는 XZ 평면에 세워진 채로 임포트되는데, 이를 `Roll 90°`로 바닥에 눕히고 흐름 방향 Yaw를 합성한다. 코너(ㄱ자) 메시도 같은 구조인데, 회전 매핑이 하나 더 필요했다. 기존엔 진입/진출 방향 합의 45° 대각 atan2로 돌렸지만 ㄱ자 실물 메시에는 90° 격자가 맞다.

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

덤으로 U턴 가드도 이때 들어갔다 — `prev + next == 0`(정반대 방향)은 코너가 아니라 직선 흐름으로 처리한다. 코너 4종의 4사분면 판정에서 U턴은 `Next - Prev`가 축 위에 떨어져 어느 사분면에도 안 들어가기 때문에, 명시적으로 걸러 주지 않으면 미정의 동작이 된다.

이 개편이 끝나자 구 박스 메시와 전용 머티리얼·텍스처 10여 종을 삭제했다. 그리고 이 시점엔 몰랐지만 — **세그먼트가 "균일 스케일 + 쿼터니언 자세"로 정비된 것이 경사의 선행 조건이었다.** 자세가 쿼터니언 합성이면, 경사는 그 합성에 pitch 쿼터니언 하나를 끼워 넣는 문제가 된다.

---

## 2. 계획 — 남의 코드에는 수식 항등으로 들어간다

일주일 뒤 경사 작업을 시작하며 계획 문서부터 썼다. 첫 줄의 전제가 이 작업의 성격을 정한다: **벨트 코드(`AConveyor`)는 다른 팀원 소유다.** 수정 허락은 받았지만 남의 영역이므로 최소 침습 — 벨트에 추가하는 모든 멤버와 함수에 `OJJ_` 접두사를 붙여 침습 경계를 표식했다.

분석해 보니 다행히 벨트의 평면 전제는 생각보다 작았다. 보간·외삽 수식은 이미 3D 벡터였고, 실제 전제는 "셀 로컬 Z = 상수" 두 지점뿐. 그래서 회귀 방지 전략을 분기 복제가 아니라 **수식 항등**으로 잡았다 — 경사 데이터(Z 배열)가 비어 있으면 기존 수식과 비트 단위로 같은 결과가 나오게 설계한다. if/else로 신구 경로를 가르면 두 경로가 따로 부패하지만, 항등이면 기존 경로라는 개념 자체가 없다.

커밋 순서도 보호 장치였다. **벨트 인프라를 "죽은 코드"로 먼저 커밋한다** — 멤버 1개, 세터 1개, 조회 헬퍼 2개, 소비 수식 2지점. 주입 호출처가 없으니 이 커밋만으로는 동작이 1도 안 변한다. 그리드 쪽에서 주입을 여는 커밋을 마지막에 둬서, 문제가 생기면 그리드 커밋 하나만 되돌리면 되게 했다.

---

## 3. 게이트 — 아무 경로나 경사가 되면 안 된다

주입을 여는 쪽은 내 소유인 그리드다. 컨베이어 경로 검증에서 균일 높이 검사가 **실패했을 때만** 경사 분기로 넘어가고(평면 경로는 기존 코드 그대로 — 회귀 0), 경사 분기는 세 가지 조건을 통과해야 한다.

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

*(상단의 설계 주석과 OutReason 문자열 일부 축약)*

45uu는 램프의 행간 계단 한계와 같은 상수다 — 램프가 오를 수 있는 기울기면 벨트도 오를 수 있어야 하고, 그 이상이면 둘 다 못 오른다.

---

## 4. 삽질의 연대기 — 축이 틀리고, 장부가 뜨고, 현이 가로지르다

여기서부터는 하루 동안의 버그 릴레이다.

### 4-1. pitch를 넣었더니 벨트가 옆으로 기울었다

첫 구현에서 경사 세그먼트가 앞으로 숙는 게 아니라 **좌우로 기울었다.** 원인은 쿼터니언 합성 순서. `Yaw * Pitch * Roll` 우측 합성에서 YawQuat에는 메시 보정용 `StraightBaseYaw(+90°)`가 섞여 있었고, 그 프레임 안에서 적용된 pitch는 90° 돌아간 roll로 발현됐다.

해결은 pitch를 로컬 프레임에서 빼내는 것 — 흐름 벡터를 +Z로 들어 올리는 **월드 수평축 `(dy, -dx)`** 회전을 만들어 **좌측에서 합성**한다. 메시 보정이 어떻게 돼 있든, 월드축 회전을 왼쪽에서 곱하면 결과 전체가 그 축으로 기운다.

### 4-2. 세그먼트는 계단에 앉는데 면은 빗변이다

축을 고치자 다음 증상: 경사 구간에서 세그먼트가 램프 면 위로 떴다가 가라앉기를 반복했다. 계측해 보니 원인은 데이터와 비주얼의 어긋남이었다. 벨트 세그먼트는 셀의 **계단형 SurfaceZ(장부값)**에 앉는데, 램프의 면은 **연속 빗변**이다. 계단과 빗변의 차이만큼 세그먼트가 면에서 벗어난다.

그래서 Foundation에 가상 훅 `OJJ_GetVisualSurfaceZAtWorld`를 열고, 램프 override가 빗변 보간 Z를 반환하게 했다. 이때 정한 경계가 이 작업 전체의 좌우명이 됐다 — **"데이터=계단, 면·벨트=빗변."** 시뮬레이션과 검증은 계단(장부값)으로, 눈에 보이는 것들은 빗변으로.

### 4-3. 전환부에서 세그먼트가 현을 그었다

그래도 평지→경사 전환부 2곳에서 세그먼트가 미세하게 떴다. 완경사에서 ~4uu, 급경사에서 25uu. 진단해 보니 기하학 문제였다: **면의 꺾임점은 항상 셀 경계에 있는데**, 세그먼트 pitch는 셀 중심 간 델타로 계산하고 있었다. 꺾인 면 위에서 중심 간 직선을 그으면, 그 직선은 꺾임점을 무시하고 현(chord)으로 가로지른다 — 편차는 정확히 ±행간/4.

해결은 주입 데이터의 단위를 바꾸는 것. 셀 중심 Z **N개**가 아니라 **셀 경계 노드 Z N+1개**를 주입한다.

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

세그먼트의 ΔZ가 자기 셀의 양 경계 노드 델타가 되므로, 세그먼트는 면과 전 구간에서 정확히 일치한다. 최종 배치 수식은 이렇다 — pitch 쿼터니언 좌측 합성에, 빗변 길이만큼 흐름 축으로만 스케일 보정:

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

빈 배열이면 `DeltaZ=0` → PitchQuat 항등, SlopeLength=1 → 1장의 diff와 **비트 동일한 결과**다. 수식 항등 원칙이 마지막 커밋까지 유지됐다.

---

## 5. 후속전 — 열어 준 것과 도로 닫은 것

경사 본작업 이후 며칠에 걸쳐 규칙이 다듬어졌다.

**열어 준 것**: raw 지형 추종 주행. Foundation 없이 맨 지형 위에서도 벨트가 GroundZ를 따라 굽이치며 가도록, 게이트를 all-foundation(한계 100uu) / all-raw(한계 300uu) / 혼합 거부의 3분기로 확장했다. raw 경로는 코너 평탄 조건도 면제 — 자연 지형에서 벨트가 꺾이며 오르내리는 건 오히려 그림이 된다.

**도로 닫은 것**: Foundation 램프 위의 경사 코너. 처음엔 게이트 조건 ③을 tolerance 50uu까지 완화해서 램프 코너를 허용해 봤다. 그런데 램프 위에서 코너 타일이 비스듬히 틀어진 모습이 아무리 봐도 어색했다. 결국 **경사 코너 금지, 평지 코너만 허용**으로 확정하고 tolerance를 미세굴곡 epsilon(5uu)까지 조였다. 코너에 pitch를 먹이는 실험 코드도 걷어내고 코너는 `YawQuat * RollQuat` 단일 평면 수평 배치로 복귀.

기능을 만들었다가 스스로 금지한 셈인데, 후회는 없다. 되는 것과 보기 좋은 것은 다르고, 이 게임에서 컨베이어는 화면의 절반을 차지한다.

---

## 6. 정리 — 침습의 크기는 코드가 아니라 수식으로 잰다

경사 컨베이어에서 한 것 —

- 선행: 박스 비균일 스케일 → GLB 실물 메시 + **균일 스케일 + 쿼터니언 자세 합성** (코너 90° 격자 매핑, U턴 가드)
- 남의 벨트 코드에 `OJJ_` 접두 침습 경계 + **빈 배열 = 수식 항등** 설계, 죽은 코드부터 커밋
- 그리드 게이트 3조건(전 셀 Foundation / |ΔZ|≤45uu / 코너 평탄)으로 주입 개방
- pitch 축 버그(좌측 합성으로 교정) → 장부/빗변 어긋남(비주얼 훅 분리) → 전환부 현 가로지름(**셀 중심 N개 → 경계 노드 N+1개**)
- 후속: raw 지형 추종 개방(300uu), 경사 코너는 시각 품질 문제로 최종 금지(tolerance 5uu)

교훈은 두 줄이다.

**남의 코드에 기능을 넣을 때 최고의 보험은 분기가 아니라 항등이다.** "새 데이터가 없으면 기존 수식과 비트 동일"이 보장되면, 회귀 테스트가 아니라 수학이 회귀를 막는다. 접두사 하나까지 포함해서, 침습의 경계가 코드에 보이게 하는 것까지가 예의다.

**이산 데이터의 단위는 기하학이 정한다.** 셀 중심이냐 셀 경계냐는 취향 문제 같지만, 면의 꺾임점이 어디에 있느냐가 답을 정해 준다. 부유 25uu의 범인은 반올림도 부동소수점도 아닌, 현과 호의 차이였다.

다음 편은 카메라다. 5월 말부터 한 달 동안 세 개의 시점이 만들어지고, 마지막 날 3,848ms짜리 청구서를 카메라가 갚는 이야기.

---

*이 글은 factory-space(UE5.7, C++) 컨베이어 메시 개편·경사 작업(2026-06-03~18, PR #66·#181·#256·#284·#287)을 정리한 것입니다. 코드 스니펫은 실제 구현에서 발췌했으며, 가독성을 위해 일부 축약했습니다.*
