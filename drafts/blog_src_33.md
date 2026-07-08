# 33편 소스 수집 — AI 머티리얼 수난사 (Meshy 임포트 머티리얼 사건 전수)

> 수집일: 2026-07-08 · 대상 저장소: PU3-Lab/factory-space · 브랜치 OJJ → main
> 이 문서는 **집필용 원자료**다. 아래 "일반화 필요 항목"을 반드시 지킬 것.
> ⚠️ 33편의 핵심 제약: **21편이 로봇 건을 이미 상세 발행**했다. 문서 맨 앞 "기발행 범위"를 기준으로 중복 없는 새 각도를 잡을 것.

---

## 블로그 게재 시 일반화 필요 항목

- **일반화(가리기):**
  - `WANTED_FACTORY_API` DLL export 매크로, 프로젝트명 `Wanted_Factory`, 전체 경로 `frontend/Source/Wanted_Factory/...` → `Source/...` 등으로 축약/일반화.
  - 협업자 실명/이니셜: `LDJ`(UI/대화 벌룬 담당) → "UI 담당 팀원", `SSR`(머신 담당) → "머신 담당 팀원", `Chan` → "다른 팀원". 문서·PR 인용 시 치환 필수.
  - `Wanted_FactoryEditor Win64 Development` 빌드 타깃명 → "에디터 타깃 풀빌드" 등으로 일반화.
- **게재 가능(기공개):**
  - `AOJJ_*`/`OJJ_*` 접두사, `/Game/OJJ/...` 경로, 도구명 Meshy/GPT/Codex/Claude.
  - `Meshy_AI_Character_output__2_.uasset`, `..._Lumen_Sentinel_...` 등 AI 산출물 파일명(29편에서 공개).
- 코드/PR/리뷰 문서는 아래 원문 그대로. 축약 시 **"일부 생략" 명시**. 동작 바뀌는 재구성 금지.

---

## 0. 21편 기발행 범위 (중복 금지 기준선)

