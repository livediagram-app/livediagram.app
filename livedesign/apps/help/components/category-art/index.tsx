import type { ComponentType } from 'react';
import { AboutArt } from './about';
import { AccountAndDataArt } from './account-and-data';
import { CanvasArt } from './canvas';
import { CollaborationArt } from './collaboration';
import { DevelopersArt } from './developers';
import { ExplorerArt } from './explorer';
import { GettingStartedArt } from './getting-started';
import { PagesArt } from './pages';
import { PaletteArt } from './palette';
import { PoliciesArt } from './policies';
import { PrivacyAndSecurityArt } from './privacy-and-security';
import { SearchPanelArt } from './search-panel';
import { SelectionModesArt } from './selection-modes';
import { SupportedDevicesArt } from './supported-devices';
import { TabsArt } from './tabs';
import { TipsAndTricksArt } from './tips-and-tricks';
import { ToolsArt } from './tools';
import { TroubleshootingArt } from './troubleshooting';
import { UserInterfaceArt } from './user-interface';

// One scene per help category, keyed by the category slug (docs/specs/018-help/help-pages.md "Category art").
// Contact has no card, so no scene. A test holds every other category to having one.
export const CATEGORY_ART: Record<string, ComponentType> = {
  about: AboutArt,
  'account-and-data': AccountAndDataArt,
  canvas: CanvasArt,
  collaboration: CollaborationArt,
  developers: DevelopersArt,
  explorer: ExplorerArt,
  'getting-started': GettingStartedArt,
  pages: PagesArt,
  palette: PaletteArt,
  policies: PoliciesArt,
  'privacy-and-security': PrivacyAndSecurityArt,
  'search-panel': SearchPanelArt,
  'selection-modes': SelectionModesArt,
  'supported-devices': SupportedDevicesArt,
  tabs: TabsArt,
  'tips-and-tricks': TipsAndTricksArt,
  tools: ToolsArt,
  troubleshooting: TroubleshootingArt,
  'user-interface': UserInterfaceArt,
};

/** The category's scene, or nothing for a slug without one. */
export function CategoryArt({ slug }: { slug: string }) {
  const Scene = CATEGORY_ART[slug];
  return Scene ? <Scene /> : null;
}
