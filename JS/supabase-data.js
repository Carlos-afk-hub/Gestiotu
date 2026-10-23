// =====================================================
// CAPA DE ACCESO A DATOS - SUPABASE (CLAVE ANON)
// =====================================================
// Funciones pequeñas y claras para leer/escribir en Supabase.
// Requiere que "JS/supabase-client.js" ya esté cargado
// (window.gestiotuSupabase) y las tablas creadas con supabase_setup.sql.
//
// IMPORTANTE: Todas las operaciones dependen de RLS. Si el usuario
// no ha iniciado sesión, las consultas devolverán vacío o error.
// NUNCA se usa service_role aquí.

(function () {
  // El cliente puede tardar en estar listo (el CDN se carga de forma
  // resistente y asíncrona). En vez de rendirnos y dejar la app sin capa de
  // datos, esperamos a window.gestiotuSupabaseReady y solo entonces
  // construimos todas las funciones con un `sb` real.
  const clientReady = (async () => {
    if (window.gestiotuSupabase) return window.gestiotuSupabase;
    if (window.gestiotuSupabaseReady) {
      try {
        await window.gestiotuSupabaseReady;
      } catch (error) {
        console.error("[supabase-data] Error esperando al cliente Supabase.", error);
      }
    }
    return window.gestiotuSupabase || null;
  })();

  // Expuesto ya, para que supabase-sync.js sepa que este módulo existe.
  const api = {};
  window.gestiotuData = api;

  // `api.ready` se resuelve cuando el cliente está listo Y las funciones ya
  // están montadas en `api`. Así, quien haga `await gestiotuData.ready` tiene
  // la garantía de que `signUp`, `getProfile`, etc. existen de verdad.
  api.ready = (async () => {
    const sb = await clientReady;
    if (!sb) {
      console.error(
        "[supabase-data] Supabase no disponible: no se pudo cargar la librería " +
          "supabase-js o falta la configuración en JS/supabase-client.js."
      );
      return null;
    }
    Object.assign(api, buildApi(sb));
    return sb;
  })();

  function buildApi(sb) {
  // ---------- AUTENTICACIÓN ----------

  const signUp = async (email, password, name) => {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email, password) => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  };

  const getSession = async () => {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session;
  };

  const getUser = async () => {
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data.user;
  };

  const onAuthChange = (callback) => sb.auth.onAuthStateChange(callback);

  // ---------- PERFIL ----------

  const getProfile = async (userId) => {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const updateProfile = async (userId, changes) => {
    const { data, error } = await sb
      .from("profiles")
      .update(changes)
      .eq("id", userId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  // ---------- PREFERENCIAS ----------

  const getPreferences = async (userId) => {
    const { data, error } = await sb
      .from("user_preferences")
      .select("preferences")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? data.preferences : null;
  };

  const savePreferences = async (userId, preferences) => {
    const { data, error } = await sb
      .from("user_preferences")
      .upsert({ user_id: userId, preferences }, { onConflict: "user_id" })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const deletePreferences = async (userId) => {
    const { error } = await sb.from("user_preferences").delete().eq("user_id", userId);
    if (error) throw error;
  };

  // ---------- DISEÑO ----------

  const getDesign = async (userId) => {
    const { data, error } = await sb
      .from("user_design")
      .select("design")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? data.design : null;
  };

  const saveDesign = async (userId, design) => {
    const { data, error } = await sb
      .from("user_design")
      .upsert({ user_id: userId, design }, { onConflict: "user_id" })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const deleteDesign = async (userId) => {
    const { error } = await sb.from("user_design").delete().eq("user_id", userId);
    if (error) throw error;
  };

  // ---------- REGISTRO DE ALIMENTACIÓN ----------

  const listFoodLogs = async (userId, dateKey) => {
    const { data, error } = await sb
      .from("food_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("log_date", dateKey)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  };

  const addFoodLog = async (userId, entry) => {
    const { data, error } = await sb
      .from("food_logs")
      .insert({
        user_id: userId,
        log_date: entry.logDate,
        meal: entry.meal,
        food: entry.food,
        amount: entry.amount
      })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const removeFoodLog = async (id) => {
    const { error } = await sb.from("food_logs").delete().eq("id", id);
    if (error) throw error;
  };

  const clearFoodLogs = async (userId, dateKey) => {
    const { error } = await sb
      .from("food_logs")
      .delete()
      .eq("user_id", userId)
      .eq("log_date", dateKey);
    if (error) throw error;
  };

  // ---------- RACHA DE EJERCICIO ----------

  const getExerciseWeek = async (userId, weekStartDate) => {
    const { data, error } = await sb
      .from("exercise_weeks")
      .select("days")
      .eq("user_id", userId)
      .eq("week_start_date", weekStartDate)
      .maybeSingle();
    if (error) throw error;
    return data ? data.days : null;
  };

  const saveExerciseWeek = async (userId, weekStartDate, days) => {
    const { data, error } = await sb
      .from("exercise_weeks")
      .upsert(
        { user_id: userId, week_start_date: weekStartDate, days },
        { onConflict: "user_id,week_start_date" }
      )
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  // ---------- BIENESTAR SEMANAL ----------

  const getWellbeingWeek = async (userId, weekStartDate) => {
    const { data, error } = await sb
      .from("wellbeing_weeks")
      .select("days")
      .eq("user_id", userId)
      .eq("week_start_date", weekStartDate)
      .maybeSingle();
    if (error) throw error;
    return data ? data.days : null;
  };

  const saveWellbeingWeek = async (userId, weekStartDate, days) => {
    const { data, error } = await sb
      .from("wellbeing_weeks")
      .upsert(
        { user_id: userId, week_start_date: weekStartDate, days },
        { onConflict: "user_id,week_start_date" }
      )
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  // ---------- HORARIO SEMANAL DE EJERCICIO ----------

  const getExerciseSchedule = async (userId) => {
    const { data, error } = await sb
      .from("exercise_schedule_config")
      .select("schedule")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? data.schedule : null;
  };

  const saveExerciseSchedule = async (userId, schedule) => {
    const { data, error } = await sb
      .from("exercise_schedule_config")
      .upsert({ user_id: userId, schedule }, { onConflict: "user_id" })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  // ---------- RECORDATORIOS ----------

  const listReminders = async (userId) => {
    const { data, error } = await sb
      .from("time_reminders")
      .select("*")
      .eq("user_id", userId)
      .eq("is_public_holiday", false)
      .order("reminder_date", { ascending: true });
    if (error) throw error;
    return data;
  };

  const addReminder = async (userId, reminder) => {
    const { data, error } = await sb
      .from("time_reminders")
      .insert({
        user_id: userId,
        title: reminder.title,
        reminder_date: reminder.date,
        kind: reminder.kind
      })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const deleteReminder = async (id) => {
    const { error } = await sb.from("time_reminders").delete().eq("id", id);
    if (error) throw error;
  };

  // ---------- REEMPLAZO MASIVO (borra y vuelve a insertar) ----------

  const replaceFoodLogs = async (userId, dateKey, entries) => {
    const del = await sb.from("food_logs").delete().eq("user_id", userId).eq("log_date", dateKey);
    if (del.error) throw del.error;
    if (!entries.length) return [];
    const rows = entries.map((entry) => ({
      user_id: userId,
      log_date: dateKey,
      meal: entry.meal,
      food: entry.food,
      amount: entry.amount
    }));
    const ins = await sb.from("food_logs").insert(rows).select();
    if (ins.error) throw ins.error;
    return ins.data;
  };

  const replaceReminders = async (userId, reminders) => {
    const del = await sb.from("time_reminders").delete().eq("user_id", userId).eq("is_public_holiday", false);
    if (del.error) throw del.error;
    if (!reminders.length) return [];
    const rows = reminders.map((r) => ({
      user_id: userId,
      title: r.title,
      reminder_date: r.date,
      kind: r.kind
    }));
    const ins = await sb.from("time_reminders").insert(rows).select();
    if (ins.error) throw ins.error;
    return ins.data;
  };

  const replaceDailySchedule = async (userId, blocks) => {
    const del = await sb.from("daily_schedule_blocks").delete().eq("user_id", userId);
    if (del.error) throw del.error;
    if (!blocks.length) return [];
    const rows = blocks.map((b) => ({
      user_id: userId,
      activity: b.activity,
      day: b.day,
      start_time: b.start,
      end_time: b.end
    }));
    const ins = await sb.from("daily_schedule_blocks").insert(rows).select();
    if (ins.error) throw ins.error;
    return ins.data;
  };

  // ---------- HORARIO DEL DÍA ----------

  const listDailySchedule = async (userId) => {
    const { data, error } = await sb
      .from("daily_schedule_blocks")
      .select("*")
      .eq("user_id", userId)
      .order("day", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    return data;
  };

  const addDailySchedule = async (userId, block) => {
    const { data, error } = await sb
      .from("daily_schedule_blocks")
      .insert({
        user_id: userId,
        activity: block.activity,
        day: block.day,
        start_time: block.start,
        end_time: block.end
      })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const deleteDailySchedule = async (id) => {
    const { error } = await sb.from("daily_schedule_blocks").delete().eq("id", id);
    if (error) throw error;
  };

  // ---------- EXPOSICIÓN GLOBAL ----------

  return {
    // auth
    signUp,
    signIn,
    signOut,
    getSession,
    getUser,
    onAuthChange,
    // perfil
    getProfile,
    updateProfile,
    // preferencias
    getPreferences,
    savePreferences,
    deletePreferences,
    // diseño
    getDesign,
    saveDesign,
    deleteDesign,
    // alimentación
    listFoodLogs,
    addFoodLog,
    removeFoodLog,
    // semanas
    getExerciseWeek,
    saveExerciseWeek,
    getWellbeingWeek,
    saveWellbeingWeek,
    // horario ejercicio
    getExerciseSchedule,
    saveExerciseSchedule,
    // recordatorios
    listReminders,
    addReminder,
    deleteReminder,
    // horario del día
    listDailySchedule,
    addDailySchedule,
    deleteDailySchedule,
    // reemplazo masivo
    replaceFoodLogs,
    replaceReminders,
    replaceDailySchedule
  };
  }
})();
