import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

// Using local rooms for timer intervals and ephemeral state only
const liveRooms = {};
const THEMES = {

  general: [
    "Chandelier",
    "Robot",
    "Kangaroo",
    "Volcano",
    "Puzzle",
    "Origami",
    "Lighthouse",
    "Dinosaur",
    "Gladiator",
    "Zombie"
  ],
  halloween: [
    "Ghost",
    "Vampire",
    "Witch",
    "Jack-o-lantern",
    "Spider web",
    "Skeleton",
    "Haunted house",
    "Broomstick",
    "Black cat",
    "Candy bucket"
  ],
  food_fun: [
    "S’mores",
    "Pizza slice",
    "Cream cheese",
    "Waffles",
    "Cereal bowl",
    "Burger",
    "Cupcake",
    "Hot dog",
    "Donut",
    "Pancakes"
  ],
  mythical_creatures: [
    "Ninja",
    "Unicorn",
    "Dragon",
    "Kraken",
    "Phoenix",
    "Griffin",
    "Mermaid",
    "Cyclops",
    "Goblin",
    "Fairy"
  ],
  space_adventure: [
    "Rocket",
    "Astronaut",
    "Alien",
    "Satellite",
    "Planet",
    "Asteroid",
    "Spaceship",
    "Comet",
    "Moon rover",
    "Space station"
  ],
  underwater_world: [
    "Shark",
    "Octopus",
    "Coral reef",
    "Treasure chest",
    "Submarine",
    "Seahorse",
    "Jellyfish",
    "Dolphin",
    "Anchor",
    "Pirate ship"
  ],
  jungle_safari: [
    "Lion",
    "Tiger",
    "Elephant",
    "Monkey",
    "Toucan",
    "Snake",
    "Waterfall",
    "Palm tree",
    "Crocodile",
    "Jungle temple"
  ],
  superheroes: [
    "Superhero",
    "Cape",
    "Mask",
    "Shield",
    "Laser",
    "Jetpack",
    "Supervillain",
    "Secret lair",
    "Lightning bolt",
    "Gadget"
  ],
  sports_arena: [
    "Football",
    "Basketball hoop",
    "Tennis racket",
    "Cricket bat",
    "Goalpost",
    "Boxing gloves",
    "Skateboard",
    "Surfboard",
    "Medal",
    "Trophy"
  ],
  fantasy_kingdom: [
    "Castle",
    "Knight",
    "Wizard",
    "Magic wand",
    "Dragon egg",
    "Potion bottle",
    "Spell book",
    "Fairy",
    "Treasure map",
    "Magic mirror"
  ],
  technology: [
    "Laptop",
    "Smartphone",
    "Headphones",
    "Keyboard",
    "Computer mouse",
    "USB drive",
    "Drone",
    "Robot",
    "VR headset",
    "Microchip"
  ],
  travel_adventure: [
    "Airplane",
    "Suitcase",
    "Compass",
    "Map",
    "Passport",
    "Hot air balloon",
    "Train",
    "Tent",
    "Backpack",
    "Camera"
  ]

};

async function createRoom() {
  const code = Math.random().toString(36).substring(2, 8);
  const { data, error } = await supabase
    .from('rooms')
    .insert([{ code, state: 'lobby', theme: 'general' }])
    .select()
    .single();

  if (error) {
    console.error('Error creating room:', error);
    return null;
  }

  liveRooms[data.id] = {
    timerInterval: null,
    timer: 0
  };

  return data;
}

async function getRoom(roomIdOrCode) {
  // Check if roomIdOrCode is a valid UUID format
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomIdOrCode);

  let query = supabase
    .from('rooms')
    .select(`
      *,
      participants (*)
    `);

  if (isUUID) {
    query = query.eq('id', roomIdOrCode);
  } else {
    query = query.eq('code', roomIdOrCode);
  }

  const { data: room, error } = await query.maybeSingle();

  if (error) {
    console.error('Error fetching room:', error);
    return null;
  }

  return room;
}

function startTimer(roomId, seconds, onComplete) {
  if (!liveRooms[roomId]) {
    liveRooms[roomId] = { timerInterval: null, timer: 0 };
  }
  const room = liveRooms[roomId];

  clearInterval(room.timerInterval);
  room.timer = seconds;

  room.timerInterval = setInterval(async () => {
    room.timer--;
    io.to(roomId).emit('timer_update', room.timer);

    if (room.timer <= 0) {
      clearInterval(room.timerInterval);
      onComplete(); // callback function
    }

    // Periodically sync timer to DB (every 5 seconds)
    if (room.timer % 5 === 0) {
      await supabase.from('rooms').update({ timer: room.timer }).eq('id', roomId);
    }
  }, 1000);
}

