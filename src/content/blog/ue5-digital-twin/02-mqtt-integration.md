---
title: "UE5 × 스마트 팩토리 — MQTT 실시간 연동: 센서 데이터를 UE5로 쏘아올리기"
description: "Python 가짜 센서 → Mosquitto → Node.js 브리지 → UE5 C++ WebSocket으로 이어지는 실시간 데이터 파이프라인 구축기"
date: 2026-04-15
category: 디지털트윈
series: ue5-digital-twin
seriesPart: 2
tags: [UE5, UnrealEngine5, 디지털트윈, MQTT, Mosquitto, WebSocket, C++, 스마트팩토리, IoT, ClaudeCode]
---

> 🏭 **시리즈: UE5 디지털 트윈 실전 가이드**
> - 1편: 개념부터 아키텍처까지 완전 정리
> - **2편: UE5 프로젝트 세팅 + MQTT 실시간 연동** ← 현재 글
> - 3편: Pixel Streaming으로 웹 대시보드 구축

## 들어가며

1편에서 디지털 트윈의 개념과 4계층 아키텍처를 설계했습니다. 이번 2편에서는 **실제로 동작하는 코드**를 작성합니다.

목표는 간단합니다: **Python으로 가짜 센서 데이터를 MQTT로 쏘고, UE5 C++에서 실시간으로 받아서 액터에 반영하는 것.**

실제 공장 장비가 없어도 됩니다. Python 스크립트 하나면 IoT 센서를 시뮬레이션할 수 있으니까요.

> ⚠️ 이 글은 실제로 처음부터 따라하면서 작성했습니다. 중간에 겪은 삽질과 해결 과정도 모두 포함되어 있으니, 같은 문제를 만나면 당황하지 마세요!

## 전체 구조 미리 보기

최종적으로 이런 파이프라인을 만들 겁니다:

```
Python 시뮬레이터 → (MQTT:1883) → Mosquitto Broker → (MQTT:1883) → Node.js 브리지 → (WS:9001) → UE5
```

> 💡 **왜 Node.js 브리지가 필요한가?**
> Mosquitto의 WebSocket은 MQTT 프로토콜 프레이밍을 사용합니다. UE5의 IWebSocket은 raw WebSocket이라 직접 통신이 안 됩니다. Node.js 브리지가 MQTT 메시지를 받아서 순수 JSON으로 변환해 UE5에 전달하는 통역사 역할을 합니다.

## 0단계. 필요한 프로그램 설치

본격적으로 시작하기 전에, 설치해야 할 프로그램이 3개 있습니다. 이미 설치되어 있다면 건너뛰세요.

### Python 설치

Windows에서 Python 설치는 생각보다 함정이 많습니다.

```powershell
# Python이 이미 있는지 확인
python --version
```

만약 MSYS2 Python(`C:\msys64\ucrt64\bin\python.exe`)이 잡히면 pip이 없을 수 있습니다. 공식 Python을 따로 설치하는 것을 강력 추천합니다.

