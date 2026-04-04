-- Add wide (leaderboard) and tall (skyscraper) banner format columns
ALTER TABLE ads ADD COLUMN image_wide TEXT;
ALTER TABLE ads ADD COLUMN image_tall TEXT;
