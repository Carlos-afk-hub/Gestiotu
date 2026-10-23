// =====================================================
// SINCRONIZACIÓN CON SUPABASE (CLAVE ANON + RLS)
// =====================================================
// Objetivo: que la web siga funcionando igual (usa localStorage como
// almacenamiento inmediato) pero, si hay sesión iniciada, los datos se
// guardan también en Supabase y se cargan desde allí.
//
// - Sin sesión o sin Supabase configurado  -> solo localStorage (como antes).
// - Con sesión iniciada                    -> localStorage + Supabase (espejo).
//
// NUNCA se usa service_role. Todo pasa por RLS.

(function () {
  // El cliente Supabase y la capa de datos se resuelven de forma asíncrona
  // (carga resistente del CDN). No podemos decidir si está configurado en el
  // instante en que se carga este archivo: hay que esperar. Antes esto se
  // evaluaba de inmediato y, si el CDN aún no había terminado, `configured`
  // quedaba en false para siempre y cuenta.html decía "Supabase no está
  // configurado" aunque todo estuviera bien.
  const readyPromise = (async () => {
    try {
      if (window.gestiotuSupabaseReady) await window.gestiotuSupabaseReady;
      const data = window.gestiotuData;
      if (data && data.ready) await data.ready;
    } catch (error) {
      console.error("[supabase-sync] Error esperando a la configuración de Supabase.", error);
    }
  })();

  let D = window.gestiotuData;
  let O = window.gestiotuSupabase;
  let configured = Boolean(window.gestiotuSupabaseConfigured && O && D);

  // Claves que espejamos con Supabase
  const PREF_KEY = "gestiotu.preferences.v1";
  const DESIGN_KEY = "gestiotu.site-design.v1";
  const REMINDERS_KEY = "gestiotu.time-reminders.v1";
  const DAILY_KEY = "gestiotu.daily-schedule.v1";
  const EX_SCHED_KEY = "gestiotu.exercise-schedule.v1";
  const WELLBEING_KEY = "gestiotu.wellbeing-week.v1";
  const FOOD_PREFIX = "gestiotu.food-log.";
  const EX_WEEK_PREFIX = "gestiotu.exercise-week.";

  // Referencias originales (las usamos internamente para no provocar bucles)
  const originalSet = window.localStorage.setItem.bind(window.localStorage);
  const originalRemove = window.localStorage.removeItem.bind(window.localStorage);
  const originalGet = window.localStorage.getItem.bind(window.localStorage);

  const localDateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  // Convierte un instante ISO (con zona) al formato local "YYYY-MM-DDTHH:MM"
  // que usan los <input type="datetime-local"> de la web.
  const toLocalInputValue = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return String(iso).slice(0, 16);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const mondayKey = () => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    return localDateKey(monday);
  };

  const state = {
    ready: null,
    userId: null,
    profile: null,
    hydrating: false,
    pending: new Map(),
    flushTimer: null
  };

  const isLogged = () => Boolean(state.userId);

  // ---------- Sincronizar una clave hacia Supabase ----------

  const pushKey = async (key, value) => {
    if (!isLogged()) return;
    const uid = state.userId;

    if (key === PREF_KEY) {
      if (value === null) return D.deletePreferences(uid);
      return D.savePreferences(uid, JSON.parse(value));
    }

    if (key === DESIGN_KEY) {
      if (value === null) return D.deleteDesign(uid);
      return D.saveDesign(uid, JSON.parse(value));
    }

    if (key === REMINDERS_KEY) {
      const list = (value === null ? [] : JSON.parse(value)).map((r) => ({
        ...r,
        date: r.date ? new Date(r.date).toISOString() : r.date
      }));
      return D.replaceReminders(uid, list);
    }

    if (key === DAILY_KEY) {
      const list = value === null ? [] : JSON.parse(value);
      return D.replaceDailySchedule(uid, list);
    }

    if (key === EX_SCHED_KEY) {
      if (value === null) return;
      return D.saveExerciseSchedule(uid, JSON.parse(value));
    }

    if (key === WELLBEING_KEY) {
      const days = value === null ? [] : JSON.parse(value);
      return D.saveWellbeingWeek(uid, mondayKey(), days);
    }

    if (key.startsWith(FOOD_PREFIX)) {
      const date = key.slice(FOOD_PREFIX.length);
      const list = value === null ? [] : JSON.parse(value);
      return D.replaceFoodLogs(uid, date, list);
    }

    if (key.startsWith(EX_WEEK_PREFIX)) {
      const week = key.slice(EX_WEEK_PREFIX.length);
      const days = value === null ? [] : JSON.parse(value);
      return D.saveExerciseWeek(uid, week, days);
    }
  };

  const scheduleFlush = (key, value) => {
    state.pending.set(key, value);
    if (state.flushTimer) window.clearTimeout(state.flushTimer);
    state.flushTimer = window.setTimeout(async () => {
      const items = [...state.pending.entries()];
      state.pending.clear();
      for (const [k, v] of items) {
        try {
          await pushKey(k, v);
        } catch (error) {
          console.error(`[supabase-sync] No se pudo sincronizar "${k}".`, error);
        }
      }
    }, 600);
  };

  // ---------- Cargar datos desde Supabase hacia localStorage ----------
  // Si en Supabase aún no hay nada pero sí en el navegador, subimos lo local
  // (así los datos que ya tenías no se pierden al iniciar sesión por primera vez).

  const hydrateAll = async () => {
    if (!isLogged()) return;
    state.hydrating = true;
    const uid = state.userId;
    const today = localDateKey(new Date());
    const monday = mondayKey();

    try {
      const prefs = await D.getPreferences(uid);
      const prefLocal = originalGet(PREF_KEY);
      if (prefs) originalSet(PREF_KEY, JSON.stringify(prefs));
      else if (prefLocal !== null) scheduleFlush(PREF_KEY, prefLocal);

      const design = await D.getDesign(uid);
      const designLocal = originalGet(DESIGN_KEY);
      if (design) originalSet(DESIGN_KEY, JSON.stringify(design));
      else if (designLocal !== null) scheduleFlush(DESIGN_KEY, designLocal);

      const reminders = await D.listReminders(uid);
      if (reminders.length) {
        originalSet(REMINDERS_KEY, JSON.stringify(reminders.map((r) => ({
          id: r.id, title: r.title, date: toLocalInputValue(r.reminder_date), kind: r.kind
        }))));
      } else {
        const local = originalGet(REMINDERS_KEY);
        if (local !== null) scheduleFlush(REMINDERS_KEY, local);
      }

      const daily = await D.listDailySchedule(uid);
      if (daily.length) {
        originalSet(DAILY_KEY, JSON.stringify(daily.map((b) => ({
          id: b.id, activity: b.activity, day: b.day,
          start: (b.start_time || "").slice(0, 5), end: (b.end_time || "").slice(0, 5)
        }))));
      } else {
        const local = originalGet(DAILY_KEY);
        if (local !== null) scheduleFlush(DAILY_KEY, local);
      }

      const food = await D.listFoodLogs(uid, today);
      if (food.length) {
        originalSet(`${FOOD_PREFIX}${today}`, JSON.stringify(food.map((f) => ({
          id: f.id, meal: f.meal, food: f.food, amount: f.amount
        }))));
      } else {
        const local = originalGet(`${FOOD_PREFIX}${today}`);
        if (local !== null) scheduleFlush(`${FOOD_PREFIX}${today}`, local);
      }

      const exDays = await D.getExerciseWeek(uid, monday);
      if (exDays && exDays.length) {
        originalSet(`${EX_WEEK_PREFIX}${monday}`, JSON.stringify(exDays));
      } else {
        const local = originalGet(`${EX_WEEK_PREFIX}${monday}`);
        if (local !== null) scheduleFlush(`${EX_WEEK_PREFIX}${monday}`, local);
      }

      const wbDays = await D.getWellbeingWeek(uid, monday);
      if (wbDays && wbDays.length) {
        originalSet(WELLBEING_KEY, JSON.stringify(wbDays));
      } else {
        const local = originalGet(WELLBEING_KEY);
        if (local !== null) scheduleFlush(WELLBEING_KEY, local);
      }

      const exSched = await D.getExerciseSchedule(uid);
      if (exSched) {
        originalSet(EX_SCHED_KEY, JSON.stringify(exSched));
      } else {
        const local = originalGet(EX_SCHED_KEY);
        if (local !== null) scheduleFlush(EX_SCHED_KEY, local);
      }
    } finally {
      state.hydrating = false;
    }
  };

  // ---------- Envoltorio de almacenamiento ----------
  // Siempre escribe en localStorage (para que la web funcione igual) y,
  // si hay sesión, además programa la sincronización con Supabase.

  const store = {
    getItem: (key) => originalGet(key),
    setItem: (key, value) => {
      originalSet(key, value);
      scheduleFlush(key, value);
    },
    removeItem: (key) => {
      originalRemove(key);
      scheduleFlush(key, null);
    }
  };

  window.gestiotuStore = store;

  // ---------- Ciclo de sesión ----------

  const loadSession = async () => {
    const session = await D.getSession();
    if (!session || !session.user) {
      state.userId = null;
      state.profile = null;
      return null;
    }
    state.userId = session.user.id;
    state.profile = await D.getProfile(session.user.id);
    return session.user;
  };

  const refresh = async () => {
    if (!configured) return null;
    await loadSession();
    await hydrateAll();
    return state.profile;
  };

  // ---------- Inicialización ----------

  const init = async () => {
    // Esperamos a que el cliente y la capa de datos estén realmente listos
    // antes de decidir si Supabase está configurado.
    await readyPromise;
    D = window.gestiotuData;
    O = window.gestiotuSupabase;
    configured = Boolean(window.gestiotuSupabaseConfigured && O && D);

    if (!configured) {
      console.info("[supabase-sync] Supabase sin configurar: solo se usará localStorage.");
      return null;
    }
    // Escuchar cambios de sesión (login/logout) para re-hidratar.
    D.onAuthChange(async () => {
      try {
        await loadSession();
        await hydrateAll();
      } catch (error) {
        console.error("[supabase-sync] Error al reaccionar al cambio de sesión.", error);
      }
    });
    await refresh();
    return state.profile;
  };

  window.gestiotuSync = {
    get configured() { return configured; },
    get userId() { return state.userId; },
    get profile() { return state.profile; },
    isLogged,
    refresh,
    hydrateAll,
    // Atajos de autenticación usados por cuenta.html
    signIn: async (email, password) => {
      const data = await D.signIn(email, password);
      await refresh();
      return data;
    },
    signUp: async (email, password, name) => {
      const data = await D.signUp(email, password, name);
      if (data && data.session) await refresh();
      return data;
    },
    signOut: async () => {
      await D.signOut();
      state.userId = null;
      state.profile = null;
    }
  };

  window.gestiotuSync.ready = init();
})();
