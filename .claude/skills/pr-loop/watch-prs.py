#!/usr/bin/env python3
"""One watcher over every open PR of the signed-in gh user (pr-loop step 6).

  watch-prs.py            watch; exit at the first change worth acting on
  watch-prs.py --running  exit 0 (and print the pid) if a watcher already runs, else 1
  watch-prs.py --status   print each open PR's state now and exit

Run it as a background Bash command, not a Monitor: it wakes the loop once, when it exits.
It polls once a minute with ONE gh call for all PRs. The first poll is the baseline (the
pass that started it has already seen those states); after that it prints one line per PR
whose state changed to RED (a check failed or was cancelled), GREEN (every check passed and
GitHub has worked out mergeability) or CONFLICTING, or that got a new comment or review
(COMMENTED), and exits. A PR opened later is
watched from PENDING, so its first result is reported. Merged and closed PRs drop out
silently. Only one watcher runs per clone (a pid file under .git); a second start exits.
After WATCH_MAX_HOURS (default 4) it prints TIMEOUT and exits, so an orphan can't hold the
lock for ever.
"""
import json, os, shutil, subprocess, sys, time

GH = shutil.which("gh") or "/opt/homebrew/bin/gh"
POLL = int(os.environ.get("WATCH_POLL_SECONDS", "60"))
MAX_SECONDS = float(os.environ.get("WATCH_MAX_HOURS", "4")) * 3600
FAILED = {"FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE", "ERROR"}


def gh(*args):
    return subprocess.run([GH, *args], capture_output=True, text=True, check=True).stdout.strip()


def pid_file():
    common = subprocess.run(["git", "rev-parse", "--git-common-dir"], capture_output=True, text=True, check=True)
    return os.path.join(os.path.abspath(common.stdout.strip()), "pr-watch.pid")


def running_pid(path):
    try:
        pid = int(open(path).read().strip())
        os.kill(pid, 0)
        return pid
    except (OSError, ValueError):
        return None


def classify(pr):
    """RED, CONFLICTING, GREEN or PENDING for one entry of `gh pr list --json`."""
    checks = pr.get("statusCheckRollup") or []
    failed, pending = [], 0
    for c in checks:
        name = c.get("name") or c.get("context") or "?"
        if c.get("__typename") == "StatusContext":
            state = c.get("state")
            if state in FAILED:
                failed.append(name)
            elif state != "SUCCESS":
                pending += 1
        elif c.get("status") != "COMPLETED":
            pending += 1
        elif c.get("conclusion") in FAILED:
            failed.append(name)
    if pr.get("mergeable") == "CONFLICTING":
        return "CONFLICTING", ""
    if failed:
        return "RED", f"[{', '.join(sorted(set(failed)))}] {pending} still running"
    if pending or not checks or pr.get("mergeable") == "UNKNOWN":
        return "PENDING", ""
    return "GREEN", ""


def poll(repo, login):
    out = gh("pr", "list", "-R", repo, "--author", login, "--state", "open", "--limit", "100",
             "--json", "number,title,mergeable,mergeStateStatus,statusCheckRollup,comments,reviews")
    return {pr["number"]: pr for pr in json.loads(out)}


def line(pr, state, detail):
    extra = f" {detail}" if detail else ""
    return f"PR {pr['number']}: {state}{extra} ({pr.get('mergeable')} {pr.get('mergeStateStatus')}) {pr['title'][:60]}"


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    path = pid_file()
    if arg == "--running":
        pid = running_pid(path)
        print(pid or "", end="\n" if pid else "")
        sys.exit(0 if pid else 1)
    repo = gh("repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner")
    login = gh("api", "user", "-q", ".login")
    if arg == "--status":
        for pr in poll(repo, login).values():
            print(line(pr, *classify(pr)))
        return
    pid = running_pid(path)
    if pid:
        print(f"ALREADY WATCHING (pid {pid})")
        return
    open(path, "w").write(str(os.getpid()))
    try:
        seen, start = None, time.monotonic()
        while time.monotonic() - start < MAX_SECONDS:
            try:
                prs = poll(repo, login)
            except (subprocess.CalledProcessError, json.JSONDecodeError):
                time.sleep(POLL)  # GitHub unreachable for a moment: try again next round
                continue
            now = {n: classify(pr) for n, pr in prs.items()}
            talk = {n: len(pr.get("comments") or []) + len(pr.get("reviews") or []) for n, pr in prs.items()}
            if seen is not None:
                events = [line(prs[n], *now[n]) for n in sorted(now)
                          if now[n][0] != "PENDING" and now[n][0] != seen.get(n, ("PENDING",))[0]]
                events += [f"PR {n}: COMMENTED {talk[n] - said.get(n, 0)} new {prs[n]['title'][:60]}"
                           for n in sorted(talk) if n in said and talk[n] > said[n]]
                if events:
                    print("\n".join(events))
                    return
            seen, said = now, talk
            time.sleep(POLL)
        print(f"TIMEOUT after {MAX_SECONDS / 3600:g}h with no change")
    finally:
        if running_pid(path) == os.getpid():
            os.remove(path)


if __name__ == "__main__":
    main()
