import type { ComponentType } from 'react';
import { PoliciesArt } from '@liveworkspace/help-site/art/scenes/policies';
import { AboutArt } from './about';
import { AccountAndDataArt } from './account-and-data';
import { CollaborationArt } from './collaboration';
import { DevelopersArt } from './developers';
import { ExplorerArt } from './explorer';
import { GettingStartedArt } from './getting-started';
import { KnowledgebaseArt } from './knowledgebase';
import { PrivacyAndSecurityArt } from './privacy-and-security';
import { SearchPanelArt } from './search-panel';
import { TroubleshootingArt } from './troubleshooting';
import { UserInterfaceArt } from './user-interface';

// One scene per help category, keyed by the category slug (liveworkspace/docs/specs/017-help/help-centre.md "Category
// art"). Contact has no card, so no scene. A test holds every other category to having one.
export const CATEGORY_ART: Record<string, ComponentType> = {
  about: AboutArt,
  'account-and-data': AccountAndDataArt,
  collaboration: CollaborationArt,
  developers: DevelopersArt,
  explorer: ExplorerArt,
  'getting-started': GettingStartedArt,
  knowledgebase: KnowledgebaseArt,
  policies: PoliciesArt,
  'privacy-and-security': PrivacyAndSecurityArt,
  'search-panel': SearchPanelArt,
  troubleshooting: TroubleshootingArt,
  'user-interface': UserInterfaceArt,
};
