-- Controle de Produção
-- Fase Auth: profiles
--
-- Esta migration registra no repositório a estrutura já aplicada no
-- banco remoto durante a migração gradual para Supabase Auth.
--
-- Não cria usuários Auth, não insere profiles e não altera RLS.

create table if not exists public.profiles (
    id uuid primary key
        references auth.users(id)
        on delete cascade,
    username text not null unique,
    name text not null,
    role text not null
        check (
            role in (
                'administrador',
                'lideranca',
                'apoio',
                'producao',
                'visualizador'
            )
        ),
    created_at timestamptz not null default now()
);
