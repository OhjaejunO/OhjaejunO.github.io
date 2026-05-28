---
title: "공장 시뮬레이션 게임 개발기 Phase 1.3 — 머티리얼로 그리드 시각화하기"
description: "반투명 + 격자 선 머티리얼로 베이스 그리드를 그리고, 두 벌의 InstancedStaticMesh + 머티리얼 인스턴스로 녹/빨 호버 미리보기를 띄우며, collision 채널을 토글해 다른 trace 시스템과 격리한 과정."
date: 2026-05-28
category: UE5
series: factory-sim
seriesPart: 3
tags: [UE5, 머티리얼, 시각화, InstancedStaticMesh, 셰이더]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 1: 그리드 시스템**
> - 1편: [그리드 시스템 개요](/blog/factory-sim/01-grid-system-overview)
> - 2편: [그리드 데이터 구조와 트랜잭션 안전성](/blog/factory-sim/02-grid-data-structure-and-transaction)
> - **3편: 머티리얼로 그리드 시각화하기** ← 현재 글
> - 4편: 마우스 입력과 빌드 컨트롤러
> - 5편: Codex Adversarial Review로 잡은 숨은 버그들

## 1. 들어가며

[2편](/blog/factory-sim/02-grid-data-structure-and-transaction)에서 `AOJJ_Grid`의 **데이터 레이어** — 두 개의 `TMap`과 트랜잭션 안전성 — 을 정리했습니다. 그 데이터가 머릿속에선 잘 도는데, 정작 화면엔 *아무것도* 안 보이죠. 빌드 모드 켜면 격자가 떠야 하고, 마우스를 올린 셀은 녹/빨로 피드백이 나와야 합니다. 이번 글은 그 두 가지를 그리는 **시각화 레이어** 이야기예요.

크게 둘로 나뉩니다.

- **베이스 그리드** — `M_OJJ_GridFloor` 머티리얼 한 장이 깔린 평면. 반투명 면 + 또렷한 격자 선.
- **호버 미리보기** — `ValidHoverISM` / `InvalidHoverISM` 두 벌의 InstancedStaticMesh가 머티리얼 인스턴스(녹/빨)로 셀을 칠한다.

거기에 하나 더 — **collision 토글**. 시각화를 켜고 끄는 함수가 단순히 visibility만 만지는 게 아니라, 빌드 모드 안팎에서 collision 채널까지 바꿉니다. 왜 그래야 했는지는 6절에서.

---

## 2. 시각화 요구사항

기능 요구만 늘어놓고 보면 단순합니다.

- 빌드 모드에 들어가면 바닥에 격자가 보인다.
- 격자는 **반투명** — 배경이 살짝 비쳐서 깊이감이 살아야 한다.
- 격자 **선은 또렷** — 어디부터 어디까지가 한 셀인지 한눈에.
- 마우스가 올라간 셀(과 멀티셀 머신이면 그 풋프린트)에 **녹색(가능) / 빨강(불가)** 으로 피드백.
- 빌드 모드를 끄면 모두 사라진다.

조건 하나가 더 있어요. **패키지 빌드에서도 보여야** 한다는 것. UE5의 `DrawDebug*` 류는 에디터/PIE에선 보이지만 Shipping 빌드에선 컴파일 자체가 빠집니다. 그래서 *정식 머티리얼*로 가야지, 빠른 디버그 라인으로 끝낼 수 없는 영역이었어요.

이 다섯 줄이 셰이더 설계와 컴포넌트 구성, 그리고 마우스 trace와의 격리 — 셋 모두를 끌고 다닙니다.

---

## 3. 베이스 그리드 머티리얼 — `M_OJJ_GridFloor`

머티리얼 자체는 `.uasset` 바이너리라 노드 그래프를 코드로 보여드리진 못합니다. 대신 같은 동작을 하는 **의사 셰이더 코드**로 설명할게요. 노드들이 결국은 이 식을 평가하는 거예요.

