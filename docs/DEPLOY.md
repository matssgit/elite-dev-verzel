# Deploy — Sprint 4

Estado em 26/10/2026: **preparado localmente; nenhuma aplicação deste projeto publicada**. Repositório público confirmado acessível pelo Git e conector: https://github.com/matssgit/elite-dev-verzel ; origin configurado. Workspace Render confirmado pelo responsável: My Workspace. Vercel respondeu 403 para a equipe zmats-projects e exige autorização da conexão. Não reutilizar serviços/bancos de outros projetos.

## Decisão atual

O responsável **recusou os recursos pagos**. Proposta arquivada em deploy/render.paid.yaml e removida do caminho padrão de descoberta. Nenhum recurso pago será criado. Comparação gratuita/mínima concluída em [INFRA_OPTIONS.md](INFRA_OPTIONS.md); não substituir o storage funcional antes da escolha. Os passos pagos abaixo são somente referência histórica da proposta recusada.

## Configuração preparada (proposta paga arquivada)

- `vercel.json`: projeto Vite na raiz do monorepo, `npm ci --include=dev`, build somente web, saída `apps/web/dist`, rotas SPA para links de sala/comprovante/auditoria e headers de segurança.
- `scripts/check-web-env.mjs`: publicação exige VITE_API_URL com origem HTTPS da API, sem caminho, credenciais ou query. Evita publicar apontando para proxy local `/api`.
- `deploy/render.paid.yaml`: API nativa Node 24.22.1, plano 0.5c-512mb, uma instância, região Virginia; PostgreSQL 17 no plano 0.1c-256mb, 1 GB, sem autoscaling; disco 1 GB em `/var/data`. Todos são recursos NOVOS.
- `DATABASE_URL` vem de `fromDatabase`, usando a conexão interna na mesma região; credenciais nunca ficam no YAML. Banco com `ipAllowList: []`, sem acesso SQL pela internet. WEB_ORIGIN é informado na criação, com a origem canônica da Vercel.
- Build API inclui servidor, migrations, seed e verificação de armazenamento compilados. `preDeployCommand` aplica migrations **sem usar o disco**, que não é montado nessa fase.
- `start-render.mjs` verifica volume/chave no runtime, prepara demo uma vez com marcador no disco e inicia API/worker. Sem acesso ao catálogo no primeiro seed, o startup falha e pode ser repetido; não fabrica dados.

## Custo proposto — autorização obrigatória antes de aplicar

| Recurso | Plano/capacidade | Base mensal estimada |
|---|---|---|
| API sempre ativa | 0.5c-512mb | US$ 7,00 |
| PostgreSQL sem expiração | 0.1c-256mb | US$ 6,00 |
| Armazenamento PostgreSQL | 1 GB | US$ 0,30 |
| Disco da auditoria | 1 GB | US$ 0,25 |
| Total | sem autoscaling | **US$ 13,55/mês** |

Antes de impostos e eventuais excedentes de tráfego/build. Não é teto de cobrança da plataforma. Gasto explicitamente NÃO AUTORIZADO; tabela apenas registra a proposta recusada. Vercel Hobby existente será usado sem upgrade, após autorização de acesso à equipe. Confirmar valores finais na tela antes de criar recursos.

