import { supabase } from './supabase';

export type MobileContext =
  | 'NAO_ALOCADO'
  | 'ATIVIDADE'
  | 'PARADA'
  | 'TRANSICAO'
  | 'INTERVALO'
  | 'AUSENCIA';

export interface MobileCollaborator {
  collaborator_id: string;
  collaborator_name: string;
}

export interface MobileShift {
  id: string;
  collaborator_id: string;
  planned_start_at: string;
  planned_end_at: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  status: string;
  current_context: MobileContext;
  previous_context: Exclude<MobileContext, 'PARADA' | 'INTERVALO' | 'AUSENCIA'> | null;
  overtime_seconds?: number | null;
  version: number;
}

export interface MobileActivitySession {
  id: string;
  shift_id: string;
  activity_type_id: string;
  activity_code: number;
  activity_name: string;
  status: 'EM_ANDAMENTO' | 'FINALIZACAO_PENDENTE' | 'CONCLUIDA' | 'CANCELADA';
  started_at: string;
  finalization_started_at: string | null;
  finished_at: string | null;
  current_context: MobileContext;
  active_stoppage_type_id: string | null;
  active_stoppage_started_at: string | null;
  version: number;
  official_activity_id: string | null;
}

export interface MobileDraft {
  payload: {
    local: string;
    listId: string;
    producedQuantity: number | string;
    itemsQuantity: number | string;
    palletJackId: string;
    forkliftId: string;
    notes: string;
    highQuantityConfirmed: boolean;
  };
  version: number;
}

function ensureClient() {
  if (!supabase) throw new Error('Supabase não está configurado.');
  return supabase;
}

function unwrap<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

export async function mobileGetServerTime(): Promise<string> {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_get_server_time');
  if (error) throw error;

  const value = typeof data === 'string'
    ? data
    : (data as { server_now?: string } | null)?.server_now;

  if (!value) throw new Error('O horário oficial do servidor não foi retornado.');
  return value;
}

export async function mobileGetBoundCollaborator(): Promise<MobileCollaborator | null> {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_get_bound_collaborator');
  if (error) throw error;

  const collaboratorId = typeof data === 'string' ? data : null;
  if (!collaboratorId) return null;

  return {
    collaborator_id: collaboratorId,
    collaborator_name: ''
  };
}

export async function mobileGetShiftPlans(collaboratorId: string) {
  const client = ensureClient();
  const { data, error } = await client
    .from('mobile_shift_plans')
    .select('id,collaborator_id,planned_start_at,planned_end_at,active,notes')
    .eq('collaborator_id', collaboratorId)
    .eq('active', true)
    .order('planned_start_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function mobileGetOpenShift(collaboratorId: string): Promise<MobileShift | null> {
  const client = ensureClient();
  const { data, error } = await client
    .from('mobile_shifts')
    .select('*')
    .eq('collaborator_id', collaboratorId)
    .eq('status', 'EM_ANDAMENTO')
    .maybeSingle();

  if (error) throw error;
  return data as MobileShift | null;
}

export async function mobileGetActivitySession(shiftId: string): Promise<MobileActivitySession | null> {
  const client = ensureClient();
  const { data, error } = await client
    .from('mobile_activity_sessions')
    .select('*')
    .eq('shift_id', shiftId)
    .in('status', ['EM_ANDAMENTO', 'FINALIZACAO_PENDENTE'])
    .maybeSingle();

  if (error) throw error;
  return data as MobileActivitySession | null;
}

export async function mobileGetDraft(sessionId: string): Promise<MobileDraft | null> {
  const client = ensureClient();
  const { data, error } = await client
    .from('mobile_activity_drafts')
    .select('payload,version')
    .eq('activity_session_id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return data as MobileDraft | null;
}

export async function mobileGetActivityTypes() {
  const client = ensureClient();
  const { data, error } = await client
    .from('activity_types')
    .select('id,code,label')
    .eq('active', true)
    .order('code');

  if (error) throw error;
  return data ?? [];
}

export async function mobileGetStoppageTypes() {
  const client = ensureClient();
  const { data, error } = await client
    .from('stoppage_types')
    .select('id,code,name')
    .eq('active', true)
    .order('code');

  if (error) throw error;
  return data ?? [];
}

export async function mobileStartShift(planId: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_start_shift', { p_shift_plan_id: planId });
  if (error) throw error;
  return unwrap(data);
}

export async function mobileStartActivity(
  shiftId: string,
  activityTypeId: string,
  local: string,
  listId: string
) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_start_activity', {
    p_shift_id: shiftId,
    p_activity_type_id: activityTypeId,
    p_local: local,
    p_list_id: listId
  });
  if (error) throw error;
  return unwrap(data);
}

export async function mobileCancelActivity(sessionId: string, reason: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_cancel_activity', {
    p_activity_session_id: sessionId,
    p_reason: reason
  });
  if (error) throw error;
  return unwrap(data);
}

