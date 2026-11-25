// The selection menu's Cut, Copy and Paste (liveworkspace/docs/specs/004-index/send-to-plan.md "The selection menu"):
// each does what its key does. Copy and Cut run the browser's own command on the words picked, so the writing's own
// copy handler fills the clipboard (rich and plain), and fall back to the words as plain text where the browser
// refuses. Paste reads the clipboard (the browser may ask first) and hands it to the writing's own paste, with a paste
// event carrying it, so every paste rule (tables, Markdown, whole blocks) runs as it does for Cmd/Ctrl+V.

/** Where Paste lands: a ProseMirror view, as read here. */
export type PasteTarget = {
  readonly isDestroyed: boolean;
  focus(): void;
  pasteHTML(html: string, event?: ClipboardEvent): boolean;
  pasteText(text: string, event?: ClipboardEvent): boolean;
};

/** Runs the browser's own copy or cut on the selection; false where it refused or has none. */
export function runClipboardCommand(kind: 'copy' | 'cut'): boolean {
  try {
    return typeof document.execCommand === 'function' && document.execCommand(kind);
  } catch {
    return false;
  }
}

/** Puts words on the clipboard as plain text; false where the browser refused. */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Whether this browser lets a page read the clipboard at all (Paste is greyed where it doesn't). */
export function canReadClipboard(): boolean {
  const clip = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  return !!clip && (typeof clip.read === 'function' || typeof clip.readText === 'function');
}

type Clip = { html: string; text: string };

// What the clipboard holds: rich and plain where the browser reads both, else plain; null where it refused.
async function readClipboard(): Promise<Clip | null> {
  const clip = navigator.clipboard;
  if (typeof clip.read === 'function') {
    try {
      const out: Clip = { html: '', text: '' };
      for (const item of await clip.read()) {
        if (!out.html && item.types.includes('text/html'))
          out.html = await (await item.getType('text/html')).text();
        if (!out.text && item.types.includes('text/plain'))
          out.text = await (await item.getType('text/plain')).text();
      }
      return out;
    } catch {
      // Refused, or no rich read here (Firefox before 127): the plain read below.
    }
  }
  try {
    return { html: '', text: await clip.readText() };
  } catch {
    return null;
  }
}

// A paste event holding the clipboard's words, as Cmd/Ctrl+V's would, for the writing's paste rules to read.
function pasteEvent(clip: Clip): ClipboardEvent | undefined {
  try {
    const data = new DataTransfer();
    if (clip.html) data.setData('text/html', clip.html);
    if (clip.text) data.setData('text/plain', clip.text);
    return new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
  } catch {
    return undefined;
  }
}

/** Pastes the clipboard into the writing over its selection; false where there was nothing to paste or it refused. */
export async function pasteClipboard(target: PasteTarget): Promise<boolean> {
  if (!canReadClipboard()) return false;
  // The caret back in the writing, on the words picked, before the read: the browser's prompt waits on it.
  target.focus();
  const clip = await readClipboard();
  if (!clip || target.isDestroyed || (!clip.html && !clip.text)) return false;
  const event = pasteEvent(clip);
  return clip.html ? target.pasteHTML(clip.html, event) : target.pasteText(clip.text, event);
}
