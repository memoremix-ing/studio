// node_modules/@solidjs/signals/dist/prod/core/error.js
var NotReadyError = class extends Error {
  source;
  constructor(r) {
    const o = Error;
    const t = o.stackTraceLimit;
    if (t !== void 0) o.stackTraceLimit = 0;
    super();
    if (t !== void 0) o.stackTraceLimit = t;
    this.source = r;
  }
};
var StatusError = class extends Error {
  source;
  constructor(r, o) {
    super(o instanceof Error ? o.message : String(o), {
      cause: o
    });
    this.source = r;
  }
};
function unwrapStatusError(r) {
  return r instanceof StatusError ? r.cause : r;
}
var NoOwnerError = class extends Error {
  constructor() {
    super("");
  }
};
var ContextNotFoundError = class extends Error {
  constructor() {
    super("");
  }
};

// node_modules/@solidjs/signals/dist/prod/core/constants.js
var REACTIVE_NONE = 0;
var REACTIVE_CHECK = 1 << 0;
var REACTIVE_DIRTY = 1 << 1;
var REACTIVE_RECOMPUTING_DEPS = 1 << 2;
var REACTIVE_IN_HEAP = 1 << 3;
var REACTIVE_IN_HEAP_HEIGHT = 1 << 4;
var REACTIVE_ZOMBIE = 1 << 5;
var REACTIVE_DISPOSED = 1 << 6;
var REACTIVE_JOINED = 1 << 7;
var REACTIVE_SNAPSHOT_STALE = 1 << 8;
var REACTIVE_LAZY = 1 << 9;
var REACTIVE_MANUAL_WRITE = 1 << 10;
var REACTIVE_FRAME_READ = 1 << 11;
var REACTIVE_MISSED_WAKE = 1 << 12;
var REACTIVE_REASK = 1 << 13;
var REACTIVE_STAGED_READ = 1 << 14;
var REACTIVE_PROBED = 1 << 15;
var REACTIVE_LANE_DIRTY = 1 << 16;
var REACTIVE_LANE_READ = 1 << 17;
var REACTIVE_SCREEN_READ = 1 << 18;
var REACTIVE_PROBE_UNANSWERED = 1 << 19;
var CONFIG_OWNED_WRITE = 1 << 0;
var CONFIG_NO_SNAPSHOT = 1 << 1;
var CONFIG_TRANSPARENT = 1 << 2;
var CONFIG_IN_SNAPSHOT_SCOPE = 1 << 3;
var CONFIG_CHILDREN_FORBIDDEN = 1 << 4;
var CONFIG_AUTO_DISPOSE = 1 << 5;
var CONFIG_SYNC = 1 << 6;
var CONFIG_STAGED = 1 << 7;
var CONFIG_HELD = 1 << 8;
var CONFIG_INPUTS_PUBLISHED = 1 << 10;
var CONFIG_OVERRIDE = 1 << 11;
var CONFIG_SLOT_NODE = 1 << 12;
var CONFIG_MANUAL_WRITE = 1 << 18;
var CONFIG_GUESS = 1 << 13;
var CONFIG_VERDICT = 1 << 14;
var CONFIG_REDERIVE = 1 << 15;
var CONFIG_AUTHORITATIVE = 1 << 17;
var CONFIG_HAS_SNAPSHOT = 1 << 9;
var CONFIG_FRESH_READ = 1 << 16;
var CONFIG_PROMOTED = 1 << 22;
var STATUS_PENDING = 1 << 0;
var STATUS_ERROR = 1 << 1;
var STATUS_UNINITIALIZED = 1 << 2;
var EFFECT_RENDER = 1;
var EFFECT_USER = 2;
var EFFECT_TRACKED = 3;
var NOT_PENDING = {};
var NO_SNAPSHOT = {};
var defaultContext = {};
var $REFRESH = /* @__PURE__ */ Symbol("refresh");

// node_modules/@solidjs/signals/dist/prod/core/scheduler.js
var transactions = [];
function newTransaction(e, n = null) {
  const t = {
    un: [],
    tn: [[], []],
    sn: [],
    dn: null,
    _parent: n,
    Z: e,
    ye: null,
    tt: 0,
    nt: false,
    nn: null,
    ve: false,
    ln: false,
    T: null
  };
  if (!e) transactions.push(t);
  return t;
}
var passLane = null;
function setPassLane(e) {
  passLane = e;
}
var flushTransaction = null;
var passTx = null;
function joinPassTx(e, n) {
  if (globalQueue.ee && !n || flushTransaction !== null) return joinFuture(e);
  if (passTx === null) passTx = resolveTx(e);
  else merge(resolveTx(e), passTx);
  schedule();
}
function txOf(e) {
  return e.m.ke = resolveTx(e.m.ke);
}
function liveTx(e) {
  e = resolveTx(e);
  return transactions.indexOf(e) !== -1 ? e : null;
}
function resolveTx(e) {
  while (e.dn !== null) e = e.dn;
  return e;
}
function joinFuture(e) {
  const n = flushTransaction;
  if (n === null) {
    flushTransaction = e === null ? newTransaction(false) : resolveTx(e);
  } else if (e !== null) merge(resolveTx(e), n);
  if (!globalQueue.ee) schedule();
}
function merge(e, n) {
  e = resolveTx(e);
  n = resolveTx(n);
  if (e === n || e.Z || n.Z) return;
  e.dn = n;
  n.tt += e.tt;
  n.nt ||= e.nt;
  append(n.un, e.un);
  append(n.tn[0], e.tn[0]);
  append(n.tn[1], e.tn[1]);
  append(n.sn, e.sn);
  if (e.T !== null) append(n.T ??= [], e.T);
  transactions.splice(transactions.indexOf(e), 1);
}
function blocked(e) {
  const n = judge;
  judge ??= e;
  const t = e.tt !== 0 || blockedBy(e.un, e) || !!GlobalQueue.cn && GlobalQueue.cn(e);
  judge = n;
  return t;
}
var judge = null;
function ownFlights(e) {
  return blockedBy(e.un, e, true);
}
function ownSource(e, n) {
  const t = e.m?.Se;
  if (t === void 0) return true;
  for (const e2 of t) {
    const t2 = e2.m?.ke;
    if (t2 == null || resolveTx(t2) === n) return true;
  }
  return false;
}
function blockedBy(e, n, t = false) {
  for (let l = 0; l < e.length; l++) {
    const o = e[l];
    if (!(o.G & STATUS_PENDING) || o.R & REACTIVE_DISPOSED || o.u & CONFIG_GUESS || o.m.ke !== null && txOf(o) !== n || t && !ownSource(o, n)) continue;
    if (o.i === EFFECT_RENDER) {
      if (onScreen(o, judge ?? n)) return true;
      continue;
    }
    for (let e2 = o.t; e2 !== null; e2 = e2.l) {
      const t2 = e2.o;
      if ((t2.i === EFFECT_RENDER || t2.R & REACTIVE_FRAME_READ || t2.u & CONFIG_REDERIVE && t2.G === STATUS_PENDING) && (e2.Ue === t2.Ge || t2.m?.V != null) && !(t2.R & REACTIVE_DISPOSED) && onScreen(t2, judge ?? n)) return true;
    }
  }
  return false;
}
function onScreen(e, n) {
  return !(e.R & REACTIVE_ZOMBIE && removalStagedBy(e, n)) && !(GlobalQueue.se && GlobalQueue.se(e));
}
function removalStagedBy(e, n) {
  let t = e;
  while (t !== null && t.R & REACTIVE_ZOMBIE) t = t._parent;
  return t !== null && (t.u & CONFIG_HELD) !== 0 && t.m?.ke != null && txOf(t) === resolveTx(n);
}
var heldTrims = [];
function heldTrim(e) {
  heldTrims.push(e);
}
var deferredZombies = [];
function deferZombie(e) {
  deleteFromHeap(e, dirtyQueue);
  e.R &= -4;
  deferredZombies.push(e);
}
function holdNode(e, n) {
  e.u |= CONFIG_HELD;
  list(e, n);
}
function list(e, n) {
  const t = ext(e);
  if (t.ke === n) return;
  t.ke = n;
  n.un.push(e);
}
function holdFrame(e, n) {
  for (let t = e.ge; t !== null; t = t.me) {
    if (t.m?.ke?.Z) continue;
    if (t.re !== void 0 && !(t.u & CONFIG_HELD)) holdNode(t, n);
    holdFrame(t, n);
  }
}
var dirtyQueue = {
  Ht: new Array(2e3).fill(void 0),
  C: false,
  He: 0,
  At: 0
};
var clock = 0;
var scheduled = false;
var halted = false;
var haltNotified = false;
var syncDepth = 0;
var actionDepth = 0;
function enterAction() {
  actionDepth++;
}
function exitAction() {
  actionDepth--;
}
var question = 0;
var questions = 0;
function setQuestion(e) {
  question = e;
}
function nextQuestion() {
  return ++questions;
}
var MAINLINE_QUESTION = 2147483647;
function schedule() {
  if (halted) {
    notifyHalted();
    return;
  }
  if (scheduled) return;
  scheduled = true;
  if (!syncDepth && !globalQueue.ee) {
    queueMicrotask(flush);
  }
}
var ROOT_ERROR_HOOK = /* @__PURE__ */ Symbol.for("solid-js/root-error-hook");
function haltReactivity(e) {
  if (halted) return;
  halted = true;
  let n = "[REACTIVITY_HALTED]";
  const t = e !== void 0 && globalThis.reportError;
  t || e === void 0 ? console.error(n) : console.error(n, e);
  t && t(e);
}
function notifyHalted() {
  if (haltNotified) return;
  haltNotified = true;
  console.error("[REACTIVITY_HALTED]");
}
var GlobalQueue = class _GlobalQueue {
  tn = [[], []];
  ee = false;
  flush() {
    if (this.ee) return;
    this.ee = true;
    resyncUnflushedCompanions();
    passLane = null;
    passTx = null;
    try {
      sweepDormant();
      runHeap(dirtyQueue, _GlobalQueue.Ce);
      this.settle();
      clock++;
      scheduled = dirtyQueue.At >= dirtyQueue.He || pendingNodes.length !== 0;
      this.run(EFFECT_RENDER);
      this.run(EFFECT_USER);
      if (false) ;
      if (false) ;
      if (false) ;
    } finally {
      this.ee = false;
      passTx = null;
    }
  }
  /** L2 — the seam: end of the pure phase. Commit this flush's staged nodes,
   * or park them with the transaction the flush joined; then land every
   * transaction no frame is waiting on. The landing flush is an ordinary
   * flush: the settle walk (async.ts) re-ran the parked readers in its pure
   * phase, and here no flight the transaction holds has a frame deriving
   * from it (`blocked`). */
  settle() {
    if (_GlobalQueue.an?.()) runHeap(dirtyQueue, _GlobalQueue.Ce);
    const e = flushTransaction;
    flushTransaction = null;
    _GlobalQueue.fn?.(e);
    const n = e !== null && !e.Z ? resolveTx(e) : null;
    if (n !== null) {
      const e2 = pendingNodes.length;
      for (let t3 = 0; t3 < e2; t3++) {
        const e3 = pendingNodes[t3];
        if (!(e3.u & (CONFIG_HELD | CONFIG_OVERRIDE)) && (e3.m === null || e3.m.ke === null || !e3.m.ke.Z)) {
          if (e3.Ae === NOT_PENDING && e3.G & STATUS_UNINITIALIZED && e3.i !== EFFECT_RENDER) continue;
          if (e3.Ae !== NOT_PENDING && !(e3.G & (STATUS_PENDING | STATUS_UNINITIALIZED)) && e3.We && e3.We(e3.pe, e3.Ae) && e3.m?.Me == null && e3.m?.Be == null) {
            e3.Ae = NOT_PENDING;
            e3.u &= ~CONFIG_STAGED;
            continue;
          }
          holdNode(e3, n);
        }
        if (e3.u & CONFIG_STAGED) holdFrame(e3, n);
      }
      pendingNodes.length = 0;
      _GlobalQueue.Tn?.(n);
      const t2 = deferredZombies.splice(0).sort((e3, n2) => e3.Le - n2.Le);
      for (let e3 = 0; e3 < t2.length; e3++) if ((t2[e3].R & (REACTIVE_DISPOSED | REACTIVE_ZOMBIE)) === REACTIVE_ZOMBIE && t2[e3].u & CONFIG_VERDICT) recompute(t2[e3]);
    } else {
      commitPendingNodes();
      for (let e2 = 0; e2 < heldTrims.length; e2++) {
        const n2 = heldTrims[e2];
        if (n2.m?.V == null && !n2.Fe) trimStaleDeps(n2);
      }
    }
    if (heldTrims.length) heldTrims.length = 0;
    const t = this.tn;
    const l = this.tn = [[], []];
    _GlobalQueue.Nn?.(n !== null ? stagedReaders : null);
    if (stagedReaders.length) stagedReaders.length = 0;
    this.tn = [[], []];
    for (let e2 = transactions.length - 1; e2 >= 0; e2--) {
      const n2 = transactions[e2];
      if (blocked(n2)) continue;
      transactions.splice(e2, 1);
      _GlobalQueue.In?.(n2);
      land(n2);
      e2 = transactions.length;
    }
    _GlobalQueue._n?.();
    _GlobalQueue.D?.(n !== null && transactions.indexOf(n) !== -1 ? n : null);
    const o = n && liveTx(n);
    const u = o !== null;
    for (let e2 = 0; e2 < 2; e2++) {
      if (u) append(o.tn[e2], t[e2]);
      this.tn[e2] = u || l[e2].length || this.tn[e2].length ? l[e2].concat(u ? [] : t[e2], this.tn[e2]) : t[e2];
    }
    if (deferredZombies.length !== 0) {
      const e2 = deferredZombies.splice(0).sort((e3, n2) => e3.Le - n2.Le);
      for (let n2 = 0; n2 < e2.length; n2++) {
        if (!(e2[n2].R & REACTIVE_DISPOSED)) recompute(e2[n2]);
      }
    }
    _GlobalQueue.Ee?.();
  }
  run(e) {
    const n = this.tn[e - 1];
    if (n.length) {
      this.tn[e - 1] = [];
      runQueue(n, e);
    }
  }
  enqueue(e, n, t = passLane) {
    if (e) (t !== null ? t : this).tn[e - 1].push(n);
    schedule();
  }
  /** Status reaching the root: pending is absorbed (the root mount defers —
   * dev records it for the ASYNC_OUTSIDE_LOADING_BOUNDARY FYI); an error is
   * unhandled (`false` → the caller halts).
   *
   * L2: this is where a transaction is registered. Pending that reaches an
   * observer (a render effect: the frame) is a frame that cannot show — the
   * flush parks, and the transaction waits on the flight while a frame
   * derives from it (`blocked`). Pending nobody observes holds nothing: a
   * memo in flight that no frame reads is not a frame waiting. (Base: the
   * queue's `_asyncReporters`, INV-3's one registration site.)
   *
   * A boundary between the observer and the root (boundaries.ts) is asked
   * first: a fallback catches what is not ready under it, and the root
   * never hears of it. */
  notify(e, n, t, l) {
    if (_GlobalQueue.fe && _GlobalQueue.fe(e, t & n, l)) return true;
    if (n & STATUS_PENDING) {
      if (t & STATUS_PENDING) {
        if (passLane === null) joinFuture(null);
      }
      return true;
    }
    return false;
  }
};
function reruns(e) {
  for (let n = 0; n < e.sn.length; n++) {
    const t = e.sn[n];
    if (t.R & REACTIVE_DISPOSED) continue;
    if (t.R & REACTIVE_FRAME_READ) {
      t.R &= ~REACTIVE_FRAME_READ;
      t.Fe = false;
      for (let e2 = t.ge; e2 !== null; e2 = e2.me) if (e2.i) e2.Fe = false;
      enqueueSub(t);
    }
  }
  e.sn.length = 0;
}
function land(e) {
  reruns(e);
  if (e.T !== null) GlobalQueue.A(e.T);
  for (let n = 0; n < e.un.length; n++) {
    const t = e.un[n];
    if (t.m.ke === null || txOf(t) !== e) continue;
    t.m.ke = null;
    commitPendingNode(t);
  }
  releaseQueues(e);
}
function releaseQueues(e) {
  for (let n = 0; n < 2; n++) {
    append(globalQueue.tn[n], e.tn[n]);
    e.tn[n] = [];
  }
}
function append(e, n) {
  for (let t = 0; t < n.length; t++) e.push(n[t]);
}
var pendingNodes = [];
var stagedReaders = [];
function staleReader(e, n) {
  if (!(e.R & REACTIVE_FRAME_READ)) {
    e.R |= REACTIVE_FRAME_READ;
    n.sn.push(e);
  }
}
function queuePendingNode(e) {
  pendingNodes.push(e);
  if (!globalQueue.ee) markUnflushedStaged();
}
var notifyEpoch = 0;
function bumpNotifyEpoch() {
  notifyEpoch++;
}
function insertSubs(e) {
  e.ze = notifyEpoch;
  const n = e.u;
  const t = (n & CONFIG_HAS_SNAPSHOT) !== 0 && e.m?.xe !== void 0;
  for (let n2 = e.t; n2 !== null; n2 = n2.l) {
    const e2 = n2.o;
    if (e2.R & REACTIVE_RECOMPUTING_DEPS && n2.Ue === e2.Ge && n2 !== e2.S) e2.R |= REACTIVE_MISSED_WAKE;
    if (t && e2.u & CONFIG_IN_SNAPSHOT_SCOPE) {
      e2.R |= REACTIVE_SNAPSHOT_STALE;
      continue;
    }
    enqueueSub(e2);
  }
}
function laneDirty(e, n) {
  for (let t = e.t; t !== null; t = t.l) {
    const e2 = t.o.m?.ke;
    if (e2?.Z ? sameLane(e2, n) : t.o.i) t.o.R |= REACTIVE_LANE_DIRTY;
  }
}
function sameLane(e, n) {
  return e === n || e.nn !== null && e.nn === n.nn;
}
function commitPendingNode(e) {
  const n = e;
  if (!n.re) {
    e.u &= -385;
    if (e.Ae !== NOT_PENDING) {
      e.pe = e.Ae;
      e.Ae = NOT_PENDING;
    }
    return;
  }
  const t = e.Ae === NOT_PENDING && (n.G & STATUS_PENDING) !== 0;
  e.u = t ? e.u & ~CONFIG_HELD | CONFIG_INPUTS_PUBLISHED : e.u & -1409;
  if (e.Ae !== NOT_PENDING) {
    e.pe = e.Ae;
    e.Ae = NOT_PENDING;
    n.G &= ~STATUS_UNINITIALIZED;
    if (n.m != null) n.m.be = false, n.m.$e = NOT_PENDING;
    if (e.i && e.i !== EFFECT_TRACKED) {
      e.Fe = true;
      globalQueue.enqueue(e.i, e.J ??= GlobalQueue.X.bind(null, n));
    }
  }
  n._e = false;
  n.R &= ~REACTIVE_MANUAL_WRITE;
  if (n.m?.V == null) trimStaleDeps(n);
  if (!(n.G & STATUS_PENDING)) n.G &= ~STATUS_UNINITIALIZED;
  if (!t && n.m != null && (n.m.Me !== null || n.m.Be !== null)) GlobalQueue.he(n, false, true);
}
function commitPendingNodes() {
  for (let e = 0; e < pendingNodes.length; e++) {
    const n = pendingNodes[e];
    if (!(n.u & (CONFIG_OVERRIDE | CONFIG_HELD))) commitPendingNode(n);
  }
  pendingNodes.length = 0;
}
var globalQueue = new GlobalQueue();
function flush(e) {
  if (actionDepth > 0) {
    return e ? e() : void 0;
  }
  if (e) {
    syncDepth++;
    try {
      return e();
    } finally {
      try {
        flush();
      } finally {
        syncDepth--;
      }
    }
  }
  if (globalQueue.ee) {
    return;
  }
  if (halted) return;
  while (scheduled) {
    globalQueue.flush();
  }
}
function runQueue(e, n) {
  for (let t = 0; t < e.length; t++) e[t](n);
}

// node_modules/@solidjs/signals/dist/prod/core/heap.js
function enqueueSub(e) {
  if (dirtyQueue.He > e.Le) dirtyQueue.He = e.Le;
  insertIntoHeap(e, dirtyQueue);
}
function actualInsertIntoHeap(e, t) {
  const E = (e._parent?.Et ? e._parent.ut?.Le : e._parent?.Le) ?? -1;
  if (E >= e.Le) e.Le = E + 1;
  const n = e.Le;
  const I = t.Ht[n];
  if (I === void 0) t.Ht[n] = e;
  else {
    const t2 = I.Ke;
    t2.je = e;
    e.Ke = t2;
    I.Ke = e;
  }
  if (n > t.At) t.At = n;
}
function insertIntoHeap(e, t) {
  let E = e.R;
  if (E & (REACTIVE_IN_HEAP | REACTIVE_RECOMPUTING_DEPS)) return;
  if (E & REACTIVE_CHECK) {
    e.R = E & -4 | REACTIVE_DIRTY | REACTIVE_IN_HEAP;
  } else {
    e.R = E | REACTIVE_IN_HEAP;
    if (t.C) markNode(e);
  }
  if (!(E & REACTIVE_IN_HEAP_HEIGHT)) actualInsertIntoHeap(e, t);
}
function insertIntoHeapHeight(e, t) {
  let E = e.R;
  if (E & (REACTIVE_IN_HEAP | REACTIVE_RECOMPUTING_DEPS | REACTIVE_IN_HEAP_HEIGHT)) return;
  e.R = E | REACTIVE_IN_HEAP_HEIGHT;
  actualInsertIntoHeap(e, t);
}
function deleteFromHeap(e, t) {
  const E = e.R;
  if (!(E & (REACTIVE_IN_HEAP | REACTIVE_IN_HEAP_HEIGHT))) return;
  e.R = E & -25;
  const n = e.Le;
  if (e.Ke === e) t.Ht[n] = void 0;
  else {
    const E2 = e.je;
    const I = t.Ht[n];
    const i = E2 ?? I;
    if (e === I) t.Ht[n] = E2;
    else e.Ke.je = E2;
    i.Ke = e.Ke;
  }
  e.Ke = e;
  e.je = void 0;
}
function markHeap(e) {
  if (e.C) return;
  e.C = true;
  for (let t = 0; t <= e.At; t++) {
    for (let E = e.Ht[t]; E !== void 0; E = E.je) {
      if (E.R & REACTIVE_IN_HEAP) markNode(E);
    }
  }
}
function markNode(e, t = REACTIVE_DIRTY) {
  const E = e.R;
  if ((E & (REACTIVE_CHECK | REACTIVE_DIRTY)) >= t) return;
  e.R = E & -4 | t;
  for (let t2 = e.t; t2 !== null; t2 = t2.l) {
    markNode(t2.o, REACTIVE_CHECK);
  }
}
function runHeap(e, t) {
  e.C = false;
  for (e.He = 0; e.He <= e.At; e.He++) {
    let E = e.Ht[e.He];
    while (E !== void 0) {
      if (E.R & REACTIVE_IN_HEAP) t(E);
      else adjustHeight(E, e);
      E = e.Ht[e.He];
    }
  }
  e.At = 0;
}
function adjustHeight(e, t) {
  deleteFromHeap(e, t);
  let E = e.Le;
  for (let t2 = e._; t2; t2 = t2.p) {
    const e2 = t2.I;
    if (e2.re && e2.Le >= E) E = e2.Le + 1;
  }
  if (e.Le !== E) {
    e.Le = E;
    for (let E2 = e.t; E2 !== null; E2 = E2.l) insertIntoHeapHeight(E2.o, t);
  }
}

// node_modules/@solidjs/signals/dist/prod/core/owner.js
function markDisposal(e) {
  let n = e.ge;
  while (n) {
    n.R |= REACTIVE_ZOMBIE;
    markDisposal(n);
    n = n.me;
  }
}
function dispose(e) {
  e.u &= ~CONFIG_AUTO_DISPOSE;
  unobserved(e);
}
function disposeChildren(e, n = false, t) {
  const i = e.R;
  if (i & REACTIVE_DISPOSED) return;
  if (n && !t && e.m !== null && (e.m.Me !== null || e.m.Be !== null)) disposeChildren(e, false, true);
  if (n) {
    e.R = i | REACTIVE_DISPOSED;
  }
  if (n && e.re) {
    if (e.m !== null) e.m.De = null;
    if (e.G & STATUS_PENDING && e.m?.ke != null || i & REACTIVE_FRAME_READ) schedule();
  }
  let l = t ? e.m.Me : e.ge;
  if (t) e.m.Me = null;
  else e.ge = null;
  while (l) {
    const e2 = l;
    e2.u &= ~CONFIG_AUTO_DISPOSE;
    deleteFromHeap(e2, dirtyQueue);
    clearDeps(e2);
    l.Je = l;
    disposeChildren(l, true);
    l = l.me;
  }
  if (!t) e.Ye = 0;
  if (n && !t && !(i & REACTIVE_ZOMBIE) && e._parent !== null && !(e._parent.R & REACTIVE_DISPOSED)) {
    const n2 = e.Je;
    const t2 = e.me;
    if (n2 !== null) n2.me = t2;
    else e._parent.ge = t2;
    if (t2 !== null) t2.Je = n2;
    e.Je = null;
  }
  runDisposal(e, t);
  if (n && e.lt) {
    const n2 = e.lt;
    e.lt = void 0;
    n2();
  }
}
function linkChild(e, n) {
  const t = e.ge;
  n.Je = null;
  n.me = t;
  if (t !== null) t.Je = n;
  e.ge = n;
}
function runDisposal(e, n) {
  const t = n ? e.m.Be : e.Pe;
  if (!t) return;
  if (n) e.m.Be = null;
  else e.Pe = null;
  if (Array.isArray(t)) {
    for (let e2 = t.length - 1; e2 >= 0; e2--) {
      const n2 = t[e2];
      n2.call(n2);
    }
  } else {
    t.call(t);
  }
}
function childId(e, n) {
  let t = e;
  while (t.u & CONFIG_TRANSPARENT && t._parent) t = t._parent;
  if (t.id != null) return formatId(t.id, n ? t.Ye++ : t.Ye);
  throw new Error("");
}
function getNextChildId(e) {
  return childId(e, true);
}
function inheritId(e, n, t) {
  return e?.id ?? (n ? t?.id : t?.id != null ? getNextChildId(t) : void 0);
}
function formatId(e, n) {
  const t = n.toString(36), i = t.length - 1;
  return e + (i ? String.fromCharCode(64 + i) : "") + t;
}
function getObserver() {
  return tracking ? context : null;
}
function getOwner() {
  return context;
}
function cleanup(e) {
  if (!context) return e;
  if (!context.Pe) context.Pe = e;
  else if (Array.isArray(context.Pe)) context.Pe.push(e);
  else context.Pe = [context.Pe, e];
  return e;
}
function isDisposed(e) {
  return !!(e.R & REACTIVE_DISPOSED);
}
function disposeRootSelf(e = true) {
  disposeChildren(this, e);
}
function createOwner(e) {
  const n = context;
  const t = e?.transparent ?? false;
  const i = {
    id: inheritId(e, t, n),
    u: t ? CONFIG_TRANSPARENT : 0,
    Et: true,
    ut: n?.Et ? n.ut : n,
    ge: null,
    me: null,
    Je: null,
    Pe: null,
    U: n?.U || defaultContext,
    Ye: 0,
    m: null,
    _parent: n,
    dispose: disposeRootSelf
  };
  if (n) linkChild(n, i);
  return i;
}
function createRoot(e, n) {
  const t = createOwner(n);
  return runWithOwner(t, () => e(() => t.dispose()));
}

