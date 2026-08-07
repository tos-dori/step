# Step 아키텍처·개발 가이드

이 문서는 파일 목록이 아니라 **Step을 목적에 맞게 설계하고 안전하게 구현하기 위한 작업 기준**이다.
현재 `main`의 실제 코드가 최종 source of truth이며, 코드 구조나 보존 계약을 바꾸는 변경에서는 이 문서도 같은 작업에서 갱신한다.

개발 범위는 항상 좁게 고정하지 않는다. **제품 흐름이나 구조가 아직 잘못됐거나 미확정이면 먼저 전체 사용자 흐름과 구조를 넓게 검토하고 필요한 재설계를 한다. 방향이 충분히 잡힌 뒤에는 가장 작은 일관된 구현 범위로 좁혀 안정적으로 패치한다.**

## 1. 앱의 형태

- GitHub Pages에서 바로 실행되는 정적 PWA다. 빌드·번들 과정이 없다.
- `index.html`은 로그인 gate와 앱의 고정 DOM root, asset 연결만 가진다.
- `styles/app.css`가 현재 화면의 전체 CSS cascade를 가진다.
- `src/app.js`가 core 스크립트를 정해진 순서로 불러온 뒤 Firebase ES module을 불러온다.
- core JavaScript 파일들은 같은 전역 scope를 공유하므로 **파일 순서가 의존성 계약**이다.
- 로컬 저장과 Firebase Auth·Firestore 동기화가 `StepSyncApp`·`StepSyncBridge`를 사이에 두고 연결된다.

## 2. 작업 전에 반드시 확인할 것

1. 사용자의 현재 요청과 지금 얻으려는 결과를 먼저 확인한다.
2. 현재 작업이 방향·구조 설계 단계인지, 구현 단계인지, 안정화 단계인지 판정한다.
3. `main`의 최신 대상 파일을 다시 가져온다.
4. 실제 화면·사용 흐름·현재 코드에서 문제가 국소인지 구조적인지 확인한다.
5. 저장 키, task/piece shape, 동기화 bridge에 영향이 있는지 확인한다.
6. 방향이 미확정이면 세부 패치부터 하지 않고 전체 흐름과 구조를 먼저 잡는다.
7. 방향이 확정됐다면 관계없는 정리 없이 가장 작은 일관된 구현 범위로 좁힌다.

## 3. 변경 경로

| 요청 종류 | 1차 담당 파일 | 함께 확인할 파일 |
|---|---|---|
| 앱 버전, 저장 키, status·kind·timer 상수 | `src/config.js` | `src/state.js`, `src/bootstrap.js` |
| 고정 DOM 참조와 selector helper | `src/dom.js` | `index.html` |
| 기본 state, 저장·불러오기·normalize, cloud state 변환 | `src/state.js` | `src/bridge.js`, `src/sync/firebase.js` |
| 토스트, 완료 표시, textarea auto-grow | `src/feedback.js` | `styles/app.css` |
| task 조회·상태 계산·type 정보 | `src/task-model.js` | `src/task-actions.js`, `src/render.js` |
| 메모 안내, 체크 토큰, 메모 표시·수정 | `src/memo.js` | `src/render.js`, `styles/app.css` |
| 1·2·3 체크리스트 문구와 piece 생성 | `src/step-flow.js` | `src/task-actions.js`, `src/render.js` |
| 집중·휴식 타이머 | `src/timer.js` | `src/render.js`, `src/events.js` |
| 생성, 선택, 성공·미완·멈춤, 삭제 | `src/task-actions.js` | `src/task-model.js`, `src/step-flow.js` |
| 편집 draft와 Step 수 변경 | `src/editor.js` | `src/render.js`, `src/state.js` |
| 현재·추가·완료·편집 화면 렌더링 | `src/render.js` | 해당 기능 파일, `styles/app.css` |
| 보관함과 끝낸 일 | `src/library.js` | `src/task-actions.js`, `src/render.js` |
| 고정 입력·버튼·hold 이벤트 연결 | `src/events.js` | 실제 동작을 소유한 기능 파일 |
| 동기화에 노출되는 앱 interface | `src/bridge.js` | `src/state.js`, `src/sync/firebase.js` |
| 화면 버전 표시와 최종 core 초기화 | `src/bootstrap.js` | `src/app.js`, `src/bridge.js` |
| 로그인, Firestore, 충돌·대기 상태 | `src/sync/firebase.js` | `src/bridge.js`, `src/state.js` |
| 간격, 크기, 색상, 화면 상태 스타일 | `styles/app.css` | 해당 렌더링 파일 |

`src/events.js`에는 새 기능 로직을 넣지 않는다. 이벤트는 담당 기능의 함수를 호출하기만 해야 한다.

## 4. 절대 보존할 계약

