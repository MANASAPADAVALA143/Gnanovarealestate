import { Phone, PhoneOff } from 'lucide-react';

interface Call {
  id: string;
  lead_id: string;
  status: 'active' | 'ringing' | 'completed' | 'failed' | 'no_answer' | 'queued';
  duration: number;
  started_at?: string;
}

interface ActiveCallsListProps {
  calls: Call[];
  selectedCallId?: string;
  onSelectCall: (call: Call) => void;
  onEndCall: (callId: string) => void;
}

export default function ActiveCallsList({ calls, selectedCallId, onSelectCall, onEndCall }: ActiveCallsListProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: Call['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'ringing':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: Call['status']) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'ringing':
        return 'Ringing';
      case 'failed':
        return 'Failed';
      case 'queued':
        return 'Queued';
      default:
        return status;
    }
  };

  const leadNames: Record<string, string> = {
    'lead-1': 'John Mitchell',
    'lead-2': 'Sarah Anderson',
    'lead-3': 'Michael Chen',
    'lead-4': 'Emily Rodriguez',
    'lead-5': 'David Thompson'
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center">
        <Phone size={20} className="mr-2" />
        Active Calls ({calls.length})
      </h2>

      <div className="space-y-2">
        {calls.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Phone size={48} className="mx-auto mb-4 opacity-20" />
            <p>No active calls</p>
          </div>
        ) : (
          calls.map(call => (
            <div
              key={call.id}
              onClick={() => onSelectCall(call)}
              className={`p-4 rounded-lg cursor-pointer transition-all ${
                selectedCallId === call.id
                  ? 'bg-blue-600 shadow-lg shadow-blue-500/20'
                  : 'bg-gray-800 hover:bg-gray-750'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(call.status)} ${
                      call.status === 'active' || call.status === 'ringing' ? 'animate-pulse' : ''
                    }`}></div>
                    <span className="text-sm font-medium text-gray-300">
                      {getStatusText(call.status)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white">
                    {leadNames[call.lead_id] || 'Unknown Lead'}
                  </h3>
                </div>
                {call.status === 'active' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEndCall(call.id);
                    }}
                    className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition"
                  >
                    <PhoneOff size={16} />
                  </button>
                )}
              </div>

              {call.status === 'active' && (
                <div className="text-2xl font-mono font-bold text-white">
                  {formatDuration(call.duration)}
                </div>
              )}

              {call.status === 'ringing' && (
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-gray-400">Connecting...</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
