import type { HelpScope } from '@liveworkspace/help-registry';
import { ALL_APPS_CATEGORIES } from '@liveworkspace/help-registry/catalogue';
import type { ListingCopy } from '@liveworkspace/help-site/components/CategoryPages';

// Each support category landing's copy per scope (the title, description and lede each product's help page carried,
// app/<slug>/page.tsx there), and All Apps' from the catalogue's own (packages/help-registry catalogue/all.ts). A flat
// data file: the landings (app/<slug>/page.tsx) read the build's scope's.

/** The support categories: a landing of article cards (SupportCategoryPage), Getting Started numbered. */
export const SUPPORT_SLUGS = [
  'about',
  'account-and-data',
  'developers',
  'getting-started',
  'policies',
  'privacy-and-security',
  'supported-devices',
  'tips-and-tricks',
  'troubleshooting',
] as const;
export type SupportSlug = (typeof SUPPORT_SLUGS)[number];

type AppCopy = Partial<Record<SupportSlug, ListingCopy>>;

const APP_COPY: Record<Exclude<HelpScope, 'all'>, AppCopy> = {
  livediagram: {
    about: {
      title: 'About livediagram',
      description: 'What livediagram is, who it is for, and why it exists.',
      lede: 'What livediagram is, who it is for, and why it exists.',
    },
    'account-and-data': {
      title: 'Account and Data',
      description: 'Guest access, signing in, syncing, exporting, and deleting your data.',
      lede: 'How identity works, what an account adds, and how to manage your data.',
    },
    developers: {
      title: 'Developers',
      description:
        'Call the livediagram REST API from your own scripts or the command line: authentication, worked examples, the CLI, errors and limits, and the OpenAPI reference.',
      lede: 'Drive livediagram from your own scripts and integrations. The same REST API the editor uses, callable with an API token, or from a terminal with the livediagram CLI.',
    },
    'getting-started': {
      title: 'Getting Started',
      description:
        'New to livediagram? Create your first diagram, learn the canvas, and share it with your team.',
      lede: 'New here? These guides get you up and running quickly.',
    },
    policies: {
      title: 'Policies',
      description:
        "How to report a vulnerability. The terms and privacy policy are liveworkspace's, on liveworkspace.app.",
      lede: "How to report a security issue privately. The terms and privacy policy for livediagram.app are liveworkspace's, at liveworkspace.app/terms and liveworkspace.app/privacy.",
    },
    'privacy-and-security': {
      title: 'Privacy and Security',
      description:
        'How your data is handled, what livediagram collects, and how share links are protected.',
      lede: 'How your data is handled and how to keep your canvases safe.',
    },
    'supported-devices': {
      title: 'Supported Devices',
      description:
        'How livediagram works on a computer, a tablet, and a phone, and what to expect on each.',
      lede: 'livediagram runs in the browser on any device. Pick yours to see what works and what to expect.',
    },
    'tips-and-tricks': {
      title: 'Tips and Tricks',
      description: 'Shortcuts and lesser-known features that make editing in livediagram faster.',
      lede: 'Work faster with these shortcuts and hidden features.',
    },
    troubleshooting: {
      title: 'Troubleshooting',
      description:
        'Solutions to common problems with the livediagram editor and real-time collaboration.',
      lede: 'Something not working? Start here.',
    },
  },
  liveplanner: {
    about: {
      title: 'About liveplanner',
      description: 'What liveplanner is, who it is for, and why it exists.',
      lede: 'What liveplanner is, who it is for, and why it exists.',
    },
    'account-and-data': {
      title: 'Account and Data',
      description: 'Guest access, signing in, syncing, exporting, and deleting your data.',
      lede: 'How identity works, what an account adds, and how to manage your data.',
    },
    developers: {
      title: 'Developers',
      description:
        'Call the liveplanner REST API from your own scripts or the command line: authentication, worked examples, the CLI, errors and limits, and the OpenAPI reference.',
      lede: 'Drive liveplanner from your own scripts and integrations. The same REST API the editor uses, callable with an API token, or from a terminal with the liveplanner CLI.',
    },
    'getting-started': {
      title: 'Getting Started',
      description:
        'New to liveplanner? Create your first plan, learn the canvas, and share it with your team.',
      lede: 'New here? These guides get you up and running quickly.',
    },
    policies: {
      title: 'Policies',
      description:
        "How to report a vulnerability. The terms and privacy policy are liveworkspace's, on liveworkspace.app.",
      lede: "How to report a security issue privately. The terms and privacy policy for liveplanner.app are liveworkspace's, at liveworkspace.app/terms and liveworkspace.app/privacy.",
    },
    'privacy-and-security': {
      title: 'Privacy and Security',
      description:
        'How your data is handled, what liveplanner collects, and how share links are protected.',
      lede: 'How your data is handled and how to keep your plans safe.',
    },
    'supported-devices': {
      title: 'Supported Devices',
      description:
        'How liveplanner works on a computer, a tablet, and a phone, and what to expect on each.',
      lede: 'liveplanner runs in the browser on any device. Pick yours to see what works and what to expect.',
    },
    'tips-and-tricks': {
      title: 'Tips and Tricks',
      description: 'Shortcuts and lesser-known features that make editing in liveplanner faster.',
      lede: 'Work faster with these shortcuts and hidden features.',
    },
    troubleshooting: {
      title: 'Troubleshooting',
      description:
        'Solutions to common problems with the liveplanner editor and real-time collaboration.',
      lede: 'Something not working? Start here.',
    },
  },
  livedocuments: {
    about: {
      title: 'About livedocuments',
      description: 'What livedocuments is, who it is for, and why it exists.',
      lede: 'What livedocuments is, who it is for, and why it exists.',
    },
    'account-and-data': {
      title: 'Account and Data',
      description: 'Guest access, signing in, syncing, exporting, and deleting your data.',
      lede: 'How identity works, what an account adds, and how to manage your data.',
    },
    developers: {
      title: 'Developers',
      description:
        'Call the livedocuments REST API from scripts or the command line: authentication, worked examples, the CLI, errors and limits, and the OpenAPI reference.',
      lede: 'Drive livedocuments from your own scripts and integrations. The same REST API the editor uses, callable with an API token, or from a terminal with the livedocuments CLI.',
    },
    'getting-started': {
      title: 'Getting Started',
      description:
        'New to livedocuments? Create your first document, learn your way around its pages, and share it with your team.',
      lede: 'New here? These guides get you up and running quickly.',
    },
    policies: {
      title: 'Policies',
      description:
        "How to report a vulnerability. The terms and privacy policy are liveworkspace's, on liveworkspace.app.",
      lede: "How to report a security issue privately. The terms and privacy policy for livedocuments.app are liveworkspace's, at liveworkspace.app/terms and liveworkspace.app/privacy.",
    },
    'privacy-and-security': {
      title: 'Privacy and Security',
      description:
        'How your data is handled, what livedocuments collects, and how share links are protected.',
      lede: 'How your data is handled and how to keep your documents safe.',
    },
    'supported-devices': {
      title: 'Supported Devices',
      description:
        'How livedocuments works on a computer, a tablet, and a phone, and what to expect on each.',
      lede: 'livedocuments runs in the browser on any device. Pick yours to see what works and what to expect.',
    },
    'tips-and-tricks': {
      title: 'Tips and Tricks',
      description: 'Shortcuts and lesser-known features that make editing in livedocuments faster.',
      lede: 'Work faster with these shortcuts and hidden features.',
    },
    troubleshooting: {
      title: 'Troubleshooting',
      description:
        'Solutions to common problems with the livedocuments editor and real-time collaboration.',
      lede: 'Something not working? Start here.',
    },
  },
  livedesign: {
    about: {
      title: 'About livedesign',
      description: 'What livedesign is, who it is for, and why it exists.',
      lede: 'What livedesign is, who it is for, and why it exists.',
    },
    'account-and-data': {
      title: 'Account and Data',
      description: 'Guest access, signing in, syncing, exporting, and deleting your data.',
      lede: 'How identity works, what an account adds, and how to manage your data.',
    },
    developers: {
      title: 'Developers',
      description:
        'Call the livedesign REST API from your own scripts or the command line: authentication, worked examples, the CLI, errors and limits, and the OpenAPI reference.',
      lede: 'Drive livedesign from your own scripts and integrations. The same REST API the editor uses, callable with an API token, or from a terminal with the livedesign CLI.',
    },
    'getting-started': {
      title: 'Getting Started',
      description:
        'New to livedesign? Create your first design, learn your way around its pages, and share it with your team.',
      lede: 'New here? These guides get you up and running quickly.',
    },
    policies: {
      title: 'Policies',
      description:
        "How to report a vulnerability. The terms and privacy policy are liveworkspace's, on liveworkspace.app.",
      lede: "How to report a security issue privately. The terms and privacy policy for livedesign.app are liveworkspace's, at liveworkspace.app/terms and liveworkspace.app/privacy.",
    },
    'privacy-and-security': {
      title: 'Privacy and Security',
      description:
        'How your data is handled, what livedesign collects, and how share links are protected.',
      lede: 'How your data is handled and how to keep your designs safe.',
    },
    'supported-devices': {
      title: 'Supported Devices',
      description:
        'How livedesign works on a computer, a tablet, and a phone, and what to expect on each.',
      lede: 'livedesign runs in the browser on any device. Pick yours to see what works and what to expect.',
    },
    'tips-and-tricks': {
      title: 'Tips and Tricks',
      description: 'Shortcuts and lesser-known features that make editing in livedesign faster.',
      lede: 'Work faster with these shortcuts and hidden features.',
    },
    troubleshooting: {
      title: 'Troubleshooting',
      description:
        'Solutions to common problems with the livedesign editor and real-time collaboration.',
      lede: 'Something not working? Start here.',
    },
  },
  livehuddle: {
    about: {
      title: 'About livehuddle',
      description: 'What livehuddle is, who it is for, and why it exists.',
      lede: 'What livehuddle is, who it is for, and why it exists.',
    },
    'account-and-data': {
      title: 'Account and Data',
      description: 'Guest access, signing in, syncing, exporting, and deleting your data.',
      lede: 'How identity works, what an account adds, and how to manage your data.',
    },
    developers: {
      title: 'Developers',
      description:
        'Call the livehuddle REST API from your own scripts: authentication, worked examples, errors and limits, and the OpenAPI reference.',
      lede: 'Drive livehuddle from your own scripts and integrations. The same REST API the editor uses, callable with an API token.',
    },
    'getting-started': {
      title: 'Getting Started',
      description:
        'New to livehuddle? Open your first Space, walk in as your character, and bring your team in.',
      lede: 'New here? These guides get you up and running quickly.',
    },
    policies: {
      title: 'Policies',
      description:
        "How to report a vulnerability. The terms and privacy policy are liveworkspace's, on liveworkspace.app.",
      lede: "How to report a security issue privately. The terms and privacy policy for livehuddle.app are liveworkspace's, at liveworkspace.app/terms and liveworkspace.app/privacy.",
    },
    'privacy-and-security': {
      title: 'Privacy and Security',
      description:
        'How your data is handled, what livehuddle collects, and how share links are protected.',
      lede: 'How your data is handled and how to keep your spaces safe.',
    },
    'supported-devices': {
      title: 'Supported Devices',
      description:
        'How livehuddle works on a computer, a tablet, and a phone, and what to expect on each.',
      lede: 'livehuddle runs in the browser on any device. Pick yours to see what works and what to expect.',
    },
    'tips-and-tricks': {
      title: 'Tips and Tricks',
      description: 'Shortcuts and lesser-known features that make editing in livehuddle faster.',
      lede: 'Work faster with these shortcuts and hidden features.',
    },
    troubleshooting: {
      title: 'Troubleshooting',
      description:
        'Solutions to common problems with the livehuddle editor and real-time collaboration.',
      lede: 'Something not working? Start here.',
    },
  },
};

/** A support landing's copy in `scope`, or undefined when the scope has no such landing. */
export function supportCopy(scope: HelpScope, slug: SupportSlug): ListingCopy | undefined {
  if (scope !== 'all') return APP_COPY[scope][slug];
  const c = ALL_APPS_CATEGORIES.find((x) => x.slug === slug);
  return c && { title: c.title, description: c.description, lede: c.description };
}
