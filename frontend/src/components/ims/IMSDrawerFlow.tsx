import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface IMSDrawerFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (selectedGstin: string) => void;
  title: string;
}

export function IMSDrawerFlow({ open, onOpenChange, onContinue, title }: IMSDrawerFlowProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGstin, setSelectedGstin] = useState<string | null>(null);
  
  // Dummy data similar to screenshots
  const businesses = [
    {
       name: 'Bauer Engineering In...',
       pan: 'AAICB4900F',
       gstins: [
           { id: '1', state: 'Jammu And...', code: '01', gstin: '01AAICB4900F1Z0', type: 'Regular' },
           { id: '2', state: 'Punjab', code: '03', gstin: '03AAICB4900F1Z0', type: 'Regular' },
           { id: '3', state: 'Haryana', code: '06', gstin: '06AAICB4900F1Z0', type: 'Regular' },
           { id: '4', state: 'Haryana', code: '06', gstin: '06AAICB4900F1Z1', type: 'ISD' },
           { id: '5', state: 'Delhi', code: '07', gstin: '07AAICB4900F1Z0', type: 'Regular' },
           { id: '6', state: 'Uttar Prad...', code: '09', gstin: '09AAICB4900F1Z0', type: 'Regular' },
       ]
    }
  ];

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-y-0 right-0 z-50 w-[350px] bg-slate-50/50 backdrop-blur-md border-l border-slate-200 flex flex-col transform transition-transform duration-300">
        <div className="flex flex-col bg-white h-full shadow-sm ml-2 relative">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-6 w-6 ml-2">
                <X className="h-4 w-4" />
                </Button>
            </div>
            </div>
            
            <div className="flex-1 overflow-hidden p-4 flex flex-col gap-2 bg-[#f4f7fe]">
            <div className="flex flex-col gap-2 relative bg-white border border-slate-200 rounded shrink-0">
                <div className="p-2 border-b border-slate-100">
                    <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2 block">Business</label>
                    <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input 
                        placeholder="Search business..." 
                        className="pl-8 bg-white border-slate-200 h-9 text-sm"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto max-h-[calc(100vh-250px)] pb-2 flex flex-col gap-0.5">
                    {businesses.map((business, bIdx) => (
                    <div key={bIdx} className="last:border-b-0 w-full px-2">
                        <div className="flex items-center gap-2 py-2 px-1 hover:bg-slate-50 cursor-pointer">
                            <ChevronDown className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs text-slate-600 font-medium truncate">{business.name} <span className="text-slate-400 font-normal">{business.pan}</span></span>
                        </div>
                        <div className="flex flex-col pl-4 border-l-2 border-l-slate-100 ml-2.5 mt-1 space-y-1">
                            {business.gstins.map((g, gIdx) => (
                                <div 
                                key={gIdx} 
                                className={`flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition-colors ${selectedGstin === g.gstin ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                                onClick={() => setSelectedGstin(g.gstin)}
                                >
                                <div className="flex items-center gap-2">
                                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedGstin === g.gstin ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {g.id === '1' ? 'JK' : g.id === '2' ? 'PB' : g.id === '3' ? 'HR' : g.id === '4' ? 'HR' : g.id === '5' ? 'DL' : 'UP'}
                                    </div>
                                    <span className="text-xs text-slate-700 font-medium whitespace-nowrap">{g.state} <span className="text-slate-400 font-normal ml-0.5">{g.gstin.substring(0, 10)}...</span></span>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${g.type === 'Regular' ? 'bg-[#e6fbf3] text-[#00a67e] border-[#b0ebd8]' : 'bg-[#fef4e8] text-[#f29c38] border-[#fde3c9]'}`}>
                                    {g.type}
                                </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    ))}
                </div>
            </div>
            </div>
            
            <div className="p-4 border-t bg-white flex items-center justify-between shrink-0">
            <Button 
                className="w-full bg-[#8fb2ed] hover:bg-blue-500 rounded text-white font-medium h-10 transition-colors duration-200" 
                disabled={!selectedGstin}
                onClick={() => onContinue(selectedGstin!)}
            >
                Continue
            </Button>
            </div>
        </div>
      </div>
    </>
  );
}
