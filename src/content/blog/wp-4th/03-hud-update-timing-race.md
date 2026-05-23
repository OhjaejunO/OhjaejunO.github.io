---
title: "[UE5 멀티플레이] HUD가 첫 픽업을 놓치는 이유 — BP Event vs BeginPlay 타이밍 레이스와 Delegate 패턴"
description: "Tick 폴링 → Delegate → 그런데 첫 무기는 HUD에 안 뜬다? cpp BlueprintImplementableEvent와 BP BeginPlay의 race condition을 발견하고 '초기 동기화 + 이벤트 주도' 패턴으로 해결한 과정"
date: 2026-05-23
category: 회고
series: wp-4th
seriesPart: 3
tags: [UE5, C++, UMG, HUD, Delegate, Replication, BlueprintImplementableEvent, 디버깅, Apex]
---

> 🎯 **WP_4th — Apex Legends FFA 모작 회고 시리즈**
>
> - 1편: Host closed the connection — 매 프레임 UE_LOG 트랩
> - 2편: bAlwaysRelevant Silent Fail — 무기가 클라이언트에서 안 보이는 이유
> - **3편: HUD가 첫 픽업을 놓치는 이유 — BP Event vs BeginPlay 타이밍 레이스** ← 현재 글
> - 4편: PlayerStart PIE 트랩 — ChoosePlayerStart override 사례 (예정)

## 들어가며

HUD가 처음엔 0으로 떠 있다가, 두 번째 픽업부터 정상 갱신되는 버그를 만났다.

```
게임 시작 → 캐릭터 R-301 자동 장착 → HUD에 탄약 안 뜸 (0/0)
G로 드롭 → 다시 R-301 픽업 → 그제서야 HUD 갱신됨 (28/180)
```

처음엔 위젯 코드 의심. 그 다음에는 Delegate 바인딩 의심. 결국 진짜 원인은 — **cpp의 `BlueprintImplementableEvent`가 BP의 `Event BeginPlay`보다 먼저 발사된다**는 것.

이 글은 그 race condition을 발견한 과정과, "초기 동기화 + 이벤트 주도" 패턴으로 해결한 기록이다.

---

## 1. 처음엔 Tick 폴링으로 시작했다 (안티패턴)

HUD가 처음 동작하지 않으니 가장 단순한 접근부터 시도. 매 프레임 캐릭터 상태를 체크해서 갱신.

```cpp
// ❌ 안티패턴
void UAmmoCounterWidget::NativeTick(const FGeometry& Geo, float Dt)
{
    Super::NativeTick(Geo, Dt);

    if (!OwnerCharacter) return;

    int32 Current = OwnerCharacter->GetReserveAmmo(EAmmoType::Light);
    if (Current != CachedValue)
    {
        UpdateText(Current);
        CachedValue = Current;
    }
}
```

작동은 한다. 그런데:
- **매 프레임 함수 호출** (60FPS 기준 초당 60회)
- 값이 안 변해도 항상 체크
- 캐시 비교 로직을 위젯마다 직접 작성
- 캐릭터에 위젯 다수 구독 시 코드 중복

**HUD는 "변경 시에만 갱신"되면 되는 거지, 매 프레임 폴링할 이유가 없다.** Tick으로 가는 순간 push 모델이 아닌 pull 모델로 돌아간 거.

---

## 2. Delegate 패턴으로 리팩터링

UE5에서 HUD 갱신의 정석은 **Dynamic Multicast Delegate**다. 상태 소유자가 변경 시 Broadcast, 위젯은 구독만.

### 비교

| 항목 | Tick 폴링 | Delegate |
|------|-----------|----------|
| 호출 빈도 | 매 프레임 (60+/sec) | 변경 시 1회 |
| CPU | 낭비 (안 변해도 체크) | 최소 |
| 누락 위험 | 캐시 비교 로직 직접 작성 | 자동 |
| 코드 가독성 | "왜 매 프레임 체크?" | 의도 명확 |
| 멀티 구독 | 어려움 | `MULTICAST_DELEGATE`로 자연스럽게 |

### 구현 — 캐릭터 측

