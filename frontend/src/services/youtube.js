// Mobile-friendly music search using iTunes API
export const searchiTunesSongs = async (query) => {
  try {
    console.log('Searching for:', query);
    
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=10`,
      {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-cache'
      }
    );
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log('iTunes data:', data);
    
    if (!data.results || data.results.length === 0) {
      console.log('No results from iTunes API');
      return [];
    }
    
    console.log('Found', data.results.length, 'songs');
    
    // Format results
    return data.results.map(track => ({
      id: track.trackId,
      title: track.trackName,
      artist: track.artistName,
      duration: formatDuration(Math.floor(track.trackTimeMillis / 1000)),
      albumArt: track.artworkUrl100 ? track.artworkUrl100.replace('100x100', '300x300') : '',
      previewUrl: track.previewUrl
    }));
  } catch (error) {
    console.error('iTunes search error:', error);
    // Don't return fallback - just return empty array
    return [];
  }
};

// Helper function
const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const itunesService = { searchiTunesSongs };
export default itunesService;