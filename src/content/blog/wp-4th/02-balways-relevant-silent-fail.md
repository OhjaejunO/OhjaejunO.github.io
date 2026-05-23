---
title: "[UE5 멀티플레이] BP에서 Replicates ✓ 보여도 동기화 안 되는 진짜 이유 — bAlwaysRelevant Silent Fail"
description: "베타 D-1에 발견한 두 번째 silent fail — 자기장이 호스트에는 보이는데 클라이언트에는 안 보이는 미스터리. NetUpdateFrequency placebo와 bAlwaysRelevant라는 결정적 해결책"
date: 2026-05-23
category: 회고
series: wp-4th
seriesPart: 2
tags: [UE5, C++, 멀티플레이, Replication, Relevancy, bAlwaysRelevant, 디버깅, Apex]
---

> 🎯 **WP_4th — Apex Legends FFA 모작 회고 시리즈**
>
> - 1편: Host closed the connection — 매 프레임 UE_LOG 트랩
> - **2편: bAlwaysRelevant Silent Fail — 무기가 클라이언트에서 안 보이는 이유** ← 현재 글
> - 3편: UMG Visibility 토글 패턴 — 빈손 처리의 함정 (예정)
> - 4편: PlayerStart PIE 트랩 — ChoosePlayerStart override 사례 (예정)

## 들어가며

베타 D-1 검증 중 두 번째 silent fail을 만났다.

**호스트 화면에서는 자기장이 정상으로 좁아진다. 데미지도 들어간다. 그런데 클라이언트 화면은 — 자기장이 멈춰있다.**

BP를 열어 확인해도 모든 게 정상이다:
- `bReplicates = true` ✓ 체크박스 보임
- 모든 멤버 변수가 `Replicated` ✓
- 빌드 에러 없음
- 컴파일 경고 없음

겉으로는 모든 게 다 돼 있는데, 클라이언트에만 동기화가 안 된다.

원인은 한 줄짜리였다. `bAlwaysRelevant = true` 누락.

이번에는 그걸 발견하는 과정에서 한 번 **placebo**에 속았다. 그 얘기다.

---

## 1. 증상

### 환경
- **엔진**: UE5.7
- **네트워킹**: Listen Server
- **문제 액터**: `AJunRingActor` (자기장 시스템, 팀원 김준 작업)
- **검증**: PIE Listen Server 2~3 클라이언트
- **시점**: 2026-05-17 (베타 D-1, 1편 UE_LOG 트랩과 같은 날)

### 현상
- **호스트(서버) 화면**: 자기장 정상. 반경이 시간에 따라 좁아지고, 자기장 밖 캐릭터에게 데미지 들어감
- **클라이언트 화면**: 자기장 시각 갱신 안 됨. 데미지도 안 들어옴

BP 설정은 완벽해 보였다:

```
AJunRingActor → Class Defaults
├─ Replicates ✓
├─ Replicate Movement ✓
└─ Replicated Variables
   ├─ CurrentRadius (Replicated ✓, OnRep_CurrentRadius)
   ├─ CurrentPhaseIndex (Replicated ✓)
   ├─ bRingStarted (Replicated ✓)
   └─ ... (총 9개 변수 모두 ✓)
```

겉으로 모든 게 다 정상. 그런데 클라이언트만 묵묵히 멈춰있다.

---

## 2. 가설 추적

### 가설 1 — NetUpdateFrequency 조정 (placebo)

처음 떠올린 건 "동기화 빈도가 너무 낮아서 클라에 전달이 안 되는 거 아닐까?"

```cpp
// AJunRingActor 생성자
NetUpdateFrequency = 30.0f;       // 기본 100 → 30으로 조정
```

빌드 후 검증 → **변화 없음**. 클라는 여전히 silent.

이 시점에서 한 번 함정에 빠질 뻔했다. "음... 30으로 했는데도 안 되네. 그러면 60으로 올려볼까?" 같은 식으로 **placebo 옵션 만지작**거리다가 시간 날릴 수 있는 상황이었다.

**사후 분석**: NetUpdateFrequency는 **이미 동기화되는 변수의 빈도**를 조절하는 옵션. 동기화 발동 자체가 안 되는 상황에서는 빈도를 100 → 30 → 60으로 바꿔도 **무의미하다**. 처음부터 잘못된 다이얼을 돌리고 있었다.

### 가설 2 — bAlwaysRelevant (결정적 해결)

