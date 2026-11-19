// Deterministic corpus: 6 injection classes x 10 variants of a closed box slab.
// All coordinates are exact integers in units of 1e-9 (1.0 == 1e9 quanta).
// A spike is one top-surface vertex pushed below the bottom face, so the closed
// mesh stays edge-manifold but its surface now pierces the bottom: a real,
// exactly detectable self-intersection. The analytic oracle is the box itself.
import { writeFileSync, mkdirSync } from "node:fs";

const Q = 10n ** 9n;
const W = 4n * Q, H = 4n * Q, T = 1n * Q;
const N = 4; // grid cells per side
const cell = W / BigInt(N);

function slab() {
  const verts = [], tris = [];
  const top = (i, j) => i * (N + 1) + j;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = BigInt(i) * cell, y = BigInt(j) * cell;
    verts.push([x, y, T]); // top: +z
  }
  const base = verts.length;
  const bot = (i, j) => base + i * (N + 1) + j;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    verts.push([BigInt(i) * cell, BigInt(j) * cell, 0n]); // bottom: -z
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const a = top(i, j), b = top(i + 1, j), c = top(i + 1, j + 1), d = top(i, j + 1);
    tris.push([a, b, c], [a, c, d]);
    const p = bot(i, j), q = bot(i + 1, j), r = bot(i + 1, j + 1), s = bot(i, j + 1);
    tris.push([p, r, q], [p, s, r]); // downward-facing
  }
  // four side walls, outward normals
  for (let i = 0; i < N; i++) {
    const t0 = top(i, 0), t1 = top(i + 1, 0), b0 = bot(i, 0), b1 = bot(i + 1, 0);
    tris.push([t0, b0, b1], [t0, b1, t1]); // y = 0, -y
    const u0 = top(i + 1, N), u1 = top(i, N), v0 = bot(i + 1, N), v1 = bot(i, N);
    tris.push([u0, v0, v1], [u0, v1, u1]); // y = H, +y
    const p0 = top(0, i), p1 = top(0, i + 1), q0 = bot(0, i), q1 = bot(0, i + 1);
    tris.push([p0, p1, q1], [p0, q1, q0]); // x = 0, -x
    const r0 = top(N, i), r1 = top(N, i + 1), s0 = bot(N, i), s1 = bot(N, i + 1);
    tris.push([r0, s0, s1], [r0, s1, r1]); // x = W, +x
  }
  return { vertices: verts, triangles: tris };
}

const TAU = [
  { id: "center", spikes: [[2, 2, 0n, 0n, T + T / 2n]] },
  { id: "offset", spikes: [[2, 2, cell / 4n, -cell / 4n, T + T / 2n]] },
  { id: "deep", spikes: [[2, 2, cell / 5n, cell / 5n, 3n * T]] },
  { id: "shallow", spikes: [[2, 2, cell / 6n, 0n, T + T / 20n]] },
  { id: "pair", spikes: [[1, 1, cell / 4n, cell / 4n, T + T / 2n], [3, 3, -cell / 4n, -cell / 4n, 2n * T]] },
  { id: "triple", spikes: [[1, 1, 0n, cell / 4n, T + T / 2n], [3, 3, -cell / 4n, 0n, T + T / 3n], [1, 3, cell / 5n, -cell / 5n, 2n * T]] },
];

const cases = [];
for (const cls of TAU) {
  for (let j = 0; j < 10; j++) {
    const m = slab();
    const meta = [];
    for (const [i, k, dx, dy, dz] of cls.spikes) {
      // jitter in y by -j..+j quanta keeps variants distinct without moving off-grid logic
      const vi = i * (N + 1) + k;
      const v = m.vertices[vi];
      const nv = [v[0] + dx, v[1] + dy + BigInt(j % 5), v[2] - dz - BigInt(j)];
      m.vertices[vi] = nv;
      meta.push({ vertex: vi, original: v.map(String), injected: nv.map(String) });
    }
    const up = (mesh) => ({ vertices: mesh.vertices.map((p) => p.map(String)), triangles: mesh.triangles });
    cases.push({ id: `${cls.id}-${String(j).padStart(2, "0")}`, class: cls.id, spikes: meta, mesh: up(m), original: up(slab()) });
  }
}

mkdirSync("data", { recursive: true });
const payload = {
  unit: "1e-9", grid: N, box: { W: W.toString(), H: H.toString(), T: T.toString() },
  classes: TAU.map((c) => c.id), cases,
};
const text = JSON.stringify(payload);
writeFileSync("data/corpus.json", text);
console.log(JSON.stringify({
  cases: cases.length, classes: TAU.length,
  trisPerMesh: cases[0].mesh.triangles.length,
  spikes: cases.reduce((s, c) => s + c.spikes.length, 0),
  bytes: text.length,
  boxVolumeQuantaCube: (W * H * T).toString(),
}));
