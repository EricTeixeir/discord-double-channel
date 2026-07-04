// Avisos sonoros tocados nos canais quando o relay liga/desliga.
// Gerados por código (PCM 48kHz estéreo 16-bit) para não depender de
// arquivos de áudio: tom subindo = abriu, tom descendo = fechou.

const SAMPLE_RATE = 48000;
const BYTES_PER_SAMPLE = 4; // 2 canais * 16-bit

function tone(freq: number, ms: number, volume = 0.25): Buffer {
  const samples = Math.round((SAMPLE_RATE * ms) / 1000);
  const buf = Buffer.alloc(samples * BYTES_PER_SAMPLE);
  const fade = Math.min(240, samples / 2); // rampa ~5ms nas pontas, evita "clique"
  for (let i = 0; i < samples; i++) {
    const env = Math.min(1, i / fade, (samples - i) / fade);
    const v = Math.round(Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE) * volume * 32767 * env);
    buf.writeInt16LE(v, i * BYTES_PER_SAMPLE);
    buf.writeInt16LE(v, i * BYTES_PER_SAMPLE + 2);
  }
  return buf;
}

function silence(ms: number): Buffer {
  return Buffer.alloc(Math.round((SAMPLE_RATE * ms) / 1000) * BYTES_PER_SAMPLE);
}

export const ON_CUE = Buffer.concat([tone(660, 120), silence(30), tone(880, 180)]);
export const OFF_CUE = Buffer.concat([tone(880, 120), silence(30), tone(440, 180)]);

export function cueDurationMs(cue: Buffer): number {
  return (cue.length / (SAMPLE_RATE * BYTES_PER_SAMPLE)) * 1000;
}
