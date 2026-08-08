---
title: "공장 시뮬레이션 게임 개발기 — 자기폭풍과 차폐장: 남의 서브시스템과 경계를 긋는 법"
description: "자기폭풍이 몰아치면 머신 효율이 떨어지고, 차폐장이 돔을 펼쳐 그 안의 머신을 지킨다 — 기능 설명은 한 줄인데, 구현의 절반은 협업 경계 문제였다. 이벤트 매니저와 머신 베이스는 팀원 소유였고, 내 차폐장이 그 안으로 들어가야 했다. 오버랩 서브시스템을 만들었다가 통째로 버리고 '차폐장은 상태만 소유, 판정은 매니저가 거리로'라는 합의 구조를 헤더 주석에 박제한 과정, 단일 효율값이 서로 덮어쓰던 것을 키별 곱 합성으로 바꾼 modifier 시스템, 생성자 MID 저장 에러로 PR을 반쪽만 머지했던 밤, 그리고 Niagara Kill Box까지 — 경계를 네 번 긋고 네 번 지킨 기록."
date: 2026-07-07
category: UE5
series: factory-sim
seriesPart: 26
tags: [UE5, C++, 행성이벤트, 차폐장, 협업, 머티리얼]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — 행성 이벤트**
> - 13편: [막간: 행성에 밤이 내린다 (지면·낮밤 사이클·절차적 별 돔)](/blog/factory-sim/13-planet-sky-day-night)
> - 25편: [캐릭터 애니메이션 — ABP는 그리고, C++는 게터 하나만 내민다](/blog/factory-sim/25-character-animation)
> - **26편: 자기폭풍과 차폐장 — 남의 서브시스템과 경계를 긋는 법** ← 현재 글

이 행성에는 자기폭풍이 분다. 폭풍이 몰아치는 동안 머신들의 생산 효율이 떨어지고, 차폐장(Shield Generator)을 지어 두면 반경 안의 머신들은 보호받는다. 기능 설명은 이걸로 끝이다.

그런데 구현 이야기는 여기서부터가 본론이다. 행성 이벤트 매니저(`PlanetEventManagerSubsystem`)와 머신 베이스(`MachineBase`)는 **팀원 소유의 코드**다(이하 팀원 C — 이 글의 커밋·주석 인용에서 실명은 익명 처리했다). 자기폭풍의 발생과 머신 효율은 그쪽 시스템이 관장하는데, 차폐장이라는 내 기능은 그 한복판에 들어가야 한다. 23편에서 남의 벨트 코드에 Z축을 심었다면, 이번엔 남의 이벤트 시스템에 보호 판정을 심는 이야기다.

---

## 1. 첫 시도 — 오버랩으로 세다가, 하루 만에 방향을 틀다

차폐장의 최초 형태는 콜리전이었다. 반경 500짜리 구형 오버랩으로 겹친 머신을 세는 전용 서브시스템까지 만들었다 — 차폐장 입장에서 "내 안에 누가 있는가"를 스스로 관리하는 구조.

문제는 이 구조가 필연적으로 팀원 C의 영역과 겹친다는 것이었다. 폭풍이 시작되고 끝날 때 머신 효율을 만지는 주체는 이벤트 매니저다. 그런데 차폐 여부를 차폐장 쪽 오버랩 상태가 들고 있으면, 매니저는 효율을 적용할 때마다 남의 서브시스템 상태를 조회해야 하고, 오버랩 등록/해제 타이밍과 이벤트 적용 타이밍이 어긋나는 순간 stale 상태가 낀다. 상태의 소유자가 둘이 되는 구조다.

같은 날 저녁, 협의 후 방향을 틀었다. 합의된 경계는 이후 차폐장 헤더의 클래스 주석에 그대로 박제했다:

```cpp
/**
 * 자기폭풍(MagneticStorm) 전용 차폐장(Shield Generator) (OJJ 소유).
 *
 * 본 액터는 "차폐장"으로서 자신의 위치/반경/활성 상태만 소유한다. 실제 보호 판정
 * (어떤 머신이 어느 차폐장 반경 안에 있는가)은 PlanetEventManagerSubsystem이 거리 기반
 * (IsMachineShieldedFromMagneticStorm 등)으로 수행한다 — 팀원과 합의된 구조.
 *
 * 따라서 오버랩/콜리전/태그 관리는 하지 않는다. BeginPlay에서 이벤트 매니저에 자신을
 * 차폐장으로 등록(Register)하고, EndPlay에서 등록 해제(Unregister)할 뿐이다.
 */
```

