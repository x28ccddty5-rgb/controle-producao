import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clock3, Play, RefreshCw, X } from 'lucide-react';
import {
  MobileDraft,
  MobileManagementSession,
  mobileAdminBeginFinalization,
  mobileAdminCancelActivity,
  mobileAdminCancelFinalization,
  mobileAdminConfirmActivity,
  mobileAdminGetOpenActivity,
  mobileAdminStartActivity,
  mobileAdminUpdateDraft,
  mobileGetActivityTypes,
  mobileGetServerTime
} from '../mobileSupabase';

type ActivityType = { id: string; code: number; label: string };

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
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function numberValue(value: number | string) {
  return value === '' || Number(value) === 0 ? '' : String(value);
}

export default function MobileAdminOperation() {
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [session, setSession] = useState<MobileManagementSession | null>(null);
  const [draft, setDraft] = useState<MobileDraft['payload']>(EMPTY_DRAFT);
  const [version, setVersion] = useState(1);
  const [selectedType, setSelectedType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const clockRef = useRef<{ serverNowMs: number; monotonicMs: number } | null>(null);
  const dirtyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const syncClock = useCallback((serverTime: string) => {
    const parsed = Date.parse(serverTime);
    if (!Number.isFinite(parsed)) throw new Error('Horário oficial inválido.');
    clockRef.current = { serverNowMs: parsed, monotonicMs: performance.now() };
    setNowMs(parsed);
  }, []);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [types, open, serverTime] = await Promise.all([
        mobileGetActivityTypes(),
        mobileAdminGetOpenActivity(),
        mobileGetServerTime()
      ]);
      setActivityTypes(types as ActivityType[]);
      syncClock(serverTime);
      setSession(open);
      if (open) {
        const payload = { ...EMPTY_DRAFT, ...(open.draft || {}) };
        if (!dirtyRef.current || open.version !== version) {
          setDraft(payload);
          setVersion(open.version);
          dirtyRef.current = false;
        }
      } else {
        setDraft(EMPTY_DRAFT);
        setVersion(1);
        dirtyRef.current = false;
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a operação administrativa.');
    } finally {
      setLoading(false);
    }
  }, [syncClock, version]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!clockRef.current) return;
      setNowMs(Math.floor(clockRef.current.serverNowMs + (performance.now() - clockRef.current.monotonicMs)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session || !dirtyRef.current || !['EM_ANDAMENTO', 'FINALIZACAO_PENDENTE'].includes(session.status)) return;
    const timer = window.setTimeout(async () => {
      try {
        const result = await mobileAdminUpdateDraft(session.id, draft, version);
        setVersion(result.version);
        dirtyRef.current = false;
        setSession(current => current ? { ...current, draft, version: result.version } : current);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Não foi possível salvar o rascunho.');
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, session?.id, session?.status, version]);

  const update = <K extends keyof MobileDraft['payload']>(key: K, value: MobileDraft['payload'][K]) => {
    dirtyRef.current = true;
    setDraft(current => ({ ...current, [key]: value }));
  };

  const start = async () => {
    if (!selectedType) {
      setError('Selecione a atividade.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      const opened = await mobileAdminStartActivity(selectedType);
      setSession({ ...opened, draft: { ...EMPTY_DRAFT, ...(opened.draft || {}) } });
      setDraft({ ...EMPTY_DRAFT, ...(opened.draft || {}) });
      setVersion(opened.version);
      dirtyRef.current = false;
      setSelectedType('');
      setNotice('Atividade administrativa iniciada.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar a atividade.');
    } finally {
      setWorking(false);
    }
  };

  const beginFinalization = async () => {
    if (!session) return;
    setWorking(true);
    setError('');
    try {
      const currentDraft = draft;
      if (dirtyRef.current) {
        const saved = await mobileAdminUpdateDraft(session.id, currentDraft, version);
        setVersion(saved.version);
        dirtyRef.current = false;
      }
      const opened = await mobileAdminBeginFinalization(session.id);
      setSession({ ...opened, draft: { ...EMPTY_DRAFT, ...(opened.draft || currentDraft) } });
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível abrir a ficha final.');
    } finally {
      setWorking(false);
    }
  };

  const canConfirm = Boolean(
    draft.local.trim() &&
    (![1, 2, 3].includes(session?.activity_code ?? 0) ||
      (Number(draft.producedQuantity) > 0 && Number(draft.itemsQuantity) > 0)) &&
    (session?.activity_code !== 1 || draft.listId.trim()) &&
    (Number(draft.producedQuantity) <= 10000 || draft.highQuantityConfirmed)
  );

  const confirm = async () => {
    if (!session || !canConfirm) {
      setError('Preencha os campos obrigatórios antes de confirmar.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      await mobileAdminConfirmActivity(session.id, version);
      setSession(null);
      setDraft(EMPTY_DRAFT);
      setVersion(1);
      setNotice('Atividade administrativa confirmada.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível confirmar a atividade.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Carregando operação...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-blue-300 font-bold">Operação administrativa</div>
        <h2 className="text-xl font-bold">Apontamento livre</h2>
        <p className="text-xs text-slate-500 mt-1">Sem turno, escala ou regras de jornada. A atividade ainda passa pela mesma ficha final e validações de produção.</p>
      </div>

      {(error || notice) && <div className={`rounded-xl border p-3 text-sm ${error ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{error || notice}</div>}

      {!session ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold"><Play className="w-5 h-5 text-blue-300" />Nova atividade</div>
          <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="mobile-input">
            <option value="">Selecione a atividade</option>
            {activityTypes.map(item => <option key={item.id} value={item.id}>{item.code} • {item.label}</option>)}
          </select>
          <button type="button" onClick={start} disabled={working} className="mobile-primary w-full">INICIAR ATIVIDADE</button>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Atividade atual</div>
            <div className="mt-1 text-lg font-bold">{session.activity_code} • {session.activity_name}</div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <Clock3 className="w-4 h-4" />
              {formatElapsed(session.started_at, nowMs)}
            </div>
          </div>

          {session.status === 'FINALIZACAO_PENDENTE' ? (
            <div className="p-4 space-y-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">Ficha final aberta. A atividade continua aberta até confirmar.</div>
              <FinalForm activityCode={session.activity_code} draft={draft} update={update} canConfirm={canConfirm} working={working} onBack={async () => {
                setWorking(true);
                try {
                  const open = await mobileAdminCancelFinalization(session.id);
                  setSession({ ...open, draft: { ...EMPTY_DRAFT, ...(open.draft || draft) } });
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Não foi possível voltar.');
                } finally {
                  setWorking(false);
                }
              }} onConfirm={confirm} />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
                <div className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">Rascunho</div>
                <div className="text-sm text-slate-400 mt-1">Acumulado persistente, ainda não oficial.</div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {[
                    ['Peças', numberValue(draft.producedQuantity)],
                    ['Itens', numberValue(draft.itemsQuantity)],
                    ['Paleteira', draft.palletJackId],
                    ['Empilhadeira', draft.forkliftId]
                  ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-950 border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{label}</div><div className="font-mono text-xl font-bold mt-1">{value || '—'}</div></div>)}
                </div>
                <button type="button" onClick={() => setModalOpen(true)} disabled={working} className="mobile-secondary w-full mt-3">EDITAR RASCUNHO</button>
              </div>

              <button type="button" onClick={beginFinalization} disabled={working} className="mobile-primary w-full"><Check className="w-5 h-5" /> FINALIZAR ATIVIDADE</button>
              <button type="button" onClick={async () => {
                if (!window.confirm('Cancelar esta atividade administrativa?')) return;
                setWorking(true);
                try { await mobileAdminCancelActivity(session.id); setSession(null); setDraft(EMPTY_DRAFT); setNotice('Atividade cancelada.'); }
                catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível cancelar.'); }
                finally { setWorking(false); }
              }} className="w-full py-3 text-xs text-slate-500">Cancelar atividade</button>
            </div>
          )}
        </section>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-4 text-white">
            <div className="flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">Rascunho</div><div className="text-lg font-bold">Atualizar acumulado</div></div><button type="button" onClick={() => setModalOpen(false)} className="p-2 rounded-xl border border-slate-700"><X className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <NumericField label="Peças" value={draft.producedQuantity} onChange={v => update('producedQuantity', v)} />
              <NumericField label="Itens" value={draft.itemsQuantity} onChange={v => update('itemsQuantity', v)} />
              <NumericField label="Paleteira" value={draft.palletJackId} onChange={v => update('palletJackId', String(v))} />
              <NumericField label="Empilhadeira" value={draft.forkliftId} onChange={v => update('forkliftId', String(v))} />
            </div>
            <button type="button" onClick={() => setModalOpen(false)} className="mobile-primary w-full mt-4">CONCLUIR E SALVAR</button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumericField({ label, value, onChange, disabled = false }: { label: string; value: number | string; onChange: (value: string | number) => void; disabled?: boolean }) {
  return (
    <label className="space-y-1 text-xs">
      <span className="text-slate-400">{label}</span>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={numberValue(value)}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder="Informe"
        disabled={disabled}
        className={`mobile-input text-base ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
    </label>
  );
}

function FinalForm({
  draft,
  update,
  canConfirm,
  working,
  onBack,
  onConfirm,
  activityCode
}: {
  draft: MobileDraft['payload'];
  update: <K extends keyof MobileDraft['payload']>(key: K, value: MobileDraft['payload'][K]) => void;
  canConfirm: boolean;
  working: boolean;
  onBack: () => Promise<void>;
  onConfirm: () => Promise<void>;
  activityCode: number;
}) {
  const requiresQuantities = [1, 2, 3].includes(activityCode);
  const requiresList = activityCode === 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs"><span className="text-slate-400">Local *</span><input autoFocus value={draft.local} onChange={e => update('local', e.target.value)} className="mobile-input" /></label>
        <label className="space-y-1 text-xs">
          <span className="text-slate-400">{requiresList ? 'Lista *' : 'Lista'}</span>
          <input value={draft.listId} onChange={e => update('listId', e.target.value)} disabled={!requiresList} className={`mobile-input ${!requiresList ? 'opacity-50 cursor-not-allowed' : ''}`} />
        </label>
        <NumericField label={requiresQuantities ? 'Peças *' : 'Peças'} value={draft.producedQuantity} onChange={v => update('producedQuantity', v)} disabled={!requiresQuantities} />
        <NumericField label={requiresQuantities ? 'Itens *' : 'Itens'} value={draft.itemsQuantity} onChange={v => update('itemsQuantity', v)} disabled={!requiresQuantities} />
        <NumericField label="Paleteira" value={draft.palletJackId} onChange={v => update('palletJackId', String(v))} />
        <NumericField label="Empilhadeira" value={draft.forkliftId} onChange={v => update('forkliftId', String(v))} />
      </div>
      <label className="space-y-1 text-xs block"><span className="text-slate-400">Observação</span><textarea value={draft.notes} onChange={e => update('notes', e.target.value)} rows={3} className="mobile-input resize-none" /></label>
      {Number(draft.producedQuantity) > 10000 && <label className="flex items-center gap-3 text-sm text-amber-100"><input type="checkbox" checked={draft.highQuantityConfirmed} onChange={e => update('highQuantityConfirmed', e.target.checked)} className="w-5 h-5" />Confirmo a quantidade acima de 10.000 peças.</label>}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onBack} disabled={working} className="mobile-secondary"><X className="w-4 h-4" /> VOLTAR</button>
        <button type="button" onClick={onConfirm} disabled={working || !canConfirm} className="mobile-primary"><Check className="w-4 h-4" /> CONFIRMAR</button>
      </div>
    </div>
  );
}
