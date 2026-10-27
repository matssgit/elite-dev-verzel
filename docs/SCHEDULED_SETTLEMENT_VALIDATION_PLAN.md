# Plano autorizado — liquidação pelo agendador real

**Execução autorizada pelo usuário em 27/10/2026**, exclusivamente neste escopo e sem reabertura financeira. A preparação original deste plano não executou alterações; a implementação e as verificações locais posteriores à autorização estão registradas no relatório do ensaio. FINANCIAL_MAINTENANCE permanece ativa durante todo o procedimento.

## Escopo proposto

Uma única liquidação de **R$10,00 simulados**, em lote novo e com comprador/vendedor exclusivos do teste. Mesmos PostgreSQL, worker, chave ativa e Blob já usados na demonstração. Nenhuma integração de pagamento ou dinheiro real. Nenhum recurso pago, upgrade, troca de chave ou transferência de segredo.

Usar o trigger existente `trigger-81af7a75-3b54-4914-ad70-d410cfb95939`, função `settlement`, branch `production`, projeto `cold-haze-51518470`. Após autorização, habilitar temporariamente o cron real por minuto; não chamar o worker manualmente para substituir o disparo agendado. Registrar os UUIDs novos antes de armar o trigger e mantê-los imutáveis durante a janela.

| Carteira exclusiva | Antes do lance | Reserva após lance | Após a liquidação |
|---|---:|---:|---:|
| Comprador de teste | R$100,00 de depósito simulado | R$10,00 | Total R$90,00, reserva R$0,00 |
| Vendedor de teste | R$0,00 | R$0,00 | Total R$10,00, reserva R$0,00 |

Setup autorizado proposto: duas contas fictícias sem dados pessoais, um depósito simulado de 10000 centavos, um lote com lance inicial de 1000 centavos/incremento de 100 e um lance de 1000. Reutilizar snapshot de catálogo já persistido, sem dependência de API externa ou alteração dos lotes existentes. Encerramento em aproximadamente quatro minutos, conforme hora efetiva do PostgreSQL. Aceitar o lance fora dos últimos 120 segundos para não introduzir prorrogação por anti-sniping; registrar o endsAt efetivamente persistido.

## Compatibilidade com a manutenção

Hoje tanto o handler da função quanto processDue retornam sem liquidar quando FINANCIAL_MAINTENANCE=true. Apenas habilitar o cron não exercitaria a liquidação.

Proposta de menor alteração, somente depois da autorização: um modo de validação agendada, desativado por padrão, que fornece ao MESMO processDue uma permissão interna e restrita ao UUID do lote autorizado. Reutilizar settleAuction e suas transações/locks, sem implementar outro algoritmo de débito/crédito. Sob essa permissão, a busca de vencidos e a publicação da outbox ficam restritas ao lote do teste; nenhuma inicialização de lotes legados ou varredura/publicação global é permitida.

**FINANCIAL_MAINTENANCE=true deve permanecer no Render e no Neon durante todo o ensaio.** Render mantém RUN_SETTLEMENT_JOBS=false. Criação/lances/depósitos/cancelamentos pelas rotas públicas continuam retornando 503. O setup interno autorizado é limitado aos objetos da tabela acima; não é reabertura geral dessas rotas.

A exceção precisa ser implementada/testada localmente antes de qualquer deploy ou habilitação do trigger. Não há exceção financeira já implementada/ativada por este plano. Chave ativa 07e8…94ab2, manifesto 126e42…25a1 e flags de exigir artefatos remotos preexistentes permanecem preservados.

## Travas obrigatórias

