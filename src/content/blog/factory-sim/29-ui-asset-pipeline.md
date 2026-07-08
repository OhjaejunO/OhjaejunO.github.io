---
title: "공장 시뮬레이션 게임 개발기 — UI 에셋 파이프라인: 위젯은 팀원의 것, 파이프라인의 양끝이 내 것"
description: "이 게임의 HUD와 위젯은 처음부터 끝까지 UI 담당 팀원의 영역이다. 그런데 내 커밋 로그에는 UI 폴더의 파일이 잔뜩 쌓여 있다 — 위젯을 디자인해서가 아니라, 에셋 파이프라인의 양끝을 맡았기 때문이다. 들어가는 쪽에서는 AI 생성 로봇과 UI 이미지를 임포트·보정했고, 나가는 쪽에서는 실시간 캡처한 포트레이트를 팀원의 위젯에 자동으로 물리는 C++를 깔았다. 그 사이 — 바이너리 .uasset 위를 두 사람이 걷는 일의 위험함과, 파이썬 수동 스폰이 월드 서브시스템 자동 스폰으로 승격되는 과정의 기록."
date: 2026-07-08
category: UE5
series: factory-sim
seriesPart: 29
tags: [UE5, C++, AI에셋, UI, 협업, 서브시스템]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — AI 에셋 파이프라인**
> - 6편: [AI 생성 3D 에셋 파이프라인 (GLB 임포트와 자동 정합)](/blog/factory-sim/06-meshy-glb-asset-pipeline)
> - 21편: [로봇 포트레이트 파이프라인 — AI 이미지에서 게임 HUD까지](/blog/factory-sim/21-robot-portrait-pipeline)
> - **29편: UI 에셋 파이프라인 — 위젯은 팀원의 것, 파이프라인의 양끝이 내 것** ← 현재 글

먼저 경계부터 분명히 하자. 이 게임의 UI — 메인 HUD, 대화 말풍선, 퀘스트 창, 인벤토리 — 는 위젯 레이아웃(WBP)부터 위젯 C++ 클래스(`UI_MainHUD`, `UI_DialogueBalloon`, `UI_QuestWindow` 등)까지 **UI 담당 팀원의 영역**이다. 나는 이 위젯들을 디자인한 적이 없다.

그런데 커밋 로그를 보면 내 이름으로 UI 폴더의 파일이 계속 바뀐다. 위젯을 만진 게 아니라 **에셋 파이프라인의 양끝**을 맡았기 때문이다. 들어가는 쪽 — 외부에서 만든 에셋(AI 생성 로봇, UI 이미지)을 엔진 안으로 들여오고 깨진 걸 보정하는 일. 나가는 쪽 — 그렇게 들어온 재료가 팀원의 위젯에 **자동으로** 물리도록 연결하는 C++. 가운데(위젯 본체)는 팀원의 것이고, 나는 그 앞뒤의 배관공이다.

이번 편은 그 양끝 이야기다. 그리고 양끝을 오가다 보면 필연적으로 밟게 되는 것 — 바이너리 `.uasset` 위를 두 사람이 걷는 일의 위험함도.

---

## 1. 입력단 ① — AI 로봇, 임포트는 반나절이고 보정이 본론이다

대화 패널의 얼굴이 될 로봇 캐릭터는 Meshy(Image-to-3D)로 생성해 임포트했다. 파일명에 그 출신이 그대로 남아 있다 — `Meshy_AI_Character_output__2_.uasset`(메시), `Sentinel_biped_Animation_Idle_11_without_skin.uasset`(idle 애니). AI 생성 에셋은 산출물 이름부터가 로그다.

