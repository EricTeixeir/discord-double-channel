import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Determinismo: as variáveis vêm só do tests/setup.ts e dos stubs locais.
vi.mock('dotenv/config', () => ({}));

// O estado do relay (ativo/inativo + timer de auto-off) é global no módulo e
// o AUTO_OFF_MS é resolvido no import — por isso cada teste importa um
// módulo fresco com o RELAY_AUTO_OFF_SECONDS que quer testar.
async function importRelayFresh(autoOffSeconds: string) {
  vi.resetModules();
  vi.stubEnv('RELAY_AUTO_OFF_SECONDS', autoOffSeconds);
  return import('./relay.js');
}

describe('relay (toggle + desligamento automático)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('começa desligado', async () => {
    const relay = await importRelayFresh('0');
    expect(relay.isRelayActive()).toBe(false);
  });

  it('toggleRelay alterna o estado', async () => {
    const relay = await importRelayFresh('0');
    relay.toggleRelay();
    expect(relay.isRelayActive()).toBe(true);
    relay.toggleRelay();
    expect(relay.isRelayActive()).toBe(false);
  });

  it('desliga sozinho após o tempo configurado', async () => {
    const relay = await importRelayFresh('2');
    relay.toggleRelay();
    expect(relay.isRelayActive()).toBe(true);

    vi.advanceTimersByTime(1999);
    expect(relay.isRelayActive()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(relay.isRelayActive()).toBe(false);
  });

  it('religar reinicia a contagem do auto-off do zero', async () => {
    const relay = await importRelayFresh('2');
    relay.toggleRelay(); // liga
    vi.advanceTimersByTime(1500);
    relay.toggleRelay(); // desliga manualmente antes do auto-off
    relay.toggleRelay(); // religa: novo timer cheio de 2s

    vi.advanceTimersByTime(1999);
    expect(relay.isRelayActive()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(relay.isRelayActive()).toBe(false);
  });

  it('desligar manualmente cancela o timer pendente (sem religamento fantasma)', async () => {
    const relay = await importRelayFresh('2');
    relay.toggleRelay(); // liga
    relay.toggleRelay(); // desliga na hora

    vi.advanceTimersByTime(10_000);
    expect(relay.isRelayActive()).toBe(false);
  });

  it('RELAY_AUTO_OFF_SECONDS=0 desativa o desligamento automático', async () => {
    const relay = await importRelayFresh('0');
    relay.toggleRelay();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(relay.isRelayActive()).toBe(true);
    relay.toggleRelay(); // deixa o estado limpo
  });

  it('sem configuração, usa o padrão de 20 segundos', async () => {
    // String vazia cai no caminho do valor padrão (mesmo tratamento de "não definido").
    const relay = await importRelayFresh('');
    relay.toggleRelay();

    vi.advanceTimersByTime(19_999);
    expect(relay.isRelayActive()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(relay.isRelayActive()).toBe(false);
  });

  it('rejeita valor inválido com erro claro e encerra o processo', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit chamado');
    }) as never);

    await expect(importRelayFresh('abc')).rejects.toThrow('process.exit chamado');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('RELAY_AUTO_OFF_SECONDS inválido'));

    await expect(importRelayFresh('-5')).rejects.toThrow('process.exit chamado');
    await expect(importRelayFresh('1.5')).rejects.toThrow('process.exit chamado');
  });
});
