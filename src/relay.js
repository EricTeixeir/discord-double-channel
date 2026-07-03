import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  EndBehaviorType,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import prism from 'prism-media';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { PcmMixer, FRAME_BYTES } from './mixer.js';

const SILENCE_FRAME = Buffer.alloc(FRAME_BYTES);

let relayActive = false;
const relayEvents = new EventEmitter();

// Desligamento automático: o relay nunca fica ligado mais que este tempo.
// Configurável via RELAY_AUTO_OFF_SECONDS (0 desativa o automático).
const AUTO_OFF_MS = resolveAutoOffMs();
let autoOffTimer = null;

function resolveAutoOffMs() {
  const raw = process.env.RELAY_AUTO_OFF_SECONDS;
  if (raw === undefined || raw === '') return 20_000;
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds < 0) {
    console.error(`[relay] RELAY_AUTO_OFF_SECONDS inválido: "${raw}" — use um inteiro >= 0 (0 desativa)`);
    process.exit(1);
  }
  return seconds * 1000;
}

function setRelayActive(active) {
  if (relayActive === active) return;
  relayActive = active;

  clearTimeout(autoOffTimer);
  autoOffTimer = null;
  if (active && AUTO_OFF_MS > 0) {
    autoOffTimer = setTimeout(() => {
      console.log(`[relay] desligado automaticamente após ${AUTO_OFF_MS / 1000}s`);
      setRelayActive(false);
    }, AUTO_OFF_MS);
  }

  relayEvents.emit('change', relayActive);
}

export function toggleRelay() {
  setRelayActive(!relayActive);
}
export function isRelayActive() { return relayActive; }

export async function setupRelay(clientA, clientB) {
  // Cada client busca o guild pela própria sessão: o adapter de voz é por client.
  const [guildA, guildB] = await Promise.all([
    clientA.guilds.fetch(process.env.GUILD_ID).catch(() => null),
    clientB.guilds.fetch(process.env.GUILD_ID).catch(() => null),
  ]);
  if (!guildA) throw new Error(`bot A (${clientA.user.tag}) não está no servidor ${process.env.GUILD_ID} — convide-o pela URL do OAuth2`);
  if (!guildB) throw new Error(`bot B (${clientB.user.tag}) não está no servidor ${process.env.GUILD_ID} — convide-o pela URL do OAuth2`);

  // O `group` separa as conexões no registro interno da lib, que é indexado
  // por guild+group. Sem isso, o segundo join REAPROVEITA a conexão do bot A
  // e só o move de canal, deixando o bot B fora de tudo.
  const connA = joinVoiceChannel({
    channelId: process.env.CHANNEL_A_ID,
    guildId: guildA.id,
    adapterCreator: guildA.voiceAdapterCreator,
    selfDeaf: false, // precisa estar false para conseguir RECEBER áudio
    group: clientA.user.id,
  });

  const connB = joinVoiceChannel({
    channelId: process.env.CHANNEL_B_ID,
    guildId: guildB.id,
    adapterCreator: guildB.voiceAdapterCreator,
    selfDeaf: false,
    group: clientB.user.id,
  });

  try {
    await Promise.all([
      entersState(connA, VoiceConnectionStatus.Ready, 15_000),
      entersState(connB, VoiceConnectionStatus.Ready, 15_000),
    ]);
  } catch (err) {
    throw new Error(
      'timeout ao conectar nos canais de voz — verifique se os IDs dos canais estão certos ' +
      'e se os dois bots têm permissão de Ver Canal/Conectar/Falar neles',
      { cause: err },
    );
  }
  console.log('[relay] conectado aos dois canais');

  attachAutoReconnect(connA, 'A');
  attachAutoReconnect(connB, 'B');

  // Nunca capturar nenhum dos dois bots (evita qualquer chance de loop de áudio).
  const botIds = new Set([clientA.user.id, clientB.user.id]);
  wireDirection(botIds, connA, connB); // A -> B
  wireDirection(botIds, connB, connA); // B -> A
}

function attachAutoReconnect(connection, label) {
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    console.warn(`[relay] canal ${label} desconectado, tentando reconectar...`);
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      connection.destroy();
      console.error(`[relay] falha ao reconectar canal ${label}, conexão destruída`);
    }
  });
}

function wireDirection(botIds, sourceConn, targetConn) {
  const player = createAudioPlayer();
  targetConn.subscribe(player);

  // Um único stream contínuo por direção enquanto o relay está ativo.
  // Criar um recurso novo por frame (design anterior) recriava o encoder Opus
  // a cada 20ms — a causa do engasgo e do atraso.
  let output = null;

  const startOutput = () => {
    output = new PassThrough();
    player.play(createAudioResource(output, { inputType: StreamType.Raw }));
  };
  const stopOutput = () => {
    const old = output;
    output = null;
    if (old) old.end();
    player.stop();
  };

  relayEvents.on('change', (active) => {
    if (!active) {
      stopOutput();
      return;
    }
    startOutput();
    // Quem já estava NO MEIO de uma fala quando o relay ligou não dispara
    // outro evento 'start' até pausar — assina esses imediatamente.
    for (const userId of sourceConn.receiver.speaking.users.keys()) {
      subscribeUser(userId);
    }
  });
  if (relayActive) startOutput();

  // Enquanto ativo, sempre escreve um frame por tick (mix ou silêncio): o
  // stream nunca "seca", então o player não desiste dele entre falas.
  // Efeito colateral útil: o bot fica com o anel verde de fala enquanto o
  // relay está ligado — indicador visual de que os times estão se ouvindo.
  const mixer = new PcmMixer((frame) => {
    if (!output) return;
    output.write(frame ?? SILENCE_FRAME);
  });

  const subscribeUser = (userId) => {
    if (botIds.has(userId)) return; // nunca capturar os próprios bots
    if (mixer.has(userId)) return; // já assinado: não duplicar decoder

    const opusStream = sourceConn.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 200 },
    });
    opusStream.on('error', (err) => console.error(`[relay] erro no stream opus de ${userId}:`, err.message));

    const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
    const pcmStream = opusStream.pipe(decoder);

    mixer.addSource(userId, pcmStream);
  };

  sourceConn.receiver.speaking.on('start', (userId) => {
    if (!relayActive) return;
    subscribeUser(userId);
  });

  sourceConn.receiver.speaking.on('end', (userId) => {
    mixer.removeSource(userId);
  });
}
