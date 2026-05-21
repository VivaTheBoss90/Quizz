require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'quiz_musical_db',
  multipleStatements: false
});

function ensureColumn(table, column, definition, cb) {
  const q = `SHOW COLUMNS FROM \`${table}\` LIKE ?`;
  connection.query(q, [column], (err, rows) => {
    if (err) return cb(err);
    if (rows.length === 0) {
      const alter = `ALTER TABLE \`${table}\` ADD COLUMN ${definition}`;
      connection.query(alter, (aerr) => cb(aerr));
    } else cb(null);
  });
}

function ensureTable(sql, cb) {
  connection.query(sql, cb);
}

const tasks = [
  function (cb) {
    ensureColumn('parties', 'current_song_index', 'current_song_index INT DEFAULT 0', cb);
  },
  function (cb) {
    ensureColumn('parties', 'is_game_started', 'is_game_started TINYINT(1) DEFAULT 0', cb);
  },
  function (cb) {
    ensureColumn('parties', 'buzz_active', 'buzz_active TINYINT(1) DEFAULT 0', cb);
  },
  function (cb) {
    const createPS = `CREATE TABLE IF NOT EXISTS party_songs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      party_id INT NOT NULL,
      song_id INT NOT NULL,
      song_order INT NOT NULL,
      FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
      INDEX (party_id)
    ) ENGINE=InnoDB`;
    ensureTable(createPS, cb);
  }
];

function runTasks(i) {
  if (i >= tasks.length) {
    console.log('Migrations completed successfully.');
    connection.end();
    process.exit(0);
  }
  tasks[i]((err) => {
    if (err) {
      console.error('Migration step error:', err);
      connection.end();
      process.exit(2);
    }
    runTasks(i + 1);
  });
}

runTasks(0);
