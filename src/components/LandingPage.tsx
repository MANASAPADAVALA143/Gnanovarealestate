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

export default function LandingPage() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const openDemoModal = () => setIsDemoModalOpen(true);
  const closeDemoModal = () => setIsDemoModalOpen(false);

  return (
    <div className="min-h-screen bg-white">
      <Header onBookDemo={openDemoModal} />
      <Hero onBookDemo={openDemoModal} />
      <Problem />
      <Solution />
      <HowItWorks />
      <Results />
      <Pricing onBookDemo={openDemoModal} />
      <FAQ />
      <FinalCTA onBookDemo={openDemoModal} />
      <Footer />
      <DemoModal isOpen={isDemoModalOpen} onClose={closeDemoModal} />
    </div>
  );
}

