import { useEditor, type Tool } from '../store/editor';

export const TOOLS: { id: Tool; label: string; icon: string; key: string }[] = [
  { id: 'select', label: 'Select', icon: '↖', key: 'V' },
  { id: 'room', label: 'Room', icon: '▭', key: 'M' },
  { id: 'wall', label: 'Wall', icon: '╱', key: 'W' },
  { id: 'calibrate', label: 'Set scale', icon: '↔', key: 'K' },
  { id: 'door', label: 'Door', icon: '◜', key: 'D' },
  { id: 'window', label: 'Window', icon: '▤', key: 'N' },
  { id: 'outlet', label: 'Outlet', icon: '⏚', key: 'O' },
];

export function ToolPalette() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const traceCreatesWalls = useEditor((s) => s.traceCreatesWalls);
  const setTraceCreatesWalls = useEditor((s) => s.setTraceCreatesWalls);
  return (
    <div className="section">
      <h3>Tools</h3>
      <div className="tool-grid">
        {TOOLS.map((t) => (
          <button key={t.id} className={tool === t.id ? 'active' : ''} onClick={() => setTool(t.id)} title={`${t.label} (${t.key})`}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
            <kbd>{t.key}</kbd>
          </button>
        ))}
      </div>
      {tool === 'room' && (
        <label className="checkbox" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={traceCreatesWalls} onChange={(e) => setTraceCreatesWalls(e.target.checked)} />
          Also create walls along room edges
        </label>
      )}
    </div>
  );
}
