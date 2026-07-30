import { useEffect, useState } from 'react';

interface FloatingCardProps {
  delay?: number;
}

export default function FloatingCard({ delay = 0 }: FloatingCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const activities = [
    { type: 'lead', message: 'New lead qualified: Sarah M.', location: 'Dubai Marina', time: 'Just now' },
    { type: 'match', message: 'Property matched: AED 4.2M Villa', location: 'Palm Jumeirah', time: '2 min ago' },
    { type: 'appointment', message: 'Appointment booked: John D.', location: 'Downtown Dubai', time: '5 min ago' },
    { type: 'follow', message: 'Follow-up sent to Emma T.', location: 'Abu Dhabi', time: '8 min ago' }
  ];

  const activity = activities[Math.floor(Math.random() * activities.length)];

  return (
    <div
      className={`absolute bg-white rounded-xl p-4 shadow-2xl border border-gray-100 transform transition-all duration-1000 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      style={{
        animation: 'float 6s ease-in-out infinite',
        animationDelay: `${delay}ms`
      }}
    >
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
          <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{activity.message}</p>
          <p className="text-xs text-gray-500">{activity.location}</p>
          <p className="text-xs text-blue-600 mt-1">{activity.time}</p>
        </div>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      </div>
    </div>
  );
}
