# 29편 소스 수집 — UI/HUD 에셋 파이프라인 (OJJ 기여분)

수집일: 2026-07-07
대상 저장소: `C:\Users\user\Desktop\factory-space` (원격 PU3-Lab/factory-space)
저자 필터: `OhjaejunO` / `ojaejun1995-sys` / `ojaejun1995@gmail.com`

---

## ⚠️ 블로그 게재 시 일반화 필요 항목

- **`WANTED_FACTORY_API` (매크로), `Wanted_Factory` (모듈/프로젝트명)** → 게재 금지. 일반화("게임 모듈 API 매크로")하거나 생략. 코드 인용 시 `WANTED_FACTORY_API`는 `GAME_API` 등으로 치환 권장.
- **`AOJJ_*` 클래스 접두사, `/Game/OJJ/...` 에셋 경로** → 1~3편에서 이미 공개됨, 게재 가능.
- **`Content/LDJ/UI/...` 경로 및 `WBP_*` 위젯** → LDJ(다른 팀원)의 UI 폴더. 경로 자체는 협업자 식별 정보이므로 게재 시 익명화 권장(예: "UI 담당 팀원 폴더").
- **협업자 실명/계정** → 익명화 권장:
  - `Dong` / `Dongruru` `<vmvm7852@gmail.com>` = **UI 담당 팀원(문서상 LDJ)**. WBP 위젯 C++ 클래스(`UI_MainHUD`, `UI_DialogueBalloon`, `UI_QuestWindow`, `UI_Inventory` 등) 및 `Content/LDJ/UI/` 폴더 소유자.
  - 커밋 메시지의 "LDJ 인수인계" 등 표현은 "UI 팀원에게 인계"로 일반화.
- **AI 생성 도구명(Meshy)** → 게재 가능(도구 소개 맥락). 단 원본 파일명(`Meshy_AI_Character_output`, `Sentinel_0629010424_texture`)은 그대로 인용해도 무방하나 프로젝트 식별과 무관.

---

## 핵심 요약 (OJJ vs 팀원 영역 구분)

**29편의 핵심 서사**: OJJ는 "UI 위젯 자체를 디자인/레이아웃한 사람"이 아니다. UI 위젯(WBP) 레이아웃과 C++ 위젯 클래스는 **UI 담당 팀원(LDJ/Dong)의 영역**이다. OJJ가 이 시리즈에서 맡은 UI/HUD 관련 기여는 **에셋 파이프라인의 양끝**이었다:

1. **입력단(에셋 임포트)**: AI 생성 이미지/3D를 게임에 임포트하고 임포트 깨짐을 수정 — 로봇 캐릭터(Meshy AI), HUD/패널 UI 이미지 텍스처(LDJ 폴더로 임포트), UI 버튼 에셋.
2. **연결단(C++ 위젯 연결)**: 실시간 캡처한 로봇 포트레이트를 팀원의 대화 패널(`WBP_DialogueBalloon`/`WBP_MainHUD`)에 **자동으로 물려주는** 파이프라인 — `UOJJ_PortraitCaptureSubsystem`(자동 스폰) + `UOJJ_PortraitSettings`(설정) + RT/머티리얼 연결.

즉 21편(로봇 포트레이트 실시간 캡처 → WBP_DialogueBalloon/WBP_MainHUD)에서 만든 캡처 액터를, **29편에서는 "레벨에 자동 스폰되고 팀원 위젯에 자동 연결되는" 파이프라인으로 승격**시킨 것이 OJJ 기여의 뼈대다.

**팀원(LDJ/Dong) 영역 (수집 대상 아님, 구분용)**:
- `UI_MainHUD.cpp` (첫 커밋 Dong, 2026-06-05)
- `UI_DialogueBalloon.cpp` (Dong, 2026-06-16)
- `UI_QuestWindow.cpp` (Dong, 2026-06-16)
- `UI_Inventory.cpp` (Dong, 2026-06-09)
- `Content/LDJ/UI/WBP/*` 위젯 블루프린트 레이아웃(OJJ는 이미지 칸/포트레이트 연결만 반영, 레이아웃 설계는 팀원)

**OJJ 소유 UI C++**:
- `UI_Minimap.cpp` (첫 커밋 OhjaejunO, 2026-07-04) — 미니맵. UI 폴더에 있지만 OJJ 소유. (29편 중심 주제는 아님, 별도 편 후보)
- `Private/OJJ_PortraitCapture*.cpp`, `OJJ_PortraitSettings.cpp` (OhjaejunO, 2026-06-28) — 포트레이트 파이프라인.