async function transitionToDrawing(roomId) {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (!room) return;

  const nextRound = (room.current_round || 0) + 1;
  const themeKey = (room.theme || 'general').toLowerCase();
  const themeWords = THEMES[themeKey] || THEMES.general;
  const word = themeWords[Math.floor(Math.random() * themeWords.length)];

  await supabase
    .from('rooms')
    .update({
      state: 'drawing',
      current_round: nextRound,
      current_word: word
    })
    .eq('id', roomId);

  io.to(roomId).emit('game_update', {
    state: 'drawing',
    round: nextRound,
    word: word
  });

  startTimer(roomId, 60, () => {
    transitionToVoting(roomId);
  });
}

async function transitionToVoting(roomId) {
  await supabase
    .from('rooms')
    .update({ state: 'voting' })
    .eq('id', roomId);

  // Fetch drawings for this round
  const { data: room } = await supabase.from('rooms').select('current_round').eq('id', roomId).single();
  const { data: drawings } = await supabase
    .from('drawings')
    .select('*, participants(socket_id)')
    .eq('room_id', roomId)
    .eq('round', room.current_round);

  const drawingsMap = {};
  drawings?.forEach(d => {
    drawingsMap[d.participants.socket_id] = d.data;
  });

  io.to(roomId).emit('game_update', {
    state: 'voting',
    drawings: drawingsMap
  });

  startTimer(roomId, 20, () => {
    transitionToResults(roomId);
  });
}

async function transitionToResults(roomId) {
  const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();

  // Calculate results from votes table
  const { data: votes } = await supabase
    .from('votes')
    .select('target_participant_id')
    .eq('room_id', roomId)
    .eq('round', room.current_round);

  const voteCounts = {};
  votes?.forEach(v => {
    voteCounts[v.target_participant_id] = (voteCounts[v.target_participant_id] || 0) + 1;
  });

  // Update scores in participants table
  const { data: participants } = await supabase.from('participants').select('*').eq('room_id', roomId);

  for (const p of participants) {
    const receivedVotes = voteCounts[p.id] || 0;
    if (receivedVotes > 0) {
      await supabase
        .from('participants')
        .update({ score: p.score + (receivedVotes * 10) })
        .eq('id', p.id);
    }
  }

  // Get updated participants
  const { data: updatedParticipants } = await supabase.from('participants').select('*').eq('room_id', roomId);

  await supabase
    .from('rooms')
    .update({ state: 'results' })
    .eq('id', roomId);

  io.to(roomId).emit('game_update', {
    state: 'results',
    players: updatedParticipants,
    votes: voteCounts // Note: target_participant_id based
  });

  startTimer(roomId, 10, () => {
    if (room.current_round >= 5) {
      supabase.from('rooms').update({ state: 'final' }).eq('id', roomId).then(() => {
        io.to(roomId).emit('game_update', { state: 'final', players: updatedParticipants });
      });
    } else {
      transitionToDrawing(roomId);
    }
  });
}

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('create_room', async ({ name }) => {
    const room = await createRoom();
    if (!room) return;

    const roomId = room.id;
    socket.join(roomId);
    socket.roomId = roomId;

    // Add host as the first player
    const { data: host, error } = await supabase
      .from('participants')
      .insert([{ room_id: roomId, socket_id: socket.id, name, score: 0, is_host: true }])
      .select()
      .single();

    if (error) {
      console.error('Error adding host:', error);
      return;
    }

    socket.emit('room_created', room.code); // Emit the code for joining

    const updatedRoom = await getRoom(roomId);
    io.to(roomId).emit('player_list_update', updatedRoom.participants);
    socket.emit('game_update', {
      state: updatedRoom.state,
      round: updatedRoom.current_round,
      word: updatedRoom.current_word,
      theme: updatedRoom.theme
    });
    console.log(`Room created: ${room.code} by ${name}`);
  });

  socket.on('select_theme', async (selectedTheme) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const { data: participant } = await supabase
      .from('participants')
      .select('is_host')
      .eq('room_id', roomId)
      .eq('socket_id', socket.id)
      .single();

    if (participant?.is_host) {
      await supabase.from('rooms').update({ theme: selectedTheme }).eq('id', roomId);
      io.to(roomId).emit('game_update', { theme: selectedTheme });
    }
  });

  socket.on('join_room', async ({ roomId: roomCode, name }) => {
    console.log(`Join attempt: code=${roomCode}, player=${name}`);
    const room = await getRoom(roomCode);

    if (!room) {
      console.log(`Room not found for code: ${roomCode}`);
      socket.emit('error_message', 'Room not found. Please check the ID or create a new room.');
      return;
    }
    console.log(`Room found: id=${room.id}, code=${room.code}, participants=${room.participants?.length}`);

    const roomId = room.id;
    socket.join(roomId);
    socket.roomId = roomId;

    // Check if player already exists
    let { data: participant } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('socket_id', socket.id)
      .maybeSingle();

    if (!participant) {
      const { data: newParticipant } = await supabase
        .from('participants')
        .insert([{ room_id: roomId, socket_id: socket.id, name, score: 0 }])
        .select()
        .single();
      participant = newParticipant;
    } else {
      await supabase.from('participants').update({ name }).eq('id', participant.id);
    }

    const updatedRoom = await getRoom(roomId);
    io.to(roomId).emit('player_list_update', updatedRoom.participants);

    // Fetch drawings for current round if in voting/results
    let drawingsMap = {};
    if (updatedRoom.state === 'voting' || updatedRoom.state === 'results') {
      const { data: drawings } = await supabase
        .from('drawings')
        .select('*, participants(socket_id)')
        .eq('room_id', roomId)
        .eq('round', updatedRoom.current_round);

      drawings?.forEach(d => {
        drawingsMap[d.participants.socket_id] = d.data;
      });
    }

    socket.emit('game_update', {
      state: updatedRoom.state,
      round: updatedRoom.current_round,
      word: updatedRoom.current_word,
      theme: updatedRoom.theme,
      drawings: drawingsMap,
      players: updatedRoom.participants
    });
  });

  socket.on('start_game', async () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const { data: room } = await supabase.from('rooms').select('state').eq('id', roomId).single();
    if (room?.state === 'lobby') {
      transitionToDrawing(roomId);
    }
  });

  socket.on('draw_data', (data) => {
    const roomId = socket.roomId;
    if (roomId) {
      socket.to(roomId).emit('draw_data', { userId: socket.id, ...data });
    }
  });

  socket.on('submit_drawing', async (drawing) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = await getRoom(roomId);
    if (room?.state === 'drawing') {
      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('room_id', roomId)
        .eq('socket_id', socket.id)
        .single();

      await supabase.from('drawings').insert([{
        room_id: roomId,
        participant_id: participant.id,
        round: room.current_round,
        data: drawing
      }]);

      const { count } = await supabase
        .from('drawings')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('round', room.current_round);

      if (count === room.participants.length) {
        transitionToVoting(roomId);
      }
    }
  });

  socket.on('submit_vote', async (targetSocketId) => {
    const roomId = socket.roomId;
    if (!roomId || targetSocketId === socket.id) return;

    const room = await getRoom(roomId);
    if (room?.state === 'voting') {
      const { data: voter } = await supabase
        .from('participants')
        .select('id')
        .eq('room_id', roomId)
        .eq('socket_id', socket.id)
        .single();

      const { data: target } = await supabase
        .from('participants')
        .select('id')
        .eq('room_id', roomId)
        .eq('socket_id', targetSocketId)
        .single();

      await supabase.from('votes').insert([{
        room_id: roomId,
        voter_id: voter.id,
        target_participant_id: target.id,
        round: room.current_round
      }]);
    }
  });

  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}, roomId: ${socket.roomId}`);
    const roomId = socket.roomId;
    if (roomId) {
      // Remove participant from DB
      await supabase.from('participants').delete().eq('socket_id', socket.id).eq('room_id', roomId);

      const updatedRoom = await getRoom(roomId);
      if (updatedRoom) {
        io.to(roomId).emit('player_list_update', updatedRoom.participants || []);

        // Only clean up timer intervals, but DON'T delete the room from the DB.
        // This prevents Vite HMR / page refreshes from nuking rooms before others can join.
        if ((updatedRoom.participants || []).length === 0) {
          if (liveRooms[roomId]) {
            clearInterval(liveRooms[roomId].timerInterval);
            delete liveRooms[roomId];
          }
          console.log(`Room ${roomId} has no participants, but keeping it in DB for rejoin.`);
        }
      }
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`server running at http://localhost:${PORT}`);
});