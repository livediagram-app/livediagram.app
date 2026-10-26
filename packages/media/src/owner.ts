// Who an image belongs to (liveworkspace/docs/specs/006-media/media.md "Owners"): the person who uploaded it. A
// signed-in person is their liveworkspace account id, the same in every app, which is what lets their
// gallery follow them across the suite. A guest has no account: their app's guest id is their
// credential, so it never leaves the app. The app sends a one-way hash of it instead, scoped to the app,
// so a guest's images stay in the app they were added in until the guest signs up and the app merges
// them into the account.

export const MEDIA_GUEST_PREFIX = 'guest:';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The owner a guest's images are kept under: `guest:` and a hash of the app and its guest id. */
export async function mediaGuestOwner(app: string, guestId: string): Promise<string> {
  return `${MEDIA_GUEST_PREFIX}${await sha256Hex(`${app}\n${guestId}`)}`;
}

export function isGuestOwner(owner: string): boolean {
  return owner.startsWith(MEDIA_GUEST_PREFIX);
}
