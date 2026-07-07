---
title: "공장 시뮬레이션 게임 개발기 — 카메라 대장정: 세 개의 시점과 3,848ms의 청구서"
description: "5월의 마지막 날 TPS 카메라 한 대로 시작해, 한 달 동안 카메라 커밋이 18개 쌓였다. possess 없이 입력을 위임받는 빌드 탑다운 카메라, IMC 교체로 끊은 마우스 룩, 정탑다운 -90°와 줌아웃 15000, Foundation 벽 뒤에서 캐릭터를 잃어버리던 SpringArm, 하루 만에 되돌린 동적 Z 상승 실험까지. 그리고 마지막 날 — 맵 리워크가 남긴 빌드모드 진입 4초 프리즈를, 다 자란 카메라 시스템이 '보이는 곳만 그린다'는 답으로 갚는다. gridVisual 3,848ms → 41ms, 약 94배."
date: 2026-07-07
category: UE5
series: factory-sim
seriesPart: 24
tags: [UE5, C++, 카메라, SpringArm, 최적화, 빌드모드]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — 카메라 대장정**
> - 22편: [맵 리워크 — 웅덩이를 버리고 진짜 강을 흐르게 하다](/blog/factory-sim/22-map-rework-river-grid)
> - 23편: [경사 컨베이어 — 남의 벨트 코드에 Z축을 심는 법](/blog/factory-sim/23-slope-conveyor-mesh-overhaul)
> - **24편: 카메라 대장정 — 세 개의 시점과 3,848ms의 청구서** ← 현재 글

이 시리즈는 대부분 "한 기능의 탄생"을 다뤘는데, 이번 편은 결이 다르다. 5월 31일부터 6월 30일까지 정확히 한 달, 카메라라는 한 주제로 쌓인 커밋 18개를 시간순으로 꿰는 대장정이다.

이 게임의 시점은 셋이다. 걸어 다닐 때의 **TPS 3인칭**, 빌드모드의 **탑다운**, 그리고 19편에서 다룬 인트로의 **1인칭**. 세 시점이 어떻게 생겨나고, 서로 충돌하고, 마지막 날 맵 리워크가 남긴 4초짜리 청구서를 갚게 되는지 — 순서대로 간다.

---

## 1. 하루에 여섯 커밋 — TPS와 탑다운의 탄생 (5/31)

시작은 평범한 TPS다. `ACharacter` 기반 플레이어에 SpringArm + Camera, Enhanced Input으로 WASD/점프/마우스 룩/휠 줌. 첫 커밋 메시지에 "알려진 이슈: 마우스 카메라 감도 과함"이라고 자기 고백을 적었고, 같은 날 다음 커밋에서 감도와 Pitch 제한으로 갚았다. 커밋 메시지에 알려진 이슈를 적어 두는 습관은 이 대장정 내내 유지된다 — 다음 커밋의 TODO가 공짜로 생긴다.

같은 날 빌드모드 시점이 왔다. B키로 빌드모드를 토글하면 그리드를 내려다보는 탑다운으로 전환되는데, 여기서 이 편 전체를 관통하는 설계 결정이 나온다. **탑다운 카메라를 별도 Pawn으로 만들어 possess하지 않는다.** 전용 액터의 헤더 주석에 철학이 그대로 있다:

```cpp
/**
 * 빌드모드 전용 탑다운 카메라 액터 (3단계).
 *
 * 레벨에 배치되어 그리드 중심을 내려다본다. AOJJ_Player가 빌드모드 진입 시
 * SetViewTargetWithBlend로 이 액터를 뷰타겟으로 전환하고(플레이어는 숨김),
 * 빌드모드에서 WASD/QE 입력을 Pan/Rotate로 위임받아 카메라를 움직인다.
 *
 * possess 하지 않으므로 입력은 플레이어가 받아 이 액터의 Pan/Rotate를 호출한다.
 * Pan/Rotate는 호출 시점의 DeltaSeconds × 속도를 적용하므로 자체 Tick 불필요.
 *
 * 패닝은 "카메라 yaw 기준 상대 이동" — Q/E로 회전하면 WASD 방향도 함께 돈다.
 */
```

