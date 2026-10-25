// The CLI's pictures (docs/specs/015-api/blueprints/cli.md "Previews", CLI30, CLI31): @liveworkspace/cli-kit's SVG
// or PNG writer, naming this CLI's package when its renderer's files are missing.

import type { CliIo } from '../io';
import { writePicture as writePictureOf, type Picture } from '@liveworkspace/cli-kit/png';
import { NPM_PACKAGE } from '../config/version';

export { pictureLine, svgSize, type Picture } from '@liveworkspace/cli-kit/png';

// Writes the drawing as SVG or, for a `.png` path, as a PNG.
export const writePicture = (
  io: CliIo,
  path: string,
  svg: string,
  format: 'svg' | 'png',
): Promise<Picture> => writePictureOf(io, path, svg, format, NPM_PACKAGE);
