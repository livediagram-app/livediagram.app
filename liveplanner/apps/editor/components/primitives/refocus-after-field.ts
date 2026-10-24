// A rename ended from the keyboard (Enter or Escape) takes its field away, which left focus on the page. Once the
// caller has swapped the field back for its name, the first control in the field's place (the title, the tab, the row's
// link) takes focus, unless something else already has it. Used by NameEditor. Without a
// focus ring (`focusVisible: false`): the key that ended the rename made the browser draw one, a bubble left over the
// renamed tab; the next Tab shows where focus is as usual.
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function refocusAfterField(field: HTMLElement): void {
  const host = field.parentElement;
  if (!host) return;
  requestAnimationFrame(() => {
    const lost = !document.activeElement || document.activeElement === document.body;
    if (lost && host.isConnected)
      host
        .querySelector<HTMLElement>(FOCUSABLE)
        ?.focus({ preventScroll: true, focusVisible: false });
  });
}
