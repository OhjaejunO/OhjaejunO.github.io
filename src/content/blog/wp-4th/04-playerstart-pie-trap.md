---
title: "[UE5 GameMode] 학원 시연 직전에 만난 PlayerStart 함정 — APlayerStartPIE와 ChoosePlayerStart BP override"
description: "베타 D-day 현장에서 발견한 마지막 silent fail — 모든 플레이어가 같은 위치에 spawn되는 문제. C++ 빌드 없이 BP override 한 번으로 해결한 D-day 안전 패턴"
date: 2026-05-23
category: 회고
series: wp-4th
seriesPart: 4
tags: [UE5, GameMode, Blueprint, PlayerStart, PIE, BlueprintNativeEvent, 디버깅, Apex]
---

> 🎯 **WP_4th — Apex Legends FFA 모작 회고 시리즈**
>
> - 1편: Host closed the connection — 매 프레임 UE_LOG 트랩
> - 2편: bAlwaysRelevant Silent Fail — 무기가 클라이언트에서 안 보이는 이유
> - 3편: HUD 첫 픽업을 놓치는 이유 — BP Event vs BeginPlay 타이밍 레이스
> - **4편: 학원 시연 직전에 만난 PlayerStart 함정** ← 현재 글 (마지막)

## 들어가며

베타 발표 당일(D-day), 학원 도착 후 시연 준비 중 마지막 silent fail을 만났다.

**호스트와 모든 클라이언트가 같은 자리에 spawn된다.** 시작하자마자 캐릭터들이 한 점에 겹쳐서 끼인다. 어떤 클라이언트는 PIE 시작 위치(에디터 카메라 시점)에 spawn되어 허공에 떠 있다.

발표까지 30분. C++ 수정해서 빌드하면 시간이 부족하다. 팀원들에게 합류 요청하기도 애매하다.

해결책은 **`BP_ApexDeathmatchGameMode`에서 `ChoosePlayerStart` BP override 한 줄**이었다. C++ 변경 0, 빌드 0, 5분 작업.

이번 사례가 가르쳐준 건 단순한 PlayerStart 분배가 아니라, **"D-day 변경은 빌드 의존성 0이 최우선"** 이라는 메타 규칙이다.

---

## 1. 증상

### 환경
- **시점**: 2026-05-19 (베타 발표 D-day, 학원 현장)
- **GameMode**: `BP_ApexDeathmatchGameMode` (AGameModeBase 기반)
- **검증**: PIE Listen Server 2~3 클라이언트
- **남은 시간**: 시연까지 약 30분

### 현상
- 호스트 + 클라이언트 모두 **같은 `APlayerStart` 위치**에 spawn → 캐릭터 끼임, 충돌
- 일부 클라이언트는 **`APlayerStartPIE`** 위치(에디터 카메라)에 spawn → 허공 또는 맵 밖 출발
- 매치 시작 직후 카메라 시점 혼란

호스트는 첫 spawn으로 들어가니까 본인은 정상으로 인지한다. 화면도 정상. 그런데 클라이언트 화면을 보면 캐릭터들이 한 곳에 겹쳐 있거나 허공에 떠 있다.

**또 false negative 패턴.** 호스트만 보면 문제없어 보이지만 실제로는 깨져 있다.

---

## 2. UE5 PlayerStart 시스템 — 두 가지 클래스

문제의 시작은 UE5에 PlayerStart가 **두 종류 있다**는 사실이다.

| 클래스 | 생성 시점 | 위치 |
|--------|-----------|------|
| `APlayerStart` | 레벨 디자이너가 배치 | 의도된 spawn 지점 |
| `APlayerStartPIE` | PIE 시작 시 자동 생성 | 에디터 카메라 위치 |

**`APlayerStartPIE`는 `APlayerStart`의 자식 클래스**다. 그래서 `GetAllActorsOfClass(APlayerStart::StaticClass())`로 잡으면 둘 다 포함된다.

```cpp
// 함정 — APlayerStartPIE까지 포함됨
TArray<AActor*> Starts;
UGameplayStatics::GetAllActorsOfClass(GetWorld(), APlayerStart::StaticClass(), Starts);

// 안전 — APlayerStartPIE 제외하려면
Starts.RemoveAll([](AActor* A) { return A->IsA<APlayerStartPIE>(); });
```

