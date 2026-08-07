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
- 데이터 보존·동기화 불변조건: `DATA_SAFETY.md`
- 아키텍처·개발 계약: `ARCHITECTURE.md`
- 프로젝트 연속성 상태: 이 파일
- 공통 AI 운영 계약: `tos-dori/tos-ai-control`
- 화면·실행 결과·로그가 문서와 충돌하면 실제 상태를 먼저 검증한다.
- `ai-sot-sandbox/PROJECT_STATE.md`는 완료된 비공식 실험 기록이며 이 파일을 대체하지 않는다.

## 연속성 운영

- 새 채팅 첫 메시지에서 `@GitHub 토스 스텝 <현재 작업>`으로 시작한다.
- 같은 채팅에서는 이후 메시지마다 `토스`나 `@GitHub`를 반복하지 않는다.
- `토스`가 활성화된 작업에서 지속 가치가 있는 검증된 변화는 이 파일에 최소 checkpoint한다.
- 자동 checkpoint는 현재 상태·결정·검증 결과·미해결·다음 작업에 한정한다.
- 앱 코드 패치, 삭제, 공통 guide·Skill·backlog 변경은 별도의 명시적 요청이 필요하다.
- 후보 아이디어, AI 추측, 검증되지 않은 패치와 단순 대화는 공식 상태로 기록하지 않는다.

## 현재 확인된 상태

- `main` 기준 정적 PWA이며 빌드·번들 과정 없이 GitHub Pages에서 실행된다.
- 앱 버전은 `0.6.59`, local canonical 저장 키는 `step_live_v1`이다.
- `index.html`은 고정 DOM과 asset 연결, `styles/app.css`는 화면 CSS, `src/app.js`는 core 스크립트 로드 순서를 담당한다.
- 현재·추가·완료·편집·보관함·끝낸 일 화면과 집중·휴식 타이머가 모듈 구조로 존재한다.
- `window.StepSyncApp`과 `window.StepSyncBridge`는 core와 Firebase 사이의 보존 대상 계약이다.
- 데이터 안전 v2가 `main`에 병합되어 있다. 12개 독립 local checkpoint, 3개 corrupt quarantine, destructive operation 강제 checkpoint, schema-3 revision/hash 동기화, 50개 cloud history slot, conflict candidate 보존, 최대 20개 stale conflict 정리, 750 KiB cloud payload 사전 차단, 오프라인 재시도 구조를 사용한다.
- 한 탭·기기가 관찰하지 않은 revision을 덮어쓰지 않는다. 동시 수정이면 canonical `main`을 그대로 두고 local candidate를 `main/conflicts/{clientId}`에 보존한다.
- 삭제·복원·remote replacement·가져오기처럼 상태를 크게 바꾸는 동작은 기존 상태를 먼저 checkpoint하며, checkpoint 또는 canonical local write 실패 시 동작을 중단하거나 원상복구한다.
- Firestore owner-only schema-3 rules는 사용자 확인 후 client 병합 전에 게시됐다. Rules emulator, local failure, 390×844 recovery/menu browser test를 통과한 코드가 `main`에 반영됐다.
- 제목 전체를 길게 눌러 여는 관리 메뉴가 적용되어 있고, 1차 메뉴는 `복구본 · 내보내기 · 가져오기 · 로그아웃`이다. 버전은 메뉴 안에 표시된다.
- Step 내보내기/가져오기는 Step 전용 envelope와 storage/schema/state 검증을 사용하며, 가져오기 직전에 강제 local checkpoint를 만든다.
- 데이터 안전 병합 커밋은 `d31e5999d0c22da77e8e1ad69a517741bfa42fcd`, 관리 메뉴 병합 커밋은 `e61a8edb38bf48f619b24ca1adf6088776763449`다.

## 결정된 방향

