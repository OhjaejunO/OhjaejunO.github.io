---
title: "공장 시뮬레이션 게임 개발기 — 캐릭터 애니메이션: ABP는 그리고, C++는 게터 하나만 내민다"
description: "임포트한 AI 생성 애니메이션 8종으로 시작해 스프린트·점프·낙하·수영까지, 캐릭터 애니메이션 한 달치를 하나의 패턴이 관통한다 — 스테이트머신은 ABP가 그리고, C++는 BlueprintPure 게터 하나만 내민다. 점프는 IsFalling이 한 박자 늦어서 슬롯 동적 몽타주로 스테이트머신 출력을 덮었고, 낮은 턱에서 점프 포즈가 튀어나와 낙하 속도 임계를 세웠고, 수영은 MOVE_Swimming이 PhysicsVolume 없이는 즉시 되돌아온다는 걸 로그로 확인하고 MOVE_Flying 부유로 갔다. 애니메이션 시스템을 설계가 아니라 증상 대응의 연속으로 쌓아 온 기록."
date: 2026-07-07
category: UE5
series: factory-sim
seriesPart: 25
tags: [UE5, C++, 애니메이션, ABP, 몽타주, 수영]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — 캐릭터 애니메이션**
> - 19편: [게임 진입: 캐릭터 선택부터 인트로 연출까지](/blog/factory-sim/19-game-entry-character-intro)
> - 24편: [카메라 대장정 — 세 개의 시점과 3,848ms의 청구서](/blog/factory-sim/24-camera-saga)
> - **25편: 캐릭터 애니메이션 — ABP는 그리고, C++는 게터 하나만 내민다** ← 현재 글

카메라 대장정을 썼으니 이번엔 그 카메라가 찍고 있는 대상 차례다. 캐릭터 애니메이션도 한 달에 걸쳐 조금씩 쌓였는데, 돌아보니 전부 하나의 패턴으로 수렴해 있었다. **스테이트머신은 ABP(Animation Blueprint)가 에디터에서 그리고, C++는 판정용 `BlueprintPure` 게터 하나만 내민다.**

먼저 한계부터 고백하면 — ABP는 바이너리 에셋이라 diff가 안 된다. 이 글의 스테이트머신 구조 서술은 커밋 메시지, C++ 게터, BlendSpace 이름에서 역산한 것이고, 코드 인용은 전부 C++ 쪽이다.

---

## 1. 뼈대 — BlendSpace 하나, 그리고 속도만 바꾸는 스프린트

캐릭터와 애니메이션은 Meshy로 생성해 임포트했다(Man 8종, Woman 9종 — Idle/Walk/Run/Jump 등). 이동 애니의 뼈대는 `ABP_Man` + `BS_Man_Locomotion`, 속도 축 BlendSpace로 Idle→Walk→Run을 보간하는 표준 구성이다.

여기서 첫 패턴이 나온다. Shift 스프린트는 **애니메이션 상태가 아니다.** C++는 이동 속도만 바꾼다:

```cpp
void AOJJ_Player::StartSprint(const FInputActionValue& Value)
{
	if (UCharacterMovementComponent* Movement = GetCharacterMovement())
	{
		Movement->MaxWalkSpeed = SprintSpeed;
	}
}

void AOJJ_Player::StopSprint(const FInputActionValue& Value)
{
	if (UCharacterMovementComponent* Movement = GetCharacterMovement())
	{
		Movement->MaxWalkSpeed = WalkSpeed;
	}
}
```

속도가 250에서 600으로 오르면 BlendSpace가 알아서 Run 샘플 쪽으로 이동한다. C++가 애니메이션을 지시하지 않고, 애니메이션이 물리 상태를 관찰한다.

입력 바인딩에는 방어 코드가 한 줄 있다:

```cpp
	EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Completed, this, &AOJJ_Player::StopSprint);
	// Hold/Chord 트리거가 붙어 뗌이 Completed 대신 Canceled로 와도 질주가 안 남도록 함께 바인딩.
	EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Canceled, this, &AOJJ_Player::StopSprint);
```

Enhanced Input에서 뗌 이벤트는 상황에 따라 `Completed`가 아니라 `Canceled`로 올 수 있다. 한쪽만 바인딩하면 Shift를 누른 채 다른 모드로 전환했을 때 영구 질주가 남는다.

