# 31편 소스 수집 — 발소리·강 앰비언스·수영 사운드 UX (PR #511)

> 수집일: 2026-07-08 · 대상 저장소: PU3-Lab/factory-space · 브랜치 OJJ → main
> 이 문서는 **집필용 원자료**다. 아래 "일반화 필요 항목"을 반드시 지킬 것.

---

## 블로그 게재 시 일반화 필요 항목

- **일반화(가리기):**
  - `WANTED_FACTORY_API` DLL export 매크로 → 노출 금지. 클래스 선언에서 빼고 인용하거나 일반화.
  - 프로젝트명 `Wanted_Factory`, 전체 경로 `frontend/Source/Wanted_Factory/...` → `Source/...` 등으로 축약/일반화.
  - 이번 PR의 코드 주석/커밋엔 협업자 실명 등장 없음(확인 완료). 에셋 경로 `Content/Assets/SFX/`, `Content/OJJ/...`는 문제 없음.
- **게재 가능(1~3편에서 이미 공개):**
  - `AOJJ_*`/`OJJ_*`/`UAnimNotify_OJJ_*` 심볼, `/Game/OJJ/...` 에셋 경로.
- 코드는 아래 원문 그대로. 블로그용으로 분기 생략 시 **"일부 생략" 명시**. 동작 바뀌는 재구성 금지.

---

## 요약 (한눈에)

- **PR #511** `feat: 사운드 시스템 (발소리/환경음)` — author OJJ, base `main` ← head `OJJ`, **MERGED 2026-07-04T10:03:39Z (KST 19:03)**, 머지 커밋 `b67ad16`. **PR 코멘트 없음**(본문만).
- **구성 커밋 1개:** `e83dc54` (2026-07-04 19:02 KST) — 코드 343줄 추가(삭제 0) + 사운드 에셋 19종 + 캐릭터 선택 영상 교체. 신규 클래스 3종: `UAnimNotify_OJJ_Footstep`, `OJJ_FootstepStatics`(비-UObject 유틸), `AOJJ_RiverAmbience`. `OJJ_Player`에 착지음·수영 루프 통합.
- **핵심 설계 4가지:**
  1. **발소리 표면 자동판별** — PhysMat(피지컬 머티리얼) 인프라 없이 **OJJ_Grid 질의 2종**으로 3표면 판별. 우선순위: ① 발 침수(`OJJ_QueryWaterBodyAt`) → **Wet** ② Foundation 커버 셀(`IsCellOnFoundation`) → **Metal** ③ 그 외/그리드 부재/off-grid → **Sand** 폴백.
  2. **사다리 발소리** — `SurfaceOverride` enum(Auto/Sand/Metal)으로 그리드 질의 자체를 생략. 사다리 등반 애니엔 Override=Metal 노티파이 + 전용 `Ladder_Cue`. 전용 C++ 없음 — **전부 에셋(노티파이 프로퍼티) 레벨 처리**.
  3. **착지음 다이빙 스킵** — `Landed()`에서 (수면Z − 발Z) ≥ `SwimEnterWaterDepth`(90uu)면 착지음 생략. **수영 진입 판정과 임계 공유** → 수영 루프와의 이중음 방지.
  4. **강 앰비언스** — `AOJJ_RiverAmbience`가 AudioComponent 1개를 0.2초 타이머로 **WaterBodyRiver 스플라인의 플레이어 최근접점**으로 이동. AmbientSound 여러 개 배치 대신 소리 하나가 강을 따라다님.
- **수영 로우패스:** 런타임 필터 아님 — 소스 전체에 lowpass/LPF 코드 없음(grep 확인). **에셋 `SwimLoop_Underwater.uasset`(333KB) 자체가 로우패스 걸린 수중 버전 웨이브**이고, C++은 `OJJ_SetSwimSoundActive(bool)`로 Play/Stop만 토글. PR 본문 표현 "수영 루프: 수영 진입/이탈에 Play/Stop (수중 로우패스 버전)"과 일치.
- **에셋 출처:** PR 본문 — "CC0 사운드 12종 (Kenney/Fantozzi/freesound)".

### 커밋/PR (시간순, KST 기준)

