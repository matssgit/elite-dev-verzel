# Contrato HTTP — conta, carteira e leilões

Base local: `http://localhost:3001`; frontend usa `/api` via proxy Vite. JSON UTF-8. Dinheiro é sempre número inteiro em **centavos**. Datas ISO 8601 UTC. Erros: `{code, message, issues?}`. Validação 400; sem sessão/expirada 401; perfil inválido 403; conflito 409; erro interno 500 sem detalhes sensíveis.

## Rotas disponíveis

| Método | Rota | Autorização | Corpo / resposta |
|---|---|---|---|
| GET | /health | Pública | 200 `{status:"ok",serverTime}`; verifica conexão SQL |
| POST | /auth/register | Pública | `{name,email,password,role}` → 201 `{user}` |
| POST | /auth/login | Pública | `{email,password}` → 200 `{token,user}` |
| GET | /auth/me | Bearer | 200 `{user}` |
| POST | /auth/logout | Bearer | 204, revoga sessão |
| GET | /wallet | LICITANTE | 200 `{totalCents,committedCents,availableCents}` |
| GET | /wallet/entries | LICITANTE | 200 `{entries:[{id,amountCents,kind,createdAt}]}`, últimos 50 |
| POST | /wallet/deposits | LICITANTE | `{amountCents}` + `Idempotency-Key: UUID` → 200 carteira atual |
| GET | /catalog?q=... | LEILOEIRO | 200 `{items:[{id,item}],cached}`; busca 2–100 caracteres |
| GET | /auctions | Pública | 200 `{auctions,serverTime}`; até 100 recentes, sem cancelados |
| GET | /me/auctions | LEILOEIRO | 200 `{auctions,serverTime}`; próprios lotes, inclusive cancelados |
| POST | /auctions | LEILOEIRO | `{catalogId,initialCents,incrementCents,startsAt,endsAt}` → 201 `{id}` |
| GET | /auctions/:id | Pública | 200 `{auction,bids,serverTime}`; histórico completo mais recente primeiro |
| POST | /auctions/:id/cancel | LEILOEIRO proprietário | 200 `{id}`; somente sem lances; repetição não modifica data |
| POST | /auctions/:id/bids | LICITANTE | `{amountCents}` + `Idempotency-Key: UUID` → 201 `{bidId}` |
| GET (upgrade) | /auctions/:id/events | Pública | WebSocket de notificações, sem envio de lances |

`user = {id,name,role,publicId}`. Roles: `LEILOEIRO`, `LICITANTE`. E-mail e hash não são devolvidos. `id` é usado na própria sessão; `publicId` é reservado para anonimização nos futuros comprovantes/auditoria.

Nome: 2–100 caracteres após trim. E-mail: válido, até 254, normalizado para minúsculas. Senha: 10–128 caracteres, sem trim. Depósito: de 100 a 100.000.000 centavos por operação. Sem cobrança real. Chave de idempotência é única por usuário; valor divergente na repetição retorna `IDEMPOTENCY_CONFLICT`. Rate limit geral 120/min/IP e cadastro/login 10/min/IP por rota. HTTPS obrigatório no deploy.

Autenticação: `Authorization: Bearer <token>`; token aleatório de 64 caracteres hex, válido 24h. Logout invalida imediatamente. Liquidação automática executa no backend; comprovantes e auditoria são públicos.

## Códigos de domínio