possess를 하면 컨트롤러 소유권이 넘어가면서 입력 매핑, 플레이어 상태, 복귀 처리가 전부 이사를 가야 한다. 뷰타겟만 바꾸면 **"보는 눈"만 빌려주고 "몸"은 플레이어에 남는다.** 입력은 플레이어가 받아서 위임 호출한다:

```cpp
void AOJJ_BuildCamera::Pan(const FVector2D& Axis)
{
	if (Axis.IsNearlyZero())
	{
		return;
	}

	const float Delta = GetWorld() ? GetWorld()->GetDeltaSeconds() : 0.f;
	if (Delta <= 0.f)
	{
		return;
	}

	// 카메라 yaw 기준 평면 이동: 액터 yaw로 전/우 방향을 산출(pitch/roll 제외 → 수평 패닝).
	const FRotator YawRotation(0.f, GetActorRotation().Yaw, 0.f);
	const FVector Forward = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
	const FVector Right = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);

	const FVector Move = (Forward * Axis.Y + Right * Axis.X) * PanSpeed * Delta;
	AddActorWorldOffset(Move);
}
```

SpringArm 세팅에도 possess 안 하는 구조가 반영돼 있다 — `bUsePawnControlRotation=false`(회전은 액터 yaw 직접 제어), `bInheritYaw=true`(Q/E 회전이 카메라에 전달), `bInheritPitch=false`(어떤 경우에도 하향 틸트 보존), `bDoCollisionTest=false`(지형에 카메라가 끌려오지 않게).

이날의 마지막 퍼즐은 입력 충돌이었다. 빌드모드인데 마우스를 움직이면 뒤에 숨은 플레이어의 시점이 돌았다. 코드로 룩 입력을 조건 분기하는 대신 **IMC(Input Mapping Context) 자체를 교체**했다 — 빌드모드용 IMC에는 IA_Look이 아예 없다. 매핑이 없으면 차단 로직도 필요 없다.

---

## 2. 다듬기의 6월 — 줌 위임, 정탑다운, 그리고 잃어버린 캐릭터

6월 중순부터는 생활 개선이다.

**휠 줌이 빌드모드에서 침묵하던 문제.** 줌은 플레이어 SpringArm을 줄이는 코드였는데, 빌드모드의 뷰타겟은 빌드 카메라다 — 안 보이는 SpringArm만 열심히 줄고 있었다. 해법은 위임 라우팅:

```cpp
// 탑다운 빌드만 뷰타겟이 BuildCamera라 그쪽을 줌(플레이어 SpringArm은 안 보임).
// ⚠️ TPS 빌드는 뷰타겟이 플레이어 SpringArm이므로 가드를 통과시켜 아래 일반 SpringArm 줌(150~800)을 탄다.
if (BuildController && BuildController->GetBuildViewMode() == EBuildViewMode::TopDown)
{
	if (BuildCamera)
	{
		BuildCamera->Zoom(Scroll);
	}
	return;
}
```

같은 커밋에서 빌드캠 pitch를 -70°에서 **-90° 정탑다운**으로 바꿨다. 비스듬한 시점은 그럴듯해 보이지만, 격자 위에 건물을 놓는 작업에는 왜곡 없는 평면도가 낫다.

**진입 위치도 다듬었다.** 초기엔 빌드모드에 들어가면 카메라가 그리드 중심으로 날아갔다 — 내가 서 있는 곳과 무관하게. 이후 빌드캠 XY를 플레이어 현재 위치로 시드하고, 그리드 밖이면 중심으로 폴백하게 바꿨다. 빌드모드는 "어디 다른 곳"이 아니라 "지금 여기를 위에서 보는 것"이어야 한다.

**Foundation이 캐릭터를 가리는 문제.** 6월 말, Foundation 벽 뒤로 걸어가면 3인칭 카메라가 캐릭터를 잃었다. SpringArm은 `ECC_Camera` 채널로 프로브를 쏴서 장애물을 피하는데, Foundation 슬래브가 그 채널에 `Ignore`로 응답하고 있었다 — SpringArm 입장에서 Foundation은 유령이라 피할 방법이 없다.

