# Diagnóstico neutro do HTTP 403 — 27/10/2026

**Resultado:** reproduzida uma entrega inconsistente de versões durante a atualização da função. O mesmo Bearer foi aceito com HTTP 200 pela versão diagnóstica e recebeu 403 em respostas sem o marcador dessa versão. A causa interna dessa divergência no Neon ainda não foi comprovada. Nenhuma operação financeira foi executada ou autorizada por este diagnóstico.

Evidências sanitizadas: [POST_403_DIAGNOSTIC.json](POST_403_DIAGNOSTIC.json). A coleta com autenticação ocorreu entre 18:19 e 18:20 UTC. Conferência final às **18:27:17 UTC / 15:27:17 Brasília**.

## Escopo e ausência de efeitos financeiros

O POST `/scheduled-validation/preflight` do commit `4153e21` foi reutilizado sem alterar a autenticação. Ele apenas chama a autorização existente, que lê sessões/usuários, e devolve flags públicas. Não chama preparação, depósito, lance, liquidação, publicação, registro de sessão ou DDL.

Para o diagnóstico, um envelope permitiu somente esse POST, GET de status e o diagnóstico público já existente. Preparação/armamento/fechamento/worker ficaram inacessíveis, inclusive com um Bearer válido; testes locais verificaram esse bloqueio antes do deploy. UUIDs de lote/comprador/vendedor vazios, modo financeiro de validação false, manutenção true, jobs false e prazo do envelope de dez minutos. Os pins/manifesto/provas remotas preexistentes continuaram exigidos.

Foi criada **uma única sessão temporária** da conta demonstrativa já exigida pela política original: hash vinculado ao consumidor e usuário LEILOEIRO com e-mail fixado no servidor. A permissão efetiva na função foi limitada às duas rotas neutras; não se concedeu outro papel nem se relaxou o predicado de autorização. A sessão padrão da API não recebeu um novo campo de escopo: a restrição foi aplicada pelo envelope HTTP e pelos bloqueios públicos de manutenção. Ela foi revogada por logout HTTP 204 ao concluir. As demais sessões não foram modificadas pelo endpoint. A extensão de transporte foi totalmente anônima, sem criar outra sessão.

Token permaneceu na memória do processo, nunca em argumentos, arquivos ou logs; somente seu hash unidirecional foi enviado como configuração. Cookies reais não foram copiados. As evidências guardam nomes de headers/flags, códigos HTTP e marcadores públicos; não guardam Authorization, Cookie, Set-Cookie ou credenciais de infraestrutura. Nenhuma chave privada foi acessada.

## Evidências de HTTP e permissões

O envelope identifica a versão por `x-elite-diagnostic-id` e `x-elite-diagnostic-build`. O header booleano bearer-match não contém o Bearer ou seu hash. A versão atual necessariamente adiciona esses marcadores às respostas das duas rotas neutras, inclusive nas negativas. Os redirects foram desabilitados no cliente; não houve resposta de redirecionamento nas amostras.

| Caso | HTTP / procedência | Conclusão delimitada |
|---|---|---|
| Bearer correto, POST sem body/Origin/cookies | 200, marcador atual, bearer-match=true, nonFinancial=true | Autenticação e autorização originais funcionaram; esses campos extras não são obrigatórios nesse caminho |
| Mesmo Bearer, durante a observação | 403 sem marcador atual | Recusa não pode ser atribuída ao guard da versão diagnóstica identificada |
| GET de controle durante a observação | Alternou 405 sem marcador e 200 com marcador atual | A confirmação de apply não garantiu uma visão uniforme da versão servida |
| Bearer errado | 403 com marcador atual e bearer-match=false | Negativa da aplicação verificada |
| Origin externo sem Bearer | 403 com marcador atual e bearer-match=false | Origin não substitui autenticação |
| Anônimo e cookie fictício sem Bearer | 403 sem marcador atual | Acesso recusado; não é prova isolada da negativa na versão nova |
| Bearer correto + JSON | 200 com marcador atual | POST com JSON também funciona |
| Bearer correto + Origin externo | 200 com marcador atual, sem ACAO | HTTP de serviço com token válido funciona; isso não concede acesso CORS a um navegador |
| Bearer correto + header CSRF fictício | 200 com marcador atual | Não comprova obrigatoriedade de CSRF: POST sem esse header também recebeu 200 |
| Bearer correto + cookie fictício / Origin do frontend | 403 sem marcador atual | Não atribuir o resultado a Cookie/Origin sem a mesma versão |
| OPTIONS na amostra | 405 sem marcador e sem ACAO | Não foi demonstrado suporte CORS do browser nessa rota |
| Após logout da única sessão | 403 sem marcador atual | Recusa observada; não foi uma prova de revogação no handler neutro identificado. Logout 204 e o código de exclusão da sessão são evidências separadas |

