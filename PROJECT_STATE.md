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
- 제품 코드 기준 커밋은 `cfc238864c3a37b0678401226af7653880138748` (`Improve Step architecture and patch guide`)이며, 이후 확인된 커밋은 continuity·sandbox 문서만 변경했다.
- `src/sync/firebase.js`의 최초 snapshot 처리에서 같은 계정의 연결 이력만 있으면 local/cloud 데이터 유무·최신성 확인보다 먼저 remote state를 자동 적용한다.
- remote가 비어 있거나 local보다 오래된 경우에도 `applyCloudState()`가 local `step_live_v1`을 remote task 목록으로 덮어쓸 수 있는 데이터 소실 경로가 코드상 확인됐다.

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
- 할 일 소실 신고를 조사해 최근 GitHub 제품 코드 변경은 없음을 확인했고, 최초 Firebase 동기화가 local state를 무조건 remote로 덮을 수 있는 경로를 확인했다.

## 현재 미해결·미확인

- 이번 실제 할 일 소실이 확인된 동기화 경로로 발생했는지는 사용자 기기의 `localStorage`와 현재 Firestore 문서를 확인하지 못해 확정되지 않았다.
- 다른 기기·브라우저에 아직 열리지 않은 `step_live_v1` 사본이 남아 있는지와 복구 가능성은 미확인이다.
- 현재 smoke test는 Firebase module 요청을 차단하므로 local/cloud 충돌과 데이터 보존 회귀를 검증하지 않는다.
- 자동 Workflow 통과는 실제 모바일 Preview의 UX 검증을 대체하지 않는다.
- 데이터 보존 패치는 아직 수행되지 않았다.

## 다음 시작점

1. 다른 기기에서 Step을 추가로 열지 말고, 기존 local state가 남아 있을 가능성을 보존한다.
2. 남아 있는 기기·브라우저에서 `localStorage['step_live_v1']`을 먼저 백업하고 현재 Firestore `stepUsers/{uid}/states/main` snapshot과 비교한다.
3. 최초 동기화에서 local 비어 있음/remote 비어 있음/local 최신/remote 최신을 분리하고, 빈 remote 또는 오래된 remote가 local을 자동 덮지 못하도록 최소 패치한다.
4. local non-empty + remote empty, local newer + remote older, initial conflict 선택 흐름을 자동 테스트에 추가한다.
5. Workflow와 실제 모바일 흐름을 검증한 뒤 관련 상태만 최소 checkpoint한다.
