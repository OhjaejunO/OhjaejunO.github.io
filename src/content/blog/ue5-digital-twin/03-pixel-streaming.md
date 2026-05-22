---
title: "UE5 × 스마트 팩토리 — Pixel Streaming으로 웹 대시보드 구축"
description: "UE5의 고품질 렌더링을 WebRTC로 인코딩해 웹 브라우저에 실시간 스트리밍. 공장 관리자가 태블릿에서 디지털 트윈을 보는 시나리오 완성기"
date: 2026-04-17
category: 디지털트윈
series: ue5-digital-twin
seriesPart: 3
tags: [UE5, UnrealEngine5, 디지털트윈, PixelStreaming, WebRTC, 스마트팩토리, MQTT, 웹스트리밍]
---

> 🏭 **시리즈: UE5 디지털 트윈 실전 가이드**
> - 1편: 개념부터 아키텍처까지 완전 정리
> - 2편: UE5 프로젝트 세팅 + MQTT 실시간 연동
> - **3편: Pixel Streaming으로 웹 대시보드 구축** ← 현재 글

## 들어가며

2편에서 Python → Mosquitto → UE5로 이어지는 실시간 데이터 파이프라인을 완성했습니다. 센서 데이터가 UE5에 반영되어 큐브의 색이 바뀌고, 로봇팔이 회전하는 것까지 확인했죠.

그런데 문제가 있습니다. **UE5 에디터를 직접 열어야만 결과를 볼 수 있다는 것.**

공장 관리자가 사무실에서, 혹은 태블릿으로 현장을 모니터링하려면 어떻게 해야 할까요? UE5를 설치하게 할 수는 없습니다.

답은 **Pixel Streaming**입니다. UE5의 고품질 렌더링을 WebRTC로 인코딩해서 웹 브라우저에 실시간 스트리밍합니다. 설치 필요 없이 URL 하나로 접속 가능합니다.

## Pixel Streaming이란?

간단히 말하면 **"UE5를 클라우드 게이밍처럼 웹으로 쏘는 것"** 입니다.

서버(GPU가 있는 PC)에서 UE5를 실행하고, 그 화면을 WebRTC로 인코딩하여 브라우저에 전달합니다. 사용자의 마우스/키보드 입력은 역방향으로 전달되어 UE5에서 처리됩니다.

### 기존 방식 vs Pixel Streaming

| 구분 | 기존 방식 | Pixel Streaming |
|------|-----------|-----------------|
| **접근성** | UE5 설치 필요 | 웹 브라우저만 있으면 됨 |
| **클라이언트 GPU** | 고사양 필요 | 불필요 (서버가 렌더링) |
| **배포** | 실행 파일 빌드 + 배포 | URL 공유만 하면 끝 |
| **멀티 플랫폼** | Windows 위주 | PC, 태블릿, 모바일 전부 |
| **업데이트** | 재배포 필요 | 서버만 업데이트 |

디지털 트윈에서 Pixel Streaming이 특히 강력한 이유는, **공장 현장의 태블릿, 사무실 PC, 경영진 회의실 모니터에서 같은 디지털 트윈을 동시에 볼 수 있다**는 점입니다.

## 전체 아키텍처

2편까지 구축한 MQTT 파이프라인에 Pixel Streaming이 추가되면 이런 구조가 됩니다.

```
Python 센서 시뮬레이터
       │ MQTT (1883)
       ▼
Mosquitto Broker
       │ MQTT
       ▼
Node.js WS 브리지 (9001)
       │ WebSocket
       ▼
UE5 DigitalTwinFactory ──── Pixel Streaming 2 ──── 시그널링 서버 (80/8888)
                                                          │
                                                          ▼
                                                    웹 브라우저
                                                 (http://localhost)
```

### 포트 정리

| 서비스 | 포트 | 역할 |
|--------|------|------|
| Mosquitto MQTT | 1883 | 센서 데이터 중계 |
| WebSocket 브리지 | 9001 | MQTT → WebSocket 변환 |
| 시그널링 서버 HTTP | 80 | player.html 제공 |
| 시그널링 서버 Streamer | 8888 | UE5 ↔ 시그널링 연결 |
| 시그널링 서버 SFU | 8889 | 멀티 뷰어 지원 |

**핵심 포인트**: 기존 MQTT 파이프라인(1883, 9001)과 Pixel Streaming(80, 8888, 8889)은 포트가 겹치지 않습니다. 둘 다 동시에 실행할 수 있습니다.

## Step 1. Pixel Streaming 2 플러그인 활성화

### .uproject에 플러그인 추가

```json
{
    "FileVersion": 3,
    "EngineAssociation": "5.7",
    "Modules": [
        {
            "Name": "DigitalTwinFactory",
            "Type": "Runtime",
            "LoadingPhase": "Default"
        }
    ],
    "Plugins": [
        {
            "Name": "ModelingToolsEditorMode",
            "Enabled": true,
            "TargetAllowList": ["Editor"]
        },
        {
            "Name": "PixelStreaming2",
            "Enabled": true
        }
    ]
}
```

