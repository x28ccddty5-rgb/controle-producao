export type ActivityStatus = 'EM_ANDAMENTO' | 'PAUSADO' | 'CONCLUIDO';

export interface Activity {
  id: string;
  date: string;             // Data de Execução (e.g. 10/05/2026)
  operator: string;         // Colaborador
  activityCode: number;     // Código Atividade (1 to 11)
  activityName: string;     // Name of the activity mapped from code (e.g., Separação, Armazenamento)
  local: string;            // Arena / Local (e.g. 2, "2,3")
  listId: string;           // Lista ID (e.g. 631)
  startTime: string;        // Hora Inicial (e.g. 06:00)
  endTime?: string;         // Hora Final (e.g. 07:00)
  duration: string;         // Duração formatted (e.g. 01:00)
  durationHours: number;    // Duração normalized as fractional hours
  palletJackId: string;     // ID Paleteira
  forkliftId: string;       // ID Empilhadeira
  producedQuantity: number; // Qtd Peças
  itemsQuantity: number;    // Qtd de Itens / SKUs
  status: ActivityStatus;
  notes?: string;           // Observação
  creator: string;          // Usuário lançador
  createdAt: string;        // Timestamp do lançamento (DD/MM/YYYY HH:MM)
}

export interface Stoppage {
  id: string;
  date: string;             // Data de Execução (e.g. 10/05/2026)
  operator: string;         // Colaborador
  stoppageCode: number;     // Código da Parada (1 to 13)
  stoppageName: string;     // Name mapped from code (e.g. BANHEIRO / ÁGUA, REUNIÃO)
  startTime: string;        // Hora Inicial
  endTime?: string;         // Hora Final
  duration: string;         // Duração formatted
  durationMinutes: number;  // Duração normalized as minutes
  status: 'ATIVA' | 'RESOLVIDA';
  notes?: string;           // Observação
  resolutionNotes?: string; // O que foi corrigido / Notas de retomada
  creator: string;          // Usuário lançador
  createdAt: string;        // Timestamp do lançamento (DD/MM/YYYY HH:MM)
}

export interface ProductionLog {
  id: string;
  timestamp: string;
  type: 'ATIVIDADE_INICIO' | 'ATIVIDADE_FIM' | 'ATIVIDADE_ATUALIZACAO' | 'PARADA_INICIO' | 'PARADA_FIM';
  description: string;
  operator: string;
  referenceId: string; // ID of the Activity or Stoppage
}

