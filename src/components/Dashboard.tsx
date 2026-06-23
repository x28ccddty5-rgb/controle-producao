import React, { useMemo, useState } from 'react';
import { Activity, Stoppage } from '../types';
import { 
  TrendingUp, 
  Layers, 
  Clock, 
  AlertTriangle, 
  Award, 
  HelpCircle, 
  ShieldCheck, 
  Info,
  Calendar,
  Filter,
  CheckCircle,
  TrendingDown,
  User,
  Activity as ActivityIcon,
  Search,
  Users,
  Check,
  ChevronRight,
  BookOpen
} from 'lucide-react';
//import { motion } from 'motion/react';

interface DashboardProps {
  activities: Activity[];
  stoppages: Stoppage[];
  onQuickResolveStoppage: (stoppageId: string) => void;
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
function parseDateString(str: string): Date | null {
  if (!str) return null;
  if (str.includes('/')) {
    const [day, month, year] = str.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  if (str.includes('-')) {
    const [year, month, day] = str.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return null;
}

// Map classification to visual labels based on the requested rules
function getProductivityClass(indexVal: number): { label: string; bg: string; text: string; border: string; barBg: string } {
  if (indexVal >= 120) return { label: 'EXCELENTE', bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20', barBg: 'bg-emerald-500' };
  if (indexVal >= 105) return { label: 'ACIMA DA MÉDIA', bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', barBg: 'bg-blue-500' };
  if (indexVal >= 90) return { label: 'DENTRO DA MÉDIA', bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20', barBg: 'bg-amber-500' };
  if (indexVal >= 75) return { label: 'ATENÇÃO', bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20', barBg: 'bg-orange-500' };
  return { label: 'BAIXA PROD.', bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20', barBg: 'bg-red-500' };
}

export default function Dashboard({ activities, stoppages, onQuickResolveStoppage }: DashboardProps) {
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

  // Active Leaderboard Category Filter
  // 'GERAL' | 1 | 2 | 3
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<number | 'GERAL'>('GERAL');

  // Sector Comparison Chart Period Filter ('7D' | '30D' | 'GERAL')
  const [chartPeriodFilter, setChartPeriodFilter] = useState<'7D' | '30D' | 'GERAL'>('7D');

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

  // Check if string date matches the defined interval
  const isWithinPeriod = (dateStr: string) => {
    const recordDate = parseDateString(dateStr);
    if (!recordDate) return true;
    
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    return recordDate >= start && recordDate <= end;
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

  // --- 4. Category Baseline and Team Average Rates ---
  const sectorProductivityStats = useMemo(() => {
    const sectorsDef = [
      { code: 1, label: 'Separação' },
      { code: 2, label: 'Armazenamento' },
      { code: 3, label: 'Remontar Picadeiras' }
    ];

    return sectorsDef.map(sec => {
      // Completed items
      const records = filteredActivities.filter(a => a.activityCode === sec.code && a.status === 'CONCLUIDO');
      
      const opGroups: Record<string, { pieces: number; items: number; hours: number }> = {};
      records.forEach(r => {
        if (!opGroups[r.operator]) {
          opGroups[r.operator] = { pieces: 0, items: 0, hours: 0 };
        }
        opGroups[r.operator].pieces += r.producedQuantity || 0;
        opGroups[r.operator].items += r.itemsQuantity || 0;
        opGroups[r.operator].hours += r.durationHours || 0;
      });

      const operatorRates = Object.entries(opGroups).map(([op, data]) => {
        const pecasHora = data.hours > 0 ? (data.pieces / data.hours) : 0;
        const itensHora = data.hours > 0 ? (data.items / data.hours) : 0;
        return { operator: op, pecasHora, itensHora };
      });

      const operatorsWithWork = operatorRates.filter(o => o.pecasHora > 0 || o.itensHora > 0);
      const totalOps = operatorsWithWork.length;

      const sumPecasRate = operatorsWithWork.reduce((acc, o) => acc + o.pecasHora, 0);
      const sumItensRate = operatorsWithWork.reduce((acc, o) => acc + o.itensHora, 0);

      const mediaPecasHoraSector = totalOps > 0 ? (sumPecasRate / totalOps) : 0;
      const mediaItensHoraSector = totalOps > 0 ? (sumItensRate / totalOps) : 0;

      return {
        code: sec.code,
        label: sec.label,
        mediaPecasHora: mediaPecasHoraSector,
        mediaItensHora: mediaItensHoraSector,
        operatorRates,
        totalOperatorsCount: totalOps
      };
    });
  }, [filteredActivities]);

  // --- 5. Individual Sector Rankings and Team Averages ---
  const threeSectorsLeaderboard = useMemo(() => {
    return sectorProductivityStats.map(sec => {
      const topOps = sec.operatorRates.map(opRate => {
        let opIndex = 0;
        if (sec.mediaPecasHora > 0 && sec.mediaItensHora > 0) {
          opIndex = (((opRate.pecasHora / sec.mediaPecasHora) * 0.4) + ((opRate.itensHora / sec.mediaItensHora) * 0.6)) * 100;
        }
        return {
          operator: opRate.operator,
          indexVal: opIndex
        };
      }).filter(o => o.indexVal > 0)
        .sort((a, b) => b.indexVal - a.indexVal);

      const sumIndexes = topOps.reduce((acc, o) => acc + o.indexVal, 0);
      const teamAvg = topOps.length > 0 ? (sumIndexes / topOps.length) : 0;

      return {
        ...sec,
        topOps,
        teamAvg
      };
    });
  }, [sectorProductivityStats]);

  // --- NEW: Sector Comparison Chart Calculations ---
  const dynamicChartActivities = useMemo(() => {
    let filtered = activities;
    const today = new Date();
    
    if (chartPeriodFilter === '7D') {
      const limit = new Date();
      limit.setDate(today.getDate() - 7);
      filtered = activities.filter(act => {
        const d = parseDateString(act.date);
        return d && d >= limit && d <= today;
      });
    } else if (chartPeriodFilter === '30D') {
      const limit = new Date();
      limit.setDate(today.getDate() - 30);
      filtered = activities.filter(act => {
        const d = parseDateString(act.date);
        return d && d >= limit && d <= today;
      });
    } else {
      // GERAL: Period filtered by the header
      filtered = filteredActivities;
    }
    return filtered;
  }, [activities, filteredActivities, chartPeriodFilter]);

  const dynamicSectorStats = useMemo(() => {
    const sectorsDef = [
      { code: 1, label: 'Separação', meta: 1667 },
      { code: 2, label: 'Armazenamento', meta: 1458 },
      { code: 3, label: 'Remontar Picadeiras', meta: 42 }
    ];

    return sectorsDef.map(sec => {
      const records = dynamicChartActivities.filter(a => a.activityCode === sec.code && a.status === 'CONCLUIDO');
      
      let totalPieces = 0;

      let periodHours = 0;

      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      
      periodHours =
        (end.getTime() - start.getTime()) /
        (1000 * 60 * 60);

      records.forEach(r => {
        totalPieces += r.producedQuantity || 0;
      });

      const avgRate =
      periodHours > 0
        ? totalPieces / periodHours
        : 0;
      const pctOfMeta = (avgRate / sec.meta) * 100;

      return {
        ...sec,
        avgRate,
        pctOfMeta: Math.min(Math.max(pctOfMeta, 0), 100), // Clamp visual percentage for standard bar
        excelPctOfMeta: pctOfMeta > 100 ? Math.min(pctOfMeta - 100, 50) : 0, // surplus bar
        realPctOfMeta: pctOfMeta,
        totalPieces,
        periodHours
      };
    });
  }, [dynamicChartActivities]);

  // --- 6. Master Table Ranking Board (VBA Multi-Sector indices) ---
  const leaderBoard = useMemo(() => {
    const opsSet = new Set<string>();
    filteredActivities.forEach(a => { if (a.status === 'CONCLUIDO') opsSet.add(a.operator); });

    const rankings = Array.from(opsSet).map(opName => {
      const completedIndices: number[] = [];
      const activeSectors: number[] = [];

      sectorProductivityStats.forEach(sec => {
        // Skip irrelevant activities when filtering leaderboard specifically
        if (selectedActivityFilter !== 'GERAL' && sec.code !== selectedActivityFilter) {
          return;
        }

        const opRate = sec.operatorRates.find(r => r.operator === opName);
        if (opRate && (opRate.pecasHora > 0 || opRate.itensHora > 0)) {
          if (sec.mediaPecasHora > 0 && sec.mediaItensHora > 0) {
            const operatorIndex = ((opRate.pecasHora / sec.mediaPecasHora) * 0.4) + ((opRate.itensHora / sec.mediaItensHora) * 0.6);
            completedIndices.push(operatorIndex * 100);
            activeSectors.push(sec.code);
          }
        }
      });

      const totalActiveSectors = activeSectors.length;
      const somaIndices = completedIndices.reduce((a, b) => a + b, 0);
      const mediaIndice = totalActiveSectors > 0 ? (somaIndices / totalActiveSectors) : 0;

      // VBA Factor list for Polivalença
      let fatorPolivalencia = 0.9;
      if (totalActiveSectors === 2) {
        fatorPolivalencia = 1.0;
      } else if (totalActiveSectors >= 3) {
        fatorPolivalencia = 1.1;
      }

      // If specific activity is selected, factor is is disabled or 1.0
      const actualFactor = selectedActivityFilter === 'GERAL' ? fatorPolivalencia : 1.0;
      const rankingFinalValue = mediaIndice * actualFactor;

      return {
        operator: opName,
        mediaIndice,
        qtdeAtividades: totalActiveSectors,
        fatorPolivalencia: actualFactor,
        rankingFinal: rankingFinalValue,
        isRated: completedIndices.length > 0
      };
    }).filter(r => r.isRated);

    return rankings.sort((a, b) => b.rankingFinal - a.rankingFinal);
  }, [filteredActivities, sectorProductivityStats, selectedActivityFilter]);

  // --- 7. Insights from Period block ---
  const insights = useMemo(() => {
    const bestOverall = leaderBoard[0] || null;
    // For worst index, take highest non-empty, otherwise lowest
    const worstOverall = leaderBoard.length > 0 ? leaderBoard[leaderBoard.length - 1] : null;

    let leaderSep = '---';
    let valSep = 0;
    let leaderArm = '---';
    let valArm = 0;
    let leaderRem = '---';
    let valRem = 0;

    threeSectorsLeaderboard.forEach(s => {
      const topOp = s.topOps[0];
      if (topOp) {
        if (s.code === 1) { leaderSep = topOp.operator; valSep = topOp.indexVal; }
        else if (s.code === 2) { leaderArm = topOp.operator; valArm = topOp.indexVal; }
        else if (s.code === 3) { leaderRem = topOp.operator; valRem = topOp.indexVal; }
      }
    });

    // Sum pieces on all activities
    let totalPieces = 0;
    filteredActivities.forEach(a => {
      totalPieces += a.producedQuantity || 0;
    });

    return {
      bestOverallOperator: bestOverall ? bestOverall.operator : '---',
      bestOverallVal: bestOverall ? bestOverall.rankingFinal : 0,
      worstOverallOperator: worstOverall ? worstOverall.operator : '---',
      worstOverallVal: worstOverall ? worstOverall.rankingFinal : 0,
      totalPieces,
      leaderSep,
      valSep,
      leaderArm,
      valArm,
      leaderRem,
      valRem
    };
  }, [leaderBoard, threeSectorsLeaderboard, filteredActivities]);

  // --- 8. Team Distribution (Excel classifications) ---
  const teamDistribution = useMemo(() => {
    let excelente = 0;
    let acimaMedia = 0;
    let dentroMedia = 0;
    let atencao = 0;
    let baixaProd = 0;

    leaderBoard.forEach(row => {
      const r = row.rankingFinal;
      if (r >= 120) excelente++;
      else if (r >= 105) acimaMedia++;
      else if (r >= 90) dentroMedia++;
      else if (r >= 75) atencao++;
      else baixaProd++;
    });

    const total = leaderBoard.length || 1;

    return {
      totalEvaluated: leaderBoard.length,
      excelente,
      excelentePct: (excelente / total) * 100,
      acimaMedia,
      acimaMediaPct: (acimaMedia / total) * 100,
      dentroMedia,
      dentroMediaPct: (dentroMedia / total) * 100,
      atencao,
      atencaoPct: (atencao / total) * 100,
      baixaProd,
      baixaProdPct: (baixaProd / total) * 100,
    };
  }, [leaderBoard]);

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

      {/* SECTION: Hours Indicators (The top 4 colorful boxes matching the exact structure from the image) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-hours-indicators">
        
        {/* Box 1: HORAS PRODUÇÃO */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-xs flex flex-col justify-between" id="metric-horas-producao">
          <div>
            <p className="text-blue-500 text-xs font-bold uppercase tracking-wider text-center">Horas Produção</p>
            <h3 className="text-3xl font-extrabold text-blue-600 font-mono tracking-tight text-center mt-2">
              {formatMinutesToHoursColon(hoursMetrics.totalActivityMins)}
            </h3>
          </div>
          <p className="text-slate-400 text-[11px] text-center mt-3 font-medium">Total de horas de atividades</p>
        </div>

        {/* Box 2: HORAS PARADAS */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-xs flex flex-col justify-between" id="metric-horas-paradas">
          <div>
            <p className="text-red-500 text-xs font-bold uppercase tracking-wider text-center">Horas Paradas</p>
            <h3 className="text-3xl font-extrabold text-red-600 font-mono tracking-tight text-center mt-2">
              {formatMinutesToHoursColon(hoursMetrics.totalStoppageMins)}
            </h3>
          </div>
          <p className="text-slate-400 text-[11px] text-center mt-3 font-medium">Total de horas de paradas</p>
        </div>

        {/* Box 3: HORAS LÍQUIDAS */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-xs flex flex-col justify-between" id="metric-horas-liquidas">
          <div>
            <p className="text-emerald-500 text-xs font-bold uppercase tracking-wider text-center">Horas Líquidas</p>
            <h3 className="text-3xl font-extrabold text-emerald-600 font-mono tracking-tight text-center mt-2">
              {formatMinutesToHoursColon(hoursMetrics.totalLiqMins)}
            </h3>
          </div>
          <p className="text-slate-400 text-[11px] text-center mt-3 font-medium">Produção - Paradas</p>
        </div>

        {/* Box 4: EFICIÊNCIA */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-xs flex flex-col justify-between" id="metric-eficiencia">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-wider text-center">Eficiência</p>
            <h3 className="text-3xl font-extrabold text-amber-500 font-mono tracking-tight text-center mt-2">
              {hoursMetrics.efficiency.toFixed(1)}%
            </h3>
          </div>
          <p className="text-slate-400 text-[11px] text-center mt-3 font-medium">Produção/(Produção+Paradas)</p>
        </div>

      </div>

      {/* SECTION: Process Quantitative Blocks (User requested splitting separated / stored into 4 separate squares) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-process-squares">
        
        {/* Square A: Peças Separadas */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">Peças Separadas</span>
            <span className="text-2xl font-bold text-slate-800 font-mono block mt-1">
              {processBoxesMetrics.piecesSeparated.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="bg-blue-50 text-blue-500 p-2.5 rounded-lg shrink-0">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        {/* Square B: Peças Armazenadas */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">Peças Armazenadas</span>
            <span className="text-2xl font-bold text-slate-800 font-mono block mt-1">
              {processBoxesMetrics.piecesStored.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="bg-indigo-50 text-indigo-500 p-2.5 rounded-lg shrink-0">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* Square C: SKUs de Separação */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">SKUs de Separação</span>
            <span className="text-2xl font-bold text-slate-800 font-mono block mt-1">
              {processBoxesMetrics.itemsSeparated.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="bg-emerald-50 text-emerald-500 p-2.5 rounded-lg shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* Square D: SKUs de Armazenamento */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">SKUs de Armazenamento</span>
            <span className="text-2xl font-bold text-slate-800 font-mono block mt-1">
              {processBoxesMetrics.itemsStored.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="bg-teal-50 text-teal-500 p-2.5 rounded-lg shrink-0">
            <Clock className="h-5 w-5" />
          </div>
        </div>

      </div>

      {/* SECTION: Leaderboards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-rankings-layout">
        
        {/* LEFT COLUMN: Leaderboard Card (Com o filtro adicional de atividade individual/geral) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between" id="leaderboard-card-dynamic">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                  <Award className="h-5 w-5 text-blue-600" />
                  Ranking Colaboradores (Ranking Final)
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 font-sans">
                  Ponderação oficial com base em polivalência e ritmo real
                </p>
              </div>

              {/* FILTER ATIVIDADE 1,2,3 (As requested) */}
              <div className="flex items-center space-x-2 shrink-0">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={selectedActivityFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedActivityFilter(val === 'GERAL' ? 'GERAL' : Number(val));
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-600 font-bold font-sans text-xs outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="GERAL">Todas (Geral)</option>
                  <option value={1}>Atividade 1 (Separação)</option>
                  <option value={2}>Atividade 2 (Armazenamento)</option>
                  <option value={3}>Atividade 3 (Remontar Picadeiras)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none bg-slate-50/50">
                    <th className="py-2.5 text-center w-10">#</th>
                    <th className="py-2.5 px-2">Colaborador</th>
                    <th className="py-2.5 text-center font-sans">Média Índice</th>
                    <th className="py-2.5 text-center font-sans">Atividades</th>
                    <th className="py-2.5 text-center font-sans">Fator</th>
                    <th className="py-2.5 text-right font-sans pr-2">Ranking Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaderBoard.slice(0, 10).map((row, index) => {
                    const rating = getProductivityClass(row.rankingFinal);
                    const positionColor = 
                      index === 0 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 
                      index === 1 ? 'bg-slate-400/15 text-slate-600 border-slate-400/30' : 
                      index === 2 ? 'bg-amber-700/10 text-amber-700 border-amber-700/20' : 
                      'bg-slate-50 text-slate-500 border-slate-200';

                    return (
                      <tr key={row.operator} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 text-center font-mono font-bold select-none">
                          <span className={`inline-flex items-center justify-center w-5.5 h-5.5 rounded-full border text-xs ${positionColor}`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-bold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <span className="p-1 px-1.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[9px]">
                              {row.operator.slice(0, 3).toUpperCase()}
                            </span>
                            <span>{row.operator}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-center font-bold font-mono text-emerald-600">
                          {row.mediaIndice.toFixed(1)}
                        </td>
                        {/* Renamed/Repurposed to raw activities quantity count as requested! */}
                        <td className="py-2.5 text-center font-semibold text-slate-600">
                          {row.qtdeAtividades}
                        </td>
                        <td className="py-2.5 text-center font-semibold font-mono text-slate-500">
                          {row.fatorPolivalencia.toFixed(2)}
                        </td>
                        <td className="py-2.5 text-right pr-2">
                          <div className="flex flex-col items-end">
                            <span className="font-bold font-mono text-slate-800 text-sm">
                              {row.rankingFinal.toFixed(1)}
                            </span>
                            <span className={`text-[8px] px-1 py-0.5 rounded font-bold font-sans tracking-wide shrink-0 ${rating.bg} ${rating.text} border ${rating.border}`}>
                              {rating.label}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {leaderBoard.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                        <HelpCircle className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <span className="text-xs">Nenhum operador com dados concluídos no período.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Métricas de Produtividade do Setor */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between" id="sector-metrics-panel">
          <div>
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
              <TrendingUp className="h-5 w-5 text-blue-600 shrink-0" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                Métricas do Setor (Médias de Ritmo)
              </h3>
            </div>

            <p className="text-slate-400 text-[11px] mb-4 font-sans leading-relaxed">
              Indicador consolidado por hora produtiva ativa de cada setor de operação (Ritmo de Peças e SKUs)
            </p>

            <div className="flex flex-col gap-4">
              {sectorProductivityStats.map((sec) => {
                let colorTheme = {
                  text: 'text-emerald-700',
                  bg: 'bg-emerald-50',
                  border: 'border-emerald-100',
                  numText: 'text-emerald-600',
                };

                if (sec.code === 2) {
                  colorTheme = {
                    text: 'text-blue-700',
                    bg: 'bg-blue-50',
                    border: 'border-blue-100',
                    numText: 'text-blue-600',
                  };
                } else if (sec.code === 3) {
                  colorTheme = {
                    text: 'text-purple-700',
                    bg: 'bg-purple-50',
                    border: 'border-purple-100',
                    numText: 'text-purple-600',
                  };
                }

                return (
                  <div key={sec.code} className="border border-slate-150 rounded-lg overflow-hidden shrink-0">
                    <div className={`px-3 py-2 border-b flex justify-between items-center font-bold text-xs ${colorTheme.bg} ${colorTheme.text} ${colorTheme.border}`}>
                      <span className="uppercase tracking-wider">{sec.label}</span>
                      <span className="text-[10px] opacity-75">CÓD {sec.code}</span>
                    </div>

                    <div className="p-3.5 bg-slate-50/20 grid grid-cols-2 gap-3">
                      {/* Metric A: Peças/Hora */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Peças por Hora</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-xl font-black font-mono tracking-tight ${colorTheme.numText}`}>
                            {sec.mediaPecasHora.toFixed(1)}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold font-sans">pçs/h</span>
                        </div>
                      </div>

                      {/* Metric B: Itens/Hora (only relevant for Separação and Armazenamento) */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Itens/SKUs p/Hora</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black font-mono tracking-tight text-slate-700 block">
                            {sec.mediaItensHora.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Operational operators count info */}
                    <div className="bg-slate-50/80 px-3 py-1.5 border-t border-slate-150 flex justify-between items-center text-[10px] text-slate-500 font-medium">
                      <span>Colaboradores Operando:</span>
                      <span className="font-bold font-mono text-slate-700">{sec.totalOperatorsCount} ativos</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 text-[10px] text-slate-400 bg-slate-50/50 p-2.5 rounded-lg border border-slate-150 font-medium leading-relaxed">
            💡 Os ritmos são calculados em tempo real de forma ponderada com base nas horas úteis gastas em atividades consolidadas.
          </div>
        </div>

      </div>

      {/* SECTION: Insights Panel & Team Distribution Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-insights-distribution-layout">
        
        {/* Card: INSIGHTS DO PERÍODO */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 shadow-xs" id="insights-panel">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4">
            Insights do Período
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-4">
            
            {/* Row 1, Col 1: Melhor Ranking Geral */}
            <div className="bg-emerald-50/50 border border-emerald-100/75 p-3 rounded-lg flex items-center space-x-3">
              <div className="bg-emerald-500 text-white rounded-lg p-2 shrink-0">
                <Award className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Melhor Ranking</span>
                <span className="text-xs font-bold text-slate-700 block truncate">{insights.bestOverallOperator}</span>
                <span className="text-emerald-600 font-bold font-mono text-xs">{insights.bestOverallVal.toFixed(1)}</span>
              </div>
            </div>

            {/* Row 1, Col 2: Menor Ranking Geral */}
            <div className="bg-red-50/50 border border-red-100/75 p-3 rounded-lg flex items-center space-x-3">
              <div className="bg-red-500 text-white rounded-lg p-2 shrink-0">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Menor Ranking</span>
                <span className="text-xs font-bold text-slate-700 block truncate">{insights.worstOverallOperator}</span>
                <span className="text-red-500 font-bold font-mono text-xs">{insights.worstOverallVal.toFixed(1)}</span>
              </div>
            </div>

            {/* Row 1, Col 3: Total de Peças */}
            <div className="bg-blue-50/50 border border-blue-100/75 p-3 rounded-lg flex items-center space-x-3">
              <div className="bg-blue-500 text-white rounded-lg p-2 shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total de Peças</span>
                <span className="text-xs font-bold text-slate-700 block truncate">Geral Acumulativa</span>
                <span className="text-blue-600 font-extrabold font-mono text-sm">{insights.totalPieces.toLocaleString('pt-BR')}</span>
              </div>
            </div>

            {/* Row 1, Col 4: Horas Líquidas */}
            <div className="bg-indigo-50/50 border border-indigo-100/75 p-3 rounded-lg flex items-center space-x-3">
              <div className="bg-indigo-500 text-white rounded-lg p-2 shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Horas Líquidas</span>
                <span className="text-xs font-bold text-slate-700 block truncate">Tempo Efetivo</span>
                <span className="text-indigo-600 font-extrabold font-mono text-sm">{formatMinutesToHoursColon(hoursMetrics.totalLiqMins)}</span>
              </div>
            </div>

          </div>

          {/* Leaders of specific sector headers */}
          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Lider Separação */}
            <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-lg text-center font-sans text-xs flex flex-col justify-between">
              <div>
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Líder Separação</p>
                <p className="text-slate-700 font-bold mt-1 max-w-full truncate">{insights.leaderSep}</p>
              </div>
              <span className="text-emerald-500 font-bold font-mono text-xs mt-1.5 inline-block">
                {insights.valSep.toFixed(1)}
              </span>
            </div>

            {/* Lider Armazenamento */}
            <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-lg text-center font-sans text-xs flex flex-col justify-between">
              <div>
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Líder Armazenamento</p>
                <p className="text-slate-700 font-bold mt-1 max-w-full truncate">{insights.leaderArm}</p>
              </div>
              <span className="text-blue-500 font-bold font-mono text-xs mt-1.5 inline-block">
                {insights.valArm.toFixed(1)}
              </span>
            </div>

            {/* Lider Remontar */}
            <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-lg text-center font-sans text-xs flex flex-col justify-between">
              <div>
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Líder Remontar</p>
                <p className="text-slate-700 font-bold mt-1 max-w-full truncate">{insights.leaderRem}</p>
              </div>
              <span className="text-purple-500 font-bold font-mono text-xs mt-1.5 inline-block">
                {insights.valRem.toFixed(1)}
              </span>
            </div>

          </div>
        </div>

        {/* Card: DISTRIBUIÇÃO DA EQUIPE (Based on final ranking classifications) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between" id="team-distribution-panel">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3 mb-5">
              Distribuição da Equipe (Ranking Final)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-8 items-center py-4">
              
              {/* Semicircle indicator widget on left - ENLARGED to fill the container space */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center py-4 shrink-0 select-none">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" r="16" cx="18" cy="18" />
                    <circle 
                      className="text-blue-600" 
                      strokeDasharray="75, 100" 
                      strokeWidth="3.5" 
                      strokeLinecap="round" 
                      stroke="currentColor" 
                      fill="none" 
                      r="16" 
                      cx="18" 
                      cy="18" 
                    />
                  </svg>
                  <div className="text-center z-10">
                    <span className="text-5xl font-black text-slate-850 font-mono tracking-tight block">
                      {teamDistribution.totalEvaluated}
                    </span>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block mt-1">AVALIADOS</span>
                  </div>
                </div>
              </div>

              {/* Progress bars list on right matching screenshot style */}
              <div className="sm:col-span-7 space-y-4 font-sans text-xs">
                
                {/* 1. Excelente */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> EXCELENTE (≥120)</span>
                    <span className="font-mono bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700">{teamDistribution.excelente} op ({teamDistribution.excelentePct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${teamDistribution.excelentePct}%` }} />
                  </div>
                </div>

                {/* 2. Acima da media */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> ACIMA DA MÉDIA (105-120)</span>
                    <span className="font-mono bg-blue-50 px-1.5 py-0.5 rounded text-blue-700">{teamDistribution.acimaMedia} op ({teamDistribution.acimaMediaPct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${teamDistribution.acimaMediaPct}%` }} />
                  </div>
                </div>

                {/* 3. Dentro da media */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> DENTRO DA MÉDIA (90-105)</span>
                    <span className="font-mono bg-amber-50 px-1.5 py-0.5 rounded text-amber-700">{teamDistribution.dentroMedia} op ({teamDistribution.dentroMediaPct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${teamDistribution.dentroMediaPct}%` }} />
                  </div>
                </div>

                {/* 4. Atencao */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> ATENÇÃO (75-90)</span>
                    <span className="font-mono bg-orange-50 px-1.5 py-0.5 rounded text-orange-700">{teamDistribution.atencao} op ({teamDistribution.atencaoPct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${teamDistribution.atencaoPct}%` }} />
                  </div>
                </div>

                {/* 5. Baixa Prod. */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> BAIXA PRODUTIVIDADE (&lt;75)</span>
                    <span className="font-mono bg-red-50 px-1.5 py-0.5 rounded text-red-700">{teamDistribution.baixaProd} op ({teamDistribution.baixaProdPct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${teamDistribution.baixaProdPct}%` }} />
                  </div>
                </div>

              </div>

            </div>
          </div>

          <div className="mt-4 text-[11px] text-slate-450 bg-slate-50 border border-slate-200 p-3 rounded-lg font-medium">
            💡 Classificação baseada no Ranking Final de cada colaborador ativo no período.
          </div>
        </div>

      </div>

      {/* NEW SECTION: COMPARATIVO METRICAS DO SETOR */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs select-none" id="sector-comparison-chart-container">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 mb-5 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">
                Indicadores do Setor vs Metas Estipuladas
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-1">
              Ritmo de produtividade real comparado com as métricas padrão do setor em diferentes intervalos de tempo
            </p>
          </div>

          {/* Period selector inside the chart */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setChartPeriodFilter('7D')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                chartPeriodFilter === '7D'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              1 Semana
            </button>
            <button
              onClick={() => setChartPeriodFilter('30D')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                chartPeriodFilter === '30D'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              1 Mês
            </button>
            <button
              onClick={() => setChartPeriodFilter('GERAL')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1 cursor-pointer ${
                chartPeriodFilter === 'GERAL'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="h-3 w-3" />
              Filtro Geral (Cabeçalho)
            </button>
          </div>
        </div>

        {/* COMPARATIVE BARS CONTAINER */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dynamicSectorStats.map((sec) => {
            const isMetaMet = sec.realPctOfMeta >= 100;
            const cardTheme = sec.code === 1 ? { border: 'border-emerald-100', bg: 'bg-emerald-500', pillBg: 'bg-emerald-50 text-emerald-700' } :
                             sec.code === 2 ? { border: 'border-blue-100', bg: 'bg-blue-600', pillBg: 'bg-blue-50 text-blue-700' } :
                             { border: 'border-purple-100', bg: 'bg-purple-600', pillBg: 'bg-purple-50 text-purple-700' };

            return (
              <div key={sec.code} className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-xs">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-slate-400 tracking-wider block uppercase">Setor</span>
                    <span className="text-[9px] font-mono text-slate-400 tracking-wider">CÓD {sec.code}</span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-800 tracking-tight">{sec.label}</h4>
                  
                  {/* METRICS ROW */}
                  <div className="grid grid-cols-2 gap-2 mt-3 select-none">
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Meta Setor</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm font-mono font-black text-slate-600">{sec.meta}</span>
                        <span className="text-[9px] text-slate-400 font-bold font-sans">pçs/h</span>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Realizado</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm font-mono font-black text-slate-800">{sec.avgRate.toFixed(1)}</span>
                        <span className="text-[9px] text-slate-400 font-bold font-sans">pçs/h</span>
                      </div>
                    </div>
                  </div>

                  {/* VISUAL COMPARE BAR CHART */}
                  <div className="mt-4 space-y-1.5 select-none text-[11px] font-sans">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-slate-500 font-medium">% da Meta Atingida</span>
                      <span className={`font-mono ${isMetaMet ? 'text-emerald-600' : 'text-slate-705'}`}>
                        {sec.realPctOfMeta.toFixed(1)}%
                      </span>
                    </div>

                    <div className="h-3 w-full bg-slate-200 border border-slate-200 rounded-full overflow-hidden flex relative shadow-inner">
                      {/* Anchor bar representing up to 100% */}
                      <div 
                        className={`h-full rounded-l-full transition-all duration-350 ease-out ${cardTheme.bg}`} 
                        style={{ width: `${sec.pctOfMeta}%`, borderRadius: sec.pctOfMeta === 100 ? '9999px 0 0 9999px' : '9999px' }} 
                      />
                      {/* Highlight Surplus bar above 100% */}
                      {sec.excelPctOfMeta > 0 && (
                        <div 
                          className="h-full bg-emerald-400 animate-pulse transition-all duration-350 ease-out" 
                          style={{ width: `${sec.excelPctOfMeta}%`, borderRadius: '0 9999px 9999px 0' }} 
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* STATUS FOOTER BADGE */}
                <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center text-[10px] font-extrabold uppercase select-none">
                  <div className="flex items-center gap-1.5">
                    {isMetaMet ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Atingida
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                        Abaixo
                      </span>
                    )}
                  </div>
                  
                  <span className="text-[10px] text-slate-400 font-mono font-bold">
                    {sec.periodHours > 0
                      ? `${sec.periodHours.toFixed(1)}h Período`
                      : 'Nenhum Lançamento'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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

      {/* FOOTER CALLOUT BOX (OBSERVAÇÕES block, styled with the yellow tint from the picture) */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5" id="dashboard-footer-notes">
        <h4 className="text-amber-800 font-bold uppercase tracking-wider text-[11px] mb-3 flex items-center gap-1.5 font-sans">
          <BookOpen className="h-4 w-4 text-amber-700" /> Observações & Metodologia
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-amber-900/80 text-xs font-medium">
          
          <div className="flex items-start space-x-2">
            <span className="text-amber-600 font-bold mt-0.5">🏆</span>
            <p>Melhor desempenho: colaborador ativo no período consultado com maior pontuação no Ranking Final.</p>
          </div>

          <div className="flex items-start space-x-2">
            <span className="text-amber-600 font-bold mt-0.5">⚡</span>
            <p>O Ranking Final considera a média dos índices produtivos individuais de todas as atividades, acrescido do fator polivalência.</p>
          </div>

          <div className="flex items-start space-x-2">
            <span className="text-amber-600 font-bold mt-0.5">⏱️</span>
            <p>Horas Líquidas representam o tempo acumulado realmente gasto em produção ativa (Atividades - Paradas).</p>
          </div>

          <div className="flex items-start space-x-2">
            <span className="text-amber-600 font-bold mt-0.5">⚠️</span>
            <p>Alerta: Colaboradores com pontuação de Ranking Final abaixo de 75 são qualificados sob atenção produtiva.</p>
          </div>

        </div>
      </div>

    </div>
  );
}
