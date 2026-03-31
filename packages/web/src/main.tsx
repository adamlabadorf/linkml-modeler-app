import React from 'react';
import { createRoot } from 'react-dom/client';
import { PlatformContext, StubWebPlatform } from '@linkml-editor/core';

// Placeholder App component — full UI implemented in later milestones
function App() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <div>
        <h1>LinkML Visual Schema Editor</h1>
        <p>Loading&hellip; (canvas coming in M3)</p>
      </div>
    </div>
  );
}

const platform = new StubWebPlatform();
const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <PlatformContext.Provider value={platform}>
      <App />
    </PlatformContext.Provider>
  </React.StrictMode>
);
