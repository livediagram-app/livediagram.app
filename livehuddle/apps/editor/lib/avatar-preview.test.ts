import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '@livehuddle/avatar/config';
import {
  clearAvatarPreview,
  getAvatarPreview,
  previewHandlers,
  previewView,
  setAvatarPreview,
  type AvatarPreview,
} from './avatar-preview';

afterEach(() => setAvatarPreview(null));

const coat: AvatarPreview = { kind: 'look', patch: { clothing: 'labcoat' }, label: 'Lab Coat' };

describe('previewView (docs/specs/008-canvas/avatar-mode.md "The preview, beside the flyout")', () => {
  it('is your own character at rest', () => {
    const v = previewView(null, DEFAULT_AVATAR_CONFIG, 'away');
    expect(v).toMatchObject({
      config: DEFAULT_AVATAR_CONFIG,
      status: 'away',
      behaviour: null,
      burst: null,
      title: 'Your Character',
      line: 'Point at an option to try it on.',
    });
  });

  it('wears a look over the current one, keeping the rest', () => {
    const v = previewView(coat, DEFAULT_AVATAR_CONFIG, null);
    expect(v.config).toEqual({ ...DEFAULT_AVATAR_CONFIG, clothing: 'labcoat' });
    expect(v.title).toBe('Lab Coat');
    expect(v.line).toBe('Click to wear it.');
  });

  it('shows a status, None included', () => {
    expect(
      previewView(
        { kind: 'status', status: 'focus', label: 'Focusing' },
        DEFAULT_AVATAR_CONFIG,
        null,
      ).status,
    ).toBe('focus');
    expect(
      previewView({ kind: 'status', status: null, label: 'None' }, DEFAULT_AVATAR_CONFIG, 'away')
        .status,
    ).toBeNull();
  });

  it('plays a Behaviour or a Reaction, the look unchanged', () => {
    const b = previewView(
      { kind: 'behaviour', id: 'wave', label: 'Wave' },
      DEFAULT_AVATAR_CONFIG,
      null,
    );
    expect(b).toMatchObject({ behaviour: 'wave', burst: null, config: DEFAULT_AVATAR_CONFIG });
    expect(b.line).toBe('Click to play it. Everyone sees it.');
    const r = previewView(
      { kind: 'reaction', id: 'hearts', label: 'Hearts' },
      DEFAULT_AVATAR_CONFIG,
      null,
    );
    expect(r).toMatchObject({ behaviour: null, burst: 'hearts', line: 'Click to throw it.' });
  });
});

describe('the preview store', () => {
  it('a leave clears only the option it left (the next one may already be shown)', () => {
    const hair: AvatarPreview = { kind: 'look', patch: { hair: 'afro' }, label: 'Afro' };
    setAvatarPreview(coat);
    setAvatarPreview(hair);
    clearAvatarPreview(coat);
    expect(getAvatarPreview()).toBe(hair);
    clearAvatarPreview(hair);
    expect(getAvatarPreview()).toBeNull();
  });

  it('pointing with a mouse or focusing shows it; a finger does not (its tap is a pick)', () => {
    const h = previewHandlers(coat);
    h.onPointerEnter({ pointerType: 'touch' });
    expect(getAvatarPreview()).toBeNull();
    h.onPointerEnter({ pointerType: 'mouse' });
    expect(getAvatarPreview()).toBe(coat);
    h.onPointerLeave();
    expect(getAvatarPreview()).toBeNull();
    h.onFocus();
    expect(getAvatarPreview()).toBe(coat);
    h.onBlur();
    expect(getAvatarPreview()).toBeNull();
  });

  it('keeps the option it holds when the same one is set again', () => {
    setAvatarPreview(coat);
    setAvatarPreview({ ...coat });
    expect(getAvatarPreview()).toBe(coat);
  });
});
