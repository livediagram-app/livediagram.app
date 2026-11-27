import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// liveworkspace/docs/specs/022-interface-design/close-button.md: every modal and drawer header closes with the one
// DialogCloseButton (the Apps drawer's circled X). This finds a file that draws a modal or a drawer (a Dialog, a
// dialog header, the phone drawer, a sheet, an aria-modal panel) and also types its own close (a button named
// "Close" or "Close <something>"), in every app's and package's source, so a new header mounts the shared one.

const ROOT = join(__dirname, '..', '..', '..', '..');
const SCANNED = [
  'packages',
  'liveworkspace/apps',
  ...[
    'livediagram',
    'liveplanner',
    'livedocuments',
    'livedesign',
    'livehuddle',
    'liveknowledge',
  ].map((p) => `${p}/apps`),
];
const SKIP_DIR = new Set(['node_modules', '.next', '.next-dev', 'out', 'dist', '.wrangler', 'e2e']);

// A modal, a sheet or a drawer drawn in this file: the shared shells, aria-modal, or the hooks a hand-built one holds
// the canvas still and rises from the bottom with. A popover (role="dialog" alone, anchored to what opened it: a
// comment thread, an action, a card on the canvas) is not one, and keeps its own small close.
const MODAL =
  /<(?:Dialog|HeroDialogHeader|DialogHeader|PhoneDrawer|BottomSheet|SheetHandle)\b|aria-modal|\buse(?:ModalGuard|Sheet)\(/;
// A close typed by hand: a name of "Close" or "Close <what>".
const OWN_CLOSE = /aria-label=(?:"Close(?: [^"]*)?"|\{`Close[^`]*`\})/g;

// Files that draw a modal and keep a close of their own that is not the header's, each with why.
const ALLOWED: Readonly<Record<string, string>> = {
  'livediagram/apps/editor/components/panels/SearchPanel.tsx':
    'the search field’s Esc key, inside the field’s row, not a header',
  'livedesign/apps/live/components/panels/SearchPanel.tsx':
    'the search field’s Esc key, inside the field’s row, not a header',
  'livedocuments/apps/editor/components/panels/SearchPanel.tsx':
    'the search field’s Esc key, inside the field’s row, not a header',
  'livehuddle/apps/editor/components/panels/SearchPanel.tsx':
    'the search field’s Esc key, inside the field’s row, not a header',
  'liveknowledge/apps/editor/components/panels/SearchPanel.tsx':
    'the search field’s Esc key, inside the field’s row, not a header',
  'liveplanner/apps/editor/components/panels/SearchPanel.tsx':
    'the search field’s Esc key, inside the field’s row, not a header',
  'packages/explorer/src/search/SearchPanel.tsx':
    'the search field’s Esc key, inside the field’s row, not a header',
  'livehuddle/apps/editor/components/canvas/collab/ReaderShell.tsx':
    'the dim backdrop, a press target out of the tab order, not a button in the header',
  'liveplanner/apps/editor/components/plan/gallery/GalleryFrame.tsx':
    'Add a Widget’s popover header beside its search; in a dialog the frame wears the hero header and its close',
  'liveknowledge/apps/editor/components/knowledge/PageRail.tsx':
    'Page Info: a popover card under its button on a desktop; on a phone the shared sheet, which has no X',
};

function* sources(dir: string): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIR.has(e.name)) yield* sources(join(dir, e.name));
    } else if (e.name.endsWith('.tsx') && !e.name.includes('.test.')) yield join(dir, e.name);
  }
}

function ownCloses(text: string): number {
  return MODAL.test(text) ? (text.match(OWN_CLOSE) ?? []).length : 0;
}

describe('the close button', () => {
  it('every modal and drawer header closes with DialogCloseButton, not a close of its own', () => {
    const found: string[] = [];
    for (const top of SCANNED) {
      for (const file of sources(join(ROOT, top))) {
        const path = relative(ROOT, file);
        if (path in ALLOWED || path === 'packages/ui/src/dialog/DialogCloseButton.tsx') continue;
        const text = readFileSync(file, 'utf8');
        if (ownCloses(text)) found.push(path);
      }
    }
    expect(found).toEqual([]);
  });

  it('every allowed file still has what it is allowed for', () => {
    const stale = Object.keys(ALLOWED).filter((path) => {
      try {
        return ownCloses(readFileSync(join(ROOT, path), 'utf8')) === 0;
      } catch {
        return true;
      }
    });
    expect(stale).toEqual([]);
  });

  it('finds a hand-typed close in a dialog, and leaves one outside a dialog alone', () => {
    expect(
      ownCloses('<Dialog open><button aria-label="Close" onClick={x}>×</button></Dialog>'),
    ).toBe(1);
    expect(ownCloses('<PhoneDrawer>{<button aria-label={`Close ${title}`} />}</PhoneDrawer>')).toBe(
      1,
    );
    expect(
      ownCloses('<div aria-modal="true"><button aria-label="Close Version History" /></div>'),
    ).toBe(1);
    expect(ownCloses('<div role="dialog"><button aria-label="Close comments" /></div>')).toBe(0);
    expect(ownCloses('<Dialog open><DialogCloseButton onClick={x} /></Dialog>')).toBe(0);
    expect(ownCloses('<div><button aria-label="Close" /></div>')).toBe(0);
    expect(ownCloses('<Dialog open><button aria-label="Closed door" /></Dialog>')).toBe(0);
  });
});
