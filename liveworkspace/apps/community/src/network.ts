// Where a like, copy or report comes from (liveworkspace/docs/community.md "Public routes"): the caller's network
// (communityNetwork, shared with the apps' rate limits), only ever stored as a one-way hash salted with the post
// id, so it cannot be compared across posts.

import { communityNetwork } from '@liveworkspace/community';

// The network as a one-way hash salted with the post id: the first 16 bytes of its SHA-256, as hex.
export async function networkHash(postId: string, ip: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${postId}:${communityNetwork(ip)}`),
  );
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// The caller's address as Cloudflare saw it. Locally, with no edge in front, every caller is one network.
export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? '127.0.0.1';
}
