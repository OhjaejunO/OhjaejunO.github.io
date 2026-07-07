# 30편 소스 수집 — 미니맵 (문제 머신 내비게이션 / PR #510)

> 수집일: 2026-07-07 · 대상 저장소: PU3-Lab/factory-space · 브랜치 OJJ → main
> 이 문서는 **집필용 원자료**다. 아래 "일반화 필요 항목"을 반드시 지킬 것.

---

## 블로그 게재 시 일반화 필요 항목

- **일반화(가리기):**
  - `WANTED_FACTORY_API` DLL export 매크로 → 노출 금지. 클래스 선언에서 빼고 인용하거나 일반화.
  - 프로젝트명 `Wanted_Factory`, 전체 경로 `frontend/Source/Wanted_Factory/...` → `Source/...` 등으로 축약/일반화.
  - 협업자 실명 `Chan`(코드 주석에 등장) → "다른 팀원"으로 일반화.
- **게재 가능(1~3편에서 이미 공개):**
  - `AOJJ_*` 클래스 접두사(`AOJJ_MinimapCapture`, `AOJJ_Grid`, `AOJJ_Player`, `UUI_Minimap`), `/Game/OJJ/...` 에셋 경로.
- 코드는 아래 원문 그대로. 블로그용으로 분기 생략 시 **"일부 생략" 명시**. 동작 바뀌는 재구성 금지.

---

## 요약 (한눈에)

- **PR #510** `feat: 미니맵 (문제 머신 내비게이션)` — author OJJ, base `main` ← head `OJJ`, **MERGED 2026-07-04T05:56:22Z**, 머지 커밋 `2337614`. **PR 코멘트 없음**(본문만).
- **동기:** "AI 에이전트가 짚는 문제 머신을 찾아가기 어렵다"는 피드백 → 원형 플레이어 중심 미니맵. 북쪽 고정, N키 토글, 좌상단(날짜 HUD 아래).
- **핵심 설계:** 그리드 전체를 **원샷 SceneCapture**(RT 2048², 10초 재캡처, 직교 탑다운)로 한 장 굽고, **머티리얼 UV 창 샘플링**으로 확대·이동 → 프레임당 캡처 비용 0. (21편 로봇 포트레이트 SceneCapture, 24편 그리드 윈도잉과 이어지는 성능 감각.)
- **마커:** 전력부족=Yellow / 고장·막힘=Red(동시엔 Red 우선). 시야 밖 머신은 원 가장자리 클램프로 방향 안내.
- **부수 변경:** 사다리 `FinishTriggerDistance` 150→95(짧은 사다리도 올라서기 애니 재생). — 17편 사다리 편의 후속 튜닝, 이번 편에선 곁가지.

### 커밋 2개 (시간순, KST 기준)

| 해시 | 날짜(KST) | 내용 |
|------|-----------|------|
| `533703b` | 2026-07-04 00:49 | **C++ 뼈대** — OJJ_Grid getter 3종, OJJ_MinimapCapture(신규), UI_Minimap(신규), OJJ_Player 통합(N키 토글·빌드모드 숨김). 에디터 에셋 미완 WIP, PIE 검증 전. (+622줄) |
| `fa72daa` | 2026-07-04 14:55 | **에셋 완성 + 튜닝** — RT/M/WBP_Minimap·마커/화살표 텍스처 추가, ShowFlags 글린트 제거 4종 추가, 마커 색 체계 변경(Cyan/Yellow→Yellow/Red)·우선순위 플립, 사다리 짧은 피니시 허용. (+10/-4 코드 + 바이너리 에셋) |

> 참고: `gh` authoredDate는 `533703b`가 `2026-07-03`(UTC), git 로컬(KST)로는 `07-04 00:49`. 같은 커밋의 시차 표기일 뿐.

### 에셋(바이너리 — 읽기 불가, 존재만 확인 · `fa72daa`에서 추가)

