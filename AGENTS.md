# ALink 관리자 웹 작업 지침

계획은 한국어로 작성한다. 사용자 결정과 확정 요구사항이 이 문서보다 우선한다.

## 기술과 구조

- Bun만 사용하고 `bun.lock`만 유지한다. 의존성은 검증한 안정 버전을 정확하게 고정한다.
- React 함수 컴포넌트, Vite, TypeScript strict, React Router, TanStack Query, Tailwind를 사용한다.
- `src/app`의 라우트는 얇게 유지한다. 기능은 `src/features/{auth,providers,announcements,feedback}`, 공유 UI는 `src/components/ui`, 공통 네트워크·환경·오류는 `src/lib`, 앱 provider는 `src/providers`에 둔다.
- 파일 이름은 kebab-case, 컴포넌트는 PascalCase, 함수와 변수는 camelCase, 이벤트 구현은 handle 접두사, 이벤트 props는 on 접두사를 쓴다. 단순 화면 상태는 로컬에 둔다.
- 기능별 `api.ts`와 `queries.ts`를 사용한다. query key에 필터·정렬·페이지를 포함하고 AbortSignal로 이전 요청을 취소한다. mutation 성공 후 목록과 상세를 함께 무효화한다. 늦은 응답이 최신 결과를 덮어쓰지 않게 한다.

## 보안과 계약

- API 단일 계약은 QLink-Bookmarks/alink-backend#208이다. 모든 `/api/*` 요청에 `Alink-Requester: admin`, `credentials: include`를 쓴다. admin refresh/signout에는 UUID `csrf_token` 헤더를 보낸다.
- access token은 메모리에만 둔다. 토큰을 URL, 로그, localStorage, sessionStorage에 두지 않는다. refresh token은 HttpOnly admin cookie로만 주고받고 channel cookie를 변경하지 않는다.
- `VITE_*`는 공개값이다. 비밀키를 넣지 않는다. Google admin audience는 서버에서 검증한다. 관리자 UI 가드와 별도로 서버 현재 역할 검증이 필수다.
- 로그인은 기존 ADMIN/SUPER_ADMIN만 허용하며 동일 권한이다. 가입·역할 부여 UI, 인증 우회, 테스트 밖 mock fallback이나 가짜 성공을 만들지 않는다.
- 세션 구현 시 refresh 동시 요청을 합치고, 만료·강등·탈퇴·로그아웃에서는 민감한 query cache와 화면을 제거한다. feature 단위에서 한국어 오류와 재시도 경로를 제공하고 서버 상세와 토큰은 노출하지 않는다.
- 리소스 ID, 제공자 type, 모델 model/providerId는 생성 후 불변이다. 수정 DTO와 편집 입력에 넣지 않는다. 외부 기본 URL은 서버 계약의 업체별 허용 호스트·경로와 리다이렉트 차단 규칙을 따른다.

## UI와 검증

- semantic DOM, 연결된 label/description, focus-visible, 표 헤더와 caption, 텍스트 상태 배지를 쓴다. 로딩·빈 상태는 status, 오류는 alert, 저장 결과는 live region으로 알린다.
- dialog는 focus trap, Esc, 취소, 닫은 뒤 trigger 초점 복귀를 제공한다. 조작 영역은 40px 이상이며 저장 중 중복 실행을 막고 초점을 보존한다.
- `src/styles/global.css` 토큰과 공유 primitives를 먼저 사용한다. 회색 강조색과 시스템 light/dark만 지원한다. placeholder 대비는 4.5:1 이상, 입력 경계는 3:1 이상을 유지한다.
- 768px 이하 모바일, 769px 이상 와이드다. 1280×800, 390×844, 768×1024, 769×1024에서 양 테마·가로 넘침·키보드·safe area를 확인한다. 텍스트 선택, autocomplete, 브라우저 뒤로가기를 보존한다.
- 검사: `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run test:unit`, `bun run build`, `bun run test:e2e`. Vitest는 순수 로직, Playwright는 사용자가 관찰할 수 있는 흐름을 검증한다. `bun test`로 대체하지 않는다.
- 테스트 fixture는 명시적 테스트에만 둔다. 외부 Google 인증과 실제 API 연동은 자동 fixture 검증과 구분해 보고한다. 증거와 로그는 ignored `output/`에 둔다.

## channel 규칙의 적용 범위

원본은 형제 `alink-channel/AGENTS.md`와 `PRODUCT.md`다. 플랫폼 공통 구조·쿼리·토큰·접근성·검증 원칙을 적용한다. React DOM이므로 Expo Router → React Router, React Native primitives → semantic HTML, NativeWind → Tailwind, SecureStore → 메모리 access token/HttpOnly cookie로 대체한다. RN SafeAreaView·ScrollView·expo-image·Platform.OS·네이티브 애니메이션·Storybook 특례와 iOS 시뮬레이터 규칙은 적용하지 않는다. 웹 safe-area와 브라우저 검증으로 대체한다.

운영 배포·도메인·호스팅은 이번 작업에서 제외한다. PM pane 작업에서는 브리프의 소유 파일·리뷰·main/push 제한을 우선한다.
