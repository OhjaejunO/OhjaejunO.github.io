# 27편 소스 수집 — 홀로그램 빌드업 · 철거 디졸브

수집 대상 저장소: `C:\Users\user\Desktop\factory-space` (원격 `PU3-Lab/factory-space`)
C++ 소스: `frontend/Source/Wanted_Factory/` (`Public/` 헤더, `Private/` 구현)

---

## ⚠️ 블로그 게재 시 일반화 필요 항목

게재 **불가**(프로젝트 식별자) — 일반화하거나 생략할 것:
- **모듈/네임스페이스 매크로 `WANTED_FACTORY_API`** — 클래스 선언 앞에 붙는 DLL export 매크로. 블로그에는 지우거나 `MYGAME_API` 등으로 치환.
- **모듈명 `Wanted_Factory`** — 경로 `frontend/Source/Wanted_Factory/...`, `Wanted_Factory.Build.cs`, `Wanted_FactoryEditor` 빌드 타겟명. 경로는 `Source/<Module>/...` 식으로 일반화.
- **에셋 클래스 `BP_Conveyor`** (프로젝트 고유 BP명) — 필요하면 "컨베이어 블루프린트" 정도로.
- PR 본문의 협업자 실명(**Chan**) — 게재 시 생략 권장.

게재 **가능**(1~3편에서 이미 공개, 프로젝트명 아님):
- `AOJJ_*` 클래스 접두사 (`UOJJ_HologramBuildUpComponent`, `AOJJ_DemolishEffectActor`, `AOJJ_BuildController` 등)
- 에셋 경로 `/Game/OJJ/Materials/M_Hologram_BuildUp` 등
- 머티리얼/파라미터 이름 (`Progress`, `MinZ`, `MaxZ`, `LineColor`, `ScanlineColor` 등)

---

## 시간순 사건 정리 (문제 → 시도 → 해결)

