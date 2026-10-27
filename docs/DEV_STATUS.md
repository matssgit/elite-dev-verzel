# Status DEV — Sprint 5 — 26/10/2026

**27/10 — incidente de chave:** dois signers expostos/retirados. Render privada corresponde à candidata cf2d…9c91 e três variáveis públicas conferem; Neon permanece dc33…ece3 sem transição. Os dois diagnósticos read-only confirmaram 15 checkpoints e snapshot financeiro intactos. Recuperação/manutenção ativas, cron pausado; sem operações financeiras. Nova preparação --replacement e uploader nativo HTTPS sem clipboard prontos, ainda não executados com chave nova. 70 testes locais, TypeScript/lint/build e fixture de transporte aprovados. Fonte atual: AUDIT_KEY_RECOVERY.md; notas anteriores são históricas.

Conferência final 12:59: 4aedfa2 no Render dep-dbgcjt0u01pc73aomag0 live e função, CI 40536125587 aprovado. Ausentes objetos da candidata e guard remoto; 15 checkpoints/snapshot intactos nos dois consumidores. Procedimento antigo de clipboard bloqueado antes de abrir DPAPI. Próximo passo exclusivamente humano: prepare-audit-key.mjs --replacement, sem aplicar antes da nova revisão.

**Handoff da chave pausado no primeiro campo:** usuário ainda não confirmou/salvou Render. Mecanismo de clipboard reforçado com conferência local, recópia R, confirmação explícita C e bloqueio quando sobrescrito; cinco testes com fixture pública/clipboard simulado aprovados. Sem acesso do agente à chave/DPAPI/clipboard real, sem nova geração ou mudança de consumidores. Recomeçar somente o configure-audit-key.ps1 atualizado usando a mesma identidade cifrada; detalhes em AUDIT_KEY_ROTATION.md. Manutenção e cron pausado devem permanecer.

**Atualização às 21:39:** operador gerou chave protegida por DPAPI; manifesto público AUDIT_SIGNING_TRANSITION.json revisado por dois verificadores, comparado aos cinco lotes/15 checkpoints e aprovado para inserção nativa. Pins públicos em AUDIT_KEY_ROTATION.md. Não há aplicação da nova chave nos consumidores ainda, nem acesso do agente ao arquivo privado. API/função maintenance=true e trigger disabled confirmados; CI 21fa48f aprovado. Próximo passo: operador executa configure-audit-key.ps1 com o hash público aprovado e avisa para validar o corte. Não reabrir automaticamente.

**Fase 2 em andamento:** usuário autorizou a transição. Implementação multichave/fronteira assinada, validação do manifesto/pins, identidade de cada assinatura, guard persistente, comprovantes/página/CLI e handoff nativo preparados. 62 testes locais, TypeScript/lint/build aprovados. Chave nova de produção ainda não gerada/aplicada; próximo passo humano em AUDIT_KEY_ROTATION.md. Manutenção e cron pausado preservados.

Compatibilidade publicada em Render/Vercel (9ef6bd9) e função, sem trocar chave. Após deploy: cinco auditorias/15 checkpoints preservados, quatro comprovantes válidos, identificações de assinatura e nova interface disponíveis, rotas financeiras bloqueadas, função maintenance=true e zero pendentes. Cron disabled. Correções/provas posteriores passaram testes dirigidos; total de casos distintos agora 64 (suíte inicial de 62 mais dois novos). Evidências e IDs em AUDIT_KEY_ROTATION.md. Falta o handoff nativo para chave real e validação pós-corte.

**Estado atual às 21:04:** ensaio simulado autorizado de R$50 aprovado, segunda execução idempotente sem novas alterações. Um débito, um crédito, reserva liberada, comprovante público e um novo checkpoint; 14 anteriores preservados, 15 no total. Após remover o executor temporário por redeploy, invariantes conferem, cinco lotes liquidados e zero pendentes. API/função mantêm FINANCIAL_MAINTENANCE=true; cron enabled=false. Não reativar sem autorização. 28 testes direcionados e TypeScript/lint/build aprovados nesta etapa. Fase 2 preparada em AUDIT_KEY_ROTATION.md e AUDIT_ROTATION_BOUNDARY.json; chave ainda não trocada. Estados anteriores abaixo são históricos.

**Estado pós-rotação, 26/10 às 20:48 (America/Sao_Paulo): manutenção ATIVA na API/função e trigger PAUSADO.** Operador confirmou troca SQL/Blob e executou o handoff nativo. Função deployment 5 concluído; API reiniciada em dep-dbfu7q0m7kps73aq84mg (live). Cinco auditorias e seus 14 checkpoints permanecem idênticos ao baseline anterior. Função com verificação isolada em 19398e8 confirmou conexão, três migrations, reservas/liquidações gravadas consistentes, zero conexões SQL anteriores à configuração nova e leitura/escrita Blob em namespace de prova. Há UMA liquidação pendente; ela NÃO foi executada após a rotação, respeitando o bloqueio. Não reabrir automaticamente. As notas de tentativas anteriores abaixo são históricas.

