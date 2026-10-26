# Rotação de credenciais — Sprint 5

Estado em 26/10/2026: **fase 1 autorizada pelo responsável; nenhuma das três credenciais foi rotacionada**. A revisão automática rejeitou o transporte por stdin do terminal antes da troca. O cron foi reativado e a manutenção retirada; não manter indisponibilidade enquanto falta o caminho protegido. Por determinação do responsável, as credenciais anteriores são potencialmente comprometidas. Não imprimir valores nem enviá-los em argumentos/entrada de terminal. A busca no histórico Git não elimina exposição em registros externos.

## Recursos e consumidores

| Credencial | Recurso | Consumidores | Estado |
|---|---|---|---|
| Senha SQL | Neon cold-haze-51518470, branch production, papel elite_verzel_owner | API, migrations/seed, função settlement | Autorizada; pendente de configuração direta nos painéis |
| Token Blob | store_jAwONeQLbcJmOzGK, prefixo elite-v1/ | API e função; conexão do projeto Vercel | Autorizada; rotação disponível no painel, ainda não executada |
| Chave de assinatura | identidade pública em AUDIT_PRODUCTION_PUBLIC_KEY.pem | API, função, verificador e páginas públicas | Transição entre chaves ainda não implementada; troca direta proibida |

## Fase 1 — SQL e Blob (janela curta, confirmação obrigatória)

1. Preservar os JSON públicos, hashes/checkpoints e comprovantes atuais. Registrar horário/commit e divergências observadas. Não alterar eventos, apagar objetos nem recriar o banco/store.
2. Antes da janela, preparar os painéis protegidos da Render e Neon e identificar todos os consumidores. Pausar temporariamente o trigger e bloquear novas operações financeiras com FINANCIAL_MAINTENANCE=true; consultas públicas permanecem disponíveis quando o banco está conectado. O bloqueio já foi implementado/testado localmente (API, worker e Function), desativado por padrão; sua ativação em produção ainda depende de confirmação. Auth/leituras podem falhar temporariamente durante a troca da conexão SQL.
3. Neon permite reset de senha pelo Console/API. O reset invalida novas conexões com a senha antiga; não equivale a encerrar conexões já abertas. Atualizar DATABASE_URL da API e as duas URLs de conexão da função (incluindo DATABASE_URL_UNPOOLED), sempre por configuração protegida. Encerrar conexões antigas do papel durante a janela depois de obter a nova conexão de administração. Não revogar o único acesso de recuperação.
4. Alternativa de menor indisponibilidade: criar novo papel SQL com privilégios explícitos, mover consumidores e somente então desabilitar login/revogar o papel exposto. A propriedade dos objetos e o runner de migrations/seed exigem revisão; não presumir que um novo papel funciona sem grants. Não criar novo projeto/plano pago.
5. Blob: substituir o token do MESMO store e atualizar API/função. A Vercel documenta revogação pelo Dashboard; o MCP instalado não oferece criação/revogação de tokens Blob. Confirmar a interface e se há sobreposição entre tokens antes do corte. Não confundir OAuth/Edge Config com token Blob. Não deletar o store para revogar acesso. Se não houver caminho seguro no painel, interromper essa etapa e solicitar ação do responsável.
6. Redeployar os consumidores com os valores novos, sem eco/arquivo em texto puro/argumentos de shell. Validar autenticação SQL, leitura de checkpoints antigos e escrita de uma prova identificada em prefixo de validação. Confirmar que as credenciais antigas foram recusadas por testes de leitura/autenticação, sem tentar alterar objetos.
7. Reativar agendamento/escritas e validar login, sala/WS, um lote controlado, liquidação única e comprovante. Não declarar a rotação concluída apenas porque um painel salvou as variáveis. Se houver falha, manter manutenção; não restaurar uma credencial exposta como solução definitiva.

O reset/revogação pode interromper API/cron. **Nenhuma dessas operações foi executada.** A confirmação da fase 1 já foi recebida; não pedir outra autorização para o mesmo escopo. A fase 2 continua separada.

### Tentativa autorizada e bloqueio

Em 26/10 às 18:55, o trigger foi pausado e a API recebeu FINANCIAL_MAINTENANCE=true (deploy 9c4f084). Antes de alterar senha/token, a revisão automática rejeitou a injeção por stdin na sessão externa. Não houve reset, rotação Blob nem troca de assinatura. O helper foi encerrado e desativado antes de ler entrada/iniciar filhos. Às 18:57 o trigger voltou a enabled=true e a API recebeu FINANCIAL_MAINTENANCE=false; dep-dbfspblg1s2s73cjddvg ficou live às 18:58. Às 18:59: health 200, ausência de manutenção confirmada por 401 no POST financeiro sem sessão, cinco auditorias INTEGRO, cron às 18:58/18:59 com failures=0. Janela encerrada sem mudança de credenciais. Evidência pública atual em tmp/rotation-audit-baseline.json, ignorada pelo Git.

