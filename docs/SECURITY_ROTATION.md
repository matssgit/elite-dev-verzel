# Rotação de credenciais — Sprint 5

**Atualização às 21:04 de 26/10:** ensaio exclusivamente demonstrativo autorizado e concluído com `FINANCIAL_MAINTENANCE=true` e trigger pausado. Compradora Ana: total 500000→495000 centavos, reserva 5000→0. Vendedor demo: total 0→5000. Exatamente um PURCHASE -5000 e um SALE +5000; nenhum provedor de pagamento foi chamado. Comprovante `d209288d-6a1c-43a7-a0ec-c8fa5dbc21cc` HTTP 200 (API e página). Um novo SETTLE/checkpoint válido; 14 antigos preservados, total 15 em cinco lotes. Segunda execução retornou settled=false e o snapshot financeiro completo permaneceu idêntico (`53f9f00b00b93e188b90908c18f80beafeba4db0275baf20fd4dfd56b1c7ac3a`). Comparação das carteiras, razão, lotes, lances, comprovantes e auditoria recusaria mudanças inesperadas; nenhuma foi observada. Código b91f50f, 28 testes direcionados, TypeScript/lint/build aprovados.

Executor temporário exigiu hash de uma única sessão válida do vendedor, prazo curto, lote/valor/contas fixos, histórico anterior fixado e exclusão mútua. Não recebeu segredos de infraestrutura. Fonte temporária removida por redeploy e sessão revogada ao terminar. Verificação posterior: cinco liquidados, zero pendentes, invariantes corretas, chave/checkpoint preservados após redeploy; trigger segue enabled=false, version=9841168, next_run_at=null. Não é teste de disparo automático do cron nem de suspensão física da API.

Fase 2 preparada em [AUDIT_KEY_ROTATION.md](AUDIT_KEY_ROTATION.md), com [fronteira pública observada](AUDIT_ROTATION_BOUNDARY.json). Não houve troca de chave nem reabertura. Evidências brutas locais em tmp/controlled-demo-*.json (ignoradas pelo Git). Os estados de 20:48 e anteriores abaixo registram o andamento histórico.

**Estado atual, 26/10 às 20:48:** operador concluiu troca SQL/Blob e atualização dos consumidores. Manutenção continua ativa e trigger desativado, por instrução expressa. Cinco auditorias/14 checkpoints idênticos ao baseline; verificação da função confirmou PostgreSQL, invariantes e leitura/escrita Blob fora do namespace de auditoria. Falta o ensaio financeiro pós-rotação e a fase 2 de assinatura. As tentativas anteriores abaixo são históricas.

**SQL e Blob rotacionados manualmente; assinatura ainda não rotacionada.** A rejeição anterior de stdin levou ao handoff nativo, sem valores novos na conversa/terminal do agente. O operador confirmou expiração imediata do token Blob antigo. Não foi feito teste de autenticação com os valores antigos; registrar essa limitação. A busca no histórico Git não elimina exposição anterior em registros externos.

## Recursos e consumidores

| Credencial | Recurso | Consumidores | Estado |
|---|---|---|---|
| Senha SQL | Neon cold-haze-51518470, branch production, papel elite_verzel_owner | API, migrations/seed, função settlement | Operador redefiniu; API reiniciada e função conectam; zero conexões anteriores à configuração nova observadas |
| Token Blob | store_jAwONeQLbcJmOzGK, prefixo elite-v1/ | API e função; conexão do projeto Vercel | Operador substituiu; leitura/escrita verificadas; expiração imediata antiga informada, sem teste com token anterior |
| Chave de assinatura | identidade pública em AUDIT_PRODUCTION_PUBLIC_KEY.pem | API, função, verificador e páginas públicas | Transição entre chaves ainda não implementada; troca direta proibida |

## Fase 1 — SQL e Blob (janela curta, confirmação obrigatória)

