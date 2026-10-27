# Elite Dev Verzel

**27/10, 15:27 — diagnóstico neutro concluído:** autenticação funciona na versão identificada; foram observadas respostas de versões diferentes durante a atualização. Causa interna ainda pendente. Nenhuma nova operação financeira; sessão revogada, manutenção ativa e cron pausado. [Evidências e correção proposta](docs/POST_403_DIAGNOSTIC.md).

**27/10, 14:59 — retomada bloqueada antes da fixture:** POST de preparação rejeitado com 403 após GET autenticado; interrompido sem repetir movimentações. Fonte normal restaurada, cron nunca habilitado, manutenção e bloqueios ativos. Snapshot, 15 checkpoints e quatro comprovantes preservados. Agendamento real ainda pendente; [evidências e diagnóstico seguro](docs/SCHEDULED_SETTLEMENT_VALIDATION_RESULT.md).

**27/10, 14:42 — ensaio agendado interrompido antes do setup:** preflight corrigido após HTTP 404 em rota consultada no serviço errado. Nenhuma movimentação, fixture, deploy ou ativação do cron. Quinze históricos e quatro comprovantes preservados; manutenção ativa. Contenções locais testadas; execução real aguarda nova autorização conforme a condição de parada. [Evidências e pendências](docs/SCHEDULED_SETTLEMENT_VALIDATION_RESULT.md).

**27/10 — rotação da assinatura verificada:** Render e Neon utilizam a chave nova 07e8…94ab2. Quinze checkpoints/assinaturas históricas e quatro comprovantes preservados; manifesto e prova nova conferidos após redeploy sem recriação. **Manutenção financeira ativa e cron pausado, aguardando autorização.** Evidências, pins e recuperação em [AUDIT_KEY_VERIFICATION](docs/AUDIT_KEY_VERIFICATION.md).

Casa de leilões online do desafio técnico Verzel. **Etapa atual: Sprint 5 — segurança e preparação de entrega.** Fluxo de leilões com catálogo/snapshots, lances concorrentes, carteira, anti-sniping, WebSocket, encerramento/liquidação automática, resultados, comprovantes compartilháveis e auditoria pública assinada implementados.

**Aplicação:** https://elite-dev-verzel-zmats-projects.vercel.app · **API:** https://elite-dev-verzel-api.onrender.com/health · **Código:** https://github.com/matssgit/elite-dev-verzel . Contas de demonstração abaixo usam valores simulados, sem pagamentos reais.

Opção gratuita aprovada: Vercel Hobby, Render Free, Neon Free, Blob privado e função Neon agendada por minuto. A API pode levar aproximadamente um minuto para reativar após ociosidade; a liquidação executa diretamente no Neon, independentemente do processo da API. Checkpoints ficam fora do PostgreSQL; chave estável em variáveis protegidas. Storage não é WORM: acesso à chave/token/contas administrativas está fora da proteção contra adulteração apenas do banco. Evidências e limites em [DEPLOY](docs/DEPLOY.md) e [AUDIT](docs/AUDIT.md). Recursos pagos continuam não autorizados; não aplicar `deploy/render.paid.yaml`.

**Estado de segurança e operação:** SQL/Blob e chave ativa substituídos, com consumidores verificados. As identidades expostas são recusadas para assinatura futura; permanecem públicas para verificação histórica delimitada. INTEGRO não garante origem legítima retroativa dos registros antigos, e Blob não é WORM. Evidências e limitações em [AUDIT_KEY_VERIFICATION](docs/AUDIT_KEY_VERIFICATION.md). Ambiente somente de demonstração, com valores simulados e finanças bloqueadas.

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
| AUDIT_STORAGE | blob na demonstração publicada; omitido usa arquivos locais |
| AUDIT_DIRECTORY | Diretório local; produção com arquivos exige armazenamento persistente verificado |
| AUDIT_BLOB_PREFIX | Namespace do store independente; não trocar para ocultar histórico |
| BLOB_READ_WRITE_TOKEN | Segredo protegido do store privado; somente API/função |
| AUDIT_PRIVATE_KEY | Chave Ed25519 PKCS8 em segredo de runtime; nunca VITE_* |
| AUDIT_PUBLIC_KEY_FINGERPRINT | Identidade pública confiável fixada para assinatura |
| RUN_SETTLEMENT_JOBS | false na API publicada; localmente o worker permanece ativo |
| FINANCIAL_MAINTENANCE | true bloqueia escritas financeiras e jobs; exige janela coordenada |

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

