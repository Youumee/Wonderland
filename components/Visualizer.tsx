import React, { useEffect, useRef } from 'react';
import { Particle } from '../types';

interface VisualizerProps {
  analyser?: AnalyserNode;
  isActive: boolean;
  colorTheme: string; // hex or instruction
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, isActive, colorTheme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationFrameId = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const initParticles = () => {
      particles.current = [];
      for (let i = 0; i < 60; i++) {
        particles.current.push(createParticle(canvas.width, canvas.height));
      }
    };
    initParticles();

    const render = () => {
      let amplitude = 0;
      if (isActive && analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
        amplitude = sum / bufferLength;
      } else {
        amplitude = 5 + Math.sin(Date.now() / 3000) * 2;
      }

      const ampFactor = amplitude / 255;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.current.forEach((p) => {
        // Gentle float
        p.y -= 0.1 + (p.vy * 0.3);
        p.x += p.vx * 0.3;

        // Active agitation
        if (isActive) {
            p.x += (Math.random() - 0.5) * ampFactor * 8;
            p.y += (Math.random() - 0.5) * ampFactor * 8;
        }

        // Wrap around
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;

        // Draw - Darker particles for light theme
        ctx.beginPath();
        const size = p.size * (1 + ampFactor * 3);
        
        // Use a warm dark brown/terracotta for particles
        ctx.fillStyle = `rgba(160, 92, 75, ${p.alpha * 0.6})`; 
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [analyser, isActive]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-50" />;
};

function createParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 1,
    vy: (Math.random() - 0.5) * 1,
    size: Math.random() * 3 + 1,
    alpha: Math.random() * 0.5 + 0.1,
    life: 100,
    color: ''
  };
}

export default Visualizer;