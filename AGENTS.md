# JJ.Dev Blog — Codex 작업 컨텍스트

> 이 문서는 Codex가 JJ.Dev 블로그 작업을 이어가기 위한 핵심 정보입니다.
> 작성 시점: 2026-05-21 (Hero 섹션 완료 후, Marquee 작업 시작 직전)

---

## 프로젝트 개요

- **저장소:** `https://github.com/ojaejun1995-sys/ojaejun1995-sys.github.io`
- **로컬 경로:** `C:\Dev\Blog\ojaejun1995-sys.github.io`
- **목표:** GitHub Pages 기반 개인 블로그 + 포트폴리오
- **디자인:** Jack 3D Creator (motionsites.ai) 톤 기반 변형
- **사용자:** 재준 (UE5 개발자, 디지털트윈 엔지니어 지망)

---

## 기술 스택

```json
{
  "framework": "Astro 6.3.5",
  "styling": "Tailwind 4.x",
  "language": "TypeScript Strict",
  "react": "@react-three/fiber 9.6.1 (3D)",
  "3d": "three 0.184.0 + @react-three/drei 10.7.7",
  "animation": "framer-motion (설치됨)",
  "icons": "lucide-react"
}
```

---

## 완료된 작업

### ✅ Hero 섹션 완성
- `src/layouts/Layout.astro` - HTML 골격
- `src/styles/global.css` - 다크 테마 + Kanit 폰트
- `src/pages/index.astro` - 메인 페이지
- `src/components/HeroSection.tsx` - Hero 전체
- `src/components/FadeIn.tsx` - 페이드인 애니메이션
- `src/components/Magnet.tsx` - 마우스 자석 효과 (현재 미사용)
- `src/components/ContactButton.tsx` - 그라데이션 버튼
- `src/components/Character3D.tsx` - 3D 캐릭터 (Hunyuan3D로 생성)
- `public/models/jj-character.glb` - 3D 모델
- `public/images/jj-portrait.png` - 백업 PNG

### ✅ GitHub 푸시 완료
- 마지막 커밋: `a7bad1f` ("Add Hero section with 3D character")

---

## 남은 작업 (우선순위 순)

### 1. Marquee 섹션 (지금 작업 중)
- **결정:** 영문 기술 스택 키워드 텍스트 마퀴
- **위치:** Hero 섹션 아래
- **구조:** 2줄, 반대 방향 무한 스크롤
- **파일:** `src/components/Marquee.tsx` (새로 만들기)

**Row 1 키워드 (왼쪽으로 흐름):**
```
UE5 · C++ · Unreal Engine · Multiplayer · Replication · 
Listen Server · UMG · Niagara · GAS · Chaos Vehicles · 
Game Architecture · System Design
```

**Row 2 키워드 (오른쪽으로 흐름):**
```
Digital Twin · Smart Factory · IoT · MQTT · WebSocket · 
Hermes Agent · Codex · MCP · Obsidian · Python · 
AI-Native Workflow · Autonomous Systems
```

### 2. About 섹션
- 스크롤 시 글자별 opacity 애니메이션 (Jack 시그니처)
- 텍스트:
```
An Unreal Engine 5 developer building games, digital twins, and AI-augmented systems.
I work with Hermes Agent, Codex, and MCP-based tooling to amplify what one developer can ship.
My interest lies where simulation, intelligent agents, and physical engineering converge.
Let's build the next-generation tools together.
```

### 3. Services 섹션 (5개 항목)
- 영문 헤딩 + 한국어 설명
- 01 Unreal Engine Development
- 02 Digital Twin Engineering
- 03 AI Agent Integration
- 04 Simulation & Automation
- 05 System Architecture & Networking

상세 설명은 `jj-dev-handover.md` 참고.

### 4. Projects 섹션 (카드 스택 효과)
- 4개 카드 + View All 링크
- 01 Split/Second Mock
- 02 Apex Legends Mock (WP_4th)
- 03 DigitalTwinFactory
- 04 AI-Native Dev Workflow

별도 페이지 `/projects`에 Scarlet Nexus: Karen 추가.

### 5. Blog 섹션 (시리즈 단위 노출)
- 형식: 시리즈 묶음으로 노출
- 예: Apex 회고 시리즈 (4편), Split/Second 회고, DTF 일지

