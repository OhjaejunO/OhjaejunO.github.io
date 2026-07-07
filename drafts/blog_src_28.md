# 블로그 28편 소스 수집 — 오프닝(스타트) AI 시네마틱

> 대상 저장소: `C:\Users\user\Desktop\factory-space` (원격 https://github.com/PU3-Lab/factory-space)
> 수집 범위: 오프닝/스타트 시네마틱(AI 생성 영상 클립)의 UE 연결부 — 미디어 플레이어 세팅, 레벨 연출 연결, 재생 종료 → 게임 진입 흐름.
> 수집자 메모: 힉스필드(AI 영상 생성) 프롬프트/파라미터는 **리포에 없음**(영상은 완성된 .mp4 바이너리로만 커밋됨). 영상 재생 로직 대부분은 **Blueprint(.uasset, 바이너리)** 이라 노드 그래프 원문 인용 불가 — 커밋 메시지가 구조를 문서화해 그것을 인용함. **C++로 인용 가능한 부분은 "재생 종료 → 게임 진입(POV 각성)" 핸드오프 코드**(`AOJJ_Player` 인트로 시퀀스).

---

## ⚠️ 블로그 게재 시 일반화 필요 항목

| 원문 | 게재 시 |
|------|---------|
| `Wanted_Factory` (프로젝트명), `frontend/Source/Wanted_Factory/...` 경로 | 일반화 or 생략 (예: "프로젝트 소스", "플레이어 클래스") |
| `WANTED_FACTORY_API` (매크로) | 생략 or `PROJECT_API` 식 일반화 |
| `AOJJ_Player`, `UOJJ_CharacterSelectionSubsystem`, `EOJJ_CharacterType` 등 `*OJJ_*` 심볼 | **게재 가능**(1~3편에서 공개된 접두사) |
| `/Game/OJJ/...` 에셋 경로 | **게재 가능** |
| `/Game/Levels/L_StartMenu`, `/Game/Levels/L_Cinematic`, `L_CharacterSelect` 등 팀 공용(LDJ) 경로 | 팀원 이니셜(LDJ) 노출 없이 레벨명만 쓰면 무방 |
| `Ollama`, `FactoryAgent` 등 백엔드 연동 심볼 | 이번 편 무관 — 등장 시 생략 |

---

## 1. 한눈에 보는 사건 순서 (시간순)

| 날짜 | 커밋 | PR | 내용 |
|------|------|-----|------|
| 2026-06-22 01:11 | `44790f8` | #333 | **스타트 화면 영상 배경** — L_StartMenu + MediaPlayer/Source/Material + StartScreen.mp4 최초 도입 |
| 2026-06-22 05:50 | `d0d18b1` | #334 | **게임 진입 흐름 완성** (start→select→cinematic→ingame). **L_Cinematic + WBP_Cinematic: AI 영상 2개(CMT1/CMT2) 순차재생** + 부팅맵 L_StartMenu 전환 |
| 2026-06-22 09:47 | `bea0e00` | #335 | **L_Planet 인트로 연출**(getup 몽타주 + 1인칭→3인칭 카메라) — 시네마틱 종료 후 "POV 각성" C++ |
| 2026-06-22 10:35 | `6380495` | #336 | **인트로 soft-lock/입력·마우스 잠김 버그 해결** + 안전 타임아웃 오발동 수정 |
| 2026-06-25 18:21 | `e9ae455` | (#389 계열) | 시작화면 영상 **스페이스바 스킵** + 캐릭터선택 프리뷰 애니 변경 |
| 2026-06-26 16:42 | `26f8d48` | (직접 push) | **패키징에 영상 포함 설정**(DefaultGame.ini) — 빌드에 Movies 스테이징 |
| 2026-07-02 03:29 | `9da8fe9` | #483 | **스타트/시네마틱/캐릭터선택 영상 교체**(CMT1 6.8MB→28.5MB 등) + UI 버튼 에셋 |
| 2026-07-04 19:02 | `e83dc54` | (#503 계열) | 캐릭터 선택 영상 재교체(사운드 시스템 커밋에 딸림) |

**핵심 3커밋: `d0d18b1`(시네마틱 재생 흐름), `bea0e00`/`6380495`(재생 종료 → POV 각성 C++), `26f8d48`(패키징 영상 포함).**

---

## 2. ⚠️ "3클립" 서사 vs 리포 실제 — 반드시 확인/정리할 것

블로그 기획의 3클립 = ① 콜로니선 자기폭풍 피격 → ② 탈출 포드 추락 → ③ POV 각성.

**리포에 실제로 존재하는 오프닝 영상은 AI 영상 2개(CMT1.mp4 + CMT2.mp4)뿐**이다.
- `d0d18b1` 커밋 메시지 원문: *"L_Cinematic / WBP_Cinematic: **AI 영상 2개 순차재생**(MediaPlayer 1개 + On End Reached + Bool 분기, CMT1/CMT2.mp4)"*
- MediaSource도 `MS_CMT1`, `MS_CMT2` 딱 2개.

따라서 "③ POV 각성"은 **AI 영상 클립이 아니라 인게임 실시간 연출**(L_Planet 진입 시 getup 몽타주 + 카메라 1인칭→3인칭)이다. 즉 화면 연출상 3단계이지만 구현은:
- **AI 영상 2클립**(CMT1 = 콜로니선 피격 / CMT2 = 탈출 포드 추락, 또는 두 서사가 클립에 어떻게 분배됐는지는 영상 내용이라 소스로 확정 불가)
- **+ 인게임 각성 연출 1개**(영상 아님, 실시간 몽타주)

→ 블로그에서 "AI 영상 3클립"이라 쓰면 소스와 어긋남. **"AI 영상 2클립 + 인게임 각성 연출"** 로 서술하거나, 저자에게 CMT1/CMT2 각각이 어떤 서사를 담았는지 확인 필요. (수집자는 영상 내용을 볼 수 없음.)

---

## 3. 미디어 에셋 인벤토리 (현재 `frontend/Content/Movies/`)

```
CMT1.mp4              28,472,261 bytes   (오프닝 클립 1 — 2026-07-02 교체본, 원래 6.8MB)
CMT2.mp4               4,280,060 bytes   (오프닝 클립 2)
StartScreen.mp4       11,897,981 bytes   (스타트 메뉴 배경 영상 — 교체본, 원래 4.1MB)
ChracterSelect.mp4     4,669,389 bytes   (캐릭터 선택 우주선 배경 — 철자 'Chracter' 오타 그대로)
Ending_Cinematic.mp4  34,311,443 bytes   (※ 엔딩 = 20편 소관, 이번 편 아님)

MP_CMT1.uasset / MP_CMT1_Video.uasset    (MediaPlayer — 오프닝용, 1개만 존재)
MS_CMT1.uasset (6,309 B) / MS_CMT2.uasset (3,162 B)   (MediaSource 2개)
M_Cinematic.uasset                        (시네마틱 재생용 머티리얼)
MP_StartScreen*.uasset / MS_StartScreen / M_StartScreen   (스타트 화면 미디어 세트)
MP_CharSelect*.uasset / MS_CharSelect / M_CharSelect       (캐릭터 선택 미디어 세트)
```

**설계 관찰:** MediaPlayer는 오프닝용으로 `MP_CMT1` **1개**뿐인데 MediaSource는 `MS_CMT1`·`MS_CMT2` **2개**. → 커밋 메시지대로 "**MediaPlayer 1개를 재사용**, `OnEndReached`(재생 종료 이벤트)에서 Bool 분기로 소스를 CMT1→CMT2로 교체해 이어붙임". 단일 파일로 합치지 않고 **클립별 개별 재생 + 이벤트 체이닝**. 오디오 트랙 별도 처리 흔적은 소스에 없음(각 mp4에 내장된 것으로 추정, 리포로 확정 불가).

---

## 4. 코드/설정 조각 (원문 인용)

### 4-1. 부팅맵을 스타트 메뉴로 전환 — `DefaultEngine.ini` (커밋 `d0d18b1`)

`frontend/Config/DefaultEngine.ini`:
```ini
 [/Script/EngineSettings.GameMapsSettings]
-GameDefaultMap=/Game/OJJ/Levels/L_Planet.L_Planet
+GameDefaultMap=/Game/Levels/L_StartMenu.L_StartMenu
 EditorStartupMap=/Game/OJJ/Levels/L_Planet.L_Planet
```
→ 패키징 빌드 부팅 시 곧바로 스타트 메뉴(영상 배경) 레벨로 진입. 에디터 작업용 시작맵은 L_Planet 유지(디버그 직행).

### 4-2. `d0d18b1` 커밋 메시지 원문 (시네마틱 재생 구조 — Blueprint라 유일한 서면 근거)

```
[게임진입 2~3단계] 시작화면→캐릭터선택→시네마틱→인게임 전체 흐름 + 레벨 페이드 전환.
- 부팅맵 전환: GameDefaultMap = L_StartMenu (DefaultEngine.ini).
- L_CharacterSelect / WBP_CharacterSelect: 호버 시 춤 + 발판(M_Platform) 발광 강조 + 클릭 선택
  (SetSelectedCharacter) + 우주선 배경영상(ChracterSelect.mp4) + 페이드.
- L_Cinematic / WBP_Cinematic: AI 영상 2개 순차재생(MediaPlayer 1개 + On End Reached + Bool 분기,
  CMT1/CMT2.mp4) + 페이드 인/아웃.
- 레벨 페이드 전환(WBP_FadeIn FadePanel + FadeIn/FadeOut), L_Planet 진입 페이드인.
```

이 커밋으로 새로 추가된 미디어 에셋(git show --stat 발췌):
```
frontend/Content/Levels/L_Cinematic.umap              (new)
frontend/Content/LDJ/UI/WBP/WBP_Cinematic.uasset      (new, 112,100 B)
frontend/Content/Movies/CMT1.mp4                       (new, 6,853,442 B)
frontend/Content/Movies/CMT2.mp4                       (new, 6,729,377 B)
frontend/Content/Movies/MP_CMT1.uasset / MP_CMT1_Video.uasset   (MediaPlayer)
frontend/Content/Movies/MS_CMT1.uasset / MS_CMT2.uasset          (MediaSource x2)
frontend/Content/Movies/M_Cinematic.uasset                       (재생 머티리얼)
frontend/Content/LDJ/UI/WBP/WBP_FadeIn.uasset          (페이드 패널)
```

### 4-3. 시네마틱 → 게임 진입 핸드오프 플래그 (C++, 인용 가능)

`frontend/Source/Wanted_Factory/Public/OJJ_CharacterSelectionSubsystem.h` (헤더 인라인, 별도 .cpp 없음):
```cpp
// [L_Planet 인트로] 시네마틱(L_Cinematic)이 L_Planet 진입 직전 true로 설정 → AOJJ_Player가 BeginPlay에서
// 읽어 getup 몽타주 + 카메라 1인칭→3인칭 연출을 1회 재생. 디버그 직접진입(시네마틱 미경유)은 기본 false라 스킵.
UFUNCTION(BlueprintCallable, Category = "Character Selection")
void SetShouldPlayIntro(bool bInShouldPlayIntro) { bShouldPlayIntro = bInShouldPlayIntro; }

UFUNCTION(BlueprintPure, Category = "Character Selection")
bool GetShouldPlayIntro() const { return bShouldPlayIntro; }

private:
    // [L_Planet 인트로] 인트로 연출 재생 여부(기본 false). 연출 완료 시 AOJJ_Player가 false로 되돌림(1회성).
    UPROPERTY()
    bool bShouldPlayIntro = false;
```
> **연결 구조:** `SetShouldPlayIntro(true)`는 **C++ 어디에도 없음** — WBP_Cinematic(Blueprint)이 두 영상 재생 후 `L_Planet` OpenLevel 직전에 `true`로 세팅한다(BlueprintCallable). C++는 `false` 리셋만 함(2군데, 아래). 즉 "영상 다 봤다 → 게임 진입하면 각성 연출 틀어라"라는 신호가 **Blueprint→GameInstanceSubsystem→C++** 로 전달되는 것이 이번 편 UE 연결부의 핵심.

### 4-4. 재생 종료 → POV 각성 (C++, `AOJJ_Player::BeginPlay` 트리거)

`frontend/Source/Wanted_Factory/Private/OJJ_Player.cpp` (BeginPlay 말미):
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

`AOJJ_Player::PlayIntroSequence()` — 각성 연출 본체 (핵심부, 일부 생략):
```cpp
void AOJJ_Player::PlayIntroSequence()
{
    // [L_Planet 인트로] 누워있다 일어나는 getup 몽타주 재생 + 카메라 1인칭(ArmLength 0) 시작.
    APlayerController* PC = Cast<APlayerController>(GetController());
    UAnimInstance* AnimInstance = GetMesh() ? GetMesh()->GetAnimInstance() : nullptr;

    // 안전 스킵: 필수 요소 누락 시 연출 생략 + 평소 플레이(크래시 방지). ... (생략)
    if (!GetUpMontage || !SpringArm || !AnimInstance) { /* EnableInput + 플래그 소거 후 return */ }

    // 입력 잠금(연출 중 이동/카메라 차단) + 1인칭 시작.
    if (PC)
    {
        DisableInput(PC);
        bIntroInputDisabled = true;
    }
    SpringArm->TargetArmLength = 0.f;

    // getup 몽타주 재생. 실패(0 반환) 시 soft-lock 방지 위해 3인칭 복귀 + 입력 복구.
    const float MontageLength = AnimInstance->Montage_Play(GetUpMontage);
    if (MontageLength <= 0.f)
    {
        SpringArm->TargetArmLength = IntroArmLength;
        TryRestoreIntroInput();
        return;
    }

    // 성공 → 카메라를 메시 HeadSocket에 부착해 진짜 머리 시점(1인칭)으로.
    AttachCameraToHeadSocket();

    // [soft-lock 최종 방어] 안전 타임아웃 = 몽타주 길이 + 여유(블렌드+버퍼).
    const float SafetyDelay = MontageLength + IntroSafetyExtraSeconds;   // IntroSafetyExtraSeconds 기본 8.f
    if (UWorld* World = GetWorld())
    {
        World->GetTimerManager().SetTimer(
            IntroSafetyTimerHandle, this, &AOJJ_Player::ForceFinishIntro, SafetyDelay, false);
    }

    // 몽타주 종료 델리게이트 바인드 → HandleMontageEnded에서 3인칭 블렌드 시작.
    FOnMontageEnded EndDelegate;
    EndDelegate.BindUObject(this, &AOJJ_Player::HandleMontageEnded);
    AnimInstance->Montage_SetEndDelegate(EndDelegate, GetUpMontage);
}
```

`TryRestoreIntroInput()` — 시네마틱 UI 입력모드 잔재 제거(중요):
```cpp
// EnableInput만으로는 PlayerController의 InputMode(UI)가 안 풀려 마우스+이동이 먹통이던 잠김을 차단(TPS=게임 전용).
EnableInput(PC);
PC->SetInputMode(FInputModeGameOnly());
PC->bShowMouseCursor = false;
bIntroInputDisabled = false;
```
> **28편 포인트:** 시네마틱 위젯(WBP_Cinematic)이 UMG 버튼/스킵을 위해 `InputMode(UI)` + 마우스 커서를 켜 둔 상태로 L_Planet에 진입하면, 게임에서 이동·카메라가 먹통이 되는 soft-lock이 발생. 각성 연출이 끝나는 시점에 `FInputModeGameOnly()`로 강제 복원하는 게 "영상 → 게임" 전환의 마지막 매듭.

### 4-5. 관련 UPROPERTY 파라미터 (수치 원문) — `OJJ_Player.h`
```cpp
float IntroArmLength = 270.f;          // 각성 후 3인칭 카메라 스프링암 길이
float IntroBlendSpeed = 2.f;           // 1인칭(0)→3인칭 카메라 FInterpTo 속도
float IntroSafetyExtraSeconds = 8.f;   // 안전 타임아웃 = 몽타주 길이 + 8초
TObjectPtr<UAnimMontage> GetUpMontage; // BP_OJJ_Player에서 할당(MT_WakeUp). 경로 하드코딩 금지, 미할당 시 안전 스킵
FName HeadSocket;                       // getup 동안 카메라 부착 소켓(1인칭 머리 시점)
```
(주의: `bea0e00` 커밋 당시 3인칭 ArmLength가 `0→400`이라 기록됨. 현재 소스 기본값은 `270.f` — 이후 `3fc5f31` "캐릭터 0.7배 축소 + 카메라(270)" 커밋에서 조정된 것으로 보임. 블로그에 수치 쓸 땐 현재값 270 사용 권장.)

### 4-6. 패키징에 영상 포함 (커밋 `26f8d48`, 2026-06-26) — `DefaultGame.ini`
```ini
[/Script/UnrealEd.ProjectPackagingSettings]
...
bSkipMovies=False
...
+DirectoriesToAlwaysStageAsUFS=(Path="Movies")
```
> **28편 포인트(패키징 함정):** 에디터 PIE에선 영상이 잘 나오는데 **패키징 빌드에선 시네마틱이 검은 화면**이 되는 흔한 문제. `Content/Movies/`의 .mp4는 uasset이 아니라 **로우 미디어 파일**이라 기본 쿡/스테이징에서 빠질 수 있음 → `DirectoriesToAlwaysStageAsUFS=(Path="Movies")`로 강제 스테이징 + `bSkipMovies=False`로 무비 스킵 방지. 이 커밋이 "빌드에서 오프닝 영상이 안 나오던" 문제를 잡은 흔적.

---

## 5. 시네마틱 재생 흐름 정리 (소스로 확정 가능한 부분만)

```
[부팅] GameDefaultMap = L_StartMenu (DefaultEngine.ini, d0d18b1)
   └ L_StartMenu: StartScreen.mp4 배경 영상 (MP_StartScreen), Game Start 버튼 (WBP_StartScreen)
        · 스페이스바로 영상 스킵 가능 (e9ae455)
   ↓ 버튼 클릭 → 페이드 → 레벨 전환
[캐릭터 선택] L_CharacterSelect: ChracterSelect.mp4 우주선 배경, 호버 시 춤/발판 발광
   · SetSelectedCharacter(Man/Woman) 저장 (GameInstanceSubsystem)
   ↓ 선택 → 페이드
[오프닝 시네마틱] L_Cinematic + WBP_Cinematic
   · MediaPlayer 1개(MP_CMT1) 재사용
   · CMT1.mp4 재생 → OnEndReached 이벤트 → Bool 분기 → 소스 교체 → CMT2.mp4 재생
   · 페이드 인/아웃, 스페이스바 스킵
   · 영상 종료 → SetShouldPlayIntro(true) 세팅 → OpenLevel(L_Planet)   ← Blueprint 소관
   ↓ 페이드
[게임 진입 = POV 각성] L_Planet, AOJJ_Player::BeginPlay
   · GetShouldPlayIntro()==true → PlayIntroSequence()
   · 입력 잠금 + 카메라 HeadSocket 부착(1인칭) + getup 몽타주(MT_WakeUp) 재생
   · 몽타주 종료 → HandleMontageEnded → Tick이 카메라 ArmLength 0→270 블렌드(3인칭)
   · 블렌드 완료 → TryRestoreIntroInput: EnableInput + InputModeGameOnly + 커서 숨김
   · soft-lock 방어: 안전 타임아웃(몽타주 길이 + 8초) → ForceFinishIntro
```

---

## 6. 못 찾은 항목 / 리포에 없는 것 (명시)

- **힉스필드 AI 영상 생성 프롬프트/파라미터/모델 설정**: 리포에 없음. 완성된 CMT1/CMT2/StartScreen/ChracterSelect .mp4 바이너리로만 존재.
- **WBP_Cinematic / WBP_StartScreen 노드 그래프 원문**: Blueprint(.uasset 바이너리) — 텍스트 인용 불가. 재생 구조는 `d0d18b1`·`6380495` 커밋 메시지가 유일한 서면 근거.
- **각 클립의 정확한 재생 길이(초)·해상도**: 소스로 확정 불가(mp4 메타는 바이너리). 페이드 시간도 UMG 애니 트랙(바이너리)이라 수치 없음. → 필요 시 저자가 영상 파일 직접 확인.
- **CMT1 vs CMT2에 각각 어떤 서사(콜로니선 피격 / 포드 추락)가 담겼는지**: 영상 내용이라 소스로 판단 불가 — 저자 확인 필요(§2 참고).
- **오디오 트랙 별도 처리**: 시네마틱 재생 관련 SoundCue/오디오 트랙 커밋 흔적 없음. 각 mp4 내장 오디오로 추정.

---

## 7. 최종 요약 (핵심 숫자)

- **찾은 관련 커밋**: 8개 (§1 표). 이번 편 직접 핵심 3개.
- **핵심 해시**:
  - `d0d18b1` — 오프닝 시네마틱 재생 흐름(L_Cinematic, CMT1/CMT2, MediaPlayer 1개+OnEndReached 분기) — **PR #334**
  - `bea0e00` — 재생 종료 → POV 각성 인트로 C++ 최초 — **PR #335**
  - `6380495` — 인트로 soft-lock/입력·마우스 잠김 버그 해결 — **PR #336**
  - `26f8d48` — 패키징 영상 포함(Movies 강제 스테이징), 직접 push(PR 없음)
  - `44790f8` — 스타트 화면 영상 배경 도입 — **PR #333**
  - `9da8fe9` — 영상 교체(CMT1 28.5MB로) — **PR #483**
- **못 찾음**: 힉스필드 프롬프트(리포에 없음), Blueprint 노드 원문(바이너리), 클립 길이/해상도(바이너리 메타).
