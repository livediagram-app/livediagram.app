# Secure context

## What

Browsers keep some Web APIs for **secure contexts**: a page served over HTTPS or from `localhost`, and, for a page
in a frame, only when every frame above it is secure too. The editor runs outside one, so that an embed on a
plain-http wiki and a self-hosted instance on a LAN address both open.

## Why

The editor mints ids (documents, tabs, elements, the guest's own participant id) with `crypto.randomUUID()`, more
than a hundred call sites across `apps/live` and the shared packages. `randomUUID` is secure-context only. On
livedocuments.app the editor itself is always HTTPS, but an [embed](../013-workspace/embeds.md) on an `http://` page is
not secure (its ancestor is not), and neither is a self-hosted instance reached as `http://192.168.1.20`. There the
first id the editor minted threw `crypto.randomUUID is not a function` while it booted, and the frame showed only
"This page couldn't load".

## The rule

- **Ids work everywhere.** A pre-hydration script (`RANDOM_UUID_BOOT_SCRIPT`, `packages/ui/src/random-uuid-boot.ts`),
  inlined straight after the Trusted Types boot and before any app code by each layout whose app mints ids in the
  browser (the editor's), installs
  `crypto.randomUUID` when the browser left it out. It mints RFC 4122 version 4 ids from
  `crypto.getRandomValues`, which every context has, so the ids are as random as the real ones. A browser that
  has `randomUUID` keeps its own. Call sites keep calling `crypto.randomUUID()`: one shim, no second id helper.
- **Hashes work everywhere.** Every SHA-256 the code computes (an image's content address,
  the CLI's PKCE challenge) goes through `sha256` in `@livedocuments/api-schema`
  (`packages/api-schema/src/sha256-digest.ts`). It calls `crypto.subtle.digest` wherever the context has it and
  otherwise computes the same FIPS 180-4 digest in plain code (about 24 ms per MB, measured on Node 22, so a 5 MB
  image costs about 120 ms, and only outside a secure context). The two must match byte for byte: the server
  re-hashes an upload.
- **The clipboard is the one thing left that needs HTTPS.** `navigator.clipboard` is secure-context only, with no
  fallback a page can build. Every copy button already wraps its write in `try` and says when the copy did not
  happen ("Could not copy the link. Select it to copy manually."), so outside a secure context the buttons
  explain themselves and the text stays selectable.

## Testing

`packages/ui/src/random-uuid-boot.test.ts` runs the script as the browser does (`runInlineScript`) with a
`crypto` that lacks `randomUUID` and checks the ids it mints are version 4 and distinct, that a real `randomUUID`
is kept, and that it never throws without `crypto`. `apps/live/app/pre-hydration-scripts.test.ts` checks the layout inlines it before any app code.
`packages/api-schema/src/sha256-digest.test.ts` checks the plain-code digest against the FIPS 180-4 vectors and against Web
Crypto at every length across the padding boundaries, and that `sha256` picks Web Crypto when it is there.
