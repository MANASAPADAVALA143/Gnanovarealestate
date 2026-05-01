import { useState } from 'react';
import Header from '../../components/Header';
import Hero from '../../components/Hero';
import Problem from '../../components/Problem';
import Solution from '../../components/Solution';
import HowItWorks from '../../components/HowItWorks';
import Results from '../../components/Results';
import Pricing from '../../components/Pricing';
import FAQ from '../../components/FAQ';
import FinalCTA from '../../components/FinalCTA';
import Footer from '../../components/Footer';
import DemoModal from '../../components/DemoModal';
import LeadCaptureForm from '@/components/LeadCaptureForm';
import ROICalculator from '../../components/marketing/ROICalculator';

export default function LandingPage() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const openDemoModal = () => setIsDemoModalOpen(true);
  const closeDemoModal = () => setIsDemoModalOpen(false);

  return (
    <div className="min-h-screen bg-white">
      <Header onBookDemo={openDemoModal} />
      <Hero onBookDemo={openDemoModal} />
      
      {/* AI Voice Agent Feature - Lead Capture Form */}
      <section id="ai-voice-feature" className="py-20 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full mb-4">
              <span className="text-xl">📞</span>
              <span className="text-sm font-semibold">Try Our AI Voice Agent</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Experience Instant AI Calls
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Fill out the form below and our AI assistant Sarah will call you 
              <span className="font-bold text-blue-600"> within 10 seconds</span> to discuss your property needs!
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-2xl mx-auto">
            <LeadCaptureForm />
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 flex items-center justify-center gap-3 flex-wrap">
              <span className="flex items-center gap-1">✅ 100% Free</span>
              <span>•</span>
              <span className="flex items-center gap-1">🔒 Your Data is Secure</span>
              <span>•</span>
              <span className="flex items-center gap-1">📞 Real AI Voice Call</span>
              <span>•</span>
              <span className="flex items-center gap-1">⏱️ 2-3 Minute Call</span>
            </p>
          </div>
        </div>
      </section>

      <Problem />
      <Solution />
      <HowItWorks />
      <ROICalculator onBookDemo={openDemoModal} />
      <Results />
      <Pricing onBookDemo={openDemoModal} />
      <FAQ />
      <FinalCTA onBookDemo={openDemoModal} />
      <Footer />
      <DemoModal isOpen={isDemoModalOpen} onClose={closeDemoModal} />
    </div>
  );
}

