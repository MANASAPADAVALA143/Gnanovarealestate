import { Bot, Home, TrendingUp, CheckCircle, Sparkles } from 'lucide-react';

export default function Solution() {
  const products = [
    {
      icon: <Bot size={48} />,
      name: 'LeadScreenerAI',
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50',
      features: [
        'Qualifies every lead in 5 minutes',
        'Sends personalized property matches via SMS',
        'Books appointments automatically'
      ],
      price: '$1,800',
      badge: 'Most Popular'
    },
    {
      icon: <Home size={48} />,
      name: 'PropertyMatchBot',
      gradient: 'from-purple-500 to-pink-500',
      bgGradient: 'from-purple-50 to-pink-50',
      features: [
        'Matches new listings to buyer database',
        'Instant SMS alerts to qualified buyers',
        'AI-generated property descriptions'
      ],
      price: '$1,200',
      badge: 'Best Value'
    },
    {
      icon: <TrendingUp size={48} />,
      name: 'DealPipelineAI',
      gradient: 'from-emerald-500 to-teal-500',
      bgGradient: 'from-emerald-50 to-teal-50',
      features: [
        'Tracks deals from inquiry to closing',
        'Auto-sends stage-specific content',
        'Monthly performance reports'
      ],
      price: '$1,500',
      badge: 'Enterprise Ready'
    }
  ];

  return (
    <section id="solutions" className="py-20 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-pink-50/50"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full mb-4">
            <Sparkles size={16} />
            <span className="text-sm font-semibold">AI-Powered Solutions</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Your Complete AI Real Estate Team
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Three powerful AI assistants working 24/7 to transform your business
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {products.map((product, index) => (
            <div
              key={index}
              className="group relative bg-white rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${product.bgGradient} opacity-50`}></div>

              <div className="relative p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${product.gradient} text-white shadow-lg`}>
                    {product.icon}
                  </div>
                  <div className="bg-white px-3 py-1 rounded-full text-xs font-bold text-gray-700 shadow-md">
                    {product.badge}
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {product.name}
                </h3>

                <ul className="space-y-3 mb-8">
                  {product.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start space-x-3">
                      <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={18} />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-baseline mb-4">
                    <span className="text-4xl font-bold text-gray-900">{product.price}</span>
                    <span className="text-gray-500 ml-2">/month</span>
                  </div>
                  <button className={`w-full px-6 py-3 bg-gradient-to-r ${product.gradient} text-white font-bold rounded-xl hover:shadow-lg transition transform hover:scale-105`}>
                    Get Started
                  </button>
                </div>
              </div>

              <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl transform translate-x-16 -translate-y-16"></div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">Need all three? Get our complete package and save 20%</p>
          <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-2xl transition transform hover:scale-105">
            View Complete Package
          </button>
        </div>
      </div>
    </section>
  );
}
