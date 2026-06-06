import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';
import { fetchGSTAnnouncements, REFRESH_INTERVAL } from '@/services/gstAnnouncements';

export interface Announcement {
  id: string;
  title: string;
  date: string;
  link: string;
  description?: string;
  category?: string;
}

interface AnnouncementsPanelProps {
  className?: string;
  limit?: number;
  showHeader?: boolean;
}

export function AnnouncementsPanel({ 
  className = '', 
  limit = 5,
  showHeader = true 
}: AnnouncementsPanelProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    fetchAnnouncements();
    
    // Auto refresh every 5 minutes
    const intervalId = setInterval(() => {
      refreshAnnouncements();
    }, REFRESH_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [limit]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchGSTAnnouncements(limit);
      setAnnouncements(data);
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError('Failed to load announcements. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const refreshAnnouncements = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const data = await fetchGSTAnnouncements(limit);
      setAnnouncements(data);
    } catch (err) {
      console.error('Error refreshing announcements:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleExpand = (index: number) => {
    setExpanded(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const openAnnouncement = (link: string) => {
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className={`shadow-card h-full ${className}`}>
      {showHeader && (
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            GST Announcements
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Loading announcements...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchAnnouncements}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        )}

        {!loading && !error && announcements.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No announcements available</p>
          </div>
        )}

        {!loading && !error && announcements.length > 0 && (
          <div 
            ref={scrollContainerRef}
            className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scroll-smooth"
            style={{
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            <style>{`
              @keyframes slideIn {
                from {
                  opacity: 0;
                  transform: translateY(-10px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              @keyframes fadeInUp {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              .announcement-item {
                animation: fadeInUp 0.4s ease-out forwards;
                opacity: 0;
              }
              .announcement-item:nth-child(1) { animation-delay: 0ms; }
              .announcement-item:nth-child(2) { animation-delay: 50ms; }
              .announcement-item:nth-child(3) { animation-delay: 100ms; }
              .announcement-item:nth-child(4) { animation-delay: 150ms; }
              .announcement-item:nth-child(5) { animation-delay: 200ms; }
              .announcement-item:nth-child(6) { animation-delay: 250ms; }
              .announcement-item:nth-child(7) { animation-delay: 300ms; }
              .announcement-item:nth-child(8) { animation-delay: 350ms; }
              .announcement-item:nth-child(9) { animation-delay: 400ms; }
              .announcement-item:nth-child(10) { animation-delay: 450ms; }
            `}</style>
            {announcements.map((announcement, index) => (
              <div 
                key={announcement.id}
                className="announcement-item p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-foreground line-clamp-2">
                      {announcement.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {announcement.date}
                    </p>
                    {expanded[index] && announcement.description && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {announcement.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => toggleExpand(index)}
                    >
                      {expanded[index] ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => openAnnouncement(announcement.link)}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-blue-600 hover:text-blue-700 text-xs mt-1"
                  onClick={() => openAnnouncement(announcement.link)}
                >
                  Read more
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && announcements.length > 0 && (
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={refreshAnnouncements}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AnnouncementsPanel;
