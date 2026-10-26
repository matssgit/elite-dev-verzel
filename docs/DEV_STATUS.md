# Status DEV — Sprint 3 — 26/10/2026

## Implementado neste marco

- Encerramento/liquidação automática: scan PostgreSQL no startup e a cada 3s, recupera vencidos após reinício e respeita o fim prorrogado. Estado settledAt durável, sem depender só de timers de encerramento em memória.
- Transação única com lock de lote e carteiras ordenadas: confere histórico, vencedor e soma das reservas; debita comprador, libera compromisso, credita vendedor, registra PURCHASE/SALE e comprovante. Unique por lote/kind e comprovante único, mais settledAt, impedem duplicação. Sem lances, sem vencedor/comprovante/movimentos.
- Comprovante HTML compartilhável e público, com item/snapshot, valor, fim, liquidação, vencedor público e hash/assinatura. Resultados pessoais e total recebido pelo leiloeiro; histórico de participações/arremates do licitante.
- Auditoria pública com eventos OPEN/BID/CANCEL/SETTLE, SHA-256 de JSON canônico versionado, Ed25519 por evento e checkpoints em arquivos fora do PostgreSQL. Compara histórico real e eventos assinados, detecta alteração/remoção/inserção e reescrita integral ancorada. Divergência bloqueia operação financeira.
- Publicação recuperável por outbox. Sucesso HTTP de criação/cancelamento/lance aguarda publicação independente; falha depois do commit retorna CHECKPOINT_PENDING, sem tentar desfazer reserva já confirmada. Retry de lance usa chave original.
- Lotes da Sprint 2 importados uma única vez como baseline explicitamente sinalizada, sem promessa de autenticidade retroativa.
- Verificador independente em scripts/verify-audit.mjs; chave pública local em docs/AUDIT_PUBLIC_KEY.pem. Chave privada e checkpoints em var/audit, ignorado pelo Git.

## Verificações realmente executadas

- Migration 0003_settlement_audit.sql aplicada ao PostgreSQL local. Adiciona settledAt/auditVersion, movimentos por lote, comprovantes e outbox/eventos assinados.
- Testes direcionados iniciais: **11/11 aprovados**. Criam schema PostgreSQL privado para não disputar com o worker ativo da demonstração.
- Regressão: **33/33 testes aprovados** (8 fundação, 14 núcleo e 11 Sprint 3), ~5,74s. Depois foi adicionado o caso de rollback para prefixo com assinaturas válidas e executada apenas a suíte direcionada: **12/12 aprovados**, ~3,17s. Total: **34 testes distintos aprovados**. Não houve uma execução única 34/34; resultados acima identificam as rodadas reais.
- O teste adicional mostrou que uma cadeia reduzida ao OPEN ainda com assinatura válida é detectada especificamente pelo checkpoint externo ausente no banco.
- Cobertos: duas execuções da liquidação; oito execuções simultâneas; débito/crédito e razão exatos; sem lances; lance versus encerramento; anti-sniping impede liquidar antes do novo fim; adulteração de lance; exclusão de toda a cadeia no banco; inserção indevida; hashes reescritos; reinicialização e reprocessamento sem cobrança duplicada; exclusão do próprio lote; recuperação de publicação interrompida.
- TypeScript nos três workspaces aprovado. Lint aprovado após remover um import não utilizado do teste. Build API/web aprovado; avisos não bloqueantes de anotação Zod e chunk JS ~672 kB (~194 kB gzip).
- O lote da Sprint 2 371f8b81-d0a5-4cb2-87ec-fce3b1a7e618 venceu às 13:14:00 (America/Sao_Paulo) e foi liquidado automaticamente às 13:14:02. Bruno debitado R$55, reserva liberada e vendedor creditado R$55.
- Navegador: sala mostrou encerrado/liquidação confirmada; histórico do vencedor mostrou arremate; comprovante público abriu sem sessão; auditoria sem login mostrou quatro eventos e quatro checkpoints, com aviso de baseline; painel do vendedor mostrou total recebido R$55.
- Comprovante demonstrado: /comprovantes/97be9005-6ee8-44a9-80e6-7ed33acf74f3. Auditoria: /auditoria/371f8b81-d0a5-4cb2-87ec-fce3b1a7e618.
- Smoke da API compilada em porta temporária 3002 confirmou auditoria INTEGRO, quatro eventos/checkpoints e comprovante HTTP 200 com 5500 centavos; processo finalizado.
- CLI independente conferiu o JSON público bruto e fingerprint confiável: quatro eventos válidos. Uma primeira tentativa reconverteu datas com PowerShell e corretamente falhou na assinatura; salvar o JSON bruto resolveu, sem alterar algoritmo ou evidência.
- Capturas locais ignoradas: tmp/receipt-verified.png e tmp/audit-verified.png. Verificação móvel e suíte Playwright versionada permanecem pendentes.

