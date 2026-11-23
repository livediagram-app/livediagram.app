# @liveworkspace/subscription-ui

Everything a page shows about Pro (liveworkspace/docs/specs/019-subscription/subscription.md "What people see"),
built once for liveworkspace.app and every app: the Pro badge, the usage meter, the limit notice, the Pro note
and the upgrade dialog, over one provider that reads the signed-in person's subscription.

Every limit, row label, explanation and price comes from `@liveworkspace/subscription`. Nothing here holds a number
of its own, and no limit is enforced here: the server decides, and these only show what it decided.

## The flag

All of it draws nothing and asks the service nothing unless Pro is on in the build
(`NEXT_PUBLIC_PRO_ENABLED` is `true`, `1` or `on`). `flag.ts` is the one place that reads it; `proOn()` is the
answer. With Pro off the provider renders its children alone, every component returns `null` and every hook answers
its `off` state, so an app can mount all of this without a check of its own.

## An editor, in fifteen lines

```tsx
import { itemPayerScope } from '@liveworkspace/subscription';
import {
  LimitNotice,
  SubscriptionProvider,
  UsageMeter,
  useOwnerView,
} from '@liveworkspace/subscription-ui';
import { workspaceOriginFor } from '@liveworkspace/sites';

// Once, near the root of the editor (inside its auth provider):
const { getToken } = useDeferredAuth();
<SubscriptionProvider getToken={getToken} origin={workspaceOriginFor(window.location.host)}>
  <Editor />
</SubscriptionProvider>;

// Anywhere under it. The owner is the open item's, never the person acting:
const owner = useOwnerView(itemPayerScope(head));
const limit = owner.status === 'ready' ? owner.view.limits.automationRunsPerMonth : null;
<UsageMeter
  limitKey="automationRunsPerMonth"
  label="Runs This Month"
  used={runsThisMonth}
  limit={limit}
/>;
<LimitNotice limitKey="automationRunsPerMonth" used={runsThisMonth} owner={owner} />;
```

`@liveworkspace/subscription-ui/provider` is the light half: the provider's shell and the hooks, with nothing that
draws. Import the provider from there at an app's root (or in a header), so the first load carries a context and a
few lines of state; the half that asks the service, and the dialogs, are fetched once the page is interactive.

The app's stylesheet scans this package, as it does the other shared ones:

```css
@source '../../../../packages/subscription-ui/src';
```

## What is here

| Export                                                        | What it is                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SubscriptionProvider`                                        | Reads `/me` once per page with `getToken`, shares it, reads again on return from the checkout or the portal (and when the tab is shown after five minutes), and mounts the one upgrade dialog. Props: `getToken`, `origin` (liveworkspace.app's, from an app's page), `account` (`'checking' \| 'out' \| 'in'`, default `'in'`), `signInHref`, `returnTo`, `navigate`, `fetch`. |
| `useSubscription()`                                           | The person's `MeResponse` as `{ status: 'off' \| 'loading' \| 'signed_out' \| 'ready' \| 'error' }`, with `me` when ready.                                                                                                                                                                                                                                                      |
| `useOwnerView(scope)`                                         | What this person may know of an item's owner: its tier, limits and `action` (`upgrade`, `manage`, `ask_admin`, `none`). Asked once per owner per page.                                                                                                                                                                                                                          |
| `useUpgrade()`                                                | `openUpgrade({ owner, limit, subscribeFor })`, `openAskAdmin({ owner, limit })`, `pricingHref`, and `inPlace` (false with no provider, where both go to the pricing page).                                                                                                                                                                                                      |
| `useBilling()`                                                | `checkout(owner)` and `portal(owner)`, which send the browser to the service's page; `askTeam(owner, limit, note)` (Ask an Admin's Send Request) and `dismissEnded(owner)` (You're Back on Free's Dismiss).                                                                                                                                                                     |
| `usePrices()`, `useRefreshSubscription()`, `usePricingHref()` | The visitor's prices, a manual re-read, and the pricing page's address.                                                                                                                                                                                                                                                                                                         |
| `ProBadge`                                                    | The ink pill. `form`: `solid` (you have Pro), `outline` (part of Pro), `mark` (logo alone). `size`: `sm` or `md`. `ground="ink"` on a dark band. `label` names it; `decorative` hides it inside a control that already says it.                                                                                                                                                 |
| `UsageMeter`                                                  | `limitKey`, `used`, `limit` (null is unlimited), `label`, `showLabel`, `layout` (`auto`, `inline`, `stacked`), `words` (the numbers in the caller's words), `showWords` (false: the bar alone, where the caller draws the numbers itself), `pro`. `role="meter"`; amber at the limit.                                                                                           |
| `LimitNotice`                                                 | `limitKey`, `used`, `owner` (the hook's answer or the view), optional `limit`, `sentence`, `offer`, `near`. Upgrade for the owner or a team admin, Ask an Admin for a member, no offer for anyone else; a quiet once-a-day nudge from 80% for someone on Free.                                                                                                                  |
| `ProNote`                                                     | The quiet line under a list a tier trims: a sentence (its children) and See Pro (or Ask an Admin) wearing the Pro mark; the outline badge leads only when there is no button. `owner`, `limitKey`, `layout` (`foot`, `rail`, `box`). The same action rules.                                                                                                                     |
| `ComparisonGrid`                                              | Every row of `LIMIT_ROWS` by tier, grouped, beside `usage`. One tier at a time below 768px.                                                                                                                                                                                                                                                                                     |
| `RowAppLogo`, `InfoPopover`                                   | A row's app logo, and the info button with its explanation.                                                                                                                                                                                                                                                                                                                     |

`@liveworkspace/subscription-ui/testing` has `setProForTests(true | false | null)` and `serviceFetch(...)`, a `fetch`
that answers as the subscription Worker does, for tests in the packages that draw these.
