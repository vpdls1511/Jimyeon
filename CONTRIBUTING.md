# 기여하기

버그 제보, 사용성 제안, 문서 개선과 코드 기여를 환영합니다.

## 소스에서 실행

**Node.js 22.12 이상**과 npm이 필요합니다.

```bash
git clone https://github.com/vpdls1511/Jimyeon.git
cd Jimyeon
npm ci
npm run app
```

- `npm run dev`: 브라우저 개발 화면
- `npm run app`: 웹 빌드 후 Electron 실행
- `npm test`: 자동 검사
- `npm run build`: 배포용 웹 파일과 의존성 라이선스 고지 생성. 설치된 런타임 의존성의 라이선스 파일을 모아 `THIRD_PARTY_LICENSES.txt`를 만들고, 데스크톱 앱에도 포함합니다.

PDF 출력은 Electron 앱 또는 `npm run build` 후 `npm start`에서 확인합니다. 개발 화면(`npm run dev`)만 실행하면 PDF 출력 서버가 실행되지 않습니다.

데스크톱 앱의 자동 저장은 macOS `~/Library/Application Support/ResumeEditor/`, Windows `%APPDATA%\ResumeEditor\`에 보관합니다. 초기 버전 사용자의 문서를 이어받기 위해 저장 경로와 문서 형식 식별자는 유지합니다.

설치 파일 빌드와 릴리즈 배포 절차는 [RELEASING.md](RELEASING.md)를 참고하세요.

### 브라우저에서 실행

```bash
npm run build
npm start
```

`http://127.0.0.1:5174/`에서 편집기를 엽니다. 브라우저 실행의 PDF 저장에는 설치된 Chrome·Edge 같은 Chromium 계열 브라우저가 필요합니다. 자동으로 찾지 못하면 `PUPPETEER_EXECUTABLE_PATH`로 실행 파일 경로를 지정합니다. 브라우저 실행의 문서는 해당 브라우저의 기기 저장소에 남습니다. 브라우저의 사이트 데이터를 지우면 문서도 사라질 수 있으니, 지우기 전에 문서 파일로 저장해 두세요.

## 변경 확인

문서 구조나 저장 형식을 변경할 때는 기존 문서·이미지·열·페이지 설정의 보존과 되돌리기를 확인해 주세요. 레이아웃 변경은 A4·A3 편집 화면과 PDF 출력에서 확인합니다. 관련된 동작 검사가 있다면 함께 실행해 주세요.

## 이슈와 PR

- 버그는 실행 환경, 재현 순서, 기대한 결과와 실제 결과를 적어 주세요.
- 개인 문서 대신 최소한의 재현용 문서를 첨부해 주세요.
- PR에는 무엇을 바꿨는지와 확인한 방법을 적어 주세요.
- 라이선스는 저장소의 GPL-3.0-only를 따릅니다. 새 의존성의 라이선스 고지가 필요하면 함께 반영해 주세요.
