# Entrega da demonstração — Elite Dev Verzel

**28/10/2026, Brasília. Estado: PRONTO PARA SUBMISSÃO, com limitações dos planos gratuitos.** O envio do formulário ainda deve ser feito pelo responsável. Esta conclusão refere-se à demo isolada; a produção original continua em manutenção e não foi alterada.

## Links para avaliação

- **Aplicação funcional:** https://elite-verzel-demo.vercel.app
- **API:** https://elite-verzel-demo-api.onrender.com/health
- **Código entregue:** https://github.com/matssgit/elite-dev-verzel/tree/codex/elite-verzel-demo
- **Lote aberto com lance até30/10/2026,23:59 Brasília:** https://elite-verzel-demo.vercel.app/lotes/db18868b-df85-4fde-874a-ba2e79568b14
- **Lote agendado para30/10,00:00 Brasília:** https://elite-verzel-demo.vercel.app/lotes/7473cdaa-bba1-4446-a6b8-672ce9c5716d
- **Lote encerrado/validado:** https://elite-verzel-demo.vercel.app/lotes/7f216ecb-a459-4bec-8b59-e6f4978a6b25
- **Comprovante público:** https://elite-verzel-demo.vercel.app/comprovantes/96d9114b-2774-441b-9cc7-70f055852268
- **Auditoria pública:** https://elite-verzel-demo.vercel.app/auditoria/7f216ecb-a459-4bec-8b59-e6f4978a6b25

**Usar a branch indicada, não presumir que main contém esta entrega.** main não foi mesclada nem alterada nesta missão. A branch está pública, contém o README atual e é a origem dos serviços demonstrativos.

## Contas exclusivamente demonstrativas

Senha de teste das três contas: `DemoVerzel2026!`. Sem dinheiro real e sem acesso administrativo aos provedores.

| Conta | Perfil |
|---|---|
| leiloeiro@demo.local | LEILOEIRO |
| ana@demo.local | LICITANTE |
| bruno@demo.local | LICITANTE |

Abra sessões separadas para disputar lances. O líder não pode cobrir seu próprio lance; use o outro licitante. Os valores e reservas abaixo representam o instante da validação e podem mudar com novos testes públicos legítimos.

## Isolamento e implantação realmente confirmados

Vercel Hobby novo prj_WF7fcEaeuexYDAPyIpJ7MfBOFPcD; Render Free novo srv-dbh86ed9fdbs7387t2m0; Neon Free novo shy-base-42585434 / br-tiny-cloud-b8cj8tmf; Blob privado novo store_UQ7SEOCwcjWKg0zw / prefixoelite-verzel-demo-v1/. Não houve contratação, trial, upgrade, reutilização de banco/store/token/chave operacional ou alteração dos recursos antigos.

Fingerprint público exclusivo: **389b505e9330eaf660ace80f9d3f352375ccf9a03c2475621753810fbba496eb**. A chave pública foi lida no novo store e seu SHA256 comparado ao pin fornecido pelo operador antes da liberação financeira. Preflight bloqueia hostname/pooler/TLS indevidos, outro store/prefixo, token embrulhado, identidade incompatível e combinações inesperadas dos flags. Segredos não foram enviados à conversa/commits/arquivos versionados. DPAPI não foi aberto pelo agente.

Inicialização protegida Live: dep-dbhatqh42hec73bubq4g; preflightOK, migrations0001–0003, seed ignorado por manutenção, health200, POSTs neutros503MAINTENANCE. Depois, somente os flags da demo foram liberados: FINANCIAL_MAINTENANCE=false, RUN_SETTLEMENT_JOBS=true e ALLOW_DEMO_SEED=true. Produção original não teve flags alterados.

Startup com seed concluído: **dep-dbhb242fngtc73b5fv30**, Live. Reinício/redeploy de persistência: **dep-dbhb6m6c6qcc73ettqo0**, Live, runtime commitd3bce83e763cab991117cfa7eb2fbfe8473984dc. Commits posteriores de documentação e frontend não alteram esse backend validado; ver CI/commit final no GitHub.

## Walkthrough remoto executado

| Grupo | Resultado efetivo |
|---|---|
| Autenticação e perfis | Logins das três contas viaAPI; Bruno e vendedor também pela UI. Licitante impedido de publicar e leiloeiro impedido de lançar403 |
| Vitrine e lotes | Aberto, agendado e encerrados disponíveis; cancelado consultável diretamente mas excluído da vitrine |
| Catálogo/criação | Busca real DomCasmurro retornou cached=false; snapshot real/capa persistidos; criação viaAPI; busca e seleção/campos/publicação habilitada conferidas pela UI |
| Cancelamento | Próprio lote sem lances cancelado; removido da vitrine |
| Carteira | Depósito simuladoR$100 e repetição com a mesma chave resultaram em um único crédito; UI mostrou total/comprometido/disponível |
| Lances | InicialválidoR$10, superaçãoR$11; mínimo/incremento/saldo insuficiente recusados422; líder e período recusados409; mensagens contratuais preservadas |
| Reservas/idempotência | Reserva do líder, liberação exata da anterior, repetição do mesmo lance sem evento/movimento adicional |
| WebSocket | ClienteWS real recebeu auction.updated viaPostgreSQL LISTEN/NOTIFY; sala da UI conectada e liderança/histórico/cronômetro visíveis |
| Anti-sniping | Primeiro lance na janela final somou exatamente120000ms ao fim vigente |
| Encerramento | Worker da API encerrou automaticamente, sem chamar função Neon; lote sem lances encerrou sem vencedor/comprovante |
| Liquidação | Débito únicoR$11 do comprador e crédito únicoR$11 ao vendedor; reserva liberada; SQL conciliado |
| Comprovante | Público, INTEGRO, valorR$11, assinante novo; aberto em aba sem sessão |
| Auditoria | Seis históricos,13checkpoints íntegros, verificação independente; sem e-mails/nomes/UUIDs internos dos licitantes nos payloads públicos |
| Interface após fim | Sala passou ao encerramento sem reload; formulário de lance desapareceu, mensagem de arremate/liquidação confirmada e link do comprovante apareceram |
| Persistência | Após novo deployLive: igualdade exata de carteiras, resultados, comprovante, registros/checkpoints assinados dos lotes monitorados e SQLwallets/ledger/reservas; sem transferências adicionais |

