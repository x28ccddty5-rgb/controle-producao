-- Dashboard: metas operacionais por atividade/setor
-- A meta deixa de ser regra hardcoded no frontend e passa a ser dado oficial do banco.

do $$
begin
  if to_regclass('public.activity_types') is null then
    raise exception 'Tabela public.activity_types não encontrada.';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception 'Tabela public.profiles não encontrada.';
  end if;
end;
$$;

alter table public.activity_types
  add column if not exists target_per_hour numeric(12,2);

alter table public.activity_types
  drop constraint if exists activity_types_target_per_hour_check;

alter table public.activity_types
  add constraint activity_types_target_per_hour_check
  check (target_per_hour is null or target_per_hour >= 0);

-- Migração dos valores que estavam hardcoded no Dashboard.
update public.activity_types
set target_per_hour = case code
  when 1 then 1458
  when 2 then 1388
  when 3 then 42
  else target_per_hour
end
where code in (1, 2, 3);

create or replace function public.dashboard_get_activity_targets()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('administrador', 'lideranca')
  ) then
    raise exception 'Consulta de metas permitida somente para Administrador ou Liderança.';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'code', a.code,
          'label', a.label,
          'target_per_hour', a.target_per_hour
        )
        order by a.code
      )
      from public.activity_types a
      where a.active = true
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.dashboard_get_activity_targets() from public;
grant execute on function public.dashboard_get_activity_targets() to authenticated;

create or replace function public.dashboard_update_activity_target(
  p_activity_code integer,
  p_target_per_hour numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('administrador', 'lideranca')
  ) then
    raise exception 'Alteração de metas permitida somente para Administrador ou Liderança.';
  end if;

  if p_target_per_hour is not null and p_target_per_hour < 0 then
    raise exception 'A meta não pode ser negativa.';
  end if;

  update public.activity_types
     set target_per_hour = p_target_per_hour
   where code = p_activity_code
     and active = true
  returning label into v_label;

  if v_label is null then
    raise exception 'Atividade/setor não encontrado ou inativo.';
  end if;

  return jsonb_build_object(
    'code', p_activity_code,
    'label', v_label,
    'target_per_hour', p_target_per_hour
  );
end;
$$;

revoke all on function public.dashboard_update_activity_target(integer,numeric) from public;
grant execute on function public.dashboard_update_activity_target(integer,numeric) to authenticated;
