---
title: "공장 시뮬레이션 게임 개발기 — 생성자 MID 저장버그 2부작: Transient라고 썼는데 왜 저장되는가"
description: "6월 20일 저녁, 2분 간격으로 두 클래스에 같은 지뢰가 심어졌다 — 생성자에서 만든 MID. 포인터에는 분명 Transient가 붙어 있었다. 그런데 사흘 뒤 차폐장 블루프린트 저장이 막혔고, 참조는 포인터가 아니라 SetMaterial이 기록하는 OverrideMaterials 직렬화 배열로 새고 있었다. 반쪽 머지의 밤, 합의 후 수정, 그리고 그 수정 코드가 5시간 만에 리팩토링으로 소멸하고 5일 뒤 같은 패턴이 다시 심어져 16일 만에 두 번째 폭발로 이어진 시간선 — 버그 하나를 고치는 것과 패턴을 팀이 학습하는 것은 다른 문제라는 기록."
date: 2026-07-08
category: UE5
series: factory-sim
seriesPart: 32
tags: [UE5, C++, MID, CDO, 직렬화, 협업]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — MID와 직렬화**
> - 26편: [자기폭풍과 차폐장 — 남의 서브시스템과 경계를 긋는 법](/blog/factory-sim/26-magnetic-storm-shield)
> - 27편: [홀로그램 빌드업과 철거 디졸브 — 사라지는 액터에게 연출을 맡기지 마라](/blog/factory-sim/27-hologram-buildup-dissolve)
> - **32편: 생성자 MID 저장버그 2부작 — Transient라고 썼는데 왜 저장되는가** ← 현재 글

26편에서 차폐장 블루프린트 저장이 막혔던 밤을, 27편 후일담에서 컨베이어가 같은 함정에 걸린 사건을 각각 스쳐 지나갔다. 그때는 결론("MID는 런타임 산물이다. 생성자와 OnConstruction에서 만들지 않는다")만 말했는데, 이번 편은 그 두 사건의 **전체 시간선과 물증**이다. 커밋 로그를 시간순으로 다시 깔아 보니, 이건 버그 두 개의 이야기가 아니라 **하나의 패턴이 팀 안에서 심어지고, 터지고, 고쳐지고, 잊히고, 다시 심어진** 이야기였다.

미리 반전부터 — 문제의 MID 포인터에는 **처음부터 `Transient`가 붙어 있었다.** "저장 안 되게 해 뒀는데 왜 저장이 막히는가"가 이 편의 축이다.

---

## 1. 6월 20일 저녁 — 2분 간격의 지뢰 두 개

시작은 팀원 C의 작업 세션 하나다. 19시 15분, 머신 위에 상태등(전력/고장 표시 구체)을 얹는 커밋이 MachineBase 생성자에 이렇게 들어갔다:

```diff
 	ConstructorHelpers::FObjectFinder<UMaterial> MaterialAsset(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
 	if (MaterialAsset.Succeeded())
 	{
 		MeshComponent->SetMaterial(0, MaterialAsset.Object);
+		StateIndicatorMaterialInstance = UMaterialInstanceDynamic::Create(MaterialAsset.Object, this);
+		StateIndicatorComponent->SetMaterial(0, StateIndicatorMaterialInstance);
 	}
```

그리고 2분 뒤인 19시 17분, 같은 패턴이 컨베이어의 흐름 화살표에도 심어졌다 — 생성자에서 `UMaterialInstanceDynamic::Create` + `SetMaterial`. 같은 손, 같은 세션, 같은 관용구. 지뢰 두 개가 나란히 묻혔다.

중요한 건 이 시점의 헤더다. 두 커밋 모두 포인터 선언이 이랬다:

```diff
+	UPROPERTY(Transient)
+	TObjectPtr<UMaterialInstanceDynamic> StateIndicatorMaterialInstance;
```

`Transient` — "이 프로퍼티는 직렬화하지 않는다." 작성자는 런타임 산물인 MID가 저장에 섞이면 안 된다는 걸 **알고 있었고, 막아 뒀다.** 적어도 포인터에 대해서는. 이 시점에서는 아무 문제도 보이지 않는다. 에디터도 조용하고, PIE도 잘 돈다.

---

## 2. 사흘 뒤 — 차폐장이 저장되지 않는다

폭발은 엉뚱한 자리에서 났다. 6월 23일, 26편의 차폐장 작업 — 에너지 실드 돔 컴포넌트를 차폐장 블루프린트(BP_OJJ_ProtectionTower)에 붙이고 저장을 누르자 에디터가 거부했다. 막고 있는 오브젝트의 이름은 `MID_BasicShapeMaterial_0` — 엔진이 자동 명명한 MID다(베이스가 `/Engine/BasicShapes/BasicShapeMaterial`이라 이 이름이 된다). 차폐장은 MID를 만든 적이 없다. 범인은 부모 클래스 MachineBase의 상태등이었다.

