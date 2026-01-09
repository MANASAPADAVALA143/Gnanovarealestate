import { History, Play, Clock, CheckCircle, XCircle, Phone, PhoneMissed } from 'lucide-react';

interface Call {
  id: string;
  lead_id: string;
  status: string;
  outcome?: string;
  duration: number;
  recording_url?: string;
  started_at?: string;
  ended_at?: string;
}

interface CallHistoryProps {
  calls: Call[];
  onSelectCall: (call: Call) => void;
}

export default function CallHistory({ calls, onSelectCall }: CallHistoryProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getOutcomeIcon = (outcome?: string) => {
    switch (outcome) {
      case 'scheduled':
        return <CheckCircle size={16} className="text-green-400" />;
      case 'not_interested':
        return <XCircle size={16} className="text-red-400" />;
      case 'callback':
        return <Phone size={16} className="text-yellow-400" />;
      case 'no_answer':
        return <PhoneMissed size={16} className="text-gray-400" />;
      default:
        return null;
    }
  };

  const getOutcomeColor = (outcome?: string) => {
    switch (outcome) {
      case 'scheduled':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'not_interested':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'callback':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'no_answer':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatOutcome = (outcome?: string) => {
    if (!outcome) return 'Unknown';
    return outcome.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const leadNames: Record<string, string> = {
    'lead-1': 'John Mitchell',
    'lead-2': 'Sarah Anderson',
    'lead-3': 'Michael Chen',
    'lead-4': 'Emily Rodriguez',
    'lead-5': 'David Thompson'
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white flex items-center">
          <History size={20} className="mr-2" />
          Call History
        </h2>
        <span className="text-sm text-gray-400">{calls.length} calls</span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex space-x-3 pb-2">
          {calls.length === 0 ? (
            <div className="text-center py-8 text-gray-500 w-full">
              <History size={48} className="mx-auto mb-3 opacity-20" />
              <p>No call history yet</p>
            </div>
          ) : (
            calls.map(call => (
              <div
                key={call.id}
                onClick={() => onSelectCall(call)}
                className="flex-shrink-0 w-64 p-4 bg-gray-800 hover:bg-gray-750 rounded-lg cursor-pointer transition border border-gray-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">
                      {leadNames[call.lead_id] || 'Unknown Lead'}
                    </h3>
                    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getOutcomeColor(call.outcome)}`}>
                      {getOutcomeIcon(call.outcome)}
                      <span>{formatOutcome(call.outcome)}</span>
                    </div>
                  </div>
                  {call.recording_url && (
                    <button className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition">
                      <Play size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-400">
                  <div className="flex items-center space-x-1">
                    <Clock size={14} />
                    <span>{formatDuration(call.duration)}</span>
                  </div>
                  <span>{formatTime(call.started_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
