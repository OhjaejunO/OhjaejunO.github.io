---
title: "공장 시뮬레이션 게임 개발기 — 오프닝 AI 시네마틱: 3막짜리 오프닝, 영상은 두 개뿐이다"
description: "게임을 켜면 콜로니선이 폭풍에 맞고, 탈출 포드가 행성으로 떨어지고, 플레이어가 모래 위에서 눈을 뜬다. 화면상 3막인데 AI 영상은 두 클립뿐이다 — 세 번째 막은 영상이 아니라 인게임 실시간 연출이고, 그 바통 터치는 bool 플래그 하나가 레벨을 넘어 나른다. MediaPlayer 하나로 클립 두 개를 이어 붙인 재생 구조, 에디터에선 멀쩡하던 영상이 패키징 빌드에서 검은 화면이 된 사건, 그리고 mp4가 uasset이 아니라서 생기는 일들의 기록."
date: 2026-07-08
category: UE5
series: factory-sim
seriesPart: 28
tags: [UE5, AI영상, Media, 시네마틱, 패키징]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — AI 시네마틱**
> - 19편: [게임 진입: 캐릭터 선택부터 인트로 연출까지](/blog/factory-sim/19-game-entry-character-intro)
> - 20편: [통신탑 엔딩 시네마틱 — 인게임 카메라와 AI 영상의 하이브리드](/blog/factory-sim/20-comm-tower-ending-cinematic)
> - **28편: 오프닝 AI 시네마틱 — 3막짜리 오프닝, 영상은 두 개뿐이다** ← 현재 글

20편에서 게임의 끝 — 통신탑 엔딩 시네마틱 — 을 다뤘다. 이번엔 반대쪽 끝, 게임을 켜자마자 나오는 **오프닝**이다. 19편이 진입 흐름의 C++ 쪽(캐릭터 선택 보존, 인트로 soft-lock 3종)을 다뤘다면, 이번 편은 그 흐름에 흘러드는 **영상 자체** — AI로 만든 클립들이 어떻게 이어 붙고, 게임으로 바통을 넘기고, 패키징 빌드에서 왜 검은 화면이 됐는지다.

미리 말해 두면, 이 편은 시리즈에서 코드 비중이 가장 낮은 편에 속한다. 영상 재생 로직의 대부분이 Blueprint(WBP_Cinematic)와 미디어 에셋이라 텍스트로 인용할 원문이 없고, 서면 근거는 커밋 메시지다. 그 경계도 사실대로 쓴다.

---

## 1. 부팅맵이 바뀌는 순간

오프닝의 첫 커밋은 영상이 아니라 **ini 한 줄**이다. 부팅맵을 개발용 행성 직행에서 스타트 메뉴로 바꾸는 것:

```ini
[/Script/EngineSettings.GameMapsSettings]
-GameDefaultMap=/Game/OJJ/Levels/L_Planet.L_Planet
+GameDefaultMap=/Game/Levels/L_StartMenu.L_StartMenu
 EditorStartupMap=/Game/OJJ/Levels/L_Planet.L_Planet
```

*(DefaultEngine.ini — 게임 진입 흐름 커밋의 diff)*

`GameDefaultMap`만 바꾸고 `EditorStartupMap`은 행성으로 남겼다 — 패키징 빌드는 스타트 메뉴부터, 에디터 작업은 여전히 행성 직행. 개발 내내 수백 번 누르는 PIE가 매번 메뉴를 거치면 그게 곧 비용이다.

스타트 메뉴(L_StartMenu)의 배경도 정지 이미지가 아니라 영상(StartScreen.mp4)이다. 이후 스페이스바 스킵도 붙었다. 여기까지가 문 앞이고, Game Start를 누르면 캐릭터 선택(L_CharacterSelect, 우주선 배경 영상) → 오프닝 시네마틱(L_Cinematic)으로 이어진다.

---

