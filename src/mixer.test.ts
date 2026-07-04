import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';
import { PcmMixer, FRAME_BYTES } from './mixer.js';

// O mixer só usa .on('data'|'end'|'error') do stream, então um EventEmitter
// puro serve como dublê de Readable.
function fakeStream(): Readable {
  return new EventEmitter() as unknown as Readable;
}

function frameOf(sampleValue: number): Buffer {
  const buf = Buffer.alloc(FRAME_BYTES);
  for (let i = 0; i < FRAME_BYTES; i += 2) buf.writeInt16LE(sampleValue, i);
  return buf;
}

describe('PcmMixer', () => {
  let mixer: PcmMixer;
  let onFrame: Mock<(frame: Buffer | null) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    onFrame = vi.fn<(frame: Buffer | null) => void>();
    mixer = new PcmMixer(onFrame);
  });

  afterEach(() => {
    mixer.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('emite null no tick quando ninguém falou', () => {
    vi.advanceTimersByTime(20);
    expect(onFrame).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('repassa o frame de um único falante sem custo de mixagem', () => {
    const stream = fakeStream();
    mixer.addSource('user-1', stream);
    const frame = frameOf(1234);
    stream.emit('data', frame);

    vi.advanceTimersByTime(20);
    // toBe (mesma instância): comprova que não houve cópia/mixagem.
    expect(onFrame.mock.calls[0][0]).toBe(frame);
  });

  it('soma as amostras de múltiplos falantes', () => {
    const s1 = fakeStream();
    const s2 = fakeStream();
    mixer.addSource('user-1', s1);
    mixer.addSource('user-2', s2);
    s1.emit('data', frameOf(1000));
    s2.emit('data', frameOf(2000));

    vi.advanceTimersByTime(20);
    const mixed = onFrame.mock.calls[0][0] as Buffer;
    expect(mixed.readInt16LE(0)).toBe(3000);
    expect(mixed.readInt16LE(FRAME_BYTES - 2)).toBe(3000);
  });

  it('clipa a soma nos limites de 16-bit (sem overflow)', () => {
    const s1 = fakeStream();
    const s2 = fakeStream();
    mixer.addSource('user-1', s1);
    mixer.addSource('user-2', s2);
    s1.emit('data', frameOf(30000));
    s2.emit('data', frameOf(30000));
    vi.advanceTimersByTime(20);
    expect((onFrame.mock.calls[0][0] as Buffer).readInt16LE(0)).toBe(32767);

    s1.emit('data', frameOf(-30000));
    s2.emit('data', frameOf(-30000));
    vi.advanceTimersByTime(20);
    expect((onFrame.mock.calls[1][0] as Buffer).readInt16LE(0)).toBe(-32768);
  });

  it('limita a fila a 3 frames por falante, descartando os mais antigos', () => {
    const stream = fakeStream();
    mixer.addSource('user-1', stream);
    for (const value of [1, 2, 3, 4, 5]) stream.emit('data', frameOf(value));

    // Os frames 1 e 2 foram descartados; o primeiro tick entrega o 3.
    vi.advanceTimersByTime(20);
    expect((onFrame.mock.calls[0][0] as Buffer).readInt16LE(0)).toBe(3);
  });

  it('ignora frames com tamanho diferente do esperado', () => {
    const stream = fakeStream();
    mixer.addSource('user-1', stream);
    stream.emit('data', Buffer.alloc(10));

    vi.advanceTimersByTime(20);
    expect(onFrame).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('remove a fonte quando o stream termina', () => {
    const stream = fakeStream();
    mixer.addSource('user-1', stream);
    expect(mixer.has('user-1')).toBe(true);

    stream.emit('end');
    expect(mixer.has('user-1')).toBe(false);
  });

  it('remove a fonte e registra o erro quando o stream falha', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stream = fakeStream();
    mixer.addSource('user-1', stream);

    stream.emit('error', new Error('stream quebrou'));
    expect(mixer.has('user-1')).toBe(false);
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('não duplica estado: has() reflete addSource/removeSource', () => {
    expect(mixer.has('user-1')).toBe(false);
    mixer.addSource('user-1', fakeStream());
    expect(mixer.has('user-1')).toBe(true);
    mixer.removeSource('user-1');
    expect(mixer.has('user-1')).toBe(false);
  });

  it('destroy() para o tick de 20ms', () => {
    mixer.destroy();
    vi.advanceTimersByTime(200);
    expect(onFrame).not.toHaveBeenCalled();
  });
});
