// A keyboard shortcut as this computer spells it: `Mod-B` is ⌘B on an Apple device and Ctrl+B elsewhere (Shift-
// and Alt- likewise). Shared by the article page toolbar and the Sheet's cell menu.

const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function keyLabel(k: string, apple: boolean = mac): string {
  // A letter key reads as its capital, as on the keycap and in every menu: a keymap's `Mod-e` is ⌘E.
  k = k.replace(/(^|-)([a-z])$/, (_, sep: string, letter: string) => sep + letter.toUpperCase());
  return apple
    ? k.replace('Mod-', '⌘').replace('Shift-', '⇧').replace('Alt-', '⌥')
    : k.replace('Mod-', 'Ctrl+').replace('Shift-', 'Shift+').replace('Alt-', 'Alt+');
}