- 핵심 철학은 “다시 시작하기 쉽게 만드는 실행 보조 앱”이다.
- 기능 판단 기준은 “지금 한 Step으로 돌아가기 쉬워지는가?”다.
- 1·2·3 흐름은 시작점 열기, 약 20분 전진, 되돌아보기와 다음 시작점 남기기를 지원한다.
- 과도한 기록, 진행률 관리와 부가 기능이 실행을 방해하지 않게 한다.
- 기본 화면은 평범하고 간결한 할 일 목록으로 두고, 제목과 선택적 메모만으로 빠르게 등록할 수 있게 한다.
- 작은 할 일은 목록에서 바로 완료할 수 있고, 실행 보조가 필요한 할 일만 사용자가 명시적으로 현재 Step으로 올린다.
- 목록 카드를 보는 동작과 현재 Step으로 올리는 동작을 분리한다. 현재 Step 전환은 별도의 재생 아이콘처럼 명확한 실행 기호로 표현하고, 텍스트 라벨은 가능한 한 줄인다.
- 아이콘 전용 버튼은 임의 이모지가 아니라 일관된 SVG와 충분한 터치 영역, 접근성 이름을 사용한다.
- 모바일은 세로 단일 열을 유지하고, PC는 목록과 선택한 할 일·현재 Step을 함께 보기 쉽도록 더 넓은 반응형 구조를 사용한다.
- 데이터 안전 변경에서는 `DATA_SAFETY.md`의 revision/hash·checkpoint·history·conflict·offline invariants를 회귀시키지 않는다.
- 빈 remote나 오래된 remote를 이유 없이 local canonical 위에 적용하는 과거 방식으로 돌아가지 않는다.
- Step과 Routiner의 관리 메뉴는 같은 1차 정보 구조를 유지하되, 각 앱의 실제 복구 엔진 차이는 억지로 동일 구현으로 만들지 않는다.
- 제품 흐름·구조가 미확정인 단계에서는 전체 사용자 흐름과 구조를 넓게 검토하고 필요한 재설계를 허용한다. 큰 방향이 확정된 뒤에는 관계없는 정리나 기능을 섞지 않고 가장 작은 일관된 구현 범위로 좁힌다.
- 실제 코드·화면·테스트로 확인되지 않은 상태를 구현 완료로 기록하지 않는다.

## 최근 의미 있는 변화

- Step 코드를 유지보수 가능한 모듈 구조로 분리하고 `ARCHITECTURE.md`에 아키텍처·개발 계약을 정리했다.
- 기존 Firebase 최초 snapshot의 무조건 remote 적용 위험을 조사한 뒤 heuristic patch를 폐기하고 revision/hash·history·conflict·local checkpoint 기반 데이터 안전 v2로 재구축했다.
- Firestore owner-only schema-3 rules와 데이터 안전 client를 순서대로 반영했다.
- 제목 길게 누르기 관리 메뉴를 Routiner와 같은 `복구본 · 내보내기 · 가져오기 · 로그아웃` 구조로 통일했다.
- 기본 할 일 목록과 선택적 Step 실행 모드로 앱 구조를 확장하는 제품 방향을 확정했다.
- 개발 운영 기준을 `항상 좁은 patch ticket` 방식에서 `큰 흐름·구조를 먼저 잡고, 확정 후 좁고 안정적으로 구현`하는 단계형 방식으로 갱신했다.
- 2026-08-07 continuity snapshot을 실제 `main`과 재대조해, 패치 전 상태를 가리키던 오래된 데이터 소실·미수행 문구를 제거하고 현재 구현으로 갱신했다.

## 현재 미해결·미확인

- 실제 사용자 기기에서 최신 GitHub Pages/PWA 캐시가 모두 교체됐는지와 현재 Firestore에 schema-3 `main` 및 history slot이 생성됐는지는 이 snapshot 기준 별도 화면·콘솔 근거로 확정하지 않았다.
- 브라우저 local storage와 Firebase 프로젝트를 동시에 잃는 상황을 위한 앱 밖의 독립 파일 백업은 자동화되어 있지 않다.
- legacy client compatibility clause는 staged compatibility를 위해 남아 있으며, 오래된 cached client를 더 이상 고려하지 않아도 되는 시점의 hardening은 별도 작업이다.
- 새 할 일 목록·상세·현재 Step 사이의 정확한 화면 전환과 PC 2단 레이아웃은 아직 세부 구현 흐름으로 확정하지 않았다.
- 자동 Workflow 통과는 실제 iPhone에서의 최종 UX 육안 검수를 대체하지 않는다.

## 다음 시작점

1. 저장·동기화·삭제·복원 관련 변경 전 `DATA_SAFETY.md`, 현재 data-safety/sync 코드와 관련 tests를 먼저 읽고 기존 invariants를 보존한다.
2. 데이터 구조나 destructive flow를 건드리면 local failure, Firestore emulator, 390×844 browser recovery/menu test를 다시 통과시킨다.
3. 다음 제품 UX 작업은 기본 할 일 목록 → 재생 아이콘으로 현재 Step 전환 → 목록에서 직접 완료 → 모바일 단일 열·PC 확장 레이아웃의 전체 사용자 흐름을 먼저 확정하고, 그 뒤 구현을 일관된 단위로 좁혀 진행한다.
4. 관리 메뉴는 Routiner와 공통 1차 구조를 유지하고, 앱별 복구 상세만 필요한 만큼 다르게 둔다.
5. 필요하면 실제 기기에서 최신 배포와 schema/history 생성 상태를 확인한다.
6. 독립 파일 백업이나 legacy rules hardening은 현재 안전 구조를 대체하지 않는 별도 개선으로 검토한다.
