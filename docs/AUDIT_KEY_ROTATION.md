# Fase 2 — preparação da transição Ed25519

## Implementação autorizada — estado atual

O usuário autorizou iniciar a fase 2 após o ensaio. Suporte a múltiplas chaves implementado no backend, contratos, comprovantes, página e CLI. Eventos novos identificam a chave em `payload.signingKeyFingerprint`, dentro do conteúdo assinado; os antigos permanecem byte a byte intactos e recebem identificação no mapa público `signatureKeys`, determinada pelo manifesto/fronteiras. Sem migration ou reassinatura.

O runtime exige o hash público independente do manifesto (`AUDIT_TRANSITION_SHA256`), a nova fingerprint e a assinatura do manifesto pela nova chave. Confere o pin histórico remoto e todas as fronteiras antes de publicar novos objetos. `elite-v1/public.pem` permanece histórico; a chave nova usa `keys/<fingerprint>.pem`, o manifesto `transitions/<id>.json`, e `rotation.json` é marcador persistente que recusa consumidores atualizados configurados apenas com a chave antiga. A aplicação publica sem sobrescrita; isso não adiciona WORM ao Blob.

**Ainda não existe chave nova de produção nem manifesto final.** A geração/inserção exige handoff nativo, respeitando a restrição anterior de não transportar novos segredos pelo terminal do agente. Não há necessidade de repetir autorização do escopo. O próximo passo humano é somente gerar/proteger a chave e preparar o manifesto público; não aplicar configurações antes de sua revisão.

Validação: 62 testes aprovados, incluindo cadeia mista com liquidação PostgreSQL em schema local isolado, comprovante com identidade correta, recuperação da outbox, preservação dos objetos, rejeição de rollback/manifestações falsas/sufixos da chave antiga. TypeScript/lint/build aprovados. Scripts nativos passaram análise sintática; o fluxo de DPAPI/clipboard com chave real ainda depende da execução manual. Não declarar rotação efetiva nem persistência da chave nova em produção antes dessa etapa.

Código de compatibilidade 9ef6bd9 implantado na API (dep-dbfusk942hec73d2qc0g live) e frontend (dpl_CNSMn7KcM22VUncHESGL3Sdsebyo READY), e função atualizada sem trocar segredos. Às 21:23: cinco auditorias/15 checkpoints byte a byte preservados, quatro comprovantes válidos com identificação da chave, frontend atualizado, quatro POSTs financeiros 503 MAINTENANCE; prontidão da função confirma manutenção, zero pendentes e invariantes corretas. Trigger version 9841168 permanece disabled/next_run_at=null. A entrada direta do agendador retorna 403, não comprova execução automática. Evidência local: tmp/phase2-compatible-deploy-checks.json. A prova de escrita da prontidão recebeu nome separado por identidade para não sobrescrever a anterior.

Após aplicar a chave, `/rotation-readiness` também gera prova Ed25519 determinística com escopo `elite-audit-key-readiness`, fingerprint ativa e hash do manifesto, publicada/lida somente em `rotation-probes/key-<fingerprint>-<hash>.json`. Ela não contém lote, lance ou movimentação financeira. O retorno público inclui `signingProof`; `scripts/verify-audit-key-readiness.mjs` verifica manifesto/pins e assinatura independentemente. Repetir depois de redeploy comprova preservação da prova. Isso ainda NÃO foi executado com a nova chave real. Dois testes adicionais posteriores à suíte inicial (prontidão com nova identidade e prova independente) passaram em execução dirigida.

### Ação manual 1: preparação, sem corte

1. Abra **PowerShell nativo do Windows**, sem gravação/transcrição de sessão. Não use o terminal automatizado do agente. Não cole chaves na conversa.
2. Execute:

   ```powershell
   cd F:\teste-verzel
   node .\scripts\prepare-audit-key.mjs
   ```

