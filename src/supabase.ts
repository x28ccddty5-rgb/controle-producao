import { createClient } from '@supabase/supabase-js';
import { Activity, Stoppage, ProductionLog } from './types';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

// Initialize client only if variables are set
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseConfigured = (): boolean => {
  return !!supabase;
};

export async function dbFetchCollaborators(): Promise<string[] | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('collaborators')
      .select('name')
      .eq('active', true)
      .order('name');

    if (error) {
      console.error('Error fetching collaborators:', error);
      return null;
    }

    return (data || []).map((row: { name: string }) => row.name);
  } catch (err) {
    console.error('Supabase collaborators query failed:', err);
    return null;
  }
}

export async function dbSaveCollaborator(name: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('collaborators')
      .upsert(
        { name: name.trim(), active: true },
        { onConflict: 'name' }
      );

    if (error) {
      console.error('Error saving collaborator:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Supabase collaborator save failed:', err);
    return false;
  }
}

export async function dbDeactivateCollaborator(name: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('collaborators')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('name', name);

    if (error) {
      console.error('Error deactivating collaborator:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Supabase collaborator deactivation failed:', err);
    return false;
  }
}

// Activity API
export async function dbFetchActivities(): Promise<Activity[] | null> {
  if (!supabase) return null;

  const pageSize = 500;
  const allRows: any[] = [];

  try {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('id', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('Error fetching activities:', error);
        return null;
      }

      const rows = data || [];
      allRows.push(...rows);

      if (rows.length < pageSize) break;
    }

    return allRows.map((row: any) => ({
      id: row.id,
      date: row.date,
      operator: row.operator,
      activityCode: row.activity_code,
      activityName: row.activity_name,
      local: row.local,
      listId: row.list_id,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      durationHours: row.duration_hours,
      palletJackId: row.pallet_jack_id || '',
      forkliftId: row.forklift_id || '',
      producedQuantity: row.produced_quantity || 0,
      itemsQuantity: row.items_quantity || 0,
      status: row.status,
      notes: row.notes,
      creator: row.creator,
      createdAt: row.created_at
    })) as Activity[];
  } catch (err) {
    console.error('Supabase activities query failed:', err);
    return null;
  }
}

export async function dbSaveActivity(activity: Activity): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('activities')
      .upsert({
        id: activity.id,
        date: activity.date,
        operator: activity.operator,
        activity_code: activity.activityCode,
        activity_name: activity.activityName,
        local: activity.local,
        list_id: activity.listId,
        start_time: activity.startTime,
        end_time: activity.endTime,
        duration: activity.duration,
        duration_hours: activity.durationHours,
        pallet_jack_id: activity.palletJackId,
        forklift_id: activity.forkliftId,
        produced_quantity: activity.producedQuantity,
        items_quantity: activity.itemsQuantity,
        status: activity.status,
        notes: activity.notes,
        creator: activity.creator,
        created_at: activity.createdAt
      });

    if (error) {
      console.error('Error saving activity:', error);
      return false;
    }

    return true;

  } catch (err) {
    console.error('Supabase activity upsert failed:', err);
    return false;
  }
}

export async function dbDeleteActivity(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting activity:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase activity delete failed:', err);
    return false;
  }
}

export async function dbFetchActiveActivities(): Promise<Activity[] | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .in('status', ['EM_ANDAMENTO', 'PAUSADO'])
      .order('id', { ascending: false });

    if (error) {
      console.error('Error fetching active activities:', error);
      return null;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      operator: row.operator,
      activityCode: row.activity_code,
      activityName: row.activity_name,
      local: row.local,
      listId: row.list_id,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      durationHours: row.duration_hours,
      palletJackId: row.pallet_jack_id || '',
      forkliftId: row.forklift_id || '',
      producedQuantity: row.produced_quantity || 0,
      itemsQuantity: row.items_quantity || 0,
      status: row.status,
      notes: row.notes,
      creator: row.creator,
      createdAt: row.created_at
    })) as Activity[];
  } catch (err) {
    console.error('Supabase active activities query failed:', err);
    return null;
  }
}

// Stoppage API
export async function dbFetchStoppages(): Promise<Stoppage[] | null> {
  if (!supabase) return null;

  const pageSize = 500;
  const allRows: any[] = [];

  try {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('stoppages')
        .select('*')
        .order('id', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('Error fetching stoppages:', error);
        return null;
      }

      const rows = data || [];
      allRows.push(...rows);

      if (rows.length < pageSize) break;
    }

    return allRows.map((row: any) => ({
      id: row.id,
      date: row.date,
      operator: row.operator,
      stoppageCode: row.stoppage_code,
      stoppageName: row.stoppage_name,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      durationMinutes: row.duration_minutes,
      status: row.status,
      notes: row.notes,
      resolutionNotes: row.resolution_notes,
      creator: row.creator,
      createdAt: row.created_at
    })) as Stoppage[];
  } catch (err) {
    console.error('Supabase stoppages query failed:', err);
    return null;
  }
}

