import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FileText, 
  Upload, 
  BarChart3, 
  Shield, 
  CheckCircle, 
  Zap, 
  FileSpreadsheet,
  Users,
  ArrowRight,
  Star,
  X
} from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'GST Return Filing',
    description: 'File your GSTR-1, GSTR-3B, and GSTR-2B returns with automated calculations and validation.'
  },
  {
    icon: Zap,
    title: 'GSTR-1 Automation',
    description: 'Automatically generate GSTR-1 tables from your sales data with B2B, B2CL, B2CS, and more.'
  },
  {
    icon: BarChart3,
    title: 'GSTR-3B Preparation',
    description: 'Auto-calculate tax liability, ITC claims, and generate summary for GSTR-3B filing.'
  },
  {
    icon: Upload,
    title: 'Sales & Purchase Data Upload',
    description: 'Upload Excel files with your invoices. Supports both ClearTax and Government templates.'
  },
  {
    icon: FileSpreadsheet,
    title: 'Excel Template Integration',
    description: 'Works with ClearTax and GST portal Excel templates. Drag and drop your files.'
  },
  {
    icon: Shield,
    title: 'GST Compliance Reports',
    description: 'Generate detailed compliance reports with error detection and tax calculations.'
  }
];

interface Client {
  name: string;
  testimonial: {
    quote: string;
    author: string;
    rating: number;
  };
}

const clients: Client[] = [
  {
    name: 'ABC Pvt Ltd',
    testimonial: {
      quote: 'Virtual CA reduced our GST filing time by 80%. The automated validation catches errors before submission.',
      author: 'Rajesh Kumar',
      rating: 5
    }
  },
  {
    name: 'XYZ Traders',
    testimonial: {
      quote: 'Excellent tool for GST compliance. The Excel template integration works seamlessly.',
      author: 'Priya Sharma',
      rating: 5
    }
  },
  {
    name: 'FinTech Corp',
    testimonial: {
      quote: 'Finally, a solution that makes GST filing hassle-free. Highly recommended!',
      author: 'Amit Patel',
      rating: 5
    }
  },
  {
    name: 'Retail Group',
    testimonial: {
      quote: 'The automated reconciliation feature saves us hours every month.',
      author: 'Sneha Reddy',
      rating: 5
    }
  },
  {
    name: 'Tech Solutions',
    testimonial: {
      quote: 'Best GST compliance tool for businesses in India. Highly recommended!',
      author: 'Vikram Singh',
      rating: 5
    }
  },
  {
    name: 'Global Imports',
    testimonial: {
      quote: 'Customer support is excellent. They helped us set up in no time.',
      author: 'Meera Patel',
      rating: 5
    }
  },
  {
    name: 'Smart Enterprises',
    testimonial: {
      quote: 'The JSON export feature makes filing so much easier.',
      author: 'Arun Kumar',
      rating: 5
    }
  },
  {
    name: 'Prime Services',
    testimonial: {
      quote: 'Value for money. Highly recommended for small businesses.',
      author: 'Kavita Singh',
      rating: 5
    }
  }
];

const whyChooseUs = [
  {
    title: 'Fast GST Return Preparation',
    description: 'Process thousands of invoices in seconds with our optimized engine.'
  },
  {
    title: 'Error Detection in Invoices',
    description: 'Automated validation catches GSTIN errors, tax mismatches, and duplicate invoices.'
  },
  {
    title: 'Automatic Tax Calculations',
    description: 'CGST, SGST, and IGST are calculated automatically based on invoice data.'
  },
  {
    title: 'Compatible with Government Utilities',
    description: 'Export data in JSON format compatible with GST portal for easy filing.'
  },
  {
    title: 'Works with ClearTax Templates',
    description: 'Seamlessly import data from ClearTax Excel templates without reformatting.'
  }
];

