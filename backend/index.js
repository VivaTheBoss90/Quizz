////////////////////////////////////////////////////////////////////////////////
// index.js - Code Complet
// - Gère l'état en mémoire via partyStates[partyId] => {
//     isGameStarted: boolean,
//     currentSongIndex: number,
//     buzzActive: boolean
//   }
// - Désactive la possibilité de buzzer si !isGameStarted ou !buzzActive
// - Si GM rafraîchit => joinGamemaster => on renvoie l'état + la chanson en cours
// - startGame => isGameStarted = true => countdown => startSong
// - handleNextBuzz(correct) => +5, stopMusic, isGameStarted reste true,
//                              buzzActive = false, 3s => nextSong => buzzActive = true
////////////////////////////////////////////////////////////////////////////////
require('dotenv').config();
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// 1) Servir /MP3
app.use(
  '/MP3',
  express.static(
    path.join(__dirname, '..', 'MP3')
  )
);

// 2) Middlewares
app.use(cors());
app.use(express.json());

// 3) Connexion BDD
const db = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'quiz_musical_db'
});
db.getConnection((err, connection) => {
  if (err) {
    console.error('Erreur de connexion MySQL :', err);
  } else {
    console.log('Connecté à MySQL !');
    connection.release();
    // Charger les parties actives en mémoire (si migrations appliquées)
    try {
      loadActiveParties();
    } catch (e) {
      console.warn('loadActiveParties failed (maybe migrations not applied):', e.message || e);
    }
  }
});

// 4) Structures
const playersConnections = {}; // playerId => socketId
const playerParties = {};      // playerId => partyId
const gmConnections = {};      // gamemasterId => socketId
const gmParties = {};          // gamemasterId => partyId
const buzzQueues = {};         // partyId => [playerId, ...]

const partySongs = {};         // partyId => [ {id, title, mp3_url}, ... ]
const currentSongIndex = {};   // [DEPRECIE si on stocke tout dans partyStates]

// Nouveau : état global de la partie en mémoire
const partyStates = {
// [partyId] : {
//   isGameStarted: false,
//   currentSongIndex: 0,
//   buzzActive: false
// }
};

// Charger les parties actives et leur playlist depuis la BDD
function loadActiveParties() {
  const sql = `SELECT id, is_game_started, current_song_index, buzz_active FROM parties WHERE finished = 0`;
  db.query(sql, [], (err, rows) => {
    if (err) {
      console.error('Erreur loadActiveParties:', err);
      return;
    }
    rows.forEach((p) => {
      const pid = p.id;
      partyStates[pid] = {
        isGameStarted: Boolean(p.is_game_started),
        currentSongIndex: p.current_song_index || 0,
        buzzActive: Boolean(p.buzz_active)
      };

      // Charger playlist sauvegardée
      const sqlSongs = `SELECT s.id, s.title, s.mp3_url FROM party_songs ps JOIN songs s ON ps.song_id = s.id WHERE ps.party_id = ? ORDER BY ps.song_order ASC`;
      db.query(sqlSongs, [pid], (err2, songRows) => {
        if (err2) {
          console.error('Erreur loadActiveParties songs:', err2);
          return;
        }
        partySongs[pid] = songRows;
      });
    });
  });
}

// 5) Routes
app.get('/', (req, res) => {
  res.send('Backend OK - with isGameStarted, buzzActive, rejoin GM on refresh');
});

// =============== GAMEMASTER REGISTER / LOGIN ===============
app.post('/api/gamemaster/register', async (req, res) => {
  const { email, password, nickname } = req.body;
  const checkQ = 'SELECT * FROM gamemaster WHERE email = ?';
  db.query(checkQ, [email], async (err, results) => {
    if (err) {
      console.error('Erreur check GM register:', err);
      return res.status(500).json({ message: 'Erreur interne (check GM)' });
    }
    if (results.length > 0) {
      return res.status(400).json({ message: 'Email déjà utilisé' });
    }
    try {
      const saltRounds = 10;
      const hashed = await bcrypt.hash(password, saltRounds);
      const insertQ = `INSERT INTO gamemaster (email, password, nickname) VALUES (?, ?, ?)`;
      db.query(insertQ, [email, hashed, nickname], (err2) => {
        if (err2) {
          console.error('Erreur insert GM:', err2);
          return res.status(500).json({ message: 'Erreur interne (insert GM)' });
        }
        return res.status(201).json({ message: 'Gamemaster enregistré !' });
      });
    } catch (error) {
      console.error('Erreur bcrypt:', error);
      return res.status(500).json({ message: 'Erreur bcrypt' });
    }
  });
});