그날 밤의 처리는 26편에서 말한 대로 **반쪽 머지**다. PR 본문 원문(⚠️ 미완 섹션, 실명 익명화):

> ## ⚠️ 미완 (이번 PR 제외)
> - **BP_OJJ_ProtectionTower 돔 컴포넌트**: 저장 에러로 보류. 원인 = `MachineBase`(팀원 C 영역) 생성자/OnConstruction의 StateIndicator MID가 construction 시점 생성 → `MID_BasicShapeMaterial_0` "private 참조" 저장에러. **팀원 C 합의 후 MID를 런타임(BeginPlay)으로 이동** 필요.

안전하게 완성된 것(머티리얼·텍스처)만 머지하고, 저장이 안 되는 돔은 원인 분석과 다음 행동까지 적어서 보류. 다음 날 낮, 구두 합의를 거쳐 수정이 들어갔다 — MachineBase는 팀원 C 소유 파일이라, 커밋 메시지에 "합의 하에 수정"이 명시되어 있다. 수정의 핵심은 두 줄이다:

```diff
 	if (MaterialAsset.Succeeded())
 	{
 		MeshComponent->SetMaterial(0, MaterialAsset.Object);
-		StateIndicatorMaterialInstance = UMaterialInstanceDynamic::Create(MaterialAsset.Object, this);
-		StateIndicatorComponent->SetMaterial(0, StateIndicatorMaterialInstance);
+		// [상태등 MID 저장버그 — 합의] 상태등은 정적 베이스 머티리얼만 지정한다. MID는 런타임
+		// (UpdateStateIndicator의 lazy 경로)에서 생성 — 생성자/에디터 construction에서 MID를 만들어 private
+		// UPROPERTY에 보관하면 BP(차폐장 BP_OJJ_ProtectionTower 등) 저장 시 직렬화 에러로 저장이 막힌다.
+		StateIndicatorComponent->SetMaterial(0, MaterialAsset.Object);
 	}
```

```cpp
void AMachineBase::UpdateStateIndicator()
{
	// 에디터 construction(OnConstruction)에서는 MID 생성/갱신을 건너뛴다.
	// HasActorBegunPlay()=false(construction/에디터)면 no-op, 런타임에서만 동작.
	if (!HasActorBegunPlay())
	{
		return;
	}
	// ... (기존 lazy-create — 런타임 첫 호출에서 MID 생성)
```

*(수정 커밋 diff — 주석 일부 축약, 실명 익명화)*

생성자는 정적 베이스 머티리얼만 지정하고, MID는 `HasActorBegunPlay()` 가드 뒤 — 즉 런타임에서만 lazy 생성한다. 트레이드오프도 커밋에 명시됐다: 에디터 프리뷰에서는 상태등 색이 안 보인다(플레이 시에만). 저장 가능과 프리뷰 색 중 저장을 택한 것이다.

이 수정 위에 차폐장 돔 PR이 스택으로 쌓여 있었다(base가 fix 브랜치). 머지 기록을 보면 수정 PR과 돔 PR이 **25초 간격**으로 연달아 들어갔다 — 사흘 막혔던 작업이 수정 머지 직후 곧바로 풀린 흔적이다.

---

## 3. 반전의 해부 — 참조는 포인터로만 흐르지 않는다

여기서 이 편의 질문으로 돌아가자. **포인터는 Transient였다. 그런데 왜 저장이 막혔는가.**

`Transient`가 막는 것은 그 프로퍼티 자신의 직렬화다 — 저장할 때 `StateIndicatorMaterialInstance` 칸은 실제로 비워진다. 문제는 MID로 가는 참조가 그 포인터 하나가 아니었다는 것이다. 생성자 코드를 다시 보면:

```cpp
StateIndicatorComponent->SetMaterial(0, StateIndicatorMaterialInstance);
```

`SetMaterial`은 그냥 렌더링 상태를 바꾸는 함수가 아니다. 컴포넌트의 **머티리얼 오버라이드 배열(`OverrideMaterials`)에 그 머티리얼을 기록**하고, 이 배열은 직렬화 대상이다 — BP를 저장하면 "슬롯 0은 이 머티리얼로 오버라이드됨"이 함께 저장된다. 그러니 저장 시점의 참조 그래프는 이렇다: 포인터 경로는 Transient로 끊었지만, 오버라이드 배열 경로로는 **저장 대상이 아닌 private 오브젝트(MID)** 를 여전히 가리키고 있다. 에디터는 이 불법 참조를 발견하고 저장을 거부한다. 두 사건의 커밋 메시지가 이 경로를 정확히 같은 문장 구조로 지목한다 — 사건 A: "직렬화 대상인 오버라이드가 transient MID를 참조해 ... 'private object 링크' 에러", 사건 B: "MID가 CDO 서브오브젝트로 박혀 컴포넌트 OverrideMaterials 직렬화를 타고 BP_Conveyor 저장을 막음(Illegal private reference)".

