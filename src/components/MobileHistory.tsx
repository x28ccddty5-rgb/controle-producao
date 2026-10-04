import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon,
  CalendarDays,
  Check,
  Clock3,
  Filter,
  Pencil,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import {
  MobileCollaborator,
  MobileHistory as MobileHistoryData,
  MobileHistoryActivity,
  MobileHistoryStoppage,
  mobileAdminUpdateHistoryActivity,
  mobileAdminUpdateHistoryStoppage,
  mobileGetHistory
} from '../mobileSupabase';

interface Props {
  collaborator: MobileCollaborator | null;
  management: boolean;
}

const ACTIVITY_OPTIONS = [
  [1, 'Separação'],
  [2, 'Armazenamento'],
  [3, 'Remontar Picadeiras'],
  [4, 'Trocar Strechs'],
  [5, 'Movimentação'],
  [6, 'Atualizar Etiquetas'],
  [7, 'Endereçamento'],
  [8, 'Empilhamento'],
  [9, 'Liberando peças do Forno'],
  [10, 'Inventário Rotativo'],
  [11, 'Outros']
] as const;

const STOPPAGE_OPTIONS = [
  [1, 'Banheiro/Água'],
  [2, 'Trabalhando em outro setor'],
  [3, 'Treinamento'],
  [4, 'Reunião'],
  [5, 'Limpeza do setor'],
  [6, 'Auxiliando externo'],
  [7, 'Inventário Pontual'],
  [8, 'Equipamento instável'],
  [9, 'Procurando Pallet'],
  [10, 'Checklist'],
  [11, 'Descarte quebra'],
  [12, 'Auditoria'],
  [13, 'Outros']
] as const;

const PAGE_SIZE = 15;

function dateInputToday() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return '--';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function initialRange() {
  const today = dateInputToday();
  return { start: addDays(today, -7), end: today };
}

