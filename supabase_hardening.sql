-- =====================================================
-- GESTIOTU - ENDURECIMIENTO PENDIENTE
-- =====================================================
-- Este script aplica endurecimiento adicional y protección del rol.
-- Es RE-EJECUTABLE: puedes correrlo cuantas veces quieras sin errores.
--
-- CÓMO USARLO:
--   1. Abre el SQL Editor de tu proyecto:
--      https://supabase.com/dashboard/project/tzdoastvcuurrpfnzcnm/sql/new
--   2. Copia TODO este archivo y pégalo.
--   3. Pulsa "Run" (o Ctrl+Enter).
--   4. Deberías ver "Success. No rows returned" sin errores.
--
-- QUÉ ARREGLA:
--   a) Impide que visitantes anónimos ejecuten las funciones internas
--      de la base de datos desde la API REST (/rest/v1/rpc/...).
--   b) Fija el search_path de esas funciones (aviso de seguridad).
--   c) Elimina 4 políticas duplicadas heredadas en time_reminders.
--   d) Impide que un usuario se asigne el rol de administrador.
-- =====================================================

create or replace function public.bloquear_cambio_rol_propio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if new.role is distinct from old.role then
    if not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    ) then
      raise exception 'No tienes permiso para cambiar tu propio rol.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_bloquear_cambio_rol on public.profiles;
create trigger profiles_bloquear_cambio_rol
  before update on public.profiles
  for each row execute procedure public.bloquear_cambio_rol_propio();

-- -----------------------------------------------------
-- a) Quitar permisos de ejecución a los roles del frontend
-- -----------------------------------------------------
-- Los triggers NO se ven afectados: se ejecutan con los permisos del
-- dueño de la tabla (postgres), no con los del visitante. Por eso es
-- seguro revocar EXECUTE a public, anon y authenticated.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_updated_at() from public, anon, authenticated;
revoke execute on function public.bloquear_cambio_rol_propio() from public, anon, authenticated;

-- -----------------------------------------------------
-- b) Fijar search_path (evita "Function Search Path Mutable")
-- -----------------------------------------------------
-- Todas las referencias de estas funciones ya están calificadas con
-- esquema (public.profiles) o son de pg_catalog, así que el cuerpo
-- sigue funcionando igual con search_path vacío.

alter function public.handle_new_user() set search_path = '';
alter function public.handle_updated_at() set search_path = '';
alter function public.bloquear_cambio_rol_propio() set search_path = '';

-- -----------------------------------------------------
-- c) Borrar políticas duplicadas de time_reminders
-- -----------------------------------------------------
-- Una versión anterior del script creaba "time_reminders_*". La versión
-- actual crea "reminders_*" con exactamente las mismas reglas. Al
-- convivir, cada consulta evalúa ocho políticas en vez de cuatro.
-- Estas órdenes están en supabase_setup.sql pero nunca se corrieron.

drop policy if exists "time_reminders_select_own" on public.time_reminders;
drop policy if exists "time_reminders_insert_own" on public.time_reminders;
drop policy if exists "time_reminders_update_own" on public.time_reminders;
drop policy if exists "time_reminders_delete_own" on public.time_reminders;

-- =====================================================
-- VERIFICACIÓN (opcional, puedes correrla después)
-- =====================================================
-- 1) Las funciones ya no deben ser ejecutables por anon:
-- select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_ejecuta
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('handle_new_user','handle_updated_at','bloquear_cambio_rol_propio');
-- -> todos en false
--
-- 2) time_reminders debe tener exactamente 4 políticas:
-- select policyname from pg_policies
-- where schemaname = 'public' and tablename = 'time_reminders';
-- -> reminders_select_own, reminders_insert_own,
--    reminders_update_own, reminders_delete_own
-- =====================================================
