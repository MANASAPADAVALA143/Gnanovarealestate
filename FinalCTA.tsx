import { ArrowRight, Calendar } from 'lucide-react';

interface FinalCTAProps {
  onBookDemo: () => void;
}

export default function FinalCTA({ onBookDemo }: FinalCTAProps) {
  return (
    <section className="py-20 bg-gradient-to-br from-gray-900 to-blue-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl"></div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="mb-8">
          <Calendar className="mx-auto mb-6 text-blue-400" size={64} />
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to 3X Your Closings?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join 200+ agents already using AI to dominate their market
          </p>
        </div>

        <button
          onClick={onBookDemo}
          className="group px-12 py-5 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xl font-bold rounded-xl hover:shadow-2xl transition-all transform hover:scale-105 inline-flex items-center space-x-3"
        >
          <span>Book Your Free Demo</span>
          <ArrowRight className="group-hover:translate-x-1 transition" size={24} />
        </button>

        <p className="mt-6 text-sm text-gray-400">
          No credit card required • 30-minute demo • See results in 48 hours
        </p>
      </div>
    </section>
  );
}
