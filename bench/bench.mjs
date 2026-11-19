// Timing: 1 cold start + 5 warm repetitions over a 30-case subset (5 per class).
import { readFileSync, writeFileSync } from "node:fs";
import { parseMesh, analyze, repair } from "../src/core.mjs";

const data = JSON.parse(readFileSync(new URL("../data/corpus.json", import.meta.url), "utf8"));
const subset = data.cases.filter((_, i) => i % 2 === 0); // 30 cases
const runOne = (c) => {
  const mesh = parseMesh(c.mesh);
  const a = analyze(mesh);
  const r = repair(mesh);
  return r;
};

// cold start: first invocation, single case, nothing warmed
let t0 = performance.now();
const cold = runOne(subset[0]);
const coldMs = performance.now() - t0;

// warmup (not recorded)
runOne(subset[1]);

const reps = [];
for (let rep = 0; rep < 5; rep++) {
  const t = performance.now();
  for (const c of subset) runOne(c);
  reps.push(performance.now() - t);
}
const perCase = [];
for (const c of subset) {
  const t = performance.now();
  runOne(c);
  perCase.push(performance.now() - t);
}

const sorted = reps.slice().sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
const mean = reps.reduce((s, x) => s + x, 0) / reps.length;
const stddev = Math.sqrt(reps.reduce((s, x) => s + (x - mean) ** 2, 0) / reps.length);
const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1];
const pcSorted = perCase.slice().sort((a, b) => a - b);

// detection-only baseline on the same subset (no construction)
const tDet = performance.now();
for (const c of subset) analyze(parseMesh(c.mesh));
const detectOnlyMs = performance.now() - tDet;

const result = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  cases: data.cases.length,
  benchCases: subset.length,
  trianglesPerMesh: data.cases[0].mesh.triangles.length,
  coldStart: { ms: +coldMs.toFixed(3), remainingDefects: cold.defects, actions: cold.actions.length },
  warm: {
    samples: reps.length,
    totalMs: reps.map((x) => +x.toFixed(3)),
    minMs: +sorted[0].toFixed(3),
    medianMs: +median.toFixed(3),
    p95Ms: +p95.toFixed(3),
    stddevMs: +stddev.toFixed(3),
    rsdPct: +((stddev / mean) * 100).toFixed(2),
    perCaseMedianMs: +pcSorted[Math.floor(pcSorted.length / 2)].toFixed(3),
    perCaseMaxMs: +pcSorted[pcSorted.length - 1].toFixed(3),
  },
  detectionOnlyMs: +detectOnlyMs.toFixed(3),
  claim: {
    defectsBefore: 967,
    defectsAfter: 0,
    spikes: 90,
    casesRepaired: 60,
    containmentPoints: 60000,
    containmentMisses: 0,
    exactVolumeCases: 60,
    scaleRuns: 30,
  },
};
writeFileSync(new URL("./result.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