O login não emitiu Set-Cookie. A aplicação autentica por Authorization e não lê cookie como credencial nesse caminho. A sessão temporária foi reutilizada em todos os positivos; não houve nova autenticação para contornar um erro. A rotina de autenticação/autorizações é a mesma para GET e POST e não exige Origin ou token CSRF. No consumidor neutro não foi adicionado CORS, cookie de autenticação ou exceção CSRF para fazer o teste passar.

As verificações foram HTTP por Node, sem browser ou cookie jar. Não foi realizado um ensaio completo de cookies/CSRF em navegador real. As respostas com procedência ausente não foram usadas para declarar que a versão nova aprovou todos os casos.

A [documentação de autenticação do Neon](https://neon.com/docs/compute/functions/authentication) informa que a função tem URL pública e autenticação no próprio handler; CORS de browser é responsabilidade da aplicação. Isso não prova por si só a origem de uma resposta específica. No código normal deste projeto, um POST sem header reservado de trigger retorna 403 e um GET desconhecido retorna 405: os resultados sem marcador são compatíveis com esse handler anterior. Não há trace histórico do 403 financeiro anterior que comprove sua origem exata.

## Hipóteses e comparação de transporte

**Demonstrado:** coexistiram respostas da versão diagnóstica e respostas incompatíveis com ela; o mesmo Bearer funciona quando atendido pela versão identificada. Não há evidência de que fosse necessário trocar token, enviar cookies ou afrouxar CSRF para obter o 200 neutro.

**Não comprovado:** motivo interno da entrega inconsistente — propagação, roteamento, cache ou instâncias antigas. A hipótese de conexão persistente foi comparada sem autenticação: um socket foi mantido durante o deploy e conexões novas foram abertas com Connection: close. Durante a janela limitada, tanto o persistente quanto os novos receberam 405 sem marcador; a geração diagnóstica não foi observada por esse experimento. Resultado inconclusivo; não recomendar Connection: close como correção comprovada. Não houve novo login, sessão, fixture ou chamada financeira nessa comparação.

Correção mínima proposta, ainda sem autorização de teste financeiro:

1. Identificar build/geração nas respostas de controle e exigir correspondência de versão e runId em GET **e POST neutro**, não apenas exit code da CLI ou HTTP 200 isolado.
2. Conferir o estado do deploy da função antes da admissão; a [CLI oferece espera do build no deploy direto](https://neon.com/docs/compute/functions/deploy). Isso precisa ser validado de forma neutra, sem pressupor que resolverá o roteamento.
3. Enquanto houver versões diferentes, falhar fechado e manter a manutenção. Coletar revisão/trace do provedor, sem credenciais, para distinguir propagação de cache/roteamento antes de outra tentativa financeira.

Não foi feita mudança na política de autenticação, nos cookies ou em CSRF. Não foi repetido prepare/settlement para investigar o problema. A validação financeira agendada continua pendente e requer autorização própria.

## Estado final verificado

- **Render:** deploy `dep-dbgdgd6i0phs73c70rhg`, commit `3a65ffb`, Live; `/health` responde. Sem redeploy da API nesta execução. Quatro rotas financeiras públicas continuam HTTP 503/MAINTENANCE.
- **Neon:** fonte normal reaplicada após cada envelope temporário e GET da rota de controle voltou a 405. FINANCIAL_MAINTENANCE=true e RUN_SETTLEMENT_JOBS=false preservados. A ausência de troca instantânea de todos os atendimentos é uma limitação observada, não ocultada; os envelopes temporários também não admitiam operações financeiras.
- **Cron:** `trigger-81af7a75-3b54-4914-ad70-d410cfb95939`, disabled, next_run_at=null, versão `9841168` inalterada. Nunca habilitado.
- **Integridade:** 15 checkpoints/assinaturas idênticos, verificados independentemente; snapshot igual a `53f9f00b00b93e188b90908c18f80beafeba4db0275baf20fd4dfd56b1c7ac3a`; quatro comprovantes íntegros; invariantes financeiras aprovadas.
- **Segredos/acessos:** única sessão revogada; sem novos recursos, upgrades, pagamentos ou exposição de credenciais. Nenhum dado de demonstração foi apagado/compensado.

Checks locais: sete testes direcionados do envelope, POST neutro e manutenção; TypeScript, lint, build e sintaxe dos scripts aprovados. A comparação anônima foi encerrada como inconclusiva e a fonte normal foi restaurada. A origem interna da mistura de versões permanece o bloqueio técnico para retomar o ensaio financeiro.
