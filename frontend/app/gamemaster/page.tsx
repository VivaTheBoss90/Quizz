"use client";

import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
let socket: Socket;

interface IPlayer {
  playerId: number;
  nickname: string;
  score: number;
}

export default function GamemasterPage() {
  // ===================== ÉTATS AUTH GM =====================
  const [gmEmail, setGmEmail] = useState("");
  const [gmPassword, setGmPassword] = useState("");
  const [gamemasterId, setGamemasterId] = useState<number | null>(null);
  const [gmNickname, setGmNickname] = useState("");

  // ===================== ÉTATS PARTIE ======================
  const [themeId, setThemeId] = useState<number>(1);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [partyCode, setPartyCode] = useState("");

  // ===================== JOUEURS + BUZZ =====================
  const [players, setPlayers] = useState<IPlayer[]>([]);
  const [buzzQueue, setBuzzQueue] = useState<number[]>([]);

  // ===================== AUDIO & CHRONO =====================
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentSongUrl, setCurrentSongUrl] = useState<string | null>(null);

  // Chrono local
  const [timeLeft, setTimeLeft] = useState(0);
  const [isChronoRunning, setIsChronoRunning] = useState(false);

  // *** leftover *** => mémorise la position de lecture
  const [audioPosition, setAudioPosition] = useState(0);

  // ===================== COUNTDOWN & ANSWER ======================
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [answerMessage, setAnswerMessage] = useState<string | null>(null);

  // Désactiver le bouton “Démarrer la partie”
  const [isGameStarted, setIsGameStarted] = useState(false);

  // Lecture 1ʳᵉ chanson localement (optionnel)
  const [firstSongUrl, setFirstSongUrl] = useState<string | null>(null);

  // Login ou mot de passe incorrect
  const [errorMessage, setErrorMessage] = useState("");
  const [showError, setShowError] = useState(false);

  // ===================== useEffect : init socket, écoute événements =====================
  useEffect(() => {
    socket = io(BACKEND_URL);

    const savedGmId = localStorage.getItem("gamemasterId");
    const savedGmNickname = localStorage.getItem("gamemasterNickname");
    const savedPartyId = localStorage.getItem("partyId");
    const savedPartyCode = localStorage.getItem("partyCode");

    if (savedGmId && savedGmNickname) {
      setGamemasterId(parseInt(savedGmId, 10));
      setGmNickname(savedGmNickname);
    }
    if (savedPartyId && savedPartyCode) {
      const pId = parseInt(savedPartyId, 10);
      setPartyId(pId);
      setPartyCode(savedPartyCode);

      if (savedGmId) {
        const gId = parseInt(savedGmId, 10);
        socket.emit("joinGamemaster", { gamemasterId: gId, partyId: pId });
      }
      fetchPlayersFromDB(pId);
    }

    // ---------- Écoute des événements Socket ----------
    socket.on("connect", () => {
      console.log("GM connected =>", socket.id);
    });

    socket.on("playerJoined", (data) => {
      const { playerId, nickname } = data;
      setPlayers((prev) => {
        if (!prev.some((p) => p.playerId === playerId)) {
          return [...prev, { playerId, nickname, score: 0 }];
        }
        return prev;
      });
    });

    socket.on("playerLeft", (data) => {
      const { playerId } = data;
      setPlayers((prev) => prev.filter((p) => p.playerId !== playerId));
    });

    socket.on("buzzQueueUpdated", (data) => {
      const q = data.queue;
      setBuzzQueue(q);
      // si q>0 => on arrête le chrono
      if (q.length > 0) {
        setIsChronoRunning(false);
      } else if (currentSongUrl) {
        setIsChronoRunning(true);
      }
    });

    socket.on("scoreUpdated", (data) => {
      const { playerId, newScore } = data;
      setPlayers((prev) =>
        prev.map((p) =>
          p.playerId === playerId ? { ...p, score: newScore } : p
        )
      );
    });

    // =========== songChanged => nouvelle chanson => on part à 0 =============
    socket.on("songChanged", (data) => {
      console.log("songChanged =>", data);
      const url = `${BACKEND_URL}${data.song.mp3_url}`;
      setCurrentSongUrl(url);

      audioRef.current?.pause();
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.currentTime = 0;
        audioRef.current.load();
        audioRef.current
          .play()
          .catch((err) => console.log("Autoplay block =>", err));
      }
      // chrono 30
      setTimeLeft(30);
      setIsChronoRunning(true);

      // Position leftover => 0 (nouvelle chanson)
      setAudioPosition(0);
    });

    // =========== stopMusic => on mémorise leftover => on arrête chrono
    socket.on("stopMusic", () => {
      audioRef.current?.pause();
      if (audioRef.current) {
        // leftover position
        console.log("GM => STOPMUSIC => leftoverPos was", audioRef.current.currentTime);
        setAudioPosition(audioRef.current.currentTime);
      }
      setIsChronoRunning(false);
    });

    socket.on("partyFinished", () => {
      console.log("Les 10 chansons sont terminées (GM).");
      setCurrentSongUrl(null);
      setTimeLeft(0);
      setIsChronoRunning(false);
      // leftover => on peut le remettre à 0
      setAudioPosition(0);
    });

    socket.on("countdownStart", (data) => {
      setCountdownValue(data.duration);
    });

    socket.on("answerRevealed", (data) => {
      setAnswerMessage(data.message);
      setTimeout(() => setAnswerMessage(null), 3000);
    });

    // =========== resumeSong => on reprend leftover
    socket.on("resumeSong", () => {
      console.log("GM => RESUMESONG => leftoverPos in state is", audioPosition);
      if (audioRef.current) {
        audioRef.current.currentTime = audioPosition;
        audioRef.current.play().catch(() => console.log("resumeSong block ?"));
      }
      setIsChronoRunning(true);
    });

    // Quand la partie est lancée => gameStateUpdated => isGameStarted => true
    socket.on("gameStateUpdated", (data) => {
      if (data.isGameStarted) {
        setIsGameStarted(true);
      }
    });

    // Cleanup socket
    return () => {
      socket.disconnect();
    };
  }, []); // <= tableau de dépendances vide pour ne pas recréer le socket en boucle

  // ===================== Chrono (30 s) =====================
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isChronoRunning && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (isChronoRunning && timeLeft === 0 && currentSongUrl) {
      // Personne n’a trouvé => on arrête
      setIsChronoRunning(false);
      if (partyId) {
        socket.emit("handleNoAnswer", { partyId });
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isChronoRunning, timeLeft, currentSongUrl, partyId]);

  // ===================== Countdown (3,2,1) =====================
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (countdownValue !== null && countdownValue > 0) {
      timer = setTimeout(() => {
        setCountdownValue((prev) => (prev ?? 0) - 1);
      }, 1000);
    } else if (countdownValue === 0) {
      setTimeout(() => setCountdownValue(null), 800);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdownValue]);

  // ===================== Fonctions =====================
  const fetchPlayersFromDB = async (pId: number) => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/players?partyId=${pId}`);
      if (!resp.ok) return;
      const data = await resp.json();
      const newPlayers = data.players.map((row: any) => ({
        playerId: row.id,
        nickname: row.nickname,
        score: row.score,
      }));
      setPlayers(newPlayers);
    } catch (err) {
      console.log("fetchPlayersFromDB error:", err);
    }
  };

  const handleLoginGM = async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/gamemaster/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: gmEmail, password: gmPassword }),
      });
      if (!resp.ok) {
        const e = await resp.json();
        console.log("Erreur login GM:", e.message);
        setErrorMessage("⛔ Identifiants incorrects");
        setShowError(true);
        setTimeout(() => setShowError(false), 2000);
        return;
      }
      const data = await resp.json();
      setGamemasterId(data.gamemaster.id);
      setGmNickname(data.gamemaster.nickname);

      localStorage.setItem("gamemasterId", data.gamemaster.id.toString());
      localStorage.setItem("gamemasterNickname", data.gamemaster.nickname);
      console.log("Connexion GM réussie !");
    } catch (err) {
      console.log("Erreur handleLoginGM:", err);
    }
  };

  const handleCreateParty = async () => {
    if (!gamemasterId) return;
    try {
      const resp = await fetch(`${BACKEND_URL}/api/parties/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamemaster_id: gamemasterId, theme_id: themeId }),
      });
      if (!resp.ok) {
        const e = await resp.json();
        console.log("Erreur création partie:", e.message);
        return;
      }
      const data = await resp.json();
      const pId = data.party.id;
      const pCode = data.party.code;
      setPartyId(pId);
      setPartyCode(pCode);

      localStorage.setItem("partyId", pId.toString());
      localStorage.setItem("partyCode", pCode);

      if (data.firstSong) {
        setFirstSongUrl(`${BACKEND_URL}${data.firstSong.mp3_url}`);
      } else {
        setFirstSongUrl(null);
      }

      socket.emit("joinGamemaster", { gamemasterId, partyId: pId });

      console.log("Partie créée ! Code =", pCode);
    } catch (err) {
      console.log("Erreur handleCreateParty:", err);
    }
  };

  const handleStartGame = () => {
    if (!partyId) return;
    setIsGameStarted(true);
    socket.emit("startGame", { partyId });
  };

  const handleNextBuzz = (correct: boolean) => {
    if (!partyId) return;
    socket.emit("handleNextBuzz", { partyId, correct });
  };

  const handleNoAnswer = () => {
    if (!partyId) return;
    socket.emit("handleNoAnswer", { partyId });
  };

  // ===================== RENDU TAILWIND =====================
  return (
    <main className="min-h-screen bg-gray-100 p-4 flex flex-col items-center text-black">
      {showError && (
        <div className="fixed top-10 inset-x-0 mx-auto w-max bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg animate-slide-down z-50">
          {errorMessage}
        </div>
      )}
      <div className="w-full max-w-3xl bg-white shadow-md rounded-md p-4 sm:p-6">
        <h1 className="text-3xl font-bold text-center mb-6">Espace Gamemaster</h1>

        {/* Si pas loggé => form login GM */}
        {!gamemasterId && (
          <div className="space-y-4">
            <div>
              <label className="block font-medium text-gray-800">Email GM</label>
              <input
                type="email"
                className="border p-2 w-full rounded text-black"
                value={gmEmail}
                onChange={(e) => setGmEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium text-gray-800">Mot de passe GM</label>
              <input
                type="password"
                className="border p-2 w-full rounded text-black"
                value={gmPassword}
                onChange={(e) => setGmPassword(e.target.value)}
              />
            </div>
            <button
              onClick={handleLoginGM}
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Se connecter (GM)
            </button>
          </div>
        )}

        {/* Si GM connecte => creer / gerer partie */}
        {gamemasterId && (
          <div className="mt-4 text-gray-800">
            <p>
              Connecté en tant que GM #{gamemasterId} 
              <span className="font-semibold"> ({gmNickname})</span>
            </p>

            {!partyId ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block font-medium">Theme ID :</label>
                  <input
                    type="number"
                    className="border p-2 rounded w-32 text-black"
                    value={themeId}
                    onChange={(e) => setThemeId(parseInt(e.target.value, 10))}
                  />
                </div>
                <button
                  onClick={handleCreateParty}
                  className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
                >
                  Créer la partie
                </button>
              </div>
            ) : (
              <>
                <div className="mt-4">
                  <p className="text-lg">
                    Partie #{partyId} - Code : 
                    <span className="font-semibold"> {partyCode}</span>
                  </p>

                  {/* BOUTONS */}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleStartGame}
                      disabled={isGameStarted}
                      className="bg-yellow-500 text-white py-2 px-4 rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Démarrer la partie (countdown 3s)
                    </button>
                    <button
                      onClick={handleNoAnswer}
                      className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
                    >
                      handleNoAnswer (test)
                    </button>
                  </div>

                  {/* COUNTDOWN (3,2,1) */}
                  {countdownValue !== null && (
                    <div className="text-4xl font-bold mt-4 text-center">
                      {countdownValue > 0 ? countdownValue : "C'est parti !!!"}
                    </div>
                  )}

                  {/* ANSWER MESSAGE */}
                  {answerMessage && (
                    <div className="text-xl font-semibold mt-4 text-center text-black">
                      {answerMessage}
                    </div>
                  )}

                  {/* JOUEURS */}
                  <h3 className="font-semibold mt-4">Joueurs connectés</h3>
                  <ul className="list-disc list-inside ml-4 text-black">
                    {players.map((p) => (
                      <li key={p.playerId}>
                        Player #{p.playerId} - {p.nickname} (score: {p.score})
                      </li>
                    ))}
                  </ul>

                  {/* FILE D'ATTENTE (buzzQueue) */}
                  {buzzQueue.length > 0 && (
                    <div className="border mt-4 p-3 rounded bg-gray-50">
                      <h3 className="font-bold mb-2">File d'attente (Buzz)</h3>
                      <ul className="list-disc list-inside ml-4 text-black">
                        {buzzQueue.map((pid, idx) => (
                          <li key={pid}>
                            Position {idx + 1} : Player #{pid}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2">Premier en attente : Player #{buzzQueue[0]}</p>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleNextBuzz(true)}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                          Bonne réponse (+5)
                        </button>
                        <button
                          onClick={() => handleNextBuzz(false)}
                          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        >
                          Mauvaise réponse (-2)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* AUDIO + CHRONO + leftover */}
                  <div className="mt-4 space-y-2">
                    <audio ref={audioRef} controls className="w-full border rounded">
                      {/* src défini dynamiquement */}
                    </audio>

                    {currentSongUrl && (
                      <>
                        <p className="text-sm text-gray-600">
                          Lecture : {currentSongUrl}
                        </p>
                        <p className="font-semibold text-black">
                          Chrono : {timeLeft}s
                          <span className="ml-2 italic">
                            {isChronoRunning ? "(en cours)" : "(en pause)"}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600">
                          Position leftover : {Math.floor(audioPosition)} s
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