NetUpdateFrequency가 무효라는 걸 확인한 후, "그러면 동기화 자체가 발동을 안 하는 거 아닌가?"라는 가설로 전환.

UE5 Replication은 단순히 `bReplicates = true` 하나로 발동하지 않는다. 다음 **3가지 조건이 모두** 충족돼야 한다:

```
1. Actor->bReplicates == true                   ← 흔히 체크
2. UPROPERTY(Replicated) + DOREPLIFETIME 등록   ← 흔히 체크
3. Actor가 이 클라에 Relevant                    ← 자주 빠뜨림
```

3번이 핵심이었다. 자기장 액터는 맵에 1개만 spawn되는 **소유자 없는 World Actor**다. 그래서 클라이언트의 NetCull 거리 밖에 있으면 "이 클라에 이 액터는 관련 없음(not relevant)" 판정이 나고, **Replication 자체가 발동하지 않는다.**

호스트는 서버이므로 모든 액터를 보유한다 → 호스트 화면만 작동하는 false positive.

해결책은 단 한 줄:

```cpp
AJunRingActor::AJunRingActor()
{
    bReplicates = true;
    bAlwaysRelevant = true;            // ← 이게 결정적 해결
    SetReplicateMovement(false);
    // ...
}
```

빌드 후 즉시 클라 화면 정상 동기화. 자기장 시각도, 데미지도 정상.

---

## 3. 진짜 원인 — Replication 발동 3단 조건

### Replication은 단순 플래그가 아니다

`bReplicates = true`는 **"이 액터를 Replication 후보로 등록"** 일 뿐이다. 후보 등록과 실제 발동은 다른 단계.

```
[등록 단계]
  bReplicates = true
  → 이 액터를 NetDriver에 후보로 올림

[발동 단계]
  매 NetUpdate 주기마다
  각 클라이언트마다
  IsNetRelevantFor(Client) 호출
  → true 면 변수 동기화
  → false 면 SKIP
```

`bReplicates = true` 만 켜면 **등록만 된 상태**. 클라이언트별로 매번 Relevancy 검사가 들어가고, 거기서 fail이면 동기화 0.

### Relevancy 판정 기준

`AActor::IsNetRelevantFor` 기본 구현:

| 조건 | 결과 |
|------|------|
| `bAlwaysRelevant == true` | 항상 relevant |
| `Owner`가 PlayerController인 경우 | 그 클라에 항상 relevant |
| Pawn에 부착된 경우 | 부착된 Pawn 기준 |
| 그 외 | `NetCullDistanceSquared` 거리 검사 (기본 ≈ 150m) |

자기장 같은 **소유자 없는 World Actor**는 마지막 항목만 적용된다. 클라이언트 위치에서 자기장까지의 거리가 NetCull 밖이면 fail.

### 그래서 한 줄로 해결됐다

```cpp
bAlwaysRelevant = true;
```

이 한 줄이 "이 액터는 거리 상관없이 항상 모든 클라이언트에 relevant"로 만든다. 자기장은 맵 단위 효과니까 이게 맞다.

---

## 4. World Actor 판단 체크리스트

`bAlwaysRelevant`를 켤지 결정할 때 다음을 확인:

- [ ] 맵에 1~3개만 spawn되는 매니저/컨트롤러
- [ ] 모든 플레이어가 동시에 영향받는 환경 효과 (자기장, 안개, 폭풍)
- [ ] GameMode/GameState만큼 중요한 게임 진행 상태 보유
- [ ] PlayerController에 attached 아님
- [ ] 맵 사이즈가 NetCullDistance(약 150m)보다 큼

**체크 2개 이상이면 `bAlwaysRelevant = true` 강력 추천.**

자기장은 위 5개 다 해당했다. 처음부터 켰어야 하는 케이스.

---

## 5. 트레이드오프 — 켜면 좋은 거 아님?

"그러면 모든 액터에 켜면 안전하지 않나?"

**아니다.** 트레이드오프가 있다.

| 측면 | 켰을 때 | 껐을 때 (기본) |
|------|---------|----------------|
| 동기화 신뢰성 | 모든 클라 항상 ✓ | 거리 기반 fail 위험 |
| 트래픽 | 모든 클라에 전송 | NetCull 밖은 제외 (절약) |
| 적정 사용처 | 맵 단위 매니저, 환경 효과 | 일반 캐릭터/무기/픽업 |
| 남용 시 부작용 | 트래픽 폭증, 의미 무효화 | — |