## Arquivos e contratos

apps/api/src/settlement/service.ts; audit/store.ts; audit/service.ts; migrations/0003_settlement_audit.sql; test/settlement-audit.test.ts. Novas interfaces em apps/web/src/result-pages.tsx; sala/carteira integradas ao resultado e ao razão. Documentação detalhada do modelo e limitações em AUDIT.md.

Novas rotas: GET /me/results, /receipts/:id, /auctions/:id/receipt e /audit/:id. Páginas: /resultados (autenticada), /comprovantes/:id e /auditoria/:id (públicas). API_CONTRACT atualizado.

## Execução e operação

Aplicar npm run db:migrate antes de iniciar a versão nova. npm run dev inicia worker junto ao backend; o servidor compilado também habilita runJobs=true. Função buildApp usada em testes não liga jobs por padrão, para permitir isolamento; teste de reinício usa a opção explicitamente. Contas, seed e .env existentes preservados.

Local: http://localhost:5173 e API http://localhost:3001. Chave de desenvolvimento gerada fora do banco em var/audit/private.pem (NÃO versionar). Novas instalações geram chave própria; não assumir que a chave pública da demonstração vale para outro ambiente.

## Pendências / limitações / bloqueios

- **R17 não plenamente validado:** armazenamento independente funciona e foi testado localmente contra escrita no banco. Permissões separadas, retenção/imutabilidade operacional, backups e durabilidade de produção ainda precisam de implantação e validação. Acesso simultâneo ao host/chave/checkpoints está fora da garantia. AUDIT.md documenta também a janela de operação ainda não ancorada e falta de garantia retroativa dos dados legados.
- Deploy público, GitHub público, revisão QA e envio ainda pendentes. Nenhum relatório QA foi sobrescrito, subagente criado ou QA acionado.
- Nenhum bloqueio para desenvolvimento local. A conclusão operacional da âncora e o deploy dependem da escolha/provisionamento de armazenamento persistente com acesso separado do operador SQL. Produção exige AUDIT_PRIVATE_KEY e AUDIT_DIRECTORY; não falha silenciosamente para chave efêmera.
- Checkpoints locais não devem ser apagados ao limpar o banco, reimplantar ou reiniciar; preservar/restaurar chave original. Backup apenas do PostgreSQL não restaura a âncora independente.

---

## Histórico: marco anterior (Sprint 2)

O registro abaixo é histórico; as pendências de liquidação/comprovantes/auditoria descritas nele foram tratadas acima.

# Status DEV — 26/10/2026

## Marco concluído: núcleo operacional de leilões

Fundação preservada: autenticação e carteira existentes. Implementados catálogo público de livros, snapshots persistidos, publicação/cancelamento de lotes próprios sem lances, vitrine por estado, sala pública, histórico anonimizado, lances transacionais, reservas/liberações, anti-sniping e WebSocket entre instâncias.

## Implementado

