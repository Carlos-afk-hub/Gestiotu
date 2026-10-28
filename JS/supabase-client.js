// =====================================================
// SUPABASE CLIENT - SOLO CLAVE PÚBLICA (publishable / anon)
// =====================================================
// IMPORTANTE: aquí va SIEMPRE la clave PÚBLICA (publishable / anon).
// NUNCA pongas aquí la clave secreta ("sb_secret_..." o "service_role").
// Este archivo se carga en el navegador (frontend) del visitante.
// Todas las operaciones están protegidas por Row Level Security (RLS).

// --- URL del proyecto GESTIOTU ---
// OJO: es la URL del PROYECTO, no la del panel de Supabase.
// Tu panel era https://supabase.com/dashboard/project/tzdoastvcuurrpfnzcnm
// por eso la URL del proyecto es:
const SUPABASE_URL = "https://tzdoastvcuurrpfnzcnm.supabase.co";

// --- Clave pública ---
// Esta es tu clave pública (publishable). Es seguro que esté aquí.
const SUPABASE_ANON_KEY = "sb_publishable_Iq2510qGxyvzXZU5-xSMpA_SpxTlQ07";

// Detecta si los valores siguen siendo los de ejemplo (sin configurar).
const SUPABASE_CONFIGURED =
  /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.startsWith("sb_publishable_") &&
  !SUPABASE_ANON_KEY.includes("...") &&
  !SUPABASE_ANON_KEY.includes("TU-CLAVE");

// -----------------------------------------------------
// CARGA RESISTENTE DE supabase-js
// -----------------------------------------------------
// El SDK puede tardar o fallar (red lenta, bloqueador, file://). El bundle UMD
// expone `supabase` como binding global, que no siempre es una propiedad de
// window; hay que comprobar ambos sitios antes de cargar una alternativa.

const SUPABASE_CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://unpkg.com/@supabase/supabase-js@2"
];

function getSupabaseNamespace() {
  if (typeof supabase !== "undefined" && typeof supabase.createClient === "function") {
    return supabase;
  }
  if (window.supabase && typeof window.supabase.createClient === "function") {
    return window.supabase;
  }
  return null;
}

function loadSupabaseLibrary() {
  return new Promise((resolve) => {
    let index = 0;

    const tryNext = () => {
      if (getSupabaseNamespace()) {
        return resolve(true);
      }
      if (index >= SUPABASE_CDN_URLS.length) return resolve(false);

      const script = document.createElement("script");
      script.src = SUPABASE_CDN_URLS[index++];
      script.async = false;
      script.onload = () => {
        if (getSupabaseNamespace()) {
          resolve(true);
        } else {
          tryNext();
        }
      };
      script.onerror = tryNext;
      document.head.appendChild(script);
    };

    tryNext();
  });
}

let supabaseClient = null;

// Crea el cliente una sola vez. Devuelve el cliente o null.
function createClientIfPossible() {
  if (supabaseClient) return supabaseClient;
  if (!SUPABASE_CONFIGURED) return null;
  const sdk = getSupabaseNamespace();
  if (!sdk) return null;
  try {
    supabaseClient = sdk.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    console.error("[supabase-client] No se pudo crear el cliente Supabase.", error);
    supabaseClient = null;
  }
  return supabaseClient;
}

// Publica el estado actual del cliente de forma coherente.
function publish() {
  window.gestiotuSupabase = supabaseClient;
  window.gestiotuSupabaseConfigured = Boolean(supabaseClient);
}

// Se resuelve cuando el cliente está listo (o cuando se confirma que no se
// puede crear). El resto de la app puede esperarlo con:
//   await window.gestiotuSupabaseReady
const ready = (async () => {
  if (!SUPABASE_CONFIGURED) {
    console.warn(
      "[supabase-client] Falta completar SUPABASE_URL y/o SUPABASE_ANON_KEY. " +
        "La web seguirá funcionando con almacenamiento local."
    );
    return null;
  }

  // Camino rápido: el SDK ya está disponible.
  if (createClientIfPossible()) {
    publish();
    return supabaseClient;
  }

  // Camino lento: la librería aún no está. La cargamos desde un CDN.
  const ok = await loadSupabaseLibrary();
  if (!ok) {
    console.error(
      "[supabase-client] No se pudo cargar la librería supabase-js desde ningún CDN. " +
        "Comprueba tu conexión a Internet (o el bloqueador de anuncios) y recarga la página."
    );
    publish();
    return null;
  }

  createClientIfPossible();
  // Solo publicamos cuando el cliente ya existe de verdad. Antes había dos
  // asignaciones al final del archivo que corrían antes de que terminara esta
  // carga asíncrona y dejaban window.gestiotuSupabase en null para siempre:
  // eso era lo que rompía la conexión con Supabase.
  publish();
  return supabaseClient;
})();

window.gestiotuSupabaseReady = ready;

// Intento inmediato: si la librería ya está disponible, dejamos el cliente
// publicado desde el primer momento sin esperar a la promesa.
createClientIfPossible();
publish();
