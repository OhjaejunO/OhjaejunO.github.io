---
title: "공장 시뮬레이션 게임 개발기 — 홀로그램 빌드업과 철거 디졸브: 사라지는 액터에게 연출을 맡기지 마라"
description: "배치 버튼을 누르면 건물이 그냥 '뿅' 나타났다. 홀로그램이 아래에서 위로 차오르며 실체화되는 빌드업을 만들었는데 — 실제 메시는 한 프레임도 안 건드리고, 복제한 프록시 메시에 코드로 생성한 홀로그램 머티리얼을 입혀 위에 덮는 구조다. 문제는 철거였다. 철거는 대상을 즉시 Destroy하는데, 연출 컴포넌트는 그 대상에 붙어 있다 — 재생할 시간이 없다. 연출만 들고 스스로 소멸하는 프록시 액터를 세우고, 설치와 철거가 MinZ/MaxZ 스왑 하나로 같은 코드를 타게 만든 기록. 그리고 생성자에서 MID를 만들면 안 되는 이유가 이웃 클래스에서 실증된 후일담까지."
date: 2026-07-07
category: UE5
series: factory-sim
seriesPart: 27
tags: [UE5, C++, 머티리얼, MID, 연출, 프록시]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — 건설/철거 연출**
> - 18편: [막간: 보이지 않으면 못 짓는다 (고스트 프리뷰·그리드 시각 위계)](/blog/factory-sim/18-ghost-preview-grid-visual)
> - 26편: [자기폭풍과 차폐장 — 남의 서브시스템과 경계를 긋는 법](/blog/factory-sim/26-magnetic-storm-shield)
> - **27편: 홀로그램 빌드업과 철거 디졸브 — 사라지는 액터에게 연출을 맡기지 마라** ← 현재 글

18편에서 배치 **전**의 시각화(고스트 프리뷰)를 다뤘다. 이번엔 배치 **확정 순간**이다. 버튼을 누르면 건물이 그냥 '뿅' 나타나는 게임과, 홀로그램이 아래에서 위로 차오르며 실체화되는 게임 — 시뮬레이션은 동일하지만 손맛이 다르다.

---

## 1. 설계 — 실제 메시는 한 프레임도 건드리지 않는다

빌드업 연출의 첫 결정이 이후 모든 것을 정했다. **실제 메시는 무수정, 100% 표시 상태 그대로 둔다.** 대신 소스 메시를 복제한 **프록시 메시**에 홀로그램 머티리얼을 입혀 위에 덮고, 연출이 끝나면 프록시만 제거한다.

실제 메시의 머티리얼을 바꿨다가 되돌리는 방식은 슬롯이 여러 개인 머신에서 원복 실수 한 번이면 사고가 되고, 연출 도중 게임플레이(콜리전·포트 판정)에 영향을 줄 여지도 있다. 프록시는 그 걱정이 없다 — 콜리전 없음, 그림자 없음, 끝나면 통째로 버린다.

구현체는 `UOJJ_HologramBuildUpComponent` 하나다. 머신과 Foundation은 상속 계보가 달라 공통 베이스가 없어서, 상속이 아니라 **컴포넌트**로 재사용했다. 핵심 진입점:

```cpp
    Proxy = NewObject<UStaticMeshComponent>(Owner);
    if (!Proxy) { return; }
    Proxy->SetStaticMesh(Source->GetStaticMesh());
    Proxy->SetWorldTransform(Source->GetComponentTransform());
    // z-fighting 방지: 실제보다 약간 크게 → 경계 위 영역이 실제 표면을 확실히 가린다.
    if (ProxyScaleMultiplier > 1.0f)
    {
        Proxy->SetWorldScale3D(Source->GetComponentTransform().GetScale3D() * ProxyScaleMultiplier);
    }
    Proxy->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Proxy->SetCastShadow(false);
    Proxy->RegisterComponent();

    const FBoxSphereBounds B = Source->Bounds;
    HologramMinZ = B.Origin.Z - B.BoxExtent.Z;
    HologramMaxZ = B.Origin.Z + B.BoxExtent.Z;

    MID = UMaterialInstanceDynamic::Create(HologramMaterial, this);
```

*(StartBuildUp 발췌 — 가드/ISM 분기 생략)*

