-- =====================================================
-- GESTIOTU - SUPABASE SETUP (SOLO CLAVE ANON/PUBLISHABLE)
-- =====================================================
-- Este script es RE-EJECUTABLE: puedes correrlo varias veces
-- sin errores de "ya existe". Usa IF NOT EXISTS y DROP ... IF EXISTS.
-- =====================================================

-- 1) EXTENSIONES NECESARIAS
-- gen_random_uuid() para generar UUIDs
create extension if not exists pgcrypto;

-- =====================================================
-- TABLAS
-- =====================================================

-- 2) PROFILES (relacionada con auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('user','admin')) default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) PREFERENCIAS POR USUARIO (1 fila por usuario)
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferences jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) DISEÑO PERSONALIZADO DEL SITIO (1 fila por usuario)
create table if not exists public.user_design (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  design jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) REGISTRO DIARIO DE ALIMENTACIÓN
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  meal text not null,
  food text not null,
  amount text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_food_logs_user_date on public.food_logs(user_id, log_date);

-- 6) RACHA SEMANAL DE EJERCICIO (1 registro por usuario/semana)
create table if not exists public.exercise_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start_date date not null,
  days jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

create index if not exists idx_exercise_weeks_user_week on public.exercise_weeks(user_id, week_start_date);

-- 7) HÁBITOS DE BIENESTAR SEMANAL (1 registro por usuario/semana)
create table if not exists public.wellbeing_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start_date date not null,
  days jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

create index if not exists idx_wellbeing_weeks_user_week on public.wellbeing_weeks(user_id, week_start_date);

-- 8) CONFIGURACIÓN DE HORARIO SEMANAL DE EJERCICIO (1 fila por usuario)
create table if not exists public.exercise_schedule_config (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  schedule jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9) RECORDATORIOS DEL USUARIO (fechas importantes)
create table if not exists public.time_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  reminder_date timestamptz not null,
  kind text not null check (kind in ('recordatorio','importante')),
  is_public_holiday boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_time_reminders_user_date on public.time_reminders(user_id, reminder_date);

-- 10) BLOQUES DE HORARIO DEL DÍA
create table if not exists public.daily_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity text not null,
  day smallint not null check (day between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_daily_schedule_blocks_user_day on public.daily_schedule_blocks(user_id, day);

-- =====================================================
-- TRIGGERS PARA updated_at
-- =====================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_user_design_updated_at on public.user_design;
create trigger set_user_design_updated_at
  before update on public.user_design
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_food_logs_updated_at on public.food_logs;
create trigger set_food_logs_updated_at
  before update on public.food_logs
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_exercise_weeks_updated_at on public.exercise_weeks;
create trigger set_exercise_weeks_updated_at
  before update on public.exercise_weeks
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_wellbeing_weeks_updated_at on public.wellbeing_weeks;
create trigger set_wellbeing_weeks_updated_at
  before update on public.wellbeing_weeks
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_exercise_schedule_config_updated_at on public.exercise_schedule_config;
create trigger set_exercise_schedule_config_updated_at
  before update on public.exercise_schedule_config
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_time_reminders_updated_at on public.time_reminders;
create trigger set_time_reminders_updated_at
  before update on public.time_reminders
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_daily_schedule_blocks_updated_at on public.daily_schedule_blocks;
create trigger set_daily_schedule_blocks_updated_at
  before update on public.daily_schedule_blocks
  for each row execute procedure public.handle_updated_at();

-- =====================================================
-- TRIGGER: crear perfil automáticamente al registrarse
-- =====================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - OBLIGATORIO CON CLAVE ANON
-- =====================================================

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_design enable row level security;
alter table public.food_logs enable row level security;
alter table public.exercise_weeks enable row level security;
alter table public.wellbeing_weeks enable row level security;
alter table public.exercise_schedule_config enable row level security;
alter table public.time_reminders enable row level security;
alter table public.daily_schedule_blocks enable row level security;

-- =====================================================
-- POLÍTICAS RLS
-- Nota: "create policy" no admite IF NOT EXISTS, por eso
-- se usa "drop policy if exists" antes de cada una.
-- =====================================================

-- 1) PROFILES
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- 2) USER_PREFERENCES
drop policy if exists "prefs_select_own" on public.user_preferences;
create policy "prefs_select_own" on public.user_preferences
  for select using (auth.uid() = user_id);

