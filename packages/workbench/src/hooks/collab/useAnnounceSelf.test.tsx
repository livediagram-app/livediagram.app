// @vitest-environment jsdom
// liveworkspace/docs/specs/003-accounts/accounts.md "Profiles", "A change reaches the room at once" (Work Tracker 1221).
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { announcedSelfKey, useAnnounceSelf, type AnnouncedSelf } from './useAnnounceSelf';

function mount(first: AnnouncedSelf) {
  const sent: AnnouncedSelf[] = [];
  const hook = renderHook(
    ({ self }: { self: AnnouncedSelf }) => useAnnounceSelf(self, () => sent.push(self)),
    { initialProps: { self: first } },
  );
  return { sent, rerender: (self: AnnouncedSelf) => hook.rerender({ self }) };
}

const ADA = { name: 'Ada', color: '#2563eb' };

describe('useAnnounceSelf', () => {
  it('says nothing on the first render: the hello says who this is', () => {
    const { sent } = mount(ADA);
    expect(sent).toEqual([]);
  });

  it('announces a new colour, name or picture once each, with this render’s self', () => {
    const { sent, rerender } = mount(ADA);
    rerender({ ...ADA, color: '#dc2626' });
    rerender({ ...ADA, color: '#dc2626' });
    rerender({ name: 'Ada L', color: '#dc2626' });
    rerender({ name: 'Ada L', color: '#dc2626', picture: 'https://lh3.googleusercontent.com/a' });
    expect(sent.map((s) => s.color)).toEqual(['#dc2626', '#dc2626', '#dc2626']);
    expect(sent.map((s) => s.name)).toEqual(['Ada', 'Ada L', 'Ada L']);
    expect(sent[2]?.picture).toBe('https://lh3.googleusercontent.com/a');
  });

  it('reads a missing picture and a null one as the same', () => {
    expect(announcedSelfKey(ADA)).toBe(announcedSelfKey({ ...ADA, picture: null }));
    const { sent, rerender } = mount(ADA);
    rerender({ ...ADA, picture: null });
    expect(sent).toEqual([]);
  });

  it('a new callback alone sends nothing', () => {
    const announce = vi.fn();
    const hook = renderHook(({ fn }: { fn: () => void }) => useAnnounceSelf(ADA, fn), {
      initialProps: { fn: announce },
    });
    hook.rerender({ fn: vi.fn() });
    expect(announce).not.toHaveBeenCalled();
  });
});
