// Home's first run (livediagram's HomeWelcome, made app-agnostic): what the host hands the Explorer so a person with
// nothing yet is greeted with starting points instead of empty lists. The starts come from the app's welcome
// manifest (`@<app>/templates/welcome.json`); every address is the app's own, so a start makes its item there.

import type { ReactNode } from 'react';

/** One starting point: a blank or a template, made at once by following `href`. */
export type WelcomeStart = {
  id: string;
  name: string;
  description?: string;
  href: string;
  /** The preview as static SVG markup, drawn as an image. */
  svg?: string;
};

/** The words and starts of one app's welcome. */
export type WelcomeManifest = {
  /** The app's name, as in "Welcome to liveplanner." */
  name: string;
  /** The first pill ("Free, no trackers"). */
  pillFree: string;
  blanks: readonly WelcomeStart[];
  popular: readonly WelcomeStart[];
  /** Three start ids fanned in the hero, the front one first. */
  fan: readonly string[];
  /** The New wizard with Start Blank chosen, the wizard itself, and its template search ("…?q=" + words). */
  startBlankHref: string;
  allTemplatesHref: string;
  searchHref: (words: string) => string;
};

export type WelcomeTelemetryType =
  | 'Welcome'
  | 'Welcome.Blank'
  | 'Welcome.Template'
  | 'Welcome.AllTemplates'
  | 'Welcome.Search'
  | 'Welcome.StartBlank'
  | 'Welcome.SignIn';

export type WelcomeOptions = {
  /** The app's welcome, or null while it loads (the host may load it lazily, only for a first run). */
  manifest: WelcomeManifest | null;
  /** Asked for once the Explorer knows it is a first run, so a host loads its manifest only then. */
  onFirstRun?: () => void;
  /** Whether the person is signed in: the second pill, and whether "Already Have Work?" offers a way back. */
  signedIn: boolean;
  /** Sign-in, for a guest who may simply have been signed out. Without it there is no "Already Have Work?". */
  signInHref?: string | null;
  /** `Home / Selected / <type>` (and `Home / Opened / Welcome`), for the host's telemetry. */
  onSelected?: (type: WelcomeTelemetryType) => void;
  onOpened?: () => void;
  /** Draws a start's picture in place of its SVG. */
  renderPicture?: (start: WelcomeStart) => ReactNode;
};

export const WELCOME_COPY = {
  question: 'What are you making first?',
  lead: 'Pick a starting point, or search the templates. Whatever you make lands here, ready to pick up again.',
  pillGuest: 'No sign-up to start',
  pillSignedIn: 'Saved to your account',
  searchPlaceholder: 'Search templates',
  searchLabel: 'Search templates',
  startBlank: 'Start Blank',
  blanksTitle: 'Start Blank',
  popularTitle: 'Popular Templates',
  allTemplates: 'Browse All Templates',
  haveWorkTitle: 'Already Have Work?',
  signInTitle: 'Nothing here yet? Sign in',
  signIn: 'Sign In',
} as const;

/** "If you have used liveplanner before, sign in and your plans come back with you." */
export const signInLine = (name: string, lowerMany: string) =>
  `If you have used ${name} before, sign in and your ${lowerMany} come back with you.`;
