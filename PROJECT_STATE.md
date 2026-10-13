## 2026-10-13 — 단일 보드 재설계 (현행)

- 대표 `index.html`은 `app/board/`로 이동한다. 기존 v7의 왼쪽 좁은 목록/오른쪽 상세/별도 실행·결과 화면 대신, 전체 폭 한 화면에 할 일이 펼쳐지는 포스트잇·간략 불렛저널형 보드를 사용한다.
- 항목 탭 → 동일한 카드가 강조·확장됨. 나머지 할 일은 보드에서 계속 보임. 제목/메모를 직접 수정, 체크로 할 일 완료/복원, +로 새 할 일 직접 입력, ×로 카드 접기. 별도 오늘/내일 강제 선택·결과 페이지·중복 Step 메뉴가 없음.
- 선택 카드 안에서만 **현재 Step 목표(`cue`)**, 기본 25분 타이머, `✓ Step 완료` 노출. Step 완료는 `doneSteps`만 증가시키고 다음 Step 준비; 할 일 `done`과 별개. 기본 `total`은 진행한 횟수 이상 유지. 예전 1/2/3 `checks` 등 기존 객체의 알 수 없는 필드는 변환/정리 없이 유지(새 Step 완료 시 checks만 초기화).
- 타이머는 독립 `step_board_timer_v1` 로컬 키. 시간 직접 수정, ▶/Ⅱ/↺ 제공. 카드 × 접기 시 실행 중이면 하단 작은 타이머 바로 표시·복귀 가능.
- 일정·마감·분류는 선택한 카드에서 선택적으로 바꾸며, 아무 정보도 입력하지 않아도 할 일을 바로 적고 시작할 수 있다. 목록의 기본 분류 강요 없음.
- **보존:** `step_v7_live_v1`, `step_v7_syncmeta_v1`, Firestore `state.workspaceV7` 및 기존 `app/v7/sync.js`를 그대로 사용. 과거 v6/legacy 저장 키와 원격 영역 변경 없음. 이미 저장된 제목/메모/날짜/그룹/진행량은 그대로 읽고, 기존 미공개 필드는 제거하지 않음.
- 검증: `tests/board-browser.mjs`은 기존 v6 데이터 마이그레이션(mock), inline edit, 직접 선택, 25분 Step/타이머, 목표 메모, 완료 복원, 320–1366px 폭을 자동 검사한다. **실제 iPad 홈 화면 앱의 키보드/스크롤 및 실제 Firestore 세 기기 동기화 검증은 미완료**다.
- 기존 v7은 `app/v7/`로 남아 있지만 대표 화면이 아니며, 데이터 갱신은 새 보드 앱에서만 할 것을 권장한다.

---

## 2026-10-13 — Step v7 실행/복귀 재정비

- 실제 대표 앱: `index.html` → `app/v7/` 유지. 이번 변경은 같은 v7 UI의 일관된 실행/복귀/키보드 안정화.
- 직접 조작: 상세와 실행 화면에서 `현재/전체 Step` 바로 옆 ±를 노출. 완료된 Step을 무효화하지 않도록 최소 전체 Step은 `doneSteps+1`(최소 1), 최대 99. 기존 `⋯ → Step 수` 중복 입력 경로는 제거. 목록/현재 작업에서 제목은 상세, ▶는 실행.
- X는 현재 화면을 닫고 상태 및 실행 체크/메모를 그대로 보존; 별도 `Ⅱ 중단`은 `paused` 상태로 저장하고 목록에 복귀. 작업 전환은 기존 작업을 자동으로 안전하게 중단하고, 불필요한 기본 confirm을 표시하지 않음.
- 실행 화면의 1·2·3 체크와 `✓ 이번 Step 완료`는 별도. 마지막 Step 후에만 전체 할 일 완료 여부 확인. 닫아도 결과 상태가 유지됨.
- 타이머는 독립 패널(큰 시간 숫자, 탭해 분 설정, ▶/Ⅱ, ↺, 남은 시간 표시)로 조작. `step_v7_timer_v1` 기기 로컬 키로 타이머 진행을 별도 보존하며, 작업 전환과 Step 완료 시 지정한 시간으로 리셋. 이는 원격 task schema 변경이 아님.
- iPad 키보드가 올라올 때 `visualViewport.height`로 `#app` 전체 높이를 변경하던 코드를 제거하고, 고정 `100dvh` 레이아웃과 개별 스크롤 영역으로 전환. **실제 iPad 홈 화면 앱에서 회색 화면 문제가 없어졌는지는 아직 미검증.**
- 기존 사용자 데이터와 Firebase 동기화(`step_v7_live_v1`, `workspaceV7`, 레거시 자료)는 변경하지 않음.
- 브라우저 회귀 테스트에 직접 Step ±, 타이머 설정·보존, X와 pause 차이, 체크 복귀 및 320–1366px 스크롤 넘침 점검을 추가. 실제 iOS Safari/iPadOS 테스트 결과는 자동 Chromium 검증과 구분.
- 다음 시작점: iPad 실기기에서 **메모 탭 → 키보드 열림/닫힘 → X → 동일 작업 ▶ → 타이머 상태 확인**을 반복하며 키보드/스크롤 확인.

