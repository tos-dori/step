(() => {
  const loaderScript = document.currentScript;
  const baseUrl = new URL('./', loaderScript.src);
  const classicModules = [
  "config.js",
  "data-safety.js",
  "dom.js",
  "state.js",
  "feedback.js",
  "task-model.js",
  "memo.js",
  "step-flow.js",
  "timer.js",
  "task-actions.js",
  "editor.js",
  "render.js",
  "library.js",
  "events.js",
  "bridge.js",
  "bootstrap.js"
];

  function loadClassicScript(relativePath) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(relativePath, baseUrl).href;
      script.async = false;
      script.dataset.stepModule = relativePath;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error(`Failed to load ${relativePath}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  (async () => {
    for (const file of classicModules) await loadClassicScript(file);
    document.documentElement.dataset.stepCoreLoaded = 'true';
    try {
      await import(new URL('sync/firebase.js', baseUrl).href);
      await import(new URL('sync/conflict-maintenance.js', baseUrl).href);
      await import(new URL('sync/management-menu.js', baseUrl).href);
      document.documentElement.dataset.stepSyncLoaded = 'true';
    } catch (error) {
      document.documentElement.dataset.stepSyncLoaded = 'false';
      console.error('[Step] Firebase sync module failed to load', error);
    }
    document.documentElement.dataset.stepAppLoaded = 'true';
  })().catch((error) => {
    console.error('[Step] core module load failed', error);
    const gate = document.getElementById('syncGate');
    if (gate) gate.innerHTML = '<div class="sync-gate-card"><p class="sync-gate-title">앱을 불러오지 못했어요.</p><p class="sync-gate-subtitle">새로고침해 주세요.</p></div>';
  });
})();
