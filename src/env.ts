// Validação na fronteira: falha cedo e com mensagem clara se o .env está incompleto.
// Este módulo é a única fonte das variáveis obrigatórias — quem importa daqui
// recebe strings garantidas, sem precisar revalidar em cada uso.
import 'dotenv/config';

const REQUIRED_ENV = [
  'DISCORD_TOKEN_A',
  'DISCORD_TOKEN_B',
  'GUILD_ID',
  'CHANNEL_A_ID',
  'CHANNEL_B_ID',
  'CONTROL_TOKEN',
] as const;

const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`[bot] variáveis faltando no .env: ${missing.join(', ')}`);
  console.error('[bot] são necessários DOIS bots (um por canal de voz do mesmo servidor).');
  process.exit(1);
}

// Os `!` são seguros: o check acima encerra o processo se algo estiver faltando.
export const env = {
  DISCORD_TOKEN_A: process.env.DISCORD_TOKEN_A!,
  DISCORD_TOKEN_B: process.env.DISCORD_TOKEN_B!,
  GUILD_ID: process.env.GUILD_ID!,
  CHANNEL_A_ID: process.env.CHANNEL_A_ID!,
  CHANNEL_B_ID: process.env.CHANNEL_B_ID!,
  CONTROL_TOKEN: process.env.CONTROL_TOKEN!,
} as const;
