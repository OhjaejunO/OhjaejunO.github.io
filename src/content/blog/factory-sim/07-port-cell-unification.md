---
title: "공장 시뮬레이션 게임 개발기 Phase 2.2 — 포트 셀 일원화: 화살표·도킹·그래프를 하나의 진실로"
description: "머신의 입력·출력 포트가 화살표 표시·컨베이어 도킹 판정·출력 타깃 그래프 세 군데서 따로 계산되던 걸, OJJ_PortCellsFromFootprint 헬퍼 하나로 모은 기록. '보이는 화살표 = 붙는 컨베이어'를 코드로 보장하고, 포트 수가 면보다 적을 때 중심축 대칭으로 배치하는 규칙까지."
date: 2026-06-08
category: UE5
series: factory-sim
seriesPart: 7
tags: [UE5, C++, 그리드, 포트, 단일진실원, 리팩터링]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 2: 머신 시스템**
> - 6편: [AI 생성 3D 에셋 파이프라인](/blog/factory-sim/06-meshy-glb-asset-pipeline)
> - **7편: 포트 셀 일원화 — 화살표·도킹·그래프를 하나의 진실로** ← 현재 글
> - (이어지는 편: 머신 동작 / 컨베이어 연결 — 예정)
>
> *Phase 1 — 그리드 시스템: [1편](/blog/factory-sim/01-grid-system-overview) · [2편](/blog/factory-sim/02-grid-data-structure-and-transaction) · [3편](/blog/factory-sim/03-material-grid-visualization) · [4편](/blog/factory-sim/04-mouse-input-build-controller) · [5편](/blog/factory-sim/05-codex-adversarial-review)*

## 1. 들어가며 — 머신을 "연결"하려면 먼저 포트가 필요하다

[6편](/blog/factory-sim/06-meshy-glb-asset-pipeline)에서 머신이 *생긴 것*을 갖췄습니다. 빈 큐브 대신 실제 설비처럼 보이게 됐죠. 이제 다음 단계는 그 머신들을 **서로 연결**하는 겁니다. 채굴기에서 캔 광석이 컨베이어를 타고 제련기로 들어가고, 제련된 결과물이 다시 다음 머신으로 — 자동화 시뮬레이션 장르의 핵심이 바로 이 "흐름"이에요.

흐름이 생기려면 머신마다 **포트(port)** 가 있어야 합니다. 어느 칸으로 자원이 들어오고(입력), 어느 칸으로 나가는지(출력). 컨베이어는 그 포트 셀에 닿아야 도킹되고, 빌드 모드에선 그 포트를 화살표로 보여줘야 플레이어가 "여기에 붙이면 되는구나"를 압니다.

그런데 이번 편은 포트를 *새로 만든* 이야기가 아니에요. 포트라는 개념은 이미 있었습니다. 문제는 **그 포트 셀이 코드 여러 군데서 따로 계산되고 있었다**는 거예요. 화살표를 그리는 코드가 계산하는 포트 셀과, 컨베이어 도킹을 허용하는 코드가 계산하는 포트 셀이 *각자* 였습니다. 둘이 어긋나면 어떻게 될까요 — **화살표는 "여기 포트야"라고 가리키는데, 막상 컨베이어를 붙이면 거부**되는 거죠. 화살표가 거짓말을 하는 겁니다.

이 글은 그 따로 노는 포트 계산을 **단 하나의 함수로 모은** 기록입니다. `AOJJ_Grid::OJJ_PortCellsFromFootprint` 하나로요. 그리고 그 김에, "포트 수가 면 길이보다 적을 때 포트를 어디에 둘 것인가"라는 배치 규칙까지 그 함수 안에 넣었습니다.

---

## 2. 포트 셀이란 — footprint 모서리의 바깥 이웃

