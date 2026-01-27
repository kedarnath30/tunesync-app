// Search for songs using iTunes API (Apple Music)
export const searchiTunesSongs = async (query) => {
  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=10`
    );
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return [];
    }
    
    // Format results to match our app structure
    return data.results.map(track => ({
      id: track.trackId,
      title: track.trackName,
      artist: track.artistName,
      duration: formatDuration(Math.floor(track.trackTimeMillis / 1000)),
      albumArt: track.artworkUrl100.replace('100x100', '300x300'), // Higher quality
      previewUrl: track.previewUrl // 30-second preview
    }));
  } catch (error) {
    console.error('iTunes search error:', error);
    return [];
  }
};

// Helper function to format duration (seconds to MM:SS)
const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const itunesService = { searchiTunesSongs };
export default itunesService;