```hlsl
// M_OJJ_GridFloor — Translucent + Unlit
// 입력: WorldPosition (자동), CellSize / LineWidth / FaceColor / LineColor / FaceOpacity / LineOpacity (파라미터)
float2 UV   = WorldPosition.xy / CellSize;          // 셀 단위 좌표 (1 = 한 셀)
float2 F    = frac(UV);                              // 셀 내부 0~1 반복
float2 D    = min(F, 1.0 - F);                       // 셀 경계까지의 거리

float  Line = step(D.x, LineWidth)
            + step(D.y, LineWidth);                  // 선 마스크 (가/세 OR ≈ 합)
Line        = saturate(Line);

float3 Color   = lerp(FaceColor,   LineColor,   Line);
float  Alpha   = lerp(FaceOpacity, LineOpacity, Line);

EmissiveColor = Color;                               // Unlit이라 EmissiveColor를 색으로
Opacity       = Alpha;
```

원리는 한 문장입니다. **셀 좌표를 `frac`으로 0~1로 반복시키고, 각 셀 안쪽에서 경계로부터의 거리가 `LineWidth`보다 가까우면 "선"으로 친다.** 가로 선과 세로 선 마스크를 더하고 `saturate`로 0~1에 묶어주면 격자 패턴 완성이에요.

### 잠깐 빠졌던 함정 — "선까지 반투명이네"

처음에는 면과 선을 한 Opacity 값으로 같이 묶어서 출력했는데, 그러니까 격자 선까지 **함께 반투명**해져서 멀리서 보면 격자 자체가 흐릿하게 흩어졌습니다. 면은 배경이 비치라고 일부러 알파 낮춘 건데, 선까지 같이 낮아진 거죠. 그래서 `FaceOpacity`와 `LineOpacity`를 분리하고, 선 영역에는 알파 거의 1을 박았어요. 같은 식 안에서 `lerp(FaceOpacity, LineOpacity, Line)` 한 줄이 그 분리를 합니다.

> 📐 (베이스 그리드 머티리얼 결과 스크린샷 후속 첨부 예정)

### 왜 Translucent + Unlit인가

- **Translucent** — 빌드 모드의 격자는 *바닥 그 자체*가 아니라 *바닥 위에 덮인 안내선*이에요. 배경이 살짝 비치는 게 의도라서 Opaque는 부적합.
- **Unlit** — 조명에 반응할 필요가 없습니다. 빌드 시간에 "여기가 셀이다"를 알려주는 UI성 표시라, 라이팅이 끼면 셀별로 명도가 들쑥날쑥해져 시각적 노이즈만 생겨요. EmissiveColor에 색을 박고 끝.

`GridSize / VisualizationRange` 분리 이야기는 2편 말미에서 한 번 짚었으니 여기선 다시 안 풀게요. 한 줄만 — 이 머티리얼이 깔리는 평면 크기는 `VisualizationRange`(시각화 전용)로 정해지고, 실제 placement 가능 여부는 `GridSize`(권위 있는 bounds)가 결정합니다. 두 값이 같이 가는 게 기본이지만, 디자이너가 따로 잡을 수 있다는 사실이 머티리얼 설계에도 영향을 줘요. 셰이더 안에서는 `CellSize`만 알면 되고, "몇 칸"인지는 머티리얼이 신경 쓸 일이 아닙니다.

---

## 4. 호버 미리보기 — 왜 InstancedStaticMesh인가

호버 미리보기는 **셀마다 작은 평면을 하나씩** 깔아야 합니다. 마우스가 가리키는 셀에 한 장, 멀티셀 머신(예: 2×2)이면 네 장. 그리고 마우스가 움직일 때마다 *전부 지우고 다시 깐다*. 매 프레임 가까이로 떨어집니다.

`AddInstance` / `ClearInstances` 가 그래서 어울려요. `UInstancedStaticMeshComponent`는 같은 메시(여기선 Engine의 Plane)를 GPU 인스턴스로 한 번에 그립니다. 셀 100개를 동시에 표시해도 draw call 한 번. 동적으로 추가·삭제도 직관적입니다.

색은 머티리얼 인스턴스 두 벌로 분리했습니다.

- `MI_OJJ_GridHoverValid` — 녹색 계열
- `MI_OJJ_GridHoverInvalid` — 빨강 계열

둘 다 `M_OJJ_GridFloor`를 부모로 하는 머티리얼 인스턴스(Material Instance)예요. 부모의 격자 패턴을 그대로 상속받고, 색 파라미터만 녹/빨로 오버라이드했습니다. 부모 머티리얼에 격자 로직이 있으니 호버 셀에도 격자 선이 자동으로 따라옵니다. 그래서 **ISM도 두 벌**입니다.

