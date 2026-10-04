-- Mobile/Administrative phase: planning, operational history and management activity mode.
-- Execute after the existing Mobile migrations (001..006) already applied in the database.

do $$
begin
  if to_regclass('public.mobile_shift_plans') is null
     or to_regclass('public.mobile_operator_bindings') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.collaborators') is null
     or to_regclass('public.activity_types') is null
     or to_regclass('public.activities') is null then
    raise exception 'Pré-requis Mobile ausente. Aplique primeiro as migrations/tabelas Mobile existentes.';
  end if;
end;
$$;


create or replace function public.mobile_require_management_role()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select role into v_role
  from public.profiles
  where id = auth.uid();

  if v_role not in ('administrador', 'lideranca') then
    raise exception 'Operação permitida somente para Administrador ou Liderança.';
  end if;
end;
$$;

revoke all on function public.mobile_require_management_role() from public;
grant execute on function public.mobile_require_management_role() to authenticated;

-- ---------------------------------------------------------------------------
-- Planejamento
-- ---------------------------------------------------------------------------

create or replace function public.mobile_admin_list_shift_plans(
  p_start_date date default null,
  p_end_date date default null,
  p_collaborator_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.mobile_require_management_role();

  select jsonb_build_object(
    'plans', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.planned_start_at)
      from public.mobile_shift_plans p
      where p.active = true
        and (p_start_date is null or p.planned_end_at >= (p_start_date::timestamp at time zone 'America/Sao_Paulo'))
        and (p_end_date is null or p.planned_start_at < ((p_end_date + 1)::timestamp at time zone 'America/Sao_Paulo'))
        and (p_collaborator_id is null or p.collaborator_id = p_collaborator_id)
      ), '[]'::jsonb),
    'collaborators', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.name)
      from public.collaborators c
      where c.active = true
      ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.mobile_admin_list_shift_plans(date,date,uuid) from public;
grant execute on function public.mobile_admin_list_shift_plans(date,date,uuid) to authenticated;

create or replace function public.mobile_admin_save_shift_plan(
  p_id uuid default null,
  p_collaborator_id uuid default null,
  p_planned_start_at timestamptz default null,
  p_planned_end_at timestamptz default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.mobile_require_management_role();

  if p_collaborator_id is null or p_planned_start_at is null or p_planned_end_at is null then
    raise exception 'Colaborador, início e fim são obrigatórios.';
  end if;

  if p_planned_end_at <= p_planned_start_at then
    raise exception 'O fim da escala deve ser posterior ao início.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mobile_shift_plan:' || p_collaborator_id::text, 0));

  if not exists (
    select 1 from public.collaborators
    where id = p_collaborator_id and active = true
  ) then
    raise exception 'Colaborador ativo não encontrado.';
  end if;

  if exists (
    select 1
    from public.mobile_shift_plans p
    where p.collaborator_id = p_collaborator_id
      and p.active = true
      and (p_id is null or p.id <> p_id)
      and p.planned_start_at < p_planned_end_at
      and p.planned_end_at > p_planned_start_at
  ) then
    raise exception 'Existe outra escala ativa do colaborador sobrepondo este período.';
  end if;

  if p_id is null then
    insert into public.mobile_shift_plans (
      collaborator_id, planned_start_at, planned_end_at, active, notes, created_by
    )
    values (
      p_collaborator_id, p_planned_start_at, p_planned_end_at, true, nullif(trim(p_notes), ''), auth.uid()
    )
    returning id into v_id;
  else
    update public.mobile_shift_plans
       set collaborator_id = p_collaborator_id,
           planned_start_at = p_planned_start_at,
           planned_end_at = p_planned_end_at,
           active = true,
           notes = nullif(trim(p_notes), '')
     where id = p_id
     returning id into v_id;

    if v_id is null then
      raise exception 'Escala não encontrada.';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.mobile_admin_save_shift_plan(uuid,uuid,timestamptz,timestamptz,text) from public;
grant execute on function public.mobile_admin_save_shift_plan(uuid,uuid,timestamptz,timestamptz,text) to authenticated;

