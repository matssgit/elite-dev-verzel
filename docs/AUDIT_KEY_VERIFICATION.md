# Verificação final da rotação — 27/10/2026

## Resultado e estado operacional

**Substituição e ativação criptográfica verificadas; finanças NÃO reativadas.** Às 14:00 (America/Sao_Paulo), API Render e função Neon utilizam a mesma identidade nova, com o manifesto aprovado. FINANCIAL_MAINTENANCE=true, RUN_SETTLEMENT_JOBS=false e cron disabled (version 9841168, next_run_at=null). AUDIT_RECOVERY_MODE=false libera somente o servidor normal/validação criptográfica; o bloqueio financeiro continua. Nenhum recurso pago criado e nenhuma operação financeira executada nesta validação.

| Pin público | Valor |
|---|---|
| Chave ativa | `07e8ccdec02da616cf480e19a0599271679ed625376bf8968837502b0af94ab2` |
| Raiz histórica potencialmente comprometida | `dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3` |
| Manifesto aprovado | `126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1` |

Documentos públicos: [manifesto](AUDIT_SIGNING_REPLACEMENT.json), [chave ativa](AUDIT_ACTIVE_PUBLIC_KEY.pem), [raiz histórica](AUDIT_PRODUCTION_PUBLIC_KEY.pem) e [prova pública exportada](AUDIT_KEY_VERIFICATION.json). Nenhum desses arquivos contém material privado.

## Verificações realmente executadas

- Antes da ativação, os dois diagnósticos HTTP 200 derivaram a fingerprint nova a partir das privadas carregadas, confirmaram sua correspondência com o pin e o manifesto/hash aprovado, e identificaram que não são as identidades comprometidas. Chave privada/DPAPI/token nunca foram lidos pelo agente; o token temporário Render foi revogado conforme informação do operador.
- Cinco relatórios públicos aprovados pelo verificador independente, usando raiz histórica MAIS hash do manifesto. Os 15 registros/checkpoints, hashes, payloads e assinaturas continuam iguais à captura pós-ensaio; nenhum registro foi reassinado. Cada assinatura histórica aponta para a raiz dc33…ece3; nenhuma usa a candidata retirada cf2d…9c91.
- A função produziu uma assinatura Ed25519 nova com escopo `elite-audit-key-readiness`, verificada independentemente com a chave ativa. A prova inclui a fingerprint ativa e hash do manifesto; fica em rotation-probes/, fora dos checkpoints financeiros. Não representa lote, lance, liquidação ou comprovante novo.
- Quatro comprovantes existentes passaram HTTP 200 na API e na página pública, valores de R$50, R$11, R$70 e R$10 preservados, status INTEGRO e assinatura original dc33…ece3 identificada corretamente. CORS da origem canônica conferido nas respostas públicas.
- POST de depósito, criação de lote, lance e cancelamento devolveu 503 MAINTENANCE antes de autenticação/transação. Não foram criados usuários, sessões, depósitos, lances ou liquidações durante essa verificação.
- Snapshot canônico completo de wallets/wallet_entries/auctions/bids/receipts/audit_records, lido em transação READ ONLY, continuou igual ao baseline após o ensaio autorizado. Somente o resultado booleano é publicado; nenhum saldo/linha foi exposto pelo diagnóstico. Cinco lotes liquidados, zero pendentes; invariantes financeiras consistentes. automaticSettlementExecuted=false.

Comprovante de referência: https://elite-dev-verzel-zmats-projects.vercel.app/comprovantes/d209288d-6a1c-43a7-a0ec-c8fa5dbc21cc . Auditoria: https://elite-dev-verzel-zmats-projects.vercel.app/auditoria/00000000-0000-4000-8000-000000000100 .

## Persistência comprovada sem recriação

Primeira ativação: Render `dep-dbgdeu0u01pc738m4gng`, live às 13:56:49; função implantada por deploy/neon-audit-activate.ts. Publicação dos artefatos novos feita no MESMO prefixo elite-v1/, mantendo public.pem histórico e os 15 checkpoints:

