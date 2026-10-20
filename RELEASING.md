# macOS·Windows 릴리즈 배포

소스는 Git 브랜치와 버전 태그로 관리하고, 설치 파일은 [GitHub Releases](https://github.com/vpdls1511/Jimyeon/releases)에 첨부합니다. `release/`, `dist/`, `node_modules/`와 개인 문서는 Git에 올리지 않습니다.

## 권장: GitHub Actions로 함께 빌드

1. `package.json`과 `package-lock.json`의 버전을 함께 변경하고 `RELEASE_NOTES.md`를 작성합니다. 첫 공개 버전은 `1.0.1`입니다.
2. 소스 변경을 `main`에 푸시합니다.
3. `main` 푸시를 감지하면 **Desktop release**가 자동 실행됩니다. 해당 버전이 이미 공개돼 있으면 빌드와 재배포를 건너뜁니다.

각 대상은 별도 실행 환경에서 의존성 설치, 자동 검사, 웹 빌드, 네이티브 패키징, 실행 파일 아키텍처·앱 버전·라이선스 고지 확인을 진행합니다.

| 대상 | 빌드 환경 | 결과 |
| --- | --- | --- |
| macOS Apple Silicon | macOS arm64 | DMG·ZIP |
| macOS Intel | macOS Intel | DMG·ZIP |
| Windows Intel/AMD 64비트 | Windows x64 | NSIS 설치 EXE·ZIP |

세 대상이 모두 성공하면 해당 소스 커밋을 대상으로 `v{버전}` 릴리즈 초안을 생성하고 설치 파일 여섯 개와 `SHA256SUMS.txt`를 첨부합니다. 업로드된 일곱 파일의 SHA-256과 소스 커밋이 모두 일치하면 **자동으로 공개**하고 최신 릴리즈로 지정합니다. 실패한 경우 공개하지 않습니다.

태그 푸시는 실행 조건에 포함하지 않아 릴리즈 공개 후 중복 빌드가 발생하지 않습니다. 이미 공개한 버전은 덮어쓰지 않습니다. 기존 초안을 재시도할 때는 처음 빌드한 소스 커밋과 같아야 합니다.

### 수동 실행

필요하면 **Actions → Desktop release → Run workflow** 또는 다음 명령으로 실행할 수 있습니다. 수동 실행은 검증된 초안까지만 만들며 공개는 직접 진행합니다.

```bash
gh workflow run release.yml --repo vpdls1511/Jimyeon --ref main
```

설치 파일에 개인 문서나 자동 저장 프로필은 포함하지 않습니다.

## 파일 선택

버전 `1.0.1`의 파일 이름은 다음과 같습니다.

- `Jimyeon-1.0.1-macOS-arm64.dmg` / `.zip`: Apple Silicon Mac
- `Jimyeon-1.0.1-macOS-x64.dmg` / `.zip`: Intel Mac
- `Jimyeon-1.0.1-Windows-x64-Setup.exe`: Windows 설치 파일
- `Jimyeon-1.0.1-Windows-x64.zip`: Windows 압축 실행 파일
- `SHA256SUMS.txt`: 여섯 파일의 SHA-256

GitHub가 자동으로 제공하는 **Source code** ZIP/TAR는 소스입니다. 사용자용 설치 파일은 첨부한 DMG·EXE·ZIP입니다.

## 로컬에서 빌드

Node.js 22.12 이상에서 해당 운영체제용 명령을 실행합니다.

```bash
npm ci
npm test
npm run app:dist:mac -- --arm64 # Apple Silicon Mac에서 실행
npm run app:dist:mac -- --x64   # Intel Mac 대상
npm run app:dist:win           # Windows에서 실행
```

결과는 `release/`에 생성됩니다. 빌드 시 의존성 라이선스 고지를 생성해 앱에 포함합니다. `.app` 또는 `.exe`를 실행해 빈 문서, 이미지, 저장 후 다시 열기와 PDF 출력을 확인합니다. 현재 macOS는 로컬 서명이며 Apple 공증이 없고, Windows는 코드 서명이 없습니다. 공증·코드 서명을 사용하려면 별도 서명 환경을 준비해야 합니다.

공식 안내: [GitHub 릴리즈 관리](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).
