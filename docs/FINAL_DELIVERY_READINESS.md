# Prontidão final — Verzel Elite Dev

**Revisão: 27/10/2026, 17:42 Brasília. Prazo informado: 29/10/2026.**

**Veredito: ainda não está pronto para entrega baseada somente na demonstração pública.** As operações essenciais estão bloqueadas pela manutenção. O código tem os fluxos implementados e uma alternativa local existente, mas essa alternativa precisa ser ensaiada e apresentada claramente ao avaliador. Não retirar a manutenção para resolver a experiência de avaliação.

## 1. Estado real e integridade

Conferência desta rodada exclusivamente por GET e listagens de metadados; nenhuma operação financeira, login novo, migration, seed, deploy, reparo, alteração de cron ou geração de chave foi executada. Evidência sanitizada em [FINAL_DELIVERY_EVIDENCE.json](FINAL_DELIVERY_EVIDENCE.json).

| Item | Resultado atual |
|---|---|
| Cinco históricos / 15 checkpoints | INTEGRO; registros, assinaturas e checkpoints idênticos ao baseline; verificador independente aprovado |
| Quatro comprovantes | HTTP 200, INTEGRO; registro/assinatura de SETTLE iguais ao histórico verificado |
| Snapshot financeiro | Igual ao baseline `53f9f00b00b93e188b90908c18f80beafeba4db0275baf20fd4dfd56b1c7ac3a`; invariantes aprovadas |
| Fixtures/movimentações indevidas | Não observadas: snapshot completo inalterado e somente os cinco lotes anteriores na vitrine |
| Nova identidade | Fingerprint `07e8ccdec02da616cf480e19a0599271679ed625376bf8968837502b0af94ab2`; manifesto `126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1`; prova assinada e artefatos existentes válidos |
| Manutenção | FINANCIAL_MAINTENANCE=true confirmada no diagnóstico; não alterada. Bloqueios públicos 503 foram comprovados na rodada anterior e preservados; nenhum POST foi repetido agora |
| Cron Neon | disabled, next_run_at=null, versão 9841168; não habilitado |
| Fonte normal Neon | Rota temporária voltou a 405 e agora expõe o build esperado `3659f9f4321e887e3aaadde1df6255d330d3e75c43e34d647cd40f13996f28fe`, com runId vazio; metadados finais anexos |
| Frontend / backend | Frontend HTTP 200; API /health ok; vitrine pública retorna cinco lotes |
| Render | Live, commit 3a65ffb, deploy dep-dbgdgd6i0phs73c70rhg; sem deploy nesta rodada |

**Última divergência de cobertura:** a coleta anterior abortou com “Cobertura de checkpoints incompleta”. O relatório bruto divergente não foi preservado, portanto a causa exata e o lote afetado não estão comprovados. Depois dela, uma leitura individual e duas passagens independentes já encontraram os 15 checkpoints intactos; a conferência única desta rodada confirmou novamente os mesmos bytes/assinaturas. Não há evidência atual de perda/adulteração, mas não é correto declarar a causa resolvida. Impacto conhecido: uma validação automática foi interrompida. Ação: manter falha fechada; se reaparecer, preservar o relatório completo e horário antes de qualquer reparo. Não houve reparo automático.

Assinaturas históricas válidas não garantem autoria retroativa: a chave antiga foi considerada comprometida. Blob não é WORM; controle conjunto de banco, runtime, chave e storage excede a proteção implementada. Ver [AUDIT.md](AUDIT.md).

## 2. Conclusão objetiva sobre o Neon

1. **Funciona:** PostgreSQL/invariantes, provas da chave nova, leitura dos históricos/comprovantes e identificação de versão no código. A fonte normal foi identificada nesta leitura.
2. **Permanece inconsistente:** a revisão 26 foi reportada como current=active/completed, mas **0 de 74** respostas neutras posteriores comprovaram build/runId esperados. Houve GET 405 e POST 403 sem a identidade nova, em conexão persistente, conexões novas e fetch. A restauração foi reportada como revisão 27. Não se deve interpretar esses 403 como senha/token inválido sem antes conferir a versão.
3. **Correção simples comprovada:** nenhuma. Esperar current/active foi implementado e testado localmente, mas não bastou na coleta de produção. Trocar conexões ou afrouxar autenticação não é solução demonstrada. Propagação, instância antiga, roteamento/cache e caminho de publicação continuam hipóteses.
4. **Impacto na entrega:** impede afirmar que o agendamento financeiro atual está validado em produção. Não impede avaliar a implementação por uma execução local isolada, cujo worker existente processa vencidos no startup/a cada três segundos sem depender do Neon Functions. Não afirmar que a disponibilidade pública dos fluxos essenciais está resolvida.

