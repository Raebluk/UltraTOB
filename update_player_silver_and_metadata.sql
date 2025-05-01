-- SQL script to handle silver initialization and metadata updates
-- Part 1: Give 100 silver to players with >2000 exp who have 0 silver
-- Part 2: Update metadata for all players with silver > 0

-- Step 1: Update players with >2000 exp and 0 silver to have 100 silver
UPDATE player 
SET 
    silver = 100,
    updated_at = NOW()
WHERE 
    exp > 4845 
    AND silver = 0;

-- Step 2: Update metadata for all players who now have silver > 0
UPDATE player_metadata 
SET 
    init_silver_given = true,
    updated_at = NOW()
WHERE id IN (
    SELECT p.id 
    FROM player p 
    WHERE p.silver > 0
);

-- Optional: Check the results
-- Players who received initial silver (should be players with >2000 exp who had 0 silver):
-- SELECT COUNT(*) as players_given_initial_silver 
-- FROM player 
-- WHERE exp > 2000 AND silver = 100;

-- Players with metadata marked as init_silver_given = true:
-- SELECT COUNT(*) as players_with_silver_metadata 
-- FROM player_metadata pm 
-- JOIN player p ON pm.id = p.id 
-- WHERE pm.init_silver_given = true AND p.silver > 0;

-- Summary of all players with silver:
-- SELECT 
--     COUNT(*) as total_players_with_silver,
--     SUM(CASE WHEN silver = 100 THEN 1 ELSE 0 END) as players_with_100_silver,
--     SUM(CASE WHEN silver > 100 THEN 1 ELSE 0 END) as players_with_more_than_100_silver
-- FROM player 
-- WHERE silver > 0;
