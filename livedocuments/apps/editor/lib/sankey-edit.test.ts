import { describe, expect, it } from 'vitest';
import { createShape } from '@livedocuments/document';
import { canEditSankey } from './sankey-edit';
import { resolveEditorCapabilities } from './editor-capabilities';

// Who may edit a Sankey (docs/specs/009-elements/sankey.md "Who may do what"): an Editor, on an unlocked diagram.
const sankey = createShape('sankey', 0, 0);
const can = (level: 'edit' | 'participate' | 'view') => resolveEditorCapabilities(level);

describe('canEditSankey', () => {
  it('lets an Editor edit an unlocked diagram', () => {
    expect(canEditSankey(can('edit'), sankey)).toBe(true);
  });

  it('never lets a Participant or a Viewer', () => {
    expect(canEditSankey(can('participate'), sankey)).toBe(false);
    expect(canEditSankey(can('view'), sankey)).toBe(false);
  });

  it('keeps a locked diagram shut even for an Editor', () => {
    expect(canEditSankey(can('edit'), { ...sankey, locked: true })).toBe(false);
  });
});
