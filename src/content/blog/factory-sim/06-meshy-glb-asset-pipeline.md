---
title: "공장 시뮬레이션 게임 개발기 Phase 2.1 — AI 생성 3D 에셋 파이프라인 (GLB 임포트와 자동 정합)"
description: "아티스트 없는 팀에서 Meshy로 머신 3D 에셋을 만들고, FBX 임포트 문제로 GLB로 전환하고, 피벗·크기가 제각각인 AI 메시를 코드로 바닥 안착(GetMachinePlacementLocation)과 셀 정규화(OnConstruction 바운즈 정규화)까지 자동 정합시킨 에셋 파이프라인 기록."
date: 2026-06-05
category: AI
series: factory-sim
seriesPart: 6
tags: [AI, Meshy, 3D에셋, GLB, UE5, C++]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 2: 머신 시스템**
> - **6편: AI 생성 3D 에셋 파이프라인 (GLB 임포트와 자동 정합)** ← 현재 글
> - (이어지는 편: 머신 동작 / 컨베이어 — 예정)
>
> *Phase 1 — 그리드 시스템: [1편](/blog/factory-sim/01-grid-system-overview) · [2편](/blog/factory-sim/02-grid-data-structure-and-transaction) · [3편](/blog/factory-sim/03-material-grid-visualization) · [4편](/blog/factory-sim/04-mouse-input-build-controller) · [5편](/blog/factory-sim/05-codex-adversarial-review)*

## 1. 들어가며 — Phase 2의 두 갈래

[Phase 1](/blog/factory-sim/01-grid-system-overview)에서 그리드 위에 머신을 놓고 돌리고 회전하는 토대를 깔았습니다. **Phase 2 — 머신 시스템**은 그 위에서 두 갈래로 갑니다.

- **동작** — 놓인 설비가 자원을 입력받아 가공해 내보내기 시작한다. (다음 편들)
- **에셋** — 그 설비가 *어떻게 생겼는지*. 빈 큐브 대신 실제 머신처럼 보이게 한다. (이번 편)

이번 글은 후자, **에셋 파이프라인**입니다. 그런데 우리 팀엔 3D 아티스트가 없어요. 부트캠프 팀 프로젝트라 다들 프로그래머/기획이고, 머신 메시를 손으로 모델링할 사람이 없었습니다.

