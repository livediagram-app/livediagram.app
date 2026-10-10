// @vitest-environment jsdom

// The Decision record's drivers (docs/specs/012-collaboration/decision-record.md
// "The face"): a word wider than the row breaks rather than running out of the card.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShapeElement } from '@livediagram/document';
import { DecisionFace } from './DecisionFace';

afterEach(cleanup);

describe('DecisionFace', () => {
  it('lets a long driver break anywhere', () => {
    const url = 'https://example.com/a/very/long/path/that/has/no/spaces/at/all';
    render(
      <DecisionFace
        element={
          {
            id: 'd',
            type: 'shape',
            shape: 'decision',
            x: 0,
            y: 0,
            width: 320,
            height: 260,
            decisionDrivers: [url],
          } as ShapeElement
        }
        label="Use Postgres"
        textColor="#0f172a"
      />,
    );
    expect(screen.getByText(url).style.overflowWrap).toBe('anywhere');
  });
});