---

## 2026-10-13 — Step v7 미니멀 UX 정비

- 대표 `index.html` → `app/v7/` 유지. 정보 설명보다 조작의 인식 가능성을 우선: 목록에서 + 직접 입력(Enter/✓ 확정, × 취소); 상세 제목/메모/기존 이어할 곳은 탭해 같은 자리에서 수정하고 ✓/×로 확정·취소. 일반 편집용 모달 제거.
- 상세의 할 일 완료는 목록과 같은 체크칸, 실행은 ▶, Step 실행 중 중단은 Ⅱ, 현재 Step 마침은 ✓. 시각적 안내·중복 텍스트 제거. 이미 진행 중인 카드는 바로 실행 화면으로 열림.
- 날짜/마감은 상세에서 인라인 날짜 및 **선택적 시간** 입력으로 조정. 이전 YYYY-MM-DD 문자열을 유지하면서 시각 지정 시 YYYY-MM-DDTHH:mm을 저장, 오늘/지난 일 판정은 날짜 부분만 비교. 기존 저장 형태를 변경/초기화하지 않음.
- 일반 Step 마침 시 불필요한 오늘/내일/나중 재선택 제거: 남은 Step이 있으면 paused/다음 실행 가능; 마지막 Step 후만 할 일 자체 완료 여부 선택. 지난 날짜의 작업은 별도 이월 퀴즈 대신 오늘 목록의 '지난 일'에 직접 표시.
- CSS는 320px 포함 가로 넘침 억제, 입력시 포커스 위치를 위쪽 컨트롤 출현 때문에 밀리지 않게 배치, 입력/텍스트 선택을 가로 스와이프 방지 터치 핸들러에서 제외. 실제 Safari PWA 키보드/관성스크롤 검증은 **여전히 미확인**.
- 기존 `step_v7_live_v1`, Firestore `workspaceV7`, 기존 workspaceV6/legacy 데이터, 사용자 계정 인증, 동기화 인터페이스 변경 없음.
- GitHub Actions 자동 테스트(기존 v6 데이터 이관, 중단/복귀, Step 처리, 상세 인라인 수정, 시간 설정, 목록 빠른 입력, 여러 화면 폭) 성공: commit `700486d522d66bf5530fc3a678c2ed0d5a614405`, workflow run `38338007328`.

---

## 2026-10-13 — v7 대표 화면 전환

- 대표 `index.html`이 `app/v7/`로 연결됨. v7 시안을 연습용 더미 데이터 없이 실제 Firebase 인증/원격 작업 동기화와 통합.
- 로컬 `step_v7_live_v1`, Firestore `state.workspaceV7`이 새 쓰기 대상. 기존 `step_v6_live_v1`/`step_live_v1`, `state.tasks`/`workspaceV6`은 변경하거나 삭제하지 않음.
- 최초 v7 클라우드 자료 없을 때 기존 v6 저장 자료를 변환하고, 다른 내용의 기기/계정 후보는 자동 덮어쓰지 않음. revision 기반 트랜잭션/클라우드 이력/로컬 checkpoint 유지.
- 아직 미확인: 실제 계정 인증, 세 기기 상호 동기화, iOS 홈 화면 Safari의 키보드·스크롤/제스처, v7의 실사용 세부 동작.
- 실행과 저장 계약: `docs/V7_DEPLOYMENT.md`. v7 브라우저 시뮬레이션 검증: `tests/v7-browser.mjs`.
- 기존 v6는 대표 버전이 아니며 업데이트 대상에서 제외.