```cpp
// AWeaponTestCharacter.h — UCLASS 바깥에 선언!
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FOnReserveAmmoChanged,
    EAmmoType, AmmoType,
    int32, NewCount);

UCLASS()
class AWeaponTestCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintAssignable, Category = "Ammo")
    FOnReserveAmmoChanged OnReserveAmmoChanged;
};
```

**제약 사항** (놓치면 빌드 에러):
- `DECLARE_DYNAMIC_MULTICAST_DELEGATE_*` 매크로는 **UCLASS 바깥**에 선언
- `BlueprintAssignable` 지정자 필수 (BP에서 Bind 가능하게)
- `Dynamic` 변형은 BP 호환, `Multicast`는 다중 구독 가능

### 변경 시 Broadcast

```cpp
void AWeaponTestCharacter::AddReserveAmmo(EAmmoType Type, int32 Amount)
{
    int32 OldValue = GetReserveAmmo(Type);
    SetReserveAmmo(Type, OldValue + Amount);

    // 변경 시에만 알림
    OnReserveAmmoChanged.Broadcast(Type, GetReserveAmmo(Type));
}
```

### 위젯 측 — BP에서 바인딩

```
[BeginPlay]
   ↓
[Get Player Character] → [Cast to BP_WeaponTestCharacter]
   ↓
[Bind Event to OnReserveAmmoChanged]
   ↓
[Custom Event: HandleAmmoChanged]
   ↓
[Update Display]
```

**Tick 0회. 깔끔.** 픽업하면 즉시 갱신, Reload하면 즉시 갱신. 완벽해 보였다.

---

## 3. 그런데 — 첫 무기는 HUD에 안 뜬다

배포 빌드 검증 중 발견. 캐릭터가 자동으로 R-301을 들고 시작하는데, HUD에는 0/0으로 표시. G로 드롭한 후 다시 픽업하면 정상.

**가설들**:
1. Delegate 바인딩 실패? → Print String 박아보니 BeginPlay에서 정상 바인딩됨
2. 캐릭터 측 초기 무기 장착이 BeginPlay 전? → 로그 찍어보니 cpp BeginPlay에서 정상 호출
3. 위젯 생성 타이밍이 다른가? → 여기서 진실에 도달

---

## 4. 진짜 원인 — BP Event vs BeginPlay race condition

### 액터 초기화 순서

UE5 액터 초기화는 다음 순서로 일어난다:

```
1. cpp BeginPlay (네이티브)
   ├─ 초기 무기 장착 로직 실행
   └─ BP_OnWeaponEquipped(NewWeapon) 호출  ← BlueprintImplementableEvent

2. BP Event BeginPlay (그래프)
   ├─ Create Widget (WBP_AmmoCounter) 
   ├─ AmmoCounterWidget 변수에 저장
   └─ Bind Event to OnReserveAmmoChanged
```

**문제**: cpp `BeginPlay`나 그 후속 호출에서 `BlueprintImplementableEvent`를 발사하면, BP 그래프의 `Event BeginPlay`보다 **먼저 도착**할 수 있다.

### 실제 일어난 일

```cpp
// cpp 측
void AWeaponTestCharacter::BeginPlay()
{
    Super::BeginPlay();
    
    // 초기 무기 자동 장착
    SwitchWeaponByID(StartWeaponID);  // 내부에서 BP_OnWeaponEquipped 호출
}

void AWeaponTestCharacter::SwitchWeaponByID(FName WeaponID)
{
    // 무기 교체 로직...
    BP_OnWeaponEquipped(NewWeapon);  // ← 이 시점에 BP BeginPlay 아직 안 돌음
}
```

BP 측 그래프:
```
Event On Weapon Equipped (NewWeapon)
   ↓
[IsValid (AmmoCounterWidget)] ← nullptr이라 False
   ↓
Skip (조용히 죽음)
```

**`AmmoCounterWidget`은 BP BeginPlay에서 `Create Widget`으로 만들어진다.** cpp가 이벤트를 먼저 발사한 시점에 이 변수는 여전히 nullptr. `IsValid` 가드에서 조용히 막힘.

→ 첫 무기의 HUD 이벤트가 nullptr 가드에서 죽고, 두 번째 픽업(이미 BP BeginPlay 이후)부터 정상 작동.

