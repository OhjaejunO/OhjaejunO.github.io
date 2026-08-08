---
title: "공장 시뮬레이션 게임 개발기 Phase 4.3 — 사다리: 부유 슬래브로 오르는 수직 등반"
description: "14·15편에서 Foundation으로 평평한 판을 지형 위에 띄워 올렸더니, 정작 캐릭터가 그 위로 올라갈 방법이 없었다. 사다리를 붙이는 건 쉬웠지만 '제대로 타는' 건 어려웠다 — 트리거에 닿자마자 빨려 들어가고, 상면을 걷다가 등반으로 오인되고, 올라설 때 몸이 위로 튀고, Foundation을 부수면 사다리가 공중에 남았다. 감지와 시작의 분리, 커스텀 수직 무브먼트, 애니메이션 평탄화, cascade 철거로 하나씩 풀어간 기록."
date: 2026-06-24
category: UE5
series: factory-sim
seriesPart: 17
tags: [UE5, C++, 사다리, 등반, 애니메이션, Foundation]
draft: false
---

> 🏭 **공장 시뮬레이션 게임 개발기 — Phase 4: 건축 — Foundation**
> - 4.1편: [Foundation 기초](/blog/factory-sim/14-foundation-basics)
> - 4.2편: [높이 재설계·램프](/blog/factory-sim/15-foundation-height-redesign-ramp)
> - **4.3편: 사다리 — 부유 슬래브로 오르는 수직 등반** ← 현재 글
> - (이어지는 편: 경사 컨베이어·메시 개편 — 예정)

14·15편에서 Foundation을 만들었다. 울퉁불퉁한 지형 위에 평평한 판을 N단 띄워 올리는 시스템 — 상면 높이는 평면 + 두께 + N×100으로 계산되고, 판끼리는 경사 램프로 이었다.

그런데 빌드를 돌려보니 멍청한 문제가 있었다. **그 위로 캐릭터가 올라갈 수가 없었다.** 지면에 서 있는 캐릭터와 공중에 떠 있는 슬래브 사이에 아무 연결이 없었다. 램프(15편)는 판과 판을 잇는 거지, 지면에서 첫 판으로 올라가는 수단은 아니었다.

답은 사다리였다. Foundation 변에 세로로 붙여서, 지면에서 슬래브 위로 오르는 수직 통로. 붙이는 것 자체는 금방 했다. 문제는 **'제대로 타게' 만드는 것**이었다 — 그 과정에서 만난 네 가지 함정이 이 글의 뼈대다.

---

## 1. 감지와 시작을 분리하다

처음엔 당연하게 만들었다. 사다리에 오버랩 박스를 달고, 캐릭터가 닿으면 등반 시작. 동작은 했다. 그런데 느낌이 나빴다.

캐릭터가 사다리 근처를 **지나가기만 해도** 트리거에 닿는 순간 등반 상태로 빨려 들어갔다. 옆으로 걸어가려던 건데 사다리가 강제로 붙잡는 거다. 일종의 순간이동처럼 느껴졌다.

그래서 **감지와 시작을 분리**했다. 이게 사다리 시스템에서 가장 중요한 결정이다.

오버랩은 '근접 감지'만 한다. `ClimbTrigger`(Pawn 오버랩 전용 박스)의 BeginOverlap은 등반을 시작하지 않는다. 단지 플레이어에게 "근처에 사다리 후보가 있다"고 포인터(`OverlappingLadder`)만 등록한다.

**실제 등반 시작은 W(앞으로) 입력 때** `Move()`에서 일어난다. 즉 사다리에 닿는 것과 사다리를 타는 것이 분리됐다. 닿기만 하면 안 타지고, W를 눌러야 탄다. 덤으로, 이미 트리거 안에 있어도 W로 시작할 수 있으니 진입이 더 자연스러워졌다.

여기에 **진입 가드**가 하나 더 붙는다. 발 Z가 사다리 하단 + 80uu(`ClimbEntryZTolerance`) 이내일 때만 등반이 시작된다. 이게 없으면 고약한 버그가 난다 — 슬래브 **상면을 걸어 다니는** 캐릭터가 사다리 전체 높이 트리거에 닿아서 등반으로 오인되고, 올라서기·미끄러지기를 무한 반복한다. 밑동에서만 진입을 허용해 이걸 차단했다.

> ⚠️ MVP 범위: 상면에서 사다리를 타고 **내려가는** 등반은 아직 미지원이다. 올라가기 전용. 진입 가드가 밑동 전용이라 자연히 그렇게 됐고, 하강은 다음 반복으로 미뤘다.

---

## 2. 등반은 텔레포트가 아니다 — 커스텀 수직 무브먼트

