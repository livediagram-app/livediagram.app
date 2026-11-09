// The print frame (docs/specs/020-import-export/print.md "How it prints"): the print document in an off-screen,
// sandboxed iframe (no script runs in it), printed from its own window, so the editor's chrome never prints and the
// page's own @page rules size each sheet. One at a time: a second print replaces the first.
import { trustedHtml } from '@livedocuments/ui';

export const PRINT_FRAME_ATTR = 'data-print-frame';
// Removed after the print dialog closes, or after this where a browser never says it did.
export const PRINT_FRAME_CLEANUP_MS = 60_000;
// The longest the dialog waits for the sheets' fonts (the drawings fetch their faces): a slow or failed font prints
// in the fallback face after this rather than never printing.
export const PRINT_FONTS_WAIT_MS = 3_000;

// The frame's fonts loaded, or the wait run out: the sheets print in their own faces, as the PDF draws them.
function fontsSettled(win: Window): Promise<void> {
  const ready = (win.document as Document | undefined)?.fonts?.ready;
  if (!ready) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<void>((settle) => (timer = setTimeout(settle, PRINT_FONTS_WAIT_MS)));
  return Promise.race([
    ready.then(
      () => undefined,
      () => undefined,
    ),
    late,
  ]).finally(() => clearTimeout(timer));
}

/** Prints `html` (our own builder's markup, printDocumentHtml) from a print frame once it loads and its fonts have
 *  (fontsSettled); resolves once the print dialog has been asked for. */
export function printInFrame(html: string, doc: Document = document): Promise<void> {
  doc.querySelector(`iframe[${PRINT_FRAME_ATTR}]`)?.remove();
  const frame = doc.createElement('iframe');
  frame.setAttribute(PRINT_FRAME_ATTR, '');
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.title = 'Print';
  // Laid out but unseen: a frame that is display:none is not printed by every browser.
  frame.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;pointer-events:none';
  return new Promise<void>((resolve, reject) => {
    frame.addEventListener(
      'load',
      () => {
        const win = frame.contentWindow;
        if (!win) {
          frame.remove();
          reject(new Error('Printing is not available here.'));
          return;
        }
        const done = () => {
          clearTimeout(timer);
          frame.remove();
        };
        win.addEventListener('afterprint', done, { once: true });
        const timer = setTimeout(done, PRINT_FRAME_CLEANUP_MS);
        void fontsSettled(win).then(() => {
          // A second print replaced this one while its fonts loaded: only the newest prints.
          if (!frame.isConnected) {
            done();
            resolve();
            return;
          }
          try {
            win.focus();
            win.print();
            resolve();
          } catch (e) {
            done();
            // The dialog names a throw that is not an Error.
            reject(e);
          }
        });
      },
      { once: true },
    );
    // The document before the frame goes in: appended empty, it would load about:blank first and print that.
    frame.srcdoc = trustedHtml(html) as string;
    doc.body.appendChild(frame);
  });
}