export async function mobileStartStoppage(
  sessionId: string,
  stoppageTypeId: string,
  notes: string
) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_start_stoppage', {
    p_activity_session_id: sessionId,
    p_stoppage_type_id: stoppageTypeId,
    p_notes: notes
  });
  if (error) throw error;
  return unwrap(data);
}

export async function mobileResolveStoppage(sessionId: string, resolutionNotes: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_resolve_stoppage', {
    p_activity_session_id: sessionId,
    p_resolution_notes: resolutionNotes
  });
  if (error) throw error;
  return unwrap(data);
}

export async function mobileStartInterval(shiftId: string, reason: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_start_interval', {
    p_shift_id: shiftId,
    p_reason: reason
  });
  if (error) throw error;
  return unwrap(data);
}

export async function mobileEndInterval(shiftId: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_end_interval', {
    p_shift_id: shiftId
  });
  if (error) throw error;
  return unwrap(data);
}

export async function mobileStartAbsence(shiftId: string, reason: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_start_absence', {
    p_shift_id: shiftId,
    p_reason: reason
  });
  if (error) throw error;
  return unwrap(data);
}

export async function mobileEndAbsence(shiftId: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_end_absence', {
    p_shift_id: shiftId
  });
  if (error) throw error;
  return unwrap(data);
}

export async function mobileUpdateDraft(
  sessionId: string,
  payload: MobileDraft['payload'],
  expectedVersion: number
) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_update_activity_draft', {
    p_activity_session_id: sessionId,
    p_payload: payload,
    p_expected_version: expectedVersion
  });
  if (error) throw error;
  return unwrap(data) as { version: number } | null;
}

export async function mobileBeginFinalization(sessionId: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_begin_finalization', {
    p_activity_session_id: sessionId
  });
  if (error) throw error;
  return unwrap(data);
}

export async function mobileCancelFinalization(sessionId: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_cancel_finalization', {
    p_activity_session_id: sessionId
  });
  if (error) throw error;
  return unwrap(data);
}

export async function mobileConfirmActivity(sessionId: string, expectedDraftVersion: number) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_confirm_activity', {
    p_activity_session_id: sessionId,
    p_expected_draft_version: expectedDraftVersion
  });
  if (error) throw error;
  return unwrap(data);
}

export async function mobileEndShift(shiftId: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_end_shift', {
    p_shift_id: shiftId
  });
  if (error) throw error;
  return unwrap(data);
}


export interface MobileDashboardJourneyRow {
  collaborator_id: string;
  collaborator_name: string;
  shifts_count: number;
  planned_minutes: number;
  worked_minutes: number;
  overtime_minutes: number;
}

export interface MobileDashboardJourney {
  rows: MobileDashboardJourneyRow[];
  total_overtime_minutes: number;
}

export interface MobileHistoryActivity {
  id: string;
  date: string;
  operator: string;
  activity_code: number;
  activity_name: string;
  local: string;
  list_id: string;
  start_time: string;
  end_time: string | null;
  duration: string;
  pallet_jack_id: string | null;
  forklift_id: string | null;
  produced_quantity: number;
  items_quantity: number;
  notes: string | null;
  created_at: string;
}

export interface MobileHistoryStoppage {
  id: string;
  date: string;
  operator: string;
  stoppage_code: number;
  stoppage_name: string;
  start_time: string;
  end_time: string | null;
  duration: string;
  duration_minutes: number;
  notes: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface MobileHistory {
  activities: MobileHistoryActivity[];
  stoppages: MobileHistoryStoppage[];
  activity_total: number;
  stoppage_total: number;
  collaborators: MobilePlanningCollaborator[];
}

export interface MobileShiftPlan {
  id: string;
  collaborator_id: string;
  planned_start_at: string;
  planned_end_at: string;
  active: boolean;
  notes: string | null;
}

export interface MobilePlanningCollaborator {
  id: string;
  name: string;
  active: boolean;
}

export interface MobilePlanningPayload {
  plans: MobileShiftPlan[];
  collaborators: MobilePlanningCollaborator[];
}

export interface MobileManagementSession {
  id: string;
  profile_id: string;
  activity_type_id: string;
  activity_code: number;
  activity_name: string;
  status: 'EM_ANDAMENTO' | 'FINALIZACAO_PENDENTE' | 'CONCLUIDA' | 'CANCELADA';
  started_at: string;
  finalization_started_at: string | null;
  finished_at: string | null;
  draft: MobileDraft['payload'];
  version: number;
  official_activity_id: string | null;
}

export interface MobileHistoryFilters {
  startDate?: string;
  endDate?: string;
  collaboratorId?: string | null;
  activityCode?: number;
  stoppageCode?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function mobileGetHistory(filters: MobileHistoryFilters = {}): Promise<MobileHistory> {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_get_history', {
    p_collaborator_id: filters.collaboratorId ?? null,
    p_start_date: filters.startDate || null,
    p_end_date: filters.endDate || null,
    p_activity_code: filters.activityCode ?? null,
    p_stoppage_code: filters.stoppageCode ?? null,
    p_search: filters.search?.trim() || null,
    p_limit: filters.limit ?? 25,
    p_offset: filters.offset ?? 0
  });
  if (error) throw error;

