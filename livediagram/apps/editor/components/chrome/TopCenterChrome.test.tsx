// @vitest-environment jsdom

// The top-centre stack's start (docs/specs/007-editor/toolbar-layout.md "Layout details"): under the strip, and
// under the tray while anything hangs in it (an empty tab's Show Templates), so the tray never covers the Offline
// banner on a phone.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { PaletteTray } from '@liveworkspace/workbench/components/chrome/PaletteTray';
import { TopCenterChrome } from './TopCenterChrome';

afterEach(cleanup);

const stack = (container: HTMLElement) =>
  container.querySelector('[data-top-center-stack]')!.className;
const box = { left: 91, width: 208, top: 12, bottom: 58 };

describe('TopCenterChrome', () => {
  it('starts under the strip with nothing in the tray', () => {
    const { container } = render(<TopCenterChrome readOnly={false} />);
    expect(stack(container)).toContain('top-[4.25rem]');
  });

  it("starts under the tray while an empty tab's tray hangs from the strip", () => {
    const { container, rerender } = render(
      <>
        <TopCenterChrome readOnly={false} />
        <PaletteTray box={box} standing lead={<span />}>
          Tab 1 is empty
        </PaletteTray>
      </>,
    );
    expect(stack(container)).toContain('top-[6.75rem]');
    rerender(<TopCenterChrome readOnly={false} />);
    expect(stack(container)).toContain('top-[4.25rem]');
  });

  it('starts at the top for a Viewer, who has no strip', () => {
    const { container } = render(<TopCenterChrome readOnly />);
    expect(stack(container)).not.toContain('top-[6.75rem]');
    expect(stack(container)).not.toContain('top-[4.25rem]');
  });
});