## 2. 3막의 서사, 2개의 영상

오프닝이 보여 주는 서사는 3막이다. **콜로니선이 폭풍에 피격되고 → 탈출 포드가 행성으로 떨어지고 → 플레이어가 행성 표면에서 눈을 뜬다.** 26편의 자기폭풍, 21편의 "불시착한 행성" 세계관이 여기서 출발한다.

그런데 리포에 있는 오프닝 영상은 **AI 생성 클립 두 개뿐이다** — `CMT1.mp4`, `CMT2.mp4`. 세 번째 막은 영상이 아니다(3장에서 계속). 재생 구조는 Blueprint라 노드 그래프를 인용할 수 없으니, 유일한 서면 근거인 커밋 메시지 원문을 그대로 싣는다:

```
[게임진입 2~3단계] 시작화면→캐릭터선택→시네마틱→인게임 전체 흐름 + 레벨 페이드 전환.
- 부팅맵 전환: GameDefaultMap = L_StartMenu (DefaultEngine.ini).
- L_CharacterSelect / WBP_CharacterSelect: 호버 시 춤 + 발판(M_Platform) 발광 강조 + 클릭 선택
  (SetSelectedCharacter) + 우주선 배경영상(ChracterSelect.mp4) + 페이드.
- L_Cinematic / WBP_Cinematic: AI 영상 2개 순차재생(MediaPlayer 1개 + On End Reached + Bool 분기,
  CMT1/CMT2.mp4) + 페이드 인/아웃.
- 레벨 페이드 전환(WBP_FadeIn FadePanel + FadeIn/FadeOut), L_Planet 진입 페이드인.
```

구조가 한 줄에 요약되어 있다 — **MediaPlayer 1개 + On End Reached + Bool 분기**. 에셋 인벤토리가 이를 뒷받침한다. Movies 폴더에 MediaPlayer는 오프닝용 `MP_CMT1` 하나뿐인데 MediaSource는 `MS_CMT1`·`MS_CMT2` 두 개다. 클립 두 개를 하나의 파일로 합쳐 오지 않고, 플레이어 하나를 재사용하면서 첫 클립의 재생 종료 이벤트(`OnEndReached`)에서 소스를 갈아 끼워 두 번째 클립을 이어 붙였다.

합쳐 오지 않은 덕에 클립은 **개별 교체 가능한 단위**로 남았다 — 실제로 이후 CMT1만 고화질본(6.8MB → 28.5MB)으로 갈아 끼우는 커밋이 있었고, 재생 로직은 무수정이었다. AI 영상 작업의 실제 루프가 "한 클립씩 다시 뽑아 갈아 끼우기"라는 걸 생각하면, 클립 단위 유지가 곧 파이프라인이다.

한계도 사실대로 — AI 영상 생성 쪽의 프롬프트·파라미터는 리포에 없다. 완성된 mp4 바이너리만 커밋되어 있어서, "어떻게 뽑았나"는 저장소가 기억하지 못한다. 각 클립의 길이·해상도도 바이너리 메타라 여기선 확정할 수 없다.

---

## 3. 세 번째 막은 영상이 아니다

3막 — 행성 표면에서 눈을 뜨는 각성 — 은 mp4가 아니라 **인게임 실시간 연출**이다. L_Planet에 진입하면 플레이어 캐릭터가 누운 채로 스폰되고, getup 몽타주가 재생되며 카메라가 머리 시점(1인칭)에서 3인칭으로 빠진다.

이 구조가 만드는 결과 하나 — 각성 장면에는 **방금 고른 캐릭터가 그대로 나온다.** 19편의 외형 스왑(`ApplySelectedCharacterAppearance`)이 인트로 재생 직전에 적용되기 때문이다. 영상으로 만들었다면 남/여 캐릭터별 클립을 따로 뽑아야 했을 장면이다.

