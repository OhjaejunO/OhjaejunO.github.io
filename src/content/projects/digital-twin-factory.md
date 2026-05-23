---
title: DIGITAL TWIN FACTORY
subtitle: UE5 스마트 팩토리 디지털 트윈
description: UE5 + MQTT + Pixel Streaming으로 스마트 팩토리 디지털 트윈의 핵심 데이터 파이프라인을 구축한 개인 프로젝트.
category: DIGITAL TWIN / SMART FACTORY
badgeCategory: 디지털트윈
order: 4

period: 2026.04 (약 1주)
role: 4계층 아키텍처 전체
teamSize: 개인 프로젝트
status: 진행 중
isTeamProject: false

techStack:
  - { label: Engine, value: UE5.7 }
  - { label: Language, value: "C++, Python, JavaScript" }
  - { label: Messaging, value: MQTT (Mosquitto) }
  - { label: Streaming, value: "WebSocket · Pixel Streaming" }
  - { label: IoT, value: "paho-mqtt · Node.js" }
badges: [UE5, MQTT, WEBSOCKET, PYTHON, PIXEL STREAMING, IOT]

links:
  github: https://github.com/ojaejun1995-sys/DigitalTwinFactory
  githubLabel: My Repo
  blog: /blog/series/ue5-digital-twin
  blogLabel: 시리즈 글 (3편)

keyFeatures:
  - 4계층 아키텍처 (Physical → Data → Visualization → Presentation)
  - MQTT 실시간 센서 데이터 연동
  - C++ WebSocket 클라이언트 + JSON 파싱
  - Python 센서 시뮬레이터 (온도·진동·로봇팔)
  - Node.js MQTT ↔ WebSocket 브리지
  - Pixel Streaming으로 웹 배포 (WebRTC)
  - 센서 상태별 시각적 피드백 (머티리얼 색상·로봇팔 회전)

keyLearnings:
  - title: 4계층 분리의 가치
    description: Physical/Data/Visualization/Presentation 명확한 책임 분리로 확장성 확보. 센서 추가시 코드 수정 최소화.
    blogLink: /blog/ue5-digital-twin/01-architecture
  - title: MQTT ↔ WebSocket 브리지가 필요한 이유
    description: Mosquitto WebSocket은 MQTT 프레이밍, UE5 IWebSocket은 raw WebSocket. Node.js 브리지가 통역사.
    blogLink: /blog/ue5-digital-twin/02-mqtt-integration
  - title: Pixel Streaming의 접근성
    description: 클라이언트는 GPU 없이도 고품질 UE5 렌더링을 웹에서 조작. 디지털 트윈 배포의 핵심.
    blogLink: /blog/ue5-digital-twin/03-pixel-streaming
---

## 프로젝트 개요

UE5 + MQTT + Pixel Streaming으로 스마트 팩토리 디지털 트윈의 **데이터 파이프라인 전체**를 구축한 개인 프로젝트입니다.
"센서 신호 → UE5 시각화 → 웹 브라우저"까지를 1주일 안에 한 줄로 연결하는 것이 목표였습니다.

## 4계층 아키텍처

```
[Physical Layer]      Python sensor simulator (paho-mqtt)
        ↓ MQTT
[Data Layer]          Mosquitto broker
        ↓ MQTT → WebSocket bridge (Node.js)
[Visualization Layer] UE5 (C++ IWebSocket client + JSON parser)
        ↓ Pixel Streaming (WebRTC)
[Presentation Layer]  Browser
```

각 계층은 다음 계층의 **인터페이스만** 의존하도록 분리했습니다. 새 센서 1종 추가는:

1. Python 시뮬레이터에 publish 추가 — 끝
2. UE5는 토픽만 구독하면 자동으로 받음 — 코드 수정 0줄

## 내가 한 작업

### 1. Python 센서 시뮬레이터

온도·진동·로봇팔 위치를 가짜로 흘려보내는 Python 프로세스. `paho-mqtt`로 매초 publish.

### 2. Node.js 브리지 (MQTT ↔ WebSocket)

> Mosquitto WebSocket은 *MQTT-over-WebSocket* — 프레이밍이 들어 있음
> UE5 `IWebSocket`은 raw WebSocket — 프레이밍 모름

UE5에서 직접 Mosquitto WebSocket으로 붙으면 **JSON 안에 MQTT 프레이밍 바이트가 섞여서 파싱 실패**.
Node.js 브리지를 한 단계 끼워 "MQTT subscribe → 토픽·페이로드만 추려서 raw WebSocket으로 push"하는 통역사를 만들었습니다.

### 3. UE5 WebSocket 클라이언트 + JSON 파서 (C++)

- `IWebSocket` 으로 브리지 서버에 접속
- `OnMessage` 콜백 → `FJsonObject` 파싱
- 센서별 액터에 디스패치 (Observer 패턴)

### 4. 시각적 피드백

- 온도 → 머티리얼 emissive 색 보간 (cool blue → hot red)
- 진동 → 액터 위치 micro-shake
- 로봇팔 → 각 축 회전 보간

### 5. Pixel Streaming으로 웹 배포

- 서버 PC에서 UE5 실행 + Pixel Streaming Plugin
- 클라이언트는 그냥 브라우저로 URL 열면 끝
- **GPU 없는 노트북에서도 RTX-급 렌더링을 조작**

이 부분이 디지털 트윈 배포의 핵심: 현장 운영자는 자기 노트북·태블릿으로 충분.

## 배운 점

- **계층 분리 = 미래의 시간**. 1주일 더 들여 4계층으로 나눠 두면, 6개월 뒤 센서 추가가 5분이 됨
- 같은 단어("WebSocket")도 환경에 따라 의미가 다르다 — 표준 = 문서 정독
- Pixel Streaming은 "디지털 트윈을 진짜 배포 가능하게" 만드는 결정적 한 조각

자세한 구현 노트는 [시리즈 글 3편](/blog/series/ue5-digital-twin)에 풀어 두었습니다.
