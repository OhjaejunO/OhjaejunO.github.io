---
title: SPLIT/SECOND MOCK
subtitle: UE5 아케이드 레이싱 데모
description: UE5와 Chaos Vehicles로 아케이드 레이싱 게임을 모킹한 팀 프로젝트. 플레이어 차량 시스템 전반을 담당.
category: GAME / RACING
badgeCategory: 회고
order: 1

period: 2026.02 - 2026.03 (약 1개월)
role: 플레이어 차량 시스템
teamSize: 팀 프로젝트
status: 완료
isTeamProject: true

techStack:
  - { label: Engine, value: UE5 }
  - { label: Language, value: "C++, Blueprint" }
  - { label: Physics, value: Chaos Vehicles }
  - { label: Effects, value: Niagara }
  - { label: Input, value: Enhanced Input }
badges: [UE5, C++, CHAOS VEHICLES, NIAGARA, ENHANCED INPUT]

links:
  github: https://github.com/Oh-Tack/ZeroZeroOne
  githubLabel: Team Repo · My Role 플레이어 차량 시스템
  blog: /blog/split-second/01-player-vehicle
  blogLabel: 블로그에서 자세히

keyFeatures:
  - 차량 기본 조작 (가속·브레이크·조향)
  - 물리 기반 드리프트 시스템 (히스테리시스 패턴)
  - 파워플레이 게이지·부스트 시스템
  - 차량 파괴·리스폰 시스템
  - 카메라 연출 (FOV 동적 변화·쉐이크·후방 카메라)
  - 이펙트·사운드 (드리프트 연기·엔진음·드리프트음)

keyLearnings:
  - title: Chaos Vehicle 팽이 현상 해결
    description: 단순 SetSteeringInput만 사용 시 팽이처럼 회전. FInterpTo로 각속도 보간 + Velocity Alignment로 진행 방향 보정해 해결.
    blogLink: /blog/split-second/01-player-vehicle
  - title: 히스테리시스 패턴 적용
    description: 드리프트 진입·유지 임계값을 다르게 설정(0.94/0.98)해 상태 떨림 방지.
  - title: 물리 리셋 패턴
    description: 리스폰 시 SetSimulatePhysics(false→true) 토글로 물리 상태 완전 리셋.
---

## 프로젝트 개요

UE5와 Chaos Vehicles로 아케이드 레이싱 게임 *Split/Second* 의 핵심 메카닉을 모킹한 팀 프로젝트입니다.
저는 **플레이어 차량 시스템 전반**을 담당했고, 짧은 일정 안에 "조작감"이 살아 있는 차량을 만들기 위해 물리·인풋·카메라·이펙트를 한 줄로 묶었습니다.

## 내가 한 작업

### 1. 차량 물리 — Chaos Vehicles 기반 핸들링

기본 템플릿의 자동차는 "그냥 굴러가는" 수준이라 실제 게임 같은 손맛이 없습니다.
손에 잡히는 조작감까지 끌어올리려면 휠 토크·서스펜션·접지 마찰만으론 부족했고, 다음 항목을 모두 직접 손봤습니다.

- 가속·브레이크·조향에 Enhanced Input 매핑
- 휠 셋업·서스펜션·앤티롤 바 튜닝
- 코너 진입 시 자연스러운 무게 이동
- 외부 충격 시 임팩트 카메라 쉐이크

### 2. 드리프트 시스템 — 히스테리시스 패턴

가장 시간을 많이 쓴 부분. 단순히 *조향각 + 속도* 만 보고 드리프트를 판정하면, 작은 진동에도 상태가 켜졌다 꺼졌다 깜빡입니다.

```cpp
// 의사 코드
if (!bDrifting && lateralRatio > 0.98f) bDrifting = true;
else if (bDrifting && lateralRatio < 0.94f) bDrifting = false;
```

**히스테리시스 패턴**(진입·이탈 임계값을 분리)으로 드리프트 상태를 안정화했고, 이때 동시에:

- Niagara 연기 이펙트 토글
- 드리프트 사운드 페이드 인/아웃
- 카메라 FOV 살짝 확장

이 한 줄에 묶여 들어가 "드리프트 시작!" 하는 감각이 즉시 전달되게 했습니다.

### 3. 팽이 현상(spinning top) 해결

> SetSteeringInput만 호출하면 차량이 그 자리에서 팽이처럼 회전하는 버그.

처음엔 마찰 계수만 손봤는데 효과가 없었고, 결국 두 가지를 함께 적용해 해결했습니다.

1. **각속도 보간 (FInterpTo)** — 회전 입력을 즉시 반영하지 말고, 일정 속도로 보간해서 들어가게
2. **Velocity Alignment** — 매 틱 진행 방향에 약하게 회전 보정 가산

### 4. 파워플레이 / 부스트 / 리스폰

- **파워플레이 게이지**: 드리프트·드래프트·니어미스로 채워지는 게이지
- **부스트**: 게이지 소비 시 일정 시간 출력 + FOV 확장
- **리스폰**: `SetSimulatePhysics(false→true)` 토글로 물리 상태 완전 초기화 — 이걸 안 하면 이전 frame의 속도가 남아 점프하면서 리스폰됨

## 배운 점

- 게임 차량은 **물리만 잘 짠다고 잡히지 않는다.** 카메라·사운드·이펙트가 같은 타이밍에 묶여 들어가야 "조작감"이 나옴
- 상태 머신 짤 땐 **히스테리시스**가 거의 항상 답
- Chaos Vehicles는 강력하지만 디폴트로 쓰면 절대 안 되고, 휠 셋업·서스펜션·앤티롤을 직접 만져야 한다

## 아쉬운 점

- 멀티플레이 미구현 (단순 1인 데모)
- AI 적 차량 없음 — 다음에 다시 만진다면 보스 차량 1대만이라도 추가하고 싶음
- 트랙 1개만 — 환경 인터랙션(파워플레이 트리거) 시연이 한정적

자세한 트러블슈팅 회고는 블로그 글에서 이어집니다.