const announcements = [
  {
    id: 1,
    title: 'Facility for Withdrawal from Rule 14A',
    date: 'March 5, 2026',
    link: 'https://www.gst.gov.in/news/withdrawal-facility-rule-14a'
  },
  {
    id: 2,
    title: 'Update on Advisory on Interest Collection in GSTR-3B',
    date: 'March 3, 2026',
    link: 'https://www.gst.gov.in/news/gstr3b-interest-advisory'
  },
  {
    id: 3,
    title: 'GST Revenue Collection Updates',
    date: 'February 28, 2026',
    link: 'https://www.gst.gov.in/news/revenue-collection-february-2026'
  },
  {
    id: 4,
    title: 'New Features in GSTR-1 Filing',
    date: 'February 25, 2026',
    link: 'https://www.gst.gov.in/news/gstr1-new-features'
  },
  {
    id: 5,
    title: 'ITC Reconciliation Improvements',
    date: 'February 22, 2026',
    link: 'https://www.gst.gov.in/news/itc-reconciliation-updates'
  },
  {
    id: 6,
    title: 'GSTR-2B Auto-reconciliation',
    date: 'February 20, 2026',
    link: 'https://www.gst.gov.in/news/gstr2b-auto-reconciliation'
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-olive-600 to-burgundy-700 flex items-center justify-center">
                <span className="text-lg font-bold text-white">V</span>
              </div>
              <span className="text-xl font-bold text-slate-900">Virtual CA</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">Features</a>
              <a href="#clients" className="text-slate-600 hover:text-slate-900 transition-colors">Clients</a>
              <a href="#why-choose-us" className="text-slate-600 hover:text-slate-900 transition-colors">Why Choose Us</a>
              <a href="/docs" className="text-slate-600 hover:text-slate-900 transition-colors">Docs & Guide</a>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/auth')} className="text-slate-600 hover:text-slate-900">
                Sign In
              </Button>
              <Button onClick={() => navigate('/auth')} className="bg-gradient-to-r from-olive-600 to-burgundy-700">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-olive-50 via-white to-burgundy-50 opacity-70" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-olive-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-burgundy-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Automate your GST compliance and return filing
            </h1>
            <p className="text-xl text-slate-600 mb-10 leading-relaxed">
              Virtual CA helps businesses upload invoices, validate GST data, and file returns seamlessly. 
              Save time, reduce errors, and stay compliant.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')}
                className="text-lg px-8 py-6 bg-gradient-to-r from-olive-600 to-burgundy-700 hover:from-olive-700 hover:to-burgundy-800 shadow-lg hover:shadow-xl transition-all"
              >
                Start Filing
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/auth')}
                className="text-lg px-8 py-6 border-2 hover:bg-slate-50 transition-all"
              >
                <Upload className="mr-2 h-5 w-5" />
                Upload Documents
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Powerful Features for GST Compliance
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Everything you need to manage your GST filings efficiently
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white"
              >
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-olive-100 to-burgundy-100 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-olive-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Clients Section with Feedback Modal */}
      <section id="clients" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Trusted by Businesses
            </h2>
            <p className="text-lg text-slate-600">
              Companies across India rely on Virtual CA for GST compliance
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {clients.map((client, index) => (
              <div 
                key={index}
                onClick={() => setSelectedClient(client)}
                className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all cursor-pointer hover:scale-105 hover:border-olive-500 border border-transparent"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-olive-600 to-burgundy-700 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-medium text-slate-700">{client.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feedback Modal */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-olive-600" />
              {selectedClient?.name}
            </DialogTitle>
            <button
              onClick={() => setSelectedClient(null)}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-1">
              {[...Array(selectedClient?.testimonial.rating || 5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-slate-700 italic">"{selectedClient?.testimonial.quote}"</p>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-olive-600 to-burgundy-700 flex items-center justify-center">
                <span className="text-white font-medium">{selectedClient?.testimonial.author.charAt(0)}</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">{selectedClient?.testimonial.author}</p>
                <p className="text-sm text-slate-500">{selectedClient?.name}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Why Choose Us Section */}
      <section id="why-choose-us" className="py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Why Choose Virtual CA?
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              The most reliable GST compliance solution for Indian businesses
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyChooseUs.map((item, index) => (
              <div 
                key={index}
                className="flex items-start gap-4 p-6 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all"
              >
                <div className="h-10 w-10 rounded-full bg-olive-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5 text-olive-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {item.title}
                  </h3>
                  <p className="text-slate-300 text-sm">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest GST Updates - Vertical News Slider */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Latest GST Updates
            </h2>
            <p className="text-lg text-slate-600">
              Stay informed with the latest GST announcements
            </p>
          </div>
          
          <div className="max-w-3xl mx-auto">
            <div className="overflow-hidden h-64 rounded-lg border border-slate-200 bg-slate-50">
              <div className="vertical-news-slider">
                {/* Duplicate the announcements for seamless scrolling */}
                {[...announcements, ...announcements].map((announcement, index) => (
                  <a
                    key={`${announcement.id}-${index}`}
                    href={announcement.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block py-3 px-4 hover:bg-olive-50 border-b border-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800 hover:text-olive-700">
                        {announcement.title}
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <span className="text-sm text-slate-500">{announcement.date}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-olive-600 to-burgundy-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Simplify Your GST Filing?
          </h2>
          <p className="text-xl text-olive-100 mb-10">
            Join thousands of businesses already using Virtual CA
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/auth')}
            className="text-lg px-10 py-7 bg-white text-olive-700 hover:bg-olive-50 shadow-xl"
          >
            Start Your Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-olive-600 to-burgundy-700 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">V</span>
                </div>
                <span className="text-xl font-bold text-white">Virtual CA</span>
              </div>
              <p className="text-sm text-slate-400">
                Automating GST compliance for businesses across India.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="/pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="/docs" className="hover:text-white transition-colors">Documentation</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="/contact" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="/support" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">GST Disclaimer</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 mt-12 pt-8 text-center text-sm text-slate-500">
            <p>&copy; 2026 Virtual CA. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
