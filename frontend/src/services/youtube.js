// Mobile-friendly music search with CORS proxy
export const searchiTunesSongs = async (query) => {
  try {
    console.log('Searching for:', query);
    
    // Use AllOrigins proxy for mobile compatibility
    const apiUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=10`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
    
    const response = await fetch(proxyUrl);
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log('iTunes results:', data.resultCount);
    
    if (!data.results || data.results.length === 0) {
      console.log('No results found');
      return [];
    }
    
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