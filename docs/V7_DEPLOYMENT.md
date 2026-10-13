# Step! v7 배포 (2026-10-13)

## 대표 화면
- `https://tos-dori.github.io/step/`의 `index.html`은 `app/v7/`로 이동한다.
- 원본 시안의 화면 구성·작업 흐름을 실제 계정 로그인 및 저장·동기화 연결과 함께 배포했다.
- v6 소스는 더 이상 대표 화면이 아니며, 참조/비상 복구용으로 그대로 존재한다.

## 데이터와 기기 간 공유
- 기존 Firebase 이메일 계정으로 로그인한다. iPhone Safari 홈 화면 PWA, iPad Safari 홈 화면 PWA, Mac Chrome에서 같은 계정으로 공유한다.
- v7 로컬 키 `step_v7_live_v1`과 동기화 메타 키 `step_v7_syncmeta_v1` 사용. v6 `step_v6_live_v1` 및 레거시 `step_live_v1`은 변경하지 않는다.
- 클라우드 경로는 기존 `stepUsers/{uid}/states/main`. 기존 `state.tasks`, `state.workspaceV6`을 그대로 보존하고 `state.workspaceV7`을 추가한다.
- 계정 최초 진입 시 v7 저장본이 없으면, `workspaceV6`의 기존 작업·묶음·진행·메모·체크·다시 볼 날을 v7 형태로 변환한다. 원격 데이터가 없으면 기기의 v6/legacy 로컬 데이터를 확인한다. **변환이 원래 저장본을 변경하지 않는다.**
- v7 화면의 예시 작업 데이터는 실제 배포 시 제거했다.
- 동기화 쓰기는 Firestore revision 확인 후 트랜잭션으로 실행하며 기존 50개 history slot으로 이전 상태를 아카이브한다. 로컬 12개 checkpoint를 지원한다. 클라우드/기기 내용이 충돌하면 자동 덮어쓰기하지 않고 사용자 선택 화면을 표시한다.
- 프로토타입 고유의 `nextDraft`는 다음 Step 시작점 초안으로 저장되며 중단 상태에서 보존된다.
- 비상 수동 내보내기: 상단 계정 메뉴에서 **1 (백업 파일 저장)** 선택.

## 검증 경계
- `tests/v7-browser.mjs`: Chromium 환경에서 기존 v6 데이터 변환, 중단/복귀 상태, Step 완료 독립성, 모바일/iPad/Mac 가로 넘침 검사. Firebase는 테스트 모킹. 실제 사용자 계정·Firestore live 데이터로 세 기기 동기화는 별도 확인이 필요하다.
- 배포가 정상이어도 iPhone/iPad Safari standalone 키보드, 오버스크롤, 홈 화면 재진입은 실제 기기 검증 전까지 완료라고 표기하지 않는다.
- 서비스의 데이터 필드 변경 시 반드시 이전 버전 및 클라우드 migration/default/rollback 영향부터 확인한다.
