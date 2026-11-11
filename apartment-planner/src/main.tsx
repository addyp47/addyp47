import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Handy for debugging in the browser console (dev builds only).
if (import.meta.env.DEV) {
  import('./store/editor').then(({ useEditor }) => {
    (window as unknown as { __editor: typeof useEditor }).__editor = useEditor;
  });
}
