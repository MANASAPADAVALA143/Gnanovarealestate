import { Quote } from 'lucide-react';

export default function Results() {
  const testimonials = [
    {
      quote: 'Gnanova Real Estate helped me close 4 extra deals in 2 months. ROI was 600%.',
      name: 'Sarah Chen',
      location: 'Los Angeles, CA',
      result: '+$47,000 additional income',
      image: '👩🏻‍💼'
    },
    {
      quote: 'I was skeptical about AI, but now I can\'t imagine working without it. Response time went from 5 hours to 5 minutes.',
      name: 'Michael Rodriguez',
      location: 'Dubai, UAE',
      result: '3.2x increase in qualified leads',
      image: '👨🏽‍💼'
    },
    {
      quote: 'Finally, I can focus on what I do best - showing properties and closing deals. The AI handles everything else.',
      name: 'Emma Thompson',
      location: 'Sydney, Australia',
      result: '12 new clients in 60 days',
      image: '👩🏼‍💼'
    }
  ];

  return (
    <section id="results" className="py-20 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Real Results from Real Agents
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all transform hover:scale-105"
            >
              <Quote className="text-blue-500 mb-4" size={32} />
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>
              <div className="flex items-center space-x-4 border-t border-gray-200 pt-6">
                <div className="text-4xl">{testimonial.image}</div>
                <div>
                  <p className="font-bold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.location}</p>
                  <p className="text-sm text-green-600 font-semibold mt-1">{testimonial.result}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
