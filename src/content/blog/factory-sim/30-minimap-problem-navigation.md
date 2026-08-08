---
title: "공장 시뮬레이션 게임 개발기 — 미니맵: 프레임당 0원짜리 지도"
description: "AI 에이전트가 '3번 제련기가 멈췄어요'라고 짚어 줘도, 그 머신이 어디 있는지 못 찾으면 소용이 없다 — 그래서 미니맵을 만들었다. 그리드 전체를 직교 SceneCapture로 2048² RenderTarget에 한 장 굽고, 확대·이동은 전부 머티리얼 UV 창에 맡겨 프레임당 캡처 비용을 0으로 만든 설계. 북쪽 고정에 화살표만 도는 회전 처리, 시야 밖 문제 머신을 원 가장자리에 세우는 클램프 내비게이션, 디버그 색을 계승했다가 '위험은 빨강' 직관에 밀려 뒤집힌 마커 색 체계, 그리고 M키를 이미 뺏겨서 N키가 된 사연까지."
date: 2026-07-08
category: UE5
series: factory-sim
seriesPart: 30
tags: [UE5, C++, 미니맵, SceneCapture, RenderTarget, UI]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — HUD/최적화**
> - 21편: [로봇 포트레이트 파이프라인 — AI 이미지에서 게임 HUD까지](/blog/factory-sim/21-robot-portrait-pipeline)
> - 24편: [카메라 대장정 — 세 개의 시점과 3,848ms의 청구서](/blog/factory-sim/24-camera-saga)
> - **30편: 미니맵 — 프레임당 0원짜리 지도** ← 현재 글

이 게임에는 공장 상태를 짚어 주는 AI 에이전트가 있다. "제련기가 전력 부족으로 멈췄습니다" — 좋다. 그런데 **그 제련기가 어디 있는데?** 맵이 넓어지고 머신이 수십 대가 되자, 에이전트가 문제를 짚어 줘도 플레이어가 현장을 못 찾는다는 피드백이 왔다. 그래서 미니맵을 만들었다. PR 제목부터가 "미니맵 (문제 머신 내비게이션)"이다 — 예쁜 지도가 아니라 **문제를 가리키는 지도**가 목표였다.

전편에서 UI 위젯은 팀원 영역이라고 경계를 그었는데, 미니맵은 예외다 — 위젯 C++(`UUI_Minimap`)까지 내가 소유한, HUD 위의 내 구역이다. 대신 메인 HUD와는 무접점으로 통합했다(5장).

---

## 1. 설계 — 한 장 굽고, 창만 움직인다

미니맵의 순진한 구현은 "미니맵용 카메라를 플레이어 머리 위에 띄우고 매 프레임 찍기"다. 이건 매 프레임 씬을 한 번 더 렌더링하는 것과 같다 — 24편에서 3,848ms짜리 청구서를 갚아 본 입장에서는 시작할 수 없는 설계다.

대신 반대로 갔다. **그리드 전체를 한 장으로 미리 굽고, 매 프레임은 그 이미지의 어느 창을 보여 줄지만 바꾼다.** 설계 전체가 캡처 액터의 클래스 주석에 박혀 있다:

```cpp
/**
 * [미니맵] 그리드 전체를 1장의 RenderTarget으로 내려찍는 직교 탑다운 캡처 액터 (레벨 배치형).
 *
 * 설계:
 *  - 상시 캡처가 아니라 요청식(RequestCapture) — bCaptureEveryFrame/OnMovement 모두 끔.
 *    지형/공장은 느리게 변하므로 BeginPlay 1초 후 1회 + RecaptureInterval 주기 재캡처로 충분.
 *  - BeginPlay에서 레벨의 AOJJ_Grid를 찾아 GetGridCenter 상공(CaptureHeight)으로 자동 이동,
 *    OrthoWidth = 그리드 extent(max(X,Y)) — 레벨 배치 위치는 무관(자동 정렬).
 *  - 캡처 방향: pitch -90, yaw 0 고정. 이때 이미지 +U = 월드 +Y, 이미지 -V(위) = 월드 +X.
 *    → UV 변환: U = 0.5 + (WorldY - CenterY)/OrthoWidth, V = 0.5 - (WorldX - CenterX)/OrthoWidth.
 *    UI_Minimap과 M_Minimap 머티리얼이 이 규약을 공유한다(변경 시 3곳 동기화).
 */
```

