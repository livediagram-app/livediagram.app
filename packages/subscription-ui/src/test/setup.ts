import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setProForTests } from '../testing';

// Pro is on for every test unless the test turns it off: the build's own flag is off, as a self-hoster's is.
beforeEach(() => {
  setProForTests(true);
});

afterEach(() => {
  cleanup();
  setProForTests(null);
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // jsdom always has storage; a guard for other environments.
  }
});
