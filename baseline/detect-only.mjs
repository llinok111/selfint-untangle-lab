// Baseline: exact detection without construction. Proves the corpus is really
// defective, that detection alone changes nothing, and how far the injected
// solid is from the analytic box (containment sample).
import { readFileSync } from "node:fs";
import { parseMesh, analyze, containsPoint } from "../src/core.mjs";

const data = JSON.parse(readFileSync(new URL("../data/corpus.json", import.meta.url), "utf8"));
const W = Number(data.box.W), H = Number(data.box.H), T = Number(data.box.T);
const cell = W / data.grid;
let defectiveCases = 0, remainingDefects = 0, ms = 0, points = 0, misses = 0;
for (const c of data.cases) {
  const mesh = parseMesh(c.mesh);
  const t0 = performance.now();
  const a = analyze(mesh);
  ms += performance.now() - t0;
  if (a.stats.defects > 0) defectiveCases++;
  remainingDefects += a.stats.defects;
  let seed = 7 + c.id.length;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const sx = Number(c.spikes[0].injected[0]), sy = Number(c.spikes[0].injected[1]);
  for (let i = 0; i < 200; i++) {
    const inColumn = i % 2 === 1;
    const x = inColumn ? sx + (rnd() - 0.5) * 0.9 * cell : W * (0.02 + 0.96 * rnd());
    const y = inColumn ? sy + (rnd() - 0.5) * 0.9 * cell : H * (0.02 + 0.96 * rnd());
    const z = T * (0.02 + 0.96 * rnd());
    points++;
    if (!containsPoint(mesh, [BigInt(Math.floor(x)), BigInt(Math.floor(y)), BigInt(Math.floor(z))]).inside) misses++;
  }
}
console.log(JSON.stringify({ defectiveCases, remainingDefects, points, containmentMisses: misses, ms: Math.round(ms * 10) / 10 }));