- Manifesto/pins e os 15 checkpoints originais iguais ao baseline antes de preparar/armar. Se faltar artefato ou houver divergência, não iniciar.
- Permissão configurada no servidor e vinculada a runId, lote, comprador, vendedor, valor exato de 1000 centavos, trigger esperado e prazo absoluto. Nenhum parâmetro de cliente escolhe lote, valor ou destinatário.
- Controle persistente no PostgreSQL, separado dos saldos, com bloqueio e unicidade por run/ocorrência. Limitar a **duas ocorrências distintas após o fim**: a primeira liquida, a seguinte deve comprovar ausência de nova movimentação. Redelivery da mesma ocorrência não cria nova autorização.
- Janela máxima de dez minutos a partir da preparação autorizada. Comparar o prazo com o relógio do banco; após expiração ou fechamento do run, nenhuma chamada pode liquidar, mesmo que o cron continue habilitado ou exista invocação na fila.
- Conferir metadados do trigger, correspondência do invocation_id com o header reservado Neon, tipo schedule e scheduled_at; registrar IDs/horários e correlacionar com os logs do provedor. Exigir as duas ocorrências posteriores ao endsAt; uma chamada HTTP manual não vale como prova de agendamento.
- Preservar locks de lote/carteiras em ordem, validação de reservas, idempotência e constraints existentes. Nem a exceção nem erro de teste podem autorizar processDue global com manutenção ativa.

## Sequência, após autorização explícita

1. **Preparar contenção sem armar:** implementar o escopo mínimo e testar localmente os caminhos normal/validação, negativas para outro lote/valor/participantes, expiração, fechamento, corrida/duplicação e manutenção. TypeScript/lint/build. Implantar inicialmente com a permissão desativada e o cron ainda pausado. Qualquer falha interrompe antes de produção.
2. **Capturar baseline:** conferir identidade nova e manifesto nos consumidores, 15 históricos/checkpoints e quatro comprovantes existentes; capturar snapshot financeiro e separar a lista exata de IDs permitidos. Verificar que as rotas públicas continuam bloqueadas.
3. **Preparar somente a fixture:** criar os objetos fictícios da tabela pelos serviços existentes em uma preparação interna restrita/idempotente. OPEN e BID assinados pela chave nova, sem tocar nos 15 antigos. Persistir o run, prazo e limite de ocorrências, ainda sem habilitar cron.
4. **Armar a janela autorizada:** habilitar a permissão e SOMENTE o trigger existente, temporariamente. As ocorrências anteriores ao fim devem observar o lote ainda aberto sem transferir saldo. Aguardar o agendador real.
5. **Primeira ocorrência após o fim:** comprovar, pelo ID/horário real e logs, um PURCHASE -1000 do comprador e um SALE +1000 do vendedor, reserva liberada, um comprovante, um SETTLE e um checkpoint novo publicado/assinado pela chave ativa.
6. **Ocorrência seguinte:** aguardar outro disparo real do cron, de minuto distinto. Comparar o snapshot financeiro ao pós-primeira execução: nenhuma nova movimentação, comprovante, SETTLE ou checkpoint. Logs de controle podem ganhar uma observação de no-op; isso não é movimentação financeira.
7. **Fechar e conter:** marcar o run fechado no PostgreSQL, bloquear novas admissões e pausar novamente o cron; depois remover/desarmar o modo de teste e restaurar o worker normal com manutenção ativa. Uma invocação já admitida pode terminar sua transação; pausar cron não a desfaz. Esperar conclusão/timeout e conferir novamente os resultados antes de declarar encerrado.
8. **Publicar evidências:** IDs e horários das duas ocorrências reais, deltas esperados, razão, comprovante acessível, assinaturas e comparações antes/depois. Preservar os artefatos do teste para auditoria, sem apagar/estornar registros para “limpar” o resultado. Não reabrir a plataforma.

Estimativa operacional: após a preparação/implantação, cerca de 6–8 minutos de observação, com prazo de dez minutos para admissões. Atraso do provedor pode tornar o ensaio inconclusivo. Não ampliar a janela ou o escopo automaticamente e não substituir o cron por liquidação manual.

## Critérios objetivos de aprovação