Alternativa mais simples: configurar as credenciais diretamente nos painéis protegidos. Blob: Storage > elite-dev-verzel-audit > Settings > Rotate Credentials; o painel oferece atraso de expiração e atualiza variáveis dos projetos conectados, mas deployments precisam ser atualizados. Não usar Delete Store. Neon: Postgres > Roles > elite_verzel_owner > Reset password. Copiar os novos valores somente para Environment da API Render e da função settlement (DATABASE_URL e DATABASE_URL_UNPOOLED). No mesmo fluxo, atualizar BLOB_READ_WRITE_TOKEN nos dois consumidores. Manter chave, fingerprint, prefixo e objetos existentes. Credenciais novas não devem passar pela conversa/terminal. O operador precisa concluir a troca nos painéis; o agente prepara manutenção e executa as verificações sem solicitar os valores.

## Fase 2 — assinatura (implementação/testes e confirmação separados)

O AuditStore atual e o verificador usam uma única chave/pin. Substituir AUDIT_PRIVATE_KEY ou trocar o prefixo para um storage vazio quebraria a verificação dos eventos antigos ou esconderia a âncora. Não fazer esse corte diretamente.

Menor evolução proposta, ainda pendente:

- Gerar uma identidade nova por mecanismo protegido, nunca imprimindo a chave privada. Preservar a chave pública anterior, marcada como potencialmente comprometida, apenas para verificação histórica.
- Capturar um manifesto público de transição contendo chaves públicas/fingerprints, horário, commit e sequência/hash final observado de CADA lote existente; publicar por canal independente revisado. Assinar o manifesto com a chave nova e fixar sua identidade por revisão humana/Git. A assinatura antiga sozinha não autoriza a sucessora, pois a chave antiga pode estar comprometida.
- Adaptar AuditStore, relatório público e verificador para múltiplas chaves com fronteiras explícitas: aceitar a chave antiga somente até os hashes/sequências ancorados, exigir chave nova para eventos posteriores e para lotes novos, mantendo o encadeamento anterior. Recusar rollback anterior à fronteira e manifesto/chave divergentes. Preservar pin/objetos antigos; não reassinar, apagar ou sobrescrever eventos.
- Testar cadeia mista, histórico/comprovante antigo, lote novo, falha de manifesto, sufixo forjado com chave antiga, rollback e recuperação da outbox antes de cortar produção. Fazer a troca em janela coordenada de API e função, depois testar os consumidores reais e publicar a fingerprint nova.

Rotação não demonstra que o histórico anterior à captura estava intacto: quem tivesse senha SQL, token Blob e chave antiga poderia falsificar a combinação. INTEGRO significa que os dados e assinaturas observados conferem; não resolve suspeita de comprometimento da chave. O manifesto fixa o estado observado na transição, não certifica retroativamente sua origem. Não oferecer garantia WORM: token/runtime/admin das plataformas continuam fora da proteção contra atacante restrito ao SQL.

## Evidências e critérios de fechamento

Teste interrompido retomado somente com leituras: lote 8e1b798d-0654-4f4e-b514-933f4d4b7bf7 venceu às 14:55:15.253 e liquidou às 14:56:00.956 (America/Sao_Paulo). Um PURCHASE -1000, um SALE +1000, um comprovante fc05d6d1-cd77-4720-9fa7-2a5e5ba47ee6, reservas zeradas. Logs Neon às 14:56:01 indicam failures=0. Auditoria pública/CLI conferiram três eventos.

Render não forneceu evento de suspensão nem série de instance_count no intervalo; ausência de métricas não significa zero instâncias. **Teste de suspensão física inconclusivo**, sem repetição. A liquidação independente foi confirmada com RUN_SETTLEMENT_JOBS=false.

Para fechar rotação: registrar confirmação do responsável, horário, consumidores atualizados, credenciais antigas recusadas, histórico preservado e fluxo novo validado. Não incluir valores de segredos na evidência. Até lá, a entrega permanece com risco de credenciais potencialmente expostas.

Fontes: [Neon: rotação da conexão](https://neon.com/faqs/rotate-database-url-connection-string), [Neon: papéis e privilégios](https://neon.com/docs/manage/roles), [Vercel: credenciais Blob e revogação no Dashboard](https://vercel.com/changelog/vercel-private-blob-is-now-generally-available). OIDC automático da Vercel não deve ser presumido disponível na Render/Neon; mantêm-se consumidores externos.
