import {LocalStore, STORAGE_KEY} from './storage.js';
import * as M from './model.js';
import {parseBackup, exportBackup, mergeBackup, asStored} from './backup.js';
import {escape as e, toggleToken} from './memo.js';
import {listView, focusView, editor, button, icons, field, groupOptions} from './view.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
let storage;
try { storage = window.localStorage; } catch { storage = {getItem() {throw new Error('Storage unavailable');}}; }
const store = new LocalStore(storage);
const ui = {mode: store.state.activeId ? 'focus' : 'list', capture: !!store.state.draft.title, shelf: false, arrange: false, library: false, timerOpen: false, modal: null};
let memoryDraft = null;
let unsavedDraft = false;
let undo = null;
let toastTimeout;
let imported = null;
let lastFocused = null;
let transitionAt = 0;

function notify(message, undoAction = false) {
  const box = document.querySelector('#toast');
  clearTimeout(toastTimeout);
  box.innerHTML = `<span>${e(message)}</span>${undoAction ? button('undo', '되돌리기', '') : ''}`;
  box.hidden = false;
  toastTimeout = setTimeout(() => {box.hidden = true;}, undoAction ? 10000 : 4000);
}
function showError(message) {
  const box = document.querySelector('#storage-alert');
  box.innerHTML = `${e(message)} ${button('settings', '백업·복구', '')}`;
  box.hidden = false;
  if (modal.open) {
    let error = modal.querySelector('.form-error');
    if (!error) {error = document.createElement('p'); error.className = 'form-error'; error.setAttribute('role', 'alert'); modal.append(error);}
    error.textContent = message;
  }
}
function commit(change, {render = true, checkpoint = true, remember = false} = {}) {
  const before = remember ? M.clone(store.state) : null;
  try {
    store.commit(change, {checkpoint});
    if (remember) undo = {state: before, raw: store.raw};
    else if (checkpoint) undo = null;
    document.querySelector('#storage-alert').hidden = true;
    if (render) renderApp();
    return true;
  } catch (error) {showError(error.message); return false;}
}
function renderApp() {
  if (store.blocked) {
    app.innerHTML = `<section class="storage-blocked"><h1>저장 내용을 먼저 확인할게요.</h1><p>기존 내용은 그대로 남겨뒀어요. 백업·복구에서 복구본이나 내보낸 파일을 불러올 수 있어요.</p>${button('settings', '백업·복구 열기', 'button primary')}</section>`;
    showError(store.error);
    return;
  }
  const task = M.currentTask(store.state);
  if (!task) ui.mode = 'list';
  const focus = document.activeElement?.dataset;
  const memoTop = document.querySelector('.memo-content')?.scrollTop || 0;
  const visible = memoryDraft && unsavedDraft ? {...store.state, ...(memoryDraft.id ? {editorDraft: memoryDraft} : {draft: memoryDraft})} : store.state;
  app.innerHTML = ui.mode === 'focus' && task ? focusView(visible, ui) : listView(visible, ui);
  const memo = document.querySelector('.memo-content');
  if (memo) memo.scrollTop = memoTop;
  if (focus?.action && ['small-check', 'memo-check'].includes(focus.action)) app.querySelector(`[data-action="${focus.action}"][data-index="${Number(focus.index)}"]`)?.focus({preventScroll: true});
  updateTimer();
}
function openDialog(html, kind, data = {}) {
  lastFocused = document.activeElement;
  ui.modal = {kind, ...data};
  modal.innerHTML = html;
  if (!modal.open) modal.showModal();
  modal.querySelector('input:not([type=file]),textarea')?.focus({preventScroll: true});
}
function closeDialog() {
  modal.close();
  ui.modal = null;
  if (!unsavedDraft) memoryDraft = null;
  lastFocused?.isConnected && lastFocused.focus({preventScroll: true});
}
const modalHeading = title => `<div class="modal-heading"><h2 id="modal-title">${e(title)}</h2>${button('modal-close', icons.close, 'icon-button', 'aria-label="창 닫기"')}</div>`;
function openEditor(id) {
  const task = M.taskById(store.state, id);
  if (!task) return;
  if (store.state.editorDraft && store.state.editorDraft.id !== id) {
    openDialog(`${modalHeading('남아 있는 편집 초안')}<p class="modal-copy">다른 할 일의 편집 초안이 있어요. 먼저 저장하거나 취소해 주세요.</p>${button('resume-edit', '초안 이어서 편집', 'button primary')}`, 'draft-warning');
    return;
  }
  if (!store.state.editorDraft && !commit(s => {s.editorDraft = {...M.clone(task), count: task.pieces.length};}, {render: false, checkpoint: false})) return;
  memoryDraft = unsavedDraft && memoryDraft?.id === id ? memoryDraft : M.clone(store.state.editorDraft);
  openDialog(editor(store.state, task, memoryDraft), 'editor', {id});
}
function captureForm(form) {
  const data = new FormData(form);
  return {title: String(data.get('title') || ''), memoText: String(data.get('memoText') || ''), groupId: String(data.get('groupId') || store.state.groups[0].id), type: Number(data.get('type') || 0), count: Number(data.get('count') || 1), startText: String(data.get('startText') || ''), finishText: String(data.get('finishText') || ''), prep: data.has('prep')};
}
function persistDraft(form) {
  const draft = captureForm(form);
  if (form.id === 'editor-form') {
    const task = M.taskById(store.state, ui.modal.id);
    if (M.started(task)) draft.prep = task.prep;
    memoryDraft = {...M.clone(store.state.editorDraft || task), ...draft, id: task.id};
    unsavedDraft = !commit(s => {s.editorDraft = M.clone(memoryDraft);}, {render: false, checkpoint: false});
  } else {
    memoryDraft = draft;
    unsavedDraft = !commit(s => {s.draft = draft;}, {render: false, checkpoint: false});
  }
}
function openCapture(groupId) {
  if (groupId && !commit(s => {s.draft.groupId = groupId;}, {render: false, checkpoint: false})) return;
  ui.mode = 'list';
  ui.capture = !ui.capture || !!groupId;
  renderApp();
  document.querySelector('#capture-title')?.focus();
}
function openNote(kind) {
  const task = M.currentTask(store.state);
  const titles = {pause: '잠깐 중단하기', 'pause-note': '이어서 할 곳', blocked: '막힌 곳 다시 잡기', continue: '같은 일을 더 이어서'};
  const copy = kind === 'pause' ? '체크·메모·진행 위치는 그대로 남아요. 다음에 손댈 곳을 적어두어도 좋아요.' : kind === 'blocked' ? '막힌 지점을 남기고 더 작은 행동으로 다시 시작해요. 새 Step 하나가 추가돼요.' : kind === 'continue' ? '이번 실행은 여기까지 남기고, 이어서 할 Step 하나를 추가해요.' : '다음에 돌아왔을 때 먼저 보일 메모예요.';
  openDialog(`<form id="note-form">${modalHeading(titles[kind])}<p class="modal-copy">${copy}</p><label class="field"><span>이어서 할 곳 (선택)</span><textarea name="resumeText" rows="3" placeholder="예: 예제 4의 두 번째 식부터">${e(task.resumeText)}</textarea></label><div class="dialog-actions">${button('modal-close', '취소', 'button ghost')}<button class="button primary" type="submit">${kind === 'pause' ? '중단하고 목록으로' : kind === 'blocked' ? '작은 Step으로 다시 시작' : kind === 'continue' ? 'Step 추가하고 이어서' : '저장'}</button></div></form>`, kind);
}
function openMemo() {
  const task = M.currentTask(store.state);
  // The same persistent editor draft protects memo typing on refresh.
  openEditor(task.id);
  const details = modal.querySelector('.settings-details');
  if (details) details.open = false;
  modal.querySelector('#edit-memo')?.focus();
}
function openGroup(id) {
  const group = store.state.groups.find(g => g.id === id);
  openDialog(`<form id="group-form">${modalHeading(group ? '묶음 편집' : '묶음 추가')}${field('name', '묶음 이름', group?.name || '', '예: 오늘, 나중, 개인 프로젝트', 'required autocomplete="off"')}${group ? `<label class="field"><span>묶음 순서</span><select name="position">${store.state.groups.map((g, i) => `<option value="${i}" ${g.id === id ? 'selected' : ''}>${i + 1}번째</option>`).join('')}</select></label>` : ''}<div class="modal-footer">${group ? button('group-delete', '묶음 삭제', 'text-button danger', `data-id="${e(id)}" ${store.state.groups.length < 2 ? 'disabled' : ''}`) : '<span></span>'}<button class="button primary" type="submit">${group ? '저장' : '추가'}</button></div></form>`, 'group', {id});
}
function confirmDelete(id) {
  const task = M.taskById(store.state, id);
  if (!task) return;
  openDialog(`${modalHeading('이 할 일을 삭제할까요?')}<p class="modal-copy"><strong>${e(task.title)}</strong><br>삭제 직전 복구본을 남겨요. 필요하면 백업·복구에서 되돌릴 수 있어요.</p><div class="dialog-actions">${button('modal-close', '취소', 'button ghost')}${button('delete-confirm', '삭제', 'button secondary danger', `data-id="${e(id)}"`)}</div>`, 'delete', {id});
}
function download(text, name) {
  const blob = new Blob([text], {type: 'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function backupState() {
  const state = M.clone(store.state);
  if (memoryDraft) {
    if (memoryDraft.id) state.editorDraft = memoryDraft;
    else state.draft = memoryDraft;
  }
  return state;
}
function openSettings() {
  const records = store.recovery();
  openDialog(`${modalHeading('백업·복구')}<p class="modal-copy">이 브라우저에 자동으로 저장돼요.<br>다른 기기로 옮기거나 브라우저 데이터를 지우기 전에는 백업을 내려받아 주세요.</p>
    <section class="settings-section"><h3>파일로 보관하기</h3>${button('export', '백업 내려받기', 'button primary small')}${button('export-copy', '백업 내용 보기', 'text-button')}<div id="backup-copy" hidden></div><label class="file-field">Step 백업 가져오기<input type="file" id="backup-file" accept=".json,application/json"></label><p>기존 Step에서 내보낸 백업도 읽을 수 있어요.</p><div id="import-preview"></div></section>
    <section class="settings-section"><h3>이 브라우저의 복구본</h3><p>진행·편집·삭제 직전 내용을 최대 8개 보관해요.</p>${records.length ? records.map((record, i) => `<div class="recovery-row"><span>${new Date(record.at).toLocaleString('ko-KR')}</span>${button('recovery', '확인', 'text-button', `data-index="${i}"`)}</div>`).join('') : '<p>아직 남겨둔 복구본이 없어요.</p>'}${store.blocked ? button('export-damaged', '현재 저장 원문 내려받기', 'text-button') : ''}</section>
    <section class="settings-section"><h3>Step! 1.0.0</h3><p>로그인과 계정 동기화 없이 사용해요. 묶음 이름은 자유롭게 바꿀 수 있고, 날짜가 바뀌어도 할 일이 자동으로 이동하지 않아요.</p>${button('reload', '저장된 내용 다시 불러오기', 'text-button')}</section>`, 'settings');
}
function burst(target, final = false) {
  if (!target || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
  const layer = document.querySelector('#effects');
  const count = final ? 26 : 8;
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('i');
    spark.className = `spark${final ? ' final' : ''}`;
    const angle = i / count * Math.PI * 2;
    const radius = final ? 75 + Math.random() * 65 : 27 + Math.random() * 22;
    spark.style.cssText = `left:${x}px;top:${y}px;--x:${Math.cos(angle) * radius}px;--y:${Math.sin(angle) * radius}px;--rot:${i * 65}deg;background:${['#e7b629','#829863','#f0ce68','#c1cc9b'][i % 4]}`;
    layer.append(spark);
    setTimeout(() => spark.remove(), 1100);
  }
  if (final) {
    const ring = document.createElement('i'); ring.className = 'reward-ring'; ring.style.left = `${x}px`; ring.style.top = `${y}px`; layer.append(ring); setTimeout(() => ring.remove(), 800);
  }
}
function updateTimer() {
  const task = M.currentTask(store.state);
  const clock = document.querySelector('#timer-clock');
  if (!task || !clock) return;
  const timer = task.timer;
  const elapsed = timer.elapsed + (timer.running && timer.startedAt ? Math.max(0, Date.now() - timer.startedAt) : 0);
  const remaining = (timer.mode === 'break' ? 300000 : 1500000) - elapsed;
  const seconds = Math.ceil(Math.abs(remaining) / 1000);
  clock.textContent = `${remaining < 0 ? '+' : ''}${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const caption = document.querySelector('#timer-caption');
  if (caption) caption.textContent = remaining <= 0 ? '시간이 됐어요. 편한 지점에서 마쳐요.' : '시간은 가볍게 참고하세요.';
}

const actions = {
  home() {ui.mode = 'list'; renderApp();},
  list() {ui.mode = 'list'; renderApp();},
  capture(el) {openCapture(el.dataset.id);},
  'capture-modal'() {ui.mode = 'list'; ui.capture = false; openCapture();},
  'capture-close'() {ui.capture = false; renderApp();},
  'show-tasks'() {ui.shelf = false; renderApp();},
  'show-shelf'() {ui.shelf = true; renderApp();},
  arrange() {ui.arrange = !ui.arrange; renderApp();},
  'group-toggle'(el) {commit(s => {const g = s.groups.find(g => g.id === el.dataset.id); g.collapsed = !g.collapsed;}, {checkpoint: false});},
  'group-new'() {openGroup();},
  'group-edit'(el) {openGroup(el.dataset.id);},
  'group-delete'(el) {
    const id = el.dataset.id;
    openDialog(`<form id="group-delete-form">${modalHeading('묶음만 삭제하기')}<p class="modal-copy">할 일은 삭제하지 않고 아래 묶음으로 옮겨요.</p><label class="field"><span>할 일을 옮길 묶음</span><select name="destination">${store.state.groups.filter(g => g.id !== id).map(g => `<option value="${e(g.id)}">${e(g.name)}</option>`).join('')}</select></label><div class="dialog-actions">${button('modal-close', '취소', 'button ghost')}<button class="button secondary" type="submit">옮기고 묶음 삭제</button></div></form>`, 'group-delete', {id});
  },
  'task-up'(el) {commit(s => M.moveWithinGroup(s, el.dataset.id, -1));},
  'task-down'(el) {commit(s => M.moveWithinGroup(s, el.dataset.id, 1));},
  edit(el) {openEditor(el.dataset.id);},
  'resume-edit'() {openEditor(store.state.editorDraft.id);},
  'edit-cancel'() {if (commit(s => {s.editorDraft = null;})) {unsavedDraft = false; closeDialog();}},
  'modal-close'() {closeDialog(); renderApp();},
  run(el) {if (commit(s => M.activate(s, el.dataset.id), {render: false})) {ui.mode = 'focus'; ui.library = false; renderApp(); window.scrollTo({top: 0});}},
  'library-toggle'() {ui.library = !ui.library; renderApp();},
  pause() {openNote('pause');},
  'pause-note'() {openNote('pause-note');},
  blocked() {openNote('blocked');},
  continue() {openNote('continue');},
  'small-check'(el) {
    const task = M.currentTask(store.state), index = Number(el.dataset.index), p = task.pieces[M.currentIndex(task)];
    if (!p || task.finalized || index < 0 || index >= M.checklist(task).length) return;
    const checking = !p.done[index];
    if (commit(s => {const t = M.currentTask(s); t.pieces[M.currentIndex(t)].done[index] = checking;}, {render: false})) {if (checking) burst(el); renderApp();}
  },
  'memo-check'(el) {const top = document.querySelector('.memo-content')?.scrollTop; if (commit(s => {const t = M.currentTask(s); t.memoText = toggleToken(t.memoText, Number(el.dataset.index));})) {const box = document.querySelector('.memo-content'); if (box) box.scrollTop = top;}},
  'memo-edit'() {openMemo();},
  'step-success'(el) {if (commit(s => M.completeStep(M.currentTask(s)), {remember: true, render: false})) {burst(el); renderApp(); notify(M.ready(M.currentTask(store.state)) ? '계획한 Step을 마쳤어요. 할 일 완료는 직접 선택해 주세요.' : '다음 Step으로 이어가요.', true);}},
  'undo-last'() {commit(s => {const task = M.currentTask(s); if (!M.ready(task) || task.finalized) return; task.pieces[task.pieces.length - 1].status = 'pending';});},
  undo() {if (!undo || store.raw !== undo.raw) {notify('그 뒤의 변경이 있어 되돌릴 수 없어요.'); return;} const previous = undo.state; if (commit(s => {Object.keys(s).forEach(k => delete s[k]); Object.assign(s, previous);})) {undo = null; notify('이전 Step으로 돌아왔어요.');}},
  extend() {if (commit(s => M.extend(M.currentTask(s)))) notify('Step 하나를 추가했어요.');},
  finalize(el) {if (commit(s => M.finalize(M.currentTask(s)), {render: false})) {burst(el, true); renderApp(); notify('할 일을 완료했어요.');}},
  'complete-new'() {if (commit(s => {s.activeId = null; s.resumeId = null;}, {render: false})) {ui.mode = 'list'; ui.shelf = false; ui.capture = true; renderApp(); document.querySelector('#capture-title')?.focus();}},
  'complete-keep'() {if (commit(s => {s.activeId = null; s.resumeId = null;})) {ui.mode = 'list'; ui.shelf = false; renderApp();}},
  'complete-shelf'() {if (commit(s => {const t = M.currentTask(s); t.doneShelf = true; t.doneShelfAt = Date.now(); s.activeId = null; s.resumeId = null;})) {ui.mode = 'list'; ui.shelf = false; renderApp(); notify('끝낸 일로 치웠어요.');}},
  unshelf(el) {if (commit(s => {const t = M.taskById(s, el.dataset.id); t.doneShelf = false; s.editorDraft = null;})) {closeDialog(); ui.shelf = false; renderApp(); notify('완료 상태로 보관함에 꺼냈어요.');}},
  delete(el) {confirmDelete(el.dataset.id);},
  'delete-confirm'(el) {if (commit(s => {s.tasks = s.tasks.filter(t => t.id !== el.dataset.id); if (s.activeId === el.dataset.id) s.activeId = null; if (s.resumeId === el.dataset.id) s.resumeId = null; if (s.editorDraft?.id === el.dataset.id) s.editorDraft = null;})) {closeDialog(); notify('삭제했어요. 복구본은 백업·복구에 남아 있어요.');}},
  'insert-token'(el) {const input = document.getElementById(el.dataset.target); const start = input.selectionStart, end = input.selectionEnd, top = input.scrollTop; input.setRangeText('○', start, end, 'end'); input.focus({preventScroll: true}); input.scrollTop = top; persistDraft(input.form);},
  'timer-mode'(el) {ui.timerOpen = true; commit(s => {const t = M.currentTask(s); M.pauseTimer(t); t.timer = {...M.timerDefault(), mode: el.dataset.mode};}, {checkpoint: false});},
  'timer-toggle'() {ui.timerOpen = true; commit(s => {const t = M.currentTask(s); if (t.timer.running) M.pauseTimer(t); else {t.timer.running = true; t.timer.startedAt = Date.now();}}, {checkpoint: false});},
  'timer-reset'() {ui.timerOpen = true; commit(s => {const t = M.currentTask(s); t.timer = {...M.timerDefault(), mode: t.timer.mode};}, {checkpoint: false});},
  settings() {openSettings();},
  export() {download(exportBackup(backupState()), `step-backup-${new Date().toISOString().slice(0, 10)}.json`); notify('백업 파일을 내려받아요.');},
  'export-copy'() {const box = document.querySelector('#backup-copy'); box.hidden = false; box.innerHTML = '<label class="field"><span>선택해서 복사할 수 있어요.</span><textarea class="backup-text" readonly></textarea></label>'; const input = box.querySelector('textarea'); input.value = exportBackup(backupState()); input.focus(); input.select();},
  'export-damaged'() {download(store.raw || '', 'step-local-unreadable.json');},
  'import-merge'() {if (!imported) return; let result; if (commit(s => {result = mergeBackup(s, imported);})) {closeDialog(); notify(`${result.added}개 추가했어요.${result.skipped ? ` 같은 ID ${result.skipped}개는 유지했어요.` : ''}`);}},
  'import-replace'() {if (!imported) return; openDialog(`${modalHeading('백업 내용으로 복원할까요?')}<p class="modal-copy">현재 내용 대신 백업의 할 일 ${imported.tasks.length}개를 불러와요. 현재 내용은 복구본으로 남겨요.</p><div class="dialog-actions">${button('modal-close', '취소', 'button ghost')}${button('import-replace-confirm', '복원', 'button primary')}</div>`, 'import-replace');},
  'import-replace-confirm'() {if (!imported) return; try {if (store.blocked) store.restore(asStored(imported)); else if (!commit(s => {Object.keys(s).forEach(k => delete s[k]); Object.assign(s, M.clone(imported)); s.tasks.forEach(t => M.pauseTimer(t));}, {render: false})) return; closeDialog(); ui.mode = store.state.activeId ? 'focus' : 'list'; ui.capture = false; renderApp(); notify('백업을 불러왔어요.');} catch (error) {showError(error.message);}},
  recovery(el) {const index = Number(el.dataset.index), record = store.recovery()[index]; if (!record) return; let state; try {state = JSON.parse(record.raw).state;} catch {notify('이 복구본을 읽을 수 없어요.'); return;} openDialog(`${modalHeading('이 시점으로 되돌릴까요?')}<p class="modal-copy">${new Date(record.at).toLocaleString('ko-KR')}<br>할 일 ${state.tasks?.length ?? '?'}개가 있어요. 현재 내용도 따로 보관해요.</p><div class="dialog-actions">${button('modal-close', '취소', 'button ghost')}${button('recovery-confirm', '복구', 'button primary', `data-index="${index}"`)}</div>`, 'recovery');},
  'recovery-confirm'(el) {try {const record = store.recovery()[Number(el.dataset.index)]; store.restore(record.raw); closeDialog(); ui.mode = store.state.activeId ? 'focus' : 'list'; renderApp(); notify('복구했어요.');} catch (error) {showError(error.message);}},
  reload() {if (store.state.editorDraft || store.state.draft.title || memoryDraft) actions.export(); location.reload();}
};

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = actions[target.dataset.action];
  if (action) {
    event.preventDefault();
    if (['step-success', 'finalize'].includes(target.dataset.action)) {
      if (Date.now() - transitionAt < 450) return;
      transitionAt = Date.now();
    }
    try {action(target);} catch (error) {showError(error.message);}
  }
});
document.addEventListener('input', event => {
  const form = event.target.form;
  if (form && ['capture-form', 'editor-form'].includes(form.id)) persistDraft(form);
});
document.addEventListener('toggle', event => {if (event.target.classList?.contains('timer-panel')) ui.timerOpen = event.target.open;}, true);
document.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  if (form.id === 'capture-form') {
    const draft = captureForm(form);
    if (commit(s => M.addTask(s, draft), {render: false})) {ui.capture = false; ui.shelf = false; memoryDraft = null; unsavedDraft = false; renderApp(); notify('추가했어요. 재생 버튼으로 시작해 보세요.');}
  } else if (form.id === 'editor-form') {
    const draft = captureForm(form), id = ui.modal.id;
    if (commit(s => {const task = M.taskById(s, id); if (!draft.title.trim()) throw new Error('제목을 적어 주세요.'); M.resizePieces(task, draft.count); const prep = M.started(task) ? task.prep : draft.prep; Object.assign(task, draft, {title: draft.title.trim(), prep}); s.editorDraft = null;})) {unsavedDraft = false; closeDialog(); renderApp(); notify('저장했어요.');}
  } else if (form.id === 'group-form') {
    const data = new FormData(form), name = String(data.get('name') || '').trim(), id = ui.modal.id;
    if (!name) return;
    if (commit(s => {if (!id) {s.groups.push({id: M.uid(), name, collapsed: false}); return;} const group = s.groups.find(g => g.id === id); group.name = name; s.groups = s.groups.filter(g => g.id !== id); s.groups.splice(Number(data.get('position')), 0, group);})) closeDialog();
  } else if (form.id === 'group-delete-form') {
    const destination = new FormData(form).get('destination'), id = ui.modal.id;
    if (commit(s => M.deleteGroup(s, id, destination))) {closeDialog(); notify('할 일을 옮기고 묶음을 삭제했어요.');}
  } else if (form.id === 'note-form') {
    const note = String(new FormData(form).get('resumeText') || ''), kind = ui.modal.kind;
    if (commit(s => {const task = M.currentTask(s); if (kind === 'pause') M.pause(s, note); else if (kind === 'pause-note') task.resumeText = note; else M.completeStep(task, kind === 'blocked' ? 'blocked' : 'incomplete', note);}, {remember: kind === 'blocked' || kind === 'continue'})) {closeDialog(); if (kind === 'pause') {ui.mode = 'list'; renderApp(); notify('여기까지 남겨뒀어요.');} else if (kind !== 'pause-note') notify('새 Step에서 이어가요.', true);}
  }
});
document.addEventListener('change', async event => {
  if (event.target.id !== 'backup-file') return;
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('백업 파일이 너무 커요. 20MB 이하 파일을 선택해 주세요.');
    imported = parseBackup(await file.text());
    const duplicate = imported.tasks.filter(t => store.state.tasks.some(x => x.id === t.id)).length;
    document.querySelector('#import-preview').innerHTML = `<div class="import-summary">할 일 ${imported.tasks.length}개 · 묶음 ${imported.groups.length}개${duplicate ? `<p>같은 ID ${duplicate}개는 추가할 때 덮어쓰지 않아요.</p>` : ''}</div><div class="dialog-actions">${!store.blocked ? button('import-merge', '기존 목록에 추가', 'button secondary') : ''}${button('import-replace', '이 백업으로 복원', 'button primary')}</div>`;
  } catch (error) {imported = null; document.querySelector('#import-preview').innerHTML = `<p class="form-error">${e(error.message)}</p>`;}
});
modal.addEventListener('cancel', () => {ui.modal = null; if (!unsavedDraft) memoryDraft = null; renderApp();});
modal.addEventListener('click', event => {if (event.target === modal) {const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {closeDialog(); renderApp();}}});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY || event.newValue === store.raw) return;
  showError('다른 창에서 내용이 바뀌었어요. 작성 중인 내용을 백업한 뒤 다시 불러와 주세요.');
});
window.addEventListener('pagehide', () => {
  if (store.blocked || !store.state.tasks.some(t => t.timer?.running)) return;
  commit(s => {s.tasks.forEach(t => M.pauseTimer(t));}, {render: false, checkpoint: false});
});
renderApp();
if (store.error) showError(store.error);
setInterval(updateTimer, 1000);
