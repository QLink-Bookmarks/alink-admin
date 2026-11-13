# 디자인 후보

원본: `alink-channel/.agents/skills/issue-workflow/references/design-candidates.md`. admin은 네이티브 화면이 없는 React 웹이다.

레이아웃·정보 계층·상호작용 중 한 축을 바꾼 후보 2~3개를 HTML로 `.impeccable/mocks/issue-<n>/`에 만든다. 색이나 간격만 바꾼 안은 후보가 아니다. 한 안을 권장하고 각 안의 장단점을 설명한다. 공통 토큰과 UI primitives를 따르며 정상·빈 상태·오류를 포함한다.

뷰포트는 1280×800, 390×844이며 768/769px 경계도 확인한다. admin은 회색 강조색과 시스템 light/dark만 사용한다. 목업에서만 캡처용 theme 조작기를 둘 수 있고 제품에 테마 토글을 넣지 않는다. 768px 이하 모바일 레이아웃을 사용한다.

기존 화면 baseline, 각 candidate, 선택 후 revised, 구현 final을 같은 뷰포트와 양 테마로 비교한다. 기존 화면이 없으면 baseline 없음으로 기록한다. 디자인 품질 점수(/40)와 P1을 기록하고 final이 revised보다 2점 넘게 낮거나 P1이 있으면 수정 후 재검토한다. PR에 점수표와 실제 검증 범위를 기록한다. bootstrap shell은 기능 화면이 아니므로 전체 기능 final 평가는 후속 단위에서 진행한다.

선택한 안의 동작·전환과 캡처 파일명만 Issue 디자인 섹션에 기록한다. 사용자 이미지 업로드 후 해당 섹션을 통째로 다시 쓰지 않는다.
