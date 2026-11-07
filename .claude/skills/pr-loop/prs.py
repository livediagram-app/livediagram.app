#!/usr/bin/env python3
"""Every open PR of the signed-in gh user and of Dependabot, from ONE GraphQL call (pr-loop sections 1 and 2.6).

  prs.py digest    one line per PR with what it needs; exit 0
  prs.py watch     wait for a change worth acting on, print it, exit (run as a background Bash command)
  prs.py running   exit 0 (and print the pid) if a watcher already runs, else 1

digest: `#<n> <ACTION> | checks | merge state | labels | threads | comments | <sha> <title>`, PRs
needing work first. ACTION is CONFLICT, RED, COMMENTS, MERGE, CHECK (green but GitHub won't call it
CLEAN), WAIT-CI or WAIT-PERSON (green behind a not-ready/do-not-merge label). A trailing `new`
marks a line that differs from the last digest; a line without it was already reported.

watch: polls once a minute and compares with the state the last watcher saved under .git, so a
PR that changed between two watchers is still reported (with no saved state the first poll is
the baseline). Exits at the first PR that went RED, GREEN or CONFLICTING or got a new comment or
review (COMMENTED). One watcher per clone (pid file); exits with TIMEOUT after WATCH_MAX_HOURS
(default 4) so an orphan can't hold the lock.
"""
import json, os, re, shutil, subprocess, sys, time

GH = shutil.which("gh") or "/opt/homebrew/bin/gh"
POLL = int(os.environ.get("WATCH_POLL_SECONDS", "60"))
MAX_SECONDS = float(os.environ.get("WATCH_MAX_HOURS", "4")) * 3600
FAILED = {"FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE", "ERROR"}
BLOCKING = {"not-ready", "do-not-merge"}
BOTS = {"dependabot"}  # bot authors whose PRs the loop also works (GraphQL login, no [bot])
QUERY = """query($owner:String!,$name:String!){viewer{login}repository(owner:$owner,name:$name){
pullRequests(states:OPEN,first:100,orderBy:{field:CREATED_AT,direction:ASC}){nodes{
number title isDraft mergeable mergeStateStatus author{login} labels(first:20){nodes{name}}
commits(last:1){nodes{commit{oid committedDate statusCheckRollup{contexts(first:100){nodes{__typename
...on CheckRun{name status conclusion} ...on StatusContext{context state}}}}}}}
reviewThreads(first:100){nodes{isResolved}}
comments(last:50){nodes{author{login} createdAt}} reviews(last:50){nodes{author{login} submittedAt body}}}}}}"""


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout.strip()


def repo():
    m = re.search(r"github\.com[:/](.+?)/(.+?)(\.git)?$", git("remote", "get-url", "origin"))
    return m.group(1), m.group(2)


def fetch(owner, name):
    """Open PRs authored by the gh user or a BOTS author, keyed by number."""
    out = subprocess.run([GH, "api", "graphql", "-f", f"query={QUERY}", "-F", f"owner={owner}", "-F", f"name={name}"],
                         capture_output=True, text=True, check=True).stdout
    data = json.loads(out)["data"]
    me = data["viewer"]["login"]
    return {p["number"]: p for p in data["repository"]["pullRequests"]["nodes"] if (p["author"] or {}).get("login") in BOTS | {me}}


def head(pr):
    nodes = pr["commits"]["nodes"]
    return nodes[0]["commit"] if nodes else {}


def checks(pr):
    """(failed names, pending count, total)."""
    roll = head(pr).get("statusCheckRollup") or {}
    nodes = (roll.get("contexts") or {}).get("nodes") or []
    failed, pending = [], 0
    for c in nodes:
        if c["__typename"] == "StatusContext":
            if c["state"] in FAILED:
                failed.append(c["context"])
            elif c["state"] != "SUCCESS":
                pending += 1
        elif c.get("status") != "COMPLETED":
            pending += 1
        elif c.get("conclusion") in FAILED:
            failed.append(c["name"])
    return sorted(set(failed)), pending, len(nodes)


def classify(pr):
    """RED, CONFLICTING, GREEN or PENDING."""
    failed, pending, total = checks(pr)
    if pr["mergeable"] == "CONFLICTING":
        return "CONFLICTING"
    if failed:
        return "RED"
    if pending or not total or pr["mergeable"] == "UNKNOWN":
        return "PENDING"
    return "GREEN"


def talk(pr):
    return len(pr["comments"]["nodes"]) + len(pr["reviews"]["nodes"])


def since_head(pr):
    """Comments and non-empty reviews newer than the head commit: (all, from bots)."""
    t = head(pr).get("committedDate", "")
    items = [(c["author"] or {}).get("login", "") for c in pr["comments"]["nodes"] if c["createdAt"] > t]
    items += [(r["author"] or {}).get("login", "") for r in pr["reviews"]["nodes"]
              if r["submittedAt"] and r["submittedAt"] > t and r["body"].strip()]
    return len(items), sum(a.endswith("[bot]") or a == "github-actions" for a in items)


