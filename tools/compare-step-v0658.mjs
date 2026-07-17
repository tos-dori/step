import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';

const baselineUrl = process.env.BASELINE_URL || 'http://127.0.0.1:4173/';
const candidateUrl = process.env.CANDIDATE_URL || 'http://127.0.0.1:4174/';
const browser = await chromium.launch({ headless: true });

async function capture(url, mode, output) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('https://www.gstatic.com/**', (route) => route.abort());
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderAll === 'function' && typeof window.baseState === 'function', null, { timeout: 20000 });
  await page.waitForFunction(() => document.styleSheets.length > 0, null, { timeout: 10000 });
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  await page.evaluate((screenMode) => {
    document.body.classList.remove('sync-locked');
    const gate = document.getElementById('syncGate');
    const popover = document.getElementById('syncPopover');
    const card = document.getElementById('syncCard');
    if (gate) gate.hidden = true;
    if (popover) popover.hidden = true;
    if (card) card.hidden = true;
    const version = document.getElementById('versionTap');
    if (version) version.textContent = 'vTEST';
    state = baseState();
    if (screenMode === 'add') {
      state.screen = 'add';
      state.draft = '회로 과제 3번 풀기';
      state.memoText = '○1 공식 확인\n○2 풀이 이어가기';
      state.count = 3;
      state.type = TYPE.ASSIGNMENT;
      state.addSettingsOpen = true;
    } else {
      state.screen = 'do';
    }
    renderAll();
    syncInputs();
    window.scrollTo(0, 0);
  }, mode);
  await page.evaluate(() => document.fonts?.ready);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(120);
  await page.screenshot({ path: output, fullPage: true });
  const fatal = pageErrors.filter((message) => /ReferenceError|SyntaxError/.test(message));
  if (fatal.length) throw new Error(`${url} runtime errors: ${fatal.join(' | ')}`);
  await page.close();
}

function compare(leftPath, rightPath, diffPath) {
  const left = PNG.sync.read(fs.readFileSync(leftPath));
  const right = PNG.sync.read(fs.readFileSync(rightPath));
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error(`Screenshot dimensions differ: ${left.width}x${left.height} vs ${right.width}x${right.height}`);
  }
  const diff = new PNG({ width: left.width, height: left.height });
  const changed = pixelmatch(left.data, right.data, diff.data, left.width, left.height, { threshold: 0.1 });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  const ratio = changed / (left.width * left.height);
  console.log(`${leftPath} changed=${changed} ratio=${ratio}`);
  if (ratio > 0.0005) throw new Error(`Visual diff ratio ${ratio} exceeded 0.0005 for ${leftPath}`);
  return ratio;
}

for (const mode of ['do', 'add']) {
  const baselinePath = `/tmp/step-baseline-${mode}.png`;
  const candidatePath = `/tmp/step-candidate-${mode}.png`;
  const diffPath = `/tmp/step-diff-${mode}.png`;
  await capture(baselineUrl, mode, baselinePath);
  await capture(candidateUrl, mode, candidatePath);
  const ratio = compare(baselinePath, candidatePath, diffPath);
  console.log(`${mode} visual diff ratio=${ratio}`);
}

await browser.close();
