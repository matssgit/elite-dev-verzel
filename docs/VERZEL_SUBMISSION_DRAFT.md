# Submissão Verzel — pronta para preenchimento humano

**Estado técnico: PRONTO PARA SUBMISSÃO. Formulário ainda não enviado.** Prazo: 29/10/2026; confirmar horário no convite.

| Campo | Conteúdo |
|---|---|
| Nome completo / e-mail | Preencher com seus dados reais diretamente no formulário |
| Repositório/branch avaliada | https://github.com/matssgit/elite-dev-verzel/tree/codex/elite-verzel-demo |
| Demonstração funcional | https://elite-verzel-demo.vercel.app |
| API | https://elite-verzel-demo-api.onrender.com/health |
| Relatório | docs/DEMO_DELIVERY_RESULT.md na branch entregue |

Se o campo de repositório só aceitar a raiz https://github.com/matssgit/elite-dev-verzel, acrescente explicitamente **avaliar branch codex/elite-verzel-demo** nas observações/explicação. main não foi mesclada nesta missão.

Contas de teste, senha exclusivamente demonstrativa: DemoVerzel2026!

- leiloeiro@demo.local — leiloeiro.
- ana@demo.local e bruno@demo.local — licitantes.

Lote aberto com lance até 30/10, 23:59 Brasília: /lotes/db18868b-df85-4fde-874a-ba2e79568b14. Comprovante: /comprovantes/96d9114b-2774-441b-9cc7-70f055852268. Caminhos relativos à demonstração acima.

## Funcionalidades verificadas

Login/perfis, catálogo real/snapshots, criação/cancelamento, carteira/depósito idempotente, lances/rejeições/liberação de reserva, WebSocket, anti-sniping +120s, encerramento e liquidação de R$ 11, comprovante/auditoria públicos. SQL conciliou saldo/ledger/reservas; reinício preservou valores, comprovante e checkpoints sem duplicação. Seis históricos e 13 checkpoints íntegros. Fluxos remotos não foram executados no ambiente original.

Suíte atual: 91 API + 6 SSR + 7 preflight; TypeScript/lint/build/stamp aprovados. Conferir o CI do SHA final publicado; detalhes em DEMO_DELIVERY_RESULT.md. Não apresentar testes isolados como adulteração executada no banco público.

## Texto de IA — revisar antes de copiar

Utilizei Codex como apoio à implementação, análise das regras, documentação, revisão e execução de testes automatizados. Também utilizei o agente para o walkthrough HTTP/WS e a validação da demonstração pública. Realizei pessoalmente testes manuais locais de login, responsividade, carteira/lances, WebSocket, liquidação, comprovante e auditoria, incluindo verificação independente da evidência local. Configurei os serviços e segredos protegidos e gerei a identidade exclusiva da demonstração. As evidências e limitações estão documentadas no repositório.

Essas atividades humanas constam do relato fornecido pelo responsável. **Complemente somente com as decisões que realmente revisou e sabe explicar**; não afirmar revisão humana de todas as linhas nem atribuir ao desenvolvedor os comandos executados pelo agente.

## Limitações a informar

Render Free suspende por inatividade: o worker retoma vencidos ao acordar, com possível atraso. Franquias gratuitas não garantem disponibilidade contínua. Auditoria depende da guarda independente de chave/storage e não é WORM. A produção original permanece em manutenção, sem cron reativado; o incidente antigo Neon não foi declarado resolvido. A demo usa serviços/identidade independentes e valores simulados.

## Envio

Formulário indicado no edital/documentação: https://elitedev.verzel.com.br/?elite-dev-2026-2 . Confirmar endereço/horário no convite, preencher seus dados, colar os links e o texto revisado, conferir e enviar. Guardar comprovante do envio. Nenhum formulário foi submetido automaticamente.