프록시를 실제보다 1.02배 키우는 건 z-fighting 대책이다. 홀로그램 경계선 위(아직 실체화 안 된 영역)에서 프록시가 실제 표면을 확실히 가려야 하니까.

안전장치 두 개도 이 시점에 박았다. 홀로그램 머티리얼이 미지정이면 연출만 조용히 생략하고 배치는 정상 진행 — 에디터에서 머티리얼을 만들기 전에도 게임이 안 깨진다. 그리고 이 컴포넌트는 **신규 배치 경로에만** 붙는다. 세이브 로드가 이 경로를 타면 로드할 때마다 맵 전체가 일제히 홀로그램 쇼를 벌이게 된다.

---

## 2. 머티리얼 — 이번에도 코드로 굽는다

홀로그램 머티리얼도 22편 랜드스케이프, 26편 실드처럼 에디터 노드 작업이 아니라 **생성 코드**(`OJJ_HologramMaterialFactory`, 에디터 전용)로 만들었다. Translucent/Unlit/TwoSided에, 파라미터와 기본값은 생성 코드 원문 그대로:

```cpp
Progress   ->DefaultValue = 0.0f;                                  // 진행도 0→1
ScanlineWidth  ->DefaultValue = 0.04f;                             // 경계 글로우 폭
EmissiveBoost  ->DefaultValue = 8.0f;                              // 스캔라인 발광 배수
HologramColor  ->DefaultValue = FLinearColor(0.05f, 0.3f, 1.0f, 1.0f);   // 본체(시안/파랑)
ScanlineColor  ->DefaultValue = FLinearColor(0.91f, 0.565f, 0.165f, 1.0f); // 경계 스캔라인(주황)
HologramOpacity->DefaultValue = 0.5f;                             // 경계 위 반투명도
ScanDensity    ->DefaultValue = 30.0f;                            // 가로 주사선 밀도
// 머신(Z) 모드 전용:
MinZ ->DefaultValue = 0.0f;   MaxZ ->DefaultValue = 100.0f;      // MID가 런타임에 실제 바운드로 덮음
```

*(파라미터 선언부 발췌)*

동작 원리는 마스크 하나다. 픽셀의 월드 Z를 `MinZ~MaxZ`로 정규화한 값(`NormZ`)이 `Progress`보다 아래면 실체(프록시가 투명해져 실제 메시가 보임), 위면 홀로그램. 경계에는 `1 - abs(NormZ - Progress) / ScanlineWidth`로 글로우 라인이 서고, 주사선과 지지직 플리커가 홀로그램 질감을 얹는다.

<video autoplay muted loop playsinline src="/videos/blog/factory-sim/s11-hologram.mp4"></video>

이 Z 마스크는 곧바로 한계를 만났다 — **컨베이어는 가로로 길다.** 아래에서 위로 차오르면 전 구간이 동시에 켜진다. 그래서 마스크의 축을 파라미터로 뽑은 변형(`PathStart`/`PathDir`/`PathLength`에 대한 투영)을 추가해, 컨베이어와 파이프는 **시작점에서 끝점으로** 차오르게 했다. 정규화된 진행도에 경계 글로우를 세우는 뒷단은 두 모드가 공유한다.

사다리(ISM 다중 인스턴스)까지 확장하면서 함정도 하나 밟았다. 인스턴스 추가 직후의 컴포넌트 `Bounds`가 타이밍에 따라 적층 전체를 안 담아서 MinZ/MaxZ 범위가 무너지고, 연출이 차오름 없이 한꺼번에 점등됐다. 컴포넌트가 보고하는 Bounds 대신 **인스턴스들의 월드 AABB를 직접 누적**해서 바닥→꼭대기를 보장하는 것으로 해결.

---

## 3. 철거 — 연출의 주인이 사라진다

빌드업이 자리를 잡으니 당연한 요구가 온다. 철거도 역방향으로 — 위에서 아래로 디졸브되며 무너지게.

"같은 컴포넌트를 역재생하면 되겠네"라고 생각한 순간 구조적인 문제와 마주쳤다. **빌드업 컴포넌트는 대상 액터에 붙어 있다. 그런데 철거는 대상을 즉시 `Destroy()`한다.** 그리드 장부 해제와 액터 파괴는 본체 철거 로직의 소관이라 그대로 유지해야 한다(연출 때문에 철거를 1초 지연시키는 건 부기 정합성을 건드리는 일이다). 대상이 사라지면 붙어 있던 컴포넌트도 같이 사라진다 — 연출이 재생될 시간 자체가 없다.

