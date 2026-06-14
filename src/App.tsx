import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Stoppage, ProductionLog, ActivityStatus, CustomUser } from './types';
import { 
  INITIAL_ACTIVITIES, 
  INITIAL_STOPPAGES, 
  INITIAL_LOGS 
} from './initialData';
import {
  isSupabaseConfigured,

  dbFetchActivities,
  dbFetchStoppages,
  dbFetchLogs,

  dbFetchUsers,
  dbSaveUser,
  dbDeleteUser,

  dbFetchActivityTypes,
  dbSaveActivityType,
  dbDeleteActivityType,

  dbFetchStoppageTypes,
  dbSaveStoppageType,
  dbDeleteStoppageType,

  dbSaveActivity,
  dbSaveStoppage,
  dbSaveLog,

  dbDeleteActivity,
  dbDeleteStoppage,

  dbClearLogs
} from './supabase';
import Dashboard from './components/Dashboard';
import ActivityManagement from './components/ActivityManagement';
import StoppageManagement from './components/StoppageManagement';
import HistoryLogs from './components/HistoryLogs';
import AdminPanel from './components/AdminPanel';
import ProductionBatch from './components/ProductionBatch';
import { 
  Gauge, 
  Activity as ActivityIcon, 
  PowerOff, 
  FileText, 
  RefreshCw, 
  Trash2, 
  Factory, 
  Timer,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Unlock,
  User
} from 'lucide-react';
// import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEYS = {
  ACTIVITIES: 'production_activities_v2',
  STOPPAGES: 'production_stoppages_v2',
  LOGS: 'production_logs_v2'
};

const DEFAULT_USERS: CustomUser[] = [
  { username: 'producao', name: 'Sara', password: '1234', role: 'producao' },
  { username: 'lideranca', name: 'Jonas', password: 'ADM2026', role: 'lideranca' },
  { username: 'adm', name: 'Matheus', password: 'math2308', role: 'adm' },
  { username: 'visualizador', name: 'Visualizador', password: '2026', role: 'visualizador' }
];

