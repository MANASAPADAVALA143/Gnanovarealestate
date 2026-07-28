import { Menu, X, Phone } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../src/contexts/AuthContext';
import { featureFlags } from '../src/lib/featureFlags';

interface HeaderProps {
  onBookDemo: () => void;
  onNavigateToCallCenter?: () => void;
}

export default function Header({ onBookDemo, onNavigateToCallCenter }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg"></div>
            <span className="text-xl font-bold text-gray-900">Gnanova Real Estate</span>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#solutions" className="text-gray-600 hover:text-gray-900 transition">Solutions</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition">Pricing</a>
            <a href="#results" className="text-gray-600 hover:text-gray-900 transition">Results</a>
            <a href="#faq" className="text-gray-600 hover:text-gray-900 transition">FAQ</a>
            {/* TODO(stub): live call-center uses mock data — gated until realtime VAPI feed exists */}
            {featureFlags.liveCallCenter && (
              <Link
                to="/call-center"
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition flex items-center space-x-2"
              >
                <Phone size={18} />
                <span>Call Center</span>
              </Link>
            )}
            {user ? (
              <Link
                to="/dashboard"
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition transform hover:scale-105"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-gray-900 transition font-medium"
                >
                  Sign In
                </Link>
                <button
                  onClick={onBookDemo}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition transform hover:scale-105"
                >
                  Book Demo
                </button>
              </>
            )}
          </div>

          <button
            className="md:hidden text-gray-600"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-4">
              <a href="#solutions" className="text-gray-600 hover:text-gray-900">Solutions</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
              <a href="#results" className="text-gray-600 hover:text-gray-900">Results</a>
              <a href="#faq" className="text-gray-600 hover:text-gray-900">FAQ</a>
              {featureFlags.liveCallCenter && (
                <Link
                  to="/call-center"
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg flex items-center space-x-2"
                >
                  <Phone size={18} />
                  <span>Call Center</span>
                </Link>
              )}
              {user ? (
                <Link
                  to="/dashboard"
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Sign In
                  </Link>
                  <button
                    onClick={onBookDemo}
                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg"
                  >
                    Book Demo
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
