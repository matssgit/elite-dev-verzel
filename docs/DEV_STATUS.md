# Status DEV — Sprint 5 — 26/10/2026

## Estado atual

Demonstração publicada: https://elite-dev-verzel-zmats-projects.vercel.app .
API: https://elite-dev-verzel-api.onrender.com/health .
Código: https://github.com/matssgit/elite-dev-verzel .

Vercel Hobby, Render Free, Neon Free e Blob privado. Nenhum recurso pago autorizado/criado. Fonte de configuração e limitações: DEPLOY.md. QA independente permanece sob coordenação do responsável; QA_REPORT.md não foi alterado e nenhum subagente/conversa de QA foi acionado.

**Prioridade de segurança:** as três credenciais anteriores de infraestrutura são potencialmente comprometidas por determinação do responsável. Nenhuma rotação concluída. Plano em SECURITY_ROTATION.md; reset/revogação com possível indisponibilidade depende de confirmação expressa. A chave única atual não admite troca direta preservando o histórico; a transição entre chaves ainda precisa ser implementada/testada.

## Funcionalidades preservadas

- Autenticação com sessão Bearer revogável, perfis e autorização no backend; carteira/depósitos simulados com idempotência.
- Catálogo Open Library com snapshots de metadados/capa no PostgreSQL, lotes e vitrine/sala pública.
- Lances com lock no lote e carteiras ordenadas, relógio do banco após locks, mínimo/incremento/período, impedimento de autossuperação, reserva/liberação e anti-sniping +120s.
- WebSocket WSS com LISTEN/NOTIFY dedicado, resync e recuperação de snapshot.
- Liquidação transacional e idempotente, razão PURCHASE/SALE, comprovantes únicos e resultados. Mesma implementação no worker local e na função Neon agendada por minuto; RUN_SETTLEMENT_JOBS=false na API de produção.
- Eventos SHA-256/Ed25519, outbox e checkpoints remotos privados fora do banco, pin e publicação sem sobrescrita por convenção da aplicação. Não é WORM; comprometimento conjunto de chave/token/runtime está fora da proteção restrita ao SQL.

## Provas de produção retomadas — sem repetir operações financeiras

Consulta READ ONLY em 26/10 às 18:32–18:33 (America/Sao_Paulo):

- Lote controlado 8e1b798d-0654-4f4e-b514-933f4d4b7bf7: fim 14:55:15.253, liquidação 14:56:00.956, R$10,00. Um PURCHASE -1000, um SALE +1000, um comprovante fc05d6d1-cd77-4720-9fa7-2a5e5ba47ee6. Reserva do vencedor zerada.
- Lotes vencedores anteriores de R$11 e R$70 continuam com um comprovante e duas movimentações cada, sem duplicações; lote sem lances continua sem movimentos. Todas as reservas das contas de validação conferem com a soma dos lotes ainda liderados.
- Logs do Neon entre 14:54 e 14:57 registraram o cron, incluindo 14:56:01 com failures=0.
- Render: consulta histórica de eventos trouxe apenas deploy_ended; instance_count não retornou série e logs filtrados não comprovaram suspensão. **Suspensão física naquele horário: INCONCLUSIVA.** Ausência de métricas não representa zero instâncias. Não foi criado outro lote nem repetido o teste.
- Auditoria desse lote e verificador independente conferiram três eventos/checkpoints; comprovante e rota SPA HTTP 200. O estado técnico INTEGRO não elimina suspeita de comprometimento da chave.
- API/frontend acessíveis; conjunto inicial de leituras levou ~44,8s, compatível com a latência de reativação, mas não prova suspensão no horário antigo.
- Login de demonstração, CORS da origem canônica, Bearer sem cookie, restrições por perfil, logout/revogação e duas conexões WS sequenciais com resync aprovados às 18:39, sem depósitos ou lances novos.

Provas da Sprint 4 preservadas: corrida no mesmo lote e entre lotes, liberação do líder superado, rejeições sem saldo/autossuperação, dois clientes WS e liquidação real. Antes/depois do redeploy Render dep-dbfouq4s728c738ilkog e da função, a auditoria preservou a fingerprint e os quatro checkpoints do lote 30ae384d-0b99-4430-8dca-131f51e7bd41; comprovante de R$11 e login permaneceram funcionais. Evidências locais em tmp/, fora do Git. Não confundir restart por redeploy com a prova de suspensão por ociosidade.

## Alterações seguras da Sprint 5

- FINANCIAL_MAINTENANCE preparado, desativado por padrão: bloqueia POST de depósitos/lotes/lances/cancelamentos antes da transação; leituras continuam disponíveis com SQL conectado; worker e Function também respeitam o bloqueio.
- Mecanismo ainda não ativado em produção; não houve reset de senha, revogação de token, troca de chave ou pausa do cron nesta sprint.
- README consolidado: URLs, arquitetura/regras, variáveis sem valores reais, migrations compiladas, demonstração, concorrência, liquidação, IA/revisão humana e riscos.
- Documentação de auditoria/delivery separa integridade matemática, confiança da chave e proteção operacional. Nenhum checkpoint foi apagado ou reescrito.

## Verificações e Git

- Estado inicial: main limpa, alinhada a origin/main, d26e208cdbd3b5a5066dd0746f9eca6bef6ed027.
- Revisão local dos cinco commits/70 caminhos: nenhum padrão de token/chave privada nem caminho sensível encontrado. .env/var/tmp/node_modules/.vercel ignorados. Essa busca não certifica ausência de exposição em logs externos.
- CI do commit implantado aprovado: https://github.com/matssgit/elite-dev-verzel/actions/runs/40370057271 .
- Sprint 5: testes direcionados de manutenção/fundação 11/11 aprovados; TypeScript, lint e build aprovados. Sprint 4 após correções compatíveis Drizzle/Zod: 29/29 direcionados financeiros/Blob; npm audit --omit=dev sem avisos. Existem avisos nas ferramentas de desenvolvimento; sem audit fix --force.
- Não foi executado QA completo nem repetida a suíte completa local a cada alteração.

## Pendências e bloqueios

1. Confirmação de janela e acesso protegido aos painéis para rotação SQL/Blob. Verificar novos consumidores e revogação real antes de fechar a fase.
2. Implementação/testes da transição criptográfica e confirmação separada antes de trocar a identidade de produção. Não há restauração de autenticidade retroativa de uma chave comprometida.
3. Suspensão física histórica classificada como inconclusiva; liquidação independente confirmada.
4. Franquias gratuitas, cold start e indisponibilidade eventual; manter sem upgrade e sem forma de pagamento Render. Não prometer disponibilidade gratuita indefinida.
5. Seed não renova lotes vencidos. Conferir lote ativo na data da avaliação e criar novo pelo painel se necessário, sem alterar prazos/saldos existentes.
6. Revisão humana e QA independente antes da entrega de 29/10/2026; prazo/horário final do formulário devem ser confirmados pelo responsável.