ORDER = ["CONFLICT", "RED", "COMMENTS", "MERGE", "CHECK", "WAIT-CI", "WAIT-PERSON"]


def digest_line(pr):
    failed, pending, total = checks(pr)
    labels = sorted(l["name"] for l in pr["labels"]["nodes"])
    threads = sum(not t["isResolved"] for t in pr["reviewThreads"]["nodes"])
    fresh, bots = since_head(pr)
    state = classify(pr)
    if state == "CONFLICTING":
        action = "CONFLICT"
    elif state == "RED":
        action = "RED"
    elif threads or fresh:
        action = "COMMENTS"
    elif state == "PENDING":
        action = "WAIT-CI"
    elif BLOCKING & set(labels) or pr["isDraft"]:
        action = "WAIT-PERSON"
    elif pr["mergeStateStatus"] == "CLEAN":
        action = "MERGE"
    else:
        action = "CHECK"
    check_txt = f"red [{', '.join(failed)}] +{pending} running" if failed else (
        f"{pending}/{total} running" if pending else f"{total} passed")
    body = (f"{action} | {check_txt} | {pr['mergeable']} {pr['mergeStateStatus']} | labels {','.join(labels) or '-'} | "
            f"threads {threads} | comments since head {fresh}{f' ({bots} bot)' if bots else ''} | "
            f"{head(pr).get('oid', '')[:7]} {pr['title'][:70]}")
    return action, f"#{pr['number']} {body}"


def state_path(kind):
    return os.path.join(os.path.abspath(git("rev-parse", "--git-common-dir")), f"pr-loop.{kind}")


def load(path, default):
    try:
        return json.load(open(path))
    except (OSError, ValueError):
        return default


def digest():
    prs = fetch(*repo())
    path = state_path("digest.json")
    last = load(path, {})
    rows = sorted((digest_line(p) for p in prs.values()), key=lambda r: (ORDER.index(r[0]), r[1]))
    for _, text in rows:
        body = text.split(" ", 1)[1]
        n = text.split(" ", 1)[0]
        print(text + ("" if last.get(n) == body else "  new"))
    json.dump({t.split(" ", 1)[0]: t.split(" ", 1)[1] for _, t in rows}, open(path, "w"))
    if not rows:
        print("no open PRs")


def running_pid(path):
    try:
        pid = int(open(path).read().strip())
        os.kill(pid, 0)
        return pid
    except (OSError, ValueError):
        return None


def watch_line(pr, state):
    detail = f" [{', '.join(checks(pr)[0])}]" if state == "RED" else ""
    return f"PR {pr['number']}: {state}{detail} ({pr['mergeable']} {pr['mergeStateStatus']}) {pr['title'][:60]}"


def watch():
    pid_path, saved_path = state_path("watch.pid"), state_path("watch.json")
    pid = running_pid(pid_path)
    if pid:
        print(f"ALREADY WATCHING (pid {pid})")
        return
    open(pid_path, "w").write(str(os.getpid()))
    owner, name = repo()
    saved = load(saved_path, None)
    seen = {int(n): v for n, v in saved["states"].items()} if saved else None
    said = {int(n): v for n, v in saved["talk"].items()} if saved else {}
    start = time.monotonic()
    try:
        while time.monotonic() - start < MAX_SECONDS:
            try:
                prs = fetch(owner, name)
            except (subprocess.CalledProcessError, ValueError, KeyError, TypeError):
                time.sleep(POLL)  # GitHub unreachable for a moment: try again next round
                continue
            states = {n: classify(p) for n, p in prs.items()}
            counts = {n: talk(p) for n, p in prs.items()}
            json.dump({"states": states, "talk": counts}, open(saved_path, "w"))
            if seen is not None:
                events = [watch_line(prs[n], s) for n, s in sorted(states.items())
                          if s != "PENDING" and s != seen.get(n, "PENDING")]
                events += [f"PR {n}: COMMENTED {c - said[n]} new {prs[n]['title'][:60]}"
                           for n, c in sorted(counts.items()) if n in said and c > said[n]]
                if events:
                    print("\n".join(events))
                    return
            seen, said = states, counts
            time.sleep(POLL)
        print(f"TIMEOUT after {MAX_SECONDS / 3600:g}h with no change")
    finally:
        if running_pid(pid_path) == os.getpid():
            os.remove(pid_path)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "digest":
        digest()
    elif cmd == "watch":
        watch()
    elif cmd == "running":
        pid = running_pid(state_path("watch.pid"))
        if pid:
            print(pid)
        sys.exit(0 if pid else 1)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
