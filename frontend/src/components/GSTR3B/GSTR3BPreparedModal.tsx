import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, ExternalLink } from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GSTR3BPreparedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gstin: string | null;
}

const STORAGE_KEY = 'gstr3b_cell_values';

interface SubRow {
  tbl: string;
  n: string;
  src: string;
}

// --- Sub-row definitions for Table 4 ---
const SUBS_4A1: SubRow[] = [
  {tbl:'4A(1)(i)',   n:'Current Month ITC (IMPG + IMPG_SEZ)', src:'2B vs PR Recon'},
  {tbl:'4A(1)(ii)',  n:'Carry Forward ITC (IMPG + IMPG_SEZ)', src:'2B vs PR Recon'},
  {tbl:'4A(1)(iii)', n:'Previous Months ITC within same year (IMPG + IMPG_SEZ)', src:'2B vs PR Recon'},
  {tbl:'4A(1)(iv)',  n:'Previous Year ITC (IMPG + IMPG_SEZ)', src:'2B vs PR Recon'},
  {tbl:'4A(1)(v)',   n:'Current Month ITC (IMPGA + IMPG_SEZA)_(Amended value - Original Value)', src:'2B vs PR Recon'},
  {tbl:'4A(1)(vi)',  n:'Current Month ITC (IMPG + IMPG_SEZ)_Original Value', src:'2B vs PR Recon'},
  {tbl:'4A(1)(vii)', n:'Carry Forward ITC (IMPGA + IMPG_SEZA)_(Amended value - Original Value)', src:'2B vs PR Recon'},
  {tbl:'4A(1)(viii)',n:'Previous Months ITC within same year (IMPGA + IMPG_SEZA)', src:'2B vs PR Recon'},
  {tbl:'4A(1)(ix)',  n:'Previous Year ITC (IMPGA + IMPG_SEZA)', src:'2B vs PR Recon'},
  {tbl:'4A(1)(x)',   n:'Others', src:'2B vs PR Recon'},
  {tbl:'4A(1)(xi)',  n:'', src:''},
  {tbl:'4A(1)(xii)', n:'', src:''},
  {tbl:'4A(1)(xiii)',n:'', src:''},
  {tbl:'4A(1)(xiv)', n:'', src:''},
  {tbl:'4A(1)(xv)',  n:'', src:''},
];

const SUBS_4A2: SubRow[] = [
  {tbl:'4A(2)(i)',   n:'PR_(Invoice + Debit Note)', src:'Purchase Register'},
  {tbl:'4A(2)(ii)',  n:'PR_(Credit Note)', src:'Purchase Register'},
  {tbl:'4A(2)(iii)', n:'Others', src:'Purchase Register'},
  {tbl:'4A(2)(iv)',  n:'', src:''},
  {tbl:'4A(2)(v)',   n:'', src:''},
  {tbl:'4A(2)(vi)',  n:'', src:''},
  {tbl:'4A(2)(vii)', n:'', src:''},
  {tbl:'4A(2)(viii)',n:'', src:''},
];

const SUBS_4A3: SubRow[] = [
  {tbl:'4A(3)(i)',     n:'Current Month ITC from registered Supplier (B2B + DN)', src:'Purchase Register'},
  {tbl:'4A(3)(ii)',    n:'Carry Forward ITC from registered Supplier (B2B + DN)', src:'Purchase Register'},
  {tbl:'4A(3)(iii)',   n:'Previous Months ITC within same year from registered supplier (B2B + DN)', src:'Purchase Register'},
  {tbl:'4A(3)(iv)',    n:'Previous Year ITC from registered Supplier (B2B + DN)', src:'Purchase Register'},
  {tbl:'4A(3)(v)',     n:'Current Month ITC from registered Supplier (CN)', src:'Purchase Register'},
  {tbl:'4A(3)(vi)',    n:'Carry Forward ITC from registered Supplier (CN)', src:'Purchase Register'},
  {tbl:'4A(3)(vii)',   n:'Previous Months ITC within same year from registered supplier (CN)', src:'Purchase Register'},
  {tbl:'4A(3)(viii)',  n:'Previous Year ITC from registered Supplier (CN)', src:'Purchase Register'},
  {tbl:'4A(3)(ix)',    n:'Current Month ITC from registered Supplier (B2BA + DNA - CNA) (Amended Value - Original Value)', src:'Purchase Register'},
  {tbl:'4A(3)(x)',     n:'Current Month ITC from registered Supplier (B2BA + DNA - CNA) (Original Value)', src:'Purchase Register'},
  {tbl:'4A(3)(xi)',    n:'Carry Forward ITC from registered Supplier (B2BA + DNA - CNA) (Amended - Original)', src:'Purchase Register'},
  {tbl:'4A(3)(xii)',   n:'Amended_Previous Months ITC within same year from registered supplier (B2BA + DNA - CNA)', src:'Purchase Register'},
  {tbl:'4A(3)(xiii)',  n:'Amended_Previous Year ITC from registered Supplier (B2BA + DNA + CNA)', src:'Purchase Register'},
  {tbl:'4A(3)(xiv)',   n:'Unregistered supplies (RCM)_(Invoice + Debit Note)', src:'Purchase Register'},
  {tbl:'4A(3)(xv)',    n:'Unregistered supplies (RCM)_(Credit Note)', src:'Purchase Register'},
  {tbl:'4A(3)(xvi)',   n:'Others - Registered', src:'Purchase Register'},
  {tbl:'4A(3)(xvii)',  n:'Others - Unregistered', src:'Purchase Register'},
  {tbl:'4A(3)(xviii)', n:'', src:'Purchase Register'},
  {tbl:'4A(3)(xix)',   n:'', src:'Purchase Register'},
  {tbl:'4A(3)(xx)',    n:'', src:'Purchase Register'},
  {tbl:'4A(3)(xxi)',   n:'', src:'Purchase Register'},
  {tbl:'4A(3)(xxii)',  n:'', src:'Purchase Register'},
];

