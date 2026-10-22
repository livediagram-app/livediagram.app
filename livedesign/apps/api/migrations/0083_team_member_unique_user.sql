-- One membership row per person per team (docs/specs/013-workspace/teams.md "Members"). The lazy
-- invite claim used to attach every unclaimed invite for an email, even in a team that person had
-- already joined by link, leaving two rows for one user: the team listed them twice and removing
-- one row left the other holding access.
--
-- 1. Keep the best row of each duplicate set: joined before invited, then the oldest. If any row in
--    the set was a joined admin, the keeper keeps that admin role, so a dedupe never strands a team
--    without its admin.
UPDATE team_members SET role = 'admin'
WHERE user_id IS NOT NULL
  AND id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY team_id, user_id
        ORDER BY CASE status WHEN 'joined' THEN 0 ELSE 1 END, created_at, id
      ) AS rn
      FROM team_members WHERE user_id IS NOT NULL
    ) WHERE rn = 1
  )
  AND EXISTS (
    SELECT 1 FROM team_members dup
    WHERE dup.team_id = team_members.team_id AND dup.user_id = team_members.user_id
      AND dup.role = 'admin' AND dup.status = 'joined'
  );

DELETE FROM team_members
WHERE user_id IS NOT NULL
  AND id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY team_id, user_id
        ORDER BY CASE status WHEN 'joined' THEN 0 ELSE 1 END, created_at, id
      ) AS rn
      FROM team_members WHERE user_id IS NOT NULL
    ) WHERE rn = 1
  );

-- 2. Then the database refuses a second row for the same user in a team. Pending email invites
--    (user_id NULL) stay outside it; UNIQUE(team_id, email) already covers those.
CREATE UNIQUE INDEX team_members_team_user_unique
  ON team_members (team_id, user_id) WHERE user_id IS NOT NULL;
