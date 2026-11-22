# Layout text slots

The text slots of every slide and infographic layout, as [Pages for agents](pages-for-agents.md) "Text slots"
reads them from the layout as built: `title`, `subtitle`, `bullets` and `body`, with how many items each list
holds. A layout’s figures (a number, a time, a percentage) are no slot. This table is written by, and checked
against the layouts by, `packages/edit-operations/src/pages/layout-text.test.ts` (`UPDATE_LAYOUT_SLOTS=1`
rewrites it; prettier then lines up its columns).

## Slides

| Layout                    | Name                | Slots                                |
| ------------------------- | ------------------- | ------------------------------------ |
| `slide-title`             | Title Slide         | title, subtitle, body ×1             |
| `slide-section`           | Section Header      | title, subtitle                      |
| `agenda`                  | Agenda              | title, subtitle, body ×12            |
| `slide-title-image`       | Title and Image     | title, subtitle, body ×2             |
| `slide-keynote`           | Keynote Title       | title, subtitle, body ×2             |
| `slide-question`          | Opening Question    | title, subtitle, body ×1             |
| `slide-speaker`           | About the Speaker   | title, subtitle, bullets ×3, body ×1 |
| `slide-objectives`        | Objectives          | title, subtitle, body ×6             |
| `slide-agenda-grid`       | Agenda Grid         | title, body ×8                       |
| `slide-agenda-image`      | Agenda and Image    | title, body ×4                       |
| `slide-bullets`           | Title and Bullets   | title, bullets ×5                    |
| `slide-two-columns`       | Two Columns         | title, bullets ×6, body ×2           |
| `slide-image-text`        | Image and Text      | title, subtitle, bullets ×3          |
| `slide-statement`         | Statement           | title, subtitle                      |
| `slide-testimonial`       | Testimonials        | title, body ×2                       |
| `quote`                   | Quote               | title, body ×2                       |
| `slide-three-points`      | Three Points        | title, body ×6                       |
| `slide-full-image`        | Full Image          | title, subtitle                      |
| `slide-takeaway`          | Key Takeaway        | title, bullets ×3, body ×2           |
| `slide-logos`             | Logo Strip          | title, subtitle, body ×1             |
| `slide-four-ideas`        | Four Ideas          | title, body ×8                       |
| `slide-title-only`        | Title Only          | title, subtitle                      |
| `slide-sidebar-title`     | Sidebar Title       | title, bullets ×5, body ×1           |
| `slide-compare-cards`     | Compare Two         | title, bullets ×6, body ×5           |
| `slide-split-image-right` | Text and Picture    | title, subtitle, bullets ×3, body ×1 |
| `slide-split-image-left`  | Picture and Text    | title, subtitle, bullets ×3, body ×1 |
| `slide-hero-image`        | Hero Picture        | title, subtitle, body ×1             |
| `slide-image-band`        | Picture Band        | title, subtitle, body ×1             |
| `slide-image-side-card`   | Picture and Card    | title, bullets ×3, body ×1           |
| `slide-quote-image`       | Quote and Picture   | title, body ×1                       |
| `slide-two-images`        | Two Pictures        | title, body ×2                       |
| `slide-three-images`      | Three Pictures      | title, body ×6                       |
| `slide-image-mosaic`      | Picture Mosaic      | title, subtitle, body ×1             |
| `big-number`              | Big Number          | title, body ×2                       |
| `slide-pricing-table`     | Pricing Table       | title, subtitle                      |
| `slide-stat-image`        | Number and Picture  | title, subtitle, body ×2             |
| `key-stats`               | Key Stats           | title, subtitle, body ×1             |
| `chart-story`             | Chart Story         | title, subtitle, body ×5             |
| `comparison`              | Comparison          | title, subtitle, body ×9             |
| `slide-three-stats`       | Three Big Numbers   | title, body ×7                       |
| `slide-big-chart`         | Big Chart           | title, subtitle, body ×2             |
| `slide-chart-insights`    | Chart and Insights  | title, body ×4                       |
| `slide-goals`             | Goals Progress      | title, body ×6                       |
| `kpi-dashboard`           | KPI Dashboard       | title, subtitle, body ×6             |
| `market-share`            | Market Share        | title, subtitle, body ×3             |
| `process`                 | Process             | title, subtitle, body ×5             |
| `timeline`                | Timeline            | title, subtitle                      |
| `roadmap`                 | Roadmap             | title, subtitle, body ×12            |
| `slide-process-flow`      | Process Flow        | title, subtitle, body ×8             |
| `slide-milestones`        | Milestones          | title, body ×5                       |
| `slide-now-next-later`    | Now, Next, Later    | title, bullets ×9, body ×3           |
| `funnel`                  | Funnel              | title, subtitle, body ×8             |
| `cycle`                   | Cycle               | title, body ×8                       |
| `project-plan`            | Project Plan        | title, body ×22                      |
| `slide-closing`           | Thank You           | title, body ×2                       |
| `team`                    | Team                | title, subtitle, body ×12            |
| `slide-team-three`        | Team of Three       | title, body ×9                       |
| `slide-summary`           | Summary             | title, body ×6                       |
| `slide-cta`               | Call to Action      | title, body ×3                       |
| `slide-next-steps`        | Next Steps          | title, subtitle, body ×11            |
| `slide-contact`           | Contact             | title, subtitle, body ×3             |
| `slide-questions`         | Questions           | title, subtitle                      |
| `slide-thanks-image`      | Thank You and Image | title, subtitle, body ×1             |
| `slide-resources`         | Resources           | title, body ×8                       |

