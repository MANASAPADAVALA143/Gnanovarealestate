import { Phone, Mail, MapPin, DollarSign, Home, Calendar, Tag } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone: string;
  location?: string;
  budget?: string;
  property_type?: string;
  status: string;
  created_at: string;
}

interface Call {
  id: string;
  status: string;
  outcome?: string;
}

interface LeadInfoProps {
  lead: Lead | null;
  call: Call | null;
  onMakeCall: (leadId: string) => void;
}

export default function LeadInfo({ lead, call, onMakeCall }: LeadInfoProps) {
  if (!lead) {
    return (
      <div className="p-6 flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <Phone size={48} className="mx-auto mb-4 opacity-20" />
          <p>Select a call to view lead details</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hot':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'warm':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'cold':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const outcomeOptions = ['scheduled', 'not_interested', 'callback', 'no_answer'];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Lead Information</h2>
          <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(lead.status)}`}>
            {lead.status.toUpperCase()}
          </div>
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">{lead.name}</h3>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-start space-x-3">
          <Phone size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs text-gray-400 mb-1">Phone</div>
            <div className="text-white">{lead.phone}</div>
          </div>
        </div>

        {lead.email && (
          <div className="flex items-start space-x-3">
            <Mail size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-400 mb-1">Email</div>
              <div className="text-white break-all">{lead.email}</div>
            </div>
          </div>
        )}

        {lead.location && (
          <div className="flex items-start space-x-3">
            <MapPin size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-400 mb-1">Location</div>
              <div className="text-white">{lead.location}</div>
            </div>
          </div>
        )}

        {lead.budget && (
          <div className="flex items-start space-x-3">
            <DollarSign size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-400 mb-1">Budget</div>
              <div className="text-white">{lead.budget}</div>
            </div>
          </div>
        )}

        {lead.property_type && (
          <div className="flex items-start space-x-3">
            <Home size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-400 mb-1">Property Type</div>
              <div className="text-white">{lead.property_type}</div>
            </div>
          </div>
        )}

        <div className="flex items-start space-x-3">
          <Calendar size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs text-gray-400 mb-1">Lead Created</div>
            <div className="text-white">
              {new Date(lead.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
          </div>
        </div>
      </div>

      {call && call.status === 'active' && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-center space-x-2 mb-3">
            <Tag size={16} className="text-blue-400" />
            <h3 className="font-semibold text-white">Call Outcome</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {outcomeOptions.map(outcome => (
              <button
                key={outcome}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  call.outcome === outcome
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {outcome.split('_').map(word =>
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {!call || call.status !== 'active' ? (
          <button
            onClick={() => onMakeCall(lead.id)}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center justify-center space-x-2 transition"
          >
            <Phone size={20} />
            <span>Call Lead</span>
          </button>
        ) : (
          <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg text-center text-green-400 font-medium">
            Call in Progress
          </div>
        )}

        <button className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold transition">
          Send Email
        </button>

        <button className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold transition">
          Schedule Follow-up
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-800">
        <h3 className="font-semibold text-white mb-3">Recent Activity</h3>
        <div className="space-y-3">
          <div className="text-sm">
            <div className="text-gray-400 mb-1">Last Contact</div>
            <div className="text-white">2 hours ago</div>
          </div>
          <div className="text-sm">
            <div className="text-gray-400 mb-1">Total Calls</div>
            <div className="text-white">3 calls</div>
          </div>
          <div className="text-sm">
            <div className="text-gray-400 mb-1">Properties Viewed</div>
            <div className="text-white">7 properties</div>
          </div>
        </div>
      </div>
    </div>
  );
}
