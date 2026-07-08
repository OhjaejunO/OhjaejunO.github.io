# 32편 소스 수집 — 생성자 MID 저장버그 2부작 (MachineBase StateIndicator / Conveyor)

> 수집일: 2026-07-08 · 대상 저장소: PU3-Lab/factory-space
> 이 문서는 **집필용 원자료**다. 아래 "일반화 필요 항목"을 반드시 지킬 것.

---

## 블로그 게재 시 일반화 필요 항목

- **일반화(가리기):**
  - `WANTED_FACTORY_API` DLL export 매크로, 프로젝트명 `Wanted_Factory`, 전체 경로 `frontend/Source/Wanted_Factory/...` → `Source/...` 등으로 축약/일반화.
  - 협업자 실명: 커밋/PR/주석에 등장하는 `Chan`(이찬, git author `Chan`) → **"팀원 C"** (26편 표기와 통일). git author `ssr5087` → **"팀원 S"** 또는 "다른 팀원". PR 본문의 "Chan(이찬)", "JJ가 고쳐" 인용 시 실명 익명화.
- **게재 가능:** `AOJJ_*`/`OJJ_*` 접두사, `/Game/OJJ/...`, `BP_OJJ_ProtectionTower`, `BP_Conveyor`, `MID_BasicShapeMaterial_0`(엔진 자동 명명).
- **소유 구분(중요):** `MachineBase`·`Conveyor`는 **팀원 C 소유 코드**다(버그 도입 커밋 e4afc61/bb2107b 저자 = Chan, ae7061a 저자 = ssr5087). 두 수정 모두 "합의/승인 후 JJ가 수정"임이 커밋·PR에 명시 — 글에서도 이 구도를 유지할 것.
- 코드/diff/커밋 메시지는 아래 원문 그대로. 축약 시 **"일부 생략" 명시**. 동작 바뀌는 재구성 금지.

---

## 요약 (한눈에)

같은 함정에 두 번 걸린 이야기. **"생성자/에디터 construction에서 MID(UMaterialInstanceDynamic)를 만들어 SetMaterial 하면 BP 저장이 막힌다."**

- **사건 A — MachineBase StateIndicator (2026-06-20 도입 → 06-23 발견 → 06-24 수정):** 팀원 C가 머신 상태등(구체 메시+MID)을 추가하며 생성자에서 MID 생성. JJ가 차폐장 돔(BP_OJJ_ProtectionTower)을 저장하려다 "private 참조" 에러로 차단 → 그날 밤 **PR #364 반쪽 머지**(머티리얼·텍스처만) → 다음날 합의 후 **PR #370(`a0069ba`)** 로 수정 → 그 위에 스택 PR **#371**(차폐장 돔)이 머지.
- **사건 B — Conveyor FlowArrow/Occluder (2026-06-20·06-29 도입 → 07-06 수정):** 사건 A와 같은 날 팀원 C가 컨베이어 화살표 MID를 생성자에서 생성(`bb2107b`), 사건 A 수정 **5일 뒤** 팀원 S가 Occluder MID를 또 생성자에 추가(`ae7061a`). 사운드 작업(BP_Conveyor에 Cue 지정)에서 저장 차단 재발 → **`a55d268`** 로 수정, 사운드 PR **#528**에 편승 머지.
- **핵심 반전(코드로 검증됨):** 두 사건 모두 MID **포인터는 처음부터 `UPROPERTY(Transient)`였다.** 그런데도 샜다 — 새는 경로는 포인터가 아니라 **`SetMaterial()`이 기록하는 컴포넌트 `OverrideMaterials`(직렬화되는 배열)** 였다. 이 설명은 가설이 아니라 **커밋 메시지·코드 주석 원문에 그대로 적혀 있다**(아래 §5).
- **아이러니:** 사건 A의 수정 코드(`a0069ba`)는 **5시간 뒤** 팀원 S의 상태등 리팩토링(`e9286e8`, 구체 MID → 아이콘+포인트라이트)으로 통째로 소멸했다. 현재 MachineBase에는 StateIndicator MID가 존재하지 않는다.

### 커밋/PR 매핑

