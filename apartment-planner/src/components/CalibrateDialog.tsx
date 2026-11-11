import { useState } from 'react';
import { useEditor } from '../store/editor';
import { dist } from '../geometry/vec';
import { formatFtIn } from '../geometry/units';
import { scaleProject } from '../model/operations';

export function CalibrateDialog() {
  const calibration = useEditor((s) => s.calibration);
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  if (!calibration) return null;
  const measured = dist(calibration.a, calibration.b);
  const real = (parseFloat(ft) || 0) * 12 + (parseFloat(inch) || 0);

  const close = () => {
    useEditor.getState().setCalibration(null);
    setFt('');
    setInch('');
  };

  const apply = () => {
    if (real <= 0) return;
    const factor = real / measured;
    const { mutate, view, setView, setTool, showToast } = useEditor.getState();
    mutate((d) => scaleProject(d, factor));
    // Keep the plan visually in place: world coords grew by `factor`.
    setView({ ...view, scale: view.scale / factor });
    setTool('select');
    showToast(`Scale set: that line is now ${formatFtIn(real)}.`);
    close();
  };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <form
        className="modal"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <h2>Set scale</h2>
        <p className="muted">
          The line you drew is {formatFtIn(measured)} at the current scale. How long is it really? Everything on the plan is rescaled to match.
          Furniture keeps its real size.
        </p>
        <div className="row">
          <input autoFocus type="number" min={0} step="1" placeholder="ft" value={ft} onChange={(e) => setFt(e.target.value)} />
          <span>ft</span>
          <input type="number" min={0} step="0.5" placeholder="in" value={inch} onChange={(e) => setInch(e.target.value)} />
          <span>in</span>
        </div>
        <div className="actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={real <= 0}>
            Apply scale
          </button>
        </div>
      </form>
    </div>
  );
}
