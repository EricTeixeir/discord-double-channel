import { describe, expect, it } from 'vitest';
import { ON_CUE, OFF_CUE, cueDurationMs } from './cues.js';

const SAMPLE_RATE = 48000;
const BYTES_PER_SAMPLE = 4; // 2 canais * 16-bit

describe('cues', () => {
  it('gera os dois cues com a duração esperada (120ms + 30ms + 180ms = 330ms)', () => {
    expect(cueDurationMs(ON_CUE)).toBeCloseTo(330, 0);
    expect(cueDurationMs(OFF_CUE)).toBeCloseTo(330, 0);
  });

  it('alinha os buffers a amostras estéreo inteiras (múltiplos de 4 bytes)', () => {
    expect(ON_CUE.length % BYTES_PER_SAMPLE).toBe(0);
    expect(OFF_CUE.length % BYTES_PER_SAMPLE).toBe(0);
  });

  it('duplica o mesmo valor nos canais esquerdo e direito (estéreo)', () => {
    // Amostra alguns pontos ao longo do buffer em vez de varrer tudo.
    for (const cue of [ON_CUE, OFF_CUE]) {
      for (let i = 0; i < cue.length; i += 4096 * BYTES_PER_SAMPLE) {
        expect(cue.readInt16LE(i)).toBe(cue.readInt16LE(i + 2));
      }
    }
  });

  it('começa e termina perto do silêncio (rampa anti-clique)', () => {
    for (const cue of [ON_CUE, OFF_CUE]) {
      expect(cue.readInt16LE(0)).toBe(0);
      // Última amostra: a rampa de saída leva o tom de volta a quase zero.
      expect(Math.abs(cue.readInt16LE(cue.length - BYTES_PER_SAMPLE))).toBeLessThan(100);
    }
  });

  it('mantém as amostras dentro do volume configurado (sem estouro de 16-bit)', () => {
    // volume 0.25 => teto teórico de 0.25 * 32767 ≈ 8192
    for (let i = 0; i < ON_CUE.length; i += 2) {
      expect(Math.abs(ON_CUE.readInt16LE(i))).toBeLessThanOrEqual(8192);
    }
  });

  it('cueDurationMs converte bytes de PCM em milissegundos', () => {
    const oneSecond = Buffer.alloc(SAMPLE_RATE * BYTES_PER_SAMPLE);
    expect(cueDurationMs(oneSecond)).toBe(1000);
    expect(cueDurationMs(Buffer.alloc(0))).toBe(0);
  });
});