| Critério | Evidência exigida |
|---|---|
| Agendamento verdadeiro | Duas ocorrências do trigger existente, com scheduled_at/invocation_id e logs correlacionados |
| Worker com identidade nova | OPEN, BID e SETTLE do lote novo exigem fingerprint 07e8…94ab2; verificador independente com raiz e hash do manifesto |
| Débito/crédito únicos | Exatamente PURCHASE -1000 e SALE +1000; transferência líquida entre carteiras soma zero |
| Reserva correta | Comprometimento do comprador 1000 → 0; total 10000 → 9000; vendedor 0 → 1000 |
| Comprovante | Um por lote, valor R$10, assinatura nova e acesso público válidos |
| Idempotência | Segunda ocorrência real sem alteração do snapshot financeiro pós-liquidação |
| Históricos antigos | Os 15 checkpoints/assinaturas anteriores permanecem idênticos e verificáveis |
| Contenção global | Snapshot das tabelas originais, excluindo SOMENTE os IDs novos autorizados, igual ao baseline; nenhuma movimentação fora da fixture |
| Encerramento | Run fechado, modo de teste desarmado, cron disabled, manutenção ativa e rotas financeiras 503 |

O total esperado passa de 15 para **18 checkpoints**: três do lote novo (OPEN/BID/SETTLE), sem duplicar ou substituir os antigos. O depósito simulado inicial é uma movimentação de setup esperada e separada das duas entradas de liquidação. Todos os objetos novos devem constar na lista autorizada.

O indicador global financialSnapshotMatchesIncidentBaseline deixará de ser verdadeiro pela inclusão legítima da fixture. Isso é esperado e não será ocultado: o verificador do ensaio compara os dados antigos excluindo exclusivamente os novos IDs, além de conferir os deltas completos dos novos objetos. Não substituir as fronteiras históricas nem alterar o manifesto para fazer esse indicador voltar a true.

## Riscos e medidas de contenção

| Risco | Contenção / condição de parada |
|---|---|
| Worker alcançar outros lotes | Escopo obrigatório no SQL e na outbox; UUID/valor/participantes fixos; manutenção global verdadeira |
| Reentrega, concorrência ou tick já enfileirado | Controle persistente por ocorrência, teto de duas admissões, locks/uniqueness e run fechado antes de pausar cron |
| Atraso, cold start ou indisponibilidade gratuita | Janela limitada; sem nova admissão após o prazo; pausar e reportar falha/inconclusivo, sem aumentar plano |
| SQL confirmar e Blob falhar depois | Outbox existente, retry sem nova cobrança; nenhum sucesso declarado sem checkpoint. Preservar estado pendente e reportar, nunca apagar/estornar/recriar para mascarar |
| Falha durante preparação ou entre ocorrências | Pausar/desarmar, preservar evidência parcial e não ampliar o orçamento de execuções automaticamente |
| Alteração financeira inesperada ou falha de integridade | Bloquear novas admissões, pausar trigger e manter manutenção. Transação em voo não é magicamente cancelada; conferir o resultado persistido, sem compensação automática |
| Confundir teste com dinheiro real | Contas/dados fictícios, saldo somente simulado, valor máximo R$10 de transferência e nenhuma API de pagamento |

A assinatura antiga continua sob suspeita de comprometimento, e Blob não é WORM. O ensaio comprova apenas o fluxo agendado controlado sob a chave nova; não resolve autoria retroativa nem comprova suspensão física do Render. Nenhuma suspensão do Render faz parte deste escopo.

## Base técnica e autorização necessária

O plano usa Function Triggers Neon, cron numérico de cinco campos em UTC, com ocorrência identificada no payload. A documentação informa que headers X-Neon-* enviados por clientes são removidos e que desabilitar o trigger não cancela uma ocorrência já enfileirada. Por isso são obrigatórios tanto a verificação dos metadados quanto o fechamento/expiração persistente: [Schedule a function](https://neon.com/docs/compute/functions/triggers/schedule).

A autorização solicitada é para implementar/deployar a contenção descrita, preparar **somente** a fixture acima, habilitar temporariamente o trigger real para essas duas ocorrências e pausá-lo ao concluir ou abortar. NÃO inclui retirar manutenção, reativar lances/depósitos/cancelamentos, varrer outros lotes, executar pagamentos reais, criar recursos pagos ou abrir a plataforma. Até essa autorização, somente este plano está preparado.
