// Copies text to the clipboard; answers whether it could (an insecure page or a refused permission can't).
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