// node_modules/@solidjs/signals/dist/prod/core/graph.js
var slotUnobservedHook;
function setSlotUnobserved(e) {
  slotUnobservedHook = e;
}
function unlinkSubs(e) {
  const n = e.I;
  const o = e.p;
  const l = e.l;
  const t = e.en;
  if (l !== null) l.en = t;
  else n.qe = t;
  if (t !== null) t.l = l;
  else {
    n.t = l;
    if (l === null) {
      if (n.u & CONFIG_SLOT_NODE) slotUnobservedHook(n);
      else n.m?.Xe?.();
      const e2 = n;
      e2.re && e2.u & CONFIG_AUTO_DISPOSE && !(e2.R & REACTIVE_ZOMBIE) && !(e2.G & STATUS_PENDING) && unobserved(e2);
    }
  }
  return o;
}
function trimStaleDeps(e) {
  const n = e.S;
  let o = n !== null ? n.p : e._;
  if (o !== null) {
    do {
      o = unlinkSubs(o);
    } while (o !== null);
    if (n !== null) n.p = null;
    else e._ = null;
  }
}
function clearDeps(e) {
  let n = e._;
  if (!n) return;
  do {
    n = unlinkSubs(n);
  } while (n !== null);
  e._ = null;
  e.S = null;
}
function unobserved(e) {
  deleteFromHeap(e, dirtyQueue);
  clearDeps(e);
  disposeChildren(e, true);
}
var dormantNodes = /* @__PURE__ */ new Set();
function sweepDormant() {
  if (dormantNodes.size === 0) return;
  for (const e of dormantNodes) {
    if (!e.t && e.u & CONFIG_AUTO_DISPOSE && !(e.G & STATUS_PENDING) && !(e.R & (REACTIVE_DISPOSED | REACTIVE_ZOMBIE))) {
      unobserved(e);
    }
  }
  dormantNodes.clear();
}
function link(e, n) {
  const o = n.S;
  if (o !== null && o.I === e) return;
  let l = null;
  const t = n.R & REACTIVE_RECOMPUTING_DEPS;
  if (t) {
    l = o !== null ? o.p : n._;
    if (l !== null && l.I === e) {
      l.Ue = n.Ge;
      n.S = l;
      return;
    }
  }
  const s = e.qe;
  if (s !== null && s.o === n && (!t || s.Ue === n.Ge)) return;
  const u = n.S = e.qe = {
    I: e,
    o: n,
    p: l,
    en: s,
    l: null,
    Ue: n.Ge
  };
  if (o !== null) o.p = u;
  else n._ = u;
  if (s !== null) s.l = u;
  else e.t = u;
  bumpNotifyEpoch();
}

// node_modules/@solidjs/signals/dist/prod/core/async.js
function addPendingSource(e, t) {
  if (e.m?.Se?.has(t)) return false;
  (ext(e).Se ??= /* @__PURE__ */ new Set()).add(t);
  return true;
}
function removePendingSource(e, t) {
  const n = e.m?.Se;
  if (!n?.delete(t)) return false;
  if (!n.size) e.m.Se = void 0;
  return true;
}
function clearPendingSources(e) {
  if (e.m !== null) e.m.Se = void 0;
}
function retryReaches(e, t) {
  for (let n = e._; n; n = n.p) {
    const e2 = n.I;
    if (e2 === t || e2.m?.Se?.has(t)) return true;
  }
  return false;
}
function parkLoadingWindow(e, t) {
  ext(e).Ie = true;
  if (t.source) addPendingSource(e, t.source);
  if (!(e.G & STATUS_ERROR)) setPendingError(e, t.source, t);
}
function setPendingError(e, t, n) {
  if (!t) {
    if (e.m !== null) e.m.V = null;
    return;
  }
  if (n instanceof NotReadyError && n.source === t) {
    ext(e).V = n;
    return;
  }
  const r = e.m?.V;
  if (!(r instanceof NotReadyError) || r.source !== t) {
    ext(e).V = new NotReadyError(t);
  }
}
function forEachDependent(e, t) {
  for (let n = e.t; n !== null; n = n.l) t(n.o, n);
}
function releaseIfSettledUnobserved(e) {
  e.re && e.u & CONFIG_AUTO_DISPOSE && !e.t && !(e.R & REACTIVE_ZOMBIE) && !(e.G & STATUS_PENDING) && unobserved(e);
}
function releaseSettledDependents(e) {
  let t;
  const n = /* @__PURE__ */ new Set();
  const visit = (e2) => {
    if (n.has(e2)) return;
    n.add(e2);
    if (!e2.t && e2.u & CONFIG_AUTO_DISPOSE) (t ??= []).push(e2);
    forEachDependent(e2, visit);
  };
  forEachDependent(e, visit);
  if (t) for (const e2 of t) releaseIfSettledUnobserved(e2);
}
function settleErroredDependents(e, t) {
  let n = false;
  const r = /* @__PURE__ */ new Set();
  const visit = (e2) => {
    if (r.has(e2)) return;
    r.add(e2);
    if (e2.m?.V === t) {
      enqueueSub(e2);
      n = true;
    }
    forEachDependent(e2, visit);
  };
  forEachDependent(e, visit);
  if (n) schedule();
}
function settlePendingSource(e, t = e) {
  removePendingSource(e, t);
  let n = false;
  let r;
  const o = /* @__PURE__ */ new Set();
  const settle = (f) => {
    if (o.has(f) || // A conditional dropped this source, but another dependency can still
    // carry it. Only retire pending state inherited through the recovered
    // branch. Deliberately NOT marked visited on this early return: the
    // carrying dependency may itself be a later branch of this same walk
    // (two unchanged memos converging), and its visit must be free to
    // re-examine this node once that branch has retired the source.
    t !== e && retryReaches(f, t) || !removePendingSource(f, t))
      return f.u & CONFIG_VERDICT && enqueueSub(f);
    o.add(f);
    f.Ne = clock;
    const u = f.m?.Se?.values().next().value;
    const i = f.G & STATUS_ERROR;
    if (u) {
      if (!i) setPendingError(f, u);
    } else {
      f.G &= ~STATUS_PENDING;
      if (!i) setPendingError(f);
      if (f.u & CONFIG_HELD) joinFuture(txOf(f));
      if (f.m?.Ie) {
        enqueueSub(f);
        n = true;
      }
      if (f.m !== null) f.m.Ie = false;
      if (!f.t && f.u & CONFIG_AUTO_DISPOSE) (r ??= []).push(f);
    }
    forEachDependent(f, settle);
  };
  forEachDependent(e, settle);
  if (r) for (const e2 of r) releaseIfSettledUnobserved(e2);
  if (n) schedule();
}
function isThenable(e) {
  return e != null && typeof e === "object" && typeof e.then === "function";
}
function releaseFlightTeardown(e) {
  const t = e.m?.Te;
  if (t != null) {
    e.m.Te = null;
    t();
  }
}
function handleAsync(e, t, n, r) {
  let o = false;
  let f = false;
  if (typeof t === "object" && t !== null) {
    untrack(() => {
      o = t[Symbol.asyncIterator];
      f = !o && isThenable(t);
    });
  }
  if (!f && !o) {
    if (e.m !== null) e.m.De = null;
    e._e = false;
    return t;
  }
  ext(e).De = t;
  e.m.Oe = question || MAINLINE_QUESTION;
  e.m.Se = void 0;
  let u;
  const handleError = (n2) => {
    if (e.m?.De !== t) return;
    let o2 = n2 instanceof NotReadyError;
    if (o2 && e._e) {
      if (e.m !== null) e.m.De = null;
      parkLoadingWindow(e, n2);
      e.Ne = clock;
      return;
    }
    notifyStatus(e, o2 ? STATUS_PENDING : STATUS_ERROR, n2);
    if (o2) settlePendingSource(e);
    e.Ne = clock;
    if (!o2) releaseSettledDependents(e);
    r?.(n2, o2);
  };
  const asyncWrite = (r2, o2) => {
    if (e.m?.De !== t) return;
    if (e.R & REACTIVE_DIRTY) return;
    const f2 = !!(e.G & STATUS_UNINITIALIZED);
    landStatus(e);
    if (n) {
      try {
        n(r2);
      } catch (e2) {
        handleError(e2);
        return;
      }
      if (f2) landStatus(e, true);
    } else {
      let t2 = e.m.Re;
      e.m.Re = null;
      if (f2 && t2 && (t2 = liveTx(t2))) holdNode(e, t2);
      try {
        setSignal(e, () => r2);
      } catch (t3) {
        notifyStatus(e, STATUS_ERROR, t3);
      }
    }
    if (e.Ae === NOT_PENDING) {
      e._e = false;
      trimStaleDeps(e);
    }
    settlePendingSource(e);
    schedule();
    flush();
    o2?.();
  };
  const settleAutodispose = () => {
    if (e.u & CONFIG_AUTO_DISPOSE && !e.t && !(e.G & STATUS_PENDING)) {
      unobserved(e);
      return true;
    }
    return false;
  };
  const consumeIterator = (n2, r2) => {
    const o2 = n2[Symbol.asyncIterator]();
    let f2 = false;
    let i2 = false;
    let s = !r2;
    const close = () => {
      if (i2) return;
      i2 = true;
      try {
        const e2 = o2.return?.();
        if (isThenable(e2)) e2.then(void 0, () => {
        });
      } catch {
      }
    };
    r2 ? r2(close) : cleanup(close);
    ext(e).Te = close;
    const iterateOrRelease = () => {
      if (!settleAutodispose()) iterate();
    };
    const iterate = () => {
      let n3, r3, l2 = false, a = false, c = true;
      const S = o2.next();
      const d = isThenable(S) ? S : {
        then: (e2) => void e2(S)
      };
      d.then((r4) => {
        if (c && s) {
          n3 = r4;
          l2 = true;
          if (r4.done) i2 = true;
        } else if (e.m?.De !== t) {
          return;
        } else if (!r4.done) {
          f2 = true;
          asyncWrite(r4.value, iterateOrRelease);
        } else {
          i2 = true;
          if (f2) {
            schedule();
            flush();
          } else {
            asyncWrite(void 0);
          }
          settleAutodispose();
        }
      }, (n4) => {
        if (c && s) {
          r3 = n4;
          a = true;
        } else if (e.m?.De === t) {
          i2 = true;
          handleError(n4);
          settleAutodispose();
        }
      });
      c = false;
      if (a) {
        i2 = true;
        handleError(r3);
        if (s) throw r3;
        return true;
      }
      if (l2 && !n3.done) {
        u = n3.value;
        f2 = true;
        return iterate();
      }
      return l2 && n3.done;
    };
    const l = iterate();
    s = false;
    return f2 || l;
  };
  let i = null;
  const flattenIfIterable = (e2, t2) => {
    let n2 = false;
    if (typeof e2 === "object" && e2 !== null) {
      untrack(() => {
        n2 = e2[Symbol.asyncIterator];
      });
    }
    if (!n2) return false;
    const r2 = consumeIterator(e2, t2);
    if (!t2) i = r2;
    return true;
  };
  if (f) {
    let n2 = false, r2 = false, o2, f2 = true;
    const registerDeferredClose = (t2) => {
      if (!e.Pe) e.Pe = t2;
      else if (Array.isArray(e.Pe)) e.Pe.push(t2);
      else e.Pe = [e.Pe, t2];
    };
    t.then((r3) => {
      if (f2) {
        u = r3;
        n2 = true;
      } else if (e.m?.De === t && !(e.R & REACTIVE_DISPOSED) && flattenIfIterable(r3, registerDeferredClose)) ;
      else {
        asyncWrite(r3);
        settleAutodispose();
      }
    }, (e2) => {
      if (f2) {
        o2 = e2;
        r2 = true;
      } else {
        handleError(e2);
        settleAutodispose();
      }
    });
    f2 = false;
    if (r2) {
      handleError(o2);
      throw o2;
    } else if (!n2) {
      if (e._e) return e.pe;
      throw new NotReadyError(context);
    } else if (!flattenIfIterable(u)) {
      e._e = false;
    }
  }
  if (o) flattenIfIterable(t);
  if (i !== null) {
    if (!i) {
      if (e._e) return e.pe;
      throw new NotReadyError(context);
    }
    e._e = false;
  }
  return u;
}
function clearStatus(e, t = false) {
  if (e.m?.Se) clearPendingSources(e);
  if (e.m?.Ie) {
    if (e.m !== null) e.m.Ie = false;
  }
  e.G = t ? 0 : e.G & STATUS_UNINITIALIZED;
  if (e.m?.V) setPendingError(e);
  const n = statusNotifierOf(e);
  if (n) n.call(e);
}
function landStatus(e, t = false) {
  const n = e.m?.Se;
  if (n && (n.delete(e), n.size)) {
    e.m.Ie = false;
    if (t) e.G = STATUS_PENDING;
    setPendingError(e, n.values().next().value);
  } else clearStatus(e, t);
}
function notifyStatus(e, t, n, r) {
  if (t === STATUS_ERROR && !(n instanceof StatusError) && !(n instanceof NotReadyError)) n = new StatusError(e, n);
  const o = t === STATUS_PENDING && n instanceof NotReadyError ? n.source : void 0;
  {
    if (t === STATUS_PENDING && o) {
      addPendingSource(e, o);
      e.G = STATUS_PENDING | e.G & STATUS_UNINITIALIZED;
      setPendingError(e, o, n);
    } else {
      clearPendingSources(e);
      e.G = t | (t !== STATUS_ERROR ? e.G & STATUS_UNINITIALIZED : 0);
      ext(e).V = n;
    }
  }
  if (t === STATUS_PENDING && e.u & CONFIG_GUESS) {
    if (passLane === null) joinFuture(null);
    return;
  }
  const f = statusNotifierOf(e);
  if (f) {
    {
      f.call(e);
    }
    return;
  }
  propagateStatus(e, t, n);
}
function propagateStatus(e, t, n, r) {
  const o = t === STATUS_PENDING && n instanceof NotReadyError ? n.source : void 0;
  forEachDependent(e, (r2, f) => {
    r2.Ne = clock;
    if (r2.u & (CONFIG_REDERIVE | CONFIG_VERDICT) || t === STATUS_PENDING && f.Ue !== r2.Ge) {
      enqueueSub(r2);
      schedule();
      return;
    }
    if (t === STATUS_PENDING && o && r2.m?.Se?.has(o)) {
      if (passLane === null && (r2.u & (CONFIG_HELD | CONFIG_OVERRIDE)) === CONFIG_HELD && globalQueue.ee) joinFuture(txOf(r2));
      return;
    }
    if (t === STATUS_PENDING && o || t !== STATUS_PENDING && (r2.m?.V !== n || r2.m?.Se)) {
      {
        if (passLane !== null) GlobalQueue.M(r2, passLane, true, e);
        else {
          queuePendingNode(r2);
          if (t === STATUS_PENDING && (r2.u & (CONFIG_HELD | CONFIG_OVERRIDE)) === CONFIG_HELD && !r2.i) joinFuture(txOf(r2));
        }
      }
      notifyStatus(r2, t, n);
    }
  });
}

