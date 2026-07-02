let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new Ctor();
    if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {});
    return sharedCtx;
  } catch {
    return null;
  }
}

function beep(ctx: AudioContext, freq: number, startTime: number, duration: number, volume = 0.18) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

/** Short two-tone chime for incoming chat messages. */
export function playMessageSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  beep(ctx, 880, now, 0.12);
  beep(ctx, 1175, now + 0.1, 0.15);
}

/** Friendlier three-tone chime for friend requests / accepted friend requests. */
export function playFriendSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  beep(ctx, 660, now, 0.12);
  beep(ctx, 880, now + 0.11, 0.12);
  beep(ctx, 1046.5, now + 0.22, 0.18);
}