- Open Library: busca de título/autor, até 8 itens, cache de importações e fallback local quando API externa falha. Capa JPEG copiada para PostgreSQL (até 250 kB); placeholder se indisponível. Lotes guardam snapshot independente do catálogo e de URLs externas.
- Lote: item previamente importado, lance inicial/incremento em centavos, início/fim; início passado permitido para publicar imediatamente. Gestão do proprietário, cancelamento sem lances e ocultação de cancelados na vitrine.
- Vitrine pública separa ao vivo/agendados/encerrados, até 100 recentes. Sala com contador ancorado no relógio do banco, lance atual, histórico com posições/identificação do próprio participante, estado ganhando/superado e saldo disponível.
- Lance: janela [início,fim), inicial/incremento mínimos, bloqueio de autossuperação e saldo insuficiente. Leiloeiro não oferece lances.
- Atomicidade: FOR UPDATE no lote, carteiras em ordem crescente de UUID, clock_timestamp() após todos os bloqueios. Reserva do novo líder, liberação do anterior, histórico e prorrogação na mesma transação. Idempotência por usuário/UUID para retry.
- Anti-sniping: lance aceito quando faltam até 120s soma exatamente 120s ao fim vigente; evento apenas após COMMIT.
- WebSocket público; lances via HTTP autenticado. PostgreSQL LISTEN/NOTIFY entre instâncias. Cliente/listener reconectam, sala ressincroniza a cada 15s; polling de segurança se socket cai.
- Seed inclui lote real de Dom Casmurro, ao vivo por 6h ao criar, com lance de R$ 50 de Ana. Reexecução preserva prazo e saldo/liderança existentes.

## Validação executada

Em 26/10/2026:

- Migration 0002_auctions.sql aplicada: catalog_items, auctions, bids, índices/constraints. Migration inicial preservada.
- Primeira rodada direcionada: 13/13 testes de leilões em PostgreSQL real aprovados.
- Rodada final após adicionar disputa cruzada: **22/22 testes aprovados** (14 leilões + 8 fundação), ~3,66s. Sem suítes completas a cada alteração.
- Cinco cenários pedidos aprovados: lances simultâneos no mesmo lote; mesmo usuário em lotes diferentes; liberação do líder anterior; saldo insuficiente; autossuperação.
- Adicionais: outbids cruzados sem deadlock; inicial/incremento; perfil; janela; expiração durante espera por lock; anti-sniping exato; idempotência; cancelamento por dono/sem lances; ocultação na vitrine; privacidade; snapshot/fallback; início inclusivo/fim exclusivo.
- WebSocket entre DUAS instâncias Fastify: evento após lance confirmado via PostgreSQL; recusa não gera novo evento.
- TypeScript nos três workspaces, lint e build API/web aprovados. Avisos não bloqueantes Vite/Zod: comentários de anotação e chunk JS ~653 kB (~191 kB gzip). Otimização pendente.
- Smoke da API compilada em porta temporária 3002: sala HTTP 200, histórico de um lance e capa persistida; WebSocket abriu e recebeu resync. Processo temporário finalizado.
- Catálogo real: primeira consulta teve timeout; repetição HTTP 200, oito registros de Dom Casmurro, quatro com capa persistida. Indisponibilidade tratada.
- Navegador: leiloeiro pesquisou Dom Casmurro, selecionou livro e publicou lote. Ana enviou R$ 50; sessão do leiloeiro recebeu atualização sem recarregar. Bruno superou com R$ 55; Ana viu novo valor, histórico com dois lances, “Você foi superado” e liberação exata de R$ 50 (disponível de R$ 5.000 para R$ 5.050, mantendo outra reserva de R$ 50 no seed).
- Evidência local ignorada no Git: tmp/auction-verified.png. CSS responsivo implementado; viewport móvel ainda não verificado separadamente. Sem suíte Playwright versionada.

Validações DEV não equivalem à aprovação do QA. Sem subagentes e sem acionar QA; QA_REPORT não foi alterado.

## Arquivos principais

- apps/api/src/catalog/service.ts: integração, imagem e fallback.
- apps/api/src/auctions/service.ts: publicação, cancelamento, sala, vitrine e lances.
- apps/api/src/auctions/realtime.ts: WebSocket, LISTEN/NOTIFY e reconexão.
- apps/api/src/app.ts: rotas/autorização; db/schema.ts e migrations/0002_auctions.sql: persistência.
- apps/api/test/auctions.test.ts: 14 testes; teste da fundação preservado.
- apps/web/src/auction-pages.tsx: novas telas; main.tsx: rotas; vite.config.ts: proxy WS.
- packages/shared/src/index.ts: schemas e contratos públicos.

## Executar

Na raiz: npm install; copiar .env.example para .env se ainda não existir; docker compose up -d db; npm run db:migrate; npm run db:seed; npm run dev.

