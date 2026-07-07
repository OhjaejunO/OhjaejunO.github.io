# 24편(카메라 대장정) 소스 수집

> 대상 저장소: `C:\Users\user\Desktop\factory-space` (원격 `PU3-Lab/factory-space`)
> C++ 소스: `frontend\Source\Wanted_Factory\` (`Public/` 헤더, `Private/` 구현)
> 저자 기여 브랜치: `PU3-Lab/OJJ` → main 머지

---

## ⚠️ 블로그 게재 시 일반화 필요 항목 (프로젝트명 은폐 규칙)

블로그 최종본에서 아래는 반드시 일반화/생략한다. (`AOJJ_*` 접두사, `/Game/OJJ/` 경로는 이미 1~3편에서 공개 → 유지 가능)

| 소스 원문 | 블로그 표기 |
|-----------|-------------|
| `WANTED_FACTORY_API` (클래스 export 매크로) | 매크로 삭제하거나 `PROJECT_API` 로 일반화 |
| 경로 `frontend/Source/Wanted_Factory/...` | `Source/<Project>/...` 또는 경로 생략, 파일명만 표기 |
| 빌드 타깃 `Wanted_FactoryEditor Win64` (PR #467 검증 문구) | `<Project>Editor Win64` 로 일반화 |
| 그 외 "Wanted_Factory" 문자열 | 전부 `<Project>` 또는 생략 |

- 유지 가능: `AOJJ_Player`, `AOJJ_BuildCamera`, `AOJJ_Grid`, `AOJJ_BuildController`, `AOJJ_Foundation`, `/Game/OJJ/`, `BP_OJJ_*`, `IMC_Build`, `L_Planet` 등.

---

## ⚠️ #467은 "이슈"가 아니라 "PR"이다 (팀리드 주의)

- 팀리드 지시서는 "이슈 #467"이라 했으나, `gh issue view 467` 은 **`Could not resolve to an Issue`** 로 실패.
- 실제로는 **PR #467** 이 존재. `gh pr view 467` 로 본문 확보 완료. 아래 수치는 전부 PR #467 본문/커밋 메시지 원문.
- PR #467을 머지한 커밋: **`f2f2172`** (`Merge pull request #467 from PU3-Lab/OJJ`, 2026-06-30 18:52 KST).
- 실제 구현 커밋: **`066ac4b`** (`perf: 빌드모드 진입 hitch 최적화 …`, 2026-06-30 17:51 KST).
- 즉 "3,848ms → 41ms" 최적화의 대상은 **빌드모드 진입 시 그리드 오버레이 재생성**이며, "카메라"와의 연결고리는 **최적화 후 시각화 윈도우가 카메라(뷰타겟)를 따라가도록 만든 부분**이다. (순수 카메라 전환 최적화가 아니라 "카메라 중심 윈도우"로 렌더 범위를 한정한 것.)

---

# 1. 시간순 사건 정리 — 카메라 시스템 대장정

