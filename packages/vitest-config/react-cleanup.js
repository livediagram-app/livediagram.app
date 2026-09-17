import { afterEach } from 'vitest';

// Unmount every tree React Testing Library rendered, after each test.
//
// RTL registers this itself, but only when a bare `afterEach` exists as a
// global — and `globals: false` in the base config deliberately denies it one
// (see index.js). Nothing warns about that: renders simply stay mounted for
// the life of the file.
//
// The bill arrives one file later. A worker tears jsdom down with a React root
// still live, moves on to the next test file (usually `environment: 'node'`,
// the default here), and a scheduler callback left over from the abandoned
// root runs against a world with no DOM:
//
//   ReferenceError: window is not defined
//     at performWorkOnRootViaSchedulerTask (react-dom-client.development.js)
//
// Vitest reports it as an unhandled error attributed to whichever file was
// unlucky enough to be running, which is never the file that caused it, and
// the run fails with every test green. It only shows up when a worker gets
// enough files to follow a leaky one with a DOM-less one, so it hides on
// developer machines with many cores and surfaces on CI.
//
// Registered for every environment, including `node`, hence the `document`
// guard and the deferred import: pulling RTL into a DOM-less file would throw
// at setup time.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
