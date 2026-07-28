import { chromium } from 'playwright';

const url = process.env.STEP_URL || 'http://127.0.0.1:4174/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
const badLocalResponses = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', (response) => {
  if (response.url().startsWith(url) && response.status() >= 400) badLocalResponses.push(`${response.status()} ${response.url()}`);
});
page.route('https://www.gstatic.com/**', (route) => route.abort());

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.documentElement.dataset.stepCoreLoaded === 'true', null, { timeout: 20000 });

const result = await page.evaluate(() => {
  document.body.classList.remove('sync-locked');
  const gate = document.getElementById('syncGate');
  if (gate) gate.hidden = true;

  state = baseState();
  state.screen = 'add';
  state.draft = '구조 검수';
  state.memoText = '○A 확인\n다음 시작점';
  state.count = 2;
  renderAll();
  syncInputs();
  document.getElementById('addBtn').click();

  const created = activeTask();
  const token = document.querySelector('[data-memo-token]');
  if (token) token.click();
  toggleTimer();
  const timerStarted = state.timer.running;
  toggleTimer();
  const timerStopped = !state.timer.running;

  state.tasks[0].title = '복구 전 상태';
  saveState('smoke-snapshot');
  state.tasks[0].title = '복구 대상 상태';
  saveState('smoke-snapshot');
  localStorage.setItem(KEY, '{broken');

  return {
    version: APP_VERSION,
    versionText: document.getElementById('versionTap')?.textContent,
    key: KEY,
    moduleCount: document.querySelectorAll('script[data-step-module]').length,
    stylesheetLoaded: Array.from(document.styleSheets).some((sheet) => sheet.href?.endsWith('/styles/app.css')),
    bridgeReady: typeof window.StepSyncApp?.getCloudState === 'function',
    taskCreated: !!created && created.title === '복구 대상 상태' && state.tasks.length === 1,
    memoToggled: !!created && created.memoText.startsWith('●A'),
    timerStarted,
    timerStopped,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  };
});

if (result.version !== '0.6.59' || result.versionText !== 'v0.6.59') throw new Error(`Unexpected version: ${JSON.stringify(result)}`);
if (result.key !== 'step_live_v1') throw new Error(`Storage key changed: ${result.key}`);
if (result.moduleCount !== 16) throw new Error(`Unexpected module count: ${result.moduleCount}`);
if (!result.stylesheetLoaded || !result.bridgeReady) throw new Error(`Core resources unavailable: ${JSON.stringify(result)}`);
if (!result.taskCreated || !result.memoToggled || !result.timerStarted || !result.timerStopped) throw new Error(`Core flow failed: ${JSON.stringify(result)}`);
if (result.horizontalOverflow) throw new Error('Unexpected horizontal overflow at 390px');

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.documentElement.dataset.stepCoreLoaded === 'true', null, { timeout: 20000 });
const recovery = await page.evaluate(() => ({
  title: state.tasks[0]?.title,
  safe: window.StepDataSafety?.isSafe(),
  issue: window.StepDataSafety?.issue()
}));
if (recovery.title !== '복구 전 상태' || !recovery.safe || !String(recovery.issue).includes('자동 복구본')) {
  throw new Error(`Local recovery failed: ${JSON.stringify(recovery)}`);
}

if (badLocalResponses.length) throw new Error(`Local resource errors: ${badLocalResponses.join(', ')}`);
const fatalErrors = pageErrors.filter((message) => /ReferenceError|SyntaxError/.test(message));
if (fatalErrors.length) throw new Error(`Runtime errors: ${fatalErrors.join(' | ')}`);

await page.screenshot({ path: '/tmp/step-v0659-smoke.png', fullPage: true });
await browser.close();