- keys/07e8ccdec02da616cf480e19a0599271679ed625376bf8968837502b0af94ab2.pem;
- transitions/dc38b398-9f20-48e3-8851-e095e618cb46.json;
- rotation.json, com ID/hash/fingerprint novos;
- prova isolada em rotation-probes/key-<fingerprint>-<manifestHash>.json.

Depois, novo deploy nos dois consumidores com AUDIT_REQUIRE_EXISTING_TRANSITION=true e AUDIT_REQUIRE_EXISTING_SIGNING_PROOF=true, mantendo manutenção e jobs desligados. Essas flags obrigam a conferir os objetos ANTES de qualquer publicação e recusam ausência/divergência; no modo estrito, manifesto/guard/chave e prova NÃO são recriados. Render `dep-dbgdgd6i0phs73c70rhg`, live às 13:59:31; função por deploy/neon-audit-persistence.ts.

Conferência final às 14:00:35: existingTransitionArtifactsVerified=true, existingSigningProofVerified=true; prova idêntica à anterior, 15 históricos/checkpoints e quatro comprovantes novamente aprovados; snapshot financeiro inalterado. A primeira consulta antecipada durante a atualização ainda não confirmou o modo estrito e não foi usada como prova de sucesso. A rodada final ocorreu após o deploy Live e propagação da função.

Evidências locais ignoradas pelo Git: tmp/audit-new-key-before-activation.json, audit-new-key-initial-readiness.json, audit-final-before-redeploy.json, audit-final-after-redeploy.json, audit-final-reports-before-redeploy.json e audit-final-reports-after-redeploy.json. Somente dados já públicos/contagens/booleans, sem valores de ambiente privados.

## Reprodução independente

Para o JSON de auditoria baixado da página:

```sh
node scripts/verify-audit.mjs evidencia.json dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3 126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1
```

Para o manifesto e a prova nova exportados, sem depender do servidor:

```sh
node scripts/verify-audit-key-readiness.mjs docs/AUDIT_KEY_VERIFICATION.json dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3 126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1
```

Os pins precisam ser obtidos por canal independente/revisão humana; a chave e o hash entregues somente pela página não estabelecem confiança. A assinatura cobre o payload da prova, não os campos externos de horário/resultado observado no JSON exportado. Não é atestado contínuo ou prova de execução do cron.

## Testes e recuperação

70 testes de regressão/segurança locais aprovados antes do corte; mais dois casos novos aprovados para ausência de artefatos e prova, com execução dirigida de 16 testes. TypeScript/lint/build aprovados. CI completo do código 3a65ffb aprovado: https://github.com/matssgit/elite-dev-verzel/actions/runs/40545565006 . Os testes negativos não apagaram objetos de produção: usaram storage simulado e schemas locais isolados.

Se falhar: manter FINANCIAL_MAINTENANCE=true, RUN_SETTLEMENT_JOBS=false e cron pausado. Pode voltar somente a AUDIT_RECOVERY_MODE=true para diagnóstico read-only, preservando a chave nova, manifesto, pins e flags de objetos preexistentes. Não restaurar privadas expostas, trocar prefixo, substituir public.pem ou apagar guard/checkpoints para obter startup. Restaurar o MESMO artefato a partir de cópia confiável, quando houver, ou planejar outra transição revisada; falhar fechado se não houver recuperação confiável. Não executar de novo os scripts de geração/upload antigos após o corte.

## Limites e pendências

- A raiz e a candidata anterior continuam comprometidas para assinatura futura; as chaves públicas históricas são conservadas para verificação delimitada pelas fronteiras. Rotação não garante retrospectivamente a origem legítima de registros antigos.
- Blob continua sem WORM/retention lock; acesso conjunto a runtime/chave/token/banco ou administração dos provedores ultrapassa o modelo de ameaça. Não declarar auditoria inviolável nem R17 irrestritamente validado.
- O cron está pausado; esta etapa NÃO testou disparo automático pós-rotação, suspensão física do Render ou novos fluxos financeiros em produção. A prova histórica de suspensão permanece inconclusiva.
- Reativação financeira, eventual novo lote de demonstração e QA independente aguardam autorização/coordenação do responsável. Nenhuma autorização de reabertura foi inferida da conclusão da rotação.
