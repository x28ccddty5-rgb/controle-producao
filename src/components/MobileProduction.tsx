import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  Check,
  Clock3,
  Coffee,
  LogOut,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  UserRound,
  X,
  Zap
} from 'lucide-react';
import {
  MobileActivitySession,
  MobileCollaborator,
  MobileContext,
  MobileDraft,
  MobileShift,
  mobileBeginFinalization,
  mobileCancelActivity,
  mobileCancelFinalization,
  mobileConfirmActivity,
  mobileEndAbsence,
  mobileEndInterval,
  mobileEndShift,
  mobileGetActivitySession,
  mobileGetActivityTypes,
  mobileGetBoundCollaborator,
  mobileGetDraft,
  mobileGetOpenShift,
  mobileGetServerTime,
  mobileGetShiftPlans,
  mobileGetStoppageTypes,
  mobileResolveStoppage,
  mobileStartAbsence,
  mobileStartActivity,
  mobileStartInterval,
  mobileStartShift,
  mobileStartStoppage,
  mobileUpdateDraft
} from '../mobileSupabase';
import { supabase } from '../supabase';
import MobileAdminOperation from './MobileAdminOperation';
import MobileHistory from './MobileHistory';
import ShiftPlanning from './ShiftPlanning';

interface Props {
  userName: string;
  onLogout: () => void;
  role?: 'administrador' | 'lideranca' | 'apoio' | 'producao' | 'visualizador';
}

type ActivityType = { id: string; code: number; label: string };
type StoppageType = { id: string; code: number; name: string };

const EMPTY_DRAFT: MobileDraft['payload'] = {
  local: '',
  listId: '',
  producedQuantity: '',
  itemsQuantity: '',
  palletJackId: '',
  forkliftId: '',
  notes: '',
  highQuantityConfirmed: false
};

