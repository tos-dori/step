import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.js';
import {LocalStore, STORAGE_KEY, PREFIX} from '../src/storage.js';
import {exportBackup, parseBackup, mergeBackup, asStored} from '../src/backup.js';
import {focusView, editor} from '../src/view.js';
import {toggleToken, renderMemo} from '../src/memo.js';
function fixture(count = 2, changes = {}) {
  const state = M.initialState();
  const task = M.addTask(state, {...M.emptyDraft(), title: '회로 예제 풀기', memoText: '○1 예제 4\n●A 식 확인', startText: 'p.37 예제 4', count, ...changes});
  M.activate(state, task.id); return {state, task};
}
class Storage {
  map = new Map(); writes = []; fail = null;
  getItem(key) {return this.map.get(key) ?? null;}
  setItem(key, value) {if (key === this.fail) throw Error('QuotaExceededError'); this.writes.push(key); this.map.set(key, String(value));}
}
const ui = {library: false, timerOpen: false};
test('pause, reload, resume preserve exact checks, memo, timer and Step count', () => {
  const {state, task} = fixture(); task.pieces[0].done = [true, false, true];
  task.timer = {mode:'focus', elapsed:1200, running:true, startedAt:Date.now()-3000};
  M.pause(state, '두 번째 식부터');
  assert.equal(state.activeId, null); assert.equal(task.pieces.length, 2); assert.equal(task.timer.running, false); assert.ok(task.timer.elapsed >= 4200);
  const reloaded = M.validateState(JSON.parse(JSON.stringify(state))); M.activate(reloaded, task.id);
  const resumed = M.currentTask(reloaded);
  assert.deepEqual(resumed.pieces[0].done, [true,false,true]); assert.equal(resumed.memoText,task.memoText); assert.equal(resumed.resumeText,'두 번째 식부터'); assert.equal(M.position(resumed),'1/2');
});
test('last Step stays 2/2, never finalizes or invents checks; final action is explicit', () => {
  const {state, task} = fixture(); M.completeStep(task); task.pieces[1].done=[true,false,false]; M.completeStep(task);
  assert.equal(M.ready(task),true); assert.equal(M.position(task),'2/2'); assert.equal(task.finalized,false);
  const html=focusView(state,ui);
  assert.equal((html.match(/data-action="small-check"[^>]*aria-pressed="true"/g)||[]).length,1);
  assert.equal((html.match(/data-action="small-check"[^>]*aria-pressed="false"/g)||[]).length,2);
  assert.match(html,/data-action="finalize"/);
  M.finalize(task); assert.equal(task.finalized,true); assert.deepEqual(task.pieces[1].done,[true,false,false]);
  for(const a of ['complete-new','complete-keep','complete-shelf','delete']) assert.ok(focusView(state,ui).includes(`data-action="${a}"`));
});
test('single Step always displays 1/1 and unfinished work cannot finalize', () => {
  const {state,task}=fixture(1); assert.equal(M.position(task),'1/1'); assert.match(focusView(state,ui),/>1\/1</); assert.throws(()=>M.finalize(task));
});
test('optional checking, continuation and blockage keep prior flags and clear intent',()=>{
  const {task}=fixture(1); task.pieces[0].done=[false,true,false]; M.completeStep(task,'incomplete','문제 3부터');
  assert.equal(task.pieces.length,2); assert.equal(task.pieces[0].status,'incomplete'); assert.deepEqual(task.pieces[0].done,[false,true,false]);
  M.completeStep(task,'blocked','예제 하나 찾아보기'); assert.equal(task.pieces.length,3); assert.equal(task.pieces[2].kind,'blocked'); assert.equal(M.checklist(task)[0].text,'예제 하나 찾아보기');
});
test('extending completed task retains history and opens a new pending Step',()=>{
  const {task}=fixture(1); task.pieces[0].done=[true,true,false]; M.completeStep(task); M.finalize(task); const old=M.clone(task.pieces[0]); M.extend(task);
  assert.deepEqual(task.pieces[0],old); assert.equal(task.finalized,false); assert.equal(M.position(task),'2/2');
});
test('more than six Steps editable, resizing never erases progress',()=>{
  const {state,task}=fixture(8); assert.match(editor(state,task,task),/name="count" value="8"/); M.resizePieces(task,9); task.pieces[8].done[0]=true;
  assert.throws(()=>M.resizePieces(task,8)); assert.equal(task.pieces.length,9); task.pieces[8].done[0]=false; M.resizePieces(task,8); assert.equal(task.pieces.length,8);
});
test('group deletion moves tasks and drafts, arbitrary group count survives reload',()=>{
  const {state,task}=fixture(); state.groups.push({id:'later',name:'나중',collapsed:true}); state.editorDraft={...M.clone(task),groupId:'inbox'};
  M.deleteGroup(state,'inbox','later'); assert.equal(task.groupId,'later'); assert.equal(state.draft.groupId,'later'); assert.equal(state.editorDraft.groupId,'later');
  for(let i=0;i<45;i++) state.groups.push({id:`g${i}`,name:`묶음 ${i}`}); assert.equal(M.validateState(state).groups.length,46); assert.equal(M.addTask(state,{...state.draft,title:'새 일'}).groupId,'later');
});
test('reordering stays in group and preserves unsaved editor draft',()=>{
  const {state,task}=fixture(); state.groups.push({id:'other',name:'다른 묶음'}); const other=M.addTask(state,{...M.emptyDraft('other'),title:'다른 일'}); const last=M.addTask(state,{...M.emptyDraft(),title:'마지막'});
  state.editorDraft={...task,title:'저장하지 않은 제목'}; M.moveWithinGroup(state,last.id,-1); assert.deepEqual(state.tasks.map(t=>t.id),[last.id,other.id,task.id]); assert.equal(state.editorDraft.title,'저장하지 않은 제목');
});
test('legacy backup retains task IDs, memo tokens, prep flags and old completion rule',()=>{
  const {state,task}=fixture(1,{prep:true}); task.pieces[0].done=[true,false,true,false]; task.pieces[0].status='success'; delete task.finalized;
  const imported=parseBackup(JSON.stringify({tag:'STEP_BACKUP_V1',app:'step',schema:1,storageKey:'step_live_v1',state}));
  assert.equal(imported.tasks[0].id,task.id); assert.deepEqual(imported.tasks[0].pieces[0].done,task.pieces[0].done); assert.equal(imported.tasks[0].memoText,task.memoText); assert.equal(imported.tasks[0].finalized,true);
});
test('local and v0.6.60 backup roundtrips preserve explicit pending finalization',()=>{
  const {state,task}=fixture(); M.completeStep(task); M.completeStep(task); state.groups.push({id:'project',name:'장기 프로젝트',collapsed:true}); task.groupId='project';
  const imported=parseBackup(exportBackup(state)); assert.equal(imported.tasks[0].finalized,false); assert.equal(imported.tasks[0].groupId,'project'); assert.deepEqual(imported.groups,state.groups);
  const legacy=parseBackup(JSON.stringify({tag:'STEP_BACKUP_V1',app:'step',schema:1,storageKey:'step_live_v1',state})); assert.equal(legacy.tasks[0].finalized,false);
});
test('same-ID import never overwrites an existing task silently',()=>{
  const {state,task}=fixture(); const incoming=M.clone(state); incoming.tasks[0].memoText='다른 기기 메모'; const result=mergeBackup(state,incoming);
  assert.equal(result.skipped,1); assert.equal(result.added,0); assert.equal(state.tasks[0].memoText,task.memoText);
});
test('malformed or foreign backups are rejected',()=>{
  assert.throws(()=>parseBackup('{')); assert.throws(()=>parseBackup('{"state":{"tasks":[]}}')); const {state}=fixture(); state.tasks[0].pieces[0].status='unknown'; assert.throws(()=>M.validateState(state));
});
test('all writes use independent namespace, leaving original data and recovery untouched',()=>{
  const storage=new Storage(); storage.map.set('step_live_v1','original private task data'); storage.map.set('step_checkpoint_v2_0','original recovery');
  const store=new LocalStore(storage); store.commit(s=>M.addTask(s,{...M.emptyDraft(),title:'새 앱'})); store.commit(s=>{s.tasks[0].title='수정';});
  assert.equal(storage.getItem('step_live_v1'),'original private task data'); assert.equal(storage.getItem('step_checkpoint_v2_0'),'original recovery'); assert.ok(storage.writes.every(k=>k.startsWith(`${PREFIX}:`))); assert.equal(new LocalStore(storage).state.tasks[0].title,'수정');
});
test('main write failure retains both previous data and working state',()=>{
  const storage=new Storage(),store=new LocalStore(storage); store.commit(s=>M.addTask(s,{...M.emptyDraft(),title:'남길 일'})); const raw=store.raw; storage.fail=STORAGE_KEY;
  assert.throws(()=>store.commit(s=>{s.tasks=[];})); assert.equal(store.state.tasks.length,1); assert.equal(storage.getItem(STORAGE_KEY),raw);
});
test('recovery write failure blocks destructive mutation before main write',()=>{
  const storage=new Storage(),store=new LocalStore(storage); store.commit(s=>M.addTask(s,{...M.emptyDraft(),title:'남길 일'})); const raw=store.raw; storage.fail=`${PREFIX}:recovery`;
  assert.throws(()=>store.commit(s=>{s.tasks=[];})); assert.equal(storage.getItem(STORAGE_KEY),raw); assert.equal(store.state.tasks.length,1);
});
test('corrupt stored bytes remain untouched; explicit recovery preserves original bytes',()=>{
  const storage=new Storage(); storage.map.set(STORAGE_KEY,'{broken'); const store=new LocalStore(storage); assert.equal(store.blocked,true); assert.throws(()=>store.commit(s=>{s.tasks=[];})); assert.equal(storage.getItem(STORAGE_KEY),'{broken');
  const {state}=fixture(); store.restore(asStored(state)); assert.equal(storage.getItem(`${PREFIX}:before-restore`),'{broken'); assert.equal(store.state.tasks.length,1);
});
test('stale tabs cannot overwrite a newer save',()=>{
  const storage=new Storage(),a=new LocalStore(storage),b=new LocalStore(storage); a.commit(s=>M.addTask(s,{...M.emptyDraft(),title:'새 내용'})); const newer=storage.getItem(STORAGE_KEY);
  assert.throws(()=>b.commit(s=>{s.draft.title='이전 창 수정';})); assert.equal(storage.getItem(STORAGE_KEY),newer);
});
test('memo token offsets, labels, linebreaks and HTML escaping remain correct',()=>{
  const text='○1 회로\n●A 검토 <script>alert(1)</script>',changed=toggleToken(text,0); assert.equal(changed,'●1 회로\n●A 검토 <script>alert(1)</script>');
  const html=renderMemo(changed); assert.match(html,/data-index="0"/); assert.match(html,/aria-pressed="true"/); assert.ok(!html.includes('<script>')); assert.match(html,/&lt;script&gt;/);
});
