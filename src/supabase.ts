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

// Activity API
export async function dbFetchActivities(): Promise<Activity[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*');
    if (error) {
      console.error('Error fetching activities:', error);
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

// Stoppage API
export async function dbFetchStoppages(): Promise<Stoppage[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('stoppages')
      .select('*');
    if (error) {
      console.error('Error fetching stoppages:', error);
      return null;
    }
    return data as Stoppage[];
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
      .upsert(stoppage);
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
