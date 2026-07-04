// Mixer simples: soma frames PCM de múltiplos speakers a cada 20ms
// e clipa o resultado. Suficiente para conversas casuais entre poucos jogadores.

import type { Readable } from 'node:stream';

export const FRAME_BYTES = 3840; // 960 samples * 2 canais * 2 bytes (16-bit)

// Teto de 3 frames (60ms) por falante: é o atraso máximo que o buffer pode
// introduzir. Acima disso descartamos o frame mais antigo — perder 20ms de
// fala é imperceptível; acumular atraso crescente não é.
const MAX_QUEUE_FRAMES = 3;

// Recebe o frame mixado, ou null se ninguém falou neste tick.
type OnFrame = (frame: Buffer | null) => void;

export class PcmMixer {
  private readonly sources = new Map<string, Buffer[]>(); // userId -> fila de frames PCM pendentes
  private readonly onFrame: OnFrame;
  private readonly interval: NodeJS.Timeout;

  constructor(onFrame: OnFrame) {
    this.onFrame = onFrame;
    this.interval = setInterval(() => this._tick(), 20);
  }

  has(userId: string): boolean {
    return this.sources.has(userId);
  }

  addSource(userId: string, pcmStream: Readable): void {
    const queue: Buffer[] = [];
    this.sources.set(userId, queue);
    pcmStream.on('data', (chunk: Buffer) => {
      queue.push(chunk);
      if (queue.length > MAX_QUEUE_FRAMES) queue.shift();
    });
    pcmStream.on('end', () => this.removeSource(userId));
    pcmStream.on('error', (err: Error) => {
      console.error(`[mixer] erro no stream de ${userId}:`, err.message);
      this.removeSource(userId);
    });
  }

  removeSource(userId: string): void {
    this.sources.delete(userId);
  }

  private _tick(): void {
    const frames: Buffer[] = [];
    for (const queue of this.sources.values()) {
      const frame = queue.shift();
      if (frame && frame.length === FRAME_BYTES) frames.push(frame);
    }

    if (frames.length === 0) {
      this.onFrame(null);
      return;
    }
    if (frames.length === 1) {
      this.onFrame(frames[0]); // caso comum (1 falante): sem custo de mixagem
      return;
    }

    const mixed = Buffer.alloc(FRAME_BYTES);
    for (let i = 0; i < FRAME_BYTES; i += 2) {
      let sample = 0;
      for (const frame of frames) sample += frame.readInt16LE(i);
      sample = Math.max(-32768, Math.min(32767, sample)); // clip
      mixed.writeInt16LE(sample, i);
    }
    this.onFrame(mixed);
  }

  destroy(): void {
    clearInterval(this.interval);
  }
}
