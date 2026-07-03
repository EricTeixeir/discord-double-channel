import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, EmbedBuilder } from 'discord.js';
import { toggleRelay, isRelayActive } from './relay.js';

const trashtalkCommand = new SlashCommandBuilder()
  .setName('trashtalk')
  .setDescription('Liga ou desliga o relay de voz entre os dois times');

export async function registerCommands(client) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN_A);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
    { body: [trashtalkCommand.toJSON()] }
  );
  console.log('[bot] slash command /trashtalk registrado');
}

function buildRelayMessage() {
  const active = isRelayActive();
  const embed = new EmbedBuilder()
    .setTitle('Trash Talk Relay')
    .setDescription(active ? '🔴 **ATIVO** — os dois times estão se ouvindo' : '⚪ Inativo')
    .setColor(active ? 0xed4245 : 0x99aab5);

  const button = new ButtonBuilder()
    .setCustomId('relay_toggle')
    .setLabel(active ? 'Desligar relay' : 'Ligar relay')
    .setStyle(active ? ButtonStyle.Danger : ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(button);
  return { embeds: [embed], components: [row] };
}

export async function handleInteraction(interaction) {
  if (interaction.isChatInputCommand() && interaction.commandName === 'trashtalk') {
    await interaction.reply(buildRelayMessage());
    return;
  }

  if (interaction.isButton() && interaction.customId === 'relay_toggle') {
    toggleRelay();
    await interaction.update(buildRelayMessage());
  }
}
