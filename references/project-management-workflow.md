# 프로젝트 작업 절차

원본: `alink-channel/.agents/skills/issue-workflow/references/project-management-workflow.md`. React 웹 저장소 `alink-admin`에 맞게 적용한다.

요구사항은 Issue, 일정·단계는 Project, 구현과 검증 근거는 PR에 둔다. 하나의 작업은 사용자가 완료할 수 있는 흐름으로 잡는다. Issue는 최신 확정본만 유지하며 사용자 업로드와 다른 섹션을 보존한다.

Issue 섹션은 1. 사용자 요청, 2. 요구사항, 3. 디자인, 4. 테스트 기준, 5. 구현 분할, 6. PR이다. 단계는 Requirement → Design → Test Criteria → Breakdown → Implementation → PR → Complete다. 요구사항과 테스트 기준은 생략하지 않는다. 단계별 사용자 확정을 받은 뒤 진행하며 PM harness에서는 지정된 reviewer/PM 게이트를 따른다.

분리된 issue branch/worktree에서 구현하고 소유 범위를 지킨다. 최초 빈 원격의 main 생성은 정확한 seed SHA와 검증 결과를 제시한 뒤 별도 승인을 받는다. 승인 전에는 어떠한 branch도 push하지 않는다. push한 branch는 rebase/force-push하지 않고 `origin/main`을 merge한다. PR 병합은 사용자가 한다.

PR에는 변경점, 실제 검증한 체크리스트와 로그 경로, 사용자 결정, 범위 밖과 제약을 기록한다. 중간 PR은 `- Refs #n`, 최종 PR만 `- Resolves #n`을 쓴다. 이미지는 첨부하거나 링크하지 않고 `{issue}_{두 자리 순번}_{kebab-case 이름}.png` 파일명으로 기록한다. 서버 계약은 backend 이슈가 소유하며 admin 이슈는 그 계약을 링크한다.

작업 재개 시 Issue의 확정 상태와 `output/state.md`를 읽고 완료한 단계를 반복하지 않는다. PM pane의 실행·리뷰·증거 규칙은 해당 브리프를 우선한다.
