# ALink 관리자 웹

React 19 + TypeScript strict + Vite + React Router + TanStack Query + Tailwind 기반이다. 패키지 실행은 Bun, 잠금 파일은 `bun.lock`만 사용한다.

기존 ADMIN·SUPER_ADMIN 계정으로 Google 로그인한 뒤 제공자·모델, 공지사항, 피드백을 관리한다. 두 역할의 권한은 같다. 제공자와 모델의 식별자는 생성 후 변경하지 않는다. 피드백은 조회만 제공한다.

## 로컬 실행

Node 22.12 이상(현재 검증 24.22.2), Bun 1.4.4 이상을 사용한다.

```sh
bun install --frozen-lockfile
cp .env.example .env
bun run dev
```

기본 주소 `http://localhost:8101/login`을 연다. 포트가 겹치면 `ADMIN_E2E_PORT=8102 bun run dev`로 변경한다. Google client id가 없으면 로그인 설정 안내가 보인다. 인증 우회나 자동 fixture fallback은 없다.

로그인 화면에서 Google 로그인 버튼 위의 [개발 | 운영]으로 접속할 서버를 고른다. 처음 값은 이 브라우저에서 마지막으로 로그인에 성공한 서버이며 기록이 없으면 개발이다. 로그인 뒤 상단바 계정 옆 배지(`운영` 주황, `개발` 회색)로 접속 서버를 보여 준다. 서버를 바꾸려면 로그아웃한 뒤 로그인 화면에서 다른 서버를 고른다. 두 서버에 동시에 로그인하지 않는다. 브라우저에는 localStorage `alink-admin:last-server`에 `dev` 또는 `prod`만 저장한다.

`bun run dev`는 같은 origin 프록시 두 개를 쓴다. `/server/dev/api/*`는 `VITE_DEV_PROXY_TARGET`(기본 `https://dev.api.archivelink.app`)으로, `/server/prod/api/*`는 `VITE_PROD_PROXY_TARGET`(기본 `https://api.archivelink.app`)으로 접두어를 떼고 전달한다. 로컬 서버로 개발하려면 `VITE_DEV_PROXY_TARGET=http://localhost:8080`으로 바꾼다. 프록시는 관리자 refresh cookie path `/api/auth/admin`을 `/server/<dev|prod>/api/auth/admin`으로 바꿔 두 서버의 cookie가 서로 덮어쓰지 않게 한다.

빌드(`bun run build`) 산출물은 개발 `https://dev.api.archivelink.app`, 운영 `https://api.archivelink.app`(alink-channel 배포 설정과 같은 값)으로 직접 요청한다. 다른 주소가 필요하면 `VITE_DEV_API_BASE_URL`·`VITE_PROD_API_BASE_URL`을 빌드 환경에 준다. 이 두 값은 `bun run dev`에서는 쓰지 않는다.

`VITE_GOOGLE_CLIENT_ID`는 관리자 웹 전용 OAuth 웹 client id로 공개값이며 두 서버가 함께 쓴다. 운영 서버가 다른 client를 쓰면 `VITE_PROD_GOOGLE_CLIENT_ID`를 주며, 이 값은 `운영`을 골랐을 때만 쓴다. 쓰는 client id를 각 서버의 `GOOGLE_ADMIN_CLIENT_IDS`에 등록한다. 이 값들 외에 비밀키나 토큰을 환경값에 추가하지 않는다. 서버는 backend PR #209의 관리자 계약을 지원해야 한다.

## 검사

```sh
bun run typecheck
bun run lint
bun run format:check
bun run test:unit
bun run build
bunx playwright install chromium
VITE_GOOGLE_CLIENT_ID=explicit-e2e-fixture VITE_PROD_GOOGLE_CLIENT_ID=explicit-e2e-prod-fixture bun run build
ADMIN_E2E_PORT=8101 bun run test:e2e
```

`bun run format`은 포맷을 적용한다. `test:unit`은 Vitest이며 `bun test`로 대체하지 않는다. E2E는 테스트용 공개 client id 두 개로 빌드한 `dist/`를 Vite preview로 실행하고 종료한다. 요청 주소는 기본 개발·운영 API 주소이며 fixture가 가로챈다. `tests/fixtures`의 명시적 GIS/API 응답으로 인증·권한·만료·관리 작업·실패 복구·키보드 흐름을 4개 viewport × light/dark에서 검증한다. 외부 Google 인증이나 실제 서버 통합의 통과를 뜻하지 않는다. 일반 산출물은 실제 `.env`로 `bun run build`해 다시 만든다. 보고서·trace는 `output/`에 남는다. preview는 정적 산출물 확인용이며 `/server/<dev|prod>/api` 프록시는 `bun run dev`에만 있다.