PIE 환경에서는 의도된 PlayerStart들 사이에 에디터 카메라 위치까지 섞여 있는 것이다.

---

## 3. ChoosePlayerStart의 기본 동작 — 문제의 본질

`AGameModeBase::ChoosePlayerStart_Implementation` 엔진 기본 구현:

1. `FindPlayerStart` 호출
2. `PlayerStart` 순회
3. **첫 번째 또는 태그 매칭되는 것 반환**
4. 랜덤 분산 없음

즉, **같은 PlayerStart를 모든 플레이어에게 반환할 수 있다.**

FFA(Free For All) 게임모드에서는 치명적이다. 4명이 동시 매치 시작 → 모두 같은 자리에 spawn → 캐릭터가 한 점에 끼인다.

게다가 PIE에서는 `APlayerStartPIE`가 배열 앞쪽에 들어가서 더 우선 선택될 수 있다. 의도한 spawn 위치는 무시되고 에디터 카메라 위치로 spawn.

**결국 두 문제가 결합**:
1. 멀티에서 같은 위치 spawn (랜덤 분산 없음)
2. PIE에서 `APlayerStartPIE` 우선 선택 (에디터 카메라 위치)

---

## 4. 해결 옵션 비교

D-day 시연 30분 전. 옵션을 빠르게 비교해야 했다.

| 방식 | 빌드 필요 | 멀티 안전 | PIE 안전 | 비용 |
|------|-----------|-----------|----------|------|
| 기본 `ChoosePlayerStart` 그대로 | X | ✗ 같은 위치 | ✗ PIE start 우선 | 0 |
| BP `ChoosePlayerStart` override + Random | X | ✓ | ✓ (분산됨) | 즉시 |
| BP override + PIE 제외 + Random | X | ✓ | ✓ 완전 | 노드 1~2개 추가 |
| C++ `ChoosePlayerStart_Implementation` override | ✓ | ✓ | ✓ | 빌드 + 팀 합류 |
| `APlayerStartPIE` 비활성화 (Project Settings) | X | — | 부분 | 다른 작업 영향 가능 |

**선택**: 2번 — **BP override + Random**.

이유:
- C++ 변경 시 → 팀 빌드 + 동료 합류 필요 (디스코드/리바운드 시간 소모)
- BP override 시 → 본인 BP 1개 저장만으로 즉시 적용
- D-day 시간 압박 = **빌드 의존성 0 선택이 최우선**
- PIE start 포함되지만 분산되니 실용상 OK

---

## 5. `ChoosePlayerStart`는 BP에서 override 가능한 함수

여기가 핵심이다. `AGameModeBase::ChoosePlayerStart`는 평범한 가상 함수가 아니라 **`BlueprintNativeEvent`** 다.

```cpp
// AGameModeBase.h (엔진 코드)
UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Game")
AActor* ChoosePlayerStart(AController* Player);
```

`BlueprintNativeEvent`의 의미:
- C++ 기본 구현이 있음
- **그러나 BP에서 override 가능**
- BP에서 override하면 C++ 기본 구현은 호출 안 됨
- BP에서 `Event Choose Player Start` 노드로 그래프 작성

즉, **C++ 한 줄도 안 건드리고 GameMode BP만 수정하면 끝**이다.

---

## 6. BP override 구현

`BP_ApexDeathmatchGameMode`에 `Event Choose Player Start` 추가:

```
Event Choose Player Start (Player: Controller) → returns Actor

[Get All Actors Of Class] (Actor Class = PlayerStart)
        ↓ Out Actors (Array)
[Length] → ArrayLen
        ↓
[Branch] (ArrayLen > 0)
   ├─ True  
   │    ↓
   │  [Random Integer In Range] (Min=0, Max=ArrayLen-1) → RandomIdx
   │    ↓
   │  [Get] (Out Actors, RandomIdx) → ChosenStart
   │    ↓
   │  Return ChosenStart
   │
   └─ False
        ↓
      [Super: Choose Player Start] (Player)  ← fallback 안전망
        ↓
      Return (Super 결과)
```

**핵심 포인트**:

### 1. `Random Integer In Range`의 Max는 `Length - 1`
off-by-one 함정. `Max = Length` 쓰면 out-of-range 에러.

