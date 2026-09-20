import { useCallback, useEffect, useRef, useState } from 'react';

// A tiny original arcade chime synthesized on demand. No audio download and no
// automatic playback. This is not a recording extracted from Sonic Forces.
export function useRingSound() {
  const context = useRef<AudioContext | null>(null);
  const enabled = useRef(false);
  const nodes = useRef(new Set<OscillatorNode>());
  const [sound, setSound] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const lastPlay = useRef(0);
  const play = useCallback(async (complete = false) => {
    if (!enabled.current) return;
    try {
      const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) throw new Error('Audio unsupported');
      const audio = context.current ?? (context.current = new Constructor());
      if (audio.state === 'suspended') await audio.resume();
      if (!enabled.current || audio.state !== 'running' || audio.currentTime - lastPlay.current < 0.07) return;
      lastPlay.current = audio.currentTime;
      const tones = complete ? [1046.5, 1318.5, 1568, 2093] : [1318.5, 2093];
      tones.forEach((frequency, i) => {
        const oscillator = audio.createOscillator(); const gain = audio.createGain();
        const start = audio.currentTime + i * 0.075;
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.075, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
        oscillator.connect(gain); gain.connect(audio.destination);
        nodes.current.add(oscillator);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); nodes.current.delete(oscillator); };
        oscillator.start(start); oscillator.stop(start + 0.25);
      });
    } catch { enabled.current = false; setSound(false); setUnavailable(true); }
  }, []);
  const toggle = useCallback(() => {
    enabled.current = !enabled.current; setSound(enabled.current);
    if (enabled.current) { lastPlay.current = -1; void play(); }
    else { nodes.current.forEach(node => { try { node.stop(); } catch { /* already ended */ } }); }
  }, [play]);
  useEffect(() => () => { enabled.current = false; void context.current?.close().catch(() => {}); }, []);
  return { sound, unavailable, toggle, play };
}
