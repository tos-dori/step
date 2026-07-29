import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { TextEncoder } from 'node:util';

class FakeStorage {
  constructor() { this.map = new Map(); this.failPrefix = ''; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) {
    if (this.failPrefix && String(key).startsWith(this.failPrefix)) throw new Error('quota');
    this.map.set(String(key), String(value));
  }
  removeItem(key) { this.map.delete(String(key)); }
}

const storage = new FakeStorage();
const context = {
  window: {},
  localStorage: storage,
  KEY: 'step_live_v1',
  TextEncoder,
  JSON,
  Math,
  Date,
  String,
  Number,
  Array,
  Object,
  isFinite,
  unescape,
  encodeURIComponent
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('src/data-safety.js', 'utf8'), context);
const safety = context.window.StepDataSafety;
const state = (title) => ({ schema: 2, activeId: 't1', tasks: [{ id: 't1', title, pieces: [{ status: 'pending' }] }] });

storage.setItem(context.KEY, JSON.stringify(state('original')));
assert.equal(safety.checkpointCurrent('initial', true), true);
storage.setItem(context.KEY, JSON.stringify(state('second')));
assert.equal(safety.checkpointCurrent('second', true), true);

storage.setItem('step_checkpoint_v2_01', '{broken');
const valid = safety.listCheckpoints();
assert.ok(valid.some((item) => item.raw.includes('original')), 'other independent slot must survive one corrupt slot');

storage.setItem(context.KEY, '{corrupt');
const recovered = safety.load(context.KEY, storage.getItem(context.KEY), () => state('fallback'), (value) => value);
assert.equal(recovered.tasks[0].title, 'original');
assert.equal(safety.isSafe(), true);
assert.ok([...storage.map.keys()].some((key) => key.startsWith('step_corrupt_v2_')));

storage.setItem(context.KEY, JSON.stringify(state('protected')));
storage.failPrefix = 'step_checkpoint_v2_';
const deleted = { schema: 2, activeId: null, tasks: [] };
assert.equal(safety.write(context.KEY, JSON.stringify(deleted), 'task-delete'), false);
assert.equal(JSON.parse(storage.getItem(context.KEY)).tasks[0].title, 'protected', 'failed pre-delete checkpoint must leave canonical local data unchanged');
assert.equal(safety.isSafe(), false);

storage.failPrefix = '';
assert.equal(safety.cloudStateSafe({ schema: 2, activeId: null, tasks: [{ id: 'x', title: 'x'.repeat(800_000), pieces: [] }] }), false);
console.log('Step local data safety tests passed');
