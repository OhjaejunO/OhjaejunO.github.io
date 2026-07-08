---
title: "공장 시뮬레이션 게임 개발기 — 발소리와 강물: PhysMat 없이, 게임이 이미 아는 것으로"
description: "발소리 표면 판별의 표준 답은 피지컬 머티리얼과 트레이스다. 그런데 이 게임의 표면은 셋뿐이다 — 물, Foundation 금속, 모래. 전 에셋에 PhysMat을 세팅하는 대신 게임이 이미 아는 지식(그리드의 물 질의와 Foundation 커버)을 그대로 재사용했다. 수영 시스템이 발소리를 공짜로 꺼 주는 상태머신의 덕, 착지음과 다이빙을 가르는 수심 90의 임계 공유, 소리 하나가 스플라인을 따라 강변을 미끄러지는 앰비언스, 그리고 '수영 로우패스'의 실체가 코드가 아니라 에셋 베이크였다는 것까지 — 공장에 소리가 깔리기 시작한 첫 편."
date: 2026-07-08
category: UE5
series: factory-sim
seriesPart: 31
tags: [UE5, C++, 사운드, AnimNotify, 발소리, 앰비언스]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — 사운드**
> - 16편: [물 시스템 — 펌프와 파이프](/blog/factory-sim/16-water-system-pump-pipe)
> - 25편: [캐릭터 애니메이션 — ABP는 그리고, C++는 게터 하나만 내민다](/blog/factory-sim/25-character-animation)
> - **31편: 발소리와 강물 — PhysMat 없이, 게임이 이미 아는 것으로** ← 현재 글

