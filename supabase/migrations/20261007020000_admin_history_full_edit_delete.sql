-- Correções administrativas completas de lançamentos históricos.
--
-- Objetivo:
-- - permitir que Administrador/Liderança corrijam todos os campos operacionais
--   de uma atividade/parada histórica;
-- - recalcular duração a partir dos horários;
-- - bloquear durações superiores a 12 horas sem impedir viradas de turno;
-- - permitir exclusão administrativa de lançamentos concluídos/resolvidos;
-- - manter auditoria em production_logs.
--
-- Não altera nem remove histórico de usuários, Mobile ou turnos.

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
  v_operator text;
  v_date text;
  v_start text;
  v_end text;
  v_activity_code integer;
  v_activity_name text;
  v_produced integer;
  v_items integer;
  v_start_minutes integer;
  v_end_minutes integer;
  v_duration_minutes integer;
  v_duration text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and deleted_at is null
      and role in ('administrador', 'lideranca')
  ) then
    raise exception 'Correção de histórico permitida somente para Administrador ou Liderança.';
  end if;

  select *
  into v_activity
  from public.activities
  where id = p_activity_id
  for update;

  if not found then
    raise exception 'Atividade não encontrada.';
  end if;

  v_date := case
    when p_patch ? 'date' then nullif(trim(coalesce(p_patch->>'date', '')), '')
    else v_activity.date
  end;

  v_operator := case
    when p_patch ? 'operator' then nullif(trim(coalesce(p_patch->>'operator', '')), '')
    else v_activity.operator
  end;

  v_activity_code := case
    when p_patch ? 'activity_code'
      then nullif(trim(coalesce(p_patch->>'activity_code', '')), '')::integer
    else v_activity.activity_code
  end;

  v_local := case
    when p_patch ? 'local' then nullif(trim(coalesce(p_patch->>'local', '')), '')
    else v_activity.local
  end;

  v_list := case
    when p_patch ? 'list_id' then nullif(trim(coalesce(p_patch->>'list_id', '')), '')
    else v_activity.list_id
  end;

  v_start := case
    when p_patch ? 'start_time' then nullif(trim(coalesce(p_patch->>'start_time', '')), '')
    else v_activity.start_time
  end;

  v_end := case
    when p_patch ? 'end_time' then nullif(trim(coalesce(p_patch->>'end_time', '')), '')
    else v_activity.end_time
  end;

  v_pallet := case
    when p_patch ? 'pallet_jack_id' then nullif(trim(coalesce(p_patch->>'pallet_jack_id', '')), '')
    else v_activity.pallet_jack_id
  end;

  v_fork := case
    when p_patch ? 'forklift_id' then nullif(trim(coalesce(p_patch->>'forklift_id', '')), '')
    else v_activity.forklift_id
  end;

  v_notes := case
    when p_patch ? 'notes' then nullif(trim(coalesce(p_patch->>'notes', '')), '')
    else v_activity.notes
  end;

  v_produced := case
    when p_patch ? 'produced_quantity'
      then coalesce((p_patch->>'produced_quantity')::integer, 0)
    else coalesce(v_activity.produced_quantity, 0)
  end;

  v_items := case
    when p_patch ? 'items_quantity'
      then coalesce((p_patch->>'items_quantity')::integer, 0)
    else coalesce(v_activity.items_quantity, 0)
  end;

  if v_date is null or v_date !~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' then
    raise exception 'Data inválida. Use o formato DD/MM/AAAA.';
  end if;

  begin
    perform to_date(v_date, 'DD/MM/YYYY');
  exception when others then
    raise exception 'Data inválida.';
  end;

  if v_operator is null then
    raise exception 'Colaborador é obrigatório.';
  end if;

  if v_local is null then
    raise exception 'Local é obrigatório.';
  end if;

  if v_start is null or v_end is null
     or v_start !~ '^[0-9]{2}:[0-9]{2}$'
     or v_end !~ '^[0-9]{2}:[0-9]{2}$' then
    raise exception 'Horários inválidos. Use HH:MM.';
  end if;

  v_start_minutes :=
    split_part(v_start, ':', 1)::integer * 60
    + split_part(v_start, ':', 2)::integer;

  v_end_minutes :=
    split_part(v_end, ':', 1)::integer * 60
    + split_part(v_end, ':', 2)::integer;

  if v_start_minutes > 1439 or v_end_minutes > 1439 then
    raise exception 'Horários inválidos. Use HH:MM.';
  end if;

  if v_end_minutes < v_start_minutes then
    v_end_minutes := v_end_minutes + 1440;
  end if;

  v_duration_minutes := v_end_minutes - v_start_minutes;

  if v_duration_minutes > 720 then
    raise exception 'Lançamento bloqueado: a duração não pode ser superior a 12 horas. Viradas de turno após 00:00 continuam permitidas quando a duração real permanece dentro de 12 horas.';
  end if;

  if v_activity_code is null then
    raise exception 'Código da atividade é obrigatório.';
  end if;

  select at.label
  into v_activity_name
  from public.activity_types at
  where at.code = v_activity_code
    and at.active = true;

  if v_activity_name is null then
    raise exception 'Atividade inválida ou inativa.';
  end if;

  if v_produced < 0 or v_items < 0 then
    raise exception 'Quantidades não podem ser negativas.';
  end if;

  if v_activity_code in (1, 2, 3)
     and (v_produced <= 0 or v_items <= 0) then
    raise exception 'Quantidade de peças e itens deve ser maior que zero para esta atividade.';
  end if;

  if v_activity_code = 1
     and (v_list is null or upper(v_list) in ('N/A', '-')) then
    raise exception 'Lista é obrigatória para a atividade 1.';
  end if;

  v_duration :=
    lpad((v_duration_minutes / 60)::text, 2, '0')
    || ':'
    || lpad((v_duration_minutes % 60)::text, 2, '0');

  update public.activities
  set
    date = v_date,
    operator = v_operator,
    activity_code = v_activity_code,
    activity_name = v_activity_name,
    local = v_local,
    list_id = coalesce(v_list, ''),
    start_time = v_start,
    end_time = v_end,
    duration = v_duration,
    duration_hours = v_duration_minutes / 60.0,
    pallet_jack_id = v_pallet,
    forklift_id = v_fork,
    produced_quantity = v_produced,
    items_quantity = v_items,
    notes = v_notes
  where id = p_activity_id
  returning * into v_activity;

  select name
  into v_editor
  from public.profiles
  where id = auth.uid();

  insert into public.production_logs (
    id, timestamp, type, description, operator, reference_id
  )
  values (
    gen_random_uuid()::text,
    clock_timestamp(),
    'ATIVIDADE_ATUALIZACAO',
    format(
      'Correção integral de histórico feita por %s na atividade %s. Data=%s, operador=%s, código=%s, início=%s, fim=%s, duração=%s.',
      coalesce(v_editor, 'usuário'),
      p_activity_id,
      v_date,
      v_operator,
      v_activity_code,
      v_start,
      v_end,
      v_duration
    ),
    v_operator,
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
  v_date text;
  v_operator text;
  v_code integer;
  v_name text;
  v_start text;
  v_end text;
  v_notes text;
  v_resolution text;
  v_start_minutes integer;
  v_end_minutes integer;
  v_duration_minutes integer;
  v_duration text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and deleted_at is null
      and role in ('administrador', 'lideranca')
  ) then
    raise exception 'Correção de histórico permitida somente para Administrador ou Liderança.';
  end if;

  select *
  into v_stoppage
  from public.stoppages
  where id = p_stoppage_id
  for update;

  if not found then
    raise exception 'Parada não encontrada.';
  end if;

  v_date := case
    when p_patch ? 'date' then nullif(trim(coalesce(p_patch->>'date', '')), '')
    else v_stoppage.date
  end;

  v_operator := case
    when p_patch ? 'operator' then nullif(trim(coalesce(p_patch->>'operator', '')), '')
    else v_stoppage.operator
  end;

  v_code := case
    when p_patch ? 'stoppage_code'
      then nullif(trim(coalesce(p_patch->>'stoppage_code', '')), '')::integer
    else v_stoppage.stoppage_code
  end;

  v_start := case
    when p_patch ? 'start_time' then nullif(trim(coalesce(p_patch->>'start_time', '')), '')
    else v_stoppage.start_time
  end;

  v_end := case
    when p_patch ? 'end_time' then nullif(trim(coalesce(p_patch->>'end_time', '')), '')
    else v_stoppage.end_time
  end;

  v_notes := case
    when p_patch ? 'notes' then nullif(trim(coalesce(p_patch->>'notes', '')), '')
    else v_stoppage.notes
  end;

  v_resolution := case
    when p_patch ? 'resolution_notes' then nullif(trim(coalesce(p_patch->>'resolution_notes', '')), '')
    else v_stoppage.resolution_notes
  end;

  if v_date is null or v_date !~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' then
    raise exception 'Data inválida. Use o formato DD/MM/AAAA.';
  end if;

  begin
    perform to_date(v_date, 'DD/MM/YYYY');
  exception when others then
    raise exception 'Data inválida.';
  end;

  if v_operator is null then
    raise exception 'Colaborador é obrigatório.';
  end if;

  if v_code is null then
    raise exception 'Código da parada é obrigatório.';
  end if;

  select st.name
  into v_name
  from public.stoppage_types st
  where st.code = v_code
    and st.active = true;

  if v_name is null then
    raise exception 'Parada inválida ou inativa.';
  end if;

  if v_start is null or v_end is null
     or v_start !~ '^[0-9]{2}:[0-9]{2}$'
     or v_end !~ '^[0-9]{2}:[0-9]{2}$' then
    raise exception 'Horários inválidos. Use HH:MM.';
  end if;

  v_start_minutes :=
    split_part(v_start, ':', 1)::integer * 60
    + split_part(v_start, ':', 2)::integer;

  v_end_minutes :=
    split_part(v_end, ':', 1)::integer * 60
    + split_part(v_end, ':', 2)::integer;

  if v_start_minutes > 1439 or v_end_minutes > 1439 then
    raise exception 'Horários inválidos. Use HH:MM.';
  end if;

  if v_end_minutes < v_start_minutes then
    v_end_minutes := v_end_minutes + 1440;
  end if;

  v_duration_minutes := v_end_minutes - v_start_minutes;

  if v_duration_minutes > 720 then
    raise exception 'Lançamento bloqueado: a duração não pode ser superior a 12 horas.';
  end if;

  v_duration :=
    lpad((v_duration_minutes / 60)::text, 2, '0')
    || ':'
    || lpad((v_duration_minutes % 60)::text, 2, '0');

  update public.stoppages
  set
    date = v_date,
    operator = v_operator,
    stoppage_code = v_code,
    stoppage_name = v_name,
    start_time = v_start,
    end_time = v_end,
    duration = v_duration,
    duration_minutes = v_duration_minutes,
    notes = v_notes,
    resolution_notes = v_resolution
  where id = p_stoppage_id
  returning * into v_stoppage;

  select name
  into v_editor
  from public.profiles
  where id = auth.uid();

  insert into public.production_logs (
    id, timestamp, type, description, operator, reference_id
  )
  values (
    gen_random_uuid()::text,
    clock_timestamp(),
    'PARADA_ATUALIZACAO',
    format(
      'Correção integral de histórico feita por %s na parada %s. Data=%s, operador=%s, código=%s, início=%s, fim=%s, duração=%s.',
      coalesce(v_editor, 'usuário'),
      p_stoppage_id,
      v_date,
      v_operator,
      v_code,
      v_start,
      v_end,
      v_duration
    ),
    v_operator,
    v_stoppage.id
  );

  return to_jsonb(v_stoppage);
