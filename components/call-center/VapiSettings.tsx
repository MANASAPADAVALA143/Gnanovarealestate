import { Save, Key, Phone, Bot } from 'lucide-react';
import { useState } from 'react';

interface VapiSettingsProps {
  onClose: () => void;
}

export default function VapiSettings({ onClose }: VapiSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [assistantId, setAssistantId] = useState('');

  const handleSave = () => {
    console.log('Saving VAPI settings:', { apiKey, phoneNumber, assistantId });
    onClose();
  };

  return (
    <div className="p-6">
      <div className="space-y-6 mb-6">
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Key size={16} className="text-blue-400" />
            <span>VAPI API Key</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your VAPI API key"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            Get your API key from{' '}
            <a
              href="https://vapi.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              vapi.ai/dashboard
            </a>
          </p>
        </div>

        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Phone size={16} className="text-blue-400" />
            <span>Phone Number</span>
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1-555-0100"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            Your VAPI phone number for making outbound calls
          </p>
        </div>

        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Bot size={16} className="text-blue-400" />
            <span>AI Assistant ID</span>
          </label>
          <input
            type="text"
            value={assistantId}
            onChange={(e) => setAssistantId(e.target.value)}
            placeholder="assistant_123abc"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            The ID of your configured AI assistant
          </p>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-blue-400 font-semibold mb-2 text-sm">Integration Guide</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>1. Sign up at vapi.ai and create an account</li>
            <li>2. Configure your AI assistant with real estate scripts</li>
            <li>3. Get your API credentials from the dashboard</li>
            <li>4. Enter your credentials here to enable calling</li>
          </ul>
        </div>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center space-x-2 transition"
        >
          <Save size={20} />
          <span>Save Settings</span>
        </button>
        <button
          onClick={onClose}
          className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
