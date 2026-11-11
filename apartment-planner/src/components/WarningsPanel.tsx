import { useEditor } from '../store/editor';
import { getWarnings, WALKWAY_MIN, type WarningKind } from '../analysis/warnings';

const ICON: Record<WarningKind, string> = { wall: '⛔', door: '🚪', overlap: '⧉', clearance: '↔' };

export function WarningsPanel() {
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const showWarnings = useEditor((s) => s.showWarnings);
  const { setShowWarnings, select, setTool } = useEditor.getState();
  const warnings = getWarnings(project);

  return (
    <div className="section">
      <h3>Layout check</h3>
      <label className="checkbox" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={showWarnings} onChange={(e) => setShowWarnings(e.target.checked)} />
        Show issues on the plan
      </label>
      {project.furniture.length === 0 ? (
        <p className="empty">Add furniture to check for wall overlaps, blocked doors, and tight walkways.</p>
      ) : warnings.length === 0 ? (
        <p className="ok">✓ No issues. Walkways are {WALKWAY_MIN}"+ and doors swing freely.</p>
      ) : (
        <ul className="list warnings">
          {warnings.map((w) => {
            const active = selection?.kind === 'furniture' && w.furnitureIds.includes(selection.id);
            return (
              <li
                key={w.id}
                className={`${w.severity} ${active ? 'selected' : ''}`}
                onClick={() => {
                  setTool('select');
                  select({ kind: 'furniture', id: w.furnitureIds[0] });
                }}
              >
                <span>
                  <span aria-hidden>{ICON[w.kind]}</span> {w.message}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted" style={{ marginTop: 10 }}>
        Checks: furniture overlapping walls, blocking door swings, overlapping other pieces, and gaps between {2}" and {WALKWAY_MIN}" (too narrow to
        walk through, but not pushed together). Chairs, lamps, plants, and rugs are skipped for walkways, and so is the coffee-table-to-sofa gap.
      </p>
    </div>
  );
}
