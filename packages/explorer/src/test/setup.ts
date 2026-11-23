import { afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { preloadExplorerDialogs } from '../explorer/lazy-dialogs';
import { preloadExplorerPanes } from '../explorer/lazy-panes';

// The sections and the dialogs load from their own chunks in the app (explorer/lazy-panes.ts, lazy-dialogs.ts); a
// test has them in from the start, as the app has once it is idle, so a section or dialog draws in the commit that
// shows it.
beforeAll(() => Promise.all([preloadExplorerPanes(), preloadExplorerDialogs()]));

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    // jsdom always has storage; a guard for other environments.
  }
});
