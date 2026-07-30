import { chromium } from 'playwright';

const url = process.env.STEP_URL || 'http://127.0.0.1:4174/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route('https://www.gstatic.com/**', (route) => route.abort());
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.documentElement.dataset.stepCoreLoaded === 'true', null, { timeout: 20000 });

await page.evaluate(async () => {
  document.body.classList.remove('sync-locked');
  document.getElementById('syncGate').hidden = true;
  const popover = document.getElementById('syncPopover');
  popover.innerHTML = '<button id="syncRecoveryBtn">복구본</button><button id="syncHiddenLogoutBtn">로그아웃</button>';
  popover.hidden = false;
  await import(`./src/sync/management-menu.js?browser-test=${Date.now()}`);
});
await page.waitForSelector('.management-menu-head');

const root = await page.evaluate(() => {
  const popover = document.getElementById('syncPopover');
  const trigger = document.getElementById('versionTap');
  const section = document.querySelector('.management-menu-section');
  return {
    labels: Array.from(popover.querySelectorAll('.management-menu-actions button')).map((button) => button.textContent.trim()),
    title: popover.querySelector('.management-menu-head strong')?.textContent.trim(),
    version: popover.querySelector('.management-menu-head span')?.textContent.trim(),
    status: popover.querySelector('.management-menu-status')?.textContent.trim(),
    importHidden: section?.hidden,
    triggerPosition: getComputedStyle(trigger).position,
    triggerFontSize: getComputedStyle(trigger).fontSize,
    titleRole: document.querySelector('.brand-title')?.getAttribute('role'),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  };
});
if (JSON.stringify(root.labels) !== JSON.stringify(['복구본', '내보내기', '가져오기', '로그아웃'])) throw new Error(`Wrong menu actions: ${JSON.stringify(root)}`);
if (root.title !== 'Step!' || root.version !== 'v0.6.59' || !root.status.includes('저장 정상')) throw new Error(`Wrong menu header: ${JSON.stringify(root)}`);
if (!root.importHidden || root.triggerPosition !== 'absolute' || root.triggerFontSize !== '0px' || root.titleRole !== 'button' || root.horizontalOverflow) throw new Error(`Wrong menu layout: ${JSON.stringify(root)}`);

await page.click('.management-menu-actions button:nth-child(3)');
const importMode = await page.evaluate(() => {
  const payload = {
    tag: 'STEP_BACKUP_V1',
    app: 'step',
    schema: 1,
    storageKey: window.StepSyncApp.key(),
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    state: window.StepSyncApp.getCloudState()
  };
  const input = document.querySelector('.management-menu-input');
  input.value = JSON.stringify(payload);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return {
    hidden: document.querySelector('.management-menu-section').hidden,
    confirmDisabled: document.querySelector('.management-menu-confirm').disabled,
    mode: document.getElementById('syncPopover').dataset.menuMode
  };
});
if (importMode.hidden || importMode.confirmDisabled || importMode.mode !== 'import') throw new Error(`Import mode failed: ${JSON.stringify(importMode)}`);

const fatal = errors.filter((message) => /ReferenceError|SyntaxError/.test(message));
if (fatal.length) throw new Error(`Runtime errors: ${fatal.join(' | ')}`);
await browser.close();
