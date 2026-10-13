import{chromium}from"playwright";
const url=process.env.STEP_URL||"http://127.0.0.1:4174/";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on("pageerror",e=>errors.push(e.message));
await page.route("https://www.gstatic.com/firebasejs/**",async route=>{
 const u=route.request().url();let body="";
 if(u.endsWith("firebase-app.js"))body="export const initializeApp=()=>({});";
 if(u.endsWith("firebase-auth.js"))body='export const getAuth=()=>({});export const setPersistence=async()=>{};export const browserLocalPersistence={};export const signInWithEmailAndPassword=async()=>{};export const onAuthStateChanged=(x,fn)=>{fn({uid:"test-v7"});return()=>{}};export const signOut=async()=>{};';
 if(u.endsWith("firebase-firestore.js"))body='export const getFirestore=()=>({});export const doc=(...x)=>({path:x});export const serverTimestamp=()=>new Date();export const onSnapshot=(ref,fn)=>{const now=new Date(),date=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");fn({metadata:{fromCache:false,hasPendingWrites:false},exists:()=>true,data:()=>({revision:1,state:{schema:2,tasks:[],activeId:null,workspaceV6:{version:6,groups:[{id:"school",name:"학교"}],tasks:[{id:"old-v6",title:"기존 할 일",group:"school",memo:"원래 메모",resume:"3번 문제부터",review:date,planned:2,completed:0,phase:"paused",checks:[true,false,false]}],activeId:"old-v6"}}})});return()=>{}};export const runTransaction=async(db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>({revision:1,state:{schema:2,tasks:[],activeId:null,workspaceV6:{version:6,groups:[{id:"school",name:"학교"}],tasks:[{id:"old-v6",title:"기존 할 일",group:"school",memo:"원래 메모",resume:"3번 문제부터",planned:2,completed:0,phase:"paused",checks:[true,false,false]}],activeId:"old-v6"}}})}),set:()=>{}});';
 await route.fulfill({status:200,contentType:"application/javascript",headers:{"access-control-allow-origin":"*"},body});
});

await page.goto(new URL("app/board/",url).href,{waitUntil:"domcontentloaded"});
await page.waitForFunction(()=>document.querySelector('#syncGate')?.hidden===true);
await page.waitForFunction(()=>document.querySelector('.note-title')?.textContent.includes('기존 할 일'));
if(await page.locator('.rail,.sidebar').count())throw Error('Old narrow sidebar remains');
let original=await page.evaluate(()=>window.StepV7App.getState().tasks[0]);
if(original.title!=='기존 할 일'||original.memo!=='원래 메모'||original.checks[0]!==true)throw Error('V6 data conversion failed');
await page.locator('.note-open').first().click();
if(!await page.locator('.note.selected').count())throw Error('Selected task not visually expanded');
if(!await page.locator('.clock').count())throw Error('Focus timer missing from board');
if(await page.locator('#board').count()!==1)throw Error('Board is not one view');
await page.locator('.selected-title').fill('운영체제 정리');
await page.locator('.selected-title').press('Tab');
await page.waitForFunction(()=>window.StepV7App.getState().tasks[0].title==='운영체제 정리');
await page.locator('.memo').fill('한 번에 할 일을 적는다');
await page.locator('.editor-keys [data-act="editSave"]').click();
await page.waitForFunction(()=>window.StepV7App.getState().tasks[0].memo==='한 번에 할 일을 적는다');
await page.locator('[data-act="timeEdit"]').click();
if(!await page.locator('#timeMinutes').count())throw Error('Inline timer editing absent');
await page.locator('#timeMinutes').fill('20');
await page.locator('[data-act="timeSave"]').click();
if((await page.locator('.clock').textContent())!=='20:00')throw Error('Timer length not applied');
await page.locator('[data-act="timeToggle"]').click();
if(!(await page.evaluate(()=>JSON.parse(localStorage.getItem('step_board_timer_v1')).running)))throw Error('Timer failed to start');
await page.locator('[data-act="timeToggle"]').click();
if(await page.evaluate(()=>JSON.parse(localStorage.getItem('step_board_timer_v1')).running))throw Error('Timer did not pause');
await page.locator('[data-act="stepFinish"]').click();
const progress=await page.evaluate(()=>window.StepV7App.getState().tasks[0]);
if(progress.done||progress.doneSteps!==1)throw Error('Step completion must not finish whole task');
if(!await page.locator('.step-label').getByText('Step 2').count())throw Error('Next Step should be directly available');
await page.locator('[data-act="dateToggle"]').click();
await page.locator('.date-day').fill('2026-10-15');
await page.locator('.date-time').fill('15:30');
await page.locator('[data-act="dateSave"]').click();
const date=await page.evaluate(()=>window.StepV7App.getState().tasks[0].review);
if(date!=='2026-10-15T15:30')throw Error('Task date and time not saved');
await page.locator('.fold').click();
if(await page.locator('.note.selected').count())throw Error('X did not collapse the task');
const kept=await page.evaluate(()=>window.StepV7App.getState().tasks[0]);
if(kept.doneSteps!==1||kept.memo!=='한 번에 할 일을 적는다')throw Error('Closing task lost data');
await page.locator('#addButton').click();
if(!await page.locator('#newTitle').count())throw Error('Quick inline entry missing');
await page.locator('#newTitle').fill('새로운 할 일');
await page.locator('#newTitle').press('Enter');
if(!await page.locator('.note-title',{hasText:'새로운 할 일'}).count())throw Error('Task add failed');
await page.locator('.note-open').filter({hasText:'새로운 할 일'}).click();
await page.locator('.note.selected .check').click();
if((await page.evaluate(()=>window.StepV7App.getState().tasks.find(t=>t.title==='새로운 할 일').done))!==true)throw Error('Task completion failed');
await page.locator('#doneToggle').click();
if(!await page.locator('#doneBoard .note.completed').count())throw Error('Completed list not available');
await page.locator('#doneBoard .check').click();
if((await page.evaluate(()=>window.StepV7App.getState().tasks.find(t=>t.title==='새로운 할 일').done))!==false)throw Error('Undo completion failed');
for(const [w,h] of [[320,690],[390,844],[430,932],[768,1024],[820,1100],[1024,768],[1366,900]]){
 await page.setViewportSize({width:w,height:h});
 const dims=await page.evaluate(()=>({
  x:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  b:document.body.scrollWidth-document.body.clientWidth
 }));
 if(dims.x>1||dims.b>1)throw Error(w+' horizontal overflow '+JSON.stringify(dims));
}
if(errors.length)throw Error('Browser JS errors '+errors.join(' ; '));
await browser.close();
console.log('Step board: selection, editing, Step, timer, dates, completion, undo and 7 layouts passed');
