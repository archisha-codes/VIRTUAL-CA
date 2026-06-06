/**
 * GSTR-1 Filters Drawer Component
 * 
 * ClearTax-style filters drawer for GSTR-1 prepare page:
 * - My GSTIN dropdown
 * - Filing Status (Filed / Not Filed)
 * - Sections (B2B, B2C Small, B2C Large, CDN, Exports, HSN, Documents)
 * - Exclude Amendments checkbox
 */

import React, { useState } from 'react';
import { X, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription,
  DrawerFooter,
  DrawerClose
} from '@/components/ui/drawer';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

// Filter options
const SECTION_OPTIONS = [
  { id: 'b2b', label: 'B2B' },
  { id: 'b2c_small', label: 'B2C Small' },
  { id: 'b2c_large', label: 'B2C Large' },
  { id: 'cdn', label: 'CDN' },
  { id: 'exports', label: 'Exports' },
  { id: 'hsn', label: 'HSN' },
  { id: 'docs', label: 'Documents' },
];

// Props
interface GSTR1FiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: GSTR1Filters) => void;
  availableGstins?: string[];
  initialFilters?: GSTR1Filters;
}

export interface GSTR1Filters {
  gstin: string;
  filingStatus: 'all' | 'filed' | 'not_filed';
  sections: string[];
  excludeAmendments: boolean;
}

const defaultFilters: GSTR1Filters = {
  gstin: 'all',
  filingStatus: 'all',
  sections: ['b2b', 'b2c_small', 'b2c_large', 'cdn', 'exports', 'hsn', 'docs'],
  excludeAmendments: false,
};

export default function GSTR1FiltersDrawer({ 
  open, 
  onOpenChange, 
  onApply,
  availableGstins = [],
  initialFilters 
}: GSTR1FiltersDrawerProps) {
  const [filters, setFilters] = useState<GSTR1Filters>(initialFilters || defaultFilters);
  
  // Reset filters to default
  const handleReset = () => {
    setFilters(defaultFilters);
  };
  
  // Handle section toggle
  const toggleSection = (sectionId: string) => {
    setFilters(prev => ({
      ...prev,
      sections: prev.sections.includes(sectionId)
        ? prev.sections.filter(s => s !== sectionId)
        : [...prev.sections, sectionId]
    }));
  };
  
  // Handle apply
  const handleApply = () => {
    onApply(filters);
    onOpenChange(false);
  };
  
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </DrawerTitle>
          <DrawerDescription>
            Filter GSTR-1 data by various criteria
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="flex-1 overflow-y-auto px-4 space-y-6">
          {/* My GSTIN */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">My GSTIN</Label>
            <Select 
              value={filters.gstin} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, gstin: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All GSTINs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All GSTINs</SelectItem>
                {availableGstins.map(gstin => (
                  <SelectItem key={gstin} value={gstin}>{gstin}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Filing Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Filing Status</Label>
            <RadioGroup 
              value={filters.filingStatus}
              onValueChange={(value) => setFilters(prev => ({ 
                ...prev, 
                filingStatus: value as 'all' | 'filed' | 'not_filed' 
              }))}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="status-all" />
                <Label htmlFor="status-all" className="font-normal">All</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="filed" id="status-filed" />
                <Label htmlFor="status-filed" className="font-normal">Filed</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="not_filed" id="status-not-filed" />
                <Label htmlFor="status-not-filed" className="font-normal">Not Filed</Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* Sections */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Sections</Label>
            <div className="grid grid-cols-2 gap-2">
              {SECTION_OPTIONS.map(section => (
                <div key={section.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`section-${section.id}`}
                    checked={filters.sections.includes(section.id)}
                    onCheckedChange={() => toggleSection(section.id)}
                  />
                  <Label 
                    htmlFor={`section-${section.id}`} 
                    className="font-normal cursor-pointer"
                  >
                    {section.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Exclude Amendments */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="exclude-amendments"
              checked={filters.excludeAmendments}
              onCheckedChange={(checked) => setFilters(prev => ({ 
                ...prev, 
                excludeAmendments: checked as boolean 
              }))}
            />
            <Label htmlFor="exclude-amendments" className="font-normal cursor-pointer">
              Exclude Amendments
            </Label>
          </div>
        </div>
        
        <DrawerFooter className="flex-row justify-between gap-2">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleApply} className="flex-1 bg-corporate-primary hover:bg-corporate-primaryHover">
            Show Applied
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
