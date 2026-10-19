## 지면 · Jimyeon v1.0.0

블록으로 구성하고, 페이지로 완성하는 로컬 문서 에디터의 첫 공개 릴리즈입니다.

### 다운로드

| 운영체제 | 설치 파일 | 압축 파일 |
| --- | --- | --- |
| macOS Apple Silicon (M1 이후) | `Jimyeon-1.0.0-macOS-arm64.dmg` | `Jimyeon-1.0.0-macOS-arm64.zip` |
| macOS Intel | `Jimyeon-1.0.0-macOS-x64.dmg` | `Jimyeon-1.0.0-macOS-x64.zip` |
| Windows 64비트 (Intel/AMD) | `Jimyeon-1.0.0-Windows-x64-Setup.exe` | `Jimyeon-1.0.0-Windows-x64.zip` |

Mac은 DMG를 열어 Jimyeon을 응용 프로그램 폴더로 옮깁니다. Windows는 Setup.exe로 설치하거나 ZIP을 풀고 Jimyeon.exe를 실행합니다. 두 운영체제 모두 Node.js와 별도 Chrome 설치가 필요하지 않습니다.

### 주요 기능

- A4·A3 용지 위에서 직접 편집하고 페이지 경계·여백·페이지 번호 확인
- 블록 이동·범위 선택, 중첩 다중 열, 인접 열 너비 조절
- 이미지 업로드·정렬·크기 조절과 외부 미디어·임베드
- 제목·목록·표·코드·수식·콜아웃·탭, 링크 색상과 구분선 색상·불투명도
- 글자 크기·행간·자간·전체 및 개별 블록 여백 조절
- 제공된 지면 로고를 macOS·Windows 앱 아이콘에 적용
- `.jimyeon` 문서 저장·가져오기와 기존 JSON 백업 호환
- 로컬 자동 저장, 문서 백업·복원, Markdown·PDF 내보내기

### 확인 범위

각 대상 운영체제에서 자동 검사 121개와 네이티브 패키징을 실행하고, 설치 파일에 담긴 실행 파일 아키텍처·앱 버전·라이선스 고지를 검사했습니다. macOS Apple Silicon의 편집·저장·PDF는 실제 화면으로 검증했습니다. Windows와 Intel Mac에서의 수동 편집 검증은 아직 진행하지 않았습니다.

macOS는 로컬 서명이며 Apple 공증을 포함하지 않습니다. Windows 배포에는 코드 서명이 없습니다. 파일 무결성은 함께 첨부한 `SHA256SUMS.txt`로 확인할 수 있습니다.

소스는 이 릴리즈의 `v1.0.0` 태그에서 확인할 수 있습니다. GPL-3.0-only로 배포하며 앱에 라이선스와 의존성 고지를 포함합니다.
