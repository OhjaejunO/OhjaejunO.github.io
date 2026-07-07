# 블로그 26편 소스 수집 — 전력망 · 자기폭풍 · 차폐장

> 수집 대상: `C:\Users\user\Desktop\factory-space` (원격 https://github.com/PU3-Lab/factory-space)
> 수집일: 2026-07-07. 저장소는 읽기 전용으로만 접근함(수정 없음).

---

## ⚠️ 블로그 게재 시 일반화 필요 항목

- **`WANTED_FACTORY_API`** (매크로): 게재 시 삭제하거나 `MYGAME_API` 등으로 일반화. 프로젝트/모듈명(Wanted_Factory) 식별 가능.
- **`Wanted_Factory` 모듈 경로** (`frontend/Source/Wanted_Factory/...`): 경로 노출 시 모듈명 식별 가능 → `Source/<Module>/...` 로 일반화하거나 파일명만 표기.
- **`#include "Wanted_Factory.h"`** (모듈 헤더): 게재 시 생략.
- **`LOG_SSR_W`** 로그 매크로: 팀 내부 매크로. 게재 시 `UE_LOG(LogTemp, Warning, ...)` 등으로 일반화 권장.
- **게재 가능(유지 OK):** `AOJJ_*` 클래스 접두사(예: `AOJJ_ProtectionTower`, `AOJJ_BuildController`, `AOJJ_DayNightController`), `/Game/OJJ/...` 에셋 경로, `M_EnergyShield`/`M_PowerRange_Plasma`/`NS_Magnetic` 등 에셋명 — 1~3편에서 이미 공개됐고 프로젝트명 아님.
- **협업자 실명:** 커밋/주석에 `이찬`/`Chan`(GitHub `chanlee420`)이 등장. 블로그에서 실명 노출 여부는 저자 판단 — 필요 시 "팀원 C" 등으로 익명화.

### 이슈/PR 번호 확정
- **#364 = PR (이슈 아님).** `gh issue view 364` → "Could not resolve to an Issue". `gh pr view 364` 정상. 제목: `feat(shield): 차폐장 에너지 실드 머티리얼 + 육각 텍스처 (#353 중간)`, MERGED, 작성자 OJJ.
- **#353 = 이슈 (CLOSED, Done).** 이 편의 핵심 트래킹 이슈. 제목: `feat(fx): 차폐장 이펙트 — 자기폭풍 발생 시에만 활성화`.
- 기타 관련 번호: #371(차폐장 돔 PR), #438(송전탑 전력 범위, `Closes #438`), #152(PlanetEvent 원 이슈, #353 본문에서 언급), #185(별 돔 — 무관, 검색 노이즈).

---

## 시간순 사건 정리 (문제 → 시도 → 해결)

전력망 시각화(전선/송전탑)는 대부분 **팀원 Chan(`chanlee420`) 소유**이고, 자기폭풍·차폐장은 **저자(OJJ) 소유**다.
이 편의 핵심 서사는 **"OJJ의 차폐장 기능이 Chan 소유의 이벤트/머신 서브시스템을 침범해야 했고, 그 경계를 협의로 그은 사건"**이다.

파일 소유권(커밋 저자 집계):
- `PlanetEventManagerSubsystem.cpp` — Chan 8 / ssr 1 / **OJJ 1** (OJJ의 1커밋이 바로 b81900a)
- `MachineBase.cpp` — Chan 20 / ssr 19 / OJJ 7 (효율 modifier 시스템은 OJJ가 추가)
- `Machines/PowerLine.cpp` — Chan 9 / OJJ 1 (전선 시각화 = Chan 영역)

### ① 자기폭풍 보호 타워의 최초 형태 — 오버랩/중첩 카운트 (2026-06-04)
- **`6124e26` (2026-06-04 15:27) — OJJ**: `feat(protection): 자기폭풍 보호 타워 추가 (OJJ_ProtectionTower + 중첩 카운트 서브시스템, 반경 500)`
- 최초 설계는 **오버랩 기반 + "중첩 카운트 서브시스템"**(콜리전으로 겹친 머신 수를 세는 방식), 반경 500.
- → 이 접근이 곧 Chan의 머신/이벤트 매니저와 충돌하게 됨(아래 ③에서 거리 판정 전용으로 전환).

### ② 효율 modifier 시스템 도입 — 단일값 → 곱 합성 (2026-06-04)
- **`9746584` (2026-06-04 16:33) — OJJ**: `feat(machine): 효율 modifier 시스템 (승률 협의, 전력 시스템 대비)`
- 문제: 기존 `SetPlanetProductionEfficiency(0.6)` 는 **단일 멤버값**이라, 자기폭풍·전력부족 등 **여러 감산 요인이 동시에 걸리면 서로 덮어씀**.
- 해결: `MachineBase`에 **키별 modifier 맵**(`EfficiencyModifiers`) 도입. 최종 효율 = 모든 modifier의 **곱**. 키는 `EfficiencyKeys::MagneticStorm`, `EfficiencyKeys::Power`(전력 시스템 대비 예약).
- 커밋 메시지의 **"승률 협의"** 는 Chan(이찬)과의 협의를 가리키는 것으로 보이나 표기가 다름 — **게재 전 저자 확인 필요**(다음 커밋 b81900a는 같은 맥락을 "이찬 협의"로 표기).

### ③ ★핵심★ 거리 판정 전용으로 전환 — "이찬 협의" (2026-06-04)
- **`b81900a` (2026-06-04 16:47) — OJJ**: `feat(event): 자기폭풍 차폐장 거리 판정 + modifier 전환 (이찬 협의)`
- **이 편의 중심 커밋.** 오버랩/콜리전 방식을 버리고, 차폐장은 **위치·반경·활성 상태만** 갖고, 실제 "어느 머신이 차폐되는가" 판정은 **이벤트 매니저(Chan 서브시스템)가 거리(`DistSquared`) 기반으로** 수행하도록 경계 재설정.
- 협업 경계의 근거 원문(커밋 본문): 아래 "협업 경계 원문" 절 참조.

### ④ 차폐장-이벤트 매니저 연동 + 구 Tag 서브시스템 제거 (2026-06-04)
- **`250226a` (2026-06-04 17:09) — OJJ**: `feat(protection): 차폐장-이벤트 매니저 연동 + 구 Tag 서브시스템 제거`
- ①에서 만든 오버랩/중첩카운트 서브시스템을 **완전히 제거**하고, BeginPlay 등록 / EndPlay 해제 방식으로 정리.

### ⑤ 차폐장을 AMachineBase로 전환 — 빌드 배치 대응 (2026-06-04)
- **`e919a93` (2026-06-04 23:12) — OJJ**: `refactor(protection): 차폐장 AMachineBase 전환 (빌드 배치 대응) + 반경 700`
- 차폐장을 빌드 그리드에 머신처럼 올리기 위해 `AMachineBase` 파생으로 전환(`APowerGridNode` 패턴). 반경 500 → 700.

### ⑥ 에너지 실드 머티리얼 (#353 중간, MID 저장버그 봉착) (2026-06-23)
- **`e848554` (2026-06-23 22:22) — OJJ**, **PR #364** (`083d72a` merge): `feat(shield): 차폐장 에너지 실드 머티리얼 + 육각 텍스처`
- `M_EnergyShield`(Translucent/Unlit/TwoSided, 육각그리드+Fresnel 엣지글로우+DepthFade+Z스캔라인) UE Python 커맨드렛으로 생성.
- **봉착:** 돔 컴포넌트를 붙이려다 **저장 에러**. 원인 = `MachineBase`(Chan 영역) 생성자/OnConstruction에서 StateIndicator MID를 construction 시점에 생성 → `MID_BasicShapeMaterial_0` "private 참조" 저장 에러. → **Chan 합의 후 MID를 런타임(BeginPlay)으로 이동 필요**로 PR을 반쪽만 머지. (PR #364 본문 원문 아래 참조)

### ⑦ MID 저장버그 수정 + 돔/구독/콜리전 완성 (#353 완료) (2026-06-24)
- **`a0069ba` (2026-06-24 12:51) — OJJ**: `fix: MachineBase MID 저장버그 수정 (BeginPlay 이전 동적 MID 생성 금지)`
- **`90e22c1` (2026-06-24 12:51) — OJJ**, **PR #371** (`9c06d5c` merge): `feat: 차폐장 돔 + 자기폭풍 구독 + 범위 1200 + 본체 BlockAll 콜리전 (#353)`
- ⑥의 저장버그를 해결(동적 MID를 BeginPlay 이후로) 후 돔 비주얼 + 자기폭풍 이벤트 구독 완성. 반경 최종 **1200uu(=12칸)**.

### ⑧ 돔 내부 Niagara 차폐 "Kill Box" (2026-06-27)
- **`07dd831` (2026-06-27 13:58) — OJJ**: `feat(fx): 자기폭풍 차폐장 돔 내부 Niagara 차폐 (Kill Box)`
- **`e88cafc` (2026-06-27 14:08) — OJJ**: `fix(fx): 자기폭풍 Kill Box codex 피드백 반영 + 리뷰 문서`
- 자기폭풍 파티클(`NS_Magnetic`)이 돔 안까지 쏟아지지 않도록, 최근접 활성 차폐장의 위치/반경을 Niagara User 파라미터로 주입해 **돔 내부 파티클을 Kill**. 여기서도 **Chan 서브시스템(RegisteredShields)을 건드리지 않고 `TActorIterator`로 자체 순회**(협업 경계 재확인 — 아래 코드 D).

### ⑨ 송전탑 전력 범위 시각화 — 노란 플라즈마 구 (2026-06-29)
- **`88e5020` (2026-06-29 01:04) — OJJ**, `Closes #438`: `feat(build): 송전탑 전력 범위 표시 (노란 전기 플라즈마 구)`
- 빌드모드에서 송전탑을 들고 호버 시 `SupplyRadius`(700uu=7칸)를 노란 전기 플라즈마 구로 표시. **차폐장 돔 패턴 재사용**(Sphere 메시 + 스케일=반경/50).

### (참고) 전력망 시각화는 Chan 소유
- **`d0d79db` (2026-06-11 16:04) — Chan**: `전력선 상태 발광으로 확인 가능` — `IsPowerLineEnergized`(FactoryManager 전력망 그래프 조회) + 연결/미연결 머티리얼 스왑. **`IsElectricallyConnected` 최초 도입.**
- **`8359af4` (2026-06-24 14:19) — Chan**: `내구도 관련 수정사항` — `IsElectricallyConnected` 통전 시 **펄스 발광 애니메이션**(`GetCurrentConnectedEmissiveStrength`) 추가.
- **`2a36ba0` (2026-06-24) — Chan**: `전력선 리팩토링`. **`33b9661` (2026-06-23) — ssr**: `제련기가 여러 송전탑과 겹쳐있을때의 전력 공급 오류 수정`.
- → 블로그에서 전력망 연결 시각화를 다룬다면 **"팀원 영역"으로 명확히 구분**하고, OJJ의 기여(차폐장/자기폭풍/송전탑 범위 표시)와 섞지 말 것.

---

## ★ 협업 경계 원문 (이 편의 핵심 글감) ★

### (A) 커밋 `b81900a` 본문 원문 — "이찬 협의"
```
feat(event): 자기폭풍 차폐장 거리 판정 + modifier 전환 (이찬 협의)

- RegisteredShields + RegisterShieldGenerator/UnregisterShieldGenerator
- IsMachineShieldedFromMagneticStorm: 활성 차폐장 반경 DistSquared 판정
- MagneticStorm 적용/등록 경로: 차폐면 Clear, 아니면 SetEfficiencyModifier(MagneticStorm)
- RestoreMachineEfficiencies: Set(1.0)→Clear(MagneticStorm)
- H2/H3: AdvanceSimulation 매 틱 활성폭풍 재평가(이동/토글/배치후이동 stale 교정)
- M4: UnregisterMachine 해제 전 modifier clear
- 차폐장 거리판정에 필요한 OJJ_ProtectionTower 차폐 API(GetShieldRadius/IsShieldActive) 포함(등록 호출 전환은 커밋3)
```

### (B) ★가장 중요★ — `OJJ_ProtectionTower.h` 클래스 주석 원문 (합의 구조를 코드에 박제)
`frontend/Source/Wanted_Factory/Public/OJJ_ProtectionTower.h` (12~28행). **"이찬과 합의된 구조"가 명문화된 주석.**
```cpp
/**
 * 자기폭풍(MagneticStorm) 전용 차폐장(Shield Generator) (OJJ 소유).
 *
 * 본 액터는 "차폐장"으로서 자신의 위치/반경/활성 상태만 소유한다. 실제 보호 판정
 * (어떤 머신이 어느 차폐장 반경 안에 있는가)은 PlanetEventManagerSubsystem이 거리 기반
 * (IsMachineShieldedFromMagneticStorm 등)으로 수행한다 — 이찬과 합의된 구조.
 *
 * 따라서 오버랩/콜리전/태그 관리는 하지 않는다. BeginPlay에서 이벤트 매니저에 자신을
 * 차폐장으로 등록(Register)하고, EndPlay에서 등록 해제(Unregister)할 뿐이다.
 *
 * ⚠️ 자기폭풍의 생산효율 저하 전용이다. SandStorm 등 다른 이벤트(내구도 데미지 등)는
 *    막지 않는다 — 판정 측에서 MagneticStorm 분기에만 차폐를 적용하기 때문.
 *
 * 상속: AMachineBase 파생 — 빌드 그리드 배치 시스템(OJJ_BuildController/OJJ_Grid)에
 *   머신으로 올리기 위함(APowerGridNode 패턴). 단 입출력 포트 0·전력 불필요·아이템 수신
 *   불가로 "비-생산 머신"이다(컨베이어 endpoint 제외는 GetInput/OutputPortCount==0 가드로 처리).
 *   루트/메시는 AMachineBase가 생성한 Root + MeshComponent를 그대로 사용한다(자체 생성 금지).
 */
```

### (C) PR #364 본문 원문 — Chan 영역 침범과 보류 결정
`gh pr view 364` 본문. **"Chan 영역"·"Chan 합의 후" 표현이 명시된 협업 경계 원문.**
```
## 요약 (#353 중간 상태 — 내일 이어감)
자기폭풍 차폐장 시각 이펙트용 **에너지 실드 머티리얼** + 육각 텍스처. UE Python 커맨드렛으로 생성.

## 포함 (안전하게 완성된 것만)
- **M_EnergyShield**: Translucent / Unlit / TwoSided. 육각그리드(OneMinus 반전) + Fresnel 엣지글로우
  + DepthFade 경계 + Z스캔라인 합성 → Emissive/Opacity. 파라미터: LineColor, BackColor, LineSpeed, LineSize, GridSize.
- **MI_EnergyShield**: 인스턴스(돔 적용용).
- 육각 패턴 텍스처 (Tiling=Wrap).

## ⚠️ 미완 (이번 PR 제외)
- **BP_OJJ_ProtectionTower 돔 컴포넌트**: 저장 에러로 보류. 원인 = `MachineBase`(Chan 영역) 생성자/OnConstruction의
  StateIndicator MID가 construction 시점 생성 → `MID_BasicShapeMaterial_0` "private 참조" 저장에러.
  **Chan 합의 후 MID를 런타임(BeginPlay)으로 이동** 필요.
- **자산 삭제 25개**(오크/M_River/머신 에셋): 검증 미완 → 이번 푸시 제외, working tree 보류.
```

### (D) Kill Box 커밋 `07dd831` 본문 + 코드 — "Chan 서브시스템 무접촉"
커밋 본문:
```
- OJJ_DayNightController: UpdateStormShieldParams() 주입 로직(Tick 0.25s 스로틀
  + 폭풍 시작 즉시 1회), TActorIterator 자체 순회(Chan 서브시스템 무접촉)
```
코드 주석 (`OJJ_DayNightController.cpp`, `UpdateStormShieldParams`):
```cpp
	// 가장 가까운 "활성" 차폐장 탐색. RegisteredShields(Chan 서브시스템)를 건드리지 않고 OJJ 액터를 자체 순회.
	const AOJJ_ProtectionTower* NearestShield = nullptr;
	float NearestDistSq = TNumericLimits<float>::Max();
	for (TActorIterator<AOJJ_ProtectionTower> It(World); It; ++It)
	{ ... }
```

> **정리:** 협업 경계 원문은 총 4곳에서 발견됨 — (A) 커밋 b81900a 메시지 "이찬 협의", (B) 헤더 클래스 주석 "이찬과 합의된 구조", (C) PR #364 본문 "Chan 영역/Chan 합의 후", (D) Kill Box 주석 "Chan 서브시스템 무접촉". **경계의 형태는 "차폐장 액터(OJJ)는 상태만 소유, 판정은 이벤트 매니저(Chan 영역)가 거리 기반으로 — 오버랩/콜리전/태그는 쓰지 않는다."**

---

## 코드 조각 (실제 소스 원문 그대로)

### 코드 1 — 거리 판정 핵심: `IsMachineShieldedFromMagneticStorm`
`frontend/Source/Wanted_Factory/Private/PlanetEventManagerSubsystem.cpp` (커밋 b81900a, 현재 소스 동일). 오버랩 대신 **`DistSquared` vs 반경²** 비교.
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

### 코드 2 — modifier 전환: 차폐되면 Clear, 아니면 감산 (곱 합성)
`PlanetEventManagerSubsystem.cpp` `ApplyActiveEventToMachine` (b81900a 이후 현재 소스). 기존 `SetPlanetProductionEfficiency(0.6)` 단일값 → **키 기반 modifier**.
```cpp
	if (EventState.Type == EPlanetEventType::MagneticStorm)
	{
		if (IsMachineShieldedFromMagneticStorm(Machine))
		{
			Machine->ClearEfficiencyModifier(EfficiencyKeys::MagneticStorm);
		}
		else
		{
			Machine->SetEfficiencyModifier(EfficiencyKeys::MagneticStorm, GetMagneticStormEfficiency());
		}
		return;
	}
```
그리고 매 틱 재평가(H2/H3, `AdvanceSimulation`) — 차폐장/머신 이동·토글로 생긴 stale 상태 교정:
```cpp
	// [H2/H3] 활성 자기폭풍 동안 매 틱 재평가 — 차폐장/머신 이동·활성토글·배치후이동으로
	// 인한 stale 차폐 상태를 교정. EndActiveEvent 후엔 Type==None이 되어 재적용되지 않음(복구 보존).
	if (EventState.Type == EPlanetEventType::MagneticStorm)
	{
		ApplyActiveEventToMachines();
	}
```

### 코드 3 — 효율 modifier 시스템 (곱 합성) `MachineBase`
`frontend/Source/Wanted_Factory/Private/MachineBase.cpp` (1836~1881행, 커밋 9746584). 단일값 → **여러 요인의 곱**. `SetPlanetProductionEfficiency`는 DEPRECATED 위임.
```cpp
namespace EfficiencyKeys
{
	const FName MagneticStorm(TEXT("MagneticStorm"));
	const FName Power(TEXT("Power"));
}

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

void AMachineBase::ClearEfficiencyModifier(FName Key)
{
	EfficiencyModifiers.Remove(Key);
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

void AMachineBase::SetPlanetProductionEfficiency(float NewEfficiency)
{
	// [DEPRECATED] 효율 modifier 시스템의 MagneticStorm 키로 위임 (멤버 미러 폐기 — F3 스테일 제거).
	SetEfficiencyModifier(EfficiencyKeys::MagneticStorm, NewEfficiency);
}
```
헤더 선언 `MachineBase.h` (24~29행) — 문자열 중복 방지 단일 정의 지점:
```cpp
// 양쪽 파일의 문자열 중복을 방지하는 단일 정의 지점. 정의는 MachineBase.cpp.
namespace EfficiencyKeys
{
	WANTED_FACTORY_API extern const FName MagneticStorm; // 자기폭풍 (행성 이벤트)
	WANTED_FACTORY_API extern const FName Power;         // 전력 부족 (전력 시스템 대비, 예약)
}
```

### 코드 4 — 차폐장 활성 판정 API (거리 판정 측이 조회) `OJJ_ProtectionTower.h`
`frontend/Source/Wanted_Factory/Public/OJJ_ProtectionTower.h` (43~59행). 차폐장은 **반경·활성 상태만 노출**, 판정은 안 함.
```cpp
	// 차폐 반경(언리얼 단위). 기본 700 = 셀 7칸. 거리 판정은 이벤트 매니저가 이 값을 조회.
	UFUNCTION(BlueprintPure, Category = "Shield")
	float GetShieldRadius() const { return ShieldRadius; }

	// 차폐장 활성 여부. 수동 비활성(bIsShieldActive=false)이거나 파손(내구도 0, bDisableWhenBroken)
	// 이면 비활성 → 판정 측(PlanetEventManager)이 무시. 머신 전환으로 내구도가 생겼으므로(SandStorm
	// 데미지 등) 파손 시 차폐 중단 — APowerGridNode::IsPowerGridActive와 동일 패턴.
	UFUNCTION(BlueprintPure, Category = "Shield")
	bool IsShieldActive() const { return bIsShieldActive && !(isBroken() && bDisableWhenBroken); }

protected:
	// 차폐 반경(언리얼 단위). 기본 1200 = 셀 12칸. 보호 판정(IsMachineShieldedFromMagneticStorm)·돔 스케일 공용 단일 출처.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shield", meta = (ClampMin = "0.0"))
	float ShieldRadius = 1200.0f;
```
> 주의: 헤더 안에서 GetShieldRadius 주석은 "기본 700", 실제 `ShieldRadius` 멤버 기본값은 1200 (⑤→⑦에서 700→1200으로 상향된 흔적). 게재 시 1200(=12칸)으로 통일 권장.

### 코드 5 — 돔 비주얼 단일 진입점 + 블렌드 `OJJ_ProtectionTower.cpp`
`frontend/Source/Wanted_Factory/Private/OJJ_ProtectionTower.cpp` (169~199행). #353의 "평소 OFF, 자기폭풍에만 ON" 요구를 **단일 함수로 게이트**.
```cpp
void AOJJ_ProtectionTower::UpdateDomeVisibility()
{
	// [#353] 돔 표시 단일 출처 — 디버그 강제(bShowShieldDome) OR (자기폭풍 활성 && 차폐 가동). 분기 산재 금지.
	if (!ShieldDomeComponent)
	{
		return;
	}
	const bool bShow = bShowShieldDome || (bMagneticStormActive && IsShieldActive());
	ShieldDomeComponent->SetVisibility(bShow || ShieldVisualAlpha > KINDA_SMALL_NUMBER);
}

void AOJJ_ProtectionTower::UpdateDomeVisual(float DeltaSeconds)
{
	if (!ShieldDomeComponent)
	{
		return;
	}

	const bool bTargetShow = bShowShieldDome || (bMagneticStormActive && IsShieldActive());
	const float TargetAlpha = bTargetShow ? 1.0f : 0.0f;
	const bool bBlendingIn = TargetAlpha > ShieldVisualAlpha;
	const float BlendSeconds = bBlendingIn ? ShieldBlendInSeconds : ShieldBlendOutSeconds;
	const float BlendInterpSpeed = BlendSeconds > KINDA_SMALL_NUMBER ? (4.0f / BlendSeconds) : 4.0f;
	ShieldVisualAlpha = FMath::FInterpTo(ShieldVisualAlpha, TargetAlpha, DeltaSeconds, BlendInterpSpeed);
	ShieldVisualAlpha = FMath::Clamp(ShieldVisualAlpha, 0.0f, 1.0f);

	const float SmoothedAlpha = FMath::InterpEaseInOut(0.0f, 1.0f, ShieldVisualAlpha, 3.0f);
	const float DomeScale = (GetShieldRadius() / 50.0f) * FMath::Lerp(0.05f, 1.0f, SmoothedAlpha);
	ShieldDomeComponent->SetRelativeScale3D(FVector(DomeScale));
	ShieldDomeComponent->SetVisibility(bTargetShow || SmoothedAlpha > KINDA_SMALL_NUMBER);
}
```

### 코드 6 (보조) — 자기폭풍 이벤트 시작/종료 흐름 (Chan 소유 매니저)
`PlanetEventManagerSubsystem.cpp` (232~275행). 차폐장은 이 델리게이트를 구독만 함.
```cpp
bool UPlanetEventManagerSubsystem::StartPlanetEvent(
	EPlanetEventType EventType,
	float Severity,
	float DurationSeconds)
{
	if (EventType == EPlanetEventType::None || EventState.Type != EPlanetEventType::None)
	{
		return false;
	}

	EventState.Type = EventType;
	EventState.Severity = FMath::Clamp(Severity, 0.0f, 1.0f);
	EventState.RemainingSeconds = DurationSeconds > 0.0f ? DurationSeconds : EventDurationSeconds;

	ApplyActiveEventToMachines();
	OnPlanetEventStarted.Broadcast(EventState.Type, EventState.Severity);

	LOG_SSR_W(
		TEXT("Planet event started: %s Severity=%.2f Duration=%.2f"),
		*UEnum::GetValueAsString(EventState.Type),
		EventState.Severity,
		EventState.RemainingSeconds);

	return true;
}

void UPlanetEventManagerSubsystem::EndActiveEvent()
{
	if (EventState.Type == EPlanetEventType::None)
	{
		return;
	}

	const EPlanetEventType EndedEventType = EventState.Type;
	if (EndedEventType == EPlanetEventType::MagneticStorm)
	{
		RestoreMachineEfficiencies();  // 등록된 머신의 MagneticStorm modifier를 Clear (Set(1.0) 아님)
	}

	EventState = FPlanetEventState();
	OnPlanetEventEnded.Broadcast(EndedEventType);

	LOG_SSR_W(TEXT("Planet event ended: %s"), *UEnum::GetValueAsString(EndedEventType));
}
```

### 코드 7 (보조) — 전력 연결 시각화 `IsElectricallyConnected` (**Chan 소유 — 참고용**)
`frontend/Source/Wanted_Factory/Machines/PowerLine.cpp` (190~206행, 커밋 d0d79db, Chan). 전선이 실제 통전 중인지 **FactoryManager 전력망 그래프**에 위임.
```cpp
bool APowerLine::IsElectricallyConnected() const
{
	if (!SourceMachine.IsValid() || !TargetMachine.IsValid())
	{
		return false;
	}

	if (UGameInstance* GameInstance = GetGameInstance())
	{
		if (UFactoryManagerSubsystem* FactoryManager = GameInstance->GetSubsystem<UFactoryManagerSubsystem>())
		{
			return FactoryManager->IsPowerLineEnergized(this);
		}
	}

	return false;
}
```
통전 시 펄스 발광(커밋 8359af4, Chan):
```cpp
float APowerLine::GetCurrentConnectedEmissiveStrength() const
{
	const UWorld* World = GetWorld();
	if (!World || ConnectedEmissiveStrength <= 0.0f)
	{
		return ConnectedEmissiveStrength;
	}

	const float PulseTime = (World->GetTimeSeconds() * ConnectedPulseFrequency) + PulsePhaseOffset;
	const float PulseWave = 0.5f + (0.5f * FMath::Sin(PulseTime));
	const float ShapedPulse = FMath::Square(PulseWave);
	const float PulseMultiplier = FMath::Lerp(
		ConnectedPulseMinMultiplier,
		ConnectedPulseAmplitude,
		ShapedPulse);

	return ConnectedEmissiveStrength * PulseMultiplier;
}
```
> ⚠️ 이 두 함수는 **Chan 소유 코드**. 블로그에서 인용 시 "팀원이 만든 전력망 시각화"로 명시하고 OJJ 기여와 구분할 것.

---

## 수치 / 파라미터 / 로그 원문

| 항목 | 값 | 출처 |
|------|-----|------|
| 차폐장 최초 반경 | 500uu | `6124e26` 커밋 메시지 |
| 차폐장 반경 (AMachineBase 전환 후) | 700uu = 7칸 | `e919a93` |
| 차폐장 최종 반경 | **1200uu = 12칸** | `90e22c1`, `OJJ_ProtectionTower.h` `ShieldRadius = 1200.0f` |
| 효율 modifier 클램프 | 0.01 ~ 100.0 | `MachineBase.cpp` SetEfficiencyModifier |
| 최종 효율 하한 | 0.01 (0 곱 방지) | GetFinalEfficiency |
| 예시 효율 합성 | MagneticStorm 0.6 × Power 0.5 = 0.3 | `MachineBase.h` 465행 주석 |
| 돔 블렌드 인/아웃 | 7.5s / 10.5s | `ShieldBlendInSeconds=7.5f`, `ShieldBlendOutSeconds=10.5f` |
| 돔 스케일 공식 | `(GetShieldRadius()/50.0f) * Lerp(0.05, 1.0, SmoothedAlpha)` | UpdateDomeVisual |
| Kill Box 파라미터 주입 주기 | 0.25초 스로틀 (+ 폭풍 시작 즉시 1회) | `07dd831` |
| Niagara User 파라미터 | `User.ShieldCenter`(Vec3), `User.ShieldRadius`(float) | `OJJ_DayNightController.cpp` |
| 송전탑 전력 범위 | SupplyRadius 700uu = 7칸 | `88e5020` |
| 전선 펄스 발광 기본값 | `ConnectedEmissiveStrength=2.5`, `ConnectedPulseFrequency=3.0`, `ConnectedPulseAmplitude=1.15` | `PowerLine.h` (Chan) |
| 자기폭풍 발생 확률 | `MagneticStormChance` (RollEvent, `FMath::FRand() <= MagneticStormChance`) | `PlanetEventManagerSubsystem.cpp:434` |
| 이벤트 심각도 롤 | `FMath::FRandRange(0.5f, 1.0f)` | RollEvent |

로그 문자열 원문 (`LOG_SSR_W` — 게재 시 일반화 대상 매크로):
```
Planet event started: %s Severity=%.2f Duration=%.2f
Planet event ended: %s
```

디버그 테스트 키 바인딩 (`2c07b8f` — L_GridTest): `F2=자기폭풍 / F3=종료`.

---

## 파일 경로 요약 (게재 시 모듈 경로 일반화)

| 역할 | 경로 (원본) | 소유 |
|------|------------|------|
| 차폐장 액터 (헤더/구현) | `.../Wanted_Factory/Public(Private)/OJJ_ProtectionTower.h/.cpp` | OJJ |
| 이벤트 매니저 (거리 판정) | `.../Wanted_Factory/Private/PlanetEventManagerSubsystem.cpp` | Chan(주) / OJJ가 b81900a로 shield 등록 추가 |
| 머신 베이스 (효율 modifier) | `.../Wanted_Factory/Private/MachineBase.cpp` | Chan(주) / OJJ가 modifier 시스템 추가 |
| Kill Box 주입 | `.../Wanted_Factory/Private/OJJ_DayNightController.cpp` | OJJ |
| 송전탑 범위 표시 | `.../Wanted_Factory/Private/OJJ_BuildController.cpp` | OJJ |
| 전선 시각화 | `.../Wanted_Factory/Machines/PowerLine.cpp/.h` | **Chan** |
| 전력망 그래프 | `.../Wanted_Factory/Private/FactoryManagerSubsystem.cpp` (`IsPowerLineEnergized`) | **Chan** |
