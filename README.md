ㅜ# 지면 · Jimyeon

**블록으로 구성하고, 페이지로 완성하는 문서 에디터.**

A local-first document editor with flexible blocks, live A4/A3 pages, and PDF export that matches your layout.

지면은 실제 용지 위에서 문서를 편집하는 로컬 문서 에디터입니다. 블록과 이미지를 자유롭게 배치하고, 페이지가 나뉘는 위치를 보면서 편집한 뒤 같은 레이아웃으로 PDF를 저장합니다. 이력서, 보고서, 기획서, 포트폴리오 등 페이지 단위 문서를 만들 수 있습니다.

<img width="1518" height="901" alt="스크린샷 2026-10-20 오전 9 08 45" src="https://github.com/user-attachments/assets/fdf261e5-0c00-4649-aa85-147490ec5e2b" />

## 주요 기능

- **페이지 위에서 직접 편집**: A4·A3, 페이지 경계, 상·하·좌·우 여백, 직접 페이지 나누기와 페이지 번호.
- **블록과 다중 열**: 블록 이동·복제·범위 선택, 2~5열 배치와 중첩 열, 인접한 두 열의 너비 조절.
- **이미지와 미디어**: 로컬 이미지 업로드, 크기·정렬 조절, 영상·오디오·파일, URL 미디어와 외부 임베드·북마크.
- **문서 서식**: 제목·목록·표·코드·수식·콜아웃·토글·탭·목차, 링크 색상과 구분선 색상·불투명도.
- **세밀한 간격**: 본문 기준 글자 크기, 독립된 페이지 제목 크기, 전체 행간·자간·블록 간격과 블록별 위·아래 여백.
- **로컬 저장과 내보내기**: 자동 저장, 문서 파일 백업·복원, Markdown 내보내기, 현재 배치를 반영한 PDF 저장.

계정, 공유, 댓글, 협업과 문서 동기화는 없습니다. 외부 임베드·북마크·URL 미디어를 사용할 때는 해당 주소에 접속합니다.

## 실행

### macOS·Windows 앱

