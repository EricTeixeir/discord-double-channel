// Servidor HTTP para controlar o relay por hotkey (ex.: AutoHotkey).
// Toda requisição exige o token de CONTROL_TOKEN (Authorization: Bearer ...):
// localmente a porta só é publicada em 127.0.0.1, mas o serviço opcional de
// túnel (docker compose --profile tunnel) a expõe na internet — por isso a
// autenticação é obrigatória sempre, não só no caminho remoto.
import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { toggleRelay, isRelayActive } from './relay.js';

const PORT = Number(process.env.CONTROL_PORT ?? 3123);

function tokenMatches(provided) {
  if (!provided) return false;
  // hash de ambos para comparar buffers de tamanho igual em tempo constante
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(process.env.CONTROL_TOKEN).digest();
  return timingSafeEqual(a, b);
}

export function startControlServer() {
  const server = http.createServer((req, res) => {
    const sendJson = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    const provided = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!tokenMatches(provided)) {
      sendJson(401, { error: 'token inválido ou ausente' });
      return;
    }

    if (req.method === 'POST' && req.url === '/toggle') {
      toggleRelay();
      console.log(`[control] relay ${isRelayActive() ? 'LIGADO' : 'desligado'} via hotkey`);
      sendJson(200, { active: isRelayActive() });
      return;
    }
    if (req.method === 'GET' && req.url === '/status') {
      sendJson(200, { active: isRelayActive() });
      return;
    }
    sendJson(404, { error: 'use POST /toggle ou GET /status' });
  });

  server.on('error', (err) => {
    console.error(`[control] falha no servidor de controle (porta ${PORT}):`, err.message);
  });

  // 0.0.0.0 é necessário DENTRO do container para o mapeamento de porta do
  // Docker e para o serviço de túnel alcançarem o processo.
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[control] servidor de controle ouvindo na porta ${PORT}`);
  });
}
