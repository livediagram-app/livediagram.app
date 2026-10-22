import { describe, expect, it } from 'vitest';
import { createMask } from '@livedesign/photo-engine';
import { getAnnouncementSnapshot } from '../announcer';
import { harness, photoOf, pixelLayer } from './photo-test-utils';
import { announceCommit, selectionWords, watchSelection } from './photo-announce';

// docs/specs/031-photo/photo-tools.md "Accessibility": edits and the selection said through the live region.
const said = () => getAnnouncementSnapshot().message;

describe('what a photo page says', () => {
  it('names an edit, a stroke with the layer it landed on', () => {
    const h = harness(photoOf(8, 8, [pixelLayer('a', { name: 'Layer 2' })]));
    h.s.choose('a', 'layer');
    announceCommit('Brush', h.s);
    expect(said()).toBe('Brush on Layer 2');
    announceCommit('New Layer', h.s);
    expect(said()).toBe('New Layer');
  });

  it('says the selection’s size as it changes, and Deselected', () => {
    expect(selectionWords(createMask({ x: 0, y: 0, width: 640, height: 480 }, 255))).toBe(
      'Selection: 640 by 480',
    );
    const h = harness(photoOf(8, 8));
    const off = watchSelection(h.s);
    h.s.selection = createMask({ x: 1, y: 1, width: 3, height: 2 }, 255);
    h.s.changed();
    expect(said()).toBe('Selection: 3 by 2');
    const nonce = getAnnouncementSnapshot().nonce;
    h.s.changed();
    expect(getAnnouncementSnapshot().nonce).toBe(nonce);
    h.s.selection = null;
    h.s.changed();
    expect(said()).toBe('Deselected');
    off();
  });
});
