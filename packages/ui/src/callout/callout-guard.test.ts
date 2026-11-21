import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// liveworkspace/docs/specs/016-notifications/callouts.md: every note or error box in place is the one Callout. This
// finds a hand-tinted box (a rose, red, amber, emerald or sky 50 surface with padding on a div or p) in the products'
// and packages' source, so a new one is written with the component instead.

const ROOT = join(__dirname, '..', '..', '..', '..');
const SCANNED = ['packages', 'liveworkspace/apps', ...PRODUCT_APPS()];
const SKIP_DIR = new Set([
  'node_modules',
  '.next',
  '.next-dev',
  'out',
  'dist',
  '.wrangler',
  'e2e',
  'help',
  'marketing',
]);

// Not callouts (callouts.md "Out of scope"), each with why.
const ALLOWED: Readonly<Record<string, string>> = {
  'livedesign/apps/live/components/chrome/WorkbenchChrome.tsx':
    'the reconnect pill, top-centre core UI',
  'livediagram/apps/editor/components/chrome/WorkbenchChrome.tsx':
    'the reconnect pill, top-centre core UI',
  'livedocuments/apps/editor/components/chrome/WorkbenchChrome.tsx':
    'the reconnect pill, top-centre core UI',
  'liveplanner/apps/editor/components/chrome/WorkbenchChrome.tsx':
    'the reconnect pill, top-centre core UI',
  'livediagram/apps/editor/components/panels/VotePanel.tsx': 'a review control strip with buttons',
  'liveplanner/apps/editor/components/panels/VotePanel.tsx': 'a review control strip with buttons',
  'livedocuments/apps/editor/components/versions/VersionDetail.tsx':
    'a restore confirm strip, a decision',
  'liveplanner/apps/editor/components/forms/FormStatusBar.tsx': 'an in-page status bar',
  'liveplanner/apps/editor/components/forms/builder/FormQuestionCard.tsx':
    'badges and a button tint',
  'liveplanner/apps/editor/components/tour/MissionStrip.tsx': 'tour step marks',
  'liveworkspace/apps/site/components/landing/PromiseArt.tsx': 'a landing illustration',
  'packages/explorer/src/approvals/ApprovalBanner.tsx': 'a banner and its badge',
  'packages/explorer/src/approvals/ApprovalPanel.tsx': 'a badge and a confirm strip',
  'packages/explorer/src/dialogs/share/ActivePass.tsx': 'a chip',
  'packages/explorer/src/explorer/SharedList.tsx': 'a chip',
  'packages/workbench/src/components/chrome/auth-cards.tsx': 'sign-in notices, their own family',
  'packages/workbench/src/components/oauth/oauth-chrome.tsx': 'a badge',
  'packages/workbench/src/components/request-access/RequestAccessButton.tsx': 'a chip',
  'packages/help-site/src/mdx-components.tsx': 'help-article Note and Tip admonitions',
  'packages/workbench/src/components/request-access/RequestAccess.tsx': 'a chip',
  'liveworkspace/apps/site/components/community/forum/ForumBits.tsx': 'a chip',
  'liveworkspace/apps/site/components/kits/KitRunCard.tsx':
    'a delete confirm strip with two buttons',
  'livediagram/apps/editor/components/chrome/SignInPrompt.tsx': 'sign-in, its own family',
  'liveplanner/apps/editor/components/chrome/SignInPrompt.tsx': 'sign-in, its own family',
  'livedocuments/apps/editor/components/chrome/SignInPrompt.tsx': 'sign-in, its own family',
  'livedesign/apps/live/components/chrome/SignInPrompt.tsx': 'sign-in, its own family',
  'livehuddle/apps/editor/components/chrome/SignInPrompt.tsx': 'sign-in, its own family',
  'livediagram/apps/editor/components/dialogs/MindOutlineDialog.tsx':
    'a removal confirm strip with two buttons',
  'livediagram/apps/editor/components/panels/session-studio/PollPane.tsx':
    'the live poll state card',
  // Moved with the Automations screen from liveplanner's editor to the platform's package.
  'packages/automations-ui/src/step-panels/IncomingWebhookPanel.tsx':
    'the Secret Made state card with a copy field',
  'liveplanner/apps/editor/components/forms/respond/FormFill.tsx':
    'the public form error summary, a focus target',
  'liveplanner/apps/editor/components/plan/time/TimerReadouts.tsx': 'a chip',
  'livehuddle/apps/editor/components/calls/mini-view/MiniView.tsx':
    'the knock card with two buttons',
};

const BOX =
  /className="[^"]*(?:bg-(?:rose|red|amber|emerald|sky)-50\b[^"]*\bp[xy]?-\d|\bp[xy]?-\d[^"]*bg-(?:rose|red|amber|emerald|sky)-50\b)[^"]*"/;
const NOT_A_BOX = /hover:bg|aria-selected|data-\[|enabled:|group-hover|<button|<Button|<li |<span/;

function PRODUCT_APPS(): string[] {
  return ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'].map(
    (p) => `${p}/apps`,
  );
}

function* sources(dir: string): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIR.has(e.name)) yield* sources(join(dir, e.name));
    } else if (e.name.endsWith('.tsx') && !e.name.includes('.test.')) yield join(dir, e.name);
  }
}

describe('callouts', () => {
  it('every note or error box is the Callout, not a hand-tinted box', () => {
    const found: string[] = [];
    for (const top of SCANNED) {
      for (const file of sources(join(ROOT, top))) {
        const path = relative(ROOT, file);
        if (path in ALLOWED || path.startsWith('packages/ui/src/callout/')) continue;
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          if (BOX.test(line) && !NOT_A_BOX.test(line)) found.push(`${path}:${i + 1}`);
        });
      }
    }
    expect(found).toEqual([]);
  });

  it('every allowed file still has what it is allowed for', () => {
    const stale = Object.keys(ALLOWED).filter((path) => {
      try {
        return !BOX.test(readFileSync(join(ROOT, path), 'utf8'));
      } catch {
        return true;
      }
    });
    expect(stale).toEqual([]);
  });
});
