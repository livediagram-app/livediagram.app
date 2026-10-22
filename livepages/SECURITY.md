# Security policy

## Reporting a vulnerability

Please report security vulnerabilities **privately** through GitHub:

**[Report a vulnerability](https://github.com/livediagram-app/livediagram.app/security/advisories/new)**

Do not open a public issue, discussion or pull request for a security problem.

The full policy, covering scope, rules for testing, safe harbour and what to expect, is at
[livediagram.app/help/policies/report-a-vulnerability](https://livediagram.app/help/policies/report-a-vulnerability/).

In short:

- **In scope:** the hosted service at livediagram.app (and the subdomains we run, such as `mcp.livediagram.app`) and the source code in this repository.
- **Out of scope:** third-party services (Clerk, Cloudflare, Resend, GitHub), self-hosted copies run by others, and findings with no demonstrated security impact.
- **Safe harbour:** good-faith research that follows the policy is authorised, and we will not take legal action over it.
- livediagram is free with no paid tier, so there is **no bug bounty** and **no guaranteed response time**. Every report is read, handled in good faith, and credited in the published advisory unless you would rather it wasn't.

## Supported versions

Only the latest `main` (what livediagram.app runs) receives security fixes. Self-hosters should stay up to date with `main`.