*(주석 원문 일부 생략, 실명은 익명 처리)*

**차폐장은 위치·반경·활성 상태만 소유하고, "누가 보호받는가"는 이벤트 매니저가 거리로 판정한다.** 오버랩도, 콜리전도, 태그도 없다. 첫 시도의 중첩 카운트 서브시스템은 통째로 삭제했다. 판정 코드는 매니저 쪽에 이렇게 들어갔다:

```cpp
bool UPlanetEventManagerSubsystem::IsMachineShieldedFromMagneticStorm(const AMachineBase* Machine) const
{
	if (!Machine)
	{
		return false;
	}

	// [L5/L6] 무효 weak 항목은 스킵만 하고 purge하지 않으며, 재평가는 O(머신×차폐장).
	// 현 규모(단일플레이·소수 차폐장)에선 충분 — 차폐장 다수화 시 purge/공간분할 최적화 검토.
	const FVector MachineLocation = Machine->GetActorLocation();
	for (const TWeakObjectPtr<AOJJ_ProtectionTower>& WeakShield : RegisteredShields)
	{
		const AOJJ_ProtectionTower* Shield = WeakShield.Get();
		if (!Shield || !Shield->IsShieldActive())
		{
			continue; // 무효(파괴)·비활성 차폐장은 스킵.
		}

		const float Radius = Shield->GetShieldRadius();
		if (FVector::DistSquared(MachineLocation, Shield->GetActorLocation()) <= FMath::Square(Radius))
		{
			return true;
		}
	}
	return false;
}
```

오버랩 이벤트의 등록/해제 타이밍 문제가 사라지고, 활성 폭풍 동안 매 틱 재평가하므로 차폐장을 끄든 머신을 옮기든 다음 틱에 진실이 맞춰진다. O(머신×차폐장)이지만 규모상 충분하다는 판단까지 주석에 남겼다 — 미래의 내가 "왜 공간분할 안 했지"라고 물을 것에 대한 선답변.

---

## 2. 효율은 곱으로 — modifier 시스템

경계를 긋기 직전에 풀어야 했던 문제가 하나 더 있었다. 기존 머신 효율은 `SetPlanetProductionEfficiency(0.6)` — **단일 멤버값**이었다. 자기폭풍이 0.6을 쓰고, 곧 들어올 전력 시스템이 0.5를 쓰면? 나중에 부른 쪽이 먼저 쓴 값을 덮어쓴다. 감산 요인이 둘이 되는 순간 이 구조는 못 버틴다.

그래서 팀원 C 소유의 `MachineBase`에 **키별 modifier 맵**을 협의하에 추가했다. 최종 효율은 모든 modifier의 곱이다.

```cpp
void AMachineBase::SetEfficiencyModifier(FName Key, float Value)
{
	if (Key.IsNone())
	{
		return; // 빈 키 거부 (F2: 의도치 않은 공유/덮어쓰기 방지)
	}
	if (!FMath::IsFinite(Value))
	{
		return; // NaN/Inf 거부 (F1: 곱 합성 오염 방지)
	}
	// 0 곱(효율 소멸)·무한대 누적 양쪽을 막기 위해 0.01~100.0으로 클램프.
	EfficiencyModifiers.Add(Key, FMath::Clamp(Value, 0.01f, 100.0f));
}

float AMachineBase::GetFinalEfficiency() const
{
	float Final = 1.0f;
	for (const TPair<FName, float>& Modifier : EfficiencyModifiers)
	{
		Final *= Modifier.Value;
	}
	return FMath::Max(0.01f, Final);
}
```

자기폭풍 0.6 × 전력 부족 0.5 = 0.3 — 요인이 몇 개가 되든 서로를 덮어쓰지 않는다. 기존 함수는 삭제하는 대신 MagneticStorm 키로 위임하는 DEPRECATED 껍데기로 남겨서, 남의 코드에 추가한 시스템이 기존 호출부를 깨지 않게 했다. 폭풍이 끝나면 값을 1.0으로 되돌리는 게 아니라 **키를 Clear**한다 — "효율을 복구한다"가 아니라 "감산 요인이 소멸한다"가 맞는 모델이다.