| 해시 | 날짜(KST) | PR | 내용 (커밋 메시지 원문) |
|------|-----------|----|------|
| `e83dc54` | 2026-07-04 19:02 | #511 | `feat: 발소리·물소리 사운드 시스템 + 캐릭터 선택 영상 교체` — 코드+에셋 전부 이 한 커밋 (+343줄) |
| `b67ad16` | 2026-07-04 19:03 | #511 | `Merge pull request #511 from PU3-Lab/OJJ` |

**PR #511 본문 원문(요지 그대로):**
> - **발소리**: AnimNotify 기반, 표면 자동 판별(얕은 물=Wet / 파운데이션=Metal / 지형=Sand — OJJ_Grid 셀 질의, PhysMat 불요). 사다리는 SurfaceOverride=Metal + 전용 사운드.
> - **점프 착지음**: Landed() 훅, 표면 판별 공용 유틸(OJJ_FootstepStatics). 다이빙 시 수영 진입 기준(수심 90)과 동일 판정으로 이중음 방지.
> - **강물**: AOJJ_RiverAmbience — WaterBodyRiver 스플라인 최근접점 추종(0.2s), Attenuation 기반 페이드.
> - **수영 루프**: 수영 진입/이탈에 Play/Stop (수중 로우패스 버전).
> - **에셋**: CC0 사운드 12종 (Kenney/Fantozzi/freesound).
> - **캐릭터 선택 영상**: 카메라 고정 + CHARACTER SELECT 타이틀 버전으로 교체.
> - 검증: PIE 검증 완료.

### 이웃 커밋(다른 편 소재 — 이번 편에선 언급만 가능)

| 해시 | 날짜(KST) | PR | 내용 |
|------|-----------|----|------|
| `40eb729` | 2026-06-30 10:20 | #463 | feat: 캐릭터 수영 기능 구현 (MOVE_Flying 부유, 수심 히스테리시스) — **25편 소재**, 이번 편의 수심 90 임계가 여기서 온 것 |
| `8a0d78f` | 2026-07-01 20:59 | #480 | 머신 연기랑 사운드 추가 (타 팀원 SSR 브랜치 — **익명화 필요**: 브랜치명 SSR도 이니셜) |
| `f0458ae`/`2b4b073` | 2026-07-06 16:12 | #520 | 채굴기 루프·전선 험 / 엔딩 뮤트 — **후속 사운드 편 소재** |
| `12b6ba5` | 2026-07-06 16:46 | #521 | 폭풍 앰비언트 + 차폐장 덕킹 — 후속 |
| `26da4bd` | 2026-07-06 19:20 | #528 | 건설/철거/컨베이어/레벨업 사운드 — 후속 |

### 에셋(바이너리 — 읽기 불가, 존재만 확인 · 전부 `e83dc54`에서 추가/변경)

- **발소리 웨이브+큐:** `Content/Assets/SFX/Footstep_Sand_01~03` + `Footstep_Sand_Cue` / `Footstep_Metal_01~03` + `Footstep_Metal_Cue` / `Footstep_Wet_01~03` + `Footstep_Wet_Cue` — 표면당 웨이브 3종 랜덤(큐에서 배리에이션 추정)
- **사다리:** `LadderHF_02.uasset` + `Ladder_Cue.uasset`
- **강물:** `RiverLoop.uasset`(499KB) + `RiverLoop_Cue.uasset`, `NewSoundAttenuation.uasset`(감쇠 에셋 — 페이드 담당)
- **수영:** `SwimLoop_Underwater.uasset`(333KB, 로우패스 베이크판) + `SwimLoop_Cue.uasset`
- **애니(노티파이 심기):** Man/Woman의 Walking·Running·Jump 시퀀스 + Ladder Climb Loop/Finish(Man/Woman), `AM_Man_Ladder_Finish` 몽타주 — 발소리/사다리 노티파이가 여기 들어감(바이너리라 배치 프레임은 확인 불가)
- **기타:** `BP_OJJ_Player.uasset`(사운드 에셋 할당), `L_Planet.umap`(RiverAmbience 액터 배치 추정), `ChracterSelect.mp4` 교체, `L_CharacterSelect.umap`/`BP_CharacterPreview.uasset`

---

## 아키텍처 개요 (데이터 흐름)

