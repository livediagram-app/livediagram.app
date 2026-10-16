# Verify a tab's export

How to check what the Export dialog really produces for a tab (a new tab kind, a new element, a change to an image
renderer), in the browser, without saving files to the Downloads folder. Specs: [Plan tabs](../specs/026-plan/plan-tabs.md#export)
for Plan tabs, [Export fidelity](../specs/020-import-export/export-fidelity.md) for what an image draws.

1. Use the running dev server and a document of your own (never someone's real document). Make it from `/new`
   with a template that has the kind you are checking (Project Planner has Board tabs and a Dashboard; Start Planning
   on a new tab adds a Sheet tab from Budget).
2. Put real content in first: a couple of cards on a board, a template's sheet, a dashboard with views and notes.
   An empty board or view only proves the empty state.
3. Open the tab, then its tab menu (the ⋯ on its pill), then **Export**. Check the format cards against the kind's
   row in the spec's table: nothing missing, nothing extra.
4. Pick an image format. The preview is the same SVG the SVG download writes. To see it at full size, run in the page:

   ```js
   const s = [...document.querySelectorAll('[role=dialog] svg')].pop();
   const d = document.createElement('div');
   d.id = '__ov';
   d.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#888;overflow:auto';
   const c = s.cloneNode(true);
   c.setAttribute('width', '1300');
   c.removeAttribute('height');
   d.appendChild(c);
   document.body.appendChild(d);
   ```

   Screenshot it, scroll it, then remove `#__ov`. Read the root's `viewBox` for the image's size.

5. Look for: content drawn where the tab shows it (not the canvas hidden underneath), the right size, every slot or
   column present, text not overlapping, nothing left as a bare labelled box that the editor draws as a chart.
6. To check the real files (PNG and PDF rasterise per element, so they can differ from the SVG), capture the download
   instead of saving it. `downloadBlob` clicks a temporary link and revokes its URL after a second, so read the blob at
   once:

   ```js
   window.__dl = [];
   window.__origClick ??= HTMLAnchorElement.prototype.click;
   HTMLAnchorElement.prototype.click = function () {
     if (!this.download) return window.__origClick.call(this);
     const name = this.download;
     fetch(this.href)
       .then((r) => r.blob())
       .then((blob) => window.__dl.push({ name, blob, url: URL.createObjectURL(blob) }));
   };
   ```

   Press **Download PNG** (or SVG, PDF), then show `window.__dl.at(-1).url` in an `<img>` (PNG), read its text (SVG:
   `await blob.text()`), or read the header (PDF: its `MediaBox` is the page in points, 0.75 a CSS px). A PNG is twice
   the image's size.

7. For text formats, read the dialog's `textarea` value. A Dashboard's JSON should carry `kind: "dashboard"` and its
   `dashboard` rows; import it back (tab menu, **Import**) to prove the round trip.
8. Don't rasterise the live DOM to compare: a DOM-to-image capture of the editor froze the page for over 45 seconds and
   came out blank (slots animate in and lazy-mount). Compare the preview with a screenshot of the tab instead.
9. Reload the page when done, so the patched `click` is gone, and close your browser tab.
