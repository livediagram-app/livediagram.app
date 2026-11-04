// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createShape,
  OFFICE_TONES,
  ROOM_DOOR_WIDTH,
  STAGE_FRONT,
  type ShapeElement,
} from '@livehuddle/document';
import { FurnitureView, isFurnitureViewShape } from './FurnitureView';
import { RoomView } from './RoomView';
import { StageView } from './StageView';

afterEach(cleanup);

const shape = (kind: Parameters<typeof createShape>[0], over: Partial<ShapeElement> = {}) =>
  ({ ...createShape(kind, 0, 0), id: kind, ...over }) as ShapeElement;

// docs/specs/009-elements/office.md
describe('the office views', () => {
  it('draws every piece but the room and the stage from the furniture table', () => {
    for (const kind of [
      'meeting-table',
      'plant',
      'bookshelf',
      'water-cooler',
      'coffee-machine',
      'rug',
    ] as const) {
      expect(isFurnitureViewShape(kind)).toBe(true);
      const { container, unmount } = render(
        <FurnitureView element={shape(kind)} stroke="#94a3b8" sitters={[]} />,
      );
      expect(container.querySelector('svg')).not.toBeNull();
      unmount();
    }
    expect(isFurnitureViewShape('room')).toBe(false);
    expect(isFurnitureViewShape('stage')).toBe(false);
  });

  it('keeps a plant green whatever the theme', () => {
    const { container } = render(
      <FurnitureView element={shape('plant')} stroke="#64748b" sitters={[]} />,
    );
    expect(container.innerHTML).toContain(OFFICE_TONES.leaf);
  });

  it('lays a rug in its own fill', () => {
    const { container } = render(
      <FurnitureView element={shape('rug')} stroke="#64748b" fill="#bbf7d0" sitters={[]} />,
    );
    expect(container.innerHTML).toContain('#bbf7d0');
  });

  it('names who sits at a meeting table, without a ring round one chair', () => {
    const { container, getByText } = render(
      <FurnitureView
        element={shape('meeting-table')}
        stroke="#64748b"
        sitters={[{ name: 'Sam', color: '#8b5cf6' }]}
      />,
    );
    expect(getByText('Sam')).toBeTruthy();
    expect(container.querySelector('ellipse[stroke="#8b5cf6"]')).toBeNull();
  });

  it('draws a room at its own size, with a gap in the wall its doorway is in', () => {
    const room = shape('room', { width: 600, height: 400, roomDoor: 'n' });
    const { container } = render(<RoomView element={room} stroke="#64748b" floor="#f5f0e6" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 600 400');
    // The back wall comes in two runs either side of the doorway.
    const backTops = [...svg.querySelectorAll('rect')].filter(
      (r) => r.getAttribute('y') === '0' && r.getAttribute('height') === '10',
    );
    expect(backTops).toHaveLength(2);
    expect(
      Number(backTops[1]!.getAttribute('x')) - Number(backTops[0]!.getAttribute('width')),
    ).toBe(ROOM_DOOR_WIDTH);
    expect(svg.getAttribute('aria-label')).toBe('Room, Room');
  });

  // docs/specs/009-elements/office.md "Stage".
  it('draws a stage at its own size: its top in its fill, planks, a shaded front edge and a plate', () => {
    const stage = shape('stage', { width: 500, height: 150 });
    const { container } = render(<StageView element={stage} stroke="#64748b" floor="#fbf7ef" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 500 150');
    expect(svg.querySelectorAll('path')).toHaveLength(2);
    const face = [...svg.querySelectorAll('rect')].filter(
      (r) => r.getAttribute('y') === String(150 - STAGE_FRONT),
    );
    // The face and its shade.
    expect(face).toHaveLength(2);
    expect(svg.querySelector('rect')!.getAttribute('fill')).toBe('#fbf7ef');
    expect(svg.getAttribute('aria-label')).toBe('Stage, Stage');
    const unnamed = render(
      <StageView element={{ ...stage, label: '' }} stroke="#64748b" floor="#fbf7ef" />,
    );
    expect(unnamed.container.querySelector('svg')!.getAttribute('aria-label')).toBe('Stage');
  });
});