```
[걸음/뛰기]  애니 시퀀스 노티파이 UAnimNotify_OJJ_Footstep (SurfaceOverride=Auto)
                └→ OJJ_FootstepStatics::PlaySurfaceFootstep(발 위치)
                     ├ ① Grid->OJJ_QueryWaterBodyAt(발) == true → WetSound
                     ├ ② Grid->IsCellOnFoundation(WorldToGrid(발)) → MetalSound
                     └ ③ 그 외/그리드 없음 → SandSound   (선택 사운드 null이면 무동작)

[사다리]     등반 애니 노티파이 (SurfaceOverride=Metal) → 그리드 질의 생략, Ladder_Cue 즉시 재생

[착지]       AOJJ_Player::Landed()
                ├ 수심(수면Z−발Z) ≥ SwimEnterWaterDepth(90) → 스킵 (수영 루프에 양보)
                └ 아니면 PlaySurfaceFootstep(Land* 사운드, 볼륨 1.2배)

[수영]       OJJ_UpdateSwimming: bSwimming 진입/이탈 지점에서 OJJ_SetSwimSoundActive(true/false)
                └ 상주 UAudioComponent Play/Stop — 로우패스는 에셋에 베이크

[강물]       AOJJ_RiverAmbience (레벨 배치 액터, Tick 없음)
                └ 0.2s 타이머: 강 스플라인의 플레이어 최근접점으로 AudioComponent 이동
                   루핑=SoundCue, 페이드=Attenuation 에셋에 위임 — 액터는 "위치"만 책임
```

공통 관례: **모든 사운드 프로퍼티는 미지정 시 무동작**("에셋 나중 지정 대비") — 코드 먼저 머지하고 에셋은 BP에서 나중에 붙이는 워크플로.

---

## 코드 조각 (실제 소스 원문)

### 1. 표면 판별 공용 유틸 — OJJ_FootstepStatics (신규 파일 전문)

`Source/.../Public/OJJ_FootstepStatics.h` (전문. `WANTED_FACTORY_API` 게재 시 제거)

```cpp
#pragma once

#include "CoreMinimal.h"

class USoundBase;
class UWorld;

/**
 * 발소리 표면 판별+재생 공용 유틸 — AnimNotify_OJJ_Footstep(걸음/등반)과 AOJJ_Player::Landed(착지)가 공유.
 * 판별 순서: ① 발 침수(OJJ_QueryWaterBodyAt) → Wet ② Foundation 셀(IsCellOnFoundation) → Metal
 * ③ 그 외/그리드 부재(프리뷰/타 레벨)/off-grid → Sand. 선택된 표면의 사운드가 null이면 무동작.
 */
class WANTED_FACTORY_API OJJ_FootstepStatics
{
public:
	static void PlaySurfaceFootstep(UWorld* World, const FVector& Location,
		USoundBase* SandSound, USoundBase* MetalSound, USoundBase* WetSound, float VolumeMultiplier);
};
```

> 주목: `UCLASS`가 아니라 **순수 C++ 클래스 + static 함수 1개**. BlueprintFunctionLibrary도 아님 — 호출자가 C++ 둘(노티파이·Landed)뿐이라 리플렉션 불필요.

`Source/.../Private/OJJ_FootstepStatics.cpp` (전문)

```cpp
#include "OJJ_FootstepStatics.h"

#include "Kismet/GameplayStatics.h"
#include "OJJ_Grid.h"
#include "Sound/SoundBase.h"

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

### 2. 발소리 애님 노티파이 — 헤더 (설계 주석이 본문 그 자체)

`Source/.../Public/AnimNotify_OJJ_Footstep.h` (전문. `WANTED_FACTORY_API` 게재 시 제거)

```cpp
#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimNotifies/AnimNotify.h"
#include "AnimNotify_OJJ_Footstep.generated.h"

class USoundBase;

// 발소리 표면 강제 지정 — Auto면 그리드 질의로 판별, 그 외엔 질의 생략(사다리 등반 애니 등
// 발밑 셀이 표면과 무관한 컨텍스트용. 예: 사다리 = 항상 Metal).
UENUM()
enum class EOJJFootstepSurface : uint8
{
	Auto,
	Sand,
	Metal
};