먼저 용어를 그림으로 잡고 갑니다. 머신은 그리드 위에서 여러 셀을 차지해요([2편](/blog/factory-sim/02-grid-data-structure-and-transaction)의 footprint). 머신에는 **앞면(Front)** 방향이 액터 회전(yaw)으로 정해져 있고, 컨벤션은 이렇습니다.

- **입력(Input)** = 앞면 방향(`+Front`)
- **출력(Output)** = 뒷면 방향(`-Front`)

"포트 셀"은 머신이 차지한 셀이 아니라, 그 **모서리에 맞닿은 바깥 셀**입니다. 예를 들어 2×2 머신의 출력이 오른쪽을 향한다면, 오른쪽 모서리 두 칸의 *바깥* 두 칸이 출력 포트 셀이 돼요.

```
  ┌─────┬─────┐
  │  M  │  M  │ →  [출력 포트 셀]
  ├─────┼─────┤
  │  M  │  M  │ →  [출력 포트 셀]
  └─────┴─────┘
   (머신 footprint)      (모서리 바깥 이웃)
```

규칙을 한 문장으로 적으면: **footprint 셀 `C` 중 `C + Dir`이 footprint 밖이면, 그 이웃 `C + Dir`이 포트 셀이다.** 방향 `Dir`만 바꾸면 입력이든 출력이든 같은 규칙으로 떨어집니다. 이게 다음 절의 함수가 하는 일이에요.

---

## 3. 문제 — 같은 포트를 세 군데서 따로 계산하면

포트 셀을 *쓰는* 곳은 셋이었습니다.

1. **화살표 표시** — 빌드 모드에서 머신마다 입력/출력 포트를 화살표로 그린다.
2. **컨베이어 도킹 판정** — 컨베이어 끝이 머신의 포트 셀에 닿았는지 검사해 연결을 허용/거부한다.
3. **출력 타깃 그래프** — 머신의 출력 포트 셀에 다른 머신이 있으면 "다운스트림 연결 후보"로 잡는다.

실제로 이 셋은 한동안 각자 "모서리 바깥 이웃"을 따로 계산하고 있었습니다. 그러다 머신을 90° 돌렸을 때 화살표가 뜬 셀과 컨베이어가 도킹되는 셀이 어긋나는 걸 만났어요 — 세 곳의 회전 처리가 미세하게 달랐던 거죠. 그래서 셋을 한 함수로 합쳤습니다.

이게 왜 최악이냐면, **눈에 보이는 안내(화살표)와 실제 규칙(도킹)이 다르면** 게임이 거짓말을 하는 걸로 느껴지거든요. "분명 화살표 있는 데다 붙였는데 왜 연결이 안 되지?"

그래서 목표는 단순합니다 — **세 경로가 글자 그대로 같은 함수를 호출하게 만든다.** 그러면 셀 집합이 *정의상* 일치합니다. 어긋날 수가 없어요.

---

## 4. 해결 — `OJJ_PortCellsFromFootprint` 하나로

핵심은 `AOJJ_Grid`의 static 헬퍼 하나입니다. footprint 셀 목록과 방향, 포트 수를 받아 포트 셀 배열을 돌려줘요. 먼저 헤더의 계약(주석)부터 보면 의도가 분명합니다.

```cpp
// footprint 셀 집합에서 Dir 쪽 모서리 이웃(포트 셀)을 산출 + PortCount 대칭 배치 규칙 적용.
// 화살표·컨베이어 도킹 판정·머신 출력 타깃 그래프가 모두 이 함수를 경유 → 셀 집합 완전 일치(단일 진실원).
//  - PortCount<=0 또는 >=면길이 → 전부 (현행 동일, 리그레션 0)
//  - PortCount==1 → 면 중앙(홀수 면만), 짝수 면이면 대칭 불가
//  - PortCount>=2 → 양끝 포함 중심축 대칭 균등 분산
//  - 대칭 불가 조합(짝수면 1포트 등) → (면길이,포트수)당 경고 1회 + 전부 반환 폴백(크래시/임의 배치 금지)
// 면 축(Dir 수직)으로 정렬 후 선택하므로 회전 시 footprint/forward가 함께 돌아 상대 위치 유지.
static TArray<FIntPoint> OJJ_PortCellsFromFootprint(const TArray<FIntPoint>& Cells, FIntPoint Dir, int32 PortCount);
```

