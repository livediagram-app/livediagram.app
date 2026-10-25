# Identity

Follow the references below only as needed; never upfront.

- ./auth-and-guest-access.md - when working on Auth + guest access: sign-in through the liveworkspace accounts Worker, and guests whose identity (a year-long guest token) comes from liveworkspace too, the same in every app; the canvas always works without sign-in; a guest's new projects start in This Browser (a signed-in person's on liveplanner), and signing in offers to move them
- ./sign-in-encouragement.md - when working on Sign-in encouragement: Dismissible guest banner (Explorer + delayed in-editor) + "why sign in" modal
- ./transactional-email.md - when working on Transactional email: Optional Cloudflare Email Service integration, gated on the `EMAIL` binding: new-comment, form and account-deleted emails (onboarding and team emails are sent by liveworkspace). Off (no sends) without the binding
- ./profile-and-email-notifications.md - when working on Account settings & email notifications: Signed-in account home in the Explorer (avatar, name, email, join date); delete-account moves here; the opt-out email notification switches (someone joins my project, someone responds to my team invite), gated like [Transactional email](transactional-email.md)
