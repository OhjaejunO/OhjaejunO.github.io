---
title: "공장 시뮬레이션 게임 개발기 — 게임 진입: 캐릭터 선택부터 인트로 연출까지"
description: "시작 화면에서 캐릭터를 고르고, 시네마틱을 보고, 행성에 누운 채로 깨어나 일어선다. 이 짧은 진입 흐름에 함정이 셋 있었다 — 캐릭터를 따로 폰으로 만들 뻔했고, 인트로가 끝났는데 입력이 영영 안 풀렸고, 안전장치라고 넣은 타임아웃이 정상 연출을 망쳤다. 단일 pawn 외형 스왑, 레벨을 넘는 선택값 보존, 그리고 세 겹의 soft-lock을 잡아 게임 진입을 매끄럽게 만든 기록."
date: 2026-06-24
category: UE5
series: factory-sim
seriesPart: 19
tags: [UE5, C++, 캐릭터, 게임진입, 카메라, 애니메이션]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — 막간: 게임 진입**
> - **게임 진입: 캐릭터 선택부터 인트로 연출까지** ← 현재 글
> - (이어지는 편: 경사 컨베이어·메시 개편 — 예정)

지금까지(1~18편) 그리드 위에 뭘 짓는 이야기만 했다. 이번엔 그 앞 — **게임을 켜고 행성에 도착하기까지**의 짧은 여정이다.

흐름은 단순하다. 시작 화면에서 캐릭터(남/여)를 고르고, AI로 만든 시네마틱을 본 뒤, 행성에 누운 채로 깨어나 1인칭에서 3인칭으로 카메라가 빠지며 일어선다. 화면만 보면 매끄러운데, 만드는 과정엔 함정이 셋 있었다 — 캐릭터를 따로 폰으로 만들 뻔했고, 인트로가 끝났는데 입력이 영영 안 풀렸고, 안전장치라고 넣은 타임아웃이 정상 연출을 망쳤다.

세 막으로 나눠 본다. 흥미로운 건 코드가 스스로 단계를 표시해뒀다는 거다 — 주석에 [게임진입 1단계], [2~3단계]가 적혀 있어 그게 곧 이 글의 목차가 됐다.

---

## 1막. 캐릭터 선택 — 단일 pawn, 외형만 바꾼다

가장 먼저 내린 결정이자 가장 중요한 결정 — **남/여 캐릭터를 별도 폰으로 만들지 않는다.** `BP_Man`, `BP_Woman` 두 개를 두면 분기가 사방으로 번진다. pawn은 하나(`AOJJ_Player`)로 두고, 선택값에 따라 메시와 애니메이션 클래스만 갈아끼운다.

여기서 풀어야 할 문제가 하나 있었다. **선택값을 어떻게 인게임까지 가져가나.**

시작 화면에서 인게임은 레벨 트래블이다. 레벨이 바뀌면 액터도 레벨 단위 데이터도 다 날아간다. 메뉴에서 "여자 캐릭터" 골랐는데 행성에 도착하니 초기화되면 곤란하다. 답은 `GameInstanceSubsystem`이었다 — 이 서브시스템은 레벨을 넘어 살아남는다. 이 프로젝트가 이미 7개 서브시스템을 쓰던 그 패턴 그대로, 선택값 보존용 하나를 더 얹었다.

```cpp
UENUM(BlueprintType)
enum class EOJJ_CharacterType : uint8 { Man, Woman };

// GameInstanceSubsystem → 메뉴→인게임 레벨 트래블을 넘어 선택값 유지
class UOJJ_CharacterSelectionSubsystem : public UGameInstanceSubsystem
{
    void SetSelectedCharacter(EOJJ_CharacterType In) { SelectedCharacter = In; }
    EOJJ_CharacterType GetSelectedCharacter() const { return SelectedCharacter; }
private:
    EOJJ_CharacterType SelectedCharacter = EOJJ_CharacterType::Man; // 직부팅도 Man으로 정상
};
```

실제 외형 적용은 인게임 진입 후 `BeginPlay`에서 일어난다. 선택값으로 DataAsset(종류 → 메시+ABP 매핑)을 조회해 `GetMesh()`의 스켈레탈 메시와 애님 클래스를 교체한다.

```cpp
void AOJJ_Player::ApplySelectedCharacterAppearance()
{
    if (!AppearanceData) return;                          // DA 미할당 → BP 기본 메시 유지
    UGameInstance* GI = GetGameInstance();
    if (!GI) return;
    auto* Selection = GI->GetSubsystem<UOJJ_CharacterSelectionSubsystem>();
    if (!Selection) return;

    const FOJJ_CharacterAppearance* App =
        AppearanceData->Appearances.Find(Selection->GetSelectedCharacter());
    if (!App) return;

    USkeletalMeshComponent* MeshComp = GetMesh();
    if (!MeshComp) return;
    if (App->SkeletalMesh) MeshComp->SetSkeletalMeshAsset(App->SkeletalMesh); // 외형만 스왑
    if (App->AnimClass)    MeshComp->SetAnimInstanceClass(App->AnimClass);
}
```

