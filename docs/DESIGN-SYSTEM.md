# Auto Pro IA Design System

## Principio Central

Direcionamento antes de informacao. O atendente deve enxergar primeiro o que fazer agora, depois abrir detalhes apenas quando precisar.

## Regras De Interface

- Mostrar no primeiro nivel somente decisao, prioridade e proxima acao.
- Agrupar detalhes em secoes expansíveis.
- Evitar blocos longos sempre abertos.
- Preferir textos curtos, verbos de acao e indicadores visuais.
- Usar cards para tarefas, nao para despejar informacao.

## Paleta Oficial

A identidade visual deve usar a paleta Auto Pro IA inspirada em transito, tecnologia e resultado:

- Fundo principal: `#0B1120`.
- Superficie elevada: `#111827`.
- Tecnologia neutra: `#1F2937`.
- Acao primaria / transito: `#FACC15`.
- Amarelo profundo: `#EAB308`.
- Clareza / texto principal: `#F9FAFB`.
- Sucesso / matricula: `#22C55E`.
- Alerta / urgencia: `#EF4444`.
- Confianca pontual: `#0F4C8A`.

O amarelo deve ser a cor dominante de acao. Azul deve aparecer apenas como apoio de confianca/tecnologia, sem competir com o amarelo.

## Hierarquia Operacional

1. Proxima acao recomendada.
2. Status do atendimento.
3. Chance, temperatura e sentimento.
4. Contexto resumido.
5. Historico e dados completos.

## Padrao De Secoes

- Resumo visivel: titulo, subtitulo e indicador.
- Conteudo fechado por padrao quando for historico, detalhe ou auditoria.
- Conteudo aberto por padrao somente quando influencia a proxima resposta.

## Aplicacao Inicial

A Central de Atendimento usa esse padrao no painel lateral:

- Card de direcionamento no topo.
- Inteligencia do lead em secao expansível.
- Timeline operacional em secao expansível.
- Perfil completo em modal separado.

## Leads E Kanban

As telas de Leads e Kanban seguem o mesmo criterio:

- Cards fechados mostram apenas identidade, prioridade e proxima acao.
- Telefone, observacoes, timeline e dados completos ficam em drawer ou expansao.
- Acoes rapidas ficam compactas e aparecem perto da decisao operacional.
- O Kanban usa expansao no proprio card para abrir contexto sem trocar de tela.
- Leads usa drawer lateral para detalhamento, com secoes expansíveis.

## Setores Do Kanban

O funil deve ser lido por setor operacional:

- Comercial: entrada, qualificacao, atendimento, orcamento e negociacao.
- Follow-up: interessados, retornos e leads perdidos.
- Fechamento: matricula pendente e matricula realizada.

Cada setor pode ser recolhido para reduzir ruido visual e focar no trabalho do momento.

## Central De Fechamento

Na central de fechamento, o topo deve orientar o atendente:

- Primeiro: plano de ataque e proxima acao.
- Segundo: filtros rapidos para escolher o foco.
- Terceiro: indicadores apenas como apoio em secao expansivel.
- Detalhes completos ficam no drawer do lead, nunca todos abertos na lista.