```diff
-	//  - Camera Ignore: 빌드/줌 카메라 충돌 간섭 방지.
+	//  - Camera Block: 3인칭 SpringArm(ProbeChannel=ECC_Camera)이 Foundation 벽 뒤 오클루전을 피하도록
+	//    머신과 동일하게 카메라 충돌을 잡는다.
-	SlabMesh->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
+	SlabMesh->SetCollisionResponseToChannel(ECC_Camera, ECR_Block);
```

인트로의 1인칭→3인칭 블렌드(카메라를 머리 소켓에 붙였다가 SpringArm 길이를 0→400으로 보간)도 이 시기의 작업인데, 연출 전체는 19편에서 다뤘으므로 여기선 카메라 관점의 한 줄만 — 몽타주 재생이 실패해도 3인칭 복귀와 입력 복구가 보장되도록 soft-lock 가드를 넣었다. 카메라 전환은 실패해도 게임은 계속돼야 한다.

---

## 3. 마지막 날 (6/30) — 실패 하나, 확장 하나, 그리고 청구서

6월의 마지막 날, 카메라 커밋이 네 개 쌓였다.

**실패 하나.** 빌드모드에서 높은 건물이 카메라를 가리는 문제를 풀겠다고, 주변 메시 높이를 읽어 카메라 Z를 동적으로 올리는 기능을 만들었다 — 그리고 **같은 날 revert 커밋으로 작업 전 상태로 되돌렸다.** 카메라가 스스로 높이를 바꾸면 줌 감각이 훼손된다. 시도-실패-원복이 커밋 히스토리에 그대로 남아 있는데, 지우지 않기로 했다. 안 되는 걸 확인한 것도 진행이다.

**확장 하나.** 대신 답은 단순했다 — 줌아웃 상한 `MaxArmLength`를 4000에서 **15000**으로 (정탑다운 FOV 90° 기준 약 300m 폭 조망). 휠 한 틱 `ZoomStep`도 150→600으로 비례 확대. 22편 리워크로 맵이 넓어졌으니 조망도 따라 커져야 했다.

**그리고 청구서가 왔다.** 22편 말미에 미뤄 둔 그 청구서다. 맵 리워크로 그리드가 756×756 = **571,536셀**이 되자, 빌드모드에 진입할 때마다 그리드 오버레이(초록/빨강/파랑 셀 표시)를 전체 재생성하는 비용이 **gridVisual 3,848ms** — 4초 프리즈로 돌아왔다.

답은 카메라 시스템이 다 자라 있었기에 자연스러웠다. **어차피 화면에 보이는 건 카메라 주변뿐인데, 왜 57만 셀을 전부 그리는가.** 오버레이 생성 루프를 카메라 중심 윈도우로 한정했다:

```diff
+		// [진입 hitch] 전체 GridSize(예 756²) 대신 카메라/플레이어 중심 윈도우만 그린다(렌더 한정, 분류 로직 동일).
+		// VisibleGridRadius<=0 또는 중심 미설정(센티넬)이면 전체(폴백). 화면 밖 셀은 안 보이므로 생성 불필요.
+		int32 MinX = 0, MaxX = GridSize.X - 1, MinY = 0, MaxY = GridSize.Y - 1;
+		if (VisibleGridRadius > 0 && VisualWindowCenter.X != INT_MIN)
+		{
+			MinX = FMath::Max(0, VisualWindowCenter.X - VisibleGridRadius);
+			MaxX = FMath::Min(GridSize.X - 1, VisualWindowCenter.X + VisibleGridRadius);
+			MinY = FMath::Max(0, VisualWindowCenter.Y - VisibleGridRadius);
+			MaxY = FMath::Min(GridSize.Y - 1, VisualWindowCenter.Y + VisibleGridRadius);
+		}
+
 		TArray<FTransform> GreenXforms;
 		TArray<FTransform> RedXforms;
 		TArray<FTransform> BlueXforms;
-		for (int32 X = 0; X < GridSize.X; ++X)
+		for (int32 X = MinX; X <= MaxX; ++X)
```

반경 30이면 (2×30+1)² = **3,721셀** — 원래의 약 1/154이다. 진입 시엔 플레이어 위치로 윈도우 중심을 시드해서 첫 페인트부터 윈도우만 그린다.