| 사건 | 역할 | 해시/PR | 날짜(KST) | 저자 | 내용 |
|------|------|---------|-----------|------|------|
| 선행 | RF_Transient 첫 도입 | `2abb9e9` | 06-11 12:24 | JJ | 그리드 호버/화살표 MID에 RF_Transient — "레벨 dirty(가짜 diff) 차단" 목적 |
| 선행 | 런타임 MID 선례 | `a2f84c6` | 06-18 17:48 | 팀원 C | Conveyor 파우더 비주얼 MID 런타임 생성 + RF_Transient (수정 커밋이 말하는 "아이템 비주얼 MID와 동일 패턴") |
| A 도입 | 상태등 추가 | `e4afc61` | 06-20 19:15 | 팀원 C | MachineBase 생성자 MID + OnConstruction/Tick에서 UpdateStateIndicator |
| B 도입 1 | 화살표 색 | `bb2107b` | 06-20 19:17 | 팀원 C | Conveyor 생성자 FlowArrow MID |
| A/B 확장 | 상태등 확장 | `80e6964` | 06-20 21:34 | 팀원 C | Conveyor `UpdateFlowArrowMaterial()` 신설(생성자 MID는 유지) |
| A 발견 | 반쪽 머지 | **PR #364** | 06-23 22:23 머지 | JJ | 실드 머티리얼만 머지, 돔 BP는 저장 에러로 보류 — **에러 오브젝트명 `MID_BasicShapeMaterial_0` 기록** |
| A 수정 | fix | `a0069ba` = **PR #370** (head `fix/machinebase-mid`) | 06-24 12:51 커밋, 13:02 머지 | JJ | 생성자는 베이스 머티리얼만, MID는 HasActorBegunPlay 가드 lazy 생성 |
| A 후속 | 차폐장 돔 | **PR #371** (스택, base=#370) | 06-24 13:02 머지 | JJ | "#370 머지 후 진행" 명시 |
| A 소멸 | 상태등 교체 | `e9286e8` | 06-24 17:51 | 팀원 S | 구체+MID → 경고 아이콘+포인트라이트. StateIndicatorMaterialInstance 삭제 |
| B 도입 2 | Occluder | `ae7061a` | 06-29 17:42 | 팀원 S | Occluder MID를 **또 생성자에서** 생성 (사건 A 수정 5일 뒤) |
| B 수정 | fix | `a55d268` (PR **#528** 에 포함, 06-06→07-06 19:21 머지) | 07-06 19:19 | JJ | 생성자 정적 베이스만 + BeginPlay 이동 + RF_Transient 이중 안전장치 |

> `gh` 조회 결과: PR #353은 PR이 아니라 **이슈 번호**(차폐장 기능 이슈). `gh pr view 353` → "Could not resolve to a PullRequest". 차폐장 PR은 #364(중간)·#371(본편)이고 커밋 제목의 "(#353)"은 이슈 참조다. **과업 지시의 "PR #353 시절"은 실제로는 이슈 #353 / PR #364·#370·#371 시절.**

---

## 사건 A — MachineBase StateIndicator

### A-1. 버그 도입: `e4afc61` (2026-06-20 19:15, 팀원 C) "퀘스트 진행키 엔터에서 . 으로 변경, 기계 위에 상태등 추가"

`frontend/Source/Wanted_Factory/Private/MachineBase.cpp` 생성자에 추가된 부분 (diff 원문):

```diff
 	ConstructorHelpers::FObjectFinder<UMaterial> MaterialAsset(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
 	if (MaterialAsset.Succeeded())
 	{
 		MeshComponent->SetMaterial(0, MaterialAsset.Object);
+		StateIndicatorMaterialInstance = UMaterialInstanceDynamic::Create(MaterialAsset.Object, this);
+		StateIndicatorComponent->SetMaterial(0, StateIndicatorMaterialInstance);
 	}
+
+	UpdateStateIndicator();
```

같은 커밋, `OnConstruction`과 `Tick`에도 호출 추가 (에디터에서도 MID 생성 경로가 열림):

```diff
@@ AMachineBase::OnConstruction(const FTransform& Transform)
 	UpdateDebugBufferText();
+	UpdateStateIndicator();
@@ AMachineBase::Tick(float DeltaTime)
+	UpdateStateIndicator();
```

그리고 **헤더 선언 — 포인터는 처음부터 Transient였다** (`Public/MachineBase.h`, e4afc61 diff 원문):

```diff
+	UPROPERTY(Transient)
+	TObjectPtr<UMaterialInstanceDynamic> StateIndicatorMaterialInstance;
```

`UpdateStateIndicator()` 내부에도 lazy-create가 있었다 (e4afc61 diff 원문, 색 스위치 부분 일부 생략):

```cpp
	if (!StateIndicatorMaterialInstance)
	{
		UMaterialInterface* BaseMaterial = StateIndicatorComponent->GetMaterial(0);
		if (!BaseMaterial)
		{
			BaseMaterial = UMaterial::GetDefaultMaterial(MD_Surface);
		}
		StateIndicatorMaterialInstance = UMaterialInstanceDynamic::Create(BaseMaterial, this);
		StateIndicatorComponent->SetMaterial(0, StateIndicatorMaterialInstance);
	}

	StateIndicatorMaterialInstance->SetVectorParameterValue(TEXT("Color"), IndicatorColor);
	StateIndicatorMaterialInstance->SetVectorParameterValue(TEXT("BaseColor"), IndicatorColor);
	StateIndicatorMaterialInstance->SetVectorParameterValue(TEXT("Tint"), IndicatorColor);
	StateIndicatorMaterialInstance->SetVectorParameterValue(TEXT("EmissiveColor"), IndicatorColor);
	StateIndicatorMaterialInstance->SetScalarParameterValue(TEXT("EmissiveStrength"), 8.0f);
```

→ 생성자에서 1차 생성 + OnConstruction(에디터 construction)에서도 lazy-create — **BP 에디터에서 저장 대상 액터가 MID를 물게 되는 경로가 두 개**.

### A-2. 발견과 반쪽 머지: PR #364 (2026-06-23 22:23 KST 머지)

PR #364 `feat(shield): 차폐장 에너지 실드 머티리얼 + 육각 텍스처 (#353 중간)` — author OhjaejunO, MERGED 2026-06-23T13:23:19Z. **본문 원문** (코멘트/리뷰 없음):

> ## 요약 (#353 중간 상태 — 내일 이어감)
> 자기폭풍 차폐장 시각 이펙트용 **에너지 실드 머티리얼** + 육각 텍스처. UE Python 커맨드렛으로 생성.
>
> ## 포함 (안전하게 완성된 것만)
> - **M_EnergyShield**: Translucent / Unlit / TwoSided. 육각그리드(OneMinus 반전) + Fresnel 엣지글로우 + DepthFade 경계 + Z스캔라인 합성 → Emissive/Opacity. 파라미터: LineColor, BackColor, LineSpeed, LineSize, GridSize.
> - **MI_EnergyShield**: 인스턴스(돔 적용용).
> - 육각 패턴 텍스처 (Tiling=Wrap).
>
> ## ⚠️ 미완 (이번 PR 제외)
> - **BP_OJJ_ProtectionTower 돔 컴포넌트**: 저장 에러로 보류. 원인 = `MachineBase`(Chan 영역) 생성자/OnConstruction의 StateIndicator MID가 construction 시점 생성 → `MID_BasicShapeMaterial_0` "private 참조" 저장에러. **Chan 합의 후 MID를 런타임(BeginPlay)으로 이동** 필요.
> - **자산 삭제 25개**(오크/M_River/머신 에셋): 검증 미완 → 이번 푸시 제외, working tree 보류.

**여기서 확보된 1차 자료:** 저장을 막은 오브젝트의 실제 이름 **`MID_BasicShapeMaterial_0`** (엔진이 자동 명명한 MID — 베이스가 `/Engine/BasicShapes/BasicShapeMaterial`이라 이 이름이 됨). 26편 본문에는 이 이름이 안 나갔다 — 32편의 새 디테일.

### A-3. 수정: `a0069ba` = PR #370 (2026-06-24 12:51 커밋 / 13:02 KST 머지)

커밋 메시지 원문 (`git log a0069ba`):

```
fix: MachineBase MID 저장버그 수정 (BeginPlay 이전 동적 MID 생성 금지)

상태등(StateIndicator) MID를 생성자/OnConstruction(에디터 construction)에서 만들어
컴포넌트 머티리얼 오버라이드에 물리면, 직렬화 대상인 오버라이드가 transient MID를
참조해 BP(차폐장 BP_OJJ_ProtectionTower 등) 저장 시 "private object 링크" 에러로 막혔다.
정적 베이스 머티리얼만 SetMaterial 하고, MID 생성/갱신은 HasActorBegunPlay() 가드로
런타임(BeginPlay→RefreshMachineState / Tick)에서만 lazy 생성하도록 변경.

트레이드오프: 에디터 프리뷰 상태등 색 미표시(런타임/플레이 시만). MachineBase는 Chan
영역 파일이며, 본 변경은 Chan 합의 하에 수정("JJ가 고쳐").
```

diff 원문 (`frontend/Source/Wanted_Factory/Private/MachineBase.cpp`, 1파일 +16/−4):

```diff
@@ -179,11 +179,12 @@ AMachineBase::AMachineBase()
 	if (MaterialAsset.Succeeded())
 	{
 		MeshComponent->SetMaterial(0, MaterialAsset.Object);
-		StateIndicatorMaterialInstance = UMaterialInstanceDynamic::Create(MaterialAsset.Object, this);
-		StateIndicatorComponent->SetMaterial(0, StateIndicatorMaterialInstance);
+		// [상태등 MID 저장버그 — Chan 합의] 상태등은 정적 베이스 머티리얼만 지정한다. MID는 런타임
+		// (UpdateStateIndicator의 lazy 경로)에서 생성 — 생성자/에디터 construction에서 MID를 만들어 private
+		// UPROPERTY에 보관하면 BP(차폐장 BP_OJJ_ProtectionTower 등) 저장 시 직렬화 에러로 저장이 막힌다.
+		// 베이스만 SetMaterial 해두면 런타임 lazy 경로가 GetMaterial(0)으로 베이스를 복구해 MID를 만든다.
+		StateIndicatorComponent->SetMaterial(0, MaterialAsset.Object);
 	}
-
-	UpdateStateIndicator();
 }
@@ -837,6 +838,17 @@ void AMachineBase::UpdateDebugBufferText()

 void AMachineBase::UpdateStateIndicator()
 {
+	// [상태등 MID 저장버그 — Chan 합의] 에디터 construction(OnConstruction)에서는 MID 생성/갱신을 건너뛴다.
+	// 에디터에서 만든 UMaterialInstanceDynamic을 private UPROPERTY에 들고 있으면 BP(차폐장 BP_OJJ_ProtectionTower
+	// 등) 저장 시 직렬화 에러로 막힌다. HasActorBegunPlay()=false(construction/에디터)면 no-op, 런타임
+	// (BeginPlay→RefreshMachineState / Tick)에서만 동작. ⚠️ AMachineBase::BeginPlay가 Super::BeginPlay()를 먼저
+	// 호출하므로 이후 RefreshMachineState 시점엔 HasBegunPlay=true(엔진 AActor::BeginPlay 말미 설정). 트레이드오프:
+	// 에디터 프리뷰 상태등 색 미표시(런타임/플레이 시만 — Chan 합의).
+	if (!HasActorBegunPlay())
+	{
+		return;
+	}
+
 	if (!StateIndicatorComponent)
 	{
 		return;
```

PR #370 본문 원문 (author OhjaejunO, MERGED 2026-06-24T04:02:15Z, 코멘트/리뷰 0건):

> ## 개요
> BeginPlay 이전(생성자/에디터 construction)에 상태등 동적 MID를 생성 → 컴포넌트 머티리얼 오버라이드(직렬화 대상)가 transient MID(private 참조)를 물어 BP 저장 시 "private object 링크" 에러로 저장이 막혔다. **전체 머신 베이스(MachineBase) 영향.**
>
> ## 변경
> - 상태등은 정적 베이스 머티리얼만 SetMaterial. MID 생성/갱신은 `UpdateStateIndicator` 상단 `HasActorBegunPlay()` 가드로 런타임(BeginPlay→RefreshMachineState / Tick)에서만 lazy 생성.
> - 생성자의 MID 생성 + UpdateStateIndicator 호출 제거.
>
> ## 영향 / 트레이드오프
> - 차폐장 등 머신 BP **저장 가능**으로 복구.
> - 에디터 프리뷰 상태등 색 미표시(런타임/플레이 시만).
>
> ## 비고
> ⚠️ MachineBase는 Chan(이찬) 영역 파일 — **Chan 구두 합의 후 수정** ("JJ가 고쳐").

**스택 PR 구조 (1차 자료):** PR #371(차폐장 돔) 본문에 —

> ### ⚠️ 선행 의존성
> 이 PR은 **#370(MachineBase MID 저장버그 수정) 머지 후** 진행 (스택 PR — base=`fix/machinebase-mid`). #370이 main에 머지되면 본 PR base는 main을 향함.

#370 머지 04:02:15Z → #371 머지 04:02:40Z. **25초 간격** — 스택이 연달아 들어갔다.

### A-4. 수정 코드의 소멸: `e9286e8` (2026-06-24 17:51, 팀원 S) "전력 부족, 내구도 부족, 버퍼 꽉참 아이콘 추가"

수정 머지 **약 5시간 뒤**, 팀원 S가 상태등을 구체+MID 방식에서 **경고 아이콘(스프라이트)+포인트라이트** 방식으로 전면 교체. 이 커밋에서 `StateIndicatorMaterialInstance`와 MID 생성 코드 전체가 삭제됐다 (diff 발췌, 원문):

```diff
-#include "Materials/MaterialInstanceDynamic.h"
...
 	if (MaterialAsset.Succeeded())
 	{
 		MeshComponent->SetMaterial(0, MaterialAsset.Object);
-		StateIndicatorComponent->SetMaterial(0, MaterialAsset.Object);
+		StateIndicatorComponent->SetMaterial(0, MaterialAsset.Object);   ← (실제 diff에선 주변 구조 변경과 함께 재배치)
 	}
...
-	if (!StateIndicatorMaterialInstance)
-	{
-		if (UMaterialInstanceDynamic* ExistingMID =
-			Cast<UMaterialInstanceDynamic>(StateIndicatorComponent->GetMaterial(0)))
+	const bool bShowWarningIcon = bShowStateIndicator && WarningIcon != nullptr;
+	if (StateIndicatorIconComponent)
```

> ⚠️ 위 블록은 grep 문맥 발췌라 행 병치가 정확하지 않다. 집필 시 인용하려면 `git show e9286e8 -- '*MachineBase*'` 재확인 필요. **확실한 사실:** 현재 `MachineBase.cpp`/`MachineBase.h`에 `StateIndicatorMaterialInstance`는 grep 0건 — a0069ba의 수정 코드는 현재 HEAD에 존재하지 않는다(교훈만 남고 코드는 소멸). 이후 `7c24294`(06-24 23:43, JJ)가 이 교체 과정의 머지 오봉합(IsOutputBufferFull)을 복구.

---

## 사건 B — Conveyor FlowArrow/Occluder

### B-1. 버그 도입 1: `bb2107b` (2026-06-20 19:17, 팀원 C) "컨베이어, 파이프 화살표 색 구현"

사건 A 도입 커밋과 **2분 차이** — 같은 작업 세션에서 같은 패턴이 두 클래스에 심어졌다. `Private/Conveyor.cpp` 생성자 (diff 원문):

```diff
 		StraightSegmentInstances->SetMaterial(0, MaterialAsset.Object);
 		CornerSegmentInstances->SetMaterial(0, MaterialAsset.Object);
 		ItemVisualInstances->SetMaterial(0, MaterialAsset.Object);
-		FlowArrowInstances->SetMaterial(0, MaterialAsset.Object);
+		FlowArrowMaterialInstance = UMaterialInstanceDynamic::Create(MaterialAsset.Object, this);
+		if (FlowArrowMaterialInstance)
+		{
+			FlowArrowMaterialInstance->SetVectorParameterValue(TEXT("Color"), FlowArrowColor);
+			FlowArrowMaterialInstance->SetVectorParameterValue(TEXT("BaseColor"), FlowArrowColor);
+			FlowArrowMaterialInstance->SetVectorParameterValue(TEXT("Tint"), FlowArrowColor);
+			FlowArrowMaterialInstance->SetVectorParameterValue(TEXT("EmissiveColor"), FlowArrowColor);
+			FlowArrowMaterialInstance->SetScalarParameterValue(TEXT("EmissiveStrength"), FlowArrowEmissiveStrength);
+			FlowArrowMaterialInstance->SetScalarParameterValue(TEXT("Opacity"), FlowArrowColor.A);
+			FlowArrowMaterialInstance->SetScalarParameterValue(TEXT("Alpha"), FlowArrowColor.A);
+			FlowArrowInstances->SetMaterial(0, FlowArrowMaterialInstance);
```

헤더 — **여기도 포인터는 Transient** (`Public/Conveyor.h`, bb2107b diff 원문):

```diff
+	UPROPERTY(Transient)
+	TObjectPtr<UMaterialInstanceDynamic> FlowArrowMaterialInstance;
```

(같은 커밋이 `Pipe.cpp`/`Pipe.h`에도 동일 패턴 적용 — +13/+9줄. 파이프도 잠재적 같은 버그였을 가능성. 단, Pipe 쪽 후속 수정 여부는 이번 수집 범위 밖 — 미확인.)

### B-2. 버그 도입 2: `ae7061a` (2026-06-29 17:42, 팀원 S) "머신 입출구 수정"

**사건 A 수정(06-24)에서 5일 뒤**, 같은 함정이 또 생성자에 추가됐다 (diff 원문):

```diff
 		PowderVisualMaterialBase = MaterialAsset.Object;
+		OutputOccluderMaterialInstance = UMaterialInstanceDynamic::Create(MaterialAsset.Object, this);
+		if (OutputOccluderMaterialInstance)
+		{
+			OutputOccluderMaterialInstance->SetVectorParameterValue(TEXT("Color"), FLinearColor::Black);
+			OutputOccluderMaterialInstance->SetVectorParameterValue(TEXT("BaseColor"), FLinearColor::Black);
+			OutputOccluderMaterialInstance->SetVectorParameterValue(TEXT("Tint"), FLinearColor::Black);
+			OutputOccluder->SetMaterial(0, OutputOccluderMaterialInstance);
+			InputOccluder->SetMaterial(0, OutputOccluderMaterialInstance);
+		}
```

헤더도 마찬가지로 `UPROPERTY(Transient) TObjectPtr<UMaterialInstanceDynamic> OutputOccluderMaterialInstance;` 추가. → 27편 §4의 "같은 함정에 세 번째" 문구의 근거: 도입 시점 기준으로 세면 e4afc61(A) → bb2107b(B-1) → ae7061a(B-2)로 이미 세 번이다.

### B-3. 수정: `a55d268` (2026-07-06 19:19 커밋, PR #528에 포함되어 19:21 KST 머지)

커밋 메시지 원문:

```
fix: Conveyor 생성자 MID CDO 오염 수정 (BP_Conveyor 저장 차단 해소)

생성자에서 UMaterialInstanceDynamic::Create + SetMaterial 시 MID가 CDO 서브오브젝트로
박혀 컴포넌트 OverrideMaterials 직렬화를 타고 BP_Conveyor 저장을 막음(Illegal private
reference). MachineBase StateIndicator MID 건과 동일 패턴 — Chan 승인.

- 생성자: 정적 베이스 머티리얼만 지정(FlowArrow/Occluder 2개)
- MID 생성+검정 파라미터: BeginPlay(런타임 전용)로 이동, RF_Transient
- UpdateFlowArrowMaterial lazy-create: HasActorBegunPlay 가드 + RF_Transient
```

전체 diff 원문 (`frontend/Source/Wanted_Factory/Private/Conveyor.cpp`, 1파일 +41/−16):

```diff
@@ -288,25 +288,15 @@ AConveyor::AConveyor()
 		StraightSegmentInstances->SetMaterial(0, MaterialAsset.Object);
 		CornerSegmentInstances->SetMaterial(0, MaterialAsset.Object);
 		ItemVisualInstances->SetMaterial(0, MaterialAsset.Object);
-		FlowArrowMaterialInstance = UMaterialInstanceDynamic::Create(MaterialAsset.Object, this);
-		if (FlowArrowMaterialInstance)
-		{
-			FlowArrowInstances->SetMaterial(0, FlowArrowMaterialInstance);
-		}
+		// [MID CDO 오염 수정] 생성자는 정적 베이스만 — 생성자 MID는 CDO 서브오브젝트로 박혀 컴포넌트
+		// OverrideMaterials 직렬화를 타고 BP_Conveyor 저장을 막는다(Illegal private reference).
+		// MID 생성/파라미터는 BeginPlay(런타임 전용)로 이동.
+		FlowArrowInstances->SetMaterial(0, MaterialAsset.Object);
 		PowderVisualMaterialBase = MaterialAsset.Object;
-		OutputOccluderMaterialInstance = UMaterialInstanceDynamic::Create(MaterialAsset.Object, this);
-		if (OutputOccluderMaterialInstance)
-		{
-			OutputOccluderMaterialInstance->SetVectorParameterValue(TEXT("Color"), FLinearColor::Black);
-			OutputOccluderMaterialInstance->SetVectorParameterValue(TEXT("BaseColor"), FLinearColor::Black);
-			OutputOccluderMaterialInstance->SetVectorParameterValue(TEXT("Tint"), FLinearColor::Black);
-			OutputOccluder->SetMaterial(0, OutputOccluderMaterialInstance);
-			InputOccluder->SetMaterial(0, OutputOccluderMaterialInstance);
-		}
+		OutputOccluder->SetMaterial(0, MaterialAsset.Object);
+		InputOccluder->SetMaterial(0, MaterialAsset.Object);
 	}

-	UpdateFlowArrowMaterial();
-
 	static ConstructorHelpers::FObjectFinder<UDataTable> ResourceTableFinder(
 		TEXT("/Game/DataTable/DT_ResourceData.DT_ResourceData"));
 	if (ResourceTableFinder.Succeeded())
@@ -357,6 +347,31 @@ void AConveyor::BeginPlay()
 		}
 	}

+	// [MID CDO 오염 수정] MID는 런타임에서만 생성(베이스 = 컴포넌트 현재 머티리얼 — BP 오버라이드 존중).
+	// RF_Transient = 직렬화 제외 이중 안전장치(아이템 비주얼 MID와 동일 패턴).
+	if (UMaterialInterface* FlowArrowBase = FlowArrowInstances ? FlowArrowInstances->GetMaterial(0) : nullptr)
+	{
+		FlowArrowMaterialInstance = UMaterialInstanceDynamic::Create(FlowArrowBase, this);
+		if (FlowArrowMaterialInstance)
+		{
+			FlowArrowMaterialInstance->SetFlags(RF_Transient);
+			FlowArrowInstances->SetMaterial(0, FlowArrowMaterialInstance);
+		}
+	}
+	if (UMaterialInterface* OccluderBase = OutputOccluder ? OutputOccluder->GetMaterial(0) : nullptr)
+	{
+		OutputOccluderMaterialInstance = UMaterialInstanceDynamic::Create(OccluderBase, this);
+		if (OutputOccluderMaterialInstance)
+		{
+			OutputOccluderMaterialInstance->SetFlags(RF_Transient);
+			OutputOccluderMaterialInstance->SetVectorParameterValue(TEXT("Color"), FLinearColor::Black);
+			OutputOccluderMaterialInstance->SetVectorParameterValue(TEXT("BaseColor"), FLinearColor::Black);
+			OutputOccluderMaterialInstance->SetVectorParameterValue(TEXT("Tint"), FLinearColor::Black);
+			OutputOccluder->SetMaterial(0, OutputOccluderMaterialInstance);
+			InputOccluder->SetMaterial(0, OutputOccluderMaterialInstance);
+		}
+	}
+
 	LastFlowArrowPhase = GetFlowArrowPhase();
 	RestartItemMoveTimer();
 	RefreshFlowArrowInstances();
@@ -2008,6 +2023,12 @@ void AConveyor::UpdateFlowArrowMaterial()

 	if (!FlowArrowMaterialInstance)
 	{
+		// [MID CDO 오염 수정] lazy-create는 런타임 전용 — CDO/OnConstruction 경로에서 MID 생성 금지
+		// (색은 Tick이 매 프레임 갱신하므로 런타임 진입 후 커버).
+		if (!HasActorBegunPlay())
+		{
+			return;
+		}
 		UMaterialInterface* BaseMaterial = FlowArrowInstances ? FlowArrowInstances->GetMaterial(0) : nullptr;
 		if (BaseMaterial)
 		{
@@ -2018,6 +2039,10 @@ void AConveyor::UpdateFlowArrowMaterial()
 			BaseMaterial = UMaterial::GetDefaultMaterial(MD_Surface);
 		}
 		FlowArrowMaterialInstance = UMaterialInstanceDynamic::Create(BaseMaterial, this);
+		if (FlowArrowMaterialInstance)
+		{
+			FlowArrowMaterialInstance->SetFlags(RF_Transient);
+		}
 		if (FlowArrowMaterialInstance && FlowArrowInstances)
 		{
 			FlowArrowInstances->SetMaterial(0, FlowArrowMaterialInstance);
```

**현재 코드 상태 확인 (HEAD, 2026-07-08 조회):** 수정 후 상태 그대로 유지 —
- 생성자 주석·정적 베이스: `Private/Conveyor.cpp` ~290-304행 (위 diff의 + 부분과 동일 원문 확인).
- BeginPlay MID 블록: 345행 `void AConveyor::BeginPlay()` 내부 357-380행.
- lazy-create 가드: 2026행 `UpdateFlowArrowMaterial()` 내부, RF_Transient 2057행.
- 헤더 `Public/Conveyor.h` 320-324행: 두 포인터 모두 `UPROPERTY(Transient)` 유지.

### B-4. 머지 경로: PR #528 (사운드 PR에 편승)

`gh api commits/a55d268/pulls` → **PR #528** `feat: 사운드 확장 2차 — 건설/컨베이어/레벨업/폭풍` (MERGED 2026-07-06T10:21:30Z, author OhjaejunO, 코멘트 0건). 본문 중 해당 항목 원문:

> - **fix**: Conveyor 생성자 MID CDO 오염 (BP_Conveyor 저장 차단 해소, MachineBase StateIndicator MID 건과 동일 패턴) — **Chan 승인**

같은 본문의 에셋 항목: "에셋: 빌드업/철거/컨베이어 WAV + Cue(...), BP_BuildController/**BP_Conveyor**/BP_Machine_B 사운드 지정" — **발견 맥락**: 컨베이어 가동 루프 사운드를 붙이려고 BP_Conveyor에 Cue를 지정·저장하는 순간 차단에 걸린 것 (PR 본문 구성상 추정 — 직접 서술은 없음, 글에서 단정하려면 사용자 확인 필요).

직후 `65c5dea`(07-06 19:24, 팀원 C, "mid merge commit") — 팀원 C가 이 변경을 자기 브랜치로 머지. 커밋 제목의 "mid"가 MID인지 "중간(mid-way)"인지는 불명 — 재미 요소로만.

---

## §5. 핵심 반전 검증 — "Transient인데 왜 샜는가"

**검증 결과: 과업의 가설이 리포 원문과 일치한다.** 다만 정확히 하면 — 버그 당시 걸려 있던 건 오브젝트 플래그 `RF_Transient`가 아니라 **포인터 프로퍼티의 `UPROPERTY(Transient)`** 였다. `RF_Transient`(오브젝트 플래그)는 수정 커밋에서야 "이중 안전장치"로 처음 걸렸다. 반전의 구도:

1. **포인터는 Transient였다** — e4afc61·bb2107b·ae7061a 모두 `UPROPERTY(Transient) TObjectPtr<UMaterialInstanceDynamic> ...` (diff 원문 §A-1, §B-1, §B-2). 즉 "이 포인터는 저장 안 되니 안전하다"고 볼 만한 상태.
2. **그런데 참조는 포인터로만 흐르지 않는다.** `SetMaterial()`은 `UMeshComponent::OverrideMaterials`(직렬화되는 배열)에 MID를 기록한다. 리포 원문이 이 경로를 명시:
   - `a55d268` 커밋 메시지: **"MID가 CDO 서브오브젝트로 박혀 컴포넌트 OverrideMaterials 직렬화를 타고 BP_Conveyor 저장을 막음(Illegal private reference)"**
   - `Conveyor.cpp` 현재 298행 주석: **"생성자 MID는 CDO 서브오브젝트로 박혀 컴포넌트 OverrideMaterials 직렬화를 타고 BP_Conveyor 저장을 막는다(Illegal private reference)"**
   - `a0069ba` 커밋 메시지: **"컴포넌트 머티리얼 오버라이드에 물리면, 직렬화 대상인 오버라이드가 transient MID를 참조해 ... 'private object 링크' 에러로 막혔다"**
   - PR #370 본문: **"컴포넌트 머티리얼 오버라이드(직렬화 대상)가 transient MID(private 참조)를 물어 BP 저장 시 'private object 링크' 에러"**
3. **주석과 diff가 가설과 다른 말을 하는 부분 없음.** 단, `OverrideMaterials`가 "UPROPERTY 배열"이라는 표현은 엔진 소스 일반 지식이지 이 리포 원문엔 "직렬화 대상인 오버라이드/OverrideMaterials 직렬화"까지만 있다. 글에서 엔진 헤더(`MeshComponent.h`의 `UPROPERTY(EditAnywhere, BlueprintReadOnly, Category=Rendering) TArray<TObjectPtr<UMaterialInterface>> OverrideMaterials;`)를 인용하려면 **집필 시 UE 소스에서 별도 확인** 필요 — 이번 수집에선 엔진 소스 미조회.
4. **두 사건의 기제 차이 (a0069ba 주석 기준):**
   - 사건 A는 생성자 + **OnConstruction(에디터 construction)** 두 경로 — 에디터에서 BP 컴파일/배치될 때마다 MID가 생겨 저장 대상 액터에 물림. 수정 = 생성자 제거 + `HasActorBegunPlay()` 가드 (RF_Transient는 안 씀 — MID를 아예 에디터에서 안 만드는 쪽).
   - 사건 B는 **생성자 → CDO 오염** — CDO가 MID를 서브오브젝트로 소유("CDO 서브오브젝트로 박혀"). 수정 = 생성자 제거 + BeginPlay 이동 + 가드 + **RF_Transient 이중 안전장치**.
5. **RF_Transient의 계보 (수법의 성숙 과정):**
   - `2abb9e9` (06-11, JJ): 첫 도입. 목적이 다름 — **"outer가 레벨 액터라 생기던 레벨 dirty(가짜 diff) 차단"** (커밋 메시지 원문). 주석 원문: `// 런타임 전용 — outer가 레벨 액터라 저장 대상이 되면 레벨 dirty(가짜 diff) 유발(F2-0).`
   - `a2f84c6` (06-18, 팀원 C): Conveyor 파우더 비주얼 MID — 런타임 생성 + `MaterialInstance->SetFlags(RF_Transient)`. a55d268 주석의 "아이템 비주얼 MID와 동일 패턴"이 가리키는 선례. (현재 `Conveyor.cpp` 1475-1477행에 잔존.)
   - `a55d268` (07-06, JJ): "RF_Transient = 직렬화 제외 이중 안전장치" — 주 방어는 생성 시점 이동이고 플래그는 보조라는 서열이 주석에 명시.

---

## §6. 에러 메시지 원문 확보 상태

**에디터 저장 차단 다이얼로그의 전체 원문은 리포에 보존돼 있지 않다** (`docs/` 및 소스 전체 grep — "Illegal private", "Graph is linked", "private object" 매치는 Conveyor.cpp 주석 1건뿐). 확보된 표현은 3종:

| 표현 | 출처 (원문 그대로) |
|------|--------------------|
| `Illegal private reference` | `a55d268` 커밋 메시지 · `Conveyor.cpp:298` 주석 |
| "private object 링크" 에러 | `a0069ba` 커밋 메시지 · PR #370 본문 |
| `MID_BasicShapeMaterial_0` "private 참조" 저장에러 | **PR #364 본문** — 문제 오브젝트의 실제 이름 |

→ 집필 시 에러 다이얼로그를 "원문"처럼 통짜 인용하는 것은 불가. "Illegal private reference" + 오브젝트명 `MID_BasicShapeMaterial_0` 조합까지가 1차 자료의 한계. UE의 해당 에러 전문(예: "Can't save ... Graph is linked to private object(s) in an external package" 계열)을 쓰려면 재현 스크린샷이나 사용자 기억 확인 필요 — **지어내지 말 것**.

---

## §7. 기발행 범위 매핑 (중복 방지)

### 이미 발행된 서술

**26편 §3** (`src/content/blog/factory-sim/26-magnetic-storm-shield.md` 117-123행, 176행):
- 돔 컴포넌트를 붙이자 저장이 에러로 막힘, **"private 참조"** 라는 표현까지 공개.
- 원인이 자기 돔이 아니라 부모 `MachineBase`(**"팀원 C 영역"** 표기)의 생성자/OnConstruction 상태등 MID라는 추적 서사.
- **"그날 밤 PR은 안전하게 완성된 것(머티리얼·텍스처)만 반쪽 머지"** + PR 본문에 원인 분석과 "합의 후 MID를 런타임으로 이동 필요" 명시 + **"다음 날 합의를 거쳐 ... BeginPlay 이후로 옮기는 수정이 별도 커밋"**.
- 각주에 "이슈 #353, PR #364·#371 외" 번호 공개.
- 예고: "생성자에서 MID를 만들면 안 되는 이유는 다음 편에서 다른 사건으로 한 번 더 등장한다."

**27편 §4** (`27-hologram-buildup-dissolve.md` 172-178행):
- 컨베이어가 생성자에서 MID 생성+SetMaterial → **"CDO의 서브오브젝트로 박히면서 컴포넌트의 `OverrideMaterials` 직렬화를 타고 블루프린트 저장을 막았다("Illegal private reference")"** — **기제 설명 자체는 이미 공개됨**.
- 수정 요지(생성자는 정적 베이스만 / BeginPlay 이동 / RF_Transient 이중 안전장치)도 공개.
- 규칙 문장: "MID는 런타임 산물이다. 생성자와 OnConstruction에서 만들지 않는다."

### 32편에서 새로 쓸 수 있는 1차 자료

- **정밀 시간선**: 두 버그가 같은 날 2분 간격으로 심어짐(e4afc61 19:15 / bb2107b 19:17) → A 발견·반쪽 머지(06-23 밤) → A 수정+스택 PR 25초 간격 머지(06-24 13:02) → **수정 코드가 5시간 만에 소멸**(e9286e8 17:51) → **5일 뒤 같은 패턴 재도입**(ae7061a 06-29) → B 폭발·수정(07-06). 기존 글엔 시간선이 전혀 없음.
- **diff 원문 전체** (도입 diff 3건 + 수정 diff 2건) — 기존 글은 요지 서술만, 코드 원문 미공개.
- **`MID_BasicShapeMaterial_0`** 오브젝트명 (PR #364 본문) — 미공개 디테일.
- **"포인터는 처음부터 UPROPERTY(Transient)였다"는 헤더 diff** — 반전의 핵심 물증, 미공개. 27편은 기제 결론만 말했고 "Transient였는데도"라는 긴장은 안 만들었음.
- **HasActorBegunPlay 가드 주석 원문** (Super::BeginPlay 타이밍 각주 포함) — 미공개.
- **RF_Transient 계보** (2abb9e9 레벨 dirty → a2f84c6 파우더 선례 → 이중 안전장치) — 미공개.
- **PR #364·#370·#371·#528 본문 원문** — 26편은 "PR 본문에 명시해 두었다"고만 했고 본문 자체는 미공개.
- **"Chan 합의/승인" 협업 절차가 커밋·PR에 반복 기록**된 것 ("JJ가 고쳐" 인용구 포함 — 익명화 필요) — 소유 경계 서사(26편 주제)의 후속 물증.
- **사건 A 수정의 무상함**: a0069ba가 고친 코드는 e9286e8로 사라졌지만(상태등이 아이콘+라이트로 교체) **교훈은 a55d268에서 재사용**됐다 — "코드는 죽어도 커밋 메시지는 산다"류 서사 가능.
- **파이프도 같은 패턴이었다**(bb2107b가 Pipe.cpp에도 동일 적용) — 단, 후속 수정 여부 미조사(아래 한계).

---

## §8. 서사 후보 (집필 시 취사)

1. **"Transient라고 썼는데 왜 저장되는가"** — 포인터 Transient(헤더 diff) vs 참조의 실제 통로 OverrideMaterials. 반전 구조의 축.
2. **같은 날 심어진 두 개의 지뢰** — 19:15/19:17, 2분 간격. 하나는 3일 만에, 하나는 16일 만에 터졌다.
3. **반쪽 머지의 기록** — PR #364 본문 원문(⚠️ 미완 섹션). "안전하게 완성된 것만"이라는 판단을 PR 본문에 남기는 습관.
4. **남의 코드 고치기의 절차** — "Chan 영역", "구두 합의 후 수정", "JJ가 고쳐", 스택 PR(base=fix/machinebase-mid) 25초 간격 머지. 26편 경계 서사의 실무 디테일 후속.
5. **수정 코드의 수명 5시간** — a0069ba의 코드는 e9286e8로 소멸. 그러나 7-06의 a55d268이 커밋 메시지로 그 교훈을 정확히 참조("MachineBase StateIndicator MID 건과 동일 패턴"). 살아남은 것은 코드가 아니라 기록.
6. **재발은 학습 부재가 아니라 전파 부재** — 수정 5일 뒤 다른 팀원이 같은 패턴 재도입(ae7061a). 규칙이 사람에 머물면 팀에선 재발한다 → 27편의 "규칙으로 못 박기" 문장의 전사(前史).
7. **RF_Transient의 세 가지 얼굴** — 레벨 dirty 차단(2abb9e9) / 관행(a2f84c6) / 이중 안전장치(a55d268). 같은 플래그, 다른 목적.

---

## §9. 못 찾은 항목 / 한계

- **에디터 에러 다이얼로그 전체 원문 미보존** (§6). "Illegal private reference" + `MID_BasicShapeMaterial_0`까지만 1차 자료.
- **PR 코멘트/리뷰 전부 0건** (#364, #370, #371, #528) — 합의는 전부 구두("Chan 구두 합의", "Chan 승인")로, 토론 로그 없음.
- **`OverrideMaterials`가 UPROPERTY 직렬화 배열이라는 엔진 측 근거** — 리포 주석은 "OverrideMaterials 직렬화"까지만 말함. 엔진 헤더 인용은 집필 시 별도 확인 필요(이번 수집에서 UE 소스 미조회).
- **사건 B의 발견 순간** — "BP_Conveyor에 사운드 Cue를 지정하다 저장이 막혔다"는 PR #528 구성상 추정이며 직접 서술 없음. 단정하려면 사용자 확인.
- **Pipe.cpp 동일 패턴(bb2107b)의 후속 수정 여부 미조사** — a55d268은 Conveyor.cpp만 수정. BP_Pipe에서 같은 증상이 났는지/언제 고쳐졌는지 확인 안 함. 글에서 언급하려면 추가 조사 필요.
- **docs/ 리뷰 문서에 두 사건 관련 기록 없음** — `docs/04_reviews/`는 06-18~06-27 공백이고(사건 A 시기), 07-06~07 문서는 TTS 등 무관 주제. 06-27_reviews_03(전선 미리보기 리뷰)에 MID 생명주기/RF_Transient 점검 항목이 있으나 별건.
- **e9286e8 diff 인용 주의** — §A-4 블록은 grep 문맥 발췌라 병치가 부정확. 인용 시 `git show e9286e8` 재확인.
