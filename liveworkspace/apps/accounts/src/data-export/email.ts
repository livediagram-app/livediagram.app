// The email when an export finishes (liveworkspace/docs/specs/003-accounts/data-export.md "The link"): ready, with its
// size and the signed link, or failed, pointing to Settings to try again. An account message: it can't be turned off.
import { EXPORT_LINK_TTL_MS } from '@liveworkspace/data-export';
import { button, escapeHtml, frame, paragraph, workspaceBrand } from '../email-layout.ts';

/** A size as people read it: `840 KB`, `12.4 MB`, `1.2 GB`. */
export function readableSize(bytes: number): string {
  if (bytes < 1000 * 1000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  if (bytes < 1000 * 1000 * 1000) return `${(bytes / 1000 / 1000).toFixed(1)} MB`;
  return `${(bytes / 1000 / 1000 / 1000).toFixed(1)} GB`;
}

const DAYS = Math.round(EXPORT_LINK_TTL_MS / (24 * 60 * 60 * 1000));

const FOOTER =
  'You’re receiving this because you asked for a download of your data on liveworkspace.';

export type ExportEmail =
  | { status: 'ready'; teamName: string | null; bytes: number; link: string; to: string }
  | { status: 'failed'; teamName: string | null };

export function exportEmail(baseUrl: string, email: ExportEmail) {
  const brand = workspaceBrand({ BASE_URL: baseUrl });
  const whose = email.teamName ? `${email.teamName}’s` : 'Your';
  const settings = `${baseUrl.replace(/\/+$/, '')}/explorer?settings=data`;
  if (email.status === 'failed') {
    const subject = `${whose} liveworkspace data couldn’t be downloaded`;
    const lead = `Something went wrong while we put together ${email.teamName ? `${email.teamName}’s` : 'your'} data, so there is nothing to download this time. Nothing of yours has changed.`;
    const again = 'You can try again from Settings, under Your Data.';
    const text = [lead, '', `${again} ${settings}`, '', FOOTER].join('\n');
    const html = frame(brand, {
      preheader: escapeHtml(lead),
      heading: 'Your download didn’t finish',
      body: `${paragraph(escapeHtml(lead))}
        ${button('Try again', escapeHtml(settings))}
        ${paragraph(escapeHtml(again), 24)}`,
      footer: FOOTER,
    });
    return { subject, text, html };
  }
  const subject = email.teamName
    ? `${email.teamName}’s liveworkspace data is ready`
    : 'Your liveworkspace data is ready';
  const lead = email.teamName
    ? `Everything ${email.teamName} owns in livediagram, liveplanner, livedocuments and livedesign is ready to download, as one zip of ${readableSize(email.bytes)}.`
    : `Everything you own in livediagram, liveplanner, livedocuments and livedesign is ready to download, as one zip of ${readableSize(email.bytes)}.`;
  const rule = `The link works for ${DAYS} days, and only when you’re signed in as ${email.to}.`;
  const readme = 'The README inside says what each folder holds and how to bring an item back.';
  const text = [lead, '', `Download it: ${email.link}`, '', rule, readme, '', FOOTER].join('\n');
  const html = frame(brand, {
    preheader: escapeHtml(lead),
    heading: email.teamName
      ? `${escapeHtml(email.teamName)}’s data is ready`
      : 'Your data is ready',
    body: `${paragraph(escapeHtml(lead))}
        ${button('Download', escapeHtml(email.link))}
        ${paragraph(`${escapeHtml(rule)} ${escapeHtml(readme)}`, 24)}`,
    footer: FOOTER,
  });
  return { subject, text, html };
}
