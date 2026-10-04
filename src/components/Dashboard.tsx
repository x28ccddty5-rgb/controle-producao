import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Stoppage } from '../types';
import { mobileAdminGetDashboardJourney, MobileDashboardJourney } from '../mobileSupabase';
import {
  TrendingUp,
  Layers,
  Clock,
  ShieldCheck,
  Calendar,
  CheckCircle,
  Activity as ActivityIcon,
  BookOpen
} from 'lucide-react';
//import { motion } from 'motion/react';

interface DashboardProps {
  activities: Activity[];
  stoppages: Stoppage[];
  onQuickResolveStoppage: (stoppageId: string) => void;
  onRefreshData: () => Promise<void>;
  canViewJourneyMetrics?: boolean;
}

// Convert hours and minutes from decimal to "HHH:MM" format
function formatMinutesToHoursColon(minutes: number) {
  const isNegative = minutes < 0;
  const absMins = Math.round(Math.abs(minutes));
  const h = Math.floor(absMins / 60);
  const m = absMins % 60;
  const sign = isNegative ? "-" : "";
  return `${sign}${h}:${m.toString().padStart(2, '0')}`;
}

// Helper to parse date representation from "DD/MM/YYYY" or "YYYY-MM-DD" to standard Date object
function normalizeOperationalDate(str: string): string | null {
  if (!str) return null;

  const trimmed = str.trim();

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  return null;
}