[python.org/downloads](https://python.org/downloads)에서 Windows 설치파일을 다운받되, 최신 Windows에서는 Python Installation Manager가 자동으로 뜰 수 있습니다.

```powershell
# 설치 후 확인 — py 명령어 사용
py -3 --version
# Python 3.14.x

# pip 확인
py -3 -m pip --version
```

> ⚠️ **삽질 포인트 1: pip 명령어가 안 먹는 경우**
> MSYS2 Python 등 pip이 없는 환경이 PATH에 먼저 잡혀있을 수 있습니다. 이 경우 `pip install` 대신 `py -3 -m pip install`을 사용하세요. Windows Python Installation Manager를 통해 설치했다면 `py -3` 접두사가 가장 확실합니다.

### Node.js 설치

[nodejs.org](https://nodejs.org)에서 LTS 버전을 다운받아 설치합니다. 기본 옵션 그대로 Next만 누르면 됩니다.

```powershell
# 설치 확인
node --version
# v22.x.x
```

> ⚠️ **삽질 포인트 2: PowerShell 실행 정책 에러**
> `npm install`을 실행할 때 "이 시스템에서 스크립트를 실행할 수 없습니다"라는 에러가 나면:
>
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
>
> 확인 물어보면 Y를 누르세요. 이건 PowerShell의 보안 정책 때문이며, 한 번만 설정하면 됩니다.

### Mosquitto (MQTT Broker) 설치

[mosquitto.org/download](https://mosquitto.org/download)에서 Windows 64-bit 설치파일을 다운받아 설치합니다.

```powershell
# 설치 확인 (전체 경로로)
& "C:\Program Files\Mosquitto\mosquitto.exe" -v
```

> ⚠️ **삽질 포인트 3: mosquitto 명령어가 안 먹는 경우**
> Mosquitto는 설치 후 PATH에 자동 등록되지 않습니다. 두 가지 해결 방법:
>
> **방법 1 — 전체 경로 사용:**
> ```powershell
> & "C:\Program Files\Mosquitto\mosquitto.exe" -v
> ```
>
> **방법 2 — PATH에 직접 추가:**
> ```powershell
> [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\Mosquitto", "User")
> # PowerShell 재시작 후 사용 가능
> ```

> ⚠️ **삽질 포인트 4: "포트 1883 이미 사용 중" 에러**
> Mosquitto를 설치하면 Windows 서비스로 자동 실행될 수 있습니다. 이 경우 수동으로 안 띄워도 이미 돌고 있어요!
>
> ```powershell
> # 포트 확인
> netstat -ano | findstr 1883
> ```
>
> 1883이 LISTENING 상태면 Mosquitto가 이미 실행 중입니다. 따로 안 띄워도 됩니다.

## 1단계. UE5 C++ 프로젝트 생성

UE5 에디터에서 **Games → Blank → C++** 프로젝트를 생성합니다. 프로젝트 이름은 `DigitalTwinFactory`로 합니다.

### Rider 연결

1. UE5 에디터 → Edit → Editor Preferences → 검색: `source code` → Source Code Editor를 Rider로 변경
2. Rider 실행 → Open → `DigitalTwinFactory.sln` 열기

## 2단계. Claude Code로 소스 코드 생성

여기서 핵심 트릭입니다. 소스 코드를 직접 타이핑하는 대신, **Claude Code에게 맡깁니다.**

### Claude Code 설치

```powershell
# Windows PowerShell에서
irm https://claude.ai/install.ps1 | iex
```

> ⚠️ **삽질 포인트 5: claude 명령어가 안 먹는 경우**
> 설치 후 "용어가 인식되지 않습니다" 에러가 나면 PATH 문제입니다.
>
> ```powershell
> # PATH에 추가
> [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Users\user\.local\bin", "User")
> # PowerShell을 닫고 새로 열기
> claude --version
> ```

### 프로젝트 폴더에서 Claude Code 실행

```powershell
cd "C:\Users\{사용자명}\Documents\Unreal Projects\DigitalTwinFactory"
claude
```

첫 실행 시 브라우저에서 로그인합니다. 로그인 후 프롬프트가 뜨면 다음을 입력합니다:

### CLAUDE.md 먼저 생성

프로젝트 루트에 `CLAUDE.md` 파일을 만들어 Claude Code에게 프로젝트 맥락을 알려줍니다:

```markdown
# CLAUDE.md — DigitalTwinFactory

## 프로젝트 개요
UE5 C++ 기반 스마트 팩토리 디지털 트윈 프로젝트.
MQTT 센서 데이터를 WebSocket으로 수신하여 UE5 액터에 시각적으로 반영한다.

## 기술 스택
- 엔진: Unreal Engine 5 (C++ only)
- 통신: MQTT (Mosquitto) → Node.js WS Bridge → UE5 WebSocket
- 시뮬레이터: Python 3 + paho-mqtt
- 핵심 모듈: WebSockets, Json, JsonUtilities
```

### Claude Code에게 전체 구현 지시

```
이 프로젝트에 디지털 트윈 MQTT 연동 시스템을 구축해줘.

1. Build.cs에 WebSockets, Json, JsonUtilities 모듈 의존성 추가

2. MQTTSubsystem (UGameInstanceSubsystem) 생성:
   - WebSocket으로 Mosquitto Broker(ws://localhost:9001)에 연결
   - 수신된 JSON 메시지에서 device_id를 추출
   - FOnSensorDataReceived 델리게이트로 브로드캐스트
   - 연결 끊김 시 5초 후 자동 재연결 (최대 10회)

3. DigitalTwinManager (AActor) 생성:
   - TMap<FString, AActor*> DeviceActorMap을 에디터에서 설정 가능하게
   - MQTTSubsystem의 델리게이트에 바인딩
   - device type별 핸들러: temperature(머티리얼 색상 변경), vibration(머티리얼 색상), robot_arm(회전)
   - SetActorColor() 유틸리티: 자동으로 Dynamic Material Instance 생성

4. Scripts/sensor_simulator.py 생성:
   - paho-mqtt로 3개 디바이스 시뮬레이션
   - 1초 간격으로 factory/line1/ 토픽에 JSON 발행

5. Scripts/ws_bridge.js 생성:
   - MQTT 클라이언트로 Mosquitto 연결, factory/# 구독
   - WebSocket 서버(9001)로 UE5에 JSON 전달
   - Scripts/package.json도 함께 생성

6. Scripts/mosquitto.conf 생성

UE5 C++ 코딩 표준 준수하고, 로그는 [클래스명] 접두사로 남겨줘.
```

Claude Code가 파일을 생성할 때 허용을 물어보면 `y`를 누릅니다.

### 프로젝트 구조 (생성 후)

```
DigitalTwinFactory/
├── CLAUDE.md
├── Source/DigitalTwinFactory/
│   ├── DigitalTwinFactory.Build.cs     ← WebSockets, Json 모듈 추가
│   ├── DigitalTwinFactory.h/cpp
│   ├── MQTTSubsystem.h/cpp            ← WS 연결 + JSON 파싱
│   └── DigitalTwinManager.h/cpp        ← Device→Actor 매핑 + 업데이트
└── Scripts/
    ├── sensor_simulator.py             ← Python 센서 시뮬레이터
    ├── ws_bridge.js                    ← MQTT→WebSocket 브리지
    ├── package.json                    ← Node.js 의존성
    └── mosquitto.conf                  ← Broker 설정
```

## 3단계. 빌드

### Rider에서 빌드

Rider에서 `Ctrl+Shift+B`로 빌드합니다.

> ⚠️ **삽질 포인트 6: "Live Coding is active" 에러**
> UE5 에디터가 열린 상태에서 Rider 빌드를 하면 이런 에러가 나옵니다:
>
> ```
> Unable to build while Live Coding is active.
> ```
>
> **해결**: UE5 에디터를 완전히 닫고 Rider에서 빌드하세요. 빌드 성공 후 에디터를 다시 열면 됩니다.

## 4단계. 백엔드 파이프라인 실행

PowerShell 탭 2~3개가 필요합니다. (Mosquitto가 서비스로 이미 돌고 있으면 2개만)

### 4-1. Mosquitto 확인

```powershell
# 이미 서비스로 돌고 있는지 확인
netstat -ano | findstr 1883
```

LISTENING 상태면 이미 실행 중이니 건너뛰세요.

안 돌고 있으면 새 탭에서:

```powershell
& "C:\Program Files\Mosquitto\mosquitto.exe" -v
```

### 4-2. Node.js 브리지 실행 (새 탭)

```powershell
cd "C:\Users\{사용자명}\Documents\Unreal Projects\DigitalTwinFactory\Scripts"
npm install
node ws_bridge.js
```

성공 시 출력:

```
[ws_bridge] WebSocket server listening on ws://localhost:9001
[ws_bridge] Connected to MQTT broker at mqtt://localhost:1883
[ws_bridge] Subscribed to factory/#
```

> ⚠️ `npm install` 후 deprecation 경고는 무시해도 됩니다. `found 0 vulnerabilities`만 확인되면 OK.

### 4-3. Python 시뮬레이터 실행 (새 탭)

```powershell
cd "C:\Users\{사용자명}\Documents\Unreal Projects\DigitalTwinFactory\Scripts"

# paho-mqtt 설치 (최초 1회)
py -3 -m pip install paho-mqtt

# 시뮬레이터 실행
py -3 sensor_simulator.py
```

성공 시 1초마다 이런 로그가 출력됩니다:

```
--- Cycle 1 ---
  [OK] factory/line1/sensor/temp_001: 38.52
  [!]  factory/line1/sensor/vibration_001: 1.23 (warning)
  [OK] factory/line1/robot/robot_arm_001: [47.3, -28.1, ...]
```

## 5단계. UE5 에디터 설정 및 실행

### 5-1. 머티리얼 생성

센서 상태에 따라 색상이 바뀌려면 Dynamic Material이 필요합니다.

1. Content Browser 빈 곳 우클릭 → Material → 이름: `M_DynamicSensor`
2. 더블클릭으로 Material Editor 열기
3. 빈 공간 우클릭 → `VectorParameter` 검색 → 추가
4. 왼쪽 Details에서 Parameter Name을 `BaseColor`로 변경
5. VectorParameter 출력핀 → Base Color 입력핀에 연결
6. 저장

### 5-2. 레벨에 액터 배치

1. **Place Actors → DigitalTwinManager** 검색 → 레벨에 드래그
2. **Cube 3개**를 레벨에 배치 (적당히 간격을 두고)
3. 큐브 3개에 `M_DynamicSensor` 머티리얼을 각각 드래그해서 적용

> ⚠️ **삽질 포인트 7: Mobility 설정**
> 큐브를 배치하면 기본값이 Static입니다. 로봇팔 큐브는 회전해야 하므로 반드시 **Movable**로 변경해야 합니다. 안 하면 이런 경고가 폭발합니다:
>
> ```
> Mobility of StaticMeshComponent0 has to be 'Movable' if you'd like to move.
> ```
>
> **큐브 3개 모두 선택 → Details → Mobility → Movable** 변경을 추천합니다.

### 5-3. DeviceActorMap 매핑

1. 레벨에서 DigitalTwinManager 선택
2. Details 패널 → DeviceActorMap → + 3번 클릭:
   - `temp_001` → 큐브 1 (온도 센서)
   - `vibration_001` → 큐브 2 (진동 센서)
   - `robot_arm_001` → 큐브 3 (로봇팔)

### 5-4. PIE 실행

**Alt+P** 또는 Play 버튼!

Output Log에서 이 로그들이 보이면 성공입니다:

```
[MQTTSubsystem] Initialized
[MQTTSubsystem] Connecting to ws://localhost:9001
[DigitalTwinManager] Bound to MQTTSubsystem, 3 devices mapped
[MQTTSubsystem] Connected to broker
[DT] Temp temp_001: 42.3 C [warning]
[DT] Vibration vibration_001: 0.72 [normal]
[DT] RobotArm robot_arm_001: 6 joints updated
```

## 결과

모든 것이 정상 동작하면 이런 모습을 볼 수 있습니다:

![MQTT 실시간 연동 결과 데모](/images/blog/ue5-digital-twin-mqtt/result-demo.gif)

- **큐브 1 (temp_001)**: 온도에 따라 초록(정상) ↔ 빨강(경고) 색상 변경
- **큐브 2 (vibration_001)**: 진동에 따라 파랑(정상) ↔ 주황(경고) 색상 변경
- **큐브 3 (robot_arm_001)**: 관절 각도 데이터에 따라 천천히 회전

Python 시뮬레이터가 1초마다 보내는 랜덤 센서 데이터가 **Mosquitto → Node.js 브리지 → WebSocket → UE5**를 거쳐서 실시간으로 큐브에 반영되고 있는 겁니다.

## 전체 실행 순서 요약

```
1. Mosquitto    — 이미 서비스로 실행 중이면 건너뛰기
                   아니면: & "C:\Program Files\Mosquitto\mosquitto.exe" -v

2. WS Bridge    — cd Scripts && node ws_bridge.js

3. Simulator    — cd Scripts && py -3 sensor_simulator.py

4. UE5 PIE      — Alt+P
```

종료할 때: 각 터미널에서 `Ctrl+C`로 중지. UE5는 Stop 버튼.

## 삽질 총정리

| # | 증상 | 원인 | 해결 |
|---|------|------|------|
| 1 | pip 명령어 안 먹음 | MSYS2 Python에 pip 없음 | `py -3 -m pip install` 사용 |
| 2 | npm 실행 시 보안 에러 | PowerShell 실행 정책 | `Set-ExecutionPolicy RemoteSigned` |
| 3 | mosquitto 명령어 안 먹음 | PATH 미등록 | 전체 경로로 실행 |
| 4 | 포트 1883 충돌 | 서비스로 이미 실행 중 | 따로 안 띄워도 OK |
| 5 | claude 명령어 안 먹음 | PATH 미등록 | PATH에 `.local\bin` 추가 |
| 6 | Rider 빌드 실패 | Live Coding 활성화 | UE5 에디터 닫고 빌드 |
| 7 | Mobility 경고 폭발 | Static 큐브 회전 시도 | Movable로 변경 |

## 마치며

실제 공장 장비 없이도 디지털 트윈의 핵심 데이터 파이프라인을 구현했습니다.

이번 2편에서 완성한 것을 정리하면:

- **UE5 C++ 프로젝트** — WebSocket + JSON 모듈 기반 실시간 데이터 수신
- **Mosquitto Broker** — MQTT 메시지 중계
- **Node.js WebSocket 브리지** — MQTT → raw JSON 변환
- **Python 센서 시뮬레이터** — 3개 디바이스(온도, 진동, 로봇팔) 시뮬레이션
- **실시간 시각화** — 센서 상태에 따른 머티리얼 색상 변경 + 로봇팔 회전

다음 3편에서는 이 결과물을 **Pixel Streaming으로 웹 브라우저에 실시간 스트리밍**하는 과정을 다루겠습니다. 공장 관리자가 태블릿에서 디지털 트윈을 조작하는 그 장면을 만들어 볼 거예요.

## 참고 자료

- [UE5 WebSocket Documentation](https://docs.unrealengine.com/)
- [Eclipse Mosquitto](https://mosquitto.org/)
- [paho-mqtt Python Client](https://pypi.org/project/paho-mqtt/)
- [Claude Code 설치 가이드](https://docs.claude.com/en/docs/agents-and-tools/claude-code)
- [Node.js 공식 사이트](https://nodejs.org/)