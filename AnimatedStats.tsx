import { useEffect, useState } from 'react';
import { TrendingUp, Users, Zap, DollarSign } from 'lucide-react';

export default function AnimatedStats() {
  const [counts, setCounts] = useState({
    leads: 0,
    agents: 0,
    response: 0,
    revenue: 0
  });

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;

    const targets = {
      leads: 1247,
      agents: 200,
      response: 5,
      revenue: 2.4
    };

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;

      setCounts({
        leads: Math.floor(targets.leads * progress),
        agents: Math.floor(targets.agents * progress),
        response: Math.floor(targets.response * progress),
        revenue: Number((targets.revenue * progress).toFixed(1))
      });

      if (step >= steps) {
        clearInterval(timer);
        setCounts(targets);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const stats = [
    { icon: <Zap size={20} />, value: counts.leads, label: 'Leads Processed', suffix: '+', color: 'text-blue-600' },
    { icon: <Users size={20} />, value: counts.agents, label: 'Active Agents', suffix: '+', color: 'text-purple-600' },
    { icon: <TrendingUp size={20} />, value: counts.response, label: 'Min Response', suffix: 'm', color: 'text-green-600' },
    { icon: <DollarSign size={20} />, value: counts.revenue, label: 'Million Saved', suffix: 'M', color: 'text-emerald-600' }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-xl p-4 shadow-lg border border-gray-100 hover:shadow-xl transition-all"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className={`${stat.color} mb-2`}>{stat.icon}</div>
          <div className="text-2xl font-bold text-gray-900">
            {stat.value}{stat.suffix}
          </div>
          <div className="text-xs text-gray-600">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