Web: http://localhost:5173 . API: http://localhost:3001/health . Banco: localhost:54329. Servidores de desenvolvimento seguem em execução. Contas demo e senha no README.

Novas rotas: GET /catalog, GET /auctions, GET /me/auctions, POST /auctions, GET /auctions/:id, POST /auctions/:id/cancel, POST /auctions/:id/bids e WebSocket /auctions/:id/events. Contratos em API_CONTRACT.

Lote seed: /lotes/00000000-0000-4000-8000-000000000100. Lote criado/disputado no navegador: /lotes/371f8b81-d0a5-4cb2-87ec-fce3b1a7e618, com fim em 26/10/2026 às 13:14 (America/Sao_Paulo), sem renovação automática.

## Pendências e limitações

- **Liquidação automática pendente.** ENCERRADO é estado temporal que rejeita lances, sem débito/crédito/comprovante. Último líder permanece com saldo comprometido. Sala informa a limitação; não liberar sem transferência/comprovante atômicos na próxima etapa.
- Resultados financeiros/total recebido, meus arremates, comprovantes e auditoria criptográfica com âncora independente pendentes. Histórico atual não é prova de integridade.
- Seed não renova lotes vencidos/cancelados; publique novos no painel. Importação inicial exige provedor disponível; falha preserva contas e solicita repetir seed. Snapshots/lotes existentes continuam disponíveis.
- Até 100 lotes na vitrine e 50 depósitos no extrato. Histórico de lances completo, sem paginação nesta etapa.
- Sessão em sessionStorage; CSP do frontend no deploy pendente. WEB_ORIGIN deve ser a origem exata (padrão localhost:5173).
- Deploy, GitHub público e envio pendentes; nenhum recurso externo provisionado. CI configurado, ainda não executado no GitHub.

## Bloqueios

Nenhum bloqueio para o próximo marco local. Open Library teve instabilidade transitória resolvida na repetição e coberta por fallback. Instalação do plugin WS e acesso ao PostgreSQL aprovados sem rejeições. Infraestrutura pública/credenciais e eventual custo serão resolvidos no marco de deploy.
# Sprint 4 — publicação em preparação (26/10/2026)

Este bloco prevalece sobre os registros históricos abaixo. Aplicação ainda sem URLs públicas; nenhuma validação de produção concluída. Nenhum recurso pago criado/autorizado. Código publicado: https://github.com/matssgit/elite-dev-verzel (push inicial b42bd18). Revisão dos 61 arquivos não encontrou tokens/chaves privadas; caminhos sensíveis ignorados e não rastreados. Projeto Vercel Hobby criado após autorização da conexão, ainda sem deployment; painel https://vercel.com/zmats-projects/elite-dev-verzel .

- Preparados vercel.json (Vite/SPA/headers), validação obrigatória de VITE_API_URL HTTPS, entradas compiladas de migrations/seed/verificação do storage e inicialização Render com verificação de mount real. Segredos ficam fora do Git; chave pública local está explicitamente identificada como desenvolvimento.
- Proposta paga removida da descoberta automática e arquivada em deploy/render.paid.yaml após recusa do responsável. Não aplicar. Não há adaptador remoto de checkpoints nem função agendada implantados. Comparação e recomendação em INFRA_OPTIONS.md.
- TypeScript, lint e build aprovados durante a preparação; testes direcionados de liquidação/auditoria 12/12 aprovados. Volume Docker exclusivo provou preservação de checkpoint/fingerprint entre contêineres, permissão 0600 e recusa sem mount ou após perda da chave. Não equivalem a reiniciar/redeployar na Render.
- Primeiro CI público aprovado no commit b42bd18: instalação limpa, PostgreSQL 17, migrations, TypeScript, lint, npm test e build. Evidência: https://github.com/matssgit/elite-dev-verzel/actions/runs/40364745794 . Teste de CI não é prova de funcionamento dos serviços de produção.
- Produção pendente: escolher infraestrutura compatível, configurar provedores/segredos, revisar proteção de acesso do frontend, aplicar migrations/seed e executar os fluxos públicos, incluindo suspensão/reinicialização/redeploy e isolamento de credenciais SQL. Documentação em DEPLOY.md e AUDIT.md. Não reutilizar infraestrutura de outros projetos.

---

