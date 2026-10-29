# Implantação demo — 28/10/2026

**Atualização28/10,22:46 Brasília: BLOQUEADA no preflight BLOB_TOKEN_STORE.** A configuração humana foi recebida, mas a API ainda não iniciou. Não houve habilitação financeira, seed ou teste financeiro remoto. Correção protegida do token Blob solicitada ao operador; não gerar outra identidade.

Autorização explícita recebida para recursos gratuitos isolados, branch/commit/push seguro, deploy, finanças simuladas e testes da demo. **Nenhuma liberação da produção.**

## Recursos realmente criados

| Recurso | Identificador | Estado confirmado |
|---|---|---|
| Branch | codex/elite-verzel-demo, commit inicial9c1e09a73de2788a34f6a24943d3c90d45f65102 | Push confirmado por git ls-remote |
| Vercel | prj_WF7fcEaeuexYDAPyIpJ7MfBOFPcD | Hobby, novo projeto |
| Frontend | https://elite-verzel-demo.vercel.app | Deploy dpl_EUzzo2MwygNgcLhCqXv8PdsN4dvm READY no commit9c1e09a; API ainda não configurada |
| Neon | shy-base-42585434 | Projeto novo, organização Free, PostgreSQL17, aws-us-east-1; create --no-secrets |
| Blob privado | store_UQ7SEOCwcjWKg0zw, elite-verzel-demo-audit | Novo store iad1; prefixo planejado elite-verzel-demo-v1/ |
| Render | srv-dbh86ed9fdbs7387t2m0 | Novo serviço Free, autodeployoff; https://elite-verzel-demo-api.onrender.com; aguardando segredos, não declarado Live |
| CI inicial | https://github.com/matssgit/elite-dev-verzel/actions/runs/40786570663 | completed/success para9c1e09a |

A implantação inicial da API pode falhar por DATABASE_URL/chave ausentes: isso é bootstrap incompleto, não autorização para reutilizar valores de produção. Seed/worker/finanças estão configurados bloqueados no novo serviço. Origem inicial demo.invalid será corrigida pelo helper para o frontend verificado acima.

## Segurança conferida antes do push

- Painel Vercel antigo: “This Project is not connected to a Git repository”; nenhum Deploy Hook configurável sem conexão. Somente leitura.
- Render antigo: autoDeploy=no, autoDeployTrigger=off, previews off, branchmain. Somente leitura.
- Workflow GitHub: somente CI; nenhum deploy. Commit publicado em branch exclusiva.
- Vercel billing: Hobby Active, sem forma de pagamento. Render: Hobby, sem cartão; uso19,07/750h,5/500min pipeline,6MB/5GB, cobrançasUS$0 no momento da leitura. Organização Neon planfree.
- readiness.ts antigo/novo transformados com esbuild minify produziram código executável idêntico. Stamp local a326…6f73 conferido. Varredura dos14 arquivos selecionados não encontrou padrões de PEM privado/tokens operacionais; isso não é análise forense de todo histórico.
- Testes locais anteriores95/95, tipos/lint/build aprovados; CI inicial também verde.

## Etapa humana necessária — sem enviar segredos

