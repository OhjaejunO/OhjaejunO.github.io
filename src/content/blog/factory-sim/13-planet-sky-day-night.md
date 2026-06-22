---
title: "공장 시뮬레이션 게임 개발기 — 막간: 행성에 밤이 내린다 (지면·낮밤 사이클·절차적 별 돔)"
description: "공장을 짓는 동안, 그 공장이 올라앉을 행성 자체도 만들고 있었습니다. Meadows 지면과 경사가 스스로 정하는 눈/흙, 시각에 맞춰 도는 태양, 그리고 밤. 그런데 UE5의 SkyAtmosphere는 별을 못 그립니다. 카메라를 따라다니되 회전은 고정인 절차적 별 돔을 새로 만들고, 낮밤 사이클에 별 강도 훅을 얇게 얹어 노을부터 별이 돋게 했어요. 달빛과 별이 박명 페이드 하나(ComputeNightFactor)를 공유하는 법, 그리고 그 별 돔이 거대한 검은 불투명 구가 되어 하늘을 통째로 가렸던 Opaque 버그까지 — 생산편 사이의 막간, 행성에 하늘을 입히는 이야기."
date: 2026-06-15
category: UE5
series: factory-sim
seriesPart: 13
tags: [UE5, C++, 환경, 낮밤사이클, 절차적머티리얼, HLSL]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — 막간(Interlude): 행성 환경**
> - **막간편: 행성에 밤이 내린다 — 지면·낮밤 사이클·절차적 별 돔** ← 현재 글
> - (다음 *생산* 편: Phase 3.2 레시피 가공 — 예정)
>
> *Phase 1 — 그리드 시스템: [1편](/blog/factory-sim/01-grid-system-overview) · [2편](/blog/factory-sim/02-grid-data-structure-and-transaction) · [3편](/blog/factory-sim/03-material-grid-visualization) · [4편](/blog/factory-sim/04-mouse-input-build-controller) · [5편](/blog/factory-sim/05-codex-adversarial-review)*
> *Phase 2 — 머신과 컨베이어 (6~11편) · Phase 3 — 생산 (12편~): [시리즈 전체 보기 →](/blog/series/factory-sim)*

## 1. 들어가며 — 공장 아래에 행성이 있었다

[12편](/blog/factory-sim/12-resource-mining-claim)까지, 시리즈는 줄곧 *시스템* 이야기였어요. 그리드, 컨베이어, 채굴기 — 격자 위에서 아이템이 태어나고 흐르는 규칙들. 그런데 그 격자는 *어디* 위에 깔려 있나요? 1~12편 내내 배경은 사실상 텅 빈 회색 평면이었습니다. 검증엔 그걸로 충분했죠. 하지만 게임이 되려면 그 격자가 *행성 위*에 있어야 합니다.

그래서 생산 계통(Phase 3)을 깔던 그 며칠 사이, 곁가지로 **행성 자체**를 만들고 있었어요. 이번 글은 그 곁가지 — 생산편들 사이의 **막간**입니다. 자원을 캐고 가공하는 흐름과는 별개로, 공장이 올라앉을 *무대*를 만드는 이야기예요.

<!-- TODO: 스크린샷 — 눈 덮인 봉우리 + 밤하늘 별이 보이는 행성 전경 (hero 후보) -->

무대에 필요한 건 둘입니다. **바닥**과 **하늘.** 바닥은 비교적 금방 깔렸는데, 하늘 — 특히 *밤하늘* — 이 의외로 한 챕터짜리 문제였습니다. UE5의 표준 하늘인 SkyAtmosphere가 **별을 안 그려주거든요.** 이 글의 절반은 그 "밤이 깜깜하기만 한" 문제를 푸는 과정입니다.

순서대로 가요. 먼저 땅, 다음 해가 도는 법, 그리고 밤.

---

## 2. 땅부터 — 경사가 스스로 정하는 눈과 흙

행성 지면은 거창한 절차적 생성이 아니라, 엔진 기본 지형 도구(Landscape)에 **PBR 텍스처 세트**를 입히는 정공법으로 갔습니다. 두 표면을 준비했어요 — 흙(`Ground037`)과 눈(`Snow015`), 각각 Color·Normal·Roughness·AO·Displacement 2K 텍스처를 묶어 `M_Ground`/`M_Snow` 머티리얼로 만들고요.