// node_modules/@solidjs/signals/dist/prod/core/core.js
GlobalQueue.Ce = (e) => {
  if (e.i === EFFECT_TRACKED) {
    deleteFromHeap(e, dirtyQueue);
    e.Fe = true;
    globalQueue.enqueue(EFFECT_USER, e.q);
  } else if (e.R & REACTIVE_ZOMBIE && !(e.R & REACTIVE_LANE_DIRTY)) deferZombie(e);
  else recompute(e);
};
GlobalQueue.he = disposeChildren;
var tracking = false;
var context = null;
var snapshotCaptureActive = false;
var snapshotSources = null;
function ownerInSnapshotScope(e) {
  while (e) {
    if (e.Ve) return true;
    e = e._parent;
  }
  return false;
}
function recompute(e, t = false) {
  bumpNotifyEpoch();
  const n = e.i;
  const E = passLane;
  setPassLane((e.R & REACTIVE_LANE_DIRTY || (e.u & (CONFIG_OVERRIDE | CONFIG_GUESS)) === CONFIG_OVERRIDE) && e.m?.ke?.Z ? e.m.ke : (
    // Loose `!=`: false with no creator lane (undefined == null).
    t && E?._parent.ye != E && (creatorPass(context)?.R ?? 0) & REACTIVE_RECOMPUTING_DEPS ? E : null
  ));
  if (!t) {
    deleteFromHeap(e, dirtyQueue);
    if (e.m !== null) {
      e.m.De = null;
      releaseFlightTeardown(e);
    }
    if (e.u & CONFIG_HELD) {
      const t2 = txOf(e);
      if (t2.Z) ;
      else if (n !== EFFECT_RENDER && !(e.u & CONFIG_VERDICT)) joinPassTx(t2);
      else if (t2 !== flushTransaction && !(e.G & STATUS_UNINITIALIZED)) {
        e.Ae = NOT_PENDING;
        if (n === EFFECT_RENDER) e.u &= ~CONFIG_HELD;
      }
    }
    if (n === EFFECT_TRACKED || e.u & CONFIG_STAGED) disposeChildren(e);
    else if (e.ge !== null || e.Pe !== null) parkChildren(e);
  }
  const u = !!(e.G & STATUS_UNINITIALIZED);
  const s = e.G & STATUS_ERROR ? e.m?.V : void 0;
  const i = (e.G & STATUS_PENDING) !== 0;
  const l = i ? e.m?.Se : void 0;
  const _ = e.m?.Se?.has(e);
  const o = (e.R & REACTIVE_REASK) !== 0 && !(e.G & STATUS_PENDING && e.m !== null && !e.m.be);
  const r = context;
  context = e;
  e.S = null;
  e.Ge++;
  e.R = REACTIVE_RECOMPUTING_DEPS | e.R & REACTIVE_ZOMBIE;
  e.Ne = clock;
  let I = e.Ae !== NOT_PENDING ? e.Ae : e.u & CONFIG_OVERRIDE ? e.m.Z : e.pe;
  let a = e.Le;
  let N = false;
  let f = false;
  let T = tracking;
  tracking = true;
  try {
    if (e.u & CONFIG_SYNC) {
      I = e.re(I);
      if (e.m !== null) e.m.De = null;
      e._e = false;
    } else {
      const t2 = e.m?.De;
      const n2 = e.re(I);
      const E2 = typeof n2 === "object" && n2 !== null;
      const u2 = e.m?.De !== t2;
      I = u2 || !E2 ? n2 : handleAsync(e, n2);
      if (!u2 && !E2) {
        if (e.m !== null) e.m.De = null;
        e._e = false;
      }
    }
    if (e.G !== 0 || e.m !== null) clearStatus(e, t);
  } catch (t2) {
    const n2 = t2 instanceof NotReadyError;
    if (n2 && e._e) {
      parkLoadingWindow(e, t2);
    } else {
      if (n2) ext(e).Ie = true;
      notifyStatus(e, n2 ? STATUS_PENDING : STATUS_ERROR, t2);
      if (n2 && _ && !e.m?.De) settlePendingSource(e);
      if (n2 && l) {
        for (const t3 of l) if (t3 !== e && !e.m?.Se?.has(t3)) settlePendingSource(e, t3);
      }
    }
  } finally {
    tracking = T;
    N = (e.R & REACTIVE_MISSED_WAKE) !== 0;
    f = (e.R & REACTIVE_JOINED) !== 0;
    if (!(e.R & REACTIVE_PROBED)) e.u &= ~CONFIG_VERDICT;
    e.R = e.R & (REACTIVE_ZOMBIE | REACTIVE_DISPOSED | REACTIVE_FRAME_READ | REACTIVE_STAGED_READ | REACTIVE_LANE_READ | REACTIVE_SCREEN_READ | REACTIVE_PROBE_UNANSWERED) | (t ? e.R & REACTIVE_SNAPSHOT_STALE : 0);
    context = r;
    if (e.m !== null) e.m.be = o && (e.G & STATUS_PENDING) !== 0;
  }
  if (e.R & REACTIVE_DISPOSED) {
    clearDeps(e);
    if (e.m !== null) e.m.De = null;
    setPassLane(E);
    return;
  }
  let S = passLane;
  const c = !!e.m?.V;
  if (S !== null) {
    if (GlobalQueue.M(e, S, t, c)) setPassLane(S);
    else S = null;
  }
  if (!e.m?.V) {
    const i2 = e.Ae !== NOT_PENDING ? e.Ae : e.u & CONFIG_OVERRIDE && e.m.Z !== NOT_PENDING ? e.m.Z : e.pe;
    let o2 = false;
    try {
      o2 = !n && u || !e.We || !e.We(i2, I);
    } catch (t2) {
      notifyStatus(e, STATUS_ERROR, t2);
    }
    if (n && o2 && // A stale reader of a lane (REACTIVE_SCREEN_READ) that computed what it
    // last applied owes no run (lanes.ts).
    !(e.R & REACTIVE_SCREEN_READ && !e.Fe && Object.is(e.Ze, I)) && // A re-staging pass owes no run: the commit replays the effect (#3802).
    e.Ae === NOT_PENDING) {
      e.Fe = !e.m?.V;
      if (!t || S !== null) globalQueue.enqueue(n, e.J ??= GlobalQueue.X.bind(null, e), S);
    }
    if (!t && S === null && e.u & CONFIG_GUESS && GlobalQueue.Qe(e, I, c)) ;
    else if (c) ;
    else if (o2) {
      if (S !== null) {
        if (n && e.Ae === NOT_PENDING) e.pe = I;
        else if (n || S.ve) e.Ae = I;
        else e.m.Z = I;
      } else if (t ? !((flushTransaction !== null || passTx !== null) && (f || E && e.R & REACTIVE_STAGED_READ || (creatorPass(r)?.R ?? 0) & REACTIVE_JOINED)) : n && e.Ae === NOT_PENDING) {
        e.pe = I;
      } else {
        e.Ae = I;
        if (t) {
          holdNode(e, flushTransaction ?? passTx);
          e.G |= STATUS_UNINITIALIZED;
        }
      }
      if (e.t !== null) {
        insertSubs(e);
        if (S !== null) laneDirty(e, S);
      }
    } else if (e.Le != a) {
      for (let t2 = e.t; t2 !== null; t2 = t2.l) insertIntoHeapHeight(t2.o, dirtyQueue);
    }
    if (!o2 && !e.m?.V) {
      if (s !== void 0) settleErroredDependents(e, s);
      if (l) {
        for (const t2 of l) if (t2 !== e) settlePendingSource(e, t2);
      }
    }
    if (_ && !(e.G & (STATUS_PENDING | STATUS_UNINITIALIZED))) settlePendingSource(e);
  }
  if (t && S === null && (f || E && e.R & REACTIVE_STAGED_READ) && e.G & STATUS_PENDING) ext(e).Re = flushTransaction ?? passTx;
  if (!e.m?.V && e.Ae === NOT_PENDING && !(n && e.Fe)) {
    if (t || n === EFFECT_TRACKED) trimStaleDeps(e);
    else heldTrim(e);
  }
  if (e.Ae !== NOT_PENDING || e.m !== null && (e.m.Me !== null || e.m.Be !== null) || (e.G & (STATUS_PENDING | STATUS_UNINITIALIZED)) !== 0 && (!t || (e.G & STATUS_PENDING) !== 0)) {
    e.u |= CONFIG_STAGED;
    if (S === null) queuePendingNode(e);
  }
  setPassLane(E);
  if (N) {
    enqueueSub(e);
    schedule();
  }
}
function updateIfNecessary(e) {
  if (e.R & (REACTIVE_RECOMPUTING_DEPS | REACTIVE_DISPOSED)) return;
  if (e.R & REACTIVE_CHECK) {
    for (let t = e._; t; t = t.p) {
      const n = t.I;
      if (n.re) {
        updateIfNecessary(n);
      }
      if (e.R & REACTIVE_DIRTY) {
        break;
      }
    }
  }
  if (e.R & REACTIVE_DIRTY || e.m?.V && e.Ne < clock && !e.m?.De) {
    recompute(e);
  }
  e.R = e.R & (REACTIVE_SNAPSHOT_STALE | REACTIVE_IN_HEAP | REACTIVE_IN_HEAP_HEIGHT | REACTIVE_ZOMBIE | REACTIVE_DISPOSED | REACTIVE_MANUAL_WRITE | REACTIVE_FRAME_READ | REACTIVE_STAGED_READ | REACTIVE_LANE_READ | REACTIVE_SCREEN_READ | REACTIVE_PROBE_UNANSWERED);
}
function computed(e, t) {
  const n = t?.transparent ?? false;
  const E = t !== null && typeof t === "object" && "loadingValue" in t;
  const u = {
    id: inheritId(t, n, context),
    u: (n ? CONFIG_TRANSPARENT : 0) | (t?.ownedWrite ? CONFIG_OWNED_WRITE : 0) | (!context || t?.lazy ? CONFIG_AUTO_DISPOSE : 0) | (t?.sync ? CONFIG_SYNC : 0) | (t?.ie ? CONFIG_NO_SNAPSHOT : 0) | (t?.we ?? 0) | (snapshotCaptureActive && ownerInSnapshotScope(context) ? CONFIG_IN_SNAPSHOT_SCOPE : 0),
    We: t?.equals ?? isEqual,
    Pe: null,
    U: context?.U ?? defaultContext,
    Ye: 0,
    re: e,
    pe: E ? t.loadingValue : void 0,
    Le: 0,
    je: void 0,
    Ke: null,
    _: null,
    S: null,
    Ge: 0,
    t: null,
    qe: null,
    _parent: context,
    me: null,
    Je: null,
    ge: null,
    R: t?.lazy ? REACTIVE_LAZY : REACTIVE_NONE,
    // A loadingValue node is born committed: commit #0 is already in _value.
    G: E ? 0 : STATUS_UNINITIALIZED,
    Ne: clock,
    Ae: NOT_PENDING,
    ze: -1,
    _e: E,
    // Cold machinery (async slots) lives one hop away in the lazily-allocated extension — the core literal MUST
    // stay under V8's in-object boundary (§12: past ~39 fields every
    // allocation spills to a backing store and creation cost ~4x's).
    m: null
  };
  if (t?.unobserved) ext(u).Xe = t.unobserved;
  setupComputedNode(u, t);
  return u;
}
function ext(e) {
  return e.m ??= {
    De: null,
    Te: null,
    V: void 0,
    Ie: void 0,
    Se: void 0,
    Xe: void 0,
    xe: void 0,
    Me: null,
    Be: null,
    ke: null,
    Re: null,
    be: false,
    $e: NOT_PENDING,
    et: -1,
    Oe: 0,
    Z: NOT_PENDING,
    T: 0
  };
}
function joinPass(e, t) {
  e.R |= REACTIVE_JOINED;
  if (t.G & STATUS_UNINITIALIZED || e.i !== EFFECT_RENDER) joinPassTx(txOf(t), GlobalQueue.ce?.(e));
}
function frameRead(e, t) {
  const n = e.u & CONFIG_VERDICT;
  if ((passLane === null || e.G & STATUS_UNINITIALIZED && t.G & STATUS_PENDING) && !n && (e.i !== EFFECT_RENDER || t.u & CONFIG_INPUTS_PUBLISHED)) return false;
  const E = txOf(t);
  if (E === flushTransaction && passLane === null && !n || e.G & STATUS_UNINITIALIZED && e.u & CONFIG_HELD && txOf(e) === E) return false;
  staleReader(e, E);
  return true;
}
function creatorPass(e) {
  return e !== null && e.Et ? e.ut : e;
}
function parkChildren(e) {
  markDisposal(e);
  const t = ext(e);
  t.Be = e.Pe;
  t.Me = e.ge;
  e.Pe = null;
  e.ge = null;
  e.Ye = 0;
}
function createEffectNode(e, t, n, E, u) {
  const s = u?.transparent ?? false;
  const i = {
    id: inheritId(u, s, context),
    u: (s ? CONFIG_TRANSPARENT : 0) | (u?.ownedWrite ? CONFIG_OWNED_WRITE : 0) | (u?.sync ? CONFIG_SYNC : 0) | (u?.we ?? 0) | (snapshotCaptureActive && ownerInSnapshotScope(context) ? CONFIG_IN_SNAPSHOT_SCOPE : 0),
    We: false,
    Pe: null,
    U: context?.U ?? defaultContext,
    Ye: 0,
    re: e,
    pe: void 0,
    Le: 0,
    je: void 0,
    Ke: null,
    _: null,
    S: null,
    Ge: 0,
    t: null,
    qe: null,
    _parent: context,
    me: null,
    Je: null,
    ge: null,
    R: REACTIVE_LAZY,
    G: STATUS_UNINITIALIZED,
    Ne: clock,
    Ae: NOT_PENDING,
    ze: -1,
    _e: false,
    Fe: false,
    Ze: void 0,
    st: t,
    it: n,
    lt: void 0,
    i: E,
    m: null
  };
  if (u?.unobserved) ext(i).Xe = u.unobserved;
  setupComputedNode(i, lazyOptions);
  return i;
}
var effectStatusNotify = null;
function setEffectStatusNotify(e) {
  effectStatusNotify = e;
}
function statusNotifierOf(e) {
  return e.i ? effectStatusNotify ?? void 0 : void 0;
}
var lazyOptions = {
  lazy: true
};
function setupComputedNode(e, t) {
  e.Ke = e;
  const n = context?.Et ? context.ut : context;
  if (context) linkChild(context, e);
  if (n) e.Le = n.Le + 1;
  GlobalQueue._t?.(e);
  !t?.lazy && recompute(e, true);
  if (snapshotCaptureActive && !t?.lazy) {
    if (!(e.G & STATUS_PENDING) && !(e.u & CONFIG_NO_SNAPSHOT)) {
      ext(e).xe = e.pe === void 0 ? NO_SNAPSHOT : e.pe;
      e.u |= CONFIG_HAS_SNAPSHOT;
      snapshotSources.add(e);
    }
  }
}
function signal(e, t) {
  const n = {
    We: t?.equals ?? isEqual,
    u: (t?.ownedWrite ? CONFIG_OWNED_WRITE : 0) | (t?.ie ? CONFIG_NO_SNAPSHOT : 0),
    pe: e,
    t: null,
    qe: null,
    Ne: clock,
    Ae: NOT_PENDING,
    // Signal-literal diet (§12e): NO _time/_fn/_statusFlags slots. Stores
    // materialize one signal per touched leaf, so signal bytes are store
    // bytes. _time is write-only on signals (every read site is computed-
    // typed error-retry gating); _fn/_statusFlags read falsy-identically as
    // missing properties on the shared paths (undefined masks to 0).
    ze: -1,
    m: null
  };
  if (t?.unobserved) ext(n).Xe = t.unobserved;
  if (snapshotCaptureActive && !(n.u & CONFIG_NO_SNAPSHOT)) {
    ext(n).xe = e === void 0 ? NO_SNAPSHOT : e;
    n.u |= CONFIG_HAS_SNAPSHOT;
    snapshotSources.add(n);
  }
  return n;
}
function isEqual(e, t) {
  return e === t;
}
function slotSignal(e, t, n, E, u) {
  const s = {
    We: t,
    u: CONFIG_OWNED_WRITE | CONFIG_SLOT_NODE,
    pe: e,
    t: null,
    qe: null,
    Ne: clock,
    Ae: NOT_PENDING,
    ze: -1,
    m: null,
    ot: n,
    rt: E,
    acc: u,
    px: void 0,
    pxv: void 0
  };
  return s;
}
var verdict = null;
function untrack(e, t) {
  if (GlobalQueue.It === null && !tracking && true) return e();
  const n = tracking;
  tracking = false;
  try {
    if (GlobalQueue.It) return GlobalQueue.It(e);
    return e();
  } finally {
    tracking = n;
  }
}
var spectating = false;
function prepareComputed(e, t) {
  if (e.R & REACTIVE_LAZY) {
    e.R &= ~REACTIVE_LAZY;
    recompute(e, true);
  } else if (e.R & REACTIVE_DISPOSED) {
    if (e.u & CONFIG_AUTO_DISPOSE) {
      const t2 = e._parent;
      if (t2 !== null) {
        if (t2.R & REACTIVE_DISPOSED) {
          e.u &= ~CONFIG_AUTO_DISPOSE;
          return;
        }
        if (!(e.R & REACTIVE_ZOMBIE)) linkChild(t2, e);
      }
      recompute(e, true);
    }
  } else ;
}
function readerSeesCommitted(e, t) {
  return !!(!t || e.Ae === NOT_PENDING || t.u & CONFIG_CHILDREN_FORBIDDEN);
}
var unflushedStaged = false;
function markUnflushedStaged() {
  unflushedStaged = true;
}
function unflushedValue(e) {
  if (globalQueue.ee || e.Ae === NOT_PENDING || e.u & CONFIG_PROMOTED) return NOT_PENDING;
  if (e.u & CONFIG_HELD) return e.m.et === clock ? e.m.$e : NOT_PENDING;
  return e.pe;
}
function stashFlushed(e) {
  const t = e.m;
  if (t.et !== clock) {
    t.$e = e.Ae;
    t.et = clock;
    unflushedStaged = true;
  }
}
var promotedWrites = [];
function markLateLinker(e) {
  e.R |= REACTIVE_MISSED_WAKE;
  return true;
}
function resyncUnflushedCompanions() {
  unflushedStaged = false;
  if (promotedWrites.length !== 0) {
    for (const e of promotedWrites) e.u &= ~CONFIG_PROMOTED;
    promotedWrites.length = 0;
  }
}
function pullComputed(e, t) {
  if (e.Le >= dirtyQueue.He) {
    markNode(t);
    markHeap(dirtyQueue);
    updateIfNecessary(e);
  } else if (t.u & CONFIG_FRESH_READ) updateIfNecessary(e);
  const n = e.Le;
  if (n >= t.Le && e._parent !== t) t.Le = n + 1;
}
function read(e) {
  let t = context;
  if (t?.Et) t = t.ut;
  const n = e;
  const E = e;
  if (typeof n.re === "function") prepareComputed(e);
  if (verdict !== null) return verdict(e, t);
  if (!n.re && e.m?.xe === void 0 && !snapshotCaptureActive && (!unflushedStaged || e.Ae === NOT_PENDING) && // A28, see readNodeFast
  !(e.u & CONFIG_OVERRIDE) && // lanes: the slow path's one arm
  true) {
    if (t) {
      if (tracking) link(e, t);
      if (e.u & CONFIG_HELD && !(t.u & CONFIG_CHILDREN_FORBIDDEN)) {
        if (frameRead(t, e)) return e.pe;
        joinPass(t, e);
      }
    }
    if (!t || e.Ae === NOT_PENDING || t.u & CONFIG_CHILDREN_FORBIDDEN) return e.pe;
    if (t.u & CONFIG_VERDICT && stagedScreen(t)) return e.pe;
    stagedRead(t);
    return e.Ae;
  }
  let u = false;
  if (t) {
    if (tracking) {
      link(e, t);
      if (E.re) pullComputed(E, t);
    }
    if (e.u & CONFIG_HELD && !(e.u & CONFIG_OVERRIDE) && !(t.u & CONFIG_CHILDREN_FORBIDDEN)) {
      if (E.G & STATUS_UNINITIALIZED || !frameRead(t, e)) joinPass(t, e);
      else u = true;
    }
  }
  if (e.u & CONFIG_OVERRIDE) {
    const n2 = GlobalQueue.Nt(t, e);
    if (n2 !== NOT_PENDING) return n2;
  }
  if (E.G & STATUS_PENDING && !u && !(e.u & CONFIG_OVERRIDE) && !(E.G & STATUS_UNINITIALIZED)) {
    if (passLane !== null && !(t?.G & STATUS_UNINITIALIZED)) u = true;
    else if (t !== null && t.u & CONFIG_VERDICT) u = GlobalQueue.ft(t, E);
  }
  if (E.G & STATUS_PENDING && !u) {
    if (t) {
      if (!(t.u & CONFIG_CHILDREN_FORBIDDEN) || E.G & STATUS_UNINITIALIZED) {
        if (!tracking && !spectating && e !== t) link(e, t);
        throw E.m?.V;
      }
    } else if (E.G & STATUS_UNINITIALIZED) {
      throw E.m?.V;
    }
  }
  if (E.re && E.G & STATUS_ERROR) {
    if (tracking && E.Ne < clock) {
      recompute(E);
      return read(e);
    } else throw E.m?.V;
  }
  if (snapshotCaptureActive && t && t.u & CONFIG_IN_SNAPSHOT_SCOPE) {
    const n2 = e.m?.xe;
    if (n2 !== void 0) {
      const E2 = n2 === NO_SNAPSHOT ? void 0 : n2;
      const u2 = e.Ae !== NOT_PENDING ? e.Ae : e.pe;
      if (u2 !== E2) t.R |= REACTIVE_SNAPSHOT_STALE;
      return E2;
    }
  }
  if (u) return e.pe;
  const s = serve(e, t);
  if (!t && typeof n.re === "function" && e.u & CONFIG_AUTO_DISPOSE && !(E.G & STATUS_PENDING) && !e.t) {
    dormantNodes.add(e);
    schedule();
  }
  return s;
}
function serve(e, t) {
  if (e.Ae !== NOT_PENDING && e.G & STATUS_UNINITIALIZED && (!t || spectating || t.u & CONFIG_CHILDREN_FORBIDDEN)) throw new NotReadyError(null);
  const n = t && unflushedStaged ? unflushedValue(e) : NOT_PENDING;
  if (n !== NOT_PENDING) {
    markLateLinker(t);
    return n;
  }
  if (readerSeesCommitted(e, t)) return e.pe;
  if (t.u & CONFIG_VERDICT && !(e.G & STATUS_UNINITIALIZED) && stagedScreen(t)) return e.pe;
  stagedRead(t, e);
  return e.Ae;
}
function stagedRead(e, t) {
  e.R |= REACTIVE_STAGED_READ;
  if (passLane !== null && !(t?.G & STATUS_UNINITIALIZED)) stagedReaders.push(e);
}
function stagedScreen(e) {
  if (flushTransaction === null) return false;
  staleReader(e, flushTransaction);
  return true;
}
function notePromotedWrite(e) {
  if (globalQueue.ee || e.u & CONFIG_PROMOTED) return;
  e.u |= CONFIG_PROMOTED;
  promotedWrites.push(e);
}
function captureWriteSnapshot(e, t) {
  if (e.u & CONFIG_NO_SNAPSHOT || e.re !== void 0 || e.m?.xe !== void 0) return;
  ext(e).xe = t === void 0 ? NO_SNAPSHOT : t;
  e.u |= CONFIG_HAS_SNAPSHOT;
  snapshotSources.add(e);
}
function setSignal(e, t) {
  const n = e.Ae === NOT_PENDING ? e.pe : e.Ae;
  if (typeof t === "function") t = t(n);
  if (e.u & CONFIG_OVERRIDE) return GlobalQueue.Tt(e, t);
  if (e.u & CONFIG_HELD) joinFuture(txOf(e));
  const E = !!(e.G & STATUS_UNINITIALIZED) || !e.We || !e.We(n, t);
  if (!E) return t;
  if (snapshotCaptureActive) captureWriteSnapshot(e, n);
  const u = e.Ae !== NOT_PENDING;
  if (!u) queuePendingNode(e);
  else if (e.u & CONFIG_HELD && !globalQueue.ee) stashFlushed(e);
  e.Ae = t;
  if (context !== null) notePromotedWrite(e);
  if (e.re !== void 0) e.Ne = clock;
  if (u && e.ze === notifyEpoch) return t;
  insertSubs(e);
  schedule();
  return t;
}
function setMemo(e, t) {
  const n = e.u & CONFIG_HELD && !(e.R & REACTIVE_MANUAL_WRITE) && txOf(e) !== flushTransaction;
  if (n && typeof t === "function") t = t(e.pe);
  const E = setSignal(e, t);
  if (n) {
    e.R = e.R & ~REACTIVE_CHECK | REACTIVE_DIRTY;
    insertIntoHeap(e, dirtyQueue);
    schedule();
  } else if (e.Ae !== NOT_PENDING) e.R |= REACTIVE_MANUAL_WRITE;
  return E;
}
function runWithOwner(e, t) {
  const n = context;
  const E = tracking;
  context = e;
  tracking = false;
  try {
    return t();
  } finally {
    context = n;
    tracking = E;
  }
}
function staleValues(e, t = true) {
  try {
    return e();
  } finally {
  }
}
function markRefresh(e) {
  if (typeof e.re === "function" && !(e.R & REACTIVE_DISPOSED)) {
    e.R = e.R & ~REACTIVE_CHECK | REACTIVE_DIRTY | (e.R & (REACTIVE_DIRTY | REACTIVE_CHECK | REACTIVE_IN_HEAP) ? 0 : REACTIVE_REASK);
    insertIntoHeap(e, dirtyQueue);
    schedule();
  }
}

// node_modules/@solidjs/signals/dist/prod/core/lanes.js
var lanes = [];
function newLane(e) {
  const n = newTransaction(true, e);
  lanes.push(n);
  return n;
}
function laneValueOf(e) {
  if (!(e.u & CONFIG_GUESS) && e.Ae !== NOT_PENDING) return e.Ae;
  const n = e.m.Z;
  return n !== NOT_PENDING ? n : e.pe;
}
function display(e) {
  const n = e.m.Z;
  return e.m.ke.ve && n !== NOT_PENDING ? n : e.pe;
}
var pendingGuesses = [];
function guessedValueOf(e) {
  const n = pendingGuessOf(e);
  if (n !== NOT_PENDING) return n;
  return e.u & CONFIG_OVERRIDE ? laneValueOf(e) : e.pe;
}
function pendingGuessOf(e) {
  for (let n = pendingGuesses.length - 3; n >= 0; n -= 3) if (pendingGuesses[n] === e) return pendingGuesses[n + 1];
  return NOT_PENDING;
}
function optimisticWrite(e, n) {
  const u = guessedValueOf(e);
  if (typeof n === "function") n = n(u);
  if (e.We && e.We(u, n) && !(e.u & CONFIG_GUESS)) return n;
  pendingGuesses.push(e, n, question || nextQuestion());
  schedule();
  return n;
}
function inFlight(e) {
  return (e.G & STATUS_PENDING) !== 0 || (e.u & CONFIG_SLOT_NODE) !== 0 && GlobalQueue.F?.(e) === true;
}
function applyGuesses(e) {
  let n = null;
  for (let u = 0; u < pendingGuesses.length; u += 3) {
    const l = pendingGuesses[u];
    const t = pendingGuesses[u + 1];
    let s = true;
    if (l.u & CONFIG_OVERRIDE) {
      s = !l.We || !l.We(laneValueOf(l), t);
      if (!(l.u & CONFIG_GUESS)) {
        l.Ae = NOT_PENDING;
        l.u |= CONFIG_GUESS;
      }
      l.m.Z = t;
      const n2 = txOf(l)._parent;
      if (e !== null && n2 !== null) merge(e, n2);
    } else {
      let u2;
      if (l.u & CONFIG_HELD) u2 = newLane(txOf(l));
      else {
        if (e === null && inFlight(l)) e = newTransaction(false);
        if (e === null) continue;
        u2 = n ??= newLane(e);
      }
      ext(l).Z = t;
      l.u |= CONFIG_OVERRIDE | CONFIG_GUESS;
      list(l, u2);
    }
    ext(l).Oe = pendingGuesses[u + 2];
    if (s) {
      insertSubs(l);
      laneDirty(l, txOf(l));
    }
  }
  pendingGuesses.length = 0;
}
function enterLane(e, n) {
  n.R |= REACTIVE_LANE_READ;
  const u = passLane;
  if (u === null) {
    setPassLane(e);
    if (n.R & REACTIVE_JOINED) stagedRead(n);
    return;
  }
  if (sameLane(u, e)) return setPassLane(e);
  if (under(u, e)) return;
  if (under(e, u)) return setPassLane(e);
  linkLanes(u, e);
  setPassLane(e);
}
function under(e, n) {
  for (let u = e._parent; u !== null && u.Z; u = u._parent) if (u === n) return true;
  return false;
}
function linkLanes(e, n) {
  const u = e.nn ?? (e.nn = [e]);
  const l = n.nn;
  if (l === u) return;
  if (l === null) {
    u.push(n);
    n.nn = u;
  } else for (let e2 = 0; e2 < l.length; e2++) {
    u.push(l[e2]);
    l[e2].nn = u;
  }
}
function linkBlocked(e) {
  const n = e.nn;
  if (n !== null) for (let u = 0; u < n.length; u++) {
    const l = n[u];
    if (l !== e && (l.tt !== 0 || ownFlights(l) || nestedBlocked(l))) return true;
  }
  return false;
}
function unlink(e) {
  const n = e.nn;
  if (n === null) return;
  const u = n.indexOf(e);
  if (u !== -1) n.splice(u, 1);
  e.nn = null;
}
function verdictLane(e) {
  return e.ye ??= newLane(e);
}
function laneStage(e, n, u, l) {
  if (!(u || l || e.R & REACTIVE_LANE_READ || e.u & CONFIG_GUESS)) {
    if (e.m !== null) {
      if (e.m.ke?.Z) e.m.ke = null;
      e.m.Z = NOT_PENDING;
    }
    e.u &= -2305;
    return false;
  }
  if (!e.i) {
    if (!(e.u & CONFIG_OVERRIDE)) {
      e.Ae = NOT_PENDING;
      e.u = e.u & ~CONFIG_HELD | CONFIG_OVERRIDE;
      ext(e);
    }
    if (!l) e.u &= ~CONFIG_GUESS;
  } else if (l) {
    if (l !== true && !(l.G & STATUS_UNINITIALIZED) && (e.u & CONFIG_HELD || e.R & REACTIVE_RECOMPUTING_DEPS) && !e.m?.ke?.Z) {
      queuePendingNode(e);
      return false;
    }
    e.R |= REACTIVE_LANE_DIRTY;
  }
  list(e, n);
  return true;
}
function supersede(e, n, u) {
  const l = txOf(e);
  const t = resolveTx(l._parent ?? l);
  if (u) {
    dissolveLane(l, t, e);
    if (l.ve) e.pe = e.m.Z;
    e.u &= -10241;
    e.m.Z = NOT_PENDING;
    e.Ae = n;
    holdNode(e, t);
    joinFuture(t);
    if (e.t !== null) insertSubs(e);
  } else {
    e.Ae = n;
    e.u |= CONFIG_HELD;
    joinFuture(t);
    for (let n2 = e.t; n2 !== null; n2 = n2.l) if (n2.o.u & CONFIG_AUTHORITATIVE) enqueueSub(n2.o);
  }
}
function dissolveLane(e, n, u) {
  const l = lanes.indexOf(e);
  if (l !== -1) lanes.splice(l, 1);
  unlink(e);
  const t = e.ye;
  if (t !== null) {
    e.ye = null;
    if (lanes.indexOf(t) !== -1) dissolveLane(t, null);
  }
  for (let l2 = 0; l2 < e.un.length; l2++) {
    const t2 = e.un[l2];
    const s = t2.m;
    if (t2 === u || s.ke !== e) continue;
    const i = t2.i;
    const r = t2.u & CONFIG_GUESS;
    const o = s.Z;
    const E = e.ve && !i ? o : t2.pe;
    const f = laneValueOf(t2);
    s.Z = NOT_PENDING;
    t2.u &= -10241;
    if (n === null) {
      s.ke = null;
      if (!i && !r) t2.Ae = f;
      commitPendingNode(t2);
      if (!i) {
        if (t2.R & (REACTIVE_IN_HEAP | REACTIVE_DIRTY | REACTIVE_CHECK) || t2.G & STATUS_PENDING) t2.u |= CONFIG_INPUTS_PUBLISHED;
        if (E !== NOT_PENDING && (!t2.We || !t2.We(E, t2.pe))) insertSubs(t2);
      }
    } else if (r) {
      if (t2.Ae === NOT_PENDING) t2.Ae = covered(t2);
      if (e.ve) t2.pe = o;
      holdNode(t2, n);
      insertSubs(t2);
    } else {
      s.ke = null;
      if (!i) {
        if (E !== NOT_PENDING && e.ve) t2.Ae = E;
        if (t2.G & STATUS_PENDING) {
          s.De = null;
          enqueueSub(t2);
        }
      }
      if (e.ve) {
        commitPendingNode(t2);
        if (!i) t2.u |= CONFIG_INPUTS_PUBLISHED;
      } else {
        if (s.Me !== null || s.Be !== null) GlobalQueue.he(t2, false, true);
        t2.u &= -385;
      }
    }
  }
  if (n === null || e.ve && !e.ln) releaseQueues(e);
  else e.tn[0].length = e.tn[1].length = 0;
}
function laneRead(e, n) {
  const u = n.u & CONFIG_GUESS;
  if (e !== null && e.u & CONFIG_AUTHORITATIVE) return u && n.Ae !== NOT_PENDING ? n.Ae : n.pe;
  if (e === null) return laneValueOf(n);
  const l = txOf(n);
  const t = n.G;
  if (!tracking || e.u & CONFIG_CHILDREN_FORBIDDEN) {
    if (passLane === null || e.u & CONFIG_CHILDREN_FORBIDDEN) return display(n);
    enterLane(l, e);
    if (!u && t & STATUS_PENDING) return NOT_PENDING;
    return laneValueOf(n);
  }
  if (e.i === EFFECT_RENDER && (passLane === null || !sameLane(passLane, l))) {
    if (!u) {
      if (t & STATUS_PENDING && n.m.Z === NOT_PENDING) return NOT_PENDING;
      if (n.Ae !== NOT_PENDING && e.u & CONFIG_HELD && flushTransaction !== null && resolveTx(flushTransaction) === txOf(e)) return n.Ae;
    }
    if (l.ln || !u && t & STATUS_PENDING) {
      if (!u && !l.ve && t & STATUS_UNINITIALIZED) throw new NotReadyError(null);
      if (!(e.R & REACTIVE_SCREEN_READ)) {
        e.R |= REACTIVE_FRAME_READ | REACTIVE_SCREEN_READ;
        l.sn.push(e);
      }
      return display(n);
    }
  }
  enterLane(l, e);
  if (!u && t & STATUS_PENDING) return NOT_PENDING;
  return laneValueOf(n);
}
function covered(e) {
  return e.u & CONFIG_SLOT_NODE && GlobalQueue.rn !== void 0 ? GlobalQueue.rn(e) : e.pe;
}
function guessFlights(e) {
  for (let n = 0; n < e.un.length; n++) {
    const u = e.un[n];
    if (u.u & CONFIG_GUESS && u.m.ke === e && inFlight(u)) return true;
  }
  return false;
}
function laneCorrections() {
  let e = false;
  const n = lanes.slice();
  for (let u = 0; u < n.length; u++) {
    const l = n[u];
    if (lanes.indexOf(l) === -1) continue;
    const t = resolveTx(l._parent);
    if (!t.nt || t.tt !== 0 || t.Z || ownFlights(t) || guessFlights(l)) continue;
    e = true;
    for (let e2 = 0; e2 < l.un.length && lanes.indexOf(l) !== -1; e2++) {
      const n2 = l.un[e2];
      if (n2.u & CONFIG_GUESS && n2.m.ke === l) {
        const e3 = n2.Ae !== NOT_PENDING ? n2.Ae : covered(n2);
        supersede(n2, e3, !n2.We || !n2.We(n2.m.Z, e3));
      }
    }
  }
  return e;
}
function laneSeam(e, n) {
  if (n || blocked(e)) {
    e.ln = true;
    return;
  }
  e.ln = false;
  e.ve = true;
  reruns(e);
  for (let n2 = 0; n2 < e.un.length; n2++) {
    const u = e.un[n2];
    const l = u.m;
    if (l.ke !== e) continue;
    if (!(u.u & CONFIG_GUESS) && !u.i && u.Ae !== NOT_PENDING) {
      l.Z = u.Ae;
      u.Ae = NOT_PENDING;
    }
    if (l.Me !== null || l.Be !== null) GlobalQueue.he(u, false, true);
    u.u &= ~CONFIG_STAGED;
  }
  releaseQueues(e);
}
function endLanes(e) {
  for (let n = lanes.length - 1; n >= 0; n--) {
    const u = lanes[n];
    if (resolveTx(u._parent) !== e) continue;
    endLanes(u);
    dissolveLane(u, null);
  }
}
function lanesBlocked(e) {
  return e.Z && linkBlocked(e) || nestedBlocked(e);
}
function nestedBlocked(e) {
  for (let n = 0; n < lanes.length; n++) {
    const u = lanes[n];
    if (resolveTx(u._parent) !== e) continue;
    if (blocked(u) || guessFlights(u)) return true;
  }
  return false;
}
function laneWrite(e, n) {
  if (e.u & CONFIG_GUESS) {
    if (stale(e, question)) {
      e.Ae = n;
      e.u |= CONFIG_HELD;
      GlobalQueue.En?.(e, n);
      schedule();
      return n;
    }
    supersede(e, n, !e.We || !e.We(e.m.Z, n));
  } else {
    const u = txOf(e);
    if (e.We && e.We(laneValueOf(e), n)) return n;
    if (u.ve) e.Ae = n;
    else e.m.Z = n;
    if (e.re !== void 0) e.Ne = clock;
    insertSubs(e);
    laneDirty(e, u);
  }
  schedule();
  return n;
}
function laneOutcome(e, n, u) {
  if (u) return true;
  if (stale(e, answered(e))) {
    e.Ae = n;
    e.u |= CONFIG_HELD;
    return true;
  }
  supersede(e, n, !e.We || !e.We(e.m.Z, n));
  return true;
}
function stale(e, n) {
  return n !== 0 && n < e.m.Oe;
}
function answered(e) {
  let n = 0;
  for (let u = e._; u !== null; u = u.p) {
    const e2 = u.I;
    if (e2.m !== null && e2.m.Oe > n && e2.Ne === clock) n = e2.m.Oe;
  }
  return n;
}
GlobalQueue.Nt = laneRead;
GlobalQueue.M = laneStage;
GlobalQueue.Qe = laneOutcome;
GlobalQueue.Tt = laneWrite;
var judged = 0;
GlobalQueue.fn = (e) => {
  judged = lanes.length;
  if (pendingGuesses.length !== 0) applyGuesses(e);
};
GlobalQueue.Nn = (e) => {
  const n = [];
  if (e !== null) for (let u = 0; u < e.length; u++) {
    const l = e[u];
    const t = l.m?.ke;
    if (l.R & REACTIVE_DISPOSED || t != null && t._parent?.ye === t && (l.u & CONFIG_VERDICT ? !(l.R & REACTIVE_PROBE_UNANSWERED) : !blocked(t._parent))) continue;
    enqueueSub(l);
    if (t != null && t.Z && n.indexOf(t) === -1) n.push(t);
  }
  for (let e2 = Math.min(judged, lanes.length) - 1; e2 >= 0; e2--) laneSeam(lanes[e2], n.indexOf(lanes[e2]) !== -1);
};
GlobalQueue.an = () => lanes.length !== 0 && laneCorrections();
GlobalQueue.In = endLanes;
GlobalQueue.cn = lanesBlocked;
GlobalQueue.ne = verdictLane;

