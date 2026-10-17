// Decoding draw.io payloads (docs/specs/020-import-export/blueprints/drawio-import.md step 3): base64, then
// inflated under the import's byte budget (lib/inflate.ts).
import { inflateBytes, type ByteBudget } from '@/lib/inflate';

export const latin1 = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);

export function base64Bytes(text: string): Uint8Array {
  const binary = atob(text.replace(/\s+/g, ''));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// draw.io's Graph.zapGremlins: C0 controls other than tab, LF, CR.
// oxlint-disable-next-line no-control-regex -- the control range IS the point
const GREMLINS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

/** A compressed `<diagram>` body back to its `mxGraphModel` XML (draw.io's
 *  Graph.decompress: base64, raw inflate, URI-decode). */
export async function decompressDiagram(text: string, budget: ByteBudget): Promise<string> {
  const inflated = latin1(await inflateBytes(base64Bytes(text), 'deflate-raw', budget));
  let decoded: string;
  try {
    decoded = decodeURIComponent(inflated);
  } catch {
    decoded = inflated; // not URI-encoded (D14)
  }
  return decoded.replace(GREMLINS, '');
}