문제는 "어디에 눈을 깔고 어디에 흙을 깔 것인가"입니다. 손으로 일일이 칠하는 건 나중 일이고, 우선 **경사도가 스스로 정하게** 하고 싶었어요. 산봉우리엔 눈, 완만한 바닥엔 흙. 이걸 위해 두 표면을 한 마스터 머티리얼(`M_Landscape_PlanetBlend`)에서 섞되, 자동 경사 마스크와 (나중에 추가할) 수동 페인트를 **하나의 가중치 `w`** 로 통합했습니다.

```
w = saturate( SlopeAuto + GroundPaint − SnowPaint )

  · SlopeAuto  : 경사도 자동 마스크 (평지 0 → 경사 1)   ← VertexNormalWS.Z 기반
  · GroundPaint: "Ground" 레이어 수동 페인트 가중치
  · SnowPaint  : "Snow"  레이어 수동 페인트 가중치
```

`w=0`이면 눈, `w=1`이면 흙. BaseColor·Normal·Roughness 세 채널을 **같은 `w`** 로 `lerp`하면 한 번의 가중치 계산으로 표면 전체가 섞입니다. 자동 마스크의 핵심은 `VertexNormalWS.Z` — 표면이 수평이면 법선 Z가 1에 가깝고, 가팔라질수록 0으로 떨어지죠. 그 Z를 임계값과 비교해 0~1로 정규화한 게 `SlopeAuto`입니다.

> **방향 한 번 뒤집은 이야기.** 처음엔 "평지=눈, 경사=흙"으로 짰는데, 막상 보니 *그림이 거꾸로*였어요. 우리가 원한 건 *산봉우리에 쌓인 눈*인데 그 공식은 평평한 바닥을 온통 눈밭으로 만들었거든요. 그래서 마스크를 `Z − Threshold`로 한 번 반전(Subtract 스왑)해서 **평지=흙 / 봉우리=눈**으로 뒤집었습니다. 완만한 행성이라 경사 변화가 작아서, Threshold 0.99·Falloff 0.01이라는 거의 극단값을 줘야 봉우리만 눈이 얹혔어요. 덤으로 Roughness를 ×2 해서 흙도 눈도 *무광*으로 — 행성 표면이 플라스틱처럼 반짝이던 걸 죽였습니다.

<!-- TODO: 스크린샷 — 평지 흙 / 봉우리 눈 경사 자동 마스크 결과 (지면 블렌드) -->

여기까진 머티리얼 그래프 손작업이라 코드로 보여줄 게 없어요. 진짜 코드가 나오는 건 **하늘**부터입니다.

---

## 3. 해가 도는 법 — 낮밤 사이클

바닥이 생겼으니 그 위로 시간이 흘러야죠. 게임엔 이미 게임 내 시각을 굴리는 시간 소스가 있었습니다(행성 이벤트·낮밤을 관장하는 서브시스템). 제가 할 일은 그걸 *읽어서* 태양을 돌리는 것 — 시간 소스 코드는 **한 줄도 건드리지 않고**, 진행률만 구독하는 레벨 배치형 컨트롤러 `AOJJ_DayNightController`를 새로 뒀습니다.

핵심은 "하루 진행률(0~1)을 태양의 Pitch(고도각)로 바꾸는" 변환 하나예요.

```cpp
float AOJJ_DayNightController::ProgressToSunPitch(float Progress01)
{
    // progress 0=0시(+90°), 0.25=6시(0°), 0.5=12시(-90°), 0.75=18시(0°).
    return 90.0f * FMath::Cos(Progress01 * UE_TWO_PI);
}
```

코사인 한 방으로 하루가 돕니다. `Pitch`가 **음수면 빛이 아래로 내리꽂혀 낮**, **양수면 빛이 위로 향해 태양이 지평선 아래 — 밤**이에요. 자정(progress 0)엔 +90°로 태양이 발밑, 정오(0.5)엔 -90°로 머리 위, 그 사이 6시·18시엔 0°로 수평(일출·일몰). 이 부호 규약이 5절의 밤 판정까지 그대로 이어집니다.