이 주제는 커밋 6개, 머지 PR 3개(#418, #420, #470)에 걸쳐 있다. 저자 기여는 `PU3-Lab/OJJ` 브랜치에서 머지됨.

### 사건 1 — 설치 빌드업의 탄생 (아래→위 차오름)
- **커밋 `a89a56d`** · 2026-06-28 00:29 · PR **#418** (`M_Hologram_BuildUp`)
- 커밋 메시지: "feat(build): 건물 배치 홀로그램 빌드업 효과 (아래서위 차오름 + 주사선 + 반투명)"
- 핵심 설계 결정:
  1. **실제 메시는 무수정·100% 표시.** 별도로 소스 메시를 복제한 **프록시** 메시에 `M_Hologram_BuildUp`(Translucent/Unlit)을 입혀 그 위에 덮는다. `Progress 0→1` 후 프록시만 제거하면 실제 메시가 남는다.
  2. **머신·파운데이션 공용 동적 컴포넌트**(`UOJJ_HologramBuildUpComponent`). 둘 다 `AActor` 직속이라 공통 베이스가 없어서 상속이 아니라 컴포넌트로 재사용.
  3. 머티리얼을 **에디터 수작업 노드가 아니라 코드로 생성**(`OJJ_HologramMaterialFactory`, `#if WITH_EDITOR`). `UMaterialEditingLibrary`로 노드 그래프를 프로그래매틱하게 조립.
  4. **신규 배치 전용.** 로드 경로(`FactorySaveSubsystem`)는 이 컴포넌트를 안 거침 → 세이브 로드 시 맵 전체가 디졸브되는 사고 방지.
  5. 안전장치: `HologramMaterial` 미지정이면 `StartBuildUp`이 무동작(배치는 정상). 에디터에서 머티리얼 제작 전에도 게임이 안 깨짐.
- 규모: 9파일, +541 −0.

### 사건 2 — 컨베이어/파이프로 확장 (경로축 마스크 + 프록시 ISM)
- **커밋 `596b63a`** · 2026-06-28 01:12 · PR **#420**
- 메시지: "feat(build): 컨베이어/파이프 홀로그램 빌드업 (시작→끝 차오름, 프록시 ISM)"
- 세로(Z) 마스크로는 가로로 긴 컨베이어가 표현이 안 됨 → 머티리얼에 **경로축 투영 마스크**(`M_Hologram_BuildUp_Path`, `PathStart`/`PathDir`/`PathLength`) 모드를 추가. 별도 컴포넌트 `OJJ_HologramPathBuildUpComponent`가 ISM 기반으로 시작→끝 차오름.

### 사건 3 — 사다리(ISM) 빌드업 + 단일메시/ISM 공용화
- PR **#470** 안에 포함(사건 5의 머지에 묶임). `UOJJ_HologramBuildUpComponent`에 **ISM 분기**를 추가해 사다리처럼 여러 칸 적층된 인스턴스도 프록시 ISM으로 복제.
- 이때 발견한 함정: ISM의 component `Bounds`가 인스턴스 추가 직후 타이밍에 따라 적층 전체를 안 담아 **MinZ/MaxZ 범위가 붕괴 → 한꺼번에 점등**. 해결: `Bounds` 대신 인스턴스 **월드 AABB를 직접 누적** 계산(바닥→꼭대기 보장). 코드 조각 B의 ISM 경로 참고.

### 사건 4 — 철거 디졸브: "원본 액터가 즉시 Destroy되는 문제"와 프록시 액터 해법 ★ 서사 핵심
- **커밋 `6de3e83`** · 2026-07-01 00:30 · PR **#470** (제목: "캐릭터 스왑 콘솔 명령 + 사다리 프리뷰/빌드업 + 철거 디졸브 효과")
- 메시지: "feat: 머신/Foundation 철거 빌드다운 디졸브 효과 추가"
- **문제:** 빌드업 컴포넌트는 대상 액터에 **붙어 있다**. 철거는 대상 액터를 즉시 `Destroy()`한다(그리드 부기/장부 해제는 본체 로직 그대로 유지해야 함). 컴포넌트를 그냥 재사용하면 대상이 사라지는 순간 컴포넌트도 같이 사라져 **연출이 재생될 시간이 없다.**
- **해법:** 연출만 **독립 자체소멸 프록시 액터** `AOJJ_DemolishEffectActor`로 분리. 철거 시:
  1. 대상 `Destroy()` **'직전'** 에 대상 메시(단일 SMC/ISM)를 프록시 액터로 **동기 복제**.
  2. 프록시가 빌드업 컴포넌트를 역방향(`bDissolveOut=true`)으로 재생.
  3. 완료 시 `bDestroyOwnerOnFinish=true`로 프록시가 **자신을 Destroy**.
  - 프록시는 **그리드 장부에 미등록**(연출 전용 — 점유 안 함, 재배치 영향 0). 머티리얼/메시 무효면 즉시 self-Destroy(잔존 0).
- **컴포넌트 공용화(설치=디졸브 동일 코드, 값만 다름):**
  - `bDissolveOut`: MinZ↔MaxZ **스왑**으로 Z 정규화를 뒤집어(normZ → 1-normZ) 위→아래 소멸. 머티리얼 무수정, 스칼라 값만 반전.
  - `bOverrideColor`/`OverrideColor`: `LineColor`(면)=빨강, `ScanlineColor`(선)=흰색으로 덮음. 기본(설치)은 오버라이드 없이 머티리얼 기본 시안 유지.
  - `Progress`는 설치·디졸브 **둘 다 0→1 전진** — 방향 차이는 오직 Z 스왑으로 결정.
- 규모: 6파일, +184 −5.
- **PIE 진단 기록**(코드 주석에 남음): 파라미터 이름/역할이 반대라 처음엔 `HologramColor`가 면인 줄 알았으나, PIE 확인 결과 **면=`LineColor`, 선=`ScanlineColor`**. `HologramColor`/`BackColor`는 면/선에 안 나타나 set 생략.

### 사건 5 — PR #470 머지 (세 기능 묶음)
- **머지 커밋 `6a021ba`** · PR #470. OJJ 브랜치 누적 3종을 main에 반영: ① 콘솔 `SetCharacter`, ② 사다리 고스트 프리뷰+빌드업, ③ 철거 디졸브. 검증: `Wanted_FactoryEditor Win64 Development` 빌드 성공 + PIE 확인(철거 디졸브 빨강 면+흰 선, 위→아래 / 설치 빌드업 시안 회귀 없음).

### 사건 6 — 레벨업 연출 재사용
- **커밋 `9ab779b`** · 2026-07-02 03:19 · PR **#482** ("feat: 레벨업 시 머신 빌드업 홀로그램 연출 재생")
- `OJJ_Player.cpp`에만 +29줄. 같은 빌드업 컴포넌트를 레벨업 순간 머신에 다시 붙여 재생 — 연출 시스템의 재사용성 입증.

### 사건 7 — (관련) Conveyor 생성자 MID CDO 오염 수정
- **커밋 `a55d268`** · 2026-07-06 19:19
- 이 27편 주제와 **직접 클래스는 다르지만 "MID 사용 방식"의 교훈으로 연결**됨. 이 시리즈 전체가 MID(`UMaterialInstanceDynamic`)를 프록시/런타임 연출에 쓰는데, **생성자에서 MID를 만들면 안 된다**는 규칙을 정면으로 다룬 커밋.
- **문제:** 생성자에서 `UMaterialInstanceDynamic::Create` + `SetMaterial` 하면 MID가 **CDO(Class Default Object) 서브오브젝트로 박혀** 컴포넌트 `OverrideMaterials` 직렬화를 타고 `BP_Conveyor` 저장을 막음("Illegal private reference").
- **해법:** 생성자는 **정적 베이스 머티리얼만** 지정. MID 생성+파라미터는 `BeginPlay`(런타임 전용)로 이동 + `RF_Transient`(직렬화 제외 이중 안전장치). lazy-create 경로엔 `HasActorBegunPlay()` 가드.
- **홀로그램 코드와의 대비 포인트(블로그 각주로 좋음):** `UOJJ_HologramBuildUpComponent`의 MID는 **런타임 `StartBuildUp`에서만** 생성(`UMaterialInstanceDynamic::Create(HologramMaterial, this)`)하고 프록시는 `RF_Transient`한 임시 컴포넌트라 CDO 오염 문제가 애초에 없음 — 즉 홀로그램 시스템은 이 함정을 우회한 설계였고, Conveyor는 생성자 MID라 걸렸다.

---

## 코드 조각 (실제 소스 원문 — 재구성 금지)

### 조각 A — 설치/디졸브 공용 진입점: 프록시 생성 + MID 파라미터 주입
`frontend/Source/Wanted_Factory/Private/OJJ_HologramBuildUpComponent.cpp` (StartBuildUp 단일메시 경로 + MID 주입, 일부 생략: ISM 분기는 조각 B)

```cpp
void UOJJ_HologramBuildUpComponent::StartBuildUp(UStaticMeshComponent* Source)
{
    // 머티리얼 미지정(에디터 제작 전) → 효과 skip. 배치 자체는 정상.
    if (!HologramMaterial) { /* ...log... */ return; }
    if (!Source || !Source->GetStaticMesh()) { return; }
    AActor* Owner = GetOwner();
    if (!Owner) { return; }

    // 재진입(연속 배치 등) 안전 — 이전 프록시 정리.
    Finish();

    float HologramMinZ = 0.0f;
    float HologramMaxZ = 0.0f;

    // (... ISM 분기 생략 — 조각 B ...) 단일메시 경로(머신/Foundation):
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
    if (MID)
    {
        const int32 NumMats = Proxy->GetNumMaterials();
        for (int32 i = 0; i < NumMats; ++i)
        {
            Proxy->SetMaterial(i, MID);
        }
        // 디졸브아웃이면 Min↔Max를 스왑해 정규화를 뒤집는다(normZ → 1-normZ) → 위→아래 소멸.
        if (bDissolveOut)
        {
            MID->SetScalarParameterValue(TEXT("MinZ"), HologramMaxZ);
            MID->SetScalarParameterValue(TEXT("MaxZ"), HologramMinZ);
        }
        else
        {
            MID->SetScalarParameterValue(TEXT("MinZ"), HologramMinZ);
            MID->SetScalarParameterValue(TEXT("MaxZ"), HologramMaxZ);
        }
        // [철거] 면=LineColor, 선(스캔라인)=ScanlineColor. 철거 디졸브 = 빨강 면 + 흰 선.
        if (bOverrideColor)
        {
            MID->SetVectorParameterValue(TEXT("LineColor"), OverrideColor);                    // 면 = 빨강
            MID->SetVectorParameterValue(TEXT("ScanlineColor"), FLinearColor(1.0f, 1.0f, 1.0f)); // 선 = 흰색
        }
        MID->SetScalarParameterValue(TEXT("Progress"), 0.0f);
    }

    Elapsed = 0.0f;
    bRunning = true;
    SetComponentTickEnabled(true);
}
```

### 조각 B — Tick의 Progress 전진 + 완료 시 소유 액터 자체소멸
`frontend/Source/Wanted_Factory/Private/OJJ_HologramBuildUpComponent.cpp` (TickComponent 전문)

```cpp
void UOJJ_HologramBuildUpComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    if (!bRunning) { return; }

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
}
```

### 조각 C — 프록시 액터: "즉시 Destroy 문제"의 해법 (전문)
`frontend/Source/Wanted_Factory/Private/OJJ_DemolishEffectActor.cpp` (StartBuildDown 전문 — 재구성 없음)

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

### 조각 D — 호출부: 철거 시 Destroy '직전'에 프록시 스폰
`frontend/Source/Wanted_Factory/Private/OJJ_BuildController.cpp`

머신 철거 분기(약 L1078–1083):
```cpp
if (TargetGrid->RemoveMachineAt(CursorCell))
{
    // [철거 빌드다운] Destroy '직전'에 메시(단일 SMC)를 독립 프록시로 복제해 역방향 디졸브(부기/Destroy 무수정).
    StartBuildDownEffect(Machine->GetMeshComponent());
    Machine->Destroy();
    bRemoved = true;
}
```

Foundation 철거 분기(약 L1118–1122):
```cpp
TargetGrid->OJJ_DestroyLaddersOnFoundation(Foundation);
// [철거 빌드다운] Destroy '직전'에 슬래브 메시(단일 SMC)를 독립 프록시로 복제해 역방향 디졸브(부기/Destroy 무수정).
StartBuildDownEffect(Foundation->GetSlabMesh());
Foundation->Destroy();
bRemoved = true;
```

`StartBuildDownEffect` 본체(약 L1545–1576, 일부 생략):
```cpp
void AOJJ_BuildController::StartBuildDownEffect(UStaticMeshComponent* Mesh)
{
    if (!Mesh) { return; }
    // (... 사운드/World 획득 생략 ...)
    const FTransform SpawnXf = Mesh->GetComponentTransform();
    AOJJ_DemolishEffectActor* Fx = World->SpawnActor<AOJJ_DemolishEffectActor>(
        AOJJ_DemolishEffectActor::StaticClass(), SpawnXf);
    if (Fx)
    {
        // Mesh를 동기 복제(대상 Destroy 직전 호출이라 메시/인스턴스 유효). 시작 못 하면 프록시가 자체 소멸.
        Fx->StartBuildDown(Mesh, HologramBuildUpMaterial, BuildDownColor, BuildDownDuration);
    }
}
```

### 조각 E — 머티리얼 파라미터 설계 (코드 생성 팩토리)
`frontend/Source/Wanted_Factory/Private/OJJ_HologramMaterialFactory.cpp` (파라미터 선언부 + 마스크 로직, 일부 생략)

블렌드/셰이딩 설정:
```cpp
Mat->BlendMode = BLEND_Translucent;
Mat->SetShadingModel(MSM_Unlit);
Mat->TwoSided = true;
```

공통 스칼라/벡터 파라미터와 **기본값**(원문 그대로):
```cpp
Progress   ->DefaultValue = 0.0f;                                  // 진행도 0→1
ScanlineWidth  ->DefaultValue = 0.04f;                             // 경계 글로우 폭
EmissiveBoost  ->DefaultValue = 8.0f;                              // 스캔라인 발광 배수
HologramColor  ->DefaultValue = FLinearColor(0.05f, 0.3f, 1.0f, 1.0f);   // 본체(시안/파랑)
ScanlineColor  ->DefaultValue = FLinearColor(0.91f, 0.565f, 0.165f, 1.0f); // 경계 스캔라인(주황)
HologramOpacity->DefaultValue = 0.5f;                             // 경계 위 반투명도
ScanDensity    ->DefaultValue = 30.0f;                            // 가로 주사선 밀도
ScanSpeed      ->DefaultValue = 1.0f;                             // 주사선 흐름 속도
ScanIntensity  ->DefaultValue = 0.6f;                            // 주사선 대비
ScanFlicker    ->DefaultValue = 0.25f;                           // 지지직 진폭
// 머신(Z) 모드 전용:
MinZ ->DefaultValue = 0.0f;   MaxZ ->DefaultValue = 100.0f;      // MID가 런타임에 실제 바운드로 덮음
// 경로(컨베이어/파이프) 모드 전용:
PathStart(0,0,0,0) / PathDir(1,0,0,0) / PathLength = 100.0f;
```

마스크 핵심 수식(주석 원문):
- 머신 Z 마스크: `NormZ = saturate((WorldPos.Z - MinZ)/(MaxZ - MinZ))`, StripeCoord = 월드 Z(세로 줄무늬)
- 경로 마스크: `NormP = saturate(dot(WorldPos - PathStart, PathDir)/PathLength)`, StripeCoord = 진행도
- 경계 글로우: `ScanGlow = saturate(1 - abs(Norm - Progress)/ScanlineWidth)`
- 가로 주사선: `frac(StripeCoord*ScanDensity - Time*ScanSpeed)`
- 지지직: `FlickerFactor = 1 + ScanFlicker*(sin(17t)*sin(5.3t))`
- Opacity: `saturate(saturate((Norm-Progress)*100)*HologramOpacity + ScanGlow)`

> 주의: `MinZ`/`MaxZ` 기본값(0/100)은 팩토리가 심어둔 자리표시자일 뿐, 실제 값은 `StartBuildUp`이 소스 메시 월드 바운드로 MID에 덮어씀(조각 A). 그래서 철거 디졸브는 머티리얼을 안 건드리고 **런타임 스칼라 스왑만으로** 방향을 뒤집는다.

---

## 수치/기본값 원문 요약

| 항목 | 값 | 출처 |
|------|-----|------|
| 설치 빌드업 지속 | `HologramBuildUpDuration = 1.0f` (초) | `OJJ_BuildController.h` L360 |
| 철거 디졸브 지속 | `BuildDownDuration = 1.0f` (초) | `OJJ_BuildController.h` L368 |
| 철거 디졸브 색 | `BuildDownColor = (1,0,0)` 빨강 | `OJJ_BuildController.h` L364 |
| 컴포넌트 Duration 기본 | `Duration = 1.0f` | `OJJ_HologramBuildUpComponent.h` L49 |
| 프록시 스케일 배수 | `ProxyScaleMultiplier = 1.02f` | `OJJ_HologramBuildUpComponent.h` L53 |
| OverrideColor 기본 | `(1,0,0)` 빨강 | `OJJ_HologramBuildUpComponent.h` L67 |
| 컴포넌트 틱 | 평상시 off, `StartBuildUp`에서 on, 완료 시 off (0비용) | `.cpp` L14–15, 158, 200 |
| 본체색 기본 | 시안/파랑 `(0.05, 0.3, 1.0)` | `OJJ_HologramMaterialFactory.cpp` L83 |
| 스캔라인색 기본 | 주황 `(0.91, 0.565, 0.165)` | `OJJ_HologramMaterialFactory.cpp` L85 |

---

## 보고 요약

- **찾은 커밋**: 관련 6개 + 머지 3개.
  - `a89a56d`(06-28) 설치 빌드업 최초 — PR #418
  - `596b63a`(06-28) 컨베이어/파이프 경로 빌드업 — PR #420
  - `6de3e83`(07-01) **철거 디졸브(핵심)** — PR #470
  - `9ab779b`(07-02) 레벨업 연출 재사용 — PR #482
  - `26da4bd`(07-06) 건설/철거/컨베이어/레벨업 사운드
  - `a55d268`(07-06) Conveyor 생성자 MID CDO 오염 수정 (MID 사용 방식 교훈)
- **핵심 해시**: `6de3e83`(디졸브 프록시), `a89a56d`(빌드업 원형), `a55d268`(MID CDO).
- **이슈/PR**: PR #418, #420, #470, #482 (모두 이슈 아님 = PR). 별도 이슈 트래커 번호는 확인 안 함.
- **핵심 클래스 파일**:
  - `Public/OJJ_HologramBuildUpComponent.h` / `Private/OJJ_HologramBuildUpComponent.cpp`
  - `Public/OJJ_DemolishEffectActor.h` / `Private/OJJ_DemolishEffectActor.cpp`
  - `Private/OJJ_HologramMaterialFactory.cpp`
  - `Private/OJJ_BuildController.cpp` (호출부)
- **못 찾은/미확인 항목**:
  - `M_Hologram_BuildUp.uasset`은 바이너리 에셋이라 파라미터 그래프 자체는 못 읽음 — 대신 이 머티리얼을 **생성한 코드**(`OJJ_HologramMaterialFactory.cpp`)로 전 파라미터·수식을 원문 확보(조각 E).
  - 별도 GitHub **이슈** 번호(PR 아닌)는 검색하지 않음. `#3`/`#184`는 코드 주석 내 기능 태그로만 등장(이슈 본문 미확인).
