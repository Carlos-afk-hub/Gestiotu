-- =====================================================
-- GESTIOTU - PROTEGER EL ROL "admin"
-- =====================================================
-- PROBLEMA:
-- La política "profiles_update_own" permite a un usuario editar SU PROPIA
-- fila, pero no revisa QUÉ columnas cambia. Como la columna "role" acepta
-- los valores 'user' y 'admin', cualquier usuario registrado podría hacer:
--
--   PATCH /rest/v1/profiles?id=eq.<su-propio-id>
--   { "role": "admin" }
--
-- y autoproclamarse administrador. RLS lo permite porque la fila es suya.
--
-- SOLUCIÓN:
-- Un trigger que impide cambiar "role" salvo que quien edita ya sea admin.
-- Los cambios de nombre o correo siguen funcionando igual.
--
-- CÓMO USARLO:
--   1. Abre https://supabase.com/dashboard/project/tzdoastvcuurrpfnzcnm/sql/new
--   2. Copia TODO este archivo y pégalo.
--   3. Pulsa "Run".
-- Es RE-EJECUTABLE.
-- =====================================================

create or replace function public.bloquear_cambio_rol_propio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
  for each row
  execute procedure public.bloquear_cambio_rol_propio();

-- El trigger solo lo usa la propia base de datos: nadie debe poder
-- llamarlo desde el frontend.
revoke execute on function public.bloquear_cambio_rol_propio() from public, anon, authenticated;

-- =====================================================
-- PARA HACER EL PRIMER ADMIN (ya existía en LEEME-SUPABASE.md):
-- Authentication -> Users -> copia el ID del usuario y ejecuta en el
-- SQL Editor (como postgres, que sí puede):
--
-- update public.profiles set role = 'admin' where id = 'UUID-AQUI';
-- =====================================================