매 틱 이 Pitch를 태양 라이트에 적용하는데, 여기에 시리즈 내내 반복된 그 습관 — **skip-if-unchanged** 가 또 들어가요.

```cpp
void AOJJ_DayNightController::ApplySunRotation(float TargetSunPitch, float DeltaSeconds)
{
    // 첫 프레임은 즉시 스냅, 이후엔 부드럽게 보간(급격한 시각 점프 흡수).
    if (!bHasInitializedRotation)
    {
        CurrentSunPitch = TargetSunPitch;
        bHasInitializedRotation = true;
    }
    else
    {
        CurrentSunPitch = FMath::FInterpTo(CurrentSunPitch, TargetSunPitch, DeltaSeconds, RotationInterpSpeed);
    }

    // 실질 변화가 없으면 트랜스폼 갱신 생략(디버그로 시각을 고정해 둔 경우 등).
    if (FMath::IsNearlyEqual(CurrentSunPitch, LastSunPitch, 0.01f) &&
        FMath::IsNearlyEqual(SunYaw, LastSunYaw, 0.01f))
    {
        return;
    }

    SunLight->SetActorRotation(FRotator(CurrentSunPitch, SunYaw, 0.0f));
    LastSunPitch = CurrentSunPitch;
    LastSunYaw = SunYaw;
}
```

`Yaw`(해 뜨는 방위)는 고정이고 `Pitch`만 시간으로 돕니다. 720초/사이클이면 0.5°/s라 충분히 부드럽고, 그나마도 `FInterpTo`로 한 번 더 완충해요. 그리고 직전 값과 같으면 `SetActorRotation`을 통째로 건너뜁니다 — 정지 시각에서 매 프레임 트랜스폼을 헛돌리지 않으려는 거죠.

> **솔직한 이음매 하나.** 이 시간 소스는 현재 *복제(replicate)되지 않습니다.* 컨트롤러는 각 클라이언트에서 회전을 로컬로 계산하는 *시각 효과*일 뿐이라, 서버·클라의 시각이 어긋나면 낮밤도 어긋나요. 멀티플레이어 정합은 시간 소스 소유자가 시각을 복제하면 자동으로 풀리는 — 지금은 *기존* 한계(이 편에서 새로 생긴 게 아닌)로 헤더에 명시만 해뒀습니다.

---

## 4. 밤을 어둡지만은 않게 — 달과 박명 페이드

태양이 지면 밤입니다. 그런데 그냥 두면 밤이 *완전한 암흑*이에요. 그래서 선택적으로 **달빛**을 둡니다 — 태양과 180° 반대 위상으로 도는 두 번째 Directional Light. 태양이 발밑일 때 달은 머리 위죠.

여기서 중요한 건 "밤이 *얼마나* 깊은가"를 하나의 숫자로 정의하는 거예요. 일몰 순간 갑자기 달빛이 *탁* 켜지면 점프가 보이니까, 박명(twilight) 구간에 걸쳐 부드럽게 올려야 합니다. 그 단일 정의가 `ComputeNightFactor`입니다.

```cpp
float AOJJ_DayNightController::ComputeNightFactor(float SunPitch) const
{
    // SunPitch>0 = 태양이 지평선 아래(밤). 일몰 순간(0)부터 TwilightBlend 폭(90°×값)에
    // 걸쳐 0→1 선형 상승. 0 division 가드.
    const float Denom = FMath::Max(KINDA_SMALL_NUMBER, 90.0f * TwilightBlend);
    return FMath::Clamp(SunPitch / Denom, 0.0f, 1.0f);
}
```

`SunPitch`가 0(일몰)에서 양수로 커질수록 — 즉 태양이 지평선 *아래로* 더 내려갈수록 — NightFactor가 0에서 1로 오릅니다. `TwilightBlend`(기본 0.05 ≈ 4.5°)가 그 페이드 폭이고요. 일몰 직후 4.5°만큼 내려가는 동안 0→1로 차오른 뒤 한밤엔 1로 포화됩니다.

달빛은 이 값을 그대로 강도에 곱해요.

