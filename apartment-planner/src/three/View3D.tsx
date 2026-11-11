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

  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const showWarnings = useEditor((s) => s.showWarnings);
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

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a6, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
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
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      for (const g of structure.children[0]?.children ?? []) {
        if (g.userData.kind !== 'wall') continue;
        toCam.subVectors(camera.position, g.userData.mid);
        toCenter.subVectors(ctx.center, g.userData.mid);
        const n = g.userData.normal as THREE.Vector3;
        const between = toCam.dot(n) * toCenter.dot(n) < 0 && Math.abs(toCenter.dot(n)) > 6;
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

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      downAt = { x: e.clientX, y: e.clientY };
      setRay(e);
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
      controls.enabled = true;
      // A click (not an orbit drag) on empty space clears the selection.
      if (!wasDragging && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 4) useEditor.getState().select(null);
      downAt = null;
    };
    const el = renderer.domElement;
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      setCapture3D(null, null);
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
        </div>
      )}
      <div className="statusbar">
        <span className="hint">Drag to orbit · right-drag to pan · scroll to zoom · drag furniture to move it · R rotates · Del deletes</span>
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
