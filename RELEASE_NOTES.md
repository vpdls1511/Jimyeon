## 지면 · Jimyeon v1.0.1

문서 저장 형식 선택과 블록 메뉴 사용성을 개선했습니다.

### 다운로드

| 운영체제 | 설치 파일 | 압축 파일 |
| --- | --- | --- |
| macOS Apple Silicon (M1 이후) | `Jimyeon-1.0.1-macOS-arm64.dmg` | `Jimyeon-1.0.1-macOS-arm64.zip` |
| macOS Intel | `Jimyeon-1.0.1-macOS-x64.dmg` | `Jimyeon-1.0.1-macOS-x64.zip` |
| Windows 64비트 (Intel/AMD) | `Jimyeon-1.0.1-Windows-x64-Setup.exe` | `Jimyeon-1.0.1-Windows-x64.zip` |

Mac은 DMG를 열어 Jimyeon을 응용 프로그램 폴더로 옮깁니다. Windows는 Setup.exe로 설치하거나 ZIP을 풀고 Jimyeon.exe를 실행합니다. 두 운영체제 모두 Node.js와 별도 Chrome 설치가 필요하지 않습니다.

### 변경 사항

- 문서 저장 버튼 및 Cmd/Ctrl+S에서 `.jimyeon`·`.json`·`.md` 저장 형식 선택
- 지면·JSON 문서는 전체 배치를 보존하고, Markdown 선택 시 세부 서식 손실 안내
- 데스크톱 저장창의 확장자 필터를 선택한 형식에 맞게 적용
- 블록 왼쪽 드래그 손잡이 메뉴를 바깥 클릭으로 즉시 닫기
- 하위 메뉴·입력 컨트롤·키보드·드래그 동작 유지
- 저장 요청 중복 실행 방지와 저장 취소·실패 후 재시도 처리
- 새 버전이 main에 반영되면 자동 빌드·검증·릴리즈 공개. 이미 공개된 버전은 재배포하지 않음

독립 리뷰와 재검토를 반영했습니다. [PR #2](https://github.com/vpdls1511/Jimyeon/pull/2), [이슈 #1](https://github.com/vpdls1511/Jimyeon/issues/1).

### 확인 범위

각 대상 운영체제에서 자동 검사 140개와 네이티브 패키징을 실행하고, 설치 파일에 담긴 실행 파일 아키텍처·앱 버전·앱 아이콘·라이선스 고지를 검사했습니다. 저장 형식과 블록 메뉴는 실제 React/Mantine/BlockNote 컴포넌트를 jsdom에 렌더링해 검사했습니다. 이번 버전의 실제 앱 화면·OS 저장창·포인터 드래그 수동 검증은 수행하지 않았습니다.

macOS는 로컬 서명이며 Apple 공증을 포함하지 않습니다. Windows 배포에는 코드 서명이 없습니다. 파일 무결성은 함께 첨부한 `SHA256SUMS.txt`로 확인할 수 있습니다.

소스는 이 릴리즈의 `v1.0.1` 태그에서 확인할 수 있습니다. GPL-3.0-only로 배포하며 앱에 라이선스와 의존성 고지를 포함합니다.
