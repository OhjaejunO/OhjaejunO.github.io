---
title: "[UE5 멀티플레이] Host closed the connection 의 진짜 범인은 매 프레임 UE_LOG였다"
description: "베타 D-1에 발견한 silent fail — 네트워크 에러 메시지가 네트워크 문제가 아닐 때, 진짜 원인을 추적한 과정과 UE5 멀티플레이 로깅 가이드라인"
date: 2026-05-23
category: 회고
series: wp-4th
seriesPart: 1
tags: [UE5, C++, 멀티플레이, ListenServer, 디버깅, UE_LOG, 트러블슈팅, Apex]
---

> 🎯 **WP_4th — Apex Legends FFA 모작 회고 시리즈**
> 포텐업 부트캠프 언리얼 트랙 5인 팀 프로젝트. UE5.7 + C++로 만든 Apex Legends FFA 모작에서 만난 트러블슈팅들을 정리합니다.
>
> - **1편: Host closed the connection — 매 프레임 UE_LOG 트랩** ← 현재 글
> - 2편: bAlwaysRelevant Silent Fail — 무기가 클라이언트에서 안 보이는 이유 (예정)
> - 3편: UMG Visibility 토글 패턴 — 빈손 처리의 함정 (예정)
> - 4편: PlayerStart PIE 트랩 — ChoosePlayerStart override 사례 (예정)

## 들어가며

베타 발표 하루 전(D-1), 시연 환경 검증 중 갑자기 멀티 매치가 끊기기 시작했다.

```
LogNet: Warning: Host closed the connection.
LogNet: NetDriver: connection timeout.
```

호스트 코드도 안 건드렸고, 네트워크 설정도 안 바꿨다. 그런데 매치 시작 후 수십 초~1분 사이에 클라이언트가 끊긴다.

**범인은 매 프레임 `UE_LOG` 한 줄이었다.**

문법 에러도, 컴파일 경고도, 단일 호출 비용도 무시 가능한 그 함수가, 누적되니 60FPS × 다수 액터 × 매 Tick = 초당 수천 호출이 되어 호스트 프레임 시간을 폭증시키고, 클라가 keepalive timeout 판정으로 연결을 끊은 것처럼 보이게 만들었다.

이 글은 그 발견 과정과, 이후 다음 프로젝트로 가져갈 가이드라인의 기록이다.

---

## 1. 증상

### 환경
- **엔진**: UE5.7
- **언어**: C++ + Blueprint
- **네트워킹**: Listen Server (호스트 = 서버 + 클라이언트)
- **검증**: PIE Listen Server 2~3 클라이언트
- **시점**: 2026-05-17 (베타 발표 D-1)

### 현상
- 매치 시작 후 **수십 초 ~ 1분 사이**에 클라이언트가 끊김
- 에러 메시지:
```
  LogNet: Warning: Host closed the connection.
```
  또는
```
  LogNet: NetDriver: connection timeout.
```
- 호스트 코드 변경 없음, 네트워크 설정 변경 없음
- **갑자기** 발생 — 어제까지는 정상이었는데

호스트 화면은 멀쩡하다. 호스트는 본인 프레임 부하만 인지할 뿐, "Host closed" 메시지는 클라이언트 쪽에만 나타난다. 호스트 화면만 보면 false negative — 문제가 없는 것처럼 보인다.

---

## 2. 가설 추적

### 가설 1: 네트워크 설정 문제 (틀림)

처음엔 당연히 네트워크를 의심했다. 메시지가 "Host closed the connection"이니까.

```cpp
// 의심한 것들
- bUseFixedFrameRate 설정?
- NetUpdateFrequency가 너무 낮은가?
- ConnectionTimeout 값?
- KeepAliveTime 조정?
```

이것들을 만져봤지만 — **무효**. 증상 그대로.

### 가설 2: 자기장 silent fail과 같은 시점 (헷갈림)

같은 D-1에 발견한 `bAlwaysRelevant` 누락으로 인한 자기장 silent fail이 있었다. 한 번에 같은 시점에 발생해서 잠깐 혼선이 있었지만, 별개 이슈로 분리.

(이 이슈는 시리즈 2편에서 다룬다.)

### 가설 3: 로그 출력량 (결정적)

콘솔 출력 창을 보다가 위화감을 느꼈다.

**같은 패턴의 로그가 비정상적으로 빠르게 흘러간다.**

Output Log를 5초만 관찰해도 같은 메시지가 100줄 넘게 도배되어 있다. 코드를 grep해보니:

```cpp
// 백그라운드 액터의 Tick 안
void ABackgroundActor::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    // 개발 중에 박아둔 "여기까지 도달" 로그
    UE_LOG(LogTemp, Log, TEXT("BackgroundActor Tick: %s"), *GetActorLocation().ToString());

    // 기타 매 프레임 로그들...
}
```

이런 코드가 여러 액터에 흩어져 있었다. 개발 초기에 "여기까지 도달 확인"용으로 박아둔 것들이 그대로 남아있었다.