// node_modules/@solidjs/signals/dist/prod/core/action.js
function inTransaction(t, n, e) {
  const i = question;
  setQuestion(n);
  joinFuture(t);
  const o = e();
  if (actionDepth === 0) flush();
  setQuestion(i);
  return o;
}
function action(t) {
  return (...n) => new Promise((e, i) => {
    const o = t(...n);
    const r = newTransaction(false);
    r.tt = 1;
    r.nt = true;
    const s = nextQuestion();
    const done = (t2, n2, o2 = false) => {
      resolveTx(r).tt--;
      schedule();
      o2 ? i(n2) : e(t2);
    };
    const step = (t2, n2) => {
      let e2;
      enterAction();
      try {
        e2 = n2 ? o.throw(t2) : o.next(t2);
      } catch (t3) {
        exitAction();
        return done(void 0, t3, true);
      }
      exitAction();
      if (isThenable(e2)) return void e2.then(run, (t3) => done(void 0, t3, true));
      run(e2);
    };
    const run = (t2) => {
      if (t2.done) return done(t2.value);
      let n2 = false;
      try {
        if (isThenable(t2.value)) return void t2.value.then((t3) => {
          if (n2) return;
          n2 = true;
          inTransaction(r, s, () => step(t3));
        }, (t3) => {
          if (n2) return;
          n2 = true;
          inTransaction(r, s, () => step(t3, true));
        });
      } catch (t3) {
        if (n2) return;
        n2 = true;
        return void inTransaction(r, s, () => step(t3, true));
      }
      inTransaction(r, s, () => step(t2.value));
    };
    joinFuture(r);
    const u = question;
    setQuestion(s);
    step();
    setQuestion(u);
  });
}

// node_modules/@solidjs/signals/dist/prod/core/context.js
function getContext(e, t = getOwner()) {
  if (!t) {
    throw new NoOwnerError();
  }
  let r = t.U[e.id];
  if (r === void 0) r = e.defaultValue;
  if (r === void 0) {
    throw new ContextNotFoundError();
  }
  return r;
}
function setContext(e, t, r = getOwner()) {
  if (!r) {
    throw new NoOwnerError();
  }
  r.U = {
    ...r.U,
    [e.id]: t === void 0 ? e.defaultValue : t
  };
}

// node_modules/@solidjs/signals/dist/prod/core/effect.js
function effect(e, t, u, E) {
  const f = !!E?.user;
  const r = createEffectNode(e, t, u, f ? EFFECT_USER : EFFECT_RENDER, E);
  recompute(r, true);
  !E?.defer && r.Ae === NOT_PENDING && !r.m?.ke?.Z && (r.i === EFFECT_USER || E?.schedule ? globalQueue.enqueue(r.i, runEffect.bind(null, r)) : runEffect(r, r.i));
}
function notifyEffectStatus(e, t) {
  const u = e !== void 0 ? e : this.G;
  const E = t !== void 0 ? t : this.m?.V;
  if (u & STATUS_ERROR) {
    globalQueue.notify(this, STATUS_PENDING, 0);
    if (this.i === EFFECT_USER) {
      if (this.G & STATUS_ERROR) {
        this.Fe = true;
        globalQueue.enqueue(this.i, this.J ??= runEffect.bind(null, this));
      }
      return;
    }
    if (!globalQueue.notify(this, STATUS_ERROR, STATUS_ERROR)) {
      haltReactivity(unwrapStatusError(E));
      throw E;
    }
  } else if (this.i === EFFECT_RENDER) {
    globalQueue.notify(this, STATUS_PENDING | STATUS_ERROR, u, E);
  }
}
function runEffect(e, t) {
  if (!e.Fe || e.R & REACTIVE_DISPOSED) return;
  if (GlobalQueue.de && GlobalQueue.de(e)) return;
  if (e.G & STATUS_ERROR && e.i === EFFECT_USER) {
    const t2 = unwrapStatusError(e.m?.V);
    e.Ze = e.pe;
    e.Fe = false;
    try {
      e.it ? e.it(t2, () => {
        const t3 = e.lt;
        e.lt = void 0;
        t3?.();
      }) : console.error(t2);
    } catch (t3) {
      if (!globalQueue.notify(e, STATUS_ERROR, STATUS_ERROR)) {
        haltReactivity(t3);
        throw t3;
      }
    }
    return;
  }
  const u = e.m?.V == null;
  const E = e.lt;
  e.lt = void 0;
  try {
    E?.();
    const t2 = e.st(e.pe, e.Ze);
    if (false) ;
    e.lt = t2;
  } catch (t2) {
    ext(e).V = new StatusError(e, t2);
    e.G |= STATUS_ERROR;
    if (!globalQueue.notify(e, STATUS_ERROR, STATUS_ERROR)) {
      haltReactivity(t2);
      throw t2;
    }
  } finally {
    e.Ze = e.pe;
    e.Fe = false;
    if (u) trimStaleDeps(e);
  }
}
GlobalQueue.X = runEffect;
function trackedEffect(e, t) {
  const run = () => {
    if (!u.Fe || u.R & REACTIVE_DISPOSED) return;
    if (GlobalQueue.de && GlobalQueue.de(u)) return;
    try {
      u.Fe = false;
      recompute(u);
    } finally {
    }
  };
  const u = computed(() => {
    const t2 = u.lt;
    u.lt = void 0;
    t2?.();
    const E = staleValues(e);
    u.lt = E;
  }, {
    ...t,
    lazy: true
  });
  u.lt = void 0;
  u.u = u.u & ~CONFIG_AUTO_DISPOSE | CONFIG_CHILDREN_FORBIDDEN;
  u.Fe = true;
  u.i = EFFECT_TRACKED;
  u.q = run;
  enqueueSub(u);
  schedule();
}
setEffectStatusNotify(notifyEffectStatus);

// node_modules/@solidjs/signals/dist/prod/core/error-hooks.js
var ambientHook;
var reported = /* @__PURE__ */ new WeakSet();
function hookFor(e) {
  for (let n = e; n; n = n._parent) {
    const e2 = n[ROOT_ERROR_HOOK];
    if (e2 !== void 0) return e2;
  }
  return ambientHook;
}
function labels(e) {
  const n = [];
  for (let o = e; o; o = o._parent) {
    const e2 = o._name;
    if (typeof e2 === "string" && e2.length) n.push(e2);
  }
  return n.length ? n.reverse() : void 0;
}
function reportClientError(e, n, o) {
  const r = e !== null && (typeof e === "object" || typeof e === "function");
  if (r) {
    if (reported.has(e)) return;
    reported.add(e);
  }
  const t = hookFor(n);
  if (t === void 0) return;
  const i = {};
  const f = labels(n);
  const c = labels(o) ?? f;
  if (c !== void 0) i.ownerPath = c;
  if (f !== void 0) i.boundaryPath = f;
  try {
    t(e, i);
  } catch (e2) {
    console.error(e2);
  }
}

// node_modules/@solidjs/signals/dist/prod/signals.js
function accessor(e) {
  const t = read.bind(null, e);
  t[$REFRESH] = e;
  return t;
}
function createSignal(e, t) {
  if (typeof e === "function") {
    const r2 = computed(e, t);
    r2.u &= ~CONFIG_AUTO_DISPOSE;
    return [accessor(r2), setMemo.bind(null, r2)];
  }
  const r = signal(e, t);
  return [accessor(r), setSignal.bind(null, r)];
}
function createMemo(e, t) {
  return accessor(computed(e, t));
}
function createRenderEffect(e, t, r) {
  effect(e, t, void 0, r);
}
function watch(e, t, r, n = 0, o, c = flushTransaction) {
  computed(() => {
    let n2;
    try {
      n2 = e();
    } catch (e2) {
      if (e2 instanceof NotReadyError) throw e2;
      queueMicrotask(() => r(unwrapStatusError(e2)));
      return;
    }
    const u = getOwner();
    const i = flushTransaction ?? passTx;
    if (u.R & REACTIVE_JOINED && i !== null && (c === null || resolveTx(c) !== resolveTx(i))) {
      staleReader(u, resolveTx(i));
      return;
    }
    o?.(n2);
    queueMicrotask(() => t(n2));
  }, {
    we: n
  }).u |= CONFIG_REDERIVE;
}
function refresh(e) {
  const t = e?.[$REFRESH];
  if (!t) {
    return Promise.resolve(void 0);
  }
  markRefresh(t);
  const r = flushTransaction;
  const n = new Promise((n2, o) => {
    queueMicrotask(() => {
      let c = null;
      const make = () => watch(() => {
        if (c === null) c = getOwner();
        return read(t);
      }, (t2) => {
        n2(typeof e === "function" ? t2 : e);
        dispose(c);
      }, (e2) => {
        o(e2);
        dispose(c);
      }, CONFIG_FRESH_READ, void 0, r);
      make();
    });
  });
  n.catch(() => {
  });
  return n;
}
function onSettled(e) {
  const t = getOwner();
  t && !(t.u & CONFIG_CHILDREN_FORBIDDEN) ? trackedEffect(() => untrack(e), void 0) : globalQueue.enqueue(EFFECT_USER, function fire() {
    if (dirtyQueue.At >= dirtyQueue.He) return globalQueue.enqueue(EFFECT_USER, fire);
    e();
  });
}

// node_modules/@solidjs/signals/dist/prod/store/types.js
var $TRACK = /* @__PURE__ */ Symbol(0);
var $TARGET = /* @__PURE__ */ Symbol(0);
var $PROXY = /* @__PURE__ */ Symbol(0);
var $RECORD = /* @__PURE__ */ Symbol(0);
var rawValues = /* @__PURE__ */ new WeakSet();
var rawValuesUsed = false;
function isRawValue(e) {
  return rawValuesUsed && rawValues.has(e);
}
function markRawOne(e) {
  if (isWrappable(e)) {
    if (e[$TARGET] !== void 0) return;
    rawValuesUsed = true;
    rawValues.add(e);
  }
}
function markRawIngest(e) {
  if (Array.isArray(e)) {
    for (let r = 0, a = e.length; r < a; r++) markRawOne(e[r]);
  } else {
    for (const r in e) markRawOne(e[r]);
  }
}
var OBJECT_PROTO = Object.prototype;
var wrappableProtos = /* @__PURE__ */ new WeakMap();
function isWrappable(e) {
  if (e == null || typeof e !== "object" || Object.isFrozen(e)) return false;
  const r = Object.getPrototypeOf(e);
  if (r === OBJECT_PROTO || r === null) return true;
  if (Array.isArray(e)) return true;
  let a = wrappableProtos.get(r);
  if (a === void 0) {
    a = Object.prototype.toString.call(e) === "[object Object]" && (typeof Node === "undefined" || !(e instanceof Node));
    wrappableProtos.set(r, a);
  }
  return a;
}
var writeOverride = false;
function setWriteOverride(e) {
  writeOverride = e;
}

// node_modules/@solidjs/signals/dist/prod/map.js
function mapArray(t, s, e) {
  const i = typeof e?.keyed === "function" ? e.keyed : void 0;
  const r = s.length > 1;
  const n = s;
  const o = {
    v: createOwner(),
    ht: 0,
    ct: t,
    wt: [],
    Ot: n,
    yt: [],
    un: [],
    rt: i,
    Mt: i || e?.keyed === false ? [] : void 0,
    gt: r && e?.keyed !== false ? [] : void 0,
    St: e?.keyed === false,
    P: e?.fallback
  };
  const h = computed(updateKeyedMap.bind(o), void 0);
  h.u &= ~CONFIG_AUTO_DISPOSE;
  return accessor(h);
}
var pureOptions = {
  ownedWrite: true
};
function trySmallMove(t, s, e, i) {
  const r = t.wt;
  const n = t.ht - 1;
  const o = [];
  const h = [];
  const f = [];
  let c = 256;
  let a = i;
  let u = i;
  let l = false;
  while (a <= n && u <= e - 1) {
    const t2 = r[a];
    const i2 = s[u];
    if (t2 === i2) {
      if (!l) {
        f.push(a, u, 0);
        l = true;
      }
      f[f.length - 1]++;
      a++;
      u++;
      continue;
    }
    l = false;
    let p = -1;
    let d = Math.min(32 - o.length, n - a, c);
    for (let t3 = 1; t3 <= d; t3++) {
      if (r[a + t3] === i2) {
        p = t3;
        break;
      }
    }
    c -= p === -1 ? d : p;
    let w = -1;
    d = Math.min(32 - h.length, e - 1 - u, c);
    for (let e2 = 1; e2 <= d; e2++) {
      if (s[u + e2] === t2) {
        w = e2;
        break;
      }
    }
    c -= w === -1 ? d : w;
    if (p !== -1 && (w === -1 || p <= w)) {
      while (p-- > 0) o.push(a++);
      continue;
    }
    if (w !== -1) {
      while (w-- > 0) h.push(u++);
      continue;
    }
    if (c <= 0 || o.length === 32 || h.length === 32) return false;
    o.push(a++);
    h.push(u++);
  }
  for (; a <= n; a++) {
    if (o.length === 32) return false;
    o.push(a);
  }
  for (; u <= e - 1; u++) {
    if (h.length === 32) return false;
    h.push(u);
  }
  return commitSmallMove(t, s, e, o, h, f);
}
function commitSmallMove(t, s, e, i, r, n) {
  const o = t.wt;
  let h;
  let f;
  let c;
  if (r.length !== 0) {
    c = new Array(i.length);
    for (f = 0; f < r.length; f++) {
      let t2 = -1;
      for (h = 0; h < i.length; h++) {
        if (!c[h] && o[i[h]] === s[r[f]]) {
          t2 = h;
          break;
        }
      }
      if (t2 === -1) return false;
      c[t2] = true;
      r[f] = r[f] << 6 | t2;
    }
  }
  if (i.length !== 0 || r.length !== 0) {
    const t2 = /* @__PURE__ */ new Set();
    for (h = 0; h < i.length; h++) t2.add(o[i[h]]);
    for (f = 0; f < r.length; f++) t2.add(s[r[f] >> 6]);
    for (let s2 = 0; s2 < n.length; s2 += 3) {
      const e2 = n[s2];
      for (let i2 = 0, r2 = n[s2 + 2]; i2 < r2; i2++) if (t2.has(o[e2 + i2])) return false;
    }
  }
  const a = t.yt;
  const u = t.un;
  const l = a.slice(0, e);
  const p = u.slice(0, e);
  for (let t2 = 0; t2 < n.length; t2 += 3) {
    const s2 = n[t2];
    const e2 = n[t2 + 1];
    if (s2 !== e2) {
      for (let i2 = 0; i2 < n[t2 + 2]; i2++) {
        l[e2 + i2] = a[s2 + i2];
        p[e2 + i2] = u[s2 + i2];
      }
    }
  }
  for (f = 0; f < r.length; f++) {
    const t2 = r[f] >> 6;
    const s2 = i[r[f] & 63];
    l[t2] = a[s2];
    p[t2] = u[s2];
  }
  t.yt = l;
  t.un = p;
  t.ht = e;
  t.wt = s.slice(0);
  for (h = 0; h < i.length; h++) {
    if (c === void 0 || !c[h]) u[i[h]].dispose();
  }
  return true;
}
function updateKeyedMap() {
  this.v.ut = getOwner();
  const t = this.ct() || [], s = t.length;
  t[$TRACK];
  runWithOwner(this.v, () => {
    let e, i, r, n, o = this.Mt ? this.St ? () => {
      r[i] = signal(t[i], pureOptions);
      return this.Ot(accessor(r[i]), i);
    } : () => {
      r[i] = signal(t[i], pureOptions);
      n && (n[i] = signal(i, pureOptions));
      return this.Ot(accessor(r[i]), n ? accessor(n[i]) : void 0);
    } : this.gt ? () => {
      const s2 = t[i];
      n[i] = signal(i, pureOptions);
      return this.Ot(s2, accessor(n[i]));
    } : () => {
      const s2 = t[i];
      return this.Ot(s2);
    };
    if (s === 0) {
      if (this.ht !== 0) {
        this.v.dispose(false);
        this.un = [];
        this.wt = [];
        this.yt = [];
        this.ht = 0;
        this.Mt && (this.Mt = []);
        this.gt && (this.gt = []);
      }
      if (this.P && !this.yt[0]) {
        this.un[0]?.dispose();
        this.yt[0] = runWithOwner(this.un[0] = createOwner(), this.P);
      }
    } else if (this.ht === 0) {
      const h = new Array(s);
      const f = new Array(s);
      r = this.Mt && new Array(s);
      n = this.gt && new Array(s);
      try {
        for (i = 0; i < s; i++) h[i] = runWithOwner(f[i] = createOwner(), o);
      } catch (t2) {
        for (e = 0; e <= i; e++) f[e]?.dispose();
        throw t2;
      }
      if (this.un[0]) this.un[0].dispose();
      this.yt = h;
      this.un = f;
      r && (this.Mt = r);
      n && (this.gt = n);
      this.wt = t.slice(0);
      this.ht = s;
    } else {
      let h, f, c, a, u, l, p, d, w, m, O;
      const _ = setSignal;
      for (h = 0, f = Math.min(this.ht, s); h < f && (this.wt[h] === t[h] || this.Mt && compare(this.rt, this.wt[h], t[h])); h++) {
        if (this.Mt) _(this.Mt[h], t[h]);
      }
      for (f = this.ht - 1, c = s - 1; f >= h && c >= h && (this.wt[f] === t[c] || this.Mt && compare(this.rt, this.wt[f], t[c])); f--, c--) ;
      if (h === s && this.ht === s) {
        this.wt = t.slice(0);
        return;
      }
      if (s <= this.ht && f - h > 64 && this.Mt === void 0 && this.gt === void 0) {
        const e2 = h + (c - h >> 1);
        const i2 = t[e2];
        const r2 = Math.min(f, e2 + 32);
        let n2 = Math.max(h, e2 - 32);
        while (n2 <= r2 && this.wt[n2] !== i2) n2++;
        if (n2 <= r2 && trySmallMove(this, t, s, h)) return;
      }
      const y = s - this.ht;
      const A = new Array(s);
      const M = new Array(s);
      r = this.Mt ? new Array(s) : void 0;
      n = this.gt ? new Array(s) : void 0;
      l = /* @__PURE__ */ new Map();
      p = new Array(c + 1);
      for (i = c; i >= h; i--) {
        a = t[i];
        u = this.rt ? this.rt(a) : a;
        e = l.get(u);
        p[i] = e === void 0 ? -1 : e;
        l.set(u, i);
      }
      for (e = h; e <= f; e++) {
        a = this.wt[e];
        u = this.rt ? this.rt(a) : a;
        i = l.get(u);
        if (i !== void 0 && i !== -1) {
          A[i] = this.yt[e];
          M[i] = this.un[e];
          r && (r[i] = this.Mt[e]);
          n && (n[i] = this.gt[e]);
          i = p[i];
          l.set(u, i);
        } else {
          (d ??= []).push(this.un[e]);
          if (false) ;
        }
      }
      try {
        for (i = h; i <= c; i++) {
          if (M[i] !== void 0) continue;
          (w ??= []).push(M[i] = createOwner());
          if (false) ;
          A[i] = runWithOwner(M[i], o);
        }
      } catch (t2) {
        if (w) for (e = 0; e < w.length; e++) w[e].dispose();
        throw t2;
      }
      for (e = 0; e < h; e++) {
        A[e] = this.yt[e];
        M[e] = this.un[e];
        r && (r[e] = this.Mt[e]);
        n && (n[e] = this.gt[e]);
      }
      for (i = h; i <= c; i++) {
        if (r) _(r[i], t[i]);
        if (n) _(n[i], i);
      }
      for (i = c + 1; i < s; i++) {
        A[i] = this.yt[i - y];
        M[i] = this.un[i - y];
        if (r) {
          r[i] = this.Mt[i - y];
          _(r[i], t[i]);
        }
        if (n) {
          n[i] = this.gt[i - y];
          if (y !== 0) _(n[i], i);
        }
      }
      this.yt = A;
      this.un = M;
      r && (this.Mt = r);
      n && (this.gt = n);
      this.ht = s;
      this.wt = t.slice(0);
      if (d) for (e = 0; e < d.length; e++) d[e].dispose();
      if (false) ;
    }
  });
  return this.yt;
}
function compare(t, s, e) {
  return t ? t(s) === t(e) : true;
}

// node_modules/@solidjs/signals/dist/prod/store/target.js
var $OWNER = /* @__PURE__ */ Symbol(0);
var storeLookup = /* @__PURE__ */ new WeakMap();
function setLookup(e, o) {
  (o.fam?.map ?? storeLookup).set(e, o);
}
function isOwned(e) {
  return e[$OWNER] !== void 0;
}
function lookupTarget(e, o) {
  const t = e[$OWNER];
  return t !== void 0 && t.fam === o ? t : (o?.map ?? storeLookup).get(e);
}
function devAssertNeverUserMutation(e) {
  return;
}
function markDescendants(e) {
  let o = e;
  while (o && !o.d) {
    o.d = true;
    o = o.u;
  }
}

