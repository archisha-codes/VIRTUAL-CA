import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  BarChart3,
  ArrowRight,
  Check,
  FileText,
  Settings,
  Users
} from 'lucide-react';

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ElementType;
  details: string[];
}

const steps: Step[] = [
  {
    number: 1,
    title: 'Upload Sales Data',
    description: 'Upload your Excel file containing sales invoices',
    icon: Upload,
    details: [
      'Download our template or use your existing ClearTax/Government format',
      'Drag and drop your Excel file',
      'Our system auto-detects the template type'
    ]
  },
  {
    number: 2,
    title: 'Map Columns',
    description: 'Map your Excel columns to GST fields',
    icon: FileSpreadsheet,
    details: [
      'Auto-mapping suggests column matches',
      'Verify required fields are mapped',
      'Save mapping for future uploads'
    ]
  },
  {
    number: 3,
    title: 'Validate Data',
    description: 'System validates your invoice data',
    icon: CheckCircle,
    details: [
      'GSTIN format validation',
      'Tax rate verification',
      'Duplicate invoice detection'
    ]
  },
  {
    number: 4,
    title: 'Generate Reports',
    description: 'Create GSTR-1, GSTR-3B, and reconciliation reports',
    icon: BarChart3,
    details: [
      'View auto-generated GSTR-1 tables',
      'Calculate tax liability for GSTR-3B',
      'Export JSON for GST portal filing'
    ]
  }
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function DocsPage() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  return (
    <DashboardLayout title="Docs & Guide">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Getting Started with Virtual CA
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Follow these simple steps to automate your GST compliance and start filing returns with confidence.
          </p>
        </div>

        {/* Steps */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {steps.map((step, index) => (
            <motion.div key={step.number} variants={itemVariants}>
              <Card 
                className={`cursor-pointer transition-all hover:shadow-lg animate-fade-in ${
                  activeStep === index 
                    ? 'ring-2 ring-olive-500 bg-olive-50' 
                    : 'hover:bg-slate-50'
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => setActiveStep(index)}
              >
                <CardContent className="p-4 text-center">
                  <motion.div 
                    className={`h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                      activeStep === index 
                        ? 'bg-olive-500 text-white' 
                        : 'bg-slate-100 text-slate-600'
                    }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <step.icon className="h-6 w-6" />
                  </motion.div>
                  <div className={`text-sm font-medium ${
                    activeStep === index ? 'text-olive-700' : 'text-slate-700'
                  }`}>
                    Step {step.number}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{step.title}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Active Step Details */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-olive-500 to-burgundy-600 flex items-center justify-center shrink-0">
                    {(() => {
                      const Icon = steps[activeStep].icon;
                      return <Icon className="h-8 w-8 text-white" />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      Step {steps[activeStep].number}: {steps[activeStep].title}
                    </h2>
                    <p className="text-slate-600 mb-4">
                      {steps[activeStep].description}
                    </p>
                    
                    <ul className="space-y-2">
                      {steps[activeStep].details.map((detail, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-slate-700">
                          <Check className="h-4 w-4 text-olive-500 shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>

                    <div className="flex gap-3 mt-6">
                      {activeStep < steps.length - 1 ? (
                        <Button 
                          onClick={() => setActiveStep(activeStep + 1)}
                          className="bg-gradient-to-r from-olive-600 to-burgundy-700"
                        >
                          Next Step
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => navigate('/upload')}
                          className="bg-gradient-to-r from-olive-600 to-burgundy-700"
                        >
                          Start Now
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                      {activeStep > 0 && (
                        <Button 
                          variant="outline"
                          onClick={() => setActiveStep(activeStep - 1)}
                        >
                          Previous
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Quick Links */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/upload')}>
              <CardContent className="p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-olive-600 mb-3" />
                <h3 className="font-semibold text-slate-900">Upload Data</h3>
                <p className="text-sm text-slate-500 mt-1">Upload your sales invoices</p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={itemVariants}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/filing')}>
              <CardContent className="p-6 text-center">
                <FileText className="h-8 w-8 mx-auto text-olive-600 mb-3" />
                <h3 className="font-semibold text-slate-900">File Returns</h3>
                <p className="text-sm text-slate-500 mt-1">Prepare and file GSTR-1, GSTR-3B</p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={itemVariants}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/settings')}>
              <CardContent className="p-6 text-center">
                <Settings className="h-8 w-8 mx-auto text-olive-600 mb-3" />
                <h3 className="font-semibold text-slate-900">Profile Settings</h3>
                <p className="text-sm text-slate-500 mt-1">Update your business details</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Help Section */}
        <Card className="bg-gradient-to-r from-olive-50 to-burgundy-50 border-olive-200">
          <CardContent className="p-6 text-center">
            <Users className="h-10 w-10 mx-auto text-olive-600 mb-3" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Need Help?</h3>
            <p className="text-slate-600 mb-4 max-w-lg mx-auto">
              Our team is here to help you with any questions about GST filing or using Virtual CA.
            </p>
            <Button variant="outline" className="border-olive-300 text-olive-700 hover:bg-olive-100">
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