export default function MobileHistory({ collaborator, management }: Props) {
  const initial = useMemo(initialRange, []);
  const [data, setData] = useState<MobileHistoryData>({
    activities: [],
    stoppages: [],
    activity_total: 0,
    stoppage_total: 0,
    collaborators: []
  });
  const [tab, setTab] = useState<'ACTIVITIES' | 'STOPPAGES'>('ACTIVITIES');
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [collaboratorId, setCollaboratorId] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingActivity, setEditingActivity] = useState<MobileHistoryActivity | null>(null);
  const [editingStoppage, setEditingStoppage] = useState<MobileHistoryStoppage | null>(null);
  const [saving, setSaving] = useState(false);

  const activeTotal = tab === 'ACTIVITIES' ? data.activity_total : data.stoppage_total;
  const totalPages = Math.max(1, Math.ceil(activeTotal / PAGE_SIZE));

  const load = async (requestedPage = page) => {
    if (startDate > endDate) {
      setError('A data inicial não pode ser maior que a data final.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await mobileGetHistory({
        startDate,
        endDate,
        collaboratorId: management ? (collaboratorId || null) : collaborator?.collaborator_id ?? null,
        activityCode: tab === 'ACTIVITIES' && codeFilter ? Number(codeFilter) : undefined,
        stoppageCode: tab === 'STOPPAGES' && codeFilter ? Number(codeFilter) : undefined,
        search,
        limit: PAGE_SIZE,
        offset: requestedPage * PAGE_SIZE
      });
      setData(result);
      setPage(requestedPage);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (management || collaborator) void load(0);
    // Os filtros são aplicados ao consultar, não a cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [management, collaborator?.collaborator_id, tab]);

  const handleTab = (next: 'ACTIVITIES' | 'STOPPAGES') => {
    setTab(next);
    setCodeFilter('');
    setPage(0);
  };

  const saveActivity = async () => {
    if (!editingActivity) return;
    setSaving(true);
    setError('');
    try {
      const updated = await mobileAdminUpdateHistoryActivity(editingActivity.id, {
        local: editingActivity.local,
        list_id: editingActivity.list_id,
        pallet_jack_id: editingActivity.pallet_jack_id,
        forklift_id: editingActivity.forklift_id,
        produced_quantity: editingActivity.produced_quantity,
        items_quantity: editingActivity.items_quantity,
        notes: editingActivity.notes
      });
      setData(current => ({
        ...current,
        activities: current.activities.map(item => item.id === updated.id ? { ...item, ...updated } : item)
      }));
      setEditingActivity(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a correção.');
    } finally {
      setSaving(false);
    }
  };

  const saveStoppage = async () => {
    if (!editingStoppage) return;
    setSaving(true);
    setError('');
    try {
      const updated = await mobileAdminUpdateHistoryStoppage(editingStoppage.id, {
        notes: editingStoppage.notes,
        resolution_notes: editingStoppage.resolution_notes
      });
      setData(current => ({
        ...current,
        stoppages: current.stoppages.map(item => item.id === updated.id ? { ...item, ...updated } : item)
      }));
      setEditingStoppage(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a correção.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-blue-300 font-bold">Histórico</div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Registros finalizados</h2>
            <p className="text-[11px] text-slate-500 mt-1">
              {management ? 'Consulta consolidada. Use os filtros para localizar um lançamento.' : 'Exibindo somente os seus próprios lançamentos.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load(0)}
            disabled={loading}
            className="p-3 rounded-xl border border-slate-700 text-slate-300"
            aria-label="Atualizar histórico"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="w-full min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-2.5 sm:p-3 space-y-2.5 overflow-hidden">
        <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => handleTab('ACTIVITIES')}
            className={`rounded-xl py-3 text-xs font-bold ${tab === 'ACTIVITIES' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}
          >
            ATIVIDADES <span className="opacity-70">({data.activity_total})</span>
          </button>
          <button
            type="button"
            onClick={() => handleTab('STOPPAGES')}
            className={`rounded-xl py-3 text-xs font-bold ${tab === 'STOPPAGES' ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}
          >
            PARADAS <span className="opacity-70">({data.stoppage_total})</span>
          </button>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:gap-2">
          <label className="min-w-0 text-[10px] uppercase tracking-widest text-slate-500">
            De
            <input value={startDate} onChange={e => setStartDate(e.target.value)} type="date" className="mobile-input mt-1 min-w-0 max-w-full" />
          </label>
          <label className="min-w-0 text-[10px] uppercase tracking-widest text-slate-500">
            Até
            <input value={endDate} onChange={e => setEndDate(e.target.value)} type="date" className="mobile-input mt-1 min-w-0 max-w-full" />
          </label>
        </div>

        {management && (
          <label className="block text-[10px] uppercase tracking-widest text-slate-500">
            Colaborador
            <select value={collaboratorId} onChange={e => setCollaboratorId(e.target.value)} className="mobile-input mt-1 min-w-0 max-w-full">
              <option value="">Todos os colaboradores</option>
              {data.collaborators.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        )}

        <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
          <label className="min-w-0 text-[10px] uppercase tracking-widest text-slate-500">
            {tab === 'ACTIVITIES' ? 'Atividade' : 'Motivo da parada'}
            <select value={codeFilter} onChange={e => setCodeFilter(e.target.value)} className="mobile-input mt-1 min-w-0 max-w-full">
              <option value="">Todos</option>
              {(tab === 'ACTIVITIES' ? ACTIVITY_OPTIONS : STOPPAGE_OPTIONS).map(([code, label]) => (
                <option key={code} value={code}>{code} • {label}</option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-[10px] uppercase tracking-widest text-slate-500">
            Busca
            <div className="relative mt-1">
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tab === 'ACTIVITIES' ? 'Local, lista ou observação' : 'Observação ou resolução'}
                className="mobile-input min-w-0 max-w-full pl-9"
              />
            </div>
          </label>
        </div>

        <button type="button" onClick={() => void load(0)} disabled={loading} className="mobile-primary w-full min-w-0">
          <Filter className="w-4 h-4" />
          {loading ? 'CONSULTANDO...' : 'APLICAR FILTROS'}
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 p-3 text-sm">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3" />
          Carregando histórico...
        </div>
      ) : tab === 'ACTIVITIES' ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
          {data.activities.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Nenhuma atividade encontrada.</div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-800">
              {data.activities.map(item => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{item.activity_code} • {item.activity_name}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{formatDate(item.date)} • {item.start_time} → {item.end_time || '--'}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="font-mono text-sm font-bold text-emerald-300">{item.duration}</div>
                      {management && (
                        <button type="button" onClick={() => setEditingActivity({ ...item })} className="p-2 rounded-lg border border-slate-700 text-blue-300" title="Corrigir lançamento">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-950 border border-slate-800 p-2">
                      <span className="text-slate-500">Peças</span>
                      <strong className="block mt-0.5">{item.produced_quantity || '—'}</strong>
                    </div>
                    <div className="rounded-lg bg-slate-950 border border-slate-800 p-2">
                      <span className="text-slate-500">Itens</span>
                      <strong className="block mt-0.5">{item.items_quantity || '—'}</strong>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {item.local || 'Sem local'}{item.list_id ? ` • Lista ${item.list_id}` : ''}
                  </div>
                  {item.notes && <div className="mt-2 text-xs text-slate-500 italic">“{item.notes}”</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
          {data.stoppages.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Nenhuma parada encontrada.</div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-800">
              {data.stoppages.map(item => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-rose-200 truncate">{item.stoppage_code} • {item.stoppage_name}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{formatDate(item.date)} • {item.start_time} → {item.end_time || '--'}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="font-mono text-sm font-bold text-rose-300">{item.duration}</div>
                      {management && (
                        <button type="button" onClick={() => setEditingStoppage({ ...item })} className="p-2 rounded-lg border border-slate-700 text-blue-300" title="Corrigir lançamento">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {item.notes && <div className="mt-2 text-xs text-slate-400">Observação: {item.notes}</div>}
                  {item.resolution_notes && <div className="mt-1 text-xs text-slate-500">Retomada: {item.resolution_notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs">
          <span className="text-slate-500">Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 0 || loading} onClick={() => void load(page - 1)} className="px-3 py-2 rounded-lg border border-slate-700 disabled:opacity-40">Anterior</button>
            <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => void load(page + 1)} className="px-3 py-2 rounded-lg border border-slate-700 disabled:opacity-40">Próxima</button>
          </div>
        </div>
      )}

      <div className="text-[11px] text-slate-600 flex items-center gap-2">
        <Clock3 className="w-3.5 h-3.5" />
        Consulta paginada no banco. O operador visualiza somente os próprios registros.
      </div>

      {editingActivity && (
        <div className="fixed inset-0 z-50 bg-black/80 p-3 flex items-end md:items-center justify-center">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Correção pontual</div>
                <h3 className="text-lg font-bold">Atividade {editingActivity.activity_code} • {editingActivity.operator}</h3>
              </div>
              <button type="button" onClick={() => setEditingActivity(null)} className="p-2 rounded-xl border border-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <label className="col-span-2 text-xs text-slate-500">Local<input value={editingActivity.local} onChange={e => setEditingActivity(v => v ? { ...v, local: e.target.value } : v)} className="mobile-input mt-1 min-w-0 max-w-full" /></label>
              <label className="text-xs text-slate-500">Lista<input value={editingActivity.list_id || ''} onChange={e => setEditingActivity(v => v ? { ...v, list_id: e.target.value } : v)} className="mobile-input mt-1 min-w-0 max-w-full" /></label>
              <label className="text-xs text-slate-500">Peças<input type="number" min={0} value={editingActivity.produced_quantity} onChange={e => setEditingActivity(v => v ? { ...v, produced_quantity: Number(e.target.value) } : v)} className="mobile-input mt-1 min-w-0 max-w-full" /></label>
              <label className="text-xs text-slate-500">Itens<input type="number" min={0} value={editingActivity.items_quantity} onChange={e => setEditingActivity(v => v ? { ...v, items_quantity: Number(e.target.value) } : v)} className="mobile-input mt-1 min-w-0 max-w-full" /></label>
              <label className="text-xs text-slate-500">Paleteira<input value={editingActivity.pallet_jack_id || ''} onChange={e => setEditingActivity(v => v ? { ...v, pallet_jack_id: e.target.value } : v)} className="mobile-input mt-1 min-w-0 max-w-full" /></label>
              <label className="text-xs text-slate-500">Empilhadeira<input value={editingActivity.forklift_id || ''} onChange={e => setEditingActivity(v => v ? { ...v, forklift_id: e.target.value } : v)} className="mobile-input mt-1 min-w-0 max-w-full" /></label>
              <label className="col-span-2 text-xs text-slate-500">Observação<textarea rows={3} value={editingActivity.notes || ''} onChange={e => setEditingActivity(v => v ? { ...v, notes: e.target.value } : v)} className="mobile-input mt-1 min-w-0 max-w-full" /></label>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setEditingActivity(null)} className="mobile-secondary flex-1">CANCELAR</button>
              <button type="button" onClick={() => void saveActivity()} disabled={saving} className="mobile-primary flex-1"><Check className="w-4 h-4" />{saving ? 'SALVANDO...' : 'SALVAR CORREÇÃO'}</button>
            </div>
          </div>
        </div>
      )}

      {editingStoppage && (
        <div className="fixed inset-0 z-50 bg-black/80 p-3 flex items-end md:items-center justify-center">
          <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-rose-400 font-bold">Correção pontual</div>
                <h3 className="text-lg font-bold">Parada {editingStoppage.stoppage_code} • {editingStoppage.operator}</h3>
              </div>
              <button type="button" onClick={() => setEditingStoppage(null)} className="p-2 rounded-xl border border-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 mt-5">
              <label className="text-xs text-slate-500">Observação<textarea rows={3} value={editingStoppage.notes || ''} onChange={e => setEditingStoppage(v => v ? { ...v, notes: e.target.value } : v)} className="mobile-input mt-1 min-w-0 max-w-full" /></label>
              <label className="text-xs text-slate-500">Retomada<textarea rows={3} value={editingStoppage.resolution_notes || ''} onChange={e => setEditingStoppage(v => v ? { ...v, resolution_notes: e.target.value } : v)} className="mobile-input mt-1 min-w-0 max-w-full" /></label>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setEditingStoppage(null)} className="mobile-secondary flex-1">CANCELAR</button>
              <button type="button" onClick={() => void saveStoppage()} disabled={saving} className="mobile-primary flex-1"><Check className="w-4 h-4" />{saving ? 'SALVANDO...' : 'SALVAR CORREÇÃO'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