캐릭터가 둘(Man/Woman)이 되면서 이 뼈대는 스왑 가능해졌다 — 19편의 캐릭터 선택이 고른 값을 서브시스템이 보존하고, `BeginPlay`에서 SkeletalMesh와 AnimClass를 통째로 갈아 끼운다. 리타겟한 Woman은 Idle에서 발이 10.46uu 떠 있어서 hips를 -10 보정하는 식의 접지 손질이 캐릭터별 DataAsset으로 들어갔다.

---

## 2. 패턴의 원조 — 사다리 IsClimbing

이 시리즈의 17편(사다리)에서 이미 등장했던 게터가 사실 이 글 전체의 원형이다.

```cpp
	UFUNCTION(BlueprintPure, Category = "Climb")
	bool IsClimbing() const { return bClimbing; }
```

당시 커밋 메시지가 원칙을 그대로 문장으로 남겼다 — *"ABP_Man climbing 스테이트머신 진입/탈출 조건용 BlueprintPure 게터. 방향/속도는 새 변수 없이 ABP가 Velocity.Z로 판별(위>0 Loop, 아래<0 Down) — 노출 최소화."*

C++는 "지금 등반 중인가"라는 불리언 하나만 답하고, 오르는 중인지 내리는 중인지는 ABP가 이미 갖고 있는 Velocity로 판별한다. 노출을 최소화하면 C++와 ABP 사이의 계약이 얇아지고, 계약이 얇으면 어느 쪽을 고쳐도 상대가 안 깨진다. 이후의 점프·낙하·수영이 전부 이 계약 형태를 복제한다.

---

## 3. 점프 — IsFalling은 한 박자 늦다

