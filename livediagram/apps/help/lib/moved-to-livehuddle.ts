import type { MovedPage } from '@liveworkspace/help-site/lib/moved';

// Avatar mode, the virtual office and the furniture moved to livehuddle (Work Tracker #650,
// docs/specs/002-project-scope/not-in-livediagram.md). Their articles went with them, and livehuddle's help keeps each
// one at the same path, so an old link here lands on the same article there. Each stub page is noindex and names
// livehuddle's page canonical, as the shared stubs in @liveworkspace/help-site/lib/moved do.

const LIVEHUDDLE_HELP = 'https://www.livehuddle.app/help';

/** The stub for a help path whose article moved to livehuddle's help at the same path. `path` is relative to /help,
 *  with no leading or trailing slash (`selection-modes/avatar-mode`). */
export function movedToLivehuddle(path: string, title: string): MovedPage {
  const href = `${LIVEHUDDLE_HELP}/${path}/`;
  return {
    href,
    label: `${title} guide in livehuddle's help`,
    metadata: {
      title,
      description: `${title} moved to livehuddle, with Avatar mode and the virtual office.`,
      robots: { index: false, follow: true },
      alternates: { canonical: href },
    },
  };
}
