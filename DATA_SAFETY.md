> **v6 공존 계약 (2026-10-12):** 아래 invariants는 기존 Step(`step_live_v1`, legacy client)의 불변조건이다. v6는 별도 `step_v6_live_v1` 및 로컬 체크포인트를 사용하며 기존 로컬 키에 쓰지 않는다. 기존 Firestore `states/main` schema-3 구조를 유지하고 `state.tasks`는 변경하지 않은 채 `state.workspaceV6`만 추가한다. 모든 변경 전 기존 원격 문서를 50칸 history ring에 보존한다. 새 기기는 같은 Firebase 계정으로 로그인해야 공유된다. 양측 수정 차이는 확인 없이 덮어쓰지 않는다. 구버전 코드로 쓰는 경우 workspaceV6 필드가 사라질 수 있으므로 구버전은 복구·참조 목적만으로 사용해야 한다. 세부: `docs/V6_DEPLOYMENT.md`.

# Step data safety contract

## Invariants

1. The existing localStorage key `step_live_v1` remains the canonical offline copy.
2. Invalid local data is quarantined and never becomes a cloud write candidate.
3. One browser tab cannot overwrite a cloud revision that it did not observe as its base.
4. A conflict never changes `main`; the local candidate is stored under that tab's conflict document until the user chooses.
5. Every successful canonical cloud replacement archives the previous canonical state into one of 50 deterministic ring slots in the same Firestore transaction.
6. Local checkpoints use 12 independent storage slots. Ordinary edits checkpoint at most once per 10 minutes; delete, restore and remote replacement checkpoint immediately.
7. A non-empty cloud task list can become empty only through an explicit delete or restore operation.
8. Cloud state larger than 750 KiB is rejected client-side before reaching Firestore's 1 MiB document limit.
9. Offline transaction failure leaves the local copy intact and queued for retry when connectivity returns.
10. Explicit offline operations are stored with the canonical hash of the exact local state and discarded if that state changes.
11. Object keys are recursively sorted before hashing, so equivalent Firestore maps produce the same compact 16-hex hash regardless of key order.
12. Firestore rules keep the legacy client usable until the first schema-3 write, then reject legacy overwrites.

## Failure handling

| Failure | Required behavior |
| --- | --- |
| Corrupt current local JSON | Quarantine it; restore newest valid independent checkpoint; block cloud writes if none exists |
| Storage quota/write failure | Keep the previous stored value; show a blocking error; do not sync |
| Forced checkpoint cannot be written | Abort and roll back delete, restore or remote replacement |
| Cloud document has invalid shape | Do not overwrite it automatically |
| Concurrent edit on another tab/device | Preserve local candidate under `conflicts/{clientId}`; leave canonical main unchanged |
| Offline during transaction | Keep local data and retry on the browser `online` event |
| User closes the app after an offline delete | Recover the persisted operation only when its saved hash still matches the current state |
| User deletes the final task | Save with explicit `task-delete`, archive the previous cloud state, then permit empty state |
| User restores a version | Checkpoint the current local state, archive current cloud main, then write the chosen version as a new revision |

## Retention

- Local: 12 independent checkpoints, deduplicated by hash.
- Cloud: 50 previous canonical revisions, deterministic ring slots.
- Conflicts: current conflict shown immediately; stale session candidates are kept separately and automatically bounded to the newest 20 once per day.

## Deployment order

1. Deploy the backwards-compatible Firestore rules.
2. Deploy/merge the schema-3 client.
3. Verify a schema-3 main document and history slot are created.
4. Keep the compatibility clause until old cached clients are no longer expected; removing it is a later hardening change, not required for safety.
