# Arquitetura mínima

Monorepo npm workspaces, Node >=22.12, TypeScript strict. Um backend modular Fastify e um frontend React/Vite, sem microsserviços. `packages/shared` contém contratos e Zod. Drizzle com driver node-postgres acessa PostgreSQL 17. SQL versionado é a fonte executável das migrations; o schema Drizzle representa as tabelas para consultas tipadas.

## Implementado

- `apps/api/src/auth`: scrypt assíncrono com salt por senha, sessões opacas de 256 bits, hash SHA-256 do token no banco e validade de 24h. Token em memória e sessionStorage no navegador; nunca em logs. Logout revoga no servidor. Perfil é carregado do banco em cada acesso autenticado.
- `apps/api/src/wallet`: depósito simulado, centavos inteiros, transação e bloqueio `FOR UPDATE` da carteira antes de consultar idempotência e gravar razão/saldo. Chave UUID única por usuário impede reaplicação; chave reaproveitada com outro valor retorna 409.
- Criação de usuário e carteira na mesma transação. Constraints impedem saldo negativo, comprometimento maior que total e números além do limite inteiro seguro do JavaScript.
- CORS para origem explícita, Helmet, limite de corpo e rate limit de autenticação. Erros internos não são enviados ao cliente. `trustProxy` não habilitado; configurar apenas proxies conhecidos no deploy.
- React Router, TanStack Query, Tailwind e CSS próprio. Chamadas tipadas e schemas compartilhados; servidor sempre revalida entradas.

## Catálogo, lotes e lances implementados

`catalog/service.ts` integra Open Library e armazena metadados/capas JPEG em PostgreSQL; em falhas busca nos imports locais. `auctions/service.ts` publica/cancela lotes, calcula estados temporais, consulta sala/histórico e aceita lances. Rotas delegam regras aos serviços. Lote guarda cópia do snapshot JSON e não depende do catálogo para consultas.

Ordem implementada de bloqueios para lances: lote primeiro, depois todas as carteiras afetadas por UUID em ordem crescente. Nunca adquirir lote após carteira em operações com ambos. Depósitos só bloqueiam uma carteira. Mesmo usuário em vários lotes é serializado pela mesma linha de carteira. `clock_timestamp()` lido **após** todos os bloqueios para impedir lance vencido durante a espera. Reserva/liberação, histórico sequencial, liderança e anti-sniping confirmados na mesma transação. Idempotência de lance por usuário/UUID. Sala lida em transação repeatable read para não misturar liderança/histórico de commits diferentes.

`auctions/realtime.ts`: WebSocket propaga invalidações após COMMIT via PostgreSQL LISTEN/NOTIFY, inclusive entre instâncias. Conexão SQL dedicada com reconexão; cliente recarrega snapshot HTTP e carteira. Ressincronização de 15s cobre transições temporais e perdas de eventos; cliente reconecta em 2s e usa polling de segurança enquanto desconectado. Proxy Vite habilita upgrade WS.

## Liquidação e auditoria — Sprint 3

settlement/service.ts faz scan de vencidos ao iniciar e a cada 3s, com recuperação após reinício. Bloqueia lote→carteiras ordenadas e verifica soma de reservas, histórico e vencedor. Débito, liberação, crédito, razão, resultado, comprovante e assinatura final na mesma transação. settledAt e uniques garantem idempotência; sem lances não gera vencedor fictício nem movimentações.

audit/service.ts e audit/store.ts mantêm cadeia de eventos com JSON canônico v1, SHA-256 e Ed25519. Outbox transacional e arquivos exclusivos independentes do banco; sucesso de lance aguarda publicação. Reconcilia histórico/termos/resultado/checkpoints e bloqueia operação divergente. Auditoria e comprovantes públicos, resultados próprios autenticados. Modelo, migração de baseline e limitações operacionais em AUDIT.md. R17 segue sem validação completa de produção.

## Operação

Docker Compose oferece PostgreSQL persistente em volume. Migration runner serializado por advisory lock, checksums detectam alteração de SQL aplicado. CI usa PostgreSQL real. Frontend deve ir para Vercel, backend para Render e banco gerenciado sem expiração que comprometa a avaliação. Nenhum serviço externo foi criado.
