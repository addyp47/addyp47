import { useState } from 'react';
import { useEditor } from '../store/editor';
import { deleteSaved, listSaved, loadSaved, saveProject } from '../persistence/storage';
import { createEmptyProject, newId } from '../model/defaults';

export function ProjectsDialog({ onClose }: { onClose: () => void }) {
  const current = useEditor((s) => s.project);
  const [, refresh] = useState(0);
  const saved = listSaved();
  const { loadProject, showToast } = useEditor.getState();

  const persistCurrent = () => {
    try {
      saveProject(useEditor.getState().project);
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const open = (id: string) => {
    persistCurrent();
    const p = loadSaved(id);
    if (!p) return showToast('That layout could not be loaded.', 'error');
    loadProject(p);
    onClose();
  };

  const newProject = () => {
    persistCurrent();
    loadProject(createEmptyProject(`Apartment ${saved.length + 1}`));
    onClose();
  };

  const saveCopy = () => {
    const copy = { ...current, id: newId('proj'), name: `${current.name} (copy)`, updatedAt: Date.now() };
    try {
      saveProject(copy);
      loadProject(copy);
      showToast(`Saved a copy: “${copy.name}”`);
      onClose();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Saved layouts</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Layouts autosave in this browser. Use <b>Export JSON</b> to back one up or move it to another device.
        </p>
        <ul className="list projects">
          {saved.length === 0 && <li className="empty">Nothing saved yet.</li>}
          {saved.map((m) => (
            <li key={m.id} className={m.id === current.id ? 'selected' : ''}>
              <div className="proj-row">
                <div onClick={() => open(m.id)} style={{ flex: 1 }}>
                  <div>
                    <b>{m.name}</b> {m.id === current.id && <span className="tag">open</span>}
                  </div>
                  <div className="muted">
                    {m.rooms} room{m.rooms === 1 ? '' : 's'} · {m.furniture} piece{m.furniture === 1 ? '' : 's'} · {new Date(m.updatedAt).toLocaleString()}
                  </div>
                </div>
                <button
                  className="small danger"
                  onClick={() => {
                    if (!confirm(`Delete “${m.name}”? This cannot be undone.`)) return;
                    deleteSaved(m.id);
                    if (m.id === current.id) loadProject(createEmptyProject());
                    refresh((n) => n + 1);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button onClick={saveCopy}>Save a copy</button>
          <button onClick={newProject}>New layout</button>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