**Antes de inserir qualquer credencial:** em [Settings da API demo](https://dashboard.render.com/web/srv-dbh86ed9fdbs7387t2m0/settings), edite Start Command para o comando abaixo e salve. O MCP disponível não edita esse campo; a navegação automatizada ao painel não carregou, portanto essa edição ainda não foi executada. O helper também recusa configuração enquanto esse prefixo não estiver instalado. O primeiro boot deve falhar fechado por credenciais ausentes, antes de acessar qualquer banco.

```sh
node scripts/demo-isolation-preflight.mjs && npm run db:migrate:production -w @elite/api && npm run db:seed:production -w @elite/api && npm start -w @elite/api
```

1. Abra o **novo** projeto Neon elite-verzel-demo, ID shy-base-42585434. Em Connect, escolha conexão direta (pooling desmarcado), TLS. Configure esse valor diretamente como DATABASE_URL na [API demo, Environment](https://dashboard.render.com/web/srv-dbh86ed9fdbs7387t2m0/env). Não usar o projeto cold-haze-51518470.
2. No Vercel, abra [store demo exclusivo](https://vercel.com/zmats-projects/~/stores/blob/store_UQ7SEOCwcjWKg0zw). Use seu token read-write exclusivo e configure diretamente BLOB_READ_WRITE_TOKEN na mesma API nova. Não usar store_jAwONeQLbcJmOzGK. Salve as duas variáveis no Render; mantenha FINANCIAL_MAINTENANCE=true, RUN_SETTLEMENT_JOBS=false, ALLOW_DEMO_SEED=false. Uma falha temporária de boot antes de configurar a chave é esperada. Não enviar valores na conversa.
3. Em PowerShell **nativo interativo**, sem transcrição, na raiz F:\teste-verzel, execute `node scripts/prepare-demo-key.mjs`. Não repetir se o diretório já existir. Só informe o fingerprint público e sucesso/erro sanitizado; não abra o DPAPI nem copie a chave.
4. Crie uma API Key temporária do Render no painel da conta, com o menor acesso disponível; não envie seu valor. O token pode ter acesso amplo à conta, portanto só será usado pelo helper fixado no serviço novo e deve ser revogado depois. Execute `./scripts/configure-demo-key.ps1 -ExpectedFingerprint FINGERPRINT_PUBLICO_GERADO`, substituindo o argumento público. O script pede token com entrada protegida, confere metadados do serviço novo/free e fingerprint da chave DPAPI, aplica somente identidade/origem/bloqueios por HTTPS e dispara deploy **da demo**. Não faz env pull, não usa clipboard, não chama Neon Functions.
5. Revogue a API Key temporária. Informe apenas “credenciais demo configuradas”, fingerprint público, deployId público e eventual mensagem sem segredos. Não habilite as finanças manualmente: o agente conferirá isolamento/health/assinatura antes de ativar os flags autorizados da demo e executar seed/walkthrough.

Helpers antigos de produção **não devem ser executados**. Os novos não recebem serviceId livre; o destino é exclusivamente srv-dbh86ed9fdbs7387t2m0. Se houver erro, interromper sem repetir upload automaticamente. Não desabilitar políticas de execução globais; se o terminal bloquear o script, informar somente o erro para tratar a alternativa.

## Pendências reais

- Bootstrap reforçado com scripts/demo-isolation-preflight.mjs antes de migrations: hostname Neon direto exato, TLS, storeId/prefixo, identidade/pin, ausência de transição de produção e combinações de flags. Quatro testes Node isolados aprovados; npm test inclui esses casos. Transporte HTTPS testado com mocks, sem acesso a DPAPI/rede; lint aprovado. Aplicar o startCommand reforçado somente ao serviço demo antes da inserção humana de segredos.
- Inserções protegidas e geração humana da chave; ainda nenhuma identidade demo gerada pelo agente.
- API iniciar com manutenção; conferir banco/store/pin exclusivos antes de habilitar demo.
- Migrations/seed demo e lote aberto até janela de avaliação; walkthrough completo, auditoria e persistência após reinício.
- CI dos commits posteriores de helper/documentação e atualização final do README/submissão.

**Não é uma demonstração funcional concluída.** Frontend publicado, backend pendente de configuração protegida; não declarar carteira/lances/WS/liquidação/persistência aprovados remotamente.

## Conferência após handoff humano

Operador informou DATABASE_URL/Blob configurados, identidade nova e revogação da API Key temporária. Fingerprint público local389b505e9330eaf660ace80f9d3f352375ccf9a03c2475621753810fbba496eb confere com var/demo-identity/public.json (somente arquivo público lido; DPAPI não aberto). Isso ainda não confirma a identidade em runtime, pois o preflight para antes dessa etapa.

| Deploy demo | Commit | Evidência |
|---|---|---|
| dep-dbha2hu1egvs73evij10, informado pelo operador | cc93728 | update_failed; build/stamp passaram, boot “Demo isolation mismatch; database/bootstrap not started” |
| dep-dbha8imc6qcc73er4o0g, diagnóstico seguro | 811fd60 | 01:42:11Z e01:42:20Z: BLOB_STORE_PREFIX |
| dep-dbhaacm1egvs73f09ik0, diagnóstico granular | c2c56db | 01:46:17Z e01:46:26Z: **BLOB_TOKEN_STORE**, antes de migrations |

As mudanças locais acrescentaram somente códigos fixos de falha, sem valores de segredos e sem alterar as regras de aceitação. Cinco testes Node do preflight e lint aprovados. npm audit --omit=dev: zero vulnerabilidades de runtime; avisos do build sobre dependências de desenvolvimento não foram tratados automaticamente.

CI do código c2c56db: [40802314686](https://github.com/matssgit/elite-dev-verzel/actions/runs/40802314686), completed/success; workflow executa tipos/lint,91 testes API+4SSR+5preflight e build. Commits posteriores apenas documentais precisam ser distinguidos dessa evidência.

Leitura do painel Blob confirmou store_UQ7SEOCwcjWKg0zw, privado, e base pública de metadados https://uq7seocwcjwkg0zw.private.blob.vercel-storage.com. O SDK instalado extrai a identidade de um token read-write pela quarta parte separada por underscore. O runtime não reconheceu essa identidade no valor configurado. Causa precisa do conteúdo incorreto (token de outro store, valor com rótulo/aspas, formato inesperado etc.) não foi comprovada, pois o segredo não foi lido. Não atribuir adulteração/exposição ao operador.

**Passaram antes da recusa:** sintaxe/hostname direto/TLS/credenciais presentes na URL Neon, AUDIT_STORAGE=blob e prefixoelite-verzel-demo-v1/. Essa é validação de configuração, não conexão SQL concluída. **Ainda não passaram:** identidade de assinatura em runtime, conexão SQL/Blob, migrations/seed, health, login/WS/lances/liquidação/comprovantes/persistência. Não chamar esses itens de validados.

**Ação única solicitada:** no Environment da API **nova** srv-dbh86ed9fdbs7387t2m0, substituir somente BLOB_READ_WRITE_TOKEN pelo valor read-write do store exclusivo correto, sem rótulo de variável, aspas, Bearer ou espaços extras. Salvar e redeploy apenas demo; manter FINANCIAL_MAINTENANCE=true, RUN_SETTLEMENT_JOBS=false, ALLOW_DEMO_SEED=false. Preservar a chave/pin já configurados. Não enviar token ou trechos na conversa. Depois conferir novo preflight/health antes de habilitar qualquer operação. Nenhum recurso de produção foi modificado nesta conferência.
