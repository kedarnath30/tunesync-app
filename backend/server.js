const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
  "http://localhost:3000",
  "https://tunesync-app.vercel.app",
  /https:\/\/tunesync-.*\.vercel\.app$/ // Allows all Vercel preview deployments
],
    methods: ["GET", "POST"]
  }
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', ({ roomCode, roomData, userId, userName, avatar }) => {
    rooms[roomCode] = {
      ...roomData,
      participants: [{ userId, userName, socketId: socket.id, avatar: avatar || '👤' }],
      queue: [],
      currentTrackIndex: 0,
      isPlaying: false,
      volume: 70,
      isShuffle: false,
      repeatMode: 'off'
    };
    socket.join(roomCode);
    socket.emit('room-state', rooms[roomCode]);
    console.log('Room created:', roomCode, 'by', userName);
  });

  socket.on('join-room', ({ roomCode, userId, userName, avatar }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].participants.push({ userId, userName, socketId: socket.id, avatar: avatar || '👤' });
      socket.join(roomCode);
      socket.emit('room-state', rooms[roomCode]);
      io.to(roomCode).emit('participants-updated', rooms[roomCode].participants);
      console.log('User joined room:', roomCode, userName);
    } else {
      socket.emit('error', { message: 'Room not found' });
    }
  });

  socket.on('play', ({ roomCode }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].isPlaying = true;
      socket.to(roomCode).emit('sync-play');
      console.log('Play in room:', roomCode);
    }
  });

  socket.on('pause', ({ roomCode }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].isPlaying = false;
      socket.to(roomCode).emit('sync-pause');
      console.log('Pause in room:', roomCode);
    }
  });

  socket.on('change-track', ({ roomCode, trackIndex }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].currentTrackIndex = trackIndex;
      rooms[roomCode].isPlaying = true;
      socket.to(roomCode).emit('sync-track-change', { trackIndex });
      console.log('Track changed in room:', roomCode, 'to index:', trackIndex);
    }
  });

  socket.on('add-to-queue', ({ roomCode, track }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].queue.push(track);
      io.to(roomCode).emit('queue-updated', rooms[roomCode].queue);
      console.log('Track added to queue in room:', roomCode);
    }
  });

  socket.on('chat-message', ({ roomCode, message }) => {
    socket.to(roomCode).emit('chat-message', message);
    console.log('Chat message in room:', roomCode, 'from', message.userName);
  });

  socket.on('add-reaction', ({ roomCode, reaction }) => {
    socket.to(roomCode).emit('reaction-added', reaction);
    console.log('Reaction added in room:', roomCode);
  });

  // New: Volume control
  socket.on('volume-change', ({ roomCode, volume }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].volume = volume;
      socket.to(roomCode).emit('volume-changed', { volume });
      console.log('Volume changed in room:', roomCode, 'to', volume);
    }
  });

  // New: Shuffle toggle
  socket.on('toggle-shuffle', ({ roomCode, isShuffle }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].isShuffle = isShuffle;
      socket.to(roomCode).emit('shuffle-toggled', { isShuffle });
      console.log('Shuffle toggled in room:', roomCode, 'to', isShuffle);
    }
  });

  // New: Repeat mode change
  socket.on('change-repeat', ({ roomCode, repeatMode }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].repeatMode = repeatMode;
      socket.to(roomCode).emit('repeat-changed', { repeatMode });
      console.log('Repeat mode changed in room:', roomCode, 'to', repeatMode);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove user from rooms
    Object.keys(rooms).forEach(roomCode => {
      const room = rooms[roomCode];
      const participant = room.participants.find(p => p.socketId === socket.id);
      
      room.participants = room.participants.filter(p => p.socketId !== socket.id);
      
      if (room.participants.length === 0) {
        console.log('Room deleted (empty):', roomCode);
        delete rooms[roomCode];
      } else {
        io.to(roomCode).emit('participants-updated', room.participants);
        if (participant) {
          console.log('User left room:', roomCode, participant.userName);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎵 TuneSync Server running on http://localhost:${PORT}`);
  console.log('Waiting for connections...');
});
