// Copying a link that opens the editor in a way (docs/specs/007-editor/wireframe-pages.md "A link that opens with
// Inspect", "Sharing a prototype"): Copy Inspect Link and Copy Prototype Link. A visitor copies the link they came in
// on; whoever may share copies the design's live Viewer link. It never makes a link: with none, the Share dialog
// opens so one can be made.
import { inspectViewLink, type InspectableLink } from './inspect-link';

export type CopyFlaggedViewLinkInput = {
  // The share code the visitor came in on; null for the owner (and anyone else not on a link).
  sessionShareCode: string | null;
  designId: string | null;
  tabId: string;
  // The flag added to the link (`withInspect`, `withPrototype`) and the address of a share code.
  withFlag: (href: string) => string;
  shareAddress: (code: string) => string;
  listShareLinks: (designId: string) => Promise<{ links: readonly InspectableLink[] }>;
  writeClipboard: (text: string) => Promise<void>;
  openShare: () => void;
  toast: { success: (m: string) => void; info: (m: string) => void; error: (m: string) => void };
  // What the toasts say the link opens with ("Inspect", "the prototype") and what Share is opened to make.
  // `link` names it where the copy failed ("Inspect link").
  link: string;
  copied: string;
  makeFirst: string;
  now?: number;
};

/** Copies the flagged link; true when it reached the clipboard. */
export async function copyFlaggedViewLink(input: CopyFlaggedViewLinkInput): Promise<boolean> {
  let code = input.sessionShareCode;
  if (code === null && input.designId) {
    try {
      const { links } = await input.listShareLinks(input.designId);
      code = inspectViewLink(links, input.tabId, input.now ?? Date.now())?.code ?? null;
    } catch {
      input.toast.error('Couldn’t read the design’s links. Try again.');
      return false;
    }
    if (code === null) {
      input.openShare();
      input.toast.info(input.makeFirst);
      return false;
    }
  }
  if (code === null) return false;
  try {
    await input.writeClipboard(input.withFlag(input.shareAddress(code)));
  } catch {
    input.toast.error(`Couldn’t copy the ${input.link}. Try again.`);
    return false;
  }
  input.toast.success(input.copied);
  return true;
}
