import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  gstin: string;
  returnPeriod: string;
}

export default function GSTR1CheckingErrorsPage({ gstin, returnPeriod }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [checkingValidation, setCheckingValidation] = useState(false);
  const [runningChecks, setRunningChecks] = useState(false);

  useEffect(() => {
    // Sequence of animations
    const seq1 = setTimeout(() => {
      setCheckingValidation(true);
    }, 1500);

    const seq2 = setTimeout(() => {
      setRunningChecks(true);
    }, 3000);

    const finish = setTimeout(() => {
      toast({
        title: 'Validation Successful',
        description: 'No errors found in your data.',
      });
      navigate('/gst/gstr1/prepare', {
        state: { gstin, returnPeriod, step: 'upload-to-gstn' }
      });
    }, 4500);

    return () => {
      clearTimeout(seq1);
      clearTimeout(seq2);
      clearTimeout(finish);
    };
  }, [gstin, returnPeriod, navigate, toast]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center font-sans">
      <div className="flex flex-col items-center">
        {/* Animated icon like Image 3 */}
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-[8px] border-blue-100 rounded-full"></div>
          <div className="absolute inset-0 border-[8px] border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center bg-blue-50 rounded-full">
            <FileText className="h-10 w-10 text-blue-500" />
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full">
               <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-500 flex items-center justify-center">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
               </div>
            </div>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-blue-600 bg-blue-50 px-4 py-1.5 rounded-md mb-8">
          Checking your data for errors
        </h2>

        <div className="space-y-4">
          <div className={`flex items-center gap-3 transition-opacity duration-500 ${checkingValidation ? 'opacity-100' : 'opacity-0'}`}>
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <span className="text-lg font-bold text-white bg-blue-600 px-3 py-1 rounded-md">Checking Validation in GSTR-1</span>
          </div>
          
          <div className={`flex items-center gap-3 transition-opacity duration-500 ${runningChecks ? 'opacity-100' : 'opacity-0'}`}>
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <span className="text-lg font-bold text-white bg-blue-600 px-3 py-1 rounded-md">Running Other checks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
