import React, { useEffect, useRef, useState } from 'react';

const EnhancedYouTubePlayer = ({ 
  videoId, 
  isPlaying, 
  isHost,
  onTimeUpdate,
  onBuffering,
  onReady,
  onEnded,
  syncToTime,
  roomCode,
  socket
}) => {
  const playerRef = useRef(null);
  const iframeRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const lastSyncTime = useRef(0);
  const syncIntervalRef = useRef(null);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      initializePlayer();
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      initializePlayer();
    };

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [videoId]);

  const initializePlayer = () => {
    if (!iframeRef.current || playerRef.current) return;

    const newPlayer = new window.YT.Player(iframeRef.current, {
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: isHost ? 1 : 0,
        modestbranding: 1,
        rel: 0,
        fs: 1,
        enablejsapi: 1
      },
      events: {
        onReady: (event) => {
          console.log('YouTube player ready');
          playerRef.current = event.target;
          setPlayer(event.target);
          if (onReady) onReady(event.target);
          
          if (isHost) {
            syncIntervalRef.current = setInterval(() => {
              if (playerRef.current && playerRef.current.getCurrentTime) {
                const currentTime = playerRef.current.getCurrentTime();
                const playerState = playerRef.current.getPlayerState();
                
                if (onTimeUpdate && Math.abs(currentTime - lastSyncTime.current) > 1) {
                  onTimeUpdate(currentTime, playerState === 1);
                  lastSyncTime.current = currentTime;
                }
              }
            }, 2000);
          }
        },
        onStateChange: (event) => {
          console.log('Player state changed:', event.data);
          
          if (event.data === 3) {
            setIsBuffering(true);
            if (onBuffering) onBuffering(true);
          } else if (event.data === 1 || event.data === 2) {
            setIsBuffering(false);
            if (onBuffering) onBuffering(false);
          } else if (event.data === 0) {
            if (onEnded) onEnded();
          }

          if (isHost && socket && roomCode) {
            if (event.data === 1) {
              socket.emit('video-play', { roomCode });
            } else if (event.data === 2) {
              socket.emit('video-pause', { roomCode });
            }
          }
        },
        onError: (event) => {
          console.error('YouTube player error:', event.data);
        }
      }
    });
  };

  useEffect(() => {
    if (!isHost && player && syncToTime !== null && syncToTime !== undefined) {
      const currentTime = player.getCurrentTime ? player.getCurrentTime() : 0;
      const timeDiff = Math.abs(currentTime - syncToTime);
      
      if (timeDiff > 3) {
        console.log(`Syncing: Current ${currentTime}s, Target ${syncToTime}s, Diff ${timeDiff}s`);
        player.seekTo(syncToTime, true);
      }
    }
  }, [syncToTime, isHost, player]);

  useEffect(() => {
    if (!player) return;

    const playerState = player.getPlayerState ? player.getPlayerState() : -1;
    
    if (isPlaying && playerState !== 1) {
      console.log('Play requested');
      player.playVideo();
    } else if (!isPlaying && playerState === 1) {
      console.log('Pause requested');
      player.pauseVideo();
    }
  }, [isPlaying, player]);

  useEffect(() => {
    if (player && player.loadVideoById) {
      console.log('Loading new video:', videoId);
      player.loadVideoById(videoId);
      if (isPlaying) {
        player.playVideo();
      }
    }
  }, [videoId, player]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '800px',
      margin: '0 auto',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
      backgroundColor: '#000'
    }}>
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
        <div 
          ref={iframeRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
        />
      </div>

      {isBuffering && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <div style={{ textAlign: 'center', color: 'white' }}>
            <div style={{ 
              fontSize: '48px', 
              marginBottom: '16px',
              animation: 'spin 1s linear infinite'
            }}>
              ⏳
            </div>
            <p style={{ fontSize: '18px' }}>Buffering...</p>
          </div>
        </div>
      )}

      {isHost && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'linear-gradient(90deg, #ec4899, #a855f7)',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          👑 Host
        </div>
      )}
    </div>
  );
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
if (!document.head.querySelector('style[data-youtube-player]')) {
  styleSheet.setAttribute('data-youtube-player', 'true');
  document.head.appendChild(styleSheet);
}

export default EnhancedYouTubePlayer;
