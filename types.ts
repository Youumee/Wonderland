export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  image?: string; // base64
  isAudio?: boolean;
}

export interface Note {
  id: string;
  summary: string;
  content: string;
  createdAt: number;
  hostName: string;
  type: 'voice' | 'chat' | 'dream';
}

export type ViewMode = 'landing' | 'chat' | 'notes' | 'edit' | 'live';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  color: string;
}

export interface Host {
  id: string;
  name: string;
  title: string;
  description: string;
  personality: string;
  voiceName: string;
  themeColor: string; // Tailwind color class prefix (e.g., 'rose', 'indigo')
  orbColor: string; // Hex for canvas/glows
  gradient: string; // Background gradient class
}