등반을 시작했다고 캐릭터를 사다리 꼭대기로 순간이동시키면 안 된다. 사다리는 **타는 맛**이 있어야 한다. 그래서 등반을 커스텀 무브먼트로 구현했다.

`BeginClimb`에서 캐릭터 무브먼트를 `MOVE_Flying` + `GravityScale=0`으로 바꾼다. 중력을 끄고, W/S로 수직 이동(`ClimbSpeed=250`)을 직접 제어한다. 텔레포트가 아니라 진짜로 한 칸씩 올라간다.

<video autoplay muted loop playsinline src="/videos/blog/factory-sim/b17-ladder.mp4"></video>

```cpp
void AOJJ_Player::BeginClimb(AOJJ_Ladder* Ladder)
{
    if (!Ladder || CurrentLadder || bSteppingOff) return;   // 단일 진실원

    CurrentLadder = Ladder;
    bClimbing = true;
    bFinishPlaying = false;

    // 사다리를 마주보게 1회 정렬(yaw만)
    const float FaceYaw = Ladder->GetStepOffDirection().Rotation().Yaw + LadderFacingYawOffset;
    SetActorRotation(FRotator(0.f, FaceYaw, 0.f));

    if (UCharacterMovementComponent* Movement = GetCharacterMovement())
    {
        Movement->SetMovementMode(MOVE_Flying);     // 중력 끄고 수직 비행
        Movement->GravityScale = 0.f;
        Movement->MaxFlySpeed = ClimbSpeed;
        Movement->StopMovementImmediately();
        Movement->bOrientRotationToMovement = false; // 등반 중 회전 고정
    }
}
```

두 가지가 더 들어갔다.

**마주보기 정렬.** 등반 시작 순간 캐릭터를 사다리 쪽으로 한 번 yaw 정렬하고, `bOrientRotationToMovement=false`로 등반 중 회전을 고정한다. 사다리를 옆으로 보면서 타는 어색함을 없앤 것. EndClimb에서 원래 회전 모드로 복원한다.

**종료 판정의 일관성.** 등반 종료를 EndOverlap에 맡기지 않았다. 트리거를 벗어나는 순간 등반을 끊으면, 등반 도중 캐릭터가 떨어진다. 그래서 상·하단 이탈은 전부 `Move()`의 도달 판정이 전담한다. 오버랩은 시작도 종료도 직접 하지 않는다 — 감지만 한다는 1절의 원칙이 끝까지 일관된다.

마지막으로 **경계 진동**을 막아야 했다. 사다리 끝과 시작 지점에서 등반이 켜졌다 꺼졌다 떨리는 현상인데, 세 겹의 가드로 잡았다 — 재진입 쿨다운(0.5초), 도달 히스테리시스(5uu 마진), step-off 보간 중 입력 잠금. 파라미터를 하나씩 나열하기보다, "경계에서 떨리지 않게 하는 3중 안전장치"로 묶어 이해하는 게 맞다.

---

## 3. 올라설 때 몸이 위로 튀었다 — 애니메이션 평탄화

기능은 다 됐는데 보기가 흉했다. 사다리 꼭대기에 올라서는 순간 캐릭터가 **위로 한 번 솟구쳤다.** 이중 솟구침이었다.

원인은 구조에 있었다. 수직 이동은 2절의 캡슐 비행이 전담한다. 그런데 올라서기(Finish) 몽타주에도 hips가 위로 올라가는 Root Motion 곡선이 들어있었다(f0=101 → peak=279). 비행이 캐릭터를 올리고 + 몽타주가 또 올리니, 두 번 솟구친 것이다.

해결은 **hips 평탄화**였다. Finish 몽타주의 hips 상승 곡선을 Loop 높이(128.4)로 완전히 눌러 평탄화했다(rise = 0). 즉 몽타주는 팔·다리 오버레이 포즈만 담당하고, 수직 이동은 오직 비행만 한다. 역할을 갈라놓은 것이다. (Root Motion은 계속 OFF.)

애니메이션 노출은 최소로 유지했다. C++이 ABP에 노출하는 건 `IsClimbing()` bool **하나뿐**이다. 올라가는지 내려가는지, 속도가 얼마인지는 별도 변수 없이 ABP가 `Velocity.Z`로 판별한다(위>0이면 Loop, 아래<0이면 Down). 스테이트머신은 손대지 않는다는 게 이 프로젝트의 애니메이션 철학이다.

Finish 몽타주는 **거리 트리거**로 재생한다. 꼭대기 도착 150uu 전 구간에서 1회 재생 — 도착하는 순간 재생하면 늦어서 뚝 끊기기 때문이다. 한 등반당 1회만 재생되게 가드도 걸었다.