요약하면 — **Transient는 "이 변수는 저장 안 함"이지 "이 오브젝트는 어디서도 저장 안 됨"이 아니다.** 오브젝트로 가는 다른 직렬화 경로가 하나라도 살아 있으면(여기선 SetMaterial이 만든 경로), 플래그는 그 경로를 막아 주지 않는다. 27편에서 결론만 적었던 기제의 전체 그림이 이것이다.

---

## 4. 수정 코드의 수명은 5시간이었다

이 이야기의 가장 흥미로운 부분은 수정 다음에 온다.

수정이 머지되고 **약 5시간 뒤**, 다른 팀원이 상태등을 전면 리팩토링했다 — 구체 메시+MID 색상 방식에서 경고 아이콘+포인트라이트 방식으로. 이 교체로 `StateIndicatorMaterialInstance`와 관련 MID 코드 전체가 삭제됐다. 현재 소스에서 이 변수는 grep 0건이다. **오전에 합의까지 거쳐 고친 코드가, 그날 저녁 지구상에서 사라졌다.**

그리고 닷새 뒤인 6월 29일, 또 다른 커밋이 컨베이어 생성자에 이렇게 추가됐다:

```diff
 		PowderVisualMaterialBase = MaterialAsset.Object;
+		OutputOccluderMaterialInstance = UMaterialInstanceDynamic::Create(MaterialAsset.Object, this);
+		if (OutputOccluderMaterialInstance)
+		{
+			OutputOccluderMaterialInstance->SetVectorParameterValue(TEXT("Color"), FLinearColor::Black);
+			OutputOccluder->SetMaterial(0, OutputOccluderMaterialInstance);
+			InputOccluder->SetMaterial(0, OutputOccluderMaterialInstance);
+		}
```

*(도입 diff — 파라미터 일부 생략)*

**생성자에서 MID를 만들어 SetMaterial. 같은 패턴이, 수정 5일 뒤에, 다시 심어졌다.** 악의도 부주의도 아니다 — 이 커밋의 작성자 입장에서는 6월 24일의 수정이 "MachineBase 상태등의 버그 픽스"였지 "생성자 MID 금지라는 팀 규칙"이 아니었던 것뿐이다. 게다가 그 수정 코드 자체가 이미 리팩토링으로 사라진 뒤라, 코드베이스 어디에도 이 패턴을 경고하는 살아 있는 예제가 없었다.

버그는 고쳐졌지만, **패턴은 학습되지 않았다.**

---

## 5. 두 번째 폭발 — 그리고 이번엔 이중 안전장치

6월 20일에 심어진 화살표 MID와 6월 29일에 심어진 Occluder MID는 7월 6일에 함께 터졌다. 발견의 순간은 사운드 확장 작업(31편 말미의 그 PR)이었다 — 컨베이어 가동 루프 사운드를 달면서 BP_Conveyor에 큐를 지정하고 저장을 누르는 순간, 에디터가 저장을 거부했다. 도입으로부터 16일 만이고, 그 fix가 사운드 PR에 편승해 들어간 이유가 이것이다. 수정 커밋 메시지가 계보를 정확히 참조한다: "MachineBase StateIndicator MID 건과 동일 패턴 — 승인." 코드는 죽었지만 커밋 메시지는 남아서, 두 번째 수정의 근거 문서가 됐다.

수정 자체는 사건 A와 같은 방향에 안전장치가 하나 늘었다:

```cpp
	// [MID CDO 오염 수정] MID는 런타임에서만 생성(베이스 = 컴포넌트 현재 머티리얼 — BP 오버라이드 존중).
	// RF_Transient = 직렬화 제외 이중 안전장치(아이템 비주얼 MID와 동일 패턴).
	if (UMaterialInterface* FlowArrowBase = FlowArrowInstances ? FlowArrowInstances->GetMaterial(0) : nullptr)
	{
		FlowArrowMaterialInstance = UMaterialInstanceDynamic::Create(FlowArrowBase, this);
		if (FlowArrowMaterialInstance)
		{
			FlowArrowMaterialInstance->SetFlags(RF_Transient);
			FlowArrowInstances->SetMaterial(0, FlowArrowMaterialInstance);
		}
	}
```