const SUBS_4A4: SubRow[] = [
  {tbl:'4A(4)(i)',    n:'Current Month ITC', src:'GSTR-2B'},
  {tbl:'4A(4)(ii)',   n:'Carry Forward ITC', src:'GSTR-2B'},
  {tbl:'4A(4)(iii)',  n:'Previous Months ITC within same year', src:'GSTR-2B'},
  {tbl:'4A(4)(iv)',   n:'Previous Year ITC', src:'GSTR-2B'},
  {tbl:'4A(4)(v)',    n:'Current Month ITC from registered Supplier (B2BA + DNA - CNA) (Amended - Original)', src:'GSTR-2B'},
  {tbl:'4A(4)(vi)',   n:'Current Month ITC from registered Supplier (B2BA + DNA - CNA) (Original)', src:'GSTR-2B'},
  {tbl:'4A(4)(vii)',  n:'Carry Forward ITC from registered Supplier (B2BA + DNA - CNA) (Amended - Original)', src:'GSTR-2B'},
  {tbl:'4A(4)(viii)', n:'Previous Months ITC within same year from registered supplier (B2BA + DNA - CNA) (Amended)', src:'GSTR-2B'},
  {tbl:'4A(4)(ix)',   n:'Previous Year ITC from registered Supplier (B2BA + DNA - CNA) (Amended)', src:'GSTR-2B'},
  {tbl:'4A(4)(x)',    n:'Others', src:'GSTR-2B'},
  {tbl:'4A(4)(xi)',   n:'', src:''},
  {tbl:'4A(4)(xii)',  n:'', src:''},
  {tbl:'4A(4)(xiii)', n:'', src:''},
  {tbl:'4A(4)(xiv)',  n:'', src:''},
  {tbl:'4A(4)(xv)',   n:'', src:''},
];

const SUBS_4A5: SubRow[] = [
  {tbl:'4A(5)(i)',      n:'Current Month ITC (B2B + DN)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(ii)',     n:'Carry Forward ITC (B2B + DN)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(iii)',    n:'Previous Months ITC within same year (B2B + DN)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(iv)',     n:'Previous Year ITC (B2B + DN)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(v)',      n:'Current Month ITC (CN)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(vi)',     n:'Carry Forward ITC (CN)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(vii)',    n:'Previous Months ITC within same year (CN)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(viii)',   n:'Previous Year ITC from registered Supplier (CN)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(ix)',     n:'Current Month ITC (B2BA + DNA - CNA) (Amended - Original)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(x)',      n:'Current Month ITC (B2BA + DNA - CNA) (Original)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(xi)',     n:'Carry Forward ITC (B2BA + DNA - CNA) (Amended - Original)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(xii)',    n:'Previous Months ITC within same year (B2BA + DNA - CNA) (Amended)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(xiii)',   n:'Previous Year ITC (B2BA + DNA - CNA) (Amended)', src:'2B vs PR Recon'},
  {tbl:'4A(5)(xiv)',    n:'Others', src:'2B vs PR Recon'},
  {tbl:'4A(5)(xv)',     n:'', src:''},
  {tbl:'4A(5)(xvi)',    n:'', src:''},
  {tbl:'4A(5)(xvii)',   n:'', src:''},
  {tbl:'4A(5)(xviii)',  n:'', src:''},
  {tbl:'4A(5)(xix)',    n:'', src:''},
];