O código agora identifica build SHA-256/runId em GET e POST, separa UNEXPECTED_VERSION de AUTH_REJECTED e recusa entradas do ensaio com versão divergente antes de conectar ao banco. Isso é uma contenção; sua disponibilidade consistente em produção não foi comprovada. Documentação oficial consultada: [deploy e espera de build](https://neon.com/docs/compute/functions/deploy), [metadados current/active](https://neon.com/docs/cli/functions) e [snapshot de ambiente por deployment](https://neon.com/docs/compute/functions/environment-variables).

Alternativas seguras, sem executá-las nesta rodada:

- **Preferida para o prazo:** entregar o repositório com roteiro local e evidências, usando produção somente para consulta. Confirmar se as instruções de submissão aceitam essa forma; não ocultar os bloqueios públicos.
- Se demonstração pública interativa for exigida: usar ambiente de avaliação isolado ou resolver o deploy neutro com revisão/trace do provedor antes de pedir nova autorização financeira. Deploy direto com espera de build pode ser investigado, mas não foi comprovado como solução e não está autorizado automaticamente.

## 3. Funcionalidades concluídas e checks

Implementados: autenticação e dois papéis; autorização de propriedade; catálogo público e snapshots; criação/cancelamento de lotes; vitrine e sala; histórico/contador/WebSocket; regras de lance e concorrência; saldo/reserva/liberação; anti-sniping; liquidação transacional/idempotente; resultados, comprovantes públicos e auditoria assinada multichave. A matriz [REQUIREMENTS.md](REQUIREMENTS.md) contém as evidências históricas; esses fluxos não foram reexecutados financeiramente nesta rodada.

| Verificação | Evidência / limite |
|---|---|
| Testes desta rodada | **14/14**, somente versão/deploy, envelope neutro, preflight e manutenção; sem fixtures financeiras |
| TypeScript / lint / build | Aprovados agora |
| Stamp do build | Confere com as 32 fontes consideradas pelo gerador |
| Regressão completa | 78/78 registrada anteriormente; sete direcionados posteriores incluíram expiração sob lock. Não apresentar isso como suíte completa do HEAD atual |
| Login/autorização, lances/WS e liquidação | Integrações/navegador e testes anteriores registrados; sem novo login ou transação financeira agora |
| Frontend | HTTP 200 e build aprovado; não houve novo walkthrough completo no navegador |
| CI | Workflow versionado: Postgres isolado, migrations, TypeScript, lint, testes e build. Resultado do commit final ainda deve ser conferido |

Avisos não impeditivos do build: bundle web grande e anotações de dependência removidas pelo bundler. Sem alterações cosméticas nesta revisão.

## 4. Roteiro seguro para o avaliador

**Produção permite consulta; não anunciar esses links como demonstração financeira liberada:**

- [Aplicação](https://elite-dev-verzel-zmats-projects.vercel.app)
- [Saúde da API](https://elite-dev-verzel-api.onrender.com/health)
- [Auditoria de exemplo](https://elite-dev-verzel-zmats-projects.vercel.app/auditoria/00000000-0000-4000-8000-000000000100)
- [Comprovante de exemplo](https://elite-dev-verzel-zmats-projects.vercel.app/comprovantes/d209288d-6a1c-43a7-a0ec-c8fa5dbc21cc)
- [Repositório](https://github.com/matssgit/elite-dev-verzel)

**Para demonstrar o fluxo completo:** clone separado em máquina de avaliação, Node 24 e Docker Desktop/Linux. Terminal limpo, sem variáveis/segredos da produção. Porta 54329 livre; se ocupada, não reutilize o banco existente nem apague volumes: use uma máquina limpa. Execute cada comando separadamente e pare se falhar. O projeto Compose abaixo cria um volume próprio.

```powershell
git clone https://github.com/matssgit/elite-dev-verzel.git verzel-avaliacao
Set-Location verzel-avaliacao
npm ci
Copy-Item .env.example .env
# Credenciais fictícias locais já existentes em .env.example:
$env:DATABASE_URL='postgres://elite:elite_local@127.0.0.1:54329/elite'
$env:TEST_DATABASE_URL=$env:DATABASE_URL
$env:NODE_ENV='development'
docker compose -p verzelavaliacao up -d db
# Aguarde o banco ficar healthy antes de continuar.
npm run db:migrate
# Opcional nesta execução do avaliador: suíte completa, antes de seed/dev.
npm test
npm run db:seed
npm run dev
```

Esse roteiro é para execução futura no ambiente isolado; **não foi executado nesta revisão**. O Compose existente executa apenas PostgreSQL, com volume separado pelo nome do projeto. Não copie chaves, manifestos de transição, tokens Blob ou DATABASE_URL do Neon para esse clone. Os defaults de desenvolvimento usam auditoria local e worker ativo, sem alterar flags da produção. Se houver variáveis AUDIT_* ou de manutenção herdadas de produção, pare e abra um terminal limpo; o seed deliberadamente não opera sob manutenção.

Abra `http://localhost:5173` e `http://localhost:3001/health`. Use as três contas e a senha **de demonstração** já documentadas no README. Em sessões de navegador separadas:

1. Leiloeiro pesquisa catálogo e cria lote; Ana e Bruno demonstram liderança/superação e reservas.
2. Confira recusa de autossuperação, mínimo e saldo; acompanhe WebSocket sem recarregar.
3. Crie prazo curto pela interface; considere que lances nos últimos 120s prorrogam +120s. Aguarde o worker local, sem editar datas no SQL.
4. Confira débito/crédito simulados, reserva liberada, resultado, comprovante e auditoria públicos locais.

O catálogo/seed depende da Open Library; se indisponível, informe a limitação e repita somente o seed local quando voltar. Seed não renova um lote antigo. Não apontar migrations, seed ou testes para Neon/produção. Algumas suítes usam schemas privados, outras criam/removem dados próprios no banco indicado; portanto use somente o banco descartável de avaliação e não execute testes junto do worker de demonstração.

## 5. Pendências antes de 29/10 — ordem recomendada

| Prioridade | Classificação | Ação concreta |
|---|---|---|
| 1 | **BLOQUEANTE** | Publicar a revisão final no repositório enviado: na abertura desta rodada, main estava um commit à frente de origin/main, **240476a**, sem alterações pendentes. Incluir também este relatório/evidência; conferir `git log origin/main..HEAD`, permissões e eventuais automações de deploy antes de enviar. Nenhum push/deploy foi executado nesta rodada |
| 2 | **BLOQUEANTE** | Definir e ensaiar o caminho completo de avaliação isolada acima. Entregar apenas URLs em manutenção não permite avaliar requisitos essenciais. Se o edital/convite exigir demo pública interativa, disponibilizar ambiente isolado autorizado antes da entrega |
| 3 | **IMPORTANTE** | Executar/conferir a suíte completa e o CI no commit publicado, exclusivamente em Postgres de teste; fazer o walkthrough local e registrar resultado verdadeiro |
| 4 | **IMPORTANTE** | Explicitar no envio que a produção está em consulta/manutenção e o cron atual não foi validado após a rotação. Não repetir claims históricos de cron como se descrevessem o estado atual |
| 5 | **IMPORTANTE** | Preservar o alerta de cobertura incompleta e investigar separadamente se reaparecer. Não declarar a auditoria inviolável ou autoria histórica garantida |
| 6 | **BLOQUEANTE** | Confirmar horário/canal no convite e enviar até 29/10/2026: formulário indicado na matriz `https://elitedev.verzel.com.br/?elite-dev-2026-2`. Esta revisão não submeteu o desafio |
| 7 | **OPCIONAL** | Opcionais pendentes da matriz (filtro de lotes, cancelamento com estorno, dark mode) e refinamento de bundle/UI. Não consumir o prazo com esses itens |

**Neon:** solucionar o agendamento publicado é IMPORTANTE para o marco de produção; torna-se BLOQUEANTE somente se a entrega depender dessa demonstração pública. Não é motivo para habilitar cron, liberar manutenção ou trocar a arquitetura às pressas.

## 6. Git, ambiente e checklist

`.env.example` documenta variáveis locais e nomes dos segredos/pins de produção; não contém credenciais reais. `.gitignore` exclui `.env`, `var/`, `tmp/` e artefatos de deploy; apenas `.env.example` está versionado entre os arquivos de ambiente. Não foi feita uma varredura forense de todo o histórico Git nesta rodada; não afirmar que exposições antigas foram retroativamente eliminadas. Nenhuma chave/credencial foi aberta ou regenerada.

O relatório, a evidência e o aviso do README são versionados em commit local ao concluir esta revisão; não ficam como arquivos relevantes esquecidos fora do Git. Esse commit e 240476a permanecem pendentes de publicação. Não foi feito push para evitar acionar automações externas nesta rodada restrita.

- [x] 15 checkpoints e quatro comprovantes verificados por leitura.
- [x] Snapshot e identidade nova conferidos; nenhuma fixture indevida observada.
- [x] Manutenção ativa e cron pausado; nenhum deploy nesta revisão.
- [x] Frontend/API acessíveis; 14 testes neutros, TypeScript/lint/build aprovados.
- [x] Limites de produção, alerta de cobertura e falha de versão explicitados.
- [x] Roteiro de avaliação isolada documentado; README deve apontar para este estado atual.
- [ ] Walkthrough completo do clone isolado realizado e registrado.
- [ ] Commit final e relatório publicados; CI final conferido.
- [ ] Instruções, links e limitações incluídos na submissão; horário confirmado e formulário enviado.

**Decisão final:** código e evidências preparados; entrega operacional ainda condicionada aos bloqueantes acima. Não declarar o projeto pronto enquanto o avaliador tiver apenas a produção com operações essenciais indisponíveis.