## Estado atual

Demonstração publicada: https://elite-dev-verzel-zmats-projects.vercel.app .
API: https://elite-dev-verzel-api.onrender.com/health .
Código: https://github.com/matssgit/elite-dev-verzel .

Vercel Hobby, Render Free, Neon Free e Blob privado. Nenhum recurso pago autorizado/criado. Fonte de configuração e limitações: DEPLOY.md. QA independente permanece sob coordenação do responsável; QA_REPORT.md não foi alterado e nenhum subagente/conversa de QA foi acionado.

**Prioridade de segurança:** SQL/Blob substituídos pelo operador, com novos consumidores verificados. Expiração imediata do token antigo confirmada pelo operador; não houve tentativa de autenticação com credenciais antigas. A chave de assinatura anterior continua potencialmente comprometida. Fase 2 separada, sem autorização de corte e sem suporte a múltiplas chaves implementado. Plano/evidências em SECURITY_ROTATION.md.

## Funcionalidades preservadas

- Autenticação com sessão Bearer revogável, perfis e autorização no backend; carteira/depósitos simulados com idempotência.
- Catálogo Open Library com snapshots de metadados/capa no PostgreSQL, lotes e vitrine/sala pública.
- Lances com lock no lote e carteiras ordenadas, relógio do banco após locks, mínimo/incremento/período, impedimento de autossuperação, reserva/liberação e anti-sniping +120s.
- WebSocket WSS com LISTEN/NOTIFY dedicado, resync e recuperação de snapshot.
- Liquidação transacional e idempotente, razão PURCHASE/SALE, comprovantes únicos e resultados. Mesma implementação no worker local e na função Neon agendada por minuto; RUN_SETTLEMENT_JOBS=false na API de produção.
- Eventos SHA-256/Ed25519, outbox e checkpoints remotos privados fora do banco, pin e publicação sem sobrescrita por convenção da aplicação. Não é WORM; comprometimento conjunto de chave/token/runtime está fora da proteção restrita ao SQL.

## Provas de produção retomadas — sem repetir operações financeiras

Consulta READ ONLY em 26/10 às 18:32–18:33 (America/Sao_Paulo):

- Lote controlado 8e1b798d-0654-4f4e-b514-933f4d4b7bf7: fim 14:55:15.253, liquidação 14:56:00.956, R$10,00. Um PURCHASE -1000, um SALE +1000, um comprovante fc05d6d1-cd77-4720-9fa7-2a5e5ba47ee6. Reserva do vencedor zerada.
- Lotes vencedores anteriores de R$11 e R$70 continuam com um comprovante e duas movimentações cada, sem duplicações; lote sem lances continua sem movimentos. Todas as reservas das contas de validação conferem com a soma dos lotes ainda liderados.
- Logs do Neon entre 14:54 e 14:57 registraram o cron, incluindo 14:56:01 com failures=0.
- Render: consulta histórica de eventos trouxe apenas deploy_ended; instance_count não retornou série e logs filtrados não comprovaram suspensão. **Suspensão física naquele horário: INCONCLUSIVA.** Ausência de métricas não representa zero instâncias. Não foi criado outro lote nem repetido o teste.
- Auditoria desse lote e verificador independente conferiram três eventos/checkpoints; comprovante e rota SPA HTTP 200. O estado técnico INTEGRO não elimina suspeita de comprometimento da chave.
- API/frontend acessíveis; conjunto inicial de leituras levou ~44,8s, compatível com a latência de reativação, mas não prova suspensão no horário antigo.
- Login de demonstração, CORS da origem canônica, Bearer sem cookie, restrições por perfil, logout/revogação e duas conexões WS sequenciais com resync aprovados às 18:39, sem depósitos ou lances novos.

Provas da Sprint 4 preservadas: corrida no mesmo lote e entre lotes, liberação do líder superado, rejeições sem saldo/autossuperação, dois clientes WS e liquidação real. Antes/depois do redeploy Render dep-dbfouq4s728c738ilkog e da função, a auditoria preservou a fingerprint e os quatro checkpoints do lote 30ae384d-0b99-4430-8dca-131f51e7bd41; comprovante de R$11 e login permaneceram funcionais. Evidências locais em tmp/, fora do Git. Não confundir restart por redeploy com a prova de suspensão por ociosidade.

## Alterações seguras da Sprint 5

