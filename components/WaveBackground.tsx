import React from 'react';

const WonderlandBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-[#D9C7A7]">
       {/* Alentejo Wheat Waves Gradient */}
       <div 
         className="absolute inset-0 bg-gradient-to-b from-[#D9C7A7] via-[#A89FAC] to-[#A05C4B] animate-breathe opacity-80" 
         style={{ animationDuration: '15s' }} 
       />
       
       {/* Soft Sun/Glow spots - Warm Light */}
       <div className="absolute top-[-20%] left-[-10%] w-[900px] h-[900px] bg-white/40 rounded-full blur-[120px] animate-float" style={{ animationDuration: '25s' }} />
       <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-[#A05C4B]/30 rounded-full blur-[100px] animate-float" style={{ animationDuration: '30s', animationDelay: '-5s' }} />
       <div className="absolute top-[30%] left-[40%] w-[500px] h-[500px] bg-[#D9C7A7]/40 rounded-full blur-[90px] animate-float" style={{ animationDuration: '20s', animationDelay: '-2s' }} />
       
       {/* Texture/Grain for Organic Feel */}
       <div className="absolute inset-0 opacity-20 mix-blend-multiply" style={{ backgroundImage: 'radial-gradient(#8B7355 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }}></div>
    </div>
  );
};

export default WonderlandBackground;