설치 파일은 [GitHub Releases](https://github.com/vpdls1511/Jimyeon/releases)의 **Assets**에서 배포합니다. 릴리즈가 아직 없다면 아래 방법으로 소스에서 실행할 수 있습니다.

| 운영체제 | 설치 파일 |
| --- | --- |
| macOS Apple Silicon (M1 이후) | 이름에 `macOS-arm64`가 있는 DMG |
| macOS Intel | 이름에 `macOS-x64`가 있는 DMG |
| Windows 64비트 (Intel/AMD) | 이름에 `Windows-x64-Setup`이 있는 EXE |

각 플랫폼의 ZIP도 함께 제공합니다. 앱에는 PDF 출력용 런타임이 포함되어 있어 Node.js나 별도 Chrome 설치가 필요하지 않습니다. Linux와 Windows ARM 네이티브 설치 파일은 현재 배포 대상에 포함하지 않습니다.

macOS는 로컬 서명이며 Apple 공증을 포함하지 않고 Windows는 코드 서명이 없습니다. 각 운영체제에서 자동 검사와 패키징을 실행하며, Windows·Intel Mac의 수동 편집 검증 범위는 릴리즈 노트를 참고하세요.

### 소스에서 실행

**Node.js 22.12 이상**과 npm이 필요합니다.

```bash
git clone https://github.com/vpdls1511/Jimyeon.git
cd Jimyeon
npm ci
npm run app
```

### 브라우저에서 실행

```bash
npm run build
npm start
```

`http://127.0.0.1:5174/`에서 편집기를 엽니다. 브라우저 실행의 PDF 저장에는 설치된 Chrome 또는 Chromium 계열 브라우저가 필요합니다. 자동으로 찾지 못하면 `PUPPETEER_EXECUTABLE_PATH`로 실행 파일 경로를 지정합니다.

개발 화면은 `npm run dev`로 실행합니다. PDF 저장 기능은 `npm start` 또는 Electron 앱에서 확인합니다.

## 사용 방법

| 작업 | 방법 |
| --- | --- |
| 블록 추가 | 빈 줄에서 `/`를 입력하고 블록 선택 |
| 블록 메뉴 | 블록 왼쪽 손잡이 클릭 또는 `⌘/Ctrl+/` |
| 가로 배치 | 블록 메뉴 → 가로 배치 → 2~5열. 열 안에서도 사용 가능 |
| 열 너비 | 두 열 사이 경계를 드래그. 문서 기준 10px 단위로 양옆 두 열만 조절 |
| 여러 블록 선택 | 편집 영역의 여백에서 드래그. Shift로 추가, Esc로 해제 |
| 목록 | `- `, `1. `, `[]` 입력. Tab / Shift+Tab으로 들여쓰기 |
| 목록 안 줄바꿈 | Shift+Enter. 빈 항목에서 Enter는 목록 종료 |
| 이미지 | `/이미지` → 파일 또는 URL. 툴바·블록 메뉴에서 정렬 |
| 구분선 | `---` 입력. 블록 메뉴에서 색상과 불투명도(기본 0.5) 조절 |
| 페이지와 서식 | 상단 용지·글자 크기·페이지 설정·블록 여백 사용 |
| 페이지 나누기 | `/페이지 나누기` 또는 `/page break` |
| PDF | 상단 PDF 저장 또는 앱에서 `⌘/Ctrl+P` |
| 문서 파일 | 문서 저장 또는 `⌘/Ctrl+S`. 가져오기는 문서 메뉴 또는 앱에서 `⌘/Ctrl+O` |
| 찾기·되돌리기 | `⌘/Ctrl+F`, `⌘/Ctrl+Z` |

[시작 문서](examples/welcome.jimyeon)를 내려받아 **문서 메뉴 → 가져오기**에서 열어 볼 수 있습니다.

### 여백 조정 단축키

본문에 커서를 두거나 여러 블록을 선택한 뒤 사용합니다. 여러 블록을 선택하면 선택한 블록에 함께 적용되며, 한 번의 실행 취소로 되돌릴 수 있습니다.

| 작업 | macOS | Windows |
| --- | --- | --- |
| 블록 위 여백 2pt 늘리기 | `⌘+⌥+↑` | `Ctrl+Alt+↑` |
| 블록 아래 여백 2pt 늘리기 | `⌘+⌥+↓` | `Ctrl+Alt+↓` |
| 블록 위 여백 2pt 줄이기 | `⌘+⌥+Shift+↑` | `Ctrl+Alt+Shift+↑` |
| 블록 아래 여백 2pt 줄이기 | `⌘+⌥+Shift+↓` | `Ctrl+Alt+Shift+↓` |

상단 **블록 여백**에서 위·아래 값을 직접 입력하거나 **문서 기본값 따르기**로 초기화할 수 있습니다. 개별 여백의 범위는 0~96pt입니다. 페이지의 상·하·좌·우 여백(mm)과 문서 전체의 행간·자간·기본 블록 간격은 **페이지 설정**에서 조절합니다.

### 저장과 호환성

- 문서 파일(`.jimyeon`)은 블록·열·이미지·페이지 설정을 함께 보존하는 백업 형식입니다. Markdown은 열과 사용자 블록의 배치·세부 서식을 모두 보존하지 못합니다.
- 브라우저 문서는 해당 브라우저의 기기 저장소에 남습니다. 브라우저 데이터 삭제 전에 문서 파일을 저장해 두세요.
- macOS 앱의 자동 저장은 `~/Library/Application Support/ResumeEditor/document.json`에 보관합니다. 초기 버전 사용자의 문서를 이어받기 위해 저장 경로와 문서 형식 식별자는 유지합니다.

## 개발과 빌드

```bash
npm test          # 자동 검사
npm run build    # 웹 빌드와 의존성 라이선스 고지 생성
npm run app:pack     # 현재 운영체제의 앱 폴더
npm run app:dist     # 현재 운영체제의 설치 파일·ZIP
npm run app:dist:mac # macOS DMG·ZIP (Mac에서 실행)
npm run app:dist:win # Windows x64 설치 EXE·ZIP (Windows에서 실행)
```

빌드 결과는 `release/`에 생성됩니다. GitHub Actions의 **Desktop release**를 실행하면 Mac 두 아키텍처와 Windows를 각 운영체제에서 빌드하고 모두 성공한 결과를 하나의 릴리즈 초안에 첨부합니다. 설치 파일·소스 버전·태그를 연결하는 방법은 [릴리즈 안내](RELEASING.md)를 참고하세요.

현재 문서 구조, 입력 규칙, 다중 열, 선택·드래그, 저장, 페이지 계산과 출력용 화면 보존에 대한 **121개 자동 검사**가 있습니다. 브라우저와 Electron의 실제 화면 검증은 macOS에서 진행했습니다. 모든 블록 조합이나 외부 임베드의 인쇄 결과를 보장하는 것은 아닙니다.

구현은 React, BlockNote, ProseMirror, Electron, Vite를 사용합니다. 기여 방법은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

앱 아이콘 원본은 `electron/resources/icon-source.png`입니다. macOS에서 `swift scripts/generate-icons.swift`를 실행하면 원본 비율과 투명도를 유지한 PNG·ICNS·ICO를 다시 생성합니다. 생성된 아이콘도 저장소에 포함되어 있어 일반 빌드에서는 이 명령이 필요하지 않습니다.

## 라이선스

[GPL-3.0-only](LICENSE). 주요 의존성의 정보는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 기록되어 있습니다. 빌드 시 설치된 런타임 의존성의 라이선스 파일을 모아 `THIRD_PARTY_LICENSES.txt`를 생성하며 앱에도 포함합니다.
