# Demonstração isolada — plano aguardando autorização

28/10/2026. **Não provisionado, não publicado.** Produção atual e clone de avaliação não devem ser modificados. Este plano não autoriza operações remotas. Não repetir auditoria nem investigação Neon.

## Recursos e custo

| Novo recurso | Plano proposto | Isolamento |
|---|---|---|
| elite-verzel-demo, frontend Vercel | Hobby, sem trial/upgrade | Projeto novo, domínio próprio *.vercel.app; sem vínculo ao projeto antigo |
| elite-verzel-demo-api, Render | Free, sem disco ou cron pago | Serviço novo, sem env group, sem copiar configuração antiga |
| elite-verzel-demo, PostgreSQL Neon | Free, projeto novo | Não é branch/clone do projeto existente; usuário/senha exclusivos |
| elite-verzel-demo-audit, Vercel Blob | Hobby, privado | Store novo, token próprio e prefixo elite-verzel-demo-v1/ |
| Identidade Ed25519 | Sem custo | Nova chave, sem manifesto/fronteiras/checkpoints de produção |

Reutilizáveis: código/repositório público, ferramentas autenticadas e contas/workspaces gratuitos, **não recursos operacionais**. Contas dos provedores compartilham franquias; isso não é isolamento de quotas. Antes de criar, conferir uso disponível e ausência de cobrança/cartão no Render, plano Hobby Vercel e Free Neon. Se houver plano pago, trial ou custo obrigatório, parar. Não alterar billing nem pausar recursos existentes para liberar quota.

