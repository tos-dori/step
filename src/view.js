import {TYPES, currentIndex, ready, position, started, currentTask, taskById, checklist} from './model.js';
import {escape as e, renderMemo} from './memo.js';
export const icons = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="m9 5 11 7-11 7z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-7 7 7 7M5 12h15"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="fill" cx="5" cy="12" r="1.4"/><circle class="fill" cx="12" cy="12" r="1.4"/><circle class="fill" cx="19" cy="12" r="1.4"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>'
};
export const button = (action, text, cls = 'button', attrs = '') => `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${text}</button>`;
const option = (value, text, selected) => `<option value="${e(value)}" ${selected ? 'selected' : ''}>${e(text)}</option>`;
export const groupOptions = (state, selected) => state.groups.map(g => option(g.id, g.name, g.id === selected)).join('');
export const field = (name, label, value = '', placeholder = '', extra = '') => `<label class="field"><span>${e(label)}</span><input name="${name}" value="${e(value)}" placeholder="${e(placeholder)}" ${extra}></label>`;
function taskRow(task, ui) {
  const status = task.finalized ? '완료' : ready(task) ? '완료 전 확인' : started(task) ? `${position(task)} · 이어서` : `${task.pieces.length} Step`;
  return `<article class="task-row ${task.finalized ? 'finished' : ''}" data-task-id="${e(task.id)}">
    <button class="task-content" data-action="edit" data-id="${e(task.id)}" aria-label="${e(task.title)} 편집"><span class="task-title">${task.finalized ? '<span class="done-mark">✓</span>' : ''}${e(task.title)}</span>${task.memoText ? `<span class="task-memo">${renderMemo(task.memoText, false)}</span>` : ''}</button>
    <span class="row-progress">${status}</span>
    ${ui.arrange ? `<div class="order-buttons">${button('task-up', '↑', 'icon-button', `data-id="${e(task.id)}" aria-label="${e(task.title)} 위로"`)}${button('task-down', '↓', 'icon-button', `data-id="${e(task.id)}" aria-label="${e(task.title)} 아래로"`)}</div>` : button('run', task.finalized ? icons.chevron : icons.play, 'play-button', `data-id="${e(task.id)}" aria-label="${e(task.title)} ${task.finalized ? '완료 내용 보기' : '시작·이어서'}"`)}
  </article>`;
}
export function collection(state, ui, compact = false) {
  const shelf = ui.shelf;
  const groups = state.groups.map(group => {
    const tasks = state.tasks.filter(t => t.groupId === group.id && !!t.doneShelf === shelf);
    if (shelf && !tasks.length) return '';
    return `<section class="group" aria-label="${e(group.name)} 묶음"><div class="group-heading">
      ${button('group-toggle', `<span class="chevron ${group.collapsed ? '' : 'open'}">${icons.chevron}</span><span>${e(group.name)}</span><span class="count">${tasks.length}</span>`, 'group-toggle', `data-id="${e(group.id)}" aria-expanded="${!group.collapsed}"`)}
      ${!shelf ? button('group-edit', icons.more, 'icon-button', `data-id="${e(group.id)}" aria-label="${e(group.name)} 묶음 편집"`) : ''}
      </div>${group.collapsed ? '' : `<div class="group-body">${tasks.map(t => taskRow(t, ui)).join('') || `<div class="group-empty">${button('capture', `${icons.plus} 할 일 추가`, 'text-button', `data-id="${e(group.id)}"`)}</div>`}</div>`}</section>`;
  }).join('');
  return `<section class="collection ${compact ? 'compact' : ''}" aria-label="할 일 목록">
    <div class="collection-toolbar"><div class="view-switch" aria-label="목록 종류">${button('show-tasks', '할 일', `tab-button ${!shelf ? 'selected' : ''}`, `aria-pressed="${!shelf}"`)}${button('show-shelf', `끝낸 일 <span>${state.tasks.filter(t => t.doneShelf).length}</span>`, `tab-button ${shelf ? 'selected' : ''}`, `aria-pressed="${shelf}"`)}</div>${button('arrange', ui.arrange ? '정리 마침' : '순서 바꾸기', `text-button ${ui.arrange ? 'selected' : ''}`, `aria-pressed="${ui.arrange}"`)}</div>
    ${groups || '<div class="shelf-empty">끝낸 일을 치워두면 여기에 모여요.</div>'}
    ${!shelf ? button('group-new', `${icons.plus} 묶음 추가`, 'text-button add-group') : ''}
  </section>`;
}
export function capture(state) {
  const draft = state.draft;
  return `<form id="capture-form" class="capture"><div class="capture-heading"><h2>새 할 일</h2>${button('capture-close', icons.close, 'icon-button', 'aria-label="새 할 일 닫기"')}</div>
    <label class="sr-only" for="capture-title">할 일 제목</label><input id="capture-title" name="title" class="title-input" placeholder="무엇을 시작해 볼까?" value="${e(draft.title)}" autocomplete="off" required>
    <label class="sr-only" for="capture-memo">메모</label><textarea id="capture-memo" name="memoText" rows="2" placeholder="이어갈 곳이나 기억할 것 (선택)">${e(draft.memoText)}</textarea>
    <div class="capture-tools">${button('insert-token', '○ 체크 넣기', 'text-button', 'data-target="capture-memo"')}<label class="inline-field">묶음 <select name="groupId" aria-label="추가할 묶음">${groupOptions(state, draft.groupId)}</select></label></div>
    <details class="settings-details"><summary>실행 설정 <span>필요할 때만</span></summary>${executionFields(draft)}</details>
    <div class="form-footer"><span class="fine-print">닫아도 작성 내용은 남아요.</span><button class="button primary" type="submit">추가 ${icons.plus}</button></div>
  </form>`;
}
export function executionFields(draft, task = null) {
  return `<div class="execution-fields"><div class="field-grid"><label class="field"><span>종류</span><select name="type">${TYPES.map((name, i) => option(i, name, i === Number(draft.type))).join('')}</select></label>${field('count', '전체 Step', draft.count, '', 'type="number" min="1" max="1000" required')}</div>
  ${field('startText', '시작할 곳', draft.startText, '예: p.37 예제 4 열기')}${field('finishText', '끝 기준', draft.finishText, '예: 예제 4 풀이 확인')}
  <label class="check-field"><input name="prep" type="checkbox" ${draft.prep ? 'checked' : ''} ${task && started(task) ? 'disabled' : ''}>첫 Step에 준비 행동 넣기</label>
  ${task && started(task) ? '<p class="fine-print">진행한 Step과 체크는 유지돼요. Step은 미진행 부분만 줄일 수 있어요.</p>' : ''}</div>`;
}
export function listView(state, ui) {
  const resumable = taskById(state, state.resumeId);
  const hasResume = resumable && !resumable.finalized && (started(resumable) || state.activeId === resumable.id);
  return `<section class="list-page"><div class="page-heading"><div><p class="eyebrow">MY STEPS</p><h1>어디부터 시작할까?</h1><p class="page-description">지금 보고 싶은 일만 펼쳐두세요.</p></div>${button('capture', ui.capture ? icons.close : `${icons.plus}<span>할 일 추가</span>`, `button ${state.tasks.length ? 'secondary' : 'primary'}`, `aria-label="${ui.capture ? '추가 닫기' : '새 할 일 추가'}"`)}</div>
    ${hasResume && !ui.capture ? `<div class="resume-banner"><div><span class="eyebrow">이어서 할 일 · ${position(resumable)}</span><strong>${e(resumable.title)}</strong>${resumable.resumeText ? `<p>${e(resumable.resumeText)}</p>` : '<p>체크한 자리부터 이어갈 수 있어요.</p>'}</div>${button('run', `이어서 ${icons.play}`, 'button primary small', `data-id="${e(resumable.id)}"`)}</div>` : ''}
    ${state.editorDraft ? `<div class="draft-banner"><span>편집 중이던 내용이 있어요.</span>${button('resume-edit', '이어서 편집', 'text-button')}</div>` : ''}
    ${ui.capture ? capture(state) : ''}${collection(state, ui)}
  </section>`;
}
function history(task) {
  if (!started(task)) return '';
  const names = {pending: '진행 전', success: '마침', incomplete: '이어감', blocked: '막힘'};
  return `<details class="history"><summary>Step 기록 <span>${currentIndex(task)}개 처리</span></summary><ol>${task.pieces.map((p, i) => `<li><div><strong>${i + 1} Step</strong><span>${names[p.status]}</span></div><p>${checklist(task, i).map((item, j) => `${p.done[j] ? '✓' : '○'} ${e(item.text)}`).join(' · ')}</p></li>`).join('')}</ol></details>`;
}
function timer(task, ui) {
  return `<details class="timer-panel" ${ui.timerOpen ? 'open' : ''}><summary>타이머 <span>${task.timer?.running ? '진행 중' : '선택'}</span></summary><div class="timer-modes">${['focus', 'break', 'off'].map((mode, i) => button('timer-mode', ['집중 25분', '휴식 5분', '끄기'][i], `timer-mode ${task.timer?.mode === mode ? 'selected' : ''}`, `data-mode="${mode}" aria-pressed="${task.timer?.mode === mode}"`)).join('')}</div>${task.timer?.mode !== 'off' ? `<div class="timer-display"><output id="timer-clock" aria-label="타이머 남은 시간">25:00</output>${button('timer-toggle', task.timer?.running ? icons.pause : icons.play, 'icon-button', `aria-label="타이머 ${task.timer?.running ? '일시정지' : '시작'}"`)}</div><div class="timer-bottom"><span id="timer-caption">시간은 가볍게 참고하세요.</span>${button('timer-reset', '다시', 'text-button')}</div>` : ''}</details>`;
}
export function focusView(state, ui) {
  const task = currentTask(state);
  const index = Math.min(currentIndex(task), task.pieces.length - 1);
  const p = task.pieces[index];
  const isReady = ready(task), isFinal = task.finalized;
  const items = checklist(task, index);
  const next = items.findIndex((_, i) => !p.done[i]);
  const allChecked = next < 0;
  const group = state.groups.find(g => g.id === task.groupId);
  const actions = items.map((item, i) => {
    const checked = !!p.done[i];
    return button('small-check', `<span class="action-number">${checked ? icons.check : e(item.number)}</span><span class="action-label">${e(item.text)}</span>${i === next && !isReady ? '<span class="next-hint">지금</span>' : ''}`, `action-button ${checked ? 'checked' : i === next && !isReady ? 'next' : ''} ${isReady ? 'settled' : ''}`, `data-index="${i}" aria-pressed="${checked}" ${isReady ? 'disabled' : ''}`);
  }).join('');
  return `<section class="focus-page"><nav class="focus-nav" aria-label="현재 작업 이동">${button('list', `${icons.back} 목록`, 'text-button')}${button('pause', `${icons.pause} 잠깐 중단`, 'text-button', isFinal ? 'hidden' : '')}</nav>
  <article class="focus-sheet ${isFinal ? 'is-final' : ''}" aria-label="현재 작업"><header class="task-header"><div><p class="eyebrow">${e(group?.name || '')} <span>／ ${TYPES[task.type]}</span></p><h1>${e(task.title)}</h1></div><div class="task-header-right"><span class="step-position" aria-label="Step 진행 위치">${position(task)}</span>${button('edit', icons.edit, 'icon-button', `data-id="${e(task.id)}" aria-label="현재 할 일 편집"`)}</div></header>
  ${task.finishText ? `<p class="finish-criterion"><span>끝 기준</span>${e(task.finishText)}</p>` : ''}
  <div class="quiet-progress" aria-hidden="true"><span style="width:${currentIndex(task) / task.pieces.length * 100}%"></span></div>
  ${task.resumeText && !isFinal ? `<div class="resume-note"><span>이어서 할 곳</span><p>${e(task.resumeText)}</p>${button('pause-note', icons.edit, 'icon-button', 'aria-label="이어갈 곳 수정"')}</div>` : ''}
  <div class="focus-grid"><section class="execution" aria-label="이번 Step"><div class="section-heading"><h2>${isFinal ? '해낸 행동' : isReady ? '마지막 Step까지 마쳤어요' : '지금 할 작은 행동'}</h2>${!isReady ? '<span>체크는 자유롭게</span>' : ''}</div><div class="action-list">${actions}</div>
  ${isFinal ? `<div class="completion"><span class="completion-symbol">${icons.check}</span><h2>하나, 해냈어요.</h2><p>이 할 일을 마쳤어요.</p><div class="completion-actions">${button('complete-new', `${icons.plus} 새 할 일`, 'button primary')}${button('complete-keep', '보관함에 두기', 'button secondary')}${button('complete-shelf', '끝낸 일로 치우기', 'text-button')}${button('delete', '삭제', 'text-button danger', `data-id="${e(task.id)}"`)}</div>${button('extend', '더 할 일이 생겼어요 · Step 추가', 'text-button')}</div>` : isReady ? `<div class="result-area final-ready"><p>할 일도 끝났다면</p>${button('finalize', `${icons.check} 완료`, 'button primary finish-button')}${button('extend', `${icons.plus} 아직 남았어요 · Step 추가`, 'text-button')}${button('undo-last', '마지막 Step 되돌리기', 'text-button quiet')}</div>` : `<div class="result-area">${button('step-success', `${icons.check} 이번 Step 마침`, `button ${allChecked ? 'primary' : 'secondary'} step-finish`)}<div class="result-secondary">${button('continue', '같은 일 더 이어서', 'text-button')}${button('blocked', '막혔어요', 'text-button')}</div></div>`}
  </section><aside class="support" aria-label="실행 메모와 보조 도구"><section class="memo-section"><div class="section-heading"><h2>메모</h2>${button('memo-edit', icons.edit, 'icon-button', 'aria-label="실행 메모 편집"')}</div><div class="memo-content" tabindex="0">${task.memoText ? renderMemo(task.memoText, !isFinal) : '<span class="memo-placeholder">다음에 볼 곳, 떠오른 생각을 남겨두세요.</span>'}</div></section>${!isFinal ? timer(task, ui) : ''}${history(task)}</aside></div>
  </article>
  <div class="below-focus">${button('library-toggle', `${ui.library ? '다른 할 일 접기' : '다른 할 일 보기'}<span class="chevron ${ui.library ? 'open' : ''}">${icons.chevron}</span>`, 'library-toggle', `aria-expanded="${ui.library}"`)}${ui.library ? `${button('capture-modal', `${icons.plus} 새 할 일`, 'text-button')} ${collection(state, ui, true)}` : ''}</div>
  </section>`;
}
export function editor(state, task, draft) {
  return `<form id="editor-form"><div class="modal-heading"><div><p class="eyebrow">TASK</p><h2 id="modal-title">할 일 편집</h2></div>${button('modal-close', icons.close, 'icon-button', 'aria-label="편집 닫기"')}</div>
    ${field('title', '제목', draft.title, '', 'required autocomplete="off"')}<label class="field"><span>메모</span><textarea id="edit-memo" name="memoText" rows="4" placeholder="이어갈 곳이나 기억할 것">${e(draft.memoText)}</textarea></label>${button('insert-token', '○ 체크 넣기', 'text-button', 'data-target="edit-memo"')}
    <label class="field group-field"><span>묶음</span><select name="groupId">${groupOptions(state, draft.groupId)}</select></label>
    <details class="settings-details"><summary>실행 설정 <span>${TYPES[Number(draft.type)]} · ${draft.count} Step</span></summary>${executionFields(draft, task)}</details>
    ${task.doneShelf ? button('unshelf', '보관함으로 꺼내기', 'button secondary', `data-id="${e(task.id)}"`) : ''}
    <div class="modal-footer">${button('delete', '삭제', 'text-button danger', `data-id="${e(task.id)}"`)}<div>${button('edit-cancel', '취소', 'button ghost')}<button class="button primary" type="submit">저장</button></div></div><p class="fine-print">닫으면 편집 초안이 남고, 취소하면 초안을 버려요.</p>
  </form>`;
}
