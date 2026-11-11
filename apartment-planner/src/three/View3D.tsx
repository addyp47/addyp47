import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useEditor } from '../store/editor';
import { getWarnings } from '../analysis/warnings';
import { projectBounds } from '../geometry/plan';
import { snap } from '../geometry/vec';
import { formatFtIn } from '../geometry/units';
import { buildFurniture, buildStructure, clearGroup } from './buildScene';
import { setCapture3D } from './capture';
import { EYE_HEIGHT, isBlocked, walkStep } from './walk';
import { roomInterior } from '../styles/rugs';
import { polygonArea } from '../geometry/polygon';

interface Ctx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  structure: THREE.Group;
  furniture: THREE.Group;
  center: THREE.Vector3;
  framedProjectId: string | null;
}

/** 3D view built from the same Project data as the 2D plan. Drag furniture on the floor; orbit with the mouse. */
export default function View3D() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<Ctx | null>(null);
  const walkRef = useRef<{ active: boolean; x: number; y: number; yaw: number; pitch: number } | null>(null);

  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const showWarnings = useEditor((s) => s.showWarnings);
  const walkMode = useEditor((s) => s.walkMode);
  const warnings = getWarnings(project);

  // One-time renderer setup
  useEffect(() => {
    const wrap = wrapRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f3f0);
    const camera = new THREE.PerspectiveCamera(45, 1, 5, 20000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.enableDamping = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a6, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun, sun.target);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.MeshStandardMaterial({ color: 0xe9e8e3, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    scene.add(ground);

    const structure = new THREE.Group();
    const furniture = new THREE.Group();
    scene.add(structure, furniture);
    const ctx: Ctx = { renderer, scene, camera, controls, structure, furniture, center: new THREE.Vector3(), framedProjectId: null };
    ctxRef.current = ctx;
    (ctx as Ctx & { sun: THREE.DirectionalLight }).sun = sun;

    const resize = () => {
      const w = wrap.clientWidth || 1;
      const h = wrap.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    setCapture3D(() => {
      renderer.render(scene, camera);
      return new Promise<Blob>((resolve, reject) => renderer.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not capture the 3D view'))), 'image/png'));
    }, [structure, furniture]);

    // Walls between the camera and the room fade out so you can see inside.
    const toCam = new THREE.Vector3();
    const toCenter = new THREE.Vector3();
    let raf = 0;
    let last = performance.now();
    const keys = new Set<string>();
    const walk = { active: false, x: 0, y: 0, yaw: 0, pitch: 0 };
    walkRef.current = walk;
    const fwd = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const walking = useEditor.getState().walkMode;
      if (walking !== walk.active) {
        walk.active = walking;
        controls.enabled = !walking;
        camera.fov = walking ? 72 : 45;
        camera.near = walking ? 1 : 5;
        camera.updateProjectionMatrix();
        keys.clear();
        if (walking) {
          const start = walkStart(useEditor.getState().project);
          Object.assign(walk, { x: start.x, y: start.y, yaw: start.yaw, pitch: -0.05 });
        } else {
          camera.position.set(ctx.center.x + 200, 320, ctx.center.z + 320);
          controls.target.copy(ctx.center).setY(30);
        }
      }
      if (walking) {
        const turn = (keys.has('arrowleft') ? 1 : 0) - (keys.has('arrowright') ? 1 : 0);
        walk.yaw += turn * 1.9 * dt;
        const f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
        const r = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
        if (f || r) {
          const speed = (keys.has('shift') ? 110 : 55) * dt; // inches per second
          const sin = Math.sin(walk.yaw);
          const cos = Math.cos(walk.yaw);
          // forward is (-sin, -cos) on the plan; right is (cos, -sin)
          const delta = { x: (-sin * f + cos * r) * speed, y: (-cos * f - sin * r) * speed };
          const next = walkStep(useEditor.getState().project, { x: walk.x, y: walk.y }, delta);
          walk.x = next.x;
          walk.y = next.y;
        }
        camera.position.set(walk.x, EYE_HEIGHT, walk.y);
        fwd.set(-Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), -Math.cos(walk.yaw) * Math.cos(walk.pitch));
        camera.lookAt(camera.position.x + fwd.x, camera.position.y + fwd.y, camera.position.z + fwd.z);
      } else controls.update();
      for (const g of structure.children[0]?.children ?? []) {
        if (g.userData.kind === 'ceiling') g.visible = walking;
        if (g.userData.kind !== 'wall') continue;
        toCam.subVectors(camera.position, g.userData.mid);
        toCenter.subVectors(ctx.center, g.userData.mid);
        const n = g.userData.normal as THREE.Vector3;
        const between = !walking && toCam.dot(n) * toCenter.dot(n) < 0 && Math.abs(toCenter.dot(n)) > 6;
        const mat = g.userData.material as THREE.MeshStandardMaterial;
        const target = between ? 0.12 : 1;
        if (mat.opacity !== target) {
          mat.opacity = target;
          mat.depthWrite = !between;
        }
      }
      renderer.render(scene, camera);
    };
    tick();

    // --- Pointer interaction: select and drag furniture on the floor plane ---
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    let dragging: { id: string; dx: number; dz: number } | null = null;
    let downAt: { x: number; y: number } | null = null;

    const setRay = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
    };
    const pickFurniture = (): string | null => {
      // Rugs are picked last so pieces standing on them win.
      const hits = raycaster.intersectObjects(furniture.children, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o && o.userData.kind !== 'furniture') o = o.parent;
        if (o) return o.userData.id as string;
      }
      return null;
    };

    let looking: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      downAt = { x: e.clientX, y: e.clientY };
      setRay(e);
      if (walk.active) {
        looking = { x: e.clientX, y: e.clientY };
        renderer.domElement.setPointerCapture(e.pointerId);
        return;
      }
      const id = pickFurniture();
      if (!id) return;
      const s = useEditor.getState();
      const f = s.project.furniture.find((x) => x.id === id);
      if (!f || !raycaster.ray.intersectPlane(floorPlane, hit)) return;
      s.select({ kind: 'furniture', id });
      s.checkpoint();
      dragging = { id, dx: hit.x - f.x, dz: hit.z - f.y };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (looking) {
        walk.yaw += (e.clientX - looking.x) * 0.005;
        walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch + (e.clientY - looking.y) * 0.004));
        looking = { x: e.clientX, y: e.clientY };
        return;
      }
      if (!dragging) return;
      setRay(e);
      if (!raycaster.ray.intersectPlane(floorPlane, hit)) return;
      const d = dragging;
      const x = snap(hit.x - d.dx, 0.5);
      const y = snap(hit.z - d.dz, 0.5);
      useEditor.getState().mutate(
        (draft) => {
          const f = draft.furniture.find((it) => it.id === d.id);
          if (f) {
            f.x = x;
            f.y = y;
          }
        },
        { record: false },
      );
    };
    const onUp = (e: PointerEvent) => {
      const wasDragging = !!dragging;
      dragging = null;
      if (walk.active) {
        // A click (not a look-drag) selects the piece you're looking at.
        const moved = downAt ? Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) : 99;
        looking = null;
        downAt = null;
        if (moved < 4) {
          setRay(e);
          const id = pickFurniture();
          useEditor.getState().select(id ? { kind: 'furniture', id } : null);
        }
        return;
      }
      controls.enabled = true;
      // A click (not an orbit drag) on empty space clears the selection.
      if (!wasDragging && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 4) useEditor.getState().select(null);
      downAt = null;
    };
    // Walk mode: double-click the floor to walk there.
    const onDouble = (e: MouseEvent) => {
      if (!walk.active) return;
      setRay(e as PointerEvent);
      if (!raycaster.ray.intersectPlane(floorPlane, hit)) return;
      const to = { x: hit.x, y: hit.z };
      if (!isBlocked(useEditor.getState().project, to)) Object.assign(walk, to);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!walk.active || (e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' && e.type === 'keydown') return useEditor.getState().setWalkMode(false);
      if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) return;
      if (k.startsWith('arrow')) e.preventDefault();
      if (e.type === 'keydown') keys.add(k);
      else keys.delete(k);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    const el = renderer.domElement;
    el.addEventListener('dblclick', onDouble);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      setCapture3D(null, null);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      el.removeEventListener('dblclick', onDouble);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      controls.dispose();
      clearGroup(structure);
      clearGroup(furniture);
      renderer.dispose();
      wrap.removeChild(el);
      ctxRef.current = null;
    };
  }, []);

  const blockedDoors = showWarnings ? warnings.filter((w) => w.openingId).map((w) => w.openingId!) : [];
  const blockedKey = blockedDoors.join(',');

  // Rebuild structure when rooms, walls, openings, or colors change (immer keeps unchanged parts identical).
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    clearGroup(ctx.structure);
    ctx.structure.add(buildStructure(project, new Set(blockedDoors)));
    const b = projectBounds(project, false);
    if (b) {
      ctx.center.set((b.minX + b.maxX) / 2, 0, (b.minY + b.maxY) / 2);
      const size = Math.max(b.maxX - b.minX, b.maxY - b.minY, 120);
      const sun = (ctx as Ctx & { sun: THREE.DirectionalLight }).sun;
      sun.position.set(ctx.center.x + size * 0.5, size * 1.4, ctx.center.z + size * 0.35);
      sun.target.position.copy(ctx.center);
      const sc = sun.shadow.camera;
      sc.left = sc.bottom = -size;
      sc.right = sc.top = size;
      sc.far = size * 4;
      sc.updateProjectionMatrix();
      if (ctx.framedProjectId !== project.id) {
        ctx.framedProjectId = project.id;
        ctx.controls.target.copy(ctx.center).setY(30);
        ctx.camera.position.set(ctx.center.x + size * 0.2, size * 1.25, ctx.center.z + size * 1.25);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.rooms, project.walls, project.openings, project.style.palette, project.id, blockedKey]);

  const flagged = showWarnings ? warnings.filter((w) => w.kind !== 'clearance').flatMap((w) => w.furnitureIds) : [];
  const flaggedKey = flagged.join(',');
  const selectedId = selection?.kind === 'furniture' ? selection.id : null;

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    clearGroup(ctx.furniture);
    ctx.furniture.add(buildFurniture(project, { selectedId, flaggedIds: new Set(flagged) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.furniture, project.style.palette, selectedId, flaggedKey]);

  const sel = selectedId ? project.furniture.find((f) => f.id === selectedId) : undefined;
  const selWarnings = sel ? warnings.filter((w) => w.furnitureIds.includes(sel.id)) : [];
  const empty = project.walls.length === 0 && project.rooms.length === 0 && project.furniture.length === 0;

  return (
    <div className="plan-wrap view3d" ref={wrapRef}>
      {empty && (
        <div className="empty-3d">
          <b>Nothing to show in 3D yet</b>
          <span>Import a RoomPlan scan (toolbar → Import), or switch to 2D and trace a room.</span>
          <button style={{ pointerEvents: 'auto' }} onClick={() => import('../demo/demoProject').then((m) => useEditor.getState().loadProject(m.createDemoProject()))}>
            Open the demo apartment
          </button>
        </div>
      )}
      {!empty && (
        <div className="view3d-controls">
          <button className={walkMode ? 'active' : ''} onClick={() => useEditor.getState().setWalkMode(!walkMode)} title="First-person walkthrough at eye height">
            {walkMode ? '✕ Exit walkthrough' : '🚶 Walk through'}
          </button>
        </div>
      )}
      <div className="statusbar">
        <span className="hint">
          {walkMode
            ? 'W A S D or arrow keys to walk (Shift = faster) · drag to look around · double-click the floor to jump there · Esc to exit'
            : 'Drag to orbit · right-drag to pan · scroll to zoom · drag furniture to move it · R rotates · Del deletes'}
        </span>
        {sel && (
          <span>
            <b>{sel.name}</b> {formatFtIn(sel.width, true)} W × {formatFtIn(sel.depth, true)} D × {formatFtIn(sel.height, true)} H
            {selWarnings.length > 0 && <span className="warn-text"> · {selWarnings[0].message}</span>}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Start the walkthrough in the biggest room, at the spot with the most open
 * floor around it, facing the far corner.
 */
function walkStart(project: import('../model/types').Project): { x: number; y: number; yaw: number } {
  const room = [...project.rooms].sort((a, b) => polygonArea(b.polygon) - polygonArea(a.polygon))[0];
  const b = room ? roomInterior(room).rect : projectBounds(project, false);
  if (!b) return { x: 0, y: 0, yaw: 0 };
  const mid = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  let best = mid;
  let bestOpen = -1;
  for (let x = b.minX + 12; x <= b.maxX - 12; x += 12)
    for (let y = b.minY + 12; y <= b.maxY - 12; y += 12) {
      let open = 0;
      for (const r of [9, 18, 27, 36, 48]) {
        if (isBlocked(project, { x, y }, r)) break;
        open = r;
      }
      // Most open floor wins; ties go to the spot nearest the middle of the room.
      const score = open - Math.hypot(x - mid.x, y - mid.y) / 1000;
      if (score > bestOpen) {
        bestOpen = score;
        best = { x, y };
      }
    }
  // Face the far corner of the room: the widest view from here.
  const corners = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];
  const far = corners.reduce((p, c) => (Math.hypot(c.x - best.x, c.y - best.y) > Math.hypot(p.x - best.x, p.y - best.y) ? c : p));
  const yaw = Math.atan2(-(far.x - best.x), -(far.y - best.y));
  return { ...best, yaw };
}