### 왜 PIE에서는 가끔 작동하나

PIE는 디버그 모드라 초기화 순서가 약간 다를 수 있다. 이 race는 **PIE에서는 잘 안 보이고 Standalone/패키지 빌드에서 더 자주 발생**한다. 빌드 후 검증에서 처음 드러난 이유.

---

## 5. 해결 — "초기 동기화 + 이벤트 주도" 패턴

해결책은 두 갈래로 가야 한다. 둘 중 하나만 하면 깨진다.

### A. BP BeginPlay 끝에서 명시적 초기 갱신

```
Event BeginPlay
   ↓
[Is Locally Controlled?] (Branch)
   ↓ True
[Create Widget (WBP_AmmoCounter)] → [AmmoCounterWidget]
   ↓
[Add to Viewport]
   ↓
[SET Owner Weapon = CurrentWeapon]  ← 현재 상태 명시 주입
   ↓
[Rebind Delegates]
   ↓
[Update Display]  ← 초기 HUD 갱신 강제
```

**핵심**: 위젯 생성 + 바인딩 후, **현재 상태로 명시적 1회 호출**. "바인딩만으로는 현재 값을 모름". 바인딩 ≠ 첫 값 받기.

### B. 이벤트 핸들러는 IsValid 가드로 안전 skip

```
Event On Weapon Equipped (NewWeapon)
   ↓
[IsValid (AmmoCounterWidget)?] (Branch)
   ↓ True → [SET Owner Weapon = NewWeapon] → [Rebind] → [Update Display]
   ↓ False → (조용히 skip — BeginPlay 전 호출이라 안전)
```

이벤트가 BeginPlay 전에 와도 crash 안 남. 그리고 BeginPlay에서 어차피 초기 동기화 단계가 있으니 누락도 없음.

### 두 갈래의 의미

- **초기 동기화 (A)**: "위젯이 처음 생성됐을 때 현재 상태를 한 번 더 적용"
- **이벤트 주도 (B)**: "이후 변경은 Broadcast로만 받아서 갱신"

cpp 측 코드는 그대로. BP 그래프에 두 분기만 잘 짜면 끝.

### Cpp 측 — 위젯 재바인딩 헬퍼

C++ 위젯의 경우 helper를 만들어두면 깔끔:

```cpp
void UAmmoCounterWidget::RebindEvents(AWeaponTestCharacter* Character)
{
    if (!Character) return;

    // 기존 바인딩 제거 (중복 방지)
    Character->OnReserveAmmoChanged.RemoveDynamic(this, &UAmmoCounterWidget::HandleAmmoChanged);
    Character->OnReserveAmmoChanged.AddDynamic(this, &UAmmoCounterWidget::HandleAmmoChanged);

    // ⚠️ 바인딩만으로는 현재 값 모름 → 명시적 초기 호출 필수
    HandleAmmoChanged(EAmmoType::Light,   Character->GetReserveAmmo(EAmmoType::Light));
    HandleAmmoChanged(EAmmoType::Heavy,   Character->GetReserveAmmo(EAmmoType::Heavy));
    HandleAmmoChanged(EAmmoType::Energy,  Character->GetReserveAmmo(EAmmoType::Energy));
    HandleAmmoChanged(EAmmoType::Shotgun, Character->GetReserveAmmo(EAmmoType::Shotgun));
}
```

---

## 6. 멀티플레이로 가니 또 다른 문제 — 늦은 join

싱글에서는 위 패턴으로 해결. 그런데 멀티플레이 검증에서 새 이슈.

**증상**: 호스트가 매치 시작 후 클라이언트가 늦게 join하면 — 클라이언트의 HUD가 초기 무기 상태를 모름.

호스트는 이미 R-301 들고 있는데, 늦게 들어온 클라이언트 화면에서는 호스트 무기가 보이긴 하지만 무기 교체 이벤트가 다시 발사되지 않으니 클라이언트 HUD는 갱신 안 됨.

### 옵션 검토

