// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RemoteSelectorsStrip, remoteSelectorCopy } from '@/components/canvas/element-badges';

// docs/specs/007-editor/editor-app.md "Concurrent-selection lock": each disc takes the pointer so its hover card can
// open, and a Viewer's disc never claims a lock.
describe('RemoteSelectorsStrip', () => {
  const jae = { id: 'p1', name: 'Jae', color: '#8b5cf6' };

  it('lets each disc take the pointer inside a pass-through strip', () => {
    const { getByLabelText } = render(
      <RemoteSelectorsStrip selectors={[{ ...jae, holds: true }]} />,
    );
    const disc = getByLabelText('Locked to Jae');
    expect(disc.closest('.pointer-events-auto')).not.toBeNull();
    expect(disc.closest('.pointer-events-none')).not.toBeNull();
  });

  it("names a Viewer's selection without claiming a lock", () => {
    const { getByLabelText, queryByLabelText } = render(
      <RemoteSelectorsStrip selectors={[{ ...jae, holds: false }]} />,
    );
    expect(getByLabelText('Selected by Jae')).toBeTruthy();
    expect(queryByLabelText('Locked to Jae')).toBeNull();
  });
});

describe('remoteSelectorCopy', () => {
  it('says the element is locked for a holder', () => {
    expect(remoteSelectorCopy({ name: 'Ava', holds: true })).toEqual({
      title: 'Locked to Ava',
      description: "Selected by them; you can't edit it right now.",
    });
  });

  it('says a Viewer is only looking', () => {
    expect(remoteSelectorCopy({ name: 'Ava', holds: false }).title).toBe('Selected by Ava');
  });
});
