export const TYPES = ['공부', '과제', '기타'];
export const uid = () => globalThis.crypto?.randomUUID?.() || `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const clone = value => JSON.parse(JSON.stringify(value));
export const piece = (kind = 'continue') => ({id: uid(), kind, status: 'pending', done: [false, false, false]});
export const emptyDraft = (groupId = 'inbox') => ({title: '', memoText: '', startText: '', finishText: '', type: 0, prep: false, count: 1, groupId});
export const initialState = () => ({tasks: [], groups: [{id: 'inbox', name: '할 일', collapsed: false}], activeId: null, resumeId: null, draft: emptyDraft(), editorDraft: null});
export const currentIndex = task => { const n = task.pieces.findIndex(p => p.status === 'pending'); return n < 0 ? task.pieces.length : n; };
export const ready = task => currentIndex(task) === task.pieces.length;
export const position = task => `${Math.min(currentIndex(task) + 1, task.pieces.length)}/${task.pieces.length}`;
export const started = task => task.pieces.some(p => p.status !== 'pending' || p.done.some(Boolean));
export const taskById = (state, id) => state.tasks.find(t => t.id === id);
export const currentTask = state => taskById(state, state.activeId);
export const timerDefault = () => ({mode: 'focus', elapsed: 0, startedAt: null, running: false});
export function pauseTimer(task, now = Date.now()) {
  task.timer ||= timerDefault();
  if (task.timer.running && task.timer.startedAt) task.timer.elapsed += Math.max(0, now - task.timer.startedAt);
  task.timer.running = false;
  task.timer.startedAt = null;
}
export function addTask(state, draft) {
  if (!draft.title.trim()) throw new Error('할 일 제목을 적어 주세요.');
  const count = Number(draft.count);
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000) throw new Error('Step 수는 1~1000 사이로 정해 주세요.');
  const groupId = state.groups.some(g => g.id === draft.groupId) ? draft.groupId : state.groups[0].id;
  const task = {...clone(draft), id: uid(), title: draft.title.trim(), groupId, count, pieces: Array.from({length: count}, (_, i) => piece(i ? 'continue' : 'start')), finalized: false, doneShelf: false, resumeText: '', timer: timerDefault(), createdAt: Date.now()};
  state.tasks.push(task);
  state.draft = emptyDraft(groupId);
  state.groups.find(g => g.id === groupId).collapsed = false;
  return task;
}
export function activate(state, id) {
  const previous = currentTask(state);
  if (previous) pauseTimer(previous);
  if (!taskById(state, id)) return;
  state.activeId = id;
  state.resumeId = id;
}
export function pause(state, note) {
  const task = currentTask(state);
  if (!task) return;
  if (note !== undefined) task.resumeText = note;
  pauseTimer(task);
  state.resumeId = task.id;
  state.activeId = null;
}
export function completeStep(task, status = 'success', note) {
  const index = currentIndex(task);
  if (index >= task.pieces.length || task.finalized) return;
  if (!['success', 'incomplete', 'blocked'].includes(status)) throw new Error('알 수 없는 Step 처리예요.');
  task.pieces[index].actionSnapshot = checklist(task, index);
  task.pieces[index].resumeNote = note ?? task.resumeText ?? '';
  task.pieces[index].status = status;
  if (note !== undefined) task.resumeText = note;
  if (status !== 'success') task.pieces.splice(index + 1, 0, piece(status));
  task.count = task.pieces.length;
  task.finalized = false;
  pauseTimer(task);
  task.timer = {...timerDefault(), mode: task.timer.mode};
}
export function extend(task) {
  task.pieces.push(piece());
  task.count = task.pieces.length;
  task.finalized = false;
  task.doneShelf = false;
  task.completedAt = null;
}
export function finalize(task) {
  if (!ready(task)) throw new Error('남아 있는 Step을 먼저 마쳐 주세요.');
  task.finalized = true;
  task.completedAt = Date.now();
  pauseTimer(task);
}
export function resizePieces(task, count) {
  count = Number(count);
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000) throw new Error('Step 수는 1~1000 사이로 정해 주세요.');
  if (count < task.pieces.length) {
    const removable = task.pieces.slice(count);
    if (removable.some(p => p.status !== 'pending' || p.done.some(Boolean))) throw new Error('진행한 Step은 줄일 수 없어요. 아직 시작하지 않은 마지막 Step만 줄여 주세요.');
    task.pieces.splice(count);
  }
  while (task.pieces.length < count) extend(task);
  task.count = task.pieces.length;
}
export function deleteGroup(state, id, destination) {
  if (state.groups.length === 1) throw new Error('묶음은 하나 이상 남겨 주세요.');
  const target = state.groups.find(g => g.id !== id && g.id === destination) || state.groups.find(g => g.id !== id);
  for (const task of state.tasks) if (task.groupId === id) task.groupId = target.id;
  if (state.draft.groupId === id) state.draft.groupId = target.id;
  if (state.editorDraft?.groupId === id) state.editorDraft.groupId = target.id;
  state.groups = state.groups.filter(g => g.id !== id);
}
export function moveWithinGroup(state, id, delta) {
  const task = taskById(state, id);
  const indices = state.tasks.map((t, i) => t.groupId === task.groupId && !!t.doneShelf === !!task.doneShelf ? i : -1).filter(i => i >= 0);
  const at = indices.indexOf(state.tasks.indexOf(task));
  const next = at + delta;
  if (next < 0 || next >= indices.length) return;
  [state.tasks[indices[at]], state.tasks[indices[next]]] = [state.tasks[indices[next]], state.tasks[indices[at]]];
}
export function checklist(task, index = Math.min(currentIndex(task), task.pieces.length - 1)) {
  const p = task.pieces[index];
  if (p.status !== 'pending' && Array.isArray(p.actionSnapshot) && p.actionSnapshot.every(item => typeof item?.text === 'string')) return p.actionSnapshot;
  const first = index === 0;
  const last = index === task.pieces.length - 1;
  const type = Number(task.type);
  let lines;
  if (p.kind === 'blocked') {
    lines = [task.resumeText || '막힌 지점 열기', type === 0 ? '예제나 설명 하나 보기' : '가능한 부분부터 작게 하기', '다음에 해볼 것 남기기'];
  } else {
    const start = first && task.startText ? task.startText : p.kind === 'incomplete' ? '못 끝낸 지점 열기' : first ? ['시작할 곳 열기', '시작할 부분 열기', '할 위치 확인하기'][type] : '이어갈 곳 열기';
    const work = last && task.finishText ? `${task.finishText}까지 하기` : ['읽고 풀기', '제출물 만들기', '실제로 하기'][type];
    lines = [start, work, last ? ['핵심·막힌 점 확인하기', '빠진 것 확인하기', '마무리 확인하기'][type] : '다음에 이어갈 곳 잡기'];
  }
  const items = lines.map((text, i) => ({number: i + 1, text}));
  if (first && task.prep) items.unshift({number: '준비', text: ['자료 열기', '과제 파일 열기', '필요한 것 꺼내기'][type]});
  return items;
}

function object(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function validateState(raw, legacy = false) {
  if (!object(raw) || !Array.isArray(raw.tasks)) throw new Error('Step 백업의 할 일 목록을 읽을 수 없어요.');
  const groups = raw.groups ?? [{id: 'inbox', name: '할 일', collapsed: false}];
  if (!Array.isArray(groups) || !groups.length || groups.some(g => !object(g) || typeof g.id !== 'string' || !g.id || typeof g.name !== 'string' || !g.name.trim())) throw new Error('묶음 정보가 올바르지 않아요.');
  if (new Set(groups.map(g => g.id)).size !== groups.length) throw new Error('같은 ID의 묶음이 중복되어 있어요.');
  const ids = new Set();
  const tasks = raw.tasks.map(t => {
    if (!object(t) || typeof t.id !== 'string' || !t.id || ids.has(t.id) || typeof t.title !== 'string') throw new Error('할 일 정보 또는 ID가 올바르지 않아요.');
    ids.add(t.id);
    if (!Array.isArray(t.pieces) || !t.pieces.length) throw new Error('Step 정보가 없는 할 일이 있어요.');
    const pieces = t.pieces.map(p => {
      if (!object(p) || !['pending', 'success', 'incomplete', 'blocked'].includes(p.status)) throw new Error('Step 상태를 읽을 수 없어요.');
      const flags = Array.isArray(p.done) ? p.done : legacy && Array.isArray(p.steps) ? p.steps.map(s => !!s.done) : null;
      if (!flags || flags.some(v => typeof v !== 'boolean') || flags.length > 4) throw new Error('작은 행동의 체크 정보가 올바르지 않아요.');
      return {...p, id: p.id || uid(), done: [...flags]};
    });
    const groupId = t.groupId || groups[0].id;
    if (!groups.some(g => g.id === groupId)) throw new Error('할 일이 속한 묶음을 찾을 수 없어요.');
    const task = {...t, groupId, pieces, count: pieces.length, type: [0, 1, 2].includes(t.type) ? t.type : 0, prep: !!t.prep, startText: String(t.startText || ''), finishText: String(t.finishText || ''), memoText: String(t.memoText || ''), resumeText: String(t.resumeText || ''), doneShelf: !!t.doneShelf};
    // Only a legacy backup without the explicit finalization field uses the old completion rule.
    task.finalized = typeof t.finalized === 'boolean' ? t.finalized : legacy ? ready(task) : false;
    if (task.finalized && !ready(task)) throw new Error('완료 상태와 남은 Step이 일치하지 않아요.');
    task.timer = {...timerDefault(), ...(object(t.timer) ? t.timer : {})};
    if (!['focus', 'break', 'off'].includes(task.timer.mode)) task.timer.mode = 'focus';
    if (!Number.isFinite(task.timer.elapsed) || task.timer.elapsed < 0) task.timer.elapsed = 0;
    if (!Number.isFinite(task.timer.startedAt)) {task.timer.startedAt = null; task.timer.running = false;}
    return task;
  });
  const state = {...initialState(), ...raw, groups: clone(groups), tasks};
  if (!tasks.some(t => t.id === state.activeId)) state.activeId = null;
  if (!tasks.some(t => t.id === state.resumeId)) state.resumeId = null;
  state.draft = {...emptyDraft(groups[0].id), ...(object(raw.draft) ? raw.draft : legacy ? {title: String(raw.draft || ''), memoText: String(raw.memoText || ''), startText: String(raw.startText || ''), finishText: String(raw.finishText || ''), type: raw.type || 0, count: raw.count || 1, prep: !!raw.prep} : {})};
  if (!groups.some(g => g.id === state.draft.groupId)) state.draft.groupId = groups[0].id;
  state.editorDraft = object(raw.editorDraft) ? raw.editorDraft : null;
  return state;
}