캡처용 fixture는 `bun tests/fixtures/prepare-captures.ts`로 정적 빌드의 사본 `output/capture-dist`에만 삽입한다. 제품 `dist/`와 소스에는 fixture를 삽입하지 않는다. PM 캡처 도구에 이 사본을 전달하며 생성한 이미지는 reviewer가 확인한다.

직접 주소와 새로고침을 지원한다: `/providers/:id`, `/announcements/:id`, `/announcements/new`, `/announcements/:id/edit`, `/feedbacks/:id`. 공지 본문은 채널과 같은 평문·줄바꿈·`[img:URL]`·`[btn:라벨|URL]`·`[link:라벨|URL]` 문법이다. 등록만 전체 알림을 보내며 수정은 재발송하지 않는다. 등록 응답을 받지 못하면 내용을 보존하고 목록 확인 후 재시도한다.

## 서버 연결과 운영 준비

API 계약은 [alink-backend#208](https://github.com/QLink-Bookmarks/alink-backend/issues/208)이 단독 관리한다. 공통 클라이언트는 admin requester, cookie include, refresh/signout UUID CSRF를 제공한다. access token은 메모리에만 두고 갱신 동시 요청을 합친다. 401은 갱신 후 한 번 재시도하며 권한 강등·사용자 삭제·갱신 실패·로그아웃 때 민감한 query cache와 화면을 제거한다. 늦은 응답은 세션 세대 검사와 AbortSignal로 차단한다. 서버가 매 요청 시 현재 관리자 역할을 검증한다.

access token은 그 토큰을 받은 서버와 묶여 메모리에 하나만 있다. 모든 요청은 현재 세션의 서버로만 가고, 새로고침하면 마지막 서버로만 세션 복구를 시도한다. 로그아웃은 현재 서버의 관리자 refresh cookie만 지운다. 관리자 로그인·관리자 확인·시작 시 복구 요청이 15초 안에 응답하지 않으면 그 서버의 연결 실패 안내와 `다시 시도`를 보여 준다.

로컬에서는 같은 origin의 `/server/<dev|prod>/api` 프록시를 통해 SameSite=Strict 관리자 cookie를 사용한다. 실제 Google 연결 시 로컬 origin(`http://localhost:<port>`)을 관리자 OAuth client의 승인된 JavaScript 원본에 추가하고, 같은 client id를 로컬/dev 서버 `GOOGLE_ADMIN_CLIENT_IDS`에 등록한다. localhost에서 Secure cookie를 지원하는 Chromium으로 검증한다.

배포 전제(서버 코드 변경 없음): `admin_refresh_token`은 Domain 없는 SameSite=Strict cookie이므로 관리자 웹은 `archivelink.app`의 하위 도메인(API와 같은 사이트)에서 서비스해야 갱신 요청에 cookie가 실린다. 두 서버의 `http.cors.hosts`에 admin origin을 credentials 허용으로 추가하고 `Alink-Requester`·`csrf_token`·`Authorization`·`Content-Type` 요청 헤더를 허용한다. admin origin을 관리자 OAuth client의 승인된 JavaScript 원본에 추가하고 server `GOOGLE_ADMIN_CLIENT_IDS`와 frontend client id를 일치시킨다. 정적 호스팅에는 라우트 직접 진입을 위한 index.html fallback이 필요하다. channel/admin refresh cookie와 세션은 분리한다.

Amplify 콘솔 설정, 배포 워크플로, 계정·역할 UI, 미지원 업체 실행 어댑터는 이번 범위 밖이다. 실제 Google 계정·admin client 설정이 없으면 외부 로그인과 실제 cookie 공존을 검증할 수 없다. 서버의 현재 역할·식별자 직렬화 거절·앱 알림·요약 worker 검증은 u0 실행 증거와 구분해 보고한다.

## PR 검사와 Amplify 빌드

`main`, `feat/**`, `refactor/**`, `fix/**` 대상 PR마다 `.github/workflows/ci.yaml`이 Node 26과 Bun 1.4.4로 `bun install --frozen-lockfile` 뒤 typecheck, lint, format check, 단위 테스트를 실행한다. E2E와 배포는 돌리지 않는다.

관리자 웹은 레포를 직접 연결한 Amplify가 `amplify.yml`로 빌드한다(Node 26, Bun 1.4.4, `bun install --frozen-lockfile` → `bun run build`, 산출물 `dist`). 주소는 `https://admin.archivelink.app`이고 한 배포가 개발·운영 서버를 모두 쓴다. Amplify 콘솔 설정(레포·브랜치 연결, 도메인, 정적 파일이 아닌 경로를 `/index.html`로 보내는 SPA 200 rewrite, PR 미리보기 끔, 환경 변수)은 사용자가 직접 한다. 환경 변수는 `VITE_GOOGLE_CLIENT_ID`가 필수이고, `VITE_PROD_GOOGLE_CLIENT_ID`·`VITE_DEV_API_BASE_URL`·`VITE_PROD_API_BASE_URL`은 기본값과 다를 때만 준다.