- `Content/LDJ/UI/WBP/RT_Minimap.uasset` (RenderTarget, 4417 B)
- `Content/OJJ/Materials/M_Minimap.uasset` (19716 B) — WindowCenter/WindowSize 파라미터, 원형 마스크
- `Content/LDJ/UI/WBP/WBP_Minimap.uasset` (38086 B) — UUI_Minimap 자식 위젯
- `Content/LDJ/UI/UI_Image/T_MinimapArrow.uasset` (82364 B) — 플레이어 화살표
- `Content/LDJ/UI/UI_Image/T_MinimapMarker.uasset` (103774 B) — 마커 텍스처
- `Content/OJJ/BP/BP_OJJ_Player.uasset`, `Content/OJJ/Levels/L_Planet.umap` 변경 — MinimapWidgetClass 할당, 캡처 액터 레벨 배치, 사다리 FinishTriggerDistance 인스턴스값 등 BP/레벨 설정 추정.

---

## 아키텍처 개요 (데이터 흐름)

```
AOJJ_MinimapCapture (레벨 배치 액터)
  └ BeginPlay: AOJJ_Grid 찾아 상공 자동정렬 → 1초 후 1회 캡처 + 10초 주기 재캡처
  └ SceneCapture2D(직교, pitch-90/yaw0) → RenderTarget(2048²)  [배경 한 장]

UUI_Minimap (WBP_Minimap의 C++ 부모, 뷰포트 위젯)
  ├ 배경: IMG_Map 브러시 M_Minimap → MID. 매 틱 WindowCenter(플레이어 UV)/WindowSize(줌/캡처extent) 공급
  │        → 확대창 이동·줌은 전부 머티리얼 UV 연산 (C++은 파라미터 2개만)
  ├ 화살표: IMG_PlayerArrow → 북쪽 고정이라 맵은 안 돌고 화살표만 Yaw 회전
  └ 마커: 0.5초 주기 GetMachineNodes() 순회로 문제 머신 수집, 매 틱 위치/색 갱신 + 가장자리 클램프

AOJJ_Player
  └ MinimapWidgetClass → CreateWidget + AddToViewport (MainHUD와 무접점 별도 위젯)
  └ N키 ToggleMinimap, 빌드모드 진입 시 숨김 / 이탈 시 bMinimapHiddenByUser 존중 복원

UV 규약(3곳 동기화): 캡처 pitch-90/yaw0 → U = 0.5 + (Wy-Cy)/Ortho, V = 0.5 - (Wx-Cx)/Ortho
  = 이미지 +U=월드+Y, 이미지 위(-V)=월드+X(북)
```

---

## 코드 조각 (실제 소스 원문)

### 1. 원샷 SceneCapture 액터 — 성능 설계의 핵심

`Source/.../Public/OJJ_MinimapCapture.h` (클래스 주석 + 프로퍼티. `WANTED_FACTORY_API` 게재 시 제거)

```cpp
/**
 * [미니맵] 그리드 전체를 1장의 RenderTarget으로 내려찍는 직교 탑다운 캡처 액터 (레벨 배치형).
 *
 * 설계:
 *  - 상시 캡처가 아니라 요청식(RequestCapture) — bCaptureEveryFrame/OnMovement 모두 끔.
 *    지형/공장은 느리게 변하므로 BeginPlay 1초 후 1회 + RecaptureInterval 주기 재캡처로 충분.
 *  - BeginPlay에서 레벨의 AOJJ_Grid를 찾아 GetGridCenter 상공(CaptureHeight)으로 자동 이동,
 *    OrthoWidth = 그리드 extent(max(X,Y)) — 레벨 배치 위치는 무관(자동 정렬).
 *  - 캡처 방향: pitch -90, yaw 0 고정. 이때 이미지 +U = 월드 +Y, 이미지 -V(위) = 월드 +X.
 *    → UV 변환: U = 0.5 + (WorldY - CenterY)/OrthoWidth, V = 0.5 - (WorldX - CenterX)/OrthoWidth.
 *    UI_Minimap과 M_Minimap 머티리얼이 이 규약을 공유한다(변경 시 3곳 동기화).
 */
UCLASS()
class AOJJ_MinimapCapture : public AActor   // 원문: class WANTED_FACTORY_API AOJJ_MinimapCapture
{
    // ...
    // 주기 재캡처 간격(초). 0이면 주기 재캡처 끔(BeginPlay 1회만).
    float RecaptureInterval = 10.0f;
    // 그리드 평면에서 캡처 카메라까지 높이(uu). 직교라 화각 무관 — 지형 최고점보다 높으면 충분.
    float CaptureHeight = 20000.0f;
    // BeginPlay 후 첫 캡처까지 지연(초) — 레벨 액터/머티리얼 초기화가 끝난 뒤 찍기 위한 여유.
    float InitialCaptureDelay = 1.0f;
};
```