// node_modules/@solidjs/signals/dist/prod/store/store.js
var optHooks = null;
function installOptHooks(e) {
  optHooks = e;
}
var affectsHooks = null;
var $DEEP = /* @__PURE__ */ Symbol(0);
function TargetShape() {
  this.v = void 0;
  this.ch = void 0;
  this.pb = void 0;
  this.n = void 0;
  this.h = void 0;
  this.k = void 0;
  this.dk = void 0;
  this.u = void 0;
  this.pk = void 0;
  this.px = void 0;
  this.d = void 0;
  this.a = void 0;
  this.sc = void 0;
  this.kc = void 0;
  this.nc = void 0;
  this.fam = void 0;
  this.s = void 0;
  this.ovl = void 0;
  this.del = void 0;
  this.wk = void 0;
}
TargetShape.prototype = Object.prototype;
function createTarget(e, n, t, r = n?.fam ?? null) {
  const i = Array.isArray(e) ? [] : new TargetShape();
  i.v = e;
  i.ch = e[$TARGET] !== void 0;
  i.pb = null;
  i.n = null;
  i.h = null;
  i.k = null;
  i.dk = null;
  i.wk = null;
  i.u = n;
  i.pk = t;
  i.px = null;
  i.d = false;
  i.a = false;
  i.sc = 0;
  i.kc = 0;
  i.nc = 0;
  i.fam = r;
  i.s = false;
  i.ovl = false;
  i.del = null;
  i.px = new Proxy(i, traps);
  setLookup(e, i);
  return i;
}
function wrap(e, n = null, t = null, r = n?.fam ?? null) {
  if (rawValuesUsed && isRawValue(e)) return e;
  const i = lookupTarget(e, r);
  if (i !== void 0) return i.px;
  const o = e[$TARGET];
  if (o !== void 0 && o.px === e) {
    if (r === null || o.fam === r) return e;
    return createTarget(e, n, t, r).px;
  }
  return createTarget(e, n, t, r).px;
}
function unwrapValue(e) {
  if (e == null || typeof e !== "object") return e;
  const n = e[$TARGET];
  if (n !== void 0 && (n.px === e || lookupTarget(e, n.fam) === n) && n.v !== void 0) {
    if (n.ovl) materializePB(n);
    return n.pb ?? n.v;
  }
  return e;
}
var slotNodeEquals = function(e, n) {
  return isEqual(e, n) || sameLogicalSlot(this.ot, e, n);
};
function sameKey(e, n) {
  return e === n || e !== e && n !== n;
}
var LaneView = class {
  rows;
  base;
  removed;
  constructor(e, n, t = null) {
    this.rows = e;
    this.base = n;
    this.removed = t;
  }
};
function asBacking(e) {
  return e instanceof LaneView ? e.base : e;
}
var containerEquals = function(e, n) {
  return e === n || optHooks !== null && optHooks.arrangement(this.ot, e, n);
};
function sameLogicalSlot(e, n, t) {
  if (n === null || typeof n !== "object" || t === null || typeof t !== "object") return false;
  const r = lookupTarget(n, e.fam);
  return r !== void 0 && r === lookupTarget(t, e.fam);
}
var deferredReleases = /* @__PURE__ */ new Set();
function releaseSlot(e) {
  const n = e.ot;
  const t = e.rt;
  if (t === $TRACK) {
    if (n.k === e) n.k = null;
  } else if (t === $DEEP) {
    if (n.dk === e) n.dk = null;
  } else if (n.n !== null && n.n[t] === e) {
    delete n.n[t];
    n.nc--;
  } else if (n.h !== null && n.h[t] === e) delete n.h[t];
  if (n.fam !== null && n.nc === 0 && n.k === null && n.dk === null && (n.h === null || Reflect.ownKeys(n.h).length === 0)) n.fam.live.delete(n);
}
function noteNode(e, n, t) {
  if (e.fam !== null) e.fam.live.add(e);
  markDescendants(e);
  if (affectsHooks !== null) affectsHooks.born(e, n, t);
}
setSlotUnobserved((e) => {
  if (e.Ae !== NOT_PENDING || e.u & CONFIG_OVERRIDE) deferredReleases.add(e);
  else releaseSlot(e);
});
function bornStaged(e, n, t, r) {
  if (n.We && n.We(n.pe, t)) return;
  queuePendingNode(n);
  n.Ae = t;
  const i = e.k;
  if (i === null) return;
  if ((i.u & (CONFIG_HELD | CONFIG_OVERRIDE)) === CONFIG_HELD && heldKeyChanged(e, r)) holdNode(n, txOf(i));
  if (i.u & CONFIG_PROMOTED) notePromotedWrite(n);
}
function getNode(e, n, t = -1) {
  const r = e.n ??= /* @__PURE__ */ Object.create(null);
  let i = r[n];
  if (i === void 0) {
    const o = e.pb;
    const l = i = slotSignal(committed(e)[n], slotNodeEquals, e, n, t === -1 ? isOwnAccessor(o ?? e.v, n) : t === 1);
    if (o !== null && !l.acc) bornStaged(e, l, e.del !== null && e.del.has(n) ? void 0 : o[n], n);
    r[n] = i;
    e.nc++;
    noteNode(e, l, n);
  }
  return i;
}
function getHasNode(e, n) {
  const t = e.h ??= /* @__PURE__ */ Object.create(null);
  let r = t[n];
  if (r === void 0) {
    const i = r = slotSignal(n in committed(e), isEqual, e, n, false);
    const o = e.pb;
    if (o !== null) bornStaged(e, i, n in o && !(e.del !== null && e.del.has(n)), n);
    t[n] = r;
    noteNode(e, i, n);
  }
  return r;
}
function getContainerNode(e) {
  let n = e.k;
  if (n === null) {
    n = e.k = slotSignal(e.v, containerEquals, e, $TRACK, false);
    noteNode(e, n, $TRACK);
    if (e.pb !== null && !directCommit) {
      n.pe = preBatch(e);
      n.Ae = e.pb;
      queuePendingNode(n);
    }
  }
  return n;
}
function stageOn(e, n) {
  if (e.k === null && passLane === null && (context === null || globalQueue.ee) && !deriveHolds(e)) return;
  const t = getContainerNode(e);
  if (t.Ae === NOT_PENDING) queuePendingNode(t);
  t.Ae = n;
  if (context !== null) notePromotedWrite(t);
  if (e.fam !== null) holdWithDerive(e, t);
}
function deriveHolds(e) {
  const n = e.fam?.node;
  return n != null && !userWrite && (n.u & CONFIG_HELD) !== 0;
}
GlobalQueue.Tn = (e) => {
  for (let n = 0; n < foldList.length; n++) {
    const t = foldList[n];
    if (t.k === null && t.pb !== null) holdNode(getContainerNode(t), e);
  }
};
function bumpDeep(e) {
  if (e.dk !== null) setSignal(e.dk, 1);
}
function notifyContainer(e, n) {
  if (e.u & CONFIG_OVERRIDE) setSignal(e, n);
  else {
    if (e.u & CONFIG_HELD) joinFuture(txOf(e));
    insertSubs(e);
    schedule();
  }
}
var hasOwn = Object.prototype.hasOwnProperty;
var lookupGetter = Object.prototype.__lookupGetter__;
var lookupSetter = Object.prototype.__lookupSetter__;
var propertyIsEnumerable = Object.prototype.propertyIsEnumerable;
function isOwnAccessor(e, n) {
  return hasOwn.call(e, n) && (lookupGetter.call(e, n) !== void 0 || lookupSetter.call(e, n) !== void 0);
}
function cloneRaw(e, n) {
  n.sc || scanAccessorsOnce(n);
  if (n.sc === 2) {
    const t2 = {
      ...e
    };
    t2[$OWNER] = n;
    return t2;
  }
  const t = Object.getOwnPropertyDescriptors(e);
  for (const r2 of Reflect.ownKeys(t)) {
    const i = t[r2];
    if (r2 === "length" && Array.isArray(e)) continue;
    i.configurable = true;
    if (!i.get && !i.set) i.writable = true;
    else n.a = true;
  }
  const r = Array.isArray(e) ? Object.defineProperties([], t) : Object.create(Object.getPrototypeOf(e), t);
  r[$OWNER] = n;
  return r;
}
function wideClone(e, n) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const n2 of Reflect.ownKeys(e)) t[n2] = e[n2];
  Object.setPrototypeOf(t, Object.prototype);
  t[$OWNER] = n;
  return t;
}
function copyOwn(e, n, t) {
  const r = Object.getOwnPropertyDescriptor(n, t);
  if (r.get || r.set || !r.enumerable || !r.writable || !r.configurable) Object.defineProperty(e, t, r);
  else e[t] = r.value;
}
function scanAccessorsOnce(e) {
  const n = e.v;
  const t = Reflect.ownKeys(n);
  let r = Object.getPrototypeOf(n) === Object.prototype;
  for (const i of t) {
    if (lookupGetter.call(n, i) !== void 0 || lookupSetter.call(n, i) !== void 0) {
      e.a = true;
      r = false;
      break;
    }
    if (r && !propertyIsEnumerable.call(n, i)) r = false;
  }
  e.sc = r ? 2 : 1;
  e.kc = t.length;
  return !e.a;
}
var OVERLAY_MIN_KEYS = 32;
var OVERLAY_REBUILD_MAX_KEYS = 1024;
var OVERLAY_REBUILD_MIN_ADDS = 16;
var WK_ALL = /* @__PURE__ */ new Set();
var plainProto = (e) => {
  const n = Object.getPrototypeOf(e);
  return n === Object.prototype || n === Array.prototype || n === null;
};
function overlayRebuilds(e, n) {
  if (e.kc > OVERLAY_REBUILD_MAX_KEYS) return false;
  if (e.del !== null && e.del.size !== 0) return true;
  const t = e.wk;
  if (t !== null && t !== WK_ALL && t.size <= OVERLAY_REBUILD_MIN_ADDS) return false;
  const r = e.v;
  let i = 0;
  for (const e2 of Reflect.ownKeys(n)) if (!hasOwn.call(r, e2) && ++i > OVERLAY_REBUILD_MIN_ADDS) return true;
  return false;
}
function materializePB(e) {
  const n = e.pb;
  if (!e.ovl) return n;
  const t = e.sc === 2 ? wideClone(e.v, e) : cloneRaw(e.v, e);
  if (e.del !== null) {
    for (const n2 of e.del) delete t[n2];
    e.kc -= e.del.size;
    e.del = null;
  }
  for (const r of Reflect.ownKeys(n)) e.sc === 2 ? t[r] = n[r] : copyOwn(t, n, r);
  e.pb = t;
  e.ovl = false;
  if (e.k !== null && e.k.Ae === n) e.k.Ae = t;
  return t;
}
function ensurePB(e) {
  let n = e.pb;
  if (userWrite && e.fam?.opt === true && !pendingNotify.has(e)) return e.pb = optHooks.draft(e);
  if (n !== null && !isOwned(n)) {
    n = e.pb = cloneRaw(n, e);
    const t = e.k;
    if (t !== null && !(t.u & CONFIG_HELD)) t.Ae = n;
  } else if (n === null) {
    const t = e.v;
    if (!directCommit) queueFold(e);
    if (!e.ch && !Array.isArray(t) && (e.sc !== 0 ? !e.a : scanAccessorsOnce(e)) && e.kc > OVERLAY_MIN_KEYS && isOwned(t)) {
      n = e.pb = Object.create(t);
      e.ovl = true;
    } else n = e.pb = cloneRaw(t, e);
    if (!directCommit) stageOn(e, n);
  }
  return n;
}
function privatizeCommitted(e) {
  if (isOwned(e.v)) return;
  const n = e.v;
  const t = cloneRaw(n, e);
  e.v = t;
  e.ch = false;
  if (e.u) {
    privatizeCommitted(e.u);
    devAssertNeverUserMutation(e.u.v);
    const t2 = e.u.v;
    const r = parentSlotKey(e, n);
    if (t2[r] === n) t2[r] = e.v;
  }
}
function parentSlotKey(e, n) {
  const t = e.pk;
  const r = e.u.v;
  if (r[t] === n || r[t] === e.v || !Array.isArray(r)) return t;
  const i = r.indexOf(n);
  if (i === -1) return t;
  e.pk = i;
  return i;
}
function flattenOverlay(e, n) {
  privatizeCommitted(e);
  const t = e.v;
  for (const r of Reflect.ownKeys(n)) e.sc === 2 ? t[r] = n[r] : copyOwn(t, n, r);
  if (e.del !== null) {
    for (const n2 of e.del) delete t[n2];
    e.kc -= e.del.size;
    e.del = null;
  }
  e.pb = null;
  e.ovl = false;
  e.wk = null;
}
function adoptPB(e, n, t = true) {
  if (!directCommit) queueFold(e);
  let r;
  if (e.pb !== null) {
    if (e.ovl) materializePB(e);
    r = e.pb;
  } else r = e.v;
  if (directCommit) {
    e.pb = null;
    if (e.k !== null) e.k.pe = n;
  } else {
    e.pb = n;
    stageOn(e, n);
  }
  e.v = n;
  e.ch = n[$TARGET] !== void 0;
  e.ovl = false;
  e.del = null;
  e.sc = 0;
  e.a = false;
  e.wk = null;
  const i = n[$OWNER];
  if (i !== void 0 && i.fam === e.fam) n[$OWNER] = e;
  else setLookup(n, e);
  if (t && r !== n) notifyFold(e, r, n);
}
var foldList = [];
var foldOlds = [];
var foldSpare = [];
var foldOldsSpare = [];
var foldIndex = null;
function queueFold(e) {
  if (e.pb !== null) return;
  schedule();
  if (foldIndex !== null) foldIndex.set(e, foldList.length);
  foldList.push(e);
  foldOlds.push(e.v);
}
function preBatch(e) {
  if (foldIndex === null) {
    foldIndex = /* @__PURE__ */ new Map();
    for (let e2 = 0; e2 < foldList.length; e2++) foldIndex.set(foldList[e2], e2);
  }
  const n = foldIndex.get(e);
  return n === void 0 ? e.v : foldOlds[n];
}
function drainFolds() {
  if (foldList.length !== 0) {
    const e = foldList;
    const n = foldOlds;
    foldList = foldSpare;
    foldOlds = foldOldsSpare;
    foldSpare = e;
    foldOldsSpare = n;
    foldIndex = null;
    for (let t = 0; t < e.length; t++) {
      const r = e[t];
      if (r.pb === null) continue;
      const i = r.k;
      if (i !== null && i.Ae !== NOT_PENDING) {
        foldList.push(r);
        foldOlds.push(n[t]);
      } else foldTarget(r, n[t]);
    }
    e.length = 0;
    n.length = 0;
  }
  if (deferredReleases.size !== 0) {
    for (const e of deferredReleases) {
      if (e.Ae === NOT_PENDING && !(e.u & CONFIG_OVERRIDE) && e.t === null) {
        deferredReleases.delete(e);
        releaseSlot(e);
      }
    }
  }
}
GlobalQueue.F = (e) => {
  const n = e.ot?.fam;
  return n != null && n.node !== null && (n.node.G & STATUS_PENDING) !== 0;
};
GlobalQueue.rn = (e) => {
  const n = e.ot;
  if (n.ch) {
    const t = e.rt;
    const r = n.v;
    if (n.h !== null && n.h[t] === e) e.pe = untrack(() => t in r);
    else if (n.n !== null && n.n[t] === e) e.pe = untrack(() => unwrapValue(r[t]));
  }
  return e.pe;
};
GlobalQueue._n = () => {
  drainFolds();
  optHooks?.sweep();
};
var directCommit = false;
function runDirect(e) {
  const n = directCommit;
  directCommit = true;
  try {
    e();
  } finally {
    directCommit = n;
  }
}
function foldTarget(e, n) {
  {
    {
      const t = e.k;
      const r = e.pb;
      if (r !== null) {
        if (r === e.v) {
          e.pb = null;
          e.wk = null;
        } else if (e.ovl && (e.v !== n || !overlayRebuilds(e, r))) {
          flattenOverlay(e, r);
        } else if (e.v !== n) {
          privatizeCommitted(e);
          const t2 = e.v;
          const i = e.wk;
          if (i !== null && i !== WK_ALL) {
            for (const e2 of i) {
              if (hasOwn.call(r, e2)) copyOwn(t2, r, e2);
              else delete t2[e2];
            }
          } else {
            for (const e2 of Reflect.ownKeys(r)) {
              const i2 = Object.getOwnPropertyDescriptor(r, e2);
              if (i2.get || i2.set || !i2.enumerable || !i2.writable || !i2.configurable) Object.defineProperty(t2, e2, i2);
              else if (i2.value !== n[e2] || !hasOwn.call(n, e2)) t2[e2] = i2.value;
            }
            for (const e2 of Reflect.ownKeys(n)) {
              if (!hasOwn.call(r, e2)) delete t2[e2];
            }
          }
          e.pb = null;
          e.wk = null;
        } else {
          e.v = e.ovl ? materializePB(e) : r;
          e.ch = e.v[$TARGET] !== void 0;
          e.pb = null;
          e.wk = null;
        }
      }
      if (t !== null) {
        if (t.t === null) e.k = null;
        else if (t.pe instanceof LaneView) t.pe.base = e.v;
        else t.pe = e.v;
      }
      if (e.v !== n && e.u) {
        const t2 = parentSlotKey(e, n);
        if (e.u.v[t2] === n) {
          privatizeCommitted(e.u);
          devAssertNeverUserMutation(e.u.v);
          e.u.v[t2] = e.v;
        }
      }
    }
  }
}
var heldDerivationHit = false;
var userWrite = false;
function userWriting() {
  return userWrite;
}
function heldDerivation(e, n, t) {
  if (e.fam === null || !userWrite) return false;
  if (n !== void 0) return (n.u & (CONFIG_HELD | CONFIG_MANUAL_WRITE)) === CONFIG_HELD && txOf(n) !== flushTransaction;
  const r = e.k;
  return r !== null && (r.u & CONFIG_HELD) !== 0 && txOf(r) !== flushTransaction && heldKeyChanged(e, t);
}
function notifyWrites(e) {
  let n = e.pb;
  if (n === null) return;
  if (userWrite && e.fam?.opt === true) {
    e.pb = null;
    e.wk = null;
    e.pb = optHooks.writes(e, n);
    return;
  }
  const t = e.v;
  const r = e.n;
  const i = e.wk;
  const o = i === WK_ALL || e.a === true || !plainProto(e.ovl ? e.v : n) ? null : i;
  if (e.fam !== null && !heldDerivationHit && o !== null) {
    for (const n2 of o) if (heldDerivation(e, r?.[n2], n2)) {
      heldDerivationHit = true;
      break;
    }
  }
  if (r !== null) {
    const i2 = o ?? Reflect.ownKeys(r);
    for (const o2 of i2) {
      const i3 = r[o2];
      if (i3 === void 0) continue;
      if (i3.acc === true || hasOwn.call(n, o2) && lookupGetter.call(n, o2) !== void 0) {
        i3.acc = isOwnAccessor(n, o2);
        const e2 = Object.getOwnPropertyDescriptor(t, o2);
        const r2 = Object.getOwnPropertyDescriptor(n, o2);
        if (e2 && (e2.get || e2.set) || r2 && (r2.get || r2.set)) {
          if (e2?.get !== r2?.get || e2?.set !== r2?.set || e2?.value !== r2?.value) setSignal(i3, () => FORCE);
          continue;
        }
        if (!isEqual(e2?.value, r2?.value)) setSignal(i3, () => r2?.value);
        continue;
      }
      const l2 = e.del !== null && e.del.has(o2) ? void 0 : n[o2];
      setSignal(i3, () => l2);
      if (e.fam !== null) {
        if (!userWrite) {
          i3.u &= ~CONFIG_MANUAL_WRITE;
          holdWithDerive(e, i3);
        } else i3.u |= CONFIG_MANUAL_WRITE;
      }
    }
  }
  const l = e.h;
  if (l !== null) {
    const t2 = o ?? Reflect.ownKeys(l);
    for (const r2 of t2) {
      const t3 = l[r2];
      if (t3 !== void 0) {
        setSignal(t3, r2 in n && !(e.del !== null && e.del.has(r2)));
        if (e.fam !== null) holdWithDerive(e, t3);
      }
    }
  }
  if (e.dk !== null) {
    if (e.del !== null && e.del.size !== 0) bumpDeep(e);
    else for (const r2 of o ?? Reflect.ownKeys(n)) {
      if (r2 === $OWNER) continue;
      const i2 = n[r2];
      const o2 = t[r2];
      if (i2 !== null && typeof i2 === "object" ? !targetsEqual(o2, i2) : !isEqual(o2, i2)) {
        bumpDeep(e);
        break;
      }
    }
  }
  const u = e.k;
  if (u !== null && (u.t !== null || u.u & CONFIG_OVERRIDE)) {
    let r2;
    if (e.ovl) {
      r2 = e.del !== null && e.del.size !== 0;
      if (!r2) {
        for (const e2 of Reflect.ownKeys(n)) {
          if (!hasOwn.call(t, e2)) {
            r2 = true;
            break;
          }
        }
      }
    } else {
      r2 = Array.isArray(n) && Array.isArray(t) ? arrayStructureChanged(t, n) : membershipChanged(t, n);
    }
    if (r2) notifyContainer(u, n);
  }
}
var FORCE = /* @__PURE__ */ Symbol();
function targetsEqual(e, n) {
  if (e === null || typeof e !== "object" || n === null || typeof n !== "object") return false;
  const t = lookupTarget(e, null);
  return t !== void 0 && t === lookupTarget(n, null);
}
function arrayStructureChanged(e, n) {
  if (e.length !== n.length) return true;
  for (let t = 0; t < n.length; t++) {
    const r = e[t];
    const i = n[t];
    if (!isEqual(r, i) && !targetsEqual(r, i)) return true;
  }
  return false;
}
function membershipChanged(e, n) {
  const t = Reflect.ownKeys(n);
  if (Reflect.ownKeys(e).length - +isOwned(e) !== t.length - +isOwned(n)) return true;
  for (const n2 of t) if (n2 !== $OWNER && !(n2 in e)) return true;
  return false;
}
function notifyKeyDiff(e, n, t, r, i = true) {
  if (e.acc === true || i && hasOwn.call(r, n) && lookupGetter.call(r, n) !== void 0) {
    e.acc = isOwnAccessor(r, n);
    const i2 = Object.getOwnPropertyDescriptor(t, n);
    const o = Object.getOwnPropertyDescriptor(r, n);
    if (i2 && (i2.get || i2.set) || o && (o.get || o.set)) {
      if (i2?.get !== o?.get || i2?.set !== o?.set || i2?.value !== o?.value) setSignal(e, () => FORCE);
      return;
    }
    const l = i2?.value;
    const u = o?.value;
    if (!isEqual(l, u) && !targetsEqual(l, u)) setSignal(e, typeof u === "function" ? () => u : u);
  } else {
    const i2 = t[n];
    const o = r[n];
    if (!isEqual(i2, o) && !targetsEqual(i2, o)) setSignal(e, typeof o === "function" ? () => o : o);
  }
}
function hasAccessorFlag(e) {
  return e.acc === true;
}
function notifyKeyValue(e, n, t, r, i, o) {
  if (e.acc === true) {
    notifyKeyDiff(e, n, i, o, false);
    return;
  }
  if (!isEqual(t, r) && !targetsEqual(t, r)) setSignal(e, typeof r === "function" ? () => r : r);
}
function notifyFoldTail(e, n, t) {
  const r = e.h;
  if (r !== null) {
    const e2 = n[$TARGET];
    for (const i2 of Reflect.ownKeys(r)) if (e2 || i2 in n !== i2 in t) setSignal(r[i2], i2 in t);
  }
  const i = e.k;
  if (i !== null && (i.t !== null || i.u & CONFIG_OVERRIDE)) {
    const e2 = Array.isArray(t) && Array.isArray(n) ? arrayStructureChanged(n, t) : membershipChanged(n, t);
    if (e2) notifyContainer(i, t);
  }
}
function notifyFold(e, n, t) {
  if (e.dk !== null && n !== t) bumpDeep(e);
  const r = e.n;
  if (r !== null) {
    for (const e2 of Reflect.ownKeys(r)) notifyKeyDiff(r[e2], e2, n, t);
  }
  notifyFoldTail(e, n, t);
}
var writing = 0;
var writeScopes = null;
var pendingNotify = /* @__PURE__ */ new Set();
function scopeKey(e) {
  if (e.fam !== null) return e.fam;
  let n = e;
  while (n.u !== null) n = n.u;
  return n;
}
function inDraft(e) {
  return writeScopes !== null && writeScopes.has(scopeKey(e));
}
function serveShallow(e, n, t) {
  if (t !== null && typeof t === "object" && t[$TARGET] !== void 0) return draftServe(e, wrap(t, e, n));
  return t;
}
function draftServe(e, n) {
  if (writeScopes !== null && inDraft(e)) {
    const e2 = n?.[$TARGET];
    if (e2 !== void 0 && e2.v !== void 0) writeScopes.add(scopeKey(e2));
  }
  return n;
}
function committed(e) {
  const n = e.k;
  if (n !== null) return n.Ae !== NOT_PENDING ? asBacking(n.pe) : e.v;
  return e.pb !== null ? preBatch(e) : e.v;
}
function stagingReader() {
  let e = context;
  if (e === null) return null;
  if (e.Et) e = e.ut ?? null;
  return e === null || e.u & CONFIG_CHILDREN_FORBIDDEN ? null : e;
}
function readSource(e, n, t = false) {
  if (userWrite && e.fam !== null && e.fam.opt === true && !pendingNotify.has(e) && inDraft(e)) {
    const n2 = ensurePB(e);
    pendingNotify.add(e);
    return n2;
  }
  const r = e.pb;
  if (r === null) return e.v;
  if (inDraft(e) || writeOverride) {
    if (writeOverride && !userWrite) {
      const t2 = n !== void 0 ? e.n?.[n] : void 0;
      if (t2 !== void 0) {
        if ((t2.u & (CONFIG_HELD | CONFIG_OVERRIDE)) === CONFIG_HELD) joinPassTx(txOf(t2));
      } else {
        const t3 = e.k;
        if (t3 !== null && (t3.u & (CONFIG_HELD | CONFIG_OVERRIDE)) === CONFIG_HELD && (n === void 0 || heldKeyChanged(e, n))) joinPassTx(txOf(t3));
      }
    }
    return r;
  }
  const i = e.k;
  if (n !== void 0) {
    const t2 = e.n?.[n];
    if (t2 !== void 0 && t2.u & CONFIG_OVERRIDE) return committed(e);
  }
  const o = i !== null && (i.u & CONFIG_HELD) !== 0;
  if (o && n !== void 0 && !heldKeyChanged(e, n, t)) return r;
  const l = stagingReader();
  if (l === null) {
    if (getObserver() !== null) return r;
    if (familyAhead(e)) return r;
    if (verdict === null || !o && n !== void 0 && !keyChanged(e, n, t)) return o ? asBacking(i.pe) : e.v;
    return i === null ? committed(e) : asBacking(read(i));
  }
  if (!o) {
    if (l.R & REACTIVE_STAGED_READ && !(l.u & (CONFIG_VERDICT | CONFIG_CHILDREN_FORBIDDEN))) return r;
    if (n !== void 0 && !keyChanged(e, n, t)) return committed(e);
    if (i === null) {
      if (l.u & CONFIG_VERDICT && stagedScreen(l)) return committed(e);
      stagedRead(l);
      return r;
    }
  }
  return asBacking(untrack(() => read(i)));
}
function heldKeyChanged(e, n, t = true) {
  return changedBetween(e, e.k.pe, e.k.Ae, n, t);
}
function familyAhead(e) {
  return e.fam !== null && context === null && !(e.k !== null && e.k.u & CONFIG_HELD);
}
function keyChanged(e, n, t = true) {
  return changedBetween(e, committed(e), e.pb, n, t);
}
function changedBetween(e, n, t, r, i) {
  if (e.ch || t[$TARGET] !== void 0 || Object.getPrototypeOf(t) !== Object.getPrototypeOf(n) || !plainProto(n)) return true;
  if (e.del !== null && e.del.has(r)) return r in n;
  const o = hasOwn.call(t, r) || e.ovl && hasOwn.call(e.v, r);
  if (o !== hasOwn.call(n, r)) return true;
  if (!o) return false;
  if ((i || e.a) && (isOwnAccessor(n, r) || isOwnAccessor(t, r) || propertyIsEnumerable.call(n, r) !== propertyIsEnumerable.call(t, r))) return true;
  const l = t[r];
  const u = n[r];
  return !isEqual(u, l) && !sameLogicalSlot(e, u, l);
}
function nodeValue(e, n, t) {
  let r = read(e);
  if (e.Ae !== NOT_PENDING && !(e.u & CONFIG_HELD) && context === null && t.fam !== null) r = e.Ae;
  return r === FORCE ? n : r;
}
function serveDataKey(e, n, t, r, i, o = -1) {
  const l = e.ch && r === e.v;
  let u = t;
  if (!inDraft(e) && !writeOverride) {
    if (i === void 0 && getObserver() !== null) i = getNode(e, n, o);
    if (i !== void 0) {
      const n2 = nodeValue(i, t, e);
      if (l) {
        i.pe = t;
        if (i.u & CONFIG_OVERRIDE) u = n2;
      } else u = n2;
    }
  }
  if (e.s) return serveShallow(e, n, u);
  if (e.ch && !l && u !== null && typeof u === "object" && u[$TARGET]?.px !== u) u = resolveChainedRaw(e, n, u);
  if (i !== void 0) {
    if (i.pxv === u && u !== void 0) return draftServe(e, i.px);
    if (!isWrappable(u)) return u;
    const t2 = wrap(u, e, n);
    i.px = t2;
    i.pxv = u;
    return draftServe(e, t2);
  }
  if (!isWrappable(u)) return u;
  return draftServe(e, wrap(u, e, n));
}
function linkedTo(e, n) {
  for (let t = e._; t !== null; t = t.p) if (t.I === n) return true;
  return false;
}
function pullFamily(e) {
  const n = e.fam.node;
  if (n === null || writeOverride || inDraft(e)) return;
  if (n.G & (STATUS_PENDING | STATUS_ERROR)) {
    const t = context;
    if (t !== null && t.i === EFFECT_RENDER && n.u & CONFIG_HELD && flushTransaction !== txOf(n) && !linkedTo(t, n)) return;
    const r = e.fam.overlaid;
    if (verdict === null && n.G & STATUS_PENDING && r !== void 0 && r.size !== 0) return;
    read(n);
  } else untrack(() => read(n));
}
function holdWithDerive(e, n) {
  const t = e.fam?.node;
  if (t !== void 0 && t !== null && !userWrite && // the derive's own write (its draft or landing), not a user setter's
  t.u & CONFIG_HELD && n.Ae !== NOT_PENDING && // A node carrying a guess is the lane's: its staging is the truth beneath
  // the guess (`setSignal` → `laneWrite`), never re-homed by the store.
  !(n.u & (CONFIG_HELD | CONFIG_OVERRIDE))) {
    holdNode(n, txOf(t));
    n.m.be = t.m.be;
  }
}
function resolveChainedRaw(e, n, t) {
  const r = e.v[$TARGET];
  if (r.ch) {
    const e2 = resolveChainedRaw(r, n, t);
    return e2 === t ? t : wrap(e2, r, n);
  }
  const i = lookupTarget(t, r.fam);
  if (i !== void 0) return i.px;
  if ((r.v[n] === t || r.pb?.[n] === t) && isWrappable(t)) return wrap(t, r, n);
  return t;
}
function enumerationSource(e) {
  if (!inDraft(e) && !writeOverride && getObserver() !== null) {
    const n2 = asBacking(read(getContainerNode(e)));
    return e.fam?.opt === true ? optHooks.view(e, n2) : n2;
  }
  const n = readSource(e);
  return optRead(e) ? optHooks.view(e, n) : n;
}
function optRead(e) {
  return e.fam !== null && e.fam.opt === true && !inDraft(e) && !writeOverride;
}
var UNSAFE_KEYS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
var traps = {
  get(e, n, t) {
    if (typeof n !== "string") {
      if (n === $TARGET) return e;
      if (n === $PROXY) return t;
      if (n === $OWNER) return void 0;
      if (n === $RECORD) return void 0;
      if (n === $REFRESH) return e.fam?.node ?? void 0;
      if (n === $TRACK) {
        if (e.fam !== null) pullFamily(e);
        if (!inDraft(e) && getObserver() !== null) {
          read(getContainerNode(e));
          const n2 = readSource(e);
          if (n2[$TARGET] !== void 0) n2[$TRACK];
        }
        return void 0;
      }
    }
    if (verdict !== null && affectsHooks !== null && getObserver() === null) affectsHooks.witness(e, n);
    if (e.fam !== null) pullFamily(e);
    const r = e.n?.[n];
    if (writeScopes === null && !writeOverride) {
      const t2 = r;
      if (t2 !== void 0 && t2.acc !== true && (!e.ch || t2.u & CONFIG_OVERRIDE)) {
        const r2 = nodeValue(t2, void 0, e);
        if (r2 === null || typeof r2 !== "object") return r2;
        if (e.s) return serveShallow(e, n, r2);
        if (t2.pxv === r2) return t2.px;
        if (isWrappable(r2)) {
          const i2 = wrap(r2, e, n);
          t2.px = i2;
          t2.pxv = r2;
          return i2;
        }
        return r2;
      }
    }
    const i = readSource(e, n);
    if (e.del !== null && i === e.pb && e.del.has(n)) {
      if (!inDraft(e) && getObserver() !== null) read(getNode(e, n));
      return void 0;
    }
    let o = -1;
    {
      let l2;
      if (r !== void 0) l2 = r.acc === true;
      else if (!inDraft(e) && getObserver() !== null) {
        l2 = isOwnAccessor(i, n);
        if (i === (e.pb ?? e.v)) o = l2 ? 1 : 0;
      } else l2 = false;
      if (l2) {
        if (!inDraft(e) && getObserver() !== null) read(r ?? getNode(e, n, o));
        const l3 = Reflect.get(i, n, t);
        if (e.s) return serveShallow(e, n, l3);
        return isWrappable(l3) ? draftServe(e, wrap(l3, e, n)) : l3;
      }
    }
    const l = e.ovl && i === e.pb;
    if ((n === "constructor" || n === "__proto__" || n === "prototype") && !hasOwn.call(i, n) && !(l && hasOwn.call(e.v, n))) return void 0;
    let u = i[n];
    if (u === void 0 ? !hasOwn.call(i, n) && !(l && hasOwn.call(e.v, n)) : false) {
      u = Reflect.get(i, n, t);
      if (typeof u === "function") return u;
      if (e.ch && i === e.v) return serveDataKey(e, n, u, i, r, o);
      if (u === void 0 && !inDraft(e)) {
        if (getObserver() !== null) read(getNode(e, n, o));
        const t2 = e.n?.[n];
        if (t2) {
          const r2 = nodeValue(t2, void 0, e);
          if (e.s) return serveShallow(e, n, r2);
          return isWrappable(r2) ? draftServe(e, wrap(r2, e, n)) : r2;
        }
      }
      if (e.s) return serveShallow(e, n, u);
      return isWrappable(u) ? draftServe(e, wrap(u, e, n)) : u;
    }
    if (typeof u === "function" && !hasOwn.call(i, n) && !(l && hasOwn.call(e.v, n))) return u;
    return serveDataKey(e, n, u, i, r, o);
  },
  has(e, n) {
    if (n === $TARGET || n === $PROXY || n === $TRACK) return true;
    if (n === $OWNER || n === $RECORD) return false;
    if (verdict !== null && affectsHooks !== null && getObserver() === null) affectsHooks.witness(e, n);
    if (e.fam !== null) pullFamily(e);
    const t = readSource(e, n);
    if (!inDraft(e) && !writeOverride) {
      if (getObserver() !== null) {
        const r = getHasNode(e, n);
        const i = read(r);
        if (!e.ch || t !== e.v) return !!i;
        const o = n in t;
        r.pe = o;
        if (r.u & CONFIG_OVERRIDE) return !!i;
        return o;
      } else if (optRead(e)) {
        const t2 = optHooks.has(e, n);
        if (t2 !== void 0) return t2;
      }
    }
    return n in t && !(e.del !== null && t === e.pb && e.del.has(n));
  },
  ownKeys(e) {
    if (verdict !== null && affectsHooks !== null && getObserver() === null) affectsHooks.witness(e, void 0);
    if (e.fam !== null) pullFamily(e);
    return visibleKeys(e, enumerationSource(e));
  },
  getOwnPropertyDescriptor(e, n) {
    if (n === $OWNER || n === $RECORD) return void 0;
    const t = getObserver();
    if (verdict !== null && affectsHooks !== null && t === null) affectsHooks.witness(e, n);
    if (e.fam !== null) pullFamily(e);
    const r = t !== null && !inDraft(e) && !writeOverride;
    const i = r && observerHoldsContainer(e, t);
    let o;
    if (i) o = enumerationSource(e);
    else if (r) {
      const t2 = getHasNode(e, n);
      const r2 = read(t2);
      o = readSource(e, n, true);
      if (!r2 && (!e.ch || t2.u & CONFIG_OVERRIDE || !(n in o))) return void 0;
    } else o = readSource(e, n, true);
    let l;
    if (!i && optRead(e)) {
      const t2 = optHooks.descriptor(e, n);
      if (t2 === null) return void 0;
      l = t2;
    }
    l ??= visibleDescriptor(e, o, n);
    if (l === void 0) return void 0;
    if (!(n === "length" && Array.isArray(e))) l.configurable = true;
    return l;
  },
  set(e, n, t) {
    const r = inDraft(e);
    const i = !r && writeOverride;
    if (!r && !i) return true;
    if (n === "__proto__") return true;
    const o = e.s ? t : unwrapValue(t);
    const l = ensurePB(e);
    pendingNotify.add(e);
    if (Array.isArray(l)) {
      if (n === "length") e.wk = WK_ALL;
      else if (e.wk !== WK_ALL) {
        const t2 = e.wk ??= /* @__PURE__ */ new Set();
        t2.add(n);
        t2.add("length");
      }
    } else {
      if (e.wk !== WK_ALL) (e.wk ??= /* @__PURE__ */ new Set()).add(n);
      if (!(n in l)) e.kc++;
    }
    if (UNSAFE_KEYS.has(n)) {
      Object.defineProperty(l, n, {
        value: o,
        writable: true,
        enumerable: true,
        configurable: true
      });
      if (e.del !== null) e.del.delete(n);
      return true;
    }
    if (e.ovl && e.sc !== 2 && !hasOwn.call(l, n)) {
      Object.defineProperty(l, n, {
        value: o,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } else l[n] = o;
    if (e.del !== null) e.del.delete(n);
    if (e.s && o !== null && typeof o === "object") markRawOne(o);
    if (i) notifyWrites(e);
    return true;
  },
  defineProperty(e, n, t) {
    const r = inDraft(e);
    const i = !r && writeOverride;
    if (!r && !i) return true;
    if (n === "__proto__") return true;
    if (t.get || t.set) e.a = true;
    if ("value" in t) t = {
      ...t,
      value: unwrapValue(t.value)
    };
    const o = ensurePB(e);
    if (e.a || !(t.enumerable && t.writable && t.configurable)) e.sc = 1;
    pendingNotify.add(e);
    if (e.wk !== WK_ALL) (e.wk ??= /* @__PURE__ */ new Set()).add(n);
    Object.defineProperty(o, n, t);
    if (e.del !== null) e.del.delete(n);
    if (i) notifyWrites(e);
    return true;
  },
  deleteProperty(e, n) {
    const t = inDraft(e);
    const r = !t && writeOverride;
    if (!t && !r) return true;
    const i = ensurePB(e);
    pendingNotify.add(e);
    if (e.wk !== WK_ALL) (e.wk ??= /* @__PURE__ */ new Set()).add(n);
    delete i[n];
    if (e.ovl && hasOwn.call(e.v, n)) (e.del ??= /* @__PURE__ */ new Set()).add(n);
    if (r) notifyWrites(e);
    return true;
  }
};
function observerHoldsContainer(e, n) {
  const t = e.k;
  if (t === null) return false;
  const r = t.qe;
  return r !== null && r.o === n && (!(n.R & REACTIVE_RECOMPUTING_DEPS) || r.Ue === n.Ge);
}
function storeSetter(e, n, t = true) {
  const r = e[$TARGET];
  const i = writeScopes;
  writeScopes = /* @__PURE__ */ new Set();
  writeScopes.add(scopeKey(r));
  const o = userWrite;
  userWrite = t;
  writing++;
  let l;
  try {
    l = n(e);
  } finally {
    writing--;
    writeScopes = i;
    if (writing === 0 && pendingNotify.size) {
      const e2 = [...pendingNotify];
      pendingNotify.clear();
      for (const n2 of e2) notifyWrites(n2);
      if (directCommit) {
        for (const n2 of e2) if (n2.pb !== null) foldTarget(n2, n2.v);
      }
    }
    userWrite = o;
  }
  if (l !== void 0 && l !== e && isWrappable(l)) {
    if (t && r.fam?.opt === true && !writeOverride) optHooks.writes(r, unwrapValue(l));
    else adoptPB(r, unwrapValue(l));
  }
  if (t && heldDerivationHit) {
    heldDerivationHit = false;
    const e2 = r.fam.node;
    if (!(e2.R & REACTIVE_DIRTY)) {
      e2.R = e2.R & ~REACTIVE_CHECK | REACTIVE_DIRTY;
      insertIntoHeap(e2, dirtyQueue);
      schedule();
    }
  }
}
function visibleKeys(e, n) {
  let t;
  if (e.ovl && n === e.pb) {
    t = Reflect.ownKeys(e.v);
    const r = e.del;
    if (r !== null && r.size !== 0) t = t.filter((e2) => !r.has(e2));
    for (const r2 of Reflect.ownKeys(n)) {
      if (!hasOwn.call(e.v, r2)) t.push(r2);
    }
  } else t = Reflect.ownKeys(n);
  for (let e2 = t.length - 1; e2 >= 0 && typeof t[e2] === "symbol"; e2--) {
    if (t[e2] === $OWNER) {
      t.splice(e2, 1);
      break;
    }
  }
  return t;
}
function visibleDescriptor(e, n, t) {
  let r = Object.getOwnPropertyDescriptor(n, t);
  if (e.ovl && n === e.pb) {
    if (e.del !== null && e.del.has(t)) return void 0;
    if (r === void 0) r = Object.getOwnPropertyDescriptor(e.v, t);
  }
  return r;
}

// node_modules/@solidjs/signals/dist/prod/store/reconcile.js
function reconcileState(e, n, t, o = false) {
  if (n == null) throw new Error("");
  const f = n?.[$TARGET];
  if (f === void 0 || f.px !== n) throw new Error("");
  const l = t === null ? null : typeof t === "string" ? (e2) => e2?.[t] : t;
  if (userWriting() && f.fam?.opt === true) {
    optHooks.reconcile(n, unwrapValue(e), l);
    return;
  }
  if (o && e !== n && e?.[$TARGET] !== void 0) {
    const n2 = f.pb ?? f.v;
    if (n2 === e) return;
    adoptPB(f, e);
    return;
  }
  const i = unwrapValue(e);
  if (l) {
    const e2 = f.pb ?? f.v;
    const n2 = l(e2);
    if (n2 !== void 0 && !sameKey(l(i), n2)) {
      if (!o) throw new Error("");
      const e3 = f.pb ?? f.v;
      if (isOwned(e3)) delete e3[$OWNER];
      else (f.fam?.map ?? storeLookup).delete(e3);
      adoptPB(f, i);
      return;
    }
  }
  applyAdopt(f, i, l, o);
}
function applyAdopt(e, n, t, o = false) {
  const f = e.ovl ? materializePB(e) : e.pb ?? e.v;
  if (n === f && !isOwned(f)) return;
  const l = e.fam;
  const i = l?.opt === true ? optHooks.view(e, f) : f;
  const u = Array.isArray(n);
  const s = e.s === true;
  const r = f;
  adoptPB(e, n, false);
  if (s) markRawIngest(n);
  if (Array.isArray(i) !== u) {
    notifyFold(e, r, n);
    return;
  }
  if (u) {
    const f2 = i;
    const u2 = n;
    const a2 = e.n;
    let c2 = 0;
    if (t && !s) {
      const i2 = f2.length;
      const s2 = u2.length;
      let d2 = false;
      let p2 = 0;
      for (const y2 = Math.min(i2, s2); p2 < y2; p2++) {
        const i3 = u2[p2];
        const s3 = f2[p2];
        if (s3 !== i3 && !(s3 !== null && typeof s3 === "object" && i3 !== null && typeof i3 === "object" && sameKey(t(s3), t(i3)))) break;
        if ((s3 !== i3 || i3 !== null && typeof i3 === "object" && isOwned(i3)) && i3 !== null && typeof i3 === "object") descend(unwrapValue(s3), i3, t, l, o);
        if (e.dk !== null && !d2 && !(i3 !== null && typeof i3 === "object" ? targetsEqual(s3, i3) : isEqual(s3, i3))) {
          bumpDeep(e);
          d2 = true;
        }
        if (a2 !== null) {
          const e2 = a2[p2];
          if (e2 !== void 0) {
            c2++;
            notifyKeyValue(e2, p2, r[p2], i3, r, n);
          }
        }
      }
      if (e.dk !== null && !d2 && p2 < u2.length) bumpDeep(e);
      const y = p2;
      let w = null;
      for (; p2 < u2.length; p2++) {
        const e2 = u2[p2];
        if (e2 !== null && typeof e2 === "object") {
          const n2 = t(e2);
          let i3;
          if (n2 !== void 0) {
            if (w === null) {
              w = /* @__PURE__ */ new Map();
              for (let e4 = y; e4 < f2.length; e4++) {
                const n3 = unwrapValue(f2[e4]);
                if (n3 !== null && typeof n3 === "object") {
                  const o2 = t(n3);
                  if (o2 === void 0) continue;
                  const f3 = w.get(o2);
                  if (f3 === void 0) w.set(o2, e4);
                  else if (Array.isArray(f3)) f3.push(e4);
                  else w.set(o2, [f3, e4]);
                }
              }
            }
            const e3 = w.get(n2);
            if (e3 === void 0) i3 = void 0;
            else if (Array.isArray(e3)) {
              i3 = unwrapValue(f2[e3.shift()]);
              if (e3.length === 1) w.set(n2, e3[0]);
            } else {
              i3 = unwrapValue(f2[e3]);
              w.delete(n2);
            }
          } else {
            i3 = unwrapValue(f2[p2]);
          }
          descend(i3, e2, t, l, o);
        }
        if (a2 !== null) {
          const e3 = a2[p2];
          if (e3 !== void 0) {
            c2++;
            notifyKeyDiff(e3, p2, r, n, false);
          }
        }
      }
    } else {
      const i2 = Math.min(f2.length, u2.length);
      const d2 = u2.length;
      let p2 = false;
      for (let y = 0; y < d2; y++) {
        const d3 = u2[y];
        if (!s && y < i2 && d3 !== null && typeof d3 === "object") descend(unwrapValue(f2[y]), d3, t, l, o);
        if (e.dk !== null && !p2 && !(d3 !== null && typeof d3 === "object" ? targetsEqual(f2[y], d3) : isEqual(f2[y], d3))) {
          bumpDeep(e);
          p2 = true;
        }
        if (a2 !== null) {
          const e2 = a2[y];
          if (e2 !== void 0) {
            c2++;
            notifyKeyDiff(e2, y, r, n, false);
          }
        }
      }
    }
    if (a2 !== null && c2 < e.nc) {
      for (const e2 of Reflect.ownKeys(a2)) {
        const t2 = typeof e2 === "string" ? +e2 : NaN;
        if (!(t2 >= 0 && t2 < u2.length)) notifyKeyDiff(a2[e2], e2, r, n, false);
      }
    }
    notifyFoldTail(e, r, n);
    return;
  }
  const a = e.n;
  let c = 0;
  let d = false;
  for (const f2 in n) {
    const u2 = n[f2];
    const p2 = r[f2];
    const y = u2 !== null && typeof u2 === "object";
    if (p2 === u2 && (!y || !isOwned(u2)) && (a === null || a[f2] === void 0 || !hasAccessorFlag(a[f2]))) {
      if (a !== null && a[f2] !== void 0) c++;
      continue;
    }
    if (y && !s) descend(unwrapValue(i[f2]), u2, t, l, o);
    if (e.dk !== null && !d && !(y ? targetsEqual(p2, u2) : isEqual(p2, u2))) {
      bumpDeep(e);
      d = true;
    }
    if (a !== null) {
      const e2 = a[f2];
      if (e2 !== void 0) {
        c++;
        notifyKeyValue(e2, f2, p2, u2, r, n);
      }
    }
  }
  const p = Object.getOwnPropertySymbols(n);
  for (let e2 = 0; e2 < p.length; e2++) {
    const f2 = p[e2];
    if (f2 === $OWNER) continue;
    const i2 = n[f2];
    if (!s && i2 !== null && typeof i2 === "object") descend(unwrapValue(r[f2]), i2, t, l, o);
    if (a !== null) {
      const e3 = a[f2];
      if (e3 !== void 0) {
        c++;
        notifyKeyValue(e3, f2, r[f2], i2, r, n);
      }
    }
  }
  if (a !== null && c < e.nc) {
    for (const e2 of Reflect.ownKeys(a)) {
      if (!hasOwnP.call(n, e2)) notifyKeyDiff(a[e2], e2, r, n, false);
    }
  }
  notifyFoldTail(e, r, n);
}
var hasOwnP = Object.prototype.hasOwnProperty;
function descend(e, n, t, o, f = false) {
  if (e === null || typeof e !== "object" || n === null || typeof n !== "object") return;
  const l = lookupTarget(e, o);
  if (l === void 0) return;
  if (!isWrappable(n)) return;
  if (rawValuesUsed && isRawValue(n)) return;
  n = unwrapValue(n);
  if (Array.isArray(e) !== Array.isArray(n)) return;
  if (t) {
    const o2 = t(e);
    const f2 = t(n);
    if (o2 !== void 0 && f2 !== void 0 && !sameKey(o2, f2)) return;
  }
  if (!f && t !== null && !l.d) return;
  applyAdopt(l, n, t, f);
}

// node_modules/@solidjs/signals/dist/prod/store/projection.js
function wrapDraft(e, t, r, n, o, i) {
  const mutate = (e2) => {
    if (!t()) return true;
    setWriteOverride(true);
    const n2 = question;
    if (i !== void 0) setQuestion(i());
    try {
      r ? r(e2) : e2();
    } finally {
      setWriteOverride(false);
      setQuestion(n2);
    }
    if (o) o();
    return true;
  };
  const read2 = (e2) => {
    setWriteOverride(true);
    try {
      return e2();
    } finally {
      setWriteOverride(false);
    }
  };
  const s = {
    get(s2, c2) {
      const u2 = read2(() => e[c2]);
      return !n && typeof u2 === "object" && u2 !== null && c2 !== $TARGET ? wrapDraft(u2, t, r, false, o, i) : u2;
    },
    has: (t2, r2) => read2(() => r2 in e),
    set: (t2, r2, n2) => mutate(() => {
      e[r2] = n2;
    }),
    deleteProperty: (t2, r2) => mutate(() => {
      delete e[r2];
    }),
    ownKeys: () => read2(() => Reflect.ownKeys(e)),
    getOwnPropertyDescriptor(t2, r2) {
      const n2 = read2(() => Reflect.getOwnPropertyDescriptor(e, r2));
      if (n2) n2.configurable = true;
      return n2;
    },
    defineProperty: (t2, r2, n2) => mutate(() => {
      Reflect.defineProperty(e, r2, n2);
    })
  };
  const c = new Proxy(Array.isArray(e) ? [] : {}, s);
  const u = e[$TARGET];
  if (u !== void 0) setLookup(c, u);
  return c;
}
function cloneState(e, t) {
  return t ? Array.isArray(e) ? e.slice() : {
    ...e
  } : JSON.parse(JSON.stringify(e));
}
function wakeFamily(e, t) {
  const r = e.node;
  e.woke = true;
  forEachFamilyNode(e, (e2) => {
    if (e2.t === null) return;
    addPendingSource(e2, r);
    propagateStatus(e2, STATUS_PENDING, t);
  });
}
function errorFamily(e) {
  forEachFamilyNode(e, (e2) => {
    if (e2.t === null) return;
    forEachDependent(e2, (e3) => {
      enqueueSub(e3);
    });
  });
  schedule();
}
function settleFamily(e) {
  if (!e.woke) return;
  e.woke = false;
  const t = e.node;
  forEachFamilyNode(e, (e2) => {
    if (e2.t !== null) settlePendingSource(e2, t);
  });
}
function forEachFamilyNode(e, t) {
  for (const r of e.live) {
    const e2 = r.n;
    if (e2 !== null) for (const r2 of Reflect.ownKeys(e2)) t(e2[r2]);
    const n = r.h;
    if (n !== null) for (const e3 of Reflect.ownKeys(n)) t(n[e3]);
    if (r.k !== null) t(r.k);
    if (r.dk !== null) t(r.dk);
  }
}
function runProjectionComputed(e, t, r, n, o) {
  const i = getOwner();
  const s = e[$TARGET];
  const c = s.fam;
  const u = c.run = (c.run || 0) + 1;
  let l;
  const a = i._e ? cloneState(s.v, s.s) : null;
  const asking = () => question || (i.m !== null && i.m.De !== null ? i.m.Oe : 0);
  const f = wrapDraft(
    e,
    () => c.run === u && !isDisposed(i),
    o,
    s.s,
    // A write after the run returned (a continuation, a callback) arms the
    // drain itself when no landing will.
    () => {
      if (!(i.G & STATUS_PENDING) && !i._e) schedule();
    },
    asking
  );
  const d = u === 1;
  const pass = () => storeSetter(f, (o2) => {
    l = t(a ?? o2);
    const commit = (t2) => {
      if (a && (t2 === void 0 || t2 === a)) t2 = cloneState(a, s.s);
      if (t2 !== o2 && t2 !== void 0) {
        const write = () => {
          const n2 = question;
          setQuestion(asking());
          try {
            storeSetter(e, (e2) => reconcileState(t2, e2, r, true), false);
          } finally {
            setQuestion(n2);
          }
        };
        n ? n(write, t2) : write();
      }
      if (!d || !(i.G & STATUS_UNINITIALIZED)) settleFamily(c);
    };
    const u2 = handleAsync(i, l, commit, (e2, t2) => {
      if (d && i.G & STATUS_UNINITIALIZED) return;
      if (t2) wakeFamily(c, e2);
      else errorFamily(c);
    });
    if (!i._e) commit(u2);
  }, false);
  try {
    d ? runDirect(pass) : pass();
  } catch (e2) {
    if (e2 instanceof NotReadyError && !d) wakeFamily(c, e2);
    throw e2;
  }
  if (i.G & STATUS_PENDING && i.m.De !== null && !i._e && !d) wakeFamily(c, i.m?.V);
  return i;
}

// node_modules/@solidjs/signals/dist/prod/store/optimistic.js
var hasOwn2 = Object.prototype.hasOwnProperty;
var optStaged = /* @__PURE__ */ new Map();
function writerBacking(e) {
  const n = committed(e);
  const t = n[$TARGET];
  return t === void 0 ? n : optimisticView(t, writerBacking(t), laneValueOf, true);
}
function optimisticDraft(e) {
  if (e.pb !== null) optStaged.set(e, e.pb);
  return cloneRaw(optimisticView(e, writerBacking(e), laneValueOf, true), e);
}
function notifyOptimisticWrites(e, n) {
  const t = writerBacking(e);
  const i = optimisticView(e, t, laneValueOf, true);
  const r = Array.isArray(n);
  const o = e.ch ? e.v : null;
  const guess = (e2, n2, i2, r2) => {
    if (o !== null) e2.pe = i2 ? n2 in t : unwrapValue(t[n2]);
    optimisticWrite(e2, () => r2);
  };
  let s = false;
  for (const t2 of Reflect.ownKeys(n)) {
    if (r && t2 === "length" || t2 === $OWNER) continue;
    const f2 = n[t2];
    const a = unwrapValue(o && f2 ? resolveChainedRaw(e, t2, f2) : f2);
    if (!(t2 in i)) {
      guess(getNode(e, t2), t2, false, a);
      guess(getHasNode(e, t2), t2, true, true);
      s = true;
    } else {
      const n2 = i[t2];
      const f3 = unwrapValue(o && n2 ? resolveChainedRaw(e, t2, n2) : n2);
      if (!isEqual(f3, a) && !targetsEqual(f3, a)) {
        guess(getNode(e, t2), t2, false, a);
        if (r) s = true;
      }
    }
  }
  for (const t2 of Reflect.ownKeys(i)) {
    if (r && t2 === "length" || t2 === $OWNER) continue;
    if (t2 in n) continue;
    guess(getNode(e, t2), t2, false, void 0);
    guess(getHasNode(e, t2), t2, true, false);
    s = true;
  }
  if (r && i.length !== n.length) {
    guess(getNode(e, "length"), "length", false, n.length);
    s = true;
  }
  if (s) {
    const o2 = r ? n.map(unwrapValue) : shallowKeys(n);
    let s2 = null;
    const f2 = e.fam.key;
    if (r && f2 !== null && f2 !== void 0) {
      const e2 = /* @__PURE__ */ new Set();
      for (let n2 = 0; n2 < o2.length; n2++) {
        const t2 = isWrappable(o2[n2]) ? f2(o2[n2]) : void 0;
        if (t2 !== void 0) e2.add(t2);
      }
      for (let n2 = 0; n2 < i.length; n2++) {
        const t2 = unwrapValue(i[n2]);
        const r2 = isWrappable(t2) ? f2(t2) : void 0;
        if (r2 !== void 0 && !e2.has(r2)) (s2 ??= /* @__PURE__ */ new Set()).add(r2);
      }
    }
    optimisticWrite(getContainerNode(e), new LaneView(o2, t, s2));
  }
  if (e.dk !== null) optimisticWrite(e.dk, {});
  markOverlaid(e);
  const f = optStaged.get(e);
  if (f === void 0) return null;
  optStaged.delete(e);
  return f;
}
function arrangement(e, n, t) {
  const i = n instanceof LaneView;
  const r = t instanceof LaneView;
  if (!i && !r) return false;
  return arrangementEqual(i ? n.rows : n, r ? t.rows : t, e.fam?.key ?? null);
}
function rowSame(e, n, t) {
  if (isEqual(e, n) || targetsEqual(e, n)) return true;
  if (t === null || !isWrappable(e) || !isWrappable(n)) return false;
  const i = t(unwrapValue(e));
  const r = t(unwrapValue(n));
  return i !== void 0 && sameKey(i, r);
}
function arrangementEqual(e, n, t) {
  if (Array.isArray(e) !== Array.isArray(n)) return false;
  if (Array.isArray(e)) {
    if (e.length !== n.length) return false;
    for (let i2 = 0; i2 < e.length; i2++) if (!rowSame(e[i2], n[i2], t)) return false;
    return true;
  }
  const i = Reflect.ownKeys(e).filter((e2) => e2 !== $OWNER);
  const r = Reflect.ownKeys(n).filter((e2) => e2 !== $OWNER);
  if (i.length !== r.length) return false;
  for (const e2 of i) if (!(e2 in n)) return false;
  return true;
}
function reconcileDraft(e, n, t) {
  if (Array.isArray(n)) {
    const i = e.length;
    const r = new Array(i);
    for (let n2 = 0; n2 < i; n2++) r[n2] = e[n2];
    let o = null;
    if (t !== null) {
      o = /* @__PURE__ */ new Map();
      for (let e2 = 0; e2 < i; e2++) {
        const n2 = unwrapValue(r[e2]);
        if (!isWrappable(n2)) continue;
        const i2 = t(n2);
        if (i2 !== void 0 && !o.has(i2)) o.set(i2, r[e2]);
      }
    }
    for (let s = 0; s < n.length; s++) {
      const f = n[s];
      let a;
      if (isWrappable(f)) {
        if (o !== null) {
          const e2 = t(f);
          if (e2 !== void 0) a = o.get(e2);
        } else if (s < i && isWrappable(unwrapValue(r[s]))) a = r[s];
      }
      if (a !== void 0) {
        if (unwrapValue(a) !== f) reconcileDraft(a, f, t);
        if (e[s] !== a) e[s] = a;
      } else if (unwrapValue(e[s]) !== f) e[s] = f;
    }
    if (e.length !== n.length) e.length = n.length;
    return;
  }
  for (const i of Object.keys(n)) {
    const r = n[i];
    const o = e[i];
    const s = unwrapValue(o);
    if (isWrappable(r) && isWrappable(s) && Array.isArray(r) === Array.isArray(s) && (t === null || Array.isArray(r) || sameKey(t(r), t(s)))) {
      if (s !== r) reconcileDraft(o, r, t);
    } else if (s !== r) e[i] = r;
  }
  for (const t2 of Object.keys(e)) if (!(t2 in n)) delete e[t2];
}
GlobalQueue.En = (e, n) => {
  const t = e.ot;
  if (t === void 0 || e.rt !== $TRACK) return;
  const i = e.m.Z;
  if (!(i instanceof LaneView)) return;
  if (!Array.isArray(n) || !Array.isArray(i.rows)) {
    i.base = n;
    return;
  }
  const r = t.fam?.key ?? null;
  if (r === null) return;
  const o = /* @__PURE__ */ new Map();
  for (let e2 = 0; e2 < n.length; e2++) {
    const t2 = n[e2];
    const i2 = isWrappable(t2) ? r(t2) : void 0;
    if (i2 !== void 0 && !o.has(i2)) o.set(i2, t2);
  }
  const s = /* @__PURE__ */ new Set();
  const f = [];
  const a = i.rows;
  for (let e2 = 0; e2 < a.length; e2++) {
    const n2 = a[e2];
    const t2 = isWrappable(n2) ? r(n2) : void 0;
    const i2 = t2 !== void 0 ? o.get(t2) : void 0;
    if (i2 !== void 0) {
      f.push(i2);
      s.add(t2);
    } else f.push(n2);
  }
  const l = i.removed;
  for (let e2 = 0; e2 < n.length; e2++) {
    const t2 = n[e2];
    const i2 = isWrappable(t2) ? r(t2) : void 0;
    if (i2 !== void 0 && !s.has(i2) && (l === null || !l.has(i2))) f.push(t2);
  }
  i.rows = f;
  i.base = f;
  const u = txOf(e);
  const c = committed(t);
  const d = t.n;
  for (let e2 = 0; e2 < f.length; e2++) {
    const n2 = d?.[e2];
    if (n2 === void 0) {
      if (!sameRow(c[e2], f[e2], r)) laneSet(getNode(t, e2), f[e2], u);
    } else if (!sameRow(n2.u & CONFIG_OVERRIDE ? n2.m.Z : c[e2], f[e2], r)) laneSet(n2, f[e2], u);
  }
  if (d !== null) {
    for (let e3 = f.length; ; e3++) {
      const n2 = d[e3];
      if (n2 === void 0) break;
      laneSet(n2, void 0, u);
    }
    const e2 = d.length;
    if (e2 !== void 0 && (e2.u & CONFIG_OVERRIDE || c.length !== f.length)) laneSet(e2, f.length, u);
  }
};
function sameRow(e, n, t) {
  if (e === n) return true;
  if (!isWrappable(e) || !isWrappable(n)) return false;
  const i = t(unwrapValue(e));
  return i !== void 0 && sameKey(i, t(unwrapValue(n)));
}
function laneSet(e, n, t) {
  const i = ext(e);
  if (!(e.u & CONFIG_OVERRIDE)) {
    e.u |= CONFIG_OVERRIDE;
    list(e, t);
  } else if (i.Z === n) return;
  i.Z = n;
  if (e.t !== null) {
    insertSubs(e);
    laneDirty(e, t);
  }
}
installOptHooks({
  draft: optimisticDraft,
  writes: notifyOptimisticWrites,
  arrangement,
  reconcile: reconcileDraft,
  view: (e, n, t = false) => t ? optimisticView(e, n, laneValueOf, true) : optimisticView(e, n),
  has: optimisticHas,
  descriptor: optimisticOwnDescriptor,
  sweep: sweepOverlaid
});
function shallowKeys(e) {
  const n = {};
  for (const t of Reflect.ownKeys(e)) if (t !== $OWNER) n[t] = unwrapValue(e[t]);
  return n;
}
var overlaidFamilies = /* @__PURE__ */ new Set();
function markOverlaid(e) {
  const n = e.fam;
  (n.overlaid ??= /* @__PURE__ */ new Set()).add(e);
  overlaidFamilies.add(n);
}
function sweepOverlaid() {
  if (overlaidFamilies.size === 0) return;
  for (const e of overlaidFamilies) {
    const n = e.overlaid;
    for (const e2 of n) if (!carriesLane(e2)) {
      n.delete(e2);
      if (e2.ch) rebaseChained(e2);
      const t = e2.k;
      if (t !== null && t.pe instanceof LaneView) t.pe = t.pe.base;
    }
    if (n.size === 0) overlaidFamilies.delete(e);
  }
}
function rebaseChained(e) {
  const n = e.v;
  let t = false;
  const i = e.n;
  if (i !== null) for (const e2 of Reflect.ownKeys(i)) {
    const r2 = i[e2];
    const o2 = untrack(() => unwrapValue(n[e2]));
    if (r2.We && r2.We(r2.pe, o2)) continue;
    r2.pe = o2;
    if (r2.t !== null && r2.ze !== notifyEpoch) {
      insertSubs(r2);
      t = true;
    }
  }
  const r = e.h;
  if (r !== null) for (const e2 of Reflect.ownKeys(r)) {
    const i2 = r[e2];
    const o2 = untrack(() => e2 in n);
    if (i2.pe === o2) continue;
    i2.pe = o2;
    if (i2.t !== null && i2.ze !== notifyEpoch) {
      insertSubs(i2);
      t = true;
    }
  }
  const o = e.k;
  if (o !== null && o.t !== null && o.pe instanceof LaneView && o.ze !== notifyEpoch) {
    const i2 = Array.isArray(n) ? untrack(() => n.map(unwrapValue)) : n;
    if (!arrangementEqual(o.pe.rows, i2, e.fam?.key ?? null)) {
      insertSubs(o);
      t = true;
    }
  }
  if (t) schedule();
}
function carriesLane(e) {
  if (e.k !== null && e.k.u & CONFIG_OVERRIDE) return true;
  if (e.dk !== null && e.dk.u & CONFIG_OVERRIDE) return true;
  const n = e.n;
  if (n !== null) {
    for (const e2 of Reflect.ownKeys(n)) if (n[e2].u & CONFIG_OVERRIDE) return true;
  }
  const t = e.h;
  if (t !== null) {
    for (const e2 of Reflect.ownKeys(t)) if (t[e2].u & CONFIG_OVERRIDE) return true;
  }
  return false;
}
function overlaid(e) {
  const n = e.fam;
  return n !== null && n.opt === true && n.overlaid !== void 0 && n.overlaid.has(e);
}
var shown = (e) => untrack(() => read(e));
function optimisticHas(e, n) {
  if (!overlaid(e)) return void 0;
  const t = e.h?.[n];
  if (t !== void 0 && t.u & CONFIG_OVERRIDE) return !!shown(t);
  const i = e.n?.[n];
  if (i !== void 0 && i.u & CONFIG_OVERRIDE) return shown(i) !== void 0;
  return void 0;
}
function optimisticOwnDescriptor(e, n) {
  const t = optimisticHas(e, n);
  if (t === void 0) return void 0;
  if (!t) return null;
  const i = e.n?.[n];
  const r = i !== void 0 && i.u & CONFIG_OVERRIDE ? shown(i) : e.v[n];
  if (n === "length" && Array.isArray(e.v)) return {
    value: r,
    writable: true,
    enumerable: false,
    configurable: false
  };
  return {
    value: r,
    writable: true,
    enumerable: true,
    configurable: true
  };
}
function optimisticView(e, n, t = shown, i = false) {
  if (!i && !overlaid(e)) return n;
  let r = null;
  const ensure = () => r ??= Array.isArray(n) ? [...n] : {
    ...n
  };
  const o = e.n;
  if (o !== null) {
    for (const e2 of Reflect.ownKeys(o)) {
      const r2 = o[e2];
      let s2;
      if (r2.u & CONFIG_OVERRIDE) s2 = t(r2);
      else if (!i || (s2 = pendingGuessOf(r2)) === NOT_PENDING) continue;
      if (e2 === "length" && Array.isArray(n)) {
        if (n.length !== s2) ensure().length = s2;
      } else if (!isEqual(n[e2], s2) || !hasOwn2.call(n, e2)) {
        ensure()[e2] = s2;
      }
    }
  }
  const s = e.h;
  if (s !== null) {
    for (const e2 of Reflect.ownKeys(s)) {
      const o2 = s[e2];
      let f;
      if (o2.u & CONFIG_OVERRIDE) f = t(o2);
      else if (!i || (f = pendingGuessOf(o2)) === NOT_PENDING) continue;
      const a = !!f;
      const l = r ?? n;
      if (!a && e2 in l) delete ensure()[e2];
    }
  }
  return r ?? n;
}
function createOptimisticStore(e, n, t) {
  const i = typeof e === "function";
  const r = i ? t : n;
  const o = i ? n : e;
  const s = r?.key === void 0 ? "id" : r.key;
  const f = {
    map: /* @__PURE__ */ new WeakMap(),
    node: null,
    live: /* @__PURE__ */ new Set(),
    shallow: !!r?.shallow,
    opt: true,
    key: typeof s === "function" ? s : s === null ? null : (e2) => isWrappable(e2) ? e2[s] : void 0
  };
  const a = wrap(o, null, null, f);
  if (f.shallow) {
    a[$TARGET].s = true;
    markRawIngest(o);
  }
  if (i) {
    const n2 = e;
    let t2;
    if (r?.seedLoadingValue) t2 = {
      loadingValue: void 0
    };
    const i2 = computed(() => {
      if (!f.node) f.node = getOwner();
      runProjectionComputed(a, n2, s);
    }, t2);
    i2.u &= ~CONFIG_AUTO_DISPOSE;
    f.node = i2;
  }
  return [a, (e2) => storeSetter(a, e2)];
}

// node_modules/@solidjs/signals/dist/prod/flatten.js
function flatten(r, t) {
  if (typeof r === "function" && !r.length) {
    if (t?.doNotUnwrap) return r;
    do {
      r = r();
    } while (typeof r === "function" && !r.length);
  }
  if (t?.skipNonRendered && (r == null || r === true || r === false || r === "")) return;
  if (Array.isArray(r)) {
    let e = [];
    if (flattenArray(r, e, t)) {
      return () => {
        let r2 = [];
        flattenArray(e, r2, {
          ...t,
          doNotUnwrap: false
        });
        return r2;
      };
    }
    return e;
  }
  return r;
}
function flattenArray(r, t = [], e) {
  let o = null;
  let f = false;
  for (let n = 0; n < r.length; n++) {
    try {
      let o2 = r[n];
      if (typeof o2 === "function" && !o2.length) {
        if (e?.doNotUnwrap) {
          t.push(o2);
          f = true;
          continue;
        }
        do {
          o2 = o2();
        } while (typeof o2 === "function" && !o2.length);
      }
      if (Array.isArray(o2)) {
        f = flattenArray(o2, t, e) || f;
      } else if (e?.skipNonRendered && (o2 == null || o2 === true || o2 === false || o2 === "")) {
      } else t.push(o2);
    } catch (r2) {
      if (!(r2 instanceof NotReadyError)) throw r2;
      o = r2;
    }
  }
  if (o) throw o;
  return f;
}

// node_modules/@solidjs/signals/dist/prod/boundaries.js
var BOUNDARY = /* @__PURE__ */ Symbol("");
var REVEAL = /* @__PURE__ */ Symbol("");
var revealHooks = null;
var collecting = /* @__PURE__ */ new Set();
var boundaryOf = (e) => e.U[BOUNDARY];
var isCollecting = (e) => e.i === STATUS_ERROR || !e.L || e.k;
function caught(e, n, r) {
  if (e.i === STATUS_ERROR) {
    r ??= n.m?.V;
    n = r?.source ?? n;
    const t = unwrapStatusError(r);
    setSignal(e.V, t);
    reportClientError(t, e.v, n);
  }
  e.H.add(n);
  collecting.add(e);
  if (e.k) flip(e);
  if (!e.P) redraw(e);
  if (e.B !== null) revealHooks.j(e.B);
}
function flip(e) {
  e.L = false;
  e.Z = e.W;
  if (e.Z !== null && e.K !== null) GlobalQueue.M(e.K, e.Z, true, false);
}
function redraw(e) {
  if (e.K !== null && !(e.K.R & (REACTIVE_DISPOSED | REACTIVE_ZOMBIE))) {
    enqueueSub(e.K);
    schedule();
  }
}
function catchStatus(e, n, r) {
  if (n === 0) {
    if (collecting.size !== 0) {
      for (let n2 = boundaryOf(e); n2 !== void 0; n2 = n2._parent ?? void 0) if (!(e.G & unsettled(n2)) && n2.H.delete(e) && n2.H.size === 0) {
        if (n2.P) redraw(n2);
        if (n2.B !== null) revealHooks.j(n2.B);
      }
    }
    return false;
  }
  for (let t = boundaryOf(e); t !== void 0; t = t._parent ?? void 0) {
    if (!(t.i & n)) continue;
    if (isCollecting(t)) {
      caught(t, e, r);
      return true;
    }
    t.H.add(e);
    collecting.add(t);
  }
  return false;
}
function hiddenBy(e) {
  for (let n = boundaryOf(e); n !== void 0; n = n._parent ?? void 0) if (n.P) return n;
  return void 0;
}
function hidden(e) {
  return hiddenBy(e) !== void 0;
}
function heldRun(e) {
  const n = hiddenBy(e);
  if (n === void 0) return false;
  (n.Y ??= /* @__PURE__ */ new Set()).add(e);
  return true;
}
function release(e) {
  if (e.Y === null) return;
  for (const n of e.Y) {
    const e2 = n.i;
    globalQueue.enqueue(e2 === EFFECT_TRACKED ? EFFECT_USER : e2, e2 === EFFECT_TRACKED ? n.q : n.J ??= GlobalQueue.X.bind(null, n));
  }
  e.Y = null;
}
var unsettled = (e) => e.i === STATUS_ERROR ? STATUS_ERROR | STATUS_PENDING : STATUS_PENDING;
function prune(e, n) {
  const r = unsettled(e);
  for (const t of e.H) {
    if (t.R & REACTIVE_DISPOSED) e.H.delete(t);
    else if (!(t.G & r)) {
      if (t !== e.$ && (t.u & (CONFIG_HELD | CONFIG_OVERRIDE)) === CONFIG_HELD) {
        if (!n) continue;
        joinFuture(txOf(t));
      }
      e.H.delete(t);
    }
  }
  return e.H.size;
}
function boundarySeam() {
  for (const e of collecting) {
    const n = e.K.R;
    if (n & REACTIVE_DISPOSED) {
      collecting.delete(e);
      continue;
    }
    if (n & REACTIVE_ZOMBIE) continue;
    prune(e, false);
    e.k = false;
    if (e.H.size === 0) {
      collecting.delete(e);
      if (e.P) redraw(e);
      if (e.B !== null) revealHooks.j(e.B);
    }
  }
}
function verdictDerived(e) {
  if (e.u & CONFIG_VERDICT) return true;
  for (let n = e._; n !== null; n = n.p) if (n.I.u & CONFIG_VERDICT) return true;
  return false;
}
function arm(e) {
  if (!e.L) {
    if (e.P && e.Z === null && e.W === null && passLane !== null) {
      e.W = passLane;
      flip(e);
      redraw(e);
    }
    return;
  }
  e.k = true;
  let n = passLane;
  if (n === null && globalQueue.ee && verdictDerived(getOwner())) {
    joinFuture(null);
    n = GlobalQueue.ne(flushTransaction);
  }
  e.W = n;
  collecting.add(e);
  for (const n2 of e.H) {
    if (n2.G & STATUS_PENDING && !(n2.R & REACTIVE_DISPOSED)) {
      flip(e);
      redraw(e);
      return;
    }
  }
}
function reset(e) {
  for (const n of [...e.H]) if (n.re !== void 0 && !(n.R & REACTIVE_DISPOSED)) recompute(n);
  schedule();
}
function createBoundary(e, n, r, t) {
  const l = createOwner();
  const o = {
    i: e,
    _parent: boundaryOf(l) ?? null,
    v: l,
    $: null,
    K: null,
    H: /* @__PURE__ */ new Set(),
    L: false,
    k: false,
    W: null,
    Z: null,
    P: false,
    Y: null,
    B: null,
    te: false,
    le: false,
    V: e === STATUS_ERROR ? signal(void 0, ERROR_SIGNAL) : null,
    oe: r
  };
  const u = e === STATUS_PENDING ? l.U[REVEAL] : null;
  if (getOwner()) cleanup(() => {
    collecting.delete(o);
    if (u) revealHooks.ue(u, o);
  });
  if (t) {
    let e2 = false;
    runWithOwner(l, () => computed(() => {
      try {
        t();
      } catch (e3) {
        if (!(e3 instanceof NotReadyError)) {
          if (!globalQueue.notify(getOwner(), STATUS_ERROR, STATUS_ERROR, e3)) {
            haltReactivity(e3);
            throw e3;
          }
          return;
        }
      }
      if (e2) arm(o);
      else e2 = true;
    })).u |= CONFIG_REDERIVE;
  }
  const a = {
    ...l.U,
    [BOUNDARY]: o
  };
  if (revealHooks !== null) a[REVEAL] = null;
  l.U = a;
  const i = runWithOwner(l, () => {
    const e2 = false ? computed(n, {
      name: "children"
    }) : computed(n);
    return false ? computed(() => flatten(read(e2)), {
      name: "boundary"
    }) : computed(() => flatten(read(e2)));
  });
  o.$ = i;
  if (u) revealHooks.ae(u, o);
  const f = computed(
    () => {
      if (o.te) {
        link(i, getOwner());
        if (o.B !== null) revealHooks.j(o.B);
        if (o.te) {
          if (o.le) {
            o.P = true;
            return void 0;
          }
          return fallback(o);
        }
      }
      const n2 = i.G & (STATUS_PENDING | STATUS_ERROR);
      if (n2 !== 0) {
        link(i, getOwner());
        if (n2 & e) {
          if (isCollecting(o)) {
            caught(o, i, void 0);
            return fallback(o);
          }
          o.H.add(i);
          collecting.add(o);
        }
        throw i.m.V;
      }
      if (isCollecting(o)) {
        const e2 = getOwner();
        if (o.H.size !== 0 && e2.G & STATUS_UNINITIALIZED && !(e2.u & CONFIG_HELD)) return fallback(o);
        if (prune(o, true) !== 0) return fallback(o);
      }
      let r2;
      try {
        r2 = read(i);
      } catch (n3) {
        if (n3 instanceof NotReadyError ? e === STATUS_PENDING : e === STATUS_ERROR) {
          if (isCollecting(o)) {
            caught(o, i, n3);
            return fallback(o);
          }
          o.H.add(i);
          collecting.add(o);
        }
        throw n3;
      }
      if (isCollecting(o) && o.H.size !== 0) return fallback(o);
      o.L = true;
      o.P = false;
      release(o);
      if (o.B !== null) {
        const e2 = o.B;
        o.B = null;
        revealHooks.j(e2);
      }
      return r2;
    },
    // Boundary structure, not a user source: its value is fallback-or-content
    // and legitimately swaps mid-hydration (resume), so it must never be
    // frozen by snapshot capture.
    {
      ie: true
    }
  );
  f.u |= CONFIG_REDERIVE;
  o.K = f;
  return accessor(f);
}
function fallback(e) {
  if (e.Z !== null) {
    setPassLane(e.Z);
    e.K.R |= REACTIVE_LANE_READ;
    e.Z = null;
  }
  e.P = true;
  return e.oe(e);
}
var ERROR_SIGNAL = {
  ownedWrite: true,
  ie: true
};
function createLoadingBoundary(e, n, r) {
  return createBoundary(STATUS_PENDING, e, () => n(), r?.on);
}
function createErrorBoundary(e, n) {
  return createBoundary(STATUS_ERROR, e, (e2) => n(accessor(e2.V), () => reset(e2)));
}
GlobalQueue.fe = catchStatus;
GlobalQueue.ce = (e) => e.G & STATUS_UNINITIALIZED && catchStatus(e, STATUS_PENDING);
GlobalQueue.se = hidden;
GlobalQueue.Ee = boundarySeam;
GlobalQueue.de = heldRun;

// node_modules/solid-js/dist/solid.js
var IS_DEV = false;
function createContext2(defaultValue, options) {
  const id = Symbol(options && options.name || "");
  function provider(props) {
    return createRoot(() => {
      setContext(provider, props.value);
      return children(() => props.children);
    });
  }
  provider.id = id;
  provider.defaultValue = defaultValue;
  return provider;
}
function useContext(context2) {
  return getContext(context2);
}
function children(fn) {
  const c = createMemo(fn, {
    lazy: true
  });
  const memo = createMemo(() => flatten(c()), {
    lazy: true,
    sync: true
  });
  memo.toArray = () => {
    const v = memo();
    return Array.isArray(v) ? v : v != null ? [v] : [];
  };
  return memo;
}
var sharedConfig = {
  hydrating: false,
  registry: void 0,
  done: false
};
var _createRoot;
var _createSignal;
var _createErrorBoundary;
var _createRenderEffect;
var _createLoadingBoundary;
var _hydrateStoreLike;
var createSignal2 = (...args) => {
  return (_createSignal || createSignal)(...args);
};
var createErrorBoundary2 = (...args) => (_createErrorBoundary || createErrorBoundary)(...args);
var createOptimisticStore2 = (...args) => {
  return typeof args[0] === "function" && sharedConfig.hydrating ? _hydrateStoreLike(createOptimisticStore, args[0], args[1] ?? {}, args[2]) : createOptimisticStore(...args);
};
var createRoot2 = (...args) => (_createRoot || createRoot)(...args);
var createRenderEffect2 = (...args) => (_createRenderEffect || createRenderEffect)(...args);
var createLoadingBoundary2 = (fn, fallback2, options) => (_createLoadingBoundary || createLoadingBoundary)(fn, fallback2, options);
function createComponent(Comp, props, name) {
  return untrack(() => Comp(props || {}));
}
var narrowedError = (name) => `Stale read from <${name}>.`;
function For(props) {
  const options = "fallback" in props ? {
    keyed: props.keyed,
    fallback: () => props.fallback
  } : {
    keyed: props.keyed
  };
  const owner = getOwner();
  let mapped;
  const create2 = () => runWithOwner(owner, () => mapArray(() => props.each, props.children, options));
  if (sharedConfig.hydrating) mapped = create2();
  const list2 = () => (mapped ?? (mapped = create2()))();
  return list2;
}
function Show(props) {
  const keyed = props.keyed;
  const conditionValue = createMemo(() => props.when, void 0);
  const condition = keyed ? conditionValue : createMemo(conditionValue, {
    equals: (a, b) => !a === !b,
    sync: true
  });
  return createMemo(() => {
    const c = condition();
    if (c) {
      const child = props.children;
      const fn = typeof child === "function" && child.length > 0;
      return fn ? keyed ? untrack(() => child(c), IS_DEV) : untrack(() => child(() => {
        if (!untrack(condition)) throw narrowedError("Show");
        return conditionValue();
      }), IS_DEV) : child;
    }
    return props.fallback;
  }, {
    sync: true
  });
}
function Errored(props) {
  return createErrorBoundary2(() => props.children, (err, reset2) => {
    const f = props.fallback;
    return typeof f === "function" ? f(err, reset2) : f;
  });
}
function Loading(props) {
  const onOpt = "on" in props ? {
    on: () => props.on
  } : void 0;
  return createLoadingBoundary2(() => props.children, () => props.fallback, onOpt);
}

// node_modules/solid-js/dist/internal.js
var sharedConfig2 = sharedConfig;

// node_modules/@solidjs/web/dist/web.js
var $$SLOT = /* @__PURE__ */ Symbol("slot");
var $$HOST = /* @__PURE__ */ Symbol("host");
var transparentOptions = {
  transparent: true,
  sync: true
};
function effect2(fn, effectFn, options) {
  const nodeOptions = options ? {
    sync: true,
    ...options,
    transparent: !options.scope
  } : transparentOptions;
  createRenderEffect2(fn, effectFn, nodeOptions);
}
function reconcileArrays(parentNode, a, b, marker) {
  let bLength = b.length, aEnd = a.length, bEnd = bLength, aStart = 0, bStart = 0, tail = a[aEnd - 1], tailTag = tail[$$SLOT], after = tail.parentNode === parentNode && (!tailTag || tailTag === marker) ? tail.nextSibling : marker || null, map = null, anchor, anchorTag;
  const isLive = (n) => {
    if (!n) return false;
    const tag = n[$$SLOT];
    return n.parentNode === parentNode && (!tag || tag === marker);
  };
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart] && isLive(a[aStart])) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1] && isLive(a[aEnd - 1])) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      let node;
      if (bEnd < bLength) {
        if (bStart) {
          const prev = b[bStart - 1];
          const prevTag = prev[$$SLOT];
          node = prev.parentNode === parentNode && (!prevTag || prevTag === marker) ? prev.nextSibling : after;
        } else node = b[bEnd - bStart];
      } else node = after;
      while (bStart < bEnd) {
        const n = b[bStart++];
        parentNode.insertBefore(n, node);
        if (marker) n[$$SLOT] = marker;
      }
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        const n = a[aStart++];
        if (!map || !map.has(n)) {
          const tag = n[$$SLOT];
          if (n.parentNode === parentNode && (!tag || tag === marker)) n.remove();
        }
      }
    } else if ((anchor = a[aStart]) === b[bEnd - 1] && b[bStart] === a[aEnd - 1] && anchor.parentNode === parentNode && (!(anchorTag = anchor[$$SLOT]) || anchorTag === marker)) {
      if (marker) {
        do {
          const n = a[--aEnd];
          parentNode.insertBefore(n, anchor);
          n[$$SLOT] = marker;
          bStart++;
          if (aStart >= aEnd - 1 || bStart >= bEnd) break;
        } while (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]);
      } else {
        do {
          parentNode.insertBefore(a[--aEnd], anchor);
          bStart++;
          if (aStart >= aEnd - 1 || bStart >= bEnd) break;
        } while (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]);
      }
    } else {
      if (!map) {
        map = /* @__PURE__ */ new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart, sequence = 1, t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const head = a[aStart];
            const headTag = head[$$SLOT];
            const node = head.parentNode === parentNode && (!headTag || headTag === marker) ? head : after;
            while (bStart < index) {
              const n = b[bStart++];
              parentNode.insertBefore(n, node);
              if (marker) n[$$SLOT] = marker;
            }
          } else {
            const oldNode = a[aStart++];
            const newNode = b[bStart++];
            const oldTag = oldNode[$$SLOT];
            if (oldNode.parentNode === parentNode && (!oldTag || oldTag === marker)) {
              parentNode.replaceChild(newNode, oldNode);
            } else {
              parentNode.insertBefore(newNode, after);
            }
            if (marker) newNode[$$SLOT] = marker;
          }
        } else aStart++;
      } else {
        const n = a[aStart++];
        const nTag = n[$$SLOT];
        if (n.parentNode === parentNode && (!nTag || nTag === marker)) n.remove();
      }
    }
  }
}
var EVENT_KEY = "_$$";
var $$EVENT_OWNER = "_$SOLID_EVENT_OWNER";
var $$EVENT_TUPLE = /* @__PURE__ */ Symbol();
var INNER_OWNED = {};
var delegatedEvents = /* @__PURE__ */ new Set();
var delegatedContainers = /* @__PURE__ */ new Map();
function render(code, element, init, options = {}) {
  let disposer;
  registerDelegatedRoot(element);
  try {
    createRoot2((dispose2) => {
      disposer = dispose2;
      if (options.onError) getOwner()[ROOT_ERROR_HOOK] = options.onError;
      if (element === document) {
        const tree = code();
        effect2(() => flatten(tree), () => {
        });
      } else {
        const tree = code();
        insert(element, () => tree, element.firstChild ? null : void 0, init, {
          ...options.insertOptions,
          schedule: true
        });
      }
    }, {
      id: options.renderId
    });
    flush();
  } catch (err) {
    if (disposer) disposer();
    unregisterDelegatedRoot(element);
    throw err;
  } finally {
  }
  return () => {
    disposer();
    unregisterDelegatedRoot(element);
    element.textContent = "";
  };
}
function create(html, bypassGuard, flag) {
  const t = document.createElement("template");
  t.innerHTML = html;
  return flag === 2 ? t.content.firstChild.firstChild : t.content.firstChild;
}
function template(html, flag) {
  let node;
  const fn = flag === 1 ? (bypassGuard) => document.importNode(node || (node = create(html, bypassGuard, flag)), true) : (bypassGuard) => (node || (node = create(html, bypassGuard, flag))).cloneNode(true);
  return fn;
}
function delegateEvents(eventNames) {
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!delegatedEvents.has(name)) {
      delegatedEvents.add(name);
      delegatedContainers.forEach((state, container) => attachDelegatedEvent(name, container, state));
    }
  }
}
function registerDelegatedRoot(root) {
  const state = registerDelegatedContainer(root, root);
  if (state) state.roots = (state.roots || 0) + 1;
}
function unregisterDelegatedRoot(root) {
  const state = delegatedContainers.get(root);
  if (state) state.roots > 1 ? state.roots-- : delete state.roots;
  unregisterDelegatedContainer(root, root);
}
function registerDelegatedContainer(container, owner = container) {
  if (!container || !owner) return;
  let state = delegatedContainers.get(container);
  if (!state) delegatedContainers.set(container, state = {
    owners: /* @__PURE__ */ new Map(),
    handlers: /* @__PURE__ */ new Map()
  });
  state.owners.set(owner, (state.owners.get(owner) || 0) + 1);
  delegatedEvents.forEach((name) => attachDelegatedEvent(name, container, state));
  return state;
}
function unregisterDelegatedContainer(container, owner = container) {
  const state = delegatedContainers.get(container);
  if (!state) return;
  const count = state.owners.get(owner);
  if (count > 1) state.owners.set(owner, count - 1);
  else state.owners.delete(owner);
  if (state.owners.size) return;
  state.handlers.forEach((handler, name) => container.removeEventListener(name, handler));
  delegatedContainers.delete(container);
}
function attachDelegatedEvent(name, container, state) {
  if (state.handlers.has(name)) return;
  const handler = (e) => eventHandler(e, container, state);
  state.handlers.set(name, handler);
  container.addEventListener(name, handler);
}
function findOwner(target, state) {
  let node = target;
  let distance = 0;
  while (node) {
    if (state.owners.has(node)) return {
      owner: node,
      distance
    };
    distance++;
    node = node._$host || node.parentNode || node.host;
  }
}
var claimHandlers = null;
function claimElement(node) {
  if (claimHandlers !== null) {
    for (let i = 0; i < claimHandlers.length; i++) claimHandlers[i](node);
  }
  return node;
}
function setAttribute(node, name, value) {
  if (isHydrating(node)) return;
  const selectMultiple = name === "multiple" && node.localName === "select";
  if (value == null || value === false) node.removeAttribute(name);
  else {
    node.setAttribute(name, value === true ? "" : value);
    if (selectMultiple && !node._$multiple) {
      const options = node.options;
      for (let i = 0; i < options.length; i++) {
        if (options[i].defaultSelected) options[i].selected = true;
      }
    }
  }
  if (selectMultiple) node._$multiple = true;
  if (claimHandlers !== null && (name === "href" || name === "action")) claimElement(node);
}
function addEvent(node, name, handler, delegate) {
  if (delegate) {
    const key = EVENT_KEY + name;
    let data;
    if (Array.isArray(handler)) {
      data = handler[1];
      node[key] = handler[0];
    } else node[key] = handler;
    node[`${key}Data`] = data;
    return;
  }
  if (Array.isArray(handler)) {
    const handlerFn = handler[0];
    const listener = (e) => handlerFn.call(node, handler[1], e);
    listener[$$EVENT_TUPLE] = handler;
    node.addEventListener(name, listener);
    return listener;
  }
  node.addEventListener(name, handler, typeof handler !== "function" && handler);
  return handler;
}
var SCOPE_OPTIONS = {
  scope: true
};
var hydrationRt = null;
function insert(parent, accessor2, marker, initial, options) {
  const multi = marker !== void 0;
  const host = options && options.host;
  if (multi && !initial) initial = [];
  if (hydrationRt !== null) initial = hydrationRt.claimInitial(parent, multi, initial);
  if (typeof accessor2 !== "function") {
    accessor2 = normalize(accessor2, initial, multi, true);
    if (typeof accessor2 !== "function") {
      insertExpression(parent, accessor2, initial, marker);
      host && tagHost(accessor2, host);
      return;
    }
  }
  if (multi && initial.length === 0) {
    const placeholder = document.createTextNode("");
    parent.insertBefore(placeholder, marker);
    initial = [placeholder];
  }
  let current = initial;
  effect2(
    (prev) => {
      if (hydrationRt !== null) current = hydrationRt.reclaimRegion(current, parent, marker);
      const value = normalize(accessor2(), current, multi, true);
      if (typeof value !== "function") return value;
      const innerOptions = prev !== void 0 && !(options && options.schedule) ? {
        ...options,
        schedule: true
      } : options;
      effect2(() => (hydrationRt !== null && (current = hydrationRt.reclaimRegion(current, parent, marker)), normalize(value, current, multi)), (inner) => {
        current = insertExpression(parent, inner, current, marker);
        host && tagHost(current, host);
      }, innerOptions);
      return INNER_OWNED;
    },
    (value) => {
      if (value === INNER_OWNED) return;
      current = insertExpression(parent, value, current, marker);
      host && tagHost(current, host);
    },
    accessor2.$s ? options ? {
      ...options,
      scope: true
    } : SCOPE_OPTIONS : options
  );
}
function isHydrating(node) {
  if (!sharedConfig2.hydrating) return false;
  if (sharedConfig2.isClaiming && !sharedConfig2.isClaiming()) return false;
  if (!node || node.isConnected) return true;
  const roots = sharedConfig2.claimRoots;
  if (roots) {
    for (let i = 0; i < roots.length; i++) {
      if (roots[i].contains(node)) return true;
    }
  }
  return false;
}
function eventHandler(e, container, state) {
  if (hydrationRt !== null && hydrationRt.dedupEvent(e)) return;
  const prev = e[$$EVENT_OWNER];
  let resumeNode;
  if (prev) {
    if (prev === true || prev === container || !container.contains(prev)) return;
    resumeNode = prev;
  }
  const owner = state && (state.owners.size === 1 && state.owners.has(container) ? container : findOwner(e.target, state)?.owner);
  if (state && !owner) return;
  if (owner && owner === resumeNode) return;
  e[$$EVENT_OWNER] = owner || true;
  let node = resumeNode || e.target;
  const key = EVENT_KEY + e.type;
  const oriTarget = e.target;
  const boundary = owner || container || e.currentTarget;
  const retarget = (value) => Object.defineProperty(e, "target", {
    configurable: true,
    value
  });
  const handleNode = () => {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== void 0 ? handler.call(node, data, e) : typeof handler === "function" ? handler.call(node, e) : handler.handleEvent(e);
      if (e.cancelBubble) return;
    }
    node.host && typeof node.host !== "string" && !node.host._$host && node.contains(e.target) && retarget(node.host);
    return true;
  };
  const walkUpTree = () => {
    while (node && handleNode()) {
      if (node === boundary || node.parentNode === boundary) break;
      node = node._$host || node.parentNode || node.host;
    }
  };
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || boundary || document;
    }
  });
  if (resumeNode) {
    if (resumeNode === e.target) node = resumeNode._$host || resumeNode.parentNode || resumeNode.host;
    if (node && node !== boundary) walkUpTree();
  } else if (e.composedPath) {
    const path = e.composedPath();
    if (path.length) {
      retarget(path[0]);
      for (let i = 0; i < path.length; i++) {
        node = path[i];
        if (!handleNode()) break;
        if (node._$host) {
          node = node._$host;
          walkUpTree();
          break;
        }
        if (node === boundary || node.parentNode === boundary) {
          break;
        }
      }
    } else walkUpTree();
  } else walkUpTree();
  retarget(oriTarget);
}
function insertExpression(parent, value, current, marker) {
  if (hydrationRt !== null && isHydrating(parent)) {
    if (value && value !== current) {
      const arr = Array.isArray(value);
      for (const n of arr ? value : [value]) {
        if (n && n.nodeType) {
          if (!isHydrating(n)) return current;
        } else if (arr && (typeof n === "string" || typeof n === "number")) {
          return current;
        }
      }
    }
    return value;
  }
  if (value === current) return value;
  if (hydrationRt !== null && sharedConfig2.hydrating && current == null && value && [].concat(value).every((n) => n?.parentNode === parent) && value.length !== 0) return value;
  const t = typeof value, multi = marker !== void 0;
  if (t === "string" || t === "number") {
    const tc = typeof current;
    if (tc === "string" || tc === "number") {
      parent.firstChild.data = value;
    } else {
      if (ownsAllChildren(parent, current)) parent.textContent = value;
      else {
        removeOwnedChildren(parent, current);
        parent.insertBefore(document.createTextNode(value), parent.firstChild);
      }
    }
  } else if (value === void 0) {
    cleanChildren(parent, current, marker);
  } else if (value.nodeType) {
    if (Array.isArray(current)) {
      cleanChildren(parent, current, multi ? marker : null, value);
    } else if (current != null && current.nodeType) {
      current.parentNode === parent ? parent.replaceChild(value, current) : parent.appendChild(value);
    } else if (current != null && parent.firstChild) {
      parent.replaceChild(value, parent.firstChild);
    } else {
      parent.appendChild(value);
    }
    if (marker) value[$$SLOT] = marker;
  } else if (Array.isArray(value)) {
    const currentArray = Array.isArray(current);
    for (let i = 0, len = value.length; i < len; i++) {
      const item = value[i], t2 = typeof item;
      if (t2 === "string" || t2 === "number") {
        const prev = currentArray ? current[i] : void 0;
        if (prev && prev.nodeType === 3) {
          if (prev.data !== "" + item) prev.data = item;
          value[i] = prev;
        } else value[i] = document.createTextNode(item);
      }
    }
    if (value.length === 0) {
      cleanChildren(parent, current, marker);
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, value, marker);
      } else reconcileArrays(parent, current, value, marker);
    } else {
      if (current != null) cleanChildren(parent, current);
      appendNodes(parent, value);
    }
  } else ;
  return value;
}
function normalize(value, current, multi, doNotUnwrap) {
  value = flatten(value, {
    skipNonRendered: true,
    doNotUnwrap
  });
  if (doNotUnwrap && typeof value === "function") return value;
  if (multi && !Array.isArray(value)) value = [value != null ? value : ""];
  if (sharedConfig2.hydrating && Array.isArray(value)) {
    for (let i = 0, len = value.length; i < len; i++) {
      const item = value[i], prev = current && current[i], t = typeof item;
      if ((t === "string" || t === "number") && prev && prev.nodeType === 3 && isHydrating(prev)) value[i] = prev;
    }
  }
  return value;
}
function tagHost(value, host) {
  if (Array.isArray(value)) {
    for (let i = 0, len = value.length; i < len; i++) tagHost(value[i], host);
  } else if (value && value.nodeType && value[$$HOST] !== host) {
    value[$$HOST] = host;
    Object.defineProperty(value, "_$host", {
      get: host,
      configurable: true
    });
  }
}
function appendNodes(parent, array, marker = null) {
  for (let i = 0, len = array.length; i < len; i++) {
    const n = array[i];
    parent.insertBefore(n, marker);
    if (marker) n[$$SLOT] = marker;
  }
}
function ownsAllChildren(parent, current) {
  if (current == null) return true;
  if (Array.isArray(current)) {
    return current.length ? parent.firstChild === current[0] && parent.lastChild === current[current.length - 1] : parent.firstChild === null;
  }
  if (current === "") return parent.firstChild === null;
  if (current.nodeType) return parent.firstChild === current && parent.lastChild === current;
  const first = parent.firstChild;
  return first !== null && first.nodeType === 3 && parent.lastChild === first;
}
function removeOwnedChildren(parent, current) {
  if (Array.isArray(current)) {
    for (let i = 0; i < current.length; i++) {
      const el = current[i];
      if (el.parentNode === parent) el.remove();
    }
  } else if (current.nodeType) {
    if (current.parentNode === parent) current.remove();
  } else {
    const first = parent.firstChild;
    if (first && first.nodeType === 3) first.remove();
  }
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === void 0) {
    if (ownsAllChildren(parent, current)) return parent.textContent = "";
    return removeOwnedChildren(parent, current);
  }
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (replacement !== el) {
        const tag = el[$$SLOT];
        const owns = el.parentNode === parent && (!tag || tag === marker);
        if (replacement && !inserted && !i) owns ? parent.replaceChild(replacement, el) : parent.insertBefore(replacement, marker);
        else if (owns) el.remove();
      } else inserted = true;
    }
  } else if (replacement) parent.insertBefore(replacement, marker);
  if (replacement && marker) replacement[$$SLOT] = marker;
}

