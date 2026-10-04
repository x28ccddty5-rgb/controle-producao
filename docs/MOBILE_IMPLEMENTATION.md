# Mobile operacional — Controle de Produção

Implementação inicial da interface Mobile sobre as RPCs Mobile já aplicadas no Supabase.

## Acesso

Após autenticar no sistema, abra:

`/mobile`

Também funciona com:

`/?mobile=1`

O Desktop continua no fluxo existente quando essa rota/parâmetro não é usado.

## Fluxo implementado

- identificação do colaborador vinculado ao usuário;
- turno planejado → início explícito;
- `NAO_ALOCADO`;
- início de atividade;
- cronômetro por timestamp da sessão;
- rascunho incremental persistido no Supabase;
- parada durante atividade;
- resolução da parada e retorno automático;
- intervalo;
- ausência;
- transição entre atividades;
- formulário final;
- confirmação da atividade;
- cancelamento da atividade;
- encerramento explícito do turno;
- recuperação do estado após recarregar a página.

## Arquivos novos

- `src/components/MobileProduction.tsx`
- `src/mobileSupabase.ts`

## Arquivo alterado

- `src/App.tsx` — somente adiciona o ponto de entrada `/mobile` / `?mobile=1`.
- `src/index.css` — estilos auxiliares exclusivos do Mobile.

## Validação realizada

- TypeScript (`npm run lint`): OK.
- Build Vite: não concluído neste ambiente porque o `node_modules` presente no ZIP não contém o binário opcional nativo do Rollup (`@rollup/rollup-linux-x64-gnu`). Isso é uma condição do ambiente/dependências, não um erro de TypeScript identificado no código.

## Observação

A interface usa as tabelas/RPCs Mobile já criadas no Supabase durante o piloto. Nenhuma nova migration SQL foi adicionada nesta etapa.
