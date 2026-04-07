/**
 * GSTR-3B Actions Dropdown Component
 * 
 * ClearTax-style action dropdown for GSTR-3B prepare page:
 * VIEW:
 *   - Show IGST, CGST, SGST, Cess
 *   - Edit Data Sources
 * DOWNLOAD:
 *   - System generated GSTR3B
 *   - Download Summary for GSTR-3B
 *   - Download Data from GSTN
 * START WITH AN EMPTY TABLE:
 *   - Clear all values
 * NIL RETURNS:
 *   - Select for NIL Returns
 * INVOICES:
 *   - View sales invoices
 *   - View purchase invoices
 * GUIDES:
 *   - Guide
 *   - Video
 */

import React from 'react';
import { 
  Eye, 
  Edit3, 
  Download, 
  Trash2, 
  FileText, 
  FileSpreadsheet,
  ShoppingCart,
  Receipt,
  BookOpen,
  PlayCircle,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface GSTR3BActionsDropdownProps {
  onViewIGST?: () => void;
  onEditDataSources?: () => void;
  onDownloadSystem?: () => void;
  onDownloadSummary?: () => void;
  onDownloadGSTN?: () => void;
  onClearAll?: () => void;
  onSelectNIL?: () => void;
  onViewSales?: () => void;
  onViewPurchase?: () => void;
  onViewGuide?: () => void;
  onViewVideo?: () => void;
}

export default function GSTR3BActionsDropdown({
  onViewIGST,
  onEditDataSources,
  onDownloadSystem,
  onDownloadSummary,
  onDownloadGSTN,
  onClearAll,
  onSelectNIL,
  onViewSales,
  onViewPurchase,
  onViewGuide,
  onViewVideo,
}: GSTR3BActionsDropdownProps) {
  const { toast } = useToast();
  
  // Default handlers that show toast
  const handleViewIGST = () => {
    if (onViewIGST) {
      onViewIGST();
    } else {
      toast({
        title: 'View Tax Breakdown',
        description: 'Showing IGST, CGST, SGST, Cess breakdown',
      });
    }
  };
  
  const handleEditDataSources = () => {
    if (onEditDataSources) {
      onEditDataSources();
    } else {
      toast({
        title: 'Edit Data Sources',
        description: 'Opening data sources editor',
      });
    }
  };
  
  const handleDownloadSystem = () => {
    if (onDownloadSystem) {
      onDownloadSystem();
    } else {
      toast({
        title: 'Download Started',
        description: 'Downloading system generated GSTR-3B...',
      });
    }
  };
  
  const handleDownloadSummary = () => {
    if (onDownloadSummary) {
      onDownloadSummary();
    } else {
      toast({
        title: 'Download Started',
        description: 'Downloading GSTR-3B summary...',
      });
    }
  };
  
  const handleDownloadGSTN = () => {
    if (onDownloadGSTN) {
      onDownloadGSTN();
    } else {
      toast({
        title: 'Download Started',
        description: 'Downloading data from GSTN...',
      });
    }
  };
  
  const handleClearAll = () => {
    if (onClearAll) {
      onClearAll();
    } else {
      toast({
        title: 'Clear All Data',
        description: 'All values have been cleared',
      });
    }
  };
  
  const handleSelectNIL = () => {
    if (onSelectNIL) {
      onSelectNIL();
    } else {
      toast({
        title: 'NIL Return',
        description: 'Selected for NIL returns',
      });
    }
  };
  
  const handleViewSales = () => {
    if (onViewSales) {
      onViewSales();
    } else {
      toast({
        title: 'Sales Invoices',
        description: 'Opening sales invoices view',
      });
    }
  };
  
  const handleViewPurchase = () => {
    if (onViewPurchase) {
      onViewPurchase();
    } else {
      toast({
        title: 'Purchase Invoices',
        description: 'Opening purchase invoices view',
      });
    }
  };
  
  const handleViewGuide = () => {
    if (onViewGuide) {
      onViewGuide();
    } else {
      toast({
        title: 'Guide',
        description: 'Opening GSTR-3B guide',
      });
    }
  };
  
  const handleViewVideo = () => {
    if (onViewVideo) {
      onViewVideo();
    } else {
      toast({
        title: 'Video Tutorial',
        description: 'Opening video tutorial',
      });
    }
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ChevronDown className="h-3 w-3" />
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* VIEW Section */}
        <DropdownMenuItem onClick={handleViewIGST}>
          <Eye className="h-4 w-4 mr-2" />
          Show IGST, CGST, SGST, Cess
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEditDataSources}>
          <Edit3 className="h-4 w-4 mr-2" />
          Edit Data Sources
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* DOWNLOAD Section */}
        <DropdownMenuItem onClick={handleDownloadSystem}>
          <FileText className="h-4 w-4 mr-2" />
          System generated GSTR3B
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadSummary}>
          <Download className="h-4 w-4 mr-2" />
          Download Summary for GSTR-3B
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadGSTN}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Download Data from GSTN
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* START WITH AN EMPTY TABLE */}
        <DropdownMenuItem onClick={handleClearAll} className="text-red-600">
          <Trash2 className="h-4 w-4 mr-2" />
          Clear all values
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* NIL RETURNS */}
        <DropdownMenuItem onClick={handleSelectNIL}>
          <FileText className="h-4 w-4 mr-2" />
          Select for NIL Returns
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* INVOICES */}
        <DropdownMenuItem onClick={handleViewSales}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          View sales invoices
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleViewPurchase}>
          <Receipt className="h-4 w-4 mr-2" />
          View purchase invoices
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* GUIDES */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <BookOpen className="h-4 w-4 mr-2" />
            Guides
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={handleViewGuide}>
              <BookOpen className="h-4 w-4 mr-2" />
              Guide
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleViewVideo}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Video
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
