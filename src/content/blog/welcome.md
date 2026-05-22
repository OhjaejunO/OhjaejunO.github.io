---
title: JJ.Dev 블로그 오픈
description: 디지털 트윈 엔지니어로 가는 길의 기록을 시작합니다.
date: 2026-05-22
category: 도구
tags: [블로그, 시작]
---

새 블로그를 열었습니다. 이곳은 UE5 게임 개발, 디지털 트윈 엔지니어링, 그리고 AI-네이티브 1인 개발 워크플로우를 만들면서 남기는 기록 공간입니다.

## 다루는 주제

- **UE5 게임 회고** — Apex Legends Mock(WP_4th), Split/Second Mock 같은 모작 프로젝트의 결정·트레이드오프·실패 기록
- **디지털 트윈 일지** — 실제 공정 라인을 UE5 + MQTT + WebSocket으로 가상화하면서 부딪힌 문제와 해결
- **AI-Native 도구 체계** — Hermes Agent · Claude Code · MCP로 1인 개발자가 팀처럼 일하는 워크플로우

> 긴 글은 단편이 아니라 시리즈로 정리합니다. 한 프로젝트의 시작부터 마무리까지 시간 순서대로 따라갈 수 있도록.

## 시스템 스택

이 블로그 자체도 일종의 실험입니다. 사용한 기술은 다음과 같습니다.

| 영역 | 도구 |
|------|------|
| 프레임워크 | Astro 6 + React |
| 스타일 | Tailwind 4 |
| 콘텐츠 | Astro Content Collections + Markdown |
| 배포 | GitHub Pages + Actions |

## 코드 샘플

코드 블록은 Shiki(`github-dark`)로 하이라이트됩니다. 예시로 간단한 TypeScript 함수:

```ts
type Stage = 'sketch' | 'build' | 'ship';

const next = (s: Stage): Stage => {
  switch (s) {
    case 'sketch':
      return 'build';
    case 'build':
      return 'ship';
    case 'ship':
      return 'sketch';
  }
};

console.log(next('sketch')); // 'build'
```

인라인 코드는 `useState`처럼 본문 안에 자연스럽게 섞입니다.

## 다음 글들

곧 다음 시리즈 글들이 이어집니다.

1. **Apex Legends Mock — WP_4th 회고** (UE5 멀티플레이어 FPS 처음부터 끝까지)
2. **DigitalTwinFactory 일지** (공정 라인 디지털 트윈)
3. **AI-Native Dev Workflow** (Claude Code · MCP 기반 1인 개발 체계)

함께 만들 만한 게 있거나 그냥 안부 인사도 환영합니다. [/blog](/blog)에서 진행 중인 시리즈를 확인해 주세요.
