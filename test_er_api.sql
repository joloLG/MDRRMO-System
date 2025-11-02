-- Test the ER team assigned API
-- Replace 'your-auth-token-here' with the actual auth token
-- This simulates what the ER team dashboard does

-- First, let's check what happens when we call the API
SELECT
  er.id,
  er.status,
  er.emergency_type,
  er.er_team_id,
  er.responded_at,
  er.created_at,
  etu.user_id,
  etu.er_team_id as user_team_id
FROM emergency_reports er
LEFT JOIN er_team_users etu ON etu.er_team_id = er.er_team_id
WHERE er.er_team_id IS NOT NULL
ORDER BY er.responded_at DESC, er.created_at DESC
LIMIT 10;

-- response

[
  {
    "id": "1d25fe53-0413-4555-b431-157510641e18",
    "status": "responded",
    "emergency_type": "Fire Incident",
    "er_team_id": 1,
    "responded_at": "2025-11-02 02:56:00.328+00",
    "created_at": "2025-11-02 02:29:09.685+00",
    "user_id": "11a1e606-5204-4293-97dc-06a7a6cceeca",
    "user_team_id": 1
  },
  {
    "id": "cc2c4f33-d6fc-4085-bcae-6b709067c14c",
    "status": "resolved",
    "emergency_type": "Fire Incident",
    "er_team_id": 1,
    "responded_at": "2025-11-02 01:51:54.035+00",
    "created_at": "2025-11-02 01:48:04.019+00",
    "user_id": "11a1e606-5204-4293-97dc-06a7a6cceeca",
    "user_team_id": 1
  },
  {
    "id": "d15ef01c-687a-4256-9104-88c1ec7a5ffc",
    "status": "resolved",
    "emergency_type": "Fire Incident",
    "er_team_id": 1,
    "responded_at": "2025-11-02 01:48:16.024+00",
    "created_at": "2025-11-02 01:48:05.298+00",
    "user_id": "11a1e606-5204-4293-97dc-06a7a6cceeca",
    "user_team_id": 1
  },
  {
    "id": "603836c7-1ce7-40a4-a682-06cda1d01159",
    "status": "responded",
    "emergency_type": "Fire Incident",
    "er_team_id": 1,
    "responded_at": "2025-11-01 17:11:02.453+00",
    "created_at": "2025-11-01 16:27:22.614+00",
    "user_id": "11a1e606-5204-4293-97dc-06a7a6cceeca",
    "user_team_id": 1
  },
  {
    "id": "9d868d2b-00f6-4665-b4c5-416e6ce8d770",
    "status": "responded",
    "emergency_type": "Fire Incident",
    "er_team_id": 1,
    "responded_at": "2025-11-01 17:10:48.649+00",
    "created_at": "2025-11-01 16:29:51.423+00",
    "user_id": "11a1e606-5204-4293-97dc-06a7a6cceeca",
    "user_team_id": 1
  },
  {
    "id": "8706ea6e-a1aa-41cd-b2d4-e96ec047c9e3",
    "status": "responded",
    "emergency_type": "Fire Incident",
    "er_team_id": 1,
    "responded_at": "2025-11-01 17:09:52.227+00",
    "created_at": "2025-11-01 16:30:13.39+00",
    "user_id": "11a1e606-5204-4293-97dc-06a7a6cceeca",
    "user_team_id": 1
  },
  {
    "id": "d88b2f61-c99a-4e33-8ac9-9867533a7f8b",
    "status": "responded",
    "emergency_type": "Fire Incident",
    "er_team_id": 1,
    "responded_at": "2025-11-01 17:09:40.382+00",
    "created_at": "2025-11-01 17:08:42.466+00",
    "user_id": "11a1e606-5204-4293-97dc-06a7a6cceeca",
    "user_team_id": 1
  },
  {
    "id": "3626df9e-022d-447b-8669-539803648cf5",
    "status": "responded",
    "emergency_type": "Fire Incident",
    "er_team_id": 1,
    "responded_at": "2025-11-01 17:07:54.404+00",
    "created_at": "2025-11-01 16:33:14.606+00",
    "user_id": "11a1e606-5204-4293-97dc-06a7a6cceeca",
    "user_team_id": 1
  },
  {
    "id": "84e6319e-1843-4d42-b244-4db2c745a685",
    "status": "responded",
    "emergency_type": "Fire Incident",
    "er_team_id": 1,
    "responded_at": "2025-11-01 16:56:46.722+00",
    "created_at": "2025-11-01 16:42:03.314+00",
    "user_id": "11a1e606-5204-4293-97dc-06a7a6cceeca",
    "user_team_id": 1
  },
  {
    "id": "997defa8-a2a3-481b-a845-187ed914bf20",
    "status": "responded",
    "emergency_type": "Fire Incident",
    "er_team_id": 1,
    "responded_at": "2025-11-01 16:22:34.393+00",
    "created_at": "2025-11-01 16:20:04.231+00",
    "user_id": "11a1e606-5204-4293-97dc-06a7a6cceeca",
    "user_team_id": 1
  }
]