```cpp
void AOJJ_DayNightController::ApplyMoon(float SunPitch)
{
    if (!MoonLight) { return; }   // 달빛은 선택 — 미지정이면 조용히 skip(태양만 동작)

    const float MoonPitch = -SunPitch;                       // 태양과 180° 반대
    const float NightFactor = ComputeNightFactor(SunPitch);  // 4절의 공유 정의
    const float TargetIntensity = MoonIntensity * NightFactor;

    // 회전 적용 (skip-if-unchanged, 일부 생략)
    // ...
    // 강도 적용 — 변화가 있을 때만, 컴포넌트가 Movable이어야 런타임 반영됨
    if (!FMath::IsNearlyEqual(TargetIntensity, LastMoonIntensity))
    {
        if (ULightComponent* MoonComp = MoonLight->GetLightComponent())
        {
            MoonComp->SetIntensity(TargetIntensity);
            LastMoonIntensity = TargetIntensity;
        }
    }
}
```

일몰 순간 `SunPitch=0` → `NightFactor=0` → 달빛 강도 0에서 *연속적으로* 시작하니 점프가 없습니다. 그리고 이 `ComputeNightFactor`가 **달빛만의 것이 아니라는 게** 다음 절의 복선이에요 — 별도 똑같은 페이드를 타야 달과 별이 *같은 박자로* 떠야 하니까요.

---

## 5. 별을 그리는 문제 — SkyAtmosphere는 별을 못 그린다

달까지 켰는데도 밤하늘이 허전했어요. 별이 없거든요. 그리고 여기서 막힙니다 — **UE5의 SkyAtmosphere는 별을 그리지 못합니다.** 대기 산란을 물리적으로 시뮬레이션하는 시스템이라 낮 하늘·노을은 멋지게 뽑지만, "검은 배경에 점점이 박힌 별" 같은 건 그 모델 바깥이에요.

그래서 별은 **별도의 표현물**로 직접 만들어야 합니다. 접근은 고전적인 **스카이돔(sky dome)** — 카메라를 통째로 감싸는 거대한 구의 *안쪽 면*에 별을 그리는 거예요. 신규 액터 `AOJJ_StarDome`이 그 구입니다.

```cpp
AOJJ_StarDome::AOJJ_StarDome()
{
    PrimaryActorTick.bCanEverTick = true;   // 매 틱 카메라를 따라가야 함

    DomeMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("DomeMesh"));
    SetRootComponent(DomeMesh);

    // 엔진 기본 구 메시. 안쪽에서 보이려면 머티리얼이 Two-Sided여야 한다.
    static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    if (SphereMesh.Succeeded()) { DomeMesh->SetStaticMesh(SphereMesh.Object); }

    static ConstructorHelpers::FObjectFinder<UMaterialInterface> StarMat(TEXT("/Game/OJJ/Sky/M_Stars.M_Stars"));
    if (StarMat.Succeeded()) { DomeMesh->SetMaterial(0, StarMat.Object); }

    // 빌드 레이캐스트/이동을 가리지 않도록 충돌 제거, 그림자/라이팅 영향 제거(순수 표시용).
    DomeMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    DomeMesh->SetCastShadow(false);
    DomeMesh->bReceivesDecals = false;
    DomeMesh->SetCanEverAffectNavigation(false);
}
```

세 가지 결정이 들어 있어요.

- **Two-Sided 머티리얼.** 보통 메시는 바깥 면만 그립니다. 우리는 구 *안쪽*에 있으니, 머티리얼이 양면이라야 안쪽 면의 별이 보여요.
- **NoCollision.** 이게 의외로 중요합니다. [4편](/blog/factory-sim/04-mouse-input-build-controller)의 빌드 배치는 마우스 레이캐스트로 바닥을 짚는데, 카메라를 감싼 거대한 구에 충돌이 있으면 그 레이가 *별 돔에 먼저 맞아* 배치가 다 깨져요. 충돌을 빼서 빌드 레이가 돔을 그냥 통과하게 합니다.
- **그림자·내비 끔.** 반경 수백 미터짜리 구가 씬 라이팅에 그림자를 드리우거나 내비메시에 끼면 안 되니까요.

그리고 이 돔은 **카메라를 따라다니되 회전은 고정**입니다.

