import { Check, Star } from 'lucide-react';

interface PricingProps {
  onBookDemo: () => void;
}

export default function Pricing({ onBookDemo }: PricingProps) {
  const plans = [
    {
      name: 'Starter',
      price: '$1,800',
      period: '/month',
      features: [
        'LeadScreenerAI',
        'Up to 100 leads/month',
        'SMS + Email automation',
        'Basic analytics'
      ],
      popular: false
    },
    {
      name: 'Professional',
      price: '$3,500',
      period: '/month',
      features: [
        'All 3 products',
        'Unlimited leads',
        'WhatsApp integration',
        'Priority support',
        'Monthly strategy call'
      ],
      popular: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'pricing',
      features: [
        '5-20 agents',
        'Custom integrations',
        'Dedicated account manager',
        'White-label option'
      ],
      popular: false
    }
  ];

  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`rounded-2xl p-8 ${
                plan.popular
                  ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-2xl scale-105 border-4 border-yellow-400'
                  : 'bg-white border-2 border-gray-200 shadow-lg'
              } hover:shadow-2xl transition-all transform hover:scale-105`}
            >
              {plan.popular && (
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <Star className="fill-yellow-400 text-yellow-400" size={20} />
                  <span className="text-sm font-bold text-yellow-400">MOST POPULAR</span>
                  <Star className="fill-yellow-400 text-yellow-400" size={20} />
                </div>
              )}
              <h3 className={`text-2xl font-bold mb-2 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                {plan.name}
              </h3>
              <div className="mb-6">
                <span className={`text-5xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                  {plan.price}
                </span>
                <span className={`text-lg ${plan.popular ? 'text-white/80' : 'text-gray-600'}`}>
                  {plan.period}
                </span>
              </div>
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start space-x-3">
                    <Check
                      className={`flex-shrink-0 mt-0.5 ${plan.popular ? 'text-yellow-400' : 'text-green-500'}`}
                      size={20}
                    />
                    <span className={plan.popular ? 'text-white' : 'text-gray-700'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                onClick={onBookDemo}
                className={`w-full px-6 py-3 rounded-xl font-semibold transition transform hover:scale-105 ${
                  plan.popular
                    ? 'bg-white text-blue-600 hover:shadow-lg'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg'
                }`}
              >
                {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
