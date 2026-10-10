// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { EntityView } from './EntityView';

describe('EntityView', () => {
  it('caps a long type at half the row so the field name keeps its room', () => {
    const element = {
      ...(createShape('entity', 0, 0) as ShapeElement),
      entityFields: [{ name: 'created_at_utc', type: 'TIMESTAMP WITH TIME ZONE' }],
    } as ShapeElement;
    render(<EntityView element={element} textColor="#000" fontFamily={undefined} />);
    const type = screen.getByText('TIMESTAMP WITH TIME ZONE');
    expect(type.className).toContain('max-w-[50%]');
    expect(type.className).not.toContain('shrink-0');
    expect(screen.getByText('created_at_utc').className).toContain('min-w-0');
  });
});