export async function dbSaveStoppage(stoppage: Stoppage): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('stoppages')
      .upsert({
      id: stoppage.id,
      date: stoppage.date,
      operator: stoppage.operator,
      stoppage_code: stoppage.stoppageCode,
      stoppage_name: stoppage.stoppageName,
      start_time: stoppage.startTime,
      end_time: stoppage.endTime,
      duration: stoppage.duration,
      duration_minutes: stoppage.durationMinutes,
      status: stoppage.status,
      notes: stoppage.notes,
      resolution_notes: stoppage.resolutionNotes,
      creator: stoppage.creator,
      created_at: stoppage.createdAt
    });
    if (error) {
      console.error('Error saving stoppage:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase stoppage upsert failed:', err);
    return false;
  }
}

export async function dbDeleteStoppage(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('stoppages')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting stoppage:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase stoppage delete failed:', err);
    return false;
  }
}

export async function dbFetchActiveStoppages(): Promise<Stoppage[] | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('stoppages')
      .select('*')
      .eq('status', 'ATIVA')
      .order('id', { ascending: false });

    if (error) {
      console.error('Error fetching active stoppages:', error);
      return null;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      operator: row.operator,
      stoppageCode: row.stoppage_code,
      stoppageName: row.stoppage_name,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      durationMinutes: row.duration_minutes,
      status: row.status,
      notes: row.notes,
      resolutionNotes: row.resolution_notes,
      creator: row.creator,
      createdAt: row.created_at
    })) as Stoppage[];
  } catch (err) {
    console.error('Supabase active stoppages query failed:', err);
    return null;
  }
}


export interface ActivityTarget {
  code: number;
  label: string;
  targetMonthlyPieces: number | null;
  targetPerHour: number | null;
}

export async function dbFetchActivityTargets(): Promise<ActivityTarget[] | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc('dashboard_get_activity_targets');
    if (error) {
      console.error('Error fetching activity targets:', error);
      return null;
    }

    return (Array.isArray(data) ? data : []).map((item: any) => ({
      code: Number(item.code),
      label: String(item.label ?? ''),
      targetMonthlyPieces: item.target_monthly_pieces === null || item.target_monthly_pieces === undefined
        ? null
        : Number(item.target_monthly_pieces),
      targetPerHour: item.target_monthly_pieces === null || item.target_monthly_pieces === undefined
        ? null
        : Math.floor(Number(item.target_monthly_pieces) / 720)
    }));
  } catch (err) {
    console.error('Supabase activity targets query failed:', err);
    return null;
  }
}

export async function dbUpdateActivityTarget(code: number, targetMonthlyPieces: number | null): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase.rpc('dashboard_update_activity_target', {
      p_activity_code: code,
      p_target_monthly_pieces: targetMonthlyPieces
    });

    if (error) {
      console.error('Error updating activity target:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Supabase activity target update failed:', err);
    return false;
  }
}

export async function dbFetchActivityTypes() {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('activity_types')
      .select('*')
      .eq('active', true)
      .order('code');

    if (error) {
      console.error(error);
      return null;
    }

    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function dbSaveActivityType(
  activityType: {
    code: number;
    label: string;
  }
) {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('activity_types')
      .upsert({
        code: activityType.code,
        label: activityType.label,
        active: true
      });

    if (error) {
      console.error(error);
      return false;
    }

    return true;

  } catch (err) {
    console.error(err);
    return false;
  }
}

export async function dbDeleteActivityType(
  code: number
) {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('activity_types')
      .update({
        active: false
      })
      .eq('code', code);

    if (error) {
      console.error(error);
      return false;
    }

    return true;

  } catch (err) {
    console.error(err);
    return false;
  }
}

export async function dbFetchStoppageTypes() {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('stoppage_types')
      .select('*')
      .eq('active', true)
      .order('code');

    if (error) {
      console.error(error);
      return null;
    }

    return data;

  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function dbSaveStoppageType(
  stoppageType: {
    code: number;
    name: string;
  }
) {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('stoppage_types')
      .upsert({
        code: stoppageType.code,
        name: stoppageType.name,
        active: true
      });

    if (error) {
      console.error(error);
      return false;
    }

    return true;

  } catch (err) {
    console.error(err);
    return false;
  }
}

export async function dbDeleteStoppageType(
  code: number
) {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('stoppage_types')
      .update({
        active: false
      })
      .eq('code', code);

    if (error) {
      console.error(error);
      return false;
    }

    return true;

  } catch (err) {
    console.error(err);
    return false;
  }
}


export interface HistoryPageResult<T> {
  items: T[];
  totalCount: number;
}

function mapActivityRow(row: any): Activity {
  return {
    id: row.id,
    date: row.date,
    operator: row.operator,
    activityCode: row.activity_code,
    activityName: row.activity_name,
    local: row.local,
    listId: row.list_id,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    durationHours: row.duration_hours,
    palletJackId: row.pallet_jack_id || '',
    forkliftId: row.forklift_id || '',
    producedQuantity: row.produced_quantity || 0,
    itemsQuantity: row.items_quantity || 0,
    status: row.status,
    notes: row.notes,
    creator: row.creator,
    createdAt: row.created_at
  };
}

