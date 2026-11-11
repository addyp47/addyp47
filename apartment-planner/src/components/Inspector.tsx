import { useEditor } from '../store/editor';
import { CATALOG_BY_ID, furnitureColor } from '../catalog/furniture';
import { newId } from '../model/defaults';
import type { RoomType } from '../model/types';
import { LengthInput } from './LengthInput';
import { clampOpeningT, wallDir, wallLength } from '../geometry/plan';
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

  if (selection.kind === 'furniture') {
    const f = project.furniture.find((x) => x.id === selection.id);
    if (!f) return null;
    const upd = (fn: (it: (typeof project.furniture)[number]) => void) =>
      mutate((d) => {
        const it = d.furniture.find((x) => x.id === f.id);
        if (it) fn(it);
      });
    const cat = CATALOG_BY_ID.get(f.catalogId);
    const sized = cat && (cat.width !== f.width || cat.depth !== f.depth || cat.height !== f.height);
    return (
      <div className="section">
        <h3>Furniture</h3>
        <div className="row">
          <label>Name</label>
          <input type="text" value={f.name} onChange={(e) => upd((it) => void (it.name = e.target.value))} />
        </div>
        <div className="row">
          <label>Width</label>
          <LengthInput value={f.width} min={1} onCommit={(v) => upd((it) => void (it.width = v))} />
        </div>
        <div className="row">
          <label>Depth</label>
          <LengthInput value={f.depth} min={1} onCommit={(v) => upd((it) => void (it.depth = v))} />
        </div>
        <div className="row">
          <label>Height</label>
          <LengthInput value={f.height} min={0.25} onCommit={(v) => upd((it) => void (it.height = v))} />
        </div>
        <div className="row">
          <label>Rotation</label>
          <input
            type="number"
            step={15}
            value={Math.round(f.rotation)}
            onChange={(e) => upd((it) => void (it.rotation = ((Number(e.target.value) % 360) + 360) % 360))}
          />
          <button className="small" title="Rotate 90° (R)" onClick={() => upd((it) => void (it.rotation = (it.rotation + 90) % 360))}>
            ↻ 90°
          </button>
        </div>
        <div className="row">
          <label>Color</label>
          <input type="color" value={furnitureColor(f, project.style.palette)} onChange={(e) => upd((it) => void (it.color = e.target.value))} />
          {f.color && (
            <button className="small" onClick={() => upd((it) => void delete it.color)}>
              Use palette
            </button>
          )}
        </div>
        <div className="row wrap">
          <label className="checkbox" title="Counts as an obstacle for walkway clearance checks">
            <input type="checkbox" checked={f.obstacle} onChange={(e) => upd((it) => void (it.obstacle = e.target.checked))} />
            Blocks floor space
          </label>
        </div>
        {sized && cat && (
          <p className="muted">
            Catalog size: {cat.width}×{cat.depth}×{cat.height}".{' '}
            <button
              className="small"
              onClick={() =>
                upd((it) => {
                  it.width = cat.width;
                  it.depth = cat.depth;
                  it.height = cat.height;
                })
              }
            >
              Reset size
            </button>
          </p>
        )}
        {cat?.note && <p className="muted">{cat.note}</p>}
        <div className="row">
          <button
            onClick={() => {
              const id = newId('furn');
              mutate((d) => void d.furniture.push({ ...f, id, x: f.x + 12, y: f.y + 12 }));
              select({ kind: 'furniture', id });
            }}
          >
            Duplicate
          </button>
          <button className="danger" onClick={remove}>
            Delete
          </button>
        </div>
      </div>
    );
  }

  if (selection.kind === 'opening') {
    const o = project.openings.find((x) => x.id === selection.id);
    const w = o && project.walls.find((x) => x.id === o.wallId);
    if (!o || !w) return null;
    const upd = (fn: (op: (typeof project.openings)[number]) => void) =>
      mutate((d) => {
        const op = d.openings.find((x) => x.id === o.id);
        if (op) fn(op);
      });
    const L = wallLength(w);
    const label = { door: 'Door', window: 'Window', outlet: 'Outlet', opening: 'Open doorway' }[o.kind];
    return (
      <div className="section">
        <h3>{label}</h3>
        {o.kind !== 'outlet' && (
          <div className="row">
            <label>Width</label>
            <LengthInput
              value={o.width}
              min={6}
              onCommit={(v) =>
                upd((op) => {
                  op.width = Math.min(v, L);
                  op.t = clampOpeningT(op.t, op.width, w);
                })
              }
            />
          </div>
        )}
        <div className="row">
          <label>From start</label>
          <LengthInput
            value={o.t * L - o.width / 2}
            min={0}
            onCommit={(v) => upd((op) => void (op.t = clampOpeningT((v + op.width / 2) / L, op.width, w)))}
          />
        </div>
        {o.kind === 'door' && (
          <div className="row">
            <button onClick={() => upd((op) => void (op.hinge = op.hinge === 'start' ? 'end' : 'start'))}>⇋ Flip hinge</button>
            <button onClick={() => upd((op) => void (op.side = op.side === 1 ? -1 : 1))}>⇅ Swing other side</button>
          </div>
        )}
        {o.kind === 'outlet' && (
          <div className="row">
            <button onClick={() => upd((op) => void (op.side = op.side === 1 ? -1 : 1))}>⇅ Other side of wall</button>
          </div>
        )}
        {(o.kind === 'window' || o.kind === 'opening') && (
          <>
            <div className="row">
              <label>Sill height</label>
              <LengthInput value={o.sillHeight} min={0} onCommit={(v) => upd((op) => void (op.sillHeight = v))} />
            </div>
            <div className="row">
              <label>Top height</label>
              <LengthInput value={o.headHeight} min={1} onCommit={(v) => upd((op) => void (op.headHeight = v))} />
            </div>
          </>
        )}
        <p className="muted">Drag it along the wall to reposition.</p>
        <button className="danger" onClick={remove}>
          Delete {label.toLowerCase()}
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