function parseTimeToHours(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours + minutes / 60;
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

export default function App() {
  // 1. Core Persistent States
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stoppages, setStoppages] = useState<Stoppage[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);

  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const [editingStoppage, setEditingStoppage] = useState<Stoppage | null>(null);
  
  const [isInitializing, setIsInitializing] = useState(true);

  // Dynamic user list
 const [usersList, setUsersList] =
  useState<CustomUser[]>([]);

  const loadUsers = async () => {
  try {

    const users = await dbFetchUsers();

    if (users) {

      setUsersList(users);

      return;
    }

  } catch (err) {
    console.error(err);
  }

  const fallback =
    localStorage.getItem(
      'porto_custom_users_v2'
    );

  if (fallback) {
    setUsersList(JSON.parse(fallback));
  }
};

  const loadActivityTypes = async () => {

  const data = await dbFetchActivityTypes();

  if (!data) return;

  setActivitiesList(
    data.map(item => ({
      code: item.code,
      label: item.label
    }))
  );
};

const loadStoppageTypes = async () => {

  const data = await dbFetchStoppageTypes();

  if (!data) return;

  setStoppagesList(
    data.map(item => ({
      code: item.code,
      name: item.name
    }))
  );
};
  
  // Dynamic lists states for ADM management
  const [collaborators, setCollaborators] = useState<string[]>(() => {
    const saved = localStorage.getItem('porto_collaborators');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ['Sara', 'Carlos', 'Marcos', 'João', 'Rafael', 'Luan', 'Karl', 'Luis', 'Daniel'];
  });

  const [activitiesList, setActivitiesList] = useState<
  { code: number; label: string }[]
  >([]);

  const [stoppagesList, setStoppagesList] =
  useState<
    { code: number; name: string }[]
  >([]);

  // Global Launch metadata configured once by the launcher in the sidebar
  const [globalCreator, setGlobalCreator] = useState(() => {
    return localStorage.getItem('porto_global_creator') || 'Sara';
  });

  // Application Authentication Sessions (3 roles: producao / supervisor / visualizador)
  const [sessionUser, setSessionUser] = useState<'producao' | 'visualizador' | 'lideranca' | 'adm' |null>(() => {
    return (localStorage.getItem('porto_session_user') as 'producao' | 'visualizador' | 'lideranca' | 'adm') || null;
  });

  const [sessionUserName, setSessionUserName] = useState<string>(() => {
    return localStorage.getItem('porto_session_user_name') || 'Visitante';
  });

  // Entry tabs and states (register tab removed visually)
  const [loginTab, setLoginTab] = useState<'login' | 'register'>('login');
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // Register state
  const [registerName, setRegisterName] = useState<string>('');
  const [registerUsername, setRegisterUsername] = useState<string>('');
  const [registerPassword, setRegisterPassword] = useState<string>('');
  const [registerRole, setRegisterRole] = useState<'producao' | 'adm'>('producao');
  const [registerSuccess, setRegisterSuccess] = useState<string>('');
  const [showCredentialsHelp, setShowCredentialsHelp] = useState<boolean>(false);

  const handleLoginSubmit = () => {
    const usernameInput = loginUsername.trim().toLowerCase();
    const passwordInput = loginPassword.trim();

    if (!usernameInput) {
      setLoginError('Por favor, informe seu Usuário.');
      return;
    }
    if (!passwordInput) {
      setLoginError('Por favor, informe sua Senha.');
      return;
    }

    const matchedUser = usersList.find(
      u => u.username.toLowerCase() === usernameInput
    );

    if (!matchedUser) {
      setLoginError('Usuário não cadastrado.');
      return;
    }

    if (matchedUser.password !== passwordInput) {
      setLoginError('Senha incorreta.');
      return;
    }

    // Success!
    setSessionUser(matchedUser.role);
    setSessionUserName(matchedUser.name);
    setGlobalCreator(matchedUser.name);

    localStorage.setItem('porto_session_user', matchedUser.role);
    localStorage.setItem('porto_session_user_name', matchedUser.name);
    localStorage.setItem('porto_global_creator', matchedUser.name);

    setActiveTab(matchedUser.role === 'producao' ? 'ACTIVITIES' : 'DASHBOARD');
    setLoginPassword('');
    setLoginUsername('');
    setLoginError('');
    setRegisterSuccess('');
  };

  const handleRegisterSubmit = () => {
    const name = registerName.trim();
    const username = registerUsername.trim().toLowerCase();
    const password = registerPassword.trim();
    const role = registerRole;

    if (!name) {
      setLoginError('Por favor, digite o Nome do Colaborador.');
      return;
    }
    if (!username) {
      setLoginError('Por favor, defina um Usuário de Login.');
      ;
    }
    if (username.length < 3) {
      setLoginError('O usuário de login deve ter pelo menos 3 letras.');
      return;
    }
    if (!password) {
      setLoginError('Por favor, digite uma Senha.');
      return;
    }
    if (password.length < 4) {
      setLoginError('A senha deve ter pelo menos 4 dígitos.');
      return;
    }

    const userExists = usersList.some(u => u.username.toLowerCase() === username);
    if (userExists) {
      setLoginError('Este nome de usuário já está sendo utilizado.');
      return;
    }

    const existingUser = usersList.find(
    u => u.username === editingUsername
    );
    
    const newUser: CustomUser = {
      id: existingUser?.id,
    
      username,
      name,
      password,
      role: newUserRole
    };

    const updatedList = [...usersList, newUser];
    setUsersList(updatedList);
    localStorage.setItem('porto_custom_users_v2', JSON.stringify(updatedList));

    // Fill details for quick onboarding:
    setLoginUsername(username);
    setLoginPassword(password);
    setLoginTab('login');
    setLoginError('');
    setRegisterSuccess(`Perfil de "${name}" criado com sucesso! Use as credenciais abaixo para entrar.`);

    // Clear register fields
    setRegisterName('');
    setRegisterUsername('');
    setRegisterPassword('');
  };

  const handleLogout = () => {
    setSessionUser(null);
    setSessionUserName('Visitante');
    localStorage.removeItem('porto_session_user');
    localStorage.removeItem('porto_session_user_name');
    setLoginPassword('');
    setLoginUsername('');
    setLoginError('');
    setRegisterSuccess('');
  };

  const handleCreateUser = async (user: CustomUser) => {

  const success = await dbSaveUser(user);

  if (!success) {
    alert('Erro ao salvar usuário.');
    return;
  }

  await loadUsers();
};

const handleUpdateUser = async (user: CustomUser) => {

  const success = await dbSaveUser(user);

  if (!success) {
    alert('Erro ao atualizar usuário.');
    return;
  }

  await loadUsers();
};

const handleDeleteUser = async (
  username: string
) => {

  const success =
    await dbDeleteUser(username);

  if (!success) {
    alert('Erro ao excluir usuário.');
    return;
  }

  await loadUsers();
};

  const handleCreateActivityType = async (
  activityType: {
    code: number;
    label: string;
  }
) => {

  const success =
    await dbSaveActivityType(activityType);

  if (!success) {
    alert('Erro ao salvar atividade.');
    return;
  }

  await loadActivityTypes();
};

const handleDeleteActivityType = async (
  code: number
) => {

  const success =
    await dbDeleteActivityType(code);

  if (!success) {
    alert('Erro ao excluir atividade.');
    return;
  }

  await loadActivityTypes();
};

const handleCreateStoppageType = async (
  stoppageType: {
    code: number;
    name: string;
  }
) => {

  const success =
    await dbSaveStoppageType(stoppageType);

  if (!success) {
    alert('Erro ao salvar parada.');
    return;
  }

  await loadStoppageTypes();
};

const handleDeleteStoppageType = async (
  code: number
) => {

  const success =
    await dbDeleteStoppageType(code);

  if (!success) {
    alert('Erro ao excluir parada.');
    return;
  }

  await loadStoppageTypes();
};
  
  const handleSelectUser = (user: string) => {
    setGlobalCreator(user);
    localStorage.setItem('porto_global_creator', user);
  };

  const [globalLaunchDate, setGlobalLaunchDate] = useState(() => {
    const saved = localStorage.getItem('porto_global_launch_date');
    if (saved) return saved;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Active Navigation Tab
  // 'DASHBOARD' | 'PRODUCTION' | 'ACTIVITIES' | 'STOPPAGES' | 'HISTORY'
  const [activeTab, setActiveTab] = useState<string>(() => {
    const savedUser = localStorage.getItem('porto_session_user');
    return savedUser === 'producao'
      ? 'PRODUCTION'
      : 'DASHBOARD';
  });

  // Real-time server/clock to display in the header
  const [currentTime, setCurrentTime] = useState<string>('');

  // 2. Load from Supabase (or LocalStorage fallback)
  useEffect(() => {
    async function loadData() {
      try {
        if (isSupabaseConfigured()) {
          const acts = await dbFetchActivities();
          const stops = await dbFetchStoppages();
          
          const activityTypes =
            await dbFetchActivityTypes();
          const stoppageTypes =
            await dbFetchStoppageTypes();
          
          const pLogs = await dbFetchLogs();
          
          if (acts !== null && stops !== null && pLogs !== null) {

            setActivities(acts);
            setStoppages(stops);
            
            if (activityTypes) {
              setActivitiesList(
                activityTypes.map(item => ({
                  code: item.code,
                  label: item.label
                }))
              );
            }
            
            if (stoppageTypes) {
              setStoppagesList(
                stoppageTypes.map(item => ({
                  code: item.code,
                  name: item.name
                }))
              );
            }
            setLogs(pLogs);
            
            localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(acts));
            localStorage.setItem(STORAGE_KEYS.STOPPAGES, JSON.stringify(stops));
            localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(pLogs));
            setIsInitializing(false);
            return;
          }
        }
        
        // Local state fallback
        const savedActivities = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
        const savedStoppages = localStorage.getItem(STORAGE_KEYS.STOPPAGES);
        const savedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);

        if (savedActivities && savedStoppages && savedLogs) {
          // Se contiver dados demonstração do mock original, limpamos automaticamente para a nova operação real
          if (savedActivities.includes('act-active-demo-1') || savedActivities.includes('20260510_KARL-2') || savedActivities.includes('20260510_KARL-3')) {
            persistData([], [], []);
          } else {
            persistData(
              JSON.parse(savedActivities),
              JSON.parse(savedStoppages),
              JSON.parse(savedLogs)
            );
          }
        } else {
          persistData(INITIAL_ACTIVITIES, INITIAL_STOPPAGES, INITIAL_LOGS);
        }
      } catch (e) {
        console.error('Falha ao ler dados:', e);
      } finally {
        
        await loadUsers();
        
        setIsInitializing(false);
      }
    }
    loadData();
  }, []);

  // Sync state helpers to update React state & LocalStorage synchronously
  function persistData(
    updatedActs: Activity[], 
    updatedStops: Stoppage[], 
    updatedLogs: ProductionLog[]
  ) {
    const validatedActs = updatedActs.map(act => ({
      ...act,
      durationHours: typeof act.durationHours === 'number' && !isNaN(act.durationHours)
        ? act.durationHours
        : parseTimeToHours(act.duration || '00:00')
    }));

    const validatedStops = updatedStops.map(stop => ({
      ...stop,
      durationMinutes: typeof stop.durationMinutes === 'number' && !isNaN(stop.durationMinutes)
        ? stop.durationMinutes
        : parseTimeToMinutes(stop.duration || '00:00')
    }));

    setActivities(validatedActs);
    setStoppages(validatedStops);
    setLogs(updatedLogs);

    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(validatedActs));
    localStorage.setItem(STORAGE_KEYS.STOPPAGES, JSON.stringify(validatedStops));
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updatedLogs));
  }

  // 3. Header Clock update
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 4. State modifications / Handlers
  
  // Create relative logs
  const createLog = (
    type: ProductionLog['type'], 
    description: string, 
    operator: string, 
    refId: string
  ): ProductionLog => {
    return {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      type,
      description,
      operator,
      referenceId: refId
    };
  };

  // Activity Start/Creation
  const handleAddActivity = (newActData: {
    operator: string;
    activityCode: number;
    local: string;
    listId: string;
    palletJackId: string;
    forkliftId: string;
    producedQuantity: number;
    itemsQuantity: number;
    notes?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    duration?: string;
    status?: ActivityStatus;
    isRetroactive: boolean;
  }) => {
    const activityMap: Record<number, string> = {
      1: 'Separação', 2: 'Armazenamento', 3: 'Remontar Picadeiras', 
      4: 'Trocar Strechs dos Pallets', 5: 'Movimentação', 6: 'Atualizar Etiquetas',
      7: 'Endereçamento', 8: 'Empilhamento', 9: 'Liberando peças do Forno',
      10: 'Inventário Rotativo', 11: 'Outros'
    };

    const isRetro = newActData.isRetroactive;
    const dateStr = newActData.date || new Date().toLocaleDateString('pt-BR');
    const startStr = newActData.startTime || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const endStr = isRetro ? newActData.endTime : undefined;

    // Build Porto Brasil unified ID: YYYYMMDD_OPERATOR
    const dateParts = dateStr.split('/');
    let formattedDateKey = dateStr;
    if (dateParts.length === 3) {
      formattedDateKey = `${dateParts[2]}${dateParts[1]}${dateParts[0]}`;
    } else {
      const ymd = dateStr.split('-');
      if (ymd.length === 3) {
        formattedDateKey = `${ymd[0]}${ymd[1]}${ymd[2]}`;
      }
    }
    const operatorKey = newActData.operator.toUpperCase().trim().replace(/\s+/g, '-');
    const prefix = `${formattedDateKey}_${operatorKey}`;
    const newId = `${prefix}_${Date.now()}`;

    let durStr = '00:00';

    if (
      isRetro &&
      newActData.startTime &&
      newActData.endTime
    ) {
    
      const [sh, sm] =
        newActData.startTime.split(':').map(Number);
    
      const [eh, em] =
        newActData.endTime.split(':').map(Number);
    
      let startMinutes =
      sh * 60 + sm;
    
      let endMinutes =
        eh * 60 + em;
      
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
      }
      
      const totalMinutes =
        endMinutes - startMinutes;
    
      const h =
        Math.floor(totalMinutes / 60);
    
      const m =
        totalMinutes % 60;
    
      durStr =
        `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }
    let durHours = parseTimeToHours(durStr);

    const newActivity: Activity = {
      id: newId,
      date: dateStr,
      operator: newActData.operator,
      activityCode: newActData.activityCode,
      activityName: activityMap[newActData.activityCode] || 'Outros',
      local: newActData.local,
      listId: newActData.listId,
      startTime: startStr,
      endTime: endStr,
      duration: durStr,
      durationHours: durHours,
      palletJackId: newActData.palletJackId,
      forkliftId: newActData.forkliftId,
      producedQuantity: newActData.producedQuantity,
      itemsQuantity: newActData.itemsQuantity,
      status: isRetro ? 'CONCLUIDO' : 'EM_ANDAMENTO',
      notes: newActData.notes,
      creator: globalCreator,
      createdAt: (() => {
        const datePartsGlobal = globalLaunchDate.split('-');
        return datePartsGlobal.length === 3 
          ? `${datePartsGlobal[2]}/${datePartsGlobal[1]}/${datePartsGlobal[0]}` 
          : globalLaunchDate;
      })()
    };

    const description = `Instanciada atividade de '${newActivity.activityName}' para o colaborador '${newActivity.operator}' no Local '${newActivity.local}', Lista ${newActivity.listId || 'N/A'}.`;
    const newLog = createLog('ATIVIDADE_INICIO', description, newActivity.operator, newId);
    
    persistData(
    [newActivity, ...activities],
    stoppages,
    [newLog, ...logs]
    );

    if (isSupabaseConfigured()) {
      dbSaveActivity(newActivity);
      dbSaveLog(newLog);
    }
  };

  // Activity update quantity adjustments
  const handleUpdateActivityQuantity = (activityId: string, produced: number, items: number) => {
    const updatedActs = activities.map(act => {
      if (act.id === activityId) {
        return {
          ...act,
          producedQuantity: produced,
          itemsQuantity: items
        };
      }
      return act;
    });

    const targetAct = activities.find(a => a.id === activityId);
    if (!targetAct) return;

    const diff = produced - targetAct.producedQuantity;
    const itemsDiff = items - targetAct.itemsQuantity;
    const detailParts: string[] = [];
    if (diff !== 0) detailParts.push(`${diff > 0 ? '+' : ''}${diff} peças`);
    if (itemsDiff !== 0) detailParts.push(`${itemsDiff > 0 ? '+' : ''}${itemsDiff} itens`);

    const description = `Ajuste manual de quantidades no lote ${targetAct.listId || 'N/A'}: ${detailParts.join(' e ')}. Total: ${produced} peças, ${items} itens.`;
    const newLog = createLog('ATIVIDADE_ATUALIZACAO', description, targetAct.operator, activityId);

    persistData(updatedActs, stoppages, [newLog, ...logs]);

    if (isSupabaseConfigured()) {
      const actToSave = updatedActs.find(a => a.id === activityId);
      if (actToSave) {
        dbSaveActivity(actToSave);
      }
      dbSaveLog(newLog);
    }
  };

  // Activity Status Toggle (Complete, pause, resume)
  const handleUpdateActivityStatus = (activityId: string, status: ActivityStatus) => {
    const updatedActs = activities.map(act => {
      if (act.id === activityId) {
        const isComplete = status === 'CONCLUIDO';
        let endTimeStr = act.endTime;
        let durationStr = act.duration;
        let durationHoursVal = act.durationHours;

        if (isComplete) {
          endTimeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          // calculate duration from startTime to endTimeStr
          const startParts = act.startTime.split(':');
          const endParts = endTimeStr.split(':');
          let startMinutes = parseInt(startParts[0], 10) * 60 + (parseInt(startParts[1], 10) || 0);
          let endMinutes = parseInt(endParts[0], 10) * 60 + (parseInt(endParts[1], 10) || 0);
          if (endMinutes < startMinutes) endMinutes += 24 * 60; // Next day hours rollover
          const diffMinutes = endMinutes - startMinutes;
          
          const h = Math.floor(diffMinutes / 60);
          const m = diffMinutes % 60;
          durationStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          durationHoursVal = diffMinutes / 60;
        }

        return {
          ...act,
          status,
          endTime: endTimeStr,
          duration: durationStr,
          durationHours: durationHoursVal
        };
      }
      return act;
    });

    const targetAct = activities.find(a => a.id === activityId);
    if (!targetAct) return;

    let logType: ProductionLog['type'] = 'ATIVIDADE_ATUALIZACAO';
    let label = '';
    if (status === 'CONCLUIDO') {
      logType = 'ATIVIDADE_FIM';
      label = `Concluiu a atividade de ${targetAct.activityName} para ${targetAct.operator}. Total de Peças: ${targetAct.producedQuantity}, total Itens: ${targetAct.itemsQuantity}.`;
    } else if (status === 'PAUSADO') {
      label = `Pausou temporariamente a atividade de ${targetAct.activityName} para ${targetAct.operator}.`;
    } else if (status === 'EM_ANDAMENTO') {
      label = `Retomou a atividade de ${targetAct.activityName} para ${targetAct.operator}.`;
    }

    const newLog = createLog(logType, label, targetAct.operator, activityId);
    persistData(updatedActs, stoppages, [newLog, ...logs]);

    if (isSupabaseConfigured()) {
      const actToSave = updatedActs.find(a => a.id === activityId);
      if (actToSave) {
        dbSaveActivity(actToSave);
      }
      dbSaveLog(newLog);
    }
  };

  // Stoppage trigger
  const handleAddStoppage = (newStopData: {
    operator: string;
    stoppageCode: number;
    notes?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    duration?: string;
    status?: string;
    isWithActive?: boolean;
    isRetroactive: boolean;
    creator?: string;
    createdAt?: string;
  }) => {
    const stoppageMap: Record<number, string> = {
      1: 'BANHEIRO / ÁGUA', 2: 'TRABALHANDO EM OUTRO SETOR', 3: 'TREINAMENTO',
      4: 'REUNIÃO', 5: 'LIMPEZA DO SETOR', 6: 'AUXILIANDO FUNCIONÁRIO DE OUTRO SETOR',
      7: 'INVENTÁRIO', 8: 'EQUIPAMENTO COM PROBLEMA', 9: 'PROCURANDO PALETES NÃO ENCONTRADOS',
      10: 'CHECKLIST DO SETOR', 11: 'DESCARTE DE QUEBRA', 12: 'AUDITORIA DETALHADA',
      13: 'OUTROS'
    };

    const isRetro = newStopData.isRetroactive;
    const dateStr = newStopData.date || new Date().toLocaleDateString('pt-BR');
    const startStr = newStopData.startTime || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const endStr = isRetro ? newStopData.endTime : undefined;

    // Build Porto Brasil unified ID: YYYYMMDD_OPERATOR
    const stopDateParts = dateStr.split('/');
    let stopFormattedDateKey = dateStr;
    if (stopDateParts.length === 3) {
      stopFormattedDateKey = `${stopDateParts[2]}${stopDateParts[1]}${stopDateParts[0]}`;
    } else {
      const ymd = dateStr.split('-');
      if (ymd.length === 3) {
        stopFormattedDateKey = `${ymd[0]}${ymd[1]}${ymd[2]}`;
      }
    }
    const stopOperatorKey = newStopData.operator.toUpperCase().trim().replace(/\s+/g, '-');
    const stopPrefix = `${stopFormattedDateKey}_${stopOperatorKey}`;
    const newId = `${stopPrefix}_${Date.now()}`;

    let durStr = isRetro ? (newStopData.duration || '00:15') : '00:00';
    let durMinutes = parseTimeToMinutes(durStr);

    const newStoppage: Stoppage = {
      id: newId,
      date: dateStr,
      operator: newStopData.operator,
      stoppageCode: newStopData.stoppageCode,
      stoppageName: stoppageMap[newStopData.stoppageCode] || 'OUTROS',
      startTime: startStr,
      endTime: endStr,
      duration: durStr,
      durationMinutes: durMinutes,
      status: isRetro ? 'RESOLVIDA' : 'ATIVA',
      notes: newStopData.notes,
      creator: globalCreator,
      createdAt: (() => {
        const datePartsGlobal = globalLaunchDate.split('-');
        return datePartsGlobal.length === 3 
          ? `${datePartsGlobal[2]}/${datePartsGlobal[1]}/${datePartsGlobal[0]}` 
          : globalLaunchDate;
      })()
    };

    const description = `Registrou parada temporária de '${newStoppage.stoppageName}' para o colaborador '${newStoppage.operator}'.`;
    const newLog = createLog('PARADA_INICIO', description, newStoppage.operator, newId);

    // Pause active activities of this operator (Warehouse Automation Logic)
    const updatedActs = activities.map(act => {
      if (act.operator === newStoppage.operator && act.status === 'EM_ANDAMENTO') {
        return { ...act, status: 'PAUSADO' as ActivityStatus };
      }
      return act;
    });
    
    persistData(updatedActs, [newStoppage, ...stoppages.filter(s => s.id !== newId)], [newLog, ...logs]);

    if (isSupabaseConfigured()) {
      dbSaveStoppage(newStoppage);
      updatedActs.forEach(act => {
        if (act.operator === newStoppage.operator && act.status === 'PAUSADO') {
          dbSaveActivity(act);
        }
      });
      dbSaveLog(newLog);
    }
  };

    const handleAddBatch = (
  rows: any[],
  productionDate: string,
  collaborator: string
) => {

  const newActivities: Activity[] = [];

  const newStoppages: Stoppage[] = [];

  const newLogs: ProductionLog[] = [];

  rows.forEach(row => {

    if (row.type === 'ATIVIDADE') {

      const activityMap: Record<number, string> = {
        1: 'Separação',
        2: 'Armazenamento',
        3: 'Remontar Picadeiras',
        4: 'Trocar Strechs dos Pallets',
        5: 'Movimentação',
        6: 'Atualizar Etiquetas',
        7: 'Endereçamento',
        8: 'Empilhamento',
        9: 'Liberando peças do Forno',
        10: 'Inventário Rotativo',
        11: 'Outros'
      };

      const formattedDate =
      productionDate.split('-').reverse().join('/');
      
      const dateParts =
      productionDate.split('-');
    
    const formattedDateKey =
      `${dateParts[0]}${dateParts[1]}${dateParts[2]}`;
    
    const operatorKey =
      collaborator
        .toUpperCase()
        .trim()
        .replace(/\s+/g, '-');
    
    const id =
    `${formattedDateKey}_${operatorKey}_${Date.now()}_${row.id}`;

    const [sh, sm] =
    row.startTime.split(':').map(Number);
  
    const [eh, em] =
      row.endTime.split(':').map(Number);
    
    const totalMinutes =
      (eh * 60 + em) -
      (sh * 60 + sm);
    
    const duration =
      `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
    
    const durationHours =
      totalMinutes / 60;
      
      const activity: Activity = {
        id,
        date: formattedDate,
        operator: collaborator,

        activityCode: Number(row.code),
        activityName:
          activityMap[Number(row.code)] || 'Outros',

        local: row.local,
        listId: row.listId,

        startTime: row.startTime,
        endTime: row.endTime,

        duration,
        durationHours,

        palletJackId: row.palletJackId,
        forkliftId: row.forkliftId,

        producedQuantity:
          row.producedQuantity,

        itemsQuantity:
          row.itemsQuantity,

        status: 'CONCLUIDO',

        notes: row.notes,

        creator: globalCreator,

        createdAt:
          new Date().toLocaleString('pt-BR')
      };

      newActivities.push(activity);

        newLogs.push(
          createLog(
            'ATIVIDADE',
            `Atividade ${activity.activityName} lançada em lote`,
            collaborator,
            id
          )
        );
        
        }

    if (row.type === 'PARADA') {
      
      const stoppageMap: Record<number, string> = {
        1: 'BANHEIRO / ÁGUA',
        2: 'TRABALHANDO EM OUTRO SETOR',
        3: 'TREINAMENTO',
        4: 'REUNIÃO',
        5: 'LIMPEZA DO SETOR',
        6: 'AUXILIANDO FUNCIONÁRIO DE OUTRO SETOR',
        7: 'INVENTÁRIO',
        8: 'EQUIPAMENTO COM PROBLEMA',
        9: 'PROCURANDO PALETES NÃO ENCONTRADOS',
        10: 'CHECKLIST DO SETOR',
        11: 'DESCARTE DE QUEBRA',
        12: 'AUDITORIA DETALHADA',
        13: 'OUTROS'
      };

      const formattedDate =
      productionDate.split('-').reverse().join('/');
      
      const dateParts =
        productionDate.split('-');
      
      const formattedDateKey =
        `${dateParts[0]}${dateParts[1]}${dateParts[2]}`;
      
      const operatorKey =
        collaborator
          .toUpperCase()
          .trim()
          .replace(/\s+/g, '-');
      
      const id =
        `${formattedDateKey}_${operatorKey}_${Date.now()}_${row.id}`;
  
        const [sh, sm] =
        row.startTime.split(':').map(Number);
      
      const [eh, em] =
        row.endTime.split(':').map(Number);
      
      let startMinutes =
      sh * 60 + sm;

      let endMinutes =
        eh * 60 + em;
      
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
      }
      
      const totalMinutes =
        endMinutes - startMinutes;
      
      const duration =
        `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
            
      const stoppage: Stoppage = {
        id,
        date: formattedDate,
        operator: collaborator,

        stoppageCode:
          Number(row.code),

        stoppageName:
          stoppageMap[Number(row.code)] || 'OUTROS',

        startTime: row.startTime,
        endTime: row.endTime,

        duration,
        durationMinutes: totalMinutes,

        status: 'RESOLVIDA',

        notes: row.notes,

        creator: globalCreator,

        createdAt:
          new Date().toLocaleString('pt-BR')
      };

      newStoppages.push(stoppage);

      newLogs.push(
        createLog(
          'PARADA',
          `Parada ${stoppage.stoppageName} lançada em lote`,
          collaborator,
          id
        )
      );
      
      }
  });

  persistData(
    [...newActivities, ...activities],
    [...newStoppages, ...stoppages],
    [...newLogs, ...logs]
  );

    if (isSupabaseConfigured()) {
  
    newActivities.forEach(
      dbSaveActivity
    );
  
    newStoppages.forEach(
      dbSaveStoppage
    );
  
    newLogs.forEach(
      dbSaveLog
    );
  
  }
  
};
  
  // Stoppage Resolution
  const handleResolveStoppage = (stoppageId: string, notes?: string) => {
    const updatedStops = stoppages.map(stop => {
      if (stop.id === stoppageId) {
        const endTimeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        // calculate duration
        const startParts = stop.startTime.split(':');
        const endParts = endTimeStr.split(':');
        let startMinutes = parseInt(startParts[0], 10) * 60 + (parseInt(startParts[1], 10) || 0);
        let endMinutes = parseInt(endParts[0], 10) * 60 + (parseInt(endParts[1], 10) || 0);
        if (endMinutes < startMinutes) endMinutes += 24 * 60;
        const diffMinutes = endMinutes - startMinutes;

        const h = Math.floor(diffMinutes / 60);
        const m = diffMinutes % 60;
        const durationStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

        return {
          ...stop,
          status: 'RESOLVIDA' as const,
          endTime: endTimeStr,
          duration: durationStr,
          durationMinutes: diffMinutes,
          notes: notes?.trim() ? notes : stop.notes
        };
      }
      return stop;
    });

    const targetStop = stoppages.find(s => s.id === stoppageId);
    if (!targetStop) return;

    const description = `Parada do colaborador '${targetStop.operator}' (${targetStop.stoppageName}) foi RESOLVIDA.`;
    const newLog = createLog('PARADA_FIM', description, targetStop.operator, stoppageId);

    persistData(activities, updatedStops, [newLog, ...logs]);

    if (isSupabaseConfigured()) {
      const stopToSave = updatedStops.find(s => s.id === stoppageId);
      if (stopToSave) {
        dbSaveStoppage(stopToSave);
      }
      dbSaveLog(newLog);
    }
  };

  // Master Resets
  const handleResetToDemo = () => {
    if (confirm('Deseja restaurar os dados originais da planilha de Porto Brasil?')) {
      persistData(INITIAL_ACTIVITIES, INITIAL_STOPPAGES, INITIAL_LOGS);
      const defaultTab = sessionUser === 'adm' ? 'DASHBOARD' : 'ACTIVITIES';
      setActiveTab(defaultTab);
      if (isSupabaseConfigured()) {
        import('./supabase').then(({ supabase: sb }) => {
          if (sb) {
            sb.from('activities').delete().neq('id', '').then(() => {});
            sb.from('stoppages').delete().neq('id', '').then(() => {});
            sb.from('production_logs').delete().neq('id', '').then(() => {});
          }
        });
      }
    }
  };

  const handleWipeData = () => {
    if (confirm('ATENÇÃO: Deseja esvaziar permanentemente todos os registros deste terminal?')) {
      persistData([], [], []);
      const defaultTab = sessionUser === 'adm' ? 'DASHBOARD' : 'ACTIVITIES';
      setActiveTab(defaultTab);
      if (isSupabaseConfigured()) {
        import('./supabase').then(({ supabase: sb }) => {
          if (sb) {
            sb.from('activities').delete().neq('id', '').then(() => {});
            sb.from('stoppages').delete().neq('id', '').then(() => {});
            sb.from('production_logs').delete().neq('id', '').then(() => {});
          }
        });
      }
    }
  };

  // Excluir Lançamentos handles (Restrito a Matheus e Jonas com perfil ativo)
  const handleDeleteActivity = (id: string) => {
    const updated = activities.filter(a => a.id !== id);
    const target = activities.find(a => a.id === id);
    const label = target 
      ? `EXCLUSÃO DE REGISTRO: Atividade '${target.activityName}' do colaborador '${target.operator}' foi removida.`
      : `EXCLUSÃO DE REGISTRO: Atividade com ID ${id} foi removida.`;
    const newLog = createLog('ATIVIDADE_ATUALIZACAO', label, target?.operator || 'N/A', id);
    persistData(updated, stoppages, [newLog, ...logs]);

    if (isSupabaseConfigured()) {
      dbDeleteActivity(id);
      dbSaveLog(newLog);
    }
  };

  const handleDeleteStoppage = (id: string) => {
    const updated = stoppages.filter(s => s.id !== id);
    const target = stoppages.find(s => s.id === id);
    const label = target
      ? `EXCLUSÃO DE REGISTRO: Parada '${target.stoppageName}' do colaborador '${target.operator}' foi removida.`
      : `EXCLUSÃO DE REGISTRO: Parada com ID ${id} foi removida.`;
    const newLog = createLog('PARADA_FIM', label, target?.operator || 'N/A', id);
    persistData(activities, updated, [newLog, ...logs]);

    if (isSupabaseConfigured()) {
      dbDeleteStoppage(id);
      dbSaveLog(newLog);
    }
  };

  const handleEditActivity = (activity: Activity) => {
  setEditingActivity(activity);
  setActiveTab('ACTIVITIES');
  };

  const handleEditStoppage = (stoppage: Stoppage) => {
  setEditingStoppage(stoppage);
  setActiveTab('STOPPAGES');
  };
  
  const handleUpdateActivity = (updatedActivity: Activity) => {

   const updatedActivities = activities.map(act =>
    act.id === updatedActivity.id
      ? updatedActivity
      : act
  );

  const description =
    `Edição manual da atividade '${updatedActivity.activityName}' do colaborador '${updatedActivity.operator}'.`;

  const newLog = createLog(
    'ATIVIDADE_ATUALIZACAO',
    description,
    updatedActivity.operator,
    updatedActivity.id
  );

  persistData(
    updatedActivities,
    stoppages,
    [newLog, ...logs]
  );

  if (isSupabaseConfigured()) {
    dbSaveActivity(updatedActivity);
    dbSaveLog(newLog);
  }

  setEditingActivity(null);
};
    
  const handleUpdateStoppage = (updatedStoppage: Stoppage) => {

  const updatedStoppages = stoppages.map(stop =>
    stop.id === updatedStoppage.id
      ? updatedStoppage
      : stop
  );

  const description =
    `Edição manual da parada '${updatedStoppage.stoppageName}' do colaborador '${updatedStoppage.operator}'.`;

  const newLog = createLog(
    'PARADA_ATUALIZACAO',
    description,
    updatedStoppage.operator,
    updatedStoppage.id
  );

  persistData(
    activities,
    updatedStoppages,
    [newLog, ...logs]
  );

  if (isSupabaseConfigured()) {
    dbSaveStoppage(updatedStoppage);
    dbSaveLog(newLog);
  }

  setEditingStoppage(null);
  };
    
 
  
  // Calculated Active Stoppages Count for Badges
  const activeStoppagesCount = useMemo(() => {
    return stoppages.filter(s => s.status === 'ATIVA').length;
  }, [stoppages]);

  const activeActivitiesCount = useMemo(() => {
    return activities.filter(a => a.status === 'EM_ANDAMENTO').length;
  }, [activities]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans">
        <div className="flex flex-col items-center space-y-4">
          <Factory className="h-12 w-12 text-blue-600 animate-bounce" />
          <p className="font-bold text-slate-700 text-sm">Carregando painel...</p>
        </div>
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans px-4 relative overflow-hidden" id="login-screen-wrapper">
        {/* Abstract background grids or shapes to evoke craftsmanship */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.12),rgba(255,255,255,0))]"></div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-md w-full relative z-10">
          {/* Logo & Brand Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xl border border-blue-500/20 shadow-blue-500/10">
              <Factory className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold font-sans tracking-tight text-white uppercase">Porto Brasil</h1>
            <p className="text-slate-400 text-xs mt-1 font-mono uppercase tracking-widest text-[10px]">Apontamento de Movimentação & Paradas</p>
          </div>

          {/* Form Card */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-7 shadow-2xl backdrop-blur-md space-y-5">
            
            <div className="space-y-1 text-center border-b border-slate-850 pb-3">
              <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Acesso Restrito</h2>
              <p className="text-[10px] text-slate-400">Entre com as credenciais do seu colaborador</p>
            </div>

            {/* Error messages */}
            {loginError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3 rounded-xl font-medium text-center animate-shake">
                ⚠️ {loginError}
              </div>
            )}

            {/* Login view */}
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest">Usuário</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ex: producao, lideranca, adm"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLoginSubmit();
                    }}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded-xl px-4 py-3 text-white text-xs outline-hidden transition"
                    id="login-username-field"
                    autoFocus
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest font-sans">Senha de Segurança</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLoginSubmit();
                    }}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded-xl px-4 py-3 text-white text-xs font-mono outline-hidden tracking-widest transition"
                    id="login-password-field"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLoginSubmit}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition duration-150 cursor-pointer text-center outline-hidden uppercase tracking-wider mt-2 shadow-lg shadow-blue-500/10"
                id="btn-login-submit"
              >
                Entrar no Sistema
              </button>
            </div>
          </div>

          {/* Footer details */}
          <div className="text-center mt-6 text-slate-600 text-[10px] font-mono uppercase tracking-wider">
            PORTO-LOG v1.4.0 • Sistema Resiliente • Porto Brasil Cerâmica
          </div>
        </div>
      </div>
    );
  }

  const isAdmLoggedIn = 
    sessionUser === 'lideranca' ||
    sessionUser === 'adm';

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans overflow-hidden" id="main-application-panel">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 flex flex-col shrink-0 shadow-lg select-none">
        <div className="p-6 h-full flex flex-col justify-between">
          <div>
            {/* Sidebar Logo / Header */}
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                <Factory className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-white font-bold text-lg leading-tight block">Porto Brasil</span>
                <span className="text-blue-400 text-[10px] uppercase font-bold tracking-wider block">Movimentação</span>
              </div>
            </div>
            
            {/* Sidebar Navigation links */}
            <nav className="space-y-1">
              {(sessionUser === 'lideranca' ||
               sessionUser === 'adm' ||
               sessionUser === 'visualizador') && (
                <button
                  onClick={() => setActiveTab('DASHBOARD')}
                  id="tab-dashboard"
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left text-sm font-medium cursor-pointer ${
                    activeTab === 'DASHBOARD' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Gauge className="w-5 h-5 shrink-0" />
                  <span>Dashboard Geral</span>
                </button>
              )}

              {(sessionUser === 'producao' ||
                 sessionUser === 'lideranca' ||
                 sessionUser === 'adm') && (
                <>
                  <button
                    onClick={() => setActiveTab('PRODUCTION')}
                    id="tab-production"
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left text-sm font-medium relative cursor-pointer ${
                      activeTab === 'PRODUCTION'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <ActivityIcon className="w-5 h-5 shrink-0" />
                  
                    <span>Produção</span>
                  
                    {(activeActivitiesCount + activeStoppagesCount) > 0 && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                        {activeActivitiesCount + activeStoppagesCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('HISTORY')}
                    id="tab-history"
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left text-sm font-medium cursor-pointer ${
                      activeTab === 'HISTORY' 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <FileText className="w-5 h-5 shrink-0" />
                    <span>Histórico</span>
                  </button>

                  {sessionUser === 'adm' && (
                    <button
                      onClick={() => setActiveTab('ADMIN')}
                      id="tab-admin"
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left text-sm font-medium cursor-pointer ${
                        activeTab === 'ADMIN' 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Lock className="w-5 h-5 shrink-0" />
                      <span>Banco de Dados (ADM)</span>
                    </button>
                  )}
                </>
              )}
            </nav>

            {/* Global Launch Parameters Block (Configured Once) */}
            <div className="mt-8 p-4 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-4 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-blue-400 text-[10px] uppercase font-bold tracking-wider block">Informações da Sessão</span>
                <span className="inline-block bg-blue-500/10 text-blue-300 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">GLOBAL</span>
              </div>
              
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  Usuário Logado
                </label>
              
                <div className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-semibold">
                  {globalCreator}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest">Data</label>
                <div className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono">
                  {globalLaunchDate
                    ? new Date(globalLaunchDate + 'T00:00:00').toLocaleDateString('pt-BR')
                    : '--/--/----'}
                </div>
              </div>
            </div>

          </div>

          {/* User profile section with logout */}
          <div className="mt-auto border-t border-slate-800 pt-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-750 flex items-center justify-center text-xs font-bold text-blue-400 select-none shrink-0 border border-slate-700 uppercase font-mono">
                {sessionUser === 'adm' ? 'SU' : 'PR'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate">
                  {sessionUser === 'adm' ? 'ADM' : 'Operação Produção'}
                </p>
                <p className="text-slate-500 text-[10px] uppercase font-mono tracking-wider truncate">
                  {sessionUser === 'adm' ? 'Nível Gestão' : 'Acesso Operador'}
                </p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-450 hover:text-rose-450 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/20 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150"
              id="btn-sidebar-logout"
            >
              <PowerOff className="w-3.5 h-3.5 shrink-0" />
              <span>Sair do Terminal</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-slate-800">
              {activeTab === 'DASHBOARD' && "Dashboard Geral"}
              {activeTab === 'ACTIVITIES' && "Lançamento de Atividades & Lotes"}
              {activeTab === 'STOPPAGES' && "Controle de Paradas Temporárias"}
              {activeTab === 'HISTORY' && "Histórico & Auditoria Geral"}
            </h1>
            {activeTab !== 'DASHBOARD' && (
              <>
                <div className="text-slate-300 font-light hidden sm:block">|</div>
                <div className="text-xs text-slate-500 font-mono hidden sm:block">
                  HORA DO CHÃO: <span className="font-bold">{currentTime || '19:23:22'}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            {activeTab !== 'DASHBOARD' && (
              activeStoppagesCount > 0 ? (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold shadow-xs">
                  <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                  ATENÇÃO: {activeStoppagesCount} COLABORADORES EM PARADA
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold shadow-xs">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  FLUXO INTEGRAL DE MOVIMENTAÇÃO
                </div>
              )
            )}

            {/* Quick resets buttons */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/50 p-1 rounded-lg">
              <button
                onClick={handleResetToDemo}
                id="reset-demo-btn"
                title="Restaurar dados originais da planilha"
                className="text-slate-400 hover:text-slate-600 hover:bg-white p-1 rounded transition cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={handleWipeData}
                id="wipe-data-btn"
                title="Limpar todos os registros"
                className="text-red-400 hover:text-red-600 hover:bg-rose-50/50 p-1 rounded transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {activeTab !== 'DASHBOARD' && activeTab !== 'ACTIVITIES' && (
              <button
                onClick={() => setActiveTab('PRODUCTION')}
                id="tab-production"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left text-sm font-medium relative cursor-pointer ${
                  activeTab === 'PRODUCTION'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <ActivityIcon className="w-5 h-5 shrink-0" />
                <span>Produção</span>
              
                {(activeActivitiesCount + activeStoppagesCount) > 0 && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                    {activeActivitiesCount + activeStoppagesCount}
                  </span>
                )}
              </button>
            )}

            {/* Logoff Button */}
            <button
              onClick={handleLogout}
              id="header-logoff-btn"
              className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer shadow-xs whitespace-nowrap"
              title="Sair do terminal e desconectar conta"
            >
              <PowerOff className="h-4 w-4 shrink-0 text-rose-600" />
              <span>Logoff</span>
            </button>
          </div>
        </header>

        {/* Content Stages with standard design spacing */}
        <div className="p-8 flex-1 overflow-y-auto bg-slate-50/50 flex flex-col gap-6">
          <>
            <div className="w-full h-full">
              {activeTab === 'DASHBOARD' && (
                <Dashboard 
                  activities={activities} 
                  stoppages={stoppages} 
                  onQuickResolveStoppage={handleResolveStoppage}
                />
              )}

              {activeTab === 'PRODUCTION' && (
                <ProductionBatch
                  collaborators={collaborators}
                  activitiesList={activitiesList}
                  stoppagesList={stoppagesList}

                  onAddActivity={handleAddActivity}
                  onAddStoppage={handleAddStoppage}

                  onAddBatch={handleAddBatch}
                />
              )}
              
              {activeTab === 'ACTIVITIES' && (
                <ActivityManagement 
                activities={activities}
                onAddActivity={handleAddActivity}
                onUpdateActivity={handleUpdateActivity}
              
                onUpdateActivityQuantity={handleUpdateActivityQuantity}
                onUpdateActivityStatus={handleUpdateActivityStatus}
              
                activeStagedOperators={stoppages.filter(s => s.status === 'ATIVA').map(s => s.operator)}
              
                isAdmin={isAdmLoggedIn}
                onDeleteActivity={handleDeleteActivity}
              
                collaboratorsList={collaborators}
                activitiesList={activitiesList}
              
                editingActivity={editingActivity}
                setEditingActivity={setEditingActivity}
              />
              )}

              {activeTab === 'STOPPAGES' && (
                <StoppageManagement 
                  stoppages={stoppages}
              
                  onAddStoppage={handleAddStoppage}
                  onUpdateStoppage={handleUpdateStoppage}
              
                  onResolveStoppage={handleResolveStoppage}
              
                  isAdmin={isAdmLoggedIn}
              
                  onDeleteStoppage={handleDeleteStoppage}
              
                  collaboratorsList={collaborators}
                  stoppagesList={stoppagesList}
              
                  editingStoppage={editingStoppage}
                  setEditingStoppage={setEditingStoppage}
                />
              )}

              {activeTab === 'HISTORY' && (
                <HistoryLogs
                  activities={activities}
                  stoppages={stoppages}
                
                  onDeleteActivity={handleDeleteActivity}
                  onEditActivity={handleEditActivity}
                
                  onDeleteStoppage={handleDeleteStoppage}
                  onEditStoppage={handleEditStoppage}
                
                  isAdmin={isAdmLoggedIn}
                />
              )}

              {activeTab === 'ADMIN' && (
                <AdminPanel 
                  collaborators={collaborators}
                  onUpdateCollaborators={(newCollabs) => {
                    setCollaborators(newCollabs);
                    localStorage.setItem('porto_collaborators', JSON.stringify(newCollabs));
                  }}
                  activitiesList={activitiesList}
                  onUpdateActivitiesList={(newList) => {
                    setActivitiesList(newList);
                  }}
                  stoppagesList={stoppagesList}
                  onUpdateStoppagesList={(newList) => {
                    setStoppagesList(newList);
                  }}
                  usersList={usersList}
                  onUpdateUsersList={(newList) => {
                    setUsersList(newList);
                  }}
                  onCreateUser={handleCreateUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}

                  onCreateActivityType={handleCreateActivityType}
                  onDeleteActivityType={handleDeleteActivityType}
                  
                  onCreateStoppageType={handleCreateStoppageType}
                  onDeleteStoppageType={handleDeleteStoppageType}
                />
              )}
            </div>
          </>
        </div>

        {/* Footer info line styled sleekly */}
        <footer className="h-10 bg-white border-t border-slate-200 px-8 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
            <span>Porto Brasil Cerâmica • Terminal de Produção & Movimentação</span>
          </div>
          <div>
            <span>Produtividade • Separação • Armazenamento • Paradas de Mão de Obra</span>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-wider font-bold">
            PORTO-LOG v1.2.0 • {isAdmLoggedIn ? 'MODO SUPERVISÃO' : 'MODO OPERADOR'}
          </div>
        </footer>
      </main>


    </div>
  );
}
