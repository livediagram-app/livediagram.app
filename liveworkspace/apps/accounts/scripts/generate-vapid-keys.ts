// Makes a VAPID key pair for phone notifications (liveworkspace/docs/specs/003-accounts/push.md "Before deploy") and
// prints the two values the Worker's secrets take. Nothing is written anywhere: set them with
//
//   node scripts/generate-vapid-keys.ts
//   wrangler secret put VAPID_PUBLIC_KEY      (and VAPID_PRIVATE_KEY, and again with --env staging)
//
// A deployment keeps one pair for good: a new public key unsubscribes every device registered under the old one.
import { toBase64Url } from '../src/push/web-push.ts';

const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])) as CryptoKeyPair;
const publicKey = new Uint8Array(
  (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer,
);
const { d } = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;

console.log(`VAPID_PUBLIC_KEY=${toBase64Url(publicKey)}`);
console.log(`VAPID_PRIVATE_KEY=${d}`);
