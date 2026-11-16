// A message as an app takes it in (liveworkspace/docs/specs/003-accounts/inbound-email.md "The reader"): who sent it
// and whether they proved it, its subject, its text and its attachments. Never throws: what cannot be read is empty.
import { authenticationOf, type InboundAuthentication } from './authentication';
import { htmlToText } from './html-text';
import {
  byteString,
  bytesOf,
  decodeBody,
  decodeCharset,
  headerParams,
  leavesOf,
  parseMime,
  type MimePart,
} from './mime';
import { addressOf, decodeEncodedWords } from './words';

export type InboundAttachment = { name: string; type: string; bytes: Uint8Array };

export type InboundMail = {
  // The header From address, lower-cased; null when the message names none.
  from: string | null;
  subject: string;
  text: string;
  attachments: InboundAttachment[];
  authentication: InboundAuthentication;
};

export type ReadOptions = {
  // The authserv-ids whose Authentication-Results count (Email Routing's).
  trustedAuthServIds: readonly string[];
  // The SMTP envelope sender (`message.from`).
  envelopeFrom: string;
};

const collapse = (s: string) => s.split(/\s/).filter(Boolean).join(' ');

function dispositionOf(part: MimePart): { attachment: boolean; name: string | undefined } {
  const { main, params } = headerParams(part.headers.get('content-disposition') ?? '');
  const name = params['filename'] ?? part.params['name'];
  return {
    attachment: main === 'attachment' || name !== undefined || part.type === 'message/rfc822',
    name: name === undefined ? undefined : decodeEncodedWords(name),
  };
}

function bodyText(part: MimePart): string {
  const bytes = decodeBody(part.raw, part.headers.get('content-transfer-encoding'));
  return decodeCharset(bytes, part.params['charset']);
}

// Plain text as written, its indents kept: line ends made LF, trailing spaces and blank lines at the ends dropped.
function plainText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/** The message's bytes, read. */
export function readInboundMail(raw: Uint8Array, opts: ReadOptions): InboundMail {
  const root = parseMime(byteString(raw));
  const from = addressOf(decodeEncodedWords(root.headers.get('from') ?? ''));
  const subject = collapse(decodeEncodedWords(root.headers.get('subject') ?? ''));
  let plain: string | null = null;
  let html: string | null = null;
  const attachments: InboundAttachment[] = [];
  for (const part of leavesOf(root)) {
    const disposition = dispositionOf(part);
    if (!disposition.attachment && part.type === 'text/plain' && plain === null) {
      plain = bodyText(part);
      continue;
    }
    if (!disposition.attachment && part.type === 'text/html' && html === null) {
      html = bodyText(part);
      continue;
    }
    if (!disposition.attachment) continue;
    attachments.push({
      name: disposition.name?.trim() || 'attachment',
      type: part.type,
      bytes: bytesOf(decodeBody(part.raw, part.headers.get('content-transfer-encoding'))),
    });
  }
  const text = plain !== null ? plainText(plain) : html !== null ? htmlToText(html) : '';
  const authentication = authenticationOf(root.headers.get('authentication-results'), {
    trusted: opts.trustedAuthServIds,
    from,
    envelopeFrom: opts.envelopeFrom,
  });
  return { from, subject, text, attachments, authentication };
}