### 2. 캡처 세팅 — ShowFlags로 미니맵 가독성 확보 (수면 글린트 제거 스토리)

`Source/.../Private/OJJ_MinimapCapture.cpp` 생성자 (전문)

```cpp
AOJJ_MinimapCapture::AOJJ_MinimapCapture()
{
    PrimaryActorTick.bCanEverTick = false;

    USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    SetRootComponent(Root);

    CaptureComponent = CreateDefaultSubobject<USceneCaptureComponent2D>(TEXT("Capture"));
    CaptureComponent->SetupAttachment(Root);
    // 탑다운 규약(헤더 참조): pitch -90, yaw 0 → +U=월드+Y, 이미지 위=월드+X(북).
    CaptureComponent->SetRelativeRotation(FRotator(-90.0f, 0.0f, 0.0f));

    CaptureComponent->ProjectionType = ECameraProjectionMode::Orthographic;
    CaptureComponent->CaptureSource = ESceneCaptureSource::SCS_FinalColorLDR;
    // 요청식 캡처만 — 상시 캡처 비용 차단.
    CaptureComponent->bCaptureEveryFrame = false;
    CaptureComponent->bCaptureOnMovement = false;

    // 미니맵 가독성: 안개/대기/파티클은 지도를 덮는 노이즈라 끔.
    CaptureComponent->ShowFlags.SetFog(false);
    CaptureComponent->ShowFlags.SetVolumetricFog(false);
    CaptureComponent->ShowFlags.SetAtmosphere(false);
    CaptureComponent->ShowFlags.SetParticles(false);
    // 물 표면 스페큘러 글린트가 저해상 RT에서 흰 점으로 앨리어싱 → 광택 계열 전부 끔.  ← fa72daa에서 추가
    CaptureComponent->ShowFlags.SetBloom(false);
    CaptureComponent->ShowFlags.SetSpecular(false);
    CaptureComponent->ShowFlags.SetScreenSpaceReflections(false);
    CaptureComponent->ShowFlags.SetLensFlares(false);
}
```

> **글감:** 뒤쪽 4줄(Bloom/Specular/SSR/LensFlares)은 `533703b`엔 없다가 `fa72daa`에서 추가됨. PIE에서 물 표면이 저해상 RT에 흰 점으로 앨리어싱된 걸 보고 잡은 것. 16편 물 시스템과 연결되는 후일담.

### 3. BeginPlay — 요청식 캡처 타이머 + 그리드 자동 정렬

`Source/.../Private/OJJ_MinimapCapture.cpp` (BeginPlay + AlignToGrid, 전문)

