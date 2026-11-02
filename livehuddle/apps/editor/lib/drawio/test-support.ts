// Test helpers shared by the draw.io importer's DOM tests (jsdom).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** An mxGraphModel element from the XML of its root's children. */
export function model(rootChildren: string, attrs = ''): Element {
  const xml = `<mxGraphModel ${attrs}><root><mxCell id="0"/><mxCell id="1" parent="0"/>${rootChildren}</root></mxGraphModel>`;
  return new DOMParser().parseFromString(xml, 'application/xml').documentElement;
}

export const vertex = (id: string, style: string, geo: string, extra = '') =>
  `<mxCell id="${id}" style="${style}" vertex="1" ${extra}><mxGeometry ${geo} as="geometry"/></mxCell>`;

export const fixtureBytes = (name: string) =>
  new Uint8Array(readFileSync(join(__dirname, '__fixtures__', name)));
