# Regras de negocio - Auto Pro IA

## Atendimento automatizado

- Toda mensagem recebida pela Evolution API deve ser validada antes de ser persistida.
- Mensagens enviadas pelo proprio numero da empresa entram como `human` e nao acionam resposta automatica.
- Mensagens de leads entram como `lead` e so acionam IA quando a conversa esta com status `ai`.
- A IA deve responder usando historico recente da conversa e resumo persistido quando existir.

## Buffer de mensagens

- Mensagens consecutivas do lead sao agrupadas no Redis por `conversationId`.
- O buffer evita que a IA responda varias vezes enquanto o cliente ainda esta digitando.
- A chave do buffer expira automaticamente para reduzir acumulo operacional.
- Em producao, o processamento do buffer deve rodar em worker/fila dedicada. O endpoint atual tambem permite disparo por job externo.

## Handoff humano

- `Assumir conversa` altera o status para `human`, registra `assigned_to` e pausa a IA.
- `Devolver para IA` altera o status para `ai`, remove responsavel ativo e libera o fluxo automatico.
- Toda mudanca de status gera registro em `handoff_events`.
- O historico da conversa nunca e apagado no handoff.

## Auditoria e seguranca

- Todas as tabelas possuem `created_at`, `updated_at`, `deleted_at`, `is_deleted` e `modified_by`.
- Exclusoes devem ser logicas, usando `is_deleted = true`.
- Consultas operacionais devem filtrar `is_deleted = false`.
- Endpoints criticos exigem sessao e RBAC.
- Secrets ficam apenas em variaveis de ambiente.
