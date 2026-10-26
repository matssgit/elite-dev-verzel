# Deploy — Sprint 4, opção gratuita aprovada

**Estado operacional em 26/10 às 20:48:** credenciais SQL/Blob atualizadas pelo operador, API reiniciada e consumidores verificados. Manutenção ATIVA e cron PAUSADO. API dep-dbfu7q0m7kps73aq84mg live; função com verificação isolada em 19398e8. Cinco auditorias/14 checkpoints preservados, três comprovantes acessíveis, reservas/razão consistentes e uma liquidação pendente. Execução financeira pós-rotação ainda não realizada; chave de assinatura anterior continua pendente de transição. As tentativas anteriores abaixo são históricas.

Atualização Sprint 5 (26/10/2026): fase 1 SQL/Blob autorizada, mas bloqueada antes da troca por rejeição do transporte de segredos via terminal. Nenhuma credencial foi rotacionada. Manutenção retirada, cron reativado e API live em 9c4f084; health 200 e cinco auditorias conferidas às 18:59. Plano/alternativa direta nos painéis em SECURITY_ROTATION.md. Não tratar credenciais anteriores como definitivas nem INTEGRO como garantia contra chave comprometida. Assinatura continua na fase 2, sem troca.

Aplicação: https://elite-dev-verzel-zmats-projects.vercel.app
API/health: https://elite-dev-verzel-api.onrender.com/health
Código: https://github.com/matssgit/elite-dev-verzel
Comprovante de validação: https://elite-dev-verzel-zmats-projects.vercel.app/comprovantes/b4cca429-9a44-4a70-afee-1c796cdbac9f
Auditoria de validação: https://elite-dev-verzel-zmats-projects.vercel.app/auditoria/30ae384d-0b99-4430-8dca-131f51e7bd41

## Serviços efetivamente criados

| Serviço | Recurso/plano | Identidade |
|---|---|---|
| Frontend | Vercel Hobby, Node 24.x, Vite | prj_szjw8K9BQ7T9WAJQpLD28VnhcAeZ |
| API + WebSocket | Render Free, Virginia, 1 instância | srv-dbfoo38ae00c73cqb0r0 |
| PostgreSQL 17 | Neon Free, Virginia | cold-haze-51518470 / br-muddy-mud-b80fr83g (production) |
| Checkpoints | Vercel Blob privado Hobby, Virginia | store_jAwONeQLbcJmOzGK / elite-v1/ |
| Liquidação | Neon Function settlement, Node 24 | https://br-muddy-mud-b80fr83g-settlement.compute.c-14.us-east-1.aws.neon.tech/ |
| Agendamento | Function Trigger a cada minuto UTC | trigger-81af7a75-3b54-4914-ad70-d410cfb95939 |

Nenhum serviço pago/upgrade/autoscaling pago autorizado ou criado. Responsável confirmou ausência de forma de pagamento no workspace Render. Neon retornou subscription_type=free_v3. Vercel permanece Hobby. Franquias excedidas podem suspender o serviço. Recursos de outros projetos não foram reutilizados. Blueprint pago em deploy/render.paid.yaml é somente histórico recusado.

## Configuração e publicação

- Raiz do monorepo na Vercel. vercel.json instala npm ci --include=dev, exige VITE_API_URL HTTPS, compila web, publica apps/web/dist e trata rotas SPA/headers. VITE_API_URL=https://elite-dev-verzel-api.onrender.com.
- WEB_ORIGIN=https://elite-dev-verzel-zmats-projects.vercel.app na API. Essa é a origem canônica para os fluxos: outros aliases Vercel não estão automaticamente liberados para CORS/WebSocket. WSS conecta diretamente à Render.
- Render build: npm ci --include=dev && npm run build -w @elite/api. Start: migrations compiladas, seed idempotente e npm start -w @elite/api. NODE_VERSION=24.22.1, HOST=0.0.0.0, PORT=10000, NODE_ENV=production, ALLOW_DEMO_SEED=true. Sem disco persistente.
- DATABASE_URL usa conexão Neon direta, TLS verify-full. Listener LISTEN/NOTIFY usa conexão dedicada; não trocar pelo pooler de transações/driver HTTP.
- AUDIT_STORAGE=blob, AUDIT_BLOB_PREFIX=elite-v1/. AUDIT_PRIVATE_KEY e BLOB_READ_WRITE_TOKEN configurados somente nos ambientes protegidos da API/função; AUDIT_PUBLIC_KEY_FINGERPRINT fixa a identidade. Nenhum segredo em VITE_*, Git ou arquivos temporários.
- RUN_SETTLEMENT_JOBS=false na API. Neon Function executa processDue e a mesma settleAuction diretamente no banco, sem chamar Render. Trigger cron * * * * * (UTC). A presença do header interno Neon é verificada; Neon documenta que remove headers X-Neon-* fornecidos por clientes. POST público sem header retorna 403.
- Deploy da função: deploy/neon.ts; função existente apenas, sem recriar banco/auth. CLI com sessão no cofre Windows. O helper antigo with-secret-env.mjs foi desativado antes de ler stdin: revisão automática rejeitou o transporte de segredos pela sessão de terminal, mesmo sem eco. Configurar valores diretamente nos campos protegidos dos provedores; não enviar por terminal, argumentos ou arquivos em texto puro.
- Antes de aplicar config: neon config plan --config deploy/neon.ts --project-id cold-haze-51518470 --branch production --profile elite-verzel. Publicar com neon deploy e --no-env-pull para preservar .env local e evitar arquivos de credenciais. A configuração lê os segredos do ambiente, não do código.
- Render auto-deploy está desligado; publicar commit revisado e acionar deploy do serviço explicitamente. Confirmar plan=free em qualquer mudança.

