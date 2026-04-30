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
  ChevronDown,
  RefreshCw
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

import { DropdownMenuLabel } from '@/components/ui/dropdown-menu';

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
        <Button variant="outline" className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 font-medium h-9">
          Actions
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-[80vh] overflow-y-auto">
        {/* VIEW Section */}
        <DropdownMenuLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-3">
          VIEW
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={handleViewIGST} className="py-2 cursor-pointer">
          <Eye className="h-4 w-4 mr-3 text-slate-500" />
          <span className="text-sm">Show IGST, CGST, SGST, Cess</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEditDataSources} className="py-2 cursor-pointer">
          <RefreshCw className="h-4 w-4 mr-3 text-slate-500" />
          <span className="text-sm">Edit Data Sources</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* DOWNLOAD Section */}
        <DropdownMenuLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-3">
          Download
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={handleDownloadSystem} className="py-2 cursor-pointer">
          <Download className="h-4 w-4 mr-3 text-blue-600" />
          <span className="text-sm">System generated GSTR3B</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadSummary} className="py-2 cursor-pointer">
          <Download className="h-4 w-4 mr-3 text-blue-600" />
          <span className="text-sm">Download Summary for GSTR-3B</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadGSTN} className="py-2 cursor-pointer">
          <Download className="h-4 w-4 mr-3 text-slate-500 text-green-600" />
          <span className="text-sm text-green-600">Download Data from GSTN</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* START WITH AN EMPTY TABLE */}
        <DropdownMenuLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-3">
          START WITH AN EMPTY TABLE
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={handleClearAll} className="py-2 cursor-pointer">
          <Trash2 className="h-4 w-4 mr-3 text-slate-500" />
          <span className="text-sm">Clear all values</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* NIL RETURNS */}
        <DropdownMenuLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-3">
          NIL RETURNS
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={handleSelectNIL} className="py-2 cursor-pointer">
          <FileText className="h-4 w-4 mr-3 text-blue-600 bg-blue-100 p-0.5 rounded-sm" />
          <span className="text-sm text-slate-700">Select for NIL Returns</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* INVOICES */}
        <DropdownMenuLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-3">
          INVOICES
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={handleViewSales} className="py-2 cursor-pointer">
          <span className="text-sm text-slate-700 font-medium">View sales invoices</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleViewPurchase} className="py-2 cursor-pointer">
          <span className="text-sm text-slate-700 font-medium">View purchase invoices</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* GUIDES */}
        <DropdownMenuLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-3">
          Guides
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={handleViewGuide} className="py-2 cursor-pointer">
          <BookOpen className="h-4 w-4 mr-3 text-slate-400" />
          <span className="text-sm text-slate-700">Guide</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleViewVideo} className="py-2 cursor-pointer">
          <PlayCircle className="h-4 w-4 mr-3 text-slate-400" />
          <span className="text-sm text-slate-700">Video</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