---

## 시간순 사건 정리

### 사건 1 — 로봇 캐릭터를 AI로 생성해 임포트 (Meshy AI)
- **f473476** `feat(content): 로봇 캐릭터 메시/머티리얼/텍스처/애니 임포트` — 2026-06-28, PR **#432**
  - AI 3D 생성 도구 **Meshy**로 만든 로봇 캐릭터를 임포트. 파일명에 AI 생성 흔적이 그대로 남음:
    - `Content/OJJ/Character/Robot/Meshy_AI_Character_output__2_.uasset` (메시)
    - `Meshy_AI_Character_output__2__Skeleton.uasset`, `..._Anim.uasset`
    - `Sentinel_biped_Animation_Idle_11_without_skin.uasset` (아이들 애니)
    - `texture_0.uasset` (8.5MB PBR 텍스처), `Material_1.uasset`
  - 이 로봇이 곧 대화 포트레이트로 캡처될 대상 메시.

### 사건 2 — Meshy 임포트 머티리얼 깨짐 수정
- **b877a2b** `fix: Meshy 임포트 머티리얼 깨짐 → 수동 M_Robot 베이스 머티리얼로 교체` — 2026-06-29, PR **#444**
  - Meshy가 뱉은 `Material_1`이 UE에서 깨져(자동 생성 머티리얼 호환 문제), 수동으로 `M_Robot` 베이스 머티리얼 신설 후 교체.
  - diff 파일 목록(에셋 교체 증거):
    ```
    Content/OJJ/Character/Robot/M_Robot.uasset            (신규 20294 bytes)
    Content/OJJ/Character/Robot/Material_1.uasset         (삭제, 70441 → 0)
    Content/OJJ/Character/Robot/Meshy_AI_Character_output__2_.uasset (재저장)
    ..._Sentinel_0629010424_texture_texture_0.uasset      (신규 7086934 bytes)
    ..._Sentinel_0629010424_texture_texture_1.uasset      (신규 5032751 bytes)
    ..._Sentinel_0629010424_texture_texture_2.uasset      (재저장)
    ..._Sentinel_0629010424_texture_texture_3.uasset      (신규 580469 bytes)
    ```
  - **교훈 포인트**: AI 생성 3D 에셋은 메시·애니는 쓸 만해도 머티리얼/텍스처 슬롯 연결이 엔진에서 깨지는 경우가 흔해, 베이스 머티리얼 수동 재구성이 파이프라인의 필수 단계.

### 사건 3 — HUD 채팅/날씨/시간 UI 이미지 임포트 (팀원 위젯에 반영)
- **ae9eee8** `feat(ui): HUD 채팅/날씨/시간 UI 수정 + 이미지 에셋 임포트` — 2026-06-27, PR **#408**
  - 커밋 본문:
    ```
    - WBP_MainHUD, WBP_DialogueBalloon 수정
    - 이미지 임포트: AI_Chat / Chat_Bar / Day_Time_Bar / Machine_Frame / Weather_ProgressBar
    ```
  - 변경 파일 (전부 바이너리, 코드 diff 0):
    ```
    Content/LDJ/UI/UI_Image/AI_Chat.uasset            (신규 195153 bytes)
    Content/LDJ/UI/UI_Image/Chat_Bar.uasset           (신규 1285057 bytes)
    Content/LDJ/UI/UI_Image/Day_Time_Bar__2_.uasset   (신규 1255765 bytes)
    Content/LDJ/UI/UI_Image/Machine_Frame.uasset      (신규 1545126 bytes)
    Content/LDJ/UI/UI_Image/Weather_ProgressBar.uasset(신규 512621 bytes)
    Content/LDJ/UI/WBP/WBP_DialogueBalloon.uasset     (58085 → 58942)
    Content/LDJ/UI/WBP/WBP_MainHUD.uasset             (78470 → 76130, 축소)
    ```
  - **PR #408 본문 중 머지 주의사항(협업 마찰 원문)**:
    > `WBP_MainHUD.uasset`가 78.5KB→76.1KB로 **축소**됨(위젯 제거 가능성). BindWidget 잠금(WBP_QuestWindow 인스턴스명 등) 있는 코어 HUD이므로, 머지 후 BindWidget 깨짐 없는지 확인 권장.
  - → **팀원 소유(BindWidget 잠금) 위젯을 OJJ가 건드리며 생긴 리스크를 PR에서 명시**한 케이스. (blog 소재: 바이너리 UI 에셋이 협업에서 왜 위험한지)

### 사건 4 — 채팅/대화 패널 UI 이미지 6종 임포트 + 위젯 갱신
- **eda854c** `feat(ui): 채팅/대화 패널 UI 이미지 임포트 + 위젯 갱신` — 2026-06-29, PR **#449**
  - 변경 파일:
    ```
    Content/LDJ/UI/UI_Image/ai_chat_panel.uasset      (신규 1390118 bytes)
    Content/LDJ/UI/UI_Image/chat_input_bar.uasset     (신규 1119781 bytes)
    Content/LDJ/UI/UI_Image/panel_main.uasset         (신규 1552637 bytes)
    Content/LDJ/UI/UI_Image/panel_topbar_chip.uasset  (신규 1399185 bytes)
    Content/LDJ/UI/UI_Image/panel_vertical_list.uasset(신규 1587572 bytes)
    Content/LDJ/UI/UI_Image/status_bar_empty.uasset   (신규 1312675 bytes)
    Content/LDJ/UI/WBP/WBP_DialogueBalloon.uasset     (58900 → 59668)
    Content/LDJ/UI/WBP/WBP_MainHUD.uasset             (78035 → 75456)
    Content/LDJ/UI/WBP/WBP_QuestWindow.uasset         (77053 → 86210)
    ```
  - PR #449 본문: "바이너리 에셋(.uasset)만 변경 — 코드 diff 없음."

### 사건 5 — 정사각 패널 이미지 추가
- **9e1ce01** `feat(ui): 정사각 패널 UI 이미지 임포트 (panel_square)` — 2026-06-29, PR **#451**
  - `Content/LDJ/UI/UI_Image/panel_square.uasset` (신규 1652886 bytes) 1개만. 코드 diff 없음.

### 사건 6 — WBP_MainHUD 에디터 변경분 반영 (부수 커밋)
- **0a11f4f** `chore(ui): WBP_MainHUD.uasset 변경 반영` — 2026-06-27
  - 본문: "램프 버그 작업 중 에디터에서 변경된 WBP_MainHUD(LDJ UI) 반영."
  - `WBP_MainHUD.uasset` (76130 → 75181). → **에디터에서 무심코 저장된 팀원 위젯을 커밋으로 정리**하는, 바이너리 협업의 전형적 잡음.

### 사건 7 — UI 버튼 에셋 + 인트로 영상 교체
- **9da8fe9** `chore: 스타트/시네마틱/캐릭터선택 영상 교체 및 UI 버튼 에셋 추가` — 2026-07-02, PR **#483**
  - UI 버튼 에셋 신규: `btn_normal_final.uasset`, `btn_hover_final.uasset` (Content/LDJ/UI/UI_Image/)
  - 함께: 인트로 mp4 4종 교체(CMT1 6.8MB→28.4MB 등), `WBP_StartScreen`/`WBP_CharacterSelect` 갱신.
  - PR #483 본문: "합계 ~49MB, 개별 최대 28MB — GitHub 100MB 제한 여유" → **대용량 바이너리를 LFS 없이 커밋하는 리스크 관리 언급**.

---

## OJJ 위젯 연결 C++ (사건 8, 핵심) — 포트레이트 자동 스폰 + 대화 패널 연결

- **b4ad005** `feat(ui/portrait): 포트레이트 자동 스폰 + 대화 패널 칸 연결` — 2026-06-28, PR **#432**
  - 커밋 본문 원문:
    ```
    파이썬 수동 스폰을 코드 자동 스폰으로 대체하고, 대화 패널에 포트레이트를 연결한다.

    - UOJJ_PortraitCaptureSubsystem(UWorldSubsystem): 인게임 레벨에서 AOJJ_PortraitCapture 자동 스폰
      (IsGameWorld·데디서버 제외 가드, AutoSpawnLevels 화이트리스트, 중복 가드, 레벨 언로드 정리)
    - UOJJ_PortraitSettings(UDeveloperSettings, config=Game): AutoSpawnLevels/SpawnZ 설정화
      → Project Settings에서 코드 수정 없이 레벨 추가
    - AOJJ_PortraitCapture 생성자: RT_RobotPortrait 기본 로드(자동 스폰 시 RT 자동 연결)
    - 대화 패널 WBP_DialogueBalloon/WBP_MainHUD에 IMG_Portrait 칸 + M_Portrait_UI 연결
    - L_Planet 정리(수동 배치 액터 제거)
    - Build.cs: DeveloperSettings 모듈 추가
    ```
  - 변경 stat: 코드 4파일 신규 + WBP 2개 + L_Planet + Build.cs (230 insertions)

### 코드 조각 A — 월드 서브시스템 자동 스폰
`frontend/Source/Wanted_Factory/Private/OJJ_PortraitCaptureSubsystem.cpp` (원문 전체, OJJ 소유):
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
    // ... (성공/실패 UE_LOG, 일부 생략)
}

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
> 게재 시: 파일 경로의 `Wanted_Factory` 모듈명은 일반화. 클래스명 `AOJJ_*`는 게재 가능.

### 코드 조각 B — 설정 클래스(UDeveloperSettings)로 레벨 화이트리스트 노출
`frontend/Source/Wanted_Factory/Public/OJJ_PortraitSettings.h` (원문, `WANTED_FACTORY_API` 일반화 필요):
```cpp
UCLASS(config = Game, defaultconfig, meta = (DisplayName = "OJJ Portrait Capture"))
class WANTED_FACTORY_API UOJJ_PortraitSettings : public UDeveloperSettings   // ← WANTED_FACTORY_API 일반화
{
    GENERATED_BODY()
public:
    UOJJ_PortraitSettings();

    /** 포트레이트 캡처 액터를 자동 스폰할 레벨(접두사 없는 맵명, 예: L_Planet). 코드 수정 없이 여기서 추가. */
    UPROPERTY(EditAnywhere, config, Category = "AutoSpawn")
    TArray<FName> AutoSpawnLevels;

    /** 스폰할 액터 클래스(미지정 시 AOJJ_PortraitCapture 기본). BP 변형을 쓰려면 여기 지정. */
    UPROPERTY(EditAnywhere, config, Category = "AutoSpawn")
    TSoftClassPtr<AOJJ_PortraitCapture> PortraitCaptureClass;

    /** 메인뷰 격리용 스폰 높이(지하). */
    UPROPERTY(EditAnywhere, config, Category = "AutoSpawn")
    float SpawnZ = -5000.f;

    /** Project Settings 분류 — "Game" 섹션에 표시. */
    virtual FName GetCategoryName() const override { return FName("Game"); }
};
```

### 코드 조각 C — 생성자에서 RenderTarget 기본 연결 (b4ad005 diff 원문)
`frontend/Source/Wanted_Factory/Private/OJJ_PortraitCapture.cpp` 생성자에 추가된 9줄:
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
> `/Game/OJJ/...` 경로 게재 가능. RT 텍스처를 코드 기본값으로 물려서, 서브시스템 자동 스폰 시 에디터 수동 배선 없이 대화 패널(`M_Portrait_UI`)까지 연결되게 함.

---

## 부록 — 포트레이트 첫 프레임 품질 fix (21편~29편 연결부, 수치 원문)

29편의 "에셋을 위젯에 물리는 파이프라인"이 실제로 화면에 깨끗이 나오게 하려고 붙인 두 건. 21편 캡처 액터에 이어지는 마감 작업이라 29편 소재로도 유효(수치 자료).

### 코드 조각 D — 셰이더 컴파일 대기 (PR #447, aa659e9)
- **aa659e9** `fix(portrait): 셰이더 컴파일 완료까지 캡처 대기` — 2026-06-29, PR **#447**
- PR #447 본문 수치 원문:
  > M_Robot 베이스패스 셰이더가 DDC 미스로 컴파일 중이라(**셰이더당 ~0.42s**, 콜드 시 수 초) 로봇이 디폴트 머티리얼로 깨진 채 캡처되던 첫 프레임 글리치를 수정.
  > 고정 지연 대신 `GShaderCompilingManager->IsCompiling()` 폴링 — `CaptureWarmupPollInterval`(0.15s) 간격, `CaptureMaxWarmupWait`(15s) 타임아웃.
  > `#if WITH_EDITOR` 가드 — 패키징은 셰이더 쿡되어 대기 분기 제외.

