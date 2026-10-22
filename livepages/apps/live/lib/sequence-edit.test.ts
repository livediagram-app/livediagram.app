import { describe, expect, it } from 'vitest';
import { createShape } from '@livepages/document';
import { canEditSequence } from './sequence-edit';
import { resolveEditorCapabilities } from './editor-capabilities';

// Who may edit a sequence diagram (docs/specs/009-elements/sequence-diagram.md "Share roles"): an Editor, on an
// unlocked diagram; a Participant and a Viewer look.
const seq = createShape('sequence', 0, 0);
const can = (level: 'edit' | 'participate' | 'view') =>
  resolveEditorCapabilities({ level, adderKey: 'key' });

describe('canEditSequence', () => {
  it('lets an Editor edit an unlocked diagram', () => {
    expect(canEditSequence(can('edit'), seq)).toBe(true);
  });

  it('never lets a Participant or a Viewer', () => {
    expect(canEditSequence(can('participate'), seq)).toBe(false);
    expect(canEditSequence(can('view'), seq)).toBe(false);
  });

  it('keeps a locked diagram shut even for an Editor', () => {
    expect(canEditSequence(can('edit'), { ...seq, locked: true })).toBe(false);
  });
});
