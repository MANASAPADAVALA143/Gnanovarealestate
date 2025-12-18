import { useState, useEffect } from 'react';
import { Phone, Settings, X } from 'lucide-react';
import ActiveCallsList from '../components/call-center/ActiveCallsList';
import CallTranscript from '../components/call-center/CallTranscript';
import LeadInfo from '../components/call-center/LeadInfo';
import CallHistory from '../components/call-center/CallHistory';
import VapiSettings from '../components/call-center/VapiSettings';

interface Call {
  id: string;
  lead_id: string;
  status: 'active' | 'ringing' | 'completed' | 'failed' | 'no_answer' | 'queued';
  outcome?: 'scheduled' | 'not_interested' | 'callback' | 'no_answer';
  duration: number;
  transcript: string;
  recording_url?: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

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
  updated_at: string;
}

export default function VoiceCallCenter() {
  const [activeCalls, setActiveCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [callHistory, setCallHistory] = useState<Call[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchMockData();

    const interval = setInterval(() => {
      updateLiveTranscript();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const fetchMockData = () => {
    const mockActiveCalls: Call[] = [
      {
        id: '1',
        lead_id: 'lead-1',
        status: 'active',
        duration: 145,
        transcript: 'Agent: Hi, this is calling from Gnanova Real Estate. Am I speaking with John?\n\nJohn: Yes, this is John.\n\nAgent: Great! I wanted to follow up on your interest in properties in the Los Angeles area. Are you still looking?\n\nJohn: Yes, absolutely! I\'m very interested in finding something in the $800k to $1.2M range.\n\nAgent: Perfect! We actually have some great new listings that match your criteria...',
        started_at: new Date(Date.now() - 145000).toISOString(),
        created_at: new Date(Date.now() - 145000).toISOString()
      },
      {
        id: '2',
        lead_id: 'lead-2',
        status: 'ringing',
        duration: 0,
        transcript: '',
        created_at: new Date().toISOString()
      }
    ];

    const mockHistory: Call[] = [
      {
        id: '3',
        lead_id: 'lead-3',
        status: 'completed',
        outcome: 'scheduled',
        duration: 420,
        transcript: 'Full call transcript...',
        recording_url: 'https://example.com/recording-3.mp3',
        started_at: new Date(Date.now() - 3600000).toISOString(),
        ended_at: new Date(Date.now() - 3180000).toISOString(),
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: '4',
        lead_id: 'lead-4',
        status: 'completed',
        outcome: 'callback',
        duration: 180,
        transcript: 'Full call transcript...',
        started_at: new Date(Date.now() - 7200000).toISOString(),
        ended_at: new Date(Date.now() - 7020000).toISOString(),
        created_at: new Date(Date.now() - 7200000).toISOString()
      },
      {
        id: '5',
        lead_id: 'lead-5',
        status: 'no_answer',
        outcome: 'no_answer',
        duration: 0,
        transcript: '',
        started_at: new Date(Date.now() - 10800000).toISOString(),
        created_at: new Date(Date.now() - 10800000).toISOString()
      }
    ];

    setActiveCalls(mockActiveCalls);
    setCallHistory(mockHistory);
    if (mockActiveCalls.length > 0) {
      setSelectedCall(mockActiveCalls[0]);
      fetchLeadInfo(mockActiveCalls[0].lead_id);
    }
  };

  const fetchLeadInfo = async (leadId: string) => {
    const mockLeads: Record<string, Lead> = {
      'lead-1': {
        id: 'lead-1',
        name: 'John Mitchell',
        email: 'john.mitchell@email.com',
        phone: '+1-555-0101',
        location: 'Los Angeles, CA',
        budget: '$800k-1.2M',
        property_type: 'Single Family Home',
        status: 'hot',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString()
      },
      'lead-2': {
        id: 'lead-2',
        name: 'Sarah Anderson',
        email: 'sarah.anderson@email.com',
        phone: '+1-555-0102',
        location: 'San Francisco, CA',
        budget: '$1.5M-2M',
        property_type: 'Condo',
        status: 'warm',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date().toISOString()
      },
      'lead-3': {
        id: 'lead-3',
        name: 'Michael Chen',
        email: 'michael.chen@email.com',
        phone: '+1-555-0103',
        location: 'Seattle, WA',
        budget: '$600k-900k',
        property_type: 'Townhouse',
        status: 'new',
        created_at: new Date(Date.now() - 259200000).toISOString(),
        updated_at: new Date().toISOString()
      },
      'lead-4': {
        id: 'lead-4',
        name: 'Emily Rodriguez',
        email: 'emily.rodriguez@email.com',
        phone: '+1-555-0104',
        location: 'Austin, TX',
        budget: '$400k-600k',
        property_type: 'Single Family Home',
        status: 'hot',
        created_at: new Date(Date.now() - 345600000).toISOString(),
        updated_at: new Date().toISOString()
      },
      'lead-5': {
        id: 'lead-5',
        name: 'David Thompson',
        email: 'david.thompson@email.com',
        phone: '+1-555-0105',
        location: 'Denver, CO',
        budget: '$700k-1M',
        property_type: 'Single Family Home',
        status: 'warm',
        created_at: new Date(Date.now() - 432000000).toISOString(),
        updated_at: new Date().toISOString()
      }
    };

    setSelectedLead(mockLeads[leadId] || null);
  };

  const updateLiveTranscript = () => {
    setActiveCalls(prev => prev.map(call => {
      if (call.status === 'active') {
        return {
          ...call,
          duration: call.duration + 3
        };
      }
      return call;
    }));
  };

  const handleCallSelect = (call: Call) => {
    setSelectedCall(call);
    fetchLeadInfo(call.lead_id);
  };

  const handleEndCall = (callId: string) => {
    setActiveCalls(prev => prev.filter(call => call.id !== callId));
    const endedCall = activeCalls.find(call => call.id === callId);
    if (endedCall) {
      setCallHistory(prev => [{
        ...endedCall,
        status: 'completed',
        ended_at: new Date().toISOString()
      }, ...prev]);
    }
    if (selectedCall?.id === callId) {
      setSelectedCall(null);
      setSelectedLead(null);
    }
  };

  const handleMakeCall = (leadId: string) => {
    const newCall: Call = {
      id: `call-${Date.now()}`,
      lead_id: leadId,
      status: 'ringing',
      duration: 0,
      transcript: '',
      created_at: new Date().toISOString()
    };
    setActiveCalls(prev => [...prev, newCall]);
    setSelectedCall(newCall);
    fetchLeadInfo(leadId);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Phone size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Voice Call Center</h1>
              <p className="text-sm text-gray-400">AI-Powered Lead Engagement</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center space-x-2 transition"
          >
            <Settings size={20} />
            <span>VAPI Settings</span>
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-89px)]">
        <div className="w-80 bg-gray-900 border-r border-gray-800 overflow-y-auto">
          <ActiveCallsList
            calls={activeCalls}
            selectedCallId={selectedCall?.id}
            onSelectCall={handleCallSelect}
            onEndCall={handleEndCall}
          />
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-6 overflow-y-auto">
            <CallTranscript
              call={selectedCall}
              lead={selectedLead}
            />
          </div>

          <div className="bg-gray-900 border-t border-gray-800">
            <CallHistory
              calls={callHistory}
              onSelectCall={handleCallSelect}
            />
          </div>
        </div>

        <div className="w-96 bg-gray-900 border-l border-gray-800 overflow-y-auto">
          <LeadInfo
            lead={selectedLead}
            call={selectedCall}
            onMakeCall={handleMakeCall}
          />
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-2xl border border-gray-800">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white">VAPI Integration Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>
            <VapiSettings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