- FINANCIAL_MAINTENANCE preparado, desativado por padrão: bloqueia POST de depósitos/lotes/lances/cancelamentos antes da transação; leituras continuam disponíveis com SQL conectado; worker e Function também respeitam o bloqueio.
- Janela autorizada às 18:55: cron pausado e API 9c4f084 implantada com manutenção. A revisão automática bloqueou stdin antes de transmitir os valores; não houve reset de senha/token ou troca de chave. Às 18:57, cron reativado e manutenção retirada; deploy dep-dbfspblg1s2s73cjddvg confirmado live às 18:58. Às 18:59: health 200, POST financeiro sem sessão 401 (sem manutenção), cinco auditorias INTEGRO e cron failures=0. Helper de stdin encerrado e desativado antes de ler entrada/iniciar processos.
- README consolidado: URLs, arquitetura/regras, variáveis sem valores reais, migrations compiladas, demonstração, concorrência, liquidação, IA/revisão humana e riscos.
- Documentação de auditoria/delivery separa integridade matemática, confiança da chave e proteção operacional. Nenhum checkpoint foi apagado ou reescrito.

## Verificações e Git

- Ensaio controlado b91f50f: 10 testes de restrição/comparação financeira, 6 de manutenção/prontidão e 12 de liquidação PostgreSQL local aprovados (28). TypeScript, lint e build completos aprovados. CI do código aprovado: https://github.com/matssgit/elite-dev-verzel/actions/runs/40423925715 . Evidências em tmp/controlled-demo-settlement-result.json, controlled-demo-public-checks.json, controlled-demo-audits-after.json e controlled-demo-post-redeploy.json. Nenhum segredo ou sessão foi salvo nesses arquivos; a sessão dedicada foi revogada.

- Pós-rotação: comparação byte a byte dos eventos/checkpoints de cinco lotes (14 entradas); verificador independente aprovou cada histórico. Login/CORS/permissões, quatro rotas financeiras retornando 503 MAINTENANCE, reconexão WS e três comprovantes de R$11/R$70/R$10 aprovados. Sessão de teste encerrada. Nenhum lance/depósito/liquidação criado.
- /rotation-readiness da função usa transação READ ONLY seguida de ROLLBACK para consultar invariantes. Um objeto pequeno de prova é gravado em rotation-probes/, fora de elite-v1/checkpoints, com ID fixado no deploy, sem conteúdo controlado pelo cliente e sem sobrescrita. Endpoint indisponível quando manutenção=false. Não reativa cron nem executa processDue/settleAuction. Novas credenciais não foram lidas/transmitidas pelas ferramentas do agente.
- Verificação da função: HTTP 200, settledAuctions=4, pendingSettlements=1, preRotationConnections=0, migrations=3, blobRead/blobWriteProbe=true, automaticSettlementExecuted=false. Fingerprint preservada. Logs/retornos não incluem segredo.
- 18 testes direcionados aprovados nesta etapa: 4 de prontidão, 2 da manutenção da função e 12 de liquidação/auditoria local isolada. TypeScript/lint/build API aprovados. CI 19398e8 aprovado: https://github.com/matssgit/elite-dev-verzel/actions/runs/40421738835 . Evidências em tmp/rotation-after-audits.json, rotation-readiness-result.json e rotation-functional-checks.json; não versionadas.

- Estado inicial: main limpa, alinhada a origin/main, d26e208cdbd3b5a5066dd0746f9eca6bef6ed027.
- Revisão local dos cinco commits/70 caminhos: nenhum padrão de token/chave privada nem caminho sensível encontrado. .env/var/tmp/node_modules/.vercel ignorados. Essa busca não certifica ausência de exposição em logs externos.
- CI do commit implantado aprovado: https://github.com/matssgit/elite-dev-verzel/actions/runs/40370057271 .
- Sprint 5: testes direcionados de manutenção/fundação 11/11 aprovados; TypeScript, lint e build aprovados. Sprint 4 após correções compatíveis Drizzle/Zod: 29/29 direcionados financeiros/Blob; npm audit --omit=dev sem avisos. Existem avisos nas ferramentas de desenvolvimento; sem audit fix --force.
- Não foi executado QA completo nem repetida a suíte completa local a cada alteração.

## Pendências e bloqueios

1. Configuração SQL/Blob e ensaio controlado de R$50 concluídos. Credenciais antigas não foram testadas diretamente; expiração imediata Blob foi informada pelo operador. Cron continua pausado: o ensaio foi execução manual restrita, não prova pós-rotação do trigger agendado. Reabertura aguarda autorização.
2. Implementação/testes da transição criptográfica e confirmação separada antes de trocar a identidade de produção. Não há restauração de autenticidade retroativa de uma chave comprometida.
3. Suspensão física histórica classificada como inconclusiva; liquidação independente confirmada.
4. Franquias gratuitas, cold start e indisponibilidade eventual; manter sem upgrade e sem forma de pagamento Render. Não prometer disponibilidade gratuita indefinida.
5. Seed não renova lotes vencidos. Conferir lote ativo na data da avaliação e criar novo pelo painel se necessário, sem alterar prazos/saldos existentes.
6. Revisão humana e QA independente antes da entrega de 29/10/2026; prazo/horário final do formulário devem ser confirmados pelo responsável.