drop policy if exists "prefs_insert_own" on public.user_preferences;
create policy "prefs_insert_own" on public.user_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "prefs_update_own" on public.user_preferences;
create policy "prefs_update_own" on public.user_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "prefs_delete_own" on public.user_preferences;
create policy "prefs_delete_own" on public.user_preferences
  for delete using (auth.uid() = user_id);

-- 3) USER_DESIGN
drop policy if exists "design_select_own" on public.user_design;
create policy "design_select_own" on public.user_design
  for select using (auth.uid() = user_id);

drop policy if exists "design_insert_own" on public.user_design;
create policy "design_insert_own" on public.user_design
  for insert with check (auth.uid() = user_id);

drop policy if exists "design_update_own" on public.user_design;
create policy "design_update_own" on public.user_design
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "design_delete_own" on public.user_design;
create policy "design_delete_own" on public.user_design
  for delete using (auth.uid() = user_id);

-- 4) FOOD_LOGS
drop policy if exists "food_logs_select_own" on public.food_logs;
create policy "food_logs_select_own" on public.food_logs
  for select using (auth.uid() = user_id);

drop policy if exists "food_logs_insert_own" on public.food_logs;
create policy "food_logs_insert_own" on public.food_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "food_logs_update_own" on public.food_logs;
create policy "food_logs_update_own" on public.food_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "food_logs_delete_own" on public.food_logs;
create policy "food_logs_delete_own" on public.food_logs
  for delete using (auth.uid() = user_id);

-- 5) EXERCISE_WEEKS
drop policy if exists "ex_weeks_select_own" on public.exercise_weeks;
create policy "ex_weeks_select_own" on public.exercise_weeks
  for select using (auth.uid() = user_id);

drop policy if exists "ex_weeks_insert_own" on public.exercise_weeks;
create policy "ex_weeks_insert_own" on public.exercise_weeks
  for insert with check (auth.uid() = user_id);

drop policy if exists "ex_weeks_update_own" on public.exercise_weeks;
create policy "ex_weeks_update_own" on public.exercise_weeks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ex_weeks_delete_own" on public.exercise_weeks;
create policy "ex_weeks_delete_own" on public.exercise_weeks
  for delete using (auth.uid() = user_id);

-- 6) WELLBEING_WEEKS
drop policy if exists "wb_weeks_select_own" on public.wellbeing_weeks;
create policy "wb_weeks_select_own" on public.wellbeing_weeks
  for select using (auth.uid() = user_id);

drop policy if exists "wb_weeks_insert_own" on public.wellbeing_weeks;
create policy "wb_weeks_insert_own" on public.wellbeing_weeks
  for insert with check (auth.uid() = user_id);

drop policy if exists "wb_weeks_update_own" on public.wellbeing_weeks;
create policy "wb_weeks_update_own" on public.wellbeing_weeks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "wb_weeks_delete_own" on public.wellbeing_weeks;
create policy "wb_weeks_delete_own" on public.wellbeing_weeks
  for delete using (auth.uid() = user_id);

-- 7) EXERCISE_SCHEDULE_CONFIG
drop policy if exists "ex_sched_config_select_own" on public.exercise_schedule_config;
create policy "ex_sched_config_select_own" on public.exercise_schedule_config
  for select using (auth.uid() = user_id);

drop policy if exists "ex_sched_config_insert_own" on public.exercise_schedule_config;
create policy "ex_sched_config_insert_own" on public.exercise_schedule_config
  for insert with check (auth.uid() = user_id);