*(OJJ_MinimapCapture.h)*

지형과 공장은 느리게 변한다 — 이 관찰 하나가 비용 구조를 정한다. 캡처는 시작 1초 뒤 1회 + 10초 주기 재캡처가 전부고, 프레임 단위 작업에서 캡처는 완전히 빠진다. RenderTarget은 2048² 한 장. 21편의 포트레이트가 "필요한 대상만, 필요한 방식으로 찍는" SceneCapture였다면, 미니맵은 "필요한 **때**만 찍는" SceneCapture다.

생성자는 그 결정들의 나열이다:

```cpp
	CaptureComponent->ProjectionType = ECameraProjectionMode::Orthographic;
	CaptureComponent->CaptureSource = ESceneCaptureSource::SCS_FinalColorLDR;
	// 요청식 캡처만 — 상시 캡처 비용 차단.
	CaptureComponent->bCaptureEveryFrame = false;
	CaptureComponent->bCaptureOnMovement = false;

	// 미니맵 가독성: 안개/대기/파티클은 지도를 덮는 노이즈라 끔.
	CaptureComponent->ShowFlags.SetFog(false);
	CaptureComponent->ShowFlags.SetVolumetricFog(false);
	CaptureComponent->ShowFlags.SetAtmosphere(false);
	CaptureComponent->ShowFlags.SetParticles(false);
	// 물 표면 스페큘러 글린트가 저해상 RT에서 흰 점으로 앨리어싱 → 광택 계열 전부 끔.
	CaptureComponent->ShowFlags.SetBloom(false);
	CaptureComponent->ShowFlags.SetSpecular(false);
	CaptureComponent->ShowFlags.SetScreenSpaceReflections(false);
	CaptureComponent->ShowFlags.SetLensFlares(false);
}
```

*(생성자 발췌)*

ShowFlags 뒤쪽 네 줄(Bloom/Specular/SSR/LensFlares)은 첫 커밋엔 없다가 다음 커밋에서 추가됐다. PIE에서 보니 16편의 강 — 물 표면의 스페큘러 하이라이트가 저해상 RT에 흰 점으로 앨리어싱되어 지도에 노이즈처럼 반짝였다. 미니맵은 사진이 아니라 지도다. 광택은 지도에 필요 없다.

배치도 무인화했다. `BeginPlay`에서 레벨의 그리드를 찾아 중심 상공 20,000uu로 스스로 이동하고, `OrthoWidth`를 그리드 extent의 긴 변으로 맞춘다 — 레벨에 아무렇게나 놓아도 알아서 정렬된다(그리드 미발견이면 경고 로그 후 배치값 유지). 29편의 자동 스폰과 같은 결이다: 에디터 수작업에 기대는 배선을 코드가 회수한다.

---

## 2. 확대·이동은 머티리얼이 한다

배경 이미지는 한 장인데 미니맵은 플레이어를 따라 움직여야 한다. 이 "움직임"을 C++이 픽셀을 만지는 게 아니라 **머티리얼 UV 창**으로 처리했다. 위젯의 매 틱이 하는 일은 파라미터 두 개 공급이 전부다:

```cpp
	// 배경 확대창: 플레이어 위치 → 캡처 UV. 규약(OJJ_MinimapCapture.h): U=+Y, V=-X.
	FVector2D CaptureCenter;
	float CaptureWorldSize = 0.0f;
	if (MapMID && ResolveCaptureFrame(CaptureCenter, CaptureWorldSize) && CaptureWorldSize > KINDA_SMALL_NUMBER)
	{
		const float U = 0.5f + (PlayerXY.Y - CaptureCenter.Y) / CaptureWorldSize;
		const float V = 0.5f - (PlayerXY.X - CaptureCenter.X) / CaptureWorldSize;
		MapMID->SetVectorParameterValue(ParamWindowCenter, FLinearColor(U, V, 0.0f, 0.0f));
		MapMID->SetScalarParameterValue(ParamWindowSize, ZoomWorldSize / CaptureWorldSize);
	}

	// 북쪽 고정 — 맵은 안 돌고 화살표만 회전. yaw 0(+X=북)=위, yaw 90(+Y)=오른쪽 → 각도=yaw 그대로.
	if (IMG_PlayerArrow)
	{
		IMG_PlayerArrow->SetRenderTransformAngle(Pawn->GetActorRotation().Yaw);
	}
```

