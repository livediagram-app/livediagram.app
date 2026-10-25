// What a product calls its work, as the help art writes it. A scene that names the work takes the product's `noun`,
// singular and lower case (`design`, `plan`, `document`, `canvas`), and spells the other forms from it.

/** `design` → `designs`, `canvas` → `canvases`. */
export function plural(noun: string): string {
  return /(s|x|ch|sh)$/.test(noun) ? `${noun}es` : `${noun}s`;
}

/** `design` → `Design`. */
export function capital(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