### 2. 빈 배열 분기 안전망
PlayerStart가 0개일 때 `Get(0)`은 nullptr → crash. 반드시 Length > 0 검사.

### 3. False 분기에 `Super` 호출
빈 배열 외에도 예상 못 한 케이스에서 `Super: Choose Player Start`로 fallback. 안전망 없으면 모든 매치 spawn 실패 위험.

빌드 0, BP 저장 한 번. 5분 작업으로 모든 spawn 문제 해결.

---

## 7. 검증 — 시연 직전

수정 후 즉시 검증:

```
1. PIE Listen Server 2~3 클라
2. 매치 시작
3. 각 캐릭터가 서로 다른 PlayerStart로 분산 spawn 확인
4. 끼임 없음 확인
5. 허공 spawn 없음 확인 (PIE start도 분산되니 빈도 낮음)
```

OK. 시연 안정성 확보.

발표 무사 완수.

---

## 8. 함정/주의사항

이번 사례에서 도출한 추가 함정들:

### `APlayerStartPIE`는 PIE에서만 존재
패키징 빌드에서는 자동 제외. 따라서 **PIE 환경에서만 의심해야 할 함정**. 패키지 빌드만 검증하면 이 문제 자체가 안 보임 → false negative.

### 에디터 카메라 위치 → 의도 외 spawn
에디터 카메라가 맵 밖 또는 공중에 있을 때 PIE start도 그 위치 → 클라가 허공 출발. 작업 중 에디터 뷰포트 위치에 따라 매번 다른 곳으로 spawn되는 혼란.

### `Random Integer` 범위 off-by-one
```
Min = 0
Max = ArrayLen - 1    ← 반드시 -1
```
`Max = Length` 쓰면 out-of-range. 가장 흔한 BP 함정.

### 빈 배열 분기 누락 = crash
PlayerStart 0개일 때 `Get(0)`은 nullptr → crash. 반드시 `Length > 0` 검사.

### 부모 클래스 호출 누락 시 모든 매치 spawn 실패
`ChoosePlayerStart` 직접 override에 fallback이 없으면 빈 결과 케이스에서 모든 매치 spawn 실패. **빈 결과면 `Super: Choose Player Start` 호출.**

### Apex 식 리스폰과 동일 분기 적용됨
`RestartPlayer` 호출 흐름 안에서 `ChoosePlayerStart`가 다시 발동된다. 리스폰 시점에도 같은 랜덤 분산 적용됨 → 의도된 동작.

### 태그 매칭 PlayerStart 무시
`PlayerStartTag`로 특정 PlayerStart에 태그 붙여서 사용 중이면 본 override가 그 매칭 로직을 우회한다. 의도 확인.

### 호스트만 검증 함정
호스트는 첫 spawn에 의해 같은 위치라도 본인은 정상으로 인지한다. **PIE 2~3 클라**로 같은 위치 끼임을 시각적으로 검증해야 한다.

### TeamPlayerStart 같은 변형 PlayerStart
일부 매치 시스템은 PlayerStart 서브클래스 사용. `APlayerStart::StaticClass()` 검색은 모든 자식 포함하므로 의도된 spawn 무시될 수 있음. 의도 확인.

---

## 9. 메타 휴리스틱 — D-day의 규칙

이번 사례에서 도출한 가장 중요한 규칙들:

### 1. D-day 변경은 빌드 의존성 0이 최우선
시연 직전에 발견한 문제는 **빌드 시간조차 리스크**다. BP override 가능한 함수는 BP로 가야 한다. C++ 수정 → 빌드 → 팀원 합류 → 동기화의 사이클이 끊기지 않을 보장이 없다.

### 2. `BlueprintNativeEvent`의 가치 = D-day 안전망
C++ 작성 시 가능한 한 `BlueprintImplementableEvent` 또는 `BlueprintNativeEvent`로 만들어라. 미래의 자신 또는 팀이 **빌드 없이 분기 가능**해진다. 이게 D-day에서 진가를 발휘한다.

### 3. 시연 환경에서만 발생하는 함정은 사전 검증 어려움
학원 환경 + PIE 환경 + 패키지 빌드는 모두 다르다. PlayerStart 함정은 PIE에서만 발생하고, 패키지 빌드만 검증한 팀은 못 본다. **다양한 환경에서 검증**해야 한다.

