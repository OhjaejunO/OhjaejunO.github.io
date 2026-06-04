---
title: SCARLET NEXUS - KAREN BOSS
subtitle: UE5 C++ 보스 전투 모작
description: 스칼렛 넥서스의 카렌 트래버스 보스전을 UE5와 C++로 모작한 팀 프로젝트. 보스 AI·공격 패턴·컷신·UI·사운드 전반을 담당.
category: GAME / BOSS BATTLE
badgeCategory: 회고
order: 3

period: 2026.04 (약 1개월)
role: 보스 AI · 공격 패턴 · 컷신 · UI · 사운드
teamSize: 팀 프로젝트
status: 완료
isTeamProject: true

techStack:
  - { label: Engine, value: UE5.7 }
  - { label: Language, value: "C++ (Blueprint 최소화)" }
  - { label: AI, value: StateTree + DataAsset }
  - { label: UI, value: "UMG (C++ 직접 제어)" }
  - { label: Media, value: Media Player }
badges: [UE5, C++, STATETREE, DATAASSET, UMG, MEDIAPLAYER]

links:
  github: https://github.com/tang-ka/POTENUP-ScarletNexus
  githubLabel: Team Repo · My Role 보스 AI · 컷신 · UI · 사운드
  blog: /blog/scarlet-nexus-karen-boss
  blogLabel: 블로그에서 자세히
  demo: https://www.youtube.com/watch?v=Pn31MEZNHq4

keyFeatures:
  - StateTree + DataAsset 가중치 기반 보스 AI
  - 5종 공격 패턴 (TeleportKick · CloneRush · AerialElectric · IceSpikes · ElectricOrbs)
  - 글리치 오버레이 이펙트 (슬롯 교체 + MID 방식)
  - 컷신 시스템 (C++ UMG · 텍스트 + 영상 + 페이드)
  - 시작 화면 UI (Press Any Key → 페이드 → 레벨 전환)
  - 사운드 시스템 (스킬·텔레포트·BGM·발자국)
  - 사망 연출 (서서히 무너지는 연출)

keyLearnings:
  - title: World Leak Fatal Error
    description: 타이머 람다에서 this 캡처가 이전 World GC를 막음. World·LevelName 명시적 캡처로 해결.
    blogLink: /blog/scarlet-nexus-karen-boss
  - title: 히트 리액션이 스킬을 중단시키는 문제
    description: 몽타주 재생 중엔 히트 리액션 스킵. 한 줄 체크로 "스킬 중엔 공격 무시하고 밀어붙이는 보스" 느낌 구현.
  - title: SetOverlayMaterial이 Translucent 미지원
    description: 글리치 오버레이가 인게임에서 안 보이는 문제. 슬롯 교체 + MID 방식으로 우회.
  - title: 컷신 이전 영상 잔상 문제
    description: OpenSource 후 UI Image가 즉시 업데이트되지 않음. 페이드 인 완료 시점에 Visible로 전환해 해결.
---

## 프로젝트 개요

UE5.7 + C++로 *Scarlet Nexus* 의 **카렌 트래버스 보스전**을 모작한 팀 프로젝트입니다.
저는 **보스 AI·공격 패턴·컷신·UI·사운드 전반**을 담당했고, "감독판처럼 짜인 보스전 한 판"이 목표였습니다.

## 내가 한 작업

### 1. StateTree + DataAsset 기반 보스 AI

- 5종 공격 패턴: `TeleportKick`, `CloneRush`, `AerialElectric`, `IceSpikes`, `ElectricOrbs`
- 각 패턴을 **DataAsset**으로 정의: 가중치 / 쿨타임 / 사거리 / 선후딜 / 사운드 / 이펙트
- StateTree가 매 결정 시점에 가중치 기반으로 다음 패턴을 뽑음
- 패턴 추가는 **DataAsset 하나 만들고 가중치 등록만** — 코드 수정 없이 확장 가능

### 2. 글리치 오버레이 — 슬롯 교체 + MID

> 카렌이 텔레포트 직전 잠깐 글리치 처리되는 시그니처 비주얼.

처음엔 `SetOverlayMaterial`로 간단히 처리하려 했는데, **인게임에서 Translucent material이 안 보임**.
결국 캐릭터 머티리얼 슬롯 자체를 MID(Material Instance Dynamic)로 잠깐 교체했다가 복원하는 방식으로 우회.

### 3. C++ UMG 컷신 시스템

- 텍스트 + 영상 + 페이드를 시퀀스로 묶은 컷신 위젯
- 모든 위젯을 **C++에서 직접 제어** (Designer 미사용)
- 페이드 인 → 텍스트 → 영상 → 페이드 아웃 → 레벨 전환

### 4. 시작 화면 / 사망 연출 / 사운드

- "Press Any Key" → 페이드 → 레벨 전환
- 사망 시 서서히 무너지는 연출 (스켈레탈 메쉬 + 콜리전 토글)
- 스킬·텔레포트·BGM·발자국 사운드 전체 셋업

## 부딪힌 트러블슈팅

### World Leak Fatal Error

타이머 람다에서 `[this]` 캡처가 이전 World의 GC를 막아서 다음 레벨 로딩 직후 Fatal Error.
**World·LevelName을 명시적으로 캡처**하고 약한 참조로 바꿔 해결.

```cpp
TWeakObjectPtr<UWorld> WeakWorld = GetWorld();
FString TargetLevel = NextLevelName;
GetWorld()->GetTimerManager().SetTimer(Handle, [WeakWorld, TargetLevel]() {
    if (UWorld* W = WeakWorld.Get()) {
        UGameplayStatics::OpenLevel(W, FName(*TargetLevel));
    }
}, 2.0f, false);
```

### 히트 리액션이 스킬을 중단시키는 문제

기본 구현은 "맞으면 멈춤". 그런데 보스는 자기 패턴을 끝까지 밀어붙여야 위협적임.
**현재 몽타주 재생 중이면 히트 리액션 스킵** — 한 줄 체크로 "스킬 중엔 공격 무시하는 보스" 느낌 완성.

### 컷신 이전 영상 잔상

`OpenSource` 후 UI Image가 즉시 업데이트되지 않아서 다음 컷신 시작할 때 이전 영상 한 프레임이 깜빡임.
**페이드 인 완료 시점에 Visible로 전환**해 해결.

## 배운 점

- AI는 코드보다 **DataAsset로 빼는 게 길게 봤을 때 유리**. 패턴 추가가 5분.
- C++ UMG는 진입 비용이 있지만, 한 번 손에 익으면 Designer보다 훨씬 명확하다
- "위협적인 보스" = 강한 데미지가 아니라 **자기 호흡을 지키는 보스**

자세한 트러블슈팅 회고는 [블로그](https://ohjaejuno.github.io/blog/scarlet-nexus-karen-boss)에 풀버전이 있습니다.