`EMAIL_IN_USE`, `INVALID_CREDENTIALS`, `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `IDEMPOTENCY_CONFLICT`, `WALLET_NOT_FOUND`, `BALANCE_LIMIT`, `REQUEST_ERROR`, `INTERNAL_ERROR`.

## Catálogo e snapshots

Integração: Open Library Search API. `catalogId` segue `OL<dígitos>W`. O servidor importa metadados e capa JPEG (máximo 250 kB; timeout 4s) para PostgreSQL e devolve `item = {catalogId,title,authors,firstPublishYear,image,sourceUrl,importedAt}`. `image` é data URI persistida ou `null` (UI mostra placeholder). Publicação aceita apenas item previamente importado, copia o JSON e não consulta a API externa. O frontend não pode enviar título, capa ou atributos arbitrários ao criar o lote.

Busca externa com timeout 8s, até 8 itens, campos explícitos, imagens baixadas sequencialmente e imports reaproveitados. Se a API falhar, busca local por título/autor entre snapshots importados retorna `cached:true`. Sem resultado local, responde 503 `CATALOG_UNAVAILABLE`. Não troca falha por dados fictícios. Rate limit 15 buscas/min/IP. Resultados podem levar vários segundos durante a importação inicial de capas.

## Lotes e sala

`auction = {id,item,initialCents,incrementCents,currentCents,leaderPublicId,bidCount,startsAt,endsAt,cancelledAt,settledAt,status}`.

`bid = {id,bidderPublicId,amountCents,sequence,createdAt}`. IDs públicos dos licitantes são aleatórios; nomes, e-mails e IDs internos de participantes/proprietário não são devolvidos nos lotes/histórico.

Status temporal calculado com hora do PostgreSQL: `AGENDADO` antes do início, `AO_VIVO` em `[início,fim)`, `ENCERRADO` no fim ou depois; `CANCELADO` tem precedência. ENCERRADO é temporal. `settledAt` informa liquidação persistida; o worker liquida ao iniciar e a cada 3s. A reserva permanece somente até esse processamento concluir.

Criação: início/fim ISO com timezone, fim posterior ao início e ao relógio atual do banco. Início no passado é permitido para publicar imediatamente. Lance inicial/incremento entre 1 e 100.000.000 centavos. Não há edição de valores/prazos depois da publicação nesta etapa. Cancelamento só do proprietário, sem qualquer lance, inclusive se já encerrou sem lances; retorna 403 `NOT_OWNER` ou 409 `HAS_BIDS` quando aplicável. Cancelado continua acessível por link direto com estado explícito, mas não aparece na vitrine.

## Lances e consistência financeira

Lance em centavos inteiros entre 1 e 100.000.000; `Idempotency-Key` obrigatório. Retry com mesmo usuário/chave/lote/valor retorna o mesmo `bidId` sem nova reserva, mesmo se a liderança ou o prazo mudaram desde a primeira aceitação. Chave usada com lote/valor diferente: 409 `IDEMPOTENCY_CONFLICT`.

Transação: bloqueio `FOR UPDATE` do lote; carteiras do licitante e líder anterior em ordem crescente de UUID; só depois `clock_timestamp()` para validar janela. O mesmo usuário em lotes diferentes compete pela mesma linha de carteira, impedindo gastar duas vezes o disponível. Lance inicial >= mínimo inicial; seguintes >= atual + incremento; líder não se supera. Reserva nova e liberação anterior, histórico sequencial, líder/valor e prorrogação são confirmados atomicamente.

Códigos adicionais: 404 `AUCTION_NOT_FOUND`; 400 `CATALOG_ITEM_NOT_FOUND`, `INVALID_DATES`; 409 `AUCTION_NOT_STARTED`, `AUCTION_ENDED`, `AUCTION_CANCELLED`, `ALREADY_LEADING`; 422 `BID_TOO_LOW`, `INSUFFICIENT_FUNDS`. Perfil inválido: 403 `FORBIDDEN`. Erros 400 de schema mantêm `VALIDATION_ERROR`.

Anti-sniping: quando `0 < fim − agora <= 120000ms`, lance aceito soma exatamente 120000ms ao fim **vigente**. Não usa “agora + 2min”. Novo fim persistido na mesma transação; lance recusado não altera prazo.

## WebSocket e reconexão

URL local do frontend: `ws://localhost:5173/api/auctions/:id/events`, proxy Vite com `ws:true`. Backend direto: `ws://localhost:3001/auctions/:id/events`. Produção: `wss://<api>/auctions/:id/events`; configurar `VITE_API_URL` com base HTTPS pública. Navegadores devem enviar Origin exatamente igual a WEB_ORIGIN. Clientes sem Origin podem consultar, pois o conteúdo é público.