const SUBS_4B1: SubRow[] = [
  {tbl:'4B(1)(i)',    n:'As per 17(5)_Other then Reverse Charge', src:'2B vs PR Recon'},
  {tbl:'4B(1)(ii)',   n:'As per 17(5)_Reverse Charge from registered supplier', src:'Purchase Register'},
  {tbl:'4B(1)(iii)',  n:'As per 17(5)_Reverse Charge from Unregistered supplier', src:'Purchase Register'},
  {tbl:'4B(1)(iv)',   n:'As per 17(5)_Import of Goods', src:'2B vs PR Recon'},
  {tbl:'4B(1)(v)',    n:'As per 17(5)_Import of Services', src:'Purchase Register'},
  {tbl:'4B(1)(vi)',   n:'As per 17(5)_ISD', src:'GSTR-2B'},
  {tbl:'4B(1)(vii)',  n:'As per Rule 42', src:'2B vs PR Recon'},
  {tbl:'4B(1)(viii)', n:'As per Rule 43', src:'GSTR-3B Summary'},
  {tbl:'4B(1)(ix)',   n:'As per Rule 38', src:'2B vs PR Recon'},
  {tbl:'4B(1)(x)',    n:'Yearly Adjustment for Rule 42', src:'2B vs PR Recon'},
  {tbl:'4B(1)(xi)',   n:'Others', src:'2B vs PR Recon'},
  {tbl:'4B(1)(xii)',  n:'', src:''},
  {tbl:'4B(1)(xiii)', n:'', src:''},
  {tbl:'4B(1)(xiv)',  n:'', src:''},
  {tbl:'4B(1)(xv)',   n:'', src:''},
  {tbl:'4B(1)(xvi)',  n:'', src:''},
];

const SUBS_4B2: SubRow[] = [
  {tbl:'4B(2)(i)',     n:'Carry Forward ITC_Other then Reverse charge (B2B + DN)', src:'2B vs PR Recon'},
  {tbl:'4B(2)(ii)',    n:'Carry Forward ITC_Other then reverse charge (CN)', src:'2B vs PR Recon'},
  {tbl:'4B(2)(iii)',   n:'Carry Forward ITC from registered supplier_Reverse charge (B2B + DN)', src:'Purchase Register'},
  {tbl:'4B(2)(iv)',    n:'Carry Forward ITC from registered supplier _Reverse charge (CN)', src:'Purchase Register'},
  {tbl:'4B(2)(v)',     n:'Carry Forward ITC from unregistered supplier_Reverse charge (Invoices)', src:'Purchase Register'},
  {tbl:'4B(2)(vi)',    n:'Carry Forward ITC from unregistered supplier_Reverse charge (Credit Notes)', src:'Purchase Register'},
  {tbl:'4B(2)(vii)',   n:'Carry Forward ITC (ISD)', src:'2B vs PR Recon'},
  {tbl:'4B(2)(viii)',  n:'Carry Forward ITC (Import of services)', src:'Purchase Register'},
  {tbl:'4B(2)(ix)',    n:'Carry Forward ITC_(Import of Goods)', src:'2B vs PR Recon'},
  {tbl:'4B(2)(x)',     n:'Carry Forward ITC_Other then Reverse charge (B2BA + DNA - CNA) (Amended - original)', src:'2B vs PR Recon'},
  {tbl:'4B(2)(xi)',    n:'Amendment_Carry Forward ITC from registered supplier_Reverse charge (B2BA + DNA - CNA) (Amended - Original)', src:'2B vs PR Recon'},
  {tbl:'4B(2)(xii)',   n:'Amendment_Carry Forward ITC (ISDA) (Amended - Original)', src:'2B vs PR Recon'},
  {tbl:'4B(2)(xiii)',  n:'Amendment_Carry Forward ITC (IMPGA) (Amended - Original)', src:'2B vs PR Recon'},
  {tbl:'4B(2)(xiv)',   n:'ITC reversed due to Rule 37', src:'2B vs PR Recon'},
  {tbl:'4B(2)(xv)',    n:'Others', src:'2B vs PR Recon'},
  {tbl:'4B(2)(xvi)',   n:'', src:''},
  {tbl:'4B(2)(xvii)',  n:'', src:''},
  {tbl:'4B(2)(xviii)', n:'', src:''},
  {tbl:'4B(2)(xix)',   n:'', src:''},
  {tbl:'4B(2)(xx)',    n:'', src:''},
];

