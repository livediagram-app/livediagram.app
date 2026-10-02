'use client';

import { SidebarGreeting } from './SidebarGreeting';
import { QuickFindSection } from './QuickFindSection';
import { PersonalSpaceSection } from './PersonalSpaceSection';
import { TeamSpacesSection } from './TeamSpacesSection';
import { LibrarySection } from './LibrarySection';
import { SidebarSignInNudge } from './SidebarSignInNudge';

// The Explorer's section tree (docs/specs/013-workspace/folders.md), shared by the desktop
// sidebar and the mobile drawer in ExplorerShell. Every navigation goes
// through `go` (a route push) so picking a section on a phone also closes
// the drawer. One component per section.
export function ExplorerSidebar() {
  return (
    <>
      <SidebarGreeting />
      <QuickFindSection />
      <PersonalSpaceSection />
      <TeamSpacesSection />
      <LibrarySection />
      <SidebarSignInNudge />
    </>
  );
}
