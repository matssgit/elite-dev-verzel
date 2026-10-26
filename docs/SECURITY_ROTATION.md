# Rotação de credenciais — Sprint 5

Estado em 26/10/2026: **nenhuma das três credenciais foi rotacionada**. Por determinação do responsável, conexão PostgreSQL, token Blob e chave privada Ed25519 anteriores são tratados como potencialmente comprometidos. Não imprimir valores, reutilizá-los como credenciais definitivas nem enviá-los em argumentos. A revisão do histórico Git (cinco commits, 70 caminhos) não encontrou padrões de segredos; isso não elimina exposição em registros de ferramentas fora do Git.

## Recursos e consumidores

| Credencial | Recurso | Consumidores | Estado |
|---|---|---|---|
| Senha SQL | Neon cold-haze-51518470, branch production, papel elite_verzel_owner | API, migrations/seed, função settlement | Rotação pendente de confirmação |
| Token Blob | store_jAwONeQLbcJmOzGK, prefixo elite-v1/ | API e função; conexão do projeto Vercel | Rotação/revogação pendente de confirmação e acesso ao painel |
| Chave de assinatura | identidade pública em AUDIT_PRODUCTION_PUBLIC_KEY.pem | API, função, verificador e páginas públicas | Transição entre chaves ainda não implementada; troca direta proibida |

## Fase 1 — SQL e Blob (janela curta, confirmação obrigatória)

1. Preservar os JSON públicos, hashes/checkpoints e comprovantes atuais. Registrar horário/commit e divergências observadas. Não alterar eventos, apagar objetos nem recriar o banco/store.
2. Antes da janela, preparar os painéis protegidos da Render e Neon e identificar todos os consumidores. Pausar temporariamente o trigger e bloquear novas operações financeiras com FINANCIAL_MAINTENANCE=true; consultas públicas permanecem disponíveis quando o banco está conectado. O bloqueio já foi implementado/testado localmente (API, worker e Function), desativado por padrão; sua ativação em produção ainda depende de confirmação. Auth/leituras podem falhar temporariamente durante a troca da conexão SQL.
3. Neon permite reset de senha pelo Console/API. O reset invalida novas conexões com a senha antiga; não equivale a encerrar conexões já abertas. Atualizar DATABASE_URL da API e as duas URLs de conexão da função (incluindo DATABASE_URL_UNPOOLED), sempre por configuração protegida. Encerrar conexões antigas do papel durante a janela depois de obter a nova conexão de administração. Não revogar o único acesso de recuperação.
4. Alternativa de menor indisponibilidade: criar novo papel SQL com privilégios explícitos, mover consumidores e somente então desabilitar login/revogar o papel exposto. A propriedade dos objetos e o runner de migrations/seed exigem revisão; não presumir que um novo papel funciona sem grants. Não criar novo projeto/plano pago.
5. Blob: substituir o token do MESMO store e atualizar API/função. A Vercel documenta revogação pelo Dashboard; o MCP instalado não oferece criação/revogação de tokens Blob. Confirmar a interface e se há sobreposição entre tokens antes do corte. Não confundir OAuth/Edge Config com token Blob. Não deletar o store para revogar acesso. Se não houver caminho seguro no painel, interromper essa etapa e solicitar ação do responsável.
6. Redeployar os consumidores com os valores novos, sem eco/arquivo em texto puro/argumentos de shell. Validar autenticação SQL, leitura de checkpoints antigos e escrita de uma prova identificada em prefixo de validação. Confirmar que as credenciais antigas foram recusadas por testes de leitura/autenticação, sem tentar alterar objetos.
7. Reativar agendamento/escritas e validar login, sala/WS, um lote controlado, liquidação única e comprovante. Não declarar a rotação concluída apenas porque um painel salvou as variáveis. Se houver falha, manter manutenção; não restaurar uma credencial exposta como solução definitiva.

O reset/revogação pode interromper API/cron. **Nenhuma dessas operações foi executada.** Aprovação da opção gratuita não substitui a confirmação de manutenção exigida pela Sprint 5, seção 3.

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
