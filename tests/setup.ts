// Roda antes de qualquer arquivo de teste importar os módulos de src/.
//
// Por que definir TUDO aqui: o src/env.ts carrega o dotenv, e o dotenv NÃO
// sobrescreve variáveis já definidas no processo. Definir valores fictícios
// antes garante duas coisas: (1) os testes são determinísticos e (2) nunca
// usam os segredos do .env real do projeto.
process.env.DISCORD_TOKEN_A = 'token-a-de-teste';
process.env.DISCORD_TOKEN_B = 'token-b-de-teste';
process.env.GUILD_ID = 'guild-de-teste';
process.env.CHANNEL_A_ID = 'canal-a-de-teste';
process.env.CHANNEL_B_ID = 'canal-b-de-teste';
process.env.CONTROL_TOKEN = 'control-token-de-teste';
// Porta 0 = porta efêmera escolhida pelo SO (evita conflito entre testes).
process.env.CONTROL_PORT = '0';
// 0 = sem timer de desligamento automático; testes do relay que precisam do
// timer sobrescrevem este valor localmente com vi.stubEnv.
process.env.RELAY_AUTO_OFF_SECONDS = '0';