*(UUI_Minimap::NativeTick 발췌)*

`WindowCenter`(플레이어의 캡처 UV 좌표)와 `WindowSize`(줌 배율 = 미니맵이 덮는 월드 10,000uu ÷ 캡처가 덮는 월드 크기) — 머티리얼 `M_Minimap`은 이 두 값으로 큰 텍스처에서 작은 창을 잘라 원형 마스크로 보여 준다. 확대·스크롤이 전부 GPU 텍스처 샘플링이라, C++ 쪽 프레임 비용은 곱셈 몇 번이다.

회전은 **북쪽 고정**으로 정했다. 맵 텍스처를 플레이어 진행 방향으로 돌리는 방식(GTA류)도 있지만, 저해상 RT를 회전시키면 재샘플 블러가 끼고 마커 좌표계까지 매 프레임 회전을 태워야 한다. 맵은 고정하고 플레이어 화살표만 `SetRenderTransformAngle(Yaw)`로 돌리면 — 캡처 규약상 이미지 위쪽이 월드 +X(북)라서 **yaw 값을 각도로 그대로 쓴다.** 변환 코드가 없는 게 아니라, 규약을 맞춰서 변환이 항등이 된 것이다. 23편의 수식 항등과 같은 계열의 단순화다.

이 UV 규약(U=+Y, V=-X)은 캡처 액터 주석·위젯 C++·머티리얼 세 곳이 공유하는 계약이라, 헤더 주석에 "변경 시 3곳 동기화"를 박아 뒀다.

---

## 3. 마커 — 색이 한 번 뒤집힌 이야기

지도가 떴으니 본론인 **문제 머신 표시**다. 판별은 매 틱이 아니라 0.5초 주기다(위치 갱신만 매 틱):

```cpp
	for (const FMachineNode& Node : FactoryManager->GetMachineNodes())
	{
		AMachineBase* Machine = Node.MachineActor.Get();
		if (!Machine)
		{
			continue;
		}

		const EMachineState State = Machine->GetMachineState();
		const bool bPowerIssue = (State == EMachineState::NoPower);
		const bool bFaultIssue =
			Machine->isBroken() ||
			State == EMachineState::Blocked ||
			State == EMachineState::Disabled;
		if (!bPowerIssue && !bFaultIssue)
		{
			continue;
		}

		FMinimapProblemMarker Marker;
		Marker.Machine = Machine;
		// 고장은 수리 전엔 전력 넣어도 안 돌아가므로 선행 과제 — 고장 색 우선.
		Marker.Color = bFaultIssue ? FaultIssueColor : PowerIssueColor;
		ProblemMarkers.Add(Marker);
	}
```

*(UUI_Minimap::RefreshProblemMarkers 발췌)*

색 체계는 첫 커밋과 둘째 커밋 사이에 뒤집혔다. 처음엔 에이전트 디버그 하이라이트(말풍선 쪽)의 색을 그대로 계승해 전력=Cyan/고장=Yellow였는데, PIE에서 보니 "위험한 것 = 빨강"이라는 직관과 어긋났다. 그래서 미니맵 고유 체계로 재정의:

```diff
- // 에이전트 디버그 하이라이트(UI_DialogueBalloon) 색 계승 — 전력=Cyan, 고장/막힘=Yellow.
- const FLinearColor PowerIssueColor = FLinearColor(0.0f, 1.0f, 1.0f, 1.0f);  // Cyan
- const FLinearColor FaultIssueColor = FLinearColor(1.0f, 1.0f, 0.0f, 1.0f);  // Yellow
+ // 전력=Yellow, 고장/막힘=Red — 디버그 하이라이트와 다른 미니맵 고유 체계.
+ const FLinearColor PowerIssueColor = FLinearColor(1.0f, 1.0f, 0.0f, 1.0f);  // Yellow
+ const FLinearColor FaultIssueColor = FLinearColor(1.0f, 0.0f, 0.0f, 1.0f);  // Red
```