## Infographics

| Layout                   | Name                  | Slots                                |
| ------------------------ | --------------------- | ------------------------------------ |
| `title`                  | Title Page            | title, subtitle, body ×2             |
| `big-number`             | Big Number            | title, body ×2                       |
| `key-stats`              | Key Stats             | title, subtitle, body ×1             |
| `process`                | Process               | title, subtitle, body ×8             |
| `timeline`               | Timeline              | title, subtitle, body ×10            |
| `comparison`             | Comparison            | title, subtitle, body ×9             |
| `chart-story`            | Chart Story           | title, subtitle, body ×5             |
| `top-tips`               | Top Tips              | title, subtitle, body ×4             |
| `quote`                  | Quote                 | title, body ×2                       |
| `team`                   | Team                  | title, subtitle, body ×12            |
| `facts-grid`             | Facts Grid            | title, subtitle, body ×7             |
| `checklist`              | Checklist             | title, subtitle, bullets ×3, body ×4 |
| `event`                  | Event                 | title, subtitle, body ×4             |
| `section-divider`        | Section Divider       | title, subtitle                      |
| `poster`                 | Poster                | title, subtitle, body ×1             |
| `survey-results`         | Survey Results        | title, subtitle, body ×1             |
| `progress-report`        | Progress Report       | title, subtitle, body ×5             |
| `roadmap`                | Roadmap               | title, subtitle, body ×12            |
| `agenda`                 | Agenda                | title, subtitle, body ×12            |
| `questions`              | Questions and Answers | title, body ×8                       |
| `profile`                | Profile               | title, subtitle, body ×1             |
| `pros-cons`              | Pros and Cons         | title, subtitle, body ×11            |
| `before-after`           | Before and After      | title, subtitle, body ×9             |
| `feature-matrix`         | Feature Matrix        | title, subtitle, body ×9             |
| `announcement`           | Announcement          | title, subtitle, body ×2             |
| `did-you-know`           | Did You Know?         | title, subtitle, body ×1             |
| `save-the-date`          | Save the Date         | title, body ×5                       |
| `pictogram`              | Pictogram             | title, subtitle, body ×2             |
| `ranking`                | Ranking               | title, subtitle, body ×6             |
| `cycle`                  | Cycle                 | title, subtitle, body ×8             |
| `funnel`                 | Funnel                | title, subtitle, body ×8             |
| `report-cover`           | Report Cover          | title, subtitle, body ×6             |
| `magazine-cover`         | Magazine Cover        | title, body ×9                       |
| `book-cover`             | Book Cover            | title, subtitle, body ×3             |
| `proposal-cover`         | Proposal Cover        | title, subtitle, body ×14            |
| `case-study-cover`       | Case Study            | title, subtitle, body ×7             |
| `newsletter-front`       | Newsletter            | title, subtitle, body ×9             |
| `contents`               | Contents              | title, subtitle, body ×13            |
| `certificate`            | Certificate           | title, subtitle, body ×7             |
| `gig-poster`             | Gig Poster            | title, body ×8                       |
| `research-poster`        | Research Poster       | title, body ×17                      |
| `coming-soon`            | Coming Soon           | title, body ×5                       |
| `exhibition`             | Exhibition            | title, body ×13                      |
| `travel-poster`          | Travel                | title, subtitle, body ×7             |
| `workshop`               | Workshop              | title, body ×14                      |
| `hiring`                 | We're Hiring          | title, body ×13                      |
| `big-sale`               | Big Sale              | title, body ×9                       |
| `notice`                 | Notice                | title, body ×6                       |
| `motivational`           | Motivational          | title, body ×6                       |
| `kpi-dashboard`          | KPI Dashboard         | title, subtitle, body ×6             |
| `trend-story`            | Trend Story           | title, subtitle, body ×11            |
| `market-share`           | Market Share          | title, subtitle, body ×2             |
| `stat-mosaic`            | Stat Mosaic           | title, subtitle, body ×6             |
| `staircase`              | Staircase             | title, subtitle, body ×10            |
| `customer-journey`       | Customer Journey      | title, subtitle, body ×19            |
| `project-plan`           | Project Plan          | title, subtitle, body ×19            |
| `decision-flow`          | Decision Flow         | title, subtitle, body ×8             |
| `how-to`                 | How-To                | title, subtitle, body ×15            |
| `versus`                 | Versus                | title, subtitle, body ×10            |
| `pricing-tiers`          | Pricing Tiers         | title, subtitle, body ×25            |
| `swot`                   | SWOT                  | title, bullets ×12, body ×12         |
| `effort-impact`          | Effort vs Impact      | title, subtitle, body ×17            |
| `scorecard`              | Scorecard             | title, subtitle, body ×20            |
| `spectrum`               | Spectrum              | title, subtitle, body ×22            |
| `venn`                   | Venn                  | title, subtitle, body ×12            |
| `three-options`          | Three Options         | title, subtitle, body ×19            |
| `org-chart`              | Org Chart             | title, subtitle, body ×20            |
| `testimonials`           | Testimonials          | title, subtitle, body ×10            |
| `meet-the-speakers`      | Meet the Speakers     | title, subtitle, body ×13            |
| `employee-spotlight`     | Spotlight             | title, subtitle, body ×10            |
| `values`                 | Our Values            | title, subtitle, body ×12            |
| `idea-board`             | Idea Board            | title, subtitle, body ×7             |
| `persona`                | Persona               | title, subtitle, body ×12            |
| `shout-outs`             | Shout-outs            | title, subtitle, body ×10            |
| `carousel-cover`         | Carousel Cover        | title, body ×7                       |
| `tip-of-the-day`         | Tip of the Day        | title, body ×8                       |
| `milestone`              | Milestone             | title, subtitle, body ×4             |
| `behind-the-scenes`      | Behind the Scenes     | title, body ×8                       |
| `countdown`              | Countdown             | title, body ×8                       |
| `product-spotlight`      | Product Spotlight     | title, subtitle, body ×4             |
| `giveaway`               | Giveaway              | title, subtitle, body ×6             |
| `welcome`                | Welcome Aboard        | title, subtitle, body ×6             |
| `webinar`                | Webinar               | title, body ×9                       |
| `explain-how-it-works`   | How It Works          | title, subtitle, body ×10            |
| `explain-anatomy`        | Anatomy               | title, subtitle, body ×12            |
| `explain-key-concepts`   | Key Concepts          | title, subtitle, body ×13            |
| `explain-cheat-sheet`    | Cheat Sheet           | title, subtitle, body ×37            |
| `explain-glossary`       | Glossary              | title, subtitle, body ×24            |
| `explain-myths-facts`    | Myths and Facts       | title, subtitle, body ×11            |
| `explain-fact-file`      | Fact File             | title, subtitle, body ×2             |
| `explain-lesson-summary` | Lesson Summary        | title, subtitle, body ×20            |
| `explain-formula`        | Formula Explained     | title, body ×18                      |
