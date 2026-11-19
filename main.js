// Rendering only: every number shown comes from src/core.mjs, never recomputed here.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { parseMesh, analyze, repair, topology, vertexVolume } from "./src/core.mjs";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 400);
camera.position.set(9, 7, 11);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(2, 2, 0.5);

scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(6, 9, 12);
scene.add(sun);
const grid = new THREE.GridHelper(12, 12, 0x30363d, 0x21262d);
grid.position.set(2, 0, 2);
scene.add(grid);

let solid = null, wire = null;

function toGeometry(mesh) {
  const pos = new Float32Array(mesh.vertices.length * 3);
  mesh.vertices.forEach((v, i) => { pos[i * 3] = Number(v[0]); pos[i * 3 + 1] = Number(v[1]); pos[i * 3 + 2] = Number(v[2]); });
  const idx = mesh.triangles.flat();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const fmt = (x) => (Math.abs(x) >= 1e6 ? x.toExponential(4) : x.toFixed(6));

async function load() {
  const data = await (await fetch("./data/corpus.json")).json();
  const sel = document.getElementById("case");
  for (const c of data.cases) {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.id;
    sel.appendChild(o);
  }
  sel.onchange = () => show(data.cases.find((c) => c.id === sel.value), data);
  show(data.cases[0], data);
}

function show(c, data) {
  if (solid) { scene.remove(solid); solid.geometry.dispose(); }
  if (wire) { scene.remove(wire); wire.geometry.dispose(); }
  const injected = parseMesh(c.mesh);
  const before = analyze(injected).stats.defects;
  const r = repair(injected);

  solid = new THREE.Mesh(toGeometry(r.mesh), new THREE.MeshStandardMaterial({ color: 0x58a6ff, metalness: 0.15, roughness: 0.55, side: THREE.DoubleSide, flatShading: true }));
  scene.add(solid);
  wire = new THREE.LineSegments(new THREE.WireframeGeometry(toGeometry(injected)), new THREE.LineBasicMaterial({ color: 0xff7b72, transparent: true, opacity: 0.5 }));
  scene.add(wire);

  const boxV = Number(data.box.W) * Number(data.box.H) * Number(data.box.T);
  const vol = Number(r.volume[0]) / Number(r.volume[1]);
  document.getElementById("before").textContent = String(before);
  const after = document.getElementById("after");
  after.textContent = String(r.defects);
  after.className = r.defects === 0 ? "" : "bad";
  document.getElementById("actions").textContent = `${r.actions.length} / ${c.spikes.length}`;
  const b = document.getElementById("boundary");
  const topo = r.topology;
  b.textContent = `${topo.boundary} / ${topo.nonManifold}`;
  b.className = topo.boundary === 0 && topo.nonManifold === 0 ? "" : "bad";
  document.getElementById("volume").textContent = `${fmt(vol)} vs ${fmt(boxV)} (Δ ${Math.abs(vol - boxV) <= 0 ? "0" : fmt(vol - boxV)})`;
  // keep the assertion that core really returned the exact box volume
  document.getElementById("volume").className = vol === boxV ? "" : "bad";
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
load();
