import { useRef, useState } from 'react';
import { useEditor } from '../store/editor';
import { ProjectsDialog } from './ProjectsDialog';
import { listSaved, saveProject } from '../persistence/storage';
import { IMPORTERS, serializeProject } from '../importers/json';
import { downloadBlob, slugify } from '../persistence/download';
import { exportPlanPng } from '../persistence/exportPng';
import { getPlanSvg } from './plan/svgRef';
import { capture3D, getExportRoots } from '../three/capture';

export function Toolbar() {
  const name = useEditor((s) => s.project.name);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { mutate, undo, redo, fitToView, showToast, loadProject } = useEditor.getState();
  const [showProjects, setShowProjects] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const save = () => {
    try {
      saveProject(useEditor.getState().project);
      showToast('Saved in this browser.');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const exportJson = () => {
    const p = useEditor.getState().project;
    downloadBlob(new Blob([serializeProject(p)], { type: 'application/json' }), `${slugify(p.name)}.apartment.json`);
  };

  const viewMode = useEditor((s) => s.viewMode);
  const setViewMode = useEditor((s) => s.setViewMode);

  const exportGlb = async () => {
    const roots = getExportRoots();
    if (!roots) return;
    try {
      const [{ GLTFExporter }, THREE] = await Promise.all([import('three/examples/jsm/exporters/GLTFExporter.js'), import('three')]);
      // Export in meters (glTF convention) with every wall opaque.
      const root = new THREE.Group();
      root.scale.setScalar(0.0254);
      for (const r of roots) root.add(r.clone(true));
      root.traverse((o) => {
        const mesh = o as import('three').Mesh;
        const m = mesh.material as import('three').Material | undefined;
        if (m && !Array.isArray(m) && m.opacity < 1 && o.parent?.userData.kind === 'wall') {
          const c = m.clone();
          c.opacity = 1;
          mesh.material = c;
        }
      });
      root.updateMatrixWorld(true);
      const data = (await new GLTFExporter().parseAsync(root, { binary: true })) as ArrayBuffer;
      downloadBlob(new Blob([data], { type: 'model/gltf-binary' }), `${slugify(useEditor.getState().project.name)}.glb`);
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const exportPng = async () => {
    if (useEditor.getState().viewMode === '3d') {
      try {
        const blob = await capture3D();
        if (blob) downloadBlob(blob, `${slugify(useEditor.getState().project.name)}-3d.png`);
      } catch (e) {
        showToast((e as Error).message, 'error');
      }
      return;
    }
    const svg = getPlanSvg();
    if (!svg) return;
    // Drop selection/hover highlights before capturing.
    useEditor.setState({ selection: null, hoverId: null });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      const { project, view } = useEditor.getState();
      const blob = await exportPlanPng(svg, project, view.scale);
      downloadBlob(blob, `${slugify(project.name)}.png`);
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const importer = IMPORTERS.find((i) => i.canImport(file));
    if (!importer) return showToast('Unsupported file type.', 'error');
    try {
      try {
        saveProject(useEditor.getState().project);
      } catch {
        /* keep going: the import matters more */
      }
      let p = await importer.import(file);
      if (listSaved().some((m) => m.name === p.name)) p = { ...p, name: `${p.name} (imported)` };
      loadProject(p);
      showToast(`Imported “${p.name}”.`);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <header className="toolbar">
      <strong className="brand">Apartment Planner</strong>
      <input
        className="project-name"
        type="text"
        value={name}
        aria-label="Project name"
        onChange={(e) => mutate((d) => void (d.name = e.target.value))}
      />
      <span className="sep" />
      <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        ↶ Undo
      </button>
      <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
        ↷ Redo
      </button>
      <button onClick={fitToView} title="Fit plan to window">
        ⤢ Fit
      </button>
      <span className="sep" />
      <div className="segmented" role="group" aria-label="View">
        <button className={viewMode === '2d' ? 'active' : ''} onClick={() => setViewMode('2d')}>
          2D plan
        </button>
        <button className={viewMode === '3d' ? 'active' : ''} onClick={() => setViewMode('3d')}>
          3D
        </button>
      </div>
      <span className="spacer" />
      <button onClick={() => setShowProjects(true)}>Layouts…</button>
      <button onClick={save} title="Layouts also autosave">
        Save
      </button>
      <span className="sep" />
      <input ref={fileInput} type="file" hidden accept={IMPORTERS.map((i) => i.accept).join(',')} onChange={(e) => importFile(e.target.files?.[0])} />
      <button onClick={() => fileInput.current?.click()}>Import JSON</button>
      <button onClick={exportJson}>Export JSON</button>
      {viewMode === '3d' && <button onClick={exportGlb}>Export GLB</button>}
      <button className="primary" onClick={exportPng}>
        Export PNG
      </button>
      {showProjects && <ProjectsDialog onClose={() => setShowProjects(false)} />}
    </header>
  );
}
