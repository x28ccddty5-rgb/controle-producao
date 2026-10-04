# Ajustes — Planejamento, Histórico e Dashboard

Objetivo:
- melhorar o Planejamento no Desktop e no Mobile;
- transformar exportação/modelo/importação da escala em Excel `.xlsx`, sem dependência externa;
- adicionar filtros e paginação/área limitada no Histórico;
- permitir correções pontuais de histórico para Administrador/Liderança com auditoria;
- remover completamente Ranking do Dashboard;
- reforçar indicadores e adicionar eficiência por colaborador;
- adicionar Horas Extras oficiais da jornada Mobile ao Dashboard.

## Arquivos

- `src/components/ShiftPlanning.tsx`
- `src/xlsxUtils.ts`
- `src/components/MobileHistory.tsx`
- `src/components/HistoryLogs.tsx`
- `src/mobileSupabase.ts`
- `src/supabase.ts`
- `src/components/Dashboard.tsx`
- `src/App.tsx`
- `supabase/migrations/20261004020000_mobile_history_corrections.sql`

## Ordem

1. Execute a migration `20261004020000_mobile_history_corrections.sql` no SQL Editor do Supabase.
2. Confirme que a migration termina sem erro.
3. Substitua os arquivos TypeScript pelos arquivos deste pacote.
4. Rode `npm run lint`.
5. Rode `npm run build` no ambiente Windows do projeto.
6. Teste com Administrador/Liderança e com um operador.

## Excel

O modelo/exportação usam `.xlsx` diretamente, sem adicionar biblioteca npm.
O arquivo contém:
- aba `Escala`;
- aba `Instruções`.

Para `FOLGA` e `FÉRIAS`:
- informe data e colaborador;
- use `Tipo = FOLGA` ou `Tipo = FÉRIAS`;
- deixe início/fim vazios;
- essas linhas são informativas e não criam um turno.
Se houver horário, o horário prevalece e a linha não deve ser marcada como folga/férias.

## Importante

Horas extras são calculadas pela jornada Mobile oficial (`mobile_shifts`), após o fim previsto da escala.

Horas de transição NÃO são estimadas por lacunas entre atividades. Isso foi deliberadamente evitado para não confundir transição com intervalo, ausência ou tempo não alocado. Para exibir transição no Dashboard com segurança, a próxima camada deve consumir os eventos oficiais da jornada (`mobile_events`).

## Validação realizada neste ambiente

- `npm run lint`: OK.
- Gerador/leitor `.xlsx`: testado com ZIP sem compressão e com ZIP Deflate.
- `npm run build`: NÃO concluído neste ambiente porque o Rollup Linux opcional está ausente em `node_modules`; erro de ambiente/dependência, não diagnóstico de TypeScript.
- Migration SQL: revisão estática; ainda precisa ser executada no Supabase real.
