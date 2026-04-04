import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, Hash, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

// =====================================================
// SCHEMAS
// =====================================================

const organizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
});

const gstinSchema = z.object({
  gstin: z.string()
    .length(15, 'GSTIN must be exactly 15 characters')
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format'),
  legalName: z.string().optional(),
  stateCode: z.string()
    .length(2, 'State code must be 2 characters')
    .regex(/^[0-9]{2}$/, 'State code must be a 2-digit number'),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;
type GstinFormData = z.infer<typeof gstinSchema>;

// =====================================================
// STATE CODES
// =====================================================

const INDIAN_STATE_CODES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' },
  { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: ' Uttarakhand' },
];

// =====================================================
// ONBOARDING COMPONENT
// =====================================================

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    currentStep, 
    setOnboardingStep, 
    createOrganization, 
    createGstProfile,
    completeOnboarding,
    isDemoMode,
  } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [orgCreated, setOrgCreated] = useState(false);

  const orgForm = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: '' },
  });

  const gstinForm = useForm<GstinFormData>({
    resolver: zodResolver(gstinSchema),
    defaultValues: { 
      gstin: '', 
      legalName: '', 
      stateCode: '' 
    },
  });

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleCreateOrganization = async (data: OrganizationFormData) => {
    setIsLoading(true);
    const { error } = await createOrganization(data.name);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setOrgCreated(true);
    setOnboardingStep('add-gstin');
  };

  const handleAddGstin = async (data: GstinFormData) => {
    setIsLoading(true);
    const { error } = await createGstProfile({
      gstin: data.gstin.toUpperCase(),
      legal_name: data.legalName,
      state_code: data.stateCode,
    });
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    await completeOnboarding();
    toast({
      title: 'Welcome!',
      description: 'Your account has been set up successfully.',
    });
    navigate('/dashboard');
  };

  const handleSkip = () => {
    completeOnboarding();
    navigate('/dashboard');
  };

  // =====================================================
  // RENDER STEPS
  // =====================================================

  const renderWelcomeStep = () => (
    <div className="text-center space-y-4">
      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-olive-600 to-burgundy-700 mb-4">
        <Building2 className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">Welcome to Virtual CA!</h2>
      <p className="text-slate-600 max-w-md mx-auto">
        Let's set up your account to start managing your GST compliance. 
        It only takes a few minutes.
      </p>
      <div className="pt-4">
        <Button 
          onClick={() => setOnboardingStep('create-org')}
          className="bg-gradient-to-r from-olive-600 to-burgundy-700 hover:from-olive-700 hover:to-burgundy-800"
        >
          Get Started <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      {!isDemoMode && (
        <div className="pt-2">
          <Button variant="link" onClick={handleSkip}>
            Skip for now
          </Button>
        </div>
      )}
    </div>
  );

  const renderCreateOrgStep = () => (
    <Form {...orgForm}>
      <form onSubmit={orgForm.handleSubmit(handleCreateOrganization)} className="space-y-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-olive-100 mb-3">
            <Building2 className="h-6 w-6 text-olive-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Create Your Organization</h2>
          <p className="text-slate-600 text-sm">
            This will be your primary workspace for GST compliance
          </p>
        </div>

        <FormField
          control={orgForm.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name</FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., ABC Enterprises Pvt Ltd" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setOnboardingStep('welcome')}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-olive-600 to-burgundy-700 hover:from-olive-700 hover:to-burgundy-800"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </form>
    </Form>
  );

  const renderAddGstinStep = () => (
    <Form {...gstinForm}>
      <form onSubmit={gstinForm.handleSubmit(handleAddGstin)} className="space-y-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-olive-100 mb-3">
            <Hash className="h-6 w-6 text-olive-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Add Your GSTIN</h2>
          <p className="text-slate-600 text-sm">
            Register your Goods and Services Tax Identification Number
          </p>
        </div>

        <FormField
          control={gstinForm.control}
          name="gstin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GSTIN (15 characters)</FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., 29ABCDE1234F1Z5" 
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  maxLength={15}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={gstinForm.control}
          name="legalName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Legal Name (Optional)</FormLabel>
              <FormControl>
                <Input 
                  placeholder="As per GST registration" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={gstinForm.control}
          name="stateCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>State Code</FormLabel>
              <FormControl>
                <select 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value)}
                  value={field.value || ''}
                >
                  <option value="">Select state</option>
                  {INDIAN_STATE_CODES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.code} - {state.name}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setOnboardingStep('create-org')}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-olive-600 to-burgundy-700 hover:from-olive-700 hover:to-burgundy-800"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Complete Setup
          </Button>
        </div>

        <div className="text-center">
          <Button 
            type="button" 
            variant="link" 
            onClick={handleSkip}
            className="text-sm text-slate-500"
          >
            Skip adding GSTIN for now
          </Button>
        </div>
      </form>
    </Form>
  );

  const renderCompleteStep = () => (
    <div className="text-center space-y-4">
      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">You're All Set!</h2>
      <p className="text-slate-600 max-w-md mx-auto">
        Your account has been created successfully. You can now start using 
        Virtual CA to manage your GST compliance.
      </p>
      <div className="pt-4">
        <Button 
          onClick={() => navigate('/dashboard')}
          className="bg-gradient-to-r from-olive-600 to-burgundy-700 hover:from-olive-700 hover:to-burgundy-800"
        >
          Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // =====================================================
  // MAIN RENDER
  // =====================================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-olive-50 via-white to-burgundy-50 p-4">
      <div className="w-full max-w-md">
        {/* Progress Indicator */}
        {currentStep !== 'welcome' && currentStep !== 'complete' && (
          <div className="mb-6">
            <div className="flex items-center justify-center gap-2">
              <div className={`flex items-center justify-center h-8 w-8 rounded-full ${orgCreated || currentStep === 'add-gstin' ? 'bg-olive-600 text-white' : 'bg-olive-100 text-olive-600'}`}>
                {orgCreated || currentStep === 'add-gstin' ? <CheckCircle2 className="h-4 w-4" /> : '1'}
              </div>
              <div className="w-8 h-0.5 bg-olive-200" />
              <div className={`flex items-center justify-center h-8 w-8 rounded-full ${currentStep === 'add-gstin' ? 'bg-olive-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                2
              </div>
            </div>
            <div className="flex justify-center gap-8 mt-2 text-xs text-slate-500">
              <span>Organization</span>
              <span>GSTIN</span>
            </div>
          </div>
        )}

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-md">
          <CardHeader className="pb-4">
            <CardTitle className="sr-only">Onboarding</CardTitle>
            <CardDescription className="sr-only">
              Complete your account setup
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 'welcome' && renderWelcomeStep()}
            {currentStep === 'create-org' && renderCreateOrgStep()}
            {currentStep === 'add-gstin' && renderAddGstinStep()}
            {currentStep === 'complete' && renderCompleteStep()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