---

## 3. 진짜 원인 — UE_LOG의 누적 비용

### UE_LOG의 실제 비용

`UE_LOG`는 다음 단계를 거친다:

1. **포맷 문자열 평가** — `%s`, `%d` 같은 형식 지정자 처리 (string concatenation)
2. **`FString` 할당 + GC 대상 등록**
3. **mutex lock** (로그는 thread-safe)
4. **콘솔 출력** (Editor) — UI thread에 메시지 큐 푸시
5. **파일 IO** (`Saved/Logs/*.log`) — disk write
6. **Verbosity 필터링 후 drop 결정**

단일 호출 ≈ 수십 µs. 큰 비용 아니다.

**그러나** — 60FPS × 5개 액터 × 매 Tick = 초당 300 호출 = 한 프레임당 5회 호출 = 프레임당 100~500 µs 추가 시간.

프레임 시간이 16.6ms (60FPS 기준)를 넘어가면 프레임 드롭. 누적이 더 심해지면 200ms도 가능.

### Listen Server keepalive 메커니즘

여기서 결정적인 게 발생한다. UE5 NetDriver는 클라이언트마다 주기적으로 keepalive 패킷을 송수신한다.

```cpp
// 엔진 기본값 (UNetDriver)
ConnectionTimeout = 60.0f;          // 60초
InitialConnectTimeout = 60.0f;
KeepAliveTime = 0.2f;               // 0.2초마다 keepalive
```

호스트 프레임 시간이 200ms 넘어가는 순간 — keepalive 송신 시점이 밀린다. 클라이언트는 응답을 못 받고 `ConnectionTimeout`을 판정한다.

→ 클라이언트 입장에서 보는 것: **"Host closed the connection"**

**호스트가 실제로 disconnect한 게 아니다.** 호스트가 너무 느려서 클라이언트가 "끊은 걸로 간주" 판정한 것이다.

이 진단이 결정적이었다. 에러 메시지는 네트워크 레이어에 표시되지만, 본질은 그 위 레이어(로그 시스템)의 부하였다.

---

## 4. 해결

### 한 줄 요약: 매 프레임 UE_LOG 제거

```cpp
// 변경 전
void ABackgroundActor::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    UE_LOG(LogTemp, Log, TEXT("Pos=%s"), *GetActorLocation().ToString()); // 제거
    // ...
}

// 변경 후
void ABackgroundActor::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    // 로그 제거. 필요하면 상태 변화 시만.
}
```

코드 전체를 grep으로 `Tick` + `UE_LOG` 조합 검색 후, 발견된 진단용 로그를 모두 제거하거나 `VeryVerbose` 레벨로 강등.

### 결과
- "Host closed the connection" 즉시 사라짐
- 프레임 시간 정상 (16ms 이하)
- 매치 안정성 회복 → 베타 시연 무사 완수

---

## 5. 안전한 로깅 패턴

### A. 조건부 로그 — 상태 변화 시만

```cpp
void AMyActor::Tick(float Dt)
{
    Super::Tick(Dt);

    if (LastPhase != CurrentPhase)
    {
        UE_LOG(LogTemp, Log, TEXT("Phase change %d → %d"), LastPhase, CurrentPhase);
        LastPhase = CurrentPhase;
    }
}
```

### B. 빈도 throttle — 초당 1회

```cpp
void AMyActor::Tick(float Dt)
{
    Super::Tick(Dt);

    LogAccum += Dt;
    if (LogAccum >= 1.0f)
    {
        LogAccum = 0.0f;
        UE_LOG(LogTemp, Log, TEXT("HP=%.1f"), HP);
    }
}
```

### C. Verbosity 강등 + Config 차단

```cpp
UE_LOG(LogTemp, VeryVerbose, TEXT("매 프레임 가능"));
```

```ini
; DefaultEngine.ini
[Core.Log]
LogTemp=Log    ; VeryVerbose 차단
```

### D. Shipping 빌드 자동 제거

```cpp
#if !UE_BUILD_SHIPPING
    UE_LOG(LogTemp, Log, TEXT("Debug: %s"), *Info);
#endif
```

출하 빌드에서 자동으로 제거된다. 디버그 코드가 시연 빌드에 섞이는 사고 방지.

---

## 6. 진단 — 로그 출력량 측정

비슷한 증상을 만났을 때 빠르게 확인하는 방법:

```
1. Editor → Output Log 창
2. 매치 시작 후 5초 관찰
3. 같은 패턴이 100줄 이상이면 의심
4. 콘솔: stat unit       — Game/Draw/GPU 프레임 시간 확인
5. 콘솔: stat unitgraph  — 그래프로 spike 시각화
```

`stat unit` 결과 Game 항목이 16ms를 넘으면 CPU 병목. UE_LOG 제거 후 다시 측정해서 즉시 회복되면 원인 확정.

---

## 7. 함정/주의사항

