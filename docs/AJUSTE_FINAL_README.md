AJUSTE FINAL — DASHBOARD + HISTÓRICO MOBILE
==============================================

Objetivo
--------
Ajustes finais visuais solicitados antes da subida ao projeto oficial.

Alterações
----------
1. Dashboard:
   - Horas extras voltou para o mesmo conjunto visual das demais métricas.
   - Cards superiores reorganizados como resumo operacional.
   - Produção física separada em uma faixa própria.
   - Removidos os dois blocos redundantes de ritmo/setor.
   - Consolidado em "Ritmo x meta por setor".
   - Ritmo por setor agora usa o tempo produtivo das atividades concluídas do próprio setor,
     e não a duração total do calendário consultado.
   - Mantidas as metas operacionais existentes no código.
   - Incluída composição visual Produção x Paradas.
   - Pareto de motivos de parada permanece como visual analítico principal.
   - Não foi adicionado gráfico extra desnecessário.

2. MobileHistory:
   - filtros com largura controlada;
   - grids com min-width:0;
   - espaçamento/padding reduzidos;
   - inputs/selects impedidos de ultrapassar o viewport.

3. index.css:
   - controles mobile mais compactos.

Validação
---------
npm run lint: PASSOU (tsc --noEmit, exit 0).

npm run build: NÃO VALIDADO neste ambiente por dependência Rollup Linux ausente:
@rollup/rollup-linux-x64-gnu.
Isso é limitação do ambiente de validação, não evidência de erro no código.

Aplicação
---------
Substituir os 3 arquivos pelos arquivos deste pacote.
Não fazer alterações em MobileProduction.tsx nesta rodada.