### 코드 조각 E — 텍스처 밉 스트리밍 대기 (PR #450, 8920660)
- **8920660** `fix: 포트레이트 캡처 첫 프레임 텍스처 스트리밍 미완 수정` — 2026-06-29, PR **#450**
- PR #450 본문 수치 원문:
  > 진단 로그로 캡처 직전 로봇 텍스처 4장이 모두 **resident 7/12 mips (NOT FULLY RESIDENT)** 임을 확인 — 텍스처 mip 스트림인 미완.
  > BeginPlay에서 로봇 텍스처 `bForceMiplevelsToBeResident=true` + 캐시, `TryBeginCapture`가 셰이더 컴파일(에디터) **AND** 텍스처 full-resident(공통) 둘 다 대기.
  > `EndPlay`에서 force 플래그 **원본값 복원**(공유 텍스처에 강제 풀밉 영구 잔존 방지 — 리뷰 Major 반영).
- 변경 파일: `Private/OJJ_PortraitCapture.cpp` (+118 -14 라인 상당), `Public/OJJ_PortraitCapture.h`, 리뷰 문서 `docs/04_reviews/2026-06-29_reviews_03.md`.

---

## 커밋/PR 인덱스 (시간순)

| 날짜 | 해시 | PR | 요약 | 영역 |
|------|------|-----|------|------|
| 2026-06-27 | ae9eee8 | #408 | HUD 채팅/날씨/시간 UI 이미지 5종 임포트 + WBP 반영 | OJJ 임포트 / LDJ 위젯 |
| 2026-06-27 | 0a11f4f | (직push) | WBP_MainHUD 에디터 변경분 반영 | LDJ 위젯 (OJJ 재저장) |
| 2026-06-28 | f473476 | #432 | 로봇 캐릭터 Meshy AI 메시/텍스처/애니 임포트 | OJJ (AI-gen) |
| 2026-06-28 | b4ad005 | #432 | **포트레이트 자동 스폰 서브시스템 + 대화 패널 연결** | **OJJ 위젯 연결 C++** |
| 2026-06-29 | b877a2b | #444 | Meshy 머티리얼 깨짐 → M_Robot 수동 교체 | OJJ (AI-gen 보정) |
| 2026-06-29 | aa659e9 | #447 | 포트레이트 셰이더 컴파일 대기 fix | OJJ |
| 2026-06-29 | 8920660 | #450 | 포트레이트 텍스처 밉 스트리밍 대기 fix | OJJ |
| 2026-06-29 | eda854c | #449 | 채팅/대화 패널 UI 이미지 6종 + WBP 3종 갱신 | OJJ 임포트 / LDJ 위젯 |
| 2026-06-29 | 9e1ce01 | #451 | panel_square 이미지 임포트 | OJJ 임포트 |
| 2026-07-02 | 9da8fe9 | #483 | UI 버튼 에셋(btn_normal/hover_final) + 인트로 영상 교체 | OJJ 임포트 |

---

## 수집 완료 보고

- **찾은 커밋**: UI/HUD 에셋·연결 직접 관련 10건 (위 표). 확장 후보(미니맵 UI_Minimap, 21편 포트레이트 캡처 본체 #432 계열)는 별도 편 소재.
- **핵심 해시**: `b4ad005`(위젯 연결 C++, 파이프라인 뼈대), `f473476`+`b877a2b`(Meshy AI 임포트/보정), `ae9eee8`·`eda854c`(HUD/패널 이미지 임포트).
- **PR 번호**: #408, #432, #444, #447, #449, #450, #451, #483.
- **AI-gen 흔적**: **Meshy**(3D 캐릭터 생성) 확인 — f473476/b877a2b. GPT/DALL·E 등 이미지 생성 도구 흔적은 커밋 메시지·파일명에서 **미발견**(UI 이미지 파일명 `AI_Chat`/`ai_chat_panel`은 게임 내 "AI 채팅" 기능의 UI일 뿐, 생성 도구 표기 아님).
- **못 찾은 항목**:
  - "OJJ가 직접 만든 아이콘/버튼을 그린 원본 소스"는 없음 — 버튼/패널 이미지는 임포트만 있고 제작 과정(도구·프롬프트)은 저장소에 기록 없음.
  - UI 위젯 레이아웃(WBP 내부 구성) diff는 바이너리라 코드 인용 불가 — 전부 `.uasset` 바이너리. 위젯 C++ 로직(BindWidget 등)은 팀원(Dong/LDJ) 소유.
