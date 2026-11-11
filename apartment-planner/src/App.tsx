import { lazy, Suspense, useEffect, useState } from 'react';
import { PlanCanvas } from './components/plan/PlanCanvas';
import { Toolbar } from './components/Toolbar';
import { ToolPalette } from './components/ToolPalette';
import { BackgroundPanel } from './components/BackgroundPanel';
import { FurnitureLibrary } from './components/FurnitureLibrary';
import { Inspector } from './components/Inspector';
import { RoomsPanel } from './components/RoomsPanel';
import { CalibrateDialog } from './components/CalibrateDialog';
import { useShortcuts } from './components/useShortcuts';
import { useEditor } from './store/editor';
import { WarningsPanel } from './components/WarningsPanel';
import { StylePanel } from './components/StylePanel';

const PhotosPanel = lazy(() => import('./components/PhotosPanel').then((m) => ({ default: m.PhotosPanel })));
import { getWarnings } from './analysis/warnings';
import { useAutosave } from './persistence/useAutosave';
import { createDemoProject } from './demo/demoProject';

const View3D = lazy(() => import('./three/View3D'));

type Tab = 'inspect' | 'rooms' | 'style' | 'photos' | 'issues';

export function App() {
  useShortcuts();
  useAutosave();
  const [tab, setTab] = useState<Tab>('inspect');
  const toast = useEditor((s) => s.toast);
  const viewMode = useEditor((s) => s.viewMode);
  const isEmpty = useEditor((s) => s.tool === 'select' && !s.project.background && s.project.walls.length + s.project.rooms.length + s.project.furniture.length === 0);
  const selection = useEditor((s) => s.selection);
  const warningCount = useEditor((s) => getWarnings(s.project).length);

  useEffect(() => {
    if (selection) setTab((t) => (t === 'issues' || t === 'style' || t === 'photos' ? t : 'inspect'));
  }, [selection]);

  return (
    <div className="app">
      <Toolbar />
      <aside className="sidebar left">
        {viewMode === '2d' && <ToolPalette />}
        {viewMode === '2d' && <BackgroundPanel />}
        <FurnitureLibrary />
      </aside>
      <main className="canvas-area">
        {viewMode === '2d' && isEmpty && (
          <div className="empty-3d" style={{ zIndex: 2 }}>
            <b>Start with your apartment</b>
            <span>Import a LiDAR room scan, trace a floor plan with the tools on the left, or look around a sample first.</span>
            <button style={{ pointerEvents: 'auto' }} className="primary" onClick={() => useEditor.getState().loadProject(createDemoProject())}>
              Open the demo apartment
            </button>
          </div>
        )}
        {viewMode === '2d' ? (
          <PlanCanvas />
        ) : (
          <Suspense fallback={<div className="empty-3d">Loading 3D view…</div>}>
            <View3D />
          </Suspense>
        )}
      </main>
      <aside className="sidebar right">
        <nav className="tabs">
          <button className={tab === 'inspect' ? 'active' : ''} onClick={() => setTab('inspect')}>
            Inspect
          </button>
          <button className={tab === 'rooms' ? 'active' : ''} onClick={() => setTab('rooms')}>
            Rooms
          </button>
          <button className={tab === 'style' ? 'active' : ''} onClick={() => setTab('style')}>
            Style
          </button>
          <button className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>
            Photos
          </button>
          <button className={tab === 'issues' ? 'active' : ''} onClick={() => setTab('issues')}>
            Issues{warningCount > 0 && <span className="badge">{warningCount}</span>}
          </button>
        </nav>
        {tab === 'inspect' && <Inspector />}
        {tab === 'rooms' && <RoomsPanel />}
        {tab === 'style' && <StylePanel />}
        {tab === 'photos' && (
          <Suspense fallback={<div className="section muted">Loading…</div>}>
            <PhotosPanel />
          </Suspense>
        )}
        {tab === 'issues' && <WarningsPanel />}
      </aside>
      <CalibrateDialog />
      {toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}
    </div>
  );
}