```cpp
// 호버 미리보기 ISM (Plane은 위에서 로드한 정적 변수 재사용)
ValidHoverISM = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("ValidHoverISM"));
ValidHoverISM->SetupAttachment(RootComponent);
ValidHoverISM->SetCollisionEnabled(ECollisionEnabled::NoCollision);
ValidHoverISM->SetCastShadow(false);

InvalidHoverISM = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("InvalidHoverISM"));
InvalidHoverISM->SetupAttachment(RootComponent);
InvalidHoverISM->SetCollisionEnabled(ECollisionEnabled::NoCollision);
InvalidHoverISM->SetCastShadow(false);

if (PlaneMesh.Succeeded())
{
    ValidHoverISM->SetStaticMesh(PlaneMesh.Object);
    InvalidHoverISM->SetStaticMesh(PlaneMesh.Object);
}

static ConstructorHelpers::FObjectFinder<UMaterialInterface> ValidHoverMat(
    TEXT("/Game/OJJ/Materials/MI_OJJ_GridHoverValid.MI_OJJ_GridHoverValid"));
if (ValidHoverMat.Succeeded())
{
    ValidHoverISM->SetMaterial(0, ValidHoverMat.Object);
}

static ConstructorHelpers::FObjectFinder<UMaterialInterface> InvalidHoverMat(
    TEXT("/Game/OJJ/Materials/MI_OJJ_GridHoverInvalid.MI_OJJ_GridHoverInvalid"));
if (InvalidHoverMat.Succeeded())
{
    InvalidHoverISM->SetMaterial(0, InvalidHoverMat.Object);
}
```

ISM 두 개 모두 **collision 없음 + 그림자 없음**입니다. 미리보기는 시각 피드백만 하면 되고, 다른 어떤 시스템에도 끼어들면 안 돼요. 그림자도 의미 없는 노이즈만 만드니까 끕니다. 메시는 베이스 그리드와 동일한 엔진 Plane을 공유하고, 머티리얼만 인스턴스 두 벌로 분기시켰어요.

> 💡 "왜 ISM 한 벌에 머티리얼만 인스턴스별로 바꾸지 않았냐"는 자연스러운 질문이에요. ISM은 *컴포넌트 단위*로 머티리얼을 잡고, 인스턴스별로 머티리얼을 바꾸는 일이 깔끔하지 않습니다. 인스턴스 단위 파라미터(`PerInstanceCustomData`)로 색을 흘려 보내는 방법도 있지만, 두 벌로 가는 게 머티리얼 그래프가 단순하고 마이그레이션도 쉬워서 그쪽을 택했어요.

---

## 5. `UpdateHoverPreview` — 셀별 분기

실제 호버를 그리는 코드는 짧습니다.

```cpp
void AOJJ_Grid::UpdateHoverPreview(AMachineBase* Machine, FIntPoint Origin)
{
    ClearHoverPreview();

    if (!Machine)
    {
        return;
    }

    const TArray<FIntPoint> FootprintCells = CalculateFootprint(Machine, Origin);

    for (const FIntPoint& Cell : FootprintCells)
    {
        const TWeakObjectPtr<AMachineBase>* Found = OccupiedCells.Find(Cell);
        const bool bIsOccupied = (Found && Found->IsValid());

        // 멀티셀 머신이 그리드 가장자리 너머로 풋프린트가 새는 경우, anchor만 valid라도
        // out-of-bounds 셀이 녹색으로 표시되면 시각 피드백이 거짓말이 됨 → 빨강으로 강제.
        const bool bIsOutOfBounds = !IsValidGridCell(Cell);
        const bool bIsInvalid = bIsOccupied || bIsOutOfBounds;

        // 베이스 그리드 평면(Z=1)보다 위로 +2 오프셋 → 가림 방지
        const FVector CellCenter = GridToWorld(Cell);
        const FVector InstanceLocation(CellCenter.X, CellCenter.Y, CellCenter.Z + 2.0f);

        // Plane(100x100) → CellSize 유닛으로 스케일
        const FVector InstanceScale(CellSize / 100.0f, CellSize / 100.0f, 1.0f);
        const FTransform InstanceTransform(FRotator::ZeroRotator, InstanceLocation, InstanceScale);

        UInstancedStaticMeshComponent* TargetISM = bIsInvalid ? InvalidHoverISM.Get() : ValidHoverISM.Get();
        if (TargetISM)
        {
            // World-space 좌표로 추가 (액터 위치 무관)
            TargetISM->AddInstance(InstanceTransform, /*bWorldSpace=*/true);
        }
    }
}

void AOJJ_Grid::ClearHoverPreview()
{
    if (ValidHoverISM)
    {
        ValidHoverISM->ClearInstances();
    }
    if (InvalidHoverISM)
    {
        InvalidHoverISM->ClearInstances();
    }
}
```

