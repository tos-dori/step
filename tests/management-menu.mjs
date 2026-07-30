import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const menu = fs.readFileSync('src/sync/management-menu.js', 'utf8');
const css = fs.readFileSync('styles/management-menu.css', 'utf8');

const checks = [
  [index, 'styles/management-menu.css'],
  [app, 'sync/management-menu.js'],
  [menu, "recovery.textContent='복구본'"],
  [menu, "textContent='내보내기'"],
  [menu, "textContent='가져오기'"],
  [menu, 'STEP_BACKUP_V1'],
  [menu, "checkpointLocal?.('import-backup',true)"],
  [menu, "aria-label','관리 메뉴 열기'"],
  [css, '.sync-popover.management-menu'],
  [css, '#versionTap'],
  [css, '.management-menu-actions']
];

for (const [source, token] of checks) {
  if (!source.includes(token)) throw new Error(`Missing Step management menu token: ${token}`);
}
console.log('Step management menu static checks passed');
