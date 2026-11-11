import { useRef } from 'react';
import { useEditor } from '../store/editor';
import { loadImageFile } from '../persistence/image';

/** Upload a lease/listing floor plan photo as a tracing background. */
export function BackgroundPanel() {
  const bg = useEditor((s) => s.project.background);
  const { mutate, fitToView, setTool, showToast } = useEditor.getState();
  const input = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const img = await loadImageFile(file);
      mutate((d) => {
        // Rough initial guess: image spans 40 ft. Calibrate to fix.
        d.background = {
          dataUrl: img.dataUrl,
          naturalWidth: img.width,
          naturalHeight: img.height,
          x: 0,
          y: 0,
          inchesPerPixel: 480 / img.width,
          opacity: 0.6,
          visible: true,
          locked: true,
        };
      });
      fitToView();
      setTool('calibrate');
      showToast('Image added. Now click both ends of a wall you know the length of.');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  return (
    <div className="section">
      <h3>Floor plan image</h3>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {!bg ? (
        <>
          <button onClick={() => input.current?.click()} style={{ width: '100%' }}>
            Upload floor plan photo…
          </button>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Trace over a plan from your lease or listing. You can also just draw rooms on the grid.
          </p>
        </>
      ) : (
        <>
          <div className="row">
            <label>Opacity</label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={bg.opacity}
              onPointerDown={() => useEditor.getState().checkpoint()}
              onChange={(e) => mutate((d) => void (d.background!.opacity = Number(e.target.value)), { record: false })}
            />
          </div>
          <div className="row wrap">
            <label className="checkbox">
              <input type="checkbox" checked={bg.visible} onChange={(e) => mutate((d) => void (d.background!.visible = e.target.checked))} />
              Show
            </label>
            <label className="checkbox" title="Unlock to drag the image around">
              <input type="checkbox" checked={!bg.locked} onChange={(e) => mutate((d) => void (d.background!.locked = !e.target.checked))} />
              Movable
            </label>
          </div>
          <div className="row">
            <button className="small" onClick={() => setTool('calibrate')}>
              Set scale
            </button>
            <button className="small" onClick={() => input.current?.click()}>
              Replace
            </button>
            <button className="small danger" onClick={() => mutate((d) => void (d.background = null))}>
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}