그리고 다음 날, Meshy가 같이 뱉어 준 자동 머티리얼(`Material_1`)이 엔진에서 깨졌다. 자동 생성 머티리얼을 폐기하고 수동 베이스 머티리얼 `M_Robot`을 신설해 텍스처 4채널을 직접 연결하는 것으로 교체 — 이 사건의 전말과 "AI 생성 GLB의 자동 머티리얼은 쓰지 않는다"는 임포트 규약, 그리고 캡처 첫 프레임을 지키기 위한 셰이더 컴파일·텍스처 밉 스트리밍 대기까지는 [21편](/blog/factory-sim/21-robot-portrait-pipeline)에서 이미 풀었다. 여기서는 파이프라인 관점의 요점만 남긴다: **생성은 반나절, 신뢰할 수 있는 임포트가 본론이다.** 6편의 GLB 자동 정합에서 시작해 21편의 임포트 규약까지, AI 에셋 도입기의 절반은 항상 보정 이야기였다.

---

## 2. 입력단 ② — UI 이미지 임포트, 그리고 바이너리 위의 협업

로봇이 3D 쪽 입력이라면, 2D 쪽 입력은 UI 이미지들이다. HUD 채팅/날씨/시간 바(`AI_Chat`, `Chat_Bar`, `Day_Time_Bar`, `Weather_ProgressBar`), 대화·패널 세트(`ai_chat_panel`, `panel_main`, `panel_topbar_chip`, `panel_vertical_list`, `status_bar_empty` 등), 버튼(`btn_normal_final`, `btn_hover_final`) — 여러 PR에 걸쳐 이미지 십수 종을 UI 담당 팀원의 폴더로 임포트하고 위젯에 반영했다. 이 패널·버튼 이미지들은 GPT 이미지 생성으로 제작했다 — 로봇 컨셉 아트를 GPT로 뽑았던 21편과 같은 결이고, 3D는 Meshy·2D는 GPT로 **입력단에 들어오는 재료가 전부 AI 생성물**인 셈이다. (참고로 `AI_Chat`류 이름은 생성 도구 표기가 아니라 게임 내 "AI 채팅" 기능의 UI라는 뜻이다.)

코드 diff가 0인 커밋들이다. 그런데 이 지점이 협업에서 제일 미끄럽다. **UI 에셋 반영은 위젯 `.uasset` 재저장을 동반하고, `.uasset`은 바이너리라 diff도 머지도 안 되기 때문이다.** 실제로 밟은 사례 셋:

**사례 1 — 줄어든 위젯.** 이미지 5종을 반영한 PR에서 `WBP_MainHUD.uasset`이 78.5KB → 76.1KB로 **축소**됐다. 텍스트 diff라면 "무엇이 지워졌는지" 리뷰로 잡히지만 바이너리는 크기 변화가 유일한 신호다. 그래서 PR 본문에 직접 경고를 남겼다:

> `WBP_MainHUD.uasset`가 78.5KB→76.1KB로 축소됨(위젯 제거 가능성). BindWidget 잠금(WBP_QuestWindow 인스턴스명 등) 있는 코어 HUD이므로, 머지 후 BindWidget 깨짐 없는지 확인 권장.

`BindWidget`은 C++ 위젯 클래스와 WBP 디자인을 잇는 이름 계약이다 — 위젯 트리에서 해당 이름의 위젯이 사라지면 컴파일이 아니라 **런타임에** 깨진다. 남의 위젯을 건드린 커밋이라면, 리뷰어가 볼 수 없는 것을 작성자가 대신 말해 줘야 한다.

**사례 2 — 무심코 저장된 남의 위젯.** 다른 버그를 잡는 중에 에디터가 `WBP_MainHUD`를 재저장했고, 그 변경분이 작업 트리에 남았다. 버리지 않고 "램프 버그 작업 중 에디터에서 변경된 위젯 반영"이라는 커밋으로 명시해서 정리했다 — 바이너리 협업의 전형적 잡음인데, 잡음일수록 커밋 메시지로 출처를 남겨야 나중에 "이 위젯 누가 언제 왜 바꿨지"의 답이 남는다.

