import { describe, expect, it } from 'vitest';
import { actionNoteOpens } from './action-note-open';

describe('actionNoteOpens', () => {
  it('opens an assigned action for anyone, and the Assign Action dialog for an Editor alone', () => {
    expect(actionNoteOpens(true, false)).toBe('popover');
    expect(actionNoteOpens(true, true)).toBe('popover');
    expect(actionNoteOpens(false, false)).toBe('assign');
    expect(actionNoteOpens(false, true)).toBeNull();
  });
});
