// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planPalette } from '../plan-palette';
import { ViewStepButton } from './view-frame';

// docs/specs/026-plan/plan-views.md "Scale": a view's header controls scroll sideways in a narrow header, so each
// keeps its own width there rather than shrinking under its words.
afterEach(cleanup);

describe('ViewStepButton', () => {
  it('keeps its width and its words on one line in a narrow header', () => {
    render(
      <ViewStepButton label="Today" onPress={vi.fn()} palette={planPalette('light', {})}>
        Today
      </ViewStepButton>,
    );
    const classes = screen.getByRole('button', { name: 'Today' }).className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['shrink-0', 'whitespace-nowrap']));
  });
});
