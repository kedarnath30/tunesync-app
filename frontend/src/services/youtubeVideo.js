// YouTube Video Search Service
const YOUTUBE_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

export const searchYouTubeVideos = async (query) => {
  try {
    console.log('Searching YouTube for:', query);
    
    if (!YOUTUBE_API_KEY) {
      console.error('YouTube API key is missing!');
      return [];
    }
    
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=10&q=${encodeURIComponent(query + ' official music video')}&key=${YOUTUBE_API_KEY}`
    );
    
    if (!response.ok) {
      console.error('YouTube API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      console.log('No YouTube results found');
      return [];
    }
    
    console.log('Found', data.items.length, 'YouTube videos');
    
    // Format results
    return data.items.map(item => ({
      id: item.id.videoId,
      videoId: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      duration: '📺 Video',
      albumArt: item.snippet.thumbnails.high.url,
      type: 'youtube' // Mark as YouTube video
    }));
  } catch (error) {
    console.error('YouTube search error:', error);
    return [];
  }
};

const youtubeService = { searchYouTubeVideos };
export default youtubeService;