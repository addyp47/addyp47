import { useState } from 'react';
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

type Tab = 'inspect' | 'rooms';

export function App() {
  useShortcuts();
  const [tab, setTab] = useState<Tab>('inspect');
  const toast = useEditor((s) => s.toast);

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
        </nav>
        {tab === 'inspect' && <Inspector />}
        {tab === 'rooms' && <RoomsPanel />}
      </aside>
      <CalibrateDialog />
      {toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}
    </div>
  );
}