```cpp
void AOJJ_MinimapCapture::BeginPlay()
{
    Super::BeginPlay();

    if (RenderTarget)
    {
        CaptureComponent->TextureTarget = RenderTarget;
    }
    else
    {
        UE_LOG(LogTemp, Warning,
            TEXT("[MinimapCapture] RenderTarget 미할당 — 미니맵 배경 캡처 비활성. RT 에셋(2048²)을 만들어 할당 필요."));
    }

    AlignToGrid();

    if (InitialCaptureDelay > 0.0f)
    {
        GetWorldTimerManager().SetTimer(
            InitialCaptureTimerHandle, this, &AOJJ_MinimapCapture::RequestCapture, InitialCaptureDelay, false);
    }
    else
    {
        RequestCapture();
    }

    if (RecaptureInterval > 0.0f)
    {
        GetWorldTimerManager().SetTimer(
            RecaptureTimerHandle, this, &AOJJ_MinimapCapture::RequestCapture, RecaptureInterval, true);
    }
}

void AOJJ_MinimapCapture::AlignToGrid()
{
    AOJJ_Grid* Grid = nullptr;
    for (TActorIterator<AOJJ_Grid> It(GetWorld()); It; ++It) { Grid = *It; break; }
    if (!Grid)
    {
        UE_LOG(LogTemp, Warning,
            TEXT("[MinimapCapture] AOJJ_Grid 미발견 — 배치 위치/OrthoWidth 그대로 사용(자동 정렬 스킵)."));
        return;
    }

    FVector2D BoundsMin, BoundsMax;
    Grid->GetGridWorldBounds(BoundsMin, BoundsMax);
    const FVector2D Extent = BoundsMax - BoundsMin;

    const FVector Center = Grid->GetGridCenter();
    SetActorLocation(FVector(Center.X, Center.Y, Center.Z + CaptureHeight));
    // 정사각 RT에 비정사각 그리드면 max 변 기준으로 여유 있게 덮는다(빈 여백은 지도 밖).
    CaptureComponent->OrthoWidth = FMath::Max(Extent.X, Extent.Y);
}
```

`RequestCapture`는 RT 없으면 스킵, 있으면 `CaptureComponent->CaptureScene();` 한 줄. (24편 그리드 윈도잉과 같은 "필요할 때만 계산" 패턴.)

### 4. 배경 확대창 + 마커 갱신 — UI_Minimap의 매 틱

`Source/.../UI/UI_Minimap.cpp` `NativeTick` (전문). 확대창 이동/줌을 머티리얼에 위임한 게 성능 핵심.

```cpp
void UUI_Minimap::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
    Super::NativeTick(MyGeometry, InDeltaTime);

    APawn* Pawn = GetOwningPlayerPawn();
    if (!Pawn) { return; }
    const FVector PawnLocation = Pawn->GetActorLocation();
    const FVector2D PlayerXY(PawnLocation.X, PawnLocation.Y);

    // 배경 확대창: 플레이어 위치 → 캡처 UV. 규약(OJJ_MinimapCapture.h): U=+Y, V=-X.
    FVector2D CaptureCenter;
    float CaptureWorldSize = 0.0f;
    if (MapMID && ResolveCaptureFrame(CaptureCenter, CaptureWorldSize) && CaptureWorldSize > KINDA_SMALL_NUMBER)
    {
        const float U = 0.5f + (PlayerXY.Y - CaptureCenter.Y) / CaptureWorldSize;
        const float V = 0.5f - (PlayerXY.X - CaptureCenter.X) / CaptureWorldSize;
        MapMID->SetVectorParameterValue(ParamWindowCenter, FLinearColor(U, V, 0.0f, 0.0f));
        MapMID->SetScalarParameterValue(ParamWindowSize, ZoomWorldSize / CaptureWorldSize);
    }

    // 북쪽 고정 — 맵은 안 돌고 화살표만 회전. yaw 0(+X=북)=위, yaw 90(+Y)=오른쪽 → 각도=yaw 그대로.
    if (IMG_PlayerArrow)
    {
        IMG_PlayerArrow->SetRenderTransformAngle(Pawn->GetActorRotation().Yaw);
    }

    MarkerRefreshAccum += InDeltaTime;
    if (MarkerRefreshAccum >= MarkerRefreshInterval)   // 기본 0.5초
    {
        MarkerRefreshAccum = 0.0f;
        RefreshProblemMarkers();
    }

    UpdateMarkerPositions(PlayerXY);
}
```

