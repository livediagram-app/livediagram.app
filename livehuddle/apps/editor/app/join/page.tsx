'use client';

import { LiveworkspaceForward } from '@liveworkspace/workbench/components/panels/LiveworkspaceForward';

// /join?token=… — where a team's join link used to land (docs/specs/013-workspace/teams.md). Teams are run on
// liveworkspace.app now (liveworkspace/docs/specs/003-accounts/accounts.md "The join link"), so an old link forwards
// there with its token. `index: false` is inherited from the root layout.
export default function JoinPage() {
  return (
    <LiveworkspaceForward
      path="/join"
      title="Teams are on liveworkspace.app"
      body="Your teams work in every liveworkspace app. Taking you to liveworkspace.app to join this team."
      cta="Join on liveworkspace.app"
    />
  );
}
