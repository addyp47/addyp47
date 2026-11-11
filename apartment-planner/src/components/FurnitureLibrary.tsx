import { useMemo, useState } from 'react';
import { CATALOG, createFurniture, type CatalogItem } from '../catalog/furniture';
import { screenToWorld, useEditor } from '../store/editor';
import { FURNITURE_DND_TYPE } from './plan/PlanCanvas';
import { polygonCentroid } from '../geometry/polygon';
import type { Vec2 } from '../model/types';
import { projectBounds } from '../geometry/plan';

/** Place a catalog piece at a point (or the selected room / view center) and select it. */
export function placeCatalogItem(c: CatalogItem, at?: Vec2) {
  const s = useEditor.getState();
  let p = at;
  if (!p) {
    const room = s.selection?.kind === 'room' ? s.project.rooms.find((r) => r.id === s.selection!.id) : undefined;
    const b = s.viewMode === '3d' ? projectBounds(s.project, false) : null;
    p = room
      ? polygonCentroid(room.polygon)
      : b
        ? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }
        : s.viewMode === '3d'
          ? { x: 0, y: 0 }
          : screenToWorld(s.view, s.viewport.width / 2, s.viewport.height / 2);
  }
  const f = createFurniture(c, p);
  s.mutate((d) => void d.furniture.push(f));
  s.setTool('select');
  s.select({ kind: 'furniture', id: f.id });
  return f;
}

export function FurnitureLibrary() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ Living: true });
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const items = needle ? CATALOG.filter((c) => c.name.toLowerCase().includes(needle) || c.group.toLowerCase().includes(needle)) : CATALOG;
    const map = new Map<string, CatalogItem[]>();
    for (const c of items) map.set(c.group, [...(map.get(c.group) ?? []), c]);
    return [...map.entries()];
  }, [q]);

  return (
    <div className="section">
      <h3>Furniture</h3>
      <input type="text" placeholder="Search furniture…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <p className="muted" style={{ margin: '0 0 6px' }}>
        Click to add, or drag onto the plan.
      </p>
      {groups.map(([group, items]) => {
        const isOpen = q ? true : !!open[group];
        return (
          <div key={group} className="lib-group">
            <button className="lib-group-head" onClick={() => setOpen({ ...open, [group]: !isOpen })}>
              <span>{isOpen ? '▾' : '▸'}</span> {group} <span className="muted">{items.length}</span>
            </button>
            {isOpen &&
              items.map((c) => (
                <div
                  key={c.id}
                  className="lib-item"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(FURNITURE_DND_TYPE, c.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => placeCatalogItem(c)}
                  title={c.note ?? `${c.width}" W × ${c.depth}" D × ${c.height}" H`}
                >
                  <span>{c.name}</span>
                  <span className="muted">
                    {c.width}×{c.depth}"
                  </span>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}