  const payload = (data || {}) as Partial<MobileHistory>;
  return {
    activities: Array.isArray(payload.activities) ? payload.activities : [],
    stoppages: Array.isArray(payload.stoppages) ? payload.stoppages : [],
    activity_total: Number(payload.activity_total || 0),
    stoppage_total: Number(payload.stoppage_total || 0),
    collaborators: Array.isArray(payload.collaborators) ? payload.collaborators : []
  };
}

export async function mobileAdminUpdateHistoryActivity(
  activityId: string,
  patch: Record<string, unknown>
): Promise<MobileHistoryActivity> {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_update_history_activity', {
    p_activity_id: activityId,
    p_patch: patch
  });
  if (error) throw error;
  return data as MobileHistoryActivity;
}

export async function mobileAdminUpdateHistoryStoppage(
  stoppageId: string,
  patch: Record<string, unknown>
): Promise<MobileHistoryStoppage> {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_update_history_stoppage', {
    p_stoppage_id: stoppageId,
    p_patch: patch
  });
  if (error) throw error;
  return data as MobileHistoryStoppage;
}


export async function mobileAdminListShiftPlans(
  startDate?: string,
  endDate?: string,
  collaboratorId?: string
): Promise<MobilePlanningPayload> {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_list_shift_plans', {
    p_start_date: startDate || null,
    p_end_date: endDate || null,
    p_collaborator_id: collaboratorId || null
  });
  if (error) throw error;

  const payload = (data || {}) as Partial<MobilePlanningPayload>;
  return {
    plans: Array.isArray(payload.plans) ? payload.plans : [],
    collaborators: Array.isArray(payload.collaborators) ? payload.collaborators : []
  };
}

export async function mobileAdminSaveShiftPlan(payload: {
  id?: string;
  collaboratorId: string;
  plannedStartAt: string;
  plannedEndAt: string;
  notes?: string;
}) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_save_shift_plan', {
    p_id: payload.id || null,
    p_collaborator_id: payload.collaboratorId,
    p_planned_start_at: payload.plannedStartAt,
    p_planned_end_at: payload.plannedEndAt,
    p_notes: payload.notes || null
  });
  if (error) throw error;
  return data as string;
}

export async function mobileAdminDeactivateShiftPlan(id: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_deactivate_shift_plan', {
    p_id: id
  });
  if (error) throw error;
  return data;
}

export async function mobileAdminImportShiftPlans(
  rows: Array<{
    collaborator_id: string;
    planned_start_at: string;
    planned_end_at: string;
    notes?: string;
  }>
) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_import_shift_plans', {
    p_rows: rows
  });
  if (error) throw error;
  return data as { inserted: number };
}

export async function mobileAdminGetOpenActivity(): Promise<MobileManagementSession | null> {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_get_open_activity');
  if (error) throw error;
  return data as MobileManagementSession | null;
}

export async function mobileAdminStartActivity(activityTypeId: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_start_activity', {
    p_activity_type_id: activityTypeId
  });
  if (error) throw error;
  return data as MobileManagementSession;
}

export async function mobileAdminUpdateDraft(
  sessionId: string,
  payload: MobileDraft['payload'],
  expectedVersion: number
) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_update_draft', {
    p_session_id: sessionId,
    p_payload: payload,
    p_expected_version: expectedVersion
  });
  if (error) throw error;
  return data as { version: number };
}

export async function mobileAdminBeginFinalization(sessionId: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_begin_finalization', {
    p_session_id: sessionId
  });
  if (error) throw error;
  return data as MobileManagementSession;
}

export async function mobileAdminCancelFinalization(sessionId: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_cancel_finalization', {
    p_session_id: sessionId
  });
  if (error) throw error;
  return data as MobileManagementSession;
}

export async function mobileAdminConfirmActivity(sessionId: string, expectedVersion: number) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_confirm_activity', {
    p_session_id: sessionId,
    p_expected_version: expectedVersion
  });
  if (error) throw error;
  return data;
}

export async function mobileAdminCancelActivity(sessionId: string) {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_cancel_activity', {
    p_session_id: sessionId
  });
  if (error) throw error;
  return data;
}


export async function mobileAdminGetDashboardJourney(
  startDate: string,
  endDate: string
): Promise<MobileDashboardJourney> {
  const client = ensureClient();
  const { data, error } = await client.rpc('mobile_admin_get_dashboard_journey', {
    p_start_date: startDate,
    p_end_date: endDate
  });
  if (error) throw error;

  const payload = (data || {}) as Partial<MobileDashboardJourney>;
  return {
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    total_overtime_minutes: Number(payload.total_overtime_minutes || 0)
  };
}
