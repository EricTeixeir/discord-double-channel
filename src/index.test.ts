import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

vi.mock('dotenv/config', () => ({}));

// O index.ts executa main() no import, então todos os colaboradores viram
// dublês e as asserções são sobre a ORQUESTRAÇÃO: logins, ordem de setup e
// roteamento de interações.
const mocks = vi.hoisted(() => ({
  registerCommands: vi.fn(async () => {}),
  handleInteraction: vi.fn(async () => {}),
  setupRelay: vi.fn(async () => {}),
  startControlServer: vi.fn(),
  clients: [] as FakeClient[],
}));

class FakeClient extends EventEmitter {
  user: { tag: string } | null = null;
  login = vi.fn(async (token: string) => {
    this.user = { tag: `bot-fake-${mocks.clients.indexOf(this)}` };
    // O client real emite clientReady depois do login resolver.
    queueMicrotask(() => this.emit('clientReady', this));
    return token;
  });
  isReady() { return true; }
  constructor(_options: unknown) {
    super();
    mocks.clients.push(this);
  }
}

vi.mock('./commands.js', () => ({
  registerCommands: mocks.registerCommands,
  handleInteraction: mocks.handleInteraction,
}));
vi.mock('./relay.js', () => ({ setupRelay: mocks.setupRelay }));
vi.mock('./control.js', () => ({ startControlServer: mocks.startControlServer }));
vi.mock('discord.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('discord.js')>();
  return { ...actual, Client: FakeClient };
});

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  await import('./index.js');
  // main() é assíncrono; espera a última etapa da inicialização.
  await vi.waitFor(() => expect(mocks.startControlServer).toHaveBeenCalled());
});

describe('index (bootstrap)', () => {
  it('cria dois clients e loga cada um com o token certo', () => {
    expect(mocks.clients).toHaveLength(2);
    const [clientA, clientB] = mocks.clients;
    expect(clientA.login).toHaveBeenCalledExactlyOnceWith('token-a-de-teste');
    expect(clientB.login).toHaveBeenCalledExactlyOnceWith('token-b-de-teste');
  });

  it('registra o comando só no bot A e liga o relay entre os dois', () => {
    const [clientA, clientB] = mocks.clients;
    expect(mocks.registerCommands).toHaveBeenCalledExactlyOnceWith(clientA);
    expect(mocks.setupRelay).toHaveBeenCalledExactlyOnceWith(clientA, clientB);
  });

  it('inicia o servidor de controle uma única vez', () => {
    expect(mocks.startControlServer).toHaveBeenCalledOnce();
  });

  it('encaminha interações do bot A para o handler', () => {
    const [clientA, clientB] = mocks.clients;
    const interaction = { id: 'interacao-fake' };

    clientA.emit('interactionCreate', interaction);
    expect(mocks.handleInteraction).toHaveBeenCalledExactlyOnceWith(interaction);

    // O bot B não responde interações — nenhum listener registrado.
    clientB.emit('interactionCreate', interaction);
    expect(mocks.handleInteraction).toHaveBeenCalledOnce();
  });
});
