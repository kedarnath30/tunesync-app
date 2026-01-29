import React from 'react';

const YouTubePlayer = ({ videoId, isPlaying, onEnded }) => {
  return (
    <div style={{
      width: '100%',
      maxWidth: '560px',
      margin: '0 auto 20px',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
    }}>
      <iframe
        width="100%"
        height="315"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=${isPlaying ? 1 : 0}&enablejsapi=1`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default YouTubePlayer;