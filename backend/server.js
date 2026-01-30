const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const io = socketIO(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://tunesync-app.vercel.app",
      /https:\/\/tunesync-.*\.vercel\.app$/ // Allows all Vercel preview deployments
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://tunesync-app.vercel.app",
    /https:\/\/tunesync-.*\.vercel\.app$/
  ],
  credentials: true
}));

app.use(express.json());

// In-memory storage for rooms
const rooms = new Map();

// Test endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'TuneSync Server Running',
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Create room
  socket.on('create-room', ({ roomCode, roomData, userId, userName, avatar }) => {
    console.log('Creating room:', roomCode);
    
    rooms.set(roomCode, {
      ...roomData,
      participants: [{ userId, userName, avatar, socketId: socket.id }],
      queue: [
        { id: 1, title: 'Shape of You', artist: 'Ed Sheeran', duration: '3:45', type: 'itunes' },
        { id: 2, title: 'Blinding Lights', artist: 'The Weeknd', duration: '3:20', type: 'itunes' },
        { id: 3, title: 'Levitating', artist: 'Dua Lipa', duration: '3:23', type: 'itunes' }
      ],
      currentTrackIndex: 0,
      isPlaying: false,
      volume: 70,
      isShuffle: false,
      repeatMode: 'off',
      // Video properties
      videoQueue: [],
      currentVideoIndex: 0,
      activeTab: 'music'
    });

    socket.join(roomCode);
    socket.emit('room-state', rooms.get(roomCode));
  });

  // Join room
  socket.on('join-room', ({ roomCode, userId, userName, avatar }) => {
    console.log('User joining room:', roomCode, userName);
    
    const room = rooms.get(roomCode);
    if (room) {
      // Add participant if not already in room
      const existingParticipant = room.participants.find(p => p.userId === userId);
      if (!existingParticipant) {
        room.participants.push({ userId, userName, avatar, socketId: socket.id });
      } else {
        existingParticipant.socketId = socket.id;
      }

      socket.join(roomCode);
      socket.emit('room-state', room);
      io.to(roomCode).emit('participants-updated', room.participants);
    } else {
      socket.emit('error', { message: 'Room not found' });
    }
  });

  // Music playback controls
  socket.on('play', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.isPlaying = true;
      io.to(roomCode).emit('sync-play');
    }
  });

  socket.on('pause', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.isPlaying = false;
      io.to(roomCode).emit('sync-pause');
    }
  });

  socket.on('change-track', ({ roomCode, trackIndex }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.currentTrackIndex = trackIndex;
      room.isPlaying = true;
      io.to(roomCode).emit('sync-track-change', { trackIndex });
    }
  });

  // Queue management
  socket.on('add-to-queue', ({ roomCode, track }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.queue.push(track);
      io.to(roomCode).emit('queue-updated', room.queue);
    }
  });

  // Volume control
  socket.on('volume-change', ({ roomCode, volume }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.volume = volume;
      io.to(roomCode).emit('volume-changed', { volume });
    }
  });

  // Shuffle toggle
  socket.on('toggle-shuffle', ({ roomCode, isShuffle }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.isShuffle = isShuffle;
      io.to(roomCode).emit('shuffle-toggled', { isShuffle });
    }
  });

  // Repeat mode
  socket.on('change-repeat', ({ roomCode, repeatMode }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.repeatMode = repeatMode;
      io.to(roomCode).emit('repeat-changed', { repeatMode });
    }
  });

  // Chat
  socket.on('chat-message', ({ roomCode, message }) => {
    io.to(roomCode).emit('chat-message', message);
  });

  // Reactions
  socket.on('add-reaction', ({ roomCode, reaction }) => {
    io.to(roomCode).emit('reaction-added', reaction);
  });

  // VIDEO SYNC - New events for video functionality
  socket.on('sync-video', ({ roomCode, videoIndex }) => {
    console.log('Syncing video:', roomCode, videoIndex);
    const room = rooms.get(roomCode);
    if (room) {
      room.currentVideoIndex = videoIndex;
      room.isPlaying = true;
      io.to(roomCode).emit('video-changed', { videoIndex });
    }
  });

  socket.on('add-video-to-queue', ({ roomCode, video }) => {
    console.log('Adding video to queue:', roomCode);
    const room = rooms.get(roomCode);
    if (room) {
      room.videoQueue.push(video);
      io.to(roomCode).emit('video-queue-updated', room.videoQueue);
    }
  });

  socket.on('sync-tab-change', ({ roomCode, tab }) => {
    console.log('Tab changed:', roomCode, tab);
    const room = rooms.get(roomCode);
    if (room) {
      room.activeTab = tab;
      // Broadcast to all users in room except sender
      socket.to(roomCode).emit('tab-changed', { tab });
    }
  });

  socket.on('video-play', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.isPlaying = true;
      io.to(roomCode).emit('sync-play');
    }
  });

  socket.on('video-pause', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.isPlaying = false;
      io.to(roomCode).emit('sync-pause');
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Remove participant from all rooms
    rooms.forEach((room, roomCode) => {
      const participantIndex = room.participants.findIndex(p => p.socketId === socket.id);
      if (participantIndex !== -1) {
        room.participants.splice(participantIndex, 1);
        
        // Notify remaining participants
        if (room.participants.length > 0) {
          io.to(roomCode).emit('participants-updated', room.participants);
        } else {
          // Delete empty rooms
          rooms.delete(roomCode);
          console.log('Room deleted:', roomCode);
        }
      }
    });
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`TuneSync server running on port ${PORT}`);
  console.log(`CORS enabled for: ${FRONTEND_URL}`);
});