---

## 3. 실드 돔 — 머티리얼은 완성됐는데 저장이 안 된다

기능이 돌아가니 다음은 비주얼이다. 차폐장이 일하고 있다는 걸 눈으로 보여 주는 에너지 실드 돔 — 육각 그리드 + Fresnel 엣지 글로우 + DepthFade 경계 + Z 스캔라인을 합성한 반투명 Unlit 머티리얼을 UE Python 커맨드렛으로 생성했다(22편 랜드스케이프, 다음 편 홀로그램과 같은 "머티리얼을 코드로 굽는" 계열이다).

그런데 돔 컴포넌트를 차폐장 블루프린트에 붙이자 **에셋 저장이 에러로 막혔다.** "private 참조" — 어디선가 동적 머티리얼 인스턴스(MID)가 에셋에 직렬화되려 하고 있었다. 추적해 보니 원인은 내 돔이 아니라 부모였다. 차폐장은 그리드 배치를 위해 `AMachineBase` 파생인데, 그 `MachineBase`(팀원 C 영역)가 생성자/OnConstruction 시점에 상태 표시용 MID를 만들고 있었고, 그 MID가 내 블루프린트의 저장을 막은 것이다.

남의 코드가 원인인 저장 버그 — 여기서도 경계 원칙대로 갔다. 그날 밤 PR은 **안전하게 완성된 것(머티리얼·텍스처)만 반쪽 머지**하고, PR 본문에 원인 분석과 "합의 후 MID를 런타임으로 이동 필요"를 명시해 두었다. 다음 날 합의를 거쳐 MID 생성을 `BeginPlay` 이후로 옮기는 수정이 별도 커밋으로 들어갔고, 그제야 돔이 완성됐다. (생성자에서 MID를 만들면 안 되는 이유는 다음 편에서 다른 사건으로 한 번 더 등장한다.)

돔 연출 자체는 blend가 전부다. 폭풍이 시작되면 7.5초에 걸쳐 펼쳐지고, 끝나면 10.5초에 걸쳐 걷힌다:

```cpp
	const bool bTargetShow = bShowShieldDome || (bMagneticStormActive && IsShieldActive());
	const float TargetAlpha = bTargetShow ? 1.0f : 0.0f;
	const bool bBlendingIn = TargetAlpha > ShieldVisualAlpha;
	const float BlendSeconds = bBlendingIn ? ShieldBlendInSeconds : ShieldBlendOutSeconds;
	const float BlendInterpSpeed = BlendSeconds > KINDA_SMALL_NUMBER ? (4.0f / BlendSeconds) : 4.0f;
	ShieldVisualAlpha = FMath::FInterpTo(ShieldVisualAlpha, TargetAlpha, DeltaSeconds, BlendInterpSpeed);

	const float SmoothedAlpha = FMath::InterpEaseInOut(0.0f, 1.0f, ShieldVisualAlpha, 3.0f);
	const float DomeScale = (GetShieldRadius() / 50.0f) * FMath::Lerp(0.05f, 1.0f, SmoothedAlpha);
	ShieldDomeComponent->SetRelativeScale3D(FVector(DomeScale));
```

*(UpdateDomeVisual 발췌)*

돔 스케일이 `GetShieldRadius() / 50`인 게 중요하다 — **판정에 쓰는 반경과 화면에 보이는 돔이 같은 값 하나에서 나온다.** 반경은 500에서 시작해 700을 거쳐 최종 1200uu(12칸)로 커졌는데, 값이 세 번 바뀌는 동안 판정과 비주얼이 어긋난 적이 없다. 단일 출처의 힘이다.

<video autoplay muted loop playsinline src="/videos/blog/factory-sim/b26-dome.mp4"></video>

---

## 4. Kill Box — 돔 안에는 폭풍이 들이치면 안 된다

돔이 생기니 새로운 어색함이 보였다. 자기폭풍 파티클(Niagara)이 **돔을 뚫고 안까지 쏟아진다.** 보호받고 있다는 시각적 약속이 깨진다.