구현의 첫 단계 — **모서리 워크**. 2절에서 말한 그 규칙 그대로입니다.

```cpp
TArray<FIntPoint> AOJJ_Grid::OJJ_PortCellsFromFootprint(const TArray<FIntPoint>& Cells, FIntPoint Dir, int32 PortCount)
{
    TArray<FIntPoint> AllPortCells;

    if (Cells.Num() == 0 || Dir == FIntPoint::ZeroValue)
    {
        return AllPortCells;
    }

    // 1) Dir쪽 모서리 포트 셀 전부 수집: footprint 셀 C 중 (C + Dir)이 footprint 밖이면 그 이웃(C+Dir)이 포트 셀.
    const TSet<FIntPoint> Footprint(Cells);
    for (const FIntPoint& Cell : Cells)
    {
        const FIntPoint Target = Cell + Dir;
        if (!Footprint.Contains(Target))
        {
            AllPortCells.AddUnique(Target);
        }
    }
    // ... (이어서 포트 수 대칭 배치 — 5절)
```

`Dir == (0,0)`(무효 머신)이거나 footprint가 비면 빈 배열. 그 외엔 모서리 바깥 이웃을 전부 모읍니다. **여기까지가 "포트 셀 후보 전부"** 예요. 포트가 면 길이만큼 많거나(전 칸이 포트) 포트 수가 설정 안 됐으면 이걸 그대로 쓰면 됩니다 — 그게 다음 절의 분기입니다.

---

## 5. 포트 수가 면보다 적으면 — 중심축 대칭 배치

머신이 항상 모서리 *전체*를 포트로 쓰는 건 아니에요. 3칸짜리 면에 출력 포트가 1개뿐일 수도 있죠. 그러면 그 1개를 어디에 둘까요? 아무 데나 두면 회전했을 때 위치가 튀고, 좌우 비대칭이면 보기에도 어색합니다. 그래서 **중심축 대칭 균등 분산** 규칙을 넣었습니다.

```cpp
    const int32 L = AllPortCells.Num();

    // 2) 포트 카운트 미설정(0)/면길이 이상 → 전부 (현행 동일, 리그레션 0).
    if (PortCount <= 0 || PortCount >= L)
    {
        return AllPortCells;
    }

    // 3) 면 축(Dir에 수직)으로 정렬 — 대칭 선택을 위한 결정적 순서.
    //    Dir이 X축이면 면은 Y로 변함(키=Y), 아니면 키=X.
    const bool bDirAlongX = (Dir.X != 0);
    AllPortCells.Sort([bDirAlongX](const FIntPoint& A, const FIntPoint& B)
    {
        return bDirAlongX ? (A.Y < B.Y) : (A.X < B.X);
    });

    // 4) 중심축 대칭 균등 분산으로 K개 인덱스 선택.
    TArray<int32> Indices;
    if (PortCount == 1)
    {
        // 단일 포트는 홀수 면에서만 정중앙 가능. 짝수 면이면 대칭 불가 → 아래 검증에서 폴백.
        if ((L % 2) == 1)
        {
            Indices.Add((L - 1) / 2);
        }
    }
    else
    {
        // 양끝(0, L-1) 포함 균등 분산. idx_j = round(j*(L-1)/(K-1)).
        for (int32 j = 0; j < PortCount; ++j)
        {
            const int32 Idx = FMath::RoundToInt(static_cast<float>(j) * (L - 1) / (PortCount - 1));
            Indices.AddUnique(Idx);
        }
    }
```

읽는 순서대로 짚으면:

- **`PortCount <= 0` 또는 `>= L` 이면 전부 반환.** 이게 무회귀의 핵심이에요. 포트 시스템을 도입하기 전 동작(= 모서리 전 칸이 포트)이 이 분기로 그대로 보존됩니다. 포트 수를 안 정한 머신은 예전과 똑같이 굴러가요.
- **면 축으로 정렬.** 포트를 고르려면 "순서"가 있어야 하는데, `Dir`이 X축이면 면은 Y방향으로 늘어서니 Y로 정렬하고, 아니면 X로 정렬합니다. 이 정렬이 **결정적(deterministic)** 이라 같은 입력엔 항상 같은 선택이 나와요.
- **포트 1개 → 정중앙.** 단, 면 길이가 홀수일 때만 정중앙이 존재합니다. 짝수 면(예: 2칸)에선 정중앙 셀이 없어 대칭이 불가능 — 이건 아래 검증에서 걸러집니다.
- **포트 2개 이상 → 양끝 포함 균등 분산.** `round(j·(L-1)/(K-1))` 공식으로, 첫 포트는 0(맨 끝), 마지막 포트는 L-1(반대 끝), 나머지는 그 사이에 고르게. 3칸 면에 2포트면 양끝(0, 2), 5칸 면에 3포트면 (0, 2, 4)처럼요.

그리고 **검증**. 위 선택이 정말 대칭인지 확인하고, 아니면 안전하게 폴백합니다.

```cpp
    // 5) 검증: 정확히 K개 + 중심축(L-1) 대칭이어야 채택.
    bool bValid = (Indices.Num() == PortCount);
    if (bValid)
    {
        const TSet<int32> IndexSet(Indices);
        for (int32 Idx : Indices)
        {
            if (!IndexSet.Contains((L - 1) - Idx))  // Idx의 거울상도 선택돼 있어야 대칭
            {
                bValid = false;
                break;
            }
        }
    }

    // 대칭 불가 조합 → (면길이,포트수)당 1회 경고 후 전부 반환 폴백. (경고 디바운스는 아래 💡)
    if (!bValid)
    {
        // ... UE_LOG 경고 1회 — 생략
        return AllPortCells;
    }

    // 6) 선택 인덱스 → 포트 셀.
    TArray<FIntPoint> Selected;
    for (int32 Idx : Indices) { Selected.Add(AllPortCells[Idx]); }
    return Selected;
}
```

검증의 포인트는 **중심축 대칭** 이에요. 인덱스 `Idx`가 선택됐으면 그 거울상 `(L-1) - Idx`도 선택돼 있어야 합니다. 짝수 면에 1포트처럼 대칭이 *수학적으로 불가능한* 조합은 여기서 걸려, 크래시나 엉뚱한 임의 배치 대신 **"전부 반환" 폴백** 으로 빠져요. 폴백 직전에 경고를 한 번 남기는데, 이 함수는 매 프레임 호버·매 도킹 검사마다 불리니 `(면길이, 포트수)` 조합당 딱 1회만 찍도록 디바운스했습니다 — 안 그러면 로그가 폭발하거든요.

> 💡 이 "조합당 1회 경고" 패턴은 [5편](/blog/factory-sim/05-codex-adversarial-review)에서 다룬 *매 프레임 `UE_LOG` 스팸*([wp-4th 1편](/blog/wp-4th/01-ue-log-spam-host-disconnect)에서 호되게 당했던 그 문제)의 교훈이 코드에 박힌 거예요. 자주 불리는 경로의 경고는 *반드시* 디바운스합니다.

---

## 6. 세 경로가 같은 함수를 경유한다 — 진짜 일원화

이제 처음 목표로 돌아갑니다. 화살표·도킹·출력 그래프 셋이 *정말로* 같은 함수를 쓰는지.

**(1) 출력/입력 셀 조회** — 등록된 머신의 포트 셀은 `OJJ_GetMachinePortCells`를 거쳐 헬퍼로 들어갑니다.