Fontes oficiais consultadas: [Render Free](https://render.com/docs/free), [Blob Hobby e quotas](https://vercel.com/docs/vercel-blob/usage-and-pricing), [Neon Free](https://neon.com/docs/introduction/plans). Custo pretendido US$0, condicionado aos planos/franquias confirmados. Render tem750h/workspace/mês; excedentes de banda/build podem cobrar quando existe forma de pagamento, por isso a ausência deve ser conferida. Hobby Blob bloqueia acesso ao exceder a franquia, sem cobrança adicional. Nenhum upgrade autorizado.

## Configuração real

Valores secretos devem ser inseridos em configurações protegidas do serviço novo ou por transporte HTTPS nativo revisado. Não colar na conversa/terminal do agente, não usar clipboard de chave privada, não executar env pull. URLs reais serão registradas após criação; os nomes abaixo são propostas, não URLs reservadas.

| Variável | Destino | Valor/instrução | Segredo? | Público? |
|---|---|---|---|---|
| DATABASE_URL | API, migrations e seed | Conexão **direta**, TLS, do novo projeto Neon; não usar URL do pooler: realtime usa LISTEN/NOTIFY | Sim | Não |
| NODE_ENV | API | production | Não | Sim |
| NODE_VERSION | Render build/runtime | 24 | Não | Sim |
| HOST | API | 0.0.0.0 | Não | Sim |
| PORT | API | Injetada pelo Render; não fixar porta local | Não | Sim |
| WEB_ORIGIN | API | Origem HTTPS canônica do novo frontend, sem barra final | Não | Sim |
| VITE_API_URL | Vercel build | Origem HTTPS da API nova, sem caminho/credencial | Não | Sim |
| AUDIT_STORAGE | API/seed | blob | Não | Sim |
| AUDIT_BLOB_PREFIX | API/seed | elite-verzel-demo-v1/ | Não | Sim |
| BLOB_READ_WRITE_TOKEN | API/seed | Token restrito ao novo store privado | Sim | Não |
| AUDIT_PRIVATE_KEY | API/seed | Novo Ed25519 PKCS8, persistido como segredo do serviço; não regenerate no boot | Sim | Não |
| AUDIT_PUBLIC_KEY_FINGERPRINT | API/seed | SHA256 do PEM SPKI, exatamente como exportado pelo código | Não | Sim |
| FINANCIAL_MAINTENANCE | API/seed | true inicial; false **somente na demo após conferir isolamento e autorização** | Não | Sim |
| RUN_SETTLEMENT_JOBS | API | false inicial; true somente na demo validada | Não | Sim |
| ALLOW_DEMO_SEED | Seed | false inicial; true no bootstrap exclusivamente demonstrativo | Não | Sim |
| AUDIT_RECOVERY_MODE | API/migrations/seed | false | Não | Sim |
| TEST_DATABASE_URL | Testes locais/CI apenas | PostgreSQL descartável local54331; nunca banco da demo publicada | Sim se remoto | Não |

Não existe JWT_SECRET, cookie de autenticação ou domínio de cookie a configurar: a aplicação usa Bearer opaco, sessões com hash no PostgreSQL e sessionStorage no navegador. CORS autoriza a origem exata; WS deriva de VITE_API_URL e valida origem. Não relaxar nenhum dos dois.

Não copiar AUDIT_TRANSITION_JSON/SHA256, ROTATION_*, SCHEDULED_VALIDATION_*, AUDIT_KEY_MODE, diretórios ou pins de incidente. A demo começa com raiz própria; não simula transição da produção. Isso não desliga verificação de assinatura/checkpoints. AUDIT_REQUIRE_EXISTING_TRANSITION/SIGNING_PROOF pertencem ao procedimento de rotação e não são necessários para uma raiz nova sem transição. Nenhuma variável da produção será apagada ou alterada.

## Identidade e transferência de segredos

Preparado `scripts/prepare-demo-key.mjs`, **somente PowerShell humano nativo**, raiz F:\teste-verzel:

```powershell
node scripts/prepare-demo-key.mjs
```

Ainda não executado. Cria identidade inédita em var/demo-identity/private-key.dpapi, com ACL restrita e DPAPI do usuário Windows; public.json contém apenas PEM público/fingerprint. Recusa sobrescrever diretório existente e não usa rede, clipboard ou arquivos privados em texto claro. Só conferimos sintaxe nesta preparação, não uma geração real.

Não reutilizar scripts de rotação existentes: eles têm IDs de produção fixados. A transferência futura precisará de helper HTTPS exclusivo com allowlist do **novo serviceId**, conferência de nome/workspace e recusa explícita de srv-dbfoo38ae00c73cqb0r0. O agente não deve abrir o DPAPI, acessar chave ou registrar payload/headers. Operador executará o helper no terminal nativo, com token temporário protegido e revogado após uso. Helper ainda não implementado/aplicado: será preparado após conhecer o serviceId novo. Não improvisar transporte pelo terminal ou clipboard para cumprir prazo. Senha SQL/token Blob também serão configurados em painel protegido; não enviados à conversa.

## Sequência proposta após aprovação

1. Conferir quotas/plano/ausência de billing e IDs existentes por leitura. Recusar colisão de nome/ID. Salvar somente inventário público dos **novos** recursos.
2. Revisar arquivos selecionados, diff de readiness e stamp; conferir hooks Git de produção **por leitura**. HEAD e origin/main local estavam50dc16a na revisão anterior. Criar branch codex/elite-verzel-demo e fazer commit/push somente com autorização. Se qualquer push gerar deploy/preview no projeto antigo, parar essa via: não mudar suas configurações. Alternativa: frontend por upload manual em projeto novo e código em repositório novo aprovado; acesso GitHub pode exigir ação humana.
3. Criar Neon Free novo (sem Functions/cron), Vercel Hobby novo e Blob privado novo. Reservar e registrar domínios reais; não vincular store a projeto antigo. Reutilizar vercel.json no novo projeto com root do monorepo, output apps/web/dist; nenhuma cópia de .vercel existente.
4. Executar preparação humana da chave. Configurar secrets diretamente nos novos serviços. API criada com deploy/render.demo.yaml, nome novo e plan:free. Nenhum disco persistente pago: persistência SQL no Neon e checkpoints no Blob. O Blueprint não contém recursos antigos.
5. Conferir serviceId/DB endpoint/storeId/prefixo/fingerprint/origem novos e ausência de heranças. Primeiro boot bloqueado, workerfalse, seedfalse. Start roda migrations não destrutivas existentes e seed (que ignora execução sob manutenção). Confirmar health, runtime e isolamento, sem movimentar recursos antigos.
6. Com aprovação abrangendo o ensaio da demo, mudar **apenas os três flags da demo** para FINANCIAL_MAINTENANCE=false, RUN_SETTLEMENT_JOBS=true, ALLOW_DEMO_SEED=true. Redeploy somente serviço novo. Seed importa item real, cria contas, crédito simulado, lote inicial e lance. Falha externa interrompe bootstrap; não fabricar metadados nem copiar catálogo do banco de produção. Repetição do seed é idempotente.
7. Publicar frontend novo apontando à API nova; CORS fixa essa origem. Walkthrough abaixo; registrar os IDs/evidências públicas. Se falhar assinatura/reserva/isolamento, bloquear **a demo**, interromper teste e preservar evidências, sem compensações automáticas.
8. Publicar somente evidências verdadeiras/URLs verificadas no README e rascunho da submissão. Uma persistência real deve ser testada reiniciando/redeployando **a demo**, após autorização dessa ação; conferir bytes/assinaturas dos checkpoints e comprovante sem repetição financeira.

## Build/start e worker

- API build: `npm ci --include=dev && node scripts/stamp-function-build.mjs && npm run build -w @elite/api`.
- API start: `npm run db:migrate:production -w @elite/api && npm run db:seed:production -w @elite/api && npm start -w @elite/api`.
- Frontend: vercel.json existente, npm ci --include=dev; check-web-env e build web; output apps/web/dist.
- Worker já implementado em app.ts/server.ts: varre vencidos no startup e a cada3s, usando processDue/settleAuction, transação/locks e idempotência. Não precisa de scheduler externo/Neon Functions.
- Render Free suspende após15min sem tráfego; HTTP/WS recebido pode acordá-lo. Enquanto suspenso não há worker e o fechamento pode atrasar; o scan de startup recupera vencidos. Não criar keepalive artificial nem prometer encerramento pontual. Não é operação financeira real.
- Checkpoints/chave persistem fora do disco efêmero; Blob não é WORM. Chave/token/admin conjuntos ficam fora da proteção contra alteração somente do SQL.

## Seed e lote aberto para o prazo

Seed existente cria leiloeiro@demo.local, ana@demo.local e bruno@demo.local (senha exclusivamente demo documentada no README), R$5000 por licitante, lote de6h e lance inicial deR$50. Não renova prazos/saldos antigos. Não alterar esse histórico.

Após seed, verificar lote aberto pela API/UI. Criar **uma vez pelo painel** outro lote com término após a janela de avaliação acordada (sugestão30/10/2026 às23:59 Brasília, confirmar com responsável), e um lance demonstrativo. Registrar ID e prazo nas evidências. Antes de repetir procedimento, consultar esse ID: se continua aberto, não criar nem lançar novamente. A criação de lote não possui contrato de Idempotency-Key; não automatizar retries de POST/auctions. Se ocorrer timeout, consultar o painel antes de qualquer nova tentativa. Esse é um procedimento operacional de repetição segura, não nova garantia de idempotência da rota. Abrir lote novo após expiração sem editar os anteriores.

A arquitetura suporta snapshots/cache, mas o bootstrap novo não dispõe de item importado; primeira importação depende da Open Library. Se indisponível, aguardar/retentar seed em nova janela ou importar pela busca legítima quando voltar. Não refatorar nem inventar fallback de dados nesta etapa.

## Walkthrough pós-publicação — ainda NÃO executado

| Grupo | Verificação obrigatória | Estado |
|---|---|---|
| Auth | Logins dos3 perfis; vendedor impedido de lance, licitante impedido de gerenciar lotes alheios | PENDENTE |
| Vitrine | Agendado/ao vivo/encerrado; consulta anônima | PENDENTE |
| Catálogo | Buscar API real, selecionar snapshot e criar lote com campos | PENDENTE |
| Cancelamento | Cancelar próprio sem lances; desaparece da vitrine | PENDENTE |
| Carteira | Depósito simulado; total/comprometido/disponível coerentes | PENDENTE |
| Lances | Primeiro válido; mínimo/saldo/autossuperação recusados; outbid libera reserva; erros claros | PENDENTE |
| Realtime | Duas sessões, WS sem reload; contador e ganhando/superado | PENDENTE |
| Encerramento | Lote curto separado; anti-sniping+120s; worker; débito/crédito/reserva únicos; resultado/receipt | PENDENTE |
| Auditoria | Anônima, íntegra, CP no store novo, export/verificador com pin demo, sem dados pessoais | PENDENTE |
| Persistência | Redeploy/reinício só da demo; checkpoint/assinatura/receipt preservados e ausência de nova transferência | PENDENTE |

Não adulterar banco público demonstrativo; testes adversariais ficam no PostgreSQL descartável. Não utilizar carteiras/lotes existentes de produção em nenhum teste.

## Aprovação solicitada

**Etapa remota proposta:** criação dos quatro recursos exclusivamente gratuitos e isolados, configuração protegida, migrations/seed apenas no banco novo, worker/finanças simuladas apenas na demo, deploys e walkthrough da demo incluindo um reinício para persistência. Nenhuma modificação de produção. Conferências de billing/quotas e transporte de segredos são condições de parada, não autorização para upgrades.

**Git:** autorização separável para commit/push da branch codex/elite-verzel-demo com arquivos explícitos abaixo, condicionada a não acionar deploys antigos. Não executar git add . nem publicar material privado.

Selecionados para revisão/commit: README.md; package.json; apps/web/src/auction-pages.tsx; apps/web/test/auction-room.test.tsx; apps/web/tsconfig.json; apps/api/src/settlement/function-build.ts; docs/REQUIREMENTS.md; docs/FINAL_DELIVERY_READINESS.md; docs/FINAL_CHALLENGE_REVIEW.md; deploy/render.demo.yaml; scripts/prepare-demo-key.mjs; docs/DEMO_DEPLOY_PLAN.md; docs/VERZEL_SUBMISSION_DRAFT.md. O diff **preexistente** apps/api/src/settlement/readiness.ts precisa ser incluído somente se aprovado após revisão; o stamp atual corresponde a ele. Não retirar um sem sincronizar/testar o outro. Nenhum arquivo var/tmp/.env/.vercel será selecionado.

Estimativa:1–3h configuração após acessos/autorizações e30–60min validação; dependência de painéis, quotas, geração/transferência humana e bootstrap externo pode ampliar. Sem previsão garantida ou promessa de conclusão antes de obter esses acessos.

## Verificações desta preparação

`npm test` executado por completo:91/91 API e4/4 SSR aprovados, PostgreSQL descartável54331, depois parado. TypeScript aprovado. Lint detectou import URL ausente no novo helper; corrigido e lint repetido/aprovado. Build e stamp aprovados após a correção. Nenhuma nova execução financeira remota, deploy, commit/push ou chave operacional. git diff --check aprovado; var/demo-identity, .env e .vercel permanecem ignorados.

Blueprint interpretado com js-yaml: um serviço novo/free, autodeployoff, sem disco/databases. Validação completa pelo schema não concluída: AJV instalado não suporta draft2020-12 e não há validador2020/CLI Render disponível. Não foi instalado pacote novo só para isso. Antes de aplicar, validar na ferramenta oficial ou usar a criação manual/MCP com campos conferidos na referência oficial. Esse passo não foi declarado aprovado. Geração DPAPI e transferência HTTPS continuam etapas humanas pendentes; node --check do helper passou, não substitui sua verificação operacional.
