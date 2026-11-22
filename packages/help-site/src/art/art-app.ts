// Which app's help the art is drawn for. The help app's Next config sets `HELP_ART_APP` from the build's scope
// (liveworkspace/apps/help/lib/scope.generated.ts), so the shared primitives draw that app's canvas: livehuddle's
// tiled floor and sticky notes, the dot grid elsewhere. Read at call time so a test can switch it.

export type ArtApp =
  'livediagram' | 'livedesign' | 'livedocuments' | 'liveplanner' | 'livehuddle' | 'liveknowledge';

const APPS: readonly string[] = [
  'livediagram',
  'livedesign',
  'livedocuments',
  'liveplanner',
  'livehuddle',
  'liveknowledge',
];

/** The app the help is built for, or undefined under All Apps (and in a test that sets none). */
export function artApp(): ArtApp | undefined {
  const app = process.env.HELP_ART_APP;
  return app && APPS.includes(app) ? (app as ArtApp) : undefined;
}