1. Preservar os JSON públicos, hashes/checkpoints e comprovantes atuais. Registrar horário/commit e divergências observadas. Não alterar eventos, apagar objetos nem recriar o banco/store.
2. Antes da janela, preparar os painéis protegidos da Render e Neon e identificar todos os consumidores. Pausar temporariamente o trigger e bloquear novas operações financeiras com FINANCIAL_MAINTENANCE=true; consultas públicas permanecem disponíveis quando o banco está conectado. O bloqueio já foi implementado/testado localmente (API, worker e Function), desativado por padrão; sua ativação em produção ainda depende de confirmação. Auth/leituras podem falhar temporariamente durante a troca da conexão SQL.
3. Neon permite reset de senha pelo Console/API. O reset invalida novas conexões com a senha antiga; não equivale a encerrar conexões já abertas. Atualizar DATABASE_URL da API e as duas URLs de conexão da função (incluindo DATABASE_URL_UNPOOLED), sempre por configuração protegida. Encerrar conexões antigas do papel durante a janela depois de obter a nova conexão de administração. Não revogar o único acesso de recuperação.
4. Alternativa de menor indisponibilidade: criar novo papel SQL com privilégios explícitos, mover consumidores e somente então desabilitar login/revogar o papel exposto. A propriedade dos objetos e o runner de migrations/seed exigem revisão; não presumir que um novo papel funciona sem grants. Não criar novo projeto/plano pago.
5. Blob: substituir o token do MESMO store e atualizar API/função. A Vercel documenta revogação pelo Dashboard; o MCP instalado não oferece criação/revogação de tokens Blob. Confirmar a interface e se há sobreposição entre tokens antes do corte. Não confundir OAuth/Edge Config com token Blob. Não deletar o store para revogar acesso. Se não houver caminho seguro no painel, interromper essa etapa e solicitar ação do responsável.
6. Redeployar os consumidores com os valores novos, sem eco/arquivo em texto puro/argumentos de shell. Validar autenticação SQL, leitura de checkpoints antigos e escrita de uma prova identificada em prefixo de validação. Confirmar que as credenciais antigas foram recusadas por testes de leitura/autenticação, sem tentar alterar objetos.
7. Reativar agendamento/escritas e validar login, sala/WS, um lote controlado, liquidação única e comprovante. Não declarar a rotação concluída apenas porque um painel salvou as variáveis. Se houver falha, manter manutenção; não restaurar uma credencial exposta como solução definitiva.

O reset/revogação pode interromper API/cron. A fase 1 foi autorizada e a troca SQL/Blob foi executada manualmente pelo operador; os resultados atuais estão ao final. Manutenção e cron continuam bloqueados por instrução posterior do usuário. A fase 2 continua separada.

### Tentativa autorizada e bloqueio

Em 26/10 às 18:55, o trigger foi pausado e a API recebeu FINANCIAL_MAINTENANCE=true (deploy 9c4f084). Antes de alterar senha/token, a revisão automática rejeitou a injeção por stdin na sessão externa. Não houve reset, rotação Blob nem troca de assinatura. O helper foi encerrado e desativado antes de ler entrada/iniciar filhos. Às 18:57 o trigger voltou a enabled=true e a API recebeu FINANCIAL_MAINTENANCE=false; dep-dbfspblg1s2s73cjddvg ficou live às 18:58. Às 18:59: health 200, ausência de manutenção confirmada por 401 no POST financeiro sem sessão, cinco auditorias INTEGRO, cron às 18:58/18:59 com failures=0. Janela encerrada sem mudança de credenciais. Evidência pública atual em tmp/rotation-audit-baseline.json, ignorada pelo Git.

Alternativa: geração nos painéis e inserção humana nos campos protegidos. **Correção após conferir a interface:** o Console Neon atual não oferece editor de variáveis da função; essa etapa exige CLI/API. Não procurar um menu Environment inexistente. Os passos de handoff estão abaixo. Nenhum valor deve passar pela conversa, argumentos ou sessão de terminal do agente.

### Passos manuais verificados

