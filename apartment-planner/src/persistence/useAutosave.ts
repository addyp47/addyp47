import { useEffect } from 'react';
import { useEditor } from '../store/editor';
import { loadLastOpened, saveProject } from './storage';

/** Restore the last-opened layout on startup and autosave changes (debounced). */
export function useAutosave(delay = 600) {
  useEffect(() => {
    const last = loadLastOpened();
    if (last) {
      // Wait a frame so the canvas has measured its viewport before fitting.
      requestAnimationFrame(() => useEditor.getState().loadProject(last));
    }
    let timer: number | undefined;
    let lastError = '';
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.project === prev.project) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try {
          saveProject(useEditor.getState().project);
          lastError = '';
        } catch (e) {
          const msg = (e as Error).message;
          if (msg !== lastError) useEditor.getState().showToast(msg, 'error');
          lastError = msg;
        }
      }, delay);
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, [delay]);
}
