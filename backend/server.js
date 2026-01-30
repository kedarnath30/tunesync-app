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
      /https:\/\/tunesync-.*\.vercel\.app$/
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
      participants: [{ 
        userId, 
        userName, 
        avatar, 
        socketId: socket.id,
        isHost: true,
        isBuffering: false
      }],
      hostId: userId,
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
      videoQueue: [],
      currentVideoIndex: 0,
      activeTab: 'music',
      currentVideoTime: 0,
      bufferingUsers: []
    });

    socket.join(roomCode);
    socket.emit('room-state', rooms.get(roomCode));
  });

  // Join room
  socket.on('join-room', ({ roomCode, userId, userName, avatar }) => {
    console.log('User joining room:', roomCode, userName);
    
    const room = rooms.get(roomCode);
    if (room) {
      const existingParticipant = room.participants.find(p => p.userId === userId);
      if (!existingParticipant) {
        room.participants.push({ 
          userId, 
          userName, 
          avatar, 
          socketId: socket.id,
          isHost: false,
          isBuffering: false
        });
      } else {
        existingParticipant.socketId = socket.id;
      }

      socket.join(roomCode);
      socket.emit('room-state', room);
      
      // If there's a video playing, sync new user immediately
      if (room.videoQueue.length > 0 && room.currentVideoIndex >= 0) {
        setTimeout(() => {
          socket.emit('video-changed', { 
            videoIndex: room.currentVideoIndex 
          });
          
          if (room.currentVideoTime > 0) {
            socket.emit('sync-video-timestamp', {
              currentTime: room.currentVideoTime,
              isPlaying: room.isPlaying
            });
          }
        }, 1000);
      }
      
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

  socket.on('add-to-queue', ({ roomCode, track }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.queue.push(track);
      io.to(roomCode).emit('queue-updated', room.queue);
    }
  });

  socket.on('volume-change', ({ roomCode, volume }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.volume = volume;
      io.to(roomCode).emit('volume-changed', { volume });
    }
  });

  socket.on('toggle-shuffle', ({ roomCode, isShuffle }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.isShuffle = isShuffle;
      io.to(roomCode).emit('shuffle-toggled', { isShuffle });
    }
  });

  socket.on('change-repeat', ({ roomCode, repeatMode }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.repeatMode = repeatMode;
      io.to(roomCode).emit('repeat-changed', { repeatMode });
    }
  });

  socket.on('chat-message', ({ roomCode, message }) => {
    io.to(roomCode).emit('chat-message', message);
  });

  socket.on('add-reaction', ({ roomCode, reaction }) => {
    io.to(roomCode).emit('reaction-added', reaction);
  });

  // VIDEO SYNC WITH HOST CONTROLS
  socket.on('sync-video', ({ roomCode, videoIndex }) => {
    console.log('Syncing video:', roomCode, videoIndex);
    const room = rooms.get(roomCode);
    if (room) {
      const sender = room.participants.find(p => p.socketId === socket.id);
      if (sender && sender.isHost) {
        room.currentVideoIndex = videoIndex;
        room.isPlaying = true;
        io.to(roomCode).emit('video-changed', { videoIndex });
      } else {
        socket.emit('error', { message: 'Only host can change videos' });
      }
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
      socket.to(roomCode).emit('tab-changed', { tab });
    }
  });

  socket.on('video-play', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (room) {
      const sender = room.participants.find(p => p.socketId === socket.id);
      if (sender && sender.isHost) {
        room.isPlaying = true;
        io.to(roomCode).emit('sync-play');
      }
    }
  });

  socket.on('video-pause', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (room) {
      const sender = room.participants.find(p => p.socketId === socket.id);
      if (sender && sender.isHost) {
        room.isPlaying = false;
        io.to(roomCode).emit('sync-pause');
      }
    }
  });

  // TIMESTAMP SYNC
  socket.on('video-timestamp-update', ({ roomCode, currentTime, isPlaying }) => {
    const room = rooms.get(roomCode);
    if (room) {
      const sender = room.participants.find(p => p.socketId === socket.id);
      if (sender && sender.isHost) {
        room.currentVideoTime = currentTime;
        room.isPlaying = isPlaying;
        socket.to(roomCode).emit('sync-video-timestamp', { currentTime, isPlaying });
      }
    }
  });

  // BUFFERING DETECTION
  socket.on('user-buffering', ({ roomCode, isBuffering, userId, userName }) => {
    const room = rooms.get(roomCode);
    if (room) {
      const participant = room.participants.find(p => p.userId === userId);
      if (participant) {
        participant.isBuffering = isBuffering;
        
        if (isBuffering) {
          if (!room.bufferingUsers.includes(userName)) {
            room.bufferingUsers.push(userName);
          }
        } else {
          room.bufferingUsers = room.bufferingUsers.filter(u => u !== userName);
        }
        
        io.to(roomCode).emit('buffering-status-update', {
          bufferingUsers: room.bufferingUsers,
          shouldPause: room.bufferingUsers.length > 0
        });
      }
    }
  });

  // TRANSFER HOST
  socket.on('transfer-host', ({ roomCode, newHostId }) => {
    const room = rooms.get(roomCode);
    if (room) {
      const sender = room.participants.find(p => p.socketId === socket.id);
      
      if (sender && sender.isHost) {
        sender.isHost = false;
        const newHost = room.participants.find(p => p.userId === newHostId);
        if (newHost) {
          newHost.isHost = true;
          room.hostId = newHostId;
          io.to(roomCode).emit('host-changed', {
            newHostId,
            newHostName: newHost.userName,
            participants: room.participants
          });
        }
      }
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    rooms.forEach((room, roomCode) => {
      const participantIndex = room.participants.findIndex(p => p.socketId === socket.id);
      if (participantIndex !== -1) {
        const leavingParticipant = room.participants[participantIndex];
        const wasHost = leavingParticipant.isHost;
        
        room.participants.splice(participantIndex, 1);
        
        if (wasHost && room.participants.length > 0) {
          room.participants[0].isHost = true;
          room.hostId = room.participants[0].userId;
          
          io.to(roomCode).emit('host-changed', {
            newHostId: room.participants[0].userId,
            newHostName: room.participants[0].userName,
            participants: room.participants
          });
        }
        
        if (room.participants.length > 0) {
          io.to(roomCode).emit('participants-updated', room.participants);
        } else {
          rooms.delete(roomCode);
          console.log('Room deleted:', roomCode);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`TuneSync server running on port ${PORT}`);
  console.log(`CORS enabled for: ${FRONTEND_URL}`);
});