/**
 * 발소리 노티파이 — 걷기/뛰기 시퀀스의 발 닿는 프레임에 심는다.
 *
 * 표면 판별(우선순위): PhysMat 인프라 없이 OJJ_Grid 질의 2종.
 *  ① 얕은 물(발 위치 침수 — OJJ_QueryWaterBodyAt, 수영 감지와 동일 소스) → Wet.
 *     수영 중(수심 ≥ SwimEnterWaterDepth)엔 수영 애니로 전환돼 발소리 노티파이 자체가 안 돈다 —
 *     여기 걸리는 건 걷기 유지되는 얕은 물뿐이라 별도 수심 상한 불필요.
 *  ② Foundation 커버 셀(WorldToGrid → IsCellOnFoundation) → Metal.
 *  ③ 그 외 → Sand. 그리드 부재(프리뷰/타 레벨)나 off-grid도 모래 폴백.
 *
 * ⚠️ BS_Man_Locomotion 블렌드 중 walk/run 시퀀스 노티파이 이중 발화 가능 — 엔진 기본
 *    Trigger Weight Threshold(0.5)가 걸러주는 것에 의존. PIE에서 walk↔run 전환 구간 확인 필요.
 * ⚠️ Meshy 애니 재임포트 시 시퀀스에 심은 노티파이가 소실된다(Man_Idle hips 보정 소실 전례) — 재임포트 후 재심기.
 */
UCLASS(meta = (DisplayName = "OJJ Footstep"))
class WANTED_FACTORY_API UAnimNotify_OJJ_Footstep : public UAnimNotify
{
	GENERATED_BODY()

public:
	virtual void Notify(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation,
		const FAnimNotifyEventReference& EventReference) override;

	// 지면(모래) 발소리. 미지정이면 해당 표면에서 무동작(에셋 나중 지정 대비).
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Footstep")
	TObjectPtr<USoundBase> SandSound;

	// Foundation(금속) 발소리. 미지정이면 해당 표면에서 무동작.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Footstep")
	TObjectPtr<USoundBase> MetalSound;

	// 얕은 물(철벅) 발소리 — 발이 물에 잠겼지만 수영 전환 전 수심. 미지정이면 해당 표면에서 무동작.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Footstep")
	TObjectPtr<USoundBase> WetSound;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Footstep", meta = (ClampMin = "0.0"))
	float VolumeMultiplier = 1.0f;

	// Auto = 그리드 판별(①물 ②Foundation ③모래). Sand/Metal = 질의 생략, 해당 사운드 고정(사다리 등반용).
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Footstep")
	EOJJFootstepSurface SurfaceOverride = EOJJFootstepSurface::Auto;
};
```

> **글감 3개가 이 헤더에 다 있다:** ① "수영 중엔 발소리 노티파이 자체가 안 돈다"는 상태머신적 무료 처리(수심 상한이 필요 없는 이유), ② 블렌드스페이스 이중 발화를 엔진 기본 Trigger Weight Threshold 0.5에 의존, ③ Meshy 재임포트 시 노티파이 소실 경고(과거 Man_Idle hips 보정 소실 전례 — 25편과 연결).

### 3. 노티파이 구현 — SurfaceOverride 분기

`Source/.../Private/AnimNotify_OJJ_Footstep.cpp` `Notify` (전문)

```cpp
void UAnimNotify_OJJ_Footstep::Notify(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation,
	const FAnimNotifyEventReference& EventReference)
{
	Super::Notify(MeshComp, Animation, EventReference);

	if (!MeshComp)
	{
		return;
	}
	UWorld* World = MeshComp->GetWorld();
	if (!World)
	{
		return;
	}

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
	// 수영 수심이면 발소리 노티파이 자체가 안 돈다(헤더 참조).
	OJJ_FootstepStatics::PlaySurfaceFootstep(
		World, FootLocation, SandSound.Get(), MetalSound.Get(), WetSound.Get(), VolumeMultiplier);
}
```

> **사다리 발소리의 실체:** 전용 C++ 클래스 없음. 사다리 등반 시퀀스(Climb Loop/Finish)에 이 노티파이를 **SurfaceOverride=Metal + MetalSound=Ladder_Cue**로 심은 것(에셋 레벨). "누가(무엇이) 오버라이드를 거는가" = 애니 시퀀스에 심긴 노티파이 인스턴스의 프로퍼티. 등반 중엔 발밑 셀이 사다리와 무관(모래 위 사다리면 모래로 판별될 것)하므로 질의 자체를 생략.

### 4. 착지음 + 다이빙 스킵 — AOJJ_Player::Landed 추가분

`Source/.../Private/OJJ_Player.cpp` `Landed` 끝부분 (`e83dc54` 추가분 원문)

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

`Source/.../Public/OJJ_Player.h` 착지음 프로퍼티 (`e83dc54` 추가분 원문)

```cpp
	// [착지 발소리] Landed에서 표면 판별 재생(OJJ_FootstepStatics — 걸음 노티파이와 공용 로직).
	// 미지정 표면은 무동작. 깊은 물 다이빙(수영 진입 수심)은 수영 루프와 이중음이라 스킵.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sound")
	TObjectPtr<USoundBase> LandSandSound;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sound")
	TObjectPtr<USoundBase> LandMetalSound;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sound")
	TObjectPtr<USoundBase> LandWetSound;
	// 착지는 걸음보다 임팩트가 커야 해서 기본 볼륨을 살짝 높임.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sound", meta = (ClampMin = "0.0"))
	float LandVolumeMultiplier = 1.2f;
