import { Link2, Settings, Rocket, TrendingUp } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
    {
      icon: Link2,
      title: 'Connect Your CRM',
      time: '15 min',
      description: 'Simple integration with your existing tools'
    },
    {
      icon: Settings,
      title: 'Customize AI Responses',
      time: '30 min',
      description: 'Personalize messaging to match your brand'
    },
    {
      icon: Rocket,
      title: 'Go Live',
      time: '24 hours',
      description: 'We test and optimize everything'
    },
    {
      icon: TrendingUp,
      title: 'Watch Deals Close',
      time: 'ongoing',
      description: 'AI works 24/7 while you focus on closings'
    }
  ];

  return (
    <section className="py-32 bg-white relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-100/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-24">
          <h2 className="text-5xl md:text-6xl font-display font-bold text-gray-900 mb-4 tracking-tight">
            Set Up in 48 Hours
          </h2>
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5">
            <div className="h-full w-full flex">
              <div className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: '25%' }}></div>
              <div className="flex-1 bg-gradient-to-r from-cyan-500 to-teal-500" style={{ width: '25%' }}></div>
              <div className="flex-1 bg-gradient-to-r from-teal-500 to-blue-500" style={{ width: '25%' }}></div>
              <div className="flex-1 bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: '25%' }}></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
            {steps.map((step, index) => {
              const IconComponent = step.icon;
              const isLast = index === steps.length - 1;

              const gradients = [
                'from-blue-600 to-cyan-500',
                'from-cyan-500 to-teal-500',
                'from-teal-500 to-blue-500',
                'from-blue-500 to-emerald-500'
              ];

              const bgColors = [
                'bg-blue-100',
                'bg-cyan-100',
                'bg-teal-100',
                'bg-emerald-100'
              ];

              const textColors = [
                'text-blue-700',
                'text-cyan-700',
                'text-teal-700',
                'text-emerald-700'
              ];

              return (
                <div key={index} className="relative group">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-8">
                      <div className={`w-28 h-28 bg-gradient-to-br ${gradients[index]} rounded-full flex items-center justify-center shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:shadow-2xl`}>
                        <IconComponent size={48} className="text-white" strokeWidth={2} />
                      </div>

                      <div className="absolute -top-3 -right-3 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-gray-100">
                        <span className="text-xl font-bold text-gray-900">{index + 1}</span>
                      </div>

                      <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-16 bg-gradient-to-br ${gradients[index]} rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity`}></div>
                    </div>

                    <h3 className="text-2xl font-display font-bold text-gray-900 mb-4 min-h-[64px] flex items-center justify-center">
                      {step.title}
                    </h3>

                    <div className={`inline-block px-5 py-2 rounded-full mb-4 ${bgColors[index]} ${textColors[index]} font-bold text-sm tracking-wide`}>
                      {step.time}
                    </div>

                    <p className="text-gray-600 leading-relaxed text-base max-w-xs mx-auto">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-24 text-center">
          <p className="text-xl text-gray-600 font-medium">
            Get started today and close more deals tomorrow
          </p>
        </div>
      </div>
    </section>
  );
}
