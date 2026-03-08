import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

const rooms = {};
const THEMES = {
  Halloween: ["Vampire", "Pumpkin", "Ghost", "Witch’s Hat", "Broomstick"],
  Space: ["Black Hole", "Alien", "Meteor", "Spaceship", "Planet"],
  Fantasy: ["Wizard", "Enchanted Forest", "Crystal Ball", "Phoenix", "Magic Spell"],
  General: ["Apple", "Banana", "Cat", "Dog", "Elephant"]
};

function createRoom() {
  const roomId = Math.random().toString(36).substring(2, 8);
  rooms[roomId] = {
    id: roomId,
    players: [],
    state: 'lobby', // lobby, drawing, voting, results, final
    theme: 'General',
    round: 0,
    word: '',
    timer: 0,
    drawings: {}, // playerSocketId: drawingData
    votes: {},    // targetPlayerSocketId: count
    timerInterval: null
  };
  return rooms[roomId];
}

function getRoom(roomId) {
  return rooms[roomId] || null;
}

function startTimer(roomId, seconds, onComplete) {
  const room = rooms[roomId];
  if (!room) return;

  clearInterval(room.timerInterval);
  room.timer = seconds;

  room.timerInterval = setInterval(() => {
    room.timer--;
    io.to(roomId).emit('timer_update', room.timer);

    if (room.timer <= 0) {
      clearInterval(room.timerInterval);
      onComplete();
    }
  }, 1000);
}

function transitionToDrawing(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.state = 'drawing';
  room.round++;
  const themeWords = THEMES[room.theme] || THEMES.General;
  room.word = themeWords[Math.floor(Math.random() * themeWords.length)];
  room.drawings = {};
  room.votes = {};

  io.to(roomId).emit('game_update', {
    state: room.state,
    round: room.round,
    word: room.word
  });

  startTimer(roomId, 60, () => {
    transitionToVoting(roomId);
  });
}

function transitionToVoting(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.state = 'voting';

  io.to(roomId).emit('game_update', {
    state: room.state,
    drawings: room.drawings
  });

  startTimer(roomId, 20, () => {
    transitionToResults(roomId);
  });
}

function transitionToResults(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.state = 'results';

  // Update scores based on votes
  room.players.forEach(p => {
    const votesReceived = room.votes[p.id] || 0;
    p.score += votesReceived * 10;
  });

  io.to(roomId).emit('game_update', {
    state: room.state,
    players: room.players,
    votes: room.votes
  });

  startTimer(roomId, 10, () => {
    if (room.round >= 5) {
      room.state = 'final';
      io.to(roomId).emit('game_update', { state: room.state, players: room.players });
    } else {
      transitionToDrawing(roomId);
    }
  });
}

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('create_room', ({ name }) => {
    const room = createRoom();
    const roomId = room.id;
    socket.join(roomId);

    // Add host as the first player
    room.players.push({ id: socket.id, name, score: 0 });
    socket.roomId = roomId;

    socket.emit('room_created', roomId);
    io.to(roomId).emit('player_list_update', room.players);
    socket.emit('game_update', { 
      state: room.state, 
      round: room.round, 
      word: room.word,
      theme: room.theme 
    });
    console.log(`Room created: ${roomId} by ${name}`);
  });

  socket.on('select_theme', (selectedTheme) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (room && room.state === 'lobby' && room.players[0].id === socket.id) {
      room.theme = selectedTheme;
      io.to(roomId).emit('game_update', { theme: room.theme });
    }
  });

  socket.on('join_room', ({ roomId, name }) => {
    const room = getRoom(roomId);

    if (!room) {
      socket.emit('error_message', 'Room not found. Please check the ID or create a new room.');
      return;
    }

    socket.join(roomId);
    socket.roomId = roomId;

    // Check if player already exists
    const existingPlayer = room.players.find(p => p.id === socket.id);
    if (!existingPlayer) {
      room.players.push({ id: socket.id, name, score: 0 });
    }

    io.to(roomId).emit('player_list_update', room.players);
    socket.emit('game_update', { 
      state: room.state, 
      round: room.round, 
      word: room.word,
      theme: room.theme,
      drawings: room.drawings,
      players: room.players 
    });
  });

  socket.on('start_game', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId] && rooms[roomId].state === 'lobby') {
      transitionToDrawing(roomId);
    }
  });

  socket.on('draw_data', (data) => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId] && rooms[roomId].state === 'drawing') {
      socket.to(roomId).emit('draw_data', { userId: socket.id, ...data });
    }
  });

  socket.on('submit_drawing', (drawing) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (room && room.state === 'drawing') {
      room.drawings[socket.id] = drawing;

      if (Object.keys(room.drawings).length === room.players.length) {
        transitionToVoting(roomId);
      }
    }
  });

  socket.on('submit_vote', (targetId) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (room && room.state === 'voting' && targetId !== socket.id) {
      room.votes[targetId] = (room.votes[targetId] || 0) + 1;
    }
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
      io.to(roomId).emit('player_list_update', rooms[roomId].players);

      if (rooms[roomId].players.length === 0) {
        clearInterval(rooms[roomId].timerInterval);
        delete rooms[roomId];
      }
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`server running at http://localhost:${PORT}`);
});