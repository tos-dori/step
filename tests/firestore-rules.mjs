import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';

const projectId = 'step-rules-test';
const rules = fs.readFileSync('firestore.rules', 'utf8');
const env = await initializeTestEnvironment({ projectId, firestore: { rules } });
const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const guest = env.unauthenticatedContext().firestore();

const state = { schema: 2, activeId: null, tasks: [] };
const legacy = {
  schema: 1,
  state,
  revision: 100,
  updatedAt: serverTimestamp(),
  updatedBy: 'legacy-device'
};
const mainV3 = (revision = 101) => ({
  schema: 3,
  state,
  stateHash: 'deadbeef',
  revision,
  operation: 'local-change',
  updatedAt: serverTimestamp(),
  updatedBy: 'device-session'
});
const history = {
  schema: 1,
  state,
  stateHash: 'deadbeef',
  archivedRevision: 100,
  operation: 'legacy',
  archivedAt: serverTimestamp(),
  archivedBy: 'device-session'
};
const conflict = {
  schema: 1,
  state,
  stateHash: 'feedface',
  baseRevision: 100,
  baseHash: 'deadbeef',
  observedRevision: 101,
  observedHash: 'cafebabe',
  operation: 'local-change',
  createdAt: serverTimestamp(),
  updatedBy: 'device-session'
};

try {
  const aliceMain = doc(alice, 'stepUsers/alice/states/main');
  await assertSucceeds(setDoc(aliceMain, legacy));
  await assertSucceeds(setDoc(aliceMain, mainV3(101)));

  await assertFails(setDoc(aliceMain, legacy));
  await assertFails(setDoc(aliceMain, mainV3(103)));
  await assertSucceeds(setDoc(aliceMain, mainV3(102)));

  await assertSucceeds(getDoc(aliceMain));
  await assertFails(getDoc(doc(bob, 'stepUsers/alice/states/main')));
  await assertFails(getDoc(doc(guest, 'stepUsers/alice/states/main')));
  await assertFails(setDoc(doc(alice, 'stepUsers/alice/states/other'), legacy));

  await assertSucceeds(setDoc(doc(alice, 'stepUsers/alice/states/main/history/slot-00'), history));
  await assertSucceeds(setDoc(doc(alice, 'stepUsers/alice/states/main/history/slot-49'), history));
  await assertFails(setDoc(doc(alice, 'stepUsers/alice/states/main/history/slot-50'), history));
  await assertFails(setDoc(doc(bob, 'stepUsers/alice/states/main/history/slot-00'), history));

  await assertSucceeds(setDoc(doc(alice, 'stepUsers/alice/states/main/conflicts/device-tab'), conflict));
  await assertFails(setDoc(doc(alice, 'stepUsers/alice/states/main/conflicts/invalid id'), conflict));
  await assertFails(setDoc(doc(bob, 'stepUsers/alice/states/main/conflicts/device-tab'), conflict));
  await assertFails(setDoc(doc(guest, 'stepUsers/alice/states/main/conflicts/device-tab'), conflict));

  const extraField = { ...mainV3(103), unexpected: true };
  await assertFails(setDoc(aliceMain, extraField));
  console.log('Step Firestore rules tests passed');
} finally {
  await env.cleanup();
}
