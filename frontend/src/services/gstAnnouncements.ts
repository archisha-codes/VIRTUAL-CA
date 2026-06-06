// GST Announcements Service
// Fetches announcements from backend API which scrapes https://www.gst.gov.in/newsandupdates

export interface Announcement {
  id: string;
  title: string;
  date: string;
  link: string;
  description?: string;
  category?: string;
}

// Backend API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const ANNOUNCEMENTS_ENDPOINT = '/api/dashboard/announcements';

/**
 * Fetch announcements from backend API
 */
export async function fetchGSTAnnouncements(limit: number = 10): Promise<Announcement[]> {
  const token = localStorage.getItem('gst_access_token');
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const url = `${API_BASE_URL}${ANNOUNCEMENTS_ENDPOINT}?limit=${limit}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`Announcements API failed with status: ${response.status}`);
      return [];
    }
    
    const json = await response.json();
    const data = json.data;
    
    // The backend returns { "success": true, "data": [...] }
    if (Array.isArray(data)) {
      return data.map((announcement: any) => ({
        id: String(announcement.id || Math.random()),
        title: String(announcement.title || 'Untitled Announcement'),
        date: formatDate(String(announcement.date || '')),
        link: String(announcement.link || 'https://www.gst.gov.in/newsandupdates'),
        description: String(announcement.description || ''),
        category: String(announcement.category || 'general'),
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Failed to fetch announcements:', error);
    return [];
  }
}

/**
 * Format date string for display
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  } catch (e) {
    // Ignore parsing errors
  }
  
  return dateStr;
}

export const REFRESH_INTERVAL = 5 * 60 * 1000;
export default fetchGSTAnnouncements;
