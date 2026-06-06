import React, { useState } from 'react';
import { X, ChevronDown, ChevronRight, Search, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface IMSFilterSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function IMSFilterSidebar({ open, onClose }: IMSFilterSidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'imsActionClear': true,
    'imsActionGovt': true,
    'imsUploadStatus': true,
    'returnPeriod': true,
    'myGstin': true
  });

  const toggleExpand = (section: string) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />
      <div 
        className={`fixed inset-y-0 right-0 w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-xl font-semibold text-slate-800">Filter</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-500 hover:text-slate-800">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto w-[400px]">
          {/* Main Search */}
          <div className="p-4 border-b">
            <Input 
              placeholder="Search Filters" 
              className="w-full bg-slate-50/50"
            />
          </div>

          {/* Filter Sections */}
          <FilterSection 
            title="IMS Action (Clear Platform)" 
            isExpanded={expanded['imsActionClear']} 
            onToggle={() => toggleExpand('imsActionClear')}
          >
            <div className="space-y-3">
              <CheckboxItem label="Accept" />
              <CheckboxItem label="Reject" />
              <CheckboxItem label="Pending" />
              <CheckboxItem label="No Action" />
              <CheckboxItem label="Blank/(-)" />
            </div>
          </FilterSection>

          <FilterSection 
            title="IMS Action (Govt. Platform)" 
            isExpanded={expanded['imsActionGovt']} 
            onToggle={() => toggleExpand('imsActionGovt')}
          >
            <div className="space-y-3">
              <CheckboxItem label="Accept" />
              <CheckboxItem label="Reject" />
              <CheckboxItem label="Pending" />
              <CheckboxItem label="No Action" />
            </div>
          </FilterSection>

          <FilterSection 
            title="IMS Upload Status" 
            isExpanded={expanded['imsUploadStatus']} 
            onToggle={() => toggleExpand('imsUploadStatus')}
          >
            <div className="space-y-3">
              <CheckboxItem label="Uploaded" />
              <CheckboxItem label="To be Uploaded" />
              <CheckboxItem label="Failed" />
              <CheckboxItem label="Upload Processing" />
              <CheckboxItem label="(Blank)/(-)" />
            </div>
          </FilterSection>

          <FilterSection 
            title="Return Period" 
            isExpanded={expanded['returnPeriod']} 
            onToggle={() => toggleExpand('returnPeriod')}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="From" className="pl-9 h-9" />
              </div>
              <span className="text-slate-400">➔</span>
              <div className="relative flex-1">
                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="To" className="pl-9 h-9" />
              </div>
            </div>
          </FilterSection>

          <FilterSection 
            title="My GSTIN" 
            isExpanded={expanded['myGstin']} 
            onToggle={() => toggleExpand('myGstin')}
          >
            <Input placeholder="Search Here" className="h-9" />
          </FilterSection>

          <FilterSection 
            title="Unique Key" 
            isExpanded={expanded['uniqueKey']} 
            onToggle={() => toggleExpand('uniqueKey')}
          >
            <Input placeholder="Search Here" className="h-9" />
          </FilterSection>

          <FilterSection 
            title="Supplier GSTIN" 
            isExpanded={expanded['supplierGstin']} 
            onToggle={() => toggleExpand('supplierGstin')}
          >
            <Input placeholder="Search Here" className="h-9" />
          </FilterSection>

          <FilterSection 
            title="Supplier Name" 
            isExpanded={expanded['supplierName']} 
            onToggle={() => toggleExpand('supplierName')}
          >
            <Input placeholder="Search Here" className="h-9" />
          </FilterSection>

          <FilterSection 
            title="Document Number" 
            isExpanded={expanded['documentNumber']} 
            onToggle={() => toggleExpand('documentNumber')}
          >
            <Input placeholder="Search Here" className="h-9" />
          </FilterSection>

          <FilterSection 
            title="Document Date" 
            isExpanded={expanded['documentDate']} 
            onToggle={() => toggleExpand('documentDate')}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="DD/MM/YYYY" className="pl-9 h-9" />
              </div>
              <span className="text-slate-400">➔</span>
              <div className="relative flex-1">
                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="DD/MM/YYYY" className="pl-9 h-9" />
              </div>
            </div>
          </FilterSection>

          <FilterSection 
            title="Is Pending Action Blocked" 
            isExpanded={expanded['isPendingBlocked']} 
            onToggle={() => toggleExpand('isPendingBlocked')}
          >
            <RadioGroup defaultValue={undefined} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="r1" />
                <Label htmlFor="r1" className="text-sm font-normal text-slate-700 cursor-pointer">True</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="r2" />
                <Label htmlFor="r2" className="text-sm font-normal text-slate-700 cursor-pointer">False</Label>
              </div>
            </RadioGroup>
          </FilterSection>

          <FilterSection 
            title="Source Return Filling Status" 
            isExpanded={expanded['sourceReturn']} 
            onToggle={() => toggleExpand('sourceReturn')}
          >
            <RadioGroup defaultValue={undefined} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="filed" id="f1" />
                <Label htmlFor="f1" className="text-sm font-normal text-slate-700 cursor-pointer">Filed</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="not-filed" id="f2" />
                <Label htmlFor="f2" className="text-sm font-normal text-slate-700 cursor-pointer">Not Filed</Label>
              </div>
            </RadioGroup>
          </FilterSection>

          <FilterSection 
            title="Document Type" 
            isExpanded={expanded['docType']} 
            onToggle={() => toggleExpand('docType')}
          >
            <div className="space-y-3">
              <CheckboxItem label="Invoice" />
              <CheckboxItem label="Credit Note" />
              <CheckboxItem label="Debit Note" />
            </div>
          </FilterSection>
          
          <FilterSection 
            title="Section Name" 
            isExpanded={expanded['sectionName']} 
            onToggle={() => toggleExpand('sectionName')}
          >
            <div className="max-h-[200px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              <CheckboxItem label="B2B" />
              <CheckboxItem label="B2BA" />
              <CheckboxItem label="CDN" />
              <CheckboxItem label="CDNA" />
              <CheckboxItem label="ECOM" />
              <CheckboxItem label="ECOMA" />
              <CheckboxItem label="IMPG" />
              <CheckboxItem label="IMPGSEZ" />
            </div>
          </FilterSection>

          <FilterSection 
            title="Port Code (Import Goods)" 
            isExpanded={expanded['portCode']} 
            onToggle={() => toggleExpand('portCode')}
          >
            <Input placeholder="Search Here" className="h-9" />
          </FilterSection>

          <FilterSection 
            title="Amendment Type (Import Docs)" 
            isExpanded={expanded['amendmentType']} 
            onToggle={() => toggleExpand('amendmentType')}
          >
            <div className="space-y-3">
              <CheckboxItem label="Value Amendment" />
              <CheckboxItem label="GSTIN amendment" />
            </div>
          </FilterSection>
          
          <FilterSection 
            title="Place of Supply" 
            isExpanded={expanded['pos']} 
            onToggle={() => toggleExpand('pos')}
          >
            <div className="max-h-[200px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              <CheckboxItem label="01-JAMMU & KASHMIR" />
              <CheckboxItem label="02-HIMACHAL PRADESH" />
              <CheckboxItem label="03-PUNJAB" />
              <CheckboxItem label="04-CHANDIGARH" />
              <CheckboxItem label="05-UTTARAKHAND" />
              <CheckboxItem label="06-HARYANA" />
              <CheckboxItem label="07-DELHI" />
            </div>
          </FilterSection>

          <FilterSection 
            title="Document Value" 
            isExpanded={expanded['docValue']} 
            onToggle={() => toggleExpand('docValue')}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-medium">Greater than or equal to (≥)</Label>
                <Input className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-medium">Less than or equal to (≤)</Label>
                <Input className="h-9" />
              </div>
            </div>
          </FilterSection>

          <FilterSection 
            title="Taxable Value" 
            isExpanded={expanded['taxValue']} 
            onToggle={() => toggleExpand('taxValue')}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-medium">Greater than or equal to (≥)</Label>
                <Input className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-medium">Less than or equal to (≤)</Label>
                <Input className="h-9" />
              </div>
            </div>
          </FilterSection>

          <FilterSection 
            title="Total Tax value" 
            isExpanded={expanded['totalTax']} 
            onToggle={() => toggleExpand('totalTax')}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-medium">Greater than or equal to (≥)</Label>
                <Input className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-medium">Less than or equal to (≤)</Label>
                <Input className="h-9" />
              </div>
            </div>
          </FilterSection>
          
          {/* Bottom Padding for scroll space */}
          <div className="h-20" />
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-white flex items-center justify-between shrink-0">
          <Button variant="outline" className="w-[45%] text-slate-700 font-medium">
            Clear All
          </Button>
          <Button className="w-[45%] bg-blue-600 hover:bg-blue-700 text-white font-medium">
            Apply
          </Button>
        </div>
      </div>
    </>
  );
}

function FilterSection({ title, isExpanded, onToggle, children }: { title: string, isExpanded?: boolean, onToggle: () => void, children: React.ReactNode }) {
  return (
    <div className="border-b last:border-b-0">
      <button 
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-500" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckboxItem({ label }: { label: string }) {
  const id = `cb-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex items-center space-x-3">
      <Checkbox id={id} className="rounded-[4px] border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
      <Label htmlFor={id} className="text-sm font-normal text-slate-700 leading-none cursor-pointer">
        {label}
      </Label>
    </div>
  );
}