### 저장과 state

- 로컬 저장 키 `step_live_v1`을 바꾸지 않는다.
- task와 piece의 기존 field를 삭제하거나 의미를 바꾸지 않는다. 오래된 저장 데이터는 `state.js`의 normalize 경로로 읽혀야 한다.
- 새 field가 필요하면 기본값, normalize, local save, cloud state에 포함할지 여부를 함께 결정한다.
- draft, active task, library 선택, timer처럼 로컬 UI 상태와 cloud 공유 상태를 구분한다.
- 데이터 문제를 빈 state로 덮어 해결하지 않는다.

### 동기화 bridge

- `window.StepSyncApp`은 core 앱이 Firebase에 제공하는 계약이다.
- `window.StepSyncBridge`는 Firebase가 core 앱에 local 변경 알림 경로를 제공하는 계약이다.
- 두 이름과 method 의미를 바꾸지 않는다.
- `bridge.js`가 만들어진 뒤에 `bootstrap.js`가 실행되고, core 로드가 끝난 뒤 Firebase module이 import되어야 한다.
- 원격 state는 반드시 core의 `applyCloudState()`와 normalize 경로를 통해 적용한다.
- 입력·편집 중 원격 변경을 즉시 덮어쓰지 않는 대기 흐름을 유지한다.

### 로드 순서와 엔트리 파일

- `src/app.js`의 core module 순서를 임의로 바꾸지 않는다.
- `bootstrap.js`를 `bridge.js`보다 앞으로 옮기지 않는다.
- 일반적인 문구·타이머·메모·편집·보관함·스타일 패치에서는 `index.html`을 수정하지 않는다.
- 새 top-level 화면 root, 고정 입력 요소, 새 외부 asset 연결이 필요한 경우에만 `index.html`을 수정한다.
- 새 기능 영역을 별도 파일로 만들 때만 `src/app.js`에 파일을 추가한다.

### CSS

- `styles/app.css`는 단일 파일로 분리됐지만, 과거 패치의 override와 `!important`가 아직 남아 있다.
- 현재 cascade가 실제 화면의 source of truth다. 앞쪽 규칙만 보고 수정하지 말고 같은 selector의 뒤쪽 재정의까지 검색한다.
- 구조 재설계가 필요한 단계에서는 필요한 CSS 구조 변경을 함께 검토할 수 있다.
- 구조가 확정된 이후의 기능·세부 패치에서는 관계없는 중복 CSS 정리를 섞지 않는다.

## 5. 개발 절차

### A. 방향·구조가 미확정인 경우

1. 앱 철학과 현재 요청을 기준으로 성공 조건을 잡는다.
2. 실제 유저가 `목록 → 선택/실행 → 현재 Step → 처리 → 복귀` 흐름을 탄다고 가정해 처음부터 끝까지 검수한다.
3. 표면 문제보다 상위의 구조 문제가 있는지 확인한다.
4. 구조 문제라면 기존 코드를 억지로 보존하기 위한 국소 hack 대신 필요한 화면·상태·컴포넌트 경계를 다시 설계한다.
5. 이 단계에서는 세부 문구·간격·CSS 값을 성급히 확정하지 않는다.
6. 사용자와 큰 흐름이 확정되면 구현 단계로 넘어간다.

### B. 방향이 확정된 구현 단계

1. 1차 담당 파일부터 읽고 필요한 호출·저장·렌더링 경로를 추적한다.
2. 문제를 해결하는 가장 작은 **일관된 범위**로 수정한다. 구조상 여러 파일이 함께 바뀌어야 하면 함께 수정한다.
3. 관계없는 기능, 이름 변경, 포맷팅, 리팩토링은 섞지 않는다.
4. state 영향이 있으면 빈 state, 현재 state, 이전 형식 state를 따로 검토한다.
5. 모든 JavaScript 문법과 local asset 경로를 검사한다.
6. `Validate Step` Workflow를 통과시킨다.
7. 390×844 Preview에서 해당 사용자 흐름을 처음부터 끝까지 실행한다.
8. Preview 확인 전 완료라고 단정하지 않는다.

### C. 안정화 단계

- 구조가 맞게 작동하면 문구, 간격, edge case, 작은 버그를 좁게 분리해 수정한다.
- 미세 조정을 이유로 이미 맞는 상위 구조를 다시 흔들지 않는다.
- 각 수정의 회귀 범위를 명확히 한다.

## 6. 사용자 흐름 검수

Step은 코드 정합성만으로 검수하지 않는다. 실제 사용자가 화면을 순서대로 탄다고 가정한다.