### 4. 부모 함수 fallback 누락 = 다음 매치 깨짐
D-day 변경에서도 안전망(`Super` 호출) 빠뜨리지 말 것. 빠른 수정이 미래의 또 다른 버그를 만들면 의미 없다.

---

## 10. 다음 프로젝트 체크리스트

새 GameMode 작성 시:

- [ ] `BP_GameMode`에 `Event Choose Player Start` override 추가 (기본값 즉시)
- [ ] PIE Listen Server 2~3 클라로 spawn 위치 분산 시각 검증
- [ ] 빈 PlayerStart 분기 안전망 (`Length > 0` 체크) 추가
- [ ] False 분기에 `Super: Choose Player Start` fallback 호출
- [ ] PIE start 제외 여부 결정 (의도 위치만 원하면 `RemoveAll` + `APlayerStartPIE` 필터)
- [ ] `APlayerStart` 맵 배치 최소 N+2개 (N = 최대 동시 플레이어)
- [ ] 멀티 spawn 캐릭터 끼임/겹침 collision handling 검토
- [ ] 패키지 빌드에서도 spawn 검증 (PIE start 제외 환경)
- [ ] `Random Integer` 범위 `Max = Length - 1` 확인

---

## 마치며 — 시리즈 마무리

베타 D-day에 발견한 마지막 silent fail이었다. 그리고 4편의 회고 시리즈가 이로써 마무리된다.

**WP_4th 베타 D-1 ~ D-day 4건 silent fail 정리**:

| # | 증상 | 진짜 원인 | 해결 |
|---|------|-----------|------|
| 1 | Host closed the connection | 매 프레임 UE_LOG 누적 | 로그 제거 |
| 2 | 자기장이 클라에 안 보임 | `bAlwaysRelevant` 누락 | 한 줄 추가 |
| 3 | HUD가 첫 픽업을 놓침 | cpp 이벤트 vs BP BeginPlay race | 초기 동기화 + IsValid 가드 |
| 4 | 모든 플레이어 같은 자리 spawn | `ChoosePlayerStart` 분산 없음 + PIE start 우선 | BP override + Random |

네 가지 모두 공통점이 있다.

### 공통점 1 — 호스트만 보면 false negative
호스트(서버)는 자기 시점에서 모든 것이 정상으로 보인다. 진짜 검증은 **클라이언트 시점**에서 해야 한다.

### 공통점 2 — 검증 시점이 늦으면 같은 날 폭발
D-1 ~ D-day에 4건이 같이 발견된 건 우연이 아니다. **본격적인 멀티 LAN 검증을 D-1에 처음 했기 때문**. 다음 프로젝트는 D-3 ~ D-5부터 멀티 검증.

### 공통점 3 — 에러 메시지가 본질을 가린다
"Host closed the connection"은 호스트 문제 아니고, "BP 체크박스 ✓"는 동기화 보장 아니고, "Event 핸들러 작성됨"은 항상 발사 보장 아니다. **메시지는 증상이지 원인이 아니다.**

### 공통점 4 — D-day 변경은 빌드 의존성 0
이번 4편 사례가 가장 극적이지만, 1~3편도 동일하다. 시연 직전 환경에서 발견되는 함정은 BP override 같은 무빌드 변경이 정답.

---

이 시리즈는 끝났지만, 본인이 만든 자산은 다음 프로젝트로 옮겨간다. 다음 멀티플레이 프로젝트에서는 이 4가지 함정을 처음부터 피할 수 있을 것이다.

그리고 다음에 또 새로운 silent fail을 만나면, 그것도 기록할 것이다. 시리즈는 끝났지만 학습은 계속된다.

---

## 참고 자료

- [UE5 Documentation — AGameModeBase::ChoosePlayerStart](https://docs.unrealengine.com/)
- [UE5 Documentation — APlayerStart](https://docs.unrealengine.com/)
- UE5.7 `AGameModeBase::ChoosePlayerStart_Implementation` 소스
- 참고 코드: `Source/WP_4th/Variant_Shooter/ShooterPlayerController.cpp:112~129` (Random PlayerStart 패턴 cpp 버전)
- 본인 Obsidian Vault: `202605192200-ue5-playerstart-pie-trap-chooseplayerstart-override.md`