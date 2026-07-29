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
10. Firestore rules keep the legacy client usable until the first schema-3 write, then reject legacy overwrites.

## Failure handling

| Failure | Required behavior |
| --- | --- |
| Corrupt current local JSON | Quarantine it; restore newest valid independent checkpoint; block cloud writes if none exists |
| Storage quota/write failure | Keep the previous stored value; show a blocking error; do not sync |
| Cloud document has invalid shape | Do not overwrite it automatically |
| Concurrent edit on another tab/device | Preserve local candidate under `conflicts/{clientId}`; leave canonical main unchanged |
| Offline during transaction | Keep local data and retry on the browser `online` event |
| User deletes the final task | Save with explicit `task-delete`, archive the previous cloud state, then permit empty state |
| User restores a version | Checkpoint the current local state, archive current cloud main, then write the chosen version as a new revision |

## Retention

- Local: 12 independent checkpoints, deduplicated by hash.
- Cloud: 50 previous canonical revisions, deterministic ring slots.
- Conflicts: one current candidate per browser tab session; removed after resolution.

## Deployment order

1. Deploy the backwards-compatible Firestore rules.
2. Deploy/merge the schema-3 client.
3. Verify a schema-3 main document and history slot are created.
4. Keep the compatibility clause until old cached clients are no longer expected; removing it is a later hardening change, not required for safety.
