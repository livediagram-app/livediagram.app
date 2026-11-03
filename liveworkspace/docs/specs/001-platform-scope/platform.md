# The platform

liveworkspace is the platform four apps stand on: livediagram (Canvas: diagrams, drawing, workshops),
liveplanner (Plan: boards, sheets, dashboards, forms), livedocuments (Document: articles, slides, infographics) and
livedesign (Design: logos, wireframes, photos). A person has one account, one Explorer and one set of settings across
all of them, at liveworkspace.app and on each app's own address. A fifth, livehuddle (Space: meetings and
workshops), is registered with the services before its launch and listed nowhere yet
([Registered before launch](../002-architecture/integrating-an-app.md#registered-before-launch)).

## Why one platform

The apps began as copies of one another. Every copy of the same feature (sign-in, folders, sharing, the Trash, image
uploads, telemetry) drifted, and every fix was made four times. The platform holds each of those once, so a fix is
made once, a person's work and identity follow them from app to app, and an app keeps only what makes it different.

## What the platform owns

| Service   | What it is                                                                                         | Spec                                           |
| --------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Accounts  | Sign-in by email code or Google, sessions, guests, teams, API tokens, settings, profiles, email    | [003-accounts](../003-accounts/README.md)      |
| Index     | Where every item is and who can reach it: folders, favourites, sharing, the Inbox, Timeline, Trash | [004-index](../004-index/README.md)            |
| Drive     | Each person's items mirrored to their Google Drive                                                 | [005-drive](../005-drive/README.md)            |
| Export    | Download Your Data: everything a person or team owns, as one zip                                   | [003-accounts](../003-accounts/data-export.md) |
| Media     | Every app's uploaded images, and every item's previews, live images and share cards                | [006-media](../006-media/README.md)            |
| Community | Every app's public Community listings                                                              | [007-community](../007-community/README.md)    |
| Telemetry | Every app's anonymous events, and the public dashboard                                             | [008-telemetry](../008-telemetry/README.md)    |
| Status    | Hourly checks of every service, kept for 90 days, and the status page                              | [009-status](../009-status/README.md)          |
| Site      | liveworkspace.app's pages: the front door, the Explorer, Settings, sign-in, the site switcher      | [010-site](../010-site/README.md)              |
| Workbench | Pairing API tokens with developer workbenches, and the sessions they open                          | [011-workbench](../011-workbench/README.md)    |
| Migrate   | The one-off move of the historical livediagram.app's people and documents                          | [012-migrate](../012-migrate/README.md)        |

## What each app keeps

An app keeps its editor, its item's content (one Durable Object per item, in the app's api Worker), its marketing
site, help centre, MCP server and CLI, and thin doors onto the platform: it registers items with the index, answers
the index's and Drive's calls about its own items, draws its previews, and binds the shared packages to its name.
It never keeps its own copy of a platform record (no teams mirror, no folders table, no image store).

## Principles

- **Platform first.** A capability two or more apps need is built once on the platform, as a service or a shared
  package (`packages/`, `@liveworkspace/*`); apps keep only the app-specific door.
- **One origin.** Every service is a path on liveworkspace.app, so the site calls them without cross-site requests,
  and each app's router forwards the paths its pages need on the app's own address.
- **One account, one guest.** A person, or a guest, is the same id in every app.
- **Offline checks.** Apps check access tokens and the index's grants against published keys, with no call per
  request.
- **Measured budgets.** Each service's spec states its costs (requests, D1 rows, bundle size) against Cloudflare's
  limits, measured rather than estimated.
- **Specs first.** Each service is specified here before it is built, and kept true after.

## Out of scope

- Content. The platform never stores or searches an item's content; that stays in the item's Durable Object in its
  app. Two services pass it through for a short time and keep no copy of their own: the Drive mirror, writing it to
  the person's Google Drive ([drive.md](../005-drive/drive.md)), and Download Your Data, which keeps the zip it builds
  in R2 only until its link lapses, 3 days at most ([data-export.md](../003-accounts/data-export.md#privacy)).
- Billing and paid tiers. Every app is free and MIT-licensed.
- Passwords and passkeys. Accounts sign in with an emailed code or Google only.
