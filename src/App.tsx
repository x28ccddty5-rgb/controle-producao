import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Stoppage, ProductionLog, ActivityStatus } from './types';
import { 
  INITIAL_ACTIVITIES, 
  INITIAL_STOPPAGES, 
  INITIAL_LOGS 
} from './initialData';
import {
  isSupabaseConfigured,

  dbFetchActivities,
  dbFetchActiveActivities,
  dbFetchStoppages,
  dbFetchActiveStoppages,
  dbFetchCollaborators,


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

  dbSaveCollaborator,
  dbDeactivateCollaborator,
  supabase
} from './supabase';
import Dashboard from './components/Dashboard';
import ActivityManagement from './components/ActivityManagement';
import StoppageManagement from './components/StoppageManagement';
import HistoryLogs from './components/HistoryLogs';
import AdminPanel from './components/AdminPanel';
import AdminUsersManagement, { ManagedUser, ManagedUserRole, NewUserPayload } from './components/AdminUsersManagement';
import ProductionBatch from './components/ProductionBatch';
import MobileProduction from './components/MobileProduction';
import ShiftPlanning from './components/ShiftPlanning';
import { 
  Gauge, 
  Activity as ActivityIcon, 
  PowerOff, 
  FileText, 
  RefreshCw, 
  Trash2, 
  Timer,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Unlock,
  User,
  Users,
  CalendarDays
} from 'lucide-react';
// import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEYS = {
  ACTIVITIES: 'production_activities_v2',
  STOPPAGES: 'production_stoppages_v2',
  LOGS: 'production_logs_v2'
};


function parseTimeToHours(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours + minutes / 60;
}


function detectMobileMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  const explicitMobile =
    window.location.pathname === '/mobile' ||
    window.location.pathname.startsWith('/mobile/') ||
    params.get('mobile') === '1';

  // Desktop-installed PWA must remain Desktop. Standalone/fullscreen alone
  // is therefore not a Mobile signal; phones/tablets are detected by the UA
  // or by the explicit /mobile route/query.
  const mobileUserAgent =
    /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(window.navigator.userAgent);

  return explicitMobile || mobileUserAgent;
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
  const [collaborators, setCollaborators] = useState<string[]>([]);

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

  // --- AUTENTICAÇÃO SUPABASE AUTH ---
  // A sessão real vem do Supabase Auth. O perfil determina a role.
  type AppRole = 'administrador' | 'lideranca' | 'apoio' | 'producao' | 'visualizador';

  const [sessionUser, setSessionUser] = useState<AppRole | null>(null);
  const [sessionUserName, setSessionUserName] = useState<string>('Visitante');

  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Administração de usuários: os dados vêm exclusivamente do Supabase Auth + profiles.
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [managedUsersLoading, setManagedUsersLoading] = useState<boolean>(false);

  const getAppRole = (role: string): AppRole => {
    switch (role.trim().toLowerCase()) {
      case 'administrador':
        return 'administrador';
      case 'lideranca':
      case 'liderança':
        return 'lideranca';
      case 'apoio':
        return 'apoio';
      case 'producao':
      case 'produção':
        return 'producao';
      case 'visualizador':
        return 'visualizador';
      default:
        throw new Error(`Role de perfil inválida: ${role}`);
    }
  };

  const getRoleLabel = (role: AppRole): string => {
    switch (role) {
      case 'administrador':
        return 'Administrador';
      case 'lideranca':
        return 'Liderança';
      case 'apoio':
        return 'Apoio';
      case 'producao':
        return 'Produção';
      case 'visualizador':
        return 'Visualizador';
    }
  };

  const getRoleShortLabel = (role: AppRole): string => {
    switch (role) {
      case 'administrador':
        return 'ADM';
      case 'lideranca':
        return 'LIDERANÇA';
      case 'apoio':
        return 'APOIO';
      case 'producao':
        return 'PRODUÇÃO';
      case 'visualizador':
        return 'VISUALIZADOR';
    }
  };

  const loadCurrentAuthUser = async () => {
    if (!supabase) {
      setSessionUser(null);
      setSessionUserName('Visitante');
      setAuthLoading(false);
      setLoginError('Supabase não está configurado para autenticação.');
      return;
    }

    setAuthLoading(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        setSessionUser(null);
        setSessionUserName('Visitante');
        setIsInitializing(false);
        return;
      }

      const userId = sessionData.session.user.id;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username,name,role,deleted_at')
        .eq('id', userId)
        .single();

      if (profileError || !profile || profile.deleted_at) {
        console.error('Perfil autenticado inexistente ou excluído:', profileError);
        await supabase.auth.signOut();
        setSessionUser(null);
        setSessionUserName('Visitante');
        setLoginError('Esta conta não possui mais acesso ao sistema.');
        setIsInitializing(false);
        return;
      }

      const role = getAppRole(profile.role);

      setSessionUser(role);
      setSessionUserName(profile.name);
      setGlobalCreator(profile.name);
      localStorage.setItem('porto_global_creator', profile.name);

      // A produção deve iniciar diretamente no lançamento.
      setActiveTab(role === 'producao' || role === 'apoio' ? 'ACTIVITIES' : 'DASHBOARD');
    } catch (error) {
      console.error('Erro ao restaurar sessão Supabase:', error);
      await supabase.auth.signOut();
      setSessionUser(null);
      setSessionUserName('Visitante');
      setLoginError('Não foi possível restaurar a sessão.');
      setIsInitializing(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLoginSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setLoginError('');

    const identifier = loginUsername.trim();
    const password = loginPassword;

    if (!identifier) {
      setLoginError('Por favor, informe seu Usuário ou E-mail.');
      return;
    }

    if (!password) {
      setLoginError('Por favor, informe sua Senha.');
      return;
    }

    if (!supabase) {
      setLoginError('Supabase não está configurado para autenticação.');
      return;
    }

    setAuthLoading(true);

    try {
      let authUserId: string | null = null;

      if (identifier.includes('@')) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: identifier,
          password
        });

        if (error || !data.user) {
          console.error('Erro no login Supabase Auth:', error);
          setLoginError('Usuário ou senha incorretos.');
          return;
        }

        authUserId = data.user.id;
      } else {
        const { data, error } = await supabase.functions.invoke('login-by-identifier', {
          body: {
            identifier,
            password
          }
        });

        if (error || !data?.session || !data?.user?.id) {
          console.error('Erro no login por identificador:', error);
          setLoginError(data?.error || 'Usuário ou senha incorretos.');
          return;
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        if (sessionError) {
          console.error('Erro ao estabelecer a sessão:', sessionError);
          setLoginError('Não foi possível estabelecer a sessão.');
          return;
        }

        authUserId = data.user.id;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username,name,role')
        .eq('id', authUserId)
        .single();

      if (profileError || !profile) {
        console.error('Erro ao carregar perfil após login:', profileError);
        await supabase.auth.signOut();
        setSessionUser(null);
        setSessionUserName('Visitante');
        setLoginError('A conta foi autenticada, mas o perfil de acesso não foi encontrado.');
        return;
      }

      const role = getAppRole(profile.role);

      setSessionUser(role);
      setSessionUserName(profile.name);
      setGlobalCreator(profile.name);
      localStorage.setItem('porto_global_creator', profile.name);

      setActiveTab(role === 'producao' || role === 'apoio' ? 'ACTIVITIES' : 'DASHBOARD');
      setLoginUsername('');
      setLoginPassword('');
      setLoginError('');
    } catch (error) {
      console.error('Erro inesperado durante o login:', error);
      await supabase.auth.signOut();
      setSessionUser(null);
      setSessionUserName('Visitante');
      setLoginError('Não foi possível concluir o login.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Erro ao encerrar sessão:', error);
      }
    }

    setSessionUser(null);
    setSessionUserName('Visitante');
    setLoginPassword('');
    setLoginUsername('');
    setLoginError('');
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


  const loadManagedUsers = async () => {
    if (!supabase || sessionUser !== 'administrador') {
      setManagedUsers([]);
      setManagedUsersLoading(false);
      return;
    }

    setManagedUsersLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { operation: 'list' }
      });

      if (error || !data?.users) {
        console.error('Erro ao carregar usuários:', error);
        alert(data?.error || 'Não foi possível carregar os usuários.');
        setManagedUsers([]);
        return;
      }

      setManagedUsers(data.users as ManagedUser[]);
    } finally {
      setManagedUsersLoading(false);
    }
  };

  const handleCreateManagedUser = async (
    payload: NewUserPayload
  ): Promise<boolean> => {
    if (!supabase || sessionUser !== 'administrador') {
      alert('Apenas o Administrador pode cadastrar usuários.');
      return false;
    }

    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        operation: 'create',
        ...payload
      }
    });

    if (error || !data?.user) {
      console.error('Erro ao criar usuário:', error);
      alert(data?.error || 'Não foi possível criar o usuário.');
      return false;
    }

    await loadManagedUsers();
    return true;
  };

  const handleDeleteManagedUser = async (
    user: ManagedUser
  ): Promise<boolean> => {
    if (!supabase || sessionUser !== 'administrador') {
      alert('Apenas o Administrador pode excluir usuários.');
      return false;
    }

    if (user.username === 'adm') {
      alert('A conta administrativa principal é protegida.');
      return false;
    }

    if (!window.confirm(
      `Excluir definitivamente o usuário "${user.name}" (${user.username})? A conta de acesso será removida, o login e o e-mail ficarão disponíveis para uma nova conta, e todo o histórico operacional será preservado.`
    )) {
      return false;
    }

    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        operation: 'delete',
        id: user.id
      }
    });

    if (error || !data?.success) {
      console.error('Erro ao excluir usuário:', error);

      let serverMessage = data?.error as string | undefined;
      const context = (error as { context?: Response } | null)?.context;

      if (!serverMessage && context && typeof context.json === 'function') {
        try {
          const payload = await context.json() as { error?: string };
          serverMessage = payload?.error;
        } catch {
          // Mantém a mensagem genérica quando a resposta da função não puder ser lida.
        }
      }

      alert(serverMessage || error?.message || 'Não foi possível excluir o usuário.');
      return false;
    }

    await loadManagedUsers();
    return true;
  };

  const handleChangeManagedUserPassword = async (
    user: ManagedUser,
    password: string
  ): Promise<boolean> => {
    if (!supabase || sessionUser !== 'administrador') {
      alert('Apenas o Administrador pode alterar senhas de usuários.');
      return false;
    }

    const normalizedPassword = password.trim();

    if (normalizedPassword.length < 6) {
      alert('A senha deve possuir pelo menos 6 caracteres.');
      return false;
    }

    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        operation: 'update-password',
        id: user.id,
        password: normalizedPassword
      }
    });

    if (error || !data?.success) {
      console.error('Erro ao alterar senha:', error);

      let serverMessage = data?.error as string | undefined;
      const context = (error as { context?: Response } | null)?.context;

      if (!serverMessage && context && typeof context.json === 'function') {
        try {
          const payload = await context.json() as { error?: string };
          serverMessage = payload?.error;
        } catch {
          // Mantém a mensagem genérica quando a resposta não puder ser lida.
        }
      }

      alert(serverMessage || error?.message || 'Não foi possível alterar a senha.');
      return false;
    }

    alert(`Senha do usuário "${user.name}" alterada com sucesso.`);
    return true;
  };

  const handleChangeManagedUserRole = async (
    user: ManagedUser,
    role: ManagedUserRole
  ): Promise<boolean> => {
    if (!supabase || sessionUser !== 'administrador') {
      alert('Apenas o Administrador pode alterar o perfil dos usuários.');
      return false;
    }

    const currentAuthUser = await supabase.auth.getUser();
    if (user.username === 'adm' || user.id === currentAuthUser.data.user?.id) {
      alert('A conta administrativa principal não pode ter o perfil alterado.');
      return false;
    }

    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        operation: 'update-role',
        id: user.id,
        role
      }
    });

    if (error || !data?.success) {
      console.error('Erro ao alterar perfil:', error);

      let serverMessage = data?.error as string | undefined;
      const context = (error as { context?: Response } | null)?.context;

      if (!serverMessage && context && typeof context.json === 'function') {
        try {
          const payload = await context.json() as { error?: string };
          serverMessage = payload?.error;
        } catch {
          // Mantém a mensagem genérica quando a resposta não puder ser lida.
        }
      }

      alert(serverMessage || error?.message || 'Não foi possível alterar o perfil.');
      return false;
    }

    await loadManagedUsers();
    alert(`Perfil de "${user.name}" alterado para ${role}.`);
    return true;
  };

  // Active Navigation Tab
  // 'DASHBOARD' | 'PRODUCTION' | 'ACTIVITIES' | 'STOPPAGES' | 'HISTORY'
  const [activeTab, setActiveTab] = useState<string>(() => {
    const savedUser = localStorage.getItem('porto_session_user');
    return savedUser === 'producao'
      ? 'PRODUCTION'
      : 'DASHBOARD';
  });

  useEffect(() => {
    const isMobileRoute = detectMobileMode();

    if (
      sessionUser === 'administrador' &&
      (activeTab === 'USERS' || isMobileRoute)
    ) {
      void loadManagedUsers();
    }
  }, [sessionUser, activeTab]);

  // Real-time server/clock to display in the header
  const [currentTime, setCurrentTime] = useState<string>('');

  // Restore the Supabase Auth session before exposing the application.
  useEffect(() => {
    loadCurrentAuthUser();

    if (!supabase) return;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setSessionUser(null);
        setSessionUserName('Visitante');
        setIsInitializing(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Mobile must have a deterministic URL when opened from a phone/PWA.
  // Desktop browsers opened at "/" remain on the existing Desktop route.
  useEffect(() => {
    if (!detectMobileMode()) return;

    const isExplicitMobilePath =
      window.location.pathname === '/mobile' ||
      window.location.pathname.startsWith('/mobile/');

    if (!isExplicitMobilePath) {
      window.history.replaceState(
        window.history.state,
        '',
        '/mobile/?mobile=1'
      );
    }
  }, []);

  // 2. Load reference data and operational state from Supabase.
  // History is loaded independently with server-side pagination.
  // Reference data must wait for an authenticated session. Otherwise the
  // browser sends these requests as `anon`, which is intentionally denied
  // by RLS.
  useEffect(() => {
    let cancelled = false;

    async function loadReferenceData() {
      try {
        if (isSupabaseConfigured()) {
          if (!sessionUser || !supabase) {
            return;
          }

          const { data: sessionData, error: sessionError } =
            await supabase.auth.getSession();

          if (sessionError || !sessionData.session) {
            return;
          }
          const [activityTypes, stoppageTypes, collaboratorData] = await Promise.all([
            dbFetchActivityTypes(),
            dbFetchStoppageTypes(),
            dbFetchCollaborators()
          ]);

          if (cancelled) return;

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

          if (collaboratorData !== null) {
            setCollaborators(collaboratorData);
            localStorage.setItem('porto_collaborators', JSON.stringify(collaboratorData));
          } else {
            const cached = localStorage.getItem('porto_collaborators');
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) setCollaborators(parsed);
              } catch {
                // Ignore invalid cache; Supabase remains the source of truth.
              }
            }
          }

          return;
        }

        const cached = localStorage.getItem('porto_collaborators');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) setCollaborators(parsed);
          } catch {
            // Ignore invalid cache.
          }
        }
      } catch (error) {
        console.error('Falha ao carregar cadastros:', error);
      }
    }

    loadReferenceData();

    return () => {
      cancelled = true;
    };
  }, [sessionUser]);

  const refreshOperationalData = async (showLoading = false) => {
    if (!sessionUser || !supabase) return;

    if (showLoading) {
      setIsInitializing(true);
    }

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        console.error('Sessão Supabase indisponível antes da carga operacional:', sessionError);
        return;
      }

      const managementRole =
        sessionUser === 'administrador' ||
        sessionUser === 'lideranca' ||
        sessionUser === 'visualizador';

      const [acts, stops] = await Promise.all([
        managementRole ? dbFetchActivities() : dbFetchActiveActivities(),
        managementRole ? dbFetchStoppages() : dbFetchActiveStoppages()
      ]);

      if (acts !== null) {
        setActivities(acts);
        localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(acts));
      }

      if (stops !== null) {
        setStoppages(stops);
        localStorage.setItem(STORAGE_KEYS.STOPPAGES, JSON.stringify(stops));
      }

      // production_logs is an audit resource and is intentionally not
      // loaded globally because RLS restricts it to management roles.
      setLogs([]);
    } catch (error) {
      console.error('Falha ao carregar dados operacionais:', error);
    } finally {
      if (showLoading) {
        setIsInitializing(false);
      }
    }
  };

  useEffect(() => {
    if (!sessionUser || !supabase) return;
    refreshOperationalData(true);
  }, [sessionUser]);


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

  if (isInitializing || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans">
        <div className="flex flex-col items-center space-y-4">
          <img src="/pwa-192x192.png" alt="" className="h-12 w-12 rounded-2xl object-contain animate-bounce" />
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
            <div className="w-14 h-14 flex items-center justify-center mx-auto mb-3">
              <img src="/pwa-192x192.png" alt="Controle de Produção" className="w-14 h-14 rounded-2xl object-contain" />
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
                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest">Usuário ou E-mail</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ex: sara, jonas, adm ou e-mail"
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

  const isMobileRoute = detectMobileMode();

  if (isMobileRoute && sessionUser) {
    return (
      <MobileProduction
        userName={sessionUserName}
        onLogout={handleLogout}
        role={sessionUser}
        databaseContent={
          (sessionUser === 'administrador' || sessionUser === 'lideranca') ? (
            <AdminPanel
              collaborators={collaborators}
              onAddCollaborator={async (name) => {
                const success = await dbSaveCollaborator(name);
                if (!success) return false;
                const updated = [
                  ...collaborators.filter(c => c.toLowerCase() !== name.toLowerCase()),
                  name
                ].sort((a, b) => a.localeCompare(b, 'pt-BR'));
                setCollaborators(updated);
                localStorage.setItem('porto_collaborators', JSON.stringify(updated));
                return true;
              }}
              onDeactivateCollaborator={async (name) => {
                const success = await dbDeactivateCollaborator(name);
                if (!success) return false;
                const updated = collaborators.filter(c => c !== name);
                setCollaborators(updated);
                localStorage.setItem('porto_collaborators', JSON.stringify(updated));
                return true;
              }}
              activitiesList={activitiesList}
              onUpdateActivitiesList={setActivitiesList}
              stoppagesList={stoppagesList}
              onUpdateStoppagesList={setStoppagesList}
              onCreateActivityType={handleCreateActivityType}
              onDeleteActivityType={handleDeleteActivityType}
              onCreateStoppageType={handleCreateStoppageType}
              onDeleteStoppageType={handleDeleteStoppageType}
            />
          ) : null
        }
        userManagementContent={
          sessionUser === 'administrador' ? (
            <AdminUsersManagement
              users={managedUsers}
              currentUserName={sessionUserName}
              loading={managedUsersLoading}
              onCreateUser={handleCreateManagedUser}
              onDeleteUser={handleDeleteManagedUser}
              onChangePassword={handleChangeManagedUserPassword}
              onChangeRole={handleChangeManagedUserRole}
            />
          ) : null
        }
      />
    );
  }

  const isAdmLoggedIn = 
    sessionUser === 'lideranca' ||
    sessionUser === 'administrador';

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans overflow-hidden" id="main-application-panel">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 flex flex-col shrink-0 shadow-lg select-none">
        <div className="p-6 h-full flex flex-col justify-between">
          <div>
            {/* Sidebar Logo / Header */}
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                <img src="/pwa-192x192.png" alt="Controle de Produção" className="w-10 h-10 rounded-xl object-contain" />
              </div>
              <div>
                <span className="text-white font-bold text-lg leading-tight block">Porto Brasil</span>
                <span className="text-blue-400 text-[10px] uppercase font-bold tracking-wider block">Movimentação</span>
              </div>
            </div>
            
            {/* Sidebar Navigation links */}
            <nav className="space-y-1">
              {(sessionUser === 'lideranca' ||
               sessionUser === 'administrador' ||
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

              {sessionUser && (
                <>
                  {(sessionUser === 'producao' ||
                    sessionUser === 'apoio' ||
                    sessionUser === 'lideranca' ||
                    sessionUser === 'administrador') && (
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

                  {(sessionUser === 'administrador' || sessionUser === 'lideranca') && (
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

                  {(sessionUser === 'administrador' || sessionUser === 'lideranca') && (
                    <button
                      onClick={() => setActiveTab('PLANNING')}
                      id="tab-planning"
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left text-sm font-medium cursor-pointer ${
                        activeTab === 'PLANNING'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <CalendarDays className="w-5 h-5 shrink-0" />
                      <span>Planejamento</span>
                    </button>
                  )}
                  {sessionUser === 'administrador' && (
                    <button
                      onClick={() => setActiveTab('USERS')}
                      id="tab-users"
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left text-sm font-medium cursor-pointer ${
                        activeTab === 'USERS'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Users className="w-5 h-5 shrink-0" />
                      <span>Controle de Usuários</span>
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
                {getRoleShortLabel(sessionUser).slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate">
                  {sessionUserName}
                </p>
                <p className="text-slate-500 text-[10px] uppercase font-mono tracking-wider truncate">
                  {getRoleLabel(sessionUser)}
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
              {activeTab === 'USERS' && "Controle de Usuários e Permissões"}
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


            {activeTab !== 'DASHBOARD' &&
              activeTab !== 'ACTIVITIES' &&
              (sessionUser === 'producao' ||
                sessionUser === 'apoio' ||
                sessionUser === 'lideranca' ||
                sessionUser === 'administrador') && (
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
                  onRefreshData={refreshOperationalData}
                  canViewJourneyMetrics={isAdmLoggedIn}
                  canManageTargets={isAdmLoggedIn}
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
                  onDeleteActivity={handleDeleteActivity}
                  onEditActivity={handleEditActivity}
                
                  onDeleteStoppage={handleDeleteStoppage}
                  onEditStoppage={handleEditStoppage}
                
                  isAdmin={isAdmLoggedIn}
                  collaborators={collaborators}
                />
              )}

              {activeTab === 'PLANNING' && (sessionUser === 'administrador' || sessionUser === 'lideranca') && (
                <ShiftPlanning />
              )}

              {activeTab === 'ADMIN' && (
                <AdminPanel 
                  collaborators={collaborators}
                  onAddCollaborator={async (name) => {
                    const success = await dbSaveCollaborator(name);
                    if (!success) return false;

                    const updated = [
                      ...collaborators.filter(c => c.toLowerCase() !== name.toLowerCase()),
                      name
                    ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

                    setCollaborators(updated);
                    localStorage.setItem('porto_collaborators', JSON.stringify(updated));
                    return true;
                  }}
                  onDeactivateCollaborator={async (name) => {
                    const success = await dbDeactivateCollaborator(name);
                    if (!success) return false;

                    const updated = collaborators.filter(c => c !== name);
                    setCollaborators(updated);
                    localStorage.setItem('porto_collaborators', JSON.stringify(updated));
                    return true;
                  }}
                  activitiesList={activitiesList}
                  onUpdateActivitiesList={(newList) => {
                    setActivitiesList(newList);
                  }}
                  stoppagesList={stoppagesList}
                  onUpdateStoppagesList={(newList) => {
                    setStoppagesList(newList);
                  }}

                  onCreateActivityType={handleCreateActivityType}
                  onDeleteActivityType={handleDeleteActivityType}
                  
                  onCreateStoppageType={handleCreateStoppageType}
                  onDeleteStoppageType={handleDeleteStoppageType}
                />
              )}

              {activeTab === 'USERS' && sessionUser === 'administrador' && (
                <AdminUsersManagement
                  users={managedUsers}
                  currentUserName={sessionUserName}
                  loading={managedUsersLoading}
                  onCreateUser={handleCreateManagedUser}
                  onDeleteUser={handleDeleteManagedUser}
              onChangePassword={handleChangeManagedUserPassword}
                onChangeRole={handleChangeManagedUserRole}
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