function formatElapsed(start: string | null, nowMs: number) {
  if (!start) return '00:00:00';
  const seconds = Math.max(0, Math.floor((nowMs - new Date(start).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function formatClock(value: string | null) {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function contextLabel(context: MobileContext) {
  switch (context) {
    case 'NAO_ALOCADO': return 'Não alocado';
    case 'ATIVIDADE': return 'Atividade';
    case 'PARADA': return 'Parada';
    case 'TRANSICAO': return 'Transição';
    case 'INTERVALO': return 'Intervalo';
    case 'AUSENCIA': return 'Ausência';
  }
}

function contextTone(context: MobileContext) {
  switch (context) {
    case 'ATIVIDADE': return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'PARADA': return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
    case 'TRANSICAO': return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'INTERVALO': return 'border-sky-500/30 bg-sky-500/10 text-sky-300';
    case 'AUSENCIA': return 'border-violet-500/30 bg-violet-500/10 text-violet-300';
    default: return 'border-slate-700 bg-slate-900 text-slate-300';
  }
}

export default function MobileProduction({ userName, onLogout, role = 'producao' }: Props) {
  const managementRole = role === 'administrador' || role === 'lideranca';
  const [collaborator, setCollaborator] = useState<MobileCollaborator | null>(null);
  const [shift, setShift] = useState<MobileShift | null>(null);
  const [session, setSession] = useState<MobileActivitySession | null>(null);
  const [draft, setDraft] = useState<MobileDraft['payload']>(EMPTY_DRAFT);
  const [draftVersion, setDraftVersion] = useState(1);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [stoppageTypes, setStoppageTypes] = useState<StoppageType[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [nowMs, setNowMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedActivityType, setSelectedActivityType] = useState('');
  const [selectedStoppageType, setSelectedStoppageType] = useState('');
  const [stoppageNotes, setStoppageNotes] = useState('');
  const [reason, setReason] = useState('');
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'PRODUCAO' | 'HISTORICO' | 'PLANEJAMENTO'>('PRODUCAO');
  const [draftIncrement, setDraftIncrement] = useState({ pieces: '', items: '', pallet: '', forklift: '' });
  const draftLoadedSessionId = useRef<string | null>(null);
  const draftVersionRef = useRef(1);
  const draftDirtyRef = useRef(false);
  const serverClockRef = useRef<{ serverNowMs: number; monotonicMs: number } | null>(null);

  const syncServerClock = useCallback((serverTime: string) => {
    const parsed = Date.parse(serverTime);
    if (!Number.isFinite(parsed)) {
      throw new Error('O horário oficial do servidor retornou um valor inválido.');
    }

    const monotonicMs = performance.now();
    serverClockRef.current = { serverNowMs: parsed, monotonicMs };
    setNowMs(parsed);
  }, []);

  const getOperationalNowMs = useCallback(() => {
    const clock = serverClockRef.current;
    if (!clock) return 0;
    return Math.floor(clock.serverNowMs + (performance.now() - clock.monotonicMs));
  }, []);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const bound = await mobileGetBoundCollaborator();
      setCollaborator(bound);

      if (!bound) {
        setShift(null);
        setSession(null);
        return;
      }

      const [typesResult, stopsResult, openShiftResult, planRowsResult, serverTimeResult] =
        await Promise.allSettled([
          mobileGetActivityTypes(),
          mobileGetStoppageTypes(),
          mobileGetOpenShift(bound.collaborator_id),
          mobileGetShiftPlans(bound.collaborator_id),
          mobileGetServerTime()
        ]);


      if (planRowsResult.status === 'rejected') {
        throw planRowsResult.reason;
      }

      if (serverTimeResult.status === 'rejected') {
        throw serverTimeResult.reason;
      }

      syncServerClock(serverTimeResult.value);
      setPlans(planRowsResult.value ?? []);

      if (typesResult.status === 'fulfilled') {
        setActivityTypes(typesResult.value as ActivityType[]);
      } else {
        console.warn(
          'Não foi possível carregar os tipos de atividade Mobile:',
          typesResult.reason
        );
        setActivityTypes([]);
      }

      if (stopsResult.status === 'fulfilled') {
        setStoppageTypes(stopsResult.value as StoppageType[]);
      } else {
        console.warn(
          'Não foi possível carregar os tipos de parada Mobile:',
          stopsResult.reason
        );
        setStoppageTypes([]);
      }

      const openShift =
        openShiftResult.status === 'fulfilled'
          ? openShiftResult.value
          : null;

      if (openShiftResult.status === 'rejected') {
        console.warn(
          'Não foi possível consultar o turno aberto Mobile:',
          openShiftResult.reason
        );
      }

      if (!openShift) {
        setShift(null);
        setSession(null);
        return;
      }

      setShift(openShift);
      const openSession = await mobileGetActivitySession(openShift.id);
      setSession(openSession);

      if (openSession) {
        const savedDraft = await mobileGetDraft(openSession.id);
        if (savedDraft && (
          draftLoadedSessionId.current !== openSession.id ||
          !draftDirtyRef.current
        )) {
          setDraft({ ...EMPTY_DRAFT, ...(savedDraft.payload || {}) });
          setDraftVersion(savedDraft.version);
          draftVersionRef.current = savedDraft.version;
          draftDirtyRef.current = false;
        } else if (!savedDraft && draftLoadedSessionId.current !== openSession.id) {
          setDraft(EMPTY_DRAFT);
          setDraftVersion(1);
          draftVersionRef.current = 1;
          draftDirtyRef.current = false;
        }
        draftLoadedSessionId.current = openSession.id;
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o Mobile.');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      if (!managementRole) {
        await refresh();
      }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [refresh, managementRole]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = getOperationalNowMs();
      if (current > 0) setNowMs(current);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [getOperationalNowMs]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session?.status !== 'FINALIZACAO_PENDENTE') {
        refresh().catch(console.error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refresh, session?.status]);

  useEffect(() => {
    if (!shift || session?.status === 'FINALIZACAO_PENDENTE') return;
    const timer = window.setInterval(() => {
      refresh().catch(console.error);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [shift?.id, refresh]);

  const mutate = async (action: () => Promise<unknown>, successMessage?: string) => {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      await action();
      if (successMessage) setNotice(successMessage);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Operação não concluída.');
    } finally {
      setWorking(false);
    }
  };

  const currentPlan = useMemo(() => {
    if (nowMs <= 0) return null;

    const validPlans = plans
      .filter((plan) => {
        if (!plan?.planned_start_at || !plan?.planned_end_at) return false;
        if (plan.active === false) return false;

        const start = new Date(plan.planned_start_at).getTime();
        const end = new Date(plan.planned_end_at).getTime();

        return Number.isFinite(start) && Number.isFinite(end) && end > nowMs;
      })
      .sort(
        (a, b) =>
          new Date(a.planned_start_at).getTime() -
          new Date(b.planned_start_at).getTime()
      );

    return validPlans[0] ?? null;
  }, [plans, nowMs]);

  const draftNumberValue = (value: number | string) => {
    if (value === '' || Number(value) === 0) return '';
    return String(value);
  };

  const draftNumericTotal = (value: number | string) => Math.max(0, Number(value) || 0);

  const addDraftIncrement = () => {
    const pieces = draftNumericTotal(draft.producedQuantity) + draftNumericTotal(draftIncrement.pieces);
    const items = draftNumericTotal(draft.itemsQuantity) + draftNumericTotal(draftIncrement.items);
    const pallet = draftNumericTotal(draft.palletJackId) + draftNumericTotal(draftIncrement.pallet);
    const forklift = draftNumericTotal(draft.forkliftId) + draftNumericTotal(draftIncrement.forklift);

    updateDraftField('producedQuantity', pieces || '');
    updateDraftField('itemsQuantity', items || '');
    updateDraftField('palletJackId', String(pallet || ''));
    updateDraftField('forkliftId', String(forklift || ''));
    setDraftIncrement({ pieces: '', items: '', pallet: '', forklift: '' });
    setDraftModalOpen(false);
  };

  const openDraftModal = () => {
    setDraftIncrement({ pieces: '', items: '', pallet: '', forklift: '' });
    setDraftModalOpen(true);
  };

  const updateDraftField = <K extends keyof MobileDraft['payload']>(
    key: K,
    value: MobileDraft['payload'][K]
  ) => {
    draftDirtyRef.current = true;
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  useEffect(() => {
    if (
      !session ||
      !['EM_ANDAMENTO', 'FINALIZACAO_PENDENTE'].includes(session.status) ||
      draftLoadedSessionId.current !== session.id ||
      !draftDirtyRef.current
    ) {
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const expectedVersion = draftVersionRef.current;
        const result = await mobileUpdateDraft(session.id, draft, expectedVersion);
        if (result?.version) {
          draftVersionRef.current = result.version;
          setDraftVersion(result.version);
          draftDirtyRef.current = false;
        }
      } catch (err) {
        console.error('Erro ao salvar rascunho Mobile:', err);
        setError(err instanceof Error ? err.message : 'Não foi possível salvar o rascunho.');
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [draft, session?.id, session?.status]);

  const canConfirm = useMemo(() => {
    const produced = Number(draft.producedQuantity);
    const items = Number(draft.itemsQuantity);
    if (!draft.local.trim()) return false;
    if ([1, 2, 3].includes(session?.activity_code ?? 0) && (produced <= 0 || items <= 0)) return false;
    if (session?.activity_code === 1 && !draft.listId.trim()) return false;
    if (produced > 10000 && !draft.highQuantityConfirmed) return false;
    return true;
  }, [draft, session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 animate-spin text-blue-400" />
          <span className="text-sm text-slate-400">Carregando operação...</span>
        </div>
      </div>
    );
  }

  const startShift = () => {
    if (!currentPlan) {
      setError('Não existe um turno planejado disponível para este colaborador.');
      return;
    }
    mutate(() => mobileStartShift(currentPlan.id), 'Turno iniciado.');
  };

  const startActivity = () => {
    const type = activityTypes.find((item) => item.id === selectedActivityType);
    if (!type) {
      setError('Selecione a atividade.');
      return;
    }
    mutate(
      () => mobileStartActivity(shift!.id, type.id, '', ''),
      'Atividade iniciada.'
    );
  };

  const finishActivity = () => {
    if (!session) return;
    if (shift?.current_context === 'PARADA') {
      setError('Encerre a parada antes de finalizar a atividade.');
      return;
    }
    setDraftModalOpen(false);
    mutate(() => mobileBeginFinalization(session.id), 'Formulário final aberto.');
  };

  const confirmActivity = () => {
    if (!session) return;
    if (!canConfirm) {
      setError('Preencha os campos obrigatórios antes de confirmar.');
      return;
    }
    mutate(() => mobileConfirmActivity(session.id, draftVersion), 'Atividade confirmada.');
  };

  const startStop = () => {
    if (!session) return;
    if (!selectedStoppageType) {
      setError('Selecione o motivo da parada.');
      return;
    }
    mutate(
      () => mobileStartStoppage(session.id, selectedStoppageType, stoppageNotes),
      'Parada iniciada.'
    );
  };

  const resolveStop = () => {
    if (!session) return;
    mutate(
      () => mobileResolveStoppage(session.id, stoppageNotes),
      'Parada resolvida. Atividade retomada.'
    );
  };

  const endShift = () => {
    if (!shift) return;
    if (!window.confirm('Encerrar o turno agora?')) return;
    mutate(() => mobileEndShift(shift.id), 'Turno encerrado.');
  };

  const title = session
    ? `${session.activity_code} • ${session.activity_name}`
    : contextLabel(shift?.current_context ?? 'NAO_ALOCADO');

  const activeStoppageType = session?.active_stoppage_type_id
    ? stoppageTypes.find((item) => item.id === session.active_stoppage_type_id)
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <div className="mx-auto w-full max-w-md min-h-screen flex flex-col">
        <header className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-bold">Porto Brasil • Mobile</div>
              <div className="font-semibold text-base">{collaborator?.collaborator_name || userName}</div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="p-2.5 rounded-xl border border-slate-800 text-slate-400 active:bg-slate-800"
              aria-label="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <nav className="sticky top-[73px] z-10 bg-slate-950 border-b border-slate-800 px-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMobileTab('PRODUCAO')} className={`rounded-xl py-2.5 text-[11px] font-bold ${mobileTab === 'PRODUCAO' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>PRODUÇÃO</button>
            <button type="button" onClick={() => setMobileTab('HISTORICO')} className={`rounded-xl py-2.5 text-[11px] font-bold ${mobileTab === 'HISTORICO' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>HISTÓRICO</button>
            {managementRole && <button type="button" onClick={() => setMobileTab('PLANEJAMENTO')} className={`rounded-xl py-2.5 text-[11px] font-bold ${mobileTab === 'PLANEJAMENTO' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>PLANEJAMENTO</button>}
          </div>
        </nav>

        <main className="flex-1 px-4 py-4 pb-8 space-y-4">

          {mobileTab === 'HISTORICO' ? (
            <MobileHistory collaborator={collaborator} management={managementRole} />
          ) : mobileTab === 'PLANEJAMENTO' && managementRole ? (
            <ShiftPlanning compact />
          ) : managementRole && mobileTab === 'PRODUCAO' ? (
            <MobileAdminOperation />
          ) : (
            <>
          {(error || notice) && (
            <div className={`rounded-xl border px-3 py-3 text-sm ${
              error
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            }`}>
              {error || notice}
            </div>
          )}

          {!collaborator ? (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
                <div>
                  <h2 className="font-semibold">Aparelho não vinculado</h2>
                  <p className="mt-1 text-sm text-amber-100/80">
                    Este usuário ainda não possui um colaborador vinculado para operar no Mobile.
                  </p>
                </div>
              </div>
            </section>
          ) : !shift ? (
            <>
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <Clock3 className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Próximo turno</div>
                    <div className="font-semibold">{currentPlan ? 'Turno planejado' : 'Nenhum turno encontrado'}</div>
                  </div>
                </div>

                {currentPlan && (
                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Planejado</span>
                      <span className="font-mono">{formatClock(currentPlan.planned_start_at)} → {formatClock(currentPlan.planned_end_at)}</span>
                    </div>
                    {currentPlan.notes && (
                      <div className="text-xs text-slate-500">{currentPlan.notes}</div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!currentPlan || working}
                  onClick={startShift}
                  className="mt-5 w-full rounded-2xl bg-blue-600 py-4 font-bold text-white disabled:opacity-40 active:scale-[0.99]"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Play className="w-5 h-5" />
                    INICIAR TURNO
                  </span>
                </button>
              </section>
            </>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Turno</div>
                    <div className="font-mono text-sm">
                      {formatClock(shift.actual_start_at)} → {shift.actual_end_at ? formatClock(shift.actual_end_at) : 'aberto'}
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${contextTone(shift.current_context)}`}>
                    {contextLabel(shift.current_context)}
                  </div>
                </div>
                <div className="mt-4 rounded-2xl bg-slate-950 border border-slate-800 p-4 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Tempo desde início do turno</div>
                  <div className="mt-1 font-mono text-3xl font-bold tracking-wider">{formatElapsed(shift.actual_start_at, nowMs)}</div>
                </div>
              </section>

              {session && (
                <section className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                  <div className="p-4 border-b border-slate-800">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Atividade atual</div>
                    <div className="mt-1 text-lg font-bold">{title}</div>

                    {shift.current_context === 'PARADA' ? (
                      <div className="mt-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
                        <div className="flex items-center gap-2 text-rose-200 font-bold">
                          <Pause className="w-4 h-4" />
                          PARADA ABERTA
                        </div>
                        <div className="mt-1 text-sm text-rose-100/80">
                          {activeStoppageType
                            ? `${activeStoppageType.code} • ${activeStoppageType.name}`
                            : 'Motivo da parada'}
                        </div>
                        <div className="mt-3 font-mono text-2xl font-bold text-rose-100">
                          {formatElapsed(session.active_stoppage_started_at, nowMs)}
                        </div>
                        <div className="mt-1 text-[11px] text-rose-100/60">
                          O tempo da atividade está pausado enquanto a parada estiver aberta.
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                        <Clock3 className="w-4 h-4" />
                        {formatElapsed(session.started_at, nowMs)}
                        <span className="text-slate-700">•</span>
                        início {formatClock(session.started_at)}
                      </div>
                    )}
                  </div>

                  {(shift.current_context === 'INTERVALO' || shift.current_context === 'AUSENCIA') ? (
                    <div className="p-5 text-center space-y-4">
                      <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center ${
                        shift.current_context === 'INTERVALO'
                          ? 'bg-sky-500/10 text-sky-300'
                          : 'bg-violet-500/10 text-violet-300'
                      }`}>
                        {shift.current_context === 'INTERVALO' ? <Coffee className="w-7 h-7" /> : <UserRound className="w-7 h-7" />}
                      </div>
                      <div>
                        <div className="font-semibold">{contextLabel(shift.current_context)}</div>
                        <div className="text-sm text-slate-500 mt-1">
                          A atividade permanece aberta e será retomada ao encerrar este contexto.
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => mutate(
                          () => shift.current_context === 'INTERVALO'
                            ? mobileEndInterval(shift.id)
                            : mobileEndAbsence(shift.id),
                          'Contexto encerrado. Atividade retomada.'
                        )}
                        className="mobile-primary w-full"
                      >
                        <Play className="w-5 h-5" /> RETOMAR ATIVIDADE
                      </button>
                    </div>
                  ) : session.status === 'FINALIZACAO_PENDENTE' ? (
                    <div className="p-4 space-y-4">
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                        Finalização pendente. A atividade continua aberta até a confirmação do formulário.
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1 text-xs">
                          <span className="text-slate-400">Local *</span>
                          <input value={draft.local} onChange={(e) => updateDraftField('local', e.target.value)} className="mobile-input" />
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="text-slate-400">Lista</span>
                          <input value={draft.listId} onChange={(e) => updateDraftField('listId', e.target.value)} className="mobile-input" />
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="text-slate-400">Qtd. peças</span>
                          <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            autoFocus
                            value={draftNumberValue(draft.producedQuantity)}
                            onChange={(e) => updateDraftField(
                              'producedQuantity',
                              e.target.value === '' ? '' : Number(e.target.value)
                            )}
                            placeholder="Informe"
                            className="mobile-input text-base"
                          />
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="text-slate-400">Qtd. itens</span>
                          <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={draftNumberValue(draft.itemsQuantity)}
                            onChange={(e) => updateDraftField(
                              'itemsQuantity',
                              e.target.value === '' ? '' : Number(e.target.value)
                            )}
                            placeholder="Informe"
                            className="mobile-input text-base"
                          />
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="text-slate-400">Paleteira (paletes)</span>
                          <input type="number" min="0" inputMode="numeric" value={draftNumberValue(draft.palletJackId)} onChange={(e) => updateDraftField('palletJackId', e.target.value === '' ? '' : e.target.value)} className="mobile-input text-base" placeholder="Informe" />
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="text-slate-400">Empilhadeira (paletes)</span>
                          <input type="number" min="0" inputMode="numeric" value={draftNumberValue(draft.forkliftId)} onChange={(e) => updateDraftField('forkliftId', e.target.value === '' ? '' : e.target.value)} className="mobile-input text-base" placeholder="Informe" />
                        </label>
                      </div>

                      <label className="space-y-1 text-xs block">
                        <span className="text-slate-400">Observação</span>
                        <textarea value={draft.notes} onChange={(e) => updateDraftField('notes', e.target.value)} rows={3} className="mobile-input resize-none" />
                      </label>

                      {Number(draft.producedQuantity) > 10000 && (
                        <label className="flex items-center gap-3 text-sm text-amber-100">
                          <input
                            type="checkbox"
                            checked={draft.highQuantityConfirmed}
                            onChange={(e) => updateDraftField('highQuantityConfirmed', e.target.checked)}
                            className="w-5 h-5"
                          />
                          Confirmo a quantidade acima de 10.000 peças.
                        </label>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <button type="button" disabled={working} onClick={() => mutate(() => mobileCancelFinalization(session.id), 'Finalização cancelada.')} className="mobile-secondary">
                          <X className="w-4 h-4" /> VOLTAR
                        </button>
                        <button type="button" disabled={working || !canConfirm} onClick={confirmActivity} className="mobile-primary">
                          <Check className="w-4 h-4" /> CONFIRMAR
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">Rascunho da produção</div>
                            <div className="mt-1 text-sm text-slate-300">
                              Acumulado durante a atividade. Ainda não é produção oficial.
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={working}
                            onClick={openDraftModal}
                            className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-[11px] font-bold text-blue-200"
                          >
                            EDITAR
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Qtd. peças</div>
                            <div className="mt-1 font-mono text-2xl font-bold">{draftNumberValue(draft.producedQuantity) || '—'}</div>
                          </div>
                          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Qtd. itens</div>
                            <div className="mt-1 font-mono text-2xl font-bold">{draftNumberValue(draft.itemsQuantity) || '—'}</div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Paleteira</div>
                            <div className="mt-1 text-sm font-semibold">{draft.palletJackId || '—'}</div>
                          </div>
                          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Empilhadeira</div>
                            <div className="mt-1 text-sm font-semibold">{draft.forkliftId || '—'}</div>
                          </div>
                        </div>

                        <div className="mt-3 text-[11px] text-slate-500">
                          Você pode atualizar o acumulado várias vezes. O último valor salvo permanece disponível para a ficha final.
                        </div>
                      </div>

                      {draftModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3">
                          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">Rascunho acumulativo</div>
                                <div className="text-lg font-bold">Adicionar movimentação</div>
                              </div>
                              <button type="button" onClick={() => setDraftModalOpen(false)} className="p-2 rounded-xl border border-slate-700 text-slate-400">
                                <X className="w-5 h-5" />
                              </button>
                            </div>

                            <div className="mt-4 rounded-2xl bg-slate-950 border border-slate-800 p-3 text-xs">
                              <div className="text-slate-500">Acumulado atual</div>
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div><span className="text-slate-600">Peças</span><strong className="block text-lg">{draftNumberValue(draft.producedQuantity) || '—'}</strong></div>
                                <div><span className="text-slate-600">Itens</span><strong className="block text-lg">{draftNumberValue(draft.itemsQuantity) || '—'}</strong></div>
                                <div><span className="text-slate-600">Paleteira (paletes)</span><strong className="block text-lg">{draftNumberValue(draft.palletJackId) || '—'}</strong></div>
                                <div><span className="text-slate-600">Empilhadeira (paletes)</span><strong className="block text-lg">{draftNumberValue(draft.forkliftId) || '—'}</strong></div>
                              </div>
                            </div>

                            <div className="mt-4">
                              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Adicionar agora</div>
                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  ['Peças', 'pieces'],
                                  ['Itens', 'items'],
                                  ['Paleteira (paletes)', 'pallet'],
                                  ['Empilhadeira (paletes)', 'forklift']
                                ].map(([label, key], index) => (
                                  <label key={key} className="space-y-1 text-xs">
                                    <span className="text-slate-400">{label}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      inputMode="numeric"
                                      autoFocus={index === 0}
                                      value={draftIncrement[key as keyof typeof draftIncrement]}
                                      onChange={(e) => setDraftIncrement(current => ({ ...current, [key]: e.target.value }))}
                                      placeholder="+0"
                                      className="mobile-input text-base"
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={addDraftIncrement}
                              disabled={working || !Object.values(draftIncrement).some(value => Number(value) > 0)}
                              className="mobile-primary w-full mt-4"
                            >
                              ADICIONAR AO RASCUNHO
                            </button>
                          </div>
                        </div>
                      )}


                      {shift.current_context !== 'PARADA' && (
                        <button type="button" disabled={working} onClick={finishActivity} className="mobile-primary w-full">
                          <Check className="w-5 h-5" /> FINALIZAR ATIVIDADE
                        </button>
                      )}

                      {shift.current_context === 'PARADA' ? (
                        <button type="button" disabled={working} onClick={resolveStop} className="w-full rounded-2xl bg-emerald-600 py-4 font-bold flex items-center justify-center gap-2">
                          <Play className="w-5 h-5" /> RETOMAR ATIVIDADE
                        </button>
                      ) : (
                        <div className="space-y-3 pt-2 border-t border-slate-800">
                          <div className="text-[10px] uppercase tracking-widest text-slate-500">Registrar parada</div>
                          <select value={selectedStoppageType} onChange={(e) => setSelectedStoppageType(e.target.value)} className="mobile-input">
                            <option value="">Selecione o motivo</option>
                            {stoppageTypes.map((item) => (
                              <option key={item.id} value={item.id}>{item.code} • {item.name}</option>
                            ))}
                          </select>
                          <input value={stoppageNotes} onChange={(e) => setStoppageNotes(e.target.value)} placeholder="Observação (opcional)" className="mobile-input" />
                          <button type="button" disabled={working} onClick={startStop} className="w-full rounded-2xl bg-rose-600 py-4 font-bold flex items-center justify-center gap-2">
                            <Pause className="w-5 h-5" /> INICIAR PARADA
                          </button>
                        </div>
                      )}

                      {shift.current_context === 'ATIVIDADE' && (
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => {
                              const text = window.prompt('Motivo do intervalo:');
                              if (text?.trim()) mutate(() => mobileStartInterval(shift.id, text.trim()), 'Intervalo iniciado.');
                            }}
                            className="mobile-secondary"
                          >
                            <Coffee className="w-4 h-4" /> INTERVALO
                          </button>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => {
                              const text = window.prompt('Motivo da ausência:');
                              if (text?.trim()) mutate(() => mobileStartAbsence(shift.id, text.trim()), 'Ausência iniciada.');
                            }}
                            className="mobile-secondary"
                          >
                            <UserRound className="w-4 h-4" /> AUSÊNCIA
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={working}
                        onClick={() => {
                          const text = window.prompt('Motivo do cancelamento da atividade:');
                          if (text?.trim()) mutate(() => mobileCancelActivity(session.id, text.trim()), 'Atividade cancelada.');
                        }}
                        className="w-full py-3 text-xs text-slate-500"
                      >
                        Cancelar atividade
                      </button>
                    </div>
                  )}
                </section>
              )}

              {!session && shift.current_context === 'TRANSICAO' && (
                <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                  <div className="flex items-center gap-3">
                    <ArrowRight className="w-5 h-5 text-amber-300" />
                    <div>
                      <div className="font-semibold">Transição</div>
                      <div className="text-sm text-amber-100/70 mt-1">Procure a próxima atividade. O sistema não inicia outra automaticamente.</div>
                    </div>
                  </div>
                </section>
              )}

              {!session && (shift.current_context === 'NAO_ALOCADO' || shift.current_context === 'TRANSICAO') && (
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-300" />
                    <div className="font-semibold">Iniciar atividade</div>
                  </div>

                  <select value={selectedActivityType} onChange={(e) => setSelectedActivityType(e.target.value)} className="mobile-input">
                    <option value="">Selecione a atividade</option>
                    {activityTypes.map((item) => (
                      <option key={item.id} value={item.id}>{item.code} • {item.label}</option>
                    ))}
                  </select>

                  <button type="button" disabled={working} onClick={startActivity} className="mobile-primary w-full">
                    <Play className="w-5 h-5" /> INICIAR ATIVIDADE
                  </button>
                </section>
              )}

              {!session && (shift.current_context === 'INTERVALO' || shift.current_context === 'AUSENCIA') && (
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-center">
                  <div className="font-semibold">{contextLabel(shift.current_context)}</div>
                  <div className="text-sm text-slate-500 mt-1">O contexto atual está pausado até o encerramento.</div>
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => mutate(
                      () => shift.current_context === 'INTERVALO' ? mobileEndInterval(shift.id) : mobileEndAbsence(shift.id),
                      'Contexto encerrado.'
                    )}
                    className="mobile-primary mt-4 w-full"
                  >
                    <Play className="w-5 h-5" /> RETORNAR
                  </button>
                </section>
              )}

              {!session && shift.current_context !== 'INTERVALO' && shift.current_context !== 'AUSENCIA' && (
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        const text = window.prompt('Motivo do intervalo:');
                        if (text?.trim()) mutate(() => mobileStartInterval(shift.id, text.trim()), 'Intervalo iniciado.');
                      }}
                      className="mobile-secondary"
                    >
                      <Coffee className="w-4 h-4" /> INTERVALO
                    </button>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        const text = window.prompt('Motivo da ausência:');
                        if (text?.trim()) mutate(() => mobileStartAbsence(shift.id, text.trim()), 'Ausência iniciada.');
                      }}
                      className="mobile-secondary"
                    >
                      <UserRound className="w-4 h-4" /> AUSÊNCIA
                    </button>
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <button
                  type="button"
                  disabled={working || !!session}
                  onClick={endShift}
                  className="w-full rounded-2xl border border-rose-500/30 text-rose-300 py-4 font-bold disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-5 h-5" />
                  ENCERRAR TURNO
                </button>
                {session && (
                  <div className="text-center text-[11px] text-slate-600 mt-2">Finalize ou cancele a atividade antes de encerrar o turno.</div>
                )}
              </section>
            </>
          )}

          <button
            type="button"
            onClick={() => refresh()}
            disabled={working}
            className="w-full py-3 text-xs text-slate-600 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar estado
          </button>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