읽기 순서대로 짚어볼게요.

1. **`ClearHoverPreview()`** — 매 호출의 첫 줄. 이전 프레임 인스턴스를 싹 지운다. 누적되면 마우스를 흔드는 즉시 화면이 녹/빨 카펫이 됩니다.
2. **풋프린트 셀 순회** — `CalculateFootprint`는 머신 크기를 기준으로 차지할 셀 목록을 만들어 줍니다(2편 참고).
3. **셀 단위 invalid 판정** — *점유*되었거나 *out-of-bounds*면 invalid. 둘 중 하나만 걸려도 빨강.
4. **Z + 2 오프셋** — `GridToWorld`가 돌려주는 셀 중심 Z는 그리드 액터 Z(보통 0)와 동일. 거기에 +2를 더해 호버 인스턴스의 world Z=2로 띄웁니다. 베이스 그리드 평면이 Z=1에 깔려 있으니 그 위 1 유닛 차이로 충분히 가림 방지가 돼요. 빠뜨리면 Z-fighting으로 깜빡거립니다.
5. **CellSize에 맞춘 스케일** — UE 엔진 기본 Plane 메시는 100×100 단위. 셀 사이즈가 200이면 2배, 50이면 0.5배.
6. **분기 배치** — invalid면 `InvalidHoverISM`에, 아니면 `ValidHoverISM`에 인스턴스 추가. 같은 트랜스폼이지만 *어느 ISM에 들어가느냐*가 색을 결정.
7. **`bWorldSpace=true`** — 인스턴스 좌표를 월드 기준으로 해석. 그리드 액터를 어디 두든 셀 중심이 정확하게 잡힙니다.

### 한 가지만 강조하면 — out-of-bounds 강제 빨강

2×2 머신을 그리드 모서리에 가져가면, anchor(왼쪽 아래)는 유효 셀인데 나머지 셀들은 그리드 바깥일 수 있어요. 점유 여부만 검사하면 그 바깥 셀들이 "비어 있음"으로 판정돼 *녹색*으로 표시됩니다. 사용자는 "여기 놓을 수 있겠네" 생각하고 클릭, 그런데 `CanPlaceMachine`은 out-of-bounds라며 거절. **시각 피드백이 거짓말**을 한 거예요.

그래서 호버 단계에서도 `IsValidGridCell`로 한 번 더 거릅니다. 같은 invariant가 *판정 함수와 시각화 함수에서 동시에* 지켜져야 사용자 신뢰가 깨지지 않아요.

> 📐 (호버 녹/빨 미리보기 스크린샷 후속 첨부 예정)

---

## 6. `SetVisualizationVisible` — collision까지 같이 토글

시각화를 켜고 끄는 함수는 *visibility만 만지면 되는 줄* 알았는데, collision도 같이 만져야 했습니다.

```cpp
void AOJJ_Grid::SetVisualizationVisible(bool bVisible)
{
    if (!GridFloorMesh)
    {
        return;
    }

    GridFloorMesh->SetVisibility(bVisible);

    if (bVisible)
    {
        // 빌드 모드 진입: cursor 라인 트레이스만 받도록 Visibility 채널만 Block.
        // Pawn/Camera/기타 trace는 Ignore로 두어 게임플레이 trace 시스템과 격리.
        GridFloorMesh->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
        GridFloorMesh->SetCollisionResponseToAllChannels(ECR_Ignore);
        GridFloorMesh->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
    }
    else
    {
        // 빌드 모드 종료: 어떤 trace에도 영향 없도록 collision 완전 해제.
        GridFloorMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    }
}
```