이번 사례에서 도출한 추가 함정들:

### "Host closed the connection" = 호스트 문제 X
실제로는 호스트 프레임 시간 폭증 → 클라가 timeout 판정. **네트워크 코드를 의심하면 헛수고.**

### Verbose 강등도 안전 아님
```cpp
UE_LOG(LogTemp, Verbose, TEXT("..."));   // 포맷 문자열 평가는 항상 발동
```
Verbosity는 출력만 막는다. 포맷 처리 비용은 여전. 진짜 안전한 건 `#if !UE_BUILD_SHIPPING` 매크로 또는 호출 자체 제거.

### `GEngine->AddOnScreenDebugMessage`도 같은 위험
Tick에서 호출 시 화면 메시지 큐 폭증 + GC 부담.

### `%s` + `*FString::Printf` 조합 특히 비쌈
임시 FString 생성 + 복사 + 해제. Tick에서는 절대 금지.

### Component 다수 × 같은 로그 = 누적 폭발
매니저 1개 + 자식 컴포넌트 10개 = 60FPS × 11 = 매 프레임 11회 호출. 같은 cpp 코드라도 인스턴스마다 별도 호출.

### 짧은 주기 Timer도 동등 위험
```cpp
SetTimer(H, this, &MyClass::Log, 0.05f, true);  // 20Hz
```
60FPS Tick의 1/3 빈도지만 누적 동일 위험.

### Tick 직접 override만 위험한 게 아님
- `TickComponent` (Component Tick)
- `BlueprintCallable` 함수가 BP Tick에서 호출되는 경우
- 짧은 주기 Timer

모두 같은 위험.

---

## 8. 메타 휴리스틱

이 사례에서 도출한 일반 규칙:

### 1. "미들웨어 에러"가 본질이 아닐 수 있음
네트워크 에러는 네트워크 문제가 아니라, 그 위 레이어 부하의 결과일 수 있다. 에러 메시지가 가리키는 레이어에서만 디버깅하면 본질을 못 찾는다.

### 2. 누적 부하는 단일 검증으로 안 보임
코드 리뷰에서 "1회 호출은 무시 가능"으로 통과한 게 누적되면 본질이 된다. **누적은 단일과 다른 차원의 문제**라는 인식.

### 3. 개발용 진단 코드의 운명 = 시연 전 제거
처음부터 `#if !UE_BUILD_SHIPPING` 매크로로 보호하면 자동 제거. 안 했으면 시연 체크리스트에 명시. **"제거 절차"가 워크플로우의 일부**여야 한다.

### 4. PIE 환경별 검증 분리
- 싱글 PIE
- Listen Server
- Standalone Client

모두 별개 검증. 한 환경 OK가 다른 환경 OK 아님. 누적 부하는 Listen Server 같은 다중 노드 환경에서 처음 드러나는 경우가 많다.

---

## 9. 다음 프로젝트 체크리스트

새 Tick / 매 프레임 코드 작성 시:

- [ ] Tick / TickComponent 안에 `UE_LOG` 절대 금지
- [ ] Timer interval 1초 이상 권장 (디버그용도면 5초)
- [ ] 상태 변화 시만 로그 (Last vs Current 비교)
- [ ] PIE Listen Server 2~3 클라이언트로 1분 이상 유지 검증
- [ ] `stat unit` 결과 Game < 16ms 유지
- [ ] 시연 직전 모든 `UE_LOG` 제거 또는 Verbosity 강등
- [ ] `#if !UE_BUILD_SHIPPING` 매크로로 출하 빌드 자동 제거
- [ ] "Host closed" 발생 시 가장 먼저 로그 출력량 의심

---

## 마치며

베타 D-1에 발견한 4건의 silent fail 중 하나였다. 다른 세 건(bAlwaysRelevant 누락, 무기 슬롯 Pistol 분기 누락, PlayerStart PIE 트랩)은 시리즈의 나머지 글에서 다룬다.

이 사례가 가르쳐준 가장 큰 교훈은 — **"에러 메시지를 액면가 그대로 받지 말라"** 는 것.

"Host closed the connection"이라고 쓰여 있어도 호스트 코드 문제가 아닐 수 있고, "NetDriver timeout"이라고 쓰여 있어도 네트워크 문제가 아닐 수 있다. 메시지는 증상이지 원인이 아니다.

다음 프로젝트에서는 검증 시점을 D-1이 아닌 D-3~D-5로 당기고, 매 프레임 진단 코드는 처음부터 `#if !UE_BUILD_SHIPPING`으로 보호할 계획이다.

---

## 참고 자료

- [UE5 Documentation — UE_LOG](https://docs.unrealengine.com/)
- UE5.7 `UNetDriver` 소스 코드 (ConnectionTimeout, KeepAliveTime 기본값)
- `stat unit` 콘솔 명령
- 본인 Obsidian Vault: `202605192230-ue5-tick-ue-log-spam-host-disconnect-trap.md`