지금까지 서른 편 내내 보이는 것 이야기만 했다. 그리드, 컨베이어, 홀로그램, 미니맵 — 화면은 점점 그럴듯해지는데, 걸어 다니면 **아무 소리도 나지 않았다.** 모래 위를 뛰어도, 강물에 뛰어들어도, 철판 위에 착지해도 무음. 이번 편부터 몇 편은 그 침묵을 걷어내는 사운드 이야기다. 첫 타자는 캐릭터와 환경 — 발소리, 착지음, 강물, 수영이다(PR #511, 코드 +343줄).

---

## 1. 발소리 표면 판별 — PhysMat 없이

발소리의 표준 구현은 이렇다: 바닥 머티리얼마다 피지컬 머티리얼(PhysMat)을 세팅하고, 발 닿는 순간 아래로 트레이스를 쏴서 맞은 표면의 PhysMat을 읽는다. 범용적이고 확장성 있는 정석이다.

그런데 이 게임의 발밑 표면은 **셋뿐이다.** 물(강), Foundation(금속 바닥), 그리고 나머지 전부인 모래. 셋을 구분하자고 지형·Foundation·머신 전 에셋에 PhysMat을 세팅하고 트레이스 채널을 관리하는 건 비용이 목적을 초과한다. 결정적으로 — **게임은 이미 그 셋을 알고 있다.** 그리드가 물 질의(16편의 WaterBody 연동)와 Foundation 커버 질의(건축 편들의 장부)를 갖고 있으니까.

그래서 판별 유틸은 이렇게 생겼다. 신규 파일 전문이다:

```cpp
void OJJ_FootstepStatics::PlaySurfaceFootstep(UWorld* World, const FVector& Location,
	USoundBase* SandSound, USoundBase* MetalSound, USoundBase* WetSound, float VolumeMultiplier)
{
	if (!World)
	{
		return;
	}

	// 표면 판별 — 그리드 질의(수영 감지의 그리드 접근 패턴 미러: GetActorOfClass, 실패 시 모래 폴백).
	bool bInWater = false;
	bool bOnFoundation = false;
	if (const AOJJ_Grid* Grid =
			Cast<AOJJ_Grid>(UGameplayStatics::GetActorOfClass(World, AOJJ_Grid::StaticClass())))
	{
		float WaterSurfaceZ = 0.0f;
		bInWater = Grid->OJJ_QueryWaterBodyAt(Location, WaterSurfaceZ);
		if (!bInWater)
		{
			bOnFoundation = Grid->IsCellOnFoundation(Grid->WorldToGrid(Location));
		}
	}

	USoundBase* Sound = bInWater ? WetSound : (bOnFoundation ? MetalSound : SandSound);
	if (!Sound)
	{
		return; // 사운드 미지정 — 무동작(에셋 나중 지정 대비).
	}
	UGameplayStatics::PlaySoundAtLocation(World, Sound, Location, VolumeMultiplier);
}
```

*(OJJ_FootstepStatics.cpp 전문)*

우선순위는 **물 > 금속 > 모래**다. 발이 물에 잠겼으면 그 아래가 뭐든 철벅이고, 물이 아닌데 Foundation 커버 셀이면 금속이고, 그 외 전부 — 그리드가 없는 레벨이든 그리드 밖이든 — 모래 폴백. 월드가 쌓인 레이어 순서가 그대로 판별 순서다.

이 클래스는 `UCLASS`도 BlueprintFunctionLibrary도 아닌 **순수 C++ static 함수 하나**다. 호출자가 C++ 둘(걸음 노티파이, 착지 `Landed`)뿐이라 리플렉션이 필요 없다. 그리고 마지막 가드 — 사운드 미지정이면 조용히 무동작. 이 "미지정 무동작" 관례가 이번 PR의 모든 사운드 프로퍼티에 깔려 있는데, 코드를 먼저 머지하고 사운드 에셋은 나중에 BP에서 붙이는 워크플로를 위한 것이다. 코드와 에셋의 파이프라인이 서로를 기다리지 않는다.

---

## 2. 노티파이 — 그리고 사다리 발소리의 실체

발소리의 트리거는 애님 노티파이다. 걷기/뛰기 시퀀스의 발 닿는 프레임에 `UAnimNotify_OJJ_Footstep`을 심고, 노티파이가 위의 유틸을 부른다. 구현에서 눈여겨볼 것은 **SurfaceOverride** 분기다:

```cpp
	// 캐릭터 메시 컴포넌트는 캡슐 바닥에 오프셋돼 있어 컴포넌트 위치 ≈ 발 위치.
	const FVector FootLocation = MeshComp->GetComponentLocation();

	// 표면 강제 지정(사다리 등반 등) — 그리드 질의 생략, 해당 사운드 즉시 재생.
	if (SurfaceOverride != EOJJFootstepSurface::Auto)
	{
		USoundBase* OverrideSound =
			(SurfaceOverride == EOJJFootstepSurface::Metal) ? MetalSound.Get() : SandSound.Get();
		if (OverrideSound)
		{
			UGameplayStatics::PlaySoundAtLocation(World, OverrideSound, FootLocation, VolumeMultiplier);
		}
		return;
	}

	// 표면 판별+재생 — 공용 유틸(OJJ_FootstepStatics, 착지 Landed와 공유). 우선순위: ①물 ②Foundation ③모래.
	OJJ_FootstepStatics::PlaySurfaceFootstep(
		World, FootLocation, SandSound.Get(), MetalSound.Get(), WetSound.Get(), VolumeMultiplier);
```

*(AnimNotify_OJJ_Footstep.cpp Notify 발췌)*

사다리 발소리는 여기서 나온다 — 그리고 그 실체는 **전용 C++ 클래스가 아니다.** 사다리 등반 시퀀스(17편의 Climb Loop/Finish)에 같은 노티파이를 `SurfaceOverride=Metal` + 전용 사다리 큐로 심은 것, 즉 전부 에셋 레벨 처리다. 등반 중엔 발밑 셀이 사다리와 무관하니(모래 위에 세운 사다리면 그리드는 "모래"라고 답할 것이다) 질의 자체를 생략하고 금속 소리를 고정한다. "여긴 어떤 표면인가"를 묻지 않아도 되는 컨텍스트에는 묻지 않을 스위치를 준 셈이다.

헤더에는 미래의 나에게 남긴 경고가 두 줄 박혀 있다. 원문 그대로:

```cpp
 * ⚠️ BS_Man_Locomotion 블렌드 중 walk/run 시퀀스 노티파이 이중 발화 가능 — 엔진 기본
 *    Trigger Weight Threshold(0.5)가 걸러주는 것에 의존. PIE에서 walk↔run 전환 구간 확인 필요.
 * ⚠️ Meshy 애니 재임포트 시 시퀀스에 심은 노티파이가 소실된다(Man_Idle hips 보정 소실 전례) — 재임포트 후 재심기.
```

첫째는 블렌드스페이스에서 walk와 run 시퀀스가 섞일 때 양쪽 노티파이가 다 발화할 수 있다는 것 — 엔진 기본 임계(가중치 0.5 미만 발화 무시)에 의존하고 있음을 명시했다. 둘째는 25편에서 hips 접지 보정으로 이미 배운 것의 재판이다: **AI 생성 애니메이션을 재임포트하면 시퀀스에 심은 노티파이가 함께 날아간다.** 에셋에 심는 모든 것은 재임포트가 지우개다.

---

## 3. 착지음 — 다이빙과 철벅을 가르는 90

점프 착지음은 노티파이가 아니라 `Landed()` 훅이다(25편의 점프 몽타주 정지와 같은 자리). 그런데 착지에는 발소리에 없는 문제가 하나 있다 — **다이빙.** 깊은 물에 뛰어들면 같은 틱에 수영이 시작되고 수영 루프 사운드가 올라오는데, 거기에 착지음까지 겹치면 이중음이다.

```cpp
	// [착지 발소리] 표면 판별 재생(걸음 노티파이와 공용 유틸). 깊은 물 다이빙(수영 진입 수심 이상)은
	// 이번 틱 수영 진입 + 수영 루프와 겹쳐 이중음 — 스킵. 얕은 물 철벅은 유틸의 Wet 경로가 정상 처리.
	const FVector Loc = GetActorLocation();
	const float FeetZ = Loc.Z - GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
	const FVector FootLocation(Loc.X, Loc.Y, FeetZ);
	bool bDeepWater = bSwimming;
	if (!bDeepWater)
	{
		if (const AOJJ_Grid* Grid =
				Cast<AOJJ_Grid>(UGameplayStatics::GetActorOfClass(GetWorld(), AOJJ_Grid::StaticClass())))
		{
			float WaterSurfaceZ = 0.0f;
			// 착지 순간 발 = 바닥이라 (수면 − 발Z) ≈ 그 지점 수심 — 수영 진입 판정(SwimEnterWaterDepth)과 동일 기준.
			bDeepWater = Grid->OJJ_QueryWaterBodyAt(FootLocation, WaterSurfaceZ)
				&& (WaterSurfaceZ - FeetZ) >= SwimEnterWaterDepth;
		}
	}
	if (!bDeepWater)
	{
		OJJ_FootstepStatics::PlaySurfaceFootstep(GetWorld(), FootLocation,
			LandSandSound, LandMetalSound, LandWetSound, LandVolumeMultiplier);
	}
```

*(AOJJ_Player::Landed 추가분)*

핵심은 임계를 **새로 만들지 않았다**는 것이다. 착지 순간 발은 바닥에 닿아 있으므로 (수면Z − 발Z)가 곧 그 지점의 수심이고, 이건 25편 수영 진입 판정(`SwimEnterWaterDepth = 90`)과 정확히 같은 기준선이다. 그래서 90 이상이면 착지음을 삼키고 수영 루프에 양보, 90 미만 얕은 물이면 유틸의 Wet 경로로 "철벅" 착지음이 나간다. 숫자 하나가 두 시스템(수영 진입, 착지음 스킵)의 경계를 동시에 정의한다 — 숫자를 두 곳에 두면 언젠가 한쪽만 튜닝되고, 그때부터 "물에 들어갔는데 착지음이 났다"류의 미묘한 버그가 산다.

걷기 쪽 얕은 물 처리에도 같은 원리의 공짜 보험이 있다. 깊은 물에서 발소리가 나면 어쩌나 — 걱정할 필요가 없다. 수심 90 이상이면 **수영 애니메이션으로 전환돼 걷기 시퀀스가 안 돌고, 발소리 노티파이 자체가 발화하지 않는다.** 헤더 주석 원문: "수영 중(수심 ≥ SwimEnterWaterDepth)엔 수영 애니로 전환돼 발소리 노티파이 자체가 안 돈다 — 여기 걸리는 건 걷기 유지되는 얕은 물뿐이라 별도 수심 상한 불필요." 상태머신이 조건문을 대신한다.

착지 볼륨은 걸음의 1.2배다 — "착지는 걸음보다 임팩트가 커야 해서"라는 주석과 함께.

---

## 4. 강물 — 소리 하나가 강변을 따라온다

맵에는 22편에서 판 강이 흐른다. 강물 소리를 넣는 순진한 방법은 AmbientSound 액터를 강을 따라 여러 개 배치하는 것 — 배치 노동에, 22편처럼 강 모양을 갈아엎으면 전부 다시 놓아야 한다.

대신 액터 하나를 만들었다. 신규 파일의 전부라 해도 될 핵심 함수:

```cpp
void AOJJ_RiverAmbience::UpdateAudioLocation()
{
	const APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0);
	const UWaterSplineComponent* Spline = TargetRiver ? TargetRiver->GetWaterSpline() : nullptr;
	if (!Player || !Spline || !AudioComponent)
	{
		return;
	}

	const FVector Closest = Spline->FindLocationClosestToWorldLocation(
		Player->GetActorLocation(), ESplineCoordinateSpace::World);
	AudioComponent->SetWorldLocation(Closest);
}
```

*(OJJ_RiverAmbience.cpp)*

엔진 Water 플러그인의 강(WaterBodyRiver)은 스플라인으로 정의된다. 그 스플라인에서 플레이어와 가장 가까운 점을 찾아(`FindLocationClosestToWorldLocation` 한 줄) 오디오 컴포넌트를 그리로 옮긴다 — **소리 하나가 플레이어를 따라 강변을 미끄러진다.** 강에 다가가면 커지고 멀어지면 작아지는 건 Attenuation 에셋이 알아서 한다.

Tick 액터도 아니다. 0.2초 타이머다 — 헤더 주석에 판단 근거까지 적혀 있다: "발원지 점프가 눈에 띄면 낮추기 — 감쇠 반경 대비 플레이어 이동속도면 0.2s 충분." 그리고 강 스플라인을 직접 읽기 때문에 레벨에서 강 모양을 고쳐도 소리가 자동 추종한다. 22편의 수작업 강이 또 바뀌어도 이 액터는 코드 무수정이다.

역할 분리도 명확하다. 루핑은 SoundCue 설정에, 들리는 범위와 페이드는 Attenuation 에셋에, **액터는 "소리를 어디에 둘 것인가"만.** 코드가 안 해도 되는 일은 에셋에 넘긴다.

---

## 5. 수영 루프 — 그리고 "로우패스"의 실체

마지막 조각은 수영 루프다. 물속에서 들리는 먹먹한 물소리 — PR 본문 표현으로 "(수중 로우패스 버전)". 그런데 소스를 아무리 뒤져도 로우패스 필터 코드가 없다. `lowpass`도 `LPF`도 grep 0건.

실체는 이렇다: **로우패스는 런타임 필터가 아니라 사운드 에셋 자체에 베이크되어 있다.** `SwimLoop_Underwater`라는 웨이브가 이미 수중 버전으로 처리된 파일이고, C++이 하는 일은 수영 진입/이탈에 맞춰 Play/Stop 토글뿐이다:

```cpp
void AOJJ_Player::OJJ_SetSwimSoundActive(bool bActive)
{
	// MachineBase RefreshOperatingSound 패턴 — 미지정 무동작 + 상태 변화 시에만 Play/Stop.
	if (!SwimLoopSoundComponent || !SwimLoopSound)
	{
		return;
	}
	if (bActive == bSwimSoundActive)
	{
		return;
	}
	bSwimSoundActive = bActive;
	if (bActive)
	{
		SwimLoopSoundComponent->SetSound(SwimLoopSound);
		SwimLoopSoundComponent->Play();
	}
	else
	{
		SwimLoopSoundComponent->Stop();
	}
}
```

*(OJJ_Player.cpp)*

주석이 말하듯 이 함수는 머신 가동음(MachineBase의 OperatingSound) 패턴의 미러다 — 상주 오디오 컴포넌트 + 상태 변화 시에만 Play/Stop + 중복 방지 플래그. 팀원이 기계에 만들어 둔 사운드 패턴이 캐릭터로 역수입된 것이다. 좋은 패턴은 도메인을 가리지 않는다.

에셋 이야기를 닫으며 — 이번 PR의 사운드 12종은 전부 CC0(Kenney/Fantozzi/freesound)다. 표면당 웨이브 3종 + 큐 구성이라 같은 표면에서도 걸음마다 소리가 미묘하게 다르다(배리에이션은 큐 에셋 소관이라 내부 설정까지는 여기서 확정 못 한다).

---

## 6. 정리 — 소리는 시스템의 증언이다

발소리·강물·수영 사운드에서 한 것 —

- 표면 판별을 PhysMat+트레이스 대신 **게임이 이미 아는 그리드 지식**(물 질의·Foundation 커버)으로 — 우선순위 물 > 금속 > 모래
- 노티파이 `SurfaceOverride`로 질의가 무의미한 컨텍스트(사다리=Metal 고정)를 에셋 레벨에서 처리 — 전용 C++ 없음
- 착지음 다이빙 스킵을 수영 진입 임계(**수심 90uu**)와 공유 — 깊은 물은 수영 루프에 양보, 얕은 물은 철벅
- 강물 소리는 AmbientSound N개 대신 **스플라인 최근접점 추종 1개**(0.2초 타이머) — 강 모양 수정에 자동 추종
- 수영 로우패스는 코드가 아니라 **에셋 베이크** — C++은 Play/Stop 토글만, 머신 가동음 패턴의 미러

교훈은 두 줄이다.

**소리는 새 시스템이 아니라 기존 시스템의 증언으로 만들 수 있다.** 발밑이 물인지 금속인지 게임플레이가 이미 알고 있다면, 사운드는 그 지식을 빌려 쓰면 된다. 새 인프라(PhysMat)는 기존 지식이 답할 수 없을 때 들이는 것이다.

**코드가 안 해도 되는 일은 코드에 넣지 마라.** 루핑은 큐가, 페이드는 감쇠 에셋이, 수중 먹먹함은 웨이브 파일이 안다. C++에 남긴 것은 "언제, 어디서"뿐 — 그래서 이번 PR의 사운드 코드 343줄이 전부 침묵 폴백("미지정 무동작")과 위치·타이밍 계산이다.

이 편은 사운드의 시작일 뿐이다. 그리고 바로 다음 사운드 작업 — 건설·철거·컨베이어에 소리를 붙이는 일 — 의 PR에는 사운드와 무관해 보이는 fix가 하나 끼어 있다. **컨베이어 블루프린트의 저장이 막혀 있었던 것이다.** 에러의 뿌리는 사운드가 아니라 열엿새 전에 심긴 MID였다. 다음 편은 그 저장버그 2부작이다.

---

*이 글은 factory-space(UE5.7, C++) 사운드 시스템 작업(2026-07-04, PR #511, 커밋 e83dc54)을 정리한 것입니다. 코드 스니펫은 실제 구현에서 발췌했으며, 가독성을 위해 일부 축약했습니다.*
