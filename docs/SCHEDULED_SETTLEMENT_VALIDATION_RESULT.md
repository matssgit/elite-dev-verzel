# Liquidação agendada — interrompida antes do setup

## Atualização da retomada autorizada — 27/10, 14:59

**O ensaio continua sem disparos reais.** A correção 404 de `5e32a45` foi conferida no Git e em produção: `/health` no Render, `/rotation-readiness` no Neon. Antes de iniciar, nove testes direcionados, TypeScript/lint, cinco históricos/15 checkpoints, snapshot e bloqueios passaram.

A primeira etapa de implantação não tornou a rota temporária disponível dentro do prazo limitado; nenhuma fixture foi criada. O comando passou a exigir `--update-existing` e confirmação JSON de branch/função realmente atualizadas, sem aceitar somente exit code zero (`4cbef23`). Essa correção de infraestrutura foi feita antes de qualquer tentativa financeira, preservando a autorização para o primeiro setup.

Na execução `d19c5a55-dc0e-44c5-9afa-63b500c6ff57`:

| Horário UTC | Evidência |
|---|---|
| 17:54:47 | Início do orquestrador |
| 17:55:00 | Atualização de settlement/production confirmada pela CLI em JSON |
| 17:55:02 | GET autenticado passou; 15 históricos/pins, manutenção e cron pausado conferidos |
| Antes de 17:55:08 | POST `/scheduled-validation/prepare` rejeitado com HTTP 403; nenhuma repetição financeira |
| 17:55:08 | Restauração da fonte normal confirmada pela CLI; sessão dedicada revogada |
| 17:59:33 | Conferência final: rota temporária 405, snapshot idêntico, 15 checkpoints/assinaturas preservados, quatro comprovantes íntegros e quatro rotas financeiras 503 |

**Não houve criação das contas, depósito, lote, lance, liquidação ou checkpoint novo.** O 403 ocorre antes da chamada de preparação no handler; a invariância integral do snapshot foi confirmada depois. Não houve primeiro ou segundo disparo: trigger continuou `enabled=false`, `next_run_at=null`, versão `9841168`, sem qualquer habilitação. Não houve compensação, recurso pago ou exposição de segredo. Manutenção continua true; jobs false preservados. A fonte temporária foi removida, confirmada por HTTP 405; o modo não chegou a ser armado.

A chamada para fechar o run também foi rejeitada; por isso o orquestrador registra `runClosed=false`, sem mascarar o resultado. Não foi possível confirmar fechamento pela rota de controle. Entretanto, nenhuma fixture foi criada, a sessão foi revogada, o cron nunca foi ativado e o consumidor voltou à fonte normal, que bloqueia liquidação em manutenção.

**Causa do 403 ainda não comprovada.** Após a confirmação da restauração pela CLI, a rota temporária ainda respondeu 403 e depois voltou a 405 sem outro deploy. Isso demonstra que o reconhecimento da implantação não bastou para confirmar imediatamente a fonte servida. Propagação entre versões/ambientes é uma hipótese para a diferença entre GET aceito e POST recusado, não uma causa estabelecida.

Preparado somente localmente: POST autenticado `/scheduled-validation/preflight`, sem setup, DDL, permissão ou escrita financeira; orquestrador exige GET e POST neutro consistentes em verificações sucessivas por pelo menos 30 segundos antes de permitir preparação. A restauração agora observa 405 com tentativas limitadas. Essa mitigação **não foi implantada/testada em produção** depois da rejeição de autorização. Não se deve repetir o POST financeiro para investigar o problema.

Após a interrupção: **11/11 testes direcionados**, TypeScript, lint e build aprovados. A regressão completa 78/78 anterior permanece registrada abaixo; não foi repetida inteira nesta retomada. Evidências atuais em [SCHEDULED_SETTLEMENT_VALIDATION_RESULT.json](SCHEDULED_SETTLEMENT_VALIDATION_RESULT.json). Próximo passo seguro é diagnosticar o POST neutro em produção, com manutenção ativa/cron pausado, antes de solicitar nova tentativa financeira. Não há instrução para fornecer credenciais pela conversa.

## Registro da tentativa anterior

Em 27/10/2026, o usuário autorizou somente SCHEDULED_SETTLEMENT_VALIDATION_PLAN.md, exigindo interrupção em caso de falha e proibindo novas tentativas financeiras automáticas. A pré-verificação iniciou às 17:39:50 UTC e interrompeu antes de qualquer setup, deploy ou ativação do cron.

## Resultado efetivo

**O teste agendado de produção não foi executado.** O script consultou equivocadamente `/rotation-readiness` no Render, recebendo HTTP 404. A rota existe apenas na função Neon. O script foi corrigido: Render usa `/health` e relatórios públicos; o diagnóstico de snapshot/invariantes/identidade é consultado no Neon. Não houve nova execução do ensaio após a falha.