같은 커밋에서 삼항의 방향도 `bPowerIssue ?` → `bFaultIssue ?`로 뒤집었다. 한 머신이 전력 부족이면서 고장일 때 어느 색을 이길 것인가 — 고장은 수리 전엔 전력을 넣어도 안 돌아가는 선행 과제라 빨강이 이긴다. **게임 규칙(수리가 급전에 선행한다)이 색 우선순위로 인코딩**된 것이다.

그리고 이 PR의 제목값을 하는 부분 — **시야 밖 내비게이션**. 문제 머신이 미니맵 원 밖에 있으면 마커를 지우는 게 아니라, 방향을 유지한 채 가장자리에 세운다:

```cpp
	// 월드 델타 → 위젯 로컬(중앙 원점). 배경 UV 규약과 동일 축: 화면 +x=월드+Y, 화면 -y=월드+X.
	const FVector MachineLocation = Machine->GetActorLocation();
	FVector2D Offset(
		(MachineLocation.Y - PlayerXY.Y) * PixelsPerUU,
		-(MachineLocation.X - PlayerXY.X) * PixelsPerUU);

	// 시야 원 밖이면 방향 유지한 채 가장자리에 세운다 — 내비게이션 핵심.
	if (Offset.SizeSquared() > FMath::Square(ClampRadius))
	{
		Offset = Offset.GetSafeNormal() * ClampRadius;
	}
```

*(UUI_Minimap::UpdateMarkerPositions 발췌)*

`GetSafeNormal() * ClampRadius` 한 줄이 "저쪽에 문제 있음" 화살표 역할을 한다. 맵 반대편의 고장 머신도 빨간 점이 원 테두리에 붙어 방향을 가리키니, 그쪽으로 달리면 된다. 마커 좌표 변환이 배경 UV와 같은 축 규약을 쓰기 때문에 배경과 마커가 어긋날 일도 없다.

![원형 미니맵에 노란색(전력)·빨간색(고장) 문제 마커가 찍힌 상태. 북·서·동·남 방위는 고정이다](/images/blog/factory-sim/s30-minimap.webp)

마커 위젯은 풀링한다 — 문제 머신 수가 갱신마다 요동쳐도 위젯을 생성/파괴하지 않고, 모자라면 만들어 풀에 넣고 남으면 `Collapsed`로 눕힌다. 27편의 프록시가 "연출은 끝나면 버린다"였다면, 매 0.5초 갱신되는 마커는 "버리지 않고 재운다"가 맞다.

---

## 4. 통합 — 남의 HUD에 무접점으로

마지막은 이 위젯을 화면에 올리는 일이다. 메인 HUD(팀원 소유)에 칸을 파 달라고 할 수도 있었지만, 전편의 경계 원칙대로 **무접점**으로 갔다 — 미니맵은 별도 뷰포트 위젯으로 `AddToViewport`되고, 메인 HUD와는 픽셀 하나 공유하지 않는다. 위젯 클래스(`MinimapWidgetClass`)는 플레이어 BP에서 할당하고, 미할당이면 미니맵 없이 정상 진행이다.

토글 키는 N이다. M(map의 M)이 자연스럽지만 — M은 이미 AI 오퍼레이터 요청 기능(팀원 C 소유)에 선점되어 있었다. 겹쳐 바인딩하면 미니맵을 여닫을 때마다 AI 요청이 발사된다. 헤더 주석에 그 사연과 "M으로 바꾸려면 팀원과 키 이관 합의 필요"까지 적어 두고 N으로 갔다. 키보드도 공유 자원이고, 공유 자원엔 장부가 필요하다.

토글 상태는 플래그 하나가 단일 진실원이다:

```cpp
void AOJJ_Player::ToggleMinimap()
{
	if (!MinimapWidgetInstance)
	{
		return;
	}

	// 플래그가 단일 진실원 — 빌드모드(위젯 강제 Collapsed) 중에도 사용자 의사는 여기 누적되고,
	// 실제 표시는 빌드모드가 아닐 때만 반영(이탈 복원 로직과 동일 기준).
	bMinimapHiddenByUser = !bMinimapHiddenByUser;

	const bool bInBuildMode = BuildController && BuildController->IsInBuildMode();
	if (!bInBuildMode)
	{
		MinimapWidgetInstance->SetVisibility(
			bMinimapHiddenByUser ? ESlateVisibility::Collapsed : ESlateVisibility::SelfHitTestInvisible);
	}
}
```

*(AOJJ_Player::ToggleMinimap)*

빌드모드에 들어가면 미니맵은 HUD와 함께 강제로 숨는다. 이때 사용자가 N을 눌러도 위젯은 안 건드리고 **의사만 플래그에 누적**한다 — 빌드모드에서 나올 때 복원 로직이 이 플래그를 보고, 사용자가 꺼 둔 미니맵은 다시 켜지 않는다. "시스템이 숨긴 것"과 "사용자가 끈 것"을 한 변수로 뭉개면 이탈 복원 때 사용자 의사를 덮어쓰게 된다.

여담 — 이 PR에는 미니맵과 무관한 곁가지가 하나 실려 있다. 17편 사다리의 올라서기 몽타주 게이트(`FinishTriggerDistance`)를 BP 인스턴스 값으로 150→95로 낮춰, 3칸짜리 짧은 사다리에서도 올라서기 애니가 재생되게 한 튜닝이다. C++ 기본값은 150 그대로라 소스 diff에는 안 보이고 에셋 변경으로만 남았다.

---

## 5. 정리 — 지도의 비용은 갱신 주기가 정한다

미니맵에서 한 것 —

- 그리드 전체를 **직교 원샷 캡처**(RT 2048², 시작 1회 + 10초 주기)로 굽고, 프레임 단위 캡처 비용 0
- 확대·이동은 **머티리얼 UV 창**(WindowCenter/WindowSize 파라미터 2개)에 위임, ShowFlags로 안개·파티클·광택 차단(수면 글린트 앨리어싱 후일담)
- **북쪽 고정 + 화살표만 회전** — 규약을 맞춰 좌표 변환을 항등으로
- 문제 머신 마커: 0.5초 주기 판별, 전력=Yellow/고장=Red(선행 과제 우선으로 삼항 뒤집기), **가장자리 클램프**로 시야 밖 내비게이션, 위젯 풀링
- 메인 HUD와 무접점 통합, M키 선점 사연 끝에 N키 토글 + "사용자가 끈 것" 플래그 분리

교훈은 두 줄이다.

**갱신 주기를 데이터의 변화 속도에 맞춰라.** 지형은 거의 안 변하니 10초, 문제 상태는 천천히 변하니 0.5초, 플레이어 위치는 매 프레임 변하니 매 틱 — 대신 그 매 틱의 일은 파라미터 두 개 공급으로 줄여 놓는다. "전부 매 프레임"은 설계가 아니라 기본값일 뿐이다.

**직관과 충돌하는 일관성은 일관성이 아니다.** 디버그 색을 계승한 건 일관성 있는 결정처럼 보였지만, 미니맵에서 "위험=빨강"을 이기지 못했다. 같은 데이터라도 보는 맥락이 다르면 색의 의미가 달라진다 — 체계는 화면 단위로 세우고, 우선순위에는 게임 규칙을 실어라.

다음 편부터는 귀를 연다. 서른 편 내내 화면 이야기만 했는데, 이 공장은 아직 걸어도 발소리가 없다 — 모래·금속·물을 걸음마다 구분하는 발소리와 강변을 따라오는 물소리를, PhysMat 없이 게임이 이미 아는 것으로 만든 이야기.

---

*이 글은 factory-space(UE5.7, C++) 미니맵 작업(2026-07-04, PR #510)을 정리한 것입니다. 코드 스니펫은 실제 구현에서 발췌했으며, 가독성을 위해 일부 축약했습니다. 협업자는 익명 처리했습니다.*