export default function Dashboard({
  activities,
  stoppages,
  onQuickResolveStoppage,
  onRefreshData,
  canViewJourneyMetrics = false
}: DashboardProps) {
  // --- 1. Date Interval Period State ---
  const [startDate, setStartDate] = useState(() => {
    // Default to '2026-06-01' during demo or start of month
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });

  const [endDate, setEndDate] = useState(() => {
    // Default to '2026-06-06' or today
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [journeyMetrics, setJourneyMetrics] = useState<MobileDashboardJourney>({
    rows: [],
    total_overtime_minutes: 0
  });
  const [journeyLoading, setJourneyLoading] = useState(false);

  // Trigger period updates quickly
  const handleQuickPeriodSelect = (period: string) => {
    const today = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${m}-${day}`;
    };

    if (period === 'HOJE') {
      setStartDate(formatDate(today));
      setEndDate(formatDate(today));
    } else if (period === 'ONTEM') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      setStartDate(formatDate(yesterday));
      setEndDate(formatDate(yesterday));
    } else if (period === 'SEMANA_ATUAL') {
      const currentDay = today.getDay();
      const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + distanceToMon);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(formatDate(monday));
      setEndDate(formatDate(sunday));
    } else if (period === 'SEMANA_PASSADA') {
      const currentDay = today.getDay();
      const distanceToLastMon = (currentDay === 0 ? -6 : 1 - currentDay) - 7;
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() + distanceToLastMon);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      setStartDate(formatDate(lastMonday));
      setEndDate(formatDate(lastSunday));
    } else if (period === 'MES_ATUAL') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(today));
    } else if (period === '7_DIAS') {
      const prior = new Date(today);
      prior.setDate(today.getDate() - 6);
      setStartDate(formatDate(prior));
      setEndDate(formatDate(today));
    } else if (period === '30_DIAS') {
      const prior = new Date(today);
      prior.setDate(today.getDate() - 29);
      setStartDate(formatDate(prior));
      setEndDate(formatDate(today));
    }
  };

  useEffect(() => {
    if (!canViewJourneyMetrics || !startDate || !endDate || startDate > endDate) {
      setJourneyMetrics({ rows: [], total_overtime_minutes: 0 });
      return;
    }

    let cancelled = false;
    setJourneyLoading(true);

    void mobileAdminGetDashboardJourney(startDate, endDate)
      .then(result => {
        if (!cancelled) setJourneyMetrics(result);
      })
      .catch(error => {
        console.error('Falha ao carregar horas extras da jornada Mobile:', error);
        if (!cancelled) setJourneyMetrics({ rows: [], total_overtime_minutes: 0 });
      })
      .finally(() => {
        if (!cancelled) setJourneyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canViewJourneyMetrics, startDate, endDate]);

  // Check if string date matches the defined interval
  const isWithinPeriod = (dateStr: string) => {
    const recordDate = normalizeOperationalDate(dateStr);
    if (!recordDate) return false;

    return recordDate >= startDate && recordDate <= endDate;
  };

  // Intermediary filtered collections
  const filteredActivities = useMemo(() => {
    return activities.filter(act => isWithinPeriod(act.date));
  }, [activities, startDate, endDate]);

  const filteredStoppages = useMemo(() => {
    return stoppages.filter(stop => isWithinPeriod(stop.date));
  }, [stoppages, startDate, endDate]);

  const activeStopsAlerts = useMemo(() => {
    return filteredStoppages.filter(s => s.status === 'ATIVA');
  }, [filteredStoppages]);

  // --- 2. Calculations for Core Hour Metrics (HHH:MM formatted) ---
  const hoursMetrics = useMemo(() => {
    let totalActivityMins = 0;
    let totalStoppageMins = 0;

    filteredActivities.forEach(act => {
      totalActivityMins += (act.durationHours || 0) * 60;
    });

    filteredStoppages.forEach(stop => {
      totalStoppageMins += stop.durationMinutes || 0;
    });

    const totalLiqMins = totalActivityMins - totalStoppageMins;
    
    // Efficiency calculation as per user formula: Produção / (Produção + Paradas)
    // where Produção is Horas Líquidas and (Produção + Paradas) counts as total activities hours.
    const efficiency = totalActivityMins > 0 ? (totalLiqMins / totalActivityMins) * 100 : 0;

    return {
      totalActivityMins,
      totalStoppageMins,
      totalLiqMins,
      efficiency: Math.max(0, efficiency)
    };
  }, [filteredActivities, filteredStoppages]);

  // --- 3. Calculations for Separate Process Process Boxes (Peças e SKUs) ---
  const processBoxesMetrics = useMemo(() => {
    let piecesSeparated = 0;
    let piecesStored = 0;
    let itemsSeparated = 0;
    let itemsStored = 0;

    filteredActivities.forEach(act => {
      if (act.activityCode === 1) { // Separação
        piecesSeparated += act.producedQuantity || 0;
        itemsSeparated += act.itemsQuantity || 0;
      } else if (act.activityCode === 2) { // Armazenamento
        piecesStored += act.producedQuantity || 0;
        itemsStored += act.itemsQuantity || 0;
      }
    });

    return {
      piecesSeparated,
      piecesStored,
      itemsSeparated,
      itemsStored
    };
  }, [filteredActivities]);

  // --- 4. Productivity by collaborator ---
  // This metric deliberately uses only official activity/stoppage records already
  // available to the Desktop dashboard. Shift-level transition/overtime will be
  // added when the dashboard consumes the mobile journey source directly.
  const collaboratorEfficiency = useMemo(() => {
    const operators = new Set<string>();
    filteredActivities.forEach(activity => operators.add(activity.operator));
    filteredStoppages.forEach(stoppage => operators.add(stoppage.operator));

    return Array.from(operators).map(operator => {
      const activityMinutes = filteredActivities
        .filter(activity => activity.operator === operator)
        .reduce((sum, activity) => sum + ((activity.durationHours || 0) * 60), 0);

      const stoppageMinutes = filteredStoppages
        .filter(stoppage => stoppage.operator === operator)
        .reduce((sum, stoppage) => sum + (stoppage.durationMinutes || 0), 0);

      const recordedMinutes = activityMinutes + stoppageMinutes;
      const efficiency = recordedMinutes > 0 ? (activityMinutes / recordedMinutes) * 100 : 0;
      const pieces = filteredActivities
        .filter(activity => activity.operator === operator)
        .reduce((sum, activity) => sum + (activity.producedQuantity || 0), 0);
      const items = filteredActivities
        .filter(activity => activity.operator === operator)
        .reduce((sum, activity) => sum + (activity.itemsQuantity || 0), 0);

      return {
        operator,
        activityMinutes,
        stoppageMinutes,
        recordedMinutes,
        efficiency,
        pieces,
        items,
        piecesPerHour: activityMinutes > 0 ? pieces / (activityMinutes / 60) : 0
      };
    }).sort((a, b) => b.recordedMinutes - a.recordedMinutes);
  }, [filteredActivities, filteredStoppages]);

  // --- 5. Ritmo por setor x metas operacionais existentes ---
  const dynamicSectorStats = useMemo(() => {
    const sectorsDef = [
      { code: 1, label: 'Separação', meta: 1458 },
      { code: 2, label: 'Armazenamento', meta: 1388 },
      { code: 3, label: 'Remontar Picadeiras', meta: 42 }
    ];

    return sectorsDef.map(sec => {
      const records = filteredActivities.filter(
        activity => activity.activityCode === sec.code && activity.status === 'CONCLUIDO'
      );
      const totalPieces = records.reduce(
        (sum, record) => sum + (record.producedQuantity || 0),
        0
      );
      const productiveMinutes = records.reduce(
        (sum, record) => sum + ((record.durationHours || 0) * 60),
        0
      );
      const avgRate = productiveMinutes > 0
        ? totalPieces / (productiveMinutes / 60)
        : 0;
      const pctOfMeta = sec.meta > 0 ? (avgRate / sec.meta) * 100 : 0;

      return {
        ...sec,
        avgRate,
        pctOfMeta: Math.min(Math.max(pctOfMeta, 0), 100),
        excelPctOfMeta: pctOfMeta > 100 ? Math.min(pctOfMeta - 100, 50) : 0,
        realPctOfMeta: pctOfMeta,
        totalPieces,
        productiveMinutes
      };
    });
  }, [filteredActivities]);

  // --- 9. Pareto Stoppages downtime list ---
  const stoppagesParetoRaw = useMemo(() => {
    const reasonsMap: Record<string, number> = {};
    filteredStoppages.forEach(s => {
      const name = s.stoppageName || 'Outros';
      reasonsMap[name] = (reasonsMap[name] || 0) + (s.durationMinutes || 0);
    });

    return Object.entries(reasonsMap).map(([name, mins]) => ({
      name,
      duration: mins
    })).sort((a, b) => b.duration - a.duration);
  }, [filteredStoppages]);

  return (
    <div className="space-y-6 bg-slate-100/50 p-6 rounded-2xl border border-slate-200" id="main-dashboard-wrap">
      
      {/* SECTION: Period Filters (styled exactly like the provided screenshot navbar block) */}
      <div 
        className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col xl:flex-row items-center justify-between gap-4"
        id="dashboard-filter-header"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto">
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-blue-600 shrink-0" />
            <span className="text-slate-800 font-bold uppercase tracking-wider text-xs lg:text-sm">Filtro de Período</span>
          </div>
          
          {/* Simple, easy-access top quick-period filter buttons */}
          <div className="flex flex-wrap gap-2 select-none">
            {[
              { id: 'ONTEM', label: 'Ontem' },
              { id: 'SEMANA_ATUAL', label: 'Semana Atual' },
              { id: 'SEMANA_PASSADA', label: 'Semana Passada' },
              { id: 'MES_ATUAL', label: 'Mês Atual' }
            ].map(btn => (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleQuickPeriodSelect(btn.id)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-200 transition-colors shadow-xs cursor-pointer"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-4 w-full xl:w-auto font-sans text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-medium whitespace-nowrap">Data Inicial:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-hidden focus:border-blue-500 font-mono text-xs cursor-pointer"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-medium whitespace-nowrap">Data Final:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-hidden focus:border-blue-500 font-mono text-xs cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => void onRefreshData()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg transition text-xs shrink-0 cursor-pointer shadow-xs uppercase tracking-wide"
          >
            Atualizar Dados
          </button>
        </div>
      </div>

      {/* SECTION: Active Stoppages Danger Banner */}
      {activeStopsAlerts.length > 0 && (
        <div
          className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-xs"
        >
          <div className="flex items-start space-x-3">
            <span className="relative flex h-3.5 w-3.5 mt-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
            </span>
            <div className="min-w-0">
              <h4 className="text-red-800 font-bold font-sans text-sm">
                Existem {activeStopsAlerts.length} paradas de colaboradores ativas!
              </h4>
              <p className="text-red-700 text-xs mt-0.5 truncate">
                Colaborador <span className="font-bold">{activeStopsAlerts[0].operator}</span> está inativo por <span className="underline">{activeStopsAlerts[0].stoppageName}</span> desde {activeStopsAlerts[0].startTime}.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {activeStopsAlerts.slice(0, 3).map((stop) => (
              <button
                key={stop.id}
                onClick={() => onQuickResolveStoppage(stop.id)}
                className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-md transition shadow-xs flex items-center space-x-1 cursor-pointer"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Encerrar Parada: {stop.operator}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SECTION: Jornada e operação */}
      <section className="space-y-3" id="dashboard-hours-indicators">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Resumo operacional</p>
            <h2 className="text-sm font-extrabold text-slate-800">Tempo e eficiência no período</h2>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-slate-500">
            Dados do período selecionado
          </span>
        </div>

        <div className={`grid grid-cols-2 ${canViewJourneyMetrics ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
          <div className="bg-white border border-blue-100 p-4 rounded-xl shadow-xs min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Horas produção</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-2xl xl:text-3xl font-extrabold text-blue-600 font-mono">{formatMinutesToHoursColon(hoursMetrics.totalActivityMins)}</span>
              <ActivityIcon className="h-4 w-4 text-blue-400 shrink-0 mb-1" />
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Tempo registrado em atividades</p>
          </div>

          <div className="bg-white border border-rose-100 p-4 rounded-xl shadow-xs min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Horas paradas</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-2xl xl:text-3xl font-extrabold text-rose-600 font-mono">{formatMinutesToHoursColon(hoursMetrics.totalStoppageMins)}</span>
              <ShieldCheck className="h-4 w-4 text-rose-400 shrink-0 mb-1" />
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Tempo acumulado de paradas</p>
          </div>

          <div className="bg-white border border-emerald-100 p-4 rounded-xl shadow-xs min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Horas líquidas</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-2xl xl:text-3xl font-extrabold text-emerald-600 font-mono">{formatMinutesToHoursColon(hoursMetrics.totalLiqMins)}</span>
              <Clock className="h-4 w-4 text-emerald-400 shrink-0 mb-1" />
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Produção menos paradas</p>
          </div>

          <div className="bg-white border border-amber-100 p-4 rounded-xl shadow-xs min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Eficiência</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-2xl xl:text-3xl font-extrabold text-amber-500 font-mono">{hoursMetrics.efficiency.toFixed(1)}%</span>
              <TrendingUp className="h-4 w-4 text-amber-400 shrink-0 mb-1" />
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Produção ÷ (produção + paradas)</p>
          </div>

          {canViewJourneyMetrics && (
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-xs min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Horas extras</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <span className="text-2xl xl:text-3xl font-extrabold text-orange-600 font-mono">
                  {journeyLoading ? '—:—' : formatMinutesToHoursColon(journeyMetrics.total_overtime_minutes)}
                </span>
                <Clock className="h-4 w-4 text-orange-500 shrink-0 mb-1" />
              </div>
              <p className="text-[10px] text-orange-700/70 mt-2">Após o fim previsto da escala</p>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2.5">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Composição do tempo registrado</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Distribuição entre atividade produtiva e parada.</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className="inline-flex items-center gap-1.5 text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500" /> Produção {hoursMetrics.totalActivityMins + hoursMetrics.totalStoppageMins > 0 ? ((hoursMetrics.totalActivityMins / (hoursMetrics.totalActivityMins + hoursMetrics.totalStoppageMins)) * 100).toFixed(1) : '0.0'}%</span>
              <span className="inline-flex items-center gap-1.5 text-rose-600"><span className="w-2 h-2 rounded-full bg-rose-500" /> Paradas {hoursMetrics.totalActivityMins + hoursMetrics.totalStoppageMins > 0 ? ((hoursMetrics.totalStoppageMins / (hoursMetrics.totalActivityMins + hoursMetrics.totalStoppageMins)) * 100).toFixed(1) : '0.0'}%</span>
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 flex">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${hoursMetrics.totalActivityMins + hoursMetrics.totalStoppageMins > 0 ? (hoursMetrics.totalActivityMins / (hoursMetrics.totalActivityMins + hoursMetrics.totalStoppageMins)) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-rose-500 transition-all"
              style={{ width: `${hoursMetrics.totalActivityMins + hoursMetrics.totalStoppageMins > 0 ? (hoursMetrics.totalStoppageMins / (hoursMetrics.totalActivityMins + hoursMetrics.totalStoppageMins)) * 100 : 0}%` }}
            />
          </div>
        </div>
      </section>

      {/* SECTION: Produção física */}
      <section className="space-y-3" id="dashboard-process-squares">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Produção física</p>
            <h2 className="text-sm font-extrabold text-slate-800">Volume consolidado</h2>
          </div>
          <span className="text-[10px] text-slate-400">Peças e itens registrados</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center justify-between min-w-0">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Peças separadas</span>
              <span className="text-xl font-bold text-slate-800 font-mono block mt-1">{processBoxesMetrics.piecesSeparated.toLocaleString('pt-BR')}</span>
            </div>
            <div className="bg-blue-50 text-blue-500 p-2 rounded-lg shrink-0"><CheckCircle className="h-4 w-4" /></div>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center justify-between min-w-0">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Peças armazenadas</span>
              <span className="text-xl font-bold text-slate-800 font-mono block mt-1">{processBoxesMetrics.piecesStored.toLocaleString('pt-BR')}</span>
            </div>
            <div className="bg-indigo-50 text-indigo-500 p-2 rounded-lg shrink-0"><Layers className="h-4 w-4" /></div>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center justify-between min-w-0">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">SKUs de separação</span>
              <span className="text-xl font-bold text-slate-800 font-mono block mt-1">{processBoxesMetrics.itemsSeparated.toLocaleString('pt-BR')}</span>
            </div>
            <div className="bg-emerald-50 text-emerald-500 p-2 rounded-lg shrink-0"><TrendingUp className="h-4 w-4" /></div>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center justify-between min-w-0">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">SKUs de armazenamento</span>
              <span className="text-xl font-bold text-slate-800 font-mono block mt-1">{processBoxesMetrics.itemsStored.toLocaleString('pt-BR')}</span>
            </div>
            <div className="bg-teal-50 text-teal-500 p-2 rounded-lg shrink-0"><Clock className="h-4 w-4" /></div>
          </div>
        </div>
      </section>

      {/* SECTION: Indicadores por colaborador */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs" id="dashboard-collaborator-efficiency">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <ActivityIcon className="h-5 w-5 text-blue-600" />
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">
                Eficiência por Colaborador
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Eficiência = tempo produtivo de atividades ÷ tempo operacional registrado (atividades + paradas).
            </p>
          </div>
          <div className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Sem classificação ou posição: apenas indicadores operacionais.
          </div>
        </div>

        {collaboratorEfficiency.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            Nenhum colaborador com registros no período selecionado.
          </div>
        ) : (
          <div className="max-h-[42vh] overflow-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider">
                  <th className="px-3 py-3">Colaborador</th>
                  <th className="px-3 py-3 text-right">Tempo produtivo</th>
                  <th className="px-3 py-3 text-right">Paradas</th>
                  <th className="px-3 py-3 text-right">Tempo registrado</th>
                  <th className="px-3 py-3 text-right">Eficiência</th>
                  <th className="px-3 py-3 text-right">Horas extras</th>
                  <th className="px-3 py-3 text-right">Peças</th>
                  <th className="px-3 py-3 text-right">Peças/h</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collaboratorEfficiency.map(row => {
                  const journey = journeyMetrics.rows.find(item => item.collaborator_name.toLocaleLowerCase() === row.operator.toLocaleLowerCase());
                  return (
                  <tr key={row.operator} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-bold text-slate-900 whitespace-nowrap">{row.operator}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatMinutesToHoursColon(row.activityMinutes)}</td>
                    <td className="px-3 py-3 text-right font-mono text-red-600">{formatMinutesToHoursColon(row.stoppageMinutes)}</td>
                    <td className="px-3 py-3 text-right font-mono font-semibold">{formatMinutesToHoursColon(row.recordedMinutes)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex min-w-[64px] justify-center rounded-full bg-emerald-50 px-2 py-1 font-bold font-mono text-emerald-700">
                        {row.efficiency.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-orange-600">
                      {journey ? formatMinutesToHoursColon(journey.overtime_minutes) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">{row.pieces.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-3 text-right font-mono">{row.piecesPerHour.toFixed(1)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION: Ritmo e meta por setor */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs" id="sector-metrics-panel">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-2 border-b border-slate-100 pb-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">Ritmo x meta por setor</h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Ritmo real calculado somente sobre o tempo produtivo das atividades concluídas, comparado às metas operacionais existentes.
            </p>
          </div>
          <span className="text-[10px] text-slate-400">Meta em peças por hora</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {dynamicSectorStats.map(sec => {
            const isMetaMet = sec.realPctOfMeta >= 100;
            const cardTheme = sec.code === 1
              ? { border: 'border-emerald-100', header: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' }
              : sec.code === 2
                ? { border: 'border-blue-100', header: 'bg-blue-50 text-blue-700', bar: 'bg-blue-600' }
                : { border: 'border-purple-100', header: 'bg-purple-50 text-purple-700', bar: 'bg-purple-600' };

            return (
              <article key={sec.code} className={`border ${cardTheme.border} rounded-xl overflow-hidden bg-slate-50/60`}>
                <div className={`px-4 py-2.5 border-b ${cardTheme.border} ${cardTheme.header} flex items-center justify-between`}>
                  <span className="text-xs font-extrabold">{sec.code} • {sec.label}</span>
                  <span className="text-[9px] font-mono opacity-70">CÓD {sec.code}</span>
                </div>

                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Peças</span>
                      <div className="text-base font-black font-mono text-slate-800 mt-1">{sec.totalPieces.toLocaleString('pt-BR')}</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Tempo</span>
                      <div className="text-base font-black font-mono text-slate-800 mt-1">{formatMinutesToHoursColon(sec.productiveMinutes)}</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Ritmo</span>
                      <div className="text-base font-black font-mono text-slate-800 mt-1">
                        {sec.avgRate.toFixed(1)}<span className="text-[8px] font-sans text-slate-400 ml-0.5">pç/h</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1.5">
                      <span className="font-bold text-slate-500">Meta: <span className="font-mono text-slate-700">{sec.meta.toLocaleString('pt-BR')} pç/h</span></span>
                      <span className={`font-bold font-mono ${isMetaMet ? 'text-emerald-600' : 'text-slate-600'}`}>{sec.realPctOfMeta.toFixed(1)}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cardTheme.bar}`}
                        style={{ width: `${sec.pctOfMeta}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase ${
                      isMetaMet ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isMetaMet ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {isMetaMet ? 'Meta atingida' : 'Abaixo da meta'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {sec.productiveMinutes > 0 ? 'Tempo produtivo utilizado' : 'Sem produção no período'}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* SECTION: Pareto Downtime Reasons (full width, since quick periods have been moved to the top filter header) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="pareto-periodos-rapidos-row">
        
        {/* Pareto Motivos de Parada Acumulado block (lg:col-span-12) */}
        <div className="lg:col-span-12 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between" id="stoppage-pareto-panel">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4">
              Motivos de Parada (Acumulado)
            </h3>
            <p className="text-[11px] text-slate-400 font-sans mb-5">
              Frequência de severidade de inatividade temporária por tempo acumulado no período selecionado (Gráfico de Pareto)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {stoppagesParetoRaw.slice(0, 10).map((item, index) => {
                const maxVal = stoppagesParetoRaw[0]?.duration || 1;
                const percentage = (item.duration / maxVal) * 100;
                
                // percentage of total stop time
                const totMins = hoursMetrics.totalStoppageMins || 1;
                const shareOfTotal = (item.duration / totMins) * 100;

                return (
                  <div key={item.name} className="space-y-1.5" id={`stoppage-row-${index}`}>
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-400 font-mono w-4">{index + 1}.</span>
                        <span className="font-bold text-slate-700">{item.name}</span>
                        <span className="text-slate-400 text-[10px]">({shareOfTotal.toFixed(1)}% do total)</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        {formatMinutesToHoursColon(item.duration)}
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-50 border border-slate-150 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-rose-500/95" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}

              {stoppagesParetoRaw.length === 0 && (
                <div className="md:col-span-2 text-center py-10 text-slate-400 font-medium">
                  <CheckCircle className="h-8 w-8 mx-auto text-emerald-300 mb-2" />
                  <span className="text-xs">Uau! Nenhuma parada foi registrada no período de consulta.</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* FOOTER CALLOUT BOX */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5" id="dashboard-footer-notes">
        <h4 className="text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-3 flex items-center gap-1.5 font-sans">
          <BookOpen className="h-4 w-4 text-blue-600" /> Observações & Metodologia
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-slate-600 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-0.5">01</span>
            <p><strong>Eficiência por colaborador</strong> usa tempo de atividades dividido pelo tempo operacional registrado em atividades + paradas.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold mt-0.5">02</span>
            <p><strong>Ritmo por setor</strong> preserva as metas operacionais já existentes e não cria uma nova regra de produtividade.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-600 font-bold mt-0.5">03</span>
            <p><strong>Horas extras e transição</strong> não são estimadas por lacunas entre lançamentos. Esses indicadores precisam usar os eventos oficiais da jornada Mobile para não misturar almoço, ausência ou tempo não alocado.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
