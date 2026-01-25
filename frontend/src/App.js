import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

function App() {
  const [view, setView] = useState('setup');
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [activeRoom, setActiveRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([
    { id: 1, title: 'Shape of You', artist: 'Ed Sheeran' },
    { id: 2, title: 'Blinding Lights', artist: 'The Weeknd' },
    { id: 3, title: 'Levitating', artist: 'Dua Lipa' }
  ]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  const currentTrack = queue[currentTrackIndex];

  useEffect(() => {
    if (userName && !socketRef.current) {
      socketRef.current = io('http://localhost:3001');
      socketRef.current.on('connect', () => setIsConnected(true));
      socketRef.current.on('disconnect', () => setIsConnected(false));
      socketRef.current.on('room-state', (room) => {
        setParticipants(room.participants.map(p => p.userName));
        if (room.queue) setQueue(room.queue);
        if (room.currentTrackIndex !== undefined) setCurrentTrackIndex(room.currentTrackIndex);
        if (room.isPlaying !== undefined) setIsPlaying(room.isPlaying);
      });
      socketRef.current.on('participants-updated', (p) => setParticipants(p.map(x => x.userName)));
      socketRef.current.on('sync-play', () => setIsPlaying(true));
      socketRef.current.on('sync-pause', () => setIsPlaying(false));
      socketRef.current.on('sync-track-change', ({ trackIndex }) => {
        setCurrentTrackIndex(trackIndex);
        setIsPlaying(true);
      });
      socketRef.current.on('queue-updated', (newQueue) => setQueue(newQueue));
      socketRef.current.on('chat-message', (msg) => {
        setChatMessages(prev => [...prev, msg]);
      });
    }
  }, [userName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const connect = () => { if (userName.trim()) setView('home'); };

  const createRoom = () => {
    if (roomName.trim() && socketRef.current) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      socketRef.current.emit('create-room', { roomCode: code, roomData: { name: roomName, code }, userId: Date.now(), userName });
      setActiveRoom({ name: roomName, code });
      setParticipants([userName]);
      setView('room');
      setRoomName('');
    }
  };

  const joinRoomByCode = () => {
    if (joinCode.trim() && socketRef.current) {
      const code = joinCode.toUpperCase();
      socketRef.current.emit('join-room', { roomCode: code, userId: Date.now(), userName });
      setActiveRoom({ name: 'Room ' + code, code });
      setView('room');
      setJoinCode('');
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
    if (currentTrackIndex < queue.length - 1) {
      const newIndex = currentTrackIndex + 1;
      setCurrentTrackIndex(newIndex);
      setIsPlaying(true);
      if (socketRef.current && activeRoom) {
        socketRef.current.emit('change-track', { roomCode: activeRoom.code, trackIndex: newIndex });
      }
    }
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

  const searchSongs = () => {
    if (searchQuery.trim()) {
      const results = [
        { id: Date.now() + 1, title: searchQuery, artist: 'Artist Name' },
        { id: Date.now() + 2, title: searchQuery + ' Remix', artist: 'DJ Mix' },
        { id: Date.now() + 3, title: searchQuery + ' Acoustic', artist: 'Unplugged' }
      ];
      setSearchResults(results);
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
      const msg = { userName, text: message, timestamp: Date.now() };
      socketRef.current.emit('chat-message', { roomCode: activeRoom.code, message: msg });
      setChatMessages(prev => [...prev, msg]);
      setMessage('');
    }
  };

  const s = {
    page: { minHeight: '100vh', background: 'linear-gradient(135deg, #581c87, #9d1753, #991b1b)', padding: '24px', color: 'white', fontFamily: 'Arial' },
    card: { background: 'rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', maxWidth: '500px', margin: '0 auto' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', marginBottom: '16px', fontSize: '16px' },
    btn: { width: '100%', background: 'linear-gradient(90deg, #ec4899, #a855f7)', color: 'white', padding: '16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }
  };

  if (view === 'setup') return (<div style={s.page}><div style={s.card}><h1 style={{ fontSize: '48px', textAlign: 'center', marginBottom: '8px' }}>TuneSync</h1><p style={{ textAlign: 'center', marginBottom: '32px' }}>Real-time music app</p><input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && connect()} placeholder="Enter your name" style={s.input} /><button onClick={connect} disabled={!userName.trim()} style={{ ...s.btn, opacity: userName.trim() ? 1 : 0.5 }}>Connect</button></div></div>);

  if (view === 'home') return (<div style={s.page}><h1 style={{ fontSize: '48px', textAlign: 'center', marginBottom: '8px' }}>TuneSync</h1><p style={{ textAlign: 'center', marginBottom: '32px' }}>Welcome, {userName}! {isConnected && '(Connected)'}</p><div style={{ ...s.card, marginBottom: '24px' }}><h2 style={{ marginBottom: '16px' }}>Create Room</h2><input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && createRoom()} placeholder="Room name" style={s.input} /><button onClick={createRoom} disabled={!roomName.trim()} style={{ ...s.btn, opacity: roomName.trim() ? 1 : 0.5 }}>Create</button></div><div style={s.card}><h2 style={{ marginBottom: '16px' }}>Join Room</h2><input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && joinRoomByCode()} placeholder="Enter room code" style={s.input} /><button onClick={joinRoomByCode} disabled={!joinCode.trim()} style={{ ...s.btn, opacity: joinCode.trim() ? 1 : 0.5 }}>Join Room</button></div></div>);

  if (view === 'room' && activeRoom) return (<div style={s.page}><button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginBottom: '16px', fontSize: '16px' }}>Back</button><div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '20px' }}><div><div style={{ ...s.card, marginBottom: '20px' }}><h2 style={{ fontSize: '28px', marginBottom: '8px' }}>{activeRoom.name}</h2><p style={{ fontSize: '14px', opacity: 0.7 }}>Code: {activeRoom.code} | {participants.join(', ')} ({participants.length} users)</p></div><div style={s.card}><h3 style={{ fontSize: '22px', marginBottom: '12px' }}>{currentTrack?.title || 'No track'}</h3><p style={{ opacity: 0.8, marginBottom: '20px' }}>{currentTrack?.artist || ''}</p><div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '24px' }}><button onClick={previousTrack} disabled={currentTrackIndex === 0} style={{ background: 'none', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer', opacity: currentTrackIndex === 0 ? 0.3 : 1 }}>⏮</button><button onClick={togglePlay} style={{ background: 'white', color: '#111', borderRadius: '50%', width: '56px', height: '56px', border: 'none', cursor: 'pointer', fontSize: '22px' }}>{isPlaying ? '⏸' : '▶'}</button><button onClick={nextTrack} disabled={currentTrackIndex >= queue.length - 1} style={{ background: 'none', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer', opacity: currentTrackIndex >= queue.length - 1 ? 0.3 : 1 }}>⏭</button></div><div><h4 style={{ fontSize: '16px', marginBottom: '10px' }}>Search Songs</h4><div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && searchSongs()} placeholder="Search..." style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} /><button onClick={searchSongs} style={{ padding: '8px 16px', background: 'white', color: '#111', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Search</button></div>{searchResults.map(r => (<div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '8px' }}><div><p style={{ fontWeight: 'bold', fontSize: '14px' }}>{r.title}</p><p style={{ fontSize: '12px', opacity: 0.7 }}>{r.artist}</p></div><button onClick={() => addToQueue(r)} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Add</button></div>))}</div></div></div><div style={s.card}><h3 style={{ fontSize: '18px', marginBottom: '12px' }}>Queue</h3><div style={{ maxHeight: '400px', overflowY: 'auto' }}>{queue.map((t, i) => (<button key={t.id} onClick={() => playTrack(i)} style={{ width: '100%', background: currentTrackIndex === i ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px', marginBottom: '8px', border: 'none', color: 'white', cursor: 'pointer', textAlign: 'left' }}><p style={{ fontWeight: 'bold', fontSize: '13px' }}>{t.title}</p><p style={{ fontSize: '11px', opacity: 0.7 }}>{t.artist}</p>{t.addedBy && <p style={{ fontSize: '10px', opacity: 0.5 }}>+ {t.addedBy}</p>}</button>))}</div></div><div style={s.card}><h3 style={{ fontSize: '18px', marginBottom: '12px' }}>Chat</h3><div style={{ height: '300px', overflowY: 'auto', marginBottom: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>{chatMessages.map((m, i) => (<div key={i} style={{ marginBottom: '10px' }}><p style={{ fontSize: '11px', opacity: 0.6 }}>{m.userName}</p><p style={{ fontSize: '14px' }}>{m.text}</p></div>))}<div ref={chatEndRef} /></div><div style={{ display: 'flex', gap: '8px' }}><input type="text" value={message} onChange={(e) => setMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type message..." style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: '14px' }} /><button onClick={sendMessage} style={{ padding: '10px 16px', background: 'white', color: '#111', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Send</button></div></div></div></div>);
}

export default App;