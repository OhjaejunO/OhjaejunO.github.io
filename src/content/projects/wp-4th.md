---
title: APEX LEGENDS MOCK
subtitle: WP_4th · UE5 멀티플레이어 FPS
description: UE5 + C++로 Apex Legends 스타일 FFA 멀티플레이를 모킹한 팀 프로젝트. 무기 시스템과 멀티플레이 네트워킹 구축을 담당.
category: GAME / MULTIPLAYER FPS
badgeCategory: 회고
order: 2

period: 2026.03 - 2026.04 (약 1개월)
role: 무기 시스템 · 멀티플레이 구축
teamSize: 팀 프로젝트
status: 진행 중
isTeamProject: true

techStack:
  - { label: Engine, value: UE5 }
  - { label: Language, value: "C++, Blueprint" }
  - { label: Networking, value: "Listen Server · Replication" }
  - { label: Abilities, value: GAS (참고) }
  - { label: UI, value: "UMG · Common UI" }
badges: [UE5, C++, REPLICATION, MULTIPLAYER, UMG]

links:
  github: https://github.com/Eurlis/WP_4th
  githubLabel: Team Repo · My Role 무기 · 멀티플레이
  blog: /blog
  blogLabel: 시리즈 글 작성 중

keyFeatures:
  - 3슬롯 무기 시스템 (Pistol · Main1 · Main2)
  - Replication 기반 무기 픽업·드롭·교체
  - Listen Server 멀티플레이 네트워킹 구조
  - 무기 슬롯 UMG 위젯
  - HP·탄약 HUD

keyLearnings:
  - title: bAlwaysRelevant Silent Fail 패턴
    description: Listen Server에서 bAlwaysRelevant 설정 누락 시 클라이언트에서 무기가 보이지 않는 버그. 디버깅 패턴 정리.
  - title: UE_LOG spam → Host Disconnect 트랩
    description: 매 프레임 UE_LOG가 Listen Server PIE에서 "Host closed connection"의 숨은 원인. 백그라운드 액터 로그 제거로 안정화.
  - title: 무기 슬롯 분배 버그 (5줄 분기 추가로 해결)
    description: ServerAddWeaponToSlot에서 Pistol 카테고리 분기 누락. 헬퍼 함수가 있어도 호출 안 하면 무용지물 패턴.
---

## 프로젝트 개요

UE5 + C++로 Apex Legends 스타일 FFA 멀티플레이를 모킹한 팀 프로젝트입니다.
저는 **무기 시스템과 멀티플레이 네트워킹 구축**을 담당했고, 한 번도 안 만져 본 Listen Server 환경에서 "왜 클라에서만 안 보이는가"라는 질문과 한 달 내내 싸웠습니다.

## 내가 한 작업

### 1. 3슬롯 무기 시스템

Apex의 시그니처 — Pistol / Main1 / Main2 — 를 그대로 옮겨왔습니다.

- 무기 카테고리(Pistol·AR·SMG 등)별 슬롯 분배 로직
- 픽업 시 빈 슬롯 우선, 없으면 현재 활성 슬롯 교체
- `EquippedWeapon` Replication + OnRep 콜백으로 메쉬 부착

### 2. Replication 기반 픽업·드롭·교체

Listen Server에서 호스트 플레이어와 리모트 플레이어 양쪽 모두에서 깨끗하게 동작하도록:

- `ServerPickUpWeapon` → Authority에서 슬롯 검사 후 부착
- `OnRep_EquippedWeapon` → 모든 클라이언트에서 메쉬 스왑
- 드롭 시 무기 액터 detach + 월드에 다시 spawn

### 3. 무기 슬롯 UMG

상단 우측에 3개 슬롯 + 현재 활성 슬롯 하이라이트. HP·탄약 HUD도 같이 구성.

## 부딪힌 트러블슈팅

### Trap 1 — bAlwaysRelevant Silent Fail

> "내 화면에선 무기가 잘 보이는데, 다른 플레이어 시점에선 무기가 사라져 있다."

가장 시간을 잡아먹은 버그. 처음엔 부착 로직, 메쉬, OnRep 콜백을 다 의심했는데 결국 정답은 **무기 액터의 `bAlwaysRelevant`가 false였던 것**.

월드 어딘가 떨어져 있는 무기는 거리가 멀면 client에 dormant 처리되고, 그 상태로 픽업되면 클라이언트엔 "그런 액터가 있다"는 사실 자체가 전달되지 않습니다.
픽업 가능한 무기에 `bAlwaysRelevant = true` 한 줄로 해결.

### Trap 2 — UE_LOG spam → Host Disconnect

> 게임 시작 30초 후 호스트가 "Host closed connection"으로 끊김.

원인은 한참을 찾아 헤맸고, 결국 **백그라운드 액터의 매 프레임 UE_LOG**.
PIE Listen Server는 출력 stream을 클라이언트로도 흘리려 하는데, 매 틱 수십 줄 로그가 쌓이면 어느 순간 채널이 막히면서 호스트가 자기 자신을 끊습니다.
디버그 로그 정리만으로 안정화.

### Trap 3 — 무기 슬롯 분배 버그

`ServerAddWeaponToSlot`에 슬롯 분배 헬퍼 함수까지 만들어 놨는데, 정작 Pistol 카테고리만 분기에서 빠져 있어서 매번 Main 슬롯으로 들어가는 버그.
**헬퍼 함수가 있어도 호출 안 하면 무용지물.** 5줄짜리 분기 추가로 끝.

## 배운 점

- Listen Server는 "내 화면이 정답"이 아니다. 항상 **다른 PIE 창에서 한 번 더 확인**해야 함
- Replication 버그의 80%는 "Owner / Authority / Relevant 셋 중 하나"
- 로그는 정말 필요한 것만. PIE 환경에선 한 줄 한 줄이 비용이다

## 아쉬운 점

- 어빌리티 시스템(GAS) 본격 도입 못 함 — 다음에 다시 만진다면 GAS 위에 무기 시스템 다시 설계하고 싶음
- 매치 시스템·로비 없음 — 단순 FFA 데모

블로그 시리즈로 트러블슈팅 회고를 정리 중입니다.
