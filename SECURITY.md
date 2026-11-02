# Security policy

## Reporting a vulnerability

Please report security vulnerabilities **privately** through GitHub:

**[Report a vulnerability](https://github.com/livediagram-app/livediagram.app/security/advisories/new)**

This opens a private security advisory that only you and the maintainers can see. It is the one channel for
liveworkspace.app and every app on it. Do not open a public issue, discussion or pull request for a security problem,
and please do not post it on social media. There is no security mailbox: a report sent through the contact form is
not ignored, but we will ask you to move it to a private advisory.

Each app's help centre holds its full policy, covering scope, rules for testing, safe harbour and what to expect:

| Site              | Policy                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| liveworkspace.app | This file. The accounts, Explorer, Drive, media, Community, telemetry and status services, and the site at www.liveworkspace.app. |
| livediagram.app   | [livediagram.app/help/policies/report-a-vulnerability](https://www.livediagram.app/help/policies/report-a-vulnerability/)         |
| liveplanner.app   | [liveplanner.app/help/policies/report-a-vulnerability](https://www.liveplanner.app/help/policies/report-a-vulnerability/)         |
| livedocuments.app | [livedocuments.app/help/policies/report-a-vulnerability](https://www.livedocuments.app/help/policies/report-a-vulnerability/)     |
| livedesign.app    | [livedesign.app/help/policies/report-a-vulnerability](https://www.livedesign.app/help/policies/report-a-vulnerability/)           |

Every site also publishes these details at `/.well-known/security.txt`.

In short, for every site:

- **In scope:** the hosted services at the sites above and the subdomains we run (such as `mcp.livediagram.app`),
  the published CLIs and MCP servers, and the source code in this repository.
- **Out of scope:** third-party services we rely on (Cloudflare, GitHub, Google), which are reported to those
  vendors; reports from automated scanners, missing headers or best-practice settings with no demonstrated impact;
  anything that relies on a share link you were given (a share link is a key by design); and social engineering.
- **Rules for testing:** use only accounts and work you own or have permission to test; stop as soon as you reach
  someone else's data and do not keep, share or change it; no denial-of-service or load tests; and give us a
  reasonable time to fix the issue before disclosing it, agreeing the disclosure with us.
- **Safe harbour:** good-faith research that follows these rules is authorised, and we will not take legal action
  over it. If you are unsure whether something is allowed, ask in the advisory first.
- Every app is free with no paid tier, so there is **no bug bounty** and **no guaranteed response time**. Every
  report is read, handled in good faith, kept confidential while open, fixed before details are published, and
  credited in the published advisory unless you would rather it wasn't.

## Supported versions

Only what the live sites run (the latest `main`) receives security fixes.