| 옵션 | 방식 | 한계 |
|------|------|------|
| B — Multicast RPC만 | 서버가 모든 클라에 직접 명령 | **늦게 join한 클라는 명령 못 받음** ← 이게 문제 |
| C — Replicated만 (OnRep 없음) | 변수 동기화만 | 시각 적용 시점 제어 못 함 |
| **A — Replicated + OnRep + Multicast** | 상태는 변수, 일회성 효과는 RPC | 상태 동기화 + 시각 제어 + 늦은 join 안전 |

**옵션 A 채택**.

---

## 7. 옵션 A 패턴 — Replicated + OnRep + Previous Tracker

### 1) 상태 변수 셋업

```cpp
// AWeaponTestCharacter.h
UPROPERTY(ReplicatedUsing = OnRep_CurrentWeapon)
AWeaponBase* CurrentWeapon;

UPROPERTY()  // Replicated 아님! 각 머신 로컬 트래커
AWeaponBase* PreviousWeapon;

UFUNCTION()
void OnRep_CurrentWeapon();
```

### 2) OnRep — Previous 비교 + 시각 적용

```cpp
void AWeaponTestCharacter::OnRep_CurrentWeapon()
{
    if (CurrentWeapon != PreviousWeapon)
    {
        ApplyWeaponVisuals(PreviousWeapon, CurrentWeapon);
        PreviousWeapon = CurrentWeapon;
    }
}

void AWeaponTestCharacter::ApplyWeaponVisuals(AWeaponBase* Old, AWeaponBase* New)
{
    if (Old) Old->SetActorHiddenInGame(true);
    if (New) 
    { 
        New->SetActorHiddenInGame(false); 
        New->AttachToHand(this);
    }
    BP_OnWeaponEquipped(New);  // BP HUD 갱신
}
```

### 3) DOREPLIFETIME 등록

```cpp
void AWeaponTestCharacter::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const
{
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME(AWeaponTestCharacter, CurrentWeapon);
    DOREPLIFETIME(AWeaponTestCharacter, CurrentSlot);
}
```

### Previous Tracker가 필요한 이유

OnRep은 변수가 동기화될 때마다 호출된다. 그런데 **같은 값이 여러 번 동기화될 수도 있다** (특히 Relevancy 변화 시). Previous와 비교해서 **실제 변경에만** 시각을 트리거 → 무기 재장착 깜빡임/이펙트 중복 방지.

### 늦은 join이 해결되는 원리

```
[새 클라 join]
   ↓
[NetDriver가 CurrentWeapon 값 동기화]
   ↓
[클라이언트 측 OnRep_CurrentWeapon 자동 발사]
   ↓
[ApplyWeaponVisuals 실행 → BP_OnWeaponEquipped → HUD 갱신]
```

명령(RPC) 대신 **상태 변수**를 동기화하니까, 늦게 join한 클라이언트도 최신 상태를 받아서 시각이 따라옴. 옵션 B(Multicast RPC만)와 차이가 여기서 난다.

---

## 8. 함정/주의사항

이번 사례에서 도출한 추가 함정들:

### BP BeginPlay 끝에서 초기 갱신 누락 = 첫 이벤트 손실
"바인딩 = 첫 값 받기"라고 착각하기 쉽다. **바인딩은 미래의 변경만 받는다.** 현재 값은 명시적으로 1회 호출해야 함.

### IsValid 가드 없이 이벤트만 처리 = nullptr crash
BP BeginPlay 전에 이벤트가 오면 위젯 nullptr. 위젯 메서드 호출 시 crash. `IsValid` 가드는 안전망이지 옵션 아님.

### PIE에서 잘 안 보이는 race
이 타이밍 문제는 **Standalone/패키지 빌드에서 더 자주** 발생. 초기화 타이밍이 다름. PIE만으로는 검증 부족.

### Previous Tracker에 `UPROPERTY(Replicated)` 붙이면 안 됨
각 머신 로컬 트래커여야 함. Replicated 붙이면 의미 무효화 (서버 값으로 덮어쓰기 됨).

### OnRep은 클라에서만 호출됨
서버에서 같은 시각 적용을 하려면 변경 함수에서 직접 ApplyVisuals 호출하거나 OnRep을 서버에서도 수동 호출.

