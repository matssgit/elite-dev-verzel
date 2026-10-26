# Elite Dev Verzel

Casa de leilões online do desafio técnico Verzel. **Etapa atual: Sprint 4 — demonstração publicada.** Fluxo de leilões com catálogo/snapshots, lances concorrentes, carteira, anti-sniping, WebSocket, encerramento/liquidação automática, resultados, comprovantes compartilháveis e auditoria pública assinada implementados.

**Aplicação:** https://elite-dev-verzel-zmats-projects.vercel.app · **API:** https://elite-dev-verzel-api.onrender.com/health · **Código:** https://github.com/matssgit/elite-dev-verzel . Contas de demonstração abaixo usam valores simulados, sem pagamentos reais.

Opção gratuita aprovada: Vercel Hobby, Render Free, Neon Free, Blob privado e função Neon agendada por minuto. A API pode levar aproximadamente um minuto para reativar após ociosidade; a liquidação executa diretamente no Neon, independentemente do processo da API. Checkpoints ficam fora do PostgreSQL; chave estável em variáveis protegidas. Storage não é WORM: acesso à chave/token/contas administrativas está fora da proteção contra adulteração apenas do banco. Evidências e limites em [DEPLOY](docs/DEPLOY.md) e [AUDIT](docs/AUDIT.md). Recursos pagos continuam não autorizados; não aplicar `deploy/render.paid.yaml`.

## Stack e organização

Node >=22.12, npm workspaces, TypeScript strict, React/Vite, Tailwind, React Router, TanStack Query, Fastify, Zod, PostgreSQL 17 e Drizzle. `apps/web` é a interface; `apps/api` é o backend; `packages/shared` contém contratos. Detalhes em [arquitetura](docs/ARCHITECTURE.md), [requisitos](docs/REQUIREMENTS.md), [decisões](docs/DECISIONS.md), [API](docs/API_CONTRACT.md) e [status para QA](docs/DEV_STATUS.md).

## Executar localmente

Requer Node.js e Docker Desktop com engine Linux iniciado. Na raiz:

```sh
npm install
```

Copie `.env.example` para `.env` (`Copy-Item .env.example .env` no PowerShell; `cp .env.example .env` no Linux/macOS). Depois:

```sh
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

Aguarde o banco ficar saudável se a migration for executada logo após baixar a imagem. Web: http://localhost:5173 . API: http://localhost:3001/health . O Compose desta etapa executa **apenas o banco**, com volume persistente e porta local 54329. Não remova o volume se quiser preservar dados. Aplicações executam via Node no host.

## Variáveis

| Variável | Uso |
|---|---|
| DATABASE_URL | PostgreSQL usado pela API, migration e seed; obrigatória |
| TEST_DATABASE_URL | Banco PostgreSQL para testes de integração; obrigatório para testes |
| WEB_ORIGIN | Origem autorizada pelo CORS; padrão http://localhost:5173 |
| HOST / PORT | Bind da API, padrão 0.0.0.0:3001 |
| NODE_ENV | development, test ou production |
| VITE_API_URL | Base HTTP da API; padrão /api, proxy local; definir URL HTTPS da API em produção |
| ALLOW_DEMO_SEED | Exigir true explicitamente para seed com NODE_ENV=production |

Não versionar `.env` ou credenciais. Valores da amostra são exclusivamente de desenvolvimento local. Banco de produção deve usar credenciais próprias.

## Banco e migrations

SQL versionado em `apps/api/migrations/`. Runner com transação por arquivo, advisory lock e SHA-256 de cada migration. Arquivos aplicados não devem ser editados; crie uma migration nova. `0001_foundation.sql` cria usuários, sessões, carteiras e razão de depósitos. `0002_auctions.sql` adiciona catálogo, lotes e lances; `0003_settlement_audit.sql` adiciona liquidação, razão por lote, comprovantes e auditoria. Aplicar migrations antes de iniciar a versão nova. Schema tipado em `apps/api/src/db/schema.ts`. Seed idempotente não duplica contas/créditos. No ambiente de demonstração em produção, habilitar seed conscientemente.

## Contas de demonstração

Senha das três contas: `DemoVerzel2026!`.

| E-mail | Perfil | Crédito inicial |
|---|---|---|
| leiloeiro@demo.local | LEILOEIRO | R$ 0,00 |
| ana@demo.local | LICITANTE | R$ 5.000,00 |
| bruno@demo.local | LICITANTE | R$ 5.000,00 |

Essas contas só têm acesso à aplicação; não dão acesso administrativo à infraestrutura. O seed importa livro real da Open Library e cria `/lotes/00000000-0000-4000-8000-000000000100`, iniciado e com duração inicial de 6h, com lance de R$ 50 de Ana. Reexecutar não renova prazo nem duplica lance/crédito. Se o catálogo falhar sem import local, as contas permanecem criadas; repita o seed depois. Após o prazo, publique outro lote pelo painel.

## Verificação e build

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Testes Vitest/Fastify Inject acessam PostgreSQL real indicado em TEST_DATABASE_URL, que precisa das migrations aplicadas. Criam e removem somente seus próprios usuários e registros, sem truncar tabelas. Cobrem autenticação/carteira, lances simultâneos no mesmo lote e entre lotes, outbids cruzados, reserva/liberação, saldo, autossuperação, janela/espera por lock, anti-sniping, idempotência, cancelamento, snapshots, WebSocket, liquidação repetida/concorrente, reinício e adulteração de histórico. Último marco: 34 testes distintos aprovados (regressão 33/33 e direcionados 12/12 após incluir um caso); rodadas reais em DEV_STATUS. Resultados efetivamente executados estão em DEV_STATUS. Navegador conferido com pesquisa, disputa, encerramento automático, resultado do vencedor/vendedor, comprovante e auditoria públicos; ainda sem suíte Playwright versionada.

Build web em `apps/web/dist`; API em `apps/api/dist/server.js`. Para API compilada: `npm start -w @elite/api`, com DATABASE_URL e demais variáveis definidas no ambiente. Migrations ainda executam com `tsx`, portanto a instalação do job de release deve incluir devDependencies.

## Deploy e limitações

Destino planejado: frontend Vercel, backend Render com WebSocket e PostgreSQL persistente sem expiração que afete a avaliação. Ainda sem recursos provisionados, domínios ou credenciais configurados. Publicação é pendente. Antes do deploy, configurar variáveis, CORS, HTTPS, política de proxy, CSP do frontend e job de migrations; verificar publicamente saúde, auth e fluxo completo. Não enviar o desafio antes de implementar os requisitos obrigatórios.

Sessão expira em 24h; token em sessionStorage é acessível a scripts da própria origem. Extrato mostra últimos 50 depósitos. Falha de rede permite repetir depósito com a mesma chave durante a permanência na tela; navegar/recarregar perde a chave em memória. Carteira reserva o lance líder e libera o anterior. Após o prazo, o worker liquida atomicamente (scan a cada 3s e no startup), debita vencedor, credita vendedor e emite comprovante. Auditoria pública usa cadeia/assinaturas e checkpoints fora do banco; veja as garantias condicionais em docs/AUDIT.md. Vitrine até 100 lotes; importação de capas pode levar segundos. WEB_ORIGIN deve corresponder à origem exata usada. Proxy Vite suporta WS; em produção, URL WS deriva de VITE_API_URL.

## Uso de IA

Codex auxilia na leitura visual do edital, arquitetura, documentação, implementação e verificações locais. QA é independente e coordenado pelo responsável; não foi acionado automaticamente. Validação técnica executada e limitações são registradas em DEV_STATUS. Revisão humana e relatório independente devem ser descritos conforme realmente ocorrerem antes da entrega.


## Auditoria e comprovantes

Resultados: /resultados. Comprovantes: /comprovantes/:id. Auditoria: /auditoria/:id. Comprovantes e auditoria não exigem login e não expõem nome/e-mail dos participantes.

A aplicação assina eventos Ed25519 e publica checkpoints independentes do PostgreSQL. Leia [modelo de ameaça e limitações](docs/AUDIT.md). Não há promessa de proteção contra invasor que controle também a chave e os arquivos. Lotes existentes na atualização recebem baseline com aviso explícito, sem autenticidade retroativa.

Desenvolvimento: var/audit armazena chave privada local e checkpoints, ignorados no Git. Em produção, configurar AUDIT_PRIVATE_KEY (PEM PKCS8 secreto, aceita quebra de linha literal ou escape), AUDIT_DIRECTORY (diretório persistente independente do banco), acesso separado do operador SQL e backups. Não montar a chave como VITE_* nem salvá-la no banco. Não apagar var/audit ao limpar dados; preservar/restaurar a chave original. Novo ambiente tem chave/fingerprint próprios. A chave pública em docs/AUDIT_PUBLIC_KEY.pem registra só esta demonstração.

Para verificar uma evidência JSON baixada sem modificar datas/campos:

```sh
node scripts/verify-audit.mjs evidencia.json FINGERPRINT_CONFIAVEL
```

Obter fingerprint por canal independente confiável; a chave entregue pela própria página não é confiança suficiente contra invasão do servidor. Checkpoint ausente gera PENDENTE; divergência gera ADULTERADO e bloqueia operações financeiras. CHECKPOINT_PENDING após commit indica operação registrada: não refazer lance com outra chave.
