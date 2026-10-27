# Auditoria: algoritmo, confiança e limites

**27/10, 14:42 — ensaio agendado interrompido no preflight:** não houve fixture, deploy, liquidação ou checkpoint novo. Erro de rota do orquestrador corrigido; nenhuma nova tentativa após a falha. Os 15 checkpoints/assinaturas e o snapshot financeiro permanecem idênticos. Chave nova/prova e quatro comprovantes conferidos; manutenção ativa e cron pausado. Contenções locais prontas, validação pelo agendador real ainda pendente. Evidências: [SCHEDULED_SETTLEMENT_VALIDATION_RESULT.md](SCHEDULED_SETTLEMENT_VALIDATION_RESULT.md).

**Estado atual, 27/10 às 14:00:** chave ativa 07e8…94ab2 verificada em Render/Neon, com manifesto aprovado, assinaturas históricas e prova nova conferidas independentemente. Quinze checkpoints/assinaturas originais e quatro comprovantes preservados após redeploy que recusa recriação de objetos ausentes. Manutenção financeira ativa e cron pausado. Evidências, pins completos, caminhos remotos e recuperação em [AUDIT_KEY_VERIFICATION.md](AUDIT_KEY_VERIFICATION.md).

A raiz dc33…ece3 e a candidata retirada cf2d…9c91 continuam comprometidas para assinatura futura. Public keys e manifestos históricos são conservados; assinaturas antigas não foram refeitas. O novo manifesto fixa a chave aplicável por lote/sequência e a fronteira observada. Verificação pública expõe keyring e identidade inequívoca por assinatura; novos eventos incluem a fingerprint dentro do payload assinado. Isso não garante retroativamente autoria legítima nem adiciona WORM ao Blob. Histórico do procedimento em AUDIT_KEY_RECOVERY.md e SECURITY_ROTATION.md.

## Modelo de ameaça

A proteção implementada considera um invasor com escrita no PostgreSQL, inclusive capaz de apagar e reescrever tabelas inteiras, mas **sem acesso à chave privada, às credenciais/checkpoints do storage independente ou ao código da API**. A suspeita atual de exposição conjunta ultrapassa esse modelo: não declarar proteção completa contra esse atacante.

Em desenvolvimento, checkpoints ficam em AUDIT_DIRECTORY/checkpoints/<auctionId>/<sequence>.json e a chave local é ignorada pelo Git. A produção gratuita usa AUDIT_STORAGE=blob e objetos privados elite-v1/checkpoints/<auctionId>/<sequence>.json, fora do PostgreSQL. Chave Ed25519 PKCS8 e token ficam em variáveis protegidas; fingerprint pública obrigatória. O backend não os devolve em endpoints. O modo de arquivos em produção continua exigindo mount persistente verificado e não é utilizado no Render Free.

Persistência de checkpoints/chave após redeploy real da API e função foi conferida. Não há WORM/retention lock nem prova de independência contra administrador das plataformas. O token Blob permite excluir/substituir objetos fora do caminho write-once da aplicação. Comprometimento conjunto de banco, token e chave permite forjar evidências. Rotação e persistência da identidade nova foram verificadas, mas os limites de acesso conjunto e autenticidade histórica permanecem; não há alegação de inviolabilidade.

## Cálculo e assinatura

Eventos: OPEN (identidade do lote, hash do snapshot, termos e fim inicial observado), BID (id, sequência, código público do participante, centavos, data e novo fim), CANCEL e SETTLE (resultado, id do comprovante, vencedor público, valor, fim e liquidação).

JSON canônico v1: ordena recursivamente chaves de objetos em ordem lexicográfica JavaScript, preserva ordem de arrays, usa JSON.stringify para strings/booleanos/números finitos/null. Datas são strings UTC ISO com milissegundos; dinheiro é inteiro. Não é uma implementação declarada de RFC 8785: é um formato próprio, versionado e reproduzido no verificador.

`hash = SHA256(canonical({version:1,auctionId,sequence,previousHash,payload}))`. A sequência começa em zero, hash anterior do primeiro evento é 64 zeros. Assinatura Ed25519 sobre os 32 bytes do hash; assinatura em base64. Cada evento recebe assinatura na transação que registra a operação. Nunca assinar conteúdo arbitrário lido de uma outbox modificável: a publicação apenas **verifica** as assinaturas já produzidas pelo serviço.

A identidade pública do lote usa SHA-256 do snapshot completo (incluindo capa), lance inicial, incremento e início, mais hash do UUID interno do proprietário. Dados pessoais não entram nos registros públicos.

## Checkpoints independentes e recuperação

Cada evento assinado integra a outbox audit_records na mesma transação do lote/lance/liquidação. Após COMMIT, o adaptador publica sem sobrescrita: arquivo temporário/hard link localmente; no Blob, put com allowOverwrite=false e addRandomSuffix=false, conferindo bytes em replay/conflito. Depois marca published_at. Queda entre publicação e marcação permite replay idêntico; antes da publicação, a outbox é recuperada. No deploy gratuito a função independente faz esse processamento; localmente, o worker.

Criação/cancelamento/lance HTTP só respondem sucesso após tentar publicar checkpoints daquele lote. Se publicação falhar após commit, 503 CHECKPOINT_PENDING informa que a operação **foi registrada**. Repetir lance com a mesma Idempotency-Key não cobra/reserva novamente. Worker também publica checkpoints a cada ciclo; liquidação pode aparecer brevemente como PENDENTE até a âncora final existir.

Uma operação confirmada no banco, mas ainda não ancorada fora dele, tem uma janela de vulnerabilidade a exclusão integral de sufixo com rollback para um prefixo válido. A assinatura impede falsificação de conteúdo, mas sozinha não prova existência de uma entrada apagada. Não se afirma detecção completa para esse intervalo. Publicação antes do sucesso HTTP reduz a janela para operações reconhecidas pelo cliente. Garantia contra perda de energia/metadata e durabilidade entre deploys depende do armazenamento provisionado; fsync do conteúdo não substitui backups ou réplica externa.

`published_at` não é a fonte de confiança: o verificador lê os arquivos independentes. Alterar essa coluna não muda a evidência. Perder a chave com checkpoints existentes bloqueia regeneração automática; restaure a chave original. Chave pública local é fixada em `public.pem`; troca silenciosa falha.

## Verificação pública

GET /audit/:id bloqueia o lote para leitura durante a comparação com eventos, lances e checkpoints. Confere assinaturas, hashes anteriores, sequências contíguas, conteúdo dos lances, contagem/liderança, termos, prazos, cancelamento, liquidação e comprovante. Checkpoints são comparados mesmo quando o banco apagou toda a cadeia. Se o próprio lote foi removido e ainda existem checkpoints, informa ADULTERADO.

- INTEGRO: comparações observadas conferem e todos os eventos têm checkpoints independentes. Não certifica sigilo da chave, autoria legítima após comprometimento ou ausência de alterações anteriores à captura da evidência.
- ADULTERADO: divergência de dados, sequência, assinatura ou checkpoint. Também bloqueia novos lances/liquidação quando a divergência é encontrada pelo serviço financeiro.
- PENDENTE: dados assinados conferem, mas falta cobertura de checkpoints. Não equivale a íntegro.

Detecta alteração de registros, remoção intermediária/sufixo/cadeia inteira já ancorada, inserção sem assinatura, recomputação de hashes, alteração de prazo/identidade e inconsistência do comprovante. Não audita toda a contabilidade histórica de depósitos nem impede destruição dos serviços (negação de serviço).

## Verificação fora da página

Baixe JSON na página e obtenha a impressão digital da chave **por canal independente e confiável** (responsável pelo projeto, repositório revisado/publicado). A página entregar sua própria chave não basta contra comprometimento do próprio servidor.

```sh
node scripts/verify-audit.mjs evidencia.json dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3 126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1
```

O verificador confere chave, assinaturas, cadeia e checkpoints exportados, além das divergências reportadas pela API. Ele não consulta diretamente o banco nem certifica que o export é o estado mais recente: para frescor, retenha checkpoints anteriores/consulte canal externo. A comparação entre dados operacionais e eventos é executada pelo backend confiável no modelo de ameaça.

`docs/AUDIT_PUBLIC_KEY.pem` registra apenas a chave **pública desta demonstração local**. Impressão digital SHA-256 desse PEM: `468bbf68a4d302c4cc37e436fb08b2ddb2d7c13ecacd532741b1753b5d5a0546`. Instalações novas geram sua própria chave; produção deve publicar sua impressão digital revisada, sem reutilizar ou divulgar a chave privada de desenvolvimento.

## Históricos anteriores à Sprint 3

Migration marca lotes existentes com audit_version=0. O worker importa esses dados uma única vez sob bloqueio, com OPEN legacyBaseline=true, assina lances existentes e publica checkpoints; depois marca versão 1. A interface informa explicitamente que não há garantia retroativa. Checkpoints externos existentes impedem reimportar como se fosse novo um histórico apagado do banco. Não confundir baseline de dados existentes com evidência produzida no instante dos lances antigos.

Referência da implementação criptográfica padrão: https://nodejs.org/api/crypto.html#cryptosignalgorithm-data-key-callback .
# Implantação — estado em 26/10/2026

Produção usa Blob privado independente do PostgreSQL, prefixo elite-v1/. Desenvolvimento continua usando var/audit. AUDIT_STORAGE=blob exige chave Ed25519 em AUDIT_PRIVATE_KEY, token BLOB_READ_WRITE_TOKEN e AUDIT_PUBLIC_KEY_FINGERPRINT; não gera chave nova silenciosamente. O adaptador de arquivos continua recusando Render sem mount persistente verificado. Segredos não são versionados nem enviados ao frontend.

Verificação Linux de mount/realpath e chave 0600 cobrem o adaptador de arquivos. A prova Docker não foi usada como prova da Render. Para o Blob, o redeploy Render dep-dbfouq4s728c738ilkog e o redeploy da função preservaram a fingerprint e os quatro checkpoints do lote 30ae384d-0b99-4430-8dca-131f51e7bd41; o comprovante permaneceu acessível. A credencial SQL foi conferida sem pg_read_server_files, o que não certifica isolamento contra administradores dos provedores.

Adaptador remoto implantado: pin público write-once, publicação sem sobrescrita, conflitos idênticos aceitos no replay concorrente, listagem paginada completa, leitura direta da origem sem cache e validação de assinatura/sequência/encadeamento. Falhas de leitura bloqueiam operação financeira; outbox retenta publicação após commit, inclusive pela função independente. Token de escrita e acesso ao runtime podem apagar/forjar evidências; não há garantia WORM contra administrador da aplicação. O atacante coberto tem apenas escrita no banco. Não atribuir proteção contra quem possui a chave.

Chave pública anterior de produção: AUDIT_PRODUCTION_PUBLIC_KEY.pem. Fingerprint SHA-256: dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3; identidade sob suspeita de exposição, mantida para histórico. Diferente da chave local. Valores de ambiente da Function são write-only/encriptados, mas isso não revoga valores que tenham sido expostos antes. A troca exige manifesto/fronteiras e suporte a múltiplas chaves, ainda pendentes. Suspensão física às 14:55 foi classificada como inconclusiva, sem repetição; liquidação pelo cron confirmada às 14:56.

---