app.post('/api/gamemaster/login', (req, res) => {
  const { email, password } = req.body;
  const sql = 'SELECT * FROM gamemaster WHERE email = ?';
  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error('Erreur interne (login GM):', err);
      return res.status(500).json({ message: 'Erreur interne' });
    }
    if (results.length === 0) {
      return res.status(400).json({ message: 'Email introuvable' });
    }
    const gm = results[0];
    try {
      const match = await bcrypt.compare(password, gm.password);
      if (!match) {
        return res.status(401).json({ message: 'Mot de passe incorrect' });
      }
      return res.status(200).json({
        message: 'Connexion réussie',
        gamemaster: {
          id: gm.id,
          email: gm.email,
          nickname: gm.nickname,
        }
      });
    } catch (bErr) {
      console.error('Erreur bcrypt compare:', bErr);
      return res.status(500).json({ message: 'Erreur interne (bcrypt)' });
    }
  });
});

// =============== CREATE PARTY ===============
app.post('/api/parties/create', (req, res) => {
  const { gamemaster_id, theme_id } = req.body;
  const code = String(Math.floor(100000 + Math.random() * 900000));

  const insertQ = `INSERT INTO parties (gamemaster_id, theme_id, code) VALUES (?, ?, ?)`;
  db.query(insertQ, [gamemaster_id, theme_id, code], (err, result) => {
    if (err) {
      console.error('Erreur creation partie:', err);
      return res.status(500).json({ message: 'Erreur création partie' });
    }

    const newPartyId = result.insertId;

    // Sélection 10 chansons
    const selectSongs = `
      SELECT id, title, mp3_url
      FROM songs
      WHERE theme_id = ?
      ORDER BY RAND()
      LIMIT 10
    `;
    db.query(selectSongs, [theme_id], (err2, songResults) => {
      if (err2) {
        console.error('Erreur sélection chansons:', err2);
        return res.status(500).json({ message: 'Erreur sélection chansons' });
      }

      partySongs[newPartyId] = songResults;

      // Persister la playlist dans party_songs
      if (songResults && songResults.length > 0) {
        const values = songResults.map((s, idx) => [newPartyId, s.id, idx]);
        const insertPS = `INSERT INTO party_songs (party_id, song_id, song_order) VALUES ?`;
        db.query(insertPS, [values], (err3) => {
          if (err3) console.error('Erreur insert party_songs:', err3);
        });
      }
      // On init l'état
      partyStates[newPartyId] = {
        isGameStarted: false,
        currentSongIndex: 0,
        buzzActive: false
      };

      let firstSong = null;
      if (songResults.length > 0) {
        firstSong = {
          title: songResults[0].title,
          mp3_url: songResults[0].mp3_url
        };
      }

      return res.status(201).json({
        message: 'Partie créée avec succès',
        party: {
          id: newPartyId,
          gamemaster_id,
          theme_id,
          code
        },
        firstSong
      });
    });
  });
});