> 💡 UE5 5.7에서는 **PixelStreaming2가 기본 제공**됩니다. 이전 버전의 PixelStreaming과 다르게 WebRTC 스택이 현대화되었고, 입력 처리 모듈이 내장되어 있어서 `PixelStreaming2Input`을 따로 추가할 필요가 없습니다.

### DefaultEngine.ini 설정

```ini
[/Script/PixelStreaming2Settings.PixelStreaming2PluginSettings]
UseMediaCapture=true
ConnectionURL=ws://localhost:8888
Codec=H264
WebRTCFps=60
```

### 에디터에서 확인

1. `.uproject` 파일 우클릭 → Generate Visual Studio project files
2. Rider에서 빌드 (`Ctrl+Shift+B`)
3. UE5 에디터 실행
4. Edit → Plugins → "Pixel Streaming" 검색 → Enabled 확인
5. Output Log에서 `LogPixelStreaming` 카테고리가 보이면 성공

> ⚠️ 첫 실행 시 셰이더 컴파일에 시간이 걸립니다. Pixel Streaming 관련 셰이더가 추가되기 때문입니다.

## Step 2. 시그널링 서버 구성

Pixel Streaming은 **시그널링 서버**가 필요합니다. UE5(스트리머)와 브라우저(플레이어) 사이의 WebRTC 연결을 중개하는 역할입니다.

### 시그널링 서버 다운로드 (최초 1회)

Epic Games가 GitHub에서 **Pixel Streaming Infrastructure**를 제공합니다.

```batch
@echo off
REM Scripts/setup_signalling.bat
echo [setup_signalling] Downloading Pixel Streaming Infrastructure for UE 5.7...

set TAG=UE5.7
set DOWNLOAD_URL=https://github.com/EpicGamesExt/PixelStreamingInfrastructure/archive/refs/heads/%TAG%.zip

curl -L -o ps_infra.zip %DOWNLOAD_URL%
powershell -command "Expand-Archive -Force ps_infra.zip ."

for /d %%D in (PixelStreamingInfrastructure-*) do (
    xcopy /E /Y "%%D\*" .
    rmdir /S /Q "%%D"
)
del ps_infra.zip

echo [setup_signalling] Download complete.
```

실행:

```powershell
cd "C:\Users\user\Documents\Unreal Projects\DigitalTwinFactory\Scripts"
.\setup_signalling.bat
```

### 시그널링 서버 기동

```batch
@echo off
REM Scripts/start_signalling.bat
echo [start_signalling] Starting signalling server...

cd /d "%~dp0SignallingWebServer\platform_scripts\cmd"
call start.bat
```

실행하면 이런 로그가 나옵니다:

```
[11:12:46.542] info: Http server listening on port 80
```

이게 나오면 시그널링 서버가 정상 기동된 것입니다.

> ⚠️ **삽질 포인트**: UE5 5.7 버전의 시그널링 서버는 `--HttpPort` 같은 CLI 인자를 인식하지 못합니다. 포트 변경이 필요하면 `config.json`을 직접 수정하세요.

## Step 3. 실행 및 브라우저 접속

### 전체 실행 순서

```
1. Mosquitto     — Windows 서비스 자동 실행 (포트 1883)
                    확인: netstat -ano | findstr 1883

2. bridge        — Antigravity 터미널 탭 1
                    cd Scripts && node ws_bridge.js

3. sensor        — Antigravity 터미널 탭 2
                    cd Scripts && py -3 sensor_simulator.py

4. 시그널링 서버  — Antigravity 터미널 탭 3
                    cd Scripts && .\start_signalling.bat

5. UE5 에디터    — DigitalTwinFactory.uproject → Alt+P (PIE)

6. 브라우저      — http://localhost 접속
```

### 브라우저 접속 확인

`http://localhost`에 접속하면 UE5 화면이 실시간으로 보입니다. MQTT 센서 데이터로 큐브 색이 바뀌고, 로봇팔이 회전하는 것을 **브라우저에서 바로 확인**할 수 있습니다.

마우스와 키보드 입력도 UE5로 전달됩니다.

## 삽질 포인트 정리

실제로 구현하면서 겪은 문제들입니다.

