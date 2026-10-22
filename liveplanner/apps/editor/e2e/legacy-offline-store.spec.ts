import { test, expect, expectNoPageErrors } from './fixtures';

// A browser that saved offline projects before the container became a project holds them in
// version 1 of IndexedDB, in the `diagrams` object store (docs/specs/006-project/offline-mode.md,
// "Store rename"). Opening the app moves them to `projects` and they stay listed and openable.
test('offline projects saved before the rename survive the store upgrade', async ({
  page,
  pageErrors,
}) => {
  // Seed from a static file on the same origin: the app, once loaded, opens (and upgrades) the store
  // itself, and would race the seed between its delete and its version-1 open.
  await page.goto('/icon.svg');
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase('liveplanner-offline');
        del.onsuccess = () => {
          const req = indexedDB.open('liveplanner-offline', 1);
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
  await page.goto('/explorer/offline');
  await expect(page.getByText('Kept through the rename').first()).toBeVisible();
  const stores = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const req = indexedDB.open('liveplanner-offline');
        req.onsuccess = () => {
          resolve([...req.result.objectStoreNames]);
          req.result.close();
        };
      }),
  );
  expect(stores).toEqual(['projects']);
  expectNoPageErrors(pageErrors);
});
