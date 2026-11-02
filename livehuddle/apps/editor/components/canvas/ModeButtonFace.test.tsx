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
        mode="avatar"
        label="Walk In"
        activeMode="select"
        textColor="#0f172a"
        onPress={() => {}}
      />,
    );
    expect(screen.getByText('Walk In')).toBeTruthy();
  });

  it('reads Leave once you are in its mode, whatever its own label', () => {
    render(
      <ModeButtonFace
        mode="avatar"
        label="Walk In"
        activeMode="avatar"
        textColor="#0f172a"
        onPress={() => {}}
      />,
    );
    expect(screen.queryByText('Walk In')).toBeNull();
    expect(screen.getByText('Leave')).toBeTruthy();
  });
});
