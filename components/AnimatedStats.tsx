import { Clock, Headphones, BadgeDollarSign, Rocket } from 'lucide-react';

export default function AnimatedStats() {
  const stats = [
    { icon: <Clock size={20} />, value: '< 60 sec', label: 'AI Response Time', color: 'text-blue-600' },
    { icon: <Headphones size={20} />, value: '24/7', label: 'AI Coverage', color: 'text-purple-600' },
    { icon: <BadgeDollarSign size={20} />, value: 'AED 0', label: 'Setup Fee', color: 'text-green-600' },
    { icon: <Rocket size={20} />, value: '48 hrs', label: 'Go Live Time', color: 'text-emerald-600' },
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
          <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
          <div className="text-xs text-gray-600">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
