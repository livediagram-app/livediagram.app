// Image ids a write would place (docs/specs/015-api/mcp-server.md §4.5b). liveplanner keeps no uploaded pictures, so
// an image element is only ever an empty placeholder: an input naming a picture is refused with a sentence that says
// so, rather than saved as a frame that can never draw. Pure: the input is what the model sent, walked once.

interface PlacedImage {
  // The element that places it, when the input names one.
  elementId: string | null;
  imageId: string;
}

// Every image id a tool's input places, wherever it sits (a tab's elements, an op's element or its set, a page's
// background): each object carrying a string `imageId`, with the element id beside it.
export function imagesPlacedIn(input: unknown): PlacedImage[] {
  const out: PlacedImage[] = [];
  const walk = (value: unknown, elementId: string | null) => {
    if (Array.isArray(value)) {
      for (const v of value) walk(v, elementId);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const rec = value as Record<string, unknown>;
    const here =
      typeof rec.id === 'string'
        ? rec.id
        : typeof rec.elementId === 'string'
          ? rec.elementId
          : elementId;
    if (typeof rec.imageId === 'string' && rec.imageId)
      out.push({ elementId: here, imageId: rec.imageId });
    for (const [key, v] of Object.entries(rec)) if (key !== 'imageId') walk(v, here);
  };
  walk(input, null);
  return out;
}

// Why a tool's input cannot be written for the pictures it places, as a sentence; null when it places none.
export function imageIdIssue(input: unknown): string | null {
  const placed = imagesPlacedIn(input)[0];
  if (!placed) return null;
  const where = placed.elementId ? ` on element "${placed.elementId}"` : '';
  return (
    `imageId ${JSON.stringify(placed.imageId)}${where} names an uploaded picture, and liveplanner keeps none. ` +
    'Leave imageId out: an image element is an empty placeholder.'
  );
}
