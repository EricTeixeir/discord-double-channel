import { afterEach, describe, expect, it, vi } from 'vitest';

// Sem isto, cada import fresco de env.ts releria o .env real do projeto e
// repovoaria a variável que o teste apagou de propósito.
vi.mock('dotenv/config', () => ({}));

async function importEnvFresh() {
  vi.resetModules();
  return import('./env.js');
}

describe('env', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exporta as variáveis obrigatórias quando todas estão presentes', async () => {
    const { env } = await importEnvFresh();
    // Valores definidos em tests/setup.ts
    expect(env.DISCORD_TOKEN_A).toBe('token-a-de-teste');
    expect(env.DISCORD_TOKEN_B).toBe('token-b-de-teste');
    expect(env.GUILD_ID).toBe('guild-de-teste');
    expect(env.CHANNEL_A_ID).toBe('canal-a-de-teste');
    expect(env.CHANNEL_B_ID).toBe('canal-b-de-teste');
    expect(env.CONTROL_TOKEN).toBe('control-token-de-teste');
  });

  it('encerra o processo listando exatamente as variáveis faltantes', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit chamado');
    }) as never);

    const savedGuild = process.env.GUILD_ID;
    const savedToken = process.env.CONTROL_TOKEN;
    delete process.env.GUILD_ID;
    delete process.env.CONTROL_TOKEN;
    try {
      await expect(importEnvFresh()).rejects.toThrow('process.exit chamado');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('GUILD_ID, CONTROL_TOKEN'));
    } finally {
      process.env.GUILD_ID = savedGuild;
      process.env.CONTROL_TOKEN = savedToken;
    }
  });

  it('trata string vazia como variável faltante', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit chamado');
    }) as never);

    vi.stubEnv('DISCORD_TOKEN_B', '');
    try {
      await expect(importEnvFresh()).rejects.toThrow('process.exit chamado');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
