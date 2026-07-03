import 'dotenv/config';
import { once } from 'node:events';
import { Client, GatewayIntentBits } from 'discord.js';
import { registerCommands, handleInteraction } from './commands.js';
import { setupRelay } from './relay.js';
import { startControlServer } from './control.js';

// Validação na fronteira: falha cedo e com mensagem clara se o .env está incompleto.
const REQUIRED_ENV = ['DISCORD_TOKEN_A', 'DISCORD_TOKEN_B', 'GUILD_ID', 'CHANNEL_A_ID', 'CHANNEL_B_ID', 'CONTROL_TOKEN'];
const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`[bot] variáveis faltando no .env: ${missing.join(', ')}`);
  console.error('[bot] são necessários DOIS bots (um por canal de voz do mesmo servidor).');
  process.exit(1);
}

// Dois clients porque o Discord só permite UM canal de voz por usuário por
// servidor: o bot A fica no canal A, o bot B fica no canal B.
function createVoiceClient() {
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

async function main() {
  const readyA = once(clientA, 'clientReady');
  const readyB = once(clientB, 'clientReady');

  await Promise.all([
    clientA.login(process.env.DISCORD_TOKEN_A),
    clientB.login(process.env.DISCORD_TOKEN_B),
  ]);
  await Promise.all([readyA, readyB]);
  console.log(`[bot] logado como ${clientA.user.tag} (canal A) e ${clientB.user.tag} (canal B)`);

  await registerCommands(clientA);
  await setupRelay(clientA, clientB);
  startControlServer();
}

main().catch((err) => {
  console.error('[bot] falha fatal na inicialização:', err);
  process.exit(1);
});
