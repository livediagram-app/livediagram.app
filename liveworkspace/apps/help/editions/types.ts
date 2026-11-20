import type { ComponentType } from 'react';
import type { AppId, HelpScope } from '@liveworkspace/help-registry';
import type { HelpHomeLayout } from '@liveworkspace/help-site/lib/home';
import type { HelpArt, HelpSiteConfig } from '@liveworkspace/help-site/site';

// One scope's edition of the one help centre (liveworkspace/docs/specs/017-help/blueprints/help-centre.md "Editions"):
// what is that scope's own, gathered in editions/<scope>/edition.ts. editions/index.ts exposes the build's
// (editions/current.generated.ts, written by scripts/build-scopes.mjs, so a build bundles only its own edition).
// Everything else (the catalogue, the pages, the components) is the framework's and reads the scope.

/** The facts the help site takes from the scope's ui package (or liveworkspace's own, under All Apps). */
export type EditionUiFacts = Pick<
  HelpSiteConfig,
  'siteName' | 'siteUrl' | 'contactFormUrl' | 'pageMetadata' | 'cardSubtitle'
>;

export interface Edition {
  /** The scope: an app id, or `all` for www.liveworkspace.app/help. */
  app: HelpScope;
  /** The site header, with the help search (and so the app switch) in its centre. */
  header: ComponentType;
  /** The site footer. */
  footer: ComponentType;
  uiFacts: EditionUiFacts;
  /** The card art, feature icons and colours. */
  art: HelpArt;
  /** The home page's sections, Start Here, Still Stuck and Popular chips. */
  homeLayout: HelpHomeLayout;
  /** The hero's line under its title. */
  heroLede: string;
  /** An open-source app's issue tracker, for the closing band's "Report a bug on GitHub". */
  issuesUrl?: string;
}

/** An app's edition (every edition but All Apps'). */
export type AppEdition = Edition & { app: AppId };