점프 애니메이션에 피드백이 왔다(#357). 증상은 명확했다: **점프 키를 누르면 캐릭터가 선 채로 떠오른 뒤에야 점프 포즈가 나온다.**

원인은 ABP 스테이트머신의 진입 조건이었다. 점프/낙하 상태는 `IsFalling`으로 진입하는데, `IsFalling`은 **발이 땅에서 떨어진 뒤에야** true가 된다. 입력 프레임과 애니메이션 프레임 사이에 물리적으로 한 박자가 낀다.

스테이트머신 전이를 빠르게 만드는 대신, **전이를 기다리지 않는 층**을 하나 얹었다 — 점프 입력 순간 슬롯 동적 몽타주로 스테이트머신 출력을 덮는다. 사다리에서 쓰던 슬롯 패턴의 재사용이고, 스테이트머신은 한 노드도 안 바뀐다.

```cpp
	// [#357 P2-①] 점프가 실제 수락될 때만 슬롯 애니를 재생하려면 CanJump()를 Jump() '전에' 판정한다(Jump()이
	// bPressedJump 등 상태를 바꾸기 전, 깨끗한 지상 상태 기준). 공중 재입력(이미 점프 중/낙하 중 추가 점프 불가)은
	// Jump()이 no-op이라 — 이 가드가 없으면 가짜 공중 점프 애니가 나간다(codex P2-①).
	const bool bJumpAccepted = CanJump();

	Jump();

	if (bJumpAccepted && JumpAnim)
	{
		if (UAnimInstance* AnimInstance = GetMesh() ? GetMesh()->GetAnimInstance() : nullptr)
		{
			// 인자: BlendIn/Out + PlayRate 1 / LoopCount 1 / BlendOutTrigger -1(끝에서 자동) / StartPosition(준비동작 스킵).
			// [P2-②] 반환 핸들을 직접 캐시(UE5.7은 UAnimMontage* 반환) → Landed에서 이 몽타주만 정지.
			ActiveJumpMontage = AnimInstance->PlaySlotAnimationAsDynamicMontage(
				JumpAnim, TEXT("DefaultSlot"), JumpAnimBlendInTime, JumpAnimBlendOutTime,
				1.0f, 1, -1.0f, JumpAnimStartPosition);
		}
	}
```

*(주석 일부 축약)*

`PlaySlotAnimationAsDynamicMontage`는 몽타주 에셋 없이 시퀀스를 즉석에서 슬롯에 올려 주는 API라, 애니메이션 하나마다 몽타주 에셋을 만들 필요가 없다. 다만 통짜 시퀀스 하나로 점프를 표현하는 데는 보정이 세 개 필요했다.

- **준비동작 스킵** — 시퀀스 앞부분의 무릎 구부림 구간을 `StartPosition 0.3초`로 건너뛴다. 물리 점프는 이미 시작됐는데 애니가 웅크리면 2단 점프처럼 보인다.
- **착지 정지** — `Landed()`에서 몽타주를 끊는다. 안 끊으면 착지 후에도 시퀀스 잔여분이 재생되며 서서 미끄러진다.
- **수락 게이트와 핸들 캐시** — 위 코드의 두 주석. 공중 재입력에 가짜 애니가 나가는 것과, 정지할 때 엉뚱한 몽타주를 잡는 것 — 둘 다 Codex 교차 리뷰에서 잡혔다.

---

## 4. 낙하 임계 — 낮은 턱에서 점프 포즈가 나온다

점프를 고치고 나니 새 제보가 왔다(#368): **낮은 턱을 내려가기만 해도 점프 포즈가 튀어나온다.**

이슈를 쓰면서 먼저 한 일이 용의자 분리였다. 3장의 슬롯 몽타주는 `StartJumpAction + CanJump()` 게이트라 지상 점프 입력에서만 재생된다 — 코드로 확인했고, 이 증상과 무관하다. 범인은 ABP 내부의 falling 전이다. 턱을 내려가는 짧은 순간에도 `IsFalling`이 잠깐 true가 되고, 스테이트머신이 성실하게 낙하 상태로 진입한 것.

"떨어지고 있는가"가 아니라 **"낙하 애니를 틀 만큼 떨어지고 있는가"**를 물어야 했다. 게터 패턴 그대로 하나 더:

```cpp
bool AOJJ_Player::ShouldPlayFallAnim() const
{
	// [#368] ABP 점프/falling 상태 진입 게이트 — raw IsFalling은 낮은 턱 내려갈 때도 잠깐 true라 점프 포즈가
	// 뜬다. 하강 중(IsFalling)이면서 하강 속도가 임계 초과(Velocity.Z < -임계)일 때만 진짜 낙하로 본다.
	// ⚠️ Velocity.Z 부호: 하강 = 음수. 낮은 턱(짧은 낙하)은 착지 전 속도가 작아 false → 진입 안 함.
	const UCharacterMovementComponent* Move = GetCharacterMovement();
	return Move && Move->IsFalling() && Move->Velocity.Z < -FallAnimVelocityThreshold;
}
```

임계는 400uu/s(PIE에서 확정). 낮은 턱은 착지 전에 이 속도에 못 미쳐서 false다. ABP 쪽 작업은 전이 조건 노드를 `Is In Air`에서 이 게터로 교체하는 것뿐이었다.

높이가 아니라 속도로 자른 게 포인트다. 높이 판정은 바닥까지 트레이스가 필요하지만, 속도는 CMC가 이미 알고 있다 — 낙하 높이는 어차피 속도에 적분되어 있다.

---

## 5. 수영 — MOVE_Swimming이 아니라 MOVE_Flying인 이유

22편에서 맵에 진짜 강이 생겼으니, 캐릭터가 빠지면 수영을 해야 한다.

정석은 `MOVE_Swimming`이다. 그런데 이 모드는 **`bWaterVolume`이 설정된 PhysicsVolume 안에서만 유지된다** — 볼륨이 없으면 CMC가 모드를 즉시 되돌린다(로그로 확인했다). 우리 강은 Water 플러그인의 WaterBodyRiver라 수영 볼륨이 따로 없고, 강 모양대로 볼륨을 수동 배치하는 건 웅덩이 시절로의 회귀다.

그래서 `MOVE_Flying`으로 갔다. 볼륨이 필요 없고 무중력이라, 수면 높이는 우리가 직접 클램프하면 된다.

```cpp
		if (!bSwimming)
		{
			// #1 진입: 수심이 충분히 깊을 때만(얕은 곳 즉시 진입 방지). 보행/낙하서만.
			if ((MM == MOVE_Walking || MM == MOVE_Falling) && WaterDepth >= SwimEnterWaterDepth)
			{
				Move->SetMovementMode(MOVE_Flying);  // volume 불필요·무중력 → 정착 안정 + 클램프와 안 싸움
				Move->RotationRate = FRotator(0.f, SwimRotationRateYaw, 0.f);
				Move->MaxFlySpeed = SwimMaxFlySpeed;
				bSwimming = true;
			}
		}
```

수면 유지는 캡슐 Z를 수면 기준 오프셋으로 보간하고 수직 속도를 죽이는 것으로:

```cpp
		const float TargetZ = SurfaceZ + (bSwimMoving ? SwimMoveOffsetZ : SwimIdleOffsetZ);
		FVector Loc = GetActorLocation();
		const float Alpha = FMath::Clamp(SwimSurfaceLerpSpeed * DeltaSeconds, 0.0f, 1.0f);
		Loc.Z = FMath::Lerp(Loc.Z, TargetZ, Alpha);
		SetActorLocation(Loc, /*bSweep=*/true);
		FVector V = Move->Velocity;
		V.Z = 0.0f;                 // MOVE_Flying 수직 입력 무력화 → 수면 고정
		Move->Velocity = V;
```

*(진입 판정 함수 중 발췌 — 이탈/디바운스 분기 생략)*

경계 떨림은 전부 히스테리시스로 눌렀다. 수심은 강바닥 라인트레이스로 실측하고, **진입 90 / 이탈 70**으로 문턱을 어긋나게 둬서 수면 언저리에서 수영이 켜졌다 꺼졌다 하지 않는다. idle/move 오프셋 전환도 속도 60/30 히스테리시스. ABP 연동은 물론 게터 두 개 — `IsSwimming()` / `IsSwimMoving()` — 뿐이고, 전진/정지 구분은 역시 ABP가 Velocity로 판별한다.

마지막 버그는 구면이 있는 놈이었다. 전진 수영을 멈추면 캐릭터가 **앞으로 갔다가 스르륵 되돌아왔다.** Meshy산 `Swim_Forward` 시퀀스의 Hips(root)에 전진 이동이 박혀 있어서, Root Motion이 꺼진 상태에서 캡슐은 안 밀리는데 메시만 앞으로 드리프트하다가, 정지 시 Idle 블렌드가 중립으로 되돌린 것. 사다리 Climb Loop에서 Hips가 위로 상승하던 것과 똑같은 구조(축만 수직→전진)라 처방도 같았다 — ABP 수영 상태에 Transform (Modify) Bone을 꽂아 Hips를 고정한다. 젓는 모션(로컬 회전)은 살고, 실제 이동은 코드가 담당하니 잃는 게 없다.

---

## 6. 정리 — 계약이 얇아야 애니메이션이 산다

한 달치 캐릭터 애니메이션에서 한 것 —

- locomotion은 BlendSpace, 스프린트는 애니 상태가 아니라 **MaxWalkSpeed 토글** (+ Canceled 바인딩)
- C++ ↔ ABP 계약은 `BlueprintPure` 게터로 최소화 — `IsClimbing` 원조에서 `ShouldPlayFallAnim`·`IsSwimming`·`IsSwimMoving`으로 복제
- 점프는 스테이트머신 전이를 기다리지 않고 **슬롯 동적 몽타주로 출력을 덮기** (`PlaySlotAnimationAsDynamicMontage` + StartPosition 0.3 + Landed 정지)
- 낙하는 높이가 아니라 **속도 임계**(400)로 판정
- 수영은 `MOVE_Swimming`의 볼륨 의존을 확인하고 **`MOVE_Flying` 부유 + 수면 클램프 + 히스테리시스**로
- AI 생성 애니의 root 오염(Hips 드리프트)은 Transform Modify Bone 고정 — 사다리와 수영에서 같은 처방 두 번

교훈은 두 줄이다.

**C++와 ABP 사이의 계약은 얇을수록 좋다.** 게터 하나면 어느 쪽을 갈아엎어도 상대는 무사하다. 캐릭터를 통째로 스왑하는 기능이 하루 만에 붙을 수 있었던 것도, 계약이 "게터 몇 개"뿐이라 ABP를 갈아 끼워도 C++가 모르기 때문이다.

**엔진의 기본 판정은 물리의 진실이지, 연출의 진실이 아니다.** `IsFalling`은 정확하지만 한 박자 늦고, 낮은 턱에서도 참이다. 연출이 원하는 건 "떨어지는가"가 아니라 "떨어지는 것처럼 보여야 하는가"이고, 그 번역을 어디서 할지(슬롯 몽타주, 속도 임계) 정하는 게 애니메이션 프로그래밍의 일이었다.

다음 편은 행성 이벤트다. 자기폭풍이 몰아치고, 차폐장이 돔을 펼치고 — 그리고 남의 서브시스템과 경계를 긋는 이야기.

---

*이 글은 factory-space(UE5.7, C++) 캐릭터 애니메이션 작업(2026-06-02~07-01, 이슈 #47·#357·#368, PR #89·#331·#463·#475)을 정리한 것입니다. 코드 스니펫은 실제 구현에서 발췌했으며, 가독성을 위해 일부 축약했습니다. ABP 스테이트머신 구조는 바이너리 에셋 특성상 커밋 기록과 C++ 연동 코드에서 역산해 서술했습니다.*
