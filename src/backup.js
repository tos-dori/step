import {clone, validateState, pauseTimer, uid} from './model.js';
export function exportBackup(state) {
  const data = clone(state);
  data.tasks.forEach(task => pauseTimer(task));
  return JSON.stringify({tag: 'STEP_LOCAL_BACKUP_V1', app: 'step-local', schema: 1, exportedAt: new Date().toISOString(), state: data}, null, 2);
}
export function parseBackup(text) {
  const data = JSON.parse(text);
  if (data.tag === 'STEP_LOCAL_BACKUP_V1' && data.app === 'step-local' && data.schema === 1) return validateState(data.state);
  if (data.tag === 'STEP_BACKUP_V1' && data.app === 'step' && data.schema === 1 && data.storageKey === 'step_live_v1') return validateState(data.state, true);
  throw new Error('Step에서 내보낸 JSON 백업 파일을 선택해 주세요.');
}
export function mergeBackup(state, imported) {
  // A repeated import never silently replaces an existing ID with another device's copy.
  const groups = new Map();
  for (const group of imported.groups) {
    const current = state.groups.find(g => g.id === group.id);
    if (current && current.name === group.name) groups.set(group.id, current.id);
    else {
      const id = current ? uid() : group.id;
      groups.set(group.id, id);
      state.groups.push({...clone(group), id});
    }
  }
  let added = 0, skipped = 0;
  for (const task of imported.tasks) {
    if (state.tasks.some(t => t.id === task.id)) {skipped++; continue;}
    const copy = {...clone(task), groupId: groups.get(task.groupId)};
    pauseTimer(copy);
    state.tasks.push(copy);
    added++;
  }
  return {added, skipped};
}
export function asStored(state) {
  return JSON.stringify({app: 'step-local', schema: 1, revision: uid(), savedAt: Date.now(), state});
}
