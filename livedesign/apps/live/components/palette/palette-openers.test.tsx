// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const ensure = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('@liveworkspace/workbench/lib/icon-registry', async (real) => ({
  ...(await real<typeof import('@liveworkspace/workbench/lib/icon-registry')>()),
  ensureIconCatalogs: ensure,
}));

import { openerById } from './palette-openers';

// docs/specs/007-editor/toolbar-layout.md "A tile's side panel": a catalogue group's opener draws that group's artwork,
// so it must fetch the catalogues itself rather than rely on the editor's one prefetch (a failed prefetch left the
// AWS opener blank).
describe('openerById', () => {
  it('starts the catalogue load when a group opener draws', () => {
    render(<>{openerById('open:technology/aws')!.icon}</>);
    expect(ensure).toHaveBeenCalled();
  });

  it('is undefined for a tile id', () => {
    expect(openerById('rect')).toBeUndefined();
  });
});
