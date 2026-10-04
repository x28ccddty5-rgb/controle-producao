-- Mobile/Desktop history filters and management-only correction RPCs.
-- Depends on the Mobile phases 1-3 migrations already executed in Supabase.

set check_function_bodies = on;

do $$
begin
  if to_regclass('public.activities') is null
     or to_regclass('public.stoppages') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.collaborators') is null
     or to_regclass('public.mobile_shifts') is null then
    raise exception 'Preflight falhou: estrutura operacional necessária não existe.';
  end if;
end;
$$;

drop function if exists public.mobile_get_history(uuid, integer);

create or replace function public.mobile_get_history(
  p_collaborator_id uuid default null,
  p_start_date text default null,
  p_end_date text default null,
  p_activity_code integer default null,
  p_stoppage_code integer default null,
  p_search text default null,
  p_limit integer default 15,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_name text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 15), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select role into v_role from public.profiles where id = auth.uid();

  if p_collaborator_id is null then
    if v_role not in ('administrador', 'lideranca') then
      raise exception 'Colaborador é obrigatório para este usuário.';
    end if;
  else
    if v_role not in ('administrador', 'lideranca') then
      if not exists (
        select 1
        from public.mobile_operator_bindings b
        where b.profile_id = auth.uid()
          and b.collaborator_id = p_collaborator_id
      ) then
        raise exception 'Acesso ao histórico de outro colaborador não permitido.';
      end if;
    end if;
  end if;

  if p_collaborator_id is not null then
    select c.name into v_name
    from public.collaborators c
    where c.id = p_collaborator_id;

    if v_name is null then
      raise exception 'Colaborador não encontrado.';
    end if;
  end if;

  return jsonb_build_object(
    'activities', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.sort_at desc)
      from (
        select
          a.id,
          a.date,
          a.operator,
          a.activity_code,
          a.activity_name,
          a.local,
          a.list_id,
          a.start_time,
          a.end_time,
          a.duration,
          a.pallet_jack_id,
          a.forklift_id,
          a.produced_quantity,
          a.items_quantity,
          a.notes,
          a.created_at,
          to_timestamp(
            a.date || ' ' || coalesce(a.end_time, a.start_time),
            'DD/MM/YYYY HH24:MI'
          ) as sort_at
        from public.activities a
        where (v_name is null or a.operator = v_name)
          and (p_start_date is null or to_date(a.date, 'DD/MM/YYYY') >= to_date(p_start_date, 'YYYY-MM-DD'))
          and (p_end_date is null or to_date(a.date, 'DD/MM/YYYY') <= to_date(p_end_date, 'YYYY-MM-DD'))
          and (p_activity_code is null or a.activity_code = p_activity_code)
          and (
            v_search is null
            or a.operator ilike '%' || v_search || '%'
            or a.activity_name ilike '%' || v_search || '%'
            or coalesce(a.local, '') ilike '%' || v_search || '%'
            or coalesce(a.list_id, '') ilike '%' || v_search || '%'
            or coalesce(a.notes, '') ilike '%' || v_search || '%'
          )
        order by sort_at desc
        limit v_limit
        offset v_offset
      ) x
    ), '[]'::jsonb),
    'stoppages', coalesce((
      select jsonb_agg(to_jsonb(y) order by y.sort_at desc)
      from (
        select
          s.id,
          s.date,
          s.operator,
          s.stoppage_code,
          s.stoppage_name,
          s.start_time,
          s.end_time,
          s.duration,
          s.duration_minutes,
          s.notes,
          s.resolution_notes,
          s.created_at,
          to_timestamp(
            s.date || ' ' || coalesce(s.end_time, s.start_time),
            'DD/MM/YYYY HH24:MI'
          ) as sort_at
        from public.stoppages s
        where (v_name is null or s.operator = v_name)
          and (p_start_date is null or to_date(s.date, 'DD/MM/YYYY') >= to_date(p_start_date, 'YYYY-MM-DD'))
          and (p_end_date is null or to_date(s.date, 'DD/MM/YYYY') <= to_date(p_end_date, 'YYYY-MM-DD'))
          and (p_stoppage_code is null or s.stoppage_code = p_stoppage_code)
          and (
            v_search is null
            or s.operator ilike '%' || v_search || '%'
            or s.stoppage_name ilike '%' || v_search || '%'
            or coalesce(s.notes, '') ilike '%' || v_search || '%'
            or coalesce(s.resolution_notes, '') ilike '%' || v_search || '%'
          )
        order by sort_at desc
        limit v_limit
        offset v_offset
      ) y
    ), '[]'::jsonb),
    'activity_total', (
      select count(*)
      from public.activities a
      where (v_name is null or a.operator = v_name)
        and (p_start_date is null or to_date(a.date, 'DD/MM/YYYY') >= to_date(p_start_date, 'YYYY-MM-DD'))
        and (p_end_date is null or to_date(a.date, 'DD/MM/YYYY') <= to_date(p_end_date, 'YYYY-MM-DD'))
        and (p_activity_code is null or a.activity_code = p_activity_code)
        and (
          v_search is null
          or a.operator ilike '%' || v_search || '%'
          or a.activity_name ilike '%' || v_search || '%'
          or coalesce(a.local, '') ilike '%' || v_search || '%'
          or coalesce(a.list_id, '') ilike '%' || v_search || '%'
          or coalesce(a.notes, '') ilike '%' || v_search || '%'
        )
    ),
    'stoppage_total', (
      select count(*)
      from public.stoppages s
      where (v_name is null or s.operator = v_name)
        and (p_start_date is null or to_date(s.date, 'DD/MM/YYYY') >= to_date(p_start_date, 'YYYY-MM-DD'))
        and (p_end_date is null or to_date(s.date, 'DD/MM/YYYY') <= to_date(p_end_date, 'YYYY-MM-DD'))
        and (p_stoppage_code is null or s.stoppage_code = p_stoppage_code)
        and (
          v_search is null
          or s.operator ilike '%' || v_search || '%'
          or s.stoppage_name ilike '%' || v_search || '%'
          or coalesce(s.notes, '') ilike '%' || v_search || '%'
          or coalesce(s.resolution_notes, '') ilike '%' || v_search || '%'
        )
    ),
    'collaborators', case
      when v_role in ('administrador', 'lideranca') then coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'active', c.active) order by c.name)
        from public.collaborators c
        where c.active = true
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  );
end;
$$;

