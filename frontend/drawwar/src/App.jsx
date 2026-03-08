import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import DrawingCanvas from './components/DrawingCanvas';
import './App.css';

const socket = io('http://localhost:3000');

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

  const handleJoin = () => {
    if (name && roomId) {
      socket.emit('join_room', { roomId, name });
      setJoined(true);
    } else {
      alert("Please enter both Name and Room ID");
    }
  };

  const handleCreateRoom = () => {
    if (name) {
      socket.emit('create_room', { name });
    } else {
      alert("Please enter your name first");
    }
  };

  const handleStart = () => {
    socket.emit('start_game');
  };

  const handleSubmitDrawing = (data) => {
    socket.emit('submit_drawing', data);
  };

  const handleVote = (playerSocketId) => {
    if (playerSocketId !== socket.id) {
      setSelectedVote(playerSocketId);
      socket.emit('submit_vote', playerSocketId);
    }
  };

  if (!joined) {
    return (
      <div className="app-container">
        <header>
          <h1>DrawWar</h1>
          <p>The ultimate drawing showdown</p>
        </header>
        <div className="card" style={{ maxWidth: '400px', margin: '0 auto' }}>
          <div className="input-group">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
          </div>
          <div className="input-group">
            <label>Room ID</label>
            <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Enter room ID to join" />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={handleJoin}>Join Room</button>
            <button onClick={handleCreateRoom} style={{ background: 'var(--accent)' }}>Create Room</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Room: {roomId}</h2>
          <h2>Round {round}/5</h2>
        </div>
        <div className="timer-bar">
          <div
            className="timer-fill"
            style={{ width: `${(timer / 60) * 100}%` }}
          ></div>
        </div>
      </header>

      {gameState === 'lobby' && (
        <div className="card">
          <h3>Welcome, {name}!</h3>
          <p style={{ margin: '1rem 0', color: 'var(--text-muted)' }}>Waiting for players to join...</p>
          <div className="player-list">
            {players.map(p => (
              <div key={p.id} className="player-tag">{p.name} {p.id === socket.id && '(You)'}</div>
            ))}
          </div>
          
          <div className="input-group" style={{ marginTop: '1.5rem' }}>
            <label>Select Theme</label>
            {players[0]?.id === socket.id ? (
              <select 
                value={theme} 
                onChange={(e) => socket.emit('select_theme', e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem', 
                  borderRadius: '0.5rem', 
                  background: 'rgba(15, 23, 42, 0.5)', 
                  color: 'white', 
                  border: '1px solid rgba(255, 255, 255, 0.1)' 
                }}
              >
                <option value="General">General</option>
                <option value="Halloween">Halloween</option>
                <option value="Space">Space</option>
                <option value="Fantasy">Fantasy</option>
              </select>
            ) : (
              <div className="player-tag" style={{ background: 'var(--primary)', display: 'inline-block' }}>
                Current Theme: {theme}
              </div>
            )}
          </div>

          <button onClick={handleStart} disabled={players.length < 2} style={{ marginTop: '1.5rem' }}>Start Game</button>
          {players.length < 2 && <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Minimum 2 players required</p>}
        </div>
      )}

      {gameState === 'drawing' && (
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <h3>Draw this: <span style={{ color: 'var(--accent)', fontSize: '1.5rem' }}>{word}</span></h3>
            <p>{timer} seconds left!</p>
          </div>
          <DrawingCanvas
            onDrawUpdate={(data) => handleSubmitDrawing(data)}
          />
        </div>
      )}

      {gameState === 'voting' && (
        <div className="card">
          <h3 style={{ textAlign: 'center' }}>Vote for the best drawing!</h3>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>You cannot vote for yourself</p>
          <div className="gallery">
            {Object.entries(drawings).map(([id, data]) => (
              <div
                key={id}
                className={`gallery-item ${selectedVote === id ? 'selected' : ''} ${id === socket.id ? 'disabled' : ''}`}
                onClick={() => handleVote(id)}
              >
                <img src={data} alt="drawing" />
                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                  {players.find(p => p.id === id)?.name} {id === socket.id && '(You)'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {gameState === 'results' && (
        <div className="card">
          <h3 style={{ textAlign: 'center' }}>Round Results</h3>
          <div style={{ marginTop: '2rem' }}>
            {players.sort((a, b) => b.score - a.score).map((p, index) => (
              <div key={p.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '1rem',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                background: index === 0 ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
              }}>
                <span>{index + 1}. {p.name} {p.id === socket.id && '(You)'}</span>
                <span style={{ fontWeight: 'bold' }}>{p.score} pts</span>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)' }}>Next round starting soon...</p>
        </div>
      )}

      {gameState === 'final' && (
        <div className="card">
          <h2 style={{ textAlign: 'center' }}>🏆 Final Leaderboard 🏆</h2>
          <div style={{ marginTop: '2rem' }}>
            {players.sort((a, b) => b.score - a.score).map((p, index) => (
              <div key={p.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '1.5rem',
                fontSize: index === 0 ? '1.5rem' : '1.1rem',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                background: index === 0 ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.2) 0%, rgba(244, 63, 94, 0.1) 100%)' : 'transparent'
              }}>
                <span>{index === 0 ? '👑' : index + 1 + '.'} {p.name} {p.id === socket.id && '(You)'}</span>
                <span style={{ fontWeight: 'bold' }}>{p.score} pts</span>
              </div>
            ))}
          </div>
          <button style={{ marginTop: '2rem' }} onClick={() => window.location.reload()}>Play Again</button>
        </div>
      )}
    </div>
  );
}

export default App;
