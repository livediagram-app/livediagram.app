# Identity

Follow the references below only as needed; never upfront.

- ./auth-and-guest-access.md - when working on Auth + guest access: sign-in through the liveworkspace accounts Worker, but the canvas always works without sign-in; guest designs start This Browser, and signing in offers to move them
- ./sign-in-encouragement.md - when working on Sign-in encouragement: Dismissible guest banner (Explorer + delayed in-editor) + "why sign in" modal
- ./transactional-email.md - when working on Transactional email: Optional email through Cloudflare Email Service, gated on the `EMAIL` binding: welcome + week-1 (Explorer) + week-2 (Teams) onboarding series off the daily cron, plus transactional team-invite and account-deleted emails. Off (no sends) without the binding
- ./profile-and-email-notifications.md - when working on Account settings & email notifications: Signed-in account home in the Explorer (avatar, name, email, join date); delete-account moves here; two opt-out email notifications (someone joins my design, someone responds to my team invite), gated like [Transactional email](transactional-email.md)
- ./phone-notifications.md - when working on Phone notifications: which comments, replies, mentions and assigned actions notify a phone, who hears, and the links a tap opens (the platform sends)