해법은 파티클 쪽에 차폐장의 존재를 알려 주는 것 — 가장 가까운 활성 차폐장의 중심/반경을 Niagara User 파라미터(`User.ShieldCenter`, `User.ShieldRadius`)로 주입하고, 이펙트가 그 구 내부의 파티클을 죽인다. 주입은 폭풍을 관장하는 낮밤 컨트롤러 Tick에서 0.25초 스로틀로.

여기서도 경계 원칙이 한 번 더 시험대에 올랐다. 활성 차폐장 목록은 이벤트 매니저의 `RegisteredShields`가 이미 들고 있다 — 그걸 읽으면 편하다. 하지만 그건 판정용으로 합의된 매니저 내부 상태다. 연출을 위해 남의 내부 컨테이너에 손을 대는 대신, **내 소유 코드에서 `TActorIterator`로 차폐장 액터를 자체 순회**했다:

```cpp
	// 가장 가까운 "활성" 차폐장 탐색. 매니저 서브시스템을 건드리지 않고 OJJ 액터를 자체 순회.
	const AOJJ_ProtectionTower* NearestShield = nullptr;
	float NearestDistSq = TNumericLimits<float>::Max();
	for (TActorIterator<AOJJ_ProtectionTower> It(World); It; ++It)
	{ ... }
```

*(주석의 실명 익명 처리, 루프 내부 생략)*

순회가 한 번 더 도는 비용과, 남의 서브시스템에 연출용 의존이 생기는 비용 — 저울질하면 전자가 싸다. 경계는 한 번 긋는 게 아니라 매번 지키는 것이었다.

덧붙여, 전력망의 연결 시각화(전선 통전 발광·펄스, `IsElectricallyConnected` 계열)는 **팀원 C가 만든 영역**이라 이 글에서는 다루지 않는다. 내 쪽 기여는 그 옆의 작은 재사용 하나 — 빌드모드에서 송전탑을 들면 공급 반경(700uu)이 노란 플라즈마 구로 표시되는데, 이건 차폐장 돔 패턴(Sphere 메시 + 스케일=반경/50)을 그대로 옮겨 심은 것이다.

---

## 5. 정리 — 경계는 문서가 아니라 코드에 남긴다

자기폭풍·차폐장에서 한 것 —

- 오버랩/중첩 카운트 서브시스템 → 하루 만에 폐기, **"차폐장은 상태만, 판정은 매니저가 거리로"** 합의 구조로 전환 (`DistSquared` + 매 틱 재평가)
- 단일 효율값 → **키별 modifier 곱 합성** (NaN/0곱 가드, 폭풍 종료 = Set(1.0)이 아니라 Clear)
- 에너지 실드 머티리얼 코드 생성 → 부모 클래스의 생성자 MID 저장 버그에 막혀 **PR 반쪽 머지 + 합의 후 런타임 이동**
- 돔 반경/판정 반경 단일 출처 (500→700→1200 변경에도 무사고)
- Niagara Kill Box — 매니저 내부 상태 대신 자체 순회로 경계 유지

이번 편의 교훈은 하나로 모인다. **합의는 대화에서 이뤄지지만, 살아남는 건 코드에 박힌 합의뿐이다.** "차폐장은 판정하지 않는다"는 문장은 회의록이 아니라 헤더의 클래스 주석에 있고, 그 덕에 한 달 뒤의 Kill Box 작업에서도, 송전탑 범위 표시에서도 같은 경계가 자동으로 지켜졌다. 남의 코드에 들어가는 기능일수록 — 무엇을 소유하고 무엇을 소유하지 않는지를 주석 한 문단으로 남겨 두는 것이, 그 어떤 아키텍처 문서보다 오래 산다.

다음 편은 건설과 철거의 연출이다. 배치 확정 순간 홀로그램이 아래에서 위로 차오르고, 철거하면 위에서 아래로 무너져 내리는 — 그리고 "이미 Destroy된 액터"에게 연출을 맡길 수 없어 프록시를 세운 이야기.

---

*이 글은 factory-space(UE5.7, C++) 자기폭풍·차폐장 작업(2026-06-04~06-29, 이슈 #353, PR #364·#371 외)을 정리한 것입니다. 코드 스니펫은 실제 구현에서 발췌했으며, 가독성을 위해 일부 축약했습니다. 인용한 커밋 메시지·주석의 협업자 실명은 익명 처리했습니다.*