```

> **임계 공유 디테일:** `bDeepWater = bSwimming` 우선 확인(이미 수영 상태면 질의 생략) 후, 착지 순간 "발 = 바닥"이므로 (수면Z − 발Z) ≈ 그 지점의 실제 지형 수심 — 25편 수영 진입 판정(`SwimEnterWaterDepth = 90`, 이탈 70의 히스테리시스)과 **동일 기준선**. 90 미만 얕은 물이면 스킵하지 않고 유틸의 Wet 경로로 "철벅" 착지음이 나감(LandWetSound).

수영 진입 임계 원문 (`Source/.../Public/OJJ_Player.h:530-537`, PR #463에서 도입 — 25편 소재):

```cpp
	// [수영] 진입/이탈 수심(공간 히스테리시스) — 수심 = SurfaceZ − 강바닥Z(라인트레이스). ⭐ 클램프된 캐릭터 위치가
	// 아니라 실제 지형 수심 기준이라 순환 없음(이전 CenterDepth 버그 해소). 진입은 깊어야, 이탈은 진입보다 얕을 때.
	// SwimExitWaterDepth < SwimEnterWaterDepth 라 진입/이탈 지점이 달라 진동 방지.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "OJJ|Swim")
	float SwimEnterWaterDepth = 90.0f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "OJJ|Swim")
	float SwimExitWaterDepth = 70.0f;
```

### 5. 강 앰비언스 — AOJJ_RiverAmbience (신규 파일)

`Source/.../Public/OJJ_RiverAmbience.h` (클래스 주석 + 프로퍼티 원문. `WANTED_FACTORY_API` 게재 시 제거)

```cpp
/**
 * 강물 소리 스플라인 추종 액터 — AmbientSound 여러 개 대신 AudioComponent 하나를
 * 타이머(UpdateInterval)마다 플레이어의 강 스플라인 최근접점으로 옮긴다.
 * 강(WaterBodyRiver) 스플라인을 그대로 읽으므로 강 모양 수정에 자동 추종.
 *
 * 사운드/루핑/감쇠는 전부 SoundCue + Attenuation 에셋에 위임 — 액터는 위치만 책임.
 * TargetRiver 미지정이면 BeginPlay에서 월드 첫 WaterBodyRiver 자동 탐색(L_Planet엔 1개).
 */
UCLASS()
class AOJJ_RiverAmbience : public AActor   // 원문: class WANTED_FACTORY_API AOJJ_RiverAmbience
{
	// ...
	// 루핑 물소리 컴포넌트 — 사운드(Cue)/감쇠는 에디터에서 이 컴포넌트에 직접 할당.
	TObjectPtr<UAudioComponent> AudioComponent;
	// 추종할 강. 미지정이면 BeginPlay에서 월드 첫 WaterBodyRiver 자동 탐색.
	TObjectPtr<AWaterBodyRiver> TargetRiver;
	// 위치 갱신 주기(초). 발원지 점프가 눈에 띄면 낮추기 — 감쇠 반경 대비 플레이어 이동속도면 0.2s 충분.
	float UpdateInterval = 0.2f;   // meta = (ClampMin = "0.05")
};
```

`Source/.../Private/OJJ_RiverAmbience.cpp` (전문)

```cpp
#include "OJJ_RiverAmbience.h"

#include "Components/AudioComponent.h"
#include "EngineUtils.h"
#include "Kismet/GameplayStatics.h"
#include "TimerManager.h"
#include "WaterBodyRiverActor.h"
#include "WaterSplineComponent.h"

