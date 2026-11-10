// Whether a click came from a finger (liveworkspace/docs/specs/010-site/site-switcher.md "How it behaves", SITE4).
// A keyboard click (Enter on a link, detail 0) never is. The press that started it decides first (`pressedWith`, the
// `pointerType` of its `pointerdown`): iPhone and iPad Safari can name a finger's click a `mouse` one, so the click's
// own pointer is only read when no press was seen. A click that names its pointer (a PointerEvent, every current
// browser) is one when that pointer is `touch`, so a mouse or trackpad on a touch screen stays a click. A click that
// names none counts as touch when the screen's main pointer is coarse.
export function isTouchTap(
  event: Pick<MouseEvent, 'detail'> & { pointerType?: string },
  pressedWith: string | null = null,
): boolean {
  if (event.detail === 0) return false;
  if (pressedWith) return pressedWith === 'touch';
  if (event.pointerType) return event.pointerType === 'touch';
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}
