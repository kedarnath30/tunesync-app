import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { searchiTunesSongs } from './services/youtube';
import { searchYouTubeVideos } from './services/youtubeVideo';
import AudioPlayer from './AudioPlayer';
import YouTubePlayer from './YouTubePlayer';

function App() {
  const [activeTab, setActiveTab] = useState('music'); // 'music' or 'videos'
const [videoQueue, setVideoQueue] = useState([]);
const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [view, setView] = useState('setup');
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [activeRoom, setActiveRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('#8B5CF6');
  const [queue, setQueue] = useState([
    { id: 1, title: 'Shape of You', artist: 'Ed Sheeran', duration: '3:45' },
    { id: 2, title: 'Blinding Lights', artist: 'The Weeknd', duration: '3:20' },
    { id: 3, title: 'Levitating', artist: 'Dua Lipa', duration: '3:23' }
  ]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [reactions, setReactions] = useState({});
  const [volume, setVolume] = useState(70);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'all', 'one'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [userAvatar, setUserAvatar] = useState('👤');
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  const currentTrack = queue[currentTrackIndex];

  // Avatar options
  const avatarOptions = ['👤', '😊', '🎵', '🎸', '🎹', '🎤', '🎧', '🎼', '🎺', '🎻', '🥁', '🎷'];

  useEffect(() => {
    if (userName && !socketRef.current) {
      setIsLoading(true);
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
socketRef.current = io(BACKEND_URL);
      
      socketRef.current.on('connect', () => {
        setIsConnected(true);
        setIsLoading(false);
        setError('');
      });
      
      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
        setError('Disconnected from server. Trying to reconnect...');
      });
      
      socketRef.current.on('connect_error', () => {
        setError('Failed to connect to server. Please check if the server is running.');
        setIsLoading(false);
      });
      
      socketRef.current.on('room-state', (room) => {
        setParticipants(room.participants.map(p => ({ name: p.userName, avatar: p.avatar || '👤' })));
        if (room.queue) setQueue(room.queue);
        if (room.currentTrackIndex !== undefined) setCurrentTrackIndex(room.currentTrackIndex);
        if (room.isPlaying !== undefined) setIsPlaying(room.isPlaying);
        if (room.volume !== undefined) setVolume(room.volume);
        if (room.isShuffle !== undefined) setIsShuffle(room.isShuffle);
        if (room.repeatMode !== undefined) setRepeatMode(room.repeatMode);
      });
      
      socketRef.current.on('participants-updated', (p) => 
        setParticipants(p.map(x => ({ name: x.userName, avatar: x.avatar || '👤' })))
      );
      
      socketRef.current.on('sync-play', () => setIsPlaying(true));
      socketRef.current.on('sync-pause', () => setIsPlaying(false));
      
      socketRef.current.on('sync-track-change', ({ trackIndex }) => {
        setCurrentTrackIndex(trackIndex);
        setIsPlaying(true);
      });
      
      socketRef.current.on('queue-updated', (newQueue) => setQueue(newQueue));
      socketRef.current.on('chat-message', (msg) => setChatMessages(prev => [...prev, msg]));
      
      socketRef.current.on('reaction-added', ({ trackId, emoji, userName }) => {
        setReactions(prev => ({
          ...prev,
          [trackId]: [...(prev[trackId] || []), { emoji, userName }]
        }));
      });
      
      socketRef.current.on('volume-changed', ({ volume }) => setVolume(volume));
      socketRef.current.on('shuffle-toggled', ({ isShuffle }) => setIsShuffle(isShuffle));
      socketRef.current.on('repeat-changed', ({ repeatMode }) => setRepeatMode(repeatMode));
    }
  }, [userName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const connect = () => { 
    if (userName.trim()) {
      setView('home');
    }
  };

  const createRoom = () => {
    if (roomName.trim() && socketRef.current) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      socketRef.current.emit('create-room', { 
        roomCode: code, 
        roomData: { name: roomName, code, theme: selectedTheme }, 
        userId: Date.now(), 
        userName,
        avatar: userAvatar
      });
      setActiveRoom({ name: roomName, code, theme: selectedTheme });
      setParticipants([{ name: userName, avatar: userAvatar }]);
      setView('room');
      setRoomName('');
    }
  };

  const joinRoomByCode = () => {
    if (joinCode.trim() && socketRef.current) {
      setIsLoading(true);
      const code = joinCode.toUpperCase();
      socketRef.current.emit('join-room', { 
        roomCode: code, 
        userId: Date.now(), 
        userName,
        avatar: userAvatar
      });
      setActiveRoom({ name: 'Room ' + code, code, theme: '#8B5CF6' });
      setView('room');
      setJoinCode('');
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  const togglePlay = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    if (socketRef.current && activeRoom) {
      socketRef.current.emit(newState ? 'play' : 'pause', { roomCode: activeRoom.code });
    }
  };

  const nextTrack = () => {
    let newIndex;
    
    if (repeatMode === 'one') {
      newIndex = currentTrackIndex;
    } else if (isShuffle) {
      newIndex = Math.floor(Math.random() * queue.length);
    } else {
      newIndex = currentTrackIndex + 1;
      if (newIndex >= queue.length) {
        if (repeatMode === 'all') {
          newIndex = 0;
        } else {
          return; // Don't go past end if not repeating
        }
      }
    }
    
    setCurrentTrackIndex(newIndex);
    setIsPlaying(true);
    if (socketRef.current && activeRoom) {
      socketRef.current.emit('change-track', { roomCode: activeRoom.code, trackIndex: newIndex });
    }
  };const handleTrackEnded = () => {
    console.log('Track ended, playing next...');
    nextTrack();
  };
  const previousTrack = () => {
    if (currentTrackIndex > 0) {
      const newIndex = currentTrackIndex - 1;
      setCurrentTrackIndex(newIndex);
      setIsPlaying(true);
      if (socketRef.current && activeRoom) {
        socketRef.current.emit('change-track', { roomCode: activeRoom.code, trackIndex: newIndex });
      }
    }
  };

  const playTrack = (index) => {
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    if (socketRef.current && activeRoom) {
      socketRef.current.emit('change-track', { roomCode: activeRoom.code, trackIndex: index });
    }
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    if (socketRef.current && activeRoom) {
      socketRef.current.emit('volume-change', { roomCode: activeRoom.code, volume: newVolume });
    }
  };

  const toggleShuffle = () => {
    const newShuffle = !isShuffle;
    setIsShuffle(newShuffle);
    if (socketRef.current && activeRoom) {
      socketRef.current.emit('toggle-shuffle', { roomCode: activeRoom.code, isShuffle: newShuffle });
    }
  };

  const cycleRepeat = () => {
    const modes = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    const newMode = modes[(currentIndex + 1) % modes.length];
    setRepeatMode(newMode);
    if (socketRef.current && activeRoom) {
      socketRef.current.emit('change-repeat', { roomCode: activeRoom.code, repeatMode: newMode });
    }
  };

  const searchSongs = async () => {
  if (searchQuery.trim()) {
    setIsLoading(true);
    try {
      const results = await searchiTunesSongs(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        alert('No songs found. Try a different search!');
      }
    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed. Please try again!');
    } finally {
      setIsLoading(false);
    }
  }
};

  const addToQueue = (song) => {
    const newSong = { ...song, addedBy: userName };
    const newQueue = [...queue, newSong];
    setQueue(newQueue);
    setSearchResults([]);
    setSearchQuery('');
    if (socketRef.current && activeRoom) {
      socketRef.current.emit('add-to-queue', { roomCode: activeRoom.code, track: newSong });
    }
  };

  const sendMessage = () => {
    if (message.trim() && socketRef.current && activeRoom) {
      const msg = { userName, text: message, timestamp: Date.now(), avatar: userAvatar };
      socketRef.current.emit('chat-message', { roomCode: activeRoom.code, message: msg });
      setChatMessages(prev => [...prev, msg]);
      setMessage('');
    }
  };

  const addReaction = (trackId, emoji) => {
    if (socketRef.current && activeRoom) {
      const reaction = { trackId, emoji, userName };
      socketRef.current.emit('add-reaction', { roomCode: activeRoom.code, reaction });
      setReactions(prev => ({
        ...prev,
        [trackId]: [...(prev[trackId] || []), reaction]
      }));
    }
  };

  const getRepeatIcon = () => {
    if (repeatMode === 'off') return '🔁';
    if (repeatMode === 'all') return '🔁';
    return '🔂';
  };

  const s = {
    page: { 
      minHeight: '100vh', 
      background: isDarkMode 
        ? 'linear-gradient(135deg, #581c87, #9d1753, #991b1b)' 
        : 'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
      padding: '24px', 
      color: isDarkMode ? 'white' : '#111', 
      fontFamily: 'Arial',
      transition: 'all 0.3s ease'
    },
    card: { 
      background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)', 
      borderRadius: '16px', 
      padding: '24px', 
      maxWidth: '500px', 
      margin: '0 auto',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
      backdropFilter: 'blur(10px)',
      transition: 'all 0.3s ease',
      animation: 'fadeIn 0.5s ease'
    },
    input: { 
      width: '100%', 
      padding: '12px', 
      borderRadius: '8px', 
      background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', 
      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`, 
      color: isDarkMode ? 'white' : '#111', 
      marginBottom: '16px', 
      fontSize: '16px',
      transition: 'all 0.2s ease'
    },
    btn: { 
      width: '100%', 
      background: 'linear-gradient(90deg, #ec4899, #a855f7)', 
      color: 'white', 
      padding: '16px', 
      borderRadius: '8px', 
      border: 'none', 
      cursor: 'pointer', 
      fontSize: '16px', 
      fontWeight: 'bold',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      boxShadow: '0 4px 15px rgba(236, 72, 153, 0.3)'
    }
  };

  // Add CSS animation
  const styleSheet = document.createElement("style");
  styleSheet.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.2);
    }
    button:active {
      transform: translateY(0);
    }
  `;
  if (!document.head.querySelector('style[data-tunesync]')) {
    styleSheet.setAttribute('data-tunesync', 'true');
    document.head.appendChild(styleSheet);
  }

  if (view === 'setup') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <h1 style={{ fontSize: '48px', textAlign: 'center', marginBottom: '8px', animation: 'pulse 2s infinite' }}>
            🎵 TuneSync
          </h1>
          <p style={{ textAlign: 'center', marginBottom: '32px', opacity: 0.8 }}>Real-time music app</p>
          
          {error && (
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.2)', 
              border: '1px solid rgba(239, 68, 68, 0.5)', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              ⚠️ {error}
            </div>
          )}
          
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', marginBottom: '8px', opacity: 0.9 }}>Choose your avatar:</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
              {avatarOptions.map(avatar => (
                <button
                  key={avatar}
                  onClick={() => setUserAvatar(avatar)}
                  style={{
                    background: userAvatar === avatar ? 'rgba(236, 72, 153, 0.3)' : 'rgba(255,255,255,0.1)',
                    border: userAvatar === avatar ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '50%',
                    width: '45px',
                    height: '45px',
                    fontSize: '24px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>
          
          <input 
            type="text" 
            value={userName} 
            onChange={(e) => setUserName(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && connect()} 
            placeholder="Enter your name" 
            style={s.input} 
          />
          <button 
            onClick={connect} 
            disabled={!userName.trim() || isLoading} 
            style={{ ...s.btn, opacity: userName.trim() && !isLoading ? 1 : 0.5 }}
          >
            {isLoading ? 'Connecting...' : 'Connect'}
          </button>
          
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{
              marginTop: '16px',
              width: '100%',
              background: 'rgba(255,255,255,0.1)',
              color: isDarkMode ? 'white' : '#111',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'home') {
    return (
      <div style={s.page}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '500px', margin: '0 auto 32px' }}>
          <div>
            <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>🎵 TuneSync</h1>
            <p style={{ fontSize: '16px' }}>
              Welcome, {userAvatar} {userName}! 
              {isConnected ? ' ✅ Connected' : ' ⚠️ Disconnected'}
            </p>
          </div>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              fontSize: '24px',
              cursor: 'pointer'
            }}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
        
        <div style={{ ...s.card, marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px' }}>🎨 Create Room</h2>
          <input 
            type="text" 
            value={roomName} 
            onChange={(e) => setRoomName(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && createRoom()} 
            placeholder="Room name" 
            style={s.input} 
          />
          
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', marginBottom: '8px', opacity: 0.9 }}>Pick a theme color:</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'].map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedTheme(color)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: color,
                    border: selectedTheme === color ? '3px solid white' : '2px solid rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease'
                  }}
                />
              ))}
            </div>
          </div>
          
          <button 
            onClick={createRoom} 
            disabled={!roomName.trim()} 
            style={{ ...s.btn, opacity: roomName.trim() ? 1 : 0.5 }}
          >
            Create Room
          </button>
        </div>

        <div style={s.card}>
          <h2 style={{ marginBottom: '16px' }}>🚪 Join Room</h2>
          <input 
            type="text" 
            value={joinCode} 
            onChange={(e) => setJoinCode(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && joinRoomByCode()} 
            placeholder="Enter room code" 
            style={s.input} 
          />
          <button 
            onClick={joinRoomByCode} 
            disabled={!joinCode.trim() || isLoading} 
            style={{ ...s.btn, opacity: joinCode.trim() && !isLoading ? 1 : 0.5 }}
          >
            {isLoading ? 'Joining...' : 'Join Room'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'room' && activeRoom) {
    return (
      <div style={{ 
        ...s.page, 
        background: isDarkMode
          ? (activeRoom?.theme ? `linear-gradient(135deg, ${activeRoom.theme}, #991b1b)` : s.page.background)
          : 'linear-gradient(135deg, #e0c3fc, #8ec5fc)'
      }}>
      {/* Tab Navigation */}
<div style={{ 
  display: 'flex', 
  gap: '10px', 
  marginBottom: '20px',
  maxWidth: '1100px',
  margin: '0 auto 20px'
}}>
  <button
    onClick={() => setActiveTab('music')}
    style={{
      flex: 1,
      padding: '12px',
      background: activeTab === 'music' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(255,255,255,0.1)',
      border: activeTab === 'music' ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.2)',
      borderRadius: '8px',
      color: isDarkMode ? 'white' : '#111',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: 'bold',
      transition: 'all 0.2s ease'
    }}
  >
    🎵 Music
  </button>
  
  <button
    onClick={() => setActiveTab('videos')}
    style={{
      flex: 1,
      padding: '12px',
      background: activeTab === 'videos' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(255,255,255,0.1)',
      border: activeTab === 'videos' ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.2)',
      borderRadius: '8px',
      color: isDarkMode ? 'white' : '#111',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: 'bold',
      transition: 'all 0.2s ease'
    }}
  >
    📺 Videos
  </button>
</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', maxWidth: '1100px', margin: '0 auto 16px' }}>
          <button 
            onClick={() => setView('home')} 
            style={{ 
              background: 'rgba(255,255,255,0.1)', 
              border: 'none', 
              color: isDarkMode ? 'white' : '#111', 
              cursor: 'pointer', 
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            ← Back
          </button>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '45px',
              height: '45px',
              fontSize: '22px',
              cursor: 'pointer',
              color: isDarkMode ? 'white' : '#111'
            }}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
        
        <div style={{ maxWidth: '1100px', marginLeft: 'auto', marginRight: 'auto', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '20px' }}>
        {activeTab === 'music' ? (
  // EXISTING MUSIC GRID (keep all your current music player code)
  <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '20px' }}>
    {/* All your existing music player, queue, and chat */}
  </div>
) : (
  // NEW VIDEOS SECTION
  <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
    {/* Video Player Area */}
    <div>
      <div style={s.card}>
        <h3 style={{ fontSize: '22px', marginBottom: '16px' }}>🎬 Watch Together</h3>
        
        {videoQueue[currentVideoIndex] ? (
          <YouTubePlayer
            videoId={videoQueue[currentVideoIndex].videoId}
            isPlaying={isPlaying}
            onEnded={() => {
              if (currentVideoIndex < videoQueue.length - 1) {
                setCurrentVideoIndex(currentVideoIndex + 1);
              }
            }}
          />
        ) : (
          <div style={{
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '12px',
            padding: '60px 20px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>📺</p>
            <p style={{ fontSize: '18px', opacity: 0.7 }}>No videos in queue</p>
            <p style={{ fontSize: '14px', opacity: 0.5 }}>Search and add videos to watch together!</p>
          </div>
        )}
        
        {videoQueue[currentVideoIndex] && (
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '18px', marginBottom: '8px' }}>
              {videoQueue[currentVideoIndex].title}
            </h4>
            <p style={{ fontSize: '14px', opacity: 0.7 }}>
              {videoQueue[currentVideoIndex].artist}
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '20px' }}>
              <button
                onClick={() => {
                  if (currentVideoIndex > 0) {
                    setCurrentVideoIndex(currentVideoIndex - 1);
                  }
                }}
                disabled={currentVideoIndex === 0}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: isDarkMode ? 'white' : '#111',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: currentVideoIndex === 0 ? 'not-allowed' : 'pointer',
                  opacity: currentVideoIndex === 0 ? 0.3 : 1,
                  fontSize: '16px'
                }}
              >
                ⏮ Previous
              </button>
              
              <button
                onClick={togglePlay}
                style={{
                  background: 'linear-gradient(90deg, #ec4899, #a855f7)',
                  border: 'none',
                  color: 'white',
                  padding: '12px 32px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 'bold'
                }}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              
              <button
                onClick={() => {
                  if (currentVideoIndex < videoQueue.length - 1) {
                    setCurrentVideoIndex(currentVideoIndex + 1);
                  }
                }}
                disabled={currentVideoIndex >= videoQueue.length - 1}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: isDarkMode ? 'white' : '#111',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: currentVideoIndex >= videoQueue.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: currentVideoIndex >= videoQueue.length - 1 ? 0.3 : 1,
                  fontSize: '16px'
                }}
              >
                Next ⏭
              </button>
            </div>
          </div>
        )}
        
        {/* Video Search */}
        <div style={{ marginTop: '30px' }}>
          <h4 style={{ fontSize: '16px', marginBottom: '10px' }}>🔍 Search Videos</h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchSongs()}
              placeholder="Search YouTube..."
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '6px',
                background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
                color: isDarkMode ? 'white' : '#111'
              }}
            />
            <button
              onClick={searchSongs}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                background: 'white',
                color: '#111',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {isLoading ? '⏳' : '🔍'}
            </button>
          </div>
          
          {searchResults.filter(r => r.type === 'youtube').map(video => (
            <div key={video.id} style={{
              display: 'flex',
              gap: '10px',
              background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              padding: '10px',
              borderRadius: '6px',
              marginBottom: '8px',
              alignItems: 'center'
            }}>
              <img
                src={video.albumArt}
                alt={video.title}
                style={{
                  width: '80px',
                  height: '60px',
                  borderRadius: '4px',
                  objectFit: 'cover'
                }}
              />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 'bold', fontSize: '14px' }}>📺 {video.title}</p>
                <p style={{ fontSize: '12px', opacity: 0.7 }}>{video.artist}</p>
              </div>
              <button
                onClick={() => {
                  setVideoQueue([...videoQueue, video]);
                  setSearchResults([]);
                  setSearchQuery('');
                }}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(236, 72, 153, 0.3)',
                  color: isDarkMode ? 'white' : '#111',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
              >
                + Add
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
    
    {/* Video Queue */}
    <div style={s.card}>
      <h3 style={{ fontSize: '18px', marginBottom: '12px' }}>📋 Video Queue ({videoQueue.length})</h3>
      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        {videoQueue.map((video, i) => (
          <div
            key={video.id}
            onClick={() => {
              setCurrentVideoIndex(i);
              setIsPlaying(true);
            }}
            style={{
              background: currentVideoIndex === i
                ? (isDarkMode ? 'rgba(236, 72, 153, 0.3)' : 'rgba(236, 72, 153, 0.2)')
                : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
              padding: '10px',
              borderRadius: '6px',
              marginBottom: '8px',
              border: currentVideoIndex === i ? '2px solid #ec4899' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', opacity: 0.6 }}>{i + 1}</span>
              <img
                src={video.albumArt}
                alt={video.title}
                style={{
                  width: '60px',
                  height: '45px',
                  borderRadius: '4px',
                  objectFit: 'cover'
                }}
              />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 'bold', fontSize: '13px' }}>
                  {video.title.length > 40 ? video.title.substring(0, 40) + '...' : video.title}
                </p>
                <p style={{ fontSize: '11px', opacity: 0.7 }}>{video.artist}</p>
              </div>
              {currentVideoIndex === i && isPlaying && (
                <span style={{ fontSize: '16px' }}>📺</span>
              )}
            </div>
          </div>
        ))}
        
        {videoQueue.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            opacity: 0.5
          }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>🎬</p>
            <p style={{ fontSize: '14px' }}>No videos yet</p>
            <p style={{ fontSize: '12px' }}>Search and add videos!</p>
          </div>
        )}
      </div>
    </div>
  </div>
)}
          <div>
            <div style={{ ...s.card, marginBottom: '20px' }}>
              <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>{activeRoom.name}</h2>
              <p style={{ fontSize: '14px', opacity: 0.7 }}>
                Code: <strong>{activeRoom.code}</strong> | 
                {participants.map(p => ` ${p.avatar} ${p.name}`).join(', ')} ({participants.length} users)
              </p>
            </div>

            <div style={s.card}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ 
  width: '200px', 
  height: '200px', 
  backgroundImage: currentTrack?.albumArt 
    ? `url(${currentTrack.albumArt})` 
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  borderRadius: '16px',
  margin: '0 auto 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '80px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
  animation: isPlaying ? 'pulse 2s infinite' : 'none'
}}>
  {!currentTrack?.albumArt && '🎵'}
