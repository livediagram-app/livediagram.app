import { describe, expect, it } from 'vitest';
import { paneCreateMode } from './pane-create-action';

describe('paneCreateMode', () => {
  it('groups both actions behind the compact Create dropdown', () => {
    // A folder is the one place both verbs apply, and it's also where the
    // title is longest — the dropdown exists to keep that title roomy.
    expect(paneCreateMode({ hasCreateDesign: true, hasCreateFolder: true })).toEqual({
      kind: 'menu',
    });
  });

  it('renders a lone action directly rather than hiding it in a menu', () => {
    // Timeline and Recent offer only New Design; a one-tile dropdown would
    // cost a click and drop the word "design" from the button.
    expect(paneCreateMode({ hasCreateDesign: true, hasCreateFolder: false })).toEqual({
      kind: 'single',
      action: 'design',
    });
    expect(paneCreateMode({ hasCreateDesign: false, hasCreateFolder: true })).toEqual({
      kind: 'single',
      action: 'folder',
    });
  });

  it('renders nothing for the read-only sections', () => {
    // Shared / Gallery / Themes / Tokens / Profile pass neither verb.
    expect(paneCreateMode({ hasCreateDesign: false, hasCreateFolder: false })).toEqual({
      kind: 'none',
    });
  });
});
