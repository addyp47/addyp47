import { useEffect, useState } from 'react';
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
import { getWarnings } from './analysis/warnings';

type Tab = 'inspect' | 'rooms' | 'style' | 'issues';

export function App() {
  useShortcuts();
  const [tab, setTab] = useState<Tab>('inspect');
  const toast = useEditor((s) => s.toast);
  const selection = useEditor((s) => s.selection);
  const warningCount = useEditor((s) => getWarnings(s.project).length);

  useEffect(() => {
    if (selection) setTab((t) => (t === 'issues' || t === 'style' ? t : 'inspect'));
  }, [selection]);

  return (
    <div className="app">
      <Toolbar />
      <aside className="sidebar left">
        <ToolPalette />
        <BackgroundPanel />
        <FurnitureLibrary />
      </aside>
      <main className="canvas-area">
        <PlanCanvas />
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
          <button className={tab === 'issues' ? 'active' : ''} onClick={() => setTab('issues')}>
            Issues{warningCount > 0 && <span className="badge">{warningCount}</span>}
          </button>
        </nav>
        {tab === 'inspect' && <Inspector />}
        {tab === 'rooms' && <RoomsPanel />}
        {tab === 'style' && <StylePanel />}
        {tab === 'issues' && <WarningsPanel />}
      </aside>
      <CalibrateDialog />
      {toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}
    </div>
  );
}