// src/api.ts
var pending = Promise.resolve();
function request(command) {
  const result = pending.then(async () => {
    const response = await window.studio.request({
      path: "/api/todos",
      method: command ? "POST" : "GET",
      body: command ? JSON.stringify(command) : null
    });
    if (response.status !== 200) throw new Error(response.body);
    return JSON.parse(response.body);
  });
  pending = result.then(() => {
  }, () => {
  });
  return result;
}
var api = {
  getTodos: () => request(),
  async addTodo(todo) {
    const todos = await request({ type: "add", todo });
    return todos.find((t) => t.id === todo.id);
  },
  async removeTodo(id) {
    await request({ type: "remove", id });
  },
  async toggleTodo(id, completed) {
    const todos = await request({ type: "toggle", id, completed });
    return todos.find((t) => t.id === id);
  },
  async toggleAll(ids, completed) {
    await request({ type: "toggle_all", ids, completed });
  },
  async clearCompleted(ids) {
    await request({ type: "clear_completed", ids });
  }
};

// src/todos.ts
function applyErrors(todos, errors) {
  for (const key in errors) {
    const error = errors[key];
    switch (error.type) {
      case "addTodo": {
        const newTodo = { ...error.args[0], error };
        const index = todos.findIndex((t) => t.id > newTodo.id);
        if (index > -1) todos.splice(index, 0, newTodo);
        else todos.push(newTodo);
        break;
      }
      case "removeTodo":
      case "toggleTodo": {
        const todo = todos.find((t) => t.id === error.args[0]);
        if (todo) todo.error = error;
        break;
      }
    }
  }
}
function createTodos() {
  const Errors = {};
  const [todos, setTodos] = createOptimisticStore2(async () => {
    const todos2 = await api.getTodos();
    applyErrors(todos2, Errors);
    return todos2;
  }, []);
  const actions = {
    addTodo: action(function* (todo) {
      setTodos((t) => {
        const old = t.find((x) => x.id === todo.id);
        if (old) old.pending = true;
        else t.push({ ...todo, pending: true });
      });
      try {
        yield api.addTodo(todo);
        delete Errors[todo.id];
      } catch {
        Errors[todo.id] ||= { type: "addTodo", args: [todo] };
      }
      refresh(todos);
    }),
    removeTodo: action(function* (id) {
      setTodos((t) => t.filter((todo) => todo.id !== id));
      try {
        yield api.removeTodo(id);
        delete Errors[id];
      } catch {
        Errors[id] ||= { type: "removeTodo", args: [id] };
      }
      refresh(todos);
    }),
    toggleTodo: action(function* (id, completed) {
      setTodos((t) => {
        const todo = t.find((x) => x.id === id);
        if (todo) {
          todo.completed = completed;
          todo.pending = true;
        }
      });
      try {
        yield api.toggleTodo(id, completed);
        delete Errors[id];
      } catch {
        Errors[id] ||= { type: "toggleTodo", args: [id, completed] };
      }
      refresh(todos);
    }),
    toggleAll: action(function* (completed) {
      const ids = todos.filter((t) => t.completed !== completed).map((t) => t.id);
      const set = new Set(ids);
      setTodos((t) => {
        t.forEach((todo) => {
          if (set.has(todo.id)) {
            todo.completed = completed;
            todo.pending = true;
          }
        });
      });
      try {
        yield api.toggleAll(ids, completed);
        ids.forEach((id) => delete Errors[id]);
      } catch {
        ids.forEach((id) => {
          Errors[id] ||= { type: "toggleTodo", args: [id, completed] };
        });
      }
      refresh(todos);
    }),
    clearCompleted: action(function* () {
      const ids = todos.filter((t) => t.completed).map((t) => t.id);
      setTodos((t) => t.filter((todo) => !todo.completed));
      try {
        yield api.clearCompleted(ids);
        ids.forEach((id) => delete Errors[id]);
      } catch {
        ids.forEach((id) => {
          Errors[id] ||= { type: "removeTodo", args: [id] };
        });
      }
      refresh(todos);
    }),
    retryTodo(todo) {
      if (!todo.error) return Promise.resolve();
      return actions[todo.error.type](...todo.error.args);
    }
  };
  return [todos, actions];
}