### nullptr 처리 빼먹으면 ghost weapon
빈손 상태에서 crash 또는 R-301 자동 부활 같은 회귀 발생. `if (Old)`, `if (New)` 분기는 안전망.

### DOREPLIFETIME 누락 = 조용한 실패
컴파일은 되는데 동기화 안 됨. 빌드 성공 = 동기화 보장 아님.

### Display 자체에도 클리어 분기 필요
드롭으로 빈손 → `CurrentWeapon = nullptr` → `Update Display`의 Branch False 분기에 `Set Text("")` 추가. 안 그러면 잔존 텍스트 남음.

---

## 9. 메타 휴리스틱

이 사례에서 도출한 일반 규칙:

### 1. HUD = 게임 상태의 view, push 모델로
Tick 폴링은 마지막 수단. 데이터 소유자가 변경 알림을 발행하고, 위젯은 구독만 한다. **Pull 모델로 가는 순간 위젯이 모든 책임을 진다.**

### 2. 초기화 순서를 안다 = race 함정 회피
cpp BeginPlay → BP BeginPlay 순서 안 지키는 게 `BlueprintImplementableEvent`. 그래서 **"초기 동기화 + 이벤트 주도" 패턴**이 정답.

### 3. 동기화는 명령이 아닌 상태로
Multicast RPC는 늦게 join한 클라이언트를 못 받는다. **상태 변수 + OnRep**으로 가야 미래의 모든 join에 대응 가능.

### 4. PIE 검증 = 완전한 검증 아님
PIE는 디버그 환경이라 초기화 타이밍이 빌드 버전과 다를 수 있다. **Standalone 또는 패키지 빌드로 한 번 검증**해야 진짜 안정성 확인.

---

## 10. 다음 프로젝트 체크리스트

새 HUD/위젯 시스템 작성 시:

- [ ] Tick으로 폴링하지 말 것 (변경 시 알림 패턴)
- [ ] `DECLARE_DYNAMIC_MULTICAST_DELEGATE_*`는 UCLASS 바깥에 선언
- [ ] `BlueprintAssignable` 지정자 빠뜨리지 말 것
- [ ] BP BeginPlay 끝에서 **초기 갱신 1회 명시적 호출**
- [ ] 이벤트 핸들러에 `IsValid` 가드 필수
- [ ] 멀티플레이 상태는 Multicast RPC가 아닌 `Replicated + OnRep`
- [ ] Previous Tracker로 실제 변경에만 시각 트리거
- [ ] `DOREPLIFETIME` 등록 검증
- [ ] 빈손/nullptr 케이스의 Display 클리어 분기 추가
- [ ] PIE 외 Standalone/패키지 빌드로 race condition 검증

---

## 마치며

세 단계로 진화한 HUD 갱신 시스템이었다.

1. **Tick 폴링**: 작동하지만 비효율
2. **Delegate 패턴**: 깔끔하지만 race condition 발견
3. **초기 동기화 + Replicated OnRep**: 싱글+멀티 모두 안정

이번 사례가 가르쳐준 가장 큰 교훈은 — **"바인딩이 시작이 아니다"** 는 것.

`Bind Event` 한 순간 모든 게 자동으로 되는 것 같지만, 그건 **미래의 변경에 대한 약속**일 뿐이다. 현재 값은 따로 챙겨야 한다. 그게 "초기 동기화 + 이벤트 주도" 패턴의 핵심.

그리고 멀티플레이로 가면 또 한 단계 — 명령이 아닌 상태로 동기화해야 늦게 join한 클라이언트도 잡힌다. **명령은 한 번 지나가지만 상태는 항상 거기 있다.**

---

## 참고 자료

- [UE5 Documentation — Delegates](https://docs.unrealengine.com/)
- [UE5 Documentation — Property Replication](https://docs.unrealengine.com/)
- UE5.7 `DECLARE_DYNAMIC_MULTICAST_DELEGATE_*` 매크로
- 본인 Obsidian Vault:
  - `202605110201-ue5-bp-event-vs-beginplay-race.md`
  - `202605110202-ue5-multiplayer-option-a-pattern.md`
  - `2026050604-UE5-Delegate-Pattern-HUD-Update.md`