"""Pure-function tests for prs.py (no network): python3 -m unittest prs_test, from this folder."""
import unittest

import prs


def run(name, conclusion="SUCCESS", status="COMPLETED", id=1, workflow="CI"):
    return {"__typename": "CheckRun", "name": name, "status": status, "conclusion": conclusion, "databaseId": id,
            "checkSuite": {"workflowRun": {"workflow": {"name": workflow}}}}


def pr(n=1, contexts=None, mergeable="MERGEABLE", oid="a1"):
    contexts = [run("build")] if contexts is None else contexts
    return {"number": n, "title": f"PR {n}", "mergeable": mergeable,
            "commits": {"nodes": [{"commit": {"oid": oid, "statusCheckRollup": {"contexts": {"nodes": contexts}}}}]}}


RED = [run("build", "FAILURE")]
RUNNING = [run("build", None, "IN_PROGRESS")]


def polls(*prs_per_poll):
    """Feed successive polls through transitions(), as watch() does; the events of each poll after the first."""
    seen, heads, out = None, {}, []
    for p in prs_per_poll:
        prs_ = {p["number"]: p}
        seen_, changed = prs.transitions(prs_, seen, heads)
        if seen is not None:
            out.append([(n, seen_[n]) for n in changed])
        seen, heads = seen_, {n: prs.head(x).get("oid") for n, x in prs_.items()}
    return out


class Checks(unittest.TestCase):
    def test_rerun_latest_attempt_wins(self):
        # #1674: attempt 1 cancelled, attempt 2 passed on the same head
        p = pr(contexts=[run("build", "CANCELLED", id=10), run("test", "CANCELLED", id=11),
                         run("build", id=20), run("test", id=21)])
        self.assertEqual(prs.checks(p), ([], 0, 2))
        self.assertEqual(prs.classify(p), "GREEN")

    def test_rerun_still_running_is_pending_not_red(self):
        p = pr(contexts=[run("build", "FAILURE", id=10), run("build", None, "QUEUED", id=20)])
        self.assertEqual(prs.checks(p), ([], 1, 1))

    def test_newest_failure_still_red_whatever_the_order(self):
        p = pr(contexts=[run("build", "FAILURE", id=30), run("build", id=20)])
        self.assertEqual(prs.checks(p)[0], ["build"])

    def test_same_job_name_in_two_workflows_counts_twice(self):
        p = pr(contexts=[run("build", id=1, workflow="CI"), run("build", "FAILURE", id=2, workflow="E2E")])
        self.assertEqual(prs.checks(p), (["build"], 0, 2))

    def test_status_contexts_kept(self):
        p = pr(contexts=[run("build"), {"__typename": "StatusContext", "context": "deploy", "state": "ERROR"},
                         {"__typename": "StatusContext", "context": "preview", "state": "PENDING"}])
        self.assertEqual(prs.checks(p), (["deploy"], 1, 3))


class Classify(unittest.TestCase):
    def test_states(self):
        self.assertEqual(prs.classify(pr()), "GREEN")
        self.assertEqual(prs.classify(pr(mergeable="UNKNOWN")), "UNKNOWN")
        self.assertEqual(prs.classify(pr(contexts=RUNNING, mergeable="UNKNOWN")), "PENDING")
        self.assertEqual(prs.classify(pr(contexts=[])), "PENDING")
        self.assertEqual(prs.classify(pr(contexts=RED, mergeable="UNKNOWN")), "RED")
        self.assertEqual(prs.classify(pr(mergeable="CONFLICTING")), "CONFLICTING")

    def test_digest_waits_on_unknown(self):
        p = pr(mergeable="UNKNOWN")
        p.update(isDraft=False, mergeStateStatus="UNKNOWN", labels={"nodes": []}, reviewThreads={"nodes": []},
                 comments={"nodes": []}, reviews={"nodes": []})
        self.assertEqual(prs.digest_line(p)[0], "WAIT-CI")


class Transitions(unittest.TestCase):
    def test_first_poll_is_a_baseline(self):
        self.assertEqual(prs.transitions({1: pr()}, None, {})[1], [])

    def test_mergeability_recompute_after_merge_is_silent(self):
        self.assertEqual(polls(pr(), pr(mergeable="UNKNOWN"), pr(), pr(mergeable="UNKNOWN"), pr()), [[], [], [], []])

    def test_unknown_carries_red(self):
        self.assertEqual(polls(pr(contexts=RED), pr(contexts=RED, mergeable="UNKNOWN")), [[]])

    def test_rerun_red_pending_red_fires(self):
        self.assertEqual(polls(pr(contexts=RED), pr(contexts=RUNNING), pr(contexts=RED)), [[], [(1, "RED")]])

    def test_ci_finishing_fires_green(self):
        self.assertEqual(polls(pr(contexts=RUNNING), pr()), [[(1, "GREEN")]])

    def test_ci_finishing_while_unknown_fires_once_known(self):
        self.assertEqual(polls(pr(contexts=RUNNING), pr(mergeable="UNKNOWN"), pr()), [[], [(1, "GREEN")]])

    def test_conflicting_fires(self):
        self.assertEqual(polls(pr(), pr(mergeable="UNKNOWN"), pr(mergeable="CONFLICTING")), [[], [(1, "CONFLICTING")]])

    def test_new_head_then_green_fires(self):
        self.assertEqual(polls(pr(), pr(contexts=RUNNING, oid="b2"), pr(oid="b2")), [[], [(1, "GREEN")]])

    def test_new_head_seen_only_as_unknown_still_fires(self):
        # CI on the new head ran wholly between two polls and mergeability is still being worked out
        self.assertEqual(polls(pr(), pr(mergeable="UNKNOWN", oid="b2"), pr(oid="b2")), [[], [(1, "GREEN")]])

    def test_new_pr_seen_first_as_unknown(self):
        seen, changed = prs.transitions({2: pr(2, mergeable="UNKNOWN")}, {1: "GREEN"}, {1: "a1"})
        self.assertEqual((seen[2], changed), ("PENDING", []))
        self.assertEqual(prs.transitions({2: pr(2)}, seen, {2: "a1"})[1], [2])

    def test_saved_state_without_heads_keeps_the_last_state(self):
        # a watch.json written before heads were saved
        self.assertEqual(prs.transitions({1: pr(mergeable="UNKNOWN")}, {1: "GREEN"}, {}), ({1: "GREEN"}, []))


    def test_new_comments_fire(self):
        self.assertEqual(prs.new_talk({1: 3, 2: 1, 3: 5}, {1: 1, 2: 1}), [(1, 2)])


if __name__ == "__main__":
    unittest.main()
