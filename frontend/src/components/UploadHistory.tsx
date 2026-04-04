import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { 
  FileSpreadsheet, 
  MoreVertical, 
  Trash2, 
  Eye,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  History
} from 'lucide-react';

export interface UploadRecord {
  id: string;
  filename: string;
  category: 'sales' | 'purchase';
  templateType: 'cleartax' | 'government' | 'unknown';
  totalRecords: number;
  uploadedAt: string;
  status: 'success' | 'partial' | 'failed';
  errorCount?: number;
  size: number;
}

// Demo upload history
const DEMO_UPLOADS: UploadRecord[] = [
  {
    id: 'upload-1',
    filename: 'SalesInvoicesAndCreditOrDebitNotes_V11.xlsx',
    category: 'sales',
    templateType: 'cleartax',
    totalRecords: 150,
    uploadedAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'success',
    errorCount: 0,
    size: 245000,
  },
  {
    id: 'upload-2',
    filename: 'Q4_Purchase_Data.xlsx',
    category: 'purchase',
    templateType: 'unknown',
    totalRecords: 89,
    uploadedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    status: 'partial',
    errorCount: 5,
    size: 128000,
  },
  {
    id: 'upload-3',
    filename: 'GSTR1_Excel_Workbook_Template_V_3_4_CT.xlsx',
    category: 'sales',
    templateType: 'government',
    totalRecords: 234,
    uploadedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    status: 'success',
    errorCount: 0,
    size: 512000,
  },
];

interface UploadHistoryProps {
  onViewUpload?: (upload: UploadRecord) => void;
  showHeader?: boolean;
}

export function UploadHistory({ onViewUpload, showHeader = true }: UploadHistoryProps) {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadUploads();
  }, []);

  const loadUploads = async () => {
    try {
      setLoading(true);
      
      // Try to load from localStorage first
      const stored = localStorage.getItem('upload_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUploads(parsed);
      } else {
        // Use demo data
        setUploads(DEMO_UPLOADS);
      }
    } catch (error) {
      console.error('Error loading uploads:', error);
      setUploads(DEMO_UPLOADS);
    } finally {
      setLoading(false);
    }
  };

  const saveUploads = async (updatedUploads: UploadRecord[]) => {
    setUploads(updatedUploads);
    localStorage.setItem('upload_history', JSON.stringify(updatedUploads));
  };

  const handleDelete = async (uploadId: string) => {
    setIsDeleting(uploadId);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updatedUploads = uploads.filter(u => u.id !== uploadId);
      await saveUploads(updatedUploads);
      toast.success('Upload record deleted');
    } catch (error) {
      console.error('Error deleting upload:', error);
      toast.error('Failed to delete upload record');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleView = (upload: UploadRecord) => {
    if (onViewUpload) {
      onViewUpload(upload);
    } else {
      // Default behavior - navigate to GSTR1 with upload data
      window.location.href = `/gstr1?uploadId=${upload.id}`;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      if (hours < 1) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
      }
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    
    // Less than 7 days
    if (diff < 86400000 * 7) {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
    
    // Otherwise show date
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: UploadRecord['status']) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            {`${5} errors`}
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-sm text-gray-500 mt-2">Loading upload history...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Upload History
          </CardTitle>
          <CardDescription>
            View and manage your previously uploaded invoice files
          </CardDescription>
        </CardHeader>
      )}
      <CardContent>
        {uploads.length === 0 ? (
          <div className="text-center py-8">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No uploads yet
            </h3>
            <p className="text-gray-500">
              Upload your first invoice file to get started.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((upload) => (
                <TableRow key={upload.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 max-w-[200px] truncate">
                          {upload.filename}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatSize(upload.size)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={upload.category === 'sales' ? 'default' : 'secondary'}>
                      {upload.category === 'sales' ? 'Sales' : 'Purchase'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {upload.totalRecords.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(upload.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="h-3 w-3" />
                      {formatDate(upload.uploadedAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(upload)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="mr-2 h-4 w-4" />
                          Download Report
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDelete(upload.id)}
                          className="text-red-600 focus:text-red-600"
                          disabled={isDeleting === upload.id}
                        >
                          {isDeleting === upload.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default UploadHistory;