> **회전 처리 결정:** 북쪽 고정. 맵 텍스처는 회전시키지 않고 `IMG_PlayerArrow`만 `SetRenderTransformAngle(Yaw)`. 헤더 주석에 근거 명시: "yaw 0(+X=북)=위". 맵을 돌리는 방식(진행방향 위) 대신, 저해상 RT 회전 시 재샘플 블러/축 재계산을 피하려고 화살표만 돌린 것.

### 5. 문제 머신 판별 — 마커 색 체계 (커밋 간 변화가 큰 글감)

`Source/.../UI/UI_Minimap.cpp` `RefreshProblemMarkers` (전문). 0.5초 주기 판별.

```cpp
void UUI_Minimap::RefreshProblemMarkers()
{
    ProblemMarkers.Reset();

    UGameInstance* GI = GetGameInstance();
    UFactoryManagerSubsystem* FactoryManager = GI ? GI->GetSubsystem<UFactoryManagerSubsystem>() : nullptr;
    if (!FactoryManager) { return; }

    for (const FMachineNode& Node : FactoryManager->GetMachineNodes())
    {
        AMachineBase* Machine = Node.MachineActor.Get();
        if (!Machine) { continue; }

        const EMachineState State = Machine->GetMachineState();
        const bool bPowerIssue = (State == EMachineState::NoPower);
        const bool bFaultIssue =
            Machine->isBroken() ||
            State == EMachineState::Blocked ||
            State == EMachineState::Disabled;
        if (!bPowerIssue && !bFaultIssue) { continue; }

        FMinimapProblemMarker Marker;
        Marker.Machine = Machine;
        // 고장은 수리 전엔 전력 넣어도 안 돌아가므로 선행 과제 — 고장 색 우선.
        Marker.Color = bFaultIssue ? FaultIssueColor : PowerIssueColor;
        ProblemMarkers.Add(Marker);
    }
}
```

**색 체계 diff (`533703b` → `fa72daa`)** — 스토리의 핵심 반전:

```diff
- // 에이전트 디버그 하이라이트(UI_DialogueBalloon) 색 계승 — 전력=Cyan, 고장/막힘=Yellow.
- const FLinearColor PowerIssueColor = FLinearColor(0.0f, 1.0f, 1.0f, 1.0f);  // Cyan
- const FLinearColor FaultIssueColor = FLinearColor(1.0f, 1.0f, 0.0f, 1.0f);  // Yellow
+ // 전력=Yellow, 고장/막힘=Red — 디버그 하이라이트와 다른 미니맵 고유 체계.
+ const FLinearColor PowerIssueColor = FLinearColor(1.0f, 1.0f, 0.0f, 1.0f);  // Yellow
+ const FLinearColor FaultIssueColor = FLinearColor(1.0f, 0.0f, 0.0f, 1.0f);  // Red
```
```diff
- Marker.Color = bPowerIssue ? PowerIssueColor : FaultIssueColor;
+ // 고장은 수리 전엔 전력 넣어도 안 돌아가므로 선행 과제 — 고장 색 우선.
+ Marker.Color = bFaultIssue ? FaultIssueColor : PowerIssueColor;
```

> 처음엔 에이전트 디버그 말풍선 색(Cyan/Yellow)을 그대로 계승했다가, PIE에서 "위험 = 빨강" 직관과 어긋남을 확인 → 전력=Yellow/고장=Red로 재정의. 동시에 삼항 조건도 `bPowerIssue?` → `bFaultIssue?`로 뒤집어 **한 머신이 전력+고장 둘 다일 때 빨강(선행 과제) 우선**하도록 바꿈. "수리가 급전 선행"이라는 게임 규칙을 색 우선순위로 인코딩.

### 6. 마커 위치 — 가장자리 클램프 (시야 밖 내비게이션 핵심)

`Source/.../UI/UI_Minimap.cpp` `UpdateMarkerPositions` 중 좌표 변환·클램프 (핵심부, 풀링 루프는 일부 생략)

