const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', ({ roomCode, roomData, userId, userName }) => {
    rooms.set(roomCode, {
      ...roomData,
      participants: [{ userId, userName, socketId: socket.id }],
      queue: [
        { id: 1, title: 'Shape of You', artist: 'Ed Sheeran' },
        { id: 2, title: 'Blinding Lights', artist: 'The Weeknd' },
        { id: 3, title: 'Levitating', artist: 'Dua Lipa' }
      ],
      currentTrackIndex: 0,
      isPlaying: false
    });
    socket.join(roomCode);
  });

  socket.on('join-room', ({ roomCode, userId, userName }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.participants.push({ userId, userName, socketId: socket.id });
      socket.join(roomCode);
      socket.emit('room-state', room);
      io.to(roomCode).emit('participants-updated', room.participants);
    }
  });

  socket.on('play', ({ roomCode }) => io.to(roomCode).emit('sync-play'));
  socket.on('pause', ({ roomCode }) => io.to(roomCode).emit('sync-pause'));
  socket.on('change-track', ({ roomCode, trackIndex }) => {
    const room = rooms.get(roomCode);
    if (room) room.currentTrackIndex = trackIndex;
    io.to(roomCode).emit('sync-track-change', { trackIndex });
  });
  socket.on('add-to-queue', ({ roomCode, track }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.queue.push(track);
      io.to(roomCode).emit('queue-updated', room.queue);
    }
  });
  socket.on('chat-message', ({ roomCode, message }) => {
    socket.to(roomCode).emit('chat-message', message);
  });

  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

server.listen(3001, () => console.log('Server running on http://localhost:3001'));