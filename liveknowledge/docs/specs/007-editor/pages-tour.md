# Pages tour (retired)

Retired on 2026-11-22 (Work Tracker 1348) for the [Get Started tours](knowledge-tours.md). The fork from livedocuments
brought a tour of each page kind (a Slides, an Infographic and an Article track), started from the footer's **Start
Pages Tour** button and from **Show Me** on a page's panel. A knowledgebase page has no kind to choose, no title bar
and no page panel ([The page surface](../030-knowledgebase/page-surface.md)), so nothing could start it any more.

What went with it: `PagesTourHost.tsx`, `PageTour.tsx` (the page panel's Show Me), the three tracks
(`slide-tour-steps.ts`, `infographic-tour-steps.ts`, `article-tour-steps.ts`), `page-tour-*.ts`, `pages-tour-page.ts`,
`lib/pages-tour.ts` and the tour square (`hooks/editor/useTourSquare.ts`). Its preferences, `pagesTourSeen` and
`pagesTourKinds`, are read by nothing and kept as stored. Its events (`PagesTour*`, `SlideTour*`, `InfographicTour*`,
`ArticleTour*`) are retired on the dashboard ([Telemetry](../017-telemetry/telemetry.md) "Retired features").

The engine every tour runs on is described in [Get Started tours](knowledge-tours.md) "How a tour runs".