왜 collision까지 토글하는가. 4편(마우스 입력) 떡밥을 살짝 깔 자리예요.

빌드 모드에서 마우스가 가리키는 셀을 알아내려면 **카메라에서 커서 위치로 라인 트레이스**를 쏩니다. 그 트레이스가 베이스 그리드 평면에 맞아야 어느 셀인지를 계산할 수 있어요. *그런데 그 평면이 collision이 없으면 트레이스가 통과해 버려서 못 맞춥니다.* 그래서 빌드 모드일 때만 평면에 collision을 살려야 합니다.

다만 **모든 collision 채널을 다 켜면** 사고가 나요.

- Pawn 채널까지 Block 되면 캐릭터가 평면 위에서 미끄러지거나 걸려요.
- Camera 채널이 Block 되면 카메라가 들어올 때 막혀요.
- 기타 게임플레이 trace(피격 판정, 인터랙션 trace)에 베이스 그리드가 잡혀 게임 로직이 흔들립니다.

그래서 **Visibility 채널 하나만 Block**, 나머지 전부 Ignore. `QueryOnly + 모든 채널 Ignore + Visibility만 Block`이 정확한 표현이에요. 마우스 라인 트레이스(`UCameraComponent`/`PlayerController` 쪽 GetHitResultUnderCursor* 류)가 Visibility 채널을 쓰니까 그것만 받습니다.

빌드 모드를 끄면 다시 `NoCollision`. 게임 외 영역 중 *이 그리드를 모르는* 다른 시스템이 베이스 그리드를 *모를 권리*를 보장하는 거예요. 시각화 컴포넌트가 게임플레이에 새어 들어가지 않게.

이 collision 격리가 곧 4편의 마우스 라인 트레이스 설계로 이어집니다. 시각화 레이어 끝에서 입력 레이어로 자연스럽게 넘어가는 다리예요.

---

## 7. 생성자 — 컴포넌트와 머티리얼 셋업

세 컴포넌트(`GridFloorMesh` + `ValidHoverISM` + `InvalidHoverISM`)와 머티리얼 로드는 생성자에서 끝납니다. 코드만 보면 길지만 패턴이 반복이라 한 번에 훑고 가요.

```cpp
AOJJ_Grid::AOJJ_Grid()
{
    PrimaryActorTick.bCanEverTick = true;
    CellSize = 100.0f;
    VisualizationRange = 20;

    USceneComponent* GridRoot = CreateDefaultSubobject<USceneComponent>(TEXT("GridRoot"));
    RootComponent = GridRoot;

    GridFloorMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("GridFloorMesh"));
    GridFloorMesh->SetupAttachment(RootComponent);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> PlaneMesh(TEXT("/Engine/BasicShapes/Plane.Plane"));
    if (PlaneMesh.Succeeded())
    {
        GridFloorMesh->SetStaticMesh(PlaneMesh.Object);
    }

    static ConstructorHelpers::FObjectFinder<UMaterialInterface> GridMaterial(
        TEXT("/Game/OJJ/Materials/M_OJJ_GridFloor.M_OJJ_GridFloor"));
    if (GridMaterial.Succeeded())
    {
        GridFloorMesh->SetMaterial(0, GridMaterial.Object);
    }

    // 기본은 collision 없음. 빌드 모드 진입 시 SetVisualizationVisible(true)에서 필요한
    // 채널만 활성화하여 hidden plane이 다른 trace 시스템에 끼어들지 않도록 격리.
    GridFloorMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    GridFloorMesh->SetVisibility(false);

    // (ValidHoverISM / InvalidHoverISM 생성 및 머티리얼 인스턴스 로드 — 4절 코드 참고)
}
```

세 가지만 짚으면 됩니다.

