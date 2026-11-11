import { useRef, useState } from 'react';
import { useEditor } from '../store/editor';
import { ProjectsDialog } from './ProjectsDialog';
import { listSaved, saveProject } from '../persistence/storage';
import { IMPORTERS, serializeProject } from '../importers/json';
import { downloadBlob, slugify } from '../persistence/download';
import { exportPlanPng } from '../persistence/exportPng';
import { getPlanSvg } from './plan/svgRef';

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

  const exportPng = async () => {
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
      <span className="spacer" />
      <button onClick={() => setShowProjects(true)}>Layouts…</button>
      <button onClick={save} title="Layouts also autosave">
        Save
      </button>
      <span className="sep" />
      <input ref={fileInput} type="file" hidden accept={IMPORTERS.map((i) => i.accept).join(',')} onChange={(e) => importFile(e.target.files?.[0])} />
      <button onClick={() => fileInput.current?.click()}>Import JSON</button>
      <button onClick={exportJson}>Export JSON</button>
      <button className="primary" onClick={exportPng}>
        Export PNG
      </button>
      {showProjects && <ProjectsDialog onClose={() => setShowProjects(false)} />}
    </header>
  );
}
