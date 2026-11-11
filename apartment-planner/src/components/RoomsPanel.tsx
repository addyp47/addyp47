import { useEditor } from '../store/editor';
import { polygonArea } from '../geometry/polygon';
import { formatArea } from '../geometry/units';
import { ROOM_TYPES } from './Inspector';

export function RoomsPanel() {
  const rooms = useEditor((s) => s.project.rooms);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const setTool = useEditor((s) => s.setTool);
  const total = rooms.reduce((s, r) => s + polygonArea(r.polygon), 0);
  return (
    <div className="section">
      <h3>Rooms</h3>
      {rooms.length === 0 ? (
        <p className="empty">
          No rooms yet. Use the <b>Room</b> tool (M) to trace one.{' '}
          <button className="small" onClick={() => setTool('room')}>
            Start tracing
          </button>
        </p>
      ) : (
        <>
          <ul className="list">
            {rooms.map((r) => (
              <li
                key={r.id}
                className={selection?.kind === 'room' && selection.id === r.id ? 'selected' : ''}
                onClick={() => {
                  setTool('select');
                  select({ kind: 'room', id: r.id });
                }}
              >
                <span>{r.name}</span>
                <span className="muted">
                  {ROOM_TYPES.find((t) => t.id === r.type)?.label} · {formatArea(polygonArea(r.polygon))}
                </span>
              </li>
            ))}
          </ul>
          <p className="muted">Total: {formatArea(total)}</p>
        </>
      )}
    </div>
  );
}
