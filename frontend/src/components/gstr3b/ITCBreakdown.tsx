/**
 * ITC Breakdown Table Component
 * Section 4 - Complete ITC Analysis (4A, 4B, 4C, 4D)
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ITCBreakdownProps {
  data: {
    // Section 4(A) - ITC Available
    available: {
      import_goods: { igst: number; cgst: number; sgst: number; cess: number };
      import_services: { igst: number; cgst: number; sgst: number; cess: number };
      inward_rcm: { igst: number; cgst: number; sgst: number; cess: number };
      isd_credit: { igst: number; cgst: number; sgst: number; cess: number };
      others: { igst: number; cgst: number; sgst: number; cess: number };
    };
    // Section 4(B) - ITC Reversed
    reversed: {
      rule_42: { igst: number; cgst: number; sgst: number; cess: number };
      rule_43: { igst: number; cgst: number; sgst: number; cess: number };
      others: { igst: number; cgst: number; sgst: number; cess: number };
    };
    // Section 4(C) - Net ITC
    net_itc: { igst: number; cgst: number; sgst: number; cess: number };
    // Section 4(D) - Ineligible ITC
    ineligible: {
      blocked_17_5: { igst: number; cgst: number; sgst: number; cess: number };
      others: { igst: number; cgst: number; sgst: number; cess: number };
    };
  };
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TaxRow({ label, taxes }: { label: string; taxes: { igst: number; cgst: number; sgst: number; cess: number } }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right">{formatCurrency(taxes.igst)}</TableCell>
      <TableCell className="text-right">{formatCurrency(taxes.cgst)}</TableCell>
      <TableCell className="text-right">{formatCurrency(taxes.sgst)}</TableCell>
      <TableCell className="text-right">{formatCurrency(taxes.cess)}</TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(taxes.igst + taxes.cgst + taxes.sgst + taxes.cess)}
      </TableCell>
    </TableRow>
  );
}

export function ITCBreakdown({ data }: ITCBreakdownProps) {
  // Calculate totals for available ITC
  const availableTotal = {
    igst: data.available.import_goods.igst + data.available.import_services.igst + 
           data.available.inward_rcm.igst + data.available.isd_credit.igst + data.available.others.igst,
    cgst: data.available.import_goods.cgst + data.available.import_services.cgst + 
           data.available.inward_rcm.cgst + data.available.isd_credit.cgst + data.available.others.cgst,
    sgst: data.available.import_goods.sgst + data.available.import_services.sgst + 
           data.available.inward_rcm.sgst + data.available.isd_credit.sgst + data.available.others.sgst,
    cess: data.available.import_goods.cess + data.available.import_services.cess + 
           data.available.inward_rcm.cess + data.available.isd_credit.cess + data.available.others.cess,
  };

  // Calculate totals for reversed ITC
  const reversedTotal = {
    igst: data.reversed.rule_42.igst + data.reversed.rule_43.igst + data.reversed.others.igst,
    cgst: data.reversed.rule_42.cgst + data.reversed.rule_43.cgst + data.reversed.others.cgst,
    sgst: data.reversed.rule_42.sgst + data.reversed.rule_43.sgst + data.reversed.others.sgst,
    cess: data.reversed.rule_42.cess + data.reversed.rule_43.cess + data.reversed.others.cess,
  };

  // Calculate totals for ineligible ITC
  const ineligibleTotal = {
    igst: data.ineligible.blocked_17_5.igst + data.ineligible.others.igst,
    cgst: data.ineligible.blocked_17_5.cgst + data.ineligible.others.cgst,
    sgst: data.ineligible.blocked_17_5.sgst + data.ineligible.others.sgst,
    cess: data.ineligible.blocked_17_5.cess + data.ineligible.others.cess,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">4. Details of Input Tax Credit</CardTitle>
        <CardDescription>Breakdown of ITC availed, reversed, net ITC, and ineligible ITC</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="available" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="available">4(A) Available</TabsTrigger>
            <TabsTrigger value="reversed">4(B) Reversed</TabsTrigger>
            <TabsTrigger value="net">4(C) Net ITC</TabsTrigger>
            <TabsTrigger value="ineligible">4(D) Ineligible</TabsTrigger>
          </TabsList>

          {/* Section 4(A) - ITC Available */}
          <TabsContent value="available">
            <div className="rounded-md border overflow-x-auto mt-4">
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
                  <TaxRow label="(i) Import of goods" taxes={data.available.import_goods} />
                  <TaxRow label="(ii) Import of services" taxes={data.available.import_services} />
                  <TaxRow label="(iii) Inward supplies liable to RCM" taxes={data.available.inward_rcm} />
                  <TaxRow label="(iv) ISD credit received" taxes={data.available.isd_credit} />
                  <TaxRow label="(v) Others" taxes={data.available.others} />
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell>Total ITC Available</TableCell>
                    <TableCell className="text-right">{formatCurrency(availableTotal.igst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(availableTotal.cgst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(availableTotal.sgst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(availableTotal.cess)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(availableTotal.igst + availableTotal.cgst + availableTotal.sgst + availableTotal.cess)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Section 4(B) - ITC Reversed */}
          <TabsContent value="reversed">
            <div className="rounded-md border overflow-x-auto mt-4">
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
                  <TaxRow label="(i) As per Rule 42 & 43" taxes={data.reversed.rule_42} />
                  <TaxRow label="(ii) Others" taxes={data.reversed.others} />
                  <TableRow className="bg-red-50 font-bold">
                    <TableCell>Total ITC Reversed</TableCell>
                    <TableCell className="text-right">{formatCurrency(reversedTotal.igst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(reversedTotal.cgst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(reversedTotal.sgst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(reversedTotal.cess)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(reversedTotal.igst + reversedTotal.cgst + reversedTotal.sgst + reversedTotal.cess)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Section 4(C) - Net ITC */}
          <TabsContent value="net">
            <div className="rounded-md border overflow-x-auto mt-4">
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
                  <TableRow className="bg-green-50 font-semibold">
                    <TableCell>Net ITC Available (4A - 4B)</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.net_itc.igst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.net_itc.cgst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.net_itc.sgst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.net_itc.cess)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.net_itc.igst + data.net_itc.cgst + data.net_itc.sgst + data.net_itc.cess)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Section 4(D) - Ineligible ITC */}
          <TabsContent value="ineligible">
            <div className="rounded-md border overflow-x-auto mt-4">
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
                  <TaxRow label="(i) Blocked under Section 17(5)" taxes={data.ineligible.blocked_17_5} />
                  <TaxRow label="(ii) Others" taxes={data.ineligible.others} />
                  <TableRow className="bg-red-50 font-bold">
                    <TableCell>Total Ineligible ITC</TableCell>
                    <TableCell className="text-right">{formatCurrency(ineligibleTotal.igst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(ineligibleTotal.cgst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(ineligibleTotal.sgst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(ineligibleTotal.cess)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(ineligibleTotal.igst + ineligibleTotal.cgst + ineligibleTotal.sgst + ineligibleTotal.cess)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