```cpp
const float ClampRadius = Diameter * 0.5f - EdgePadding;   // EdgePadding 기본 8px
const float PixelsPerUU = Diameter / ZoomWorldSize;        // ZoomWorldSize 기본 10000uu

// 월드 델타 → 위젯 로컬(중앙 원점). 배경 UV 규약과 동일 축: 화면 +x=월드+Y, 화면 -y=월드+X.
const FVector MachineLocation = Machine->GetActorLocation();
FVector2D Offset(
    (MachineLocation.Y - PlayerXY.Y) * PixelsPerUU,
    -(MachineLocation.X - PlayerXY.X) * PixelsPerUU);

// 시야 원 밖이면 방향 유지한 채 가장자리에 세운다 — 내비게이션 핵심.
if (Offset.SizeSquared() > FMath::Square(ClampRadius))
{
    Offset = Offset.GetSafeNormal() * ClampRadius;
}

MarkerImage->SetBrushTintColor(Marker.Color);
MarkerImage->SetVisibility(ESlateVisibility::SelfHitTestInvisible);
if (UCanvasPanelSlot* MarkerSlot = Cast<UCanvasPanelSlot>(MarkerImage->Slot))
{
    MarkerSlot->SetPosition(Offset);
}
```

> **좌표 변환:** 배경 UV와 **같은 축 규약**(화면 +x=월드+Y, 화면 -y=월드+X)을 마커에도 적용 → 배경과 마커가 항상 정합. 원 밖 머신은 `GetSafeNormal() * ClampRadius`로 방향만 유지해 테두리에 붙임(= "저쪽에 문제 있음" 화살표 역할). 이게 PR 제목 "문제 머신 내비게이션"의 실체.

### 7. 성능 배려 — 마커 위젯 풀링

`Source/.../UI/UI_Minimap.h` 구조체 + 풀 필드, `UI_Minimap.cpp` `GetOrCreatePoolMarker` (핵심부)

```cpp
// (헤더) 마커 위젯 풀 — 매 갱신 생성/파괴 대신 재사용, 남는 것은 Collapsed.
TArray<TObjectPtr<UImage>> MarkerPool;

// (cpp) 인덱스에 위젯 있으면 재사용, 없으면 1회 생성 후 풀에 저장. 남는 풀 위젯은 Collapsed로 숨김.
UImage* UUI_Minimap::GetOrCreatePoolMarker(int32 Index)
{
    if (MarkerPool.IsValidIndex(Index) && MarkerPool[Index]) { return MarkerPool[Index]; }
    // ... WidgetTree->ConstructWidget<UImage> + CP_Markers->AddChildToCanvas (중앙 앵커/정렬) ...
}
```
남는 위젯은 파괴 대신 `SetVisibility(ESlateVisibility::Collapsed)`. 문제 머신 수가 프레임마다 요동쳐도 위젯 생성/파괴가 없음.

### 8. OJJ_Grid — 미니맵용 getter 3종 (`533703b` 신규)

`Source/.../Public/OJJ_Grid.h` + `.cpp`

```cpp
// (헤더) CellSize/GridSize가 protected라 외부(미니맵 UV 변환)는 getter 경유.
float GetCellSize() const { return CellSize; }
FIntPoint GetGridSizeXY() const { return GridSize; }
void GetGridWorldBounds(FVector2D& OutMin, FVector2D& OutMax) const;

// (cpp) center-anchored bounds — GetGridCenter ± GridSize*CellSize/2
void AOJJ_Grid::GetGridWorldBounds(FVector2D& OutMin, FVector2D& OutMax) const
{
    const FVector Center = GetGridCenter();
    const float HalfExtentX = GridSize.X * CellSize * 0.5f;
    const float HalfExtentY = GridSize.Y * CellSize * 0.5f;
    OutMin = FVector2D(Center.X - HalfExtentX, Center.Y - HalfExtentY);
    OutMax = FVector2D(Center.X + HalfExtentX, Center.Y + HalfExtentY);
}
```

### 9. OJJ_Player — 위젯 부착 + N키 토글 + 빌드모드 숨김/복원 (`533703b`)

