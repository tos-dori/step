const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const htmlPath = 'index.html';
const originalHtml = fs.readFileSync(htmlPath, 'utf8');
const styleMatches = [...originalHtml.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)];
const scriptMatches = [...originalHtml.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];

if (styleMatches.length !== 1) throw new Error(`Expected one inline style block, found ${styleMatches.length}`);
const appMatch = scriptMatches.find((match) => /\bvar\s+KEY\s*=\s*["']step_live_v1["']/.test(match[2] || ''));
const syncMatch = scriptMatches.find((match) => /\btype\s*=\s*["']module["']/.test(match[1] || '') && /StepSyncBridge/.test(match[2] || ''));
if (!appMatch) throw new Error('Inline Step app script was not found');
if (!syncMatch) throw new Error('Inline Firebase sync module was not found');

const styleSource = styleMatches[0][1].replace(/^\n/, '').replace(/\s+$/, '') + '\n';
const appSource = appMatch[2];
const syncSource = syncMatch[2].replace(/^\n/, '').replace(/\s+$/, '') + '\n';
const ast = acorn.parse(appSource, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
const nodes = ast.body;
if (nodes.length !== 201) throw new Error(`Unexpected app top-level node count: ${nodes.length}`);

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function numbers(start, end) { return Array.from({ length: end - start + 1 }, (_, i) => start + i); }
function segment(oneBasedIndex) {
  const index = oneBasedIndex - 1;
  const start = nodes[index].start;
  const end = index + 1 < nodes.length ? nodes[index + 1].start : appSource.length;
  return appSource.slice(start, end);
}
function moduleText(indices, prefix = '') {
  return prefix + indices.map(segment).join('').replace(/^\n+/, '').replace(/\s+$/, '') + '\n';
}
function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content);
}

const sections = {
  'src/config.js': numbers(1, 15),
  'src/dom.js': numbers(25, 27),
  'src/state.js': [...numbers(28, 60), ...numbers(16, 24)],
  'src/feedback.js': numbers(61, 64),
  'src/task-model.js': numbers(65, 77),
  'src/memo.js': numbers(78, 90),
  'src/step-flow.js': numbers(91, 109),
  'src/timer.js': numbers(110, 122),
  'src/task-actions.js': numbers(123, 139),
  'src/editor.js': numbers(140, 149),
  'src/render.js': numbers(150, 185),
  'src/library.js': numbers(186, 191),
  'src/events.js': numbers(192, 195),
  'src/bridge.js': [196],
  'src/bootstrap.js': numbers(197, 201)
};

const assigned = Object.values(sections).flat();
const expected = numbers(1, nodes.length);
if (assigned.length !== expected.length || new Set(assigned).size !== expected.length || expected.some((value) => !assigned.includes(value))) {
  throw new Error('Module assignment does not cover every original statement exactly once');
}

const leading = appSource.slice(0, nodes[0].start);
write('src/config.js', moduleText(sections['src/config.js'], `${leading}var APP_VERSION="0.6.58";\n`));
for (const [file, indices] of Object.entries(sections)) {
  if (file === 'src/config.js' || file === 'src/bootstrap.js') continue;
  write(file, moduleText(indices));
}
write('src/bootstrap.js', `if(byId("versionTap"))byId("versionTap").textContent="v"+APP_VERSION;\n${moduleText(sections['src/bootstrap.js'])}`);
write('src/sync/firebase.js', syncSource);
write('styles/app.css', styleSource);

const classicModules = [
  'config.js',
  'dom.js',
  'state.js',
  'feedback.js',
  'task-model.js',
  'memo.js',
  'step-flow.js',
  'timer.js',
  'task-actions.js',
  'editor.js',
  'render.js',
  'library.js',
  'events.js',
  'bridge.js',
  'bootstrap.js'
];

write('src/app.js', `(() => {\n  const loaderScript = document.currentScript;\n  const baseUrl = new URL('./', loaderScript.src);\n  const classicModules = ${JSON.stringify(classicModules, null, 2)};\n\n  function loadClassicScript(relativePath) {\n    return new Promise((resolve, reject) => {\n      const script = document.createElement('script');\n      script.src = new URL(relativePath, baseUrl).href;\n      script.async = false;\n      script.dataset.stepModule = relativePath;\n      script.addEventListener('load', resolve, { once: true });\n      script.addEventListener('error', () => reject(new Error(\`Failed to load \${relativePath}\`)), { once: true });\n      document.head.appendChild(script);\n    });\n  }\n\n  (async () => {\n    for (const file of classicModules) await loadClassicScript(file);\n    document.documentElement.dataset.stepCoreLoaded = 'true';\n    try {\n      await import(new URL('sync/firebase.js', baseUrl).href);\n      document.documentElement.dataset.stepSyncLoaded = 'true';\n    } catch (error) {\n      document.documentElement.dataset.stepSyncLoaded = 'false';\n      console.error('[Step] Firebase sync module failed to load', error);\n    }\n    document.documentElement.dataset.stepAppLoaded = 'true';\n  })().catch((error) => {\n    console.error('[Step] core module load failed', error);\n    const gate = document.getElementById('syncGate');\n    if (gate) gate.innerHTML = '<div class="sync-gate-card"><p class="sync-gate-title">앱을 불러오지 못했어요.</p><p class="sync-gate-subtitle">새로고침해 주세요.</p></div>';\n  });\n})();\n`);

let nextHtml = originalHtml;
nextHtml = nextHtml.replace(styleMatches[0][0], '  <link rel="stylesheet" href="./styles/app.css" />');
nextHtml = nextHtml.replace(appMatch[0], '  <script src="./src/app.js"></script>');
nextHtml = nextHtml.replace(syncMatch[0], '');
nextHtml = nextHtml.replace(/(<span\s+class="version"\s+id="versionTap">)[^<]*(<\/span>)/, '$1$2');
fs.writeFileSync(htmlPath, nextHtml);

const architecture = `# Step architecture\n\n## Stable entry files\n- \`index.html\`: fixed DOM shell, PWA/icon links, one stylesheet link, and the app loader only. Normal feature patches should not modify it.\n- \`site.webmanifest\`: PWA metadata.\n- \`styles/app.css\`: the complete current visual cascade, extracted byte-for-byte from the former inline style block. CSS cleanup is intentionally separate from this structural refactor.\n- \`src/app.js\`: ordered loader for classic app modules, followed by the Firebase sync module.\n\n## JavaScript responsibilities\n- \`src/config.js\`: app version, storage key, task/status/timer constants.\n- \`src/dom.js\`: fixed DOM references and selector helpers.\n- \`src/state.js\`: base state, local persistence, normalization, cloud-state conversion, shared utilities, and runtime variables.\n- \`src/feedback.js\`: toast, celebration, textarea auto-grow.\n- \`src/task-model.js\`: task lookup, status calculation, type metadata.\n- \`src/memo.js\`: memo guides, Unicode check tokens, memo editing and token toggling.\n- \`src/step-flow.js\`: checklist wording, piece kinds, Step construction.\n- \`src/timer.js\`: focus/break timer state, rendering and hold behavior.\n- \`src/task-actions.js\`: create, select, progress, put away, done-shelf and delete actions.\n- \`src/editor.js\`: edit drafts and edit-time Step count changes.\n- \`src/render.js\`: current/add/done/editor rendering and current-card bindings.\n- \`src/library.js\`: library and finished-task list rendering.\n- \`src/events.js\`: static input, button and hold-event bindings.\n- \`src/bridge.js\`: stable \`window.StepSyncApp\` interface exposed to synchronization.\n- \`src/bootstrap.js\`: visible version and final startup calls.\n- \`src/sync/firebase.js\`: Firebase Auth, Firestore synchronization, conflict handling, and \`window.StepSyncBridge\`.\n\n## Invariants\n- Keep storage key \`step_live_v1\` unchanged.\n- Keep both \`window.StepSyncApp\` and \`window.StepSyncBridge\` contracts unchanged.\n- Keep the module order in \`src/app.js\` unless dependency testing proves a change is safe.\n- Do not move bootstrap calls ahead of bridge creation.\n- Do not combine structural refactoring with UX, copy, timer, task-model, or CSS-result changes.\n- Routine patches should touch only the responsible source file; visual patches should normally touch only \`styles/app.css\`.\n`;
write('ARCHITECTURE.md', architecture);

const smoke = `import { chromium } from 'playwright';\n\nconst url = process.env.STEP_URL || 'http://127.0.0.1:4174/';\nconst browser = await chromium.launch({ headless: true });\nconst page = await browser.newPage({ viewport: { width: 390, height: 844 } });\nconst pageErrors = [];\nconst badLocalResponses = [];\n\npage.on('pageerror', (error) => pageErrors.push(error.message));\npage.on('response', (response) => {\n  if (response.url().startsWith(url) && response.status() >= 400) badLocalResponses.push(\`\${response.status()} \${response.url()}\`);\n});\npage.route('https://www.gstatic.com/**', (route) => route.abort());\n\nawait page.goto(url, { waitUntil: 'domcontentloaded' });\nawait page.waitForFunction(() => document.documentElement.dataset.stepCoreLoaded === 'true', null, { timeout: 20000 });\n\nconst result = await page.evaluate(() => {\n  document.body.classList.remove('sync-locked');\n  const gate = document.getElementById('syncGate');\n  if (gate) gate.hidden = true;\n\n  state = baseState();\n  state.screen = 'add';\n  state.draft = '구조 검수';\n  state.memoText = '○A 확인\\n다음 시작점';\n  state.count = 2;\n  renderAll();\n  syncInputs();\n  document.getElementById('addBtn').click();\n\n  const created = activeTask();\n  const token = document.querySelector('[data-memo-token]');\n  if (token) token.click();\n  toggleTimer();\n  const timerStarted = state.timer.running;\n  toggleTimer();\n  const timerStopped = !state.timer.running;\n\n  return {\n    version: APP_VERSION,\n    versionText: document.getElementById('versionTap')?.textContent,\n    key: KEY,\n    moduleCount: document.querySelectorAll('script[data-step-module]').length,\n    stylesheetLoaded: Array.from(document.styleSheets).some((sheet) => sheet.href?.endsWith('/styles/app.css')),\n    bridgeReady: typeof window.StepSyncApp?.getCloudState === 'function',\n    taskCreated: !!created && created.title === '구조 검수' && state.tasks.length === 1,\n    memoToggled: !!created && created.memoText.startsWith('●A'),\n    timerStarted,\n    timerStopped,\n    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth\n  };\n});\n\nif (result.version !== '0.6.58' || result.versionText !== 'v0.6.58') throw new Error(\`Unexpected version: \${JSON.stringify(result)}\`);\nif (result.key !== 'step_live_v1') throw new Error(\`Storage key changed: \${result.key}\`);\nif (result.moduleCount !== 15) throw new Error(\`Unexpected module count: \${result.moduleCount}\`);\nif (!result.stylesheetLoaded || !result.bridgeReady) throw new Error(\`Core resources unavailable: \${JSON.stringify(result)}\`);\nif (!result.taskCreated || !result.memoToggled || !result.timerStarted || !result.timerStopped) throw new Error(\`Core flow failed: \${JSON.stringify(result)}\`);\nif (result.horizontalOverflow) throw new Error('Unexpected horizontal overflow at 390px');\nif (badLocalResponses.length) throw new Error(\`Local resource errors: \${badLocalResponses.join(', ')}\`);\nconst fatalErrors = pageErrors.filter((message) => /ReferenceError|SyntaxError/.test(message));\nif (fatalErrors.length) throw new Error(\`Runtime errors: \${fatalErrors.join(' | ')}\`);\n\nawait page.screenshot({ path: '/tmp/step-v0658-smoke.png', fullPage: true });\nawait browser.close();\n`;
write('tests/smoke-step.mjs', smoke);

const validateWorkflow = `name: Validate Step\n\non:\n  pull_request:\n    branches: [main]\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\njobs:\n  validate:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Validate static structure\n        shell: bash\n        run: |\n          set -euo pipefail\n          test -f styles/app.css\n          test -f src/app.js\n          test -f src/sync/firebase.js\n          test -f ARCHITECTURE.md\n          test \"$(grep -R -l 'step_live_v1' src | wc -l | tr -d ' ')\" -eq 1\n          test \"$(grep -c '<style' index.html || true)\" -eq 0\n          test \"$(grep -c 'var KEY=' index.html || true)\" -eq 0\n          find src -name '*.js' -print0 | xargs -0 -n1 node --check\n          python3 -m json.tool site.webmanifest >/dev/null\n      - name: Install browser\n        run: |\n          npm install --no-save playwright@1.52.0\n          npx playwright install --with-deps chromium\n      - name: Run 390x844 smoke test\n        shell: bash\n        run: |\n          python3 -m http.server 4174 >/tmp/step-http.log 2>&1 &\n          SERVER_PID=$!\n          trap 'kill $SERVER_PID' EXIT\n          STEP_URL=http://127.0.0.1:4174/ node tests/smoke-step.mjs\n`;
write('.github/workflows/validate-step.yml', validateWorkflow);

fs.writeFileSync('/tmp/step-original-node-count.txt', String(nodes.length));
