# Matriz de requisitos

Sprint 5: aplicação publicada nos serviços gratuitos, com liquidação Neon independente e checkpoints Blob. Persistência após redeploy e retomada do lote controlado confirmadas; **suspensão física histórica inconclusiva**, sem repetição. Credenciais anteriores potencialmente comprometidas: rotação pendente de confirmação; transição criptográfica ainda não implementada. Validações funcionais abaixo não equivalem a segurança operacional plena. Evidências em DEV_STATUS/DEPLOY e plano em SECURITY_ROTATION. Nenhum recurso pago autorizado.

Fonte: `Teste tecnico Elite Dev - Verzel.pdf`, 7 páginas, lidas visualmente na íntegra em 26/10/2026 (o documento contém imagens, sem camada textual útil).

Estados: **Pendente**, **Em desenvolvimento**, **Implementado**, **Validado**. Validado exige evidência no DEV_STATUS; não significa aprovação independente do QA.

## Obrigatórios

| ID | Requisito fiel ao edital | Página | Estado | Evidência / escopo |
|---|---|---|---|---|
| R01 | Dois papéis: leiloeiro gerencia os próprios lotes e não dá lances; licitante deposita e arremata | 2 | Validado | Perfis, lotes, participação e arremate/liquidação verificados; 34 testes distintos e navegador |
| R02 | Autenticação de usuários | 2 | Validado | Cadastro/login, sessão expirada/revogável e logout: testes de integração e login no navegador; DEV_STATUS |
| R03 | Buscar itens de API pública e criar lote com imagem, título, atributos, lance inicial, incremento e início/fim | 2–3 | Validado | Busca real, snapshot incluindo capa, seleção e publicação conferidos no navegador; DEV_STATUS |
| R04 | Vitrine separando ao vivo, agendados e encerrados; ocultar cancelados | 3 | Validado | Vitrine por status implementada; cancelados ocultos e fronteiras de estado testadas |
| R05 | Proprietário cancela lote que ainda não recebeu lances | 3 | Validado | Proprietário/ausência de lances verificados em integração |
| R06 | Leiloeiro vê resultado de cada lote, se arrematado, valor e total recebido | 3 | Validado | Resultados e comprovantes do leiloeiro; crédito/total recebido de R$55 conferido no navegador |
| R07 | Sala com lance atual, histórico, posição do usuário, contador e ganhando/superado sem recarregar | 3 | Validado | Duas sessões no navegador: histórico, cronômetro, ganhando/superado e WS; teste entre instâncias |
| R08 | Carteira: total, comprometido, disponível e depósito simulado | 3 | Validado | Depósitos preservados; reserva e liberação atômicas nos testes e navegador |
| R09 | Meus arremates: itens em que deu lances, vencidos, comprovante e link compartilhável | 3 | Validado | Histórico de participações, vencidos e comprovante compartilhável; fluxo do vencedor no navegador |
| R10 | Auditoria pública sem login: histórico completo e indicação íntegro/adulterado | 3 | Validado | Página/API públicas com cadeia, assinaturas, checkpoints e status; ressalvas em AUDIT.md |
| R11 | Motivos claros de recusa: mínimo, saldo, já líder, não iniciado, encerrado | 3 | Validado | Mínimo, saldo, autossuperação, janela futura e encerrada testados |
| R12 | Vitrine, salas, auditoria e comprovantes independentes da disponibilidade da API externa | 4 | Validado | Snapshots independentes do catálogo usados na vitrine, sala, comprovante e auditoria |
| R13 | Lances somente entre início e fim, primeiro >= inicial, seguintes >= atual + incremento, líder não se supera | 4 | Validado | Regras, janela e expiração durante espera por lock testadas |
| R14 | Saldo disponível = total − comprometido; bloquear lance acima do disponível, reservar liderança e liberar anterior imediatamente | 4 | Validado | Concorrência no lote, entre lotes, outbids cruzados, saldo/liberação testados em PostgreSQL real |
| R15 | Lance aceito nos últimos 2 minutos estende o fim por +2 minutos | 4 | Validado | Prorrogação exata de 120s ao fim vigente na janela final; prazo persistido e propagado |
| R16 | Encerrar, debitar vencedor, creditar leiloeiro e gerar comprovante; sem lances, sem vencedor | 4 | Validado | Liquidação atômica/idempotente, concorrência, sem lances e reinício; testes e lote demo liquidado automaticamente |
| R17 | Detectar alteração, remoção e inserção posterior, inclusive diretamente no banco; explicar técnica | 4 | Em desenvolvimento | Implementado/testado localmente com Ed25519 e arquivos fora do banco; isolamento/durabilidade da âncora em produção pendentes; AUDIT.md |
| R18 | Auditoria e comprovante identificam licitantes sem expor dados pessoais | 4 | Validado | Histórico/comprovante públicos usam códigos aleatórios; nomes, e-mails e IDs internos omitidos |
| R19 | React no frontend; Node.js ou Python no backend; banco aceito e instruções de configuração | 5 | Validado | Build React/Node.js e execução em PostgreSQL; instruções no README; DEV_STATUS |
| R20 | Seed: um leiloeiro, dois clientes, lote publicado com lances abertos | 5 | Validado | Seed com três contas, saldo e lote real de Dom Casmurro com lance; execução local confirmada |
| R21 | README detalhado, execução e comportamentos inesperados/limitações | 5 | Implementado | README com estado atual |
| R22 | Aplicação publicada e acessível por link público | 2,7 | Pendente | Sem deploy nesta etapa |
| R23 | Repositório público no GitHub (ambos os links se separados) | 7 | Pendente | Ainda sem repositório Git configurado |
| R24 | Envio no formulário com nome completo, e-mail, repositório, deploy e explicação do uso de IA | 7 | Pendente | Envio coordenado pelo humano |

## Opcionais oficiais

| ID | Requisito | Página | Estado |
|---|---|---|---|
| O01 | Busca e filtro de lotes | 6 | Pendente |
| O02 | Cancelamento com estorno automático | 6 | Pendente |
| O03 | Docker Compose | 6 | Validado (PostgreSQL local; execução em DEV_STATUS) |
| O04 | Testes automatizados | 6 | Validado (34 testes distintos: regressão 33/33 e direcionados 12/12 após adicionar um caso) |
| O05 | Dark mode claro/escuro | 6 | Pendente |

Não solicitados pelo edital: nota fiscal, revenda entre usuários, app nativo e recuperação de senha (p.6). Segurança, concorrência e deploy não serão sacrificados para opcionais.

## Prazo, avaliação e entrega

- Edital p.5: sete dias corridos a partir do recebimento. Não especifica data absoluta nem horário de corte. Meta informada pelo responsável: **29/10/2026**; confirmar horário no convite/formulário antes de enviar.
- Formulário p.7: https://elitedev.verzel.com.br/?elite-dev-2026-2
- Opcionais contam na avaliação, mas não são obrigatórios. Falta de explicações no README afeta negativamente a nota. O edital não apresenta pesos ou rubrica adicional.
- Uso de IA é permitido; explicar onde, como e o que foi revisto/ajustado.

## Requisitos adicionais do responsável

TypeScript strict, monorepo, migrations, autorização no backend, testes direcionados de concorrência financeira, liquidação idempotente, âncora de auditoria independente do histórico, documentação DEV/QA e implantação progressiva. Esses requisitos complementam o edital e não mudam a classificação dos opcionais oficiais.
