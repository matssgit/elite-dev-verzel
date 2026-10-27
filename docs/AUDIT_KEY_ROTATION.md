# Fase 2 — preparação da transição Ed25519

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
