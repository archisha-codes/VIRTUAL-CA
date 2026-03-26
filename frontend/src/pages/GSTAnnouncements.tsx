import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  ExternalLink, 
  RefreshCw, 
  Loader2, 
  Calendar,
  Bell,
  Filter,
  ChevronRight
} from 'lucide-react';
import { fetchGSTAnnouncements } from '@/services/gstAnnouncements';

export interface Announcement {
  id: string;
  title: string;
  date: string;
  link: string;
  description?: string;
  category?: string;
}

export default function GSTAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchGSTAnnouncements(50); // Get more for dedicated page
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
      const data = await fetchGSTAnnouncements(50);
      setAnnouncements(data);
    } catch (err) {
      console.error('Error refreshing announcements:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openAnnouncement = (link: string) => {
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  // Get unique categories from announcements
  const categories = Array.from(new Set(
    announcements
      .filter(a => a.category)
      .map(a => a.category!)
  ));

  const filteredAnnouncements = announcements.filter(announcement => {
    const matchesSearch = 
      announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (announcement.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesCategory = categoryFilter === 'all' || announcement.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Sort by date (newest first)
  const sortedAnnouncements = [...filteredAnnouncements].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <DashboardLayout title="GST Announcements">
      <div className="space-y-6">
        {/* Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Announcements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{announcements.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length || 'N/A'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last Updated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {announcements.length > 0 ? announcements[0].date : 'N/A'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search announcements..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select 
                className="border rounded-md px-3 py-2 text-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <Button 
            variant="outline"
            onClick={refreshAnnouncements}
            disabled={isRefreshing}
            className="gap-2"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        {/* Announcements List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Latest GST Announcements
            </CardTitle>
            <CardDescription>
              Stay updated with the latest GST circulars, notifications, and updates from CBIC/GSTN
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                <span className="ml-2 text-muted-foreground">Loading announcements...</span>
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={fetchAnnouncements}>
                  Try Again
                </Button>
              </div>
            )}

            {!loading && !error && sortedAnnouncements.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No announcements found</p>
              </div>
            )}

            {!loading && !error && sortedAnnouncements.length > 0 && (
              <div className="space-y-4">
                {sortedAnnouncements.map((announcement) => (
                  <div 
                    key={announcement.id}
                    className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => openAnnouncement(announcement.link)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {announcement.category && (
                            <Badge variant="secondary" className="text-xs">
                              {announcement.category}
                            </Badge>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {announcement.date}
                          </span>
                        </div>
                        <h3 className="font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {announcement.title}
                        </h3>
                        {announcement.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                            {announcement.description}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-primary mt-2"
                    >
                      Read Full Notification
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