drop policy if exists "ex_sched_config_update_own" on public.exercise_schedule_config;
create policy "ex_sched_config_update_own" on public.exercise_schedule_config
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ex_sched_config_delete_own" on public.exercise_schedule_config;
create policy "ex_sched_config_delete_own" on public.exercise_schedule_config
  for delete using (auth.uid() = user_id);

-- 7) TIME_REMINDERS
-- Limpieza: una versión anterior usaba el prefijo "time_reminders_".
-- Si no se borran, quedan políticas duplicadas (mismas reglas, pero redundantes).
drop policy if exists "time_reminders_select_own" on public.time_reminders;
drop policy if exists "time_reminders_insert_own" on public.time_reminders;
drop policy if exists "time_reminders_update_own" on public.time_reminders;
drop policy if exists "time_reminders_delete_own" on public.time_reminders;

drop policy if exists "reminders_select_own" on public.time_reminders;
create policy "reminders_select_own" on public.time_reminders
  for select using (auth.uid() = user_id);

drop policy if exists "reminders_insert_own" on public.time_reminders;
create policy "reminders_insert_own" on public.time_reminders
  for insert with check (auth.uid() = user_id);

drop policy if exists "reminders_update_own" on public.time_reminders;
create policy "reminders_update_own" on public.time_reminders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reminders_delete_own" on public.time_reminders;
create policy "reminders_delete_own" on public.time_reminders
  for delete using (auth.uid() = user_id);

-- 8) DAILY_SCHEDULE_BLOCKS
drop policy if exists "daily_blocks_select_own" on public.daily_schedule_blocks;
create policy "daily_blocks_select_own" on public.daily_schedule_blocks
  for select using (auth.uid() = user_id);

drop policy if exists "daily_blocks_insert_own" on public.daily_schedule_blocks;
create policy "daily_blocks_insert_own" on public.daily_schedule_blocks
  for insert with check (auth.uid() = user_id);

drop policy if exists "daily_blocks_update_own" on public.daily_schedule_blocks;
create policy "daily_blocks_update_own" on public.daily_schedule_blocks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "daily_blocks_delete_own" on public.daily_schedule_blocks;
create policy "daily_blocks_delete_own" on public.daily_schedule_blocks
  for delete using (auth.uid() = user_id);

-- =====================================================
-- COMENTARIOS
-- =====================================================
comment on table public.profiles is 'Perfil de usuario ligado a auth.users. Solo usar clave anon + RLS.';
comment on table public.user_preferences is 'Preferencias por usuario (coincide con gestiotu.preferences.v1).';
comment on table public.user_design is 'Diseño personalizado (solo admin en la app).';
comment on table public.food_logs is 'Registro diario de alimentación.';
comment on table public.exercise_weeks is 'Racha semanal de ejercicio (días marcados).';
comment on table public.wellbeing_weeks is 'Hábitos de bienestar semanal.';
comment on table public.exercise_schedule_config is 'Configuración semanal de ejercicio por día.';
comment on table public.time_reminders is 'Recordatorios/fechas importantes del usuario.';
comment on table public.daily_schedule_blocks is 'Bloques del horario del día.';

-- =====================================================
-- ENDURECIMIENTO (hardening) DE SEGURIDAD
-- =====================================================
-- Fija el search_path de las funciones que ejecuta la base de datos al
-- crear un usuario. Así se evita el aviso "Function Search Path Mutable".
alter function public.handle_new_user() set search_path = '';
alter function public.handle_updated_at() set search_path = '';

-- handle_new_user es una función de disparador (trigger): no debe poder
-- llamarse desde fuera por un visitante. Le quitamos el permiso de ejecución.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- handle_updated_at solo la usan los triggers de la propia base de datos.
revoke execute on function public.handle_updated_at() from public;
revoke execute on function public.handle_updated_at() from anon;
revoke execute on function public.handle_updated_at() from authenticated;