```cpp
TArray<FIntPoint> AOJJ_Grid::GetMachineOutputCells(AMachineBase* Machine) const
{
    // 출력 = OutputDir(-Front) 방향 포트 셀. 출력 포트수로 대칭 배치 적용.
    return Machine
        ? OJJ_GetMachinePortCells(Machine, GetMachineOutputDir(Machine), Machine->GetOutputPortCount())
        : TArray<FIntPoint>();
}

TArray<FIntPoint> AOJJ_Grid::OJJ_GetMachineInputCells(AMachineBase* Machine) const
{
    // 입력 = InputDir(+Front) 방향 포트 셀. 출력 셀과 같은 헬퍼 공유, 방향만 반전 + 입력 포트수로 대칭 배치.
    return Machine
        ? OJJ_GetMachinePortCells(Machine, OJJ_GetMachineInputDir(Machine), Machine->GetInputPortCount())
        : TArray<FIntPoint>();
}
```

입력과 출력의 차이는 **방향뿐** 이에요. `GetMachineOutputDir`은 `-Front`, `OJJ_GetMachineInputDir`은 그 부호 반전인 `+Front`. 같은 헬퍼에 방향만 뒤집어 넣습니다.

**(2) 컨베이어 도킹 판정** — 컨베이어 끝이 머신 출력 포트에 닿았는지 검사하는 코드도 *같은 헬퍼* 를 부릅니다.

```cpp
// 포트 셀 일원화: ConveyorCell이 대칭 규칙으로 선택된 출력 포트 셀이어야 도킹 허용.
// GetMachineOutputCells와 동일한 OJJ_PortCellsFromFootprint(BackStep, 출력 포트수) 경유 →
// 화살표 표시 셀 = 도킹 허용 셀 완전 일치. 포트수=면길이/0이면 전부라 기존 동작 불변.
const TArray<FIntPoint> OutputPortCells =
    AOJJ_Grid::OJJ_PortCellsFromFootprint(MachineCells, BackStep, Machine->GetOutputPortCount());
if (!OutputPortCells.Contains(ConveyorCell))
{
    return false;  // 포트 셀이 아니면 도킹 거부
}
```

주석에 핵심이 적혀 있죠 — **"화살표 표시 셀 = 도킹 허용 셀 완전 일치."** 이게 이번 편 제목 그대로입니다. 화살표가 가리키는 셀과 도킹이 허용되는 셀이 *같은 함수의 같은 출력* 이라, 어긋날 방법이 없어요. 입력 도킹(`OJJ_IsMachineFrontInputPair`)도 `FrontStep`으로 똑같이 처리합니다.

**(3) 출력 타깃 그래프** — 머신이 자원을 내보낼 다운스트림 머신을 찾는 `GetMachineOutputTargets`도 포트 셀을 새로 구하지 않습니다. 그냥 (1)의 출력 셀을 그대로 순회해요.

```cpp
for (const FIntPoint& Cell : GetMachineOutputCells(Machine))  // ← (1)과 동일한 헬퍼 경유
```

각 출력 포트 셀에 머신이 있으면(`GetMachineAtCell`) 다운스트림 연결 후보로 잡을 뿐, 포트 계산은 한 글자도 따로 하지 않습니다. `GetMachineOutputCells` → `OJJ_PortCellsFromFootprint`로 (1)·(2)와 *정확히 같은* 셀 집합을 받으니까요.

세 경로 — **화살표 / 도킹 / 그래프** — 가 전부 `OJJ_PortCellsFromFootprint` 한 점으로 수렴합니다. 이게 "단일 진실 공급원(single source of truth)" 패턴이에요. 진실이 한 군데 있으니, 그걸 *보여주는* 화살표와 *집행하는* 도킹이 결코 모순되지 않습니다.

---

## 7. 화살표 렌더링 — ISM 4벌, 그리고 "연결된 포트는 숨긴다"