AOJJ_RiverAmbience::AOJJ_RiverAmbience()
{
	PrimaryActorTick.bCanEverTick = false;

	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	AudioComponent = CreateDefaultSubobject<UAudioComponent>(TEXT("Audio"));
	AudioComponent->SetupAttachment(Root);
	// 상시 재생 — 루핑은 SoundCue의 Looping 설정에, 들리는 범위는 Attenuation에 위임.
	AudioComponent->bAutoActivate = true;
}

void AOJJ_RiverAmbience::BeginPlay()
{
	Super::BeginPlay();

	if (!TargetRiver)
	{
		for (TActorIterator<AWaterBodyRiver> It(GetWorld()); It; ++It)
		{
			TargetRiver = *It;
			break;
		}
	}
	if (!TargetRiver)
	{
		UE_LOG(LogTemp, Warning,
			TEXT("[RiverAmbience] WaterBodyRiver 미발견 — 위치 추종 비활성(배치 위치에서 고정 재생)."));
		return;
	}

	UpdateAudioLocation();
	GetWorldTimerManager().SetTimer(
		UpdateTimerHandle, this, &AOJJ_RiverAmbience::UpdateAudioLocation, UpdateInterval, true);
}

void AOJJ_RiverAmbience::UpdateAudioLocation()
{
	const FVector Closest = ...;   // 아래 원문
	// (아래 함수 전문 참조)
}
```

핵심 함수 `UpdateAudioLocation` (전문):

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

> **구조 요지:** ① Tick 액터가 아니라 0.2초 타이머 — 감쇠 반경 대비 이동속도면 충분(주석에 판단 근거 명시). ② 엔진 Water 플러그인의 `UWaterSplineComponent::FindLocationClosestToWorldLocation` 한 줄이 전부 — 강 스플라인을 직접 읽으니 레벨에서 강 모양을 고쳐도 자동 추종. ③ 소리 자체(루핑·감쇠 페이드)는 SoundCue+Attenuation 에셋 책임, 액터는 "소리를 어디에 둘 것인가"만. ④ 강 전체를 커버하는 AmbientSound 다수 배치의 대안 — **소리 하나가 플레이어를 따라 강변을 미끄러지는** 방식.

### 6. 수영 루프 — Play/Stop 토글 (로우패스는 에셋 베이크)

`Source/.../Private/OJJ_Player.cpp` 생성자 추가분 + `OJJ_SetSwimSoundActive` (전문)

```cpp
	// [수영 사운드] 상주 컴포넌트 — MachineBase OperatingSound 패턴(수동 Play/Stop, 자동재생 금지).
	SwimLoopSoundComponent = CreateDefaultSubobject<UAudioComponent>(TEXT("SwimLoopSound"));
	SwimLoopSoundComponent->SetupAttachment(RootComponent);
	SwimLoopSoundComponent->bAutoActivate = false;
```

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

호출 지점 — `OJJ_UpdateSwimming` 내 수영 진입/이탈 (diff 원문, 각 1줄 추가):

```cpp
				bSwimming = true;
				OJJ_SetSwimSoundActive(true);
// ...이탈 쪽:
			bSwimming = false;
			OJJ_SetSwimSoundActive(false);
```

> **"수영 로우패스"의 진실:** 소스 트리 전체 grep에 `lowpass`/`LPF` 코드 0건. 런타임 필터(예: `SetLowPassFilterFrequency`)가 아니라 **`SwimLoop_Underwater.uasset` 웨이브 자체가 로우패스 처리된 수중 버전**이고, C++은 Play/Stop만 한다. PR 본문 문구도 "(수중 로우패스 버전)" — 에셋 수식어. 헤더 프로퍼티 주석 원문: `// [수영 사운드] 수영 중 루핑 재생 사운드(Cue). 미지정이면 무동작(에셋 나중 지정 대비).` / 플래그: `// [수영 사운드] 현재 재생 플래그 — 중복 Play/Stop 방지(RefreshOperatingSound의 bOperatingSoundActive 미러).`

### 7. 판별의 토대 — OJJ_Grid 질의 2종 (기존 함수 재사용, 이번 PR에서 추가 아님)

`Source/.../Public/OJJ_Grid.h` (선언 + 주석 원문)