`Source/.../Private/OJJ_Player.cpp` (발췌, diff 원문)

```cpp
// BeginPlay: MainHUD와 별도 뷰포트 위젯(무접점)
if (PC && MinimapWidgetClass)
{
    MinimapWidgetInstance = CreateWidget<UUserWidget>(PC, MinimapWidgetClass);
    if (MinimapWidgetInstance) { MinimapWidgetInstance->AddToViewport(); }
}

// SetupPlayerInputComponent:
// ⚠️ M은 SendOperatorGuideRequest(AI 오퍼레이터)에 선점 — 겹치면 토글마다 AI 요청 발사 → N 채택.
PlayerInputComponent->BindKey(EKeys::N, IE_Pressed, this, &AOJJ_Player::ToggleMinimap);

void AOJJ_Player::ToggleMinimap()
{
    if (!MinimapWidgetInstance) { return; }
    // 플래그가 단일 진실원 — 빌드모드 중에도 사용자 의사는 여기 누적, 실제 표시는 빌드모드 아닐 때만 반영.
    bMinimapHiddenByUser = !bMinimapHiddenByUser;
    const bool bInBuildMode = BuildController && BuildController->IsInBuildMode();
    if (!bInBuildMode)
    {
        MinimapWidgetInstance->SetVisibility(
            bMinimapHiddenByUser ? ESlateVisibility::Collapsed : ESlateVisibility::SelfHitTestInvisible);
    }
}
```
빌드모드 진입 시 HUD와 함께 `Collapsed`, 이탈 시 `!bMinimapHiddenByUser`일 때만 복원(사용자가 N으로 끈 건 존중).

> **글감(키 충돌):** M키가 AI 오퍼레이터 요청(다른 팀원 기능)에 선점돼 있어 미니맵 토글을 N으로 뺀 협업 일화. 주석 원문엔 팀원 실명 `Chan`이 있으나 **게재 시 "다른 팀원"으로 일반화**.

### 10. (곁가지) 사다리 짧은 피니시 — FinishTriggerDistance

- C++ 기본값은 **150 그대로** (`Public/OJJ_Player.h:473`, `float FinishTriggerDistance = 150.f;` 주석 "옵션A에서 150 권장(BP에서 설정)").
- PR 본문의 **150→95는 BP 인스턴스 오버라이드**(`BP_OJJ_Player.uasset`, `fa72daa`에서 변경). 소스 diff엔 안 나타남 = 코드 아닌 에셋 값 변경.
- 게이트 로직 `Private/OJJ_Player.cpp:1347-1356`: `ClimbHeight >= FinishTriggerDistance`면 루트모션 올라서기 몽타주, 미만이면 스킵(Loop+step-off). 값을 낮추니 3칸짜리 짧은 사다리도 올라서기 애니가 재생됨.
- **이번 편에선 곁가지**(17편이 사다리 본편). 미니맵과 같은 PR에 얹힌 별개 튜닝이란 점만 짚으면 충분.

---

## 수치/설정값 원문 (블로그 인용용)

