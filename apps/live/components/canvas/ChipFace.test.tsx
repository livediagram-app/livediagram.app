// @vitest-environment jsdom

// A badge or step number on the canvas (docs/specs/009-elements/badge.md): its pill in its look, its label on it.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { ChipFace } from './ChipFace';

afterEach(cleanup);

const show = (over: Partial<ShapeElement>) => {
  const element = { ...createShape('badge', 0, 0), ...over };
  const { container } = render(
    <ChipFace
      element={element}
      labelNode={<span>Beta</span>}
      accent="rgb(37, 99, 235)"
      fill="rgb(255, 255, 255)"
      ink="rgb(15, 23, 42)"
    />,
  );
  return container.querySelector('[data-chip-look]') as HTMLElement;
};

describe('ChipFace', () => {
  it('fills a Solid badge with the accent and writes its label on it', () => {
    const pill = show({});
    expect(pill.dataset.chipLook).toBe('solid');
    expect(pill.style.backgroundColor).toBe('rgb(37, 99, 235)');
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('draws an Outline badge on the surface with an accent ring', () => {
    const pill = show({ chipLook: 'outline' });
    expect(pill.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(pill.style.boxShadow).toContain('rgb(37, 99, 235)');
  });
});