end;
$$;

revoke all on function public.mobile_admin_update_history_stoppage(text, jsonb) from public;
grant execute on function public.mobile_admin_update_history_stoppage(text, jsonb) to authenticated;


create or replace function public.mobile_admin_delete_history_activity(
  p_activity_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity public.activities%rowtype;
  v_editor text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and deleted_at is null
      and role in ('administrador', 'lideranca')
  ) then
    raise exception 'Exclusão de histórico permitida somente para Administrador ou Liderança.';
  end if;

  select *
  into v_activity
  from public.activities
  where id = p_activity_id
  for update;

  if not found then
    raise exception 'Atividade não encontrada.';
  end if;

  if v_activity.status <> 'CONCLUIDO' then
    raise exception 'Somente atividades concluídas podem ser excluídas pelo histórico.';
  end if;

  if exists (
    select 1
    from public.mobile_activity_sessions mas
    where mas.official_activity_id = p_activity_id
  ) then
    raise exception 'Esta atividade está vinculada ao histórico Mobile e não pode ser excluída por este fluxo.';
  end if;

  select name
  into v_editor
  from public.profiles
  where id = auth.uid();

  insert into public.production_logs (
    id, timestamp, type, description, operator, reference_id
  )
  values (
    gen_random_uuid()::text,
    clock_timestamp(),
    'ATIVIDADE_ATUALIZACAO',
    format(
      'EXCLUSÃO DE LANÇAMENTO: atividade %s removida por %s. Operador=%s, data=%s, código=%s, início=%s, fim=%s, duração=%s, peças=%s, itens=%s.',
      v_activity.id,
      coalesce(v_editor, 'usuário'),
      v_activity.operator,
      v_activity.date,
      v_activity.activity_code,
      v_activity.start_time,
      v_activity.end_time,
      v_activity.duration,
      v_activity.produced_quantity,
      v_activity.items_quantity
    ),
    v_activity.operator,
    v_activity.id
  );

  delete from public.activities
  where id = p_activity_id;

  return true;