Referências oficiais verificadas em 26/10/2026: [preços](https://render.com/pricing?trk=article-ssr-frontend-pulse_little-text-block), [compute plans](https://render.com/docs/compute-plans), [discos](https://render.com/docs/disks), [Blueprint](https://render.com/docs/blueprint-spec).

## Persistência e chaves

Menor alteração da arquitetura: preservar o armazenamento já existente em **disco persistente da API**, fora do PostgreSQL. Blueprint define AUDIT_DIRECTORY=/var/data/elite-audit e AUDIT_MOUNT_PATH=/var/data. AUDIT_REQUIRE_MOUNT=true confere `/proc/self/mountinfo` e realpath, recusando filesystem efêmero ou diretório fora do mount.

AUDIT_KEY_MODE=persistent-file gera Ed25519 só no primeiro runtime com diretório vazio e volume verificado. Chave privada com permissão 0600, sem stdout e sem commit; public.pem fixa a identidade no mesmo volume. Reinício/redeploy reutilizam a chave e checkpoints. Se chave sumir e houver pin/checkpoints, a API recusa gerar substituta. A alternativa existente AUDIT_PRIVATE_KEY por segredo continua suportada; nunca usar VITE_* para segredos.

O disco não é compartilhado com o processo do PostgreSQL. Credenciais SQL permitem modificar tabelas, não ler a chave nem alterar arquivos da API. Administrador da conta Render ou do runtime/shell da API pode controlar ambos: está fora dessa garantia. Não há WORM/object-lock implementado. Limitar acesso administrativo, manter conta com MFA e backups; não afirmar imutabilidade contra operador da plataforma.

Render documenta persistência entre deploys/restarts e disco disponível só no runtime. Disco implica uma única instância e breve indisponibilidade em deploys. Snapshot automático não substitui retenção externa nem comprova recuperação sem testes. A proteção permanece condicional ao modelo documentado em AUDIT.md.

## Passos externos restantes

1. Autorizar acesso da conexão Vercel à equipe zmats-projects pelo link temporário fornecido no chat. Não enviar token pela conversa.
2. Publicar código revisado no repositório dedicado já confirmado. Não publicar .env, var, node_modules, tmp, .vercel nem PDF do edital.
3. Escolher arquitetura após ler INFRA_OPTIONS.md. Recursos pagos já foram recusados; não aplicar Blueprint nem criar serviços/banco/disco pagos.
4. Publicar o commit revisado no repositório dedicado e criar projeto Vercel **na raiz do monorepo**. Configurar Node 24.x. Reservar e confirmar o domínio canônico real antes de configurar WEB_ORIGIN; nomes/URLs não são garantidos enquanto não criados.
5. Aplicar `deploy/render.paid.yaml` pelo Blueprint Dashboard, já sincronizado no repositório. O MCP da Render cria API/DB, mas não anexa discos nem cria Blueprint; não usar criação incompleta sem disco. Se for necessário acesso Git OAuth, concluir no Dashboard.
6. Configurar WEB_ORIGIN com a origem HTTPS canônica da Vercel; iniciar API e aguardar deploy **live**. Confirmar mount e fingerprint nos logs, sem extrair chave privada. Conferir migrations e seed.
7. Definir VITE_API_URL na Vercel com a origem HTTPS real da API e publicar o frontend. A URL WS é derivada automaticamente (`https:`→`wss:`), sem proxy Vercel para WebSocket.

Não criar recursos duplicados entre MCP e Blueprint. Configurações do Blueprint são a fonte de verdade da API/DB. Se usar CLI, validar primeiro com `render blueprints validate render.yaml`; CLI não está autenticada/instalada neste ambiente. Foi realizada validação estrutural pelo JSON Schema oficial, não uma aplicação/validação autenticada do Blueprint pela Render.

## Verificação de produção a executar

- Registrar IDs, URLs canônicas, commit e deploy IDs reais; abrir frontend sem sessão; verificar SPA por link direto para comprovante/auditoria.
- GET /health; CORS só para WEB_ORIGIN; conexão WS com Origin real do frontend. Não habilitar coringa para contornar erro. Previews Vercel de outra origem não estão automaticamente autorizadas.
- Login, vitrine e carteira com usuários de demonstração; preferir contas/lotes descartáveis identificados como validação para testes de lance, sem alterar dados importantes.
- Aceitar lance válido; recusar abaixo do mínimo, autossuperação e sem saldo. Confirmar reserva, superação/liberação e atualização em segunda sessão.
- Criar lote de validação com fim curto. Lance próximo do fim prorroga 120s: respeitar a regra, sem editar prazo no banco para acelerar o teste.
- Salvar evidência JSON, fingerprint e hash do checkpoint antes de reiniciar. Reiniciar a API e depois fazer novo deploy do mesmo commit. Conferir chave, checkpoints, dados e auditoria INTEGRO após ambos.
- Conferir recuperação de lote vencido no período offline: um débito, um crédito, um comprovante; sem cobrança duplicada ao repetir restart/deploy.
- Abrir comprovante/auditoria publicamente e executar `scripts/verify-audit.mjs` com fingerprint confiável fora da página.

## Evidência local desta preparação

- `deploy/render.paid.yaml` aprovado pelo JSON Schema oficial draft 2020-12 baixado de https://render.com/schema/render.yaml.json .
- Build web/API, TypeScript e lint aprovados; comando **compilado** de migration executado contra o banco local existente, sem reaplicar migrations já registradas.
- 12/12 testes direcionados de liquidação/auditoria aprovados após a preparação.
- Docker oficial node:24.22.1-alpine, volume exclusivo `elite-verzel-audit-sprint4`: checkpoint e chave preservados em substituição completa de contêiner, hash/fingerprint idênticos, modo da chave 0600. Sem volume, inicialização recusada. Chave removida temporariamente apenas nesse volume de teste, startup recusado e chave restaurada.
- Hash do checkpoint de teste: 7d781a6a07eabfe2e218ecd3b8ae2027ba82477065e65ca7f90438d1c0761e70. Fingerprint desse ambiente **de teste**: f38a573aaac0cfe775c730f175d750a874b0c0b84e9874f1199b3875ae395ce8.
- Validação da origem web aceita HTTPS válido e recusa configuração ausente. Esses testes locais não comprovam persistência na Render.

## URLs públicas

Nenhuma URL pública deste projeto disponível ainda. Não substituir por links locais, por nomes propostos ou por serviços de outro projeto. Preencher esta seção somente depois de publicar e verificar.