Testes Vitest/Fastify Inject acessam PostgreSQL real indicado em TEST_DATABASE_URL. Use banco local de teste com migrations; não executar a suíte no banco da demonstração. Cobrem autenticação/carteira, concorrência entre lances/lotes, reserva/liberação, janela, anti-sniping, idempotência, WebSocket, liquidação e adulteração de histórico, além de falhas/conflitos do Blob e manutenção. Resultados reais em DEV_STATUS: direcionados financeiros/Blob 29/29 na Sprint 4 e manutenção/fundação 11/11 na Sprint 5. O CI do último commit implantado passou. QA independente permanece com o responsável; não há suíte Playwright versionada.

Build web em `apps/web/dist`; API em `apps/api/dist/server.js`. Para API compilada: `npm start -w @elite/api`, com variáveis no ambiente. Após compilar, migrations e seed também funcionam sem tsx: `npm run db:migrate:production -w @elite/api` e `npm run db:seed:production -w @elite/api`. Build requer devDependencies; runtime compilado não precisa de tsx.

## Deploy e limitações

Publicado nos serviços gratuitos descritos em DEPLOY. Render suspende por ociosidade, Neon e Blob têm franquias e podem suspender acesso ao excedê-las; não há promessa de operação gratuita contínua. CORS/WebSocket autorizam a origem canônica informada acima. A prova de suspensão física no horário do lote controlado foi inconclusiva por falta de telemetria; a liquidação pelo cron independente foi confirmada, sem repetir o lote.

Sessão expira em 24h; token Bearer em sessionStorage é acessível a scripts da própria origem. Não usa cookie de autenticação. Extrato mostra as últimas 50 movimentações. Retry de depósito preserva a chave apenas enquanto a tela permanece aberta. Carteira reserva o líder e libera o superado. Depois do prazo, a mesma liquidação transacional debita vencedor, credita vendedor e emite comprovante: localmente no startup/a cada 3s, em produção por cron Neon a cada minuto. Vitrine limitada a 100 lotes, histórico de lances sem paginação. CORS usa uma origem exata; WS deriva de VITE_API_URL.

Concorrência: lock FOR UPDATE no lote e carteiras em ordem de UUID; relógio do PostgreSQL conferido depois dos locks. O mesmo saldo não pode financiar lances simultâneos acima do disponível. O líder não se supera; lance inicial/incremento/período são conferidos no backend. Lance nos últimos 120s soma 120s ao fim vigente. Liquidação usa settledAt, transação e unicidade de comprovante/movimentos para impedir repetição.

## Uso de IA

Codex auxilia na leitura visual do edital, arquitetura, documentação, implementação e verificações locais. QA é independente e coordenado pelo responsável; não foi acionado automaticamente. Validação técnica executada e limitações são registradas em DEV_STATUS. Revisão humana e relatório independente devem ser descritos conforme realmente ocorrerem antes da entrega.


## Auditoria e comprovantes

Resultados: /resultados. Comprovantes: /comprovantes/:id. Auditoria: /auditoria/:id. Comprovantes e auditoria não exigem login e não expõem nome/e-mail dos participantes.

A aplicação assina eventos Ed25519 e publica checkpoints independentes do PostgreSQL. Leia [modelo de ameaça e limitações](docs/AUDIT.md). Não há promessa de proteção contra invasor que controle também a chave e os arquivos. Lotes existentes na atualização recebem baseline com aviso explícito, sem autenticidade retroativa.

Desenvolvimento: var/audit contém chave e checkpoints locais, ignorados no Git. Produção: AUDIT_STORAGE=blob, store privado, chave/token protegidos e pin público; sem arquivos de auditoria no disco efêmero da Render. Preservar checkpoints e identidade; não trocar chave/prefixo sem o procedimento de transição. AUDIT_PUBLIC_KEY.pem identifica apenas o ambiente local; AUDIT_PRODUCTION_PUBLIC_KEY.pem identifica a chave anterior de produção, sob suspeita de exposição. Nenhuma chave privada é publicada.

Para verificar uma evidência JSON baixada sem modificar datas/campos:

```sh
node scripts/verify-audit.mjs evidencia.json dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3 126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1
```

Obter fingerprint por canal independente confiável; a chave entregue pela própria página não é confiança suficiente contra invasão do servidor. Checkpoint ausente gera PENDENTE; divergência gera ADULTERADO e bloqueia operações financeiras. CHECKPOINT_PENDING após commit indica operação registrada: não refazer lance com outra chave.
