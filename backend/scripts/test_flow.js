const axios = require('axios');
const { io } = require('socket.io-client');

const BACKEND = process.env.BACKEND_URL || 'http://localhost:4000';

async function delay(ms){ return new Promise(res=>setTimeout(res,ms)); }

(async ()=>{
  try{
    console.log('Creating gamemaster...');
    // register GM
    const email = `gm${Date.now()}@example.com`;
    const password = 'secretpass';
    const nickname = 'GMTest';
    await axios.post(`${BACKEND}/api/gamemaster/register`, { email, password, nickname }).catch(()=>{});
    const login = await axios.post(`${BACKEND}/api/gamemaster/login`, { email, password });
    const gm = login.data.gamemaster;
    console.log('GM logged:', gm.id);

    // create party
    const create = await axios.post(`${BACKEND}/api/parties/create`, { gamemaster_id: gm.id, theme_id: 1 });
    const party = create.data.party;
    console.log('Party created:', party.id, party.code);

    // create player via API join
    const playerName = 'PlayerTest';
    const join = await axios.post(`${BACKEND}/api/players/join`, { code: party.code, nickname: playerName });
    const player = join.data.player;
    console.log('Player created:', player.id);

    // connect sockets
    const gmSocket = io(BACKEND);
    const playerSocket = io(BACKEND);

    gmSocket.on('connect', ()=>{
      console.log('GM socket connected', gmSocket.id);
      gmSocket.emit('joinGamemaster', { gamemasterId: gm.id, partyId: party.id });
    });
    playerSocket.on('connect', ()=>{
      console.log('Player socket connected', playerSocket.id);
      playerSocket.emit('joinPlayer', { playerId: player.id, partyId: party.id });
    });

    playerSocket.on('songChanged', (d)=>{ console.log('Player received songChanged', d.index); });
    playerSocket.on('stopMusic', ()=>{ console.log('Player received stopMusic'); });
    playerSocket.on('buzzQueueUpdated', (d)=>{ console.log('Player buzzQueue', d.queue); });
    playerSocket.on('scoreUpdated', (d)=>{ console.log('Player scoreUpdated', d); });
    gmSocket.on('buzzQueueUpdated', (d)=>{ console.log('GM buzzQueue', d.queue); });
    gmSocket.on('songChanged', (d)=>{ console.log('GM songChanged', d.index); });
    gmSocket.on('scoreUpdated', (d)=>{ console.log('GM scoreUpdated', d); });

    // wait a bit
    await delay(1000);

    console.log('GM starts game');
    gmSocket.emit('startGame', { partyId: party.id });

    // wait for songChanged
    await new Promise((resolve)=>{
      const to = setTimeout(()=>{ resolve(); }, 5000);
      gmSocket.on('songChanged', (d)=>{ console.log('songChanged idx', d.index); clearTimeout(to); resolve(); });
    });

    // player buzzes
    console.log('Player buzz');
    playerSocket.emit('playerBuzz', { playerId: player.id, partyId: party.id });

    await delay(500);

    // GM handles next buzz as correct
    console.log('GM handles next buzz => correct');
    gmSocket.emit('handleNextBuzz', { partyId: party.id, correct: true });

    // wait a bit for nextSong
    await delay(8000);

    console.log('Test flow complete, closing sockets');
    gmSocket.close(); playerSocket.close();
    process.exit(0);

  }catch(err){
    console.error('Test flow error', err.message || err);
    process.exit(2);
  }
})();
