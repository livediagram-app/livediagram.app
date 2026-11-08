'use client';

// The device sign-in page (docs/specs/015-api/blueprints/cli.md "The device grant", "Presentation and UX"): the shared
// page, bound to this editor's facts.
import { createOauthDevicePage } from '@liveworkspace/workbench/components/oauth/OauthDevicePage';
import { OAUTH_PAGES } from '../oauth-shell';

export default createOauthDevicePage(OAUTH_PAGES);
