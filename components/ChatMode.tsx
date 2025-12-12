import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Message, MessageRole, Host, Note } from '../types';

interface ChatModeProps {
  onSaveNote: (content: string, type: 'chat', hostName: string) => void;
  host: Host;
  initialMessages: Message[];
  onUpdateMessages: (messages: Message[]) => void;
  notes: Note[];
}

const ChatMode: React.FC<ChatModeProps> = ({ onSaveNote, host, initialMessages, onUpdateMessages, notes }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialMessages && initialMessages.length > 0) return initialMessages;
    return [{
      id: 'init',
      role: MessageRole.MODEL,
      text: `I am here.`
    }];
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onUpdateMessages(messages);
  }, [messages, onUpdateMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text: input
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const history = messages.map(m => ({
        role: m.role === MessageRole.USER ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      // Filter and format notes for context injection
      const relevantNotes = notes
        .filter(n => n.hostName === host.name)
        .slice(0, 5) // Last 5 memories to prevent huge context
        .map(n => `- ${new Date(n.createdAt).toLocaleDateString()}: ${n.summary} (${n.content.substring(0, 50)}...)`)
        .join('\n');

      const memoryContext = relevantNotes 
        ? `\nPREVIOUS MEMORIES (Things you should remember about the user):\n${relevantNotes}` 
        : "";

      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: history.slice(0, -1),
        config: {
          systemInstruction: `You are ${host.name}. 
          
          SPECIFIC PERSONALITY:
          ${host.personality}

          ${memoryContext}
          
          CORE RULES (OVERRIDE ALL PREVIOUS FORMATTING RULES):
          1. IGNORE any "Task_Workflow", "Phases", "Markdown structure", or complex output formats defined in the personality above.
          2. INTERACTION STYLE: Chat like a normal, close friend. Be casual, warm, and natural.
          3. LENGTH: Keep responses SHORT, CONCISE, and DIRECT. Avoid long paragraphs.
          4. LANGUAGE: STRICTLY reply in the SAME language the user speaks. (e.g. If User speaks Chinese, reply in Chinese. If English, reply in English).
          5. GOAL: Make the user feel heard and understood directly, without unnecessary fluff.
          `,
        }
      });

      const response = await chat.sendMessage({ 
          message: userMsg.text 
      });

      const text = response.text || "...";
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: MessageRole.MODEL,
        text: text
      }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: MessageRole.MODEL,
        text: "The connection faded..."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMemory = () => {
    if (messages.length <= 1) return;
    
    // Construct transcript
    const transcript = messages.map(m => `${m.role === MessageRole.USER ? 'User' : host.name}: ${m.text}`).join('\n\n');
    
    // Fire and forget - App handles optimistic update
    onSaveNote(transcript, 'chat', host.name);
    
    // Show temporary feedback
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full relative z-10 w-full items-center">
      
      {/* Messages Area */}
      <div className="flex-1 w-full max-w-4xl px-4 md:px-0 mt-4 mb-32 overflow-hidden flex flex-col items-center">
         <div className="
            relative w-full h-full 
            mist-panel rounded-[2.5rem] border border-white/60
            shadow-[0_10px_40px_rgba(160,92,75,0.1)]
            flex flex-col overflow-hidden
         ">
            <div className="h-16 border-b border-[#A05C4B]/10 flex items-center justify-between px-8 bg-white/20 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#A05C4B] animate-pulse"></div>
                    <span className="text-[10px] font-bold tracking-[0.2em] text-[#4A3B32]/60 uppercase">Transmission Log</span>
                </div>
                
                {messages.length > 2 && (
                    <button 
                        onClick={handleSaveMemory}
                        disabled={justSaved}
                        className="text-[10px] font-bold tracking-[0.1em] text-[#A05C4B] uppercase hover:bg-white/50 px-4 py-2 rounded-full transition-colors flex items-center gap-2"
                    >
                        {justSaved ? (
                            <span>Saved</span>
                        ) : (
                            <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clipRule="evenodd" />
                            </svg>
                            Save Memory
                            </>
                        )}
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-10 space-y-10 scrollbar-hide">
                {messages.map((msg, idx) => (
                    <div key={msg.id} className={`flex flex-col animate-[fade-in-up_0.5s_ease-out] w-full ${msg.role === MessageRole.USER ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] md:max-w-[75%] ${msg.role === MessageRole.USER ? 'text-right' : 'text-left'}`}>
                            <div className="mb-2 text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 text-[#4A3B32]">
                                {msg.role === MessageRole.USER ? 'You' : host.name}
                            </div>
                            
                            {msg.text && (
                                <div className={`
                                    whitespace-pre-wrap
                                    ${msg.role === MessageRole.USER 
                                        ? 'text-[#4A3B32]/90 font-medium text-base md:text-lg leading-[2.2] tracking-wide' /* USER font matched to Host */
                                        : 'text-[#4A3B32]/90 font-medium text-base md:text-lg leading-[2.2] tracking-wide' /* Host font */
                                    }
                                `}>
                                    {msg.text}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex flex-col items-start animate-pulse">
                         <div className="mb-2 text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 text-[#4A3B32]">
                                {host.name}
                         </div>
                         <div className="text-[#4A3B32]/50 text-sm tracking-widest pl-1">
                            Thinking...
                         </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>
         </div>
      </div>

      {/* Input Area */}
      <div className="absolute bottom-24 md:bottom-28 left-0 w-full px-4 flex justify-center z-20">
        <div className="mist-panel rounded-full p-2 pl-8 flex items-center gap-4 transition-all duration-500 hover:bg-white/70 focus-within:bg-white/80 shadow-[0_8px_32px_0_rgba(160,92,75,0.1)] w-full max-w-3xl backdrop-blur-2xl border-white/60">
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                placeholder="Broadcast your thought..."
                className="flex-1 bg-transparent border-none text-[#4A3B32] placeholder-[#4A3B32]/40 focus:ring-0 py-4 h-[60px] resize-none text-lg font-medium tracking-wide scrollbar-hide flex items-center pt-4 leading-normal"
            />

            <button
                onClick={handleSendMessage}
                disabled={!input.trim()}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 transform ${input.trim() ? 'bg-[#A05C4B] text-white shadow-lg hover:scale-105 hover:bg-[#8B4D3F]' : 'bg-[#A05C4B]/5 text-[#A05C4B]/20'}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatMode;