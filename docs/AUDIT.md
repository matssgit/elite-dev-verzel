# Auditoria: algoritmo, confiança e limites

## Modelo de ameaça

A proteção implementada considera um invasor com acesso de escrita ao PostgreSQL, inclusive capaz de apagar e reescrever tabelas inteiras, mas **sem acesso à chave privada, aos checkpoints no sistema de arquivos da API ou ao código da API**. O administrador SQL não deve compartilhar a identidade/permissões do operador desses arquivos.

Os checkpoints ficam em `AUDIT_DIRECTORY/checkpoints/<auctionId>/<sequence>.json`, fora das tabelas auditadas. A chave privada não é armazenada no banco nem devolvida em endpoints. O diretório é ignorado pelo Git. Em desenvolvimento, a aplicação gera uma chave Ed25519 local; em produção exige `AUDIT_PRIVATE_KEY` (PEM PKCS8, variável secreta) e `AUDIT_DIRECTORY` explícito, persistente e independente do banco.

**Limitação operacional atual:** o ambiente local não comprova separação de permissões entre operadores, armazenamento WORM/retention lock, réplica externa ou recuperação após perda do disco. O deploy ainda não configurou/validou esses controles. O requisito de proteção operacional da âncora não está marcado como plenamente validado. Comprometimento conjunto do host da API/chave/checkpoints permite forjar evidências. Não há alegação de inviolabilidade.

## Cálculo e assinatura

Eventos: OPEN (identidade do lote, hash do snapshot, termos e fim inicial observado), BID (id, sequência, código público do participante, centavos, data e novo fim), CANCEL e SETTLE (resultado, id do comprovante, vencedor público, valor, fim e liquidação).

JSON canônico v1: ordena recursivamente chaves de objetos em ordem lexicográfica JavaScript, preserva ordem de arrays, usa JSON.stringify para strings/booleanos/números finitos/null. Datas são strings UTC ISO com milissegundos; dinheiro é inteiro. Não é uma implementação declarada de RFC 8785: é um formato próprio, versionado e reproduzido no verificador.

`hash = SHA256(canonical({version:1,auctionId,sequence,previousHash,payload}))`. A sequência começa em zero, hash anterior do primeiro evento é 64 zeros. Assinatura Ed25519 sobre os 32 bytes do hash; assinatura em base64. Cada evento recebe assinatura na transação que registra a operação. Nunca assinar conteúdo arbitrário lido de uma outbox modificável: a publicação apenas **verifica** as assinaturas já produzidas pelo serviço.

A identidade pública do lote usa SHA-256 do snapshot completo (incluindo capa), lance inicial, incremento e início, mais hash do UUID interno do proprietário. Dados pessoais não entram nos registros públicos.

## Checkpoints independentes e recuperação

Cada evento assinado é uma entrada da outbox durável `audit_records`, gravada na mesma transação do lote/lance/liquidação. Após COMMIT, publicação escreve arquivo temporário exclusivo, sincroniza conteúdo e cria hard link atômico com nome final. Arquivo existente nunca é substituído; divergência gera erro e preserva a evidência. Depois marca `published_at`. Se cair entre arquivo e marcação, repetir apenas confere o mesmo conteúdo. Se cair antes do arquivo, worker recupera entradas não publicadas.

Criação/cancelamento/lance HTTP só respondem sucesso após tentar publicar checkpoints daquele lote. Se publicação falhar após commit, 503 CHECKPOINT_PENDING informa que a operação **foi registrada**. Repetir lance com a mesma Idempotency-Key não cobra/reserva novamente. Worker também publica checkpoints a cada ciclo; liquidação pode aparecer brevemente como PENDENTE até a âncora final existir.

Uma operação confirmada no banco, mas ainda não ancorada fora dele, tem uma janela de vulnerabilidade a exclusão integral de sufixo com rollback para um prefixo válido. A assinatura impede falsificação de conteúdo, mas sozinha não prova existência de uma entrada apagada. Não se afirma detecção completa para esse intervalo. Publicação antes do sucesso HTTP reduz a janela para operações reconhecidas pelo cliente. Garantia contra perda de energia/metadata e durabilidade entre deploys depende do armazenamento provisionado; fsync do conteúdo não substitui backups ou réplica externa.

`published_at` não é a fonte de confiança: o verificador lê os arquivos independentes. Alterar essa coluna não muda a evidência. Perder a chave com checkpoints existentes bloqueia regeneração automática; restaure a chave original. Chave pública local é fixada em `public.pem`; troca silenciosa falha.

## Verificação pública

GET /audit/:id bloqueia o lote para leitura durante a comparação com eventos, lances e checkpoints. Confere assinaturas, hashes anteriores, sequências contíguas, conteúdo dos lances, contagem/liderança, termos, prazos, cancelamento, liquidação e comprovante. Checkpoints são comparados mesmo quando o banco apagou toda a cadeia. Se o próprio lote foi removido e ainda existem checkpoints, informa ADULTERADO.

- INTEGRO: comparações locais conferem e todos os eventos observados têm checkpoints independentes.
- ADULTERADO: divergência de dados, sequência, assinatura ou checkpoint. Também bloqueia novos lances/liquidação quando a divergência é encontrada pelo serviço financeiro.
- PENDENTE: dados assinados conferem, mas falta cobertura de checkpoints. Não equivale a íntegro.

Detecta alteração de registros, remoção intermediária/sufixo/cadeia inteira já ancorada, inserção sem assinatura, recomputação de hashes, alteração de prazo/identidade e inconsistência do comprovante. Não audita toda a contabilidade histórica de depósitos nem impede destruição dos serviços (negação de serviço).

## Verificação fora da página

Baixe JSON na página e obtenha a impressão digital da chave **por canal independente e confiável** (responsável pelo projeto, repositório revisado/publicado). A página entregar sua própria chave não basta contra comprometimento do próprio servidor.

```sh
node scripts/verify-audit.mjs evidencia.json FINGERPRINT_CONFIAVEL
```

O verificador confere chave, assinaturas, cadeia e checkpoints exportados, além das divergências reportadas pela API. Ele não consulta diretamente o banco nem certifica que o export é o estado mais recente: para frescor, retenha checkpoints anteriores/consulte canal externo. A comparação entre dados operacionais e eventos é executada pelo backend confiável no modelo de ameaça.

`docs/AUDIT_PUBLIC_KEY.pem` registra apenas a chave **pública desta demonstração local**. Impressão digital SHA-256 desse PEM: `468bbf68a4d302c4cc37e436fb08b2ddb2d7c13ecacd532741b1753b5d5a0546`. Instalações novas geram sua própria chave; produção deve publicar sua impressão digital revisada, sem reutilizar ou divulgar a chave privada de desenvolvimento.

## Históricos anteriores à Sprint 3

Migration marca lotes existentes com audit_version=0. O worker importa esses dados uma única vez sob bloqueio, com OPEN legacyBaseline=true, assina lances existentes e publica checkpoints; depois marca versão 1. A interface informa explicitamente que não há garantia retroativa. Checkpoints externos existentes impedem reimportar como se fosse novo um histórico apagado do banco. Não confundir baseline de dados existentes com evidência produzida no instante dos lances antigos.

Referência da implementação criptográfica padrão: https://nodejs.org/api/crypto.html#cryptosignalgorithm-data-key-callback .
# Implantação — estado em 26/10/2026

Não há auditoria de produção plenamente validada. Checkpoints atuais são arquivos independentes do PostgreSQL em var/audit (desenvolvimento). Diretório/chave não são versionados. Render Free perde esses arquivos em restart/redeploy/suspensão e não suporta disco persistente: a implementação atual deve recusar essa implantação, não declarar integridade com uma âncora vazia.

Foi acrescentada verificação Linux de mount independente e confinamento do diretório por realpath. Modo persistent-file de produção exige mount verificado, usa chave 0600 e recusa regeneração se houver pin público/checkpoints. Volume Docker exclusivo preservou chave e checkpoint entre contêineres; perda da chave e ausência do volume foram rejeitadas. Essas provas são locais; restart/redeploy na Render e isolamento efetivo da credencial SQL permanecem pendentes.

Alternativa gratuita proposta em INFRA_OPTIONS.md exige AuditStore remoto durável e independente (Blob), outbox/retry, verificação completa de conflitos/cadeia e chave estável em segredos de runtime separados do SQL. Ainda não implementada. Token de escrita do storage e acesso ao runtime podem apagar/forjar evidências; não há garantia WORM contra administrador da aplicação. No modelo existente, o atacante tem apenas acesso de escrita ao banco. Não atribuir ao Blob ou ao disco proteção contra um atacante com acesso à chave.

---