3. O script verifica as cinco auditorias contra a fronteira revisada antes de gerar qualquer chave. Se houver divergência/indisponibilidade, interrompe. Gera Ed25519 em memória e grava apenas uma cópia cifrada por DPAPI do usuário Windows em `var/audit-key-rotation/new-private-key.dpapi`, com ACL do usuário/SYSTEM, ignorada pelo Git. Nunca imprime/grava a chave privada em texto puro. Não sobrescreve preparação existente.
4. Cria `docs/AUDIT_SIGNING_TRANSITION.json`, documento **público** com chaves públicas, fronteiras e assinatura nova; mostra somente fingerprint/hash públicos. Não modifica Render, Neon, Blob, flags ou cron. Não envia segredos pela rede nessa preparação.
5. Avise apenas **“preparação da chave concluída”**. O agente revisará o documento público e sua assinatura, confrontará novamente os 15 checkpoints e publicará/fixará os pins antes do corte.

O arquivo DPAPI só pode ser aberto pela mesma identidade Windows e pode se tornar inacessível após perda do perfil/SID. Não copiá-lo para a conversa ou Git. O conteúdo permanece transitório na memória dos processos nativos; DPAPI não protege uma máquina/conta já comprometida. Falha posterior à gravação deve ser investigada sem regenerar/sobrescrever automaticamente.

### Ação manual 2: consumidores, somente depois da revisão

O script `scripts/configure-audit-key.ps1 -ExpectedTransitionHash <HASH_PUBLICO_REVISADO>` está preparado, **não executar ainda**. Confere o manifesto/pin e que a chave privada cifrada corresponde à sucessora; copia cada valor diretamente para clipboard para inserção nos quatro campos Render: `AUDIT_PRIVATE_KEY`, `AUDIT_PUBLIC_KEY_FINGERPRINT`, `AUDIT_TRANSITION_JSON`, `AUDIT_TRANSITION_SHA256`. A chave usa quebras `\n` literais. Limpa clipboard entre campos e ao terminar; mantenha histórico/sincronização do clipboard desativados antes dessa etapa.

Preserva `FINANCIAL_MAINTENANCE=true` e `RUN_SETTLEMENT_JOBS=false`. Após salvar/rebuild/redeploy do Render, solicita `APLICAR` no terminal nativo e implanta `deploy/neon-audit-key.ts` na função existente, por ambiente protegido herdado; SQL/Blob omitidos e preservados. Nenhum segredo em argv/arquivo texto/log. O hash passado no comando é público. Pode haver indisponibilidade da auditoria entre os dois consumidores: o guard recusa runtime antigo; cron/escritas continuam bloqueados.

Após o usuário confirmar a configuração: conferir os 15 checkpoints e comprovantes antigos, mapa de chaves, manifesto/pins e guard; gerar prova nova assinada em namespace de validação separado (ou um fluxo demo específico autorizado), verificar por CLI e leitura pública, redeployar ambos os consumidores e repetir as leituras. Não reabrir automaticamente.

As seções originais abaixo descrevem o plano e critérios; a implementação acima não equivale ao corte concluído.

Preparado em 26/10/2026 após o ensaio simulado das 21:03 (America/Sao_Paulo). **Não houve geração/troca de chave, troca de pin ou autorização de corte.** API/função continuam em manutenção e o cron continua pausado. Este documento é o plano concreto da implementação seguinte, não uma rotação concluída.

## Fronteira histórica preservada

[AUDIT_ROTATION_BOUNDARY.json](AUDIT_ROTATION_BOUNDARY.json) registra os hashes/sequências finais observados nos cinco lotes, com 15 eventos/checkpoints após o ensaio. O verificador independente conferiu todas as cadeias. Os 14 checkpoints anteriores permanecem idênticos; só o lote original recebeu SETTLE na sequência 2, hash `d64660dda46b0ce5a55d512f65ca13a7603fa9b19788d0c5c1e56be975af3b5d`.

A captura é pública, sem chave privada, sem assinatura de transição e com `successorFingerprint:null` e `transitionAuthorized:false`. Não é consumida automaticamente pelo runtime. A chave antiga permanece potencialmente comprometida: capturar o estado observado não certifica retroativamente sua autoria. Antes do corte, recapturar/comparar o estado durante manutenção; qualquer divergência exige investigação, nunca atualização silenciosa da fronteira.

