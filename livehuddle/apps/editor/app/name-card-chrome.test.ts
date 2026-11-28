// Work Tracker 1522: a guest's Change Name opens the name card over the canvas and nothing more. The card's state
// (`identityOnlyScreenOpen`, and `anyWelcomeOpen`, which only holds the tours) gates none of the chrome: the header's
// Share and Make a Copy, the tab bar, and the canvas's floating chrome (its `chromeHidden`). This reads the files
// that draw them, since the space's view has no render harness of its own.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe("a guest's name card", () => {
  it('hides none of the chrome', () => {
    for (const path of [
      'app/document/[id]/EditorView.tsx',
      'components/canvas/CanvasChrome.tsx',
      'components/canvas/Canvas.types.ts',
      'components/canvas/EditorCanvasHost.tsx',
    ]) {
      expect(read(path), path).not.toMatch(/\bwelcomeOpen\b|anyWelcomeOpen/);
    }
  });

  it('still holds the tours while it is open', () => {
    expect(read('app/document/[id]/editor-state/useEditorDialogs.ts')).toContain(
      'const anyWelcomeOpen = identityOnlyScreenOpen;',
    );
    expect(read('components/tour/ElementTourHost.tsx')).toContain('!ctx.anyWelcomeOpen');
  });

  it('keeps the canvas host drawn for the card on a connected tab', () => {
    expect(read('app/document/[id]/EditorView.tsx')).toContain(
      'ctx.activeTabConnected && !ctx.identityOnlyScreenOpen',
    );
  });
});