| 문제 | 원인 | 해결 |
|------|------|------|
| `PixelStreaming2Input` 플러그인을 찾을 수 없음 | UE5 5.7에서는 입력 모듈이 PixelStreaming2에 내장됨 | `.uproject`에서 PixelStreaming2Input 제거 |
| 시그널링 서버 `Unknown arg --HttpPort` | UE5 5.7 시그널링 서버는 CLI 인자 형식이 다름 | 인자 없이 `start.bat`만 실행, `config.json`으로 설정 |
| `http://localhost` 접속 불가 | 포트 80이 다른 프로그램에 점유됨 | `netstat -ano | findstr :80`으로 확인 |
| PIE에서 PS2 연결 안 됨 | `DefaultEngine.ini`에 ConnectionURL 미설정 | PS2 설정 섹션에 URL 추가 |
| 브라우저에서 검은 화면 | GPU 인코더(NVENC/AMF) 미지원 | 전용 GPU가 있는 PC에서 실행 필요 |

## MQTT + Pixel Streaming = 4계층 완성

여기까지 오면 **1편에서 설계한 4계층 아키텍처가 모두 구현된 것**입니다.

```
Layer 1 — Physical      : Python 센서 시뮬레이터 (실제 센서 대체)
Layer 2 — Data           : Mosquitto + ws_bridge.js (MQTT→WS 변환)
Layer 3 — Visualization  : UE5 (MQTTSubsystem + DigitalTwinManager)
Layer 4 — Presentation   : Pixel Streaming → 웹 브라우저
```

핵심은 **기존 MQTT 코드를 한 줄도 수정하지 않았다는 점**입니다. Pixel Streaming은 UE5의 렌더링 결과를 그대로 스트리밍하므로, MQTT로 들어온 데이터가 액터에 반영되면 그것이 자동으로 브라우저에 보입니다.

## 다음 단계 — 확장 아이디어

### 웹 오버레이 대시보드

기본 player.html을 커스텀하면 센서 수치를 HTML/CSS로 오버레이할 수 있습니다.

- **방식 A (권장)**: 브라우저도 ws_bridge.js에 WebSocket으로 직접 연결해서 JSON 데이터 표시. UE5 부하 없음.
- **방식 B**: UE5의 `emitUIInteraction`으로 브라우저에 데이터 전달. 양방향 통신 가능.

### HTTPS + 외부 접속

로컬 검증 후 외부에서 접속하려면:

- **리버스 프록시**: nginx/caddy로 HTTPS + WSS 설정
- **TURN 서버**: coturn으로 NAT 뒤의 클라이언트 접속
- **방화벽**: UDP 포트 개방 필요

### 운영 환경 배포

```powershell
DigitalTwinFactory.exe -RenderOffscreen -AudioMixer -PixelStreamingURL=ws://localhost:8888 -ResX=1920 -ResY=1080
```

서버 GPU(NVENC 지원)에서 헤드리스로 실행하면 가장 안정적입니다.

## 이 글의 전체 파일 구조

```
DigitalTwinFactory/
├── Source/
│   └── DigitalTwinFactory/
│       ├── DigitalTwinFactory.Build.cs
│       ├── MQTTSubsystem.h / .cpp
│       └── DigitalTwinManager.h / .cpp
├── Config/
│   ├── DefaultEngine.ini          ← PS2 설정 추가
│   └── DefaultGame.ini
├── Scripts/
│   ├── sensor_simulator.py
│   ├── ws_bridge.js
│   ├── setup_signalling.bat       ← PS Infrastructure 다운로드
│   ├── start_signalling.bat       ← 시그널링 서버 기동
│   └── run_ue5_pixelstreaming.bat ← UE5 PS 실행 (선택)
├── DigitalTwinFactory.uproject    ← PixelStreaming2 플러그인
├── CLAUDE.md
└── .gitignore
```

## 시리즈 마무리

3편에 걸쳐 UE5 디지털 트윈의 핵심 파이프라인을 완성했습니다.

- **1편**: 개념 + 4계층 아키텍처 설계
- **2편**: MQTT 실시간 데이터 연동 (Python → Mosquitto → UE5)
- **3편**: Pixel Streaming으로 웹 브라우저 스트리밍

실제 공장 장비 없이도 Python 스크립트로 센서를 시뮬레이션하고, UE5 C++로 실시간 시각화를 구현하고, Pixel Streaming으로 웹 배포까지 할 수 있다는 것을 보여드렸습니다.

디지털 트윈은 더 이상 대기업만의 영역이 아닙니다. UE5의 무료 라이선스와 오픈소스 MQTT 생태계 덕분에, 개인 프로젝트에서도 충분히 시작할 수 있습니다.

이 시리즈의 전체 소스코드는 GitHub에서 확인할 수 있습니다:
[ojaejun1995-sys/DigitalTwinFactory](https://github.com/ojaejun1995-sys/DigitalTwinFactory)

## 참고 자료

- [Epic Games — Pixel Streaming](https://www.unrealengine.com/en-US/digital-humans)
- [Pixel Streaming Infrastructure GitHub](https://github.com/EpicGamesExt/PixelStreamingInfrastructure)
- [UE5 Pixel Streaming 2 Documentation](https://docs.unrealengine.com/)
- [WebRTC 공식 사이트](https://webrtc.org/)