```cpp
void AOJJ_StarDome::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!bFollowCamera) { return; }

    // 0번 플레이어 카메라 위치로 이동(회전은 유지 → 별자리 고정, 시차 없음).
    if (const APlayerCameraManager* CamMgr = UGameplayStatics::GetPlayerCameraManager(this, 0))
    {
        SetActorLocation(CamMgr->GetCameraLocation());
    }
}
```

*위치만* 카메라에 붙이고 *회전은 건드리지 않는* 게 묘수예요. 카메라가 항상 돔의 정중앙에 있으니 아무리 걸어다녀도 별까지의 거리가 안 변해서 **시차(parallax)가 0** — 별이 무한히 먼 곳에 박힌 것처럼 보입니다. 회전을 고정했으니 별자리는 제자리에 있고, 플레이어가 고개를 돌리면 그 별자리를 *올려다보는* 게 되죠. 크기는 `DomeScale=1500`(반경 ~750m)으로 맵(half 504m)을 넉넉히 감쌌습니다.

---

## 6. 별 머티리얼과 강도 — 낮엔 0, 노을부터 만개

돔은 그릇이고, 별 그 자체는 머티리얼 `M_Stars`가 그립니다. 텍스처를 붙이는 대신 **절차적으로** — 돔 표면의 방향 벡터를 격자로 쪼개 해시로 별을 흩뿌리는 Custom HLSL 한 토막이에요.

```hlsl
float3 d = normalize(Dir);              // 돔 표면 방향 (VertexNormalWS)
float3 p = d * Density;                 // 방향을 격자 해상도만큼 확대
float3 i = floor(p);                    // 격자 셀 인덱스
float h = frac(sin(dot(i, float3(127.1, 311.7, 74.7))) * 43758.5453);  // 셀별 해시
float present = step(1.0 - Coverage, h);              // 이 셀에 별이 있나?
float h2 = frac(sin(dot(i, float3(269.5, 183.3, 246.1))) * 43758.5453);
float3 center = float3(h, h2, frac(h + h2));          // 셀 안 별의 위치
float dist = length(frac(p) - center);
float star = present * saturate(1.0 - dist / max(StarSize, 1e-4));
return pow(star, Sharpness);            // 가장자리 날카로움
```

`Density`(격자 해상도)·`Coverage`(별 있는 셀 비율)·`StarSize`·`Sharpness`를 전부 ScalarParameter로 빼서 에디터 슬라이더로 별 밀도와 크기를 튜닝할 수 있게 했어요. Unlit·Two-Sided라 라이팅 영향 없이 순수 Emissive로만 빛납니다.

그런데 별이 *낮에도* 떠 있으면 안 되죠. 그 on/off를 3·4절의 낮밤 사이클과 잇는 게 마지막 한 가닥입니다. 머티리얼은 Material Parameter Collection(`MPC_Sky`)의 `StarIntensity` 스칼라를 읽어 별 밝기에 곱하고, 컨트롤러가 매 틱 그 스칼라에 **NightFactor를 써넣어요.**

```cpp
void AOJJ_DayNightController::ApplyStars(float SunPitch)
{
    if (!StarCollection) { return; }   // 별도 선택 — MPC 미지정이면 skip
    UWorld* World = GetWorld();
    if (!World) { return; }

    // 낮 0 / 밤 1 — 달빛과 '같은' ComputeNightFactor. 낮엔 0이라 별이 완전히 사라진다.
    const float TargetStarIntensity = MaxStarIntensity * ComputeNightFactor(SunPitch);

    // skip-if-unchanged: 변화가 미미하면 머티리얼 파라미터 push 생략.
    if (FMath::IsNearlyEqual(TargetStarIntensity, LastStarIntensity, 0.001f)) { return; }

    UKismetMaterialLibrary::SetScalarParameterValue(World, StarCollection, StarIntensityParam, TargetStarIntensity);
    LastStarIntensity = TargetStarIntensity;
}
```

4절에서 깔아둔 복선이 여기서 회수됩니다 — 별이 `ApplyMoon`과 **똑같은 `ComputeNightFactor`** 를 쓰죠. 그래서 달과 별의 박명 페이드가 *반드시* 일치해요. 낮엔 강도 0이라 별이 완전히 사라지고, 노을이 지기 시작하면 달과 나란히 돋아 한밤에 만개합니다. 서브시스템도, 달빛 로직도 손대지 않고 *훅 하나만 얇게* 얹은 셈이에요.