포트 셀을 구했으니 이제 *그린다*. 화살표는 인스턴스드 스태틱 메시(ISM)로 그려요. [3편](/blog/factory-sim/03-material-grid-visualization)의 호버 셀과 같은 결의 접근입니다 — 같은 메시를 수십 개 찍어내니 인스턴싱이 제격이죠.

ISM은 **4벌**입니다. 배치된 머신용 입력/출력, 호버 프리뷰용 입력/출력. 수명주기를 분리해서 — 배치 화살표는 빌드 모드 내내 떠 있고, 호버 화살표는 커서 따라 매 프레임 새로 그립니다.

```cpp
// === 포트 방향 화살표 ISM (Cone — 엔진 기본, 전용 메시는 후속) ===
auto MakeArrowISM = [this](const TCHAR* Name) -> UInstancedStaticMeshComponent*
{
    UInstancedStaticMeshComponent* ISM = CreateDefaultSubobject<UInstancedStaticMeshComponent>(Name);
    ISM->SetupAttachment(RootComponent);
    ISM->SetCollisionEnabled(ECollisionEnabled::NoCollision);  // 트레이스 오염 방지
    ISM->SetCastShadow(false);
    return ISM;
};
PlacedInputArrowISM  = MakeArrowISM(TEXT("PlacedInputArrowISM"));
PlacedOutputArrowISM = MakeArrowISM(TEXT("PlacedOutputArrowISM"));
HoverInputArrowISM   = MakeArrowISM(TEXT("HoverInputArrowISM"));
HoverOutputArrowISM  = MakeArrowISM(TEXT("HoverOutputArrowISM"));
```

메시는 엔진 기본 콘(`/Engine/BasicShapes/Cone.Cone`), 색은 `BeginPlay`에서 동적 머티리얼로 입혀요 — **입력은 파랑 계열, 출력은 주황 계열**. (전용 포트 화살표 메시·머티리얼은 후속 작업으로 미뤄둔, 지금은 "기능 먼저" 단계입니다.)

실제로 한 셀에 화살표를 찍는 부분은 이렇습니다. 콘의 apex(+Z)를 수평 방향에 정렬하는 게 포인트예요.

```cpp
auto EmitOne = [this](UInstancedStaticMeshComponent* ISM, FIntPoint Cell, FIntPoint FacingDir)
{
    if (!ISM || FacingDir == FIntPoint::ZeroValue) { return; }

    // 연결된 포트 숨김: 포트 셀에 컨베이어가 점유 중이면 그 포트 화살표를 그리지 않는다.
    if (OJJ_GetConveyorAtCell(Cell)) { return; }

    const FVector Dir3D = FVector(FacingDir.X, FacingDir.Y, 0.0f).GetSafeNormal();
    if (Dir3D.IsNearlyZero()) { return; }

    const FVector CellCenter = GridToWorld(Cell);
    const FVector Location(CellCenter.X, CellCenter.Y, CellCenter.Z + PortArrowHeightOffset);

    // 콘 메시 apex(+Z)를 수평 FacingDir로 정렬.
    const FRotator Rotation = FRotationMatrix::MakeFromZ(Dir3D).Rotator();
    const FTransform InstanceTransform(Rotation, Location, FVector(PortArrowScale));

    ISM->AddInstance(InstanceTransform, /*bWorldSpace=*/true);
};
```

여기 숨은 디테일 하나 — **이미 컨베이어가 붙은 포트는 화살표를 안 그립니다.** `OJJ_GetConveyorAtCell(Cell)`로 그 셀에 컨베이어가 점유 중인지 보고, 있으면 화살표를 생략해요. 포트가 *비어 있을 때만* "여기 붙일 수 있어"라고 안내하는 거죠. 컨베이어를 떼면 점유가 풀려 화살표가 자동으로 돌아옵니다. 이것도 6절의 일원화 덕인데 — 그리드 점유라는 *진실원* 을 직접 조회하니, 별도의 "연결됨" 플래그를 동기화할 필요가 없어요.

