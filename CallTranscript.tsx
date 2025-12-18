import { MessageSquare, Mic } from 'lucide-react';
import { useEffect, useRef } from 'react';
import AudioWaveform from './AudioWaveform';

interface Call {
  id: string;
  status: string;
  transcript: string;
  duration: number;
}

interface Lead {
  name: string;
  phone: string;
}

interface CallTranscriptProps {
  call: Call | null;
  lead: Lead | null;
}

export default function CallTranscript({ call, lead }: CallTranscriptProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [call?.transcript]);

  if (!call || !lead) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <MessageSquare size={64} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">Select a call to view transcript</p>
        </div>
      </div>
    );
  }

  const parseTranscript = (transcript: string) => {
    if (!transcript) return [];

    const lines = transcript.split('\n\n');
    return lines.map(line => {
      const isAgent = line.startsWith('Agent:');
      const text = line.replace(/^(Agent:|[\w\s]+:)\s*/, '');
      return { isAgent, text };
    });
  };

  const messages = parseTranscript(call.transcript);

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-xl border border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">{lead.name}</h2>
            <p className="text-sm text-gray-400">{lead.phone}</p>
          </div>
          <div className="flex items-center space-x-3">
            {call.status === 'active' && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Live</span>
              </div>
            )}
            {call.status === 'ringing' && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-full">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Ringing</span>
              </div>
            )}
          </div>
        </div>

        {call.status === 'active' && <AudioWaveform />}
      </div>

      <div
        ref={transcriptRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Mic size={48} className="mx-auto mb-3 opacity-20" />
              <p>Waiting for conversation to start...</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.isAgent ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-lg ${
                  message.isAgent
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                <div className="text-xs font-medium mb-1 opacity-70">
                  {message.isAgent ? 'AI Agent' : lead.name}
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.text}
                </div>
              </div>
            </div>
          ))
        )}

        {call.status === 'active' && messages.length > 0 && (
          <div className="flex items-center space-x-2 text-gray-500 text-sm">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span>AI is listening...</span>
          </div>
        )}
      </div>
    </div>
  );
}
