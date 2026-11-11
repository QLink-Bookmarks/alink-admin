# ALink 관리자 웹

React 19 + TypeScript strict + Vite + React Router + TanStack Query + Tailwind 기반이다. 패키지 실행은 Bun, 잠금 파일은 `bun.lock`만 사용한다.

현재 a0는 웹 기반 bootstrap이다. `/login`의 제목과 비활성 Google 버튼, 공유 UI와 API transport만 제공한다. Google 인증·세션 복원·메뉴·관리 화면은 c1에서 연결한다. 관리 주소는 로그인 shell로 돌아가며 로그인 성공이나 실제 권한 검증을 제공하지 않는다. 테스트의 Google script stub은 외부 로그인 검증이 아니다.

## 로컬 실행

Node 22.12 이상(현재 검증 24.22.2), Bun 1.4.4 이상을 사용한다.

```sh
bun install --frozen-lockfile
cp .env.example .env
bun run dev
```

기본 주소 `http://localhost:8101/login`을 연다. 포트가 겹치면 `ADMIN_E2E_PORT=8102 bun run dev`로 변경한다. 로그인 shell은 서버나 Google client id 없이도 열린다.

`.env`의 `VITE_API_PROXY_TARGET`은 로컬 서버 origin(기본 `http://localhost:8080`) 또는 dev API origin을 지정한다. `/api`는 개발 서버가 이 대상으로 프록시한다. `VITE_GOOGLE_CLIENT_ID`는 관리자 웹 전용 OAuth 웹 client id로 공개값이며 실제 연결 시 채운다. 두 값 외에 비밀키나 토큰을 환경값에 추가하지 않는다. bootstrap shell은 API 요청을 보내지 않는다.

## 검사

```sh
bun run typecheck
bun run lint
bun run format:check
bun run test:unit
bun run build
bunx playwright install chromium
ADMIN_E2E_PORT=8101 bun run test:e2e
```

`bun run format`은 포맷을 적용한다. `test:unit`은 Vitest이며 `bun test`로 대체하지 않는다. E2E는 먼저 생성한 `dist/`를 Vite preview로 실행하고 종료한다. 4개 viewport × light/dark에서 Google script를 명시적 stub/실패로 대체해 shell 렌더링과 가로 넘침을 확인한다. 보고서·trace는 `output/`에 남는다. preview는 정적 산출물 확인용이며 `/api` 프록시는 `bun run dev`에만 있다.

## 서버 연결과 운영 준비

API 계약은 [alink-backend#208](https://github.com/QLink-Bookmarks/alink-backend/issues/208)이 단독 관리한다. 공통 클라이언트는 admin requester, cookie include, refresh/signout CSRF를 제공한다. 인증 token은 호출별 메모리 값으로 전달한다. transport는 서버 envelope를 그대로 반환하며 기능 API에서 타입을 정의·해석한다. 자동 refresh나 인증 상태는 후속 단위에서 구현한다.

로컬에서는 같은 origin의 `/api` 프록시를 통해 SameSite=Strict 관리자 cookie를 사용한다. 실제 Google 연결 시 로컬 origin(`http://localhost:<port>`)을 관리자 OAuth client의 승인된 JavaScript 원본에 추가하고, 같은 client id를 로컬/dev 서버 `GOOGLE_ADMIN_CLIENT_IDS`에 등록한다. localhost에서 Secure cookie를 지원하는 Chromium으로 검증한다.

운영 admin origin은 API와 같은 사이트(eTLD+1)에 있어야 한다. 배포 시 admin origin을 backend `http.cors.hosts`와 관리자 OAuth client의 승인된 JavaScript 원본에 추가하고 server `GOOGLE_ADMIN_CLIENT_IDS`와 frontend client id를 일치시킨다. 정적 호스팅에는 라우트 직접 진입을 위한 index.html fallback과 `/api` 연결 구성이 필요하다. channel/admin refresh cookie와 세션은 분리한다.

도메인·호스팅 구성, CI 배포, 실제 배포, 계정·역할 UI는 이번 범위 밖이다. 빈 원격의 main 생성과 push도 bootstrap 검토 및 사용자 승인 전에는 수행하지 않는다.