Não houve teste destrutivo de adulteração na demo pública. Esses cenários permanecem na suíte isolada. A pesquisa/seleção foi exercitada pela UI; criação/cancelamento/depósito/lances do walkthrough remoto foram enviados pelo clienteHTTP de validação. Não apresentar como cliques manuais todos os testes de API.

## Conciliação financeira após reinício

| Conta | Total (centavos) | Comprometido | Reserva calculada dos lotes | Ledger total | Movimentos |
|---|---:|---:|---:|---:|---|
| Ana | 500000 | 5000 | 5000 | 500000 | Um depósito inicial |
| Bruno | 508900 | 10000 | 10000 | 508900 | Dois depósitos (seed+R$100) e uma compraR$11 |
| Leiloeiro | 1100 | 0 | 0 | 1100 | Uma vendaR$11 |

TotalconservadoR$10100 simulados: créditos iniciaisR$10000 mais depósito autorizadoR$100. Compra/venda têm soma zero. Reservas remanescentes pertencem ao seed e ao lote de prazo longo, não ao lote liquidado.

Evidência sanitizada: [DEMO_DELIVERY_EVIDENCE.json](DEMO_DELIVERY_EVIDENCE.json). Evidência integral assinada do arremate: [DEMO_AUDIT_EVIDENCE.json](DEMO_AUDIT_EVIDENCE.json), raiz em [AUDIT_DEMO_PUBLIC_KEY.pem](AUDIT_DEMO_PUBLIC_KEY.pem).

```sh
node scripts/verify-audit.mjs docs/DEMO_AUDIT_EVIDENCE.json 389b505e9330eaf660ace80f9d3f352375ccf9a03c2475621753810fbba496eb
```

Resultado executado: **Assinaturas/cadeia/checkpoints conferem:4eventos.** Esse pin pertence à demo; não usar os pins/manifestos antigos de produção.

## Testes locais/CI e correções da execução

- Suíte base executada:91testesAPI e4SSR aprovados em PostgreSQL descartável54331. Mais7testes de isolamento e2de confiança visual foram executados após suas mudanças; npm test inclui91API+6SSR+7preflight. CI final deve ser conferido pelo SHA publicado, sem tratar ensaio local como teste de produção.
- TypeScript, lint, build e stamp conferidos. npm audit --omit=dev retornou0vulnerabilidades de runtime; avisosdev do build não foram corrigidos com upgrades automáticos.
- Token inicialmente copiado com rótulo/aspas: guard recusou antes das migrations. Foi removido somente o rótulo público do campo do serviço novo por teclado, sem copiar/exibir o token em logs. Preflight manteve todas as verificações e passou.
- OpenLibrary indisponível no primeiro seed: contas/créditos ficaram idempotentes. SQLsomenteleitura confirmou um depósito por licitante. Item/autor/capa foram obtidos da API pública e inseridos idempotentemente no cache do banco novo; nenhum dado de produção copiado. Busca posterior do serviço também respondeu normalmente, cached=false.
- ClienteHTTP de teste corrigido por Content-TypeJSON sem corpo no cancelamento e expectativa409/422 de período. A API agiu conforme contrato. Retomada preservou depósitos/lotes existentes; nenhum depósito repetido com chave nova, compensação ou alteração de regras financeiras. Lote curto expirado sem lances foi preservado e validado sem comprovante.
- Mensagem da auditoria ajustada: uma raiz independente sem transição não é rotulada automaticamente como chave histórica comprometida; o alerta das identidades antigas expostas continua preservado. Não houve nova funcionalidade ou troca de arquitetura.

## Limitações e pendências de submissão

RenderFree pode suspender após inatividade. O worker executa no startup/a cada3s enquanto a API está ativa; vencidos durante suspensão são recuperados quando ela acorda. **Não há promessa de encerramento pontual durante suspensão** nem validação do antigo agendamento Neon. O ensaio remoto não provocou suspensão deliberada; comprovou reinício/redeploy e idempotência.

Franquias são compartilhadas nas contas/workspace; armazenamento é privado e persistente, mas nãoWORM. Proteção não cobre controle conjunto de banco/runtime/chave/storage. Nova raiz demo não autentica retroativamente os registros da produção antiga. APIs externas podem falhar; snapshots/cache mantêm os lotes publicados utilizáveis. Seed não reabre lotes antigos: depois do prazo indicado, publique novo pelo painel.

**Pendências:** preencher dados pessoais, revisar o texto de IA conforme participação real, confirmar horário e enviar o formulário da Verzel. Usar URLda branch acima caso o campo aceite; se exigir apenas repositório raiz, informar a branch no texto de observações/IA. Mergeemmain não está autorizado nem foi feito. Nenhum recurso pago ou alteração de produção é necessário para submeter a demo atual.

Formulário indicado no edital/documentação: https://elitedev.verzel.com.br/?elite-dev-2026-2 . O agente não o submeteu.
