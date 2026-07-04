# CS Trash Talk Bot

Relay de voz temporário entre dois canais do Discord, para simular "trash talk" em
partidas privadas de CS entre amigos. Enquanto ativo, quem fala no canal do Time A é
ouvido no canal do Time B, e vice-versa. Liga e desliga por botão no Discord ou por
tecla de atalho (F8) sem sair do jogo.

> Uso entre amigos cientes do recurso. O bot fica com o anel verde de fala enquanto o
> relay está ativo, então dá pra ver quando os times estão se ouvindo.

## Como funciona

```
[Canal A] --voz--> Bot A ---\                /--- Bot B --voz--> [Canal B]
                             >-- 1 processo -<
[Canal B] --voz--> Bot B ---/    Node.js      \--- Bot A --voz--> [Canal A]

   /trashtalk (botão no Discord)  ou  F8 (AutoHotkey -> HTTP na porta 3123)
```

- **Dois bots** porque o Discord só permite um canal de voz por usuário por servidor.
  O bot A fica no canal do Time A e é dono do comando `/trashtalk`; o bot B só segura
  o canal do Time B.
- O toggle é uma flag em memória — os bots ficam conectados o tempo todo, então ligar
  e desligar é instantâneo.
- Tudo roda num único container Docker. Não precisa de porta aberta para o Discord
  (o bot é cliente); a única porta exposta é a do controle por hotkey (3123).

## Requisitos

- Docker + Docker Compose
- Duas aplicações de bot no [Discord Developer Portal](https://discord.com/developers/applications)

## Setup

### 1. Criar os dois bots no Developer Portal

Para **cada um** dos dois bots (ex.: "CS Trashtalk" e "CS Trashtalk B"):

1. **New Application** → aba **Bot** → **Reset Token** → guarde o token.
2. Aba **OAuth2 → URL Generator**: marque o scope `bot` (no bot A, marque também
   `applications.commands`) e as permissões `View Channels`, `Connect`, `Speak`,
   `Use Voice Activity`. Abra a URL gerada e convide para o servidor.

Nenhum intent privilegiado é necessário.

### 2. Configurar o `.env`

```bash
cp .env.example .env
```

| Variável | O que é |
|---|---|
| `DISCORD_TOKEN_A` | Token do bot A (canal do Time A, dono do `/trashtalk`) |
| `DISCORD_TOKEN_B` | Token do bot B (canal do Time B) |
| `GUILD_ID` | ID do servidor (modo desenvolvedor → botão direito → Copiar ID) |
| `CHANNEL_A_ID` | ID do canal de voz do Time A |
| `CHANNEL_B_ID` | ID do canal de voz do Time B |
| `CONTROL_TOKEN` | Senha do controle por hotkey — gere com `openssl rand -hex 24` |
| `CONTROL_BIND` | Opcional. `127.0.0.1` (padrão, só a própria máquina) ou `0.0.0.0` (VPS, aceita F8 de fora) |
| `RELAY_AUTO_OFF_SECONDS` | Opcional. Desliga o relay sozinho após N segundos ligado (padrão: `20`; `0` desativa o automático) |

### 3. Subir

```bash
docker compose up -d --build
docker compose logs -f csbot   # deve mostrar "conectado aos dois canais"
```

## Uso

- **Pelo Discord (qualquer PC/celular, zero setup):** `/trashtalk` → clique no botão.
- **Por tecla (F8, funciona com o jogo em tela cheia):**
  1. Instale o [AutoHotkey v2](https://www.autohotkey.com) (`winget install AutoHotkey.AutoHotkey`).
  2. Copie `trashtalk.example.ahk` para `trashtalk.ahk` e preencha no topo do arquivo:
     - `baseUrl` — `http://127.0.0.1:3123` no PC que roda o bot, ou `http://IP_DA_VPS:3123`
       de qualquer outro PC.
     - `token` — o mesmo `CONTROL_TOKEN` do `.env`.
  3. Dois cliques no `trashtalk.ahk`. Beep agudo = ligou, beep grave = desligou.
  4. Para iniciar com o Windows: atalho do arquivo em `Win+R` → `shell:startup`.

O estado é um só: botão do Discord e F8 controlam a mesma chave, de qualquer origem.

O relay **desliga sozinho após 20 segundos** ligado (pensado para o timing de fim de
round) — apertar de novo antes disso desliga na hora. O tempo é configurável via
`RELAY_AUTO_OFF_SECONDS`.

Todos no canal sabem quando estão sendo ouvidos: ao abrir, os bots tocam um **toque
subindo** nos dois canais; ao fechar (manual ou automático), um **toque descendo** —
além do anel verde de fala aceso enquanto estiver ativo.

## Desenvolvimento

O código-fonte é TypeScript (`src/`), compilado para `dist/` no build da imagem Docker.

```bash
pnpm install       # instala dependências (inclui as de desenvolvimento)
pnpm test          # roda os testes unitários (Vitest)
pnpm run typecheck # checagem de tipos de src/ + tests/
pnpm run build     # compila src/ -> dist/ (o Docker faz isso sozinho)
```

Os testes não tocam a API do Discord nem leem o seu `.env` — todos os valores
sensíveis são substituídos por fictícios em `tests/setup.ts`.

## Deploy na VPS

```bash
git clone <repo> && cd <repo>
cp .env.example .env    # preencher com os MESMOS valores usados localmente
# no .env da VPS, descomente/adicione: CONTROL_BIND=0.0.0.0
docker compose up -d --build
```

- Libere a porta **3123/tcp** no firewall da VPS (ex.: `ufw allow 3123/tcp`).
- **Nunca rode o bot em dois lugares ao mesmo tempo** (local + VPS): os mesmos tokens
  logados duas vezes brigam pelas conexões de voz. Pare o local antes
  (`docker compose down`).

## API de controle (o que o F8 usa)

Todas as rotas exigem `Authorization: Bearer <CONTROL_TOKEN>`.

| Rota | Efeito |
|---|---|
| `POST /toggle` | Alterna o relay; responde `{"active": true\|false}` |
| `GET /status` | Só consulta o estado |

## Segurança

- `.env` e `trashtalk.ahk` estão no `.gitignore` porque contêm segredos — **não** os
  versione; use os arquivos `.example` como modelo.
- O controle remoto viaja em HTTP puro; o token é a única proteção. Para esse escopo
  (ligar/desligar um relay) o risco é baixo. Se a VPS tiver domínio, dá para colocar
  HTTPS na frente com Caddy/nginx.
- O bot não grava nada em disco — o áudio é retransmitido em memória, em tempo real.

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| `TokenInvalid` no log | Token errado/vazio no `.env` |
| `variáveis faltando no .env` | O log diz exatamente quais preencher |
| `timeout ao conectar nos canais de voz` | IDs de canal errados ou bots sem permissão de Conectar/Falar |
| F8 não faz nada (nem beep) | O `trashtalk.ahk` não está rodando (procure o ícone "H" na bandeja) |
| Beep de erro no F8 | Bot fora do ar, `baseUrl` errada ou porta bloqueada no firewall |
| Beep + aviso de token | `token` do `.ahk` diferente do `CONTROL_TOKEN` do `.env` |
