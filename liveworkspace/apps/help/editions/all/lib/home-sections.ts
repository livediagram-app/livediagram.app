import type { HelpHomeLayout } from '@liveworkspace/help-site/lib/home';

// The All Apps home's layout (liveworkspace/docs/specs/016-help/help-centre.md "The home pages"): New to
// liveworkspace? (the account, the Explorer, connected files and sharing), Written once for every app (the shared
// categories), the account and policy pages, and Still Stuck. Pick an App sits above it (AllAppsHome).
export const HOME: HelpHomeLayout = {
  startHere: {
    walkthrough: 'getting-started',
    steps: [
      'getting-started/guest-vs-account',
      'account-and-data/signing-in',
      'explorer/home',
      'account-and-data/google-drive',
      'collaboration/sharing',
    ],
    beside: ['about', 'tips-and-tricks'],
  },
  sections: [
    {
      id: 'every-app',
      eyebrow: 'Written Once',
      heading: 'Written once, for every app',
      lede: 'What works the same in every app: sharing, the Explorer, tabs, the interface and the tools.',
      categories: ['collaboration', 'explorer', 'tabs', 'user-interface', 'tools', 'search-panel'],
    },
    {
      id: 'account',
      eyebrow: 'Your Account',
      heading: 'Your account, your data and the rules',
      lede: 'One account across every app: signing in, your data, privacy, devices and the policies.',
      categories: ['account-and-data', 'privacy-and-security', 'supported-devices', 'developers', 'policies'],
    },
  ],
  stillStuck: { category: 'troubleshooting', contact: 'contact' },
  popular: [
    { label: 'Sharing', path: 'collaboration/sharing' },
    { label: 'Signing In', path: 'account-and-data/signing-in' },
    { label: 'The Explorer', path: 'explorer/home' },
    { label: 'Google Drive', path: 'account-and-data/google-drive' },
    { label: 'Keyboard Essentials', path: 'getting-started/keyboard-essentials' },
  ],
};