### 6. Contact 섹션
- 거대 텍스트: "LET'S CONNECT."
- 짧은 카피: "함께 만들 만한 게 있거나 그냥 안부 인사도 환영합니다."
- Email: ojaejun1995@gmail.com
- GitHub: ojaejun1995-sys
- LinkedIn: linkedin.com/in/재준-오-1995abc
- Footer: Built with Astro · TypeScript · Tailwind

### 7. 별도 페이지
- `/blog` - 전체 글 목록 (시리즈별)
- `/projects` - 전체 프로젝트 (Scarlet Nexus 포함)

### 8. GitHub Pages 배포
- GitHub Actions 워크플로우 작성
- 자동 빌드 + 배포

### 9. Velog 글 이전
- 기존 Velog 글들을 새 블로그 마크다운으로 옮기기
- 카테고리: 회고, UE5, 디지털트윈, AI, 도구

---

## 디자인 명세

### 색상
- 배경: `#0C0C0C`
- 본문 텍스트: `#D7E2EA`
- 그라데이션 텍스트: `linear-gradient(180deg, #646973 0%, #BBCCD7 100%)`
- 버튼 그라데이션: `linear-gradient(123deg, #18011F 7%, #B600A8 37%, #7621B0 72%, #BE4C00 100%)`

### 폰트
- Kanit (300-900)

### 인터랙션
- Hero: 3D 캐릭터 마우스 추적
- Marquee: 좌우 무한 스크롤 (두 줄 반대 방향)
- About: 글자별 opacity 애니메이션
- Projects: 카드 스택 (스크롤 시 카드 겹치며 작아짐)

---

## 작업 시 주의사항

### Windows 환경
- PowerShell 5.x: `&&` 미지원, `;` 또는 `if ($?)` 사용
- here-string으로 JSX 코드 작성 금지 (`<` 가 깨짐)
- Antigravity IDE로 직접 편집 권장
- 파일 인코딩 UTF-8 필수

### Git 워크플로우
- 큰 단위 작업 완료 후 즉시 커밋·푸시
- 커밋 메시지 영문 권장

### Astro 특이사항
- React 컴포넌트는 `client:load` 디렉티브 필요
- Tailwind 4.x 사용 (3.x와 설정 다름)
- `@import` 문은 CSS 파일 맨 위에

---

## 사용자 컨텍스트

- IDE: Antigravity (`C:\Users\user\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe`)
- 단축어: bl (블로그 폴더 + Antigravity 열기)
- PKM: Obsidian Vault "JJ-Brain" (`C:\Obsidian.JJ\JJ-Brain`)
- 다른 프로젝트: WP_4th, DigitalTwinFactory, ScarletNexus-Karen

---

## 다음 액션 (Codex에서 시작 시)

1. **현재 상태 확인:**
   ```bash
   git status
   git log --oneline -5
   ls src/components
   ```

2. **dev 서버 실행:**
   ```bash
   npm run dev
   ```

3. **Marquee.tsx 작성:**
   - 위치: `src/components/Marquee.tsx`
   - 두 줄 반대 방향 무한 스크롤
   - Framer Motion 사용
   - HeroSection 아래에 추가

4. **HeroSection.tsx에 import 추가:**
   ```tsx
   import Marquee from './Marquee';
   ```

5. **index.astro에 Marquee 추가:**
   ```astro
   <HeroSection client:load />
   <Marquee client:load />
   ```

6. **결과 확인 후 다음 섹션 (About) 진행**

---

## 블로그 시스템 (Astro Content Collections)

블로그는 `src/content/blog/` 하위의 마크다운 파일을 Astro Content Collection으로 로드합니다.
파일을 추가하면 자동으로 `/blog/[slug]` 경로의 정적 페이지가 생성되고, 시리즈 그룹·단편·메인 카드도 자동 갱신됩니다.

### 핵심 파일

