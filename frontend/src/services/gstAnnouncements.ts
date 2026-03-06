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
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ANNOUNCEMENTS_ENDPOINT = '/gst-announcements';

/**
 * Fetch announcements from backend API
 * The backend scrapes https://www.gst.gov.in/newsandupdates and returns real data
 */
export async function fetchGSTAnnouncements(limit: number = 10): Promise<Announcement[]> {
  try {
    const url = `${API_BASE_URL}${ANNOUNCEMENTS_ENDPOINT}?limit=${limit}`;
    console.log('Fetching GST announcements from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('GST Announcements response:', result);
    
    if (result.success && result.data) {
      // Format dates for display
      return result.data.map((announcement: Announcement) => ({
        ...announcement,
        date: formatDate(announcement.date)
      }));
    }
    
    throw new Error(result.error || 'Failed to fetch announcements');
  } catch (error) {
    console.error('Error fetching GST announcements:', error);
    throw error;
  }
}

/**
 * Format date string for display
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  
  try {
    // Try parsing ISO date string
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
  
  // Return original if parsing fails
  return dateStr;
}

/**
 * Refresh interval in milliseconds (5 minutes)
 */
export const REFRESH_INTERVAL = 5 * 60 * 1000;

export default fetchGSTAnnouncements;
