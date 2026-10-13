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
await page.goto(new URL("app/v7/",url).href,{waitUntil:"domcontentloaded"});
await page.waitForFunction(()=>document.querySelector("#syncGate")?.hidden===true);
await page.waitForFunction(()=>document.querySelector(".now-card")?.textContent.includes("기존 할 일"));
const values=await page.evaluate(()=>({task:window.StepV7App.getState().tasks[0],scroll:getComputedStyle(document.querySelector("#listScroll")).overscrollBehavior,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
if(values.task.title!=="기존 할 일"||values.task.cue!=="3번 문제부터"||!values.task.checks[0])throw Error("Legacy V6 import lost fields: "+JSON.stringify(values));
if(values.overflow||values.scroll!=="none")throw Error("Bad mobile layout: "+JSON.stringify(values));
await page.locator(".now-card").click();
if(!await page.locator('[data-action="stepFinish"]').count())throw Error("Run page missing Step finish action");
await page.locator('[data-action="pause"]').click();
await page.locator(".now-card").click();
const resumed=await page.evaluate(()=>window.StepV7App.getState().tasks[0]);
if(resumed.phase!=="running"||!resumed.checks[0])throw Error("Paused Step did not resume");
await page.locator('[data-action="stepFinish"]').click();
const finished=await page.evaluate(()=>window.StepV7App.getState().tasks[0]);
if(finished.done||finished.doneSteps!==1)throw Error("Step finish wrongly finalized task");
// Direct content editing never opens a modal and only ✓ commits.
await page.locator('[data-action="open"][data-id="old-v6"]').click();
const title=page.locator('#workContent input[data-inline="title"]');
await title.click();
if(await title.getAttribute('readonly')!==null)throw Error('Title tap did not enable editing');
await title.fill('수정한 할 일');
await page.locator('.inline-field[data-field="title"] [data-action="fieldSave"]').click();
if((await page.evaluate(()=>window.StepV7App.getState().tasks[0].title))!=='수정한 할 일')throw Error('Inline title not persisted');
await page.locator('#workContent textarea[data-inline="memo"]').click();
await page.locator('#workContent textarea[data-inline="memo"]').fill('사용자가 직접 쓴 긴 메모가 그대로 유지되어야 한다.');
await page.locator('.inline-field[data-field="memo"] [data-action="fieldSave"]').click();
if(!(await page.evaluate(()=>window.StepV7App.getState().tasks[0].memo)).includes('긴 메모'))throw Error('Inline memo not persisted');
// In-place date and optional time, no secondary dialog.
await page.locator('[data-action="editDate"][data-key="review"]').click();
await page.locator('.date-inline[data-key="review"] .date-hour').fill('15:30');
await page.locator('.date-inline[data-key="review"] [data-action="dateApply"]').click();
if(!(await page.evaluate(()=>window.StepV7App.getState().tasks[0].review)).endsWith('T15:30'))throw Error('Date time was not saved');
await page.locator('#workContent [data-action="close"]').click();
await page.locator('#listContent [data-action="add"]').first().click();
if(await page.locator('#modal:visible').count())throw Error('Add unexpectedly opened a modal');
await page.locator('#quickTitle').fill('추가한 할 일');
await page.locator('#quickTitle').press('Enter');
if(!await page.locator('#listContent .task-name', {hasText:'추가한 할 일'}).count())throw Error('Inline quick entry failed');
for(const width of [320,375,390,430]){
 await page.setViewportSize({width,height:844});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
 if(overflow)throw Error(width+'px horizontal overflow');
}

await page.setViewportSize({width:820,height:1100});
if(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth))throw Error("iPad horizontal overflow");
await page.setViewportSize({width:1366,height:880});
if(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth))throw Error("Mac horizontal overflow");
if(errors.length)throw Error("Browser errors: "+errors.join(" | "));
console.log("Step v7: legacy import, state machine and responsive layout OK");
await browser.close();