1. Abrir Vercel Storage > elite-dev-verzel-audit > Settings; Neon projeto elite-dev-verzel, branch production; Render serviço elite-dev-verzel-api > Environment. Não resetar/rotacionar ainda. Informar ao agente que os painéis estão prontos.
2. Agente ativa manutenção da API e da função, pausa o trigger e confirma bloqueio financeiro. deploy/neon-maintenance.ts controla apenas a flag pública, preservando todos os segredos já implantados. Não iniciar a troca antes dessa confirmação.
3. Operador: Vercel > Rotate Credentials no MESMO store; escolher expiração imediata da credencial antiga durante a janela. Não Delete Store nem Upgrade. O token novo aparece na variável BLOB_READ_WRITE_TOKEN do projeto conectado elite-dev-verzel. Copiar somente para os destinos protegidos; não colar em mensagens.
4. Operador: Neon > Postgres database > Roles > elite_verzel_owner > Reset password, na branch production. Em Connect, selecionar banco elite_verzel e papel elite_verzel_owner; desativar Connection pooling e copiar a URL nova completa.
5. Operador: Render > Environment > Edit: atualizar somente DATABASE_URL e BLOB_READ_WRITE_TOKEN. Manter FINANCIAL_MAINTENANCE=true e preservar AUDIT_PRIVATE_KEY, fingerprint e prefixo. Salvar e redeployar.
6. Operador: abrir PowerShell NATIVO no próprio computador, na pasta F:\teste-verzel, e executar `powershell.exe -NoProfile -File .\scripts\configure-neon-credentials.ps1`. O script solicita os dois valores novos com Read-Host -AsSecureString (entrada oculta). Não escrever valores no comando; não executar por ferramentas do agente. Recusa entrada redirecionada, não salva arquivo de credenciais e limpa as variáveis temporárias ao terminar. Se a política local impedir a execução, informar o erro sem segredos; não contornar a proteção automaticamente.
7. Esse script atualiza apenas DATABASE_URL, DATABASE_URL_UNPOOLED, BLOB_READ_WRITE_TOKEN e a manutenção da função. Os campos da chave de assinatura são OMITIDOS, preservando os valores existentes conforme contrato do SDK Neon. Não pede nem troca a chave privada. A configuração de entrada é deploy/neon-credentials.ts; nenhum banco/store/plano novo é declarado. Usa o perfil Neon elite-verzel já autenticado no cofre Windows e --no-env-pull.
8. Informar ao agente somente que a configuração terminou. O agente valida leituras/assinaturas e consumidores, retira manutenção e reativa cron quando estiver consistente. Falha mantém manutenção e não autoriza restaurar credenciais expostas. A verificação de revogação efetiva e de conexões SQL antigas ainda precisa ser concluída para fechar a fase.

Validação do handoff: sintaxe PowerShell e lint conferidos; o operador confirmou execução nativa bem-sucedida contra produção, e os consumidores foram verificados posteriormente. O agente não executou o script com segredos. O uso manual nativo evita transmitir os valores pelo terminal externo do agente; não protege contra comprometimento do computador do operador. O helper legado with-secret-env.mjs continua desativado.

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

## Resultado das verificações após o handoff

- Operador confirmou conclusão e expiração imediata das credenciais Blob antigas. Nenhum valor novo foi solicitado/exibido pelo agente.
- API redeployada em dep-dbfu7q0m7kps73aq84mg para carregar o ambiente atualizado; HTTP 200 em /health, 503 MAINTENANCE nas quatro rotas financeiras, login e permissões corretos, WS reconecta. Sessão criada só para o teste foi encerrada.
- Função manteve os campos de assinatura existentes e recebeu explicitamente DATABASE_URL/DATABASE_URL_UNPOOLED e o token. Verificação durante manutenção: PostgreSQL conecta, três migrations, quatro lotes já liquidados com invariantes corretas, um pendente e zero conexões do papel anteriores a 23:32:02 UTC (configuração manual nova). Isso não é teste de autenticação com a senha antiga.
- Blob: pin público confere com a chave configurada; prova pequena escrita/lida por uma credencial nova no runtime da função, no prefixo rotation-probes/, sem tocar eventos/checkpoints. Não é uma nova âncora financeira nem WORM. Endpoint de verificação só opera em manutenção, com alvo de escrita fixado por variável pública no deploy.
- Cinco auditorias e 14 eventos/checkpoints idênticos, assinaturas conferidas pelo CLI independente. Três comprovantes HTTP 200 e valores preservados. Não houve débito/crédito ou liquidação nesta validação.
- Cron continua disabled. A liquidação legítima de R$50 do lote original 00000000-0000-4000-8000-000000000100 venceu durante a manutenção e permanece pendente. Reservas correspondem aos lotes não liquidados, inclusive vencidos. Os 12 testes locais de liquidação passaram, mas NÃO substituem execução financeira pós-rotação em produção.
- Os handles antigos de credenciais mantidos pelo orquestrador foram descartados da memória de trabalho; isso não apaga eventuais registros históricos nem revoga acessos por si só.

Não há atestado de segurança plena: chave privada anterior ainda requer a fase 2. Para comprovar execução automática pós-rotação será necessária uma execução controlada do worker, mantendo lances/depósitos bloqueados, e conferência posterior de débito/crédito/comprovante únicos. Essa execução não foi iniciada, pois o usuário pediu cron pausado e manutenção ativa até o relatório.

Fontes: [Neon: rotação da conexão](https://neon.com/faqs/rotate-database-url-connection-string), [Neon: papéis e privilégios](https://neon.com/docs/manage/roles), [Vercel: credenciais Blob e revogação no Dashboard](https://vercel.com/changelog/vercel-private-blob-is-now-generally-available). OIDC automático da Vercel não deve ser presumido disponível na Render/Neon; mantêm-se consumidores externos.