---

## 7. 하늘이 검은 공이 됐다 — Opaque → Additive

여기까지 만들고 PIE를 켰더니 밤하늘에 별이 잘 떴습니다. 됐다 싶었죠. 그런데 **낮이 이상했어요** — 하늘도, 태양도, 대기도 사라지고 화면이 그냥 막막했습니다.

원인은 별 돔 머티리얼의 **Blend Mode가 Opaque**였던 것. 생각해보면 당연한 사고였어요. 반경 750m짜리 구를 카메라가 *안에서* 보고 있는데, 그 구가 불투명이면 — 별이 안 그려지는 픽셀은 그냥 **검은색**입니다. 즉 거대한 검은 공이 하늘·태양·SkyAtmosphere를 통째로 가린 거예요.

> **밤엔 왜 안 들켰나.** 이게 이 버그가 한동안 안 잡힌 이유입니다. 밤엔 그 검은 공이 *원래 검어야 할 밤하늘*과 구분이 안 됐고, 그 위에 별이 점등되니 오히려 그럴듯했어요. "밤하늘 잘 나오네" 하고 넘어간 거죠. 낮을 봤을 때야 비로소 "하늘이 통째로 없다"가 드러났습니다.

<!-- TODO: 스크린샷 — (좌) Opaque 검은 공이 낮 하늘 가린 상태 / (우) Additive 수정 후 낮 하늘 복구 비교 -->

해결은 한 줄 — **Blend Mode를 Opaque → Additive**로 바꾸는 것이었어요. Additive는 픽셀 색을 뒤 배경에 *더하기*만 합니다.

- **낮:** 별 × `StarIntensity`(=0) = 0. 0을 더하는 건 아무것도 안 하는 것 → 돔이 **완전히 투명**해져 하늘이 복구됩니다.
- **밤:** 별 × `StarIntensity`(>0) = 양수. 그만큼 배경(검은 밤하늘)에 가산되어 별이 빛나요.

5·6절에서 별 강도를 0~1로 곱해두고, 7절에서 블렌드를 가산으로 바꾸니 *낮의 0이 곧 투명*이 되는 — 두 결정이 맞물려 떨어졌습니다. Additive로 바꾼 뒤 밤 별이 좀 흐려져서 `MaxStarIntensity`로 가산 강도만 올려 마무리했어요.

---

## 8. 마치며 — 무대가 생겼다

이번 막간의 요약은 셋입니다.

1. **바닥은 경사가 정한다.** 흙/눈 두 PBR 표면을 하나의 가중치 `w`(경사 자동 마스크 + 수동 페인트)로 섞고, 마스크를 반전해 *평지=흙·봉우리=눈*으로 뒤집었다. 머티리얼 그래프 손작업이라 코드는 없지만, "한 가중치로 통합"이 핵심.
2. **해는 코사인으로 돈다.** 시간 소스는 한 줄도 안 건드리고, 진행률을 `90*cos`로 Pitch에 매핑해 태양을 회전. Pitch 부호가 낮/밤을 가르고, skip-if-unchanged로 정지 시각의 헛도는 갱신을 막았다.
3. **별은 직접 그려야 한다.** SkyAtmosphere가 못 그리니 카메라 추적·회전 고정·무충돌 돔에 절차적 별 머티리얼을 입히고, 달빛과 *같은* `ComputeNightFactor`로 강도를 묶어 박자를 맞췄다. 그리고 그 돔이 검은 공으로 하늘을 가린 Opaque 사고를 Additive로 풀었다 — 낮의 강도 0이 곧 투명.

12편까지가 격자 위 *시스템*이었다면, 이번 편은 그 격자가 올라앉을 *무대*였습니다. 이제 행성엔 눈 덮인 봉우리와, 도는 해와, 노을부터 돋는 별이 있어요. 공장은 비로소 *어딘가에* 서 있게 됐습니다.

막간은 여기까지. 다음 *생산* 편은 12편이 예고한 그대로 — 채굴기가 캐낸 원료가 **레시피를 따라 바뀌는** 자리, 제련과 가공의 계통(Phase 3.2)으로 돌아갑니다.

— JJ