| 파일 | 역할 |
|------|------|
| `src/content.config.ts` | Zod 기반 frontmatter 스키마 |
| `src/data/series.ts` | 시리즈 슬러그 → 이름/설명/카테고리 매핑 |
| `src/lib/blog.ts` | `loadPublishedPosts`, `groupPosts`, `findSeriesNeighbors`, `formatDate` 헬퍼 |
| `src/content/blog/*.md` | 글 본문 (단편) |
| `src/content/blog/<series>/*.md` | 시리즈 글 (디렉토리로 묶어도 되고, frontmatter `series` 필드만으로도 동작) |
| `src/pages/blog/[...slug].astro` | 개별 글 페이지 (prev/next, prose 스타일 포함) |
| `src/pages/blog/series/[seriesSlug].astro` | 시리즈 글 목록 페이지 |

### 새 글 작성

1. **파일 생성:** `src/content/blog/<slug>.md`
   - 시리즈 글은 폴더로 묶어도 OK: `src/content/blog/<series-slug>/<part-slug>.md`
   - 파일 경로가 URL이 됩니다. 예: `src/content/blog/wp-4th/01-setup.md` → `/blog/wp-4th/01-setup`
2. **Frontmatter 작성:**

   ```yaml
   ---
   title: "글 제목"
   description: "한 줄 요약 (블로그 카드와 메타 영역에 노출)"
   date: 2026-05-22                       # YYYY-MM-DD
   category: 회고                          # 회고 | UE5 | 디지털트윈 | AI | 도구
   series: wp-4th                          # (선택) 시리즈 슬러그 — src/data/series.ts 의 키와 일치
   seriesPart: 1                           # (선택) 시리즈 내 순서 (정렬 + 표시용)
   tags: [UE5, multiplayer, networking]    # (선택) 본문 하단 #태그
   originalUrl: "https://velog.io/@..."    # (선택) Velog/Tistory 등 원본 글 링크
   heroImage: "/images/blog/foo.png"       # (선택) 글 상단 큰 이미지 (public/ 기준)
   draft: false                            # 기본 false. true면 빌드/목록에서 제외
   ---
   ```

3. **본문 마크다운 작성:**
   - 헤딩(`##`/`###`), 리스트, 표, 인용(`>`), 코드 블록(```` ``` `lang` ````) 모두 동작
   - 코드 블록 syntax highlighting: Shiki `github-dark` 테마
   - 이미지: `public/` 폴더에 두고 `/path` 형태로 참조 (예: `public/images/blog/foo.png` → `/images/blog/foo.png`)
   - 외부 링크/내부 링크 모두 일반 마크다운 문법

4. **새 시리즈 추가:**
   - 글의 frontmatter `series` 필드에 슬러그(kebab-case) 입력
   - `src/data/series.ts`의 `SERIES_META`에 같은 슬러그 키로 항목 추가
     (이름/설명/카테고리). 미등록 시 슬러그가 그대로 이름이 됩니다.

5. **확인 → 푸시:**

   ```bash
   npm run dev        # 로컬에서 /blog, /blog/<slug> 동작 확인
   npm run build      # 전체 정적 빌드 검증
   git add src/content/blog/... src/data/series.ts
   git commit -m "Add blog post: <slug>"
   git push origin main   # GitHub Actions가 자동 배포
   ```

### 시리즈/단편 분류 규칙

- frontmatter에 `series` 있음 → 시리즈 글로 그룹핑되어 `/blog` 시리즈 카드에 노출
- frontmatter에 `series` 없음 → `/blog` 하단 **Singles** 섹션에 노출
- 시리즈 글 내부 정렬은 `seriesPart` 오름차순, 없으면 파일명 순
- 메인 페이지 BlogSection은 시리즈 4개까지만 노출 (등록 순서 우선, 미등록은 최신순)

### draft

- `draft: true` 글은 빌드/목록/시리즈 어디에도 노출되지 않음
- 작성 중인 글은 draft로 두고, 발행 시점에 `false`로 바꿔서 푸시

### URL 패턴

| 경로 | 출처 |
|------|------|
| `/blog` | `src/pages/blog.astro` (전체 시리즈 + 단편) |
| `/blog/<post-id>` | `src/pages/blog/[...slug].astro` (개별 글) |
| `/blog/series/<series-slug>` | `src/pages/blog/series/[seriesSlug].astro` (시리즈 목록) |
| `/projects`, `/projects/<slug>` | (기존 Projects 라우트, 별도 시스템) |