// =============== JOIN PLAYER ===============
app.post('/api/players/join', (req, res) => {
  const { code, nickname } = req.body;
  const selParty = `SELECT * FROM parties WHERE code = ? AND finished = 0`;
  db.query(selParty, [code], (err, results) => {
    if (err) {
      console.error('Erreur join player:', err);
      return res.status(500).json({ message: 'Erreur interne' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Partie introuvable ou terminée' });
    }
    const party = results[0];
    const insertP = `INSERT INTO players (party_id, nickname) VALUES (?, ?)`;
    db.query(insertP, [party.id, nickname], (err2, r2) => {
      if (err2) {
        console.error('Erreur insert player:', err2);
        return res.status(500).json({ message: 'Erreur interne (insert player)' });
      }
      return res.status(201).json({
        message: 'Joueur ajouté',
        player: {
          id: r2.insertId,
          party_id: party.id,
          nickname
        }
      });
    });
  });
});

// =============== GET PLAYERS ===============
app.get('/api/players', (req, res) => {
  const { partyId } = req.query;
  if (!partyId) {
    return res.status(400).json({ message: 'partyId requis' });
  }
  const sql = `SELECT id, nickname, score FROM players WHERE party_id = ?`;
  db.query(sql, [partyId], (err, results) => {
    if (err) {
      console.error('Erreur GET /api/players :', err);
      return res.status(500).json({ message: 'Erreur interne' });
    }
    return res.status(200).json({ players: results });
  });
});

////////////////////////////////////////////////////////////////////////////////
// 6) SOCKET.IO
////////////////////////////////////////////////////////////////////////////////
io.on('connection', (socket) => {
  console.log('Socket connecté :', socket.id);

  //
  // joinPlayer
  //
  socket.on('joinPlayer', (data) => {
    const { playerId, partyId } = data;
    playersConnections[playerId] = socket.id;
    playerParties[playerId] = partyId;
    socket.join(`party_${partyId}`);

    db.query('SELECT nickname, score FROM players WHERE id=?', [playerId], (err, rows) => {
      let nickname = "";
      let score = 0;
      if (!err && rows.length > 0) {
        nickname = rows[0].nickname;
        score = rows[0].score;
      }
      console.log(`Player ${playerId} joined party_${partyId}, nickname=${nickname}`);
      io.to(`party_${partyId}`).emit('playerJoined', { playerId, nickname });
      io.to(socket.id).emit('playerScore', { playerId, score });

      const ps = partyStates[partyId];
      if (ps) {
        io.to(socket.id).emit('gameStateUpdated', {
          isGameStarted: ps.isGameStarted,
          buzzActive: ps.buzzActive,
          currentSongIndex: ps.currentSongIndex
        });
        io.to(socket.id).emit('buzzQueueUpdated', {
          queue: buzzQueues[partyId] || []
        });
        if (ps.isGameStarted) {
          const idx = ps.currentSongIndex;
          const s = partySongs[partyId][idx];
          if (s) {
            io.to(socket.id).emit('songChanged', { index: idx, song: s });
            if ((buzzQueues[partyId] || []).length > 0) {
              io.to(socket.id).emit('stopMusic');
            }
          }
        }
      }
    });
  });

  //
  // joinGamemaster
  //
  socket.on('joinGamemaster', (data) => {
    const { gamemasterId, partyId } = data;
    gmConnections[gamemasterId] = socket.id;
    gmParties[gamemasterId] = partyId;
    socket.join(`party_${partyId}`);
    console.log(`Gamemaster ${gamemasterId} joined party_${partyId}`);

    // Renvoyer l'état => isGameStarted etc.
    const ps = partyStates[partyId];
    if (ps) {
      io.to(socket.id).emit('gameStateUpdated', {
        isGameStarted: ps.isGameStarted,
        buzzActive: ps.buzzActive,
        currentSongIndex: ps.currentSongIndex
      });
      io.to(socket.id).emit('buzzQueueUpdated', {
        queue: buzzQueues[partyId] || []
      });

      // Si la partie a déjà démarré => on renvoie la chanson en cours
      if (ps.isGameStarted) {
        const idx = ps.currentSongIndex;
        const s = partySongs[partyId][idx];
        if (s) {
          io.to(socket.id).emit('songChanged', { index: idx, song: s });
          if ((buzzQueues[partyId] || []).length > 0) {
            io.to(socket.id).emit('stopMusic');
          }
        }
      }
    }
  });

  //
  // startGame => isGameStarted=true => countdown => startSong
  //
  socket.on('startGame', (data) => {
    const { partyId } = data;
    if (!partyStates[partyId]) return;

    partyStates[partyId].isGameStarted = true;
    partyStates[partyId].currentSongIndex = 0;
    partyStates[partyId].buzzActive = true;

    // Persister l'état de la partie
    db.query('UPDATE parties SET is_game_started = 1, current_song_index = 0, buzz_active = 1 WHERE id = ?', [partyId], (uErr) => {
      if (uErr) console.error('Erreur update startGame:', uErr);
    });

    // avertir tout le monde => GM peut disable le bouton
    io.to(`party_${partyId}`).emit('gameStateUpdated', { isGameStarted: true });

    launchCountdown(partyId, () => {
      startSong(partyId);
    });
  });

  //
  // playerBuzz => on check si isGameStarted + buzzActive
  //
  socket.on('playerBuzz', (data) => {
    const { playerId, partyId } = data;

    const ps = partyStates[partyId];
    if (!ps || !ps.isGameStarted) {
      console.log("Buzz ignoré => game pas démarrée");
      return;
    }
    if (!ps.buzzActive) {
      console.log("Buzz ignoré => buzz pas actif");
      return;
    }

    // si OK => on push
    if (!buzzQueues[partyId]) {
      buzzQueues[partyId] = [];
    }
    if (!buzzQueues[partyId].includes(playerId)) {
      buzzQueues[partyId].push(playerId);
      console.log(`Buzz => p=${playerId}, partyId=${partyId}, queue=`, buzzQueues[partyId]);

      // On arrête la musique
      io.to(`party_${partyId}`).emit('stopMusic');
      // Notifier la file
      io.to(`party_${partyId}`).emit('buzzQueueUpdated', { queue: buzzQueues[partyId] });
    }
  });

  //
  // handleNextBuzz => bonne/mauvaise rep
  //
  socket.on('handleNextBuzz', (data) => {
    const { partyId, correct } = data;
    if (!buzzQueues[partyId] || buzzQueues[partyId].length === 0) return;
    const firstPlayerId = buzzQueues[partyId][0];

    if (correct) {
      // Désactiver le buzz pendant l'annonce et persister
      if (partyStates[partyId]) {
        partyStates[partyId].buzzActive = false;
        db.query('UPDATE parties SET buzz_active = 0 WHERE id = ?', [partyId], (uerr) => {
          if (uerr) console.error('Erreur update buzz_active (handleNextBuzz):', uerr);
        });
      }
      // 1) Effectuer l’UPDATE SQL + SELECT
      db.query('UPDATE players SET score=score+5 WHERE id=?', [firstPlayerId], (err1, res1) => {
        if (!err1) {
          // après que l’update ait vraiment fini
          db.query('SELECT score FROM players WHERE id=?', [firstPlayerId], (err2, rs) => {
            if (!err2 && rs.length > 0) {
              // 2) Émettre “scoreUpdated”
              io.to(`party_${partyId}`).emit("scoreUpdated", {
                playerId: firstPlayerId,
                newScore: rs[0].score,
                correct: true
              });
            }
            // 3) Arrêter la musique (stopMusic), vider la queue
            io.to(`party_${partyId}`).emit('stopMusic');
            buzzQueues[partyId] = [];
            io.to(`party_${partyId}`).emit('buzzQueueUpdated', { queue: [] });
            
            // 4) answerRevealed (3s) => setTimeout => launchCountdown => nextSong
            io.to(`party_${partyId}`).emit('answerRevealed', {
              message: `Bravo Player #${firstPlayerId} !`
            });
            setTimeout(() => {
              launchCountdown(partyId, () => {
                nextSong(partyId);
              });
            }, 3000);
          });
        }
      });

    } else {
      // Mauvaise => -2
      buzzQueues[partyId].shift();
      db.query('UPDATE players SET score=score-2 WHERE id=?', [firstPlayerId]);
      db.query('SELECT score FROM players WHERE id=?', [firstPlayerId], (err, rs) => {
        if (!err && rs.length > 0) {
          io.to(`party_${partyId}`).emit('scoreUpdated', {
            playerId: firstPlayerId,
            newScore: rs[0].score,
            correct: false
          });
        }
      });
      io.to(`party_${partyId}`).emit('buzzQueueUpdated', {
        queue: buzzQueues[partyId]
      });

      // S'il n'y a plus personne => resumeSong
      if (buzzQueues[partyId].length === 0) {
        io.to(`party_${partyId}`).emit('resumeSong', {});
      }
    }
  });

  //
  // handleNoAnswer => stopMusic => answerRevealed => 3s => countdown => nextSong
  //
  socket.on('handleNoAnswer', (data) => {
    const { partyId } = data;

    // plus de buzz
    partyStates[partyId].buzzActive = false;
    // Persister buzz_active
    db.query('UPDATE parties SET buzz_active = 0 WHERE id = ?', [partyId], (err) => {
      if (err) console.error('Erreur update buzz_active (handleNoAnswer):', err);
    });
    io.to(`party_${partyId}`).emit('stopMusic');

    buzzQueues[partyId] = [];
    io.to(`party_${partyId}`).emit('buzzQueueUpdated', { queue: [] });

    io.to(`party_${partyId}`).emit('answerRevealed', {
      message: 'Personne n’a trouvé la bonne réponse…'
    });

    setTimeout(() => {
      launchCountdown(partyId, () => {
        nextSong(partyId);
      });
    }, 3000);
  });

  // déconnexion
  socket.on('disconnect', () => {
    console.log('Socket déconnecté :', socket.id);
    for (const [pId, sId] of Object.entries(playersConnections)) {
      if (sId === socket.id) {
        const playerId = parseInt(pId, 10);
        const partyId = playerParties[playerId];
        console.log(`Player ${pId} disconnected from party ${partyId}`);
        delete playersConnections[pId];
        delete playerParties[playerId];

        if (partyId) {
          const queue = buzzQueues[partyId] || [];
          const index = queue.indexOf(playerId);
          if (index !== -1) {
            queue.splice(index, 1);
            io.to(`party_${partyId}`).emit('buzzQueueUpdated', { queue });
            if (queue.length === 0) {
              io.to(`party_${partyId}`).emit('resumeSong', {});
            }
          }
          io.to(`party_${partyId}`).emit('playerLeft', { playerId });
        }
        break;
      }
    }
    for (const [gmId, sId] of Object.entries(gmConnections)) {
      if (sId === socket.id) {
        console.log(`Gamemaster ${gmId} disconnected`);
        delete gmConnections[gmId];
        delete gmParties[gmId];
        break;
      }
    }
  });
});

// 7) Fonctions
function launchCountdown(partyId, callback) {
  io.to(`party_${partyId}`).emit('countdownStart', { duration: 3 });
  setTimeout(() => {
    callback();
  }, 3000);
}

function startSong(partyId) {
  const st = partyStates[partyId];
  if (!st) return;

  const idx = st.currentSongIndex;
  const arr = partySongs[partyId];
  if (!arr || arr.length === 0) {
    io.to(`party_${partyId}`).emit('partyFinished', {});
    return;
  }
  const s = arr[idx];
  if (!s) {
    io.to(`party_${partyId}`).emit('partyFinished', {});
  } else {
    // On réactive le buzz
    st.buzzActive = true;
    // Persister buzzActive
    db.query('UPDATE parties SET buzz_active = 1 WHERE id = ?', [partyId], (err) => {
      if (err) console.error('Erreur update buzz_active (startSong):', err);
    });
    io.to(`party_${partyId}`).emit('songChanged', { index: idx, song: s });
  }
}

function nextSong(partyId) {
  const st = partyStates[partyId];
  st.currentSongIndex++;
  const idx = st.currentSongIndex;

  const arr = partySongs[partyId];
  if (!arr || idx >= arr.length) {
    io.to(`party_${partyId}`).emit('partyFinished', {});
  } else {
    st.buzzActive = true; // re-autoriser le buzz pour la nouvelle chanson
    // Persister index + buzz
    db.query('UPDATE parties SET current_song_index = ?, buzz_active = 1 WHERE id = ?', [idx, partyId], (err) => {
      if (err) console.error('Erreur update nextSong:', err);
    });
    const s = arr[idx];
    io.to(`party_${partyId}`).emit('songChanged', { index: idx, song: s });
  }
}

// Lancement
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});