*(AConveyor::BeginPlay 추가분 발췌 — Occluder 블록 생략, 동일 구조)*

생성자는 정적 베이스만, MID 생성은 BeginPlay로, lazy-create 경로에는 `HasActorBegunPlay()` 가드 — 여기까지가 주 방어다. 그리고 `SetFlags(RF_Transient)`가 이중 안전장치로 붙었다. 프로퍼티의 `UPROPERTY(Transient)`(변수를 저장 안 함)와 달리 이건 **오브젝트 자체의 플래그**(이 오브젝트는 직렬화에서 제외)다. 어떤 경로로 참조가 새더라도 오브젝트 쪽에서 한 번 더 거른다.

재미있는 건 `RF_Transient`의 계보다. 이 리포에서 이 플래그는 세 번, 각각 다른 이유로 쓰였다 — 6월 11일 그리드 호버 MID에는 "레벨 dirty(가짜 diff) 차단"용으로, 6월 18일 컨베이어 파우더 MID에는 런타임 생성 관행의 일부로, 그리고 7월 6일에는 저장버그의 이중 안전장치로. 같은 플래그가 팀 안에서 굴러다니며 용도를 넓혀 온 셈이고, 마지막 커밋의 "아이템 비주얼 MID와 동일 패턴"이라는 문구는 그 관행을 명시적으로 상속받았다는 서명이다.

---

## 6. 정리 — 고치는 것과 배우는 것

생성자 MID 저장버그 2부작의 시간선 —

- **06-20 19:15 / 19:17**: 같은 세션에서 MachineBase 상태등·Conveyor 화살표에 생성자 MID 심김 (포인터는 둘 다 `UPROPERTY(Transient)`)
- **06-23**: 차폐장 BP 저장 차단으로 사건 A 발견 (`MID_BasicShapeMaterial_0` "private 참조") → 완성분만 반쪽 머지, 원인·대책을 PR 본문에 기록
- **06-24 낮**: 합의 후 수정 — 생성자 제거 + `HasActorBegunPlay()` 가드, 스택 PR 25초 간격 머지
- **06-24 저녁**: 상태등 리팩토링으로 **수정 코드 소멸** (5시간)
- **06-29**: 다른 손이 같은 패턴(Occluder MID)을 생성자에 재도입 (수정 5일 뒤)
- **07-06**: BP_Conveyor 저장 차단으로 사건 B 폭발 (16일 잠복) → BeginPlay 이동 + `RF_Transient` 이중 안전장치

교훈은 두 줄이다.

**Transient는 변수의 속성이지 오브젝트의 운명이 아니다.** 참조는 포인터로만 흐르지 않는다 — `SetMaterial` 한 줄이 직렬화되는 오버라이드 배열에 참조를 기록하는 순간, 프로퍼티 지정자는 그 경로에 아무 힘이 없다. 저장 안전을 따질 때는 "이 변수가 저장되는가"가 아니라 "이 오브젝트로 가는 직렬화 경로가 존재하는가"를 물어야 한다.

**버그를 고치는 것과 패턴을 팀이 학습하는 것은 다른 일이다.** 사건 A의 수정은 완벽했지만 5시간 뒤 코드째 사라졌고, 5일 뒤 같은 패턴이 다른 손으로 재도입됐다. 살아남아 두 번째 수정을 이끈 것은 코드가 아니라 **커밋 메시지와 PR 본문의 기록**이었다. 27편에서 "규칙으로 못 박는 수밖에 없다"고 썼던 문장의 전사(前史)가 이것이다 — 규칙이 사람 머릿속이나 사라질 코드에 있으면 팀에서는 재발한다. 기록에, 그리고 가능하면 구조(가드·플래그)에 박아야 한다.

머티리얼이 말썽인 건 MID만이 아니었다. 다음 편은 이 프로젝트가 AI 생성 에셋과 함께 사는 대가로 치른 **머티리얼 수난사 전체** — 6월 첫 주의 머신 3종 오염부터, 고쳤다고 믿었던 것이 노트북에서 다시 깨진 날까지다.

---

*이 글은 factory-space(UE5.7, C++) 생성자 MID 저장버그 2건(2026-06-20~07-06, 이슈 #353 계열 PR 및 커밋 a0069ba·a55d268)을 정리한 것입니다. 코드·diff·커밋 메시지는 원문에서 발췌했으며(일부 축약 명시), 협업자는 익명 처리했습니다. 에디터 에러 다이얼로그 전문은 기록이 남아 있지 않아 커밋·PR에 보존된 표현("Illegal private reference", "private object 링크", `MID_BasicShapeMaterial_0`)만 인용했습니다.*
