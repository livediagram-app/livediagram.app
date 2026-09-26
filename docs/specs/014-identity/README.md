# Identity

Follow the references below only as needed; never upfront.

- ./auth-and-guest-access.md - when working on Auth + guest access: Clerk auth — but the canvas always works without sign-in
- ./sign-in-encouragement.md - when working on Sign-in encouragement: Dismissible guest banner (Explorer + delayed in-editor) + "why sign in" modal
- ./transactional-email.md - when working on Transactional & lifecycle email (Resend): Optional Resend integration, gated on `RESEND_API_KEY`: welcome + week-1 (Explorer) + week-2 (Teams) onboarding series off the daily cron, plus transactional team-invite and account-deleted emails. Off (no sends) when the key is unset
- ./profile-and-email-notifications.md - when working on Account settings & email notifications: Signed-in account home in the Explorer (avatar, name, email, join date); delete-account moves here; two opt-out email notifications (someone joins my diagram, someone responds to my team invite), gated like [Transactional & lifecycle email (Resend)](transactional-email.md)
