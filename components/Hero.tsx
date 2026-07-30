import { ArrowRight, Award, Shield, Star, Sparkles, Play } from 'lucide-react';
import AnimatedStats from './AnimatedStats';

interface HeroProps {
  onBookDemo: () => void;
}

export default function Hero({ onBookDemo }: HeroProps) {
  const villas = [
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800',
    'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=800',
    'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800',
  ];

  return (
    <section className="relative pt-20 pb-32 overflow-hidden min-h-screen flex items-center">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 animate-gradient"></div>

      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 text-white z-10">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/20 shadow-lg animate-pulse-glow">
              <Sparkles className="text-yellow-400" size={18} />
              <span className="text-sm font-semibold font-mono">AI Working 24/7 • Live Now</span>
            </div>

            <div className="space-y-6">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-display font-extrabold leading-[0.95] tracking-tight">
                Sell More.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 animate-gradient">
                  Work Less.
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-300 leading-relaxed max-w-xl font-body">
                AI assistant that qualifies leads, matches properties, and closes deals while you focus on what matters
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={onBookDemo}
                className="group relative px-10 py-5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white text-lg font-bold rounded-2xl overflow-hidden transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/50 flex items-center justify-center space-x-3"
              >
                <span className="relative z-10">Start Free Trial</span>
                <ArrowRight className="relative z-10 group-hover:translate-x-1 transition" size={22} />
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
              <button className="group px-10 py-5 bg-white/5 backdrop-blur-xl border-2 border-white/20 text-white text-lg font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center space-x-3">
                <Play size={22} className="fill-white" />
                <span>Watch Demo</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-8 pt-6">
              <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full">
                <Award className="text-cyan-400" size={22} />
                <span className="text-sm font-semibold text-slate-200">200+ Agents</span>
              </div>
              <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full">
                <Star className="text-yellow-400 fill-yellow-400" size={22} />
                <span className="text-sm font-semibold text-slate-200">4.9/5 Rating</span>
              </div>
              <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full">
                <Shield className="text-emerald-400" size={22} />
                <span className="text-sm font-semibold text-slate-200">SOC2 Certified</span>
              </div>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-3xl opacity-20 blur-2xl animate-pulse"></div>

              <div className="relative grid grid-cols-2 gap-4">
                <div className="space-y-4 animate-float-slow">
                  <div className="relative group overflow-hidden rounded-2xl shadow-2xl">
                    <img
                      src={villas[0]}
                      alt="Luxury Villa"
                      className="w-full h-64 object-cover transform group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-bold text-lg">AED 4.2M</p>
                          <p className="text-slate-300 text-sm">Dubai Marina</p>
                        </div>
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                        <Sparkles className="text-white" size={24} />
                      </div>
                      <div>
                        <p className="text-white font-bold">AI Matched</p>
                        <p className="text-slate-300 text-sm">2 mins ago</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-8" style={{ animationDelay: '1s' }}>
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white font-bold text-sm">Lead Qualified</p>
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                    <p className="text-slate-300 text-xs">Sarah M. • Dubai Marina</p>
                    <p className="text-cyan-400 text-xs mt-1">Just now</p>
                  </div>

                  <div className="relative group overflow-hidden rounded-2xl shadow-2xl">
                    <img
                      src={villas[1]}
                      alt="Modern Villa"
                      className="w-full h-48 object-cover transform group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-white font-bold">AED 2.8M</p>
                      <p className="text-slate-300 text-sm">Palm Jumeirah</p>
                    </div>
                  </div>

                  <div className="relative group overflow-hidden rounded-2xl shadow-2xl">
                    <img
                      src={villas[2]}
                      alt="Luxury Estate"
                      className="w-full h-40 object-cover transform group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-white font-bold text-sm">AED 6.5M</p>
                      <p className="text-slate-300 text-xs">Downtown Dubai</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20">
          <AnimatedStats />
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
      `}</style>
    </section>
  );
}
