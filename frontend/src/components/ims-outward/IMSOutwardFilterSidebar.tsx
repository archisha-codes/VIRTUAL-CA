import React, { useState } from 'react';
import { X, ChevronDown, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface IMSOutwardFilterSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function IMSOutwardFilterSidebar({ open, onClose }: IMSOutwardFilterSidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'status': true,
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

          <FilterSection title="Status" isExpanded={expanded['status']} onToggle={() => toggleExpand('status')}>
            <div className="space-y-3">
              <CheckboxItem label="Accept" />
              <CheckboxItem label="Reject" />
              <CheckboxItem label="Pending" />
              <CheckboxItem label="No Action" />
            </div>
          </FilterSection>

          <FilterSection title="Return Period" isExpanded={expanded['returnPeriod']} onToggle={() => toggleExpand('returnPeriod')}>
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

          <FilterSection title="My GSTIN" isExpanded={expanded['myGstin']} onToggle={() => toggleExpand('myGstin')}>
            <Input placeholder="Search Here" className="h-9" />
          </FilterSection>

          <FilterSection title="Recipient GSTIN" isExpanded={expanded['recipientGstin']} onToggle={() => toggleExpand('recipientGstin')}>
            <Input placeholder="Search Here" className="h-9" />
          </FilterSection>

          <FilterSection title="Trade/Legal Name" isExpanded={expanded['tradeName']} onToggle={() => toggleExpand('tradeName')}>
            <Input placeholder="Search Here" className="h-9" />
          </FilterSection>

          <FilterSection title="Document Number" isExpanded={expanded['docNum']} onToggle={() => toggleExpand('docNum')}>
            <Input placeholder="Search Here" className="h-9" />
          </FilterSection>

          <FilterSection title="Document Date" isExpanded={expanded['docDate']} onToggle={() => toggleExpand('docDate')}>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="DD/MM/YY" className="pl-9 h-9" />
              </div>
              <span className="text-slate-400">➔</span>
              <div className="relative flex-1">
                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="DD/MM/YY" className="pl-9 h-9" />
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Filling Status" isExpanded={expanded['fillingStatus']} onToggle={() => toggleExpand('fillingStatus')}>
            <div className="space-y-3">
              <RadioGroup defaultValue={undefined} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="filed" id="fs1" />
                  <Label htmlFor="fs1" className="text-sm font-normal text-slate-700 cursor-pointer">Filed</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="not-filed" id="fs2" />
                  <Label htmlFor="fs2" className="text-sm font-normal text-slate-700 cursor-pointer">Not Filed</Label>
                </div>
              </RadioGroup>
            </div>
          </FilterSection>

          <FilterSection title="Document Type" isExpanded={expanded['docType']} onToggle={() => toggleExpand('docType')}>
            <div className="space-y-3">
              <CheckboxItem label="Invoice" />
              <CheckboxItem label="Credit Note" />
              <CheckboxItem label="Debit Note" />
            </div>
          </FilterSection>
          
          <FilterSection title="Section Name" isExpanded={expanded['sectionName']} onToggle={() => toggleExpand('sectionName')}>
            <div className="max-h-[200px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              <CheckboxItem label="B2B" />
              <CheckboxItem label="B2BA" />
              <CheckboxItem label="CDN" />
              <CheckboxItem label="CDNA" />
              <CheckboxItem label="ECOM" />
              <CheckboxItem label="ECOM URP2B" />
              <CheckboxItem label="ECOMA" />
              <CheckboxItem label="ECOM URP2BA" />
            </div>
          </FilterSection>
          
          <FilterSection title="Place of Supply" isExpanded={expanded['pos']} onToggle={() => toggleExpand('pos')}>
            <div className="max-h-[250px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              <CheckboxItem label="01-JAMMU & KASHMIR" />
              <CheckboxItem label="02-HIMACHAL PRADESH" />
              <CheckboxItem label="03-PUNJAB" />
              <CheckboxItem label="04-CHANDIGARH" />
              <CheckboxItem label="05-UTTARAKHAND" />
              <CheckboxItem label="06-HARYANA" />
              <CheckboxItem label="07-DELHI" />
              <CheckboxItem label="08-RAJASTHAN" />
              <CheckboxItem label="09-UTTAR PRADESH" />
              <CheckboxItem label="10-BIHAR" />
              <CheckboxItem label="11-SIKKIM" />
              <CheckboxItem label="12-ARUNACHAL PRADESH" />
              <CheckboxItem label="13-NAGALAND" />
              <CheckboxItem label="14-MANIPUR" />
              <CheckboxItem label="15-MIZORAM" />
              <CheckboxItem label="16-TRIPURA" />
              <CheckboxItem label="17-MEGHALAYA" />
              <CheckboxItem label="18-ASSAM" />
              <CheckboxItem label="19-WEST BENGAL" />
              <CheckboxItem label="20-JHARKHAND" />
              <CheckboxItem label="21-ODISHA" />
              <CheckboxItem label="22-CHHATTISGARH" />
              <CheckboxItem label="23-MADHYA PRADESH" />
              <CheckboxItem label="24-GUJARAT" />
              <CheckboxItem label="25-DAMAN & DIU" />
              <CheckboxItem label="26-DADRA & NAGAR HAVELI AND DAMAN AND DIU" />
              <CheckboxItem label="27-MAHARASHTRA" />
              <CheckboxItem label="29-KARNATAKA" />
              <CheckboxItem label="30-GOA" />
              <CheckboxItem label="31-LAKSHADWEEP" />
              <CheckboxItem label="32-KERALA" />
              <CheckboxItem label="33-TAMIL NADU" />
              <CheckboxItem label="34-PONDICHERRY" />
              <CheckboxItem label="35-ANDAMAN & NICOBAR ISLANDS" />
              <CheckboxItem label="36-TELANGANA" />
              <CheckboxItem label="37-ANDHRA PRADESH" />
              <CheckboxItem label="38-LADAKH" />
              <CheckboxItem label="96-FOREIGN COUNTRY" />
              <CheckboxItem label="97-OTHER TERRITORY" />
            </div>
          </FilterSection>

          <FilterSection title="Form Type" isExpanded={expanded['formType']} onToggle={() => toggleExpand('formType')}>
            <div className="space-y-3">
              <CheckboxItem label="GSTR1" />
              <CheckboxItem label="GSTR1A" />
            </div>
          </FilterSection>

          {/* Bottom Padding for scroll space */}
          <div className="h-20" />
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-white flex items-center justify-between shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
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
        <span className="text-[13px] font-semibold text-slate-800">{title}</span>
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
  const id = `cb-ow-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex items-center space-x-3">
      <Checkbox id={id} className="rounded-[4px] border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
      <Label htmlFor={id} className="text-sm font-normal text-slate-700 leading-none cursor-pointer select-none">
        {label}
      </Label>
    </div>
  );
}
