// exact self-intersection witnesses for triangle soups.
// Pure ES module: no three.js, no DOM, no I/O, no environment reads.
// All vertex coordinates are exact integers ("quanta"). Predicates use BigInt only.

const ZERO = 0n;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// ---------- exact rationals ----------
export function rat(n, d = 1n) {
  if (d < ZERO) { n = -n; d = -d; }
  return [n, d];
}
const radd = (a, b) => rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const rsub = (a, b) => rat(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const rmul = (a, b) => rat(a[0] * b[0], a[1] * b[1]);
const rcmp = (a, b) => {
  const l = a[0] * b[1], r = b[0] * a[1];
  return l < r ? -1 : l > r ? 1 : 0;
};
const rsign = (a) => (a[0] < ZERO ? -1 : a[0] > ZERO ? 1 : 0);
export function rstr(a) {
  let n = a[0], d = a[1];
  const g = (x, y) => { x = x < ZERO ? -x : x; y = y < ZERO ? -y : y; while (y) { const t = x % y; x = y; y = t; } return x; };
  const q = g(n, d) || 1n;
  n /= q; d /= q;
  return d === 1n ? `${n}` : `${n}/${d}`;
}

function triangleVecs(mesh, t) {
  const ids = mesh.triangles[t];
  const vs = mesh.vertices;
  return [ids.map((i) => vs[i][0]), ids.map((i) => vs[i][1]), ids.map((i) => vs[i][2])];
}
function vertexVecs(mesh, i) {
  const v = mesh.vertices[i];
  return [v[0], v[1], v[2]];
}
function planeOf(a, b, c) {
  const n = cross(sub(b, a), sub(c, a));
  return { n, d: -dot(n, a) };
}
const sideOf = (p, pl) => dot(pl.n, p) + pl.d;
const boxOf = (mesh, t) => {
  const ids = mesh.triangles[t], vs = mesh.vertices;
  const lo = [vs[ids[0]][0], vs[ids[0]][1], vs[ids[0]][2]];
  const hi = [lo[0], lo[1], lo[2]];
  for (let k = 1; k < 3; k++) {
    for (let q = 0; q < 3; q++) {
      const v = vs[ids[k]][q];
      if (v < lo[q]) lo[q] = v;
      if (v > hi[q]) hi[q] = v;
    }
  }
  return { lo, hi };
};
const boxHit = (a, b) => a.lo[0] <= b.hi[0] && b.lo[0] <= a.hi[0] &&
  a.lo[1] <= b.hi[1] && b.lo[1] <= a.hi[1] && a.lo[2] <= b.hi[2] && b.lo[2] <= a.hi[2];

// points where triangle `t` meets `pl`, from exact side values.
function planePoints(mesh, t, pl, sides) {
  const ids = mesh.triangles[t], vs = mesh.vertices;
  const out = [];
  const seen = new Set();
  const push = (i, j, tt) => {
    const key = `${i}:${tt[0]}/${tt[1]}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ i, j, t: tt });
  };
  for (let e = 0; e < 3; e++) {
    const i = ids[e], j = ids[(e + 1) % 3];
    const si = sides[e], sj = sides[(e + 1) % 3];
    if (si === ZERO && sj === ZERO) { push(i, j, rat(ZERO)); push(i, j, rat(1n)); }
    else if (si === ZERO) push(i, j, rat(ZERO));
    else if (sj === ZERO) push(i, j, rat(1n));
    else if (si > ZERO !== sj > ZERO) push(i, j, rat(si, si - sj));
  }
  return out;
}

function pointOnEdge(mesh, pt) {
  const a = vertexVecs(mesh, pt.i), b = vertexVecs(mesh, pt.j);
  const t = pt.t;
  return [0, 1, 2].map((q) => radd(rat(a[q]), rmul(t, rat(b[q] - a[q]))));
}
function paramOnLine(mesh, pt, L) {
  const a = vertexVecs(mesh, pt.i), b = vertexVecs(mesh, pt.j);
  const da = dot(a, L), db = dot(b, L);
  return radd(rat(da), rmul(pt.t, rat(db - da)));
}
function minMax(pts, mesh, L) {
  let lo = paramOnLine(mesh, pts[0], L), hi = lo;
  for (const p of pts) {
    const q = paramOnLine(mesh, p, L);
    if (rcmp(q, lo) < 0) lo = q;
    if (rcmp(q, hi) > 0) hi = q;
  }
  return [lo, hi];
}

// ---------- coplanar 2D fallback ----------
function proj(v, axis) {
  return axis === 0 ? [v[1], v[2]] : axis === 1 ? [v[0], v[2]] : [v[0], v[1]];
}
const cross2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const onSeg2 = (a, b, p) => {
  const c = cross2(a, b, p);
  if (c !== ZERO) return false;
  return p[0] >= (a[0] < b[0] ? a[0] : b[0]) && p[0] <= (a[0] > b[0] ? a[0] : b[0]) &&
    p[1] >= (a[1] < b[1] ? a[1] : b[1]) && p[1] <= (a[1] > b[1] ? a[1] : b[1]);
};
function inTri2(a, b, c, p, strict) {
  const s1 = cross2(a, b, p), s2 = cross2(b, c, p), s3 = cross2(c, a, p);
  if (strict) return (s1 > ZERO && s2 > ZERO && s3 > ZERO) || (s1 < ZERO && s2 < ZERO && s3 < ZERO);
  return (s1 >= ZERO && s2 >= ZERO && s3 >= ZERO) || (s1 <= ZERO && s2 <= ZERO && s3 <= ZERO);
}
function coplanar(mesh, ta, tb, n) {
  const ax = n[0] < ZERO ? -n[0] : n[0], ay = n[1] < ZERO ? -n[1] : n[1], az = n[2] < ZERO ? -n[2] : n[2];
  const axis = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
  const A = [0, 1, 2].map((i) => proj(vertexVecs(mesh, mesh.triangles[ta][i]), axis));
  const B = [0, 1, 2].map((i) => proj(vertexVecs(mesh, mesh.triangles[tb][i]), axis));
  let area = false, contact = false, witness = null;
  for (let i = 0; i < 3 && !area; i++) {
    for (let j = 0; j < 3 && !area; j++) {
      const a1 = A[i], a2 = A[(i + 1) % 3], b1 = B[j], b2 = B[(j + 1) % 3];
      const o1 = cross2(b1, b2, a1), o2 = cross2(b1, b2, a2), o3 = cross2(a1, a2, b1), o4 = cross2(a1, a2, b2);
      if ((o1 > ZERO && o2 < ZERO || o1 < ZERO && o2 > ZERO) && (o3 > ZERO && o4 < ZERO || o3 < ZERO && o4 > ZERO)) {
        area = true;
        const tt = rat(o1, o1 - o2);
        const j1 = mesh.triangles[ta][i], j2 = mesh.triangles[ta][(i + 1) % 3];
        witness = [0, 1, 2].map((q) => radd(rat(mesh.vertices[j1][q]), rmul(tt, rat(mesh.vertices[j2][q] - mesh.vertices[j1][q]))));
        break;
      }
      if (onSeg2(a1, a2, b1)) { contact = true; if (!witness) witness = vertexVecs(mesh, mesh.triangles[tb][j]).map((x) => rat(x)); }
    }
  }
  if (!area) {
    for (let i = 0; i < 3; i++) {
      if (inTri2(A[0], A[1], A[2], B[i], true)) { area = true; witness = vertexVecs(mesh, mesh.triangles[tb][i]).map((x) => rat(x)); break; }
      if (onSeg2(A[0], A[1], B[i]) || onSeg2(A[1], A[2], B[i]) || onSeg2(A[2], A[0], B[i])) {
        contact = true; if (!witness) witness = vertexVecs(mesh, mesh.triangles[tb][i]).map((x) => rat(x));
      }
      if (inTri2(B[0], B[1], B[2], A[i], true)) { area = true; witness = vertexVecs(mesh, mesh.triangles[ta][i]).map((x) => rat(x)); break; }
      if (onSeg2(B[0], B[1], A[i]) || onSeg2(B[1], B[2], A[i]) || onSeg2(B[2], B[0], A[i])) {
        contact = true; if (!witness) witness = vertexVecs(mesh, mesh.triangles[ta][i]).map((x) => rat(x));
      }
    }
  }
  if (area) return { kind: "coplanar-area", witness: witness ? [witness] : [] };
  if (contact) {
    if (!witness) witness = vertexVecs(mesh, mesh.triangles[ta][0]).map((x) => rat(x));
    return { kind: "coplanar-contact", witness: [witness] };
  }
  return null;
}

// ---------- exact triangle-triangle ----------
export function triTri(mesh, ta, tb) {
  const A = [0, 1, 2].map((i) => vertexVecs(mesh, mesh.triangles[ta][i]));
  const B = [0, 1, 2].map((i) => vertexVecs(mesh, mesh.triangles[tb][i]));
  const p1 = planeOf(A[0], A[1], A[2]);
  if (p1.n[0] === ZERO && p1.n[1] === ZERO && p1.n[2] === ZERO) return null;
  const s = B.map((p) => sideOf(p, p1));
  if (s.every((x) => x > ZERO) || s.every((x) => x < ZERO)) return null;
  const p2 = planeOf(B[0], B[1], B[2]);
  if (p2.n[0] === ZERO && p2.n[1] === ZERO && p2.n[2] === ZERO) return null;
  const t = A.map((p) => sideOf(p, p2));
  if (t.every((x) => x > ZERO) || t.every((x) => x < ZERO)) return null;
  if (s.every((x) => x === ZERO) && t.every((x) => x === ZERO)) return coplanar(mesh, ta, tb, p1.n);
  const L = cross(p1.n, p2.n);
  if (L[0] === ZERO && L[1] === ZERO && L[2] === ZERO) return null;
  // A against plane of B uses sides t; B against plane of A uses sides s.
  const pa = planePoints(mesh, ta, p2, t);
  const pb = planePoints(mesh, tb, p1, s);
  if (!pa.length || !pb.length) return null;
  const [alo, ahi] = minMax(pa, mesh, L);
  const [blo, bhi] = minMax(pb, mesh, L);
  if (rcmp(alo, bhi) > 0 || rcmp(blo, ahi) > 0) return null;
  const lo = rcmp(alo, blo) >= 0 ? alo : blo;
  const hi = rcmp(ahi, bhi) <= 0 ? ahi : bhi;
  if (rcmp(lo, hi) > 0) return null;
  const all = [...pa.map((p) => ({ p, side: "a" })), ...pb.map((p) => ({ p, side: "b" }))];
  const at = (target) => {
    for (const e of all) if (rcmp(paramOnLine(mesh, e.p, L), target) === 0) return pointOnEdge(mesh, e.p);
    return null;
  };
  const w1 = at(lo);
  if (!w1) return null;
  if (rcmp(lo, hi) === 0) return { kind: "contact", witness: [w1] };
  const w2 = at(hi);
  if (!w2) return null;
  // A shared edge yields a positive-length overlap that is still only contact:
  // proper crossing requires the segment midpoint to be interior to both faces.
  const mid = w1.map((x, q) => rmul(radd(x, w2[q]), rat(1n, 2n)));
  const proper = inside3(mid, A, p1.n, true) && inside3(mid, B, p2.n, true);
  return { kind: proper ? "crossing" : "contact", witness: [w1, w2] };
}

// Independent witness check: every witness point must lie on both planes
// and inside both triangles (all three exact edge signs agree).
export function checkWitness(mesh, pair) {
  const ta = mesh.triangles[pair.a], tb = mesh.triangles[pair.b];
  const A = [0, 1, 2].map((i) => vertexVecs(mesh, ta[i]));
  const B = [0, 1, 2].map((i) => vertexVecs(mesh, tb[i]));
  const pa = planeOf(A[0], A[1], A[2]), pb = planeOf(B[0], B[1], B[2]);
  for (const w of pair.witness) {
    if (!sideZero(w, pa) || !sideZero(w, pb)) return false;
    if (!inside3(w, A, pa.n) || !inside3(w, B, pb.n)) return false;
  }
  return pair.witness.length > 0;
}
function sideZero(rp, pl) {
  const v = [rmul(rp[0], rat(pl.n[0])), rmul(rp[1], rat(pl.n[1])), rmul(rp[2], rat(pl.n[2]))];
  return rsign(radd(radd(v[0], v[1]), radd(v[2], rat(pl.d)))) === 0;
}
function inside3(rp, T, n, strict = false) {
  const signs = [];
  let zero = false;
  for (let i = 0; i < 3; i++) {
    const a = T[i], b = T[(i + 1) % 3];
    const e = sub(b, a);
    const p = [rsub(rp[0], rat(a[0])), rsub(rp[1], rat(a[1])), rsub(rp[2], rat(a[2]))];
    const c = [
      rsub(rmul(rat(e[1]), p[2]), rmul(rat(e[2]), p[1])),
      rsub(rmul(rat(e[2]), p[0]), rmul(rat(e[0]), p[2])),
      rsub(rmul(rat(e[0]), p[1]), rmul(rat(e[1]), p[0])),
    ];
    const s = rsign(radd(radd(rmul(c[0], rat(n[0])), rmul(c[1], rat(n[1]))), rmul(c[2], rat(n[2]))));
    if (s === 0) zero = true; else signs.push(s);
  }
  if (strict) return !zero && signs.length === 3 && !(signs.includes(1) && signs.includes(-1));
  return !(signs.includes(1) && signs.includes(-1));
}

// ---------- BVH ----------
function buildBVH(mesh) {
  const boxes = mesh.triangles.map((_, i) => boxOf(mesh, i));
  const idx = mesh.triangles.map((_, i) => i);
  const build = (list) => {
    let lo = [boxes[list[0]].lo[0], boxes[list[0]].lo[1], boxes[list[0]].lo[2]];
    let hi = [boxes[list[0]].hi[0], boxes[list[0]].hi[1], boxes[list[0]].hi[2]];
    for (const i of list) for (let q = 0; q < 3; q++) {
      if (boxes[i].lo[q] < lo[q]) lo[q] = boxes[i].lo[q];
      if (boxes[i].hi[q] > hi[q]) hi[q] = boxes[i].hi[q];
    }
    if (list.length <= 8) return { lo, hi, list };
    const ext = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    const axis = ext[0] >= ext[1] && ext[0] >= ext[2] ? 0 : ext[1] >= ext[2] ? 1 : 2;
    const c = (i) => boxes[i].lo[axis] + boxes[i].hi[axis];
    list.sort((x, y) => (c(x) < c(y) ? -1 : c(x) > c(y) ? 1 : 0));
    const mid = list.length >> 1;
    return { lo, hi, left: build(list.slice(0, mid)), right: build(list.slice(mid)) };
  };
  return build(idx);
}

export function analyze(mesh, { bvh = true, maxPairs = 100000 } = {}) {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const pairs = [];
  const test = (i, j) => {
    const a = boxOf(mesh, i), b = boxOf(mesh, j);
    if (!boxHit(a, b)) return;
    const r = triTri(mesh, i, j);
    const lo = i < j ? i : j, hi = i < j ? j : i;
    if (r) pairs.push({ a: lo, b: hi, ...r });
  };
  if (bvh) {
    const root = buildBVH(mesh);
    const crossNodes = (na, nb) => {
      if (pairs.length >= maxPairs) return;
      if (!boxHit(na, nb)) return;
      if (na.list && nb.list) { for (const i of na.list) for (const j of nb.list) test(i, j); return; }
      if (na.list) { crossNodes(na, nb.left); crossNodes(na, nb.right); return; }
      if (nb.list) { crossNodes(na.left, nb); crossNodes(na.right, nb); return; }
      const sa = na.hi[0] - na.lo[0] + na.hi[1] - na.lo[1] + na.hi[2] - na.lo[2];
      const sb = nb.hi[0] - nb.lo[0] + nb.hi[1] - nb.lo[1] + nb.hi[2] - nb.lo[2];
      if (sa >= sb) { crossNodes(na.left, nb); crossNodes(na.right, nb); }
      else { crossNodes(na, nb.left); crossNodes(na, nb.right); }
    };
    const self = (n) => {
      if (n.list) { for (let i = 0; i < n.list.length; i++) for (let j = i + 1; j < n.list.length; j++) test(n.list[i], n.list[j]); return; }
      self(n.left); self(n.right); crossNodes(n.left, n.right);
    };
    self(root);
  } else {
    for (let i = 0; i < mesh.triangles.length; i++) for (let j = i + 1; j < mesh.triangles.length; j++) test(i, j);
  }
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const counts = { crossing: 0, contact: 0, "coplanar-area": 0, "coplanar-contact": 0 };
  for (const p of pairs) counts[p.kind]++;
  return {
    pairs,
    stats: {
      triangles: mesh.triangles.length,
      vertices: mesh.vertices.length,
      pairs: pairs.length,
      defects: counts.crossing + counts["coplanar-area"],
      contacts: counts.contact + counts["coplanar-contact"],
      counts,
      ms: t1 - t0,
    },
    fingerprint: fingerprint(mesh, pairs),
  };
}

export function fingerprint(mesh, pairs) {
  const rows = pairs.slice().sort((x, y) => (x.a - y.a) || (x.b - y.b) || (x.kind < y.kind ? -1 : 1))
    .map((p) => `${p.a},${p.b},${p.kind}`);
  const s = `v${mesh.vertices.length};t${mesh.triangles.length};` + rows.join(";");
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i) & 0xff);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

export function scaleMesh(mesh, k) {
  const f = 10n ** BigInt(k);
  return {
    vertices: mesh.vertices.map((v) => v.map((x) => (x * f).toString())),
    triangles: mesh.triangles.map((t) => t.slice()),
  };
}

export function parseMesh(mesh) {
  return {
    vertices: mesh.vertices.map((v) => v.map((x) => BigInt(x.toString()))),
    triangles: mesh.triangles.map((t) => t.slice()),
  };
}

export function pairSignature(result) {
  return result.pairs.map((p) => `${p.a},${p.b},${p.kind}`).sort().join("|");
}
// ============================================================================
// Constructive repair added in selfint-untangle-lab.
// A defect cluster is attributed to the vertex that appears in the most
// defective triangles. Its 1-ring must be exactly planar; the vertex is then
// projected onto that plane and accepted only if the incident fan becomes an
// exact, non-overlapping triangulation of the ring polygon (fan area ==
// polygon area, every fan triangle positively oriented). Integer output, so
// every later predicate stays exact.
// ============================================================================

const absB = (x) => (x < ZERO ? -x : x);
function rdivRound(a, b) { // nearest integer to a/b, b > 0
  const neg = a < ZERO;
  const n = neg ? -a : a;
  const q = (n * 2n + b) / (2n * b);
  return neg ? -q : q;
}
function projRound(r) { return rdivRound(r[0], r[1]); }

export function vertexVolume(mesh) { // exact rational [num, 6]
  let s = 0n;
  const vs = mesh.vertices;
  for (const t of mesh.triangles) {
    const a = vs[t[0]], b = vs[t[1]], c = vs[t[2]];
    s += a[0] * (b[1] * c[2] - b[2] * c[1])
       - a[1] * (b[0] * c[2] - b[2] * c[0])
       + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return [s, 6n];
}
export const volumeSign = (v) => (v[0] < ZERO ? "-" : "");
export function volumeRatio(a, b) { // a / b as a double
  return Number(a[0]) / Number(b[0]) * Number(b[1]) / Number(a[1]);
}
export function volumeAbsDiffRel(a, b) {
  const d = [a[0] * b[1] - b[0] * a[1], a[1] * b[1]];
  return Number(absB(d[0])) / Number(absB(d[1])) / (Math.abs(Number(b[0])) / Number(b[1]));
}

export function topology(mesh) {
  const und = new Map(), dir = new Map();
  for (const t of mesh.triangles) for (let e = 0; e < 3; e++) {
    const i = t[e], j = t[(e + 1) % 3];
    const key = i < j ? `${i},${j}` : `${j},${i}`;
    und.set(key, (und.get(key) || 0) + 1);
    dir.set(`${i}>${j}`, (dir.get(`${i}>${j}`) || 0) + 1);
  }
  let boundary = 0, nonManifold = 0, reversed = 0;
  for (const [key, n] of und) {
    const [i, j] = key.split(",");
    const f = dir.get(`${i}>${j}`) || 0, r = dir.get(`${j}>${i}`) || 0;
    if (n !== 2 || f !== 1 || r !== 1) {
      if (n !== 2) boundary++;
      if (n > 2) nonManifold++;
      if (n === 2 && !(f === 1 && r === 1)) reversed++;
    }
  }
  return { boundary, nonManifold, reversed, edges: und.size };
}

function oneRing(mesh, v) {
  const fan = [];
  mesh.triangles.forEach((t, i) => { if (t.includes(v)) fan.push(i); });
  const adj = new Map();
  for (const fi of fan) {
    const others = mesh.triangles[fi].filter((x) => x !== v);
    if (others.length !== 2) return null;
    const [a, b] = others;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b); adj.get(b).add(a);
  }
  if (adj.size < 3) return null;
  const start = adj.keys().next().value;
  const order = [start];
  let prev = null, cur = start;
  for (;;) {
    const ns = [...adj.get(cur)].filter((x) => x !== prev);
    const nxt = ns.find((x) => x !== start);
    if (nxt === undefined) break;
    order.push(nxt); prev = cur; cur = nxt;
    if (order.length > adj.size) return null;
  }
  if (order.length !== adj.size) return null;
  return { fan, order };
}

function newellPlane(mesh, order) {
  const vs = mesh.vertices;
  let n = [ZERO, ZERO, ZERO];
  for (let i = 0; i < order.length; i++) {
    const a = vs[order[i]], b = vs[order[(i + 1) % order.length]];
    n = [
      n[0] + (a[1] * b[2] - a[2] * b[1]),
      n[1] + (a[2] * b[0] - a[0] * b[2]),
      n[2] + (a[0] * b[1] - a[1] * b[0]),
    ];
  }
  if (n[0] === ZERO && n[1] === ZERO && n[2] === ZERO) return null;
  const d = -(n[0] * vs[order[0]][0] + n[1] * vs[order[0]][1] + n[2] * vs[order[0]][2]);
  return { n, d };
}

function projectPoint(p, pl) {
  const num = pl.n[0] * p[0] + pl.n[1] * p[1] + pl.n[2] * p[2] + pl.d;
  const den = pl.n[0] * pl.n[0] + pl.n[1] * pl.n[1] + pl.n[2] * pl.n[2];
  return p.map((q, i) => projRound(rat(q * den - num * pl.n[i], den)));
}

function planeBasis2D(pl) {
  const ax = absB(pl.n[0]), ay = absB(pl.n[1]), az = absB(pl.n[2]);
  const drop = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
  return { drop, map: (p) => (drop === 0 ? [p[1], p[2]] : drop === 1 ? [p[0], p[2]] : [p[0], p[1]]) };
}

const cross22 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

export function fanCertificate(mesh, v, ring, pl, apex) {
  const ringPts = ring.order.map((i) => mesh.vertices[i]);
  // exact planarity of the supporting ring
  for (const p of ringPts) if (pl.n[0] * p[0] + pl.n[1] * p[1] + pl.n[2] * p[2] + pl.d !== ZERO) return { ok: false, why: "ring-not-planar" };
  const { map } = planeBasis2D(pl);
  const R = ringPts.map(map), A = map(apex);
  if (R.length < 3) return { ok: false, why: "short-ring" };
  const sArea = R.reduce((s, p, i) => s + (p[0] * R[(i + 1) % R.length][1] - R[(i + 1) % R.length][0] * p[1]), 0n);
  if (sArea === ZERO) return { ok: false, why: "zero-area-ring" };
  const sgn = sArea > ZERO ? 1n : -1n;
  // apex strictly inside the (convex) ring polygon
  for (let i = 0; i < R.length; i++) {
    const c = cross22(R[i], R[(i + 1) % R.length], A) * sgn;
    if (c <= ZERO) return { ok: false, why: "apex-outside-ring" };
  }
  // fan from apex tiles the ring polygon exactly: same signed area, positive parts
  let fanArea = 0n;
  for (let i = 0; i < R.length; i++) {
    const a = R[i], b = R[(i + 1) % R.length];
    const c = (a[0] * b[1] - a[1] * b[0]) - (A[0] * (b[1] - a[1]) - A[1] * (b[0] - a[0]));
    const part = cross22(A, a, b) * sgn;
    if (part <= ZERO) return { ok: false, why: "fan-degenerate" };
    fanArea += part;
  }
  if (fanArea !== sArea * sgn) return { ok: false, why: "fan-area-mismatch" };
  return { ok: true, ringArea2: sArea, fanArea2: fanArea * sgn };
}

// Repair only uses the mesh; it never sees injection metadata.
export function repair(mesh, { maxActions = 16, candidates = 4 } = {}) {
  let cur = mesh;
  const actions = [];
  for (let step = 0; step < maxActions; step++) {
    const res = analyze(cur);
    const defects = res.pairs.filter((p) => p.kind === "crossing" || p.kind === "coplanar-area");
    if (!defects.length) break;
    const score = new Map();
    for (const p of defects) for (const t of [p.a, p.b]) for (const v of cur.triangles[t]) score.set(v, (score.get(v) || 0) + 1);
    const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, candidates);
    let done = false;
    for (const [v] of ranked) {
      const ring = oneRing(cur, v);
      if (!ring) continue;
      const pl = newellPlane(cur, ring.order);
      if (!pl) continue;
      const apex = projectPoint(cur.vertices[v], pl);
      if (apex[0] === cur.vertices[v][0] && apex[1] === cur.vertices[v][1] && apex[2] === cur.vertices[v][2]) continue;
      if (!fanCertificate(cur, v, ring, pl, apex).ok) continue;
      const next = { vertices: cur.vertices.map((p, i) => (i === v ? apex : p)), triangles: cur.triangles };
      const chk = analyze(next);
      const left = chk.pairs.filter((p) => p.kind === "crossing" || p.kind === "coplanar-area").length;
      if (left >= defects.length) continue; // require measurable progress
      actions.push({ step, vertex: v, from: cur.vertices[v].map(String), to: apex.map(String), planeNormal: pl.n.map(String), defectsBefore: defects.length, defectsAfter: left });
      cur = next;
      done = true;
      break;
    }
    if (!done) break;
  }
  const res = analyze(cur);
  const defects = res.pairs.filter((p) => p.kind === "crossing" || p.kind === "coplanar-area").length;
  return { mesh: cur, actions, defects, topology: topology(cur), volume: vertexVolume(cur), pairs: res.pairs };
}

// ---------- float containment oracle (independent of the exact predicates) ----------
// Moller-Trumbore against three axis-aligned rays. A point counts as inside only
// if all three rays agree on odd parity; disagreements are reported, not hidden.
function rayHits(mesh, P, axis) {
  const vs = mesh.vertices;
  const dir = [0, 0, 0]; dir[axis] = 1;
  let hits = 0;
  for (const t of mesh.triangles) {
    const a = vs[t[0]].map(Number), b = vs[t[1]].map(Number), c = vs[t[2]].map(Number);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const pv = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]];
    const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2];
    if (det > -1e-12 && det < 1e-12) continue;
    const tv = [P[0] - a[0], P[1] - a[1], P[2] - a[2]];
    const u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) / det;
    if (u <= 1e-9 || u >= 1 - 1e-9) continue;
    const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
    const v = (dir[0] * qv[0] + dir[1] * qv[1] + dir[2] * qv[2]) / det;
    if (v <= 1e-9 || u + v >= 1 - 1e-9) continue;
    const tt = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
    if (tt > 0) hits++;
  }
  return hits;
}
export function containsPoint(mesh, p) {
  const P = p.map(Number);
  const a = rayHits(mesh, P, 0) & 1, b = rayHits(mesh, P, 1) & 1, c = rayHits(mesh, P, 2) & 1;
  return { inside: a === 1, agree: a === b && b === c };
}