`src/content/blog/factory-sim/21-robot-portrait-pipeline.md` (2026-07-05 발행, PR #432·#444·#446·#447 명시 — **#450은 각주에 누락**되어 있으나 본문 4-3이 그 내용을 다룸)이 이미 서술한 것:

1. **파이프라인 전체**: GPT 컨셉 → Meshy Image-to-3D(GLB) → UE5 임포트 → `AOJJ_PortraitCapture` → RT 512×512 → `M_Portrait_UI`(1-Alpha) → WBP. "반나절 작업" 서술 포함.
2. **캡처 액터 설계 5종**: ShowOnly 셀프 캡처 / SCS_SceneColorHDR 역불투명 알파 + UI 측 단일 반전 / 환경광 ShowFlags 차단 + KeyLight·FillLight / 바운드 자동 프레이밍(상반신 비율 0.42, 18° 앵글) / WorldSubsystem 자동 스폰 + **Z=-5000 격리 배치**.
3. **삽질 1 — Material_1 직렬화 결함**: Interchange 자동 머티리얼 인스턴스가 텍스처 바인딩/부모를 직렬화 못 함 → 재시작/타 기기 재로드 시 DefaultTexture + Texture Sample ERROR → 흰색 노이즈. 대응 4단계(Material_1 폐기 → 수동 `M_Robot` 직결 → 텍스처만 재임포트·에셋명 유지로 C++ 무변경 → 슬롯 교체). **"AI 생성 GLB의 자동 머티리얼은 쓰지 않는다" 임포트 규약으로 격상** 서술.
   - ⚠️ "확인해 보니 로봇만이 아니라 같은 방식으로 임포트한 **Man/Woman 캐릭터도 전부 같은 결함**"이라는 **한 문장**은 이미 발행됨. 단, Man/Woman의 **개별 수정사(6월 초~하순의 커밋·PR)는 미발행**.
4. **이전 팀 프로젝트 FBX fallback 전례**: "데스크탑은 멀쩡, 노트북만 흰색 — FBX 임포터 fallback 머티리얼이 플러그인 가상 경로에 걸림. 두 번째로 같은 칼에 베였다" 서술 발행.
   - ⚠️ 단, **이 프로젝트 안에서도** 6/27에 캐릭터 머티리얼이 "노트북에서 깨짐"(PR #407)이 있었다는 사실은 **미발행** — 21편은 전례를 '이전 팀 프로젝트'로만 돌렸다.
5. **삽질 2 — 워밍업 3단 진화**: A-1 고정 0.3s → A-2 `GShaderCompilingManager->IsCompiling()` 폴링(WITH_EDITOR, 셰이더당 ~0.42s, 0.15s 간격/15s 안전망) → A-3 force-resident + `GetNumResidentMips()` 폴링(mip 7/12, WITH_EDITOR 가드 없음). 3단 비교표, **EndPlay 원본값 복원(리뷰 Major)** 서술. 코드는 **축약 인용 2블록**만 발행(원문 전문은 미발행 — 본 문서 5장에 확보).
6. 교훈 2줄("AI 에셋은 규약이, RT 캡처는 시점이 전부다").

### 인접 편의 기발행 조각

- **19편** (`19-game-entry-character-intro.md:70`, 참고 박스 원문): "Meshy로 임포트한 리그는 별도 root 본이 없어 hips가 최상위 — Idle에서 발이 살짝 떠 있었다. **hips 트랙 Z를 전 프레임 -11.5 시프트해 접지**. 재임포트하면 보정이 사라진다(6편 연장선)." → 한 줄 요약만 발행. **PR #324의 측정 수치/스크립트/57프레임 디테일은 미발행.**
- **25편** (`25-character-animation.md:59`): "Woman은 Idle에서 발이 **10.46uu** 떠 있어 hips를 **-10** 보정" 한 줄 발행.
- **17편**: 사다리 Finish 몽타주 hips 평탄화(101→279 곡선을 128.4로) 발행 — 33편과는 별개 축(애니 보정이지 머티리얼 아님).
- **6편** (`06-meshy-glb-asset-pipeline.md`): FBX 임포트 실패 → GLB 전환(원인 미확정 고백), 바닥 안착·셀 정규화 발행. **단 c15db0a의 머신 3종 머티리얼 오염(FBXLegacyPhong) 사건은 6편에 없음 — 미발행.**
- **29편** (`29-ui-asset-pipeline.md:27-29`): 로봇 임포트 파일명 + Material_1 사건을 "21편에서 이미 풀었다"로 요약 재언급. "생성은 반나절, 신뢰할 수 있는 임포트가 본론" 문장 발행.

### 항목별 기발행/미발행 판정표

| 소재 | 상태 |
|------|------|
| 로봇 Material_1 → M_Robot 사건 서사 | **기발행(21편 3장)** — 재탕 금지, 참조만 |
| 워밍업 3단 진화 서사 | **기발행(21편 4장)** — 재탕 금지, 원문 코드 인용은 가능(21편은 축약) |
| PR #444 진단 디테일 "git blob == 디스크 sha256 → 동기화/LFS/autocrlf 아님" | **미발행** |
| PR #447 확증 정황 "머티리얼 에디터를 한번 열면 정상화" | **미발행** |
| 진단 로그 원문 "resident 7/12 mips (NOT FULLY RESIDENT)" | 21편에 "12단계 중 7단계" 서술로 발행, 로그 원문 표기는 신규 |
| 머신 3종 FBXLegacyPhong 오염 (c15db0a, 6/1) | **미발행** |
| OreCrusher 재임포트 덮어쓰기 사고 + 캐릭터 1차 임포트 실패 (PR #46, 6/2) | **미발행** |
| ManMat/WomanMat 자체 PBR 교체 (fdb9d4b, 6/5) | **미발행** |
| Material_1 → ManMat_2/WomanMat_2 리네임 (138fab4, 6/21) | **미발행** |
| 캐릭터 머티리얼 "노트북에서 깨짐" → 엔진 의존 완전 제거 (73a851b/PR #407, 6/27) | **미발행** |
| Man hips -11.5 상세(측정 수치·스크립트) / Woman hips -10 상세 | **미발행**(한 줄 요약만 기발행) |
| Woman에 ManMat override 덮임 → EmptyOverrideMaterials (61e76d9, 6/26) | **미발행** |
| MeshyImports gitignore 규약 (b664f49, 6/1) | **미발행** |
| UI 담당 인수인계 문서 원문(트러블슈팅 표) | 21편에 "인수인계 문서 한 장" 언급만, 내용 미발행 |

---

## 요약 (한눈에)

- **33편 주제 후보**: 로봇 단건(21편)이 아니라, **6월 한 달 동안 머신 → 캐릭터 → 로봇 3세대에 걸쳐 반복된 AI 임포트 머티리얼 사건 전수사**. Interchange가 벤 칼이 매번 달랐다:
  - ① **FBXLegacyPhong 오염**(머신, 6/1): 자동 머티리얼이 삭제된 텍스처 더미를 참조 → 컴파일 실패.
  - ② **엔진 플러그인 경로 의존**(캐릭터, 6/5·6/27): 자동 MI의 부모가 엔진 플러그인 가상 경로 → git 미추적/엔진 차이로 **노트북에서 깨짐**.
  - ③ **Material_1 직렬화 결함**(로봇, 6/29): 재로드만으로 바인딩 소실 → DefaultTexture ERROR.
- 세 번 모두 결론은 같았다 — **자동 머티리얼 폐기, 수동 베이스 머티리얼 직결** (M_Meshy_PBR → ManMat/WomanMat → M_Robot). 규약은 한 번에 성립한 게 아니라 **세 번 베인 뒤에** 성립했다.
- 부수 사건: 재임포트가 기존 메시를 덮어쓴 사고(OreCrusher), 임포트할 때마다 Material_1이 다시 생기는 문제(리네임으로 회피), hips 접지 보정(Man -11.5 / Woman -10, 재임포트 시 소실 KNOWN-LIMIT).

### 사건 전수 시간선 (KST, git 로컬 날짜)

| 날짜(KST) | 해시 | PR | 사건 | 기발행? |
|-----------|------|-----|------|---------|
| 06-01 01:00 | `b664f49` | — | MeshyImports 원본/플러그인 gitignore — "UE는 cooked .uasset만 필요" 규약 | 미발행 |
| 06-01 16:16 | `c15db0a` | #46에 포함 | **[사건①] 머신 3종** FBXLegacyPhongSurfaceMaterial 오염(삭제된 B_Energy_* 더미 참조 → 컴파일 실패) → 재임포트(Nanite) + 텍스처 15개 + 마스터 `M_Meshy_PBR` + MI 3종 직접 구성 | 미발행 |
| 06-02 00:38 | `f16ab77` | — | Man/Woman 1차 임포트 (애니 8+9종, Material 포함) | 미발행 |
| 06-02 04:25 | (머지) | **#46** | OreCrusher에 컨베이어 FBX 재임포트 덮어쓰기 사고 복구(git 히스토리에서) + "캐릭터는 **텍스처/슬롯 이슈로 제거**, 재작업 예정" | 미발행 |
| 06-02 13:12 | `a3c9ae4` | — | 캐릭터 에셋 전량 삭제("데스크탑에서 재작업 예정") — 삭제 목록에 `Man/Material_1.uasset`, `Woman/Material_1.uasset` | 미발행 |
| 06-03 14:46 | `42409db` | (이슈 #47) | 캐릭터 재임포트 성공 (데스크탑) | 미발행 |
| 06-05 00:24 | `fdb9d4b` | #89에 포함 | **[사건②-a] 캐릭터** 머티리얼 자체 PBR(ManMat/WomanMat) 교체 — "Interchange 레거시 Phong 의존 제거", MeshyImports 의존 0 | 미발행 |
| 06-21 17:18 | `3654776` | **#324** | Man_Idle hips Z 전 57프레임 -11.5 접지 (UE Python 측정 11.48→-0.02) | 19편 한 줄 |
| 06-21 20:41 | `138fab4` | #327에 포함 | 사다리 애니 임포트 + **Material_1 → ManMat_2/WomanMat_2 리네임** (새 임포트가 또 Material_1 생성) | 미발행 |
| 06-26 00:28 | `61e76d9` | **#392** | Woman 추가 — Woman_Idle hips -10 접지(10.46→~0.5), `EmptyOverrideMaterials`(ManMat override 제거 — Man 머티리얼이 Woman 위에 덮여 깨짐) | 25편 한 줄 |
| 06-27 01:27 | `73a851b` | **#407** | **[사건②-b] 캐릭터** 머티리얼이 엔진 플러그인 폴더(`/InterchangeAssets/.../FBXLegacyPhongSurfaceMaterial`) 부모 MI(ManMat_2/_3)에 의존 → **노트북에서 깨짐** → ManMat/WomanMat 일원화(엔진 의존 0), 머리카락 Masked+Two-Sided 자체 처리, 고아 RTG_AutoGenerated 삭제 | 미발행 |
| 06-28 21:10 | `f473476` | #432에 포함 | 로봇 임포트 (Material_1 + texture_0 — **또 자동 머티리얼을 믿었다**) | 21편(임포트 자체) |
| 06-29 10:26 | `b877a2b` | **#444** | **[사건③] 로봇** Material_1 직렬화 결함 → M_Robot 직결 | **21편 발행** |
| 06-29 11:27 | `3c52548` | **#446** | A-1 워밍업 0.3s + UI 담당 인수인계 + 리뷰 문서 01 | 21편 발행(요지) |
| 06-29 11:58 | `aa659e9` | **#447** | A-2 셰이더 컴파일 폴링 + 리뷰 문서 02 | 21편 발행(요지) |
| 06-29 14:56 | `8920660` | **#450** | A-3 force-resident + mip 폴링 + 리뷰 문서 03 | 21편 발행(요지, 각주엔 #450 누락) |

> `gh` CLI 정상 동작. 단 42409db 메시지의 "(#47)"은 PR이 아니라 이슈 번호(PR 47 조회 시 `Could not resolve to a PullRequest`).

---

## 1. 사건① — 머신 3종 (2026-06-01, `c15db0a`) [미발행]

커밋 메시지 전문:

```
머신 3종 Meshy 임포트 PBR 머티리얼 정상화

오염된 엔진 임포트 머티리얼(FBXLegacyPhongSurfaceMaterial — 삭제된
B_Energy_* 텍스처 더미 참조로 컴파일 실패)을 우회하고 PBR 파이프라인 직접 구성.

- 메시 3종 재임포트(Nanite): SM_OreCrusher / SM_IroncladCrusher / SM_EmberforgeFoundry
- 텍스처 15개 임포트 + 설정 (Metallic/Roughness=Masks·sRGB off, Normal=Normalmap)
- 마스터 머티리얼 M_Meshy_PBR (BaseColor/Metallic/Roughness/Normal/Emissive + EmissiveStrength)
- 머신별 머티리얼 인스턴스 MI_* 3개 + 텍스처 연결, 메시 슬롯 교체
- 소스 png는 .gitignore로 커밋 제외 (.uasset에 임포트 완료)
```

- 스탯: `M_Meshy_PBR.uasset` 신규 + MI 3종 + 머신별 텍스처 5채널×3종(BaseColor/Emissive/Metallic/Normal/Roughness) 신규. 경로 `frontend/Content/OJJ/MeshyMachines/`.
- **글감**: 규약의 원형이 여기서 이미 나왔다 — "자동 머티리얼 우회, 마스터+MI 직접 구성, 텍스처 설정(sRGB off/Masks) 수동". 6편(에셋 파이프라인)은 FBX→GLB 전환과 기하 정합만 다뤘고 **머티리얼 오염 사건은 다루지 않았다.**
- 같은 날 `b664f49` (06-01 01:00): MeshyImports 원본 fbx/텍스처 + meshy 플러그인 gitignore — "UE는 cooked .uasset만 필요, 원본은 재임포트용", "플러그인 제외를 .git/info/exclude → .gitignore로 이동(팀 공유 + **노트북 자동 적용**)". 노트북/데스크탑 이중 환경이 처음부터 변수였다는 복선.

## 2. 사건①-b — 재임포트 덮어쓰기 사고 (PR #46, 2026-06-02) [미발행]

PR #46 본문 원문(`chore(asset): OreCrusher 메시 복구 + 컨베이어 2종 추가 + 에셋 정리`, merged 2026-06-02T04:25:43Z):

```
## 배경
이전 커밋(98393db)에서 SM_OreCrusher에 컨베이어 FBX가 잘못 재임포트되어
원본 메시가 덮어써짐. git 히스토리(c15db0a)에서 정상 메시 복구.

## 변경 사항
- fix: SM_OreCrusher 컨베이어 덮어쓰기 복구, 정상 광석분쇄기 메시 재적용
- feat: 컨베이어 2종(SM_ConveyorBelt) 메시·텍스처·MI 추가
- chore: 머신 머티리얼(MI_*, M_Meshy_PBR)을 Materials/ 폴더로 이동(rename)
- chore: 캐릭터 임포트 정리 (데스크탑에서 재임포트 예정)

## 참고
- 캐릭터(Man/Woman)는 텍스처/슬롯 이슈로 이번에 제거, 별도 PR로 재작업 예정
- OJJ_ prefix 영역만 변경, 타 팀원 파일 미수정
```

- `a3c9ae4`(06-02 13:12, "캐릭터 임포트 정리, 데스크탑에서 재작업 예정")의 삭제 목록에 **`CharacterMeshy/Man/Material_1.uasset`(68254B), `CharacterMeshy/Woman/Material_1.uasset`(67801B)** 이 보인다 — 캐릭터도 처음부터 Material_1을 달고 들어왔고, **1차 임포트는 "텍스처/슬롯 이슈"로 통째로 폐기**됐다.
- **글감**: 재임포트는 공짜가 아니다 — 같은 주에 "재임포트가 남의 메시를 덮어쓴 사고"와 "임포트 자체가 실패해 전량 삭제"가 연달아 났다. git 히스토리에서 메시를 복구한 것도 기록됨.

## 3. 사건② — 캐릭터 Man/Woman (6/5 + 6/27) [미발행 — 33편 최대 신규 소재]

### 3-1. 1차 절연 — `fdb9d4b` (06-05, PR #89에 포함)

커밋 메시지 전문:

```
fix(character): 캐릭터 머티리얼 자체 PBR(ManMat/WomanMat)로 교체 — Interchange 레거시 Phong 의존 제거

- ManMat/WomanMat 신규(자체 PBR), Man/Woman 스켈레탈 메시 슬롯을 신규 머티리얼로 교체
- metallic/roughness 텍스처 설정(sRGB off/압축) 정정
- 신규 머티리얼은 Character/{Man,Woman} 내부 텍스처 uasset만 참조(MeshyImports 의존 0)
```

- 스탯: `ManMat.uasset`/`WomanMat.uasset` 신규, Man/Woman 메시 슬롯 교체, metallic/roughness 텍스처 재설정. **로봇 사건(6/29)보다 24일 먼저, 캐릭터에서 같은 처방을 이미 썼다.**

### 3-2. 재발 — `138fab4` (06-21, PR #327에 포함)

커밋 메시지 발췌: "`Material_1 → ManMat_2 / WomanMat_2 리네임`" — 사다리 애니를 **새로 임포트하자 Interchange가 또 Material_1을 만들었다.** 이때는 삭제가 아니라 리네임으로 넘어갔고, 이 ManMat_2가 6일 뒤 터진다. (현재도 `frontend/Content/OJJ/Character/Man/ManMat_2.uasset` 잔존 확인 — 고아 여부는 미확인.)

### 3-3. 노트북에서 깨짐 — `73a851b` (06-27, **PR #407**)

PR #407 본문 해당 절 원문 (title: `캐릭터 머티리얼 엔진 의존 제거 + 캐릭터 선택화면 호버 스포트라이트`, merged 2026-06-26T16:29:18Z):

```
### 1. `fix(material)` 캐릭터 머티리얼 엔진 의존 제거 (73a851b)
- **문제:** 캐릭터 머티리얼이 엔진 플러그인 폴더(`/InterchangeAssets/.../FBXLegacyPhongSurfaceMaterial`)를 부모로 쓰는 MI(ManMat_2/_3)에 의존 → git 미추적/엔진 버전 차이로 **노트북에서 깨짐**.
- **수정:** 자체 머티리얼 `ManMat`/`WomanMat`(엔진 의존 0)로 일원화.
  - 머리카락: Masked + Two-Sided + 베이스 텍스처 알파 → Opacity Mask (자체 처리)
  - 밝기/톤: Emissive 밝기 + Roughness 자체화로 기존 _2 룩 재현
  - 메시 슬롯 → 자체 머티리얼 교체 (Man 메시 바인딩 갱신)
  - 고아 에셋 `RTG_AutoGenerated.uasset`(Woman) 삭제
```

- **글감(핵심)**: 21편은 "노트북만 흰색" 전례를 **이전 팀 프로젝트** 이야기로 소개했는데, 1차 자료를 보면 **이 프로젝트의 캐릭터에서도 6/27에 똑같은 일이 났다**(엔진 플러그인 가상 경로 부모 → 노트북 깨짐). 즉 로봇 사건(6/29) 시점엔 "두 번째"가 아니라 사실상 **세 번째** 베임이었다. 21편 서사와 모순은 아니지만(21편은 로봇 시점 회고), 33편에서 시간선을 펼치면 반복 구조가 훨씬 선명하다.
- 61e76d9(06-26)의 관련 조각: `EmptyOverrideMaterials(ManMat override 제거)` — Man 전용 머티리얼 override가 Woman 메시 위에 그대로 덮여 "누움/머티리얼 깨짐/발 뜸" 3종 세트가 났고, Woman 추가 시 정리됨(PR #392 원문: "Man 전용 애님이 Woman_Skeleton에 재생돼 누움/머티리얼 깨짐/발 뜸 문제 해결").

## 4. 사건③ — 로봇 (6/28~29) [21편 기발행 — 미발행 디테일만]

### 4-1. PR #444 본문 원문 (b877a2b, merged 2026-06-29T01:26:43Z, 코멘트 0)

```
## 요약
Meshy GLB → Interchange 자동 생성 머티리얼 인스턴스(`Material_1`)가 텍스처 바인딩/부모를 제대로 직렬화하지 못해, 재로드(다른 기기/에디터 재시작) 시 텍스처가 엔진 `DefaultTexture`로 떨어지고 Texture Sample이 ERROR → 로봇 포트레이트가 흰색+노이즈로 렌더되는 결함을 수정.

## 원인
- Interchange 자동 머티리얼 인스턴스의 구조적 직렬화 결함 (로봇/Man/Woman 공통)
- 진단: git blob == 디스크 sha256 동일 → 동기화/LFS/autocrlf 아님, 깨진 에셋 자체가 커밋됨

## 변경
- 자동 인스턴스 미경유 **수동 베이스 머티리얼 `M_Robot`** 생성
- 로봇 GLB 재임포트로 텍스처 4채널 신규 임포트(baseColor/MR/normal/emissive)
- 메시 머티리얼 슬롯을 `M_Robot`으로 교체 (메시/스켈레톤/Idle 이름 유지 → **C++ 무변경**)
- 깨진 `Material_1` / 옛 `texture_0` 삭제

## 검증
- 에디터 재시작 후 ERROR 없음 + PIE 포트레이트 정상 확인 완료
```

- **미발행 디테일**: "진단: **git blob == 디스크 sha256 동일** → 동기화/LFS/autocrlf 아님, **깨진 에셋 자체가 커밋됨**" — 파일 동기화 계층을 배제하는 진단 절차. 21편엔 없다.
- 커밋 스탯(에셋 전용, 코드 0줄): `M_Robot.uasset` 신규(20294B), `Material_1.uasset` 삭제(70441B), 텍스처 `Meshy_AI_Lumen_Sentinel_0629010424_texture_texture_0~3.uasset` 4장 신규, 메시 재저장. 머지 커밋 `8ea49df`.

### 4-2. PR #447 본문 원문 (aa659e9, merged 2026-06-29T02:58:42Z, 코멘트 0)

```
## 요약
에디터 첫 PIE 시 M_Robot 베이스패스 셰이더가 DDC 미스로 컴파일 중이라(셰이더당 ~0.42s, 콜드 시 수 초) 로봇이 디폴트 머티리얼로 깨진 채 캡처되던 **첫 프레임 글리치**를 수정. A-1(고정 0.3초 지연)으론 컴파일 완료를 못 기다려 미해결이었음 — 머티리얼 에디터를 한번 열면 셰이더가 동기 컴파일·캐시되어 정상화되던 증상이 원인을 확증.

## 변경
- 고정 지연 대신 `GShaderCompilingManager->IsCompiling()` **폴링**으로 실제 컴파일 완료를 기다린 뒤 캡처 시작 (머신/DDC 상태에 강건) — `CaptureWarmupPollInterval`(0.15s) 간격, `CaptureMaxWarmupWait`(15s) 타임아웃 안전망
- `#if WITH_EDITOR` 가드(+`ShaderCompiler.h`) — 패키징은 셰이더 쿡되어 대기 분기 제외, 즉시 캡처 (글리치 자체가 패키징엔 없음, **런타임 비용/회귀 0** — warm DDC면 즉시 통과)
- `EndPlay`에서 워밍업 타이머 정리 (Subsystem `Destroy()` 윈도우 대비, 리뷰 반영)
- 리뷰 문서 `docs/04_reviews/2026-06-29_reviews_02.md`

## 검증
- 빌드 (에디터 타깃): **Succeeded**
- **PIE: 첫 PIE부터 포트레이트 깨끗 (통과)**
- Codex 리뷰: Blocker/Major 없음, Minor 1건(EndPlay) 반영
```

- **미발행 디테일**: "**머티리얼 에디터를 한번 열면** 셰이더가 동기 컴파일·캐시되어 정상화되던 증상이 원인을 확증" — 디버깅 정황 증거. 21편엔 없다.

### 4-3. PR #450 본문 원문 (8920660, merged 2026-06-29T05:56:53Z, 코멘트 0)

```
## 요약
셰이더 컴파일 대기(#447)만으론 첫 캡처가 **저해상도**로 찍히던 문제 수정. 진단 로그로 캡처 직전 로봇 텍스처 4장이 모두 **resident 7/12 mips (NOT FULLY RESIDENT)** 임을 확인 — 텍스처 mip 스트림인 미완.

## 변경
- BeginPlay에서 로봇 텍스처 `bForceMiplevelsToBeResident=true` + 캐시 (격리 배치라 화면커버리지 스트리밍이 저밉에서 멈추는 것 방지)
- `TryBeginCapture`가 셰이더 컴파일(에디터, WITH_EDITOR) **AND** 텍스처 full-resident(공통, 가드 없음) **둘 다** 대기 후 캡처 — `CaptureMaxWarmupWait`(15s) 타임아웃 공유
- `EndPlay`에서 force 플래그 **원본값 복원**(공유 텍스처에 강제 풀밉 영구 잔존 방지 — 리뷰 Major 반영)
- 빈 캐시 시 Warning 로그(무음 재발 방지 — 리뷰 Minor 반영)
- 리뷰 문서 `docs/04_reviews/2026-06-29_reviews_03.md`

## ⚠️ 패키징에도 적용
텍스처 스트리밍은 쿡 빌드 런타임에도 발생 → 셰이더 대기와 달리 **WITH_EDITOR 가드 없음**(출시 빌드 첫 캡처도 보호).

## 검증
- 빌드 (에디터 타깃): **Succeeded**
- **PIE: 첫 PIE부터 풀해상도 캡처(통과), 타임아웃 경고 없음**
- Codex 리뷰: Major(force 수명) + Minor(빈 캐시) 반영 완료
```

### 4-4. 리뷰 문서 원문 발췌 (docs/04_reviews/, 커밋 `96c93eb`로 레포 반영)

**`2026-06-29_reviews_01.md`** (A-1, 3c52548 대상) — Minor 1건:

```
### 🟡 Minor — 워밍업 0.3초 동안 RT 빈(투명) 상태 노출
- **내용:** 워밍업 0.3초 동안 bCaptureEveryFrame=false라 RT가 채워지지 않음. ...
- **제안/결정:** **수용**. RT ClearColor가 BeginPlay에서 투명(alpha 0)으로 설정되고 UI 머티리얼 M_Portrait_UI가
  1-Alpha 처리하므로, 워밍업 중에는 검정이 아니라 **투명**으로 보임(빈 칸). 레벨 진입 직후 잠깐이며 무해.
```

긍정 항목 중: "`bCaptureEveryFrame` 토글을 무리하게 위젯 open/close에 묶지 않고(대화창 상시 노출 전제), 워밍업 지연이라는 위젯-독립적 C++ 해법으로 처리 — 담당(LDJ) 경계 침범 없음." *(게재 시 LDJ → "UI 담당 팀원")*

**`2026-06-29_reviews_02.md`** (A-2, aa659e9 대상) — Minor 2건 + Nit:

```
### 🟠→해결 Minor — `EndPlay` 타이머 정리 누락 (리뷰 후 반영)
- **내용:** 워밍업 폴링 도중 액터가 파괴되면(`UOJJ_PortraitCaptureSubsystem::Deinitialize`가 자동 스폰분을
  `Destroy()`) 보류 타이머 콜백이 파괴된 액터에 도달할 여지.
- **조치:** **반영 완료** — `EndPlay` 오버라이드 추가해 `GetTimerManager().ClearTimer(CaptureWarmupTimer)` 호출.

### 🟡 Minor — `IsCompiling()` 전역 큐 대기 (수용)
- **내용:** `IsCompiling()`은 M_Robot만이 아닌 전역 셰이더 큐를 기다림 → 무관 셰이더가 길면 최대 15초 포트레이트 지연.
- **결정:** **수용**. PIE 한정 + 15초 타임아웃 안전망. UE5에 머티리얼별 준비완료 공개 API 부재로 대안 제한적.
```

**`2026-06-29_reviews_03.md`** (A-3, 8920660 대상) — Major 1 + Minor 2:

```
### 🟠→해결 Major — `bForceMiplevelsToBeResident` 수명 미복원 (리뷰 후 반영)
- **내용:** force 플래그를 true로 설정 후 복원하지 않아, 액터가 사라진 뒤에도 공유 UTexture2D에 강제 풀밉이
  영구 잔존. 메모리 비용이 액터 수명으로 제한되지 않음.
- **조치:** **반영 완료** — 원래 값을 RobotTexturesPrevForceResident에 저장, EndPlay에서 원본값으로 복원
  (blind false가 아니라 원복 → 타 시스템이 force하던 텍스처 보존). 복원 후 캐시 Reset.

### 🟡→해결 Minor — 빈 캐시 시 무음 스킵 (리뷰 후 반영)
- **내용:** RobotMesh 없음/텍스처 0개 수집 시 AreRobotTexturesFullyResident()가 true 반환 → 대기를 건너뛰어
  저해상도 첫 캡처가 조용히 재발 가능.
- **조치:** **반영 완료** — Warning 로그 추가("텍스처 없음"과 "수집 실패" 구분).

### 🟡 Minor — 전 텍스처(노멀/러프니스/메탈릭 포함) 대기 (수용)
- **결정:** **수용**. 4장 규모 + PIE 검증 통과. ... 지연 민감해지면 base color로 범위 축소 검토.
```

리뷰 03 긍정 항목: "진단을 추측이 아닌 **로그(resident 7/12)로 확정**한 뒤 수정 — 원인-수정 정합."

### 4-5. UI 담당 인수인계 문서 (docs/02_work_plans/2026-06-29-robot-portrait-ldj-handoff.md) [내용 미발행]

- 구조: "OJJ가 준비한 것(건드릴 필요 없음)" 표 / "할 것 — Brush에 M_Portrait_UI 할당, Draw As=Image, **Tint 흰색(곱연산 주의)**, 1:1 유지" / "동작/주의(워밍업 0.3초 투명, 상시 캡처, 단일 인스턴스 — 수동 배치 추가 금지)" / **트러블슈팅 표 4행**(빈 칸이면 화이트리스트→RT 더블클릭→Output Log `[PortraitSubsystem]` 순 확인, 찌그러지면 1:1 비율).
- **글감**: "바이너리 협업" 축 — 위젯 담당에게 코드가 아니라 **증상→확인 순서 표**로 넘긴 문서. 29편 바이너리 협업 서사의 자매편. *(게재 시 "LDJ" 전부 일반화)*

---

## 5. 현재 코드 원문 — `Source/.../Private/OJJ_PortraitCapture.cpp` (21편은 축약 인용, 아래가 원문)

### 5-1. BeginPlay 말미 — 텍스처 force + 워밍업 등록 (원문)

```cpp
	// 로봇 텍스처를 수집하고 전체 밉을 강제 resident로 요청(스트리밍 우선순위). 격리 배치(Z=-5000)라
	// 화면 커버리지 기반 스트리밍이 저밉에서 멈출 수 있어, 강제 force가 필요하다.
	CacheAndForceRobotTextures();

	// --- 캡처 워밍업: 셰이더 컴파일 + 텍스처 스트림인 완료 대기 ---
	// 첫 PIE는 ① 셰이더 컴파일 미완(에디터, 디폴트 머티리얼로 깨짐) ② 텍스처 mip 스트림인 미완(공통, 저해상도)
	// 으로 깨진 첫 프레임이 캡처될 수 있다. CaptureWarmupDelay 뒤부터 둘 다 끝났는지 폴링해(TryBeginCapture)
	// 완료 시 캡처를 켠다 — 고정 지연이 아니라 실제 완료를 기다려 머신/DDC/스트리밍 상태에 강건.
	if (Capture)
	{
		CaptureWarmupElapsed = 0.f;
		if (CaptureWarmupDelay > 0.f)
		{
			GetWorldTimerManager().SetTimer(
				CaptureWarmupTimer, this, &AOJJ_PortraitCapture::TryBeginCapture, CaptureWarmupDelay, /*bLoop=*/false);
		}
		else
		{
			TryBeginCapture();
		}
	}
```

### 5-2. EndPlay — 타이머 정리 + force 원본값 복원 (전문)

```cpp
void AOJJ_PortraitCapture::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	// 워밍업 폴링 중 파괴되면 보류 중인 타이머를 정리(콜백이 파괴된 액터에 도달하는 것 방지).
	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().ClearTimer(CaptureWarmupTimer);
	}

	// 강제 force한 텍스처의 bForceMiplevelsToBeResident를 원래 값으로 복원 — 액터(Subsystem이 Destroy)가
	// 사라진 뒤 공유 텍스처에 강제 풀밉이 영구히 남지 않게 한다. blind false가 아니라 원본 복원(타 시스템 force 보존).
	for (int32 i = 0; i < RobotTextures.Num(); ++i)
	{
		if (UTexture2D* Tex2D = RobotTextures[i])
		{
			Tex2D->bForceMiplevelsToBeResident =
				RobotTexturesPrevForceResident.IsValidIndex(i) ? RobotTexturesPrevForceResident[i] : false;
		}
	}
	RobotTextures.Reset();
	RobotTexturesPrevForceResident.Reset();

	Super::EndPlay(EndPlayReason);
}
```

### 5-3. TryBeginCapture — 이중 대기 폴링 (전문)

```cpp
void AOJJ_PortraitCapture::TryBeginCapture()
{
	// 캡처 시작 전 두 가지를 기다린다(둘 중 하나라도 미완이면 폴링 계속):
	//  ① (에디터) 셰이더 컴파일 완료 — 미완이면 로봇이 디폴트 머티리얼로 깨져 캡처됨. 패키징은 쿡되어 무관.
	//  ② (에디터+패키징) 로봇 텍스처 mip full-resident — 미완이면 저해상도로 캡처됨. 스트리밍은 런타임 공통.
	bool bWaiting = false;

#if WITH_EDITOR
	if (GShaderCompilingManager && GShaderCompilingManager->IsCompiling())
	{
		bWaiting = true;
	}
#endif

	if (!AreRobotTexturesFullyResident())
	{
		bWaiting = true;
	}

	// 미완이고 최대 대기 안 넘었으면 폴링 간격으로 재확인.
	if (bWaiting && CaptureWarmupElapsed < CaptureMaxWarmupWait)
	{
		CaptureWarmupElapsed += CaptureWarmupPollInterval;
		GetWorldTimerManager().SetTimer(
			CaptureWarmupTimer, this, &AOJJ_PortraitCapture::TryBeginCapture, CaptureWarmupPollInterval, /*bLoop=*/false);
		return;
	}

	if (bWaiting)   // 최대대기 초과로 빠져나온 경우(안전망 — 무한 대기 방지)
	{
		UE_LOG(LogTemp, Warning,
			TEXT("[OJJ_PortraitCapture] 워밍업 대기 %.1fs 초과 — 미완 상태로 캡처 시작(셰이더/텍스처 미완 가능)."),
			CaptureMaxWarmupWait);
	}

	BeginContinuousCapture();
}
```

### 5-4. CacheAndForceRobotTextures — 텍스처 수집·force (전문)

```cpp
void AOJJ_PortraitCapture::CacheAndForceRobotTextures()
{
	RobotTextures.Reset();
	RobotTexturesPrevForceResident.Reset();
	if (!RobotMesh)
	{
		UE_LOG(LogTemp, Warning, TEXT("[OJJ_PortraitCapture] RobotMesh 없음 — 텍스처 force/대기 스킵(저해상도 첫 캡처 가능)."));
		return;
	}

	// 로봇 머티리얼이 쓰는 모든 텍스처를 모아 캐시하고, 전체 밉을 강제 resident로 표시한다.
	// 포트레이트는 격리 배치(Z=-5000)라 화면 커버리지 기반 스트리밍이 저밉에서 멈출 수 있어, 강제 force가 필요.
	// 원래 플래그 값을 함께 저장해 EndPlay에서 원복한다(공유 텍스처에 강제 풀밉이 영구히 남지 않게).
	const TArray<UMaterialInterface*> Mats = RobotMesh->GetMaterials();
	for (UMaterialInterface* Mat : Mats)
	{
		if (!Mat)
		{
			continue;
		}
		TArray<UTexture*> UsedTextures;
		Mat->GetUsedTextures(UsedTextures);
		for (UTexture* Tex : UsedTextures)
		{
			if (UTexture2D* Tex2D = Cast<UTexture2D>(Tex))
			{
				if (RobotTextures.Contains(Tex2D))   // 중복 제외(원본값 배열과 인덱스 정렬 유지)
				{
					continue;
				}
				RobotTextures.Add(Tex2D);
				RobotTexturesPrevForceResident.Add(Tex2D->bForceMiplevelsToBeResident);  // 원래 값 저장
				Tex2D->bForceMiplevelsToBeResident = true;  // 렌더 여부와 무관하게 전체 밉 스트림인
			}
		}
	}

	if (RobotTextures.Num() == 0)
	{
		// "텍스처 없음(의도)"과 "수집 실패"를 구분하기 위한 경고 — 비면 대기를 건너뛰어 저해상도 첫 캡처 재발 가능.
		UE_LOG(LogTemp, Warning,
			TEXT("[OJJ_PortraitCapture] 로봇 머티리얼 텍스처 0개 수집 — 텍스처 대기 스킵. 머티리얼/텍스처 할당을 확인하세요."));
	}
}
```

### 5-5. AreRobotTexturesFullyResident + BeginContinuousCapture (전문)

```cpp
bool AOJJ_PortraitCapture::AreRobotTexturesFullyResident() const
{
	// 캐시가 비어 있으면(텍스처 없음/수집 실패) 대기하지 않는다.
	for (const UTexture2D* Tex2D : RobotTextures)
	{
		if (Tex2D && Tex2D->GetNumResidentMips() < Tex2D->GetNumMips())
		{
			return false;
		}
	}
	return true;
}

void AOJJ_PortraitCapture::BeginContinuousCapture()
{
	if (!Capture)
	{
		return;
	}

	// 워밍업 끝(셰이더 컴파일 + 텍스처 스트림인 완료) — 연속 캡처를 켜고 즉시 한 장 갱신한다.
	Capture->bCaptureEveryFrame = true;
	Capture->CaptureScene();
}
```

### 5-6. 헤더 워밍업 프로퍼티 원문 (`Public/OJJ_PortraitCapture.h`)

```cpp
	float CaptureWarmupDelay = 0.3f;          // 폴 시작 전 초기 지연(컴파일 잡 큐 등록 대기), Clamp 0.0~2.0
	float CaptureWarmupPollInterval = 0.15f;  // 폴링 간격, Clamp 0.02~1.0
	float CaptureMaxWarmupWait = 15.f;        // 최대 대기(안전망), Clamp 1.0~60.0
	FTimerHandle CaptureWarmupTimer;
	float CaptureWarmupElapsed = 0.f;         // 누적 폴링 대기 시간 — CaptureMaxWarmupWait 비교용
	TArray<UTexture2D*> RobotTextures;                 // (UPROPERTY(Transient) — GC 안전, 리뷰 확인 항목)
	TArray<bool> RobotTexturesPrevForceResident;       // 원래 값(EndPlay 원복용, 인덱스 정렬)
```

### 5-7. A-1 원본 diff (`3c52548`, PR #446) — "0.3초" 최초 형태 (발췌)

```diff
-	Capture->bCaptureEveryFrame = true;          // idle 애니 실시간 반영
+	// 캡처는 BeginPlay 워밍업 지연 후 켠다(BeginContinuousCapture) — 첫 프레임 셰이더 컴파일/스트림인 글리치 회피.
+	Capture->bCaptureEveryFrame = false;
```
```cpp
+	// --- 캡처 워밍업 지연 ---
+	// BeginPlay 직후 몇 프레임은 M_Robot 셰이더 첫 컴파일/텍스처 스트림인으로 깨진 채 렌더된다(에디터 첫 PIE).
+	// 매 프레임 캡처가 그 깨진 프레임을 RT에 찍지 않도록, CaptureWarmupDelay 뒤에 연속 캡처를 켠다(0이면 즉시).
+	if (Capture)
+	{
+		if (CaptureWarmupDelay > 0.f)
+		{
+			GetWorldTimerManager().SetTimer(
+				CaptureWarmupTimer, this, &AOJJ_PortraitCapture::BeginContinuousCapture, CaptureWarmupDelay, /*bLoop=*/false);
+		}
+		else
+		{
+			BeginContinuousCapture();
+		}
+	}
```

- **글감**: A-1 주석은 이미 "셰이더 첫 컴파일/**텍스처 스트림인**"을 둘 다 지목하고 있었다 — 원인 후보는 첫날부터 맞게 짚었는데, 처방(고정 지연)이 얕았던 것. A-2 헤더 diff에서 `CaptureWarmupDelay`의 의미가 "글리치 회피 지연" → "**폴링 시작 전 초기 지연**(컴파일 잡 큐 등록 대기)"으로 재정의된 것도 진화의 디테일.

---

## 6. hips 접지 보정 원자료 (PR #324 / #392) [19·25편 한 줄씩만 발행]

### PR #324 본문 원문 (3654776, merged 2026-06-21T09:03:49Z)

```
## 문제
Man_Idle 애니메이션만 캐릭터 발이 ~+11.5 떠 있음(Walk/Run 정상). BlendSpace 0속도 샘플이라 정지 시 항상 뜸.

## 원인
이 Meshy 리그는 별도 `root` 본 없이 `hips`가 최상위(루트). Man_Idle의 hips가 Walk/Run 대비 ~11.5 높게 익스포트됨.
UE Python 측정: 발끝 최저 컴포넌트 Z = **Idle 11.48 / Walk 0.06 / Run -0.23**.

## 수정
`hips` 트랙 Z를 전 57프레임 **-11.5** 시프트(회전/스케일/호흡 모션 보존). 적용 후 발끝 최저 Z = **-0.02**(접지).
PIE 확인 정상, Idle↔Walk 전환 튐 없음.

## KNOWN-LIMIT
Meshy로 Man_Idle 재임포트 시 보정 사라짐 → hips Z -11.5 재적용 필요(스크립트 `Saved/PyDump/apply_idle_lift.py`, gitignore).
```

- Woman 쪽(61e76d9, PR #392): "Woman_Idle — hips Z **-10** 보정 (발 **+10.46** 뜸 → **~0.5** 접지, UE Python `set_bone_track_keys`)".
- **글감**: 머티리얼과 같은 구조의 이야기 — AI 산출물의 결함을 **측정으로 확정**(UE Python으로 발끝 Z 재기) → 원본 비파괴 최소 보정(hips 트랙만) → **재임포트하면 소실**되는 한계를 KNOWN-LIMIT + 재적용 스크립트로 문서화. "보정은 저장되지만 규약은 스크립트로 남긴다". 33편에서 머티리얼 축의 보조 사례로 쓸 수 있고, 분량상 빼도 됨(애니 축은 25편과 겹칠 위험).

---

## 7. 수치/문자열 원문 (블로그 인용용)

| 항목 | 값 | 출처 |
|------|----|----|
| 셰이더 컴파일 소요 | 셰이더당 ~0.42s, DDC 콜드 시 수 초 | PR #447 본문 |
| 캡처 워밍업 | Delay 0.3s / Poll 0.15s / MaxWait 15s | OJJ_PortraitCapture.h:108,112,116 |
| mip 미스트림인 진단 | 로봇 텍스처 4장 모두 "resident **7/12** mips (NOT FULLY RESIDENT)" | PR #450 본문·reviews_03 |
| RT | RT_RobotPortrait 512×512 | 인수인계 문서 |
| 격리 배치 | Z=-5000 (21편 기발행) | 21편·코드 주석 |
| 로봇 텍스처 | 4채널 baseColor/MR/normal/emissive, `..._0629010424_texture_texture_0~3` | b877a2b 스탯 |
| Material_1 크기 | 로봇 70441B(삭제), Man 68254B/Woman 67801B(1차 임포트분, a3c9ae4에서 삭제) | git 스탯 |
| 머신 오염 원인 | FBXLegacyPhongSurfaceMaterial이 삭제된 `B_Energy_*` 텍스처 더미 참조 → 컴파일 실패 | c15db0a 메시지 |
| 캐릭터 오염 원인 | 엔진 플러그인 폴더 `/InterchangeAssets/.../FBXLegacyPhongSurfaceMaterial` 부모 MI(ManMat_2/_3) → 노트북에서 깨짐 | PR #407 본문 |
| Man hips 보정 | Z -11.5, 57프레임, 발끝 11.48→-0.02 (Walk 0.06/Run -0.23) | PR #324 |
| Woman hips 보정 | Z -10, 발 +10.46→~0.5 | PR #392 |
| 머신 텍스처 설정 규약 | Metallic/Roughness=Masks·sRGB off, Normal=Normalmap | c15db0a 메시지 |

로그/경고 문자열(원문):
- `"[OJJ_PortraitCapture] 워밍업 대기 %.1fs 초과 — 미완 상태로 캡처 시작(셰이더/텍스처 미완 가능)."`
- `"[OJJ_PortraitCapture] RobotMesh 없음 — 텍스처 force/대기 스킵(저해상도 첫 캡처 가능)."`
- `"[OJJ_PortraitCapture] 로봇 머티리얼 텍스처 0개 수집 — 텍스처 대기 스킵. 머티리얼/텍스처 할당을 확인하세요."`
- 인수인계 트러블슈팅 표의 확인 키워드: Output Log `[PortraitSubsystem]` / `[OJJ_PortraitCapture]`

---

## 8. 서사 후보 (집필 시 취사 — 21편과 차별화 각도)

1. **"세 번 베이고 나서야 규약이 됐다"** (본명 후보) — 로봇 단건(21편)이 아니라 6/1 머신 → 6/5·6/27 캐릭터 → 6/29 로봇, 3세대 반복 사건사. 매번 칼이 달랐다(더미 참조 컴파일 실패 / 엔진 경로 의존·노트북 깨짐 / 직렬화 결함·재로드 깨짐), 처방은 매번 같았다(수동 베이스 머티리얼 직결: M_Meshy_PBR → ManMat·WomanMat → M_Robot). 21편의 "한 번은 사고고, 규약을 만들면 파이프라인"의 프리퀄+검증편.
2. **"Material_1은 죽지 않는다"** — 삭제해도(a3c9ae4) 재임포트마다 부활(138fab4 리네임 → 6일 뒤 그 ManMat_2가 노트북에서 터짐). "자동 생성물은 지우는 게 아니라 안 쓰는 구조를 만들어야 한다".
3. **진단의 진화** — sha256으로 동기화 계층 배제(#444) / "머티리얼 에디터 열면 정상화"라는 정황으로 셰이더 컴파일 확증(#447) / resident 7/12 로그로 확정(#450). "추측이 아니라 배제와 로그" — 리뷰 03의 문장("진단을 로그로 확정한 뒤 수정 — 원인-수정 정합") 인용 가능.
4. **노트북이라는 리트머스지** — 21편의 '이전 팀 프로젝트 전례'가 이 프로젝트에서도 재현(PR #407). 이중 환경(데스크탑/노트북)이 "환경 의존 에셋"을 조기 검출하는 테스트 장치 역할을 한 셈. b664f49의 gitignore 정비("노트북 자동 적용")가 복선.
5. **재임포트의 대가** — OreCrusher 덮어쓰기 사고(git 히스토리 복구), hips 보정 소실 KNOWN-LIMIT(재적용 스크립트). "AI 에셋 파이프라인에서 재임포트는 멱등이 아니다".
6. **리뷰가 잡은 수명 버그** — force-resident의 원본값 복원(Major). 21편에 한 단락 발행됐지만, 리뷰 문서 원문(reviews_03)과 EndPlay 전문 코드는 신규. 분량 주의(재탕 경계).
7. (곁가지) **바이너리 인수인계** — 트러블슈팅 표로 넘긴 인수인계 문서. 29편 바이너리 협업과 연결.

⚠️ 집필 시 주의: 4-1~4-3(로봇 PR 본문)과 5장(워밍업 코드)은 21편 재탕 위험이 가장 큰 구간 — 33편에서는 "미발행 디테일"(sha256 진단, 머티리얼 에디터 정황, 리뷰 원문)과 시간선 확장에만 쓰고, 사건 서술 자체는 21편 링크로 처리 권장.

---

## 못 찾은 항목 / 한계

- **PR #444/#447/#450 모두 코멘트 0** — 리뷰 토론은 GitHub이 아니라 `docs/04_reviews/` 문서(Codex 리뷰)로만 존재. 원문 확보 완료.
- **42409db의 "(#47)"은 이슈 번호** — `gh pr view 47`은 `Could not resolve to a PullRequest`. 이슈 본문은 미조회(필요 시 `gh issue view 47`).
- **캐릭터(Man/Woman)의 Material_1 "직렬화 결함" 단독 수정 커밋은 없음** — b877a2b가 "로봇/Man/Woman 공통"이라 진단했지만, Man/Woman은 이미 fdb9d4b·73a851b로 자체 머티리얼로 절연된 상태였기에 별도 수정 불필요했던 것으로 보임(추정 — 명시 기록 없음). 현재 `ManMat_2.uasset` 잔존이 고아인지 사용 중인지는 .uasset 바이너리라 미확인.
- **머티리얼 노드 그래프**(M_Robot/M_Meshy_PBR/ManMat 내부 구성)는 .uasset 바이너리라 확인 불가 — 커밋 메시지의 채널 구성 서술까지만 확보.
- **6/2 캐릭터 1차 임포트 실패의 "텍스처/슬롯 이슈" 구체 증상** — PR #46의 한 줄 서술이 전부, 스크린샷/로그 없음.
