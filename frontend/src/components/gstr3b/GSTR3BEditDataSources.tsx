import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Minus, ChevronDown, Settings2, X, ArrowRight, ClipboardList } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface GSTR3BEditDataSourcesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceedToNextStep: () => void;
  businessName?: string;
  gstin?: string;
}

const GSTR3BEditDataSources: React.FC<GSTR3BEditDataSourcesProps> = ({ 
  open, 
  onOpenChange,
  onProceedToNextStep,
  businessName = "Bauer Specialized Foundation Contractor India Private Limited AADCB1626P",
  gstin = "Delhi 07AADCB1626P1ZJ"
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // States for all dropdowns - exactly as provided in the text block
  const [selections, setSelections] = useState({
    // Table 3.1 A,B,C & E
    table31_r1: "Draft GSTR-3B (Recommended)",
    table31_r2: "Draft GSTR-3B (Recommended)",
    // Table 3.1 D INWARD SUPPLIES - RCM
    table31D_r1: "Purchase Register (PR) (Recommended)",
    table31D_r2: "Purchase Register (PR) (Recommended)",
    // Table 3.2 OUTWARD SUPPLIES
    table32_r1: "Draft GSTR-3B (Recommended)",
    table32_r2: "Draft GSTR-3B (Recommended)",
    // Table 3.1.1 OUTWARD SUPPLIES U/S 9(5)
    table311_r1: "Sales Register (SR) (Recommended)",
    table311_r2: "Sales Register (SR) (Recommended)",
    // Table 4A(1) IMPORT OF GOODS
    table4A1_r1: "2B vs PR Recon (Recommended)",
    table4A1_r2: "2B vs PR Recon (Recommended)",
    // Table 4A(2) IMPORT OF SERVICES
    table4A2_r1: "Purchase Register (PR) (Recommended)",
    table4A2_r2: "Purchase Register (PR) (Recommended)",
    // Table 4A(3) REGISTERED
    table4A3Reg_r1: "Purchase Register (PR) (Recommended)",
    table4A3Reg_r2: "Purchase Register (PR) (Recommended)",
    // Table 4A(3) UNREGISTERED
    table4A3Unreg_r1: "Purchase Register (PR) (Recommended)",
    table4A3Unreg_r2: "Purchase Register (PR) (Recommended)",
    // Table 4A(4) ISD
    table4A4_r1: "GSTR-2B (Recommended)",
    table4A4_r2: "GSTR-2B (Recommended)",
    // Table 4A(5) ALL OTHER ITC
    table4A5_r1: "GSTR-2B",
    table4A5_r2: "GSTR-2B",
    // Table 4B(1) & 4B(2)
    table4B_r1: "Mixed Selection",
    table4B_r2: "Mixed Selection",
    // Table 4D(1) & 4D(2)
    table4D_r1: "GSTR-2B",
    table4D_r2: "GSTR-2B",
    // Table 5 INWARD SUPPLIES
    table5_r1: "Purchase Register (PR) (Recommended)",
    table5_r2: "Purchase Register (PR) (Recommended)",
    // Table 5.1.1 INTEREST
    table511_r1: "Autofill from GSTN",
    table511_r2: "Autofill from GSTN",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] flex flex-col p-0 overflow-hidden border-none shadow-none rounded-none bg-background focus:outline-none" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        
        {/* Top Header Row */}
        <div className="flex-none bg-muted border-b border-border px-6 h-[48px] flex items-center justify-between z-[110]">
          <div className="text-[13px] font-bold text-foreground uppercase tracking-wide">
            Data Source to autofill tables
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-10 w-10 text-foreground hover:bg-accent flex items-center justify-center transition-colors rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col overflow-hidden px-12 py-8 bg-background overflow-y-hidden">
          
          {/* Header Action Section */}
          <div className="flex justify-between items-start mb-8 shrink-0">
            <div className="space-y-1.5">
              <h1 className="text-[28px] font-bold text-foreground leading-tight">
                Confirm data source to auto-fill tables in GSTR-3B
              </h1>
              <p className="text-[14px] text-muted-foreground font-medium">
                Government recommends <span className="font-bold text-foreground underline decoration-muted-foreground/30">G1</span> and <span className="font-bold text-foreground underline decoration-muted-foreground/30">2B</span> data to fill this table.
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-3 pt-1">
              <Button 
                className="bg-[#007AFF] hover:bg-[#0062CC] text-white font-bold h-[44px] px-8 gap-2 rounded-sm shadow-sm text-sm tracking-wide"
                onClick={() => {
                  onProceedToNextStep();
                  onOpenChange(false);
                }}
              >
                Prepare GSTR-3B <ArrowRight className="h-4 w-4" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-[36px] px-4 gap-2 border-[#D9D9D9] text-[#555555] font-bold bg-white hover:bg-slate-50 text-[12px] rounded-sm shadow-sm transition-all">
                    <ClipboardList className="h-4 w-4 text-[#007AFF]" />
                    ACTIONS <ChevronDown className="h-4 w-4 text-[#999999]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[240px] p-1.5 shadow-2xl border-slate-200 rounded-sm">
                  <DropdownMenuItem className="py-2.5 px-4 font-bold text-[#333333] cursor-pointer hover:bg-slate-50">
                    Reset
                  </DropdownMenuItem>
                  <DropdownMenuItem className="py-2.5 px-4 font-bold text-[#666666] cursor-pointer hover:bg-slate-50 border-t border-slate-100 mt-1">
                    Reset to recommended source
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Table Container - Width-wise scroll only */}
          <div className="flex-1 overflow-hidden border border-border rounded-sm bg-card shadow-sm flex flex-col">
            <div className="overflow-x-auto overflow-y-auto w-full flex-1 custom-scrollbar-thin">
              <Table className="border-collapse min-w-[5000px] table-fixed w-full">
                <TableHeader className="bg-muted/50 sticky top-0 z-50 border-b border-border">
                  <TableRow className="hover:bg-transparent border-none">
                    {/* Pillar 1: Checkbox & Business Header */}
                    <TableHead className="w-[50px] bg-muted/50 sticky left-0 z-[60] border-r border-border h-[120px] shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex justify-center pt-8">
                        <Checkbox className="rounded-none border-[#D9D9D9] h-4 w-4" />
                      </div>
                    </TableHead>

                    <TableHead className="w-[420px] border-r border-border font-black text-muted-foreground uppercase tracking-[0.2em] text-[10px] text-center sticky left-[50px] bg-muted/50 z-[60] h-[120px] shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                       <span className="block pt-8">BUSINESS</span>
                    </TableHead>

                    {/* Header: TABLE 3.1 A,B,C & E */}
                    <TableHead className="w-[340px] border-r border-border font-black text-muted-foreground uppercase tracking-[0.1em] text-[10px] text-center px-6 pt-8">
                      TABLE 3.1 A,B,C &amp; E
                    </TableHead>

                    {/* Group Header: TABLE 3.1 and 3.2 */}
                    <TableHead className="w-[720px] border-r border-border p-0" colSpan={2}>
                      <div className="flex flex-col h-full uppercase tracking-[0.1em] text-[10px] font-black">
                        <div className="border-b border-border px-4 py-3 text-muted-foreground text-center bg-muted mt-1">
                          TABLE 3.1 and 3.2
                        </div>
                        <div className="flex flex-1">
                          <div className="flex-1 border-r border-border px-4 py-6 text-muted-foreground text-center flex items-center justify-center leading-tight">
                            TABLE 3.1 D INWARD SUPPLIES - RCM
                          </div>
                          <div className="flex-1 px-4 py-6 text-muted-foreground text-center flex items-center justify-center">
                            TABLE 3.2 OUTWARD SUPPLIES
                          </div>
                        </div>
                      </div>
                    </TableHead>

                    {/* Header: TABLE 3.1.1 OUTWARD SUPPLIES U/S 9(5) */}
                    <TableHead className="w-[340px] border-r border-border font-black text-muted-foreground uppercase tracking-[0.1em] text-[10px] text-center px-6 pt-8">
                      TABLE 3.1.1 OUTWARD SUPPLIES U/S 9(5)
                    </TableHead>

                    {/* Group Header: TABLE 4 */}
                    <TableHead className="w-[2560px] border-r border-border p-0" colSpan={8}>
                      <div className="flex flex-col h-full uppercase tracking-[0.05em] text-[9.5px] font-black">
                        <div className="border-b border-border px-4 py-3 text-muted-foreground text-center bg-muted mt-1">
                          TABLE 4
                        </div>
                        <div className="flex flex-1">
                          {[
                            "TABLE 4A(1) IMPORT OF GOODS",
                            "TABLE 4A(2) IMPORT OF SERVICES",
                            "TABLE 4A(3) INWARD SUPPLIES LIABLE TO REVERSE CHARGE FROM REGISTERED PERSON",
                            "TABLE 4A(3) INWARD SUPPLIES LIABLE TO REVERSE CHARGE FROM UNREGISTERED PERSON",
                            "TABLE 4A(4) INWARD SUPPLIES FROM ISD",
                            "TABLE 4A(5) ALL OTHER ITC",
                            "TABLE 4B(1) & 4B(2) - ITC TO BE REVERSED",
                            "TABLE 4D(1) & 4D(2) - OTHER DETAILS"
                          ].map((label, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "w-[320px] px-8 py-4 text-muted-foreground text-center flex items-center justify-center leading-snug",
                                idx < 7 ? "border-r border-border" : ""
                              )}
                            >
                              {label}
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableHead>

                    {/* Header: TABLE 5 INWARD SUPPLIES (EXEMPT, NIL-RATED, NON-GST) */}
                    <TableHead className="w-[360px] border-r border-border font-black text-muted-foreground uppercase tracking-[0.05em] text-[9px] text-center px-6 pt-8 leading-tight">
                      TABLE 5 INWARD SUPPLIES (EXEMPT, NIL-RATED, NON-GST)
                    </TableHead>

                    {/* Header: TABLE 5.1.1 INTEREST */}
                    <TableHead className="w-[280px] font-black text-muted-foreground uppercase tracking-[0.1em] text-[10px] text-center px-6 pt-8">
                      TABLE 5.1.1 INTEREST
                    </TableHead>
                  </TableRow>
                </TableHeader>
                
                <TableBody>
                  {/* Business Name Row (Main) */}
                  <TableRow className="bg-blue-600/10 dark:bg-blue-500/10 hover:bg-blue-600/15 border-b border-border h-[72px]">
                    <TableCell className="border-r border-border sticky left-0 z-40 bg-blue-600/10 dark:bg-blue-500/10 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                      <div className="flex justify-center">
                        <Checkbox className="rounded-none border-blue-400" />
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-border sticky left-[50px] z-40 bg-blue-600/10 dark:bg-blue-500/10 shadow-[2px_0_4px_rgba(0,0,0,0.02)] py-4">
                      <div className="flex items-center gap-4 pl-4 pr-6">
                         <button
                           onClick={() => setIsExpanded(!isExpanded)}
                           className="flex items-center justify-center w-5 h-5 rounded-sm border-2 border-border bg-card text-blue-600 shadow-sm transition-transform active:scale-95"
                         >
                           {isExpanded ? <Minus className="h-4 w-4" strokeWidth={5} /> : <Plus className="h-4 w-4" strokeWidth={5} />}
                         </button>
                         <span className="text-[14px] font-black text-foreground uppercase tracking-tight">{businessName}</span>
                      </div>
                    </TableCell>
                    {/* Row Mapping - 1st row dropdown values */}
                    <Row1Dropdowns selections={selections} setSelections={setSelections} />
                  </TableRow>

                  {/* GSTIN Row (Child) */}
                  {isExpanded && (
                    <TableRow className="bg-card hover:bg-muted/30 border-b border-border h-[72px]">
                      <TableCell className="border-r border-border/50 sticky left-0 z-40 bg-card shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                        <div className="flex justify-center">
                          <Checkbox className="rounded-none border-border" />
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border/50 pl-20 sticky left-[50px] z-40 bg-card shadow-[2px_0_4px_rgba(0,0,0,0.02)] py-4">
                        <span className="text-[14px] font-bold text-muted-foreground">{gstin}</span>
                      </TableCell>
                      {/* Row Mapping - 2nd row dropdown values */}
                      <Row2Dropdowns selections={selections} setSelections={setSelections} />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-none px-12 py-6 border-t border-border bg-card flex items-center justify-end gap-6 z-[110]">
          <Button
            variant="ghost"
            onClick={() => {
              console.log("Discarding changes...");
            }}
            className="text-muted-foreground font-black hover:bg-muted px-8 h-12 tracking-[0.1em] text-[12px] uppercase transition-colors"
          >
            DISCARD CHANGES
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white font-black px-16 h-[48px] shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] uppercase tracking-[0.1em] text-[13px] rounded-sm"
            onClick={() => {
              console.log("Saving changes...");
            }}
          >
            SAVE &amp; UPDATE
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Dropdown Cell helper
 */
const DropdownCell = ({ val, options, onChange }: { 
  val: string, 
  options: string[], 
  onChange: (v: string) => void 
}) => {
  const isRecommended = val.includes("(Recommended)");
  
  return (
    <TableCell className="border-r border-slate-100 p-0 text-center bg-transparent">
      <div className="h-full w-full flex items-center justify-center min-h-[72px] px-4">
        <Select value={val} onValueChange={onChange}>
          <SelectTrigger className={cn(
            "w-full h-10 text-[13px] border-none shadow-none px-4 bg-transparent focus:ring-0 transition-all rounded-sm flex justify-between items-center group",
            isRecommended ? "text-[#007AFF] font-black bg-blue-50/50" : "text-slate-600 font-bold hover:bg-slate-50"
          )}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-[320px] p-2 shadow-2xl border-slate-200 z-[200] rounded-sm bg-white overflow-hidden">
            {options.map(opt => (
              <SelectItem 
                key={opt} 
                value={opt} 
                className={cn(
                  "text-[13px] px-4 py-3 cursor-pointer rounded-sm font-bold transition-all border-none mb-0.5",
                  opt.includes("(Recommended)") ? "text-[#007AFF] bg-blue-50/30" : "text-[#333333] hover:bg-slate-100"
                )}
              >
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </TableCell>
  );
};

const Row1Dropdowns = ({ selections, setSelections }: any) => (
  <>
    <DropdownCell val={selections.table31_r1} options={["Draft GSTR-3B (Recommended)", "Sales Register (SR)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table31_r1: v})} />
    <DropdownCell val={selections.table31D_r1} options={["GSTR-2B", "Purchase Register (PR) (Recommended)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table31D_r1: v})} />
    <DropdownCell val={selections.table32_r1} options={["Draft GSTR-3B (Recommended)"]} onChange={(v) => setSelections({...selections, table32_r1: v})} />
    <DropdownCell val={selections.table311_r1} options={["Sales Register (SR) (Recommended)", "Draft GSTR-3B", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table311_r1: v})} />
    <DropdownCell val={selections.table4A1_r1} options={["GSTR-2B", "Purchase Register (PR)", "2B vs PR Recon (Recommended)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4A1_r1: v})} />
    <DropdownCell val={selections.table4A2_r1} options={["Purchase Register (PR) (Recommended)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4A2_r1: v})} />
    <DropdownCell val={selections.table4A3Reg_r1} options={["GSTR-2B", "Purchase Register (PR) (Recommended)", "2B vs PR Recon", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4A3Reg_r1: v})} />
    <DropdownCell val={selections.table4A3Unreg_r1} options={["Purchase Register (PR) (Recommended)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4A3Unreg_r1: v})} />
    <DropdownCell val={selections.table4A4_r1} options={["GSTR-2B (Recommended)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4A4_r1: v})} />
    <DropdownCell val={selections.table4A5_r1} options={["GSTR-2B", "Purchase Register (PR)", "2B vs PR Recon", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4A5_r1: v})} />
    <DropdownCell val={selections.table4B_r1} options={["Mixed Selection", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4B_r1: v})} />
    <DropdownCell val={selections.table4D_r1} options={["GSTR-2B", "2B vs PR Recon", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4D_r1: v})} />
    <DropdownCell val={selections.table5_r1} options={["Purchase Register (PR) (Recommended)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table5_r1: v})} />
    <DropdownCell val={selections.table511_r1} options={["Autofill from GSTN", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table511_r1: v})} />
  </>
);

const Row2Dropdowns = ({ selections, setSelections }: any) => (
  <>
    <DropdownCell val={selections.table31_r2} options={["Draft GSTR-3B (Recommended)", "Sales Register (SR)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table31_r2: v})} />
    <DropdownCell val={selections.table31D_r2} options={["GSTR-2B", "Purchase Register (PR) (Recommended)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table31D_r2: v})} />
    <DropdownCell val={selections.table32_r2} options={["Draft GSTR-3B (Recommended)"]} onChange={(v) => setSelections({...selections, table32_r2: v})} />
    <DropdownCell val={selections.table311_r2} options={["Sales Register (SR) (Recommended)", "Draft GSTR-3B", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table311_r2: v})} />
    <DropdownCell val={selections.table4A1_r2} options={["GSTR-2B", "Purchase Register (PR)", "2B vs PR Recon (Recommended)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4A1_r2: v})} />
    <DropdownCell val={selections.table4A2_r2} options={["Purchase Register (PR) (Recommended)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4A2_r2: v})} />
    <DropdownCell val={selections.table4A3Reg_r2} options={["GSTR-2B", "Purchase Register (PR) (Recommended)", "2B vs PR Recon", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4A3Reg_r2: v})} />
    <DropdownCell val={selections.table4A3Unreg_r2} options={["Purchase Register (PR) (Recommended)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4A3Unreg_r2: v})} />
    <DropdownCell val={selections.table4A4_r2} options={["GSTR-2B (Recommended)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4A4_r2: v})} />
    <DropdownCell val={selections.table4A5_r2} options={["GSTR-2B", "Purchase Register (PR)", "2B vs PR Recon", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4A5_r2: v})} />
    <DropdownCell val={selections.table4B_r2} options={["Mixed Selection", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4B_r2: v})} />
    <DropdownCell val={selections.table4D_r2} options={["GSTR-2B", "2B vs PR Recon", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table4D_r2: v})} />
    <DropdownCell val={selections.table5_r2} options={["Purchase Register (PR) (Recommended)", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table5_r2: v})} />
    <DropdownCell val={selections.table511_r2} options={["Autofill from GSTN", "GSTR-3B Summary", "Manually fill"]} onChange={(v) => setSelections({...selections, table511_r2: v})} />
  </>
);

export default GSTR3BEditDataSources;