입력/출력 화살표의 **방향**도 의미가 다릅니다.

```cpp
if (bDrawInput)
{
    // 입력 화살표: 머신을 향해(−InputDir) — "입력 셀 → 머신".
    const FIntPoint InputFacing(-InputDir.X, -InputDir.Y);
    for (const FIntPoint& Cell : InputCells) { EmitOne(InputISM, Cell, InputFacing); }
}
if (bDrawOutput)
{
    // 출력 화살표: 머신에서 나가는(+OutputDir) — "머신 → 출력 셀".
    for (const FIntPoint& Cell : OutputCells) { EmitOne(OutputISM, Cell, OutputDir); }
}
```

입력 화살표는 머신 *쪽으로* 들어오는 방향(`-InputDir`), 출력 화살표는 머신에서 *나가는* 방향(`+OutputDir`). 색(파랑/주황)에 더해 화살표의 *방향* 까지 흐름을 말해주니, 색 머티리얼이 혹시 안 입혀져도 입출력이 식별됩니다.

---

## 8. 호버 프리뷰는 어떻게 "배치 결과와 똑같이" 보이나

배치된 머신은 액터가 있으니 회전(yaw)을 액터에서 읽으면 됩니다. 그런데 **호버 프리뷰는 머신 액터를 spawn하지 않아요**([4편](/blog/factory-sim/04-mouse-input-build-controller)에서 다룬, 커서 따라다니는 미리보기). 액터가 없으니 forward 벡터도 없죠. 그럼 미리보기 화살표 방향을 어떻게 실제 배치 결과와 맞출까요?

```cpp
void AOJJ_Grid::DrawHoverMachineArrows(AMachineBase* Machine, FIntPoint Origin, int32 RotationSteps)
{
    ClearHoverMachineArrows();
    if (!Machine) { return; }

    // 호버는 액터를 spawn하지 않으므로 forward가 없다. 배치 컨벤션(SetActorRotation(0, 90*step, 0))과
    // 동일하게 yaw로 재구성 → 미리보기 화살표 방향이 실제 배치 결과와 정확히 일치.
    const FVector Forward = FRotator(0.0f, 90.0f * RotationSteps, 0.0f).RotateVector(FVector::ForwardVector);
    const FIntPoint InputDir  = CardinalFromVector(Forward);    // 입력 = +Front
    const FIntPoint OutputDir = CardinalFromVector(-Forward);   // 출력 = -Front

    const TArray<FIntPoint> Footprint = CalculateFootprint(Machine, Origin, RotationSteps);

    const bool bDrawInput  = Machine->GetInputPortCount() > 0 && !OJJ_IsExtractionMachine(Machine);
    const bool bDrawOutput = Machine->GetOutputPortCount() > 0;

    OJJ_EmitPortArrows(
        HoverInputArrowISM, bDrawInput,
        OJJ_PortCellsFromFootprint(Footprint, InputDir, Machine->GetInputPortCount()), InputDir,
        HoverOutputArrowISM, bDrawOutput,
        OJJ_PortCellsFromFootprint(Footprint, OutputDir, Machine->GetOutputPortCount()), OutputDir);
}
```

답은 또 **일원화** 예요. 호버도 결국 `OJJ_PortCellsFromFootprint`를 직접 부릅니다 — 단지 등록된 머신의 footprint 대신, 커서 위치로 *계산한* footprint를 넘길 뿐이죠. 회전은 배치 코드가 쓸 `SetActorRotation(0, 90*step, 0)`을 그대로 재현해 yaw를 만들고, 거기서 입력/출력 방향을 뽑습니다. 그래서 미리보기에 뜬 화살표가 곧 배치 후의 화살표예요. **"보이는 대로 놓인다."**

> 📐 (회전별 호버 화살표 스크린샷 후속 첨부 예정 — 머신을 R로 90°씩 돌릴 때 입력/출력 화살표가 footprint와 함께 도는 모습)