**규칙**: 명백한 World Actor(맵당 1~3개)에만 사용. 일반 Actor에는 절대 켜지 말 것. 모든 액터에 켜면 NetCull 시스템 자체가 무력화돼 트래픽이 폭증한다.

캐릭터, 무기, 픽업처럼 **위치 기반으로 의미 있는** 액터는 거리 컬링을 살려둬야 한다.

---

## 6. 컴포넌트 단위 Replication의 함정

`UJunRingComponent`에는 `UPROPERTY(Replicated)` 멤버가 9개 있었다:

```cpp
UPROPERTY(ReplicatedUsing = OnRep_CurrentRadius, BlueprintReadOnly)
float CurrentRadius;

UPROPERTY(Replicated, BlueprintReadOnly)
int32 CurrentPhaseIndex;

UPROPERTY(Replicated, BlueprintReadOnly)
bool bRingStarted;
// ... 6개 더
```

컴포넌트 레벨에서는 완벽하게 셋업돼 있었다. 그런데도 silent fail.

**왜냐하면 — 컴포넌트의 Replicated는 부모 Actor의 Relevancy를 못 뚫는다.**

부모 Actor가 not relevant이면 그 안의 컴포넌트도 모두 동기화 0. 컴포넌트 레벨에서 아무리 잘 셋업해도 부모 액터의 조건이 충족되지 않으면 의미 없다.

**컴포넌트 Replication은 부모 Actor가 Replicates + Relevant 일 때만 작동한다.** 이걸 모르면 컴포넌트 코드만 들여다보며 시간 날리기 쉽다.

---

## 7. 진단 흐름 — silent fail 의심 시

같은 증상을 만났을 때 빠르게 확인하는 순서:

### Step 1: 호스트 vs 클라 행동 비교
- 호스트만 정상 → Replication 또는 Relevancy 문제
- 호스트도 실패 → 로직 자체 문제 (Replication 아님)

### Step 2: BP 체크박스 확인 (의외로 종종 빠뜨림)
- Actor → Class Defaults → Replicates ✓
- 변수 → Replication → Replicated 선택

### Step 3: C++ `bReplicates` 코드 확인
```cpp
ActorInstance->GetIsReplicated()   // true 여야 함
```

### Step 4: `GetLifetimeReplicatedProps` 등록 확인
```cpp
void AMyActor::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const
{
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME(AMyActor, MyVar);   // 빠뜨리면 silent
}
```

### Step 5: Relevancy 검사 (본 노트의 핵심)
```cpp
// 콘솔 명령
showactornetrelevancy MyActor

// 또는 코드
const bool bRelevant = Actor->IsNetRelevantFor(MyPC, MyViewActor, MyViewLocation);
```

`false`로 나오면 **이게 silent fail의 원인**. `bAlwaysRelevant = true` 켜거나, NetCullDistance 늘리거나, Owner 설정.

### Step 6: 트래픽 옵션은 placebo 의심
- `NetUpdateFrequency`, `MinNetUpdateFrequency`는 **이미 동기화되는 변수의 빈도** 조절
- 동기화 발동 자체가 안 되면 빈도 100 → 30 바꿔도 무의미
- "고쳤다고 느꼈지만 사실 같은 시점 다른 변경이 우연히 해결한 케이스"를 의심

---

## 8. 함정/주의사항

이번 사례에서 도출한 추가 함정들:

### BP 체크박스가 가장 강한 misdirection
"보이는 게 정상"이라는 인지로 다른 곳을 의심하게 됨. **가장 먼저 의심해야 할 게 Relevancy다.** BP 체크박스는 1차 검증일 뿐.

### `bOnlyRelevantToOwner`와 혼동 X
이건 "오직 Owner에게만 relevant". World Actor에 켜면 모든 클라에 안 보이게 된다. 정반대 효과니까 이름 헷갈리지 말 것.

### 클라가 늦게 join → 초기 상태 누락
`bAlwaysRelevant`를 켜도 join 이전 상태 변화는 못 받는다. 초기 상태는 `OnRep_X` 또는 `BeginPlay`에서 직접 동기화 필요.

### `SetReplicateMovement(false)` 같이 쓰는 이유
자기장은 위치가 안 움직이니까 Movement Replication을 끈다. 트래픽 절약 + 충돌 안전. World Actor는 보통 이 둘을 같이 묶는다.

### `Replicated` vs `ReplicatedUsing=OnRep_X` 차이
- 단순 `Replicated`: 값만 보내고 클라 콜백 없음
- `ReplicatedUsing=OnRep_X`: 콜백 함수 호출 → 시각/사운드 트리거 가능