Nenhuma conta exclusiva, depósito, lote, lance, liquidação, checkpoint, permissão persistente ou deploy novo foi criado. O cron nunca foi habilitado. Não houve primeiro/segundo disparo, estorno, recurso pago ou transferência de segredo.

A condição de parada foi respeitada. Retomar a execução controlada requer nova autorização explícita. Não há bloqueio de credenciais nem necessidade de retirar manutenção para retomar o plano corrigido.

## Estado após a interrupção

Conferência de leitura e probes já bloqueados às **17:42:43 UTC / 14:42:43 Brasília**; evidência pública em [SCHEDULED_SETTLEMENT_VALIDATION_RESULT.json](SCHEDULED_SETTLEMENT_VALIDATION_RESULT.json).

| Verificação | Resultado |
|---|---|
| Cinco históricos / 15 checkpoints | INTEGRO; registros, assinaturas e checkpoints idênticos ao baseline |
| Verificador independente | Cadeias, assinaturas, manifesto e prova da chave nova válidos |
| Snapshot financeiro | Igual a 53f9f00b00b93e188b90908c18f80beafeba4db0275baf20fd4dfd56b1c7ac3a |
| Invariantes financeiras no Neon | Aprovadas; nenhuma liquidação pendente |
| Quatro comprovantes antigos | API HTTP 200; INTEGRO |
| Depósitos, criação, lances e cancelamento públicos | HTTP 503, código MAINTENANCE |
| API Render | Health responde; deploy dep-dbgdgd6i0phs73c70rhg Live, commit 3a65ffb |
| Trigger existente | enabled=false, next_run_at=null, versão 9841168 |
| FINANCIAL_MAINTENANCE | Continua true; bloqueios públicos confirmados |
| Jobs / modo de validação | RUN_SETTLEMENT_JOBS=false preservado; fonte normal da função, sem permissão de teste criada/armada |

Chave ativa: `07e8ccdec02da616cf480e19a0599271679ed625376bf8968837502b0af94ab2`. Manifesto: `126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1`. Nenhuma chave privada foi aberta, copiada ou transferida pelo agente.

## Implementação local

Commit inicial c6d9dbb, seguido da correção do preflight. Contenções versionadas, **não implantadas**:

- Permissão PostgreSQL vinculada aos UUIDs, participantes, R$10 exatos, prazo máximo de dez minutos e teto de duas ocorrências elegíveis. Constraints persistentes para valor, prazo, estado e orçamento.
- Claim persistido antes da movimentação: interrupção deixa executing, que recusa nova execução automática. Advisory lock serializa fechamento e ocorrências.
- Mesmo processDue/settleAuction, locks e transação originais; busca de vencidos/outbox restritas ao lote. Prazo revalidado após espera nos locks das carteiras.
- Snapshot completo exclui somente IDs autorizados; confere depósito/razão exatos, reserva, comprovante e assinatura. Eventos antigos não são reescritos.
- Header Neon e payload correlacionados; duas ocorrências de minutos distintos; entrega duplicada não consome nova admissão.
- Fonte temporária exige manutenção, jobs desligados, identidade/manifesto fixados, artefatos remotos preexistentes e sessão dedicada do operador. Configuração transporta apenas hash da sessão e UUIDs públicos, preservando segredos sem env pull.
- Orquestrador fecha o run antes de pausar cron, remove fonte temporária e revoga sessão. Não repete setup/liquidação por HTTP. Exige flag `--execute-authorized-plan`, que não substitui autorização humana após falha.

Verificação local: regressão **78/78**; após adicionar expiração durante bloqueio da carteira, arquivo direcionado **7/7** (seis já incluídos na regressão e um adicional). PostgreSQL local em schemas isolados. TypeScript, lint, build e sintaxe do orquestrador aprovados. Build mantém avisos existentes de tamanho de bundle/anotações de dependência. Testes substituem os pins por identidade de fixture; não usam a chave privada de produção.

## Pendente e limites

Débito/crédito únicos, reserva liberada, comprovante e SETTLE pela chave nova, segundo disparo real idempotente, logs correlacionados e persistência dos novos checkpoints **continuam pendentes em produção**. Testes locais não aprovam esse marco.

A chave antiga permanece potencialmente comprometida; INTEGRO não prova autoria retroativa. Blob não oferece WORM. Nenhuma suspensão física do Render ou proteção contra comprometimento conjunto de runtime/banco/storage foi comprovada por este ensaio.

Para retomar: obter autorização de nova tentativa; revisar o estado preservado; executar uma única vez o script corrigido com a flag explícita. Ele reconfere manutenção/baseline/cron antes de preparar a fixture. Não retirar manutenção, ampliar janela, recriar fixture após erro ou ativar cron manualmente para contornar travas.
