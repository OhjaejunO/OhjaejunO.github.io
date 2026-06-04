---
title: AI-NATIVE DEV WORKFLOW
subtitle: 1인 개발자의 에이전트 기반 워크플로우
description: Hermes Agent · Claude Code · MCP · Obsidian을 결합한 1인 개발자 워크플로우. 자동화 · 문서화 · 코드 리뷰까지 에이전트가 담당하는 도구 체계.
category: AI WORKFLOW / TOOLING
badgeCategory: AI
order: 5

period: 진행 중 (Live Project)
role: 워크플로우 구축
teamSize: 개인 프로젝트
status: Live
isTeamProject: false

techStack:
  - { label: Agents, value: "Claude Code · Codex · Hermes Agent" }
  - { label: Protocol, value: MCP (Model Context Protocol) }
  - { label: PKM, value: "Obsidian (PARA + Zettelkasten)" }
  - { label: Automation, value: "Python · PowerShell" }
badges: [CLAUDE CODE, MCP, HERMES AGENT, PYTHON, OBSIDIAN]

links:
  github: https://github.com/OhjaejunO/Obsidian-Vault
  githubLabel: Vault Repo (Private)
  blog: /blog
  blogLabel: AI-Native 시리즈 (작성 예정)

keyFeatures:
  - Claude Code · Codex 기반 코딩 위임
  - Hermes Agent 자동화 파이프라인
  - MCP 서버 연동 (filesystem · memory · exa · Atlassian · Obsidian)
  - Obsidian Vault PKM (89+ 노트, MOC 6개, Zettel 78개)
  - PowerShell 단축키 시스템 (dt · sn · wp · ob · obc 등)
  - 데스크탑·노트북 양방향 동기화 (GitHub Private Repo)

keyLearnings:
  - title: AI 도구를 단순 도우미가 아닌 팀원으로
    description: Claude Code가 작업 일부를 위임받고, 결과를 검토·개선하는 방식. 1인 개발자가 팀처럼 일하는 핵심.
  - title: PKM이 AI 워크플로우의 기반
    description: 컨텍스트가 잘 정리된 Vault가 있으면 AI가 즉시 효율적으로 작동. 메모리·MCP·Obsidian의 시너지.
  - title: 단축키·자동화 시스템의 복리
    description: PowerShell 단축키 + Obsidian 자동 동기화 + 단축키 시스템이 매일 시간을 아껴줌. 초기 투자가 장기 복리.
---

## 프로젝트 개요

> "1인 개발자가 어떻게 팀처럼 일하는가."

Hermes Agent · Claude Code · MCP · Obsidian을 결합한 **AI-Native 개발 워크플로우**입니다.
기능 추가가 아니라 **시스템 자체를 만드는 프로젝트**라, 다른 프로젝트와 달리 "끝"이 없습니다. 매주 조금씩 업데이트합니다.

## 도구 스택

### Agents
- **Claude Code** — 메인 페어. 다중 파일 리팩토링·작성·리뷰까지 위임
- **Codex** — 보조 페어. 빠른 단일 파일 작업, 두 번째 의견
- **Hermes Agent** — 자동화 파이프라인. 매일 같은 패턴의 작업을 cron으로 돌림

### Protocol — MCP
**Model Context Protocol** — Claude Code가 외부 시스템과 직접 통신하는 표준 인터페이스.
연동된 MCP 서버:

- `filesystem` — 로컬 파일 시스템 접근
- `memory` — 세션 간 영속 메모리
- `exa` — 웹 검색
- `Atlassian` — Jira / Confluence
- `Obsidian` — Vault 직접 읽기·쓰기

### PKM — Obsidian
- Vault "JJ-Brain" (Private GitHub repo로 양방향 동기화)
- 89+ 노트, MOC 6개, Zettel 78개
- PARA (Project · Area · Resource · Archive) + Zettelkasten 혼합
- 모든 회고·결정·트러블슈팅이 여기로 모임 → AI가 컨텍스트로 사용

### Automation
- PowerShell 단축키: `dt`, `sn`, `wp`, `ob`, `obc`, `bl` ...
- 데스크탑 ↔ 노트북 양방향 동기화 (Vault·Settings·Snippets)

## 작업 흐름

1. **아이디어** — Obsidian에 "Fleeting Note"로 빠르게 기록
2. **컨텍스트 정리** — 관련 Zettel·MOC를 5분 안에 연결
3. **위임** — Claude Code에 "이 컨텍스트로 X를 해 줘" 형태로 위임
4. **검토·개선** — 결과물을 내가 직접 검토, 안 맞으면 재위임
5. **회고** — 작업 완료 후 Obsidian에 회고 Zettel 작성 → 다음 위임의 컨텍스트가 됨

이 루프가 **복리**처럼 쌓입니다. Vault가 두꺼울수록 AI의 출력 품질이 올라감.

## 배운 점

### 1. AI는 "도우미"가 아니라 "팀원"
가장 큰 인식 전환. 단순히 자동완성 도구로 쓰면 30% 효율이고, **명확한 컨텍스트와 책임을 위임하는 팀원**으로 쓰면 300% 효율.

### 2. PKM이 AI 워크플로우의 기반
Vault가 없으면 매번 같은 설명을 반복함. Vault가 있으면 "이 노트와 이 노트 보고 작업해 줘" 한 줄로 끝.
**PKM은 AI 워크플로우의 인프라.**

### 3. 자동화는 복리
PowerShell 단축키 하나 만드는 데 10분, 매일 20초씩 아낌. 1년이면 2시간.
이걸 30개 만들면 1년에 60시간. **초기 투자 = 장기 복리.**

## 앞으로

- AI-Native 시리즈 블로그 글 작성 중
- Hermes Agent 자동화 파이프라인 케이스 스터디 정리 예정
- MCP 서버 자체 제작도 실험 중
