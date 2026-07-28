import fs from 'node:fs';
import vm from 'node:vm';

class MemoryStorage {
  constructor(){ this.map = new Map(); }
  getItem(key){ return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key,value){ this.map.set(key,String(value)); }
  removeItem(key){ this.map.delete(key); }
}

function makeContext(){
  const localStorage = new MemoryStorage();
  const context = { localStorage, KEY: 'step_live_v1', window: null, Date, JSON, String, Array, Object, Math };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../src/data-safety.js', import.meta.url), 'utf8'), context);
  return context;
}

const context = makeContext();
const key = context.KEY;
const first = JSON.stringify({ tasks: [{ id: 'a' }], activeId: 'a' });
const second = JSON.stringify({ tasks: [{ id: 'a' }, { id: 'b' }], activeId: 'a' });
if (!context.StepDataSafety.write(key, first, 'first')) throw new Error('first write failed');
if (!context.StepDataSafety.write(key, second, 'second')) throw new Error('second write failed');
context.localStorage.setItem(key, '{broken');
const recovered = context.StepDataSafety.load(key, context.localStorage.getItem(key), () => ({ tasks: [] }), (value) => value);
if (!Array.isArray(recovered.tasks) || recovered.tasks.length !== 1) throw new Error('latest previous snapshot was not recovered');
if (!context.StepDataSafety.isSafe()) throw new Error('recovered state should be safe');
if (!context.StepDataSafety.issue().includes('자동 복구본')) throw new Error('recovery issue message missing');

const blocked = makeContext();
blocked.localStorage.setItem(blocked.KEY, '{broken');
const fallback = blocked.StepDataSafety.load(blocked.KEY, blocked.localStorage.getItem(blocked.KEY), () => ({ tasks: [] }), (value) => value);
if (fallback.tasks.length !== 0 || blocked.StepDataSafety.isSafe()) throw new Error('unrecoverable corruption must block sync');

const previous = { tasks: [{}, {}, {}, {}] };
const next = { tasks: [{}] };
if (!context.StepDataSafety.destructiveChange(previous, next)) throw new Error('large destructive change not detected');
