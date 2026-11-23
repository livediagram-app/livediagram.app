import { expect, type Locator } from '@playwright/test';

/**
 * Waits until a control or panel has stopped moving: fully in the viewport, and the same box on two animation frames
 * running. A sheet slides in, and a tap on a row mid-slide lands on whatever is under the finger by then, so a phone
 * spec calls this before it taps anything inside a sheet or panel. It polls; it adds no fixed timeout.
 */
export async function settled(target: Locator): Promise<void> {
  await expect(target).toBeInViewport({ ratio: 1 });
  await expect
    .poll(async () =>
      target.evaluate(
        (el) =>
          new Promise<boolean>((done) => {
            const box = () => JSON.stringify(el.getBoundingClientRect());
            const before = box();
            requestAnimationFrame(() => requestAnimationFrame(() => done(box() === before)));
          }),
      ),
    )
    .toBe(true);
}