## Menor evolução de código necessária

1. Preservar os eventos v1 e seus bytes, hashes e assinaturas. Manter `elite-v1/public.pem` e todos os objetos antigos. Não reassinar eventos, não abrir um namespace vazio e não reiniciar sequências.
2. Acrescentar um keyring público e manifesto de transição com fingerprint antiga, nova chave pública/fingerprint, fronteiras por lote e versão do formato. Fixar o hash do manifesto e a nova identidade por revisão humana em canal independente/Git; a assinatura da chave antiga sozinha não autoriza a sucessora. O manifesto final deve ser assinado pela chave nova.
3. Selecionar a chave de verificação pelo lote/sequência: chave antiga somente até a fronteira fixada; chave nova obrigatória depois dela e desde OPEN para lotes novos. Continuar `previousHash` do último evento antigo. Não mudar a serialização canônica v1 apenas para acrescentar identificação de chave: o manifesto determina o verificador aplicável.
4. Refatorar `AuditStore.valid/checkpoints`, assinatura/publicação e `checkHistory` para usar esse keyring. Exigir que todo histórico de lote antigo contenha o hash exato da fronteira; um prefixo menor é rollback, mesmo com assinaturas antigas válidas. Chave antiga depois da fronteira, lote antigo ausente do manifesto, nova chave divergente ou manifesto inválido devem falhar fechados.
5. Publicar nova chave em caminho imutável por convenção, como `keys/<fingerprint>.pem`, e manifesto em `transitions/<id>.json`, sem substituir `public.pem`. Manter pin raiz histórico separado do pin ativo. No relatório público, preservar campos legados e acrescentar `keyring`, `transition` e `activeFingerprint`; atualizar página, comprovante e CLI para cadeias mistas. CLI antigo deve recusar cadeia mista, nunca aceitá-la usando uma única chave.
6. Configurar somente a chave privada ativa no runtime após o corte; conservar a chave pública antiga para história. Evitar manter duas chaves privadas em produção. Os valores privados entram exclusivamente pelos painéis/fluxo nativo protegido; não por conversa, argv, Git ou arquivos temporários do agente.

## Testes obrigatórios antes do corte

| Caso | Resultado exigido |
|---|---|
| Cinco históricos/comprovantes antigos e 15 checkpoints capturados | Verificáveis sem alteração de bytes |
| Lote antigo com novo evento | Encadeamento antigo → novo válido |
| Lote novo | OPEN e demais eventos somente com chave nova |
| Sufixo forjado usando a chave antiga | Recusado mesmo com assinatura matematicamente válida |
| Rollback anterior à fronteira ou lote ausente do manifesto | Recusado |
| Manifesto/chave/hash fixado divergente | Falha fechada, sem escrita financeira |
| Outbox interrompida antes/depois do corte | Recuperação sem duplicação nem troca da chave de evento já gravado |
| API e função com configurações incompatíveis | Bloqueio explícito; nenhum consumidor assina com chave antiga após a fronteira |
| Reinício/redeploy com keyring novo | História mista e comprovantes preservados |

## Corte e recuperação, ainda não executados

Implementar/testar primeiro sem segredos reais; manter manutenção e trigger pausado. Preparar patch, manifesto final e novos pins para revisão. Após autorização específica de corte, gerar chave por mecanismo protegido, inserir campos nos consumidores, implantar API/função compatíveis, validar keyring e histórico, executar um fluxo simulado autorizado e verificar o primeiro checkpoint novo. Reabertura exige autorização separada do usuário.

Se falhar antes de emitir evento novo, manter manutenção e preservar as evidências. Depois de emitir evento com chave nova, não restaurar o runtime de chave única antiga: isso quebraria a continuidade. Recuperar com versão compatível com o keyring e chave ativa nova. Nunca apagar o novo checkpoint para fazer rollback funcionar.

Vercel Blob continua sem WORM/retention lock; comprometimento conjunto de chave ativa, token/runtime e banco continua fora da proteção restrita ao SQL. Rotação reduz exposição futura; não elimina essa limitação nem torna o histórico antigo retroativamente confiável.
