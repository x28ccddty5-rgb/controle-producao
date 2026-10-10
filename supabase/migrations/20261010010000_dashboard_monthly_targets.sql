-- Metas operacionais mensais em peças para atividades 1, 2 e 3.
-- O frontend deriva pç/h usando 720 horas fixas (30 dias x 24 horas).

do $$
begin
  if to_regclass('public.activity_types') is null then
    raise exception 'Tabela public.activity_types não encontrada.';
  end if;
end;
$$;

alter table public.activity_types
  add column if not exists target_monthly_pieces numeric(14,0);

-- Migra as metas horárias anteriores para um equivalente mensal, preservando
-- aproximadamente o ritmo configurado antes da mudança de regra.
update public.activity_types
set target_monthly_pieces = round(target_per_hour * 720)
where target_monthly_pieces is null
  and target_per_hour is not null;

alter table public.activity_types
  drop constraint if exists activity_types_target_monthly_pieces_check;
alter table public.activity_types
  add constraint activity_types_target_monthly_pieces_check
  check (target_monthly_pieces is null or target_monthly_pieces >= 0);

-- Remove a assinatura antiga para evitar ambiguidade no RPC.
drop function if exists public.dashboard_update_activity_target(integer, numeric);

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
    select 1 from public.profiles
    where id = auth.uid() and role in ('administrador', 'lideranca')
  ) then
    raise exception 'Consulta de metas permitida somente para Administrador ou Liderança.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', a.code,
      'label', a.label,
      'target_monthly_pieces', a.target_monthly_pieces
    ) order by a.code)
    from public.activity_types a
    where a.active = true and a.code in (1, 2, 3)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.dashboard_get_activity_targets() from public;
grant execute on function public.dashboard_get_activity_targets() to authenticated;

create or replace function public.dashboard_update_activity_target(
  p_activity_code integer,
  p_target_monthly_pieces numeric
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
    select 1 from public.profiles
    where id = auth.uid() and role in ('administrador', 'lideranca')
  ) then
    raise exception 'Alteração de metas permitida somente para Administrador ou Liderança.';
  end if;

  if p_activity_code not in (1, 2, 3) then
    raise exception 'Somente as atividades 1, 2 e 3 possuem meta configurável neste Dashboard.';
  end if;

  if p_target_monthly_pieces is not null and p_target_monthly_pieces < 0 then
    raise exception 'A meta mensal não pode ser negativa.';
  end if;

  if p_target_monthly_pieces is not null and p_target_monthly_pieces <> trunc(p_target_monthly_pieces) then
    raise exception 'A meta mensal deve ser informada em peças inteiras.';
  end if;

  update public.activity_types
     set target_monthly_pieces = p_target_monthly_pieces
   where code = p_activity_code and active = true
  returning label into v_label;

  if v_label is null then
    raise exception 'Atividade/setor não encontrado ou inativo.';
  end if;

  return jsonb_build_object(
    'code', p_activity_code,
    'label', v_label,
    'target_monthly_pieces', p_target_monthly_pieces
  );
end;
$$;

revoke all on function public.dashboard_update_activity_target(integer, numeric) from public;
grant execute on function public.dashboard_update_activity_target(integer, numeric) to authenticated;