그래서 연출의 주인을 바꿨다. **연출만 들고 스스로 소멸하는 프록시 액터** `AOJJ_DemolishEffectActor`:

```cpp
void AOJJ_DemolishEffectActor::StartBuildDown(UStaticMeshComponent* SourceMesh, UMaterialInterface* HologramMaterial, const FLinearColor& Color, float Duration)
{
    // 연출 불가(머티리얼/메시 무효)면 즉시 소멸 — 빈 프록시 잔존 방지.
    if (!SourceMesh || !HologramMaterial)
    {
        Destroy();
        return;
    }

    Effect = NewObject<UOJJ_HologramBuildUpComponent>(this);
    if (!Effect)
    {
        Destroy();
        return;
    }
    Effect->HologramMaterial = HologramMaterial;
    Effect->Duration = (Duration > 0.0f) ? Duration : 1.0f;
    Effect->bDissolveOut = true;           // 위→아래로 메시 소멸(Z 스왑 + Progress 0→1).
    Effect->bOverrideColor = true;         // 철거색(빨강 등).
    Effect->OverrideColor = Color;
    Effect->bDestroyOwnerOnFinish = true;  // 완료 시 이 프록시 액터 자체 소멸.
    Effect->RegisterComponent();
    Effect->StartBuildUp(SourceMesh);

    // 머티리얼/메시 무효 등으로 시작 못 했으면(틱 미가동 → 완료 콜백도 안 옴) 자체 소멸로 잔존 방지.
    if (!Effect->IsRunning())
    {
        Destroy();
    }
}
```

호출부는 철거 로직에 단 한 줄 끼어든다 — `Destroy()` **직전**에:

```cpp
if (TargetGrid->RemoveMachineAt(CursorCell))
{
    // [철거 빌드다운] Destroy '직전'에 메시(단일 SMC)를 독립 프록시로 복제해 역방향 디졸브(부기/Destroy 무수정).
    StartBuildDownEffect(Machine->GetMeshComponent());
    Machine->Destroy();
    bRemoved = true;
}
```

직전이어야 하는 이유는 단순하다 — 복제는 동기라서, 이 줄이 실행되는 시점엔 메시가 아직 유효하다. 다음 줄에서 원본은 사라지지만, 프록시는 이미 자기 메시를 들고 독립해 있다. 프록시는 그리드 장부에 등록되지 않으므로 셀을 점유하지 않는다 — 철거한 자리에 즉시 재배치해도 디졸브 중인 유령과 충돌하지 않는다.

가장 마음에 드는 부분은 **설치와 철거가 같은 코드라는 것**이다. 컴포넌트의 Tick은 방향을 모른다:

```cpp
    Elapsed += DeltaTime;
    // Progress 0→1 전진(빌드업/디졸브아웃 공용 — 방향 차이는 StartBuildUp의 Z 스왑으로 처리).
    const float P = FMath::Clamp(Duration > 0.0f ? Elapsed / Duration : 1.0f, 0.0f, 1.0f);
    if (MID)
    {
        MID->SetScalarParameterValue(TEXT("Progress"), P);
    }
    if (P >= 1.0f)
    {
        // 빌드업은 실제 메시만 100% 표시로 귀결, 빌드다운(독립 프록시)은 소유 액터까지 자체 소멸.
        const bool bDestroyOwner = bDestroyOwnerOnFinish;
        Finish();
        if (bDestroyOwner)
        {
            if (AActor* OwnerActor = GetOwner())
            {
                OwnerActor->Destroy();
            }
        }
    }
```

*(TickComponent 발췌)*

디졸브의 비밀은 시작 시점의 스칼라 두 개다 — `bDissolveOut`이면 MID에 **MinZ와 MaxZ를 서로 바꿔** 넣는다. 정규화가 뒤집히니(`normZ → 1-normZ`) 같은 Progress 전진이 위→아래 소멸이 된다. 머티리얼 무수정, 분기 무추가. 색만 오버라이드해서 설치는 시안, 철거는 빨간 면 + 흰 경계선. (여담으로, 파라미터 이름과 실제 역할이 어긋나 있어서 — PIE로 확인한 결과 면 색은 `HologramColor`가 아니라 `LineColor`가 지배했다. 코드로 머티리얼을 굽는 방식의 대가는 이런 이름-역할 검증을 눈으로 해야 한다는 것.)