```cpp
	// ① UE Water 플러그인 WaterBody(강/호수) 직접 질의: 월드 점이 수중인지 + per-location 수면 Z.
	// 레벨의 AWaterBody를 순회해 TryQueryWaterInfoClosestToWorldLocation(ComputeImmersionDepth)로 침수 판정.
	// 베이크 water 분류·GetWaterSurfaceZAtCell의 1차 소스(WaterArea는 폴백). 매 호출 TActorIterator라 hot-loop엔
	// 부적합 — 베이크는 사전수집 리스트로 별도 처리(성능). 수중(immersion>0)이면 true + OutSurfaceZ=수면 월드 Z.
	bool OJJ_QueryWaterBodyAt(const FVector& WorldLoc, float& OutSurfaceZ) const;

	// 셀이 유효한 Foundation에 커버되는지. 파괴된(stale) Foundation의 셀은 false(점유 stale 처리와 일관).
	UFUNCTION(BlueprintPure, Category = "Grid|Foundation")
	bool IsCellOnFoundation(FIntPoint Cell) const;
```

> 발소리는 **기존 시스템 2개(물 질의=16편/25편, Foundation 커버=그리드 편)를 사운드 도메인에 재사용**한 것. PhysMat을 전 에셋에 세팅하는 대신, 이미 게임플레이가 알고 있는 "여긴 물/파운데이션/모래" 지식을 그대로 씀. 단 `OJJ_QueryWaterBodyAt`은 주석대로 매 호출 TActorIterator라 hot-loop 부적합 — 발소리는 걸음 주기(초당 수 회)라 허용 범위라는 판단이 깔려 있음.

---

## 수치/설정값 원문 (블로그 인용용)

| 항목 | 값 | 출처 |
|------|----|----|
| 표면 판별 우선순위 | ① 물(Wet) → ② Foundation(Metal) → ③ Sand 폴백 | OJJ_FootstepStatics.cpp / AnimNotify_OJJ_Footstep.h 주석 |
| SurfaceOverride enum | Auto / Sand / Metal (Wet 강제값 없음) | AnimNotify_OJJ_Footstep.h |
| 노티파이 기본 볼륨 `VolumeMultiplier` | 1.0 (ClampMin 0.0) | AnimNotify_OJJ_Footstep.h |
| 착지 볼륨 `LandVolumeMultiplier` | **1.2** — "착지는 걸음보다 임팩트가 커야 해서" | OJJ_Player.h |
| 다이빙 스킵 임계 | (수면Z − 발Z) ≥ `SwimEnterWaterDepth` = **90 uu** | OJJ_Player.cpp Landed / OJJ_Player.h:535 |
| 수영 이탈 수심 (참고) | `SwimExitWaterDepth` = 70 uu (히스테리시스) | OJJ_Player.h:537 |
| 발 위치 계산(착지) | ActorZ − CapsuleHalfHeight | OJJ_Player.cpp Landed |
| 발 위치 계산(노티파이) | MeshComp->GetComponentLocation() — "캡슐 바닥 오프셋 ≈ 발 위치" | AnimNotify_OJJ_Footstep.cpp |
| 강 위치 갱신 주기 `UpdateInterval` | **0.2초** (ClampMin 0.05) | OJJ_RiverAmbience.h |
| 강 액터 Tick | bCanEverTick = false (타이머만) | OJJ_RiverAmbience.cpp |
| 강 AudioComponent | bAutoActivate = true (루핑=Cue, 감쇠=Attenuation 위임) | OJJ_RiverAmbience.cpp |
| 수영 AudioComponent | bAutoActivate = false (수동 Play/Stop) | OJJ_Player.cpp 생성자 |
| 블렌드 이중 발화 필터 | 엔진 기본 Trigger Weight Threshold **0.5** 의존 | AnimNotify_OJJ_Footstep.h 주석 |
| 발소리 웨이브 | 표면당 3종(01~03) + Cue 1개 × 3표면 | e83dc54 stat |
| 에셋 출처 | CC0 12종 — Kenney / Fantozzi / freesound | PR #511 본문 |

로그 문자열(원문):
- `"[RiverAmbience] WaterBodyRiver 미발견 — 위치 추종 비활성(배치 위치에서 고정 재생)."`
- (발소리/수영 사운드 쪽은 로그 없음 — 전부 "미지정 무동작" 침묵 폴백)

---

## 서사 후보 (집필 시 취사)

