import React from 'react';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerFooter,
  DrawerClose
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Building2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface GSTR3BDataAvailabilityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceedWithData: () => void;
  onProceedToDownload: () => void;
}

export default function GSTR3BDataAvailabilityDrawer({
  open,
  onOpenChange,
  onProceedWithData,
  onProceedToDownload
}: GSTR3BDataAvailabilityDrawerProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="w-full sm:w-[450px] mx-auto sm:ml-auto sm:mr-0 h-[100dvh] right-0 left-auto mt-0 rounded-none border-l flex flex-col bg-background relative outline-none p-0">
        <DrawerHeader className="border-b border-border px-6 py-4 flex flex-row items-center justify-between bg-card shrink-0">
          <DrawerTitle className="text-lg font-medium text-foreground">Data Availability</DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 shrink-0 grow">
          <div className="bg-card border border-border text-sm rounded-lg p-4 mb-6 text-foreground flex gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p>Some of your data are already available for use. You can review and download remaining data as required.</p>
              <p className="text-xs text-muted-foreground mt-1">Last Downloaded: Not available</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">Selected Business Data</h3>
            <button className="text-xs text-blue-500 font-medium">What does this mean?</button>
          </div>
          
          <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="p-3 border-b border-border flex justify-between items-start">
              <div className="flex gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <h4 className="text-sm font-medium text-foreground">Bauer Specialized Foundation Contractor India Private Limited</h4>
                  <p className="text-[11px] text-muted-foreground">PAN: AADCB1626P</p>
                </div>
              </div>
              <button onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
            
            {isExpanded && (
              <div className="p-0">
                <div className="flex justify-between items-center px-4 py-3 border-b border-border">
                  <div>
                    <h5 className="text-sm font-medium text-foreground">07AADCB1626P1ZJ</h5>
                    <p className="text-[11px] text-muted-foreground">Delhi</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-orange-400/50 text-orange-500 bg-orange-500/10 font-normal">Partial</Badge>
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                
                <div className="px-4 py-2 space-y-2 pb-4">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-foreground">GSTR2B</span>
                      <span className="bg-muted text-muted-foreground rounded text-[9px] font-bold px-1.5 py-0.5 leading-none">M</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-foreground">GSTR3B_DRAFT</span>
                      <span className="bg-muted text-muted-foreground rounded text-[9px] font-bold px-1.5 py-0.5 leading-none">M</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-foreground">GSTR3B_G1</span>
                      <span className="bg-muted text-muted-foreground rounded text-[9px] font-bold px-1.5 py-0.5 leading-none">M</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <DrawerFooter className="border-t border-border p-4 flex flex-row justify-between gap-3 bg-card shrink-0 absolute bottom-0 w-full shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <Button
            variant="outline"
            onClick={onProceedWithData}
            className="flex-1 h-10 font-medium"
          >
            Proceed with this data
          </Button>
          <Button
            onClick={onProceedToDownload}
            className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 font-medium text-white"
          >
            Proceed to download data
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
