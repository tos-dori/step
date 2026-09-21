import {initialState, validateState, clone, uid} from './model.js';

export const PREFIX = 'step_local_v1';
export const STORAGE_KEY = `${PREFIX}:state`;
const HISTORY = `${PREFIX}:recovery`;
export function parseStored(raw) {
  const data = JSON.parse(raw);
  if (data.app !== 'step-local' || data.schema !== 1 || typeof data.revision !== 'string') throw new Error('저장 형식을 확인할 수 없어요.');
  return {...data, state: validateState(data.state)};
}
export class LocalStore {
  constructor(storage) {
    this.storage = storage;
    this.raw = null;
    this.state = initialState();
    this.error = null;
    this.blocked = false;
    try {
      this.raw = storage.getItem(STORAGE_KEY);
      if (this.raw !== null) this.state = parseStored(this.raw).state;
    } catch (error) {
      this.error = '저장된 내용을 읽지 못했어요. 백업·복구에서 복구본을 확인해 주세요.';
      this.blocked = true;
    }
  }
  commit(change, {checkpoint = true} = {}) {
    if (this.blocked) throw new Error(this.error || '먼저 저장 상태를 확인해 주세요.');
    const next = clone(this.state);
    change(next);
    const payload = JSON.stringify({app: 'step-local', schema: 1, revision: uid(), savedAt: Date.now(), state: next});
    try {
      if (this.storage.getItem(STORAGE_KEY) !== this.raw) throw new Error('다른 창에서 내용이 바뀌었어요. 작성 중인 내용을 백업한 뒤 다시 불러와 주세요.');
      if (checkpoint && this.raw !== null) {
        const histories = this.recovery(false);
        histories.unshift({at: Date.now(), raw: this.raw});
        this.storage.setItem(HISTORY, JSON.stringify(histories.slice(0, 8)));
      }
      this.storage.setItem(STORAGE_KEY, payload);
      if (this.storage.getItem(STORAGE_KEY) !== payload) throw new Error('기기 저장을 확인할 수 없어요.');
    } catch (error) {
      this.error = error.message.includes('다른 창') ? error.message : '기기에 저장하지 못했어요. 공간·브라우저 설정을 확인하거나 백업을 내려받아 주세요.';
      throw new Error(this.error);
    }
    this.raw = payload;
    this.state = next;
    this.error = null;
    return this.state;
  }
  recovery(includeBeforeRestore = true) {
    let records = [];
    try {const entries = JSON.parse(this.storage.getItem(HISTORY) || '[]'); records = Array.isArray(entries) ? entries.filter(e => typeof e.raw === 'string' && Number.isFinite(e.at)) : [];} catch {}
    if (includeBeforeRestore) {
      try {
        const raw = this.storage.getItem(`${PREFIX}:before-restore`);
        if (raw) {const previous = parseStored(raw); records.push({at: previous.savedAt, raw, beforeRestore: true});}
      } catch {}
    }
    return records;
  }
  restore(raw) {
    const parsed = parseStored(raw);
    // Preserve unreadable bytes before replacing a broken main record.
    const actual = this.storage.getItem(STORAGE_KEY);
    if (actual !== null) this.storage.setItem(`${PREFIX}:before-restore`, actual);
    const payload = JSON.stringify({...parsed, revision: uid(), savedAt: Date.now()});
    this.storage.setItem(STORAGE_KEY, payload);
    this.raw = payload;
    this.state = parsed.state;
    this.blocked = false;
    this.error = null;
  }
}