end;
$$;

revoke all on function public.mobile_admin_delete_history_activity(text) from public;
grant execute on function public.mobile_admin_delete_history_activity(text) to authenticated;


create or replace function public.mobile_admin_delete_history_stoppage(
  p_stoppage_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stoppage public.stoppages%rowtype;
  v_editor text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and deleted_at is null
      and role in ('administrador', 'lideranca')
  ) then
    raise exception 'Exclusão de histórico permitida somente para Administrador ou Liderança.';
  end if;

  select *
  into v_stoppage
  from public.stoppages
  where id = p_stoppage_id
  for update;

  if not found then
    raise exception 'Parada não encontrada.';
  end if;

  if v_stoppage.status = 'ATIVA' then
    raise exception 'Parada ativa não pode ser excluída pelo histórico.';
  end if;

  select name
  into v_editor
  from public.profiles
  where id = auth.uid();

  insert into public.production_logs (
    id, timestamp, type, description, operator, reference_id
  )
  values (
    gen_random_uuid()::text,
    clock_timestamp(),
    'PARADA_ATUALIZACAO',
    format(
      'EXCLUSÃO DE LANÇAMENTO: parada %s removida por %s. Operador=%s, data=%s, código=%s, início=%s, fim=%s, duração=%s.',
      v_stoppage.id,
      coalesce(v_editor, 'usuário'),
      v_stoppage.operator,
      v_stoppage.date,
      v_stoppage.stoppage_code,
      v_stoppage.start_time,
      v_stoppage.end_time,
      v_stoppage.duration
    ),
    v_stoppage.operator,
    v_stoppage.id
  );

  delete from public.stoppages
  where id = p_stoppage_id;

  return true;
end;
$$;

revoke all on function public.mobile_admin_delete_history_stoppage(text) from public;
grant execute on function public.mobile_admin_delete_history_stoppage(text) to authenticated;
