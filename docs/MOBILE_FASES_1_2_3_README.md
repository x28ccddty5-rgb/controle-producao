# Mobile / Administração / Planejamento — pacote de alteração

Base: ZIP do projeto enviado pelo usuário em 04/10/2026.

## Arquivos
- src/App.tsx
- src/components/MobileProduction.tsx
- src/components/MobileHistory.tsx
- src/components/MobileAdminOperation.tsx
- src/components/ShiftPlanning.tsx
- src/mobileSupabase.ts
- supabase/migrations/20261004010000_mobile_admin_planning_history.sql

## Ordem
1. Executar o SQL da migration no Supabase SQL Editor.
2. Confirmar que o SQL terminou sem erro.
3. Substituir/criar os arquivos TypeScript listados.
4. Rodar `npm run lint`.
5. Rodar `npm run build` no ambiente local/projeto, pois o node_modules do ZIP de análise não possui o binário Linux opcional do Rollup.

## Funcionalidades
- Rascunho acumulativo: peças, itens, paleteira (paletes), empilhadeira (paletes).
- Consolidação do rascunho na ficha final.
- Histórico Mobile de atividades e paradas finalizadas.
- Operação livre para Liderança/Admin no Mobile, sem turno/escala.
- Planejamento de escalas para Desktop e Mobile.
- Desktop: importação CSV compatível com Excel com validação + pré-visualização + confirmação; exportação e modelo.
- Mobile: inclusão/edição individual de escalas.
- Backend: RPCs protegidas por role para planejamento, histórico e operação administrativa.

## Segurança
As operações administrativas de planejamento e operação livre são autorizadas no backend pela role do profile (`administrador` ou `lideranca`). A importação é transacional no RPC.
