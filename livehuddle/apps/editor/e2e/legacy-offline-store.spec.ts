import { adoptGuest, expect, expectNoPageErrors, mintGuest, test } from './fixtures';

// A browser that saved offline documents before the container became a document holds them in
// version 1 of IndexedDB, in the `diagrams` object store (docs/specs/006-document/offline-mode.md,
// "Store rename"). Opening the app moves them to `documents` and they stay listed and openable.
test('offline documents saved before the rename survive the store upgrade', async ({
  page,
  pageErrors,
}) => {
  // A guest, as the canvas page opens for one without leaving for the guest hand-off.
  await adoptGuest(page, await mintGuest(page.request));
  // Seed from a static file on the same origin: the app, once loaded, opens (and upgrades) the store
  // itself, and would race the seed between its delete and its version-1 open.
  await page.goto('/icon.svg');
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase('livehuddle-offline');
        del.onsuccess = () => {
          const req = indexedDB.open('livehuddle-offline', 1);
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
  // Opening the canvas upgrades the store and reads it whole (the offline id cache, once per page load), which
  // rebuilds This Browser's list (the Explorer's, in localStorage) with it. /new alone never reads the store: a
  // guest's wizard has no offline id to ask about.
  await page.goto('/document/offline-legacy-1');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('liveworkspace:this-browser:livehuddle') ?? ''),
    )
    .toContain('Kept through the rename');
  const stores = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const req = indexedDB.open('livehuddle-offline');
        req.onsuccess = () => {
          resolve([...req.result.objectStoreNames]);
          req.result.close();
        };
      }),
  );
  // `diagrams` is gone; version 3's `retired-parts` sits beside `documents` (offline-mode.md "Retired parts set aside").
  expect([...stores].sort()).toEqual(['documents', 'retired-parts']);
  expectNoPageErrors(pageErrors);
});