**사례 3 — 용량 저울질.** 버튼 에셋과 함께 오프닝 영상 4종을 교체한 PR에는 "합계 ~49MB, 개별 최대 28MB — GitHub 100MB 제한 여유"라는 계산이 적혀 있다. LFS 없이 바이너리를 직접 커밋하는 리포에서는 임포트 자체가 리포 비대화와의 거래다.

셋을 관통하는 결론 — **바이너리 에셋 협업에서는 커밋 메시지와 PR 본문이 diff를 대신한다.** 코드라면 도구가 말해 줄 것을 사람이 써야 한다.

---

## 3. 연결단 — 임포트한 것을 위젯에 "자동으로" 물린다

입력단이 재료를 들여왔으면, 이제 팀원의 위젯에 물릴 차례다. 21편에서 로봇 포트레이트는 SceneCapture 액터가 RenderTarget에 실시간으로 찍고, 위젯의 `IMG_Portrait` 칸이 그 RT 머티리얼을 표시하는 구조로 완성됐다. 그 글에서 "스폰도 자동이다"라고 한 줄로 지나간 부분 — 이번엔 그 실체다.

처음에 캡처 액터는 파이썬 스크립트로 레벨에 **수동 배치**되어 있었다. 동작은 하지만, 레벨이 늘 때마다 스크립트를 다시 돌려야 하고 레벨에 배치를 깜빡하면 포트레이트 칸이 그냥 비는 구조다. 이걸 커밋 한 번으로 갈았다 — 커밋 메시지 첫 줄이 의도 그 자체다: *"파이썬 수동 스폰을 코드 자동 스폰으로 대체하고, 대화 패널에 포트레이트를 연결한다."*

핵심은 `UWorldSubsystem` 하나다. 월드가 시작될 때 조건을 검사하고 캡처 액터를 알아서 세운다:

```cpp
void UOJJ_PortraitCaptureSubsystem::OnWorldBeginPlay(UWorld& InWorld)
{
	Super::OnWorldBeginPlay(InWorld);

	// 에디터 프리뷰 등 비게임 월드 제외.
	if (!InWorld.IsGameWorld())
	{
		return;
	}

	// 데디케이티드 서버는 렌더가 없어 포트레이트 캡처가 무의미 — 스폰하지 않는다(메시/RT 로드·캡처 비용 낭비 회피).
	if (InWorld.GetNetMode() == NM_DedicatedServer)
	{
		return;
	}

	const UOJJ_PortraitSettings* Settings = GetDefault<UOJJ_PortraitSettings>();
	if (!Settings)
	{
		return;
	}

	// 현재 persistent 맵명(PIE 접두사 제거) 화이트리스트 체크 — 인게임 레벨에서만 스폰.
	FString MapName = InWorld.GetMapName();
	MapName.RemoveFromStart(InWorld.StreamingLevelsPrefix);
	if (!Settings->AutoSpawnLevels.Contains(FName(*MapName)))
	{
		return;
	}

	// 중복 가드 — 레벨에 이미 (수동 배치/타 경로로) 존재하면 스폰하지 않는다.
	for (TActorIterator<AOJJ_PortraitCapture> It(&InWorld); It; ++It)
	{
		UE_LOG(LogTemp, Log, TEXT("[PortraitSubsystem] '%s'에 기존 PortraitCapture 존재 — 자동 스폰 생략."), *MapName);
		return;
	}

	TSubclassOf<AOJJ_PortraitCapture> SpawnClass = Settings->PortraitCaptureClass.LoadSynchronous();
	if (!SpawnClass)
	{
		SpawnClass = AOJJ_PortraitCapture::StaticClass();
	}

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	const FVector SpawnLoc(0.f, 0.f, Settings->SpawnZ);

	PortraitCaptureInstance = InWorld.SpawnActor<AOJJ_PortraitCapture>(
		SpawnClass, SpawnLoc, FRotator::ZeroRotator, Params);
	// (성공/실패 로그 생략)
}
```

