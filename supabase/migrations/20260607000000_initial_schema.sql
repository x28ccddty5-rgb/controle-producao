-- Migration: Initial Schema for Porto-Log
-- Create tables corresponding to the React types and storage models.

-- Enable UUID extension just in case
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: activities
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  operator TEXT NOT NULL,
  activity_code INTEGER NOT NULL,
  activity_name TEXT NOT NULL,
  local TEXT NOT NULL,
  list_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration TEXT NOT NULL,
  duration_hours NUMERIC NOT NULL DEFAULT 0,
  pallet_jack_id TEXT,
  forklift_id TEXT,
  produced_quantity INTEGER NOT NULL DEFAULT 0,
  items_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL, -- 'EM_ANDAMENTO', 'PAUSADO', 'CONCLUIDO'
  notes TEXT,
  creator TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Table: stoppages
CREATE TABLE IF NOT EXISTS stoppages (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  operator TEXT NOT NULL,
  stoppage_code INTEGER NOT NULL,
  stoppage_name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration TEXT NOT NULL,
  duration_minutes NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL, -- 'ATIVA', 'RESOLVIDA'
  notes TEXT,
  resolution_notes TEXT,
  creator TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Table: production_logs
CREATE TABLE IF NOT EXISTS production_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL, -- 'ATIVIDADE_INICIO', 'ATIVIDADE_FIM', 'ATIVIDADE_ATUALIZACAO', 'PARADA_INICIO', 'PARADA_FIM'
  description TEXT NOT NULL,
  operator TEXT NOT NULL,
  reference_id TEXT NOT NULL
);

-- Create simple indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_stoppages_date ON stoppages(date);
CREATE INDEX IF NOT EXISTS idx_production_logs_timestamp ON production_logs(timestamp DESC);

-- Enable Row Level Security (RLS) so users can specify security rules later
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE stoppages ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for the sake of the client-side SPA demo
-- (Can be secured subsequently according to operational requirements)
CREATE POLICY "Allow anonymous read logic" ON activities FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert logic" ON activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update logic" ON activities FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete logic" ON activities FOR DELETE USING (true);

CREATE POLICY "Allow anonymous read logic" ON stoppages FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert logic" ON stoppages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update logic" ON stoppages FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete logic" ON stoppages FOR DELETE USING (true);

CREATE POLICY "Allow anonymous read logic" ON production_logs FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert logic" ON production_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update logic" ON production_logs FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete logic" ON production_logs FOR DELETE USING (true);
