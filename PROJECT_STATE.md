---
id: step-project-state
kind: project-state
status: active
project: Step
continuity: automatic-checkpoint
---

# Step Project State

## 목적

Step은 **다시 시작하기 쉽게 만드는 실행 보조 앱**이다. 기능과 기록은 지금 한 Step으로 돌아가기 쉬워지는지 기준으로 판단하며, 기록 자체가 부담이 되는 방향은 피한다.

이 문서는 여러 ChatGPT 채팅이 같은 프로젝트 맥락을 이어받기 위한 공식 continuity snapshot이다. 전체 대화나 세부 코드 설명을 복사하지 않고, 다음 작업의 판단이 달라지는 현재 상태·결정·미해결·다음 시작점만 유지한다.

## 공식 원본과 우선순위

- 실제 구현과 설정: 현재 `main`의 코드
- 안전한 패치 계약: `ARCHITECTURE.md`
- 프로젝트 연속성 상태: 이 파일
- 공통 AI 운영 계약: `tos-dori/tos-ai-control`
- 화면·실행 결과·로그가 이 문서와 충돌하면 실제 상태를 먼저 검증한다.
- `ai-sot-sandbox/PROJECT_STATE.md`는 완료된 비공식 실험 기록이며 이 파일을 대체하지 않는다.

## 연속성 운영

- 새 채팅 첫 메시지에서 `@GitHub 토스 스텝 <현재 작업>`으로 시작한다.
- 같은 채팅에서는 이후 메시지마다 `토스`나 `@GitHub`를 반복하지 않는다.
- `토스`가 활성화된 작업에서 지속 가치가 있는 변화가 확인되면 이 파일을 자동 checkpoint할 수 있다.
- 자동 checkpoint는 이 파일의 현재 상태·결정·검증 결과·미해결·다음 작업에 한정한다.
- 앱 코드 패치, 삭제, 공통 guide·Skill·backlog 변경은 별도의 명시적 요청이 필요하다.
- 후보 아이디어, AI 추측, 검증되지 않은 패치와 단순 대화는 공식 상태로 기록하지 않는다.

## 현재 확인된 상태

- `main` 기준 정적 PWA이며 빌드·번들 과정 없이 GitHub Pages에서 실행된다.
- `index.html`은 고정 DOM과 asset 연결, `styles/app.css`는 화면 CSS, `src/app.js`는 core 스크립트 로드 순서를 담당한다.
- 로컬 저장과 Firebase Auth·Firestore 동기화를 사용한다.
- 로컬 저장 키는 `step_live_v1`이며 기존 task·piece 데이터 호환을 보존해야 한다.
- 현재·추가·완료·편집·보관함·끝낸 일 화면과 집중·휴식 타이머가 모듈 구조로 존재한다.
- `window.StepSyncApp`과 `window.StepSyncBridge`는 core와 Firebase 사이의 보존 대상 계약이다.
- `.github/workflows/validate-step.yml`과 `tests/smoke-step.mjs`가 자동 검증 경로로 존재한다.
- 기준 커밋: `2fcbac13c6962ca2bd60778208865f5cae025c07` (`Record completed source-of-truth sandbox checks`).

## 결정된 방향

- 핵심 철학은 “다시 시작하기 쉽게 만드는 실행 보조 앱”이다.
- 기능 판단 기준은 “지금 한 Step으로 돌아가기 쉬워지는가?”다.
- 1·2·3 흐름은 시작점 열기, 약 20분 전진, 되돌아보기와 다음 시작점 남기기를 지원한다.
- 과도한 기록, 진행률 관리와 부가 기능이 실행을 방해하지 않게 한다.
- 기존 저장 데이터, 동기화 bridge와 로드 순서를 보존한다.
- 기능 패치와 구조·CSS 대규모 정리를 한 번에 섞지 않는다.
- 실제 코드·화면·테스트로 확인되지 않은 상태를 구현 완료로 기록하지 않는다.
- 이 파일은 handoff를 대체하는 공식 snapshot이며, handoff는 필요할 때 여기서 파생한다.

## 최근 의미 있는 변화

- Step 코드를 유지보수 가능한 모듈 구조로 분리하고 `ARCHITECTURE.md`에 안전한 패치 계약을 정리했다.
- `ai-sot-sandbox/`에서 GitHub 파일 생성·재조회·SHA 기반 수정·임시 파일 삭제와 diff 검증을 완료했다.
- 이 파일을 공식 프로젝트 연속성 원본으로 도입했다.

## 현재 미해결·미확인

- `토스` 호출 후 다른 새 채팅에서 이 파일을 자동으로 찾아 맥락을 복구하는 end-to-end 검증은 아직 필요하다.
- 같은 채팅에서 의미 있는 패치 완료 뒤 이 파일이 자동 checkpoint되는 실제 검증은 아직 필요하다.
- 자동 Workflow 통과는 실제 모바일 Preview의 UX 검증을 대체하지 않는다.
- 현재 특정 제품 패치가 진행 중이라고 확정할 근거는 없다.

## 다음 시작점

1. 새 채팅에서 `@GitHub 토스 스텝 현재 상태 확인하기`로 이 파일과 필요한 실제 코드를 읽는다.
2. 제품 작업을 수행한다.
3. 자동 검증과 관련 모바일 흐름을 실제로 확인한다.
4. 검증된 상태 변화가 있으면 이 파일의 관련 섹션만 최소 갱신한다.
5. 다음 새 채팅에서 갱신된 상태가 복구되는지 확인한다.
