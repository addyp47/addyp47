import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../store/editor';
import { loadImageFile } from '../persistence/image';
import { newId } from '../model/defaults';
import { furnitureColor } from '../catalog/furniture';
import { MAX_PHOTOS, suggestFromPhotos, usableSuggestions } from '../ai/labelFromPhotos';

type Target = 'piece' | 'floor' | 'walls';
type Usable = ReturnType<typeof usableSuggestions>;

const KEY_STORE = 'aptplanner:anthropic-key';

/** Average color of a small square around (x, y) on a canvas. */
function sample(ctx: CanvasRenderingContext2D, x: number, y: number, r = 4): string {
  const x0 = Math.max(0, Math.round(x) - r);
  const y0 = Math.max(0, Math.round(y) - r);
  const d = ctx.getImageData(x0, y0, Math.min(r * 2 + 1, ctx.canvas.width - x0), Math.min(r * 2 + 1, ctx.canvas.height - y0)).data;
  let R = 0, G = 0, B = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    R += d[i];
    G += d[i + 1];
    B += d[i + 2];
  }
  return '#' + [R, G, B].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('');
}

/** Reference photos: copy real colors onto pieces, rename them, or let Claude suggest both. */
export function PhotosPanel() {
  const photos = useEditor((s) => s.photos);
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const { addPhotos, removePhoto, mutate, select, showToast } = useEditor.getState();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [target, setTarget] = useState<Target>('piece');
  const [lastColor, setLastColor] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const active = photos.find((p) => p.id === activeId) ?? photos[0];
  const selected = selection?.kind === 'furniture' ? project.furniture.find((f) => f.id === selection.id) : undefined;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = active.width;
      canvas.height = active.height;
      canvas.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0);
    };
    img.src = active.dataUrl;
  }, [active]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const loaded = await Promise.all(
        [...files].map(async (f) => {
          const img = await loadImageFile(f, 1568);
          return { id: newId('photo'), name: f.name.replace(/\.[^.]+$/, ''), dataUrl: img.dataUrl, width: img.width, height: img.height };
        }),
      );
      addPhotos(loaded);
      setActiveId(loaded[0].id);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const pick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const color = sample(canvas.getContext('2d', { willReadFrequently: true })!, ((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height);
    setLastColor(color);
    if (target === 'piece') {
      if (!selected) return showToast('Select a piece first (click it in the plan or the list below).');
      mutate((d) => {
        const f = d.furniture.find((x) => x.id === selected.id);
        if (f) f.color = color;
      });
    } else if (target === 'floor') {
      mutate((d) => {
        d.style.palette.floor = color;
        for (const r of d.rooms) delete r.floorColor;
      });
    } else mutate((d) => void (d.style.palette.walls = color));
  };

  return (
    <>
      <div className="section">
        <h3>Photos</h3>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <button onClick={() => fileInput.current?.click()} style={{ width: '100%' }}>
          Add room photos…
        </button>
        {photos.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Add photos of your rooms, then click a spot in a photo to copy its real color onto a piece, the floor, or the walls. Photos stay in this
            browser tab and are not saved with the layout.
          </p>
        ) : (
          <>
            <div className="thumbs">
              {photos.map((p) => (
                <div key={p.id} className={`thumb ${p.id === active?.id ? 'active' : ''}`} onClick={() => setActiveId(p.id)} title={p.name}>
                  <img src={p.dataUrl} alt={p.name} />
                  <button
                    className="thumb-x"
                    aria-label={`Remove ${p.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto(p.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <span className="muted">Click sets color of</span>
              <select value={target} onChange={(e) => setTarget(e.target.value as Target)}>
                <option value="piece">{selected ? selected.name : 'the selected piece'}</option>
                <option value="floor">the floor</option>
                <option value="walls">the walls</option>
              </select>
              {lastColor && <span className="swatch" style={{ background: lastColor }} title={lastColor} />}
            </div>
            <canvas ref={canvasRef} className="photo-canvas" onClick={pick} />
          </>
        )}
      </div>

      <div className="section">
        <h3>Pieces</h3>
        {project.furniture.length === 0 && <p className="empty">No furniture yet.</p>}
        <ul className="list pieces">
          {project.furniture.map((f) => (
            <li key={f.id} className={selected?.id === f.id ? 'selected' : ''} onClick={() => select({ kind: 'furniture', id: f.id })}>
              <div className="proj-row">
                <input
                  type="color"
                  value={furnitureColor(f, project.style.palette)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => mutate((d) => void (d.furniture.find((x) => x.id === f.id)!.color = e.target.value))}
                />
                <input
                  type="text"
                  value={f.name}
                  onChange={(e) => mutate((d) => void (d.furniture.find((x) => x.id === f.id)!.name = e.target.value))}
                  style={{ flex: 1 }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <ClaudeSuggest />
    </>
  );
}

function ClaudeSuggest() {
  const photos = useEditor((s) => s.photos);
  const project = useEditor((s) => s.project);
  const { mutate, showToast } = useEditor.getState();
  const [key, setKey] = useState(() => {
    try {
      return localStorage.getItem(KEY_STORE) ?? '';
    } catch {
      return '';
    }
  });
  const [remember, setRemember] = useState(!!key);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Usable | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      if (remember) localStorage.setItem(KEY_STORE, key);
      else localStorage.removeItem(KEY_STORE);
      const usable = usableSuggestions(project, await suggestFromPhotos(key.trim(), project, photos));
      setResult(usable);
      setChecked(Object.fromEntries(usable.pieces.map((p) => [p.id, true])));
      if (usable.pieces.length === 0) showToast("Claude couldn't match any pieces to these photos.");
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result) return;
    mutate((d) => {
      for (const s of result.pieces) {
        const f = d.furniture.find((x) => x.id === s.id);
        if (!f || !checked[s.id]) continue;
        f.name = s.name || f.name;
        if (s.color) f.color = s.color;
      }
      if (checked.__floor && result.floorColor) d.style.palette.floor = result.floorColor;
      if (checked.__walls && result.wallColor) d.style.palette.walls = result.wallColor;
    });
    showToast('Applied. Ctrl+Z undoes it.');
    setResult(null);
  };

  const names = new Map(project.furniture.map((f) => [f.id, f.name]));
  return (
    <div className="section">
      <h3>Suggest with Claude (optional)</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Claude looks at your photos and suggests a name and color for each piece. This sends up to {MAX_PHOTOS} photos and your list of pieces from
        this browser to the Anthropic API, using your own API key. Nothing is sent unless you click the button.
      </p>
      <div className="row">
        <input type="password" placeholder="Anthropic API key (sk-ant-…)" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" style={{ flex: 1 }} />
      </div>
      <label className="checkbox" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Remember the key in this browser
      </label>
      <button className="primary" disabled={busy || !key.trim() || photos.length === 0 || project.furniture.length === 0} onClick={run}>
        {busy ? 'Looking at photos…' : 'Suggest names and colors'}
      </button>
      {photos.length === 0 && <p className="muted">Add photos above first.</p>}

      {result && result.pieces.length + (result.floorColor ? 1 : 0) + (result.wallColor ? 1 : 0) > 0 && (
        <div className="suggestions">
          <p className="muted">Review, untick anything wrong, then apply.</p>
          {result.pieces.map((s) => (
            <label key={s.id} className="suggestion">
              <input type="checkbox" checked={!!checked[s.id]} onChange={(e) => setChecked({ ...checked, [s.id]: e.target.checked })} />
              {s.color && <span className="swatch" style={{ background: s.color }} />}
              <span>
                <b>{s.name}</b> <span className="muted">was “{names.get(s.id)}”</span>
                <br />
                <span className="muted">{s.note}</span>
              </span>
            </label>
          ))}
          {(['floor', 'walls'] as const).map((k) => {
            const color = k === 'floor' ? result.floorColor : result.wallColor;
            if (!color) return null;
            return (
              <label key={k} className="suggestion">
                <input type="checkbox" checked={!!checked[`__${k}`]} onChange={(e) => setChecked({ ...checked, [`__${k}`]: e.target.checked })} />
                <span className="swatch" style={{ background: color }} />
                <span>Use this as the {k === 'floor' ? 'floor' : 'wall'} color</span>
              </label>
            );
          })}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="primary" onClick={apply}>
              Apply selected
            </button>
            <button onClick={() => setResult(null)}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
