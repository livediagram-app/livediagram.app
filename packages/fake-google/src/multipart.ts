// multipart/related bodies as Drive's upload endpoint takes them: a JSON
// metadata part, then the media part.

export type MultipartPart = { contentType: string; body: string };

export function parseMultipartRelated(contentType: string, body: string): MultipartPart[] {
  const m = /boundary="?([^";]+)"?/i.exec(contentType);
  if (!/^multipart\/related/i.test(contentType) || !m) {
    throw new Error(`fake-google: expected multipart/related, got ${contentType}`);
  }
  const boundary = `--${m[1]}`;
  const parts: MultipartPart[] = [];
  for (const raw of body.split(boundary).slice(1)) {
    if (raw.startsWith('--')) break;
    const chunk = raw.replace(/^\r?\n/, '');
    const split = /\r?\n\r?\n/.exec(chunk);
    if (!split) continue;
    const headers = chunk.slice(0, split.index);
    const content = chunk.slice(split.index + split[0].length).replace(/\r?\n$/, '');
    const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() ?? 'text/plain';
    parts.push({ contentType: type, body: content });
  }
  return parts;
}