Mensagens: `{type:"auction.updated",auctionId}` após COMMIT, ou `{type:"resync"}` ao abrir/reconectar listener e a cada 15s. Cliente recarrega snapshot HTTP e carteira, não aplica valores financeiros de mensagens. Publicação PostgreSQL LISTEN/NOTIFY funciona entre instâncias, com conexão dedicada e reconexão. Não há eventos pessoais ou tokens na URL. Socket é somente leitura; lances usam HTTP autenticado. Payload recebido limitado a 1 kB; cliente lento é desconectado ao acumular mais de 128 kB no buffer de saída.

Frontend reconecta em 2s, recarrega snapshot ao reconectar e usa polling de segurança de 15s enquanto o socket está desconectado. Heartbeat de ressincronização atualiza status temporal mesmo sem novos lances. Contador usa serverTime da resposta como âncora e avança localmente; ao atingir limite recarrega a sala. Validação final sempre no banco.


## Sprint 3: liquidação, resultados e auditoria

| Método | Rota | Acesso | Resposta |
|---|---|---|---|
| GET | /me/results | Bearer (ambos os perfis) | `{results:[{auction,receiptId,won,amountCents}],totalReceivedCents}` |
| GET | /auctions/:id/receipt | Público | `{receiptId:UUID ou null}` |
| GET | /receipts/:id | Público | Comprovante e registro assinado de liquidação |
| GET | /audit/:id | Público | Relatório, eventos, checkpoints, chave pública e impressão digital |

Resultados do leiloeiro incluem os próprios lotes e o total efetivamente creditado. Do licitante incluem todas as participações e comprovantes dos lotes vencidos. Histórico pessoal não tem o limite de 100 da vitrine.

`receipt = {id,auctionId,item,amountCents,winnerPublicId,endedAt,settledAt,record,verification}`. Sem nome/e-mail/ID interno do vencedor. Página `/comprovantes/:id` compartilhável sem login. Verificação INTEGRO/ADULTERADO/PENDENTE deriva da auditoria do lote.

`audit = {auctionId,status,issues,records,checkpoints,publicKey,fingerprint,legacyBaseline}`. Cada evento: `{auctionId,sequence,previousHash,payload,hash,signature}`; OPEN, BID, CANCEL ou SETTLE. Ordenação crescente desde zero. JSON canônico v1 e Ed25519 descritos em AUDIT.md. A chave privada nunca é exposta. `/auditoria/:id` oferece download do JSON. Baseline legado recebe aviso sem garantia retroativa.

Liquidação não é disparada por endpoint público. Worker faz varredura durável PostgreSQL no startup e a cada 3s, até 100 lotes por ciclo; retoma atrasados após reinício. Bloqueia lote, depois carteiras por UUID; consulta hora do banco depois dos bloqueios, respeitando anti-sniping. Verifica histórico, vencedor e soma das reservas do usuário antes de debitar/creditar. Lote, movimentos, comprovante e evento SETTLE na mesma transação. Unique por lote/kind na razão e comprovante único por lote complementam idempotência do lock/settledAt. Sem lances, settledAt e evento são gravados sem vencedor, comprovante ou movimentos.

Movimentações da carteira agora incluem DEPOSIT (positivo), PURCHASE (negativo) e SALE (positivo); razão referencia o lote nas duas últimas. GET /wallet e /wallet/entries continuam exclusivos do licitante; leiloeiro consulta seus resultados/total recebido. Depósito mantém a regra existente.

Criação/cancelamento/lance só devolvem sucesso após publicar checkpoints daquele lote. 503 CHECKPOINT_PENDING após commit informa operação registrada e publicação pendente: consultar lote e repetir lances apenas com a mesma chave. 409 AUDIT_CORRUPTED bloqueia operação se histórico/checkpoint divergir; 409 SETTLEMENT_INCONSISTENT bloqueia liquidação quando saldo/reserva/vencedor diverge. Worker registra falha e tenta novamente em ciclos futuros; não corrige saldos silenciosamente. 404 RECEIPT_NOT_FOUND para comprovante inexistente.

Auditoria INTEGRO é condicional ao modelo banco comprometido/chave e arquivos preservados. Controle de acesso e durabilidade desses arquivos ainda precisam de validação em produção; R17 não é plenamente validado. Ver limitações, janela antes de ancoragem e referência pública em AUDIT.md.