revoke all on function public.mobile_get_history(uuid, text, text, integer, integer, text, integer, integer) from public;
grant execute on function public.mobile_get_history(uuid, text, text, integer, integer, text, integer, integer) to authenticated;

create or replace function public.mobile_admin_update_history_activity(
  p_activity_id text,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity public.activities%rowtype;
  v_editor text;
  v_local text;
  v_list text;
  v_pallet text;
  v_fork text;
  v_notes text;
  v_produced integer;
  v_items integer;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('administrador', 'lideranca')
  ) then
    raise exception 'Correção de histórico permitida somente para Administrador ou Liderança.';
  end if;

  select * into v_activity
  from public.activities
  where id = p_activity_id
  for update;

  if not found then raise exception 'Atividade não encontrada.'; end if;

  v_local := case when p_patch ? 'local' then nullif(trim(coalesce(p_patch->>'local', '')), '') else v_activity.local end;
  v_list := case when p_patch ? 'list_id' then nullif(trim(coalesce(p_patch->>'list_id', '')), '') else v_activity.list_id end;
  v_pallet := case when p_patch ? 'pallet_jack_id' then nullif(trim(coalesce(p_patch->>'pallet_jack_id', '')), '') else v_activity.pallet_jack_id end;
  v_fork := case when p_patch ? 'forklift_id' then nullif(trim(coalesce(p_patch->>'forklift_id', '')), '') else v_activity.forklift_id end;
  v_notes := case when p_patch ? 'notes' then nullif(trim(coalesce(p_patch->>'notes', '')), '') else v_activity.notes end;
  v_produced := case when p_patch ? 'produced_quantity' then greatest(0, coalesce((p_patch->>'produced_quantity')::integer, 0)) else v_activity.produced_quantity end;
  v_items := case when p_patch ? 'items_quantity' then greatest(0, coalesce((p_patch->>'items_quantity')::integer, 0)) else v_activity.items_quantity end;

  if v_local is null or v_local = '' then raise exception 'Local é obrigatório.'; end if;
  if v_activity.activity_code in (1,2,3) and (coalesce(v_produced, 0) <= 0 or coalesce(v_items, 0) <= 0) then
    raise exception 'Quantidade de peças e itens deve ser maior que zero para esta atividade.';
  end if;
  if v_activity.activity_code = 1 and (v_list is null or v_list = '') then
    raise exception 'Lista é obrigatória para a atividade 1.';
  end if;

  update public.activities
  set
    local = v_local,
    list_id = coalesce(v_list, ''),
    pallet_jack_id = v_pallet,
    forklift_id = v_fork,
    produced_quantity = v_produced,
    items_quantity = v_items,
    notes = v_notes
  where id = p_activity_id
  returning * into v_activity;

  select name into v_editor from public.profiles where id = auth.uid();

  insert into public.production_logs (
    id, timestamp, type, description, operator, reference_id
  )
  values (
    gen_random_uuid()::text,
    clock_timestamp(),
    'ATIVIDADE_ATUALIZACAO',
    format('Correção de histórico feita por %s na atividade %s.', coalesce(v_editor, 'usuário'), p_activity_id),
    v_activity.operator,
    v_activity.id
  );

  return to_jsonb(v_activity);
end;
$$;

revoke all on function public.mobile_admin_update_history_activity(text, jsonb) from public;
grant execute on function public.mobile_admin_update_history_activity(text, jsonb) to authenticated;

create or replace function public.mobile_admin_update_history_stoppage(
  p_stoppage_id text,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stoppage public.stoppages%rowtype;
  v_editor text;
  v_notes text;
  v_resolution text;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('administrador', 'lideranca')
  ) then
    raise exception 'Correção de histórico permitida somente para Administrador ou Liderança.';
  end if;

  select * into v_stoppage
  from public.stoppages
  where id = p_stoppage_id
  for update;

  if not found then raise exception 'Parada não encontrada.'; end if;

  v_notes := case when p_patch ? 'notes' then nullif(trim(coalesce(p_patch->>'notes', '')), '') else v_stoppage.notes end;
  v_resolution := case when p_patch ? 'resolution_notes' then nullif(trim(coalesce(p_patch->>'resolution_notes', '')), '') else v_stoppage.resolution_notes end;

  update public.stoppages
  set
    notes = v_notes,
    resolution_notes = v_resolution
  where id = p_stoppage_id
  returning * into v_stoppage;

  select name into v_editor from public.profiles where id = auth.uid();

  insert into public.production_logs (
    id, timestamp, type, description, operator, reference_id
  )
  values (
    gen_random_uuid()::text,
    clock_timestamp(),
    'PARADA_ATUALIZACAO',
    format('Correção de histórico feita por %s na parada %s.', coalesce(v_editor, 'usuário'), p_stoppage_id),
    v_stoppage.operator,
    v_stoppage.id
  );

  return to_jsonb(v_stoppage);
end;
$$;

revoke all on function public.mobile_admin_update_history_stoppage(text, jsonb) from public;
grant execute on function public.mobile_admin_update_history_stoppage(text, jsonb) to authenticated;


create or replace function public.mobile_admin_get_dashboard_journey(
  p_start_date date,
  p_end_date date
)
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
    raise exception 'Indicadores de jornada permitidos somente para Administrador ou Liderança.';
  end if;

  return jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'collaborator_id', x.collaborator_id,
          'collaborator_name', x.collaborator_name,
          'shifts_count', x.shifts_count,
          'planned_minutes', x.planned_minutes,
          'worked_minutes', x.worked_minutes,
          'overtime_minutes', x.overtime_minutes
        )
        order by x.collaborator_name
      )
      from (
        select
          s.collaborator_id,
          c.name as collaborator_name,
          count(*)::integer as shifts_count,
          round(coalesce(sum(extract(epoch from (s.planned_end_at - s.planned_start_at))) / 60, 0))::integer as planned_minutes,
          round(coalesce(sum(
            extract(epoch from (
              coalesce(s.actual_end_at, clock_timestamp()) - s.actual_start_at
            ))
          ) / 60, 0))::integer as worked_minutes,
          round(coalesce(sum(
            greatest(
              0,
              coalesce(
                s.overtime_seconds,
                extract(epoch from (
                  coalesce(s.actual_end_at, clock_timestamp()) - s.planned_end_at
                ))
              )
            )
          ) / 60, 0))::integer as overtime_minutes
        from public.mobile_shifts s
        join public.collaborators c on c.id = s.collaborator_id
        where (s.planned_start_at at time zone 'America/Sao_Paulo')::date between p_start_date and p_end_date
        group by s.collaborator_id, c.name
      ) x
    ), '[]'::jsonb),
    'total_overtime_minutes', coalesce((
      select round(sum(
        greatest(
          0,
          coalesce(
            s.overtime_seconds,
            extract(epoch from (coalesce(s.actual_end_at, clock_timestamp()) - s.planned_end_at))
          )
        )
      ) / 60)::integer
      from public.mobile_shifts s
      where (s.planned_start_at at time zone 'America/Sao_Paulo')::date between p_start_date and p_end_date
    ), 0)
  );
end;
$$;

revoke all on function public.mobile_admin_get_dashboard_journey(date, date) from public;
grant execute on function public.mobile_admin_get_dashboard_journey(date, date) to authenticated;
