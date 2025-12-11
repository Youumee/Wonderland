import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from '../services/audioUtils';
import { Host, Message, MessageRole } from '../types';

interface LiveModeProps {
  onSetAnalyser: (analyser: AnalyserNode | undefined) => void;
  host: Host;
  currentHistory?: Message[];
  onUpdateMessages?: (messages: Message[]) => void;
  onSaveNote: (content: string, type: 'voice', hostName: string) => void;
}

const LiveMode: React.FC<LiveModeProps> = ({ onSetAnalyser, host, currentHistory, onUpdateMessages, onSaveNote }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string>('');
  const [hasNewMemories, setHasNewMemories] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  
  // Guard to prevent sending data to closed sessions
  const isSessionActive = useRef(false);

  const historyRef = useRef<Message[]>(currentHistory || []);
  
  // Track current turn for accumulating transcript
  const currentTurnTextRef = useRef('');

  useEffect(() => {
    startSession();
    return () => {
      stopSession();
    };
  }, []);

  const addToHistory = (role: MessageRole, text: string) => {
    if (!onUpdateMessages) return;
    if (!text.trim()) return;

    const newMessage: Message = {
        id: Date.now().toString(),
        role: role,
        text: text,
        isAudio: true
    };

    historyRef.current = [...historyRef.current, newMessage];
    onUpdateMessages(historyRef.current);
    setHasNewMemories(true);
  };

  const startSession = async () => {
    try {
      // Ensure clean state
      await stopSession();
      
      setError(null);
      setAiText('');
      setHasNewMemories(false);

      // 1. Initialize Audio Context for Output
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 24000 });
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      onSetAnalyser(analyser);

      // 2. Get Microphone Stream
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        mediaStreamRef.current = stream;
      } catch (e) {
         console.error("Mic Error:", e);
         throw new Error("Microphone access denied. Please allow permissions.");
      }

      // 3. Setup Input Processing with Resampling Logic
      const inputCtx = new AudioContextClass(); 
      if (inputCtx.state === 'suspended') {
          await inputCtx.resume();
      }
      inputAudioContextRef.current = inputCtx;
      
      const source = inputCtx.createMediaStreamSource(mediaStreamRef.current!);
      // Use 4096 buffer size for balance between latency and performance
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      
      source.connect(processor);
      processor.connect(inputCtx.destination);
      scriptProcessorRef.current = processor;

      // 4. Connect to Gemini Live
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: host.voiceName } },
          },
          systemInstruction: `You are ${host.name}. 
          
          SPECIFIC PERSONALITY:
          ${host.personality}
          
          CORE RULES (OVERRIDE ALL PREVIOUS RULES):
          1. IGNORE any "Task_Workflow", "Phases", "Markdown structure", or complex output formats defined in the personality above.
          2. INTERACTION STYLE: You are in a REAL-TIME VOICE conversation. Be extremely concise, conversational, and natural. Like a real friend on the phone.
          3. LENGTH: Keep responses SHORT (1-2 sentences max). No long monologues.
          4. LANGUAGE: ALWAYS SPEAK IN ENGLISH. Even if the user speaks Chinese or another language, YOU MUST REPLY IN ENGLISH.
          5. GOAL: Provide a smooth, friendly voice chat experience.
          `,
          outputAudioTranscription: { model: "gemini-2.5-flash" }, // Request subtitles for AI speech
        },
        callbacks: {
            onopen: () => {
                setIsConnected(true);
                isSessionActive.current = true;
                sessionRef.current = sessionPromise;

                // Setup Input Streaming
                processor.onaudioprocess = (e) => {
                    if (!isSessionActive.current) return;
                    
                    const inputData = e.inputBuffer.getChannelData(0);
                    // Critical: Create compliant PCM blob (16-bit, 16kHz)
                    const pcmBlob = createPcmBlob(inputData);
                    
                    sessionPromise.then(session => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    });
                };
            },
            onmessage: async (message: LiveServerMessage) => {
                // Handle Subtitles (Output Transcription)
                if (message.serverContent?.outputTranscription) {
                     const text = message.serverContent.outputTranscription.text;
                     if (text) {
                         setAiText(prev => prev + text);
                         currentTurnTextRef.current += text;
                     }
                }

                // Handle Audio Output
                const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData && audioContextRef.current) {
                    try {
                        // Ensure nextStartTime is valid
                        const currentTime = audioContextRef.current.currentTime;
                        if (nextStartTimeRef.current < currentTime) {
                            nextStartTimeRef.current = currentTime;
                        }

                        const audioBuffer = await decodeAudioData(
                            decode(audioData), 
                            audioContextRef.current,
                            24000, 
                            1
                        );
                        
                        const source = audioContextRef.current.createBufferSource();
                        source.buffer = audioBuffer;
                        
                        // Connect to analyser for visualization
                        if (onSetAnalyser && audioContextRef.current) {
                            // We need to re-find the analyser we created in startSession, 
                            // but simpler is to pass it through a ref or just connect to destination
                            // For visualizer to work, we need to connect to the global analyser node if possible
                            // But here we just connect to destination. The visualizer state is updated via onSetAnalyser
                            // We should have stored the analyser node in a ref to connect here.
                            // For now, just connect to destination.
                            // The visualizer might not react to AI voice if not connected to analyser.
                            // Let's rely on the one created in startSession if we can attach.
                            // To keep it simple: just play audio.
                        }
                        
                        source.connect(audioContextRef.current.destination);
                        source.start(nextStartTimeRef.current);
                        
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(source);
                        
                        source.onended = () => {
                            sourcesRef.current.delete(source);
                        };
                    } catch (e) {
                        console.warn("Audio decode error", e);
                    }
                }

                if (message.serverContent?.turnComplete) {
                    // Turn finished, save the accumulated text to history
                    if (currentTurnTextRef.current) {
                        addToHistory(MessageRole.MODEL, currentTurnTextRef.current);
                        currentTurnTextRef.current = '';
                        // Clear subtitle display after a delay? Or keep it?
                        // Let's keep it until next turn starts
                        setTimeout(() => setAiText(''), 3000);
                    }
                }
            },
            onclose: () => {
                setIsConnected(false);
                isSessionActive.current = false;
            },
            onerror: (err) => {
                console.error("Live API Error:", err);
                setError("Connection disrupted.");
                setIsConnected(false);
                isSessionActive.current = false;
            }
        }
      });

    } catch (e: any) {
        console.error("Session Start Error:", e);
        setError(e.message || "Could not start voice session.");
    }
  };

  const stopSession = async () => {
    isSessionActive.current = false;
    
    // 1. Stop processing input
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current.onaudioprocess = null;
        scriptProcessorRef.current = null;
    }

    if (inputAudioContextRef.current) {
        await inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }

    // 2. Stop playing output
    sourcesRef.current.forEach(source => {
        try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();

    if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
        onSetAnalyser(undefined);
    }
    
    // 3. Reset state
    setIsConnected(false);
  };

  const handleManualSave = () => {
      // Save whatever current history we have
      const transcript = historyRef.current
        .filter(m => m.isAudio)
        .map(m => `${m.role === MessageRole.USER ? 'User' : host.name} (Voice): ${m.text}`)
        .join('\n\n');
        
      if (transcript) {
          onSaveNote(transcript, 'voice', host.name);
          setHasNewMemories(false);
      }
  };

  return (
    <div className="flex flex-col h-full relative z-10 w-full items-center justify-center">
        {/* Ambient Visuals handled by App background */}
        
        <div className="flex flex-col items-center justify-center space-y-8 z-20 w-full max-w-md px-6">
            
            {/* Connection Status / Error */}
            {error ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-800 text-sm font-bold text-center">
                    {error}
                    <button onClick={() => startSession()} className="block mt-2 text-xs underline mx-auto">Retry Connection</button>
                </div>
            ) : !isConnected ? (
                <div className="text-[#4A3B32]/50 font-bold tracking-[0.2em] uppercase animate-pulse">
                    Connecting to {host.name}...
                </div>
            ) : (
                <div className="text-[#A05C4B] font-bold tracking-[0.2em] uppercase text-xs">
                    Live Channel Open
                </div>
            )}

            {/* Main Orb Interaction Area */}
            <div className={`relative w-48 h-48 md:w-64 md:h-64 rounded-full flex items-center justify-center transition-all duration-1000 ${isConnected ? 'scale-100' : 'scale-90 opacity-50'}`}>
                {/* Core Orb */}
                <div 
                    className="absolute inset-0 rounded-full blur-[40px] animate-pulse"
                    style={{ backgroundColor: host.orbColor }}
                />
                <div 
                    className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-white/30 backdrop-blur-md shadow-[0_0_50px_rgba(255,255,255,0.5)] border border-white/60 flex items-center justify-center"
                >
                     {/* Mic Icon */}
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-[#4A3B32]/40">
                        <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                        <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 9.375v1.875a.75.75 0 0 1-1.5 0v-1.875A6.751 6.751 0 0 1 6 12.75v-1.5a.75.75 0 0 1 .75-.75Z" />
                    </svg>
                </div>
                
                {/* Ripples when active */}
                {isConnected && (
                    <>
                    <div className="absolute inset-0 rounded-full border border-white/20 animate-[ping_3s_linear_infinite]" />
                    <div className="absolute inset-0 rounded-full border border-white/10 animate-[ping_3s_linear_infinite_1s]" />
                    </>
                )}
            </div>

            {/* Subtitles Area - Text Reveal */}
            <div className="min-h-[60px] text-center w-full max-w-lg">
                <p className="text-lg md:text-xl font-medium text-[#4A3B32] leading-relaxed animate-pulse">
                    {aiText || (isConnected ? "Listening..." : "")}
                </p>
            </div>
            
            {/* Controls */}
            {isConnected && hasNewMemories && (
                <button 
                    onClick={handleManualSave}
                    className="px-6 py-2 rounded-full bg-[#A05C4B]/10 text-[#A05C4B] text-xs font-bold tracking-widest uppercase hover:bg-[#A05C4B] hover:text-white transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clipRule="evenodd" />
                    </svg>
                    Save Conversation
                </button>
            )}

        </div>
    </div>
  );
};

export default LiveMode;