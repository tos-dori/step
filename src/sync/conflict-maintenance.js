import { getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const MAX_CONFLICT_COPIES = 20;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_KEY_PREFIX = "step_conflict_cleanup_v2_";

const app = getApps()[0];
if (app) {
  const auth = getAuth(app);
  const db = getFirestore(app);

  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    cleanup(user.uid).catch((error) => console.warn("Step conflict cleanup failed", error));
  });

  window.StepConflictArchive = {
    list: async () => {
      const user = auth.currentUser;
      if (!user) return [];
      return readCopies(user.uid);
    },
    cleanup: async () => {
      const user = auth.currentUser;
      if (!user) return;
      await cleanup(user.uid, true);
    }
  };

  async function readCopies(uid) {
    const snapshots = await getDocs(collection(db, "stepUsers", uid, "states", "main", "conflicts"));
    const items = [];
    snapshots.forEach((snapshot) => {
      const data = snapshot.data() || {};
      if (!data.state || !Array.isArray(data.state.tasks)) return;
      items.push({
        id: snapshot.id,
        ref: snapshot.ref,
        state: data.state,
        operation: String(data.operation || "local-change"),
        createdAt: timestampMillis(data.createdAt)
      });
    });
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }

  async function cleanup(uid, force = false) {
    const key = CLEANUP_KEY_PREFIX + uid;
    const last = Number(localStorage.getItem(key) || 0);
    if (!force && last && Date.now() - last < CLEANUP_INTERVAL_MS) return;
    const items = await readCopies(uid);
    const removals = items.slice(MAX_CONFLICT_COPIES).map((item) => deleteDoc(item.ref));
    await Promise.allSettled(removals);
    localStorage.setItem(key, String(Date.now()));
  }

  function timestampMillis(value) {
    if (value && typeof value.toMillis === "function") return value.toMillis();
    if (value && Number.isFinite(value.seconds)) return value.seconds * 1000;
    return 0;
  }
}