*(OJJ_PortraitCaptureSubsystem.cpp — 로그 2줄 생략)*

가드가 네 겹이다. 에디터 프리뷰 월드 제외, 렌더가 없는 데디케이티드 서버 제외, 레벨 화이트리스트, 그리고 중복 가드. 마지막 가드에는 디테일이 하나 있다 — 이미 있는 액터를 발견해 스폰을 생략한 경우 `PortraitCaptureInstance`에 저장하지 않는다. 그래서 정리 시점에:

```cpp
void UOJJ_PortraitCaptureSubsystem::Deinitialize()
{
	// 자체 스폰분만 정리(레벨 수동 배치분은 건드리지 않음).
	if (PortraitCaptureInstance)
	{
		PortraitCaptureInstance->Destroy();
		PortraitCaptureInstance = nullptr;
	}

	Super::Deinitialize();
}
```

**자기가 세운 것만 자기가 치운다.** 수동 배치분이 남아 있는 레벨과도 공존하는 소유권 규칙이다.

레벨 화이트리스트는 코드에 박지 않고 `UDeveloperSettings`로 뺐다:

```cpp
UCLASS(config = Game, defaultconfig, meta = (DisplayName = "OJJ Portrait Capture"))
class UOJJ_PortraitSettings : public UDeveloperSettings
{
	GENERATED_BODY()
public:
	/** 포트레이트 캡처 액터를 자동 스폰할 레벨(접두사 없는 맵명, 예: L_Planet). 코드 수정 없이 여기서 추가. */
	UPROPERTY(EditAnywhere, config, Category = "AutoSpawn")
	TArray<FName> AutoSpawnLevels;

	/** 스폰할 액터 클래스(미지정 시 AOJJ_PortraitCapture 기본). BP 변형을 쓰려면 여기 지정. */
	UPROPERTY(EditAnywhere, config, Category = "AutoSpawn")
	TSoftClassPtr<AOJJ_PortraitCapture> PortraitCaptureClass;

	/** 메인뷰 격리용 스폰 높이(지하). */
	UPROPERTY(EditAnywhere, config, Category = "AutoSpawn")
	float SpawnZ = -5000.f;
};
```

*(OJJ_PortraitSettings.h — 모듈 API 매크로·카테고리 함수 생략)*

`config = Game`이라 값은 DefaultGame.ini에 저장되고, Project Settings ▸ Game에 편집 칸이 생긴다. 인게임 레벨이 하나 늘면 코드 수정·재컴파일 없이 에디터에서 맵명 하나 추가로 끝난다 — 레벨을 만드는 사람이 곧 팀원이라는 걸 생각하면, 이 설정화가 연결단의 인수인계이기도 하다.

마지막 조각은 RenderTarget 연결이다. 수동 배치 시절엔 에디터에서 RT 에셋을 액터에 손으로 물렸는데, 자동 스폰엔 그 손이 없다. 그래서 생성자에서 기본 RT를 로드한다:

```cpp
// RenderTarget 기본 로드 — 자동 스폰(서브시스템) 시에도 RT가 연결되도록.
// 에디터 배치 시 PortraitRenderTarget을 다른 RT로 덮어쓸 수 있다.
static ConstructorHelpers::FObjectFinder<UTextureRenderTarget2D> RTFinder(
	TEXT("/Game/OJJ/Character/Robot/RT_RobotPortrait.RT_RobotPortrait"));
if (RTFinder.Succeeded())
{
	PortraitRenderTarget = RTFinder.Object;
}
```

*(OJJ_PortraitCapture.cpp 생성자)*

