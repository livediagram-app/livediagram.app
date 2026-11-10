// @vitest-environment jsdom

// The quote's menu section (docs/specs/009-elements/quote.md "Editing the slots").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livedocuments/document';
import { QuoteMenuSection } from './QuoteMenuSection';
import type { ElementStyleOps } from '@/lib/element-style-ops';

afterEach(cleanup);

const quote = (over: Partial<ShapeElement> = {}) =>
  ({ ...createShape('quote', 0, 0), ...over }) as ShapeElement;

function show(target: ShapeElement, picker = true) {
  const ops: ElementStyleOps = {
    preview: vi.fn(),
    end: vi.fn(),
    commit: vi.fn(),
    burst: vi.fn(),
    commitTab: vi.fn(),
  };
  const onOpenPicker = vi.fn();
  const onRemovePhoto = vi.fn();
  render(
    <QuoteMenuSection
      target={target}
      ops={ops}
      sectionProps={() => ({ open: true, onToggle: () => {}, flush: true })}
      onOpenPicker={picker ? onOpenPicker : undefined}
      onRemovePhoto={picker ? onRemovePhoto : undefined}
    />,
  );
  const lastMap = () =>
    (ops.commit as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as (e: Element) => ShapeElement;
  return { ops, lastMap, onOpenPicker, onRemovePhoto };
}

describe('QuoteMenuSection', () => {
  it('switches the look to Plain, previewing on hover', () => {
    const { ops, lastMap } = show(quote());
    expect(screen.getByRole('button', { name: 'Card Look' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Plain Look' }), {
      pointerType: 'mouse',
    });
    expect(ops.preview).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Plain Look' }));
    expect(ops.commit).toHaveBeenCalledWith(expect.any(Function), 'QuoteLook');
    expect(lastMap()(quote()).quoteLook).toBe('plain');
  });

  it('turns the role off and the name back on', () => {
    const { lastMap } = show(quote());
    fireEvent.click(screen.getByRole('button', { name: /^Role/ }));
    expect('pageSubtitle' in lastMap()(quote())).toBe(false);
    cleanup();
    const second = show(quote({ pageTitle: undefined }));
    fireEvent.click(screen.getByRole('button', { name: /^Name/ }));
    expect(second.lastMap()(quote({ pageTitle: undefined })).pageTitle).toBe('Name');
  });

  it('picks no portrait, and asks the picker for a photo', () => {
    const target = quote();
    const { lastMap, onOpenPicker, ops } = show(target);
    fireEvent.click(screen.getByRole('button', { name: 'No Portrait' }));
    expect('cardMedia' in lastMap()(quote())).toBe(false);
    const commits = (ops.commit as ReturnType<typeof vi.fn>).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Photo Portrait' }));
    expect(onOpenPicker).toHaveBeenCalledWith(target.id);
    expect((ops.commit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(commits);
  });

  it('a quote with a photo offers Change Photo and Remove Photo', () => {
    const target = quote({ imageId: 'img-1' });
    const { onOpenPicker, onRemovePhoto } = show(target);
    fireEvent.click(screen.getByRole('button', { name: 'Change Photo' }));
    expect(onOpenPicker).toHaveBeenCalledWith(target.id);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Photo' }));
    expect(onRemovePhoto).toHaveBeenCalledWith(target.id);
  });

  it('without picture uploads there is no Photo choice', () => {
    show(quote(), false);
    expect(screen.queryByRole('button', { name: 'Photo Portrait' })).toBeNull();
  });
});