영상(Blueprint 세계)에서 인게임 연출(C++ 세계)로 바통을 넘기는 장치는 bool 플래그 하나다. 레벨 트래블을 넘어 살아남는 GameInstanceSubsystem에 실려 있다:

```cpp
// [L_Planet 인트로] 시네마틱(L_Cinematic)이 L_Planet 진입 직전 true로 설정 → AOJJ_Player가 BeginPlay에서
// 읽어 getup 몽타주 + 카메라 1인칭→3인칭 연출을 1회 재생. 디버그 직접진입(시네마틱 미경유)은 기본 false라 스킵.
UFUNCTION(BlueprintCallable, Category = "Character Selection")
void SetShouldPlayIntro(bool bInShouldPlayIntro) { bShouldPlayIntro = bInShouldPlayIntro; }

UFUNCTION(BlueprintPure, Category = "Character Selection")
bool GetShouldPlayIntro() const { return bShouldPlayIntro; }
```

*(OJJ_CharacterSelectionSubsystem.h)*

재미있는 건 `SetShouldPlayIntro(true)`를 부르는 코드가 **C++ 어디에도 없다**는 점이다. 두 영상을 다 재생한 WBP_Cinematic이 L_Planet을 열기 직전에 BlueprintCallable로 세팅한다. C++은 읽고, 소거(1회성 false 리셋)만 한다:

```cpp
// [L_Planet 인트로] 시네마틱(L_Cinematic) 경유 진입 시에만 getup 몽타주 + 카메라 1인칭→3인칭 연출.
// 외형 확정 직후 재생(올바른 ABP에서 getup 몽타주). 디버그 직접진입(플래그 false)은 스킵하고 평소 플레이.
if (UGameInstance* GameInstance = GetGameInstance())
{
	if (UOJJ_CharacterSelectionSubsystem* Selection = GameInstance->GetSubsystem<UOJJ_CharacterSelectionSubsystem>())
	{
		if (Selection->GetShouldPlayIntro())
		{
			PlayIntroSequence();
		}
	}
}
```

*(AOJJ_Player::BeginPlay 말미)*

"영상을 다 봤다"는 사실이 **Blueprint → GameInstanceSubsystem → C++** 세 세계를 통과해 전달된다. 19편의 분업("연출은 BP, 상태는 C++") 그대로다 — 언제 어떤 순서로 영상을 트는지는 BP가 자유롭게 바꾸고, C++은 "인트로를 틀어야 하는가"라는 상태 하나만 레벨 너머로 지킨다. 플래그 기본값이 false라서 에디터에서 행성에 직행하면 각성 연출 없이 바로 평소 플레이인 것도 이 구조의 공짜 보너스다.

각성 연출 자체(입력 잠금, HeadSocket 1인칭, 몽타주 길이 기준 안전 타임아웃, UI 입력모드 잔재 청산)는 [19편](/blog/factory-sim/19-game-entry-character-intro)에서 이미 코드로 풀었으니 여기선 반복하지 않는다.

---

## 4. 패키징의 검은 화면

에디터 PIE에서는 오프닝이 멀쩡했다. 그런데 **패키징 빌드에서 시네마틱이 검은 화면**이 됐다.

원인은 mp4의 신분이다. `Content/Movies/`의 mp4는 uasset이 아니라 **로우 미디어 파일**이다. 쿡은 uasset을 대상으로 돌고, 로우 파일은 스테이징 목록에 명시되지 않으면 패키지에 실리지 않는다. 게임은 정상 부팅되고 레벨도 열리는데 MediaSource가 가리키는 파일만 없으니 — 재생 실패, 검은 화면. 에러 팝업도 없다.

수정은 DefaultGame.ini 두 줄이다:

```ini
[/Script/UnrealEd.ProjectPackagingSettings]
bSkipMovies=False
+DirectoriesToAlwaysStageAsUFS=(Path="Movies")
```

