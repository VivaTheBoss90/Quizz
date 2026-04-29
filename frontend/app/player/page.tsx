"use client";

import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
let socket: Socket;

export default function PlayerPage() {
  // Saisir le code de la partie
  const [joinCode, setJoinCode] = useState("");
  const [nickname, setNickname] = useState("");

  const [playerId, setPlayerId] = useState<number | null>(null);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const playerIdRef = useRef<number | null>(null);
  const partyIdRef = useRef<number | null>(null);
  const audioPositionRef = useRef<number>(0);

  // Audio
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentSongUrl, setCurrentSongUrl] = useState<string | null>(null);

  // Chrono local
  const [timeLeft, setTimeLeft] = useState(0);
  const [isChronoRunning, setIsChronoRunning] = useState(false);

  // Position leftover pour REPRENDRE si on arrête la même chanson
  const [audioPosition, setAudioPosition] = useState(0);

  // Countdown (3,2,1)
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  // Message “Bravo !” ou “Personne n’a trouvé…”
  const [answerMessage, setAnswerMessage] = useState<string | null>(null);

  // Contrôle du BUZZ disabled
  const [canBuzz, setCanBuzz] = useState(false);

  // ====================== INIT SOCKET (useEffect vide) ======================
  useEffect(() => {
    // 1) Créer le socket UNE seule fois
    socket = io(BACKEND_URL);

    // 2) Restauration localStorage
    const savedPlayerId = localStorage.getItem("playerId");
    const savedPartyId = localStorage.getItem("partyId");
    const savedNickname = localStorage.getItem("nickname");

    if (savedPlayerId && savedPartyId && savedNickname) {
      const pId = parseInt(savedPlayerId, 10);
      const prtyId = parseInt(savedPartyId, 10);
      setPlayerId(pId);
      setPartyId(prtyId);
      setNickname(savedNickname);
      playerIdRef.current = pId;
      partyIdRef.current = prtyId;
      // Rejoindre la partie
      socket.emit("joinPlayer", { playerId: pId, partyId: prtyId });
      fetchPlayerScore(prtyId);
    }

    // ============= LISTENERS =============
    socket.on("connect", () => {
      console.log("Player connect =>", socket.id);
    });

    // 3,2,1 => countdown
    socket.on("countdownStart", (data) => {
      setCountdownValue(data.duration);
    });

    // “Bravo !” ou “Personne n’a trouvé…”
    socket.on("answerRevealed", (data) => {
      setAnswerMessage(data.message);
      setTimeout(() => setAnswerMessage(null), 3000);
    });

    // =========== SONGCHANGED => nouvelle chanson => on repart 0
    socket.on("songChanged", (data) => {
      const url = `${BACKEND_URL}${data.song.mp3_url}`;
      setCurrentSongUrl(url);

      // On part à 0 => c’est un NOUVEAU morceau
      audioRef.current?.pause();
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.currentTime = 0;
        audioRef.current.load();
        audioRef.current.play().catch((err) => console.log("Autoplay block =>", err));
      }

      // chrono 30
      setTimeLeft(30);
      setIsChronoRunning(true);
      // position audio = 0
      setAudioPosition(0);
      audioPositionRef.current = 0;

      // BUZZ => autorisé
      setCanBuzz(true);
    });

    // =========== STOPMUSIC => On enregistre la position => BUZZ off
    socket.on("stopMusic", () => {
      if (audioRef.current) {
        audioRef.current.pause();
        // On retient la position leftover
        const currentTime = audioRef.current.currentTime;
        setAudioPosition(currentTime);
        audioPositionRef.current = currentTime;
      }
      setIsChronoRunning(false);

      // BUZZ => non
      setCanBuzz(false);
    });

    // =========== RESUMESONG => On reprend la MÊME chanson => on repart leftover
    socket.on("resumeSong", () => {
      if (audioRef.current) {
        audioRef.current.currentTime = audioPositionRef.current; // leftover
        audioRef.current.play().catch(() => console.log("resumeSong block?"));
      }
      setIsChronoRunning(true);

      // BUZZ => on le réactive
      setCanBuzz(true);
    });

    // =========== FIN DE PARTIE
    socket.on("partyFinished", () => {
      console.log("Fin de partie (Player).");
      setCurrentSongUrl(null);
      setTimeLeft(0);
      setIsChronoRunning(false);
      setCanBuzz(false);
    });

    // Score => si c’est nous
    socket.on("scoreUpdated", (data) => {
      if (playerIdRef.current && data.playerId === playerIdRef.current) {
        setScore(data.newScore);
        console.log(`Votre nouveau score : ${data.newScore}`);
      }
    });

    socket.on("playerScore", (data) => {
      if (playerIdRef.current && data.playerId === playerIdRef.current) {
        setScore(data.score);
      }
    });

    socket.on("gameStateUpdated", (data) => {
      if (data.buzzActive !== undefined) {
        setCanBuzz(Boolean(data.isGameStarted && data.buzzActive));
      }
    });

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, []);

  // ====================== CHRONO LOCAL 30S ======================
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isChronoRunning && timeLeft > 0) {
      timer = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isChronoRunning && timeLeft === 0 && currentSongUrl) {
      // Personne n’a trouvé => on arrête
      setIsChronoRunning(false);
      // Le Gamemaster fera handleNoAnswer, ou le chrono GM le fera
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [timeLeft, isChronoRunning, currentSongUrl]);

  // ====================== COUNTDOWN (3,2,1) ======================
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (countdownValue !== null && countdownValue > 0) {
      timer = setTimeout(() => setCountdownValue((prev) => (prev ?? 0) - 1), 1000);
    } else if (countdownValue === 0) {
      // On affiche “C’est parti !” brièvement
      setTimeout(() => setCountdownValue(null), 800);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdownValue]);

  // ====================== FONCTIONS ======================
  const handleJoin = async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/players/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode, nickname }),
      });
      if (!resp.ok) {
        const e = await resp.json();
        console.log("Erreur join player:", e.message);
        return;
      }
      const data = await resp.json();
      const { id, party_id, nickname: nick } = data.player;

      setPlayerId(id);
      setPartyId(party_id);
      setNickname(nick);
      playerIdRef.current = id;
      partyIdRef.current = party_id;

      localStorage.setItem("playerId", id.toString());
      localStorage.setItem("partyId", party_id.toString());
      localStorage.setItem("nickname", nick);

      socket.emit("joinPlayer", { playerId: id, partyId: party_id });
      fetchPlayerScore(party_id);
      console.log("Vous avez rejoint la partie !");
    } catch (err) {
      console.log("Erreur handleJoin:", err);
    }
  };

  const handleBuzz = () => {
    if (!playerId || !partyId) {
      console.log("Impossible de BUZZ, pas de partyId ou de playerId");
      return;
    }
    socket.emit("playerBuzz", { playerId, partyId });
    console.log("Vous avez buzzé !");
  };

  const fetchPlayerScore = async (pId: number) => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/players?partyId=${pId}`);
      if (!resp.ok) return;
      const data = await resp.json();
      const me = data.players.find((row: any) => row.id === playerIdRef.current);
      if (me) {
        setScore(me.score);
      }
    } catch (err) {
      console.log("fetchPlayerScore error:", err);
    }
  };

  // ====================== RENDU TAILWIND ======================
  return (
    <main className="min-h-screen bg-gray-100 p-4 flex flex-col items-center text-black">
      <div className="w-full max-w-2xl bg-white shadow-md rounded-md p-4 sm:p-6">
        <h1 className="text-3xl font-bold text-center mb-6">Espace Joueur</h1>

        {playerId && partyId ? (
          <>
            <p className="mb-4 text-gray-800">
              Joueur #{playerId}, Partie #{partyId}
              <br/>
              Pseudo : <span className="font-semibold">{nickname}</span>
              <br/>
              Score : <span className="font-semibold">{score !== null ? score : 0}</span>
            </p>

            {/* BOUTON BUZZ => disabled si canBuzz = false */}
            <button
              onClick={handleBuzz}
              disabled={!canBuzz}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              BUZZ
            </button>

            {/* COUNTDOWN 3,2,1 */}
            {countdownValue !== null && (
              <div className="text-4xl font-bold mt-6 text-center">
                {countdownValue > 0 ? countdownValue : "C'est parti !!!"}
              </div>
            )}

            {/* ANSWER MESSAGE */}
            {answerMessage && (
              <div className="text-xl mt-4 text-center text-black">
                {answerMessage}
              </div>
            )}

            <div className="mt-4 space-y-2">
              {currentSongUrl ? (
                <audio ref={audioRef} controls className="w-full border rounded">
                  <source src={currentSongUrl} type="audio/mpeg" />
                  Votre navigateur ne supporte pas l'audio
                </audio>
              ) : (
                <p className="text-gray-500">Aucune chanson en cours</p>
              )}

              {currentSongUrl && (
                <>
                  <p className="text-sm text-gray-600">
                    Lecture : {currentSongUrl}
                  </p>
                  <p className="font-semibold text-black">
                    Chrono local : {timeLeft}s
                    <span className="ml-2 italic">
                      {isChronoRunning ? "(en cours)" : "(arrêté)"}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Position audio leftover : {Math.floor(audioPosition)}s
                  </p>
                </>
              )}
            </div>
          </>
        ) : (
          // FORM JOIN
          <div className="flex flex-col gap-4 mt-4">
            <div>
              <label className="block font-medium text-gray-800">Code de la partie</label>
              <input
                type="text"
                placeholder="Ex: 123456"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="border p-2 w-full rounded text-black"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-800">Votre pseudo</label>
              <input
                type="text"
                placeholder="Ex: John"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="border p-2 w-full rounded text-black"
              />
            </div>
            <button
              onClick={handleJoin}
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Rejoindre la partie
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