그래서 택한 게 **AI 생성**입니다. 이미지를 3D로 변환해주는 도구([Meshy](https://www.meshy.ai))로 머신 에셋을 뽑고, 그걸 UE5에 임포트해서 그리드에 얹는 거예요. 컨셉이 따로 노는 걸 막으려고 톤은 **화이트-오렌지 산업 스타일**로 통일했습니다 — 흰 바디에 주황 포인트, 공장 설비 느낌.

말은 간단한데, 막상 "AI가 만든 메시를 게임 그리드에 정확히 얹기"까지는 함정이 셋 있었어요. 임포트 포맷, 피벗, 크기. 이 글은 그 셋을 코드로 메운 기록입니다.

---

## 2. 파이프라인 — 이미지에서 그리드 위 메시까지

전체 흐름부터 그리고 갑니다.

```
컨셉 이미지(멀티뷰: front + side)
        │  AI 이미지 생성 — 화이트-오렌지 산업 톤 고정
        ▼
Meshy (이미지 → 3D)
        │  멀티뷰를 주면 단일뷰보다 형상이 안정적
        ▼
Remesh (폴리곤 절감)
        │  게임용으로 트라이앵글 수 다이어트
        ▼
UE5 임포트 (.glb)
        │  ★ 여기서부터 코드가 개입
        ▼
그리드 자동 정합 (피벗·크기 보정)
```

앞단(이미지 → Meshy → Remesh)은 도구 작업이라 이 글에서 깊게 다루진 않습니다. 한 가지 팁만 — Meshy에 **멀티뷰(정면 + 측면) 컨셉 이미지**를 주면 단일 이미지보다 형상이 훨씬 안정적으로 나옵니다. 산업 설비처럼 정면/측면 실루엣이 분명한 물체는 특히요.

진짜 이야기는 **"임포트한 다음"** 입니다. AI가 뽑은 메시는 *우리 그리드를 전혀 모르고* 만들어져요. 피벗이 어디 있는지, 크기가 몇 uu인지 제멋대로입니다. 그걸 손으로 에셋마다 맞추면 — 머신 종류가 늘 때마다 같은 수작업을 반복해야 하죠. 그래서 **코드로 일반화**했습니다.

---

## 3. 함정 ① — FBX 임포트에서 메시가 안 들어왔다

처음엔 별생각 없이 **FBX**로 내보내 임포트했습니다. 게임 에셋의 사실상 표준 포맷이니까요. 그런데 UE5.7로 임포트하니 메시가 제대로 안 들어오는 일을 겪었어요. (이 프로젝트는 엔진 5.7입니다 — `.uproject`의 `EngineAssociation`이 `"5.7"`.)

원인을 끝까지 파고들 수도 있었지만 — 임포트 파이프라인(Interchange) 쪽을 의심했습니다 — 팀 프로젝트 일정상 *원인 규명보다 우회가 빠른* 상황이었어요. 그래서 포맷을 **GLB(glTF 바이너리)** 로 바꿨고, 그 뒤로는 메시가 정상적으로 들어왔습니다.

> ⚠️ 솔직히 적어두면: "UE5.7 FBX 임포트가 왜 실패했는가"의 정확한 내부 원인은 제가 확정 짓지 못했습니다. Interchange 설정/플러그인 문제였을 수도, 익스포트 옵션 문제였을 수도 있어요. 확실한 건 *GLB로 바꾸니 해결됐다*는 결과뿐입니다. 그래서 이후 머신·건물 메시(발전소·송전탑·차폐장·컨베이어 등)는 전부 GLB로 임포트했습니다.

결과적으로 GLB는 이 워크플로우에 잘 맞았어요. Meshy 출력이 glTF/GLB를 네이티브로 지원하고, 텍스처·머티리얼이 한 파일에 묶여 오갈 때 깔끔합니다. "표준이라서 FBX"라는 관성을 한 번 의심해본 게 이 단계의 교훈이었습니다.

---

## 4. 함정 ② — 피벗이 중앙이라 머신이 땅에 절반 묻혔다

GLB로 들어온 메시를 그리드에 얹었더니, 머신이 **바닥에 절반쯤 박혀** 있었습니다. 원인은 피벗(원점)이었어요. AI가 뽑은 메시는 피벗이 *바운딩 박스 중앙*에 있는 경우가 많습니다. 게임에서 바닥에 놓는 물체는 보통 피벗이 *바닥면*에 있어야 하는데요.

[3편](/blog/factory-sim/03-material-grid-visualization)에서 배치 위치는 셀 중심 + 그리드 평면 Z였죠. 피벗이 중앙이면 그 평면에 *메시 중앙*이 맞춰지니, 메시 아래 절반이 평면 밑으로 내려가 땅에 묻힙니다.

에셋마다 모델링 툴에서 피벗을 바닥으로 옮길 수도 있지만, 그것도 머신이 늘 때마다 반복되는 수작업이에요. 그래서 **배치 코드가 피벗을 몰라도 항상 바닥에 안착하도록** 일반화했습니다. `AOJJ_Grid::GetMachinePlacementLocation`의 Z 보정이 그것입니다.

```cpp
FVector AOJJ_Grid::GetMachinePlacementLocation(AMachineBase* Machine, FIntPoint Origin, int32 RotationSteps) const
{
    // (XY: 회전 footprint center 보정 — 4편 참고, 생략)
    const FVector LowerLeftCenter = GridToWorld(Origin);
    const float OffsetX = (Size.X - 1) * CellSize * 0.5f;
    const float OffsetY = (Size.Y - 1) * CellSize * 0.5f;

    // Z: 피벗 무관 "바닥 안착". 메시 AABB의 최저점이 그리드 평면(LowerLeftCenter.Z)에 닿도록
    // 액터 Z를 보정. 메시 로컬 AABB를 "MeshComponent→Actor" 상대 트랜스폼으로 변환해 액터
    // 기준 최저점(ActorSpaceBox.Min.Z)을 구하므로, 컴포넌트 상대 위치·회전·스케일(음수 포함)을
    // 모두 반영. ZOffset = -ActorSpaceBox.Min.Z.
    float ZOffset = 0.0f;
    if (const UStaticMeshComponent* Mesh = Machine->GetMeshComponent())
    {
        if (const UStaticMesh* MeshAsset = Mesh->GetStaticMesh())
        {
            const FTransform CompToActor =
                Mesh->GetComponentTransform().GetRelativeTransform(Machine->GetActorTransform());
            const FBox ActorSpaceBox = MeshAsset->GetBoundingBox().TransformBy(CompToActor);
            ZOffset = -ActorSpaceBox.Min.Z;
        }
    }

    return FVector(LowerLeftCenter.X + OffsetX, LowerLeftCenter.Y + OffsetY, LowerLeftCenter.Z + ZOffset);
}
```

핵심은 세 줄이에요.

- **`GetRelativeTransform`으로 "메시 컴포넌트 → 액터" 변환을 구한다.** 메시 컴포넌트가 액터 안에서 따로 옮겨졌거나 회전·스케일됐을 수 있으니, 로컬 바운딩박스를 그대로 쓰면 안 됩니다.
- **그 변환으로 로컬 AABB를 `TransformBy`** 해서 *액터 기준* 바운딩박스를 다시 구한다. 이러면 컴포넌트의 상대 위치·회전·스케일(음수 스케일이나 틸트까지)이 전부 반영돼요.
- **`ZOffset = -ActorSpaceBox.Min.Z`.** 변환된 박스의 최저점만큼 액터를 위로 끌어올리면, 메시 *바닥*이 정확히 그리드 평면에 닿습니다.

### 기존 머신은 안 깨지나 — 무회귀 논증

이미 피벗이 바닥에 있던 머신(예: 엔진 기본 큐브 류)은 `Min.Z ≈ 0`이라 `ZOffset ≈ 0`. 즉 **보정이 0이라 기존 동작과 동일**합니다. 중앙 피벗(`Min.Z < 0`)만 위로, 상단 피벗(`Min.Z > 0`)만 아래로 옮겨져요. 피벗이 어디든 *바닥 안착*이라는 한 가지 결과로 수렴하면서, 멀쩡하던 머신은 건드리지 않는 게 이 보정의 핵심입니다.

> 💡 이 Z 보정 코드는 [5편](/blog/factory-sim/05-codex-adversarial-review)에서 한 번 등장했습니다. 처음엔 단순히 셀 중심 Z에 놓았다가, Codex adversarial review가 "[Medium] 피벗이 바닥이 아니면?"을 찌르면서 지금의 AABB 변환 보정으로 견고해진 거예요. 즉 이 함정 ②의 해결은 *에셋 파이프라인 작업과 5편 AI 리뷰가 만난 지점*입니다.

---

## 5. 함정 ③ — "100uu = 1셀" 가정이 깨지자 메시가 거대해졌다

피벗을 잡고 나니 이번엔 머신이 **셀을 한참 넘치게 거대**했습니다. 어떤 메시는 한 변이 수백 uu, 어떤 건 수천 uu — Meshy 출력 크기는 제각각이니까요.

원인은 코드 깊숙이 박혀 있던 가정이었어요. 머신 메시 스케일을 그동안 `GridSize`(셀 개수)로만 잡았는데, 이건 **"메시 1유닛이 100uu이고 100uu가 정확히 1셀"** 이라는 전제 위에서만 맞습니다. 엔진 기본 큐브가 *우연히* 100uu라 여태 맞아떨어졌던 거예요. AI 메시는 그 가정을 전혀 안 지키니, `GridSize`만 곱한 스케일이 그대로 폭주한 겁니다.

그래서 스케일을 **메시 네이티브 바운즈 기준으로 정규화**하도록 바꿨습니다. `AMachineBase::OnConstruction`이 그 일을 해요.

```cpp
void AMachineBase::OnConstruction(const FTransform& Transform)
{
    Super::OnConstruction(Transform);
    if (MeshComponent)
    {
        // 메시 네이티브 바운즈를 footprint(GridSize × MeshFitCellWorld)에 정규화 → 셀 자동 정합.
        // 폴백: 메시 널/바운즈 0이면 기존 식(GridSize 그대로).
        FVector Scale(GridSize.X, GridSize.Y, 1.0f);
        if (const UStaticMesh* StaticMeshAsset = MeshComponent->GetStaticMesh())
        {
            const FVector MeshSize = StaticMeshAsset->GetBoundingBox().GetSize();
            if (MeshSize.X > KINDA_SMALL_NUMBER && MeshSize.Y > KINDA_SMALL_NUMBER)
            {
                const float SX = (GridSize.X * MeshFitCellWorld) / MeshSize.X;
                const float SY = (GridSize.Y * MeshFitCellWorld) / MeshSize.Y;
                // 높이(Z)는 XY 중 작은 스케일을 따름 — XY는 셀에 맞춰 축별로 늘어나지만,
                // Z가 과도하게 늘어나 키 큰 메시(송전탑 등)가 왜곡되는 것을 막는다.
                Scale = FVector(SX, SY, FMath::Min(SX, SY));
            }
        }
        // 머신별 미세조정 배율(기본 1,1,1 → 정규화 결과 그대로).
        Scale *= MeshScaleMultiplier;
        MeshComponent->SetWorldScale3D(Scale);
    }
    // (내구도 클램프 / 디버그 텍스트 갱신 — 생략)
}
```

읽는 순서대로 짚을게요.

- **목표 크기 = `GridSize × MeshFitCellWorld`.** 2×2 머신이면 `(2×100, 2×100) = 200×200uu`가 목표. `MeshFitCellWorld`는 셀 한 칸의 월드 크기(100uu)입니다.
- **스케일 = 목표 / 메시 실제 바운즈.** `SX = (GridSize.X × 100) / MeshSize.X`. 메시가 400uu든 4000uu든, 이 비율을 곱하면 정확히 셀 footprint에 맞아요. 크기를 *몰라도* 자동 정합되는 거죠.
- **Z는 `min(SX, SY)`.** XY는 셀에 맞춰 축별로 따로 늘어나는데, 그 비율을 Z에도 따로 적용하면 송전탑처럼 키 큰 메시가 위아래로 찌그러집니다. 그래서 Z는 둘 중 *작은* 스케일을 따라 높이 왜곡을 막아요.
- **`MeshScaleMultiplier`로 머신별 미세조정.** 정규화 결과에 곱하는 보정값(기본 `(1,1,1)`). 어떤 머신을 셀보다 살짝 크게 연출하고 싶을 때 이 값만 만지면 됩니다.

### 엔진 큐브가 "우연히 맞았던" 이유

여기가 이 절의 진짜 포인트예요. 기본 큐브(100uu)에 1×1 머신이면 — `SX = (1 × 100) / 100 = 1`. 스케일이 `(1, 1, 1)`이라 **정규화 전과 수치가 똑같습니다.** 여태 `GridSize`만 곱해도 맞았던 건, 큐브 크기(100)와 `MeshFitCellWorld`(100)가 같아서 비율이 1이 됐던 *우연* 이었어요. 그 우연이 깨진 게 AI 메시였고, 정규화는 그 우연을 *규칙*으로 바꾼 겁니다.

> 💡 `MeshFitCellWorld`(=100)는 `AOJJ_Grid::CellSize`(=100)와 **반드시 같아야** 합니다. `MachineBase`가 그리드 헤더에 역의존하지 않도록 상수로 따로 뒀는데, 한쪽만 바꾸면 정규화가 어긋나요. 이것도 Codex 리뷰에서 "CellSize 편집 시 정규화가 어긋난다"는 경고를 양쪽 헤더 주석에 박아두라는 지적을 받아 반영했습니다.

---

## 6. 결과 — 임포트만 하면 그리드에 얹힌다

함정 셋을 메우고 나니, 파이프라인의 코드 측이 완성됐습니다. 이제 흐름은 이렇게 짧아져요.

1. Meshy로 머신 컨셉을 GLB로 뽑는다.
2. UE5에 임포트하고 머신 BP의 메시 슬롯에 꽂는다.
3. **끝.** 피벗이 중앙이든 상단이든 — `GetMachinePlacementLocation`이 바닥에 안착시키고, 크기가 400uu든 4000uu든 — `OnConstruction`이 셀 footprint에 정규화합니다.

에셋마다 피벗 옮기고 크기 맞추던 수작업이 사라졌습니다. 아티스트 없이 AI로 에셋을 찍어내는 팀에선, *에셋 한 개를 추가하는 비용*이 이 자동 정합 덕에 거의 0에 수렴해요. 새 머신이 필요하면 Meshy에서 뽑아 임포트만 하면 되니까요.

> 📐 (전/후 비교 스크린샷 후속 첨부 예정 — 정규화 전: 셀을 뚫고 나온 거대한 메시 / 정규화 후: footprint에 딱 맞는 머신)

---

## 7. 마치며

이번 편 요약은 셋입니다.

1. **포맷 — FBX에서 GLB로.** UE5.7 FBX 임포트에서 겪은 메시 누락을 GLB 전환으로 우회. 정확한 원인은 못 박았지만 결과는 확실했다.
2. **피벗 — 코드가 바닥에 안착시킨다.** `GetMachinePlacementLocation`이 메시 AABB를 액터 기준으로 변환해 최저점을 그리드 평면에 맞춘다. 피벗 위치 무관, 기존 머신 무회귀.
3. **크기 — 메시 바운즈로 정규화한다.** `OnConstruction`이 `GridSize × 100 / 메시바운즈`로 스케일을 잡아 어떤 크기 메시든 셀에 자동 정합. 엔진 큐브가 맞았던 건 우연이었고, 정규화가 그걸 규칙으로 만들었다.

흥미로운 건, 이 작업이 [5편](/blog/factory-sim/05-codex-adversarial-review)의 AI 리뷰와 다시 만난다는 점이에요. 함정 ②의 Z 보정은 처음부터 이렇게 견고하지 않았고, Codex의 [Medium] 지적("피벗이 바닥이 아니면?")을 거치며 AABB 변환 보정으로 단단해졌습니다. 에셋을 *AI로 만들고*, 그 에셋을 얹는 코드를 *AI로 리뷰하는* — 1인(혹은 소수) 팀이 아티스트도 시니어 리뷰어도 없이 굴러가는 방식이 이 시리즈 내내 반복되는 주제예요.

다음 편부터는 드디어 **머신이 일을 합니다.** 그리드에 얹힌 설비가 자원을 입력받아 가공해 내보내는 — 생산 사이클과 포트 시스템 이야기로 갑니다.

— JJ
