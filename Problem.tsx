import { TrendingDown, Clock, AlertTriangle } from 'lucide-react';

export default function Problem() {
  const problems = [
    {
      icon: TrendingDown,
      title: '50% of leads never get contacted',
      description: 'Manual follow-up means opportunities slip through the cracks'
    },
    {
      icon: Clock,
      title: 'Response time = 5 hours average',
      description: 'By the time you call back, leads have moved on'
    },
    {
      icon: AlertTriangle,
      title: '80% of deals go to faster agents',
      description: 'Speed wins in real estate. Every minute counts.'
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-5xl md:text-6xl font-display font-bold text-gray-900 mb-6 tracking-tight">
            The Real Cost of Slow Follow-Up
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {problems.map((problem, index) => {
            const IconComponent = problem.icon;
            return (
              <div
                key={index}
                className="group relative bg-gradient-to-br from-red-50/80 to-pink-50/80 backdrop-blur-sm border-2 border-red-200/50 rounded-3xl p-10 hover:shadow-2xl hover:shadow-red-100/50 transition-all duration-300 transform hover:-translate-y-2"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-400/10 rounded-full blur-3xl group-hover:bg-red-400/20 transition-all"></div>

                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-red-500/30 group-hover:scale-110 transition-transform">
                    <IconComponent size={32} className="text-white" />
                  </div>

                  <h3 className="text-2xl font-display font-bold text-gray-900 mb-4 leading-tight">
                    {problem.title}
                  </h3>

                  <p className="text-gray-600 leading-relaxed font-body">
                    {problem.description}
                  </p>
                </div>

                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-pink-500 rounded-b-3xl transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <div className="inline-flex items-center space-x-2 bg-red-100 text-red-800 px-6 py-3 rounded-full font-semibold">
            <AlertTriangle size={20} />
            <span>Don't let another lead slip away</span>
          </div>
        </div>
      </div>
    </section>
  );
}
