# Inbound email blueprint

Derived from [inbound-email.md](../inbound-email.md): the shared reader every app's `email()` handler uses.

## Domain and naming

| Spec term          | Identifier                                                                   |
| ------------------ | ---------------------------------------------------------------------------- |
| the reader         | `readInboundMail(raw, { trustedAuthServIds, envelopeFrom })` → `InboundMail` |
| a message, read    | `InboundMail` `{ from, subject, text, attachments, authentication }`         |
| an attachment      | `InboundAttachment` `{ name, type, bytes }`                                  |
| the verdict        | `InboundAuthentication` `{ verdict: 'pass' \| 'fail', reason }`              |
| quoted reply strip | `stripQuotedReply(text)`                                                     |
| the parts          | `parseMime(bytes)` → `MimePart` tree (headers, body bytes, children)         |

## Files

- `packages/email/src/inbound/index.ts`: the `./inbound` export (`@liveworkspace/email/inbound`).
- `packages/email/src/inbound/mime.ts`: `parseMime`, header unfolding, `headerParams` (a left-to-right tokenizer for
  `type/sub; a=b; c="d"`, RFC 2231 `name*=` and continuations), `decodeBody` (base64, quoted-printable, 7bit, 8bit,
  binary), `decodeCharset`.
- `packages/email/src/inbound/words.ts`: `decodeEncodedWords` (RFC 2047 `=?charset?B|Q?…?=`), `addressOf` (the
  bare address of a `From:` value, lower-cased).
- `packages/email/src/inbound/html-text.ts`: `htmlToText` (tags dropped, `br`/`p`/`div`/`li`/`tr` as line breaks,
  `script`/`style` content dropped, the common entities and numeric references decoded), one pass.
- `packages/email/src/inbound/authentication.ts`: `authenticationOf(topmostHeader, opts)`.
- `packages/email/src/inbound/quoted.ts`: `stripQuotedReply`.
- `packages/email/src/inbound/read.ts`: `readInboundMail`.

## Behaviour and state

- `parseMime`: the header block ends at the first empty line (CRLF or LF). A header line starting with a space or tab
  continues the one before. Header names compared case-insensitively; the first occurrence of each is kept, except
  `Authentication-Results`, of which only the first (topmost) is kept. A `multipart/*` body is split on
  `--<boundary>` lines (the boundary from `Content-Type`), up to the closing `--<boundary>--`; its preamble and
  epilogue are dropped. Children past `INBOUND_PARTS_MAX` in total, or deeper than `INBOUND_DEPTH_MAX`, are left out.
  A multipart with no boundary is read as one text part.
- `readInboundMail`: the first `text/plain` part not marked attachment is the text; with none, the first `text/html`
  through `htmlToText`. Every other leaf part with a `filename`/`name` parameter or `Content-Disposition:
attachment` is an attachment (name `attachment` when none). `message/rfc822` parts are attachments too (not read
  into). `subject` is `decodeEncodedWords` of `Subject`, whitespace runs collapsed to one space, trimmed.
- `authenticationOf(header, { trusted, from, envelopeFrom })`: null header, or an authserv-id (the text before the
  first `;`, trimmed, lower-cased, any version after a space dropped) not in `trusted` → `fail no_results`. Results
  are read by splitting on `;` and taking each `method=result` token's method (`spf`, `dkim`, `dmarc`) and result,
  the first of each method winning except `dkim`, where any `pass` counts and each passing part's signing domain
  is kept (`header.d=`, else the domain of `header.i=`, lower-cased). `dmarc=pass` → `pass`. `dmarc` of
  `fail`, `quarantine`, `reject`, `permerror` or `temperror` → `fail dmarc_fail`. Otherwise neither `spf=pass` nor
  `dkim=pass` → `fail none_passed`; `from !== envelopeFrom` → `fail unaligned`; `spf=pass`, or a passing DKIM
  signing domain equal to the From's domain or a parent of it → `pass`; else `fail unaligned`.
- `stripQuotedReply(text)`: lines split on LF (CR dropped). Scanned top-down; the cut is at the first line that is
  a quote opener: trimmed, it starts with `On ` and ends with `wrote:` (or the next line ends with `wrote:`, for a
  wrapped one), or is `-----Original Message-----` (any case), or starts with `From:` right after an empty line, or
  is 16 or more `_`. A `>` line run that reaches the end of the text (blank lines allowed between) is cut too. A
  line that is exactly `-- ` or `--` cuts the signature. Trailing blank lines go. A cut that would leave nothing
  keeps the text as it was.

## Interfaces and contracts

```ts
type InboundAttachment = { name: string; type: string; bytes: Uint8Array };
type InboundAuthentication = {
  verdict: 'pass' | 'fail';
  reason: 'dmarc_pass' | 'aligned_pass' | 'dmarc_fail' | 'no_results' | 'unaligned' | 'none_passed';
};
type InboundMail = {
  from: string | null; // the header From address, lower-cased
  subject: string;
  text: string;
  attachments: InboundAttachment[];
  authentication: InboundAuthentication;
};
function readInboundMail(
  raw: Uint8Array,
  opts: { trustedAuthServIds: readonly string[]; envelopeFrom: string },
): InboundMail;
function stripQuotedReply(text: string): string;
```

The reader never throws on a malformed message: what it cannot read is empty (no subject, no text, no attachments).

## Errors and edge cases

- No `From:` → `from` null, verdict `fail none_passed` unless `dmarc=pass` (which cannot happen without one).
- A base64 body with junk characters: they are skipped; a broken quoted-printable `=` stays as it is.
- A charset `TextDecoder` does not know: read as UTF-8 (`fatal: false`).
- A multipart whose closing boundary is missing: the parts up to the end are kept.

## Security and trust

- Header values are never interpreted as HTML or markup anywhere; the text is plain.
- Only the topmost `Authentication-Results` is read, and only from a trusted authserv-id: Email Routing prepends its
  own, and a sender can only add theirs below it.
- No regular expression with nested or adjacent unbounded repeats: the tokenizers are index scans, so the work is
  linear in the message's size.

## Performance and limits

- One pass over the bytes for the parts, one decode per part, one pass per text; `INBOUND_PARTS_MAX` and
  `INBOUND_DEPTH_MAX` bound a crafted multipart. A 1 MB body of worst-case text (a quote opener on every line,
  64,000 `>` lines, 100,000 spaces, 1 MB of `=` in quoted-printable) is tested inside `cpuBudgetMs(50)`.

## Observability

The reader logs nothing; the app logs the verdict's reason and counts.

## Testing

`packages/email/src/inbound/*.test.ts`: plain, multipart/alternative, mixed with attachments, nested, base64 and
quoted-printable, encoded-word subjects and file names (B and Q, UTF-8 and Latin-1), RFC 2231 names, HTML only, LF
and CRLF, folded headers, the parts and depth caps; every authentication branch (trusted and untrusted id, a lower
header ignored, dmarc pass and fail, none with aligned and unaligned dkim and spf, none passed); the quoted reply
openers, `>` runs, signatures, all-quote keeps; the CPU budgets.

## Constants and configuration

| Constant            | Value | Why                                                            |
| ------------------- | ----- | -------------------------------------------------------------- |
| `INBOUND_PARTS_MAX` | 50    | Far past real mail (a few parts); bounds crafted work          |
| `INBOUND_DEPTH_MAX` | 8     | Real mail nests 3 deep at most (mixed > related > alternative) |

## Defaults ledger

ACC29 in [DEFAULTS.md](DEFAULTS.md).
