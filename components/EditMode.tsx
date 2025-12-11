import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";

interface EditModeProps {
    onSaveNote: (note: string) => void;
}

const EditMode: React.FC<EditModeProps> = ({ onSaveNote }) => {
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt || isLoading) return;

    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: prompt }
          ]
        },
      });

      let foundImage = false;
      if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                  const base64 = part.inlineData.data;
                  setResultImage(`data:${part.inlineData.mimeType};base64,${base64}`);
                  foundImage = true;
                  break;
              }
          }
      }
    } catch (error) {
      console.error(error);
      alert("The vision faded...");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResultImage(null);
    setPrompt('');
  };

  return (
    <div className="flex flex-col h-full relative z-10 w-full max-w-5xl mx-auto p-6 overflow-y-auto">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-serif italic text-[#4A3B32] magic-text">Dream Weaver</h2>
        <p className="text-[#4A3B32]/50 text-sm mt-1 tracking-wide">Conjure visions from words.</p>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 w-full">
        
        {/* Result View */}
        {resultImage ? (
            <div className="flex flex-col items-center animate-[fade-in-up_0.5s_ease-out] w-full max-w-3xl">
                <div className="relative w-full mist-panel p-4 rounded-3xl shadow-2xl">
                    <img src={resultImage} alt="Dream" className="w-full h-auto rounded-2xl shadow-inner" />
                    
                    {/* Actions */}
                    <div className="absolute bottom-8 right-8 flex gap-3">
                         <a href={resultImage} download="wonderland-dream.png" className="p-3 bg-white/90 rounded-full text-[#4A3B32] hover:text-[#A05C4B] shadow-md transition-transform hover:scale-105">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                        </a>
                        <button onClick={() => onSaveNote(`Dream: ${prompt}`)} className="p-3 bg-white/90 rounded-full text-[#4A3B32] hover:text-[#A05C4B] shadow-md transition-transform hover:scale-105">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Return Key */}
                <button 
                    onClick={handleReset}
                    className="mt-8 px-8 py-3 bg-[#A05C4B] text-white rounded-full uppercase tracking-widest font-bold text-sm shadow-lg hover:bg-[#8B4D3F] transition-all flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                    </svg>
                    Return to Void
                </button>
            </div>
        ) : (
            /* Input View */
            <div className="w-full max-w-2xl flex flex-col gap-6 animate-[fade-in-up_0.5s_ease-out]">
                 <div className="mist-panel rounded-3xl p-10 flex flex-col items-center text-center border border-white/40">
                    <div className="w-full max-w-lg relative">
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe a place that doesn't exist..."
                            className="w-full bg-[#FDFCF8]/50 rounded-xl p-6 text-[#4A3B32] placeholder-[#4A3B32]/30 text-xl font-serif italic focus:outline-none focus:ring-1 focus:ring-[#A05C4B]/20 min-h-[150px] resize-none"
                        />
                        {isLoading && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                <div className="text-[#A05C4B] font-bold tracking-widest uppercase animate-pulse">Weaving Reality...</div>
                            </div>
                        )}
                    </div>
                    
                    <button 
                        onClick={handleGenerate}
                        disabled={!prompt || isLoading}
                        className="mt-8 px-12 py-4 bg-[#A05C4B] hover:bg-[#8B4D3F] text-white rounded-full disabled:opacity-30 uppercase tracking-widest text-sm font-bold transition-all hover:scale-105 shadow-xl disabled:hover:scale-100"
                    >
                        Synthesize
                    </button>
                 </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default EditMode;