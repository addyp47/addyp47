import { useEditor } from '../store/editor';

export function Toolbar() {
  const name = useEditor((s) => s.project.name);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { mutate, undo, redo, fitToView } = useEditor.getState();

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
    </header>
  );
}