1. **"PhysMat 없이 발소리"** — 표준 답(피지컬 머티리얼 + 트레이스) 대신 게임이 이미 아는 지식(그리드 물 질의·Foundation 커버)을 재사용. 표면이 3종뿐인 게임에서 전 에셋 PhysMat 세팅의 비용을 회피. 물 > 금속 > 모래 우선순위가 곧 월드의 레이어 순서.
2. **"수영이 발소리를 공짜로 꺼준다"** — 깊은 물 상한 처리가 필요 없는 이유: 수심 90 이상이면 수영 애니로 전환돼 발소리 노티파이 자체가 안 돎. 상태머신이 조건문을 대신하는 구조.
3. **착지음의 90uu** — Landed에서 "발=바닥이므로 수면−발Z≈수심"이라는 관찰로 수영 진입 임계를 그대로 공유. 임계 하나로 "다이빙(무음→수영루프)"과 "얕은 철벅(LandWet)"이 갈라짐. 숫자를 두 곳에 두지 않는 설계.
4. **소리 하나가 강을 따라온다** — AmbientSound N개 배치 대신 스플라인 최근접점 추종 1개. `FindLocationClosestToWorldLocation` 한 줄 + 0.2초 타이머. "강 모양을 고쳐도 소리가 자동 추종"이 레벨 디자인 협업 관점의 이득.
5. **역할 분리: 액터는 위치만** — 루핑은 Cue, 페이드는 Attenuation, 위치만 C++. 수영 루프도 로우패스를 코드가 아닌 에셋(SwimLoop_Underwater)에 베이크. "코드가 안 해도 되는 일은 에셋에".
6. **패턴 재사용** — 수영 루프가 MachineBase OperatingSound 패턴(상주 컴포넌트 + 상태 변화 시에만 Play/Stop + bActive 플래그)의 미러임을 주석이 명시. 기계 소리 패턴이 캐릭터로 역수입.
7. **미래의 나에게 남긴 경고 2줄** — 블렌드 이중 발화(Trigger Weight Threshold 0.5 의존)와 Meshy 재임포트 시 노티파이 소실(Man_Idle 전례). 헤더 주석이 위험 대장 역할.
8. **"미지정 무동작" 관례** — 모든 사운드 프로퍼티가 null이면 조용히 스킵: 코드 먼저 머지, 에셋은 나중에 BP에서. 소규모 팀의 코드/에셋 파이프라인 분리.

---

## 못 찾은 항목 / 한계

- **PR #511 코멘트 없음** — 리뷰 토론 원문 없음(`comments: []`). 설계 근거는 PR 본문·코드 주석이 1차 자료.
- **노티파이 배치 프레임** — 애니 시퀀스(.uasset 바이너리)에 심긴 노티파이의 정확한 프레임 위치/SurfaceOverride 설정값은 에셋 내부라 확인 불가. "사다리=Override Metal + Ladder_Cue"는 PR 본문+헤더 주석 근거(코드로는 미확인이나 정황 일치).
- **BP 사운드 할당값** — BP_OJJ_Player의 LandSandSound 등 실제 할당 에셋(Footstep_*_Cue 매핑)은 바이너리라 추정. LandWet에 Footstep_Wet_Cue 재사용인지 별도 큐인지 미확인.
- **SoundCue 내부** — 웨이브 3종 랜덤 배리에이션·피치 랜덤 여부, RiverLoop_Cue 루핑 설정, NewSoundAttenuation의 감쇠 곡선/반경 수치는 전부 에셋 내부라 확인 불가.
- **"로우패스" 수치** — SwimLoop_Underwater가 어떤 컷오프로 처리됐는지는 오디오 파일 자체 정보라 불명. "에셋에 베이크된 수중 버전"까지만 사실로 확정.
- **CC0 출처 상세** — 어떤 사운드가 Kenney/Fantozzi/freesound 중 어디서 왔는지 개별 매핑은 기록 없음.

---

## 수집 완료 보고

- PR #511 (`feat: 사운드 시스템 (발소리/환경음)`, 2026-07-04 19:03 KST 머지, 머지 커밋 `b67ad16`) — 구성 커밋은 `e83dc54` 단일.
- 신규 파일 6개(AnimNotify_OJJ_Footstep .h/.cpp, OJJ_FootstepStatics .h/.cpp, OJJ_RiverAmbience .h/.cpp) 전문 + OJJ_Player .h/.cpp 추가분 diff 원문 확보. 이후 커밋에서 해당 파일 변경 없음(현재 소스 = e83dc54 상태).
- 수영 로우패스는 런타임 코드가 아니라 에셋 베이크로 확정(소스 전체 grep 0건).
