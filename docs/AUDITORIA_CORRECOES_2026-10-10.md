# Auditoria e correções — Controle de Produção

## Evidências iniciais

- `vite.config.ts`: o manifesto PWA definia `start_url: '/?mobile=1'`, e `src/App.tsx` trata `mobile=1` como sinal explícito de interface mobile.
- `src/xlsxUtils.ts`: o leitor ZIP avançava usando `compressedSize` do cabeçalho local. Em arquivos que usam data descriptor, esse tamanho pode estar zerado; o diretório central do ZIP contém o tamanho correto.
- `src/components/Dashboard.tsx` e `src/supabase.ts`: metas eram editadas e persistidas como `target_per_hour`.
- `src/App.tsx`: o carregamento inicial tentava restaurar a sessão Supabase existente.
- `src/components/MobileProduction.tsx` e `src/components/MobileAdminOperation.tsx`: a confirmação podia ocorrer enquanto o salvamento automático de rascunho ainda estava pendente, gerando conflito de versão.

## Alterações

1. PWA passa a iniciar em `/`; a escolha do layout mobile continua vinculada à rota/query explícita ou ao dispositivo móvel.
2. O leitor XLSX percorre o diretório central ZIP e usa os tamanhos reais dos arquivos, suportando arquivos que utilizam data descriptors.
3. O Dashboard recebe metas mensais em peças para atividades 1, 2 e 3. O ritmo horário é derivado por `floor(metaMensal / 720)`, usando as 720 horas fixas informadas. Exemplo: 1.000.000 / 720 = 1.388 pç/h.
4. Nova migration `20261010010000_dashboard_monthly_targets.sql` adiciona `target_monthly_pieces`, migra as metas existentes para um equivalente mensal e atualiza os RPCs com as mesmas permissões administrativas/de liderança.
5. A inicialização limpa a sessão local do Supabase e exige novo login após atualizar ou reabrir o app.
6. A finalização mobile e administrativa tenta salvar o rascunho mais recente antes de confirmar, reduzindo conflitos com o autosave.

## Validação

- `npm run lint` / `tsc --noEmit`: aprovado após as alterações.
- Build Vite: não foi possível validar neste ambiente porque a dependência opcional nativa `@rollup/rollup-linux-x64-gnu` não ficou disponível no `node_modules` copiado; o executável Vite falhou antes de compilar a aplicação.
- Não foi executada uma confirmação real contra Supabase. A migration precisa ser aplicada no projeto Supabase antes de publicar o frontend.

## Publicação

1. Revise e aplique `supabase/migrations/20261010010000_dashboard_monthly_targets.sql` no Supabase.
2. Instale as dependências no ambiente local (`npm install`) e execute `npm run lint` e `npm run build`.
3. Teste o app instalado no desktop e em celular; teste uma planilha `.xlsx` preenchida em massa; teste finalização de Inventário Rotativo e Outros; valide login após refresh/reabertura.
4. Publique no Vercel somente depois de confirmar os testes e a migration.
