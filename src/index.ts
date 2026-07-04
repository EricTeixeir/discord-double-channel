// A importação de env.js vem primeiro de propósito: ela carrega o .env e
// valida as variáveis obrigatórias antes de qualquer outro módulo executar.
import './env.js';
import { once } from 'node:events';
import { Client, GatewayIntentBits } from 'discord.js';
import { env } from './env.js';
import { registerCommands, handleInteraction } from './commands.js';
import { setupRelay } from './relay.js';
import { startControlServer } from './control.js';

// Dois clients porque o Discord só permite UM canal de voz por usuário por
// servidor: o bot A fica no canal A, o bot B fica no canal B.
function createVoiceClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });
}

const clientA = createVoiceClient();
const clientB = createVoiceClient();

// Só o bot A é dono do slash command e responde interações.
clientA.on('interactionCreate', (interaction) => handleInteraction(interaction));
clientA.on('error', (err) => console.error('[client A error]', err));
clientB.on('error', (err) => console.error('[client B error]', err));

async function main(): Promise<void> {
  const readyA = once(clientA, 'clientReady');
  const readyB = once(clientB, 'clientReady');

  await Promise.all([
    clientA.login(env.DISCORD_TOKEN_A),
    clientB.login(env.DISCORD_TOKEN_B),
  ]);
  await Promise.all([readyA, readyB]);

  // O evento 'clientReady' garante que `user` está preenchido; este guard só
  // materializa isso para o compilador (narrowing para Client<true>).
  if (!clientA.isReady() || !clientB.isReady()) {
    throw new Error('clients não ficaram prontos após o login');
  }
  console.log(`[bot] logado como ${clientA.user.tag} (canal A) e ${clientB.user.tag} (canal B)`);

  await registerCommands(clientA);
  await setupRelay(clientA, clientB);
  startControlServer();
}

main().catch((err) => {
  console.error('[bot] falha fatal na inicialização:', err);
  process.exit(1);
});
