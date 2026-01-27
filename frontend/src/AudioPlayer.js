import { useEffect, useRef, useState } from 'react';

const AudioPlayer = ({ track, isPlaying, volume, onEnded, onError }) => {
  const audioRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!audioRef.current || !track?.previewUrl) return;

    const audio = audioRef.current;
    
    // Pause current audio first
    audio.pause();
    
    // Update source
    if (audio.src !== track.previewUrl) {
      setIsLoading(true);
      audio.src = track.previewUrl;
      audio.load();
    }
    
    // Set volume
    audio.volume = volume / 100;

    // Play or pause
    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsLoading(false);
          })
          .catch(err => {
            // Ignore AbortError (happens when switching tracks quickly)
            if (err.name !== 'AbortError') {
              console.error('Playback error:', err);
              if (onError) onError(err);
            }
            setIsLoading(false);
          });
      }
    } else {
      audio.pause();
      setIsLoading(false);
    }
  }, [track, isPlaying, onError, volume]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume / 100;
  }, [volume]);

  return (
    <audio
      ref={audioRef}
      onEnded={onEnded}
      style={{ display: 'none' }}
    />
  );
};

export default AudioPlayer;