create or replace function public.mobile_admin_deactivate_shift_plan(
  p_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mobile_require_management_role();

  update public.mobile_shift_plans
     set active = false
   where id = p_id;

  if not found then
    raise exception 'Escala não encontrada.';
  end if;

  return true;
end;
$$;

revoke all on function public.mobile_admin_deactivate_shift_plan(uuid) from public;
grant execute on function public.mobile_admin_deactivate_shift_plan(uuid) to authenticated;

create or replace function public.mobile_admin_import_shift_plans(
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_collaborator_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_notes text;
  v_id uuid;
  v_count integer := 0;
begin
  perform public.mobile_require_management_role();

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'O lote de importação deve ser uma lista.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mobile_shift_plan:import', 0));

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_collaborator_id := nullif(v_row->>'collaborator_id', '')::uuid;
    v_start := nullif(v_row->>'planned_start_at', '')::timestamptz;
    v_end := nullif(v_row->>'planned_end_at', '')::timestamptz;
    v_notes := nullif(trim(coalesce(v_row->>'notes', '')), '');

    if v_collaborator_id is null or v_start is null or v_end is null then
      raise exception 'Importação contém colaborador, início ou fim inválido.';
    end if;

    if v_end <= v_start then
      raise exception 'Importação contém escala com fim anterior ou igual ao início.';
    end if;

    if not exists (
      select 1 from public.collaborators
      where id = v_collaborator_id and active = true
    ) then
      raise exception 'Importação contém colaborador ativo inexistente.';
    end if;

    if exists (
      select 1
      from public.mobile_shift_plans p
      where p.collaborator_id = v_collaborator_id
        and p.active = true
        and p.planned_start_at < v_end
        and p.planned_end_at > v_start
    ) then
      raise exception 'Importação contém uma escala que sobrepõe uma escala ativa existente.';
    end if;

    insert into public.mobile_shift_plans (
      collaborator_id, planned_start_at, planned_end_at, active, notes, created_by
    )
    values (
      v_collaborator_id, v_start, v_end, true, v_notes, auth.uid()
    )
    returning id into v_id;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('inserted', v_count);
end;
$$;

revoke all on function public.mobile_admin_import_shift_plans(jsonb) from public;
grant execute on function public.mobile_admin_import_shift_plans(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Histórico Mobile
-- ---------------------------------------------------------------------------

create or replace function public.mobile_get_history(
  p_collaborator_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_name text;
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

  select c.name into v_name
  from public.collaborators c
  where c.id = p_collaborator_id;

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
          null::text as event_kind,
          to_timestamp(
            a.date || ' ' || coalesce(a.end_time, a.start_time),
            'DD/MM/YYYY HH24:MI'
          ) as sort_at
        from public.activities a
        where (p_collaborator_id is null or a.operator = v_name)
        order by sort_at desc
        limit greatest(1, least(coalesce(p_limit, 100), 200))
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
        where (p_collaborator_id is null or s.operator = v_name)
        order by sort_at desc
        limit greatest(1, least(coalesce(p_limit, 100), 200))
      ) y
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.mobile_get_history(uuid,integer) from public;
grant execute on function public.mobile_get_history(uuid,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Modo de operação Administrativa (Liderança/Admin)
-- ---------------------------------------------------------------------------

create table if not exists public.mobile_management_activity_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  activity_type_id uuid not null references public.activity_types(id),
  activity_code integer not null,
  activity_name text not null,
  status text not null check (status in ('EM_ANDAMENTO','FINALIZACAO_PENDENTE','CONCLUIDA','CANCELADA')),
  started_at timestamptz not null,
  finalization_started_at timestamptz,
  finished_at timestamptz,
  draft jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  official_activity_id text references public.activities(id)
);

create unique index if not exists uq_mobile_management_open
on public.mobile_management_activity_sessions(profile_id)
where status in ('EM_ANDAMENTO','FINALIZACAO_PENDENTE');

alter table public.mobile_management_activity_sessions enable row level security;

drop policy if exists mobile_management_self_select on public.mobile_management_activity_sessions;
create policy mobile_management_self_select
on public.mobile_management_activity_sessions
for select to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('administrador','lideranca')
  )
);

create or replace function public.mobile_admin_get_open_activity()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_session jsonb;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('administrador','lideranca') then
    raise exception 'Operação permitida somente para Administrador ou Liderança.';
  end if;

  select to_jsonb(s) into v_session
  from public.mobile_management_activity_sessions s
  where s.profile_id = auth.uid()
    and s.status in ('EM_ANDAMENTO','FINALIZACAO_PENDENTE')
  limit 1;

  return v_session;