눈여겨볼 건 **null-guard 체인**이다. DataAsset 미할당, 서브시스템 없음, 매핑 항목 없음, 메시 없음 — 어디서 끊겨도 그냥 안전하게 빠져나가 BP 기본 메시를 유지한다. 크래시가 아니라 graceful fallback. 콘솔에서 캐릭터를 바꾸는 디버그 Exec도 위젯 만들기 전에 이 경로를 검증하는 용도였다.

> 참고: 캐릭터 애니메이션은 대부분 에디터/에셋 작업(BlendSpace, ABP 스테이트머신)이라 코드 글에선 깊이 다루지 않는다. 다만 함정 하나 — Meshy로 임포트한 리그는 별도 root 본이 없어 hips가 최상위가 되는데, 그 탓에 Idle에서 발이 살짝 떠 있었다. hips 트랙 Z를 전 프레임 -11.5 시프트해 접지시켰다. AI 생성 리그의 구조적 한계라, 재임포트하면 보정이 사라진다(6편 Meshy GLB 파이프라인의 연장선).

---

## 2막. 게임 진입 흐름 — BP가 트리거, C++이 상태를 보존한다

캐릭터를 골랐으니 행성까지 가야 한다. 전체 경로는 네 개의 레벨을 거치는 트래블이다.

```
L_StartMenu ──시작──▶ L_CharacterSelect ──선택──▶ L_Cinematic ──영상 종료──▶ L_Planet
  (부팅맵)        (호버 춤·발판 발광·클릭)    (AI 영상 2개 순차)      (페이드인 + 인트로 시작)
```

- **시작 화면**(`L_StartMenu`)이 부팅맵이다.
- **선택 화면**(`L_CharacterSelect`)에서 캐릭터에 호버하면 춤추고 발판이 발광하며, 클릭하면 종류가 확정된다.
- **시네마틱**(`L_Cinematic`)에서 AI로 만든 영상 2개가 순차 재생된다(MediaPlayer + On End Reached 분기).
- 영상이 끝나면 **행성**(`L_Planet`)으로 페이드인하며 인트로가 시작된다.

여기서 구조적으로 중요한 경계가 하나 있다. **이 흐름의 트리거는 거의 다 Blueprint·레벨·미디어 에셋이고, C++이 닿는 곳은 딱 두 군데뿐이다** — 선택 확정 시 `SetSelectedCharacter`, 시네마틱 종료 시 `SetShouldPlayIntro(true)`. 즉 "언제·어떻게 전환되는가"는 BP가 연출하고, "무엇이 선택됐고 인트로를 틀어야 하는가"라는 *상태*만 C++ 서브시스템이 레벨 너머로 보존한다. 연출은 BP, 상태는 C++ — 이 분업이 깔끔하면 진입 흐름을 BP에서 자유롭게 바꿔도 코드가 안 흔들린다.

---

## 3막. 인트로 연출 — 일어서는 카메라, 그리고 세 겹의 soft-lock

행성에 도착하면 캐릭터는 누워 있다. `BeginPlay`가 `bShouldPlayIntro`를 확인하고 `PlayIntroSequence()`를 부른다.

연출 자체는 이렇게 흐른다 — 입력을 잠그고 SpringArm 길이를 0으로(1인칭 시작) → 카메라를 머리 본(`HeadSocket`)에 부착해 진짜 1인칭 시점 → getup 몽타주 재생 → 몽타주가 끝나면 카메라를 머리에서 떼 원위치로 복원하고 카메라 블렌드 시작 → Tick에서 ArmLength를 0 → 400으로 보간해 3인칭으로 수렴. 누운 1인칭에서 일어서며 카메라가 뒤로 빠지는, 흔한 게임 오프닝의 그 연출이다.

문제는 연출이 아니라 **그 뒤처리**였다. 인트로가 끝났는데 입력이 안 풀리는 soft-lock이 세 가지 경로로 났다.

**버그 ① — DisableInput/EnableInput 불균형.** 인트로 시작 때 입력을 끄는데, `BeginPlay` 시점엔 PlayerController가 아직 null일 수 있다. `DisableInput(null)`은 모든 컨트롤러에 broadcast로 먹는데, 나중에 `EnableInput(validPC)`는 특정 PC 하나만 푼다. 1:1이 안 맞으니 잠금이 안 풀렸다. → PC가 유효할 때만 끄고, 껐다는 사실을 플래그(`bIntroInputDisabled`)로 기록한 뒤, 복구는 그 플래그가 켜졌을 때만 1:1로 푼다.

**버그 ② — 안전 타임아웃이 몽타주보다 짧았다.** 혹시 인트로가 안 끝날까봐 안전 타임아웃을 걸어뒀는데, 그게 6초 절대값 고정이었다. 그런데 getup 몽타주가 그보다 길었다. 그래서 정상 재생 도중에 타임아웃이 터져 카메라가 뚝 스냅되고 입력이 조기 복구되며 캐릭터가 미끄러졌다. **안전장치가 정상 동작을 망친** 전형적인 케이스다.

