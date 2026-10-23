# Guía para configurar Supabase en GESTIOTU

Este proyecto está preparado para usar **Supabase** como base de datos, cargando la librería **supabase-js** desde CDN y usando **únicamente la clave pública `anon`**.

## 1. Crear proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com/) y crea una cuenta o inicia sesión.
2. Pulsa "New project".
3. Asigna un nombre (ej. `gestiotu`).
4. Elige una región cercana a ti.
5. Establece una contraseña para la base de datos (guárdala en lugar seguro, no la usaremos en frontend).
6. Espera a que el proyecto termine de crearse.

## 2. Obtener URL y clave anon (publishable)

1. En tu proyecto, ve a **Settings → API** (izquierda).
2. Copia:
- **Project URL** (ej. `https://xxxxxxxxxxxx.supabase.co`)
- **anon public** (clave pública, publishable). **NUNCA copies `service_role`**.

## 3. Configurar `JS/supabase-client.js`

Abre `JS/supabase-client.js` y reemplaza:

```js
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU-CLAVE-ANON-PUBLICA";
```

Por tus valores reales.

## 4. Crear tablas y políticas (RLS)

1. Ve a **SQL Editor** → **New query**.
2. Abre el archivo `supabase_setup.sql` (está en la raíz del proyecto).
3. Copia todo su contenido y pégalo en el editor.
4. Pulsa **Run**.
5. Deberías ver mensajes de éxito sin errores.

Verifica RLS activado:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname='public'
order by tablename;
```

Todas deben tener `rowsecurity = true`.

## 5. Comprobar que funciona

1. Abre `index.html` en local (doble clic) o publica en Vercel.
2. Prueba a registrar una cuenta desde `cuenta.html`. Al registrarte, se creará automáticamente un perfil en `profiles` (gracias al trigger).
3. En **Table Editor** de Supabase puedes ver los datos que se guarden (solo verás los tuyos gracias a RLS).

> ¿Dónde se cargan los datos? En `JS/supabase-sync.js`. Mientras no inicies
> sesión, la web usa el `localStorage` del navegador (como antes). Cuando
> inicias sesión, además se sube todo a Supabase y, si entras desde otro
> dispositivo, se descarga desde Supabase. La primera vez que inicies sesión,
> lo que ya tuvieras guardado en ese navegador se sube automáticamente.

## Notas importantes

- **SOLO clave `anon`**: Está en frontend. Esto es correcto **porque tenemos RLS activado** en todas las tablas.
- **No migramos hashes**: El sistema anterior usaba PBKDF2 local. Ahora usamos **Supabase Auth** (credenciales gestionadas por Supabase).
- **Primer admin**: Al crear el primer usuario, `role` es `user` por defecto. Para darle rol `admin`, ve a **Authentication → Users**, abre ese usuario, copia su `ID` y ejecútalo en SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = 'UUID-DEL-USUARIO-AQUI';
```

- **Festivos externos**: Siguen consultándose desde `https://date.nager.at` (no se guardan en BD).
- **Datos temporales**: Temporizador, notificaciones, etc. **no van a Supabase** (se mantienen locales). Solo migran datos que deben persistir entre dispositivos.

## Archivos añadidos

- `JS/supabase-client.js` → Inicializa el cliente Supabase (con placeholders) y expone `window.gestiotuSupabaseConfigured`.
- `JS/supabase-data.js` → Funciones para leer/escribir en las tablas (con `anon` + RLS).
- `JS/supabase-sync.js` → Conecta la web con Supabase: envuelve `localStorage` (`window.gestiotuStore`), carga los datos al iniciar sesión y los sube al guardar.
- `supabase_setup.sql` → Esquema completo (tablas + RLS + políticas + triggers).
- CDN añadido en **todos** los HTML, en este orden: `@supabase/supabase-js@2` → `supabase-client.js` → `supabase-data.js` → `supabase-sync.js` → `gestiotu.js`.

### Qué se guarda en Supabase (por usuario)

| Clave en `localStorage` | Tabla en Supabase |
| --- | --- |
| `gestiotu.preferences.v1` | `user_preferences.preferences` (jsonb) |
| `gestiotu.site-design.v1` | `user_design.design` (jsonb) |
| `gestiotu.food-log.<fecha>` | `food_logs` |
| `gestiotu.exercise-week.<lunes>` | `exercise_weeks.days` (jsonb) |
| `gestiotu.wellbeing-week.v1` | `wellbeing_weeks.days` (jsonb) |
| `gestiotu.exercise-schedule.v1` | `exercise_schedule_config.schedule` (jsonb) |
| `gestiotu.time-reminders.v1` | `time_reminders` |
| `gestiotu.daily-schedule.v1` | `daily_schedule_blocks` |

> Se quedan **solo en el navegador** (no van a Supabase): el temporizador,
> las notificaciones y los cálculos en vivo (presupuesto, recetas, etc.).
