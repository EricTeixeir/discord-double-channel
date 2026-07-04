import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv/config', () => ({}));

// Dublê do REST: os testes não podem falar com a API do Discord.
const putMock = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock('discord.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('discord.js')>();
  class FakeREST {
    setToken() { return this; }
    put = putMock;
  }
  return { ...actual, REST: FakeREST };
});

vi.mock('./relay.js', () => ({
  toggleRelay: vi.fn(),
  isRelayActive: vi.fn(() => false),
}));

import { Routes, type Client, type Interaction } from 'discord.js';
import { registerCommands, handleInteraction } from './commands.js';
import { toggleRelay, isRelayActive } from './relay.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isRelayActive).mockReturnValue(false);
});

describe('registerCommands', () => {
  it('registra o /trashtalk como comando de guild do bot A', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const client = { user: { id: 'app-do-bot-a' } } as Client<true>;

    await registerCommands(client);

    expect(putMock).toHaveBeenCalledExactlyOnceWith(
      Routes.applicationGuildCommands('app-do-bot-a', 'guild-de-teste'),
      { body: [expect.objectContaining({ name: 'trashtalk' })] },
    );
  });
});

// Dublês mínimos: só o que o handleInteraction realmente consulta.
function fakeSlashInteraction(commandName: string) {
  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    commandName,
    reply: vi.fn(async (_message: unknown) => {}),
  };
}

function fakeButtonInteraction(customId: string) {
  return {
    isChatInputCommand: () => false,
    isButton: () => true,
    customId,
    update: vi.fn(async (_message: unknown) => {}),
  };
}

describe('handleInteraction', () => {
  it('/trashtalk responde com o painel (embed + botão) sem alterar o relay', async () => {
    const interaction = fakeSlashInteraction('trashtalk');
    await handleInteraction(interaction as unknown as Interaction);

    expect(interaction.reply).toHaveBeenCalledOnce();
    const message = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ data: { description: string } }>;
      components: unknown[];
    };
    expect(message.embeds[0].data.description).toContain('Inativo');
    expect(message.components).toHaveLength(1);
    expect(toggleRelay).not.toHaveBeenCalled();
  });

  it('o painel reflete o estado ativo', async () => {
    vi.mocked(isRelayActive).mockReturnValue(true);
    const interaction = fakeSlashInteraction('trashtalk');
    await handleInteraction(interaction as unknown as Interaction);

    const message = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ data: { description: string } }>;
    };
    expect(message.embeds[0].data.description).toContain('ATIVO');
  });

  it('clique no botão alterna o relay e atualiza a mensagem', async () => {
    const interaction = fakeButtonInteraction('relay_toggle');
    await handleInteraction(interaction as unknown as Interaction);

    expect(toggleRelay).toHaveBeenCalledOnce();
    expect(interaction.update).toHaveBeenCalledOnce();
  });

  it('ignora comandos e botões que não são dele', async () => {
    const outroComando = fakeSlashInteraction('outro');
    await handleInteraction(outroComando as unknown as Interaction);
    expect(outroComando.reply).not.toHaveBeenCalled();

    const outroBotao = fakeButtonInteraction('outro_botao');
    await handleInteraction(outroBotao as unknown as Interaction);
    expect(outroBotao.update).not.toHaveBeenCalled();
    expect(toggleRelay).not.toHaveBeenCalled();
  });
});
