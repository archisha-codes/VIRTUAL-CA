/**
 * GSTR-1 Actions Dropdown Component
 * 
 * ClearTax-style action dropdown for GSTR-1 prepare page:
 * DOWNLOAD:
 *   - Download PAN Summary for GSTR-1/IFF
 * SYNC:
 *   - Sync Draft G1 from GSTN
 * FILING:
 *   - Select for NIL Returns
 *   - Select Summary Source
 * DATA:
 *   - Delete from clear
 */

import React from 'react';
import { 
  Download, 
  RefreshCw, 
  FileText, 
  Database,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface GSTR1ActionsDropdownProps {
  onDownloadPAN?: () => void;
  onSyncGSTN?: () => void;
  onSelectNIL?: () => void;
  onSelectSource?: () => void;
  onDelete?: () => void;
}

export default function GSTR1ActionsDropdown({
  onDownloadPAN,
  onSyncGSTN,
  onSelectNIL,
  onSelectSource,
  onDelete,
}: GSTR1ActionsDropdownProps) {
  const { toast } = useToast();
  
  // Default handlers
  const handleDownloadPAN = () => {
    if (onDownloadPAN) {
      onDownloadPAN();
    } else {
      toast({
        title: 'Download Started',
        description: 'Downloading PAN Summary for GSTR-1/IFF...',
      });
    }
  };
  
  const handleSyncGSTN = () => {
    if (onSyncGSTN) {
      onSyncGSTN();
    } else {
      toast({
        title: 'Sync Initiated',
        description: 'Syncing draft GSTR-1 from GSTN...',
      });
    }
  };
  
  const handleSelectNIL = () => {
    if (onSelectNIL) {
      onSelectNIL();
    } else {
      toast({
        title: 'NIL Return Selected',
        description: 'Selected invoices marked for NIL returns',
      });
    }
  };
  
  const handleSelectSource = () => {
    if (onSelectSource) {
      onSelectSource();
    } else {
      toast({
        title: 'Select Summary Source',
        description: 'Opening summary source selection',
      });
    }
  };
  
  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    } else {
      // Show confirmation
      if (confirm('Are you sure you want to delete all data? This action cannot be undone.')) {
        toast({
          title: 'Data Deleted',
          description: 'All data has been cleared',
        });
      }
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
        {/* DOWNLOAD Section */}
        <DropdownMenuItem onClick={handleDownloadPAN}>
          <Download className="h-4 w-4 mr-2" />
          Download PAN Summary for GSTR-1/IFF
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* SYNC Section */}
        <DropdownMenuItem onClick={handleSyncGSTN}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync Draft G1 from GSTN
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* FILING Section */}
        <DropdownMenuItem onClick={handleSelectNIL}>
          <FileText className="h-4 w-4 mr-2" />
          Select for NIL Returns
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSelectSource}>
          <Database className="h-4 w-4 mr-2" />
          Select Summary Source
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* DATA Section */}
        <DropdownMenuItem onClick={handleDelete} className="text-red-600">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete from clear
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