function mapStoppageRow(row: any): Stoppage {
  return {
    id: row.id,
    date: row.date,
    operator: row.operator,
    stoppageCode: row.stoppage_code,
    stoppageName: row.stoppage_name,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    durationMinutes: row.duration_minutes,
    status: row.status,
    notes: row.notes,
    resolutionNotes: row.resolution_notes,
    creator: row.creator,
    createdAt: row.created_at
  };
}

export async function dbFetchActivityHistoryPage(params: {
  startDate?: string;
  endDate?: string;
  operator?: string;
  code?: number;
  limit: number;
  offset: number;
}): Promise<HistoryPageResult<Activity> | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc('get_activity_history', {
      p_start_date: params.startDate || null,
      p_end_date: params.endDate || null,
      p_operator: params.operator?.trim() || null,
      p_code: params.code ?? null,
      p_limit: params.limit,
      p_offset: params.offset
    });

    if (error) {
      console.error('Error fetching activity history:', error);
      return null;
    }

    const payload = (data || {}) as { items?: any[]; total_count?: number };
    return {
      items: (payload.items || []).map(mapActivityRow),
      totalCount: Number(payload.total_count || 0)
    };
  } catch (err) {
    console.error('Supabase activity history query failed:', err);
    return null;
  }
}

export async function dbFetchStoppageHistoryPage(params: {
  startDate?: string;
  endDate?: string;
  operator?: string;
  code?: number;
  limit: number;
  offset: number;
}): Promise<HistoryPageResult<Stoppage> | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc('get_stoppage_history', {
      p_start_date: params.startDate || null,
      p_end_date: params.endDate || null,
      p_operator: params.operator?.trim() || null,
      p_code: params.code ?? null,
      p_limit: params.limit,
      p_offset: params.offset
    });

    if (error) {
      console.error('Error fetching stoppage history:', error);
      return null;
    }

    const payload = (data || {}) as { items?: any[]; total_count?: number };
    return {
      items: (payload.items || []).map(mapStoppageRow),
      totalCount: Number(payload.total_count || 0)
    };
  } catch (err) {
    console.error('Supabase stoppage history query failed:', err);
    return null;
  }
}

// ProductionLog API
export async function dbFetchLogs(): Promise<ProductionLog[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('production_logs')
      .select('*');
    if (error) {
      console.error('Error fetching logs:', error);
      return null;
    }
    // Map db structure back to type if needed
    const mapped = (data || []).map((d: any) => ({
      id: d.id,
      timestamp: d.timestamp,
      type: d.type,
      description: d.description,
      operator: d.operator,
      referenceId: d.reference_id
    }));
    return mapped as ProductionLog[];
  } catch (err) {
    console.error('Supabase logs query failed:', err);
    return null;
  }
}

export async function dbSaveLog(log: ProductionLog): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('production_logs')
      .upsert({
        id: log.id,
        timestamp: log.timestamp,
        type: log.type,
        description: log.description,
        operator: log.operator,
        reference_id: log.referenceId
      });
    if (error) {
      console.error('Error saving log:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase log upsert failed:', err);
    return false;
  }
}

export async function dbClearLogs(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('production_logs')
      .delete()
      .neq('id', '');
    if (error) {
      console.error('Error clearing logs:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase logs clearing failed:', err);
    return false;
  }
}


export async function dbAdminCorrectActivityHistory(
  activityId: string,
  patch: Record<string, unknown>
): Promise<Activity | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc('mobile_admin_update_history_activity', {
      p_activity_id: activityId,
      p_patch: patch
    });

    if (error) {
      console.error('Error correcting activity history:', error);
      return null;
    }

    return data ? mapActivityRow(data) : null;
  } catch (err) {
    console.error('Supabase activity history correction failed:', err);
    return null;
  }
}

export async function dbAdminCorrectStoppageHistory(
  stoppageId: string,
  patch: Record<string, unknown>
): Promise<Stoppage | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc('mobile_admin_update_history_stoppage', {
      p_stoppage_id: stoppageId,
      p_patch: patch
    });

    if (error) {
      console.error('Error correcting stoppage history:', error);
      return null;
    }

    return data ? mapStoppageRow(data) : null;
  } catch (err) {
    console.error('Supabase stoppage history correction failed:', err);
    return null;
  }
}

export async function dbAdminDeleteActivityHistory(
  activityId: string
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { data, error } = await supabase.rpc('mobile_admin_delete_history_activity', {
      p_activity_id: activityId
    });

    if (error) {
      console.error('Error deleting activity history:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('Supabase activity history deletion failed:', err);
    return false;
  }
}

export async function dbAdminDeleteStoppageHistory(
  stoppageId: string
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { data, error } = await supabase.rpc('mobile_admin_delete_history_stoppage', {
      p_stoppage_id: stoppageId
    });

    if (error) {
      console.error('Error deleting stoppage history:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('Supabase stoppage history deletion failed:', err);
    return false;
  }
}
