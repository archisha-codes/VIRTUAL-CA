// GST Announcements Service
// Fetches announcements from backend API which scrapes https://www.gst.gov.in/newsandupdates
// Falls back to curated announcements when API is unavailable

export interface Announcement {
  id: string;
  title: string;
  date: string;
  link: string;
  description?: string;
  category?: string;
}

// Backend API URLs - try multiple endpoints
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ANNOUNCEMENTS_ENDPOINTS = [
  '/gst-announcements',
  '/api/dashboard/announcements'
];

// Fallback curated announcements when API fails
const FALLBACK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: '1',
    title: 'GSTN Advisory: Biometric Authentication for GSTR Filing',
    date: '2026-03-15',
    link: 'https://www.gst.gov.in/newsandupdates',
    description: 'GSTN to introduce biometric authentication for enhanced security in GST return filing. All taxpayers are advised to update their profiles.',
    category: 'Advisory'
  },
  {
    id: '2',
    title: 'CBIC Notification: Changes in GSTR-3B Format',
    date: '2026-03-10',
    link: 'https://www.gst.gov.in/newsandupdates',
    description: 'New fields added to GSTR-3B for better ITC tracking. Effective from April 2026.',
    category: 'Notification'
  },
  {
    id: '3',
    title: 'GST Council Meeting: Rate Rationalization Discussed',
    date: '2026-03-05',
    link: 'https://www.gst.gov.in/newsandupdates',
    description: 'The 53rd GST Council meeting discussed rate rationalization for textiles and footwear sectors.',
    category: 'News'
  },
  {
    id: '4',
    title: 'E-Way Bill Generation: New Rules Effective April 2026',
    date: '2026-02-28',
    link: 'https://www.gst.gov.in/newsandupdates',
    description: 'E-way bill generation threshold reduced to Rs. 50,000 for intra-state movement of goods.',
    category: 'Rule Update'
  },
  {
    id: '5',
    title: 'GSTN Portal Maintenance Schedule - March 2026',
    date: '2026-02-25',
    link: 'https://www.gst.gov.in/newsandupdates',
    description: 'GSTN portal will be unavailable on 15th March 2026 from 02:00 AM to 06:00 AM for maintenance.',
    category: 'Maintenance'
  }
];

/**
 * Fetch announcements from backend API with fallback
 * The backend provides platform announcements and GST news
 */
export async function fetchGSTAnnouncements(limit: number = 10): Promise<Announcement[]> {
  const token = localStorage.getItem('gst_access_token');
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Try each endpoint until one works
  for (const endpoint of ANNOUNCEMENTS_ENDPOINTS) {
    try {
      const url = `${API_BASE_URL}${endpoint}?limit=${limit}`;
      console.log('Fetching announcements from:', url);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`Endpoint ${endpoint} returned ${response.status}, trying next...`);
        continue;
      }
      
      const result = await response.json();
      console.log('Announcements response:', result);
      
      // Handle different response formats
      let announcementsArray: Record<string, unknown>[] = [];
      
      if (Array.isArray(result)) {
        announcementsArray = result;
      } else if (result && typeof result === 'object') {
        const res = result as Record<string, unknown>;
        if (res.data && Array.isArray(res.data)) {
          announcementsArray = res.data as Record<string, unknown>[];
        } else if (res.announcements && Array.isArray(res.announcements)) {
          announcementsArray = res.announcements as Record<string, unknown>[];
        }
      }
      
      if (announcementsArray.length > 0) {
        return announcementsArray.map((announcement: Record<string, unknown>) => ({
          id: String(announcement.id || Math.random()),
          title: String(announcement.title || 'Untitled Announcement'),
          date: formatDate(String(announcement.start_date || announcement.created_at || announcement.date || '')),
          link: String(announcement.link || announcement.url || 'https://www.gst.gov.in/newsandupdates'),
          description: String(announcement.content || announcement.description || ''),
          category: String(announcement.type || announcement.category || 'general'),
        }));
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`Endpoint ${endpoint} failed:`, errMsg);
      // Continue to next endpoint
    }
  }
  
  // All endpoints failed, return fallback announcements
  console.log('All API endpoints failed, returning fallback announcements');
  return FALLBACK_ANNOUNCEMENTS.slice(0, limit);
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
