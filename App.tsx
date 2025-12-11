import React, { useState, useEffect } from 'react';
import Visualizer from './components/Visualizer';
import ChatMode from './components/ChatMode';
import NotesMode from './components/NotesMode';
import LandingMode from './components/LandingMode';
import LiveMode from './components/LiveMode';
import WonderlandBackground from './components/WaveBackground';
import { Note, ViewMode, Host, Message } from './types';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [currentHost, setCurrentHost] = useState<Host | null>(null);
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const saved = localStorage.getItem('wonderland_notes');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | undefined>(undefined);
  
  // Chat History State with LocalStorage Persistence
  const [chatHistories, setChatHistories] = useState<Record<string, Message[]>>(() => {
    try {
      const saved = localStorage.getItem('wonderland_chat_history');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Save to local storage whenever history changes
  useEffect(() => {
    localStorage.setItem('wonderland_chat_history', JSON.stringify(chatHistories));
  }, [chatHistories]);

  // Save notes to local storage
  useEffect(() => {
    localStorage.setItem('wonderland_notes', JSON.stringify(notes));
  }, [notes]);

  const updateChatHistory = (hostId: string, messages: Message[]) => {
    setChatHistories(prev => ({
      ...prev,
      [hostId]: messages
    }));
  };

  const createMemory = (content: string, type: 'voice' | 'chat' | 'dream', hostName: string) => {
    // 1. Optimistic Update: Create note immediately with placeholder summary
    const tempId = Date.now().toString();
    const newNote: Note = {
      id: tempId,
      content,
      summary: "Weaving memory...", // Placeholder
      createdAt: Date.now(),
      hostName,
      type
    };

    setNotes(prev => [newNote, ...prev]);

    // 2. Generate Summary in Background (Non-blocking)
    (async () => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Summarize the following interaction/content in one natural, casual sentence (max 15 words). 
                Avoid poetic, flowery, or strictly parallel structures. Make it sound like a simple, life-like observation or a diary entry.
                IMPORTANT: Use the same language (Chinese or English) as the content.
                Content: ${content.substring(0, 1000)}`,
            });
            const summary = response.text || "A woven memory.";
            
            // Update the specific note with the real summary
            setNotes(prev => prev.map(n => n.id === tempId ? { ...n, summary } : n));
        } catch (e) {
            console.error("Summary generation failed", e);
            setNotes(prev => prev.map(n => n.id === tempId ? { ...n, summary: "A preserved moment." } : n));
        }
    })();
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleEnterWonderland = (host: Host) => {
    setCurrentHost(host);
    setViewMode('chat');
  };

  const handleBack = () => {
    setCurrentHost(null);
    setViewMode('landing');
    setAudioAnalyser(undefined);
  };

  const navItems: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    { 
      mode: 'chat', 
      label: 'Commune',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
    },
    {
      mode: 'live',
      label: 'Voice',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75-18.75h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
    },
    { 
      mode: 'notes', 
      label: 'Memory',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
    }
  ];

  if (viewMode === 'landing') {
    return <LandingMode onEnter={handleEnterWonderland} />;
  }

  return (
    <div className={`relative w-full h-screen overflow-hidden`}>
      
      {/* Visualizer Layer - Background Movement & Audio Reaction */}
      <Visualizer 
        isActive={!!audioAnalyser} 
        analyser={audioAnalyser} 
        colorTheme={currentHost?.themeColor || 'amber'}
      />
      <WonderlandBackground />

      {/* Main Container */}
      <div className="relative w-full h-full flex flex-col">
        
        {/* Top Bar with Back Navigation */}
        <div className="flex justify-between items-center p-6 z-20">
            <button 
              onClick={handleBack}
              className="px-4 py-2 rounded-full mist-panel hover:bg-white/60 transition-colors text-[#4A3B32] group flex items-center gap-2"
              title="Return to Guides"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 group-hover:-translate-x-1 transition-transform">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              <span className="text-[10px] font-bold tracking-widest uppercase hidden md:inline">Back</span>
            </button>

            <h1 className="text-sm font-bold tracking-[0.3em] text-[#4A3B32]/60 uppercase absolute left-1/2 -translate-x-1/2">Wonderland</h1>
            
            <div className="flex items-center gap-3 px-4 py-2 rounded-full mist-panel text-xs font-bold tracking-widest text-[#4A3B32] uppercase shadow-sm">
                <span 
                   className={`w-2 h-2 rounded-full animate-pulse`} 
                   style={{ backgroundColor: currentHost?.orbColor }}
                ></span>
                {currentHost?.name}
            </div>
        </div>

        {/* Content */}
        <main className="flex-1 relative z-10 overflow-hidden flex flex-col pb-24 md:pb-6 w-full mx-auto">
          {viewMode === 'chat' && currentHost && (
            <ChatMode 
              host={currentHost} 
              onSaveNote={createMemory} 
              initialMessages={chatHistories[currentHost.id] || []}
              onUpdateMessages={(msgs) => updateChatHistory(currentHost.id, msgs)}
            />
          )}
          {viewMode === 'live' && currentHost && (
            <LiveMode
              host={currentHost}
              onSetAnalyser={setAudioAnalyser}
              onSaveNote={createMemory}
              currentHistory={chatHistories[currentHost.id] || []}
              onUpdateMessages={(msgs) => updateChatHistory(currentHost.id, msgs)}
            />
          )}
          {viewMode === 'notes' && <NotesMode notes={notes} onDelete={deleteNote} />}
        </main>

        {/* Floating Navigation Bar */}
        <div className="fixed bottom-8 left-0 w-full flex justify-center z-50 pointer-events-none">
            <nav className="flex items-center gap-1 p-2 rounded-full mist-panel pointer-events-auto shadow-[0_10px_30px_rgba(160,92,75,0.2)] border border-white/60">
                {navItems.map((item) => (
                <button
                    key={item.mode}
                    onClick={() => setViewMode(item.mode)}
                    className={`
                       px-6 py-3 rounded-full transition-all duration-300 flex items-center gap-3
                       ${viewMode === item.mode 
                        ? 'bg-[#A05C4B] text-white shadow-md scale-105' 
                        : 'text-[#4A3B32]/60 hover:text-[#A05C4B] hover:bg-white/40'}
                    `}
                >
                    {item.icon}
                    <span className={`text-xs font-bold uppercase tracking-widest ${viewMode === item.mode ? 'block' : 'hidden md:block'}`}>
                        {item.label}
                    </span>
                </button>
                ))}
            </nav>
        </div>

      </div>
    </div>
  );
};

export default App;