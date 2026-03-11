import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import DrawingCanvas from './components/DrawingCanvas';

const SERVER_URL = 'https://drawwar.onrender.com';
const socket = io(SERVER_URL);


/* ─── Design tokens ────────────────────── */
const C = {
  bg: '#1a1a2e',
  panel: '#16213e',
  card: '#0f3460',
  accent: '#e94560',
  gold: '#FFD700',
  green: '#4ade80',
  blue: '#60a5fa',
  text: '#f0f0f0',
  muted: '#8892a4',
  border: 'rgba(255,255,255,0.08)',
};

const fonts = {
  display: "'Fredoka One', cursive",
  body: "'Nunito', sans-serif",
};

/* ─── Shared style helpers ─────────────────────────────────────── */
const cardStyle = {
  background: C.card,
  borderRadius: '20px',
  border: `2px solid ${C.border}`,
  padding: '28px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

const btnStyle = (bg = C.accent, color = '#fff') => ({
  background: bg,
  color,
  border: 'none',
  borderRadius: '50px',
  padding: '12px 28px',
  fontFamily: fonts.display,
  fontSize: '1rem',
  letterSpacing: '0.5px',
  cursor: 'pointer',
  boxShadow: `0 4px 0 rgba(0,0,0,0.35)`,
  transition: 'transform 0.1s, box-shadow 0.1s',
  userSelect: 'none',
});

const inputStyle = {
  background: 'rgba(255,255,255,0.07)',
  border: `1.5px solid ${C.border}`,
  borderRadius: '12px',
  padding: '12px 16px',
  color: C.text,
  fontFamily: fonts.body,
  fontSize: '1rem',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
};

/* ─── Injected Google Fonts ────────────────────────────────────── */
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${C.bg}; color: ${C.text}; font-family: ${fonts.body}; min-height: 100vh; }

    .dw-btn:hover  { transform: translateY(-2px); box-shadow: 0 6px 0 rgba(0,0,0,0.35); }
    .dw-btn:active { transform: translateY(2px);  box-shadow: 0 2px 0 rgba(0,0,0,0.35); }
    .dw-input:focus { border-color: ${C.accent}; background: rgba(255,255,255,0.12); }

    .fade-in { animation: fadeIn 0.4s ease forwards; }
    @keyframes fadeIn { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform:none; } }

    .pulse { animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }

    .bounce { animation: bounce 0.6s ease; }
    @keyframes bounce {
      0%   { transform: scale(1); }
      30%  { transform: scale(1.15); }
      60%  { transform: scale(0.95); }
      100% { transform: scale(1); }
    }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }

    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }

    .gallery-card {
      background: rgba(255,255,255,0.05);
      border-radius: 14px;
      overflow: hidden;
      border: 3px solid transparent;
      cursor: pointer;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
    }
    .gallery-card:hover:not(.self) { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
    .gallery-card.selected { border-color: ${C.gold}; box-shadow: 0 0 20px rgba(255,215,0,0.4); }
    .gallery-card.self { cursor: default; opacity: 0.6; }
    .gallery-card img { width: 100%; display: block; }

    .leaderboard-row {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 18px;
      border-radius: 12px;
      margin-bottom: 8px;
      background: rgba(255,255,255,0.04);
      border: 1.5px solid rgba(255,255,255,0.06);
      transition: background 0.2s;
    }
    .leaderboard-row.top { background: linear-gradient(90deg, rgba(255,215,0,0.15) 0%, rgba(255,215,0,0.05) 100%); border-color: rgba(255,215,0,0.3); }

    .timer-bar-outer {
      height: 10px;
      background: rgba(255,255,255,0.08);
      border-radius: 99px;
      overflow: hidden;
      width: 100%;
    }
    .timer-bar-inner {
      height: 100%;
      border-radius: 99px;
      transition: width 1s linear, background 1s;
    }

    .badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px;
      border-radius: 50%;
      font-family: ${fonts.display};
      font-size: 0.8rem;
      flex-shrink: 0;
    }

    .word-reveal {
      font-family: ${fonts.display};
      font-size: 2.4rem;
      color: ${C.gold};
      letter-spacing: 3px;
      text-shadow: 0 0 30px rgba(255,215,0,0.4);
    }
  `}</style>
);

/* ─── Avatar (colourful pixel avatar placeholder) ──────────────── */
const AVATAR_COLORS = ['#e94560', '#60a5fa', '#4ade80', '#FFD700', '#a78bfa', '#fb923c', '#f472b6', '#34d399'];
const Avatar = ({ name, size = 36, index = 0 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: AVATAR_COLORS[index % AVATAR_COLORS.length],
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: fonts.display, fontSize: size * 0.4, color: '#fff',
    flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    border: '2px solid rgba(255,255,255,0.25)',
  }}>
    {name?.[0]?.toUpperCase() || '?'}
  </div>
);

/* ─── Timer Bar ────────────────────────────────────────────────── */
const TimerBar = ({ timer, maxTime = 60 }) => {
  const pct = Math.max(0, Math.min(100, (timer / maxTime) * 100));
  const bg = pct > 50 ? C.green : pct > 25 ? '#facc15' : C.accent;
  return (
    <div className="timer-bar-outer">
      <div className="timer-bar-inner" style={{ width: `${pct}%`, background: bg }} />
    </div>
  );
};

/* ─── Main App ─────────────────────────────────────────────────── */
function App() {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState('lobby');
  const [theme, setTheme] = useState('General');
  const [round, setRound] = useState(0);
  const [word, setWord] = useState('');
  const [timer, setTimer] = useState(0);
  const [drawings, setDrawings] = useState({});
  const [selectedVote, setSelectedVote] = useState(null);
  const [joined, setJoined] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const TOTAL_ROUNDS = 5;

  useEffect(() => {
    socket.on('player_list_update', (list) => setPlayers(list));

    socket.on('game_update', (update) => {
      if (update.state) setGameState(update.state);
      if (update.theme) setTheme(update.theme);
      if (update.round) setRound(update.round);
      if (update.word) setWord(update.word);
      if (update.drawings) setDrawings(update.drawings);
      if (update.players) setPlayers(update.players);

      if (update.state === 'drawing') {
        setSelectedVote(null);
        setDrawings({});
        setSubmitted(false);
      }
    });

    socket.on('timer_update', (t) => setTimer(t));

    socket.on('room_created', (newRoomId) => {
      setRoomId(newRoomId);
      setJoined(true);
    });

    socket.on('error_message', (msg) => {
      alert(msg);
      setJoined(false);
    });

    return () => {
      socket.off('player_list_update');
      socket.off('game_update');
      socket.off('timer_update');
      socket.off('room_created');
    };
  }, []);

  /* ── Handlers ───────── */
  const handleJoin = () => {
    if (name && roomId) { socket.emit('join_room', { roomId, name }); setJoined(true); }
    else alert('Please enter both Name and Room ID');
  };

  const handleCreateRoom = () => {
    if (name) socket.emit('create_room', { name });
    else alert('Please enter your name first');
  };

  const handleStart = () => socket.emit('start_game');

  const handleSubmitDrawing = (data) => {
    socket.emit('submit_drawing', data);
    setSubmitted(true);
  };

  const handleVote = (id) => {
    if (id !== socket.id) {
      setSelectedVote(id);
      socket.emit('submit_vote', id);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     LOBBY / LOGIN
  ═══════════════════════════════════════════════════════════════ */
  if (!joined) {
    return (
      <>
        <FontLoader />
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '24px',
          background: `radial-gradient(ellipse at 30% 20%, rgba(233,69,96,0.18) 0%, transparent 60%),
                       radial-gradient(ellipse at 80% 80%, rgba(96,165,250,0.15) 0%, transparent 55%),
                       ${C.bg}`,
        }} className="fade-in">

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{
              fontFamily: fonts.display, fontSize: '3.5rem', color: C.gold, letterSpacing: '2px',
              textShadow: '0 4px 0 rgba(0,0,0,0.3), 0 0 40px rgba(255,215,0,0.3)'
            }}>
              🎨 DrawWar
            </h1>
            <p style={{ color: C.muted, fontFamily: fonts.body, fontSize: '1rem', marginTop: '6px', fontWeight: 600 }}>
              Draw. Vote. Dominate.
            </p>
          </div>

          {/* Card */}
          <div style={{ ...cardStyle, width: '100%', maxWidth: '420px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: C.muted, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Your Name</label>
                <input
                  className="dw-input"
                  style={{ ...inputStyle, marginTop: '6px' }}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. SketchMaster99"
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: C.muted, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Room ID</label>
                <input
                  className="dw-input"
                  style={{ ...inputStyle, marginTop: '6px' }}
                  value={roomId}
                  onChange={e => setRoomId(e.target.value)}
                  placeholder="Enter room code to join"
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <button className="dw-btn" style={{ ...btnStyle(C.blue), flex: 1 }} onClick={handleJoin}>
                  Join Room
                </button>
                <button className="dw-btn" style={{ ...btnStyle(C.accent), flex: 1 }} onClick={handleCreateRoom}>
                  Create Room
                </button>
              </div>
            </div>
          </div>

          <p style={{ color: C.muted, fontSize: '0.78rem', marginTop: '24px' }}>
            Minimum 2 players · Draw a word · Vote the best · Win!
          </p>
        </div>
      </>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     IN-GAME LAYOUT
  ═══════════════════════════════════════════════════════════════ */
  const isHost = players.some(p => p.is_host && p.socket_id === socket.id);

  return (
    <>
      <FontLoader />
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        background: `radial-gradient(ellipse at top left, rgba(233,69,96,0.12) 0%, transparent 50%),
                     radial-gradient(ellipse at bottom right, rgba(96,165,250,0.1) 0%, transparent 50%),
                     ${C.bg}`,
      }}>

        {/* ── Top Bar ── */}
        <div style={{
          background: C.panel,
          borderBottom: `2px solid ${C.border}`,
          padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: '16px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: fonts.display, fontSize: '1.4rem', color: C.gold }}>🎨 DrawWar</span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: C.muted, fontWeight: 700 }}>
              <span>Round {round}/{TOTAL_ROUNDS}</span>
              <span>{timer}s</span>
            </div>
            <TimerBar timer={timer} maxTime={60} />
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '10px',
            padding: '6px 14px',
            fontFamily: fonts.body,
            fontSize: '0.82rem',
            color: C.muted,
          }}>
            Room: <span style={{ color: C.text, fontWeight: 700 }}>{roomId}</span>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          gap: '16px',
          flex: 1,
          padding: '16px',
          maxWidth: '1100px',
          width: '100%',
          margin: '0 auto',
          alignItems: 'start',
        }}>

          {/* ── Player List (left sidebar) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
              Players ({players.length})
            </div>
            {[...players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
              <div key={p.id} style={{
                ...cardStyle, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: '10px',
                border: p.socket_id === socket.id ? `2px solid ${C.accent}` : `2px solid ${C.border}`,
                background: p.socket_id === socket.id ? 'rgba(233,69,96,0.12)' : C.card,
              }}>
                <div className="badge" style={{ background: i === 0 ? C.gold : 'rgba(255,255,255,0.1)', color: i === 0 ? '#1a1a2e' : C.text }}>
                  {i === 0 ? '👑' : i + 1}
                </div>
                <Avatar name={p.name} size={30} index={i} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name} {p.socket_id === socket.id && <span style={{ color: C.accent, fontSize: '0.7rem' }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: C.gold, fontWeight: 600 }}>{p.score || 0} pts</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Main Content ── */}
          <div className="fade-in">

            {/* ── WAITING / LOBBY ── */}
            {gameState === 'lobby' && (
              <div style={cardStyle}>
                <h2 style={{ fontFamily: fonts.display, fontSize: '1.6rem', marginBottom: '6px' }}>
                  Waiting Room 🕹️
                </h2>
                <p style={{ color: C.muted, marginBottom: '20px', fontSize: '0.9rem' }}>
                  Share your Room ID: <strong style={{ color: C.text }}>{roomId}</strong>
                </p>

                {isHost && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '0.78rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Theme</label>
                    <select
                      value={theme}
                      onChange={e => socket.emit('select_theme', e.target.value)}
                      style={{ ...inputStyle, marginTop: '8px', cursor: 'pointer' }}
                    >
                      {['General', 'Halloween', 'Space', 'Fantasy'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
                {!isHost && (
                  <div style={{ marginBottom: '20px', color: C.muted, fontSize: '0.9rem' }}>
                    Theme: <span style={{ color: C.blue, fontWeight: 700 }}>{theme}</span> (set by host)
                  </div>
                )}

                {isHost ? (
                  <>
                    <button
                      className="dw-btn"
                      style={{ ...btnStyle(players.length < 2 ? '#444' : C.green, '#111'), width: '100%', fontSize: '1.1rem', padding: '16px' }}
                      onClick={handleStart}
                      disabled={players.length < 2}
                    >
                      {players.length < 2 ? 'Waiting for more players…' : '🚀 Start Game!'}
                    </button>
                    {players.length < 2 && <p style={{ color: C.muted, fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' }}>Need at least 2 players</p>}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: C.muted, padding: '20px', fontWeight: 600 }} className="pulse">
                    ⏳ Waiting for host to start…
                  </div>
                )}
              </div>
            )}

            {/* ── DRAWING ── */}
            {gameState === 'drawing' && (
              <div style={cardStyle}>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Draw this word</div>
                  <div className="word-reveal">{word}</div>
                </div>
                <DrawingCanvas onDrawUpdate={handleSubmitDrawing} />
                {submitted && (
                  <div style={{
                    marginTop: '14px', textAlign: 'center',
                    color: C.green, fontWeight: 700, fontSize: '0.95rem',
                  }}>
                    ✅ Drawing submitted! Waiting for others…
                  </div>
                )}
              </div>
            )}

            {/* ── VOTING ── */}
            {gameState === 'voting' && (
              <div style={cardStyle}>
                <h2 style={{ fontFamily: fonts.display, fontSize: '1.5rem', marginBottom: '4px' }}>Vote for the Best! 🗳️</h2>
                <p style={{ color: C.muted, fontSize: '0.85rem', marginBottom: '4px' }}>
                  The word was: <span style={{ color: C.gold, fontWeight: 700 }}>{word}</span>
                </p>
                <p style={{ color: C.muted, fontSize: '0.82rem' }}>You cannot vote for your own drawing.</p>

                <div className="gallery-grid">
                  {Object.entries(drawings).map(([id, data]) => {
                    const player = players.find(p => p.socket_id === id);
                    const isSelf = id === socket.id;
                    return (
                      <div
                        key={id}
                        className={`gallery-card ${selectedVote === id ? 'selected' : ''} ${isSelf ? 'self' : ''}`}
                        onClick={() => handleVote(id)}
                      >
                        <img src={data} alt="drawing" />
                        <div style={{
                          padding: '8px 12px',
                          display: 'flex', alignItems: 'center', gap: '8px',
                          background: 'rgba(0,0,0,0.3)',
                        }}>
                          <Avatar name={player?.name} size={24} index={players.findIndex(p => p.socket_id === id)} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                            {player?.name} {isSelf && '(you)'}
                          </span>
                          {selectedVote === id && <span style={{ marginLeft: 'auto', fontSize: '1rem' }}>⭐</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── RESULTS ── */}
            {gameState === 'results' && (
              <div style={cardStyle}>
                <h2 style={{ fontFamily: fonts.display, fontSize: '1.6rem', marginBottom: '20px', textAlign: 'center' }}>
                  Round {round} Results 📊
                </h2>
                {[...players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                  <div key={p.id} className={`leaderboard-row ${i === 0 ? 'top' : ''}`}>
                    <div className="badge" style={{ background: i === 0 ? C.gold : 'rgba(255,255,255,0.1)', color: i === 0 ? '#1a1a2e' : C.text, fontSize: '1rem' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </div>
                    <Avatar name={p.name} size={34} index={i} />
                    <span style={{ flex: 1, fontWeight: 700 }}>{p.name} {p.socket_id === socket.id && <span style={{ color: C.accent }}>(you)</span>}</span>
                    <span style={{ fontFamily: fonts.display, fontSize: '1.1rem', color: C.gold }}>{p.score || 0} pts</span>
                  </div>
                ))}
                <p style={{ textAlign: 'center', color: C.muted, marginTop: '20px', fontSize: '0.85rem' }} className="pulse">
                  ⏳ Next round starting soon…
                </p>
              </div>
            )}

            {/* ── FINAL ── */}
            {gameState === 'final' && (
              <div style={cardStyle}>
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🏆</div>
                  <h2 style={{ fontFamily: fonts.display, fontSize: '2rem', color: C.gold }}>Final Leaderboard</h2>
                </div>

                {[...players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                  <div key={p.id} className={`leaderboard-row ${i === 0 ? 'top' : ''} bounce`} style={{ animationDelay: `${i * 0.1}s` }}>
                    <div style={{ fontSize: i === 0 ? '1.8rem' : '1.1rem', minWidth: '40px', textAlign: 'center' }}>
                      {i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </div>
                    <Avatar name={p.name} size={i === 0 ? 42 : 34} index={i} />
                    <span style={{ flex: 1, fontWeight: 700, fontSize: i === 0 ? '1.2rem' : '1rem' }}>
                      {p.name} {p.socket_id === socket.id && <span style={{ color: C.accent }}>(you)</span>}
                    </span>
                    <span style={{
                      fontFamily: fonts.display,
                      fontSize: i === 0 ? '1.5rem' : '1.1rem',
                      color: i === 0 ? C.gold : C.text,
                    }}>
                      {p.score || 0} pts
                    </span>
                  </div>
                ))}

                <button
                  className="dw-btn"
                  style={{ ...btnStyle(C.accent), width: '100%', marginTop: '28px', fontSize: '1.1rem', padding: '16px' }}
                  onClick={() => window.location.reload()}
                >
                  🔄 Play Again
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

export default App;