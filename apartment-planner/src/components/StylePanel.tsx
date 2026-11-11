import { useEditor } from '../store/editor';
import { PRESETS, PRESETS_BY_ID, RENTER_BASICS, roomSuggestion, visibleIdeas, type IdeaCategory } from '../styles/presets';
import { furnitureInRoom, roomInterior, suggestRug } from '../styles/rugs';
import { CATALOG_BY_ID, createFurniture } from '../catalog/furniture';
import { placeCatalogItem } from './FurnitureLibrary';
import { formatFtIn } from '../geometry/units';
import { ROOM_TYPES } from './Inspector';
import type { Palette, Room } from '../model/types';

const PALETTE_FIELDS: { key: Exclude<keyof Palette, 'accents'>; label: string; renterLabel?: string }[] = [
  { key: 'walls', label: 'Walls', renterLabel: 'Walls (via removable paper or art)' },
  { key: 'floor', label: 'Floor', renterLabel: 'Floor (shows through rugs)' },
  { key: 'wood', label: 'Wood' },
  { key: 'textile', label: 'Upholstery' },
];

export function StylePanel() {
  const style = useEditor((s) => s.project.style);
  const rooms = useEditor((s) => s.project.rooms);
  const { mutate } = useEditor.getState();
  const preset = style.presetId ? PRESETS_BY_ID.get(style.presetId) : undefined;

  const applyPreset = (id: string) => {
    const p = PRESETS_BY_ID.get(id)!;
    mutate((d) => {
      d.style.presetId = id;
      d.style.palette = { ...p.palette, accents: [...p.palette.accents] };
    });
  };

  const ideas = preset ? visibleIdeas(preset.ideas, style.renterMode) : [];
  const byCategory = new Map<IdeaCategory, typeof ideas>();
  for (const i of style.renterMode ? [...ideas, ...RENTER_BASICS.filter((b) => !ideas.some((x) => x.text === b.text))] : ideas) {
    byCategory.set(i.category, [...(byCategory.get(i.category) ?? []), i]);
  }

  return (
    <>
      <div className="section">
        <h3>Style preset</h3>
        <div className="preset-grid">
          {PRESETS.map((p) => (
            <button key={p.id} className={`preset ${style.presetId === p.id ? 'active' : ''}`} onClick={() => applyPreset(p.id)} title={p.tagline}>
              <span className="swatches">
                {[p.palette.walls, p.palette.floor, p.palette.wood, p.palette.textile, ...p.palette.accents].map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </span>
              <span className="preset-name">{p.name}</span>
            </button>
          ))}
        </div>
        {preset && <p className="muted" style={{ margin: '8px 0 0' }}>{preset.tagline}</p>}
        <label className="checkbox renter-toggle">
          <input type="checkbox" checked={style.renterMode} onChange={(e) => mutate((d) => void (d.style.renterMode = e.target.checked))} />
          <span>
            <b>Renter-friendly mode</b>
            <br />
            <span className="muted">Only suggest removable, reversible ideas</span>
          </span>
        </label>
      </div>

      <div className="section">
        <h3>Palette</h3>
        {PALETTE_FIELDS.map((f) => (
          <div className="row" key={f.key}>
            <input type="color" value={style.palette[f.key]} onChange={(e) => mutate((d) => void (d.style.palette[f.key] = e.target.value))} />
            <span>{style.renterMode && f.renterLabel ? f.renterLabel : f.label}</span>
          </div>
        ))}
        <div className="row">
          {style.palette.accents.map((c, i) => (
            <input key={i} type="color" value={c} onChange={(e) => mutate((d) => void (d.style.palette.accents[i] = e.target.value))} />
          ))}
          <span>Accents (rugs, chairs, lamps)</span>
        </div>
      </div>

      <div className="section">
        <h3>Room by room</h3>
        {rooms.length === 0 && <p className="empty">Trace rooms and set each room's type to get furniture and rug suggestions.</p>}
        {rooms.map((r) => (
          <RoomSuggestions key={r.id} room={r} />
        ))}
      </div>

      <div className="section">
        <h3>{preset ? `${preset.name} ideas` : style.renterMode ? 'Renter-friendly ideas' : 'Ideas'}</h3>
        {!preset && !style.renterMode && <p className="empty">Pick a preset to see ideas.</p>}
        {[...byCategory.entries()].map(([cat, list]) => (
          <div key={cat} className="idea-group">
            <div className="idea-cat">{cat}</div>
            <ul className="ideas">
              {list.map((i) => (
                <li key={i.text}>
                  {i.text}
                  {i.renterFriendly && !style.renterMode && (
                    <span className="tag" title="Removable / reversible">
                      renter-ok
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

function RoomSuggestions({ room }: { room: Room }) {
  const project = useEditor((s) => s.project);
  const { mutate, select, setTool } = useEditor.getState();
  const preset = project.style.presetId ? PRESETS_BY_ID.get(project.style.presetId) : undefined;
  const sugg = roomSuggestion(project.style.presetId, room.type);
  const rug = suggestRug(project, room, preset?.rugPolicy ?? 'front-legs');
  const present = new Set(furnitureInRoom(project, room).map((f) => f.catalogId));
  const dims = roomInterior(room);
  const center = dims.center;
  const typeLabel = ROOM_TYPES.find((t) => t.id === room.type)?.label;

  const addRug = (catalogId: string, placement = rug!.placement) => {
    const c = CATALOG_BY_ID.get(catalogId);
    if (!c) return;
    const f = createFurniture(c, placement, ((placement.rotation % 360) + 360) % 360);
    mutate((d) => void d.furniture.push(f));
    setTool('select');
    select({ kind: 'furniture', id: f.id });
  };

  return (
    <div className="room-sugg">
      <div className="room-sugg-head">
        <b>{room.name}</b>
        <span className="muted">
          {typeLabel} · {formatFtIn(dims.width)} × {formatFtIn(dims.depth)}
        </span>
      </div>
      {room.type === 'other' && <p className="muted">Set the room type in the Inspector for better suggestions.</p>}
      <div className="chips">
        {sugg.furniture.map((id) => {
          const c = CATALOG_BY_ID.get(id);
          if (!c) return null;
          const has = present.has(id);
          return (
            <button key={id} className={`chip ${has ? 'has' : ''}`} onClick={() => placeCatalogItem(c, center)} title={`Add ${c.name} (${c.width}×${c.depth}")`}>
              {has ? '✓ ' : '+ '}
              {c.name}
            </button>
          );
        })}
      </div>
      {rug && (
        <div className="rug-sugg">
          <div>
            <b>Rug: {rug.label}</b>{' '}
            <button className="small" onClick={() => addRug(rug.catalogId)}>
              Add rug
            </button>
          </div>
          <div className="muted">{rug.reason}</div>
          {rug.secondary && (
            <div className="muted">
              + {rug.secondary.reason}{' '}
              <button className="small" onClick={() => addRug(rug.secondary!.catalogId, { ...rug.placement, x: rug.placement.x + 12, y: rug.placement.y + 12 })}>
                Add {rug.secondary.label}
              </button>
            </div>
          )}
        </div>
      )}
      {sugg.tips.length > 0 && (
        <ul className="ideas">
          {sugg.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
