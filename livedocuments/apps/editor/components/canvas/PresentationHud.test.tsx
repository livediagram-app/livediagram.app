// @vitest-environment jsdom
// The presenting HUD is a named landmark, so its slide counter and name sit inside one
// (docs/specs/012-collaboration/presentation-mode.md).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PresentationHud } from './PresentationHud';

describe('PresentationHud', () => {
  it('is a landmark named for the controls, holding the counter and the slide name', () => {
    render(
      <PresentationHud
        position={1}
        total={6}
        name="Customer Support, Q3"
        slideId="s1"
        cards={[]}
        cardAt={0}
        onCard={() => {}}
        notesOpen={false}
        onToggleNotes={() => {}}
        settingsOpen={false}
        onToggleSettings={() => {}}
        showPosition
        slides={[]}
        jumpOpen={false}
        onToggleJump={() => {}}
        onJump={() => {}}
        elapsedMs={null}
        budget={null}
        onNext={() => {}}
        onClose={() => {}}
        hidden={false}
      />,
    );
    const region = screen.getByRole('region', { name: 'Presentation controls' });
    expect(region.textContent).toContain('1 / 6');
    expect(region.textContent).toContain('Customer Support, Q3');
  });
});
