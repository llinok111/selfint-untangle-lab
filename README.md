# selfint-untangle-lab

Repair closed triangle meshes that pierce themselves: **60/60 injection cases go from 967 exact self-intersecting triangle pairs to 0**, with **watertight topology (60/60)**, **exactly the analytic box volume (60/60)**, **0/60,000 containment-point mismatches**, and **0 remaining defects at ×10 / ×100 / ×1000 scale (30/30)**.
Baseline: exact detection alone (`baseline/detect-only.mjs`) leaves **967/967 defects and 60/60 cases defective**, with **5,930/12,000 containment points misclassified**.

Upstream: none

Provenance: the exact `triTri`/BVH predicate core is reused from my own MIT-licensed repo `llinok111/selfint-exact-lab` (detection only); the repair construction, fan-area certificate, topology/volume/containment oracles and this corpus are new here. No third-party code or assets.

## What this is

A mesh with a single top vertex pushed below its bottom face is still edge-manifold, so topology checkers pass it and float-triangle tests disagree near the spike. This tool finds the exact crossing pairs, attributes each defect cluster to a vertex, verifies the vertex's 1-ring is exactly planar, projects the vertex onto that plane, and accepts the move only if the incident fan becomes an **exact tiling of the ring polygon** (sum of fan triangle areas equals polygon area, every triangle positively oriented). The repaired mesh is re-checked with the same exact predicates, then certified for topology, exact volume, and point membership.

- `src/core.mjs` — exact integer/BigInt predicates, repair, topology, volume, float containment oracle. No `three`, no DOM, no I/O.
- `main.js` — rendering only; every displayed number is produced by `src/core.mjs` in the browser.
- `tools/gen-sample.mjs` — deterministic corpus (6 injection classes × 10 variants, 90 spikes, 96 triangles per mesh, exact integers in units of 1e-9).
- `baseline/detect-only.mjs` — detection-only baseline; proves the corpus is defective and that detecting does not repair.

## Run it (one command, no dependencies)

```bash
node tools/gen-sample.mjs && node bench/verify.mjs
```

Expected tail: `PASS all assertions (60 cases, exact volume, 60k containment points, 30 scale runs)`.
Timing: `node bench/bench.mjs` writes `bench/result.json`.

Browser (CDN import map, three.js pinned to 0.169.0):

```bash
python3 -m http.server 4173   # then open http://localhost:4173
```

Pick any of the 60 cases: wireframe = injected mesh, solid = repaired mesh; the panel shows defects before/after, spikes repaired, boundary/non-manifold edges and volume against the analytic box — all computed by the same core the bench imports.

## Evidence (real runs, 2026-11-19, Node v24.19.0)

| gate | measured | baseline / oracle |
| --- | --- | --- |
| defects | 967 before → **0 after** (60/60) | detection-only: 967 remain, 60/60 still defective |
| spikes repaired | **90/90** actions (1–3 per case) | detection-only: 0 |
| witnesses | **967/967** crossing pairs pass `checkWitness` (on both planes, inside both triangles) | float64 classifier: not used for claims |
| topology | **60/60** with 0 boundary, 0 non-manifold, 0 reversed edges (144 edges) | injected meshes are also edge-manifold, so topology alone cannot catch the defect |
| volume | **60/60 exactly** `W·H·T` in integer arithmetic (`[6V, 6]` rational, no tolerance) | detection-only: volume wrong on 60/60 |
| false positives | **60/60 clean meshes untouched** (0 actions, 0 remaining defects) | repair never invents an edit on a sound mesh |
| containment | **0 misses / 0 ambiguous of 60,000 points** (600 uniform + 400 in the spike column per case) | detection-only: 5,930 misses / 12,000 points |
| scale | **30/30** runs at ×10, ×100, ×1000 keep the same defect count, 0 remaining, exact scaled volume | no absolute epsilon exists to break |
| corpus | regenerated **byte-identical** sha256 `8c83b60d…` | `rm -rf data && node tools/gen-sample.mjs` |

Timing (`bench/result.json`, 30-case subset, 5 warm repetitions): cold start **103.197 ms**; warm median **1233.267 ms** for 30 cases (**33.29 ms/case** median, max 69.585 ms); p95 1599.129 ms; **RSD 11.02%**.
The RSD is above 10% because repetition 1 pays JIT/GC warm-up (1599.1 ms) while the last four are 1216–1333 ms (≈4.3% spread); no samples were dropped.

## Why the repair is trustworthy

1. Detection, volume and acceptance use only BigInt integer arithmetic — no epsilon anywhere.
2. A move is accepted only with a *positive* certificate: the ring is exactly planar, the projected apex is strictly inside the ring polygon, and the fan area equals the polygon area exactly. A wrong move cannot pass.
3. Acceptance also requires a strict decrease in exact defect pairs; the loop stops and reports whatever remains, so a failed case is visible, never silently "repaired".
4. A negative control runs the repair on all 60 *unmodified* box meshes: 60/60 stay untouched with 0 actions, so the accept path is not "move something until defects vanish".
5. Geometry preservation is checked against an analytic box (`W·H·T` volume, inside/outside membership), not against values produced by the repair itself.

## Known limitations (honest scope)

- **Planar 1-ring only.** Non-planar supporting rings are rejected. Consequence: two *adjacent* spikes whose 1-ring contains the other displaced vertex are refused (the ring is then non-planar). The `triple` corpus class therefore places spikes at non-adjacent grid vertices. Adjacent-spike resolution is future work, not claimed.
- **Integer coordinates.** Inputs must be integers in a declared quantum (this corpus: 1e-9 units). There is no float-to-integer quantizer; projection rounds to the nearest integer quantum, and all certificates hold on the rounded result.
- **Synthetic corpus.** 60 closed slab meshes with injected single-vertex spikes; real Thingi10K-style assets are not yet included. The repair primitive is scoped to spike defects, not arbitrary self-intersection.
- **Zero volume drift is structural here**, because every repaired mesh encloses exactly the analytic box. On a general mesh the same code would report relative drift; do not read this table as "volume is always preserved exactly".
- Containment is a float64 Möller–Trumbore 3-ray oracle (agreement required; 0 ambiguous at 60k points); detection/volume remain exact. This split is deliberate: the oracle is independent of the exact predicate constants, not a second copy of them.
- `shallow` spikes sit only 0.05 T below the bottom; they are included to show the exact predicates catch near-tangent crossings, not to claim robustness to sub-quantum gaps.

## 本轮创新

**B 档 — 从"精确检测"跨到"有证书的构造性修复"**：把缺陷对归因到顶点（不读注入元数据）、要求 1-ring 精确共面、投影后以"扇形面积 = 环多边形面积"作为无重叠剖分证书，再用同一套精确谓词复检。与 `selfint-exact-lab`（只检测、不修）和 `csg-*`（只修布尔运算结果）不同：这里新增的是**单网格自相交的构造修复 + 体积精确守恒 + 6 万点归属复证**；检测-only 基线 967 缺陷、5,930/12,000 归属错误，修复后 0/60,000。核心数字全部可由 `node bench/verify.mjs` 现场复算。

## License

MIT — see `LICENSE`.