// src/filter.ts
function parseHash(hash) {
  if (hash === "#/active") return "active";
  if (hash === "#/completed") return "completed";
  return "all";
}
function createHashFilter() {
  const [filter, setFilter] = createSignal2(parseHash(location.hash));
  onSettled(() => {
    const onChange = () => setFilter(parseHash(location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  });
  return filter;
}

// src/app.tsx
var _tmpl$ = /* @__PURE__ */ template(`<header class=header><h1>todos</h1><input class=new-todo placeholder="What needs to be done?"autofocus>`);
var _tmpl$2 = /* @__PURE__ */ template(`<li class=todo><div class=view><input class=toggle type=checkbox><label></label><button class=destroy>`);
var _tmpl$3 = /* @__PURE__ */ template(`<button class=retry>`);
var _tmpl$4 = /* @__PURE__ */ template(`<section class=main><input id=toggle-all class=toggle-all type=checkbox><label for=toggle-all>Mark all as complete</label><ul class=todo-list>`);
var _tmpl$5 = /* @__PURE__ */ template(`<button class=clear-completed>Clear completed`);
var _tmpl$6 = /* @__PURE__ */ template(`<footer class=footer><span class=todo-count><strong></strong> <!> left</span><ul class=filters><li><a href=#/>All</a></li><li><a href=#/active>Active</a></li><li><a href=#/completed>Completed`);
var _tmpl$7 = /* @__PURE__ */ template(`<section class=todoapp><!><!>`);
var _tmpl$8 = /* @__PURE__ */ template(`<div class=app-error><p>Something went wrong: </p><button>Reset`);
var _tmpl$9 = /* @__PURE__ */ template(`<p class=loading>Loading\u2026`);
var TodosContext = createContext2();
function Header() {
  const [, {
    addTodo
  }] = useContext(TodosContext);
  var _el$ = _tmpl$(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
  _el$3._$$keydown = (e) => {
    if (e.key !== "Enter") return;
    const title = e.currentTarget.value.trim();
    if (!title) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    addTodo({
      id,
      title,
      completed: false
    });
    e.currentTarget.value = "";
  };
  return _el$;
}
function TodoItem(props) {
  const [, {
    toggleTodo,
    removeTodo,
    retryTodo
  }] = useContext(TodosContext);
  var _el$4 = _tmpl$2(), _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling, _el$8 = _el$7.nextSibling;
  _el$6.addEventListener("change", (e) => toggleTodo(props.todo.id, e.currentTarget.checked));
  insert(_el$7, () => props.todo.title);
  insert(_el$5, createComponent(Show, {
    get when() {
      return props.todo.error;
    },
    children: (error) => (() => {
      var _el$9 = _tmpl$3();
      _el$9._$$click = () => retryTodo(props.todo);
      effect2(() => `Retry ${error().type}`, (_v$) => {
        setAttribute(_el$9, "title", _v$);
      });
      return _el$9;
    })()
  }), _el$8);
  _el$8._$$click = () => removeTodo(props.todo.id);
  effect2(() => ({
    e: !!props.todo.completed,
    t: !!props.todo.pending,
    a: !!props.todo.error,
    o: props.todo.completed
  }), ({
    e,
    t,
    a,
    o
  }, _p$) => {
    e !== _p$?.e && _el$4.classList.toggle("completed", e);
    t !== _p$?.t && _el$4.classList.toggle("pending", t);
    a !== _p$?.a && _el$4.classList.toggle("errored", a);
    _el$6.checked = o;
  });
  return _el$4;
}
function MainSection(props) {
  const [todos, {
    toggleAll
  }] = useContext(TodosContext);
  const filtered = () => {
    const f = props.filter;
    if (f === "active") return todos.filter((x) => !x.completed);
    if (f === "completed") return todos.filter((x) => x.completed);
    return todos;
  };
  const allCompleted = () => todos.length > 0 && todos.every((x) => x.completed);
  return createComponent(Show, {
    get when() {
      return todos.length > 0;
    },
    get children() {
      var _el$0 = _tmpl$4(), _el$1 = _el$0.firstChild, _el$10 = _el$1.nextSibling, _el$11 = _el$10.nextSibling;
      _el$1.addEventListener("change", () => toggleAll(!allCompleted()));
      insert(_el$11, createComponent(For, {
        get each() {
          return filtered();
        },
        children: (todo) => createComponent(TodoItem, {
          todo
        })
      }));
      effect2(() => allCompleted(), (_v$) => {
        _el$1.checked = _v$;
      });
      return _el$0;
    }
  });
}
function Footer(props) {
  const [todos, {
    clearCompleted
  }] = useContext(TodosContext);
  const remaining = () => todos.filter((x) => !x.completed).length;
  const completed = () => todos.length - remaining();
  return createComponent(Show, {
    get when() {
      return todos.length > 0;
    },
    get children() {
      var _el$12 = _tmpl$6(), _el$13 = _el$12.firstChild, _el$14 = _el$13.firstChild, _el$15 = _el$14.nextSibling, _el$17 = _el$15.nextSibling, _el$16 = _el$17.nextSibling, _el$18 = _el$13.nextSibling, _el$19 = _el$18.firstChild, _el$20 = _el$19.firstChild, _el$21 = _el$19.nextSibling, _el$22 = _el$21.firstChild, _el$23 = _el$21.nextSibling, _el$24 = _el$23.firstChild;
      insert(_el$14, remaining);
      insert(_el$13, () => remaining() === 1 ? "item" : "items", _el$17);
      claimElement(_el$20);
      claimElement(_el$22);
      claimElement(_el$24);
      insert(_el$12, createComponent(Show, {
        get when() {
          return completed() > 0;
        },
        get children() {
          var _el$25 = _tmpl$5();
          addEvent(_el$25, "click", clearCompleted, true);
          return _el$25;
        }
      }), null);
      effect2(() => ({
        e: !!(props.filter === "all"),
        t: !!(props.filter === "active"),
        a: !!(props.filter === "completed")
      }), ({
        e,
        t,
        a
      }, _p$) => {
        e !== _p$?.e && _el$20.classList.toggle("selected", e);
        t !== _p$?.t && _el$22.classList.toggle("selected", t);
        a !== _p$?.a && _el$24.classList.toggle("selected", a);
      });
      return _el$12;
    }
  });
}
function App() {
  const filter = createHashFilter();
  return createComponent(Errored, {
    fallback: (err, reset2) => (() => {
      var _el$29 = _tmpl$8(), _el$30 = _el$29.firstChild, _el$31 = _el$30.firstChild, _el$32 = _el$30.nextSibling;
      insert(_el$30, () => String(err()), null);
      addEvent(_el$32, "click", reset2, true);
      return _el$29;
    })(),
    get children() {
      return createComponent(TodosContext, {
        get value() {
          return createTodos();
        },
        get children() {
          var _el$26 = _tmpl$7(), _el$27 = _el$26.firstChild, _el$28 = _el$27.nextSibling;
          insert(_el$26, createComponent(Header, {}), _el$27);
          insert(_el$26, createComponent(Loading, {
            get fallback() {
              return _tmpl$9();
            },
            get children() {
              return [createComponent(MainSection, {
                get filter() {
                  return filter();
                }
              }), createComponent(Footer, {
                get filter() {
                  return filter();
                }
              })];
            }
          }), _el$28);
          return _el$26;
        }
      });
    }
  });
}
delegateEvents(["keydown", "click"]);

// src/main.tsx
render(() => createComponent(App, {}), document.getElementById("root"));