---

## 2026-10-12 — 화면·조작·스크롤 안정화 (검증된 업데이트)

- 현재 `app/v6/` 화면은 오늘·상세·Step 실행·Step 결과·날짜 검토를 역할별 배경/위계로 구분한다. 작업 제목·진행 위치·다음 시작점 표기는 목록과 상세에서 같은 의미를 유지한다.
- 상세·실행·검토·완료 화면의 X는 공통 위치/닫기 동작을 가진다. 날짜 선택/막힘 화면에서의 뒤로 가기는 직전 작업 화면으로 돌아간다. 닫기는 진행 상태를 바꾸지 않는다.
- 중단(`paused`)한 Step은 ▶ 재개 시 `running`으로 복귀하고 기존 체크·다음 시작점을 유지한다. 종료된 전체 작업은 명시적 최종 완료를 거쳐야 한다.
- 모바일 사이드바가 상세 전환 시 숨겨지며 `scrollTop=0`으로 초기화되던 문제를 별도 탭별 스크롤 위치 기억으로 해결했다. 동일 화면의 업데이트는 위치를 유지하고, 다른 탭은 자신의 마지막 목록 위치로 돌아간다.
- 독립 스크롤 컨테이너는 `overscroll-behavior: none`이고 경계 수직 터치를 보호한다. 키보드 팝업은 `visualViewport` 높이를 사용한다. **iPhone/iPad Safari 실기기 제스처·키보드 검증은 별도 필요하다.**
- 보존 계약: `step_v6_live_v1`, 기존 `step_live_v1`, `workspaceV6` 및 기존 Firebase 인증/충돌 보호 유지. 저장 구조는 변경하지 않았다.
- GitHub Pages 및 GitHub Actions `Validate Step` 성공: commit `79d9b99f53ed24d6a3411f98ae6e536e10b73dff`, workflow run `38207158751`. 자동 검증은 320/390/430px 모바일, iPad 820px, Mac 1366px, 체크·중단·재개·최종 완료·공통 X·모바일 스크롤 복원을 포함한다.
- 다음 시작점: 실제 iPad·iPhone PWA에서 목록 스크롤/오버스크롤, 키보드, 백 제스처, 분할화면 UI를 직접 타며 검수하고 확인된 문제만 수정한다.

---

## 2026-10-12 — 현재 배포 상태 (구버전 스냅샷보다 우선)

- GitHub Pages 대표 `index.html`은 `app/v6/`로 이동한다. 이 URL이 Step의 현재 사용자 화면이다.
- 이전 Step 전체는 `archive/pre-v6-main-2026-10-12` 브랜치로 아카이빙했으며, `legacy/index.html`에서 옛 실행 화면으로 접근할 수 있다.
- v6는 iPhone/iPad Safari 홈 화면 및 Mac Chrome 반응형 UI를 제공한다.
- v6는 FSM 성격의 `idle/running/paused/await-next/await-final/completed` 상태, 명시적 작업 완료, 수동 이월, 다음 시작점 저장, 현재 Step 보존을 구현한다.
- v6 로컬 키 `step_v6_live_v1`; 구버전 `step_live_v1`은 변경하지 않는다.
- 기존 Firebase 이메일 인증·owner-only Firestore `stepUsers/{uid}/states/main`을 사용한다. 서버 legacy tasks는 보존하고 v6 작업은 `state.workspaceV6` 필드에 추가 저장한다.
- sync revision/hash 트랜잭션과 history ring을 사용하며 다른 기기 충돌을 자동 덮어쓰지 않는다.
- **미확인:** 실제 사용자 iPhone/iPad PWA 로그인·동기화, Mac Chrome 동기화, iOS 키보드/오버스크롤/제스처 실기기 시험. GitHub Actions는 자동화된 부분 검증일 뿐이다.
- 상세 계약: `docs/V6_DEPLOYMENT.md`. v6 앱 코드를 다시 수정하기 전 현재 `main`을 확인한다.

---

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