이 구조의 보너스는 재사용이었다. 머신 레벨업 순간 같은 빌드업 연출을 다시 재생하는 기능이 **+29줄**로 끝났다 — 연출이 대상의 생명주기와 분리되어 있으니, 어디서든 컴포넌트를 붙여 틀면 된다.

---

## 4. 후일담 — 생성자에서 MID를 만들면 생기는 일

이 시스템의 MID는 전부 **런타임(`StartBuildUp`)에서만** 생성되고, 임시 프록시에만 물린다. 26편의 실드 돔 저장 버그에서 배운 그대로다.

그 규칙이 왜 중요한지는 최근에 이웃 클래스가 다시 실증했다. 컨베이어가 **생성자에서** MID를 만들어 `SetMaterial`까지 해 두고 있었는데, 이 MID가 CDO(Class Default Object)의 서브오브젝트로 박히면서 컴포넌트의 `OverrideMaterials` 직렬화를 타고 블루프린트 저장을 막았다("Illegal private reference"). 수정은 정석대로 — 생성자는 정적 베이스 머티리얼만 지정하고, MID 생성과 파라미터는 `BeginPlay`로 이동, 거기에 `RF_Transient`(직렬화 제외)까지 이중 안전장치.

같은 함정에 세 번째로 걸리지 않으려면 규칙으로 못 박는 수밖에 없다. **MID는 런타임 산물이다. 생성자와 OnConstruction에서 만들지 않는다.**

---

## 5. 정리 — 연출은 시뮬레이션의 손님이어야 한다

홀로그램 빌드업·철거 디졸브에서 한 것 —

- 실제 메시 무수정 — **프록시 메시 + 코드 생성 홀로그램 머티리얼**로 덮고, 끝나면 프록시만 제거
- Z 마스크(머신/Foundation) + 경로축 투영 마스크(컨베이어/파이프), ISM은 Bounds 대신 월드 AABB 직접 누적
- 철거는 대상 `Destroy()` 직전에 **자체소멸 프록시 액터**로 메시를 복제해 역방향 디졸브 — 부기/파괴 로직 무수정, 그리드 미등록이라 재배치 무간섭
- 설치=디졸브 동일 코드: 방향은 분기가 아니라 **MinZ/MaxZ 스왑**으로, Progress는 항상 0→1
- 레벨업 연출 재사용 +29줄, MID는 런타임 생성 원칙 재확인

교훈은 두 줄이다.

**연출은 시뮬레이션의 손님이어야 한다.** 배치·철거·장부 로직은 연출이 있든 없든 동일하게 돌고, 연출은 그 옆에서 프록시를 들고 왔다가 조용히 사라진다. 연출 때문에 본체의 생명주기를 비트는 순간(철거 지연, 저장되는 MID), 청구서는 반드시 시뮬레이션 쪽으로 날아온다.

**방향을 분기로 만들지 마라.** 빌드업과 디졸브를 별도 코드 경로로 짰다면 지금쯤 둘은 미묘하게 달라져 있을 것이다. "Progress는 항상 전진, 방향은 데이터(Z 스왑)가 정한다"로 두면 코드 경로가 하나라 부패할 자리가 없다 — 23편의 수식 항등과 같은 계열의 보험이다.

다음 편은 게임의 처음으로 돌아간다. AI로 만든 오프닝 영상 클립들이 어떻게 이어 붙어 인게임 각성 연출로 바통을 넘기는지 — 그리고 에디터에선 멀쩡하던 그 영상이 패키징 빌드에서 검은 화면이 된 이야기.

---

*이 글은 factory-space(UE5.7, C++) 홀로그램 빌드업·철거 디졸브 작업(2026-06-28~07-02, PR #418·#420·#470·#482)을 정리한 것입니다. 코드 스니펫은 실제 구현에서 발췌했으며, 가독성을 위해 일부 축약했습니다.*