## Evidências realmente executadas

- Três migrations aplicadas ao Neon. Seed de demonstração idempotente concluído na Render; dados existentes não tiveram saldo/prazo reiniciados.
- Frontend e /health HTTP 200 sem sessão. Proteção SSO do projeto removida para publicação pública autorizada.
- Cinco contas novas identificadas como validação; nenhum lote/usuário importante alterado. Login/CORS, catálogo, snapshots, vitrine, lances simultâneos no mesmo lote e entre lotes, reserva/liberação, sem saldo, autossuperação e dois clientes WS aprovados. Sessões do script encerradas.
- Dois lotes com vencedor e um sem lances venceram às 14:29 e foram liquidados pelo Neon às 14:30 de 26/10/2026 (America/Sao_Paulo), com jobs internos da API desativados. Consulta READ ONLY confirmou um comprovante, um PURCHASE e um SALE por lote vencedor; soma zero, nenhuma duplicação, reservas agregadas corretas. Sem lances: nenhuma movimentação/comprovante.
- Auditoria pública INTEGRO. Evidência JSON bruta salva antes de redeploy e verificador independente aprovou quatro eventos assinados/checkpoints. Fingerprint de produção: dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3. Chave pública em AUDIT_PRODUCTION_PUBLIC_KEY.pem.
- Papel SQL elite_verzel_owner sem pg_read_server_files; credencial SQL não é credencial do Blob/controle dos deployments. Esse teste não demonstra proteção contra administrador das plataformas.
- 29/29 testes direcionados após correções compatíveis de Drizzle e Zod; TypeScript, lint e build aprovados. npm audit --omit=dev: zero avisos. Ainda há avisos nas ferramentas de desenvolvimento; não foi aplicado npm audit fix --force.
- Dados das provas ficam em tmp/production-evidence.json, tmp/production-readonly.json e tmp/production-audit-before.json, ignorados pelo Git. Scripts versionados explicam a reprodução sem incluir sessões/credenciais.

## Limitações e provas ainda em andamento

- Persistência após redeploy real: comprovante de R$11, fingerprint e quatro checkpoints permaneceram idênticos após Render dep-dbfouq4s728c738ilkog e novo deployment da função; login permaneceu funcional. É prova de persistência, não de sigilo da chave.
- Teste interrompido retomado sem repetição: lote 8e1b798d-0654-4f4e-b514-933f4d4b7bf7 venceu às 14:55:15.253 e liquidou às 14:56:00.956 de 26/10, pelo cron Neon. Um débito/crédito de R$10, um comprovante fc05d6d1-cd77-4720-9fa7-2a5e5ba47ee6, reservas corretas, três eventos/checkpoints conferidos. Logs do gatilho: failures=0.
- Suspensão física da Render às 14:55: **INCONCLUSIVA**. Eventos e métricas consultados não demonstraram suspensão; série vazia não é zero instâncias. Não foi criado outro lote para repetir a prova. Reconexão WS e login/permissões/logout revalidados às 18:39, sem novas operações financeiras.
- Demonstração original conferida às 18:42: lote 00000000-0000-4000-8000-000000000100 AO_VIVO, fim 26/10 às 20:22 (America/Sao_Paulo), um lance. Seed não renova o prazo; avaliar/criar outro lote pelo painel se a avaliação ocorrer depois, após tratar a rotação.
- Render Free suspende após 15 min sem tráfego de entrada e pode levar aproximadamente um minuto para reativar. Limite de 750 h/mês compartilhado no workspace; tráfego/build também têm franquias. Sem forma de pagamento, excesso suspende/impede build em vez de autorizar cobrança.
- Neon: 100 CU-h/mês; agendamento por minuto mantém o banco acordado. 0,25 CU continuamente por 30 dias equivale a ~180 CU-h. Demonstração curta cabe no orçamento de uso; não há promessa de disponibilidade gratuita indefinida. Functions também têm franquia de compute/invocações. Conferir limites efetivos no console, não habilitar upgrades.
- Blob Hobby: 1 GB, 2 mil operações avançadas e 10 mil simples/mês, além de transferência; quotas compartilhadas. Auditoria financeira exige leitura fresca e pode esgotar operações antes de armazenamento. Excesso bloqueia acesso; aplicação deve falhar fechado, sem ancoragem fictícia.
- Checkpoints são write-once por convenção da aplicação, não WORM. Quem controla token/chave/runtime/contas administrativas pode apagar ou substituir provas. Não declarar auditoria plenamente protegida contra todos os tipos de adulteração.

Fontes oficiais verificadas: [Render Free](https://render.com/docs/free), [Neon Free](https://neon.com/pricing), [Function Triggers](https://neon.com/docs/compute/functions/triggers/schedule), [segredos de função](https://neon.com/docs/compute/functions/environment-variables), [Blob Hobby](https://vercel.com/docs/vercel-blob/usage-and-pricing).
