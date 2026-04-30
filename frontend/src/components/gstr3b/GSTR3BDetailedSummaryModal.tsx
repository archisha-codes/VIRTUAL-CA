import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Info, ChevronRight, MinusSquare, PlusSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface GSTR3BDetailedSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gstin: string;
}

const GSTR3BDetailedSummaryModal: React.FC<GSTR3BDetailedSummaryModalProps> = ({
  open,
  onOpenChange,
  gstin
}) => {
  const [activeTab, setActiveTab] = useState("4");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    '4-A-1': true,
    '4-A-2': true,
    '4-A-3': true,
    '4-A-4': true,
    '4-A-5': true,
    '4-B-1': true,
    '4-B-2': true,
    '4-D-1': true,
    '4-D-2': true,
  });

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const tables = [
    { id: "3.1", label: "3.1" },
    { id: "3.1.1", label: "3.1.1" },
    { id: "3.2", label: "3.2" },
    { id: "4", label: "4" },
    { id: "5", label: "5" },
    { id: "5.1", label: "5.1" },
    { id: "6.1", label: "6.1" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] flex flex-col p-0 overflow-hidden border-none shadow-none rounded-none bg-white z-[200]">
        
        {/* Top Header */}
        <div className="flex-none bg-white border-b border-slate-200 px-6 h-[48px] flex items-center justify-between z-[110]">
          <div className="text-[14px] font-bold text-[#333333]">
            Detailed GSTR-3B summary
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="h-10 w-10 text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors rounded-sm"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <div className="flex flex-1 overflow-hidden">
            
            {/* Left Sidebar Table Nav */}
            <div className="w-[100px] border-r border-slate-200 bg-[#F8FAFC] flex flex-col shrink-0">
              <div className="py-2 flex flex-col items-center">
                 <div className="p-3 w-10 h-10 rounded-md bg-white border border-slate-200 text-blue-600 flex items-center justify-center font-bold text-xs cursor-pointer shadow-sm mb-4">
                   07-DL
                 </div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">GSTR-3B Tables</p>
                 {tables.map(t => (
                   <button 
                     key={t.id}
                     onClick={() => {
                        setActiveTab(t.id);
                        document.getElementById(`section-${t.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                     }}
                     className={cn(
                       "w-full py-2.5 px-3 text-[13px] font-bold transition-all relative flex items-center justify-between group",
                       activeTab === t.id ? "text-blue-600 bg-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                     )}
                   >
                     {t.label}
                     {activeTab === t.id && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-2/3 bg-blue-600 rounded-l-full" />}
                     <ChevronRight className={cn("h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity", activeTab === t.id ? "opacity-100" : "")} />
                   </button>
                 ))}
              </div>
            </div>

            {/* Right Scrollable Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              
              {/* Internal Header Area */}
              <div className="px-10 pt-8 pb-4 shrink-0 border-b border-slate-50 flex justify-between items-start bg-white">
                <div className="space-y-1">
                  <h2 className="text-[20px] font-bold text-slate-800 tracking-tight">
                    GSTR-3B for Delhi ({gstin})
                  </h2>
                  <p className="text-[13px] font-medium text-slate-500">
                    Review line item details for the tables of GSTR-3B form
                  </p>
                </div>
                <div className="text-[16px] font-bold text-slate-700">
                  Tax to be paid: <span className="text-slate-900 ml-1">₹ 0</span>
                </div>
              </div>

              {/* Scroll Area for Tables */}
              <div className="flex-1 overflow-y-auto px-10 pt-6 pb-20 custom-scrollbar-thin flex flex-col gap-12 select-none h-full bg-white">
                
                {/* Sections 3.1 to 3.2 (Existing) */}
                <Section identifier="3.1" title="3.1 Details of Outward supplies and inward supplies liable to reverse charge" subtitle="Autofilled at 16 Apr 2026, 10:35 AM">
                   <Table className="border-collapse border border-slate-200">
                      <TableHeader className="bg-[#F8F9FA] h-[48px]">
                        <TableRow>
                          <TableHead className="w-[500px] font-bold text-slate-400 uppercase tracking-widest text-[9px] px-6">NATURE OF SUPPLIES</TableHead>
                          <TableHead className="w-[220px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">TOTAL TAXABLE VALUE (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">IGST (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">CGST (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">SGST (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">CESS (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <Row label="(a) Outward Taxable supplies (other than zero rated, nil rated and exempted)" taxable="0.00" igst="0.00" cgst="0.00" sgst="0" cess="0.00" />
                        <Row label="(b) Outward Taxable supplies (zero rated )" taxable="0.00" igst="0.00" cgst="0.00" sgst="-" cess="-" />
                        <Row label="(c) Other Outward Taxable supplies (Nil rated, exempted)" taxable="0.00" igst="-" cgst="-" sgst="-" cess="-" />
                        <Row label="(d) Inward supplies (liable to reverse charge)" taxable="0.00" igst="0.00" cgst="0.00" sgst="0" cess="0.00" />
                        <Row label="(e) Non-GST Outward supplies" taxable="0.00" igst="-" cgst="-" sgst="-" cess="-" />
                      </TableBody>
                   </Table>
                </Section>

                {/* Section 3.1.1 */}
                <Section identifier="3.1.1" title="3.1.1 Details of supplies notified under section 9(5) of the CGST Act, 2017" subtitle="Autofilled at 16 Apr 2026, 10:35 AM">
                   <Table className="border-collapse border border-slate-200">
                      <TableHeader className="bg-[#F8F9FA] h-[48px]">
                        <TableRow>
                          <TableHead className="w-[500px] font-bold text-slate-400 uppercase tracking-widest text-[9px] px-6">NATURE OF SUPPLIES</TableHead>
                          <TableHead className="w-[220px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">TOTAL TAXABLE VALUE (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">IGST (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">CGST (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">SGST (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">CESS (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <Row label="(i) Taxable supplies on which ECO is liable to pay tax u/s 9(5) [to be furnished by ECO]" taxable="0.00" igst="0.00" cgst="0.00" sgst="0" cess="0.00" />
                        <Row label="(ii) Taxable supplies made by the registered person through ECO u/s 9(5) [to be furnished by registered person]" taxable="0.00" igst="0.00" cgst="0.00" sgst="0" cess="0.00" />
                      </TableBody>
                   </Table>
                </Section>

                {/* Section 3.2 */}
                <Section identifier="3.2" title="3.2 Of the supplies shown in 3.1 (a) above, details of inter-State supplies" subtitle="Autofilled at 16 Apr 2026, 10:35 AM">
                   <Table className="border-collapse border border-slate-200">
                      <TableHeader className="bg-[#F8F9FA] h-[48px]">
                        <TableRow>
                          <TableHead className="w-[500px] font-bold text-slate-400 uppercase tracking-widest text-[9px] px-6">NATURE OF SUPPLIES</TableHead>
                          <TableHead className="w-[220px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">TOTAL TAXABLE VALUE (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">IGST (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <Row label="Supplies made to Unregistered Persons" taxable="0.00" igst="0.00" />
                        <Row label="Supplies made to Composition Taxable Persons" taxable="0.00" igst="0.00" />
                        <Row label="Supplies made to UIN holders" taxable="0.00" igst="0.00" />
                      </TableBody>
                   </Table>
                </Section>

                {/* Section 4: Eligible ITC - UPDATED PERSENTATION */}
                <Section identifier="4" title="4. Eligible ITC" subtitle="Autofilled at 16 Apr 2026, 10:35 AM | Sources: Mixed Selection">
                    <Table className="border-collapse border border-slate-200">
                      <TableHeader className="bg-[#F8F9FA] h-[48px]">
                        <TableRow>
                          <TableHead className="w-[500px] font-bold text-slate-400 uppercase tracking-widest text-[9px] px-6">NATURE OF SUPPLIES</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">IGST (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">CGST (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">SGST (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">CESS (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-6">SOURCE</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* (A) ITC Available */}
                        <TableRow className="bg-[#FBFCFD] h-[44px]"><TableCell colSpan={6} className="px-6 text-[12px] font-black text-slate-900 tracking-tight uppercase">(A) ITC Available (Whether in full or part)</TableCell></TableRow>
                        
                        {/* 4.A.1 Import of goods */}
                        <CollapsibleHeader 
                          id="4-A-1" 
                          label="Import of goods" 
                          igst="0.00" cess="0.00" source="2B vs PR Recon" 
                          isOpen={expandedSections['4-A-1']} 
                          onToggle={() => toggleSection('4-A-1')} 
                        />
                        {expandedSections['4-A-1'] && (
                          <>
                            <NestedRow label="(i) Current Month ITC (IMPG + IMPG_SEZ)" igst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(ii) Carry Forward ITC (IMPG + IMPG_SEZ)" igst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(iii) Previous Months ITC within same year (IMPG + IMPG_SEZ)" igst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(iv) Previous Year ITC (IMPG + IMPG_SEZ)" igst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(v) Current Month ITC (IMPGA + IMPG_SEZA)_(Amended value - Original Value)" igst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(vi) Current Month ITC (IMPG + IMPG_SEZ)_Original Value" igst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(vii) Carry Forward ITC (IMPGA + IMPG_SEZA)_(Amended value - Original Value)" igst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(viii) Previous Months ITC within same year (IMPGA + IMPG_SEZA)" igst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(ix) Previous Year ITC (IMPGA + IMPG_SEZA)" igst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(x) Others" igst="-" cess="-" source="2B vs PR Recon" />
                          </>
                        )}

                        {/* 4.A.2 Import of services */}
                        <CollapsibleHeader 
                          id="4-A-2" 
                          label="Import of services" 
                          igst="0.00" cess="0.00" source="Purchase Register" 
                          isOpen={expandedSections['4-A-2']} 
                          onToggle={() => toggleSection('4-A-2')} 
                        />
                        {expandedSections['4-A-2'] && (
                          <>
                            <NestedRow label="(i) PR_ (Invoice + Debit Note)" igst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(ii) PR_(Credit Note)" igst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(iii) Others" igst="0.00" cess="0.00" source="Purchase Register" />
                          </>
                        )}

                        {/* 4.A.3 Inward supplies liable to reverse charge */}
                        <CollapsibleHeader 
                          id="4-A-3" 
                          label="Inward supplies liable to reverse charge (other than 1 & 2 above)" 
                          igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" 
                          isOpen={expandedSections['4-A-3']} 
                          onToggle={() => toggleSection('4-A-3')} 
                        />
                        {expandedSections['4-A-3'] && (
                          <>
                            <NestedRow label="(i) Current Month ITC from registered Supplier (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(ii) Carry Forward ITC from registered Supplier (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(iii) Previous Months ITC within same year from registered supplier (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(iv) Previous Year ITC from registered Supplier (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(v) Current Month ITC from registered Supplier (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(vi) Carry Forward ITC from registered Supplier (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(vii) Previous Months ITC within same year from registered supplier (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(viii) Previous Year ITC from registered Supplier (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(ix) Current Month ITC from registered Supplier (B2BA + DNA - CNA) (Amended Value - Original Value)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(x) Current Month ITC from registered Supplier (B2BA + DNA - CNA) (Original Value)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(xi) Carry Forward ITC from registered Supplier (B2BA + DNA - CNA) (Amended - Original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(xii) Amended_Previous Months ITC within same year from registered supplier (B2BA + DNA - CNA)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(xiii) Amended_Previous Year ITC from registered Supplier (B2BA + DNA - CNA)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(xiv) Unregistered supplies (RCM)_ (Invoice + Debit Note)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(xv) Unregistered supplies (RCM)_ (Credit Note)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(xvi) Others - Registered" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(xvii) Others - Unregistered" igst="-" cgst="-" sgst="-" cess="-" source="Purchase Register" />
                          </>
                        )}

                        {/* 4.A.4 Inward supplies from ISD */}
                        <CollapsibleHeader 
                          id="4-A-4" 
                          label="Inward supplies from ISD" 
                          igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="GSTR-2B" 
                          isOpen={expandedSections['4-A-4']} 
                          onToggle={() => toggleSection('4-A-4')} 
                        />
                        {expandedSections['4-A-4'] && (
                          <>
                            <NestedRow label="(i) Current Month ITC" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="GSTR-2B" />
                            <NestedRow label="(ii) Carry Forward ITC" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="GSTR-2B" />
                            <NestedRow label="(iii) Previous Months ITC within same year" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="GSTR-2B" />
                            <NestedRow label="(iv) Previous Year ITC" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="GSTR-2B" />
                            <NestedRow label="(v) Current Month ITC from registered Supplier (B2BA + DNA - CNA) (Amended - Original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="GSTR-2B" />
                            <NestedRow label="(vi) Current Month ITC from registered Supplier (B2BA + DNA - CNA) (Original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="GSTR-2B" />
                            <NestedRow label="(vii) Carry Forward ITC from registered Supplier (B2BA + DNA - CNA) (Amended - Original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="GSTR-2B" />
                            <NestedRow label="(viii) Previous Months ITC within same year from registered supplier (B2BA + DNA - CNA) (Amended)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="GSTR-2B" />
                            <NestedRow label="(ix) Previous Year ITC from registered Supplier (B2BA + DNA - CNA) (Amended)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="GSTR-2B" />
                            <NestedRow label="(x) Others" igst="-" cgst="-" sgst="-" cess="-" source="GSTR-2B" />
                          </>
                        )}

                        {/* 4.A.5 All other ITC */}
                        <CollapsibleHeader 
                          id="4-A-5" 
                          label="All other ITC" 
                          igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" 
                          isOpen={expandedSections['4-A-5']} 
                          onToggle={() => toggleSection('4-A-5')} 
                        />
                        {expandedSections['4-A-5'] && (
                          <>
                            <NestedRow label="(i) Current Month ITC (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(ii) Carry Forward ITC (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(iii) Previous Months ITC within same year (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(iv) Previous Year ITC (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(v) Current Month ITC (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(vi) Carry Forward ITC (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(vii) Previous Months ITC within same year (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(viii) Previous Year ITC from registered Supplier (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(ix) Current Month ITC (B2BA + DNA - CNA) (Amended - Original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(x) Current Month ITC (B2BA + DNA - CNA) (Original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(xi) Carry Forward ITC (B2BA + DNA - CNA) (Amended - Original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(xii) Previous Months ITC within same year (B2BA + DNA - CNA) (Amended)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(xiii) Previous Year ITC (B2BA + DNA - CNA) (Amended)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(xiv) Others" igst="-" cgst="-" sgst="-" cess="-" source="2B vs PR Recon" />
                          </>
                        )}

                        {/* (B) ITC Reversed */}
                        <TableRow className="bg-[#FBFCFD] h-[44px] border-t border-slate-200"><TableCell colSpan={6} className="px-6 text-[12px] font-black text-slate-900 tracking-tight uppercase">(B) ITC Reversed</TableCell></TableRow>
                        
                        {/* 4.B.1 As per rules... */}
                        <CollapsibleHeader 
                          id="4-B-1" 
                          label="As per rules 38,42 & 43 of CGST Rules and section 17(5)" 
                          igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Mixed Selection" 
                          isOpen={expandedSections['4-B-1']} 
                          onToggle={() => toggleSection('4-B-1')} 
                        />
                        {expandedSections['4-B-1'] && (
                          <>
                            <NestedRow label="(i) As per 17(5)_Other then Reverse Charge" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(ii) As per 17(5)_Reverse Charge from registered supplier" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(iii) As per 17(5)_Reverse Charge from Unregistered supplier" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(iv) As per 17(5)_Import of Goods" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(v) As per 17(5)_Import of Services" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(vi) As per 17(5)_ISD" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="GSTR-2B" />
                            <NestedRow label="(vii) As per Rule 42" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(viii) As per Rule 43" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="GSTR-3B Summary" />
                            <NestedRow label="(ix) As per Rule 38" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(x) Yearly Adjustment for Rule 42" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(xi) Others" igst="-" cgst="-" sgst="-" cess="-" source="2B vs PR Recon" />
                          </>
                        )}

                        {/* 4.B.2 Others */}
                        <CollapsibleHeader 
                          id="4-B-2" 
                          label="Others" 
                          igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Mixed Selection" 
                          isOpen={expandedSections['4-B-2']} 
                          onToggle={() => toggleSection('4-B-2')} 
                        />
                        {expandedSections['4-B-2'] && (
                          <>
                            <NestedRow label="(i) Carry Forward ITC_Other then Reverse charge (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(ii) Carry Forward ITC_Other then reverse charge (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(iii) Carry Forward ITC from registered supplier_Reverse charge (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(iv) Carry Forward ITC from registered supplier _Reverse charge (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(v) Carry Forward ITC from unregistered supplier_Reverse charge (Invoices)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(vi) Carry Forward ITC from unregistered supplier_Reverse charge (Credit Notes)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(vii) Carry Forward ITC (ISD)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(viii) Carry Forward ITC (Import of services)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Purchase Register" />
                            <NestedRow label="(ix) Carry Forward ITC_(Import of Goods)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(x) Carry Forward ITC_Other then Reverse charge (B2BA + DNA - CNA) (Amended - original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(xi) Amendment_Carry Forward ITC from registered supplier_Reverse charge (B2BA + DNA - CNA) (Amended - Original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(xii) Amendment_Carry Forward ITC (ISDA) (Amended - Original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(xiii) Amendment_Carry Forward ITC (IMPGA) (Amended - Original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(xiv) ITC reversed due to Rule 37" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="2B vs PR Recon" />
                            <NestedRow label="(xv) Others" igst="-" cgst="-" sgst="-" cess="-" source="2B vs PR Recon" />
                          </>
                        )}

                        {/* (C) Net ITC Available */}
                        <TableRow className="bg-[#FBFCFD] h-[52px] border-y border-slate-200 font-bold text-slate-900"><TableCell className="px-6 uppercase tracking-tight text-[12px] font-black">(C) Net ITC Available (A)-(B)</TableCell><TableCell className="text-right px-6 font-black text-[13px]">0.00</TableCell><TableCell className="text-right px-6 font-black text-[13px]">0.00</TableCell><TableCell className="text-right px-6 font-black text-[13px]">0.00</TableCell><TableCell className="text-right px-6 font-black text-[13px]">0.00</TableCell><TableCell /></TableRow>
                        
                        {/* (D) Other Details */}
                        <TableRow className="bg-[#FBFCFD] h-[44px]"><TableCell colSpan={6} className="px-6 text-[12px] font-black text-slate-900 tracking-tight uppercase">(D) Other Details</TableCell></TableRow>

                        {/* 4.D.1 ITC reclaimed... */}
                        <CollapsibleHeader 
                          id="4-D-1" 
                          label="D(1) ITC reclaimed which was reversed under Table 4(B)(2) in earlier tax period" 
                          igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" 
                          isOpen={expandedSections['4-D-1']} 
                          onToggle={() => toggleSection('4-D-1')} 
                        />
                        {expandedSections['4-D-1'] && (
                          <>
                            <NestedRow label="(i) Previous month ITC_Other then reverse Charge (B2B + DN) but within same year" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(ii) Previous year ITC_Other then reverse Charge (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(iii) Previous month ITC_Other then reverse charge (CN) but within same year" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(iv) Previous Year ITC_Other then reverse charge (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(v) Previous month ITC from registered supplier_reverse Charge (B2B + DN) but within same year" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(vi) Previous Year ITC from registered supplier_reverse Charge (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(vii) Previous month ITC from registered supplier_reverse Charge (CN) but within same year" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(viii) Previous Year ITC from registered supplier_reverse Charge (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(ix) Previous month ITC (ISD) but within same year" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(x) Previous Year ITC (ISD)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(xi) Previous month ITC (Import of Goods) but within same year" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(xii) Previous Year ITC (Import of Goods)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(xiii) Previous Months ITC within same year (IMPGA + IMPG_SEZA)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(xiv) Previous Year ITC (IMPGA + IMPG_SEZA)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(xv) Amended_Previous Months ITC within same year from registered supplier (B2BA + DNA - CNA)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(xvi) Amended_Previous Year ITC from registered Supplier (B2BA + DNA - CNA)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(xvii) Previous Months ITC within same year from registered supplier (B2BA + DNA - CNA) (Amended)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(xviii) Previous Year ITC from registered Supplier (B2BA + DNA - CNA) (Amended)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(xix) Previous Months ITC within same year (B2BA + DNA - CNA) (Amended)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(xx) Previous Year ITC (B2BA + DNA - CNA) (Amended)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(xxi) Others" igst="-" cgst="-" sgst="-" cess="-" source="Manually fill" />
                          </>
                        )}

                        {/* 4.D.2 Ineligible ITC... */}
                        <CollapsibleHeader 
                          id="4-D-2" 
                          label="Ineligible ITC under section 16(4) & ITC restricted due to PoS rules" 
                          igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" 
                          isOpen={expandedSections['4-D-2']} 
                          onToggle={() => toggleSection('4-D-2')} 
                        />
                        {expandedSections['4-D-2'] && (
                          <>
                            <NestedRow label="(i) Ineligible ITC due to POS & 16(4) (B2B + DN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(ii) Ineligible ITC due to POS (CN)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(iii) Ineligible ITC (ISD)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(iv) Ineligible ITC due to POS & 16(4) (B2BA + DNA - CNA) (Amended - Original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(v) Ineligible ITC due to POS & 16(4) (ISDA) (Amended - Original)" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" source="Manually fill" />
                            <NestedRow label="(vi) Others" igst="-" cgst="-" sgst="-" cess="-" source="Manually fill" />
                          </>
                        )}

                      </TableBody>
                    </Table>
                </Section>

                {/* Remaining sections 5, 5.1, 6.1 */}
                <Section identifier="5" title="5. Values of exempt, nil-rated and non-GST inward supplies" subtitle="Autofilled at 16 Apr 2026, 10:35 AM">
                    <Table className="border-collapse border border-slate-200">
                      <TableHeader className="bg-[#F8F9FA] h-[48px]">
                        <TableRow>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] px-6">NATURE OF SUPPLIES</TableHead>
                          <TableHead className="w-[300px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">INTER-STATE SUPPLIES (₹)</TableHead>
                          <TableHead className="w-[300px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">INTRA-STATE SUPPLIES (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="h-[52px] border-b border-slate-100 font-bold text-[13px] text-slate-600"><TableCell className="px-6 font-bold">From a supplier under composition scheme, Exempt and Nil rated supply</TableCell><TableCell className="text-right px-6 font-bold text-slate-500">0.00</TableCell><TableCell className="text-right px-6 font-bold text-slate-500">0.00</TableCell></TableRow>
                        <TableRow className="h-[52px] border-b border-slate-100 font-bold text-[13px] text-slate-600"><TableCell className="px-6 font-bold">Non GST supply</TableCell><TableCell className="text-right px-6 font-bold text-slate-500">0.00</TableCell><TableCell className="text-right px-6 font-bold text-slate-500">0.00</TableCell></TableRow>
                      </TableBody>
                    </Table>
                </Section>

                <Section identifier="5.1" title="5.1 Interest and Late fee for previous tax period" subtitle="Autofilled at 16 Apr 2026, 10:35 AM">
                   <Table className="border-collapse border border-slate-200">
                      <TableHeader className="bg-[#F8F9FA] h-[48px]">
                        <TableRow>
                          <TableHead className="w-[500px] font-bold text-slate-400 uppercase tracking-widest text-[9px] px-6">DESCRIPTION</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">IGST (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">CGST (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">SGST (₹)</TableHead>
                          <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right px-6">CESS (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <Row label="Interest" igst="0.00" cgst="0.00" sgst="0.00" cess="0.00" />
                        <Row label="Late Fee" igst="-" cgst="0.00" sgst="0.00" cess="-" />
                      </TableBody>
                   </Table>
                </Section>

                <Section identifier="6.1" title="6.1 Payment of tax" subtitle="Source: USER INPUT">
                    <div className="border border-slate-200 rounded-sm overflow-hidden bg-white">
                      <Table className="border-collapse table-fixed w-full">
                         <TableHeader className="bg-[#F9FAFB] border-b border-slate-200 h-[50px]">
                           <TableRow>
                             <TableHead className="w-[420px] font-bold text-slate-400 uppercase tracking-widest text-[9px] px-6">DETAILS</TableHead>
                             <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">TOTAL (₹)</TableHead>
                             <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">IGST (₹)</TableHead>
                             <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">CGST (₹)</TableHead>
                             <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">SGST (₹)</TableHead>
                             <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">CESS (₹)</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {/* TOTAL TAX LIABILITY */}
                           <DataGroup title="TOTAL TAX LIABILITY" />
                           <SimpleRow id="1a" label="Tax payable other than reverse charge" total="0.00" />
                           <SimpleRow id="1b" label="Tax Payable for Supplies u/s 9(5)" total="0.00" />
                           <SimpleRow id="1c" label="Reverse Charge tax payable" total="0.00" />
                           <SimpleRow id="1d" label="Interest payable" total="0.00" />
                           <SimpleRow id="1e" label="Late fee payable" total="0.00" />
                           <SimpleRow id="1f" label="Total tax to be paid (a+b+c+d+e)" total="0.00" isBold bgClass="bg-[#FFF8F0]" />
                           
                           {/* Adjustment of Negative Liability */}
                           <DataGroup title="Adjustment of Negative Liability of Previous Tax Period" />
                           <SimpleRow id="2a" label="Tax payable other than reverse charge" total="0.00" />
                           <SimpleRow id="2b" label="Tax Payable for Supplies u/s 9(5) and reverse charge" total="0.00" />

                           {/* NET TAX LIABILITY */}
                           <DataGroup title="NET TAX LIABILITY" />
                           <SimpleRow id="3a" label="Tax payable other than reverse charge" total="0.00" />
                           <SimpleRow id="3b" label="Tax Payable for Supplies u/s 9(5)" total="0.00" />
                           <SimpleRow id="3c" label="Reverse Charge tax payable" total="0.00" />
                           <SimpleRow id="3d" label="Interest payable" total="0.00" />
                           <SimpleRow id="3e" label="Late fee payable" total="0.00" />

                           {/* ITC CLAIMED & CREDIT LEDGER BALANCE */}
                           <DataGroup title="ITC CLAIMED & CREDIT LEDGER BALANCE" />
                           <SimpleRow id="4" label="ITC available" total="0.00" />
                           <SimpleRow id="5" label="Electronic Credit Ledger balance" total="79,42,446" igst="78,88,940" cgst="26,753" sgst="26,753" cess="0.00" />
                           
                           {/* Row 6 with 6A-6D nested */}
                           <TableRow className="border-b border-slate-100">
                             <TableCell className="px-0 py-0" colSpan={6}>
                               <div className="flex w-full">
                                 <div className="w-[420px] flex items-center px-6 py-4 gap-4 border-r border-slate-100 bg-[#FBFBFC]">
                                    <span className="w-8 text-[11px] font-bold text-slate-400">6</span>
                                    <span className="text-[13px] font-bold text-slate-600">Total Tax to be paid through ITC (2+3)</span>
                                 </div>
                                 <div className="flex-1 flex flex-col">
                                    <div className="flex border-b border-slate-50">
                                      <div className="flex-1 px-4 py-3 text-[12px] font-medium text-slate-500 border-r border-slate-50">6A - Integrated Tax (IGST)</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500">0.00</div>
                                    </div>
                                    <div className="flex border-b border-slate-50">
                                      <div className="flex-1 px-4 py-3 text-[12px] font-medium text-slate-500 border-r border-slate-50">6B - Central Tax (CGST)</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500">0.00</div>
                                    </div>
                                    <div className="flex border-b border-slate-50">
                                      <div className="flex-1 px-4 py-3 text-[12px] font-medium text-slate-500 border-r border-slate-50">6C - State/UT Tax</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500">0.00</div>
                                    </div>
                                    <div className="flex">
                                      <div className="flex-1 px-4 py-3 text-[12px] font-medium text-slate-500 border-r border-slate-50">6D - Cess</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                      <div className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500">0.00</div>
                                    </div>
                                 </div>
                               </div>
                             </TableCell>
                           </TableRow>

                           {/* PAYMENT OF TAX */}
                           <DataGroup title="PAYMENT OF TAX (TABLE 6.1 in GSTR-3B FORM)" />
                           <SimpleRow id="7" label="Other than Reverse Charge (1a-4)" total="0.00" />
                           <SimpleRow id="8" label="Tax to be paid in cash for Supplies u/s 9(5)" total="0.00" />
                           <SimpleRow id="9" label="Reverse Charge tax to be paid in cash" total="0.00" />
                           <SimpleRow id="10" label="Interest to be paid in cash" total="0.00" />
                           <SimpleRow id="11" label="Late fee to be paid in cash" total="0.00" />
                           <SimpleRow id="12" label="Total tax to be paid in cash (5+6+7+8+9)" total="0.00" isBold bgClass="bg-[#FFF8F0]" />

                           {/* CASH LEDGER BALANCE */}
                           <DataGroup title="CASH LEDGER BALANCE" />
                           <SimpleRow id="13" label="Tax amount" total="0.00" />
                           <SimpleRow id="14" label="Penalty amount" total="0.00" />
                           <SimpleRow id="15" label="Interest amount" total="0.00" />
                           <SimpleRow id="16" label="Fee amount" total="0.00" />
                           <SimpleRow id="17" label="Other amount" total="0.00" />

                           {/* Row 18 with sub-items */}
                           <TableRow className="border-b border-slate-100">
                             <TableCell className="px-0 py-0" colSpan={6}>
                               <div className="flex w-full">
                                 <div className="w-[420px] flex items-center px-6 py-4 gap-4 border-r border-slate-100 bg-[#FFF8F0]">
                                    <span className="w-8 text-[11px] font-bold text-slate-400">18</span>
                                    <span className="text-[13px] font-bold text-slate-900">Total Utilizable Cash Balance</span>
                                 </div>
                                 <div className="flex-1 flex flex-col">
                                    {["Other than Reverse Charge", "Reverse Charge", "Interest", "Late Fee", "Total"].map((l, i) => (
                                      <div key={l} className={cn("flex border-b border-slate-50", i === 4 ? "bg-[#FFF8F0] border-none" : "")}>
                                        <div className="flex-1 px-4 py-3 text-[12px] font-medium text-slate-500 border-r border-slate-50">{l}</div>
                                        {[1,2,3,4,5].map(v => (
                                          <div key={v} className="w-[160px] flex items-center justify-center text-[13px] font-bold text-slate-500 border-r border-slate-50">0.00</div>
                                        ))}
                                      </div>
                                    ))}
                                 </div>
                               </div>
                             </TableCell>
                           </TableRow>

                           <SimpleRow id="19" label="Additional cash required" total="0.00" isBold bgClass="bg-blue-50/50" />

                           {/* CLOSING LEDGER BALANCE */}
                           <DataGroup title="CLOSING LEDGER BALANCE" />
                           <SimpleRow id="20" label="Electronic Credit Ledger balance" total="79,42,446" igst="78,88,940" cgst="26,753" sgst="26,753" cess="0.00" isBold bgClass="bg-blue-50/80" />
                         </TableBody>
                      </Table>
                    </div>
                </Section>

              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Section = ({ identifier, title, subtitle, children }: { identifier: string, title: string, subtitle: string, children: React.ReactNode }) => (
  <div id={`section-${identifier}`} className="flex flex-col gap-4 scroll-mt-24">
    <div className="flex flex-col gap-1.5 border-l-4 border-blue-600 pl-4 py-1">
      <h3 className="text-[17px] font-bold text-slate-800 tracking-tight leading-tight">{title}</h3>
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
        <Info className="h-3.5 w-3.5 text-blue-400" />
        {subtitle}
      </div>
    </div>
    {children}
  </div>
);

const Row = ({ label, taxable, igst, cgst, sgst, cess, source, isBold, bgClass }: any) => (
  <TableRow className={cn("h-[48px] border-b border-slate-100 font-bold text-[13px] text-slate-600 transition-colors hover:bg-slate-50", bgClass, isBold ? "text-slate-900" : "")}>
    <TableCell className="px-6">{label}</TableCell>
    {taxable !== undefined && <TableCell className="text-right px-6 font-bold">{taxable}</TableCell>}
    <TableCell className="text-right px-6 font-bold">{igst ?? "-"}</TableCell>
    <TableCell className="text-right px-6 font-bold">{cgst ?? "-"}</TableCell>
    <TableCell className="text-right px-6 font-bold">{sgst ?? "-"}</TableCell>
    <TableCell className="text-right px-6 font-bold">{cess ?? "-"}</TableCell>
    {source !== undefined && (
      <TableCell className="text-center px-6">
        <div className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-sm border border-blue-100">{source}</div>
      </TableCell>
    )}
  </TableRow>
);

const CollapsibleHeader = ({ id, label, igst, cgst, sgst, cess, source, isOpen, onToggle }: any) => (
  <TableRow 
    className={cn(
      "h-[52px] border-b border-slate-100 font-bold text-[13px] transition-colors cursor-pointer group hover:bg-slate-50/80",
      isOpen ? "bg-slate-50/50" : "bg-white"
    )}
    onClick={onToggle}
  >
    <TableCell className="px-6 flex items-center gap-3 h-full">
      {isOpen ? <MinusSquare className="h-4 w-4 text-blue-600 shrink-0" /> : <PlusSquare className="h-4 w-4 text-blue-600 shrink-0" />}
      <span className="text-slate-700 font-bold">{label}</span>
    </TableCell>
    <TableCell className="text-right px-6 font-bold text-slate-900">{igst ?? "0.00"}</TableCell>
    <TableCell className="text-right px-6 font-bold text-slate-900">{cgst ?? "-"}</TableCell>
    <TableCell className="text-right px-6 font-bold text-slate-900">{sgst ?? "-"}</TableCell>
    <TableCell className="text-right px-6 font-bold text-slate-900">{cess ?? "0.00"}</TableCell>
    <TableCell className="text-center px-6">
      <div className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-sm border border-blue-100">{source}</div>
    </TableCell>
  </TableRow>
);

const NestedRow = ({ label, igst, cgst, sgst, cess, source }: any) => (
  <TableRow className="h-[48px] border-b border-slate-100 bg-[#FBFBFB]/40 hover:bg-[#F8F9FA]">
    <TableCell className="pl-14 pr-6 text-[12px] font-medium text-slate-500 italic">{label}</TableCell>
    <TableCell className="text-right px-6 font-bold text-slate-500 text-[12px]">{igst ?? "0.00"}</TableCell>
    <TableCell className="text-right px-6 font-bold text-slate-500 text-[12px]">{cgst ?? "-"}</TableCell>
    <TableCell className="text-right px-6 font-bold text-slate-500 text-[12px]">{sgst ?? "-"}</TableCell>
    <TableCell className="text-right px-6 font-bold text-slate-500 text-[12px]">{cess ?? "0.00"}</TableCell>
    <TableCell className="text-center px-6">
      <div className="inline-block px-2 py-0.5 bg-slate-100 text-slate-400 text-[9px] font-black uppercase rounded-sm border border-slate-200">{source}</div>
    </TableCell>
  </TableRow>
);

const DataGroup = ({ title }: { title: string }) => (
  <TableRow className="bg-[#F8F9FA] h-[40px] border-y border-slate-200">
    <TableCell colSpan={6} className="px-6 font-black text-slate-500 text-[10px] tracking-widest uppercase">{title}</TableCell>
  </TableRow>
);

const SimpleRow = ({ id, label, total, igst = "0.00", cgst = "0.00", sgst = "0.00", cess = "0.00", isBold, bgClass }: any) => (
  <TableRow className={cn("h-[52px] border-b border-slate-100 hover:bg-slate-50", bgClass)}>
    <TableCell className="px-6 flex items-center gap-4 h-full">
      <span className="w-8 text-[11px] font-bold text-slate-400">{id}</span>
      <span className={cn("text-[13px] font-bold", isBold ? "text-slate-900" : "text-slate-600")}>{label}</span>
    </TableCell>
    {[total, igst, cgst, sgst, cess].map((v, i) => (
      <TableCell key={i} className="p-2 text-center text-[13px] font-bold text-slate-500">{v}</TableCell>
    ))}
  </TableRow>
);

export default GSTR3BDetailedSummaryModal;
