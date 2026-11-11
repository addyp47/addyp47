import { useEffect } from 'react';
import { useEditor } from '../store/editor';
import { TOOLS } from './ToolPalette';
import { deleteSelection } from '../model/operations';
import { newId } from '../model/defaults';

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]')) return;
      const s = useEditor.getState();
      if (s.calibration) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }

      const sel = s.selection;
      if (sel && (e.key === 'Delete' || e.key === 'Backspace') && s.tool === 'select') {
        e.preventDefault();
        s.mutate((d) => deleteSelection(d, sel));
        s.select(null);
        return;
      }
      if (e.key === 'Escape' && s.tool === 'select') {
        s.select(null);
        return;
      }

      if (sel?.kind === 'furniture') {
        const nudge = e.shiftKey ? 6 : 1;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-nudge, 0],
          ArrowRight: [nudge, 0],
          ArrowUp: [0, -nudge],
          ArrowDown: [0, nudge],
        };
        if (moves[e.key]) {
          e.preventDefault();
          const [dx, dy] = moves[e.key];
          s.mutate((d) => {
            const f = d.furniture.find((x) => x.id === sel.id);
            if (f) {
              f.x += dx;
              f.y += dy;
            }
          });
          return;
        }
        if (!mod && key === 'r') {
          s.mutate((d) => {
            const f = d.furniture.find((x) => x.id === sel.id);
            if (f) f.rotation = (f.rotation + (e.shiftKey ? 270 : 90)) % 360;
          });
          return;
        }
        if (mod && key === 'd') {
          e.preventDefault();
          const id = newId('furn');
          s.mutate((d) => {
            const f = d.furniture.find((x) => x.id === sel.id);
            if (f) d.furniture.push({ ...f, id, x: f.x + 12, y: f.y + 12 });
          });
          s.select({ kind: 'furniture', id });
          return;
        }
      }

      if (!mod && !e.altKey) {
        const t = TOOLS.find((x) => x.key.toLowerCase() === key);
        if (t) s.setTool(t.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
