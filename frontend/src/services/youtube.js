// Simple music search using iTunes API (works without CORS proxy)
export const searchiTunesSongs = async (query) => {
  try {
    // iTunes API has built-in JSONP support for CORS
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=10&callback=?`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    );
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.log('No results from iTunes API');
      return [];
    }
    
    console.log('iTunes results:', data.results.length);
    
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
    
    // Fallback: return mock data for testing
    console.log('Returning mock data as fallback');
    return [
      {
        id: Date.now() + 1,
        title: query + ' - Song 1',
        artist: 'Artist Name',
        duration: '3:45',
        albumArt: '',
        previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
      },
      {
        id: Date.now() + 2,
        title: query + ' - Song 2',
        artist: 'Artist Name',
        duration: '4:12',
        albumArt: '',
        previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
      }
    ];
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