카메라 관련 클래스는 3개다.
- **`AOJJ_Player`** (ACharacter): TPS 3인칭 카메라 소유 (`SpringArm` + `Camera`). 빌드모드 진입/해제, 인트로 연출, 줌 위임의 허브.
- **`AOJJ_BuildCamera`** (AActor): 빌드모드 전용 탑다운 카메라. possess하지 않고, 플레이어가 입력을 받아 이 액터의 `Pan/Rotate/Zoom`을 위임 호출.
- **`AOJJ_BuildController`**: 빌드모드 로직 컨트롤러. Tick에서 뷰타겟 위치를 그리드 시각화 윈도우에 전달(#467).

## Act 1 — TPS 3인칭 카메라 (1단계) · 2026-05-31

- **`f70a887`** `feat(player): TPS 플레이어 기본 이동·카메라 구현 (1단계)` (2026-05-31)
  - `AOJJ_Player(ACharacter)` 신규. SpringArm + Camera 3인칭. Enhanced Input(WASD/SPACE/마우스Look/스크롤줌).
  - 커밋 메시지 자기고백: *"알려진 이슈: 마우스 카메라 감도 과함 → 다음 커밋에서 LookSensitivity 조절 예정."*
  - (이 커밋은 blueprint 에셋만 담았고 `.cpp`는 이후 커밋에서 등장 — 파일 히스토리상 정리 필요.)
- **`ba0c5a7`** `fix(player): 마우스 카메라 감도 조절 및 Pitch 제한` (2026-05-31) — 위 자기고백 해소.

## Act 2 — 빌드모드 토글과 탑다운 전환 (2~3단계) · 2026-05-31 (하루에 6커밋)

- **`ab94329`** `feat(player): B키 빌드모드 토글 및 그리드 연동 (2단계)` (2026-05-31)
- **`12ebf7c`** `feat(player): 빌드모드 탑다운 카메라 전환 및 자동 센터링 (3a)` (2026-05-31)
  - `AOJJ_BuildCamera` 신규(spawn 방식, 수동 배치 불필요).
  - 빌드모드 진입 시 `SetViewTargetWithBlend`로 탑다운 전환 + 플레이어 숨김.
  - `AOJJ_Grid::GetGridCenter` 추가 → 그리드 중심 자동 센터링.
  - 커밋 메시지 자기고백: *"알려진 제약: 빌드모드 중 마우스 내부 회전 살아있음 → 3b(IMC 교체)에서 완전 차단."*
- **`6887c86`** `feat(player): 빌드모드 IMC 교체로 마우스 Look 차단 (3b)` (2026-05-31) — 위 제약 해소. IMC_Build엔 IA_Look 없음.
- **`419535e`** `feat(player): 빌드모드 카메라 WASD 패닝 및 Q/E 회전 (3c)` (2026-05-31)
  - `IA_BuildPan`(2D, WASD), `IA_BuildRotate`(1D, Q/E) 신규. BuildPan/BuildRotate 핸들러 → BuildCamera Pan/Rotate.
  - "3단계 완료 — 빌드모드 탑다운 전환 전체 완성."

## Act 3 — 배치·줌·시점 다듬기 · 2026-06

- **`01b11b3`** `feat: 마우스 휠 줌 빌드모드 확장 + 빌드캠 정탑다운 (#186)` (2026-06-14)
  - 문제: 휠 줌이 TPS에서만 되고 빌드모드(별도 BuildCamera 뷰타겟)에선 무입력이었다.
  - `OJJ_BuildCamera::Zoom(ScrollDelta)` 추가 — SpringArm TargetArmLength를 Min(600)~Max(**4000**) 클램프(ZoomStep **150**).
  - `CameraPitch` 기본값 **-70 → -90** (바닥과 수평으로 정수직 내려다보는 평면도 시점).
  - `OJJ_Player::Zoom()`: 빌드모드면 BuildCamera로 위임, 아니면 플레이어 SpringArm. IMC_Build에 IA_Zoom→MouseWheelAxis 매핑 추가.
- **`b53020a`** `feat: 빌드 모드 카메라 플레이어 위치 기준 배치(off-grid 시 그리드 센터 폴백) + PlayerStart 위치 조정` (2026-06-19)
  - 빌드캠 XY = 플레이어 위치, off-grid면 그리드 센터 폴백. (아래 코드 조각 3의 진입 로직 근간.)

## Act 4 — 인트로 시네마틱: 1인칭 → 3인칭 카메라 블렌드 · 2026-06-22

- **`bea0e00`** `feat(player): L_Planet 인트로 연출 (getup 몽타주 + 1인칭→3인칭 카메라)` (2026-06-22)
  - L_Cinematic 경유 진입 시 getup 몽타주 재생 + 카메라를 `HeadSocket`에 부착한 1인칭 머리 시점 → 3인칭(ArmLength 0→400) 블렌드.
  - soft-lock 가드: `Montage_Play` 실패 시 3인칭 복귀 + 입력 복구 (Codex 교차검증 반영).
- **`6380495`** `feat(player): L_Planet 인트로 연출 + soft-lock/input 복구 처리` (2026-06-22) — 후속 보강.

## Act 5 — 3인칭 카메라 오클루전 & 비례 조정 · 2026-06-25

- **`3fc5f31`** `feat(player): 캐릭터 0.7배 축소 + 카메라(270)/점프(335) 비례 조정` (2026-06-25) — 캐릭터 스케일에 맞춰 카메라 ArmLength 비례.
- **`8d9a73b`** `fix(camera): Foundation ECC_Camera Block — 3인칭 카메라 오클루전 해결` (2026-06-25)
  - Foundation SlabMesh `ECC_Camera` 응답 `Ignore → Block`. SpringArm(ProbeChannel=ECC_Camera)이 Foundation 벽 뒤 캐릭터 오클루전을 피함. (코드 조각 5)

## Act 6 — 줌아웃 확장과 진입 hitch 최적화 (#467) · 2026-06-30 (하루에 카메라 커밋 4개)

- **`675f704`** `feat: 빌드모드 카메라 높은 메시 자동 상승 (배경 메시 높이 필터)` (2026-06-30) — 배경 메시 높이 필터로 카메라 Z 동적 상승 시도.
- **`e0009aa`** `revert: 빌드모드 카메라 동적 Z 상승 폐기 (작업 전 상태로 원복)` (2026-06-30) — **위 시도를 같은 날 되돌림.** (서사에 좋은 "실패→원복" 사건.)
- **`7982116`** `feat: 빌드모드 카메라 줌아웃 최대 거리 확대 (4000→15000)` (2026-06-30)
  - `MaxArmLength` **4000 → 15000** (정탑다운 FOV90 기준 ~300m 폭 조망). `ZoomStep` **150 → 600** (범위 확대에 비례).
- **`066ac4b`** `perf: 빌드모드 진입 hitch 최적화 …` (2026-06-30) → PR **#467**, 머지 커밋 **`f2f2172`**. **★ 이 편의 클라이맥스.** (코드 조각 4, 수치 원문 아래.)

---

# 2. #467 진입 hitch 최적화 — 원문 수치/로그 & 원인·수정

## 수치 (PR #467 본문 "효과 (PIE 계측)" 원문 그대로)

> gridVisual **3848ms -> 41ms** (약 94배 감소). 진입 hitch 체감 제거 확인.

커밋 `066ac4b` 메시지 원문:
> 빌드모드 진입마다 그리드 오버레이를 전체(GridSize 756x756 = 571,536셀)
> 재생성하던 것이 진입 hitch(gridVisual ~3848ms)의 원인. 카메라/플레이어
> 중심 윈도우(VisibleGridRadius)만 그리도록 한정.
> …
> - gridVisual 3848ms -> 41ms (약 94배). GridSize/빌드/쿼리 로직 무수정

## 원인 분석 (PR #467 "변경 요약" 원문)

> 빌드모드 진입마다 그리드 오버레이를 전체(GridSize 756x756 = 571,536셀)를 재생성하던 것이 진입 hitch(gridVisual ~3848ms)의 원인이었다. 카메라/플레이어 중심 윈도우(VisibleGridRadius)만 그리도록 한정해 해결.

핵심 숫자:
- 전체 그리드: **756 × 756 = 571,536 셀** (매 진입마다 전부 재생성)
- 최적화 후 윈도우: `VisibleGridRadius`=30 → **(2×30+1)² = 61² = 3,721 셀** (약 **154배** 적은 셀)
- 결과 gridVisual: **3,848ms → 41ms**

## 구현 (PR #467 "구현" 원문)

> - `RefreshGridVisual` 셀 루프를 `VisualWindowCenter ± VisibleGridRadius`(~3721셀)로 한정. 전체는 폴백(반경 0 / 중심 미설정).
> - `EnterBuildMode` 진입 시 플레이어 위치로 윈도우 중심 시드 → 첫 paint도 윈도우만.
> - `BuildController::Tick`에서 뷰타겟(탑다운=빌드캠/TPS=플레이어) 추종 — 중심 셀이 임계 이상 이동 시에만 재페인트.
> - **GridSize / 빌드 / 쿼리 로직 무수정** — 격자가 "그려지는 범위"만 주변으로 한정.

## 신규 튜닝 변수 (PR #467 원문)

> - `VisibleGridRadius`(기본 30), `VisualWindowRepaintStep`(기본 8) — PIE 튜닝 가능.

## 검증 (PR #467 원문 — ⚠️ 프로젝트명 포함, 게재 시 일반화)

> - 빌드 성공 (Wanted_FactoryEditor Win64 Development)   ← 게재 시 `<Project>Editor Win64` 로
> - PIE: 진입 hitch 제거 확인. 최대 줌아웃 시 윈도우 밖 가장자리는 격자 미표시(의도된 트레이드오프 — VisibleGridRadius 튜닝/추후 줌 비례 검토 가능)

---

# 3. 코드 조각 (실제 소스/diff 원문 인용)

## 코드 조각 1 — 빌드 탑다운 카메라 액터 (설계 주석 + SpringArm 세팅)
**파일:** `frontend/Source/Wanted_Factory/Public/OJJ_BuildCamera.h` (헤더 상단 클래스 주석)
> possess 하지 않고 플레이어가 입력을 위임한다는 설계 철학이 그대로 드러나는 부분.

```cpp
/**
 * 빌드모드 전용 탑다운 카메라 액터 (3단계).
 *
 * 레벨에 배치되어 그리드 중심을 내려다본다. AOJJ_Player가 빌드모드 진입 시
 * SetViewTargetWithBlend로 이 액터를 뷰타겟으로 전환하고(플레이어는 숨김),
 * 빌드모드에서 WASD/QE 입력을 Pan/Rotate로 위임받아 카메라를 움직인다.
 *
 * possess 하지 않으므로 입력은 플레이어가 받아 이 액터의 Pan/Rotate를 호출한다.
 * Pan/Rotate는 호출 시점의 DeltaSeconds × 속도를 적용하므로 자체 Tick 불필요.
 *
 * 패닝은 "카메라 yaw 기준 상대 이동" — Q/E로 회전하면 WASD 방향도 함께 돈다.
 */
```

**파일:** `frontend/Source/Wanted_Factory/Private/OJJ_BuildCamera.cpp` (생성자, SpringArm inherit 설정 — 일부 생략: 컴포넌트 생성 라인 제외)
```cpp
SpringArm->bDoCollisionTest = false;        // 지형/머신에 카메라가 끌려오지 않도록
SpringArm->bUsePawnControlRotation = false; // possess 안 함 — 회전은 액터 yaw로 직접 제어
// 액터 yaw를 상속해야 Q/E(AddActorWorldRotation yaw)로 카메라가 함께 회전(3c).
// pitch/roll은 상속 끄고 상대 pitch(-70)만 유지 → 어떤 경우에도 하향 틸트 보존.
SpringArm->bInheritYaw = true;
SpringArm->bInheritPitch = false;
SpringArm->bInheritRoll = false;
```

## 코드 조각 2 — 카메라 yaw 기준 패닝 (possess 없이 입력 위임)
**파일:** `frontend/Source/Wanted_Factory/Private/OJJ_BuildCamera.cpp` (`Pan`, 전문)
```cpp
void AOJJ_BuildCamera::Pan(const FVector2D& Axis)
{
	if (Axis.IsNearlyZero())
	{
		return;
	}

	const float Delta = GetWorld() ? GetWorld()->GetDeltaSeconds() : 0.f;
	if (Delta <= 0.f)
	{
		return;
	}

	// 카메라 yaw 기준 평면 이동: 액터 yaw로 전/우 방향을 산출(pitch/roll 제외 → 수평 패닝).
	const FRotator YawRotation(0.f, GetActorRotation().Yaw, 0.f);
	const FVector Forward = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
	const FVector Right = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);

	const FVector Move = (Forward * Axis.Y + Right * Axis.X) * PanSpeed * Delta;
	AddActorWorldOffset(Move);
}
```

## 코드 조각 3 — 빌드모드 진입 시 카메라 전환(뷰타겟 블렌드 + 플레이어 숨김)
**파일:** `frontend/Source/Wanted_Factory/Private/OJJ_Player.cpp` (모드 전환 TopDown 분기, 라인 ~2209-2238. 일부 생략: 마우스 입력모드 세팅 블록은 발췌만)
```cpp
// ── 카메라 + 가시성: 모드별 ──
if (NewMode == EBuildViewMode::TopDown)
{
   // 빌드캠 XY = 플레이어 현재 위치, Z = 그리드 평면. 그 후 빌드캠으로 블렌드 + 캐릭터 숨김.
   if (BuildCamera && BuildController)
   {
      if (const AOJJ_Grid* Grid = BuildController->GetTargetGrid())
      {
         const FVector PlayerLoc = GetActorLocation();
         const FVector AnchorXY = Grid->IsValidGridCell(Grid->WorldToGrid(PlayerLoc))
            ? PlayerLoc : Grid->GetGridCenter();
         const FVector CamLoc(AnchorXY.X, AnchorXY.Y, Grid->GetGridCenter().Z);
         BuildCamera->SetActorLocation(CamLoc);
      }
   }
   if (PC && BuildCamera)
   {
      PC->SetViewTargetWithBlend(BuildCamera, CameraBlendTime);
   }
   // 탑다운에서 플레이어가 안 보이도록 숨김
   SetActorHiddenInGame(true);
   ...
}
```

**줌 위임** (같은 파일, `Zoom`, 라인 ~2002-2011):
```cpp
// 탑다운 빌드만 뷰타겟이 BuildCamera라 그쪽을 줌(플레이어 SpringArm은 안 보임).
// ⚠️ TPS 빌드는 뷰타겟이 플레이어 SpringArm이므로 가드를 통과시켜 아래 일반 SpringArm 줌(150~800)을 탄다.
if (BuildController && BuildController->GetBuildViewMode() == EBuildViewMode::TopDown)
{
	if (BuildCamera)
	{
		BuildCamera->Zoom(Scroll);
	}
	return;
}
```

## 코드 조각 4 — #467 진입 hitch 최적화 (윈도우 한정 diff, `066ac4b`)
**파일:** `frontend/Source/Wanted_Factory/Private/OJJ_Grid.cpp` (`RefreshGridVisual` 셀 루프 diff — commit `066ac4b`)
```diff
+		// [진입 hitch] 전체 GridSize(예 756²) 대신 카메라/플레이어 중심 윈도우만 그린다(렌더 한정, 분류 로직 동일).
+		// VisibleGridRadius<=0 또는 중심 미설정(센티넬)이면 전체(폴백). 화면 밖 셀은 안 보이므로 생성 불필요.
+		int32 MinX = 0, MaxX = GridSize.X - 1, MinY = 0, MaxY = GridSize.Y - 1;
+		if (VisibleGridRadius > 0 && VisualWindowCenter.X != INT_MIN)
+		{
+			MinX = FMath::Max(0, VisualWindowCenter.X - VisibleGridRadius);
+			MaxX = FMath::Min(GridSize.X - 1, VisualWindowCenter.X + VisibleGridRadius);
+			MinY = FMath::Max(0, VisualWindowCenter.Y - VisibleGridRadius);
+			MaxY = FMath::Min(GridSize.Y - 1, VisualWindowCenter.Y + VisibleGridRadius);
+		}
+
 		TArray<FTransform> GreenXforms;
 		TArray<FTransform> RedXforms;
 		TArray<FTransform> BlueXforms;
-		for (int32 X = 0; X < GridSize.X; ++X)
+		for (int32 X = MinX; X <= MaxX; ++X)
 		{
-			for (int32 Y = 0; Y < GridSize.Y; ++Y)
+			for (int32 Y = MinY; Y <= MaxY; ++Y)
 			{
 				const FIntPoint Cell(X, Y);
 				switch (OJJ_ClassifyCellColor(Cell))
```

**카메라 추종** — `BuildController::Tick` diff (commit `066ac4b`):
**파일:** `frontend/Source/Wanted_Factory/Private/OJJ_BuildController.cpp`
```diff
+		// [진입 hitch] 시각화 윈도우가 카메라(뷰타겟) 중심을 따라가도록 갱신. 중심 셀이 충분히 이동했을 때만
+		// 재페인트(UpdateVisualWindow 내부 임계). 탑다운=빌드캠, TPS=플레이어가 뷰타겟.
+		if (TargetGrid)
+		{
+			if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
+			{
+				if (AActor* ViewTarget = PC->GetViewTarget())
+				{
+					TargetGrid->UpdateVisualWindow(ViewTarget->GetActorLocation());
+				}
+			}
+		}
```

**재페인트 임계 로직** — `AOJJ_Grid::UpdateVisualWindow` (신규 함수, commit `066ac4b`, 현재 소스 `OJJ_Grid.cpp` 원문):
```cpp
void AOJJ_Grid::UpdateVisualWindow(const FVector& WorldCenter)
{
	// [진입 hitch] 빌드모드 중 시각화 윈도우 중심을 추종. 중심 셀이 충분히 이동했을 때만 재페인트(매 프레임 재구성 방지).
	if (VisibleGridRadius <= 0)
	{
		return; // 윈도잉 끔(전체 모드) — 추종 불필요.
	}

	const FIntPoint NewCenter = WorldToGrid(WorldCenter);
	const bool bUnset = (VisualWindowCenter.X == INT_MIN);
	const bool bMoved = bUnset
		|| FMath::Abs(NewCenter.X - VisualWindowCenter.X) >= VisualWindowRepaintStep
		|| FMath::Abs(NewCenter.Y - VisualWindowCenter.Y) >= VisualWindowRepaintStep;
	if (!bMoved)
	{
		return;
	}

	VisualWindowCenter = NewCenter;
	if (bVisualizationActive)
	{
		RefreshGridVisual();
	}
}
```

## 코드 조각 5 — Foundation ECC_Camera 오클루전 픽스 (`8d9a73b`)
**파일:** `frontend/Source/Wanted_Factory/Private/OJJ_Foundation.cpp` (diff)
```diff
-	//  - Camera Ignore: 빌드/줌 카메라 충돌 간섭 방지.
+	//  - Camera Block: 3인칭 SpringArm(ProbeChannel=ECC_Camera)이 Foundation 벽 뒤 오클루전을 피하도록
+	//    머신과 동일하게 카메라 충돌을 잡는다. ⚠️ 플레이어가 Foundation 위에 설 때 발밑 슬래브로 인한
+	//    카메라 줌인 부작용은 PIE에서 확인 필요(필요 시 발밑/측면 구분 후속).
 	SlabMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("SlabMesh"));
 	...
-	SlabMesh->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
+	SlabMesh->SetCollisionResponseToChannel(ECC_Camera, ECR_Block);
```

## (보너스) 코드 조각 6 — 인트로 1인칭→3인칭 카메라 블렌드 (`bea0e00`)
**파일:** `frontend/Source/Wanted_Factory/Private/OJJ_Player.cpp` (`Tick` 내 블렌드, 라인 ~1636-1656)
> 카메라를 HeadSocket(머리 본)에 붙여 1인칭으로 시작 → 몽타주 종료 후 SpringArm ArmLength를 `IntroArmLength`로 `FInterpTo` 보간해 3인칭으로 수렴. PC가 null인 프레임에도 soft-lock 안 걸리도록 "입력 복구 성공"에 블렌드 종료를 묶은 것이 포인트.
```cpp
if (bBlendingCamera && SpringArm)
{
	const float NewArm = FMath::FInterpTo(SpringArm->TargetArmLength, IntroArmLength, DeltaSeconds, IntroBlendSpeed);
	SpringArm->TargetArmLength = NewArm;
	if (FMath::Abs(NewArm - IntroArmLength) <= 1.f)
	{
		SpringArm->TargetArmLength = IntroArmLength;
		if (TryRestoreIntroInput())
		{
			bBlendingCamera = false;
			if (UWorld* World = GetWorld())
			{
				World->GetTimerManager().ClearTimer(IntroSafetyTimerHandle);
			}
		}
	}
}
```

---

# 4. 참고: 줌 파라미터 진화 (수치 근거)

| 항목 | 초기(`01b11b3`, 6/14) | 확대(`7982116`, 6/30) | 출처 |
|------|----------------------|----------------------|------|
| `MaxArmLength` (빌드캠 줌아웃 상한) | 4000 | **15000** (~300m 폭) | `OJJ_BuildCamera.h` |
| `ZoomStep` (휠 한 틱) | 150 | **600** | `OJJ_BuildCamera.h` |
| `MinArmLength` | 600 | 600 (유지) | `OJJ_BuildCamera.h` |
| `CameraPitch` | -70 → **-90**(정탑다운) | -90 (유지) | `OJJ_BuildCamera.h` |
| TPS 플레이어 줌 | 150~800 (별개) | 유지 | `OJJ_Player.cpp` |

`OJJ_BuildCamera.h` 현재값 원문:
```cpp
float CameraPitch = -90.f;   // -90이 정탑다운(바닥과 수평으로 내려다봄)
float ArmLength = 1500.f;    // SpringArm 길이(런타임 현재값 겸함)
float ZoomStep = 600.f;      // 휠 한 틱당 팔 길이 변화량
float MinArmLength = 600.f;
float MaxArmLength = 15000.f; // 맵 전체 조망(정탑다운 FOV90 기준 ~300m 폭)
```

---

# 5. 보고 요약

**찾은 카메라 관련 커밋: 18개** (아래 핵심 목록)

핵심 커밋 해시 (시간순):
- `f70a887` (5/31) TPS 3인칭 카메라 1단계
- `ba0c5a7` (5/31) 마우스 감도/Pitch 픽스
- `ab94329` (5/31) B키 빌드모드 토글 2단계
- `12ebf7c` (5/31) 빌드 탑다운 카메라 전환 3a (`AOJJ_BuildCamera` 신규)
- `6887c86` (5/31) IMC 교체로 마우스 Look 차단 3b
- `419535e` (5/31) WASD 패닝 + Q/E 회전 3c
- `01b11b3` (6/14) 휠 줌 빌드 확장 + 정탑다운(-90) (#186)
- `b53020a` (6/19) 빌드캠 플레이어 위치 기준 배치
- `bea0e00` (6/22) 인트로 1인칭→3인칭 블렌드
- `6380495` (6/22) 인트로 soft-lock/입력 복구 보강
- `3fc5f31` (6/25) 캐릭터 0.7배 + 카메라 비례
- `8d9a73b` (6/25) Foundation ECC_Camera Block 오클루전 픽스
- `675f704` (6/30) 빌드캠 동적 Z 상승 시도
- `e0009aa` (6/30) ↑ 동적 Z 상승 revert (실패→원복 사건)
- `7982116` (6/30) 줌아웃 4000→15000
- **`066ac4b` (6/30) 진입 hitch 최적화 (gridVisual 3848ms→41ms) ★**
- **`f2f2172` (6/30) PR #467 머지 커밋**

**이슈/PR #467: 확인 완료.**
- ⚠️ #467은 **이슈가 아니라 PR**이다 (`gh issue view 467` 실패, `gh pr view 467` 성공).
- 최적화 수치 원문 확보: **gridVisual 3848ms → 41ms (약 94배)**. 전체 756×756=571,536셀 → 윈도우 (2×30+1)²=3,721셀.
- 대상은 카메라 전환 자체가 아니라 **빌드모드 진입 시 그리드 오버레이 재생성**이며, 카메라 연결점은 **시각화 윈도우가 뷰타겟(카메라/플레이어)을 추종**하도록 만든 부분.

**못 찾은 항목:**
- **이슈 #467 (이슈로서는 존재하지 않음)** — GitHub 이슈가 아니라 PR로 관리됨. 프로파일러 원본 캡처(외부 스크린샷/로그 파일)는 저장소에 없고, 수치는 PR 본문/커밋 메시지의 서술형 텍스트로만 존재.
- "탑다운↔자유시점↔캐릭터" 식의 **자유시점(free-fly) 모드는 없음.** 실제 시점 축은 (1) TPS 3인칭(일반/TPS 빌드), (2) 빌드 탑다운(`AOJJ_BuildCamera`), (3) 인트로 1인칭(HeadSocket) 세 가지. `EBuildViewMode` = `{None, TPS, TopDown}`.
- 별도 이슈 트래커 코멘트(프로파일 세션 로그 등)는 `gh pr view 467 --comments`가 빈 결과 → PR에 리뷰 코멘트 없음. 본문이 유일한 원문 출처.
