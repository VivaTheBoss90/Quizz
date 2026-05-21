-- Migration: add party state columns and party_songs table
ALTER TABLE IF EXISTS parties
  ADD COLUMN IF NOT EXISTS current_song_index INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_game_started TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buzz_active TINYINT(1) DEFAULT 0;

CREATE TABLE IF NOT EXISTS party_songs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  party_id INT NOT NULL,
  song_id INT NOT NULL,
  song_order INT NOT NULL,
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
  INDEX (party_id)
);
