// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ModifierHintBanner, selectedKindOf } from './ModifierHintBanner';

function holdShift(down: boolean) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: 'Shift' }));
  });
}

function show(props: Partial<Parameters<typeof ModifierHintBanner>[0]> = {}) {
  return render(
    <ModifierHintBanner
      drag={null}
      selectedKind={null}
      hasElements
      suppressed={false}
      {...props}
    />,
  );
}


afterEach(() => {
  // `globals: false` means no automatic RTL cleanup; without this every
  // render stacks up and the queries match the previous test's banner.
  cleanup();
  holdShift(false);
});

describe('ModifierHintBanner', () => {
  it('says nothing when no modifier is worth naming', () => {
    show();
    expect(screen.queryByText(/shift/i)).toBeNull();
  });

  it('names what Shift is doing while it is held', () => {
    show();
    holdShift(true);
    expect(screen.getByText(/click elements to select several/i)).toBeTruthy();
  });
});

describe('selectedKindOf', () => {
  const els = [
    { id: 'r', type: 'arrow' },
    { id: 't', type: 'table' },
    { id: 's', type: 'shape' },
  ] as unknown as Parameters<typeof selectedKindOf>[0];

  it('names the selected element’s flavour for the no-drag hints, or null', () => {
    expect(selectedKindOf(els, 'r')).toBe('arrow');
    expect(selectedKindOf(els, 't')).toBe('table');
    expect(selectedKindOf(els, 's')).toBe('other');
    expect(selectedKindOf(els, null)).toBeNull();
    expect(selectedKindOf(els, 'gone')).toBeNull();
  });
});
