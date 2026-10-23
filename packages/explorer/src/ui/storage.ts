// Device-local choices (the layout, the Details sort): read from the current key, else the first of the older
// keys the apps once kept the same choice under, so a person's choice survives the move; written to the
// current key only. Storage can be missing or refuse (a private window): reads then say nothing, writes are
// dropped, and the page still works.

export function readStored(key: string, legacy: readonly string[] = []): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const now = localStorage.getItem(key);
    if (now !== null) return now;
    for (const old of legacy) {
      const value = localStorage.getItem(old);
      if (value !== null) return value;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A convenience only.
  }
}
