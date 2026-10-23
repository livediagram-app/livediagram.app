// A design's own page in the editor (the router serves the editor at /design/<id>).
export function designPath(designId: string): string {
  return `/design/${encodeURIComponent(designId)}`;
}