`DirectoriesToAlwaysStageAsUFS`가 Movies 디렉토리를 통째로 강제 스테이징하고, `bSkipMovies=False`가 무비 스킵 옵션을 차단한다. 커밋 한 줄짜리 수정인데, 증상(검은 화면)에서 원인(스테이징 누락)까지의 거리가 먼 종류의 문제다 — 코드도 에셋도 다 멀쩡하고, 빌드 구성만 문제니까.

20편의 엔딩 영상(Ending_Cinematic.mp4)도 같은 Movies 폴더라 이 설정 하나로 함께 해결된다. 오프닝과 엔딩이 같은 배관을 쓰는 셈이다.

---

## 5. 영상은 계속 교체된다 — 리포에 남은 흔적

오프닝 작업의 마지막 결은 **교체 이력**이다. 최초 커밋의 CMT1은 6.8MB였는데, 열흘 뒤 28.5MB 고화질본으로 교체됐다. 스타트 화면·캐릭터 선택 영상도 같이 갈렸다. 해당 PR 본문에는 이런 리스크 관리 문구가 남아 있다:

> 합계 ~49MB, 개별 최대 28MB — GitHub 100MB 제한 여유

mp4를 LFS 없이 리포에 직접 커밋하고 있으니, 교체할 때마다 개별 파일 100MB 제한과 리포 비대화를 저울질한 흔적이다. 참고로 캐릭터 선택 영상의 파일명은 `ChracterSelect.mp4` — 오타(Chracter)가 최초 커밋부터 지금까지 그대로다. 에셋 파일명은 한 번 참조가 걸리면 고치는 비용이 오타를 참는 비용보다 커진다.

---

## 6. 정리 — 오프닝은 세 세계의 릴레이다

오프닝 AI 시네마틱에서 한 것 —

- 부팅맵을 스타트 메뉴로 전환(에디터는 행성 직행 유지), 메뉴·선택 화면도 영상 배경
- 서사 3막을 **AI 영상 2클립 + 인게임 각성 연출 1개**로 구현 — MediaPlayer 1개를 재사용하며 OnEndReached에서 소스 교체로 클립 체이닝
- 영상 → 게임 바통 터치는 GameInstanceSubsystem의 bool 플래그 — Set은 Blueprint, Get·소거는 C++
- 패키징 검은 화면 → mp4는 uasset이 아니다, `DirectoriesToAlwaysStageAsUFS`로 강제 스테이징
- 클립 단위 교체 가능 구조 덕에 고화질본 교체가 재생 로직 무수정으로 끝남

교훈은 두 줄이다.

**연출의 단위와 교체의 단위를 맞춰라.** 클립 두 개를 한 파일로 합쳤다면 재생 로직은 단순해졌겠지만, 클립 하나를 다시 뽑을 때마다 전체를 다시 합쳐야 한다. AI 영상처럼 재생성이 잦은 에셋일수록 교체 단위를 잘게 유지하는 쪽이 이긴다.

**에셋의 신분을 확인하라.** uasset은 쿡이 챙겨 주지만 로우 파일은 아니다. PIE에서 보이는 것과 패키지에 실리는 것은 다른 질문이고, 그 차이는 출시 직전에야 검은 화면으로 나타난다.

다음 편은 HUD로 간다. UI 위젯은 처음부터 끝까지 팀원의 영역인데, 내 커밋 로그에는 왜 UI 폴더 파일이 잔뜩 쌓여 있는가 — 에셋 파이프라인의 양끝 이야기다.

---

*이 글은 factory-space(UE5.7, C++) 오프닝 시네마틱 작업(2026-06-22~07-02, PR #333·#334·#335·#336·#483 및 패키징 설정 커밋)을 정리한 것입니다. 코드·설정 스니펫은 실제 소스와 커밋 diff에서 발췌했으며, Blueprint 재생 로직은 커밋 메시지를 근거로 서술했습니다.*