- 지금 할 행동이 바로 보이는가?
- 목록을 보는 행동과 현재 Step으로 올리는 행동이 섞이지 않는가?
- 이미 정한 것을 또 선택하게 하지 않는가?
- 첫 Step·중간 Step·마지막 Step·단일 Step의 시점이 자연스러운가?
- 미완·멈춤 뒤 다시 시작할 위치가 자연스러운가?
- 빈 메모나 긴 메모에서도 UI가 붕 뜨지 않는가?
- 기능이 지금 한 Step으로 돌아가기 쉽게 하는가, 관리할 것을 늘리는가?
- 국소 수정이 다른 화면의 정상 흐름을 깨뜨리지 않는가?

## 7. 변경 종류별 검증

### Step 흐름·문구 변경

- 첫 Step, 중간 Step, 마지막 Step을 각각 확인한다.
- 미완과 멈춤 뒤 생성되는 새 piece를 확인한다.
- 공부·과제·기타 유형별 1·2·3 문구를 확인한다.
- prep 체크와 finish 문구가 시점에 맞게 표시된다.

### 메모 변경

- 새 할 일 입력, 현재 화면 표시, 편집, 보관함 preview를 모두 확인한다.
- `○`, `●`, 숫자·영문 라벨 토큰이 정확한 위치에서 전환된다.
- 토큰 전환 뒤 메모 스크롤 위치가 유지된다.
- 빈 메모와 긴 메모에서 높이·내부 스크롤이 자연스럽다.

### 타이머 변경

- 집중 시작·일시정지·재개가 정상이다.
- 집중·휴식·꺼짐 순환과 길게 누르기 동작을 확인한다.
- 시간 초과 표시와 task 전환 뒤 reset을 확인한다.
- timer loop가 중복 생성되지 않는다.

### 생성·편집·보관함 변경

- 작성 중 draft가 닫기·새로고침 뒤 보존된다.
- 명시적 비우기만 draft를 지운다.
- 생성, 현재 선택, 편집 저장, 보관함으로 내리기가 정상이다.
- 완료 뒤 치우기, 꺼내기, 2단계 삭제가 정상이다.
- 기존 task의 status, piece, memo가 의도하지 않게 바뀌지 않는다.

### 저장·동기화 변경

- 로그아웃 상태의 gate와 로그인 유지가 정상이다.
- 빈 local/빈 cloud, local만 있음, cloud만 있음, 양쪽 모두 있음 상황을 구분한다.
- 최초 선택, 입력 중 remote 대기, remote 적용, local 유지가 정상이다.
- cloud save가 자기 snapshot을 다시 적용하는 loop를 만들지 않는다.

### UI·CSS 변경

- 할 일 없음, 현재 Step, 편집, 새 할 일, 완료, 보관함, 끝낸 일 화면을 확인한다.
- 390×844에서 잘림·가로 overflow·safe-area 침범이 없다.
- 메모, 타이머, 진행바, 결과 버튼의 위계가 유지된다.
- 기존 화면과 무관한 selector가 바뀌지 않았는지 diff를 확인한다.

## 8. 자동 검증의 범위와 한계

`.github/workflows/validate-step.yml`은 다음을 확인한다.

- 필수 파일과 bridge 계약 존재
- 저장 키 위치
- `index.html`에 인라인 구현이 다시 들어오지 않았는지
- 모든 JavaScript 문법
- manifest 형식
- 390×844 기본 smoke flow

이 검증은 모든 문구·시점·예외 UX가 자연스럽다는 뜻은 아니다. 화면·동작 변경은 실제 사용자 순서의 Preview 검수가 추가로 필요하다.

## 9. 금지되는 개발 방식

- 사용자 요청과 무관한 기능 추가
- 구조 문제가 있는데 “최소 패치”를 이유로 hack과 예외를 계속 누적하기
- 방향이 이미 확정된 뒤 관계없는 대규모 정리까지 함께 하기
- 저장 오류를 state 초기화로 숨기기
- `index.html`에 기능 코드나 CSS를 다시 넣기
- `events.js`나 `render.js`에 모든 기능 로직 몰아넣기
- bridge를 우회해 Firebase가 전역 state를 직접 수정하기
- Workflow 통과만으로 실제 Preview 완료를 대신하기
- 기존 파일이 있다는 이유만으로 내용을 확인하지 않고 추측해 수정하기

## 10. 완료 조건

- 현재 단계의 성공 조건을 실제로 충족했다.
- 구조 설계 단계라면 큰 흐름과 변경 경계가 모순 없이 정리됐다.
- 구현 단계라면 확정된 방향을 벗어난 관계없는 변경이 없다.
- 저장 키와 기존 데이터 호환 조건이 유지됐다.
- 담당 파일과 실제 변경 위치가 일치한다.
- `Validate Step`이 통과했다.
- 관련 사용자 흐름을 Preview에서 확인했다.
- 구조·계약이 달라졌다면 이 문서도 함께 갱신됐다.
