import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

vi.mock('dotenv/config', () => ({}));

// Usa o relay REAL de propósito: o toggle é uma flag em memória, sem I/O.
// Com RELAY_AUTO_OFF_SECONDS=0 (tests/setup.ts) não há timer envolvido.
import { startControlServer } from './control.js';
import { isRelayActive } from './relay.js';

const TOKEN = 'control-token-de-teste'; // mesmo valor do tests/setup.ts

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = startControlServer();
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('servidor de controle', () => {
  it('recusa requisição sem token (401) e não altera o estado', async () => {
    const res = await fetch(`${baseUrl}/toggle`, { method: 'POST' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'token inválido ou ausente' });
    expect(isRelayActive()).toBe(false);
  });

  it('recusa token errado (401)', async () => {
    const res = await fetch(`${baseUrl}/toggle`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-errado' },
    });
    expect(res.status).toBe(401);
    expect(isRelayActive()).toBe(false);
  });

  it('POST /toggle alterna o relay e devolve o novo estado', async () => {
    const on = await fetch(`${baseUrl}/toggle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(on.status).toBe(200);
    expect(await on.json()).toEqual({ active: true });
    expect(isRelayActive()).toBe(true);

    const off = await fetch(`${baseUrl}/toggle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(await off.json()).toEqual({ active: false });
    expect(isRelayActive()).toBe(false);
  });

  it('GET /status consulta sem alterar o estado', async () => {
    for (let i = 0; i < 2; i++) {
      const res = await fetch(`${baseUrl}/status`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ active: false });
    }
  });

  it('método/rota desconhecidos respondem 404 com instrução de uso', async () => {
    const cases = [
      { url: `${baseUrl}/`, method: 'GET' },
      { url: `${baseUrl}/toggle`, method: 'GET' }, // método errado na rota certa
      { url: `${baseUrl}/status`, method: 'POST' },
    ];
    for (const { url, method } of cases) {
      const res = await fetch(url, { method, headers: { Authorization: `Bearer ${TOKEN}` } });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'use POST /toggle ou GET /status' });
    }
  });
});