그리고 **짧은 사다리 예외**. 등반 높이가 트리거 거리(150uu)보다 짧으면 Finish를 아예 스킵한다. 안 그러면 짧은 사다리에서 BeginClimb 직후 곧바로 Finish가 터져서 허공에 올라서는 모션이 나온다.

---

## 4. Foundation을 부수면 사다리가 공중에 남았다 — 높이 산출과 cascade 철거

사다리는 14·15편 Foundation 시스템 위에 얹혀 있다. 두 지점에서 직접 엮인다.

**높이 자동 산출.** 사다리 길이를 손으로 정하지 않는다. Foundation 상면 Z(14편 산식)에서 바깥 지면 Z(15편 지형 추종)를 빼서 등반 높이를 구한다.

```cpp
// 변(edge) 셀 = Foundation, 바깥 이웃 셀 = 지면. 높이 = 두 면 Z의 차.
float TopZ = 0.0f;
TargetGrid->GetFoundationSurfaceZ(BestEdgeCell, TopZ);            // 14편: Foundation 상면
const float GroundZ = OJJ_GetRawTerrainSurfaceZ(BestGroundCell);  // 15편: 지형 추종 Z
OutClimbHeight = TopZ - GroundZ;

// 위치 = 변셀·지면셀 중심의 중점(= 벽면 라인) → 4방향 변 모두 부착
const FVector WallMid = (EdgeCenter + GroundCenter) * 0.5f;
```

배치는 변(edge) 부착이다. H키 서브모드에서 커서가 Foundation을 덮으면, 4방향 이웃이 비-Foundation인 경계셀을 찾아 그 변 바깥 지면에 세로로 붙인다. Foundation 한 채의 네 면 어디에든 붙일 수 있다. (고스트 프리뷰는 14편부터 쓰던 그 시스템을 그대로 재사용한다 — 호버·프리뷰·배치가 같은 함수라 초록/빨강 색만 다르게 나온다.)

**cascade 철거.** 여기서 버그가 하나 있었다. 사다리는 그리드 장부에 등록하지 않는 자유 액터로 뒀다(MVP 결정 — 충돌 규칙 없이 겹침 허용). 그런데 그러다 보니 Foundation을 부수면 그 위에 붙어 있던 사다리가 **공중에 둥둥 남았다.** 그리드가 사다리의 존재를 모르니 같이 못 지운 것이다.

해결은 철거 전용 레이어였다. 점유 장부와는 별개로, `TMultiMap<지면셀, 사다리>` 매핑을 따로 뒀다. Foundation을 철거할 때 `OJJ_DestroyLaddersOnFoundation`이 OwningFoundation을 매칭해 딸린 사다리를 연쇄 삭제한다.

이 패턴은 처음이 아니다 — 10편 컨베이어 연쇄 삭제, 16편 WaterArea 등록/해제 대칭과 같은 모양이다. **"무언가를 만들면 부수는 경로도 같이 만든다."** 자원이든 건축물이든 사다리든, 생성과 소멸을 대칭으로 두지 않으면 반드시 유령이 남는다.

---

## 5. 정리 — 붙이는 건 쉽고, 타는 건 어렵다

사다리를 Foundation 변에 세우는 건 한나절이면 됐다. 시간이 걸린 건 전부 **'제대로 타는'** 부분이었고, 그게 네 개의 함정이었다.

| 함정 | 증상 | 해결 |
|---|---|---|
| 감지=시작 | 지나가다 빨려 들어감 | 오버랩은 감지만, W로 시작 + 밑동 진입 가드 |
| 텔레포트 | 순간이동하면 맛이 없음 | MOVE_Flying 커스텀 수직 무브먼트 |
| 이중 솟구침 | 올라설 때 몸이 튐 | Finish 몽타주 hips 평탄화(수직은 비행만) |
| 공중 사다리 | Foundation 부수면 떠 있음 | cascade 철거 전용 레이어 |

관통하는 원칙을 하나 꼽으면 — **"역할을 겹치지 않게 가른다."** 감지와 시작을 가르고, 수직 이동과 포즈 애니를 가르고, 생성과 철거를 대칭으로 둔다. 두 가지가 같은 일을 하려고 하면(비행도 올리고 몽타주도 올리고, 오버랩이 감지도 하고 시작도 하고) 반드시 충돌이 난다. 사다리는 작은 기능이지만, 그 교훈은 컸다.

Foundation 갈래(Phase 4)는 여기까지다. 다음 편은 경사 컨베이어와 메시 개편으로 넘어간다.

---

*이 글은 factory-space(UE5.7, C++) 개발 중 이슈 #184·#343 작업을 정리한 것입니다. 코드 스니펫은 실제 `OJJ_` 파일에서 발췌했으며, 가독성을 위해 일부 축약·일반화했습니다.*