const SUBS_4D1: SubRow[] = [
  {tbl:'4D(1)(i)',     n:'Previous month ITC_Other then reverse Charge (B2B + DN) but within same year', src:'2B vs PR Recon'},
  {tbl:'4D(1)(ii)',    n:'Previous year ITC_Other then reverse Charge (B2B + DN)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(iii)',   n:'Previous month ITC_Other then reverse charge (CN) but within same year', src:'2B vs PR Recon'},
  {tbl:'4D(1)(iv)',    n:'Previous Year ITC_Other then reverse charge (CN)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(v)',     n:'Previous month ITC from registered supplier_reverse Charge (B2B + DN) but within same year', src:'2B vs PR Recon'},
  {tbl:'4D(1)(vi)',    n:'Previous Year ITC from registered supplier_reverse Charge (B2B + DN)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(vii)',   n:'Previous month ITC from registered supplier_reverse Charge (CN) but within same year', src:'2B vs PR Recon'},
  {tbl:'4D(1)(viii)',  n:'Previous Year ITC from registered supplier_reverse Charge (CN)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(ix)',    n:'Previous month ITC (ISD) but within same year', src:'2B vs PR Recon'},
  {tbl:'4D(1)(x)',     n:'Previous Year ITC (ISD)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(xi)',    n:'Previous month ITC (Import of Goods) but within same year', src:'2B vs PR Recon'},
  {tbl:'4D(1)(xii)',   n:'Previous Year ITC (Import of Goods)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(xiii)',  n:'Previous Months ITC within same year (IMPGA + IMPG_SEZA)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(xiv)',   n:'Previous Year ITC (IMPGA + IMPG_SEZA)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(xv)',    n:'Amended_Previous Months ITC within same year from registered supplier (B2BA + DNA - CNA)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(xvi)',   n:'Amended_Previous Year ITC from registered Supplier (B2BA + DNA - CNA)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(xvii)',  n:'Previous Months ITC within same year from registered supplier (B2BA + DNA - CNA) (Amended)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(xviii)', n:'Previous Year ITC from registered Supplier (B2BA + DNA - CNA) (Amended)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(xix)',   n:'Previous Months ITC within same year (B2BA + DNA - CNA) (Amended)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(xx)',    n:'Previous Year ITC (B2BA + DNA - CNA) (Amended)', src:'2B vs PR Recon'},
  {tbl:'4D(1)(xxi)',   n:'Others', src:'2B vs PR Recon'},
  {tbl:'4D(1)(xxii)',  n:'', src:''},
  {tbl:'4D(1)(xxiii)', n:'', src:''},
  {tbl:'4D(1)(xxiv)',  n:'', src:''},
  {tbl:'4D(1)(xxv)',   n:'', src:''},
  {tbl:'4D(1)(xxvi)',  n:'', src:''},
];

const SUBS_4D2: SubRow[] = [
  {tbl:'4D(2)(i)',   n:'Ineligible ITC due to POS & 16(4) (B2B + DN)', src:'2B vs PR Recon'},
  {tbl:'4D(2)(ii)',  n:'Ineligible ITC due to POS (CN)', src:'2B vs PR Recon'},
  {tbl:'4D(2)(iii)', n:'Ineligible ITC (ISD)', src:'2B vs PR Recon'},
  {tbl:'4D(2)(iv)',  n:'Ineligible ITC due to POS & 16(4) (B2BA + DNA - CNA) (Amended - Original)', src:'2B vs PR Recon'},
  {tbl:'4D(2)(v)',   n:'Ineligible ITC due to POS & 16(4) (ISDA) (Amended - Original)', src:'2B vs PR Recon'},
  {tbl:'4D(2)(vi)',  n:'Others', src:'2B vs PR Recon'},
  {tbl:'4D(2)(vii)', n:'', src:''},
  {tbl:'4D(2)(viii)',n:'', src:''},
  {tbl:'4D(2)(ix)', n:'', src:''},
  {tbl:'4D(2)(x)',  n:'', src:''},
  {tbl:'4D(2)(xi)', n:'', src:''},
];

export default function GSTR3BPreparedModal({
  open,
  onOpenChange,
  gstin
}: GSTR3BPreparedModalProps) {
  const [activeTab, setActiveTab] = useState('3.1');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [cellValues, setCellValues] = useState<Record<string, string>>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  
  // State for Table 3.2 View Modal
  const [activeView32, setActiveView32] = useState<string | null>(null);
  
  const scrollToSection = (id: string) => {
    setActiveTab(id);
    const element = document.getElementById(`section-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSave = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cellValues));
    } catch {
      // storage full – silently ignore
    }
    setIsEditing(false);
  };

  const sections = ['3.1', '3.1.1', '3.2', '4', '5', '5.1'];

  let autoCellIndex = 0;

  const renderCell = (defaultVal: string | false, stableKey?: string) => {
    if (defaultVal === "" || defaultVal === false) return "";
    
    const key = stableKey !== undefined ? stableKey : `auto-${autoCellIndex++}`;
    const displayVal = cellValues[key] !== undefined ? cellValues[key] : defaultVal;

    if (isEditing) {
      return (
        <Input 
          type="number" 
          value={displayVal} 
          onChange={(e) => setCellValues(prev => ({ ...prev, [key]: e.target.value }))}
          className="h-7 w-[100px] text-right font-medium text-xs ml-auto"
        />
      );
    }
    return displayVal;
  };

  /* ---- Reusable renderer for an expandable parent row in Table 4 ---- */
  const renderExpandableRow = (
    id: string,
    tblLabel: string,
    name: string,
    src: string,
    noCgstSgst: boolean,
    subs: SubRow[]
  ) => {
    const isExp = expandedRows.has(id);
    return (
      <React.Fragment key={id}>
        <TableRow className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggleRow(id)}>
          <TableCell className="font-medium relative pl-8">
            <span className="absolute left-2 top-2.5 flex h-4 w-4 items-center justify-center rounded-sm border border-slate-300 text-slate-500 bg-white shadow-sm text-[10px]">
              {isExp ? '−' : '+'}
            </span>
            {tblLabel}
          </TableCell>
          <TableCell className="font-semibold text-slate-800">{name}</TableCell>
          <TableCell className="text-right">{renderCell("0", `${id}-igst`)}</TableCell>
          {noCgstSgst ? (
            <>
              <TableCell className="bg-slate-100"></TableCell>
              <TableCell className="bg-slate-100"></TableCell>
            </>
          ) : (
            <>
              <TableCell className="text-right">{renderCell("0", `${id}-cgst`)}</TableCell>
              <TableCell className="text-right">{renderCell("0", `${id}-sgst`)}</TableCell>
            </>
          )}
          <TableCell className="text-right">{renderCell("0", `${id}-cess`)}</TableCell>
          <TableCell className="text-right text-slate-600">{src}</TableCell>
        </TableRow>
        {isExp && subs.map((s, si) => (
          <TableRow key={`${id}-s${si}`} className="bg-white">
            <TableCell className="text-slate-500 pl-4">{s.tbl}</TableCell>
            <TableCell className="text-slate-600">{s.n}</TableCell>
            <TableCell className="text-right">{renderCell("0.00", `${id}-s${si}-igst`)}</TableCell>
            {noCgstSgst ? (
              <>
                <TableCell className="bg-slate-100"></TableCell>
                <TableCell className="bg-slate-100"></TableCell>
              </>
            ) : (
              <>
                <TableCell className="text-right">{renderCell("0.00", `${id}-s${si}-cgst`)}</TableCell>
                <TableCell className="text-right">{renderCell("0", `${id}-s${si}-sgst`)}</TableCell>
              </>
            )}
            <TableCell className="text-right">{renderCell("0.00", `${id}-s${si}-cess`)}</TableCell>
            <TableCell className="text-right text-slate-500">{s.src}</TableCell>
          </TableRow>
        ))}
      </React.Fragment>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[95vh] rounded-xl flex flex-col p-0 gap-0 overflow-hidden bg-slate-50">
          <DialogHeader className="px-6 py-4 border-b bg-white flex flex-row items-center justify-between shrink-0">
          <DialogTitle className="text-xl font-medium text-slate-800">Detailed GSTR-3B summary</DialogTitle>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 font-medium">
              Compare with GSTN
            </Button>
            <Button 
              className={`${isEditing ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium px-8`}
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            >
              {isEditing ? 'Save' : 'Edit'}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 ml-2" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar navigation */}
          <div className="w-[80px] bg-white border-r flex flex-col items-center py-4 shrink-0">
            <div className="text-[10px] font-semibold text-slate-500 mb-4 px-2 text-center leading-tight">GSTR-3B<br/>Tables</div>
            {sections.map(section => (
              <button 
                key={section}
                onClick={() => scrollToSection(section)}
                className={`w-full py-3 text-sm font-medium transition-colors border-l-2 ${activeTab === section ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}
              >
                {section}
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <ScrollArea className="flex-1 bg-white relative">
            <div className="p-8 max-w-6xl mx-auto pb-32">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-[22px] font-semibold text-slate-800">GSTR-3B for Delhi ({gstin || '07AADCB1626P1ZJ'})</h2>
                  <p className="text-slate-500 mt-1">Review line item details for the tables of GSTR-3B form</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-slate-800">Gross Liability: ₹ 0.00</p>
                </div>
              </div>

              {/* Section 3.1 */}
              <div id="section-3.1" className="mb-12">
                <div className="flex justify-between items-baseline mb-2">
                  <h3 className="text-[15px] font-semibold text-slate-800 relative pl-4 before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-blue-500 before:rounded-full">
                    3.1 Details of Outward supplies and inward supplies liable to reverse charge
                  </h3>
                  <button className="text-sm font-medium text-blue-600 hover:underline">
                    View Detailed Liability from IMS Outward Supplies
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-4 pl-4">Autofilled at {new Date().toLocaleDateString()}, {new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})} | Sources: Draft GSTR-3B &amp; Purchase Register (3.1(d))</p>
                
                <div className="border rounded-lg overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-50 text-slate-600 uppercase">
                      <TableRow>
                        <TableHead className="font-semibold w-[40%]">Nature of Supplies</TableHead>
                        <TableHead className="text-right font-semibold">Total Taxable Value (₹)</TableHead>
                        <TableHead className="text-right font-semibold">IGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold">CGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold">SGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold">CESS (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        {n: '(a) Outward Taxable supplies (other than zero rated, nil rated and exempted)'},
                        {n: '(b) Outward Taxable supplies (zero rated)'},
                        {n: '(c) Other Outward Taxable supplies (Nil rated, exempted)'},
                        {n: '(d) Inward supplies (liable to reverse charge)'},
                        {n: '(e) Non-GST Outward supplies'}
                      ].map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-slate-700">{row.n}</TableCell>
                          <TableCell className="text-right text-slate-600">{renderCell("0.00")}</TableCell>
                          <TableCell className="text-right text-slate-600">{renderCell(i !== 2 && i !== 4 ? "0.00" : "")}</TableCell>
                          <TableCell className="text-right text-slate-600">{renderCell(i !== 2 && i !== 4 && i !== 1 ? "0.00" : "")}</TableCell>
                          <TableCell className="text-right text-slate-600">{renderCell(i !== 2 && i !== 4 && i !== 1 ? "0.00" : "")}</TableCell>
                          <TableCell className="text-right text-slate-600">{renderCell(i !== 2 && i !== 4 ? "0.00" : "")}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 font-bold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Section 3.1.1 */}
              <div id="section-3.1.1" className="mb-12">
                <h3 className="text-[15px] font-semibold text-slate-800 mb-2 relative pl-4 before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-blue-500 before:rounded-full">
                  3.1.1 Details of supplies notified under sub-section (5) of section 9 of the Central Goods and Services Tax Act, 2017...
                </h3>
                <p className="text-xs text-slate-500 mb-4 pl-4">Autofilled at {new Date().toLocaleDateString()}, {new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})} | Sources: Sales Register</p>
                <div className="border rounded-lg overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-50 text-slate-600 uppercase">
                      <TableRow>
                        <TableHead className="font-semibold w-[40%]">Description</TableHead>
                        <TableHead className="text-right font-semibold">Total Taxable Value (₹)</TableHead>
                        <TableHead className="text-right font-semibold">IGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold">CGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold">SGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold">CESS (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-slate-700">(i) E-Com operation to pay tax u/s 9(5)</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-slate-700">(ii) Registered person under e-com operator to declare taxable u/s 9(5)</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right"></TableCell>
                        <TableCell className="text-right"></TableCell>
                        <TableCell className="text-right"></TableCell>
                        <TableCell className="text-right"></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Section 3.2 */}
              <div id="section-3.2" className="mb-12">
                <h3 className="text-[15px] font-semibold text-slate-800 mb-2 relative pl-4 before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-blue-500 before:rounded-full">
                  3.2 Of the supplies shown in 3.1(a) and 3.1.1(i), details of inter-state supplies made to unregistered persons, composition taxable persons and UIN holders
                </h3>
                <p className="text-xs text-slate-500 mb-4 pl-4">Autofilled at {new Date().toLocaleDateString()}, {new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})} | Sources: Draft GSTR-3B</p>
                <div className="border rounded-lg overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-50 text-slate-600 uppercase">
                      <TableRow>
                        <TableHead className="font-semibold w-[40%]">Nature of Supplies</TableHead>
                        <TableHead className="text-right font-semibold">Total Taxable Value (₹)</TableHead>
                        <TableHead className="text-right font-semibold">IGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {['Supplies made to Unregistered Persons', 'Supplies made to Composition Taxable Persons', 'Supplies made to UIN holders'].map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-slate-700">{r}</TableCell>
                          <TableCell className="text-right">{renderCell("0.00", `32-${i}-tx`)}</TableCell>
                          <TableCell className="text-right">{renderCell("0.00", `32-${i}-ig`)}</TableCell>
                          <TableCell className="text-right text-blue-600 font-medium cursor-pointer flex justify-end">
                            <span onClick={() => setActiveView32(r)} className="hover:underline">View</span>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 font-bold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* ============================================================ */}
              {/* Section 4 – Eligible ITC (exact ClearTax layout)             */}
              {/* ============================================================ */}
              <div id="section-4" className="mb-12">
                <h3 className="text-[15px] font-semibold text-slate-800 mb-2 relative pl-4 before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-blue-500 before:rounded-full">
                  4. Eligible ITC
                </h3>
                <p className="text-xs text-slate-500 mb-4 pl-4">Autofilled at {new Date().toLocaleDateString()}, {new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})} | Sources: Mixed Selection</p>
                <div className="border rounded-lg overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-50 text-slate-600 uppercase">
                      <TableRow>
                        <TableHead className="font-semibold w-[100px] min-w-[100px]">TABLE</TableHead>
                        <TableHead className="font-semibold w-[35%] min-w-[260px]">NATURE OF SUPPLIES</TableHead>
                        <TableHead className="text-right font-semibold min-w-[90px]">IGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold min-w-[90px]">CGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold min-w-[90px]">SGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold min-w-[90px]">CESS (₹)</TableHead>
                        <TableHead className="text-right font-semibold min-w-[120px]">SOURCE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* 4A Header */}
                      <TableRow className="bg-slate-50/70 font-bold">
                        <TableCell>4A</TableCell>
                        <TableCell colSpan={6}>(A) ITC Available (Whether in full or part)</TableCell>
                      </TableRow>

                      {renderExpandableRow('4a1', '4A(1)', 'Import of goods', '2B vs PR Recon', true, SUBS_4A1)}
                      {renderExpandableRow('4a2', '4A(2)', 'Import of services', 'Purchase Register', true, SUBS_4A2)}
                      {renderExpandableRow('4a3', '4A(3)', 'Inward supplies liable to reverse charge (other than 1 & 2 above)', 'Purchase Register', false, SUBS_4A3)}
                      {renderExpandableRow('4a4', '4A(4)', 'Inward supplies from ISD', 'GSTR-2B', false, SUBS_4A4)}
                      {renderExpandableRow('4a5', '4A(5)', 'All other ITC', '2B vs PR Recon', false, SUBS_4A5)}

                      {/* 4B Header */}
                      <TableRow className="bg-slate-50/70 font-bold">
                        <TableCell>4B</TableCell>
                        <TableCell colSpan={6}>(B) ITC Reversed</TableCell>
                      </TableRow>

                      {renderExpandableRow('4b1', '4B(1)', 'As per rules 38, 42 & 43 of CGST Rules and section 17(5)', 'Mixed Selection', false, SUBS_4B1)}
                      {renderExpandableRow('4b2', '4B(2)', 'Others', 'Mixed Selection', false, SUBS_4B2)}

                      {/* 4C – Net ITC */}
                      <TableRow className="bg-slate-50 font-bold border-t-2">
                        <TableCell>4C</TableCell>
                        <TableCell>(C) Net ITC Available (A)-(B)</TableCell>
                        <TableCell className="text-right">{renderCell("0.00", "4c-igst")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00", "4c-cgst")}</TableCell>
                        <TableCell className="text-right">{renderCell("0", "4c-sgst")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00", "4c-cess")}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>

                      {/* 4D Header */}
                      <TableRow className="bg-slate-50/70 font-bold">
                        <TableCell>4D</TableCell>
                        <TableCell colSpan={6}>(D) Other Details</TableCell>
                      </TableRow>

                      {renderExpandableRow('4d1', '4D(1)', 'D(1) ITC reclaimed which was reversed under Table 4(B)(2) in earlier tax period', '2B vs PR Recon', false, SUBS_4D1)}
                      {renderExpandableRow('4d2', '4D(2)', 'Ineligible ITC under section 16(4) & ITC restricted due to PoS rules', '2B vs PR Recon', false, SUBS_4D2)}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Section 5 */}
              <div id="section-5" className="mb-12">
                <h3 className="text-[15px] font-semibold text-slate-800 mb-2 relative pl-4 before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-blue-500 before:rounded-full">
                  5. Values of exempt, nil-rated and non-GST inward supplies
                </h3>
                <p className="text-xs text-slate-500 mb-4 pl-4">Autofilled at {new Date().toLocaleDateString()}, {new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})} | Sources: Purchase Register</p>
                <div className="border rounded-lg overflow-hidden">
                  <Table className="text-xs">
                     <TableHeader className="bg-slate-50 text-slate-600 uppercase">
                      <TableRow>
                        <TableHead className="font-semibold w-[40%]">Nature of Supplies</TableHead>
                        <TableHead className="text-right font-semibold">Inter-State Supplies (₹)</TableHead>
                        <TableHead className="text-right font-semibold">Intra-State Supplies (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>From a supplier under composition scheme, Exempt and Nil rated supply</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Non GST supply</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                      </TableRow>
                      <TableRow className="bg-slate-50 font-bold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Section 5.1 */}
              <div id="section-5.1" className="mb-8">
                <h3 className="text-[15px] font-semibold text-slate-800 mb-2 relative pl-4 before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-blue-500 before:rounded-full">
                  5.1 Interest and late fees
                </h3>
                <p className="text-xs text-slate-500 mb-4 pl-4">Autofilled at {new Date().toLocaleDateString()}, {new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})} | Sources: Autofill from GSTN &amp; GSTN (late fees)</p>
                <div className="border rounded-lg overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-50 text-slate-600 uppercase">
                      <TableRow>
                        <TableHead className="font-semibold w-[40%] text-left">Description</TableHead>
                        <TableHead className="text-right font-semibold">IGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold">CGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold">SGST (₹)</TableHead>
                        <TableHead className="text-right font-semibold">CESS (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-slate-700">Interest</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-slate-700">Late Fee</TableCell>
                        <TableCell className="text-right bg-slate-100"></TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right bg-slate-100"></TableCell>
                      </TableRow>
                      <TableRow className="bg-slate-50 font-bold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                        <TableCell className="text-right">{renderCell("0.00")}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>

    {/* Table 3.2 View Modal (Place of Supply Breakdown) */}
    <Dialog open={!!activeView32} onOpenChange={(val) => !val && setActiveView32(null)}>
      <DialogContent className="max-w-[800px] h-auto rounded-xl flex flex-col p-0 gap-0 overflow-hidden bg-slate-50">
        <DialogHeader className="px-6 py-4 border-b bg-white flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-xl font-medium text-slate-800">
              {activeView32}
            </DialogTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 ml-2" onClick={() => setActiveView32(null)}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="p-8 pb-12 bg-slate-50">
          <div className="flex justify-between items-baseline mb-4">
            <h3 className="text-[15px] font-semibold text-slate-800 relative pl-4 before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-blue-500 before:rounded-full">
              Place of Supply (POS) Breakdown
            </h3>
            <span className="text-xs text-slate-500">Autofilled from Sales Register</span>
          </div>

          <div className="border rounded-lg overflow-hidden bg-white">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50 text-slate-600 uppercase">
                <TableRow>
                  <TableHead className="font-semibold w-[50%]">Place of Supply (State/UT)</TableHead>
                  <TableHead className="text-right font-semibold">Total Taxable Value (₹)</TableHead>
                  <TableHead className="text-right font-semibold">IGST (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { state: '07-Delhi', val: '0.00', igst: '0.00' },
                  { state: '06-Haryana', val: '0.00', igst: '0.00' },
                  { state: '09-Uttar Pradesh', val: '0.00', igst: '0.00' },
                ].map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-slate-700">{row.state}</TableCell>
                    <TableCell className="text-right text-slate-600">{row.val}</TableCell>
                    <TableCell className="text-right text-slate-600">{row.igst}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 font-bold border-t-2">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right text-slate-800">0.00</TableCell>
                  <TableCell className="text-right text-slate-800">0.00</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-8 flex justify-end">
            <Button onClick={() => setActiveView32(null)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8">
              Close Breakdown
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