추출 머신(채굴기·펌프 등)은 입력이 *자원 노드* 라 컨베이어 입력이 없죠. 그래서 `OJJ_IsExtractionMachine`이면 입력 화살표를 통째로 생략합니다 — 이것도 배치/호버 양쪽이 같은 조건을 공유해요.

---

## 9. 무회귀 — 왜 기존 머신은 안 깨지나

새 규칙을 넣을 때 항상 묻는 질문 — *기존에 잘 돌던 건 안 깨지나?* 이번 일원화는 두 겹의 안전장치가 있습니다.

1. **포트 수 미설정/면길이 이상 → 전부 반환.** 5절의 그 분기예요. 포트 시스템 이전 머신(포트 수를 안 정한 머신)은 `PortCount <= 0`이라 *모서리 전 칸* 이 포트가 됩니다 — 도입 전과 100% 동일. 새 규칙은 "포트 수를 명시적으로 줄인" 머신에만 적용돼요.
2. **회전 불변.** 면 축으로 정렬해서 인덱스로 고르니, 머신이 돌면 footprint와 forward가 *함께* 돌아 포트의 상대 위치가 유지됩니다. "출력 정중앙"은 어느 방향으로 돌려도 정중앙이에요.

여기에 5절의 **대칭 검증 + 폴백** 까지 더하면, 대칭이 불가능한 조합조차 *전부 반환* 으로 안전하게 떨어집니다. 최악의 경우가 "예전 동작"이라, 이 리팩터는 게임을 *덜 똑똑하게* 만들 수는 있어도 *깨뜨리지는* 않아요.

> 💡 Phase 1의 머신 제거 경로에서도 이 일원화가 한몫합니다. 빌드 모드 중 머신을 철거하면 `RemoveMachine`이 화살표를 즉시 재적재(`RefreshPlacedMachineArrows`)하는데, 양방향 맵이 이미 갱신된 뒤라 제거된 머신은 자동으로 빠져요. 포트 계산이 한 곳이라, *제거된 머신의 stale 화살표* 같은 동기화 버그가 원천적으로 안 생깁니다.

---

## 10. 마치며

이번 편 요약은 셋입니다.

1. **포트 셀은 한 함수에서만 나온다.** `OJJ_PortCellsFromFootprint`가 footprint 모서리의 바깥 이웃을 산출하고, 화살표·도킹·출력 그래프 셋이 전부 이걸 경유한다. 진실이 한 곳이라 *보이는 화살표 = 붙는 컨베이어* 가 정의상 보장된다.
2. **포트 수가 면보다 적으면 중심축 대칭으로 배치한다.** 1포트는 정중앙(홀수 면), 2포트 이상은 양끝 포함 균등 분산. 대칭 불가 조합은 경고 1회 + 전부 반환 폴백으로 안전하게.
3. **무회귀 설계.** 포트 수 미설정/면길이 이상이면 예전처럼 전 칸이 포트. 회전 불변. 최악의 경우가 "도입 전 동작"이라 깨질 일이 없다.

"단일 진실 공급원"은 거창한 말 같지만, 실제로는 **"같은 걸 두 번 계산하지 말자"** 의 다른 이름이에요. 화살표용 포트 계산과 도킹용 포트 계산을 따로 두는 순간, 둘은 *언젠가 반드시* 어긋납니다. 한쪽만 고치는 날이 오니까요. 그걸 함수 하나로 묶으면, 어긋날 코드 자체가 사라집니다. 1인(혹은 소수) 팀에서 *동기화해야 할 것을 애초에 안 만드는* 게 — 이 시리즈 내내 반복되는, 가장 값싼 버그 예방법이에요.

다음 편부터는 드디어 이 포트로 자원이 *흐릅니다.* 컨베이어가 출력 포트에서 입력 포트로 아이템을 실어 나르는 — 생산 사이클과 컨베이어 라인 이야기로 갑니다.

— JJ
