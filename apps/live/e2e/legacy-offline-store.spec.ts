import { test, expect, expectNoPageErrors } from './fixtures';

// A browser that saved offline documents before the container became a document holds them in
// version 1 of IndexedDB, in the `diagrams` object store (docs/specs/006-document/offline-mode.md,
// "Store rename"). Opening the app moves them to `documents` and they stay listed and openable.
test('offline documents saved before the rename survive the store upgrade', async ({ page, pageErrors }) => {
  await page.goto('/explorer/offline');
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase('livediagram-offline');
        del.onsuccess = () => {
          const req = indexedDB.open('livediagram-offline', 1);
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
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
  await page.reload();
  await expect(page.getByText('Kept through the rename').first()).toBeVisible();
  const stores = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const req = indexedDB.open('livediagram-offline');
        req.onsuccess = () => {
          resolve([...req.result.objectStoreNames]);
          req.result.close();
        };
      }),
  );
  expect(stores).toEqual(['documents']);
  expectNoPageErrors(pageErrors);
});