자기장 반경 변경은 `OnRep_CurrentRadius`로 클라 측 메시 크기·머티리얼을 갱신했다.

### 호스트만 검증하고 OK 판단 금지
호스트는 서버라 모든 액터를 보유한다 → 모든 검증이 **false negative 보장**. PIE Listen Server 2~3 클라로 **클라 시점에서 반드시 검증**해야 한다.

### D-1까지 멀티 검증 미루기 = silent fail 다발 위험
WP_4th 베타 D-1에 자기장 silent fail 외에도 같은 날 다발 발생 (UE_LOG 트랩, 무기 슬롯 분기 누락, PlayerStart PIE 트랩). 검증 시점이 늦으면 같은 날 폭발한다.

---

## 9. 메타 휴리스틱

이 사례에서 도출한 디버깅 메타 규칙:

### 1. "보이는 것"의 신뢰도를 낮춰라
BP 체크박스, 코드 검사, 빌드 성공 — 이 세 가지 모두 silent fail을 막지 못한다. 시각적 확인은 1차 필터일 뿐, 결정적 증거가 아니다.

### 2. "고친 것 같다"의 사후 검증
NetUpdateFrequency 변경 후 작동 안 했는데 마음속으로는 "고친 것 같다"고 진행할 뻔했다. **검증을 즉시 안 하면 placebo가 진짜 해결책 행세를 한다.** 변경 → 검증 → 다음, 이 사이클을 끊지 말 것.

### 3. 호스트와 클라의 인지 차이가 모든 멀티 버그의 출발점
호스트 화면만 보고 "작동한다" 판단은 false positive 보장. **클라 시점 검증이 진짜 검증이다.** 같은 PC에서 PIE Listen Server 2~3 클라로 충분히 시뮬레이션 가능하니 안 할 이유 없다.

### 4. 결정적 변경 1개를 찾을 때까지 멈추지 마라
여러 옵션을 동시에 변경한 후 "어떤 게 효과였는지 모름" = 다음 프로젝트에서 재현 불가. **변경 → 검증 → 분리**의 단계를 지킨다.

---

## 10. 다음 프로젝트 체크리스트

새 멀티플레이 Actor 작성 시:

- [ ] Actor가 World 단위인가? Y → `bAlwaysRelevant = true` 후보
- [ ] 위치 안 움직이나? Y → `SetReplicateMovement(false)` 추가 검토
- [ ] PIE Listen Server 2~3 클라이언트로 **클라 시점** 동기화 시각 검증
- [ ] BP 체크박스가 아닌 C++ `bReplicates` 코드로 셋업 (BP 체크박스는 보조)
- [ ] `GetLifetimeReplicatedProps`에 `DOREPLIFETIME` 등록 누락 점검
- [ ] 동기화 누락 발생 시 가장 먼저 `IsNetRelevantFor` 의심
- [ ] 트래픽 옵션(`NetUpdateFrequency` 등) 변경은 **이미 동기화 발동 후** 빈도 조절

---

## 마치며

이번 사례의 가장 큰 교훈은 — **"체크박스가 모든 걸 보장하지 않는다"** 는 것.

BP UI는 친절하다. `Replicates` 옆에 ✓ 체크박스가 있고, 변수마다 Replication 옵션이 드롭다운으로 깔끔하게 나온다. 이걸 다 켜놓으면 마치 "동기화 셋업 완료"처럼 느껴진다.

그런데 그 뒤에는 **Relevancy**라는 또 다른 레이어가 있다. UI에 잘 노출되지 않는 그 한 줄이 동기화 자체의 발동 여부를 결정한다.

`bAlwaysRelevant = true` — 자기장 같은 World Actor에는 이게 진짜 시작점이다. BP 체크박스가 아니라.

다음 멀티플레이 액터를 만들 때, 가장 먼저 묻는 질문은 "이 액터는 World 단위인가?"가 될 것이다. Y면 한 줄 추가, 그 다음에 BP 셋업.

---

## 참고 자료

- [UE5 Documentation — Actor Replication](https://docs.unrealengine.com/)
- [UE5 Documentation — Network Relevancy](https://docs.unrealengine.com/)
- UE5.7 `AActor::IsNetRelevantFor` 소스 코드
- `showactornetrelevancy` 콘솔 명령
- 본인 Obsidian Vault: `202605192130-ue5-replication-silent-fail-balways-relevant-pattern.md`