end;
$$;

revoke all on function public.mobile_admin_get_open_activity() from public;
grant execute on function public.mobile_admin_get_open_activity() to authenticated;

create or replace function public.mobile_admin_start_activity(
  p_activity_type_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_type record;
  v_id uuid;
begin
  perform public.mobile_require_management_role();

  select id, code, label into v_type
  from public.activity_types
  where id = p_activity_type_id and active = true;

  if not found then raise exception 'Tipo de atividade não encontrado.'; end if;

  if exists (
    select 1 from public.mobile_management_activity_sessions
    where profile_id = auth.uid()
      and status in ('EM_ANDAMENTO','FINALIZACAO_PENDENTE')
  ) then
    raise exception 'Já existe uma atividade administrativa aberta.';
  end if;

  insert into public.mobile_management_activity_sessions (
    profile_id, activity_type_id, activity_code, activity_name, status, started_at, draft
  )
  values (
    auth.uid(), v_type.id, v_type.code, v_type.label, 'EM_ANDAMENTO',
    clock_timestamp(), '{}'::jsonb
  )
  returning id into v_id;

  return (
    select to_jsonb(s)
    from public.mobile_management_activity_sessions s
    where s.id = v_id
  );
end;
$$;

revoke all on function public.mobile_admin_start_activity(uuid) from public;
grant execute on function public.mobile_admin_start_activity(uuid) to authenticated;

create or replace function public.mobile_admin_update_draft(
  p_session_id uuid,
  p_payload jsonb,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer;
begin
  perform public.mobile_require_management_role();

  update public.mobile_management_activity_sessions
     set draft = coalesce(p_payload, '{}'::jsonb),
         version = version + 1
   where id = p_session_id
     and profile_id = auth.uid()
     and status in ('EM_ANDAMENTO','FINALIZACAO_PENDENTE')
     and version = p_expected_version
  returning version into v_version;

  if v_version is null then
    raise exception 'Rascunho desatualizado ou sessão administrativa inválida.';
  end if;

  return jsonb_build_object('version', v_version);
end;
$$;

revoke all on function public.mobile_admin_update_draft(uuid,jsonb,integer) from public;
grant execute on function public.mobile_admin_update_draft(uuid,jsonb,integer) to authenticated;

create or replace function public.mobile_admin_begin_finalization(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mobile_require_management_role();

  update public.mobile_management_activity_sessions
     set status = 'FINALIZACAO_PENDENTE',
         finalization_started_at = clock_timestamp()
   where id = p_session_id
     and profile_id = auth.uid()
     and status = 'EM_ANDAMENTO';

  if not found then raise exception 'Atividade administrativa não está aberta.'; end if;

  return public.mobile_admin_get_open_activity();
end;
$$;

revoke all on function public.mobile_admin_begin_finalization(uuid) from public;
grant execute on function public.mobile_admin_begin_finalization(uuid) to authenticated;

create or replace function public.mobile_admin_cancel_finalization(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mobile_require_management_role();

  update public.mobile_management_activity_sessions
     set status = 'EM_ANDAMENTO',
         finalization_started_at = null
   where id = p_session_id
     and profile_id = auth.uid()
     and status = 'FINALIZACAO_PENDENTE';

  if not found then raise exception 'Finalização administrativa não está pendente.'; end if;

  return public.mobile_admin_get_open_activity();
end;
$$;

revoke all on function public.mobile_admin_cancel_finalization(uuid) from public;
grant execute on function public.mobile_admin_cancel_finalization(uuid) to authenticated;

create or replace function public.mobile_admin_confirm_activity(
  p_session_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_profile record;
  v_payload jsonb;
  v_local text;
  v_list text;
  v_notes text;
  v_produced integer;
  v_items integer;
  v_pallet text;
  v_fork text;
  v_high boolean;
  v_now timestamptz;
  v_local_now timestamp;
  v_id text;
  v_duration_seconds integer;
begin
  perform public.mobile_require_management_role();

  select s.*, p.name as profile_name
    into v_session
  from public.mobile_management_activity_sessions s
  join public.profiles p on p.id = s.profile_id
   where s.id = p_session_id
     and s.profile_id = auth.uid()
     and s.status = 'FINALIZACAO_PENDENTE';

  if not found then raise exception 'Atividade administrativa não está pendente de finalização.'; end if;
  if v_session.version <> p_expected_version then raise exception 'Rascunho desatualizado.'; end if;

  v_payload := coalesce(v_session.draft, '{}'::jsonb);
  v_local := trim(coalesce(v_payload->>'local',''));
  v_list := trim(coalesce(v_payload->>'listId',''));
  v_notes := nullif(trim(coalesce(v_payload->>'notes','')), '');
  v_produced := nullif(v_payload->>'producedQuantity','')::integer;
  v_items := nullif(v_payload->>'itemsQuantity','')::integer;
  v_pallet := nullif(trim(coalesce(v_payload->>'palletJackId','')), '');
  v_fork := nullif(trim(coalesce(v_payload->>'forkliftId','')), '');
  v_high := coalesce((v_payload->>'highQuantityConfirmed')::boolean, false);

  if v_local = '' then raise exception 'Informe o local.'; end if;
  if v_session.activity_code in (1,2,3) and (coalesce(v_produced,0) <= 0 or coalesce(v_items,0) <= 0) then
    raise exception 'Quantidade de peças e itens deve ser maior que zero para esta atividade.';
  end if;
  if v_session.activity_code = 1 and v_list = '' then raise exception 'Informe a lista.'; end if;
  if coalesce(v_produced,0) > 10000 and not v_high then raise exception 'Confirme a quantidade acima de 10.000 peças.'; end if;

  v_now := clock_timestamp();
  v_local_now := v_now at time zone 'America/Sao_Paulo';
  v_duration_seconds := greatest(0, extract(epoch from (v_now - v_session.started_at))::integer);

  v_id := to_char(v_local_now, 'YYYYMMDD') || '_ADM_' || upper(regexp_replace(v_session.profile_name, '\s+', '-', 'g')) || '_' || extract(epoch from v_now)::bigint;

  insert into public.activities (
    id, date, operator, activity_code, activity_name, local, list_id,
    start_time, end_time, duration, duration_hours,
    pallet_jack_id, forklift_id, produced_quantity, items_quantity,
    status, notes, creator, created_at
  )
  values (
    v_id,
    to_char(v_local_now, 'DD/MM/YYYY'),
    v_session.profile_name,
    v_session.activity_code,
    v_session.activity_name,
    v_local,
    v_list,
    to_char(v_session.started_at at time zone 'America/Sao_Paulo', 'HH24:MI'),
    to_char(v_now at time zone 'America/Sao_Paulo', 'HH24:MI'),
    to_char(make_interval(secs => v_duration_seconds), 'HH24:MI'),
    round(v_duration_seconds / 3600.0, 4),
    v_pallet,
    v_fork,
    coalesce(v_produced,0),
    coalesce(v_items,0),
    'CONCLUIDO',
    v_notes,
    v_session.profile_name,
    to_char(v_now at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
  )
  returning id into v_id;

  update public.mobile_management_activity_sessions
     set status = 'CONCLUIDA',
         finished_at = v_now,
         official_activity_id = v_id,
         version = version + 1
   where id = p_session_id;

  return jsonb_build_object('id', v_id, 'status', 'CONCLUIDA');
end;
$$;

revoke all on function public.mobile_admin_confirm_activity(uuid,integer) from public;
grant execute on function public.mobile_admin_confirm_activity(uuid,integer) to authenticated;

create or replace function public.mobile_admin_cancel_activity(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mobile_require_management_role();

  update public.mobile_management_activity_sessions
     set status = 'CANCELADA',
         finished_at = clock_timestamp(),
         version = version + 1
   where id = p_session_id
     and profile_id = auth.uid()
     and status in ('EM_ANDAMENTO','FINALIZACAO_PENDENTE');

  if not found then raise exception 'Atividade administrativa não encontrada.'; end if;

  return jsonb_build_object('status','CANCELADA');
end;
$$;

revoke all on function public.mobile_admin_cancel_activity(uuid) from public;
grant execute on function public.mobile_admin_cancel_activity(uuid) to authenticated;
