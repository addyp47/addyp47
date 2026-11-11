import { PlanCanvas } from './components/plan/PlanCanvas';
import { useEditor } from './store/editor';

export function App() {
  const name = useEditor((s) => s.project.name);
  return (
    <div className="app">
      <header className="toolbar">
        <strong className="brand">Apartment Planner</strong>
        <span className="muted">{name}</span>
      </header>
      <aside className="sidebar left" />
      <main className="canvas-area">
        <PlanCanvas />
      </main>
      <aside className="sidebar right" />
    </div>
  );
}
