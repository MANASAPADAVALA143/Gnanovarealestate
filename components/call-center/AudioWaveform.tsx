import { useEffect, useState } from 'react';

export default function AudioWaveform() {
  const [bars, setBars] = useState<number[]>(Array(40).fill(0));

  useEffect(() => {
    const interval = setInterval(() => {
      setBars(Array(40).fill(0).map(() => Math.random()));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center space-x-1 h-16 bg-gray-900 rounded-lg px-4">
      {bars.map((height, index) => (
        <div
          key={index}
          className="w-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-full transition-all duration-100"
          style={{
            height: `${Math.max(4, height * 100)}%`,
            opacity: 0.5 + height * 0.5
          }}
        ></div>
      ))}
    </div>
  );
}
