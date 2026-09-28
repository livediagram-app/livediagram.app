// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/diagram';
import { RailView } from './RailView';

// A rail's point labels (docs/specs/009-elements/timeline-rail.md) edit as a local draft committed on blur,
// and take a new value from outside (an undo, a peer) when one arrives.

const rail = (labels: string[]): ShapeElement => ({
  ...createShape('timeline-rail', 0, 0),
  railCount: labels.length,
  railLabels: labels,
});

function draw(labels: string[], onSetLabel = vi.fn()) {
  const view = (l: string[]) => (
    <RailView element={rail(l)} accent="#000" textColor="#000" editable onSetLabel={onSetLabel} />
  );
  const utils = render(view(labels));
  return { ...utils, redraw: (l: string[]) => utils.rerender(view(l)), onSetLabel };
}

const fields = () => screen.getAllByPlaceholderText('Label') as HTMLTextAreaElement[];

afterEach(cleanup);

describe('RailView labels', () => {
  it('keeps the draft while typing, and commits it on blur', () => {
    const { onSetLabel, redraw } = draw(['Kick-off', 'Launch']);
    fireEvent.change(fields()[0]!, { target: { value: 'Start' } });
    redraw(['Kick-off', 'Launch']);
    expect(fields()[0]!.value).toBe('Start');
    fireEvent.blur(fields()[0]!);
    expect(onSetLabel).toHaveBeenCalledWith(expect.any(String), 0, 'Start');
  });

  it('takes a new label from outside', () => {
    const { redraw } = draw(['Kick-off', 'Launch']);
    redraw(['Kick-off', 'Ship']);
    expect(fields().map((f) => f.value)).toEqual(['Kick-off', 'Ship']);
  });
});