</div>
                <h3 style={{ fontSize: '22px', marginBottom: '8px' }}>{currentTrack?.title || 'No track'}</h3>
                <p style={{ opacity: 0.8, marginBottom: '8px' }}>{currentTrack?.artist || ''}</p>
                <p style={{ fontSize: '12px', opacity: 0.6 }}>{currentTrack?.duration || ''}</p>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
                <button 
                  onClick={toggleShuffle}
                  style={{ 
                    background: isShuffle ? 'rgba(236, 72, 153, 0.3)' : 'none', 
                    border: 'none', 
                    color: isDarkMode ? 'white' : '#111', 
                    fontSize: '20px', 
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px'
                  }}
                  title="Shuffle"
                >
                  🔀
                </button>
                
                <button 
                  onClick={previousTrack} 
                  disabled={currentTrackIndex === 0} 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: isDarkMode ? 'white' : '#111', 
                    fontSize: '28px', 
                    cursor: 'pointer', 
                    opacity: currentTrackIndex === 0 ? 0.3 : 1 
                  }}
                >
                  ⏮
                </button>
                
                <button 
                  onClick={togglePlay} 
                  style={{ 
                    background: 'white', 
                    color: '#111', 
                    borderRadius: '50%', 
                    width: '60px', 
                    height: '60px', 
                    border: 'none', 
                    cursor: 'pointer', 
                    fontSize: '24px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                  }}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                
                <button 
                  onClick={nextTrack} 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: isDarkMode ? 'white' : '#111', 
                    fontSize: '28px', 
                    cursor: 'pointer'
                  }}
                >
                  ⏭
                </button>
                
                <button 
                  onClick={cycleRepeat}
                  style={{ 
                    background: repeatMode !== 'off' ? 'rgba(236, 72, 153, 0.3)' : 'none', 
                    border: 'none', 
                    color: isDarkMode ? 'white' : '#111', 
                    fontSize: '20px', 
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px'
                  }}
                  title={`Repeat: ${repeatMode}`}
                >
                  {getRepeatIcon()}
                </button>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '18px' }}>🔊</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                    style={{
                      flex: 1,
                      height: '6px',
                      borderRadius: '3px',
                      background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${volume}%, rgba(255,255,255,0.2) ${volume}%, rgba(255,255,255,0.2) 100%)`,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '14px', minWidth: '35px' }}>{volume}%</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '20px' }}>
                {['❤️', '🔥', '👍', '🎵'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => addReaction(currentTrack?.id, emoji)}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '20px',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {reactions[currentTrack?.id] && reactions[currentTrack.id].length > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
                  <p style={{ fontSize: '12px', marginBottom: '8px', opacity: 0.8 }}>Reactions:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {reactions[currentTrack.id].map((r, i) => (
                      <span key={i} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '4px 8px', fontSize: '12px' }}>
                        {r.emoji} {r.userName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 style={{ fontSize: '16px', marginBottom: '10px' }}>🔍 Search Songs</h4>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchSongs()}
                    placeholder="Search..."
                    style={{ 
                      flex: 1, 
                      padding: '8px', 
                      borderRadius: '6px', 
                      background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', 
                      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`, 
                      color: isDarkMode ? 'white' : '#111'
                    }}
                  />
                  <button 
                    onClick={searchSongs} 
                    disabled={isLoading}
                    style={{ 
                      padding: '8px 16px', 
                      background: 'white', 
                      color: '#111', 
                      borderRadius: '6px', 
                      border: 'none', 
                      cursor: 'pointer', 
                      fontWeight: 'bold'
                    }}
                  >
                    {isLoading ? '⏳' : '🔍'}
                  </button>
                </div>
                {searchResults.map(r => (
  <div key={r.id} style={{ 
    display: 'flex', 
    justifyContent: 'space-between', 
    background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', 
    padding: '10px', 
    borderRadius: '6px',
    marginBottom: '8px',
    alignItems: 'center',
    gap: '10px'
  }}>
    {r.albumArt && (
      <img 
        src={r.albumArt} 
        alt={r.title}
        style={{
          width: '50px',
          height: '50px',
          borderRadius: '4px',
          objectFit: 'cover'
        }}
      />
    )}
    <div style={{ flex: 1 }}>
      <p style={{ fontWeight: 'bold', fontSize: '14px' }}>
  {r.type === 'youtube' && '📺 '}
  {r.title}
</p>
      <p style={{ fontSize: '12px', opacity: 0.7 }}>{r.artist} • {r.duration}</p>
    </div>
                    <button 
                      onClick={() => addToQueue(r)} 
                      style={{ 
                        padding: '6px 12px', 
                        background: 'rgba(236, 72, 153, 0.3)', 
                        color: isDarkMode ? 'white' : '#111', 
                        borderRadius: '4px', 
                        border: 'none', 
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={s.card}>
            <h3 style={{ fontSize: '18px', marginBottom: '12px' }}>📋 Queue ({queue.length})</h3>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {queue.map((t, i) => (
                <div key={t.id} style={{ marginBottom: '8px' }}>
                  <button
                    onClick={() => playTrack(i)}
                    style={{
                      width: '100%',
                      background: currentTrackIndex === i 
                        ? (isDarkMode ? 'rgba(236, 72, 153, 0.3)' : 'rgba(236, 72, 153, 0.2)') 
                        : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                      padding: '10px',
                      borderRadius: '6px',
                      border: currentTrackIndex === i ? '2px solid #ec4899' : 'none',
                      color: isDarkMode ? 'white' : '#111',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', opacity: 0.6 }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 'bold', fontSize: '13px' }}>{t.title}</p>
                        <p style={{ fontSize: '11px', opacity: 0.7 }}>{t.artist} • {t.duration}</p>
                        {t.addedBy && <p style={{ fontSize: '10px', opacity: 0.5 }}>Added by {t.addedBy}</p>}
                      </div>
                      {currentTrackIndex === i && isPlaying && (
                        <span style={{ fontSize: '16px', animation: 'pulse 1s infinite' }}>🎵</span>
                      )}
                    </div>
                  </button>
                  {reactions[t.id] && reactions[t.id].length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', paddingLeft: '10px' }}>
                      {reactions[t.id].slice(0, 5).map((r, idx) => (
                        <span key={idx} style={{ fontSize: '14px' }}>{r.emoji}</span>
                      ))}
                      {reactions[t.id].length > 5 && (
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>+{reactions[t.id].length - 5}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={s.card}>
            <h3 style={{ fontSize: '18px', marginBottom: '12px' }}>💬 Chat</h3>
            <div style={{ 
              height: '350px', 
              overflowY: 'auto', 
              marginBottom: '12px', 
              background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)', 
              borderRadius: '8px', 
              padding: '12px' 
            }}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{ marginBottom: '12px', animation: 'fadeIn 0.3s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px' }}>{m.avatar || '👤'}</span>
                    <p style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold' }}>{m.userName}</p>
                  </div>
                  <p style={{ fontSize: '14px', paddingLeft: '22px' }}>{m.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type message..."
                style={{ 
                  flex: 1, 
                  padding: '10px', 
                  borderRadius: '6px', 
                  background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', 
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`, 
                  color: isDarkMode ? 'white' : '#111', 
                  fontSize: '14px' 
                }}
              />
              <button 
                onClick={sendMessage} 
                style={{ 
                  padding: '10px 16px', 
                  background: 'linear-gradient(90deg, #ec4899, #a855f7)', 
                  color: 'white', 
                  borderRadius: '6px', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontWeight: 'bold'
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
        
        {currentTrack?.type === 'youtube' ? (
  <YouTubePlayer
    videoId={currentTrack.videoId}
    isPlaying={isPlaying}
    onEnded={handleTrackEnded}
  />
) : (
  <AudioPlayer
    track={currentTrack}
    isPlaying={isPlaying}
    volume={volume}
    onEnded={handleTrackEnded}
    onError={(err) => console.error('Audio error:', err)}
  />
)}
      </div>
    );
  }
}

export default App;