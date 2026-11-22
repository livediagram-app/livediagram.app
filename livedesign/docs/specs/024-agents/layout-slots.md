# Layout text slots

The text slots of every wireframe and logo layout, as [Pages for agents](pages-for-agents.md) "Text slots"
reads them from the layout as built: `title`, `subtitle`, `bullets` and `body`, with how many items each list
holds; `figures` are its numbers, times and prices. This table is written by, and checked
against the layouts by, `packages/edit-operations/src/pages/layout-text.test.ts` (`UPDATE_LAYOUT_SLOTS=1`
rewrites it; prettier then lines up its columns). A watch layout is read on a watch, the rest on a phone.

## Wireframes

| Layout                  | Name           | Slots                                 |
| ----------------------- | -------------- | ------------------------------------- |
| `wf-onboarding`         | Onboarding     | title, subtitle, body ×2              |
| `wf-sign-in`            | Sign In        | title, subtitle, body ×7, figures ×1  |
| `wf-empty-state`        | Empty State    | title, body ×7                        |
| `wf-home-feed`          | Home Feed      | title, subtitle, body ×12             |
| `wf-landing-page`       | Landing Page   | title, subtitle, body ×4              |
| `wf-product-detail`     | Product Detail | title, body ×7, figures ×1            |
| `wf-search-results`     | Search Results | title, subtitle, body ×14, figures ×7 |
| `wf-profile`            | Profile        | title, body ×11, figures ×3           |
| `wf-settings`           | Settings       | title, body ×16, figures ×4           |
| `wf-checkout`           | Checkout       | title, body ×13, figures ×4           |
| `wf-pricing`            | Pricing        | title, body ×12, figures ×3           |
| `wf-dashboard`          | Dashboard      | title, subtitle, body ×8, figures ×8  |
| `wf-chat`               | Chat           | title, subtitle, body ×7              |
| `wf-data-table`         | Data Table     | title, subtitle, body ×16, figures ×6 |
| `wf-article`            | Article        | title, body ×3                        |
| `wf-places`             | Places         | title, subtitle, body ×6              |
| `wf-notifications`      | Notifications  | title, body ×26, figures ×4           |
| `wf-calendar`           | Calendar       | title, body ×16, figures ×35          |
| `wf-inbox`              | Inbox          | title, subtitle, body ×26, figures ×2 |
| `wf-music-player`       | Music Player   | title, subtitle, body ×1, figures ×2  |
| `wf-gallery`            | Photo Gallery  | title, body ×9                        |
| `wf-sign-up`            | Sign Up        | title, subtitle, body ×9              |
| `wf-verify-code`        | Verify Code    | title, subtitle, body ×2, figures ×3  |
| `wf-permissions`        | Permissions    | title, subtitle, body ×9              |
| `wf-shop-grid`          | Shop Grid      | title, subtitle, body ×10, figures ×2 |
| `wf-cart`               | Cart           | title, body ×13, figures ×14          |
| `wf-order-tracking`     | Order Tracking | title, body ×10                       |
| `wf-post-detail`        | Post           | title, subtitle, body ×9              |
| `wf-stories`            | Stories Feed   | title, subtitle, body ×10             |
| `wf-compose-post`       | New Post       | title, subtitle, body ×2, figures ×1  |
| `wf-kanban`             | Kanban Board   | title, subtitle, body ×22             |
| `wf-task-list`          | Task List      | title, body ×22                       |
| `wf-video-player`       | Video Player   | title, subtitle, body ×10             |
| `wf-podcast`            | Podcast        | title, subtitle, body ×12             |
| `wf-edit-profile`       | Edit Profile   | title, body ×12                       |
| `wf-help-center`        | Help Center    | title, subtitle, body ×10, figures ×4 |
| `wf-team`               | Team           | title, subtitle, body ×10             |
| `wf-contact`            | Contact        | title, subtitle, body ×9              |
| `wf-blog`               | Blog           | title, body ×10                       |
| `wf-flight-search`      | Flight Search  | title, body ×17                       |
| `wf-boarding-pass`      | Boarding Pass  | title, subtitle, body ×11, figures ×3 |
| `wf-ride`               | Ride           | title, body ×8, figures ×3            |
| `wf-watch-glance`       | Glance         | title, subtitle                       |
| `wf-watch-list`         | List           | title, body ×3                        |
| `wf-watch-workout`      | Workout        | title, body ×2, figures ×2            |
| `wf-watch-now-playing`  | Now Playing    | title, subtitle                       |
| `wf-watch-weather`      | Weather        | title, body ×1, figures ×9            |
| `wf-watch-timer`        | Timer          | title, body ×2                        |
| `wf-watch-heart-rate`   | Heart Rate     | title, body ×2, figures ×1            |
| `wf-watch-up-next`      | Up Next        | title, body ×2, figures ×2            |
| `wf-watch-notification` | Notification   | title, subtitle, body ×3              |

## Logos

| Layout              | Name             | Slots                    |
| ------------------- | ---------------- | ------------------------ |
| `logo-icon-above`   | Icon Above Name  | title, subtitle          |
| `logo-icon-beside`  | Icon Beside Name | title, subtitle          |
| `logo-stacked`      | Stacked          | title, subtitle          |
| `logo-icon-right`   | Name Beside Icon | title, subtitle          |
| `logo-divided`      | Divided          | title, subtitle          |
| `logo-pill`         | Pill             | title                    |
| `logo-icon-below`   | Icon Below Name  | title, subtitle          |
| `logo-wordmark`     | Wordmark         | title, subtitle          |
| `logo-monogram`     | Monogram         | title                    |
| `logo-underlined`   | Underlined       | title                    |
| `logo-two-lines`    | Two Lines        | title, subtitle          |
| `logo-spaced`       | Spaced Capitals  | title                    |
| `logo-initial`      | Initial Accent   | title, subtitle          |
| `logo-badge`        | Badge            | title, subtitle          |
| `logo-seal`         | Seal             | title, subtitle          |
| `logo-hexagon`      | Hexagon          | title                    |
| `logo-stamp`        | Stamp            | title, subtitle, body ×1 |
| `logo-square-badge` | Square Badge     | title                    |
| `logo-diamond`      | Diamond          | title, subtitle          |
| `logo-mark-disc`    | Icon Disc        |                          |
| `logo-mark-app`     | App Icon         |                          |
| `logo-mark-rings`   | Rings            |                          |
| `logo-mark-initial` | Initial          | title                    |
| `logo-mark-peaks`   | Peaks            |                          |
| `logo-mark-star`    | Star             |                          |