| 항목 | 값 | 출처 |
|------|----|----|
| RenderTarget 해상도 | 2048² (권장, RTF RGBA8) | OJJ_MinimapCapture.h 주석 |
| 재캡처 주기 `RecaptureInterval` | 10.0초 (0이면 1회만) | OJJ_MinimapCapture.h:57 |
| 첫 캡처 지연 `InitialCaptureDelay` | 1.0초 | OJJ_MinimapCapture.h:65 |
| 캡처 높이 `CaptureHeight` | 20000 uu | OJJ_MinimapCapture.h:61 |
| 캡처 투영 | Orthographic, pitch -90/yaw 0, SCS_FinalColorLDR | OJJ_MinimapCapture.cpp:19-22 |
| OrthoWidth | `max(그리드 extentX, extentY)` 자동 | OJJ_MinimapCapture.cpp:94 |
| 상시 캡처 | bCaptureEveryFrame=false, bCaptureOnMovement=false | OJJ_MinimapCapture.cpp:24-25 |
| ShowFlags off | Fog, VolumetricFog, Atmosphere, Particles, **Bloom, Specular, SSR, LensFlares** | OJJ_MinimapCapture.cpp:28-36 |
| 미니맵 줌 `ZoomWorldSize` | 10000 uu (원이 덮는 월드 지름) | UI_Minimap.h:55 |
| 마커 판별 주기 `MarkerRefreshInterval` | 0.5초 | UI_Minimap.h:68 |
| 가장자리 여유 `EdgePadding` | 8 px | UI_Minimap.h:64 |
| 마커 기본 크기(브러시 미지정) | 12×12 px | UI_Minimap.cpp:257 |
| 색: 전력부족 | Yellow (1,1,0) | UI_Minimap.cpp:22 |
| 색: 고장/막힘 | Red (1,0,0), 동시엔 우선 | UI_Minimap.cpp:23,163 |
| 문제 판별 조건 | NoPower(전력) / isBroken·Blocked·Disabled(고장) | UI_Minimap.cpp:150-154 |
| 토글 키 | N (M은 AI 오퍼레이터 선점) | OJJ_Player.cpp:1176 |
| 사다리 FinishTriggerDistance | C++ 기본 150, BP 인스턴스 95 | OJJ_Player.h:473 / BP |

로그 문자열(원문):
- `"[MinimapCapture] RenderTarget 미할당 — 미니맵 배경 캡처 비활성. RT 에셋(2048²)을 만들어 할당 필요."`
- `"[MinimapCapture] AOJJ_Grid 미발견 — 배치 위치/OrthoWidth 그대로 사용(자동 정렬 스킵)."`
- `"[UI_Minimap] IMG_Map 브러시가 머티리얼이 아님 — 확대창 이동 비활성(정적 이미지로 표시). WBP에서 M_Minimap 할당 필요."`

---

## 서사 후보 (집필 시 취사)

1. **"프레임당 0원짜리 미니맵"** — 원샷 SceneCapture + 머티리얼 UV 창. 상시 렌더 미니맵의 비용을 피한 설계(21편 로봇 포트레이트, 24편 윈도잉과 같은 결).
2. **색이 두 번 바뀐 이야기** — 디버그 색(Cyan/Yellow) 계승 → 직관 충돌 → Yellow/Red 재정의 + 우선순위 플립. "게임 규칙을 색 우선순위로 인코딩".
3. **수면 글린트 잡기** — 저해상 RT 앨리어싱 → ShowFlags 4종 추가. 16편 물 시스템 후일담.
4. **시야 밖 내비게이션** — 가장자리 클램프(GetSafeNormal*ClampRadius)로 "저기 문제 있음" 방향 표시 = PR 제목의 실체.
5. **북쪽 고정 vs 회전** — 맵 대신 화살표만 회전한 결정과 이유(재샘플 블러 회피, UV 규약 단순).
6. **키 하나의 정치** — M 선점 → N 채택. 팀 협업 일화(실명 일반화).
7. **무접점 통합** — MainHUD 안 건드리고 별도 뷰포트 위젯 + BindWidgetOptional로 디자이너와 계약 분리.

---

## 못 찾은 항목 / 한계

- **PR #510 코멘트 없음** — 리뷰 토론 원문 없음. 설계 근거는 커밋 메시지·코드 주석이 유일한 1차 자료(다행히 주석이 매우 상세).
- **에셋 내부(M_Minimap 노드 그래프, WBP 레이아웃)** — .uasset 바이너리라 UV 창 머티리얼의 실제 노드 구성은 확인 불가. C++이 공급하는 파라미터(WindowCenter/WindowSize)와 규약(TexSample UV = WindowCenter + (UV-0.5)*WindowSize, 주석 명시)까지만 확보.
- **사다리 95값** — BP 인스턴스 오버라이드라 diff에 안 보임. PR 본문 서술로 확인(코드 기본값은 150 유지).
