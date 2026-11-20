# Inbound email

The platform also takes mail in. An app that gives people an address to write to (liveplanner's Email to Board,
[liveplanner/docs/specs/026-plan/email-to-board.md](../../../../liveplanner/docs/specs/026-plan/email-to-board.md))
receives it through Cloudflare Email Routing on its own subdomain, and reads it with the shared reader in
`@liveworkspace/email/inbound`. The reader is the platform's part: it parses the message, says whether the sender
proved who they are, and cuts it down to what a person wrote. What the mail makes is the app's.

## How mail arrives

- **Routing.** An app's intake subdomain (liveplanner's `in.liveplanner.app`) has Email Routing's MX records and one
  rule that sends its single address (liveplanner's `board@`) to the app's api Worker, with subaddressing on so
  `board+<code>@` matches it too. Not the catch-all: Email Routing has one per zone, shared with the root domain,
  and the root domain's catch-all already forwards its own mail elsewhere. The root domain's own mail (its `hello@`
  sender, its SPF and DKIM) is left alone. Inbound routing is free; the Worker's CPU time is billed as any request.
- **The handler.** The Worker's default export gains an `email(message, env, ctx)` handler beside `fetch`. It reads
  the envelope (`message.from`, `message.to`), the declared size (`message.rawSize`) and the raw MIME stream once.
- **Refusing.** `message.setReject(reason)` refuses a message during delivery, so the sending server tells its own
  person; nothing is ever sent back from the platform (no bounce, no auto-reply), so a forged sender is never mailed.
- **Dropping.** A message the reader says is not authenticated is accepted and thrown away: a forger learns
  nothing from it.

## The reader

`readInboundMail(raw, options)` takes the message's bytes and answers one `InboundMail`:

- **Who sent it**: the header `From:` address, lower-cased, and whether it is authenticated (below).
- **Subject**: decoded (RFC 2047 encoded words in UTF-8 or Latin-1), whitespace collapsed.
- **Text**: the first `text/plain` part, or, with none, the first `text/html` part as plain text (tags dropped, block
  ends as line breaks, entities decoded). Quoted-printable and base64 bodies are decoded, and the part's charset
  read through `TextDecoder` (UTF-8 when it names none or one the runtime lacks).
- **Attachments**: every other part with a file name or `Content-Disposition: attachment` (inline pictures too), each
  with its name (RFC 2231 and RFC 2047 names decoded), its declared type and its decoded bytes.
- **Limits**: at most `INBOUND_PARTS_MAX` (50) parts and a nesting depth of `INBOUND_DEPTH_MAX` (8); parts past those
  are left out, never an error. The app checks the message's size before reading it.

### Authentication

Email Routing checks SPF, DKIM and DMARC as it receives a message and writes the results in an
`Authentication-Results` header ([RFC 8601](https://www.rfc-editor.org/rfc/rfc8601)) at the top of it.

- Only the **topmost** `Authentication-Results` header counts, and only when its authserv-id is one the app trusts
  (Email Routing's, `mx.cloudflare.net`). A header a sender wrote further down, or one naming another server, is
  never read: anyone can write one.
- A message **passes** when `dmarc=pass`; or, when the result has no DMARC verdict (`dmarc=none` or absent: the
  sender's domain publishes no policy), when the header `From:` address is the envelope sender and one method
  passed **for that address's domain**: `spf=pass` (SPF proves the envelope's domain), or a `dkim=pass` whose
  signing domain (`header.d`, else the domain of `header.i`) is the From's domain or a parent of it. A DKIM pass
  by any other domain proves nothing about the sender: anyone can sign a forged `From:` with a domain of their
  own. Anything else (`dmarc=fail`, no trusted header, neither passing) **fails**.
  - [x] IA1: `dkim=pass header.d=other.example` with `dmarc=none` and no SPF pass fails (`unaligned`); with the
        From's own domain it passes.
- The verdict is `pass` or `fail`, with the reason for a log (`dmarc_fail`, `no_results`, `unaligned`, `none_passed`).

### Quoted replies

`stripQuotedReply(text)` keeps what the person wrote and drops what they replied to, reading line by line from the
top: it stops at the first line that opens a quote (`On … wrote:`, `-----Original Message-----`, a `From:` line
under a blank one, `________________`) or a run of `>` lines that goes to the end, and drops a signature (`-- ` on
its own line) and what follows. A message that is nothing but a quote keeps it whole, so a forward still has its
text. Every check is a left-to-right scan with no regular expression that can backtrack, so a hostile body costs
time in proportion to its length.

## Limits

| Limit               | Value | Why                                                           |
| ------------------- | ----- | ------------------------------------------------------------- |
| `INBOUND_PARTS_MAX` | 50    | Far past any real message; bounds the work a crafted one asks |
| `INBOUND_DEPTH_MAX` | 8     | Nested multiparts past this are a crafted message             |
| Reader CPU budget   | 50 ms | A 1 MB worst-case body, tested (`cpuBudgetMs`)                |

## Privacy

The reader keeps no header but `From`, `Subject`, `Content-*` and the topmost `Authentication-Results`: no
`Received` chain, no addresses in `To` or `Cc`, no message id. An app logs a message only as counts and verdicts,
with any address redacted (`redactAddress`).
