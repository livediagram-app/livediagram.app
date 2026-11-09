import { afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { preloadExplorerPanes } from '../explorer/lazy-panes';

// The sections load from their own chunks in the app (explorer/lazy-panes.ts); a test has them in from the start,
// as the app has once it is idle, so a section draws in the commit that shows it.
beforeAll(() => preloadExplorerPanes());

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    // jsdom always has storage; a guard for other environments.
  }
});