```cpp
const float MontageLength = AnimInstance->Montage_Play(GetUpMontage);
if (MontageLength <= 0.f)
{
    // 몽타주 재생 실패: 즉시 3인칭 복귀 + 입력 복구 (Codex가 지적한 누락 경로)
    SpringArm->TargetArmLength = IntroArmLength;
    TryRestoreIntroInput();
    return;
}
AttachCameraToHeadSocket();

// 옛 절대 6초는 몽타주보다 짧아 재생 중 터지던 버그
// → 몽타주 길이 + 여유로 잡아, 정상 연출을 절대 방해하지 않게
const float SafetyDelay = MontageLength + IntroSafetyExtraSeconds;
World->GetTimerManager().SetTimer(IntroSafetyTimerHandle, this,
    &AOJJ_Player::ForceFinishIntro, SafetyDelay, false);
```

`Montage_Play`의 반환값이 몽타주 길이다. 그걸 기준으로 타임아웃을 잡으니, 안전망이 정상 연출보다 항상 늦게 깨어난다. 정상 완료되면 ClearTimer로 취소한다.

**버그 ③ — 시네마틱 위젯이 남긴 UI 입력 모드 잔재.** `EnableInput`을 했는데도 마우스와 이동이 먹통이었다. 시네마틱 위젯이 켜둔 `InputMode(UI)`와 마우스 커서가 안 풀린 거였다. → 입력 복구 지점에서 `FInputModeGameOnly()` + `bShowMouseCursor=false`로 명시 청산.

세 수정을 한곳에 모은 게 **단일 복구 출처** `TryRestoreIntroInput()`이다.

```cpp
bool AOJJ_Player::TryRestoreIntroInput()
{
    APlayerController* PC = Cast<APlayerController>(GetController());
    if (bIntroInputDisabled)
    {
        if (!PC) return false;                       // PC 없으면 보류 → 다음 틱 재시도
        EnableInput(PC);                             // DisableInput과 1:1
        PC->SetInputMode(FInputModeGameOnly());      // 시네마틱 UI모드 잔재 청산
        PC->bShowMouseCursor = false;
        bIntroInputDisabled = false;
    }
    // … bShouldPlayIntro 1회성 소거 (입력 복구가 보장된 뒤에만) …
    return true;
}
```

그리고 **최종 방어선** `ForceFinishIntro`. 만약 몽타주 종료 델리게이트가 끝내 안 오면 `bBlendingCamera`가 영영 false로 남아 영구 잠김이 된다. 그래서 안전 타이머 콜백이 잔여 상태를 감지하면(블렌드 중이거나, 입력이 잠겼거나, 카메라가 머리에 붙어 있으면) 몽타주를 멈추고 카메라·입력을 강제 복구한다. PC가 그때도 없으면 0.5초 뒤 재시도해 끝까지 수렴시킨다.

이 마지막 복구 경로는 Codex 교차검증에서 나온 것이다 — 몽타주 재생이 실패하는 경로(`MontageLength <= 0`)에서 입력 복구가 빠져 있던 걸 지적받아 `TryRestoreIntroInput` 호출을 추가했다. 정상 경로만 보면 안 보이는, 실패 경로의 구멍이었다.

---

## 정리 — 진입은 첫인상이고, soft-lock은 최악의 첫인상이다

게임 진입은 플레이어가 처음 만나는 화면이다. 여기서 입력이 안 풀리면 그 게임은 시작도 못 하고 끝난다. 이 막간에서 한 것 —

- 캐릭터를 별도 폰이 아니라 **단일 pawn 외형 스왑**으로 (분기 폭발 방지)
- 선택값을 **레벨 너머로 보존**하는 GameInstanceSubsystem
- 누운 1인칭 → 일어선 3인칭 **카메라 블렌드**
- 세 경로의 **soft-lock** 제거 + 델리게이트 미발화 대비 **최종 방어선**

soft-lock 셋을 관통하는 교훈을 하나 꼽으면 — **"잠그는 코드와 푸는 코드는 반드시 짝이 맞아야 한다."** DisableInput과 EnableInput을 1:1로, 안전 타임아웃을 정상 연출보다 늦게, UI 모드를 켰으면 끄는 것까지. 그리고 짝이 어긋날 모든 경로(PC null, 델리게이트 미발화, 재생 실패)에 복구를 깔아야 한다. 사다리에서 "감지와 시작을 갈랐"고 고스트에서 "정보와 액션을 갈랐"다면, 여기서는 "잠금과 해제를 짝지었다." 게임이 플레이어를 가두지 않게 하는 일이다.

다음 편은 경사 컨베이어와 메시 개편으로 돌아간다.

---

*이 글은 factory-space(UE5.7, C++) 개발 중 캐릭터 선택·게임 진입 흐름(커밋 2ff242e·d0d18b1·bea0e00·6380495) 작업을 정리한 것입니다. 코드 스니펫은 실제 `OJJ_` 파일에서 발췌했으며, 가독성을 위해 일부 축약·일반화했습니다.*
