-- Check ER teams and their users
SELECT
  et.id as team_id,
  et.name as team_name,
  etu.user_id,
  etu.created_at as assigned_at
FROM er_teams et
LEFT JOIN er_team_users etu ON et.id = etu.er_team_id
ORDER BY et.id, etu.created_at DESC;

-- response
[
  {
    "team_id": 1,
    "team_name": "Team Alpha",
    "user_id": "11a1e606-5204-4293-97dc-06a7a6cceeca",
    "assigned_at": "2025-10-29 08:47:05.949752+00"
  },
  {
    "team_id": 2,
    "team_name": "Team Bravo",
    "user_id": null,
    "assigned_at": null
  },
  {
    "team_id": 3,
    "team_name": "Team Charlie",
    "user_id": null,
    "assigned_at": null
  }
]