-- Create rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  state TEXT DEFAULT 'lobby',
  theme TEXT DEFAULT 'General',
  current_round INT DEFAULT 0,
  current_word TEXT,
  timer INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create participants table
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  socket_id TEXT,
  name TEXT NOT NULL,
  score INT DEFAULT 0,
  is_host BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now()
);

-- Create drawings table
CREATE TABLE drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  round INT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create votes table
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  target_participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  round INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
