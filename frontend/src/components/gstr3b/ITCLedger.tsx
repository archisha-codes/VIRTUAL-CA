/**
 * ITC Ledger Component
 * Phase 4 - ITC Credit Ledger Simulation
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ITCLedgerProps {
  data: {
    openingBalance: {
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
    };
    itcAvailed: {
      import_goods: { igst: number; cgst: number; sgst: number; cess: number };
      import_services: { igst: number; cgst: number; sgst: number; cess: number };
      inward_rcm: { igst: number; cgst: number; sgst: number; cess: number };
      others: { igst: number; cgst: number; sgst: number; cess: number };
    };
    itcReversed: {
      rule_42: { igst: number; cgst: number; sgst: number; cess: number };
      rule_43: { igst: number; cgst: number; sgst: number; cess: number };
      others: { igst: number; cgst: number; sgst: number; cess: number };
    };
    utilizedForIgst: { igst: number; cgst: number; sgst: number };
    utilizedForCgst: { cgst: number; igst: number };
    utilizedForSgst: { sgst: number; igst: number };
    closingBalance: {
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
    };
  };
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TaxRow({ label, igst, cgst, sgst, cess, highlight = false }: { 
  label: string; 
  igst: number; 
  cgst: number; 
  sgst: number; 
  cess: number;
  highlight?: boolean;
}) {
  const total = igst + cgst + sgst + cess;
  return (
    <TableRow className={highlight ? 'bg-primary/10 font-semibold' : ''}>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right">{formatCurrency(igst)}</TableCell>
      <TableCell className="text-right">{formatCurrency(cgst)}</TableCell>
      <TableCell className="text-right">{formatCurrency(sgst)}</TableCell>
      <TableCell className="text-right">{formatCurrency(cess)}</TableCell>
      <TableCell className={`text-right font-medium ${highlight ? '' : 'text-green-600'}`}>
        {formatCurrency(total)}
      </TableCell>
    </TableRow>
  );
}

export function ITCLedger({ data }: ITCLedgerProps) {
  // Calculate totals
  const totalAvailed = {
    igst: data.itcAvailed.import_goods.igst + data.itcAvailed.import_services.igst + 
           data.itcAvailed.inward_rcm.igst + data.itcAvailed.others.igst,
    cgst: data.itcAvailed.import_goods.cgst + data.itcAvailed.import_services.cgst + 
           data.itcAvailed.inward_rcm.cgst + data.itcAvailed.others.cgst,
    sgst: data.itcAvailed.import_goods.sgst + data.itcAvailed.import_services.sgst + 
           data.itcAvailed.inward_rcm.sgst + data.itcAvailed.others.sgst,
    cess: data.itcAvailed.import_goods.cess + data.itcAvailed.import_services.cess + 
           data.itcAvailed.inward_rcm.cess + data.itcAvailed.others.cess,
  };

  const totalReversed = {
    igst: data.itcReversed.rule_42.igst + data.itcReversed.rule_43.igst + data.itcReversed.others.igst,
    cgst: data.itcReversed.rule_42.cgst + data.itcReversed.rule_43.cgst + data.itcReversed.others.cgst,
    sgst: data.itcReversed.rule_42.sgst + data.itcReversed.rule_43.sgst + data.itcReversed.others.sgst,
    cess: data.itcReversed.rule_42.cess + data.itcReversed.rule_43.cess + data.itcReversed.others.cess,
  };

  const totalUtilized = {
    igst: data.utilizedForIgst.igst + data.utilizedForCgst.igst + data.utilizedForSgst.igst,
    cgst: data.utilizedForIgst.cgst + data.utilizedForCgst.cgst + 0,
    sgst: data.utilizedForIgst.sgst + 0 + data.utilizedForSgst.sgst,
    cess: 0,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">ITC Credit Ledger</CardTitle>
        <CardDescription>ITC Balance tracking - Opening, Availed, Reversed, Utilized, Closing</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40%]">Description</TableHead>
                <TableHead className="text-right">IGST</TableHead>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST</TableHead>
                <TableHead className="text-right">Cess</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Opening Balance */}
              <TableRow className="bg-blue-50">
                <TableCell className="font-medium">Opening Balance</TableCell>
                <TableCell className="text-right">{formatCurrency(data.openingBalance.igst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.openingBalance.cgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.openingBalance.sgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.openingBalance.cess)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(data.openingBalance.igst + data.openingBalance.cgst + data.openingBalance.sgst + data.openingBalance.cess)}
                </TableCell>
              </TableRow>

              {/* ITC Availed */}
              <TableRow className="bg-green-50">
                <TableCell colSpan={5} className="font-medium text-green-700">ITC Availed (+)</TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TaxRow label="  Import of goods" {...data.itcAvailed.import_goods} />
              <TaxRow label="  Import of services" {...data.itcAvailed.import_services} />
              <TaxRow label="  Inward RCM" {...data.itcAvailed.inward_rcm} />
              <TaxRow label="  Others" {...data.itcAvailed.others} />
              <TaxRow label="Total ITC Availed" {...totalAvailed} highlight />

              {/* ITC Reversed */}
              <TableRow className="bg-red-50">
                <TableCell colSpan={5} className="font-medium text-red-700">ITC Reversed (-)</TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TaxRow label="  Rule 42/43" {...data.itcReversed.rule_42} />
              <TaxRow label="  Others" {...data.itcReversed.others} />
              <TaxRow label="Total ITC Reversed" {...totalReversed} highlight />

              {/* ITC Utilized */}
              <TableRow className="bg-yellow-50">
                <TableCell colSpan={5} className="font-medium text-yellow-700">ITC Utilized for Tax Payment (-)</TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TaxRow label="  IGST Payment" igst={data.utilizedForIgst.igst} cgst={data.utilizedForIgst.cgst} sgst={data.utilizedForIgst.sgst} cess={0} />
              <TaxRow label="  CGST Payment" igst={data.utilizedForCgst.igst} cgst={data.utilizedForCgst.cgst} sgst={0} cess={0} />
              <TaxRow label="  SGST Payment" igst={data.utilizedForSgst.igst} cgst={0} sgst={data.utilizedForSgst.sgst} cess={0} />
              <TaxRow label="Total ITC Utilized" {...totalUtilized} highlight />

              {/* Closing Balance */}
              <TableRow className="bg-primary/10 font-bold text-lg">
                <TableCell>Closing Balance</TableCell>
                <TableCell className="text-right">{formatCurrency(data.closingBalance.igst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.closingBalance.cgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.closingBalance.sgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.closingBalance.cess)}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(data.closingBalance.igst + data.closingBalance.cgst + data.closingBalance.sgst + data.closingBalance.cess)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
