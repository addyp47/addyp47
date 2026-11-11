import { useEditor } from '../store/editor';
import type { RoomType } from '../model/types';
import { LengthInput } from './LengthInput';
import { wallDir, wallLength } from '../geometry/plan';
import { add, scale } from '../geometry/vec';
import { deleteSelection, findVerticesAt, moveVertices } from '../model/operations';
import { polygonArea, bbox } from '../geometry/polygon';
import { formatArea, formatFtIn } from '../geometry/units';

export const ROOM_TYPES: { id: RoomType; label: string }[] = [
  { id: 'living', label: 'Living room' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'dining', label: 'Dining' },
  { id: 'office', label: 'Office' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'entry', label: 'Entry / hall' },
  { id: 'other', label: 'Other' },
];

export function Inspector() {
  const selection = useEditor((s) => s.selection);
  const project = useEditor((s) => s.project);
  const { mutate, select } = useEditor.getState();

  if (!selection) {
    return (
      <div className="section">
        <h3>Inspector</h3>
        <p className="empty">Select a wall, room, door, or furniture piece to edit it.</p>
        <Shortcuts />
      </div>
    );
  }

  const remove = () => {
    mutate((d) => deleteSelection(d, selection));
    select(null);
  };

  if (selection.kind === 'wall') {
    const w = project.walls.find((x) => x.id === selection.id);
    if (!w) return null;
    return (
      <div className="section">
        <h3>Wall</h3>
        <div className="row">
          <label>Length</label>
          <LengthInput
            value={wallLength(w)}
            onCommit={(len) =>
              mutate((d) => {
                const refs = findVerticesAt(d, w.b);
                moveVertices(d, refs, add(w.a, scale(wallDir(w), len)));
              })
            }
          />
        </div>
        <div className="row">
          <label>Thickness</label>
          <LengthInput value={w.thickness} min={1} onCommit={(v) => mutate((d) => void (d.walls.find((x) => x.id === w.id)!.thickness = v))} />
        </div>
        <div className="row">
          <label>Height</label>
          <LengthInput value={w.height} min={12} onCommit={(v) => mutate((d) => void (d.walls.find((x) => x.id === w.id)!.height = v))} />
        </div>
        <p className="muted">Drag the round handles to move corners. Connected walls and rooms follow.</p>
        <button className="danger" onClick={remove}>
          Delete wall
        </button>
      </div>
    );
  }

  if (selection.kind === 'room') {
    const r = project.rooms.find((x) => x.id === selection.id);
    if (!r) return null;
    const b = bbox(r.polygon)!;
    const upd = (fn: (room: (typeof project.rooms)[number]) => void) =>
      mutate((d) => {
        const room = d.rooms.find((x) => x.id === r.id);
        if (room) fn(room);
      });
    return (
      <div className="section">
        <h3>Room</h3>
        <div className="row">
          <label>Name</label>
          <input type="text" value={r.name} onChange={(e) => upd((room) => void (room.name = e.target.value))} />
        </div>
        <div className="row">
          <label>Type</label>
          <select value={r.type} onChange={(e) => upd((room) => void (room.type = e.target.value as RoomType))}>
            {ROOM_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <label>Floor</label>
          <input
            type="color"
            value={r.floorColor ?? project.style.palette.floor}
            onChange={(e) => upd((room) => void (room.floorColor = e.target.value))}
          />
          {r.floorColor && (
            <button className="small" onClick={() => upd((room) => void delete room.floorColor)}>
              Use palette
            </button>
          )}
        </div>
        <p className="muted">
          {formatFtIn(b.maxX - b.minX)} × {formatFtIn(b.maxY - b.minY)} · {formatArea(polygonArea(r.polygon))}
        </p>
        <button className="danger" onClick={remove}>
          Delete room
        </button>
      </div>
    );
  }

  return null;
}

function Shortcuts() {
  return (
    <div className="muted" style={{ marginTop: 12, lineHeight: 1.7 }}>
      <div>
        <b>Shortcuts</b>
      </div>
      <div>V select · M room · W wall · K set scale</div>
      <div>D door · N window · O outlet</div>
      <div>R rotate 90° · Ctrl+D duplicate · arrows nudge</div>
      <div>Ctrl+Z undo · Ctrl+Shift+Z redo · Del delete</div>
      <div>Shift while drawing = free angle</div>
      <div>Alt+drag or middle-drag = pan</div>
    </div>
  );
}
