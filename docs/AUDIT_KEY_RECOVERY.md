# Recuperação após exposição de chaves — 27/10/2026

## Pré-validação tolerante à inicialização, sem repetir uploads

Após relato de HTTP 503 na consulta do script, ambos os diagnósticos responderam HTTP 200 em nova conferência. Render segue Live em 4aedfa2, com manutenção/recuperação ativas, jobs desativados, 15 checkpoints preservados e snapshot financeiro igual; Neon confirma as mesmas condições e cron segue disabled (version 9841168, next_run_at=null). O manifesto novo permanece com hash `126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1`, validado novamente. Não foi aberta chave DPAPI, solicitado token ou executado upload.

O 503 não foi reproduzido e sua causa histórica não foi comprovada. A [documentação Render Free](https://render.com/docs/free#spinning-down-on-idle) descreve retomada após inatividade, levando aproximadamente um minuto: é compatível com uma falha transitória, não prova de que esse foi o evento observado. O script anterior abortava no primeiro HTTP não bem-sucedido.

`scripts/audit-recovery-preflight.ps1` agora executa somente GET nos dois hosts fixos, sem autenticação ou redirecionamento: até quatro tentativas por endpoint, timeout configurado de 30 segundos e esperas de 5/10/15 segundos. Só repete HTTP 408/429/502/503/504 ou falhas transitórias de transporte. HTTP 401/403/404, redirect, TLS/certificado, resposta inválida e divergência semântica interrompem sem abrir DPAPI. HTTP 503 contendo diagnóstico estruturado do runtime com falha também interrompe imediatamente, sem mascarar erro de integridade como inicialização.

Validação exige booleans reais, contagens inteiras, manutenção/recuperação/jobs desligados nos valores corretos, 15 checkpoints, nenhum lote inesperado, ausência de guard, pin e snapshot iguais e runtime correspondente ao host. A conferência pública do manifesto ocorre antes; só após os DOIS diagnósticos aprovados o fluxo chega ao DPAPI/token.

Nenhuma repetição automática foi adicionada aos PUTs/POST do envio de segredo/deploy ou à implantação Neon. Não repetir upload incerto indiscriminadamente: inspecionar os diagnósticos e estado público antes. Testes: 14 cenários de pré-validação com HTTP/sleep totalmente simulados, incluindo esgotamento, falhas semânticas, autenticação e TLS; testes existentes do uploader também passaram. O novo helper foi executado ainda com GETs REAIS nos dois diagnósticos e confirmou compatibilidade com a recuperação atual. Sintaxe PowerShell aprovada. A alteração é local ao procedimento; nenhum serviço/flag/credencial foi alterado nesta conferência.

## Nova candidata revisada e aprovada para upload nativo, 13:30

Operador concluiu prepare-audit-key.mjs --replacement. O agente revisou somente o documento público, sem abrir DPAPI ou chave privada:

- Documento: [AUDIT_SIGNING_REPLACEMENT.json](AUDIT_SIGNING_REPLACEMENT.json), ID dc38b398-9f20-48e3-8851-e095e618cb46;
- fingerprint nova: `07e8ccdec02da616cf480e19a0599271679ed625376bf8968837502b0af94ab2`;
- hash SHA-256 canônico: `126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1`;
- parser estrito do runtime e verificador independente aprovaram formato, chaves e assinatura nova; identidade fora da lista comprometida, raiz pública original preservada e cinco fronteiras idênticas;
- Render e Neon confirmaram manutenção/recuperação ativas e jobs desligados, 15 checkpoints preservados, snapshot financeiro igual, zero lotes inesperados e ausência de guard/artefatos da candidata retirada. Cron disabled, version 9841168, next_run_at=null;
- nenhum consumidor alterado com a chave nova, nenhuma ativação ou movimentação financeira executada; evidência pública/booleana local em tmp/audit-replacement-review.json.

Esta revisão autoriza o próximo handoff nativo no escopo já solicitado. Comparar fingerprint/hash com a saída local do preparo antes de prosseguir. Divergência interrompe; não enviar valores privados para conferência.

### Próxima ação humana: configuração direta por HTTPS

1. Fechar execuções antigas e abrir PowerShell NATIVO com o mesmo usuário Windows, sem transcrição. Não usar configure-audit-key.ps1 nem qualquer helper de clipboard.
2. Na conta Render, Account Settings > API Keys, criar token temporário para esta operação. Não enviar o token à conversa ou colocá-lo no comando/arquivo. Inserir somente quando o script solicitar a entrada oculta.
3. Executar:

   ```powershell
   cd F:\teste-verzel
   .\scripts\apply-audit-key-direct.ps1 -ExpectedTransitionHash 126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1
   ```

4. O script verifica o manifesto PUBLICAMENTE antes de abrir DPAPI e valida a privada depois de abri-lo, sem mostrá-la. Quando solicitar o token da API Render, fornecer SOMENTE esse token — a chave de assinatura é recuperada automaticamente do DPAPI novo, não deve ser colada em lugar algum.
5. O envio vai diretamente por HTTPS para as sete variáveis permitidas do serviço fixo; preserva FINANCIAL_MAINTENANCE=true, AUDIT_RECOVERY_MODE=true, RUN_SETTLEMENT_JOBS=false. O script informa apenas um deploy ID público. Aguardar status Live no Render e digitar APLICAR no terminal nativo para implantar a MESMA configuração na função Neon, também em recuperação.
6. Revogar o token temporário Render ao terminar e informar **“configuração HTTPS concluída”**. Em caso de erro, não imprimir request/response/cabeçalhos/env; enviar somente mensagem genérica e estado público. Manter manutenção/recuperação/cron pausado.

Nenhuma requisição real do uploader foi executada pelo agente. Teste de transporte com HTTP simulado aprovado novamente; sintaxe PowerShell e lint aprovados. A assinatura nova no runtime, identidade dos dois consumidores, publicação do manifesto/guard e persistência pós-redeploy só serão declaradas verificadas após a configuração real e as etapas de ativação criptográfica abaixo. Não reativar finanças automaticamente.

## Estado confirmado, antes de qualquer reativação

Conferência final às 12:59 de 27/10: código 4aedfa2 ativo no Render (`dep-dbgcjt0u01pc73aomag0`, live) e função atualizada em recuperação. CI aprovado: https://github.com/matssgit/elite-dev-verzel/actions/runs/40536125587 . Ambos confirmam ausência também dos objetos remotos da chave/manifesto candidatos retirados, além da ausência de rotation.json. Os 15 checkpoints e o snapshot financeiro permanecem idênticos. Evidência agregada sem segredos: tmp/audit-incident-final.json. Nenhum upload de nova chave nem ativação ocorreu.

Incidente informado pelo operador: valor privado usado no procedimento foi exposto em outra conversa. O agente não pediu/leu esse valor nem abriu DPAPI/clipboard. Por precaução, as duas identidades conhecidas estão comprometidas para assinatura futura:

| Identidade pública | Destino |
|---|---|
| `dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3` | Raiz histórica: verificar somente os 15 eventos já observados |
| `cf2d363c00c091450177e17cf62d4be0b1f8c0f2be8a911a42e08444329d9c91` | Candidata retirada: não aplicar/reutilizar para assinatura |

Manifesto anterior `AUDIT_SIGNING_TRANSITION.json`, hash `36456231ec23295539ca214a25ec3151c9e876de11abb5f7911e3c3a68ed7943`, preservado como artefato público, com aprovação de aplicação RETIRADA. Registro de incidente: AUDIT_KEY_INCIDENT.json. Não apagar checkpoints, reescrever assinaturas, mudar o prefixo ou reutilizar qualquer material privado exposto.

Diagnóstico executado dentro dos runtimes, às 12:46–12:47 de 27/10 (America/Sao_Paulo), depois de implantar recuperação:

| Verificação | Render | Neon |
|---|---|---|
| Chave privada parseável, Ed25519 | Sim | Sim |
| Fingerprint derivada da chave | cf2d…9c91 | dc33…ece3 |
| Privada corresponde ao fingerprint configurado | Sim | Sim |
| Três variáveis públicas correspondem ao manifesto preparado anterior | Sim, inclusive hash e assinatura | Não: manifesto/hash ausentes e fingerprint antigo |
| Identidade conhecida comprometida | Sim | Sim |
| Checkpoints observados | 15, preservados | 15, preservados |
| Todas as assinaturas/encadeamentos/fronteiras observadas conferem | Sim | Sim |
| Snapshot financeiro igual ao pós-ensaio autorizado | Sim | Sim |
| Marcador remoto rotation.json | Ausente | Ausente |

A suspeita de chave incompatível no Render não se confirmou para a configuração salva carregada nesse deploy. Isso NÃO torna a chave segura: a exposição invalida seu uso futuro. Não confundir valores não salvos de uma aba com configuração efetivamente carregada.

Render em recuperação `dep-dbgcekom7kps73c1jkhg` live (b07a562); flags públicas FINANCIAL_MAINTENANCE=true, AUDIT_RECOVERY_MODE=true, RUN_SETTLEMENT_JOBS=false. Na função, as mesmas flags estão ativas e o cron continua disabled, version 9841168, next_run_at=null. O servidor de recuperação bloqueia TODAS as requisições de escrita, não inicia AuditStore, não publica manifesto/guard/prova e pula seed/migrations; SQL usa transação READ ONLY/ROLLBACK e Blob apenas GET/listagem.

Diagnóstico retorna somente fingerprints, contagens e booleans. Nenhum saldo, carteira, lance, comprovante, linha do banco, payload de evento, conteúdo de checkpoint ou segredo é retornado. A primeira proposta de diagnóstico detalhado foi rejeitada pela revisão automática; foi substituída por essa versão mínima, sem contornar o bloqueio. Evidências locais sem segredos: tmp/audit-incident-render.json e tmp/audit-incident-neon.json.

## Nova preparação: etapa humana necessária

Ainda não foi gerada pelo agente uma chave nova de produção. O preparo deve ser feito no computador do operador, em PowerShell nativo, mesmo usuário Windows, sem transcrição/compartilhamento de tela do material privado:

```powershell
cd F:\teste-verzel
node .\scripts\prepare-audit-key.mjs --replacement
```

Esse modo verifica os dois diagnósticos antes de gerar: manutenção/recuperação/jobs desligados, 15 históricos iguais, snapshot financeiro igual e ausência de guard de ativação. Divergência interrompe sem gerar chave. Gera Ed25519 nova e recusa fingerprints comprometidos. Não abre o arquivo DPAPI antigo. Usa caminhos NOVOS, sem sobrescrever preparação anterior:

- `var/audit-key-replacement/private-key.dpapi`: somente material cifrado DPAPI/ACL, ignorado pelo Git, nunca compartilhar;
- `docs/AUDIT_SIGNING_REPLACEMENT.json`: somente manifesto/chaves públicas, para revisão independente;
- mantém os arquivos e as assinaturas históricas intactos; não altera consumidores/banco/Blob/cron.

Ao concluir, informar somente **“nova preparação concluída”** e, se desejado, os pins públicos exibidos. Não colar chave/token nem fotografar os valores. Se o arquivo novo já existir, parar e informar; não apagar/regenerar por tentativa. A aprovação anterior não serve para o manifesto novo.

## Transferência revisada: sem clipboard da chave de assinatura

O script antigo `configure-audit-key.ps1` foi retirado e agora para antes de abrir qualquer chave quando existe o registro do incidente. Não use `Get-Clipboard`, cópia de texto do terminal, campos de conversa, argumentos com segredo, arquivo PEM/plaintext ou arquivo .env para transportar a chave.

Depois de revisar e publicar o manifesto NOVO, será fornecido o hash público para `scripts/apply-audit-key-direct.ps1 -ExpectedTransitionHash <HASH_NOVO_REVISADO>`. NÃO EXECUTAR AINDA. O script preparado:

1. Confere os diagnósticos e rejeita identidades comprometidas antes de abrir DPAPI novo. Confere a correspondência criptográfica da privada com o manifesto novo.
2. Solicita um token TEMPORÁRIO da API Render por Read-Host -AsSecureString, apenas no terminal nativo. O token é criado/gerido em Account Settings, nunca enviado ao agente. Não usa clipboard para a chave de assinatura.
3. Envia os quatro campos de auditoria diretamente por HTTPS à API oficial Render, no serviço fixo srv-dbfoo38ae00c73cqb0r0. Preserva explicitamente maintenance=true, recovery=true, jobs=false; não consulta todas as variáveis existentes e não modifica banco, plano, escala ou cobrança. Descarta respostas sem imprimi-las, inclusive possíveis ecos de valor. Destinos, campos e métodos limitados no helper.
4. Inicia deploy em recuperação; após o operador confirmar Live, implanta a MESMA chave na função por ambiente nativo herdado/SDK Neon, sem argumento secreto nem env pull. SQL/Blob preservados por omissão.
5. Mantém recuperação e manutenção; o token Render temporário deve ser revogado pelo operador. Informa apenas IDs/pins públicos. Fecha o terminal ao concluir; DPAPI não protege máquina/usuário já comprometidos.

Referências oficiais verificadas: [API Render e autenticação](https://render.com/docs/api), [PUT individual de variável](https://api-docs.render.com/reference/update-env-var), [deploy](https://api-docs.render.com/reference/create-deploy). O token Render também é um segredo e não deve aparecer em mensagens, logs ou comandos.

## Conferências e ativação criptográfica, ainda pendentes

Após upload: ambos os diagnósticos devem derivar o MESMO fingerprint novo, confirmar privada/configuração/manifesto/hash, identidades fora da lista comprometida e os 15 históricos intactos. Se falhar, manter recuperação; não restaurar chaves expostas.

Só então retirar AUDIT_RECOVERY_MODE de forma coordenada, preservando FINANCIAL_MAINTENANCE=true, RUN_SETTLEMENT_JOBS=false e cron pausado. O seed também é omitido durante manutenção. O startup recusa as duas chaves comprometidas para assinatura ativa; suas chaves públicas continuam válidas apenas para verificação histórica limitada à fronteira. Com nova chave: validar publicação write-once da nova chave/manifesto/guard, prova isolada assinada, verificador independente, comprovantes antigos e persistência após redeploy. Nenhum evento financeiro novo é necessário para esse teste. Reativação financeira exige autorização posterior explícita.

Não apagar `public.pem`, guard, manifestos ou checkpoints para recuperar. Se aparecer um guard antes do corte, interromper a preparação direta e revisar a sucessão, preservando esse artefato. Nunca tentar sobrescrevê-lo para fazer outra identidade funcionar.

## Verificações executadas e limites

70 testes de regressão/segurança aprovados no PostgreSQL LOCAL, incluindo rejeição das duas identidades expostas, manutenção e diagnóstico sem dados sensíveis. TypeScript/lint/build aprovados. Helper de upload testado com HTTP totalmente simulado: destino fixo, sete campos permitidos, nenhum GET de credenciais, respostas secretas não impressas e bloqueio de flags inválidas; sintaxe dos scripts conferida. Nenhuma execução real do uploader nem da geração nova foi realizada pelo agente.

As assinaturas antigas continuam matematicamente verificáveis; exposição das chaves não permite afirmar autoria legítima retroativa. As fronteiras fixam o estado observado. Blob continua sem WORM, e controle conjunto de runtime/chave/token/banco continua fora da proteção restrita ao SQL. Não declarar o incidente encerrado antes da troca, rejeição das identidades anteriores e verificações reais em ambos os consumidores.
