import { test, expect, expectNoPageErrors } from './fixtures';

// A browser that saved offline designs before the container became a design holds them in
// version 1 of IndexedDB, in the `diagrams` object store (docs/specs/006-design/offline-mode.md,
// "Store rename"). Opening the app moves them to `designs` and they stay listed and openable.
test('offline designs saved before the rename survive the store upgrade', async ({
  page,
  pageErrors,
}) => {
  // Seed from a static file on the same origin: the app, once loaded, opens (and upgrades) the store
  // itself, and would race the seed between its delete and its version-1 open.
  await page.goto('/icon.svg');
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase('livedesign-offline');
        del.onsuccess = () => {
          const req = indexedDB.open('livedesign-offline', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('diagrams', { keyPath: 'id' });
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('diagrams', 'readwrite');
            tx.objectStore('diagrams').put({
              id: 'offline-legacy-1',
              name: 'Kept through the rename',
              folderId: null,
              createdAt: Date.now(),
              savedAt: Date.now(),
              tabs: [{ id: 't1', name: 'Tab 1', kind: 'diagram', elements: [] }],
            });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
          };
          req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
        };
      }),
  );
  // Openable: the editor opens the store (version 2, which runs the upgrade) and the design from it.
  await page.goto('/design/offline-legacy-1');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await expect(page.getByText('Kept through the rename').first()).toBeVisible();
  const stores = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const req = indexedDB.open('livedesign-offline');
        req.onsuccess = () => {
          resolve([...req.result.objectStoreNames]);
          req.result.close();
        };
      }),
  );
  expect(stores).toEqual(['designs']);
  // Listed: This Browser in the Explorer (liveworkspace's, on this origin) reads the list the editor rebuilt from the
  // store as it opened (lib/offline/offline-ids.ts).
  await page.goto('/explorer/offline');
  await expect(page.locator('[data-this-browser-row="offline-legacy-1"]')).toContainText(
    'Kept through the rename',
  );
  expectNoPageErrors(pageErrors);
});
