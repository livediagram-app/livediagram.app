// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ModeButtonFace } from './ModeButtonFace';

afterEach(cleanup);

// docs/specs/009-elements/mode-button.md: in its own mode the button is the way out, and says so.
describe('ModeButtonFace', () => {
  it('shows its own label while it switches you in', () => {
    render(
      <ModeButtonFace
        mode="laser"
        label="Point It Out"
        activeMode="select"
        textColor="#0f172a"
        onPress={() => {}}
      />,
    );
    expect(screen.getByText('Point It Out')).toBeTruthy();
  });

  it('reads Leave once you are in its mode, whatever its own label', () => {
    render(
      <ModeButtonFace
        mode="laser"
        label="Point It Out"
        activeMode="laser"
        textColor="#0f172a"
        onPress={() => {}}
      />,
    );
    expect(screen.queryByText('Point It Out')).toBeNull();
    expect(screen.getByText('Leave')).toBeTruthy();
  });
});