이렇게 하면 파이프라인이 끝에서 끝까지 무인이 된다 — 레벨이 열리면 서브시스템이 캡처 액터를 세우고, 액터는 RT를 물고 태어나고, 팀원의 위젯은 그 RT 머티리얼(`M_Portrait_UI`)을 `IMG_Portrait` 칸에 표시한다. 같은 커밋에서 대화 패널(`WBP_DialogueBalloon`/`WBP_MainHUD`)에 포트레이트 칸이 연결됐고, 레벨에 수동 배치돼 있던 액터는 제거됐다.

---

## 4. 경계 — 가운데는 넘긴다

이 편의 구조를 한 장으로 접으면 이렇다.

```
[입력단 — 내 것]                [가운데 — 팀원의 것]           [연결단 — 내 것]
AI 로봇 생성·임포트·보정   →   WBP 레이아웃, BindWidget,   ←   자동 스폰 서브시스템,
UI 이미지 임포트·반영           위젯 C++ (HUD/말풍선/퀘스트)      설정화, RT 기본 연결
```

가운데를 넘기는 방식은 21편에서 이미 정해져 있었다 — "머티리얼 붙이고 1:1 비율만 지켜 달라"는 인수인계 문서 한 장. 연결단의 C++이 할 일을 다 해 두면 위젯 쪽 계약은 그렇게 얇아진다. 반대로 입력단에서 남의 폴더에 에셋을 들일 때는 2장의 규칙 — 바이너리 변경의 의도를 PR 본문이 대신 말한다 — 이 경계를 지킨다.

26편에서 남의 서브시스템과 경계를 그었다면, 이번엔 남의 **위젯**과 경계를 그은 셈이다. 코드의 경계는 인터페이스로 긋지만, 에셋의 경계는 **소유 폴더·커밋 메시지·인수인계 문서**로 긋는다.

---

## 5. 정리 — 배관공의 일

UI 에셋 파이프라인에서 한 것 —

- 입력단: Meshy 로봇 임포트 + 자동 머티리얼 절연·수동 보정(21편 규약), GPT 생성 UI 이미지 십수 종 임포트·위젯 반영
- 바이너리 협업 3사례: 위젯 축소 경고를 PR 본문에 명시, 무심코 저장된 남의 위젯을 출처 커밋으로 정리, 용량 저울질 기록
- 연결단: 파이썬 수동 스폰 → `UWorldSubsystem` 자동 스폰(가드 4겹 + "자기가 세운 것만 치운다"), `UDeveloperSettings` 레벨 화이트리스트, 생성자 RT 기본 로드
- 위젯 본체는 팀원 영역으로 유지 — 인수인계 계약은 "머티리얼 붙이고 비율 지키기" 한 장

교훈은 두 줄이다.

**파이프라인 담당의 일은 가운데를 대신하는 게 아니라 양끝을 무인화하는 것이다.** 임포트가 규약을 갖추고 연결이 자동이 되면, 가운데(위젯)를 쥔 사람은 재료 걱정 없이 자기 일만 하면 된다.

**바이너리 위에서는 사람이 diff다.** .uasset 협업에서 도구가 잡아 주는 것은 크기 변화뿐이고, 무엇이 왜 바뀌었는지는 커밋 메시지와 PR 본문만이 남긴다 — 그걸 쓰는 비용이 머지 사고 한 번보다 항상 싸다.

다음 편은 이 HUD 위에 마지막으로 올라간 위젯 — 그런데 이번엔 위젯 C++까지 내가 소유한 — 미니맵이다. 그리드 전체를 한 장으로 굽고, 프레임당 캡처 비용 0원으로 문제 머신을 가리키는 지도 이야기.

---

*이 글은 factory-space(UE5.7, C++) UI 에셋 파이프라인 작업(2026-06-27~07-02, PR #408·#432·#444·#449·#451·#483 등)을 정리한 것입니다. 코드 스니펫은 실제 구현에서 발췌했으며, 모듈 API 매크로 등 일부는 생략·일반화했습니다. 협업자는 익명 처리했습니다.*