윈도우는 고정이면 안 된다. 빌드모드에서 카메라가 패닝하면 윈도우도 따라와야 한다. 여기서 이 대장정의 주인공들이 한 프레임에 모인다 — 빌드 컨트롤러 Tick이 **현재 뷰타겟**(탑다운이면 빌드캠, TPS 빌드면 플레이어)의 위치를 그리드에 넘기고, 그리드는 중심 셀이 임계값 이상 움직였을 때만 재페인트한다:

```cpp
void AOJJ_Grid::UpdateVisualWindow(const FVector& WorldCenter)
{
	// [진입 hitch] 빌드모드 중 시각화 윈도우 중심을 추종. 중심 셀이 충분히 이동했을 때만 재페인트(매 프레임 재구성 방지).
	if (VisibleGridRadius <= 0)
	{
		return; // 윈도잉 끔(전체 모드) — 추종 불필요.
	}

	const FIntPoint NewCenter = WorldToGrid(WorldCenter);
	const bool bUnset = (VisualWindowCenter.X == INT_MIN);
	const bool bMoved = bUnset
		|| FMath::Abs(NewCenter.X - VisualWindowCenter.X) >= VisualWindowRepaintStep
		|| FMath::Abs(NewCenter.Y - VisualWindowCenter.Y) >= VisualWindowRepaintStep;
	if (!bMoved)
	{
		return;
	}

	VisualWindowCenter = NewCenter;
	if (bVisualizationActive)
	{
		RefreshGridVisual();
	}
}
```

결과는 PR 본문의 계측 원문 그대로 —

> gridVisual **3848ms → 41ms** (약 94배 감소). 진입 hitch 체감 제거 확인.

중요한 건 **무엇을 안 건드렸는가**다. GridSize도, 베이크도, 배치 검증 쿼리도 무수정 — 격자가 "존재하는 범위"는 그대로 두고 "그려지는 범위"만 카메라 주변으로 한정했다. 시뮬레이션과 렌더를 분리해 둔 9편의 원칙이 여기서 한 번 더 빛을 봤다. 트레이드오프도 명시적으로 남겼다: 최대 줌아웃에서는 윈도우 밖 가장자리에 격자가 안 보인다. `VisibleGridRadius`와 `VisualWindowRepaintStep`(기본 8)을 프로퍼티로 빼 뒀으니, 문제가 되면 코드가 아니라 튜닝으로 잡는다.

---

## 4. 정리 — 카메라는 기능이 아니라 인프라였다

한 달의 대장정을 요약하면 —

- TPS 3인칭 → B키 빌드모드 → **possess 없는 탑다운 카메라**(뷰타겟 전환 + 입력 위임) 3단 구축
- 입력 충돌은 조건 분기가 아니라 **IMC 교체**로 — 매핑이 없으면 차단 로직도 없다
- 줌 위임 라우팅, 정탑다운 -90°, 플레이어 위치 기준 진입, `ECC_Camera` Block으로 오클루전 해결
- 동적 Z 상승은 하루 만에 원복, 대신 줌아웃 4000→15000
- 맵 리워크의 4초 프리즈를 **카메라 추종 시각화 윈도우**로 해결 — 3,848ms → 41ms (약 94배)

교훈은 두 줄이다.

**시점 전환의 최소 단위는 Pawn이 아니라 뷰타겟이다.** possess는 소유권 이사고, 뷰타겟은 눈만 빌려주는 것이다. 눈만 필요한 일에 이사까지 하면, 입력·상태·복귀가 전부 청구서로 돌아온다.

**"보이는 것만 그린다"는 최적화는 카메라가 완성된 뒤에야 가능하다.** 뷰타겟이 프레임마다 명확했기 때문에 시각화 윈도우가 누구를 따라갈지 자명했다. 한 달간 쌓은 카메라 인프라가 없었다면, 3,848ms 앞에서 선택지는 "그리드를 도로 줄이자"뿐이었을 거다. 인프라는 그것이 없었을 때 못 했을 해법의 개수로 평가된다.

---

*이 글은 factory-space(UE5.7, C++) 카메라 시스템 작업(2026-05-31~06-30, PR #467 외)을 정리한 것입니다. 코드 스니펫은 실제 구현에서 발췌했으며, 가독성을 위해 일부 축약했습니다.*