- **`/Engine/BasicShapes/Plane.Plane`** — UE5 엔진 기본 평면 메시. 100×100 단위, 두께 없는 정사각형. 베이스 그리드도, 호버 인스턴스도 동일 메시를 공유합니다. 하나의 정적 `FObjectFinder` 결과를 세 컴포넌트가 같이 써요.
- **`/Game/OJJ/Materials/...`** — 머티리얼 에셋 경로. **`/Game/`은 `Content/`** 의 별칭입니다. 즉 실제 디스크 경로는 `Content/OJJ/Materials/M_OJJ_GridFloor.uasset`. 경로가 틀리면 `FObjectFinder`가 실패하고 머티리얼이 안 잡힙니다. 그 결과는 **에디터에서 익숙한 핑크색 체크무늬** — UE가 "머티리얼을 못 찾았다"고 말하는 시각 신호예요. 핑크가 떴다면 일단 `Outliner → Details → Material` 슬롯 경로부터 확인하면 됩니다.
- **기본 invisible + NoCollision** — 빌드 모드에 들어가야 비로소 보이고, collision도 그때만 살립니다. 6절의 `SetVisualizationVisible`이 이 기본 상태에서 시작해서 켰다 껐다 합니다.

### `BeginPlay` — `VisualizationRange` 기반 스케일/위치

생성자에서는 메시·머티리얼만 잡고, 실제 평면 크기는 런타임에 잡습니다.

```cpp
void AOJJ_Grid::BeginPlay()
{
    Super::BeginPlay();

    if (GridFloorMesh)
    {
        // Plane 기본 크기 100x100 → CellSize 단위로 스케일
        const float ScaleFactor = (VisualizationRange * CellSize) / 100.0f;
        GridFloorMesh->SetRelativeScale3D(FVector(ScaleFactor, ScaleFactor, 1.0f));

        // Plane은 액터 중심에 위치 → 그리드 lower-left 원점에 맞추려면 절반만큼 +XY 오프셋
        // Z=1로 Z-fighting 방지
        const float OffsetXY = (VisualizationRange * CellSize) / 2.0f;
        GridFloorMesh->SetRelativeLocation(FVector(OffsetXY, OffsetXY, 1.0f));
    }
}
```

이 짧은 두 줄에 신경 쓴 게 둘.

- **Plane은 중심 기준** — 엔진 기본 Plane의 피벗은 액터 중심입니다. 그리드 좌표계는 lower-left가 원점(`(0,0)`)이라, 평면을 그대로 두면 그리드가 -X / -Y 쪽으로 절반 새요. 그래서 `(VisualizationRange * CellSize) / 2` 만큼 +X/+Y로 밀어줍니다.
- **Z=1로 Z-fighting 방지** — 바닥 액터가 Z=0에 깔리는 일이 흔해서, 정확히 Z=0에 베이스 그리드를 두면 두 평면이 깜빡거립니다. 1 유닛만 띄워도 충분히 해결돼요. 그리고 호버 미리보기 인스턴스는 5절에서 본 것처럼 그리드 액터 Z + 2 — 일반 배치에선 world Z=2 — 에 들어갑니다. **0(바닥) < 1(베이스 그리드) < 2(호버)** 가 Z 순서.

---

## 8. 마치며

이번 편 요약은 네 줄이에요.

1. **베이스 그리드는 머티리얼 한 장** — `frac`/`min`/`step`으로 반투명 면 + 또렷한 격자 선. `LineOpacity`를 따로 두지 않으면 선까지 흐려진다.
2. **호버 미리보기는 ISM 두 벌** — 녹/빨 머티리얼 인스턴스로 분리하고, 매 프레임 `ClearInstances` → `AddInstance(..., bWorldSpace=true)`.
3. **invariant는 시각화에서도 지킨다** — `UpdateHoverPreview`에서 점유 + out-of-bounds를 같이 본다. 판정 함수와 시각 피드백이 따로 놀면 사용자 신뢰가 깨진다.
4. **`SetVisualizationVisible`은 collision까지 토글** — Visibility 채널만 Block, 나머지 전부 Ignore. 시각화 컴포넌트가 다른 trace 시스템에 새지 않게 격리한다.

마지막 4번이 다음 편 — **4편: 마우스 입력과 빌드 컨트롤러** — 의 출발점입니다. *그 Visibility 채널 trace를 쏘는 쪽 코드*, 그리고 빌드 모드 토글이 컨트롤러에서 어떻게 흐르는지를 다음 글에서 풀어요. 시각화 쪽 collision 격리가 *왜 그렇게 까다롭게 잡혔는지*도 그제서야 완전히 보일 겁니다.

그리고 약속한 **5편** — 이 시각화/입력 코드를 AI 도구가 어떻게 흔들었는지 — 도 그대로 갑니다.

— JJ
