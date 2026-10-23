(async () => {
  const storageKey = "gestiotu.preferences.v1";
  const designStorageKey = "gestiotu.site-design.v1";
  // Capa de sincronización con Supabase (si está configurada).
  const sync = window.gestiotuSync || null;
  // Envoltorio de almacenamiento: escribe siempre en localStorage y, si hay
  // sesión iniciada, sincroniza con Supabase. Si no existe, usa localStorage puro.
  const store = window.gestiotuStore || window.localStorage;
  const allowedFonts = {
    inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
    georgia: 'Georgia, "Times New Roman", serif',
    arial: 'Arial, Helvetica, sans-serif',
    verdana: 'Verdana, Geneva, sans-serif',
    trebuchet: '"Trebuchet MS", Arial, sans-serif'
  };
  const defaultDesign = {
    background: "#ffffff",
    secondColor: "#f2f2f3",
    useGradient: false,
    angle: "135",
    font: "inter",
    headingColor: "#17191c"
  };
  // Esperar a que la sincronización con Supabase esté lista (si está configurada),
  // para que los datos del usuario ya estén cargados antes de pintar la interfaz.
  if (sync && sync.ready) {
    try {
      await sync.ready;
    } catch (error) {
      console.error("No se pudo inicializar la sincronización con Supabase.", error);
    }
  }

  const readDesign = () => {
    const savedDesign = JSON.parse(localStorage.getItem(designStorageKey));
    if (!savedDesign || typeof savedDesign !== "object") return null;
    const isColor = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
    return {
      background: isColor(savedDesign.background) ? savedDesign.background : defaultDesign.background,
      secondColor: isColor(savedDesign.secondColor) ? savedDesign.secondColor : defaultDesign.secondColor,
      useGradient: savedDesign.useGradient === true,
      angle: ["0", "45", "90", "135", "180"].includes(String(savedDesign.angle)) ? String(savedDesign.angle) : defaultDesign.angle,
      font: Object.hasOwn(allowedFonts, savedDesign.font) ? savedDesign.font : defaultDesign.font,
      headingColor: isColor(savedDesign.headingColor) ? savedDesign.headingColor : defaultDesign.headingColor
    };
  };

  const applyDesign = (design) => {
    const root = document.documentElement;
    if (!design) {
      delete root.dataset.customDesign;
      root.style.removeProperty("--site-background");
      root.style.removeProperty("--site-font");
      root.style.removeProperty("--font-sohne");
      root.style.removeProperty("--font-signifier");
      root.style.removeProperty("--site-heading-color");
      return;
    }
    const pageBackground = design.useGradient
      ? `linear-gradient(${design.angle}deg, ${design.background}, ${design.secondColor})`
      : design.background;
    root.dataset.customDesign = "true";
    root.style.setProperty("--site-background", pageBackground);
    root.style.setProperty("--site-font", allowedFonts[design.font] || allowedFonts.inter);
    root.style.setProperty("--font-sohne", allowedFonts[design.font] || allowedFonts.inter);
    root.style.setProperty("--font-signifier", allowedFonts[design.font] || allowedFonts.inter);
    root.style.setProperty("--site-heading-color", design.headingColor);
  };

  const getCurrentAccount = () => {
    // La sesión la gestiona Supabase Auth; aquí solo leemos el perfil cargado.
    if (sync && sync.profile) {
      return {
        id: sync.profile.id,
        name: sync.profile.name,
        email: sync.profile.email,
        role: sync.profile.role
      };
    }
    return null;
  };

  const setAccountStatus = (message) => {
    const status = document.querySelector("#account-status");
    if (status) status.textContent = message;
  };

  const installAccountControls = () => {
    const header = document.querySelector(".encabezado");
    if (!header) return;

    const isServicePage = window.location.pathname.toLowerCase().includes("/servicios/");
    const accountHref = isServicePage ? "../cuenta.html" : "cuenta.html";
    const controls = document.createElement("div");
    controls.className = "site-account-controls";
    controls.innerHTML = `
      <a class="site-account-link" href="${accountHref}">Iniciar sesión / Registro</a>
      <button class="site-logout-button" type="button" hidden>Cerrar sesión</button>
      <details class="site-editor" hidden>
        <summary>Editar sitio</summary>
        <form class="site-editor-form">
          <fieldset>
            <legend>Fondo de las páginas</legend>
            <label>Color principal <input name="background" type="color" value="${defaultDesign.background}"></label>
            <label class="site-gradient-toggle"><input name="useGradient" type="checkbox"> Usar degradado</label>
            <label class="site-second-color" hidden>Segundo color <input name="secondColor" type="color" value="${defaultDesign.secondColor}"></label>
            <label class="site-gradient-angle" hidden>Dirección
              <select name="angle"><option value="0">Arriba</option><option value="45">Diagonal</option><option value="90">Derecha</option><option value="135" selected>Diagonal inversa</option><option value="180">Abajo</option></select>
            </label>
          </fieldset>
          <label>Tipografía
            <select name="font">
              <option value="inter">Inter</option><option value="georgia">Georgia</option>
              <option value="arial">Arial</option><option value="verdana">Verdana</option>
              <option value="trebuchet">Trebuchet MS</option>
            </select>
          </label>
          <label>Color de los títulos <input name="headingColor" type="color" value="${defaultDesign.headingColor}"></label>
          <p class="site-editor-status" role="status" aria-live="polite"></p>
          <div class="site-editor-actions">
            <button type="submit">Guardar diseño</button>
            <button type="button" data-reset-design>Restablecer</button>
          </div>
          <p class="site-editor-notice">Los cambios se guardan en este navegador y no se publican para otros visitantes.</p>
        </form>
      </details>`;
    header.append(controls);

    const accountLink = controls.querySelector(".site-account-link");
    const logoutButton = controls.querySelector(".site-logout-button");
    const editor = controls.querySelector(".site-editor");
    const editorForm = controls.querySelector(".site-editor-form");
    const editorStatus = controls.querySelector(".site-editor-status");
    const gradientToggle = editorForm.elements.useGradient;
    const secondColorLabel = controls.querySelector(".site-second-color");
    const gradientAngleLabel = controls.querySelector(".site-gradient-angle");

    const refreshAccountControls = () => {
      const account = getCurrentAccount();
      accountLink.textContent = account ? `Cuenta: ${account.name}` : "Iniciar sesión / Registro";
      logoutButton.hidden = !account;
      editor.hidden = !account || account.role !== "admin";
    };

    const fillEditor = (design) => {
      Object.entries(design).forEach(([key, value]) => {
        if (editorForm.elements[key].type === "checkbox") editorForm.elements[key].checked = Boolean(value);
        else editorForm.elements[key].value = value;
      });
      secondColorLabel.hidden = !design.useGradient;
      gradientAngleLabel.hidden = !design.useGradient;
    };

    try {
      fillEditor(readDesign() || defaultDesign);
    } catch (error) {
      console.error("No se pudo leer el diseño local.", error);
      editorStatus.textContent = "No se pudo leer el diseño guardado. Puedes restablecerlo.";
      fillEditor(defaultDesign);
    }
    refreshAccountControls();
    logoutButton.addEventListener("click", async () => {
      try {
        if (sync) await sync.signOut();
      } catch (error) {
        console.error("No se pudo cerrar sesión.", error);
      }
      refreshAccountControls();
      window.location.href = accountHref;
    });

    gradientToggle.addEventListener("change", () => {
      secondColorLabel.hidden = !gradientToggle.checked;
      gradientAngleLabel.hidden = !gradientToggle.checked;
      applyDesign(readEditorDesign());
    });

    const readEditorDesign = () => ({
      background: editorForm.elements.background.value,
      secondColor: editorForm.elements.secondColor.value,
      useGradient: gradientToggle.checked,
      angle: editorForm.elements.angle.value,
      font: editorForm.elements.font.value,
      headingColor: editorForm.elements.headingColor.value
    });

    editorForm.addEventListener("input", () => applyDesign(readEditorDesign()));
    editorForm.addEventListener("change", () => applyDesign(readEditorDesign()));
    editorForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (editor.hidden) return;
      const design = readEditorDesign();
      try {
        store.setItem(designStorageKey, JSON.stringify(design));
        applyDesign(design);
        editorStatus.textContent = "Diseño guardado para todas las páginas.";
      } catch (error) {
        console.error("No se pudo guardar el diseño.", error);
        editorStatus.textContent = "No se pudo guardar el diseño. Revisa el almacenamiento del navegador.";
      }
    });
    controls.querySelector("[data-reset-design]").addEventListener("click", () => {
      try {
        store.removeItem(designStorageKey);
        fillEditor(defaultDesign);
        applyDesign(null);
        editorStatus.textContent = "Se restableció el diseño inicial.";
      } catch (error) {
        console.error("No se pudo restablecer el diseño.", error);
        editorStatus.textContent = "No se pudo restablecer el diseño.";
      }
    });

    return { refreshAccountControls, accountHref };
  };

  const accountControls = installAccountControls();
  try {
    applyDesign(readDesign());
  } catch (error) {
    console.error("No se pudo aplicar el diseño guardado.", error);
    applyDesign(null);
  }

  const accountPage = document.querySelector("[data-account-page]");
  if (accountPage) {
    const loginForm = accountPage.querySelector("[data-login-form]");
    const registerForm = accountPage.querySelector("[data-register-form]");
    const loginToggle = accountPage.querySelector("[data-show-login]");
    const registerToggle = accountPage.querySelector("[data-show-register]");

    const syncReady = window.gestiotuSync && window.gestiotuSync.ready;

    const updateInitialStatus = () => {
      if (!sync || !sync.configured) {
        setAccountStatus("Supabase no está configurado todavía. Rellena JS/supabase-client.js con tu URL y tu clave anon.");
      } else {
        const account = getCurrentAccount();
        if (account) setAccountStatus(`Ya iniciaste sesión como ${account.name}.`);
      }
    };

    // La configuración de Supabase se resuelve de forma asíncrona, así que
    // esperamos antes de mostrar el aviso inicial (si no, aparecía el error
    // de "no configurado" aunque ya estuviera lista).
    if (syncReady && typeof syncReady.then === "function") {
      syncReady.then(updateInitialStatus).catch(updateInitialStatus);
    } else {
      updateInitialStatus();
    }

    const showAccountForm = (formName) => {
      const showRegister = formName === "register";
      loginForm.hidden = showRegister;
      registerForm.hidden = !showRegister;
      loginToggle.setAttribute("aria-pressed", String(!showRegister));
      registerToggle.setAttribute("aria-pressed", String(showRegister));
      setAccountStatus("");
    };

    loginToggle.addEventListener("click", () => showAccountForm("login"));
    registerToggle.addEventListener("click", () => showAccountForm("register"));

    const requireSync = async () => {
      if (sync && sync.ready) {
        try { await sync.ready; } catch (error) { /* se evalúa abajo */ }
      }
      if (!sync || !sync.configured) {
        setAccountStatus("No se pudo conectar con Supabase. Comprueba tu conexión y recarga la página (revisa JS/supabase-client.js).");
        return false;
      }
      return true;
    };

    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!registerForm.reportValidity()) return;
      if (!(await requireSync())) return;
      const formData = new FormData(registerForm);
      const name = String(formData.get("name")).trim();
      const email = String(formData.get("email")).trim().toLowerCase();
      const password = String(formData.get("password"));
      try {
        const data = await sync.signUp(email, password, name);
        if (data && data.session) {
          setAccountStatus("Cuenta creada. Iniciando sesión...");
          window.setTimeout(() => window.location.reload(), 700);
        } else {
          setAccountStatus("Cuenta creada. Revisa tu correo para confirmarla y después inicia sesión.");
        }
        registerForm.reset();
      } catch (error) {
        console.error("No se pudo crear la cuenta.", error);
        setAccountStatus(error.message || "No se pudo crear la cuenta.");
      }
    });

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!loginForm.reportValidity()) return;
      if (!(await requireSync())) return;
      const formData = new FormData(loginForm);
      const email = String(formData.get("email")).trim().toLowerCase();
      const password = String(formData.get("password"));
      try {
        await sync.signIn(email, password);
        setAccountStatus(`Sesión iniciada${sync.profile && sync.profile.role === "admin" ? " como administrador" : ""}.`);
        loginForm.reset();
        window.setTimeout(() => window.location.reload(), 700);
      } catch (error) {
        console.error("No se pudo iniciar sesión.", error);
        setAccountStatus("Correo o contraseña incorrectos.");
      }
    });
  }

  const defaultSettings = {
    displayName: "Usuario",
    accountEmail: "gestiotu@gmail.com",
    allowContactForm: true,
    showWhatsApp: true,
    defaultTimerDuration: 25,
    budgetCurrency: "COP",
    mealPreference: "equilibrada",
    exerciseGoal: "general",
    theme: "claro",
    showDetails: true,
    showFooterDetails: true,
    visibleCategories: {
      tiempo: true,
      economia: true,
      alimentacion: true,
      ejercicio: true,
      salud: true
    },
    rememberSettings: true,
    textSize: "normal",
    reduceMotion: false,
    highContrast: false
  };

  const readSavedSettings = () => {
    try {
      const savedSettings = JSON.parse(localStorage.getItem(storageKey));
      if (!savedSettings || typeof savedSettings !== "object") return null;
      return {
        ...defaultSettings,
        ...savedSettings,
        visibleCategories: {
          ...defaultSettings.visibleCategories,
          ...savedSettings.visibleCategories
        }
      };
    } catch {
      return null;
    }
  };

  const configurationForm = document.querySelector("#preferencias-form");
  const savedSettings = readSavedSettings();
  let activeSettings = savedSettings || { ...defaultSettings };

  const readFormSettings = () => {
    if (!configurationForm) return activeSettings;
    const settings = { ...defaultSettings };

    configurationForm.querySelectorAll("[data-setting]").forEach((control) => {
      settings[control.dataset.setting] = control.type === "checkbox" ? control.checked : control.value;
    });

    settings.visibleCategories = { ...defaultSettings.visibleCategories };
    configurationForm.querySelectorAll("[data-category-setting]").forEach((control) => {
      settings.visibleCategories[control.dataset.categorySetting] = control.checked;
    });

    return settings;
  };

  const fillConfigurationForm = (settings) => {
    if (!configurationForm) return;

    configurationForm.querySelectorAll("[data-setting]").forEach((control) => {
      const value = settings[control.dataset.setting];
      if (control.type === "checkbox") {
        control.checked = Boolean(value);
      } else if (value !== undefined) {
        control.value = value;
      }
    });

    configurationForm.querySelectorAll("[data-category-setting]").forEach((control) => {
      control.checked = Boolean(settings.visibleCategories[control.dataset.categorySetting]);
    });
  };

  const applySettings = (settings) => {
    activeSettings = settings;
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.dataset.textSize = settings.textSize;
    root.dataset.motion = settings.reduceMotion ? "reducido" : "normal";
    root.dataset.contrast = settings.highContrast ? "alto" : "normal";
    root.dataset.showDetails = String(settings.showDetails);
    root.dataset.mealPreference = settings.mealPreference;

    document.querySelectorAll(".datos-contacto").forEach((details) => {
      details.hidden = !settings.showFooterDetails;
    });

    document.querySelectorAll("[data-category-section]").forEach((section) => {
      section.hidden = !settings.visibleCategories[section.dataset.categorySection];
    });

    document.querySelectorAll("[data-category-link]").forEach((link) => {
      link.hidden = !settings.visibleCategories[link.dataset.categoryLink];
    });

    document.querySelectorAll("[data-whatsapp-quick]").forEach((link) => {
      link.hidden = !settings.showWhatsApp;
    });

    const contactForm = document.querySelector("#contacto-form");
    if (contactForm) {
      contactForm.querySelectorAll("input, textarea, select, button").forEach((control) => {
        control.disabled = !settings.allowContactForm;
      });
      const nameField = contactForm.querySelector("#nombre");
      const emailField = contactForm.querySelector("#correo");
      if (nameField && document.activeElement !== nameField) {
        nameField.value = settings.displayName === "Usuario" ? "" : settings.displayName;
      }
      if (emailField && document.activeElement !== emailField) {
        emailField.value = settings.accountEmail;
      }
      const contactStatus = document.querySelector("#contacto-estado");
      if (contactStatus) {
        contactStatus.textContent = settings.allowContactForm
          ? "Tu mensaje se preparará en la aplicación de correo de este dispositivo."
          : "El formulario está desactivado. Puedes escribirnos por teléfono o correo desde el pie de página.";
      }
    }
  };

  const showConfigurationStatus = (message) => {
    const status = document.querySelector("#config-estado");
    if (status) status.textContent = message;
  };

  const activateConfigurationSection = (sectionName) => {
    document.querySelectorAll("[data-config-target]").forEach((button) => {
      const isActive = button.dataset.configTarget === sectionName;
      button.classList.toggle("activo", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    document.querySelectorAll("[data-config-section]").forEach((section) => {
      section.hidden = section.dataset.configSection !== sectionName;
    });
  };

  if (configurationForm) {
    fillConfigurationForm(activeSettings);
    activateConfigurationSection("cuenta");

    document.querySelectorAll("[data-config-target]").forEach((button) => {
      button.addEventListener("click", () => activateConfigurationSection(button.dataset.configTarget));
    });

    configurationForm.addEventListener("input", () => applySettings(readFormSettings()));
    configurationForm.addEventListener("change", () => applySettings(readFormSettings()));

    configurationForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!configurationForm.reportValidity()) return;

      const settings = readFormSettings();
      if (!Object.values(settings.visibleCategories).some(Boolean)) {
        activateConfigurationSection("inicio");
        showConfigurationStatus("Deja al menos una categoría visible en Inicio.");
        configurationForm.querySelector("[data-category-setting]")?.focus();
        return;
      }

      applySettings(settings);
      if (settings.rememberSettings) {
        store.setItem(storageKey, JSON.stringify(settings));
        showConfigurationStatus("Preferencias guardadas en este navegador.");
      } else {
        store.removeItem(storageKey);
        showConfigurationStatus("Cambios aplicados durante esta visita. No se guardaron preferencias.");
      }
    });

    document.querySelector("#descartar-preferencias")?.addEventListener("click", () => {
      const settings = readSavedSettings() || { ...defaultSettings };
      fillConfigurationForm(settings);
      applySettings(settings);
      showConfigurationStatus("Se descartaron los cambios sin guardar.");
    });

    document.querySelector("#restaurar-preferencias")?.addEventListener("click", () => {
      store.removeItem(storageKey);
      fillConfigurationForm(defaultSettings);
      applySettings(defaultSettings);
      showConfigurationStatus("Se restauraron los ajustes iniciales.");
    });
  }

  applySettings(activeSettings);

  window.addEventListener("storage", (event) => {
    if (event.key === designStorageKey || event.key === null) {
      try {
        const design = readDesign();
        applyDesign(design);
        const editor = document.querySelector(".site-editor-form");
        if (editor) {
          const editorDesign = design || defaultDesign;
          Object.entries(editorDesign).forEach(([key, value]) => {
            if (editor.elements[key].type === "checkbox") editor.elements[key].checked = Boolean(value);
            else editor.elements[key].value = value;
          });
          document.querySelector(".site-second-color").hidden = !editorDesign.useGradient;
          document.querySelector(".site-gradient-angle").hidden = !editorDesign.useGradient;
        }
      } catch (error) {
        console.error("No se pudo sincronizar el diseño guardado.", error);
      }
    }

    if (event.key === null) {
      accountControls?.refreshAccountControls();
    }

    if (event.key !== storageKey && event.key !== null) return;

    const settings = readSavedSettings() || { ...defaultSettings };
    applySettings(settings);
    fillConfigurationForm(settings);
    showConfigurationStatus("Preferencias sincronizadas desde otra pestaña.");
  });

  document.querySelectorAll("[data-facebook-share]").forEach((link) => {
    const shareUrl = new URL("https://www.facebook.com/sharer/sharer.php");
    shareUrl.searchParams.set("u", window.location.href);
    link.href = shareUrl.href;
    link.addEventListener("click", (event) => {
      if (window.location.protocol !== "file:") return;
      event.preventDefault();
      const status = link.closest(".pie-pagina").querySelector("[data-social-status]");
      status.textContent = "Para compartir esta página en Facebook, primero debe estar publicada en una dirección web pública.";
    });
  });

  document.querySelectorAll("[data-instagram-share]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = button.closest(".pie-pagina").querySelector("[data-social-status]");
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: document.title,
            text: "Conoce GESTIOTU: herramientas sencillas para organizar tu día a día.",
            url: window.location.href
          });
          status.textContent = "Se abrió el menú para compartir. Elige Instagram si está disponible.";
        } catch (error) {
          if (error.name !== "AbortError") {
            status.textContent = `No se pudo abrir el menú para compartir. ${error.message}`;
          }
        }
        return;
      }

      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      status.textContent = "Este navegador no ofrece compartir directamente con Instagram. Se abrió Instagram; puedes compartir desde la aplicación.";
    });
  });

  const contactForm = document.querySelector("#contacto-form");
  if (contactForm) {
    const accountName = activeSettings.displayName === "Usuario" ? "" : activeSettings.displayName;
    const nameField = contactForm.querySelector("#nombre");
    const emailField = contactForm.querySelector("#correo");
    if (nameField && accountName) nameField.value = accountName;
    if (emailField && activeSettings.accountEmail !== "gestiotu@gmail.com") {
      emailField.value = activeSettings.accountEmail;
    }

    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!contactForm.reportValidity()) return;

      const formData = new FormData(contactForm);
      const reason = formData.get("motivo");
      const relatedService = formData.get("servicio");
      const subject = relatedService ? `${reason} · ${relatedService}` : `${reason} para GESTIOTU`;
      const message = [
        `Nombre: ${formData.get("nombre")}`,
        `Teléfono: ${formData.get("telefono")}`,
        `Correo: ${formData.get("correo") || "No indicado"}`,
        `Motivo: ${reason}`,
        `Servicio: ${relatedService || "No especificado"}`,
        "",
        formData.get("mensaje")
      ].join("\n");
      const mailto = `mailto:gestiotu@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      const contactStatus = document.querySelector("#contacto-estado");
      if (contactStatus) {
        contactStatus.textContent = "Se abrirá tu aplicación de correo con el mensaje listo. Revisa los datos y presiona Enviar.";
      }
      window.location.href = mailto;
    });

    contactForm.addEventListener("reset", () => {
      const contactStatus = document.querySelector("#contacto-estado");
      if (contactStatus) {
        window.setTimeout(() => {
          contactStatus.textContent = "El formulario quedó limpio.";
        }, 0);
      }
    });
  }

  const timerWidget = document.querySelector("[data-timer-widget]");
  if (timerWidget) {
    const durationInput = timerWidget.querySelector("[data-timer-duration]");
    const display = timerWidget.querySelector("[data-timer-display]");
    const progress = timerWidget.querySelector("[data-timer-progress]");
    const status = timerWidget.querySelector("[data-timer-status]");
    const startButton = timerWidget.querySelector("[data-timer-start]");
    const pauseButton = timerWidget.querySelector("[data-timer-pause]");
    durationInput.value = String(activeSettings.defaultTimerDuration);
    let totalSeconds = Number(durationInput.value) * 60;
    let remainingSeconds = totalSeconds;
    let timerInterval = null;

    const renderTimer = () => {
      const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
      const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
      display.textContent = `${minutes}:${seconds}`;
      progress.max = totalSeconds;
      progress.value = totalSeconds - remainingSeconds;
    };

    const stopTimer = () => {
      window.clearInterval(timerInterval);
      timerInterval = null;
      startButton.disabled = false;
      pauseButton.disabled = true;
    };

    durationInput.addEventListener("change", () => {
      const minutes = Number(durationInput.value);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 90) {
        status.textContent = "Elige una duración entre 1 y 90 minutos.";
        return;
      }
      stopTimer();
      totalSeconds = minutes * 60;
      remainingSeconds = totalSeconds;
      renderTimer();
      status.textContent = "Duración actualizada. Cuando quieras, comienza.";
    });

    startButton.addEventListener("click", () => {
      if (timerInterval || remainingSeconds <= 0) return;
      startButton.disabled = true;
      pauseButton.disabled = false;
      status.textContent = "Sesión en curso. Mantén el foco en una sola tarea.";
      timerInterval = window.setInterval(() => {
        remainingSeconds -= 1;
        renderTimer();
        if (remainingSeconds <= 0) {
          stopTimer();
          status.textContent = "Sesión completa. Tómate una pausa antes del siguiente bloque.";
        }
      }, 1000);
    });

    pauseButton.addEventListener("click", () => {
      if (!timerInterval) return;
      stopTimer();
      status.textContent = "Sesión en pausa. Puedes retomarla cuando estés listo.";
    });

    timerWidget.querySelector("[data-timer-reset]").addEventListener("click", () => {
      stopTimer();
      const minutes = Number(durationInput.value);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 90) {
        status.textContent = "Elige una duración entre 1 y 90 minutos.";
        durationInput.reportValidity();
        return;
      }
      totalSeconds = minutes * 60;
      remainingSeconds = totalSeconds;
      renderTimer();
      status.textContent = "Temporizador reiniciado.";
    });

    renderTimer();
  }

  const budgetWidget = document.querySelector("[data-budget-widget]");
  if (budgetWidget) {
    const currencyCode = activeSettings.budgetCurrency || "COP";
    const currency = new Intl.NumberFormat(currencyCode === "USD" ? "en-US" : "es-CO", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0
    });
    const fields = Object.fromEntries(
      [...budgetWidget.querySelectorAll("[data-budget]")].map((field) => [field.dataset.budget, field])
    );
    const remainingOutput = budgetWidget.querySelector("[data-budget-remaining]");
    const rateOutput = budgetWidget.querySelector("[data-budget-rate]");
    const status = budgetWidget.querySelector("[data-budget-status]");
    const currencyLabel = budgetWidget.querySelector("[data-budget-currency-label]");
    const exampleValues = currencyCode === "USD"
      ? { income: 2800, fixed: 1200, variable: 650, savings: 400 }
      : { income: 2800000, fixed: 1200000, variable: 650000, savings: 400000 };

    Object.entries(exampleValues).forEach(([key, value]) => {
      fields[key].value = String(value);
    });
    if (currencyLabel) currencyLabel.textContent = currencyCode;

    const calculateBudget = () => {
      const income = Math.max(0, Number(fields.income.value) || 0);
      const fixed = Math.max(0, Number(fields.fixed.value) || 0);
      const variable = Math.max(0, Number(fields.variable.value) || 0);
      const savings = Math.max(0, Number(fields.savings.value) || 0);
      const remaining = income - fixed - variable - savings;
      const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

      remainingOutput.textContent = currency.format(remaining);
      rateOutput.textContent = `${savingsRate} %`;
      budgetWidget.querySelector('[data-budget-share="needs"]').textContent = currency.format(income * 0.5);
      budgetWidget.querySelector('[data-budget-share="flexible"]').textContent = currency.format(income * 0.3);
      budgetWidget.querySelector('[data-budget-share="goals"]').textContent = currency.format(income * 0.2);
      status.textContent = remaining < 0
        ? `Faltan ${currency.format(Math.abs(remaining))} para cubrir todos los valores ingresados.`
        : `Después de tus gastos y meta, quedarían ${currency.format(remaining)} disponibles.`;
    };

    budgetWidget.addEventListener("input", calculateBudget);
    calculateBudget();
  }

  const currencyWidget = document.querySelector("[data-currency-widget]");
  if (currencyWidget) {
    const amountInput = currencyWidget.querySelector("[data-currency-amount]");
    const fromSelect = currencyWidget.querySelector("[data-currency-from]");
    const toSelect = currencyWidget.querySelector("[data-currency-to]");
    const resultOutput = currencyWidget.querySelector("[data-currency-result]");
    const rateOutput = currencyWidget.querySelector("[data-currency-rate]");
    const status = currencyWidget.querySelector("[data-currency-status]");
    const refreshButton = currencyWidget.querySelector("[data-currency-refresh]");
    let currentRate = null;
    let requestId = 0;

    const formatCurrency = (amount, currencyCode) => new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: Math.abs(amount) > 0 && Math.abs(amount) < 0.01 ? 6 : 2
    }).format(amount);

    const renderConversion = () => {
      const amount = Number(amountInput.value);
      if (amountInput.value === "" || !Number.isFinite(amount) || amount < 0) {
        resultOutput.textContent = "—";
        status.textContent = "Ingresa una cantidad válida igual o mayor que cero.";
        return;
      }
      if (currentRate === null) {
        resultOutput.textContent = "—";
        return;
      }
      resultOutput.textContent = formatCurrency(amount * currentRate, toSelect.value);
    };

    const loadCurrencyRate = async () => {
      const activeRequest = ++requestId;
      const fromCurrency = fromSelect.value;
      const toCurrency = toSelect.value;
      currentRate = null;
      resultOutput.textContent = "—";
      rateOutput.textContent = "Consultando tasa de cambio…";
      status.textContent = "Conectando con la fuente de tasas de cambio.";
      refreshButton.disabled = true;

      try {
        const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(fromCurrency)}`);
        if (!response.ok) {
          throw new Error(`La fuente respondió con estado ${response.status}.`);
        }
        const rateData = await response.json();
        const rate = rateData.rates && rateData.rates[toCurrency];
        if (rateData.result !== "success" || !Number.isFinite(rate) || rate <= 0) {
          throw new Error("La fuente no devolvió una tasa válida para estas monedas.");
        }
        if (activeRequest !== requestId) return;

        currentRate = rate;
        const rateText = new Intl.NumberFormat("es-CO", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4
        }).format(rate);
        rateOutput.textContent = `1 ${fromCurrency} = ${rateText} ${toCurrency}`;
        const updateDate = new Date(rateData.time_last_update_utc);
        status.textContent = Number.isNaN(updateDate.getTime())
          ? "Tasa de referencia actualizada."
          : `Última actualización de la fuente: ${new Intl.DateTimeFormat("es-CO", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC"
          }).format(updateDate)} UTC.`;
        renderConversion();
      } catch (error) {
        if (activeRequest !== requestId) return;
        rateOutput.textContent = "Tasa no disponible.";
        status.textContent = `No fue posible consultar la tasa de cambio. ${error.message}`;
      } finally {
        if (activeRequest === requestId) refreshButton.disabled = false;
      }
    };

    amountInput.addEventListener("input", renderConversion);
    fromSelect.addEventListener("change", loadCurrencyRate);
    toSelect.addEventListener("change", loadCurrencyRate);
    refreshButton.addEventListener("click", loadCurrencyRate);
    loadCurrencyRate();
  }

  const mealWidget = document.querySelector("[data-meal-widget]");
  if (mealWidget) {
    const mealPlans = {
      equilibrada: [
        ["Avena con fruta y yogur", "Fruta", "Arroz, legumbres y ensalada", "Arepa con queso", "Tortilla de verduras y arepa"],
        ["Pan integral, huevo y fruta", "Yogur", "Pollo, papa y vegetales", "Mandarina y nueces", "Sopa casera con una guarnición"],
        ["Yogur con avena y banano", "Manzana", "Pescado, arroz y ensalada", "Pan integral con queso", "Lentejas con verduras"]
      ],
      vegetariana: [
        ["Avena con fruta y yogur", "Fruta", "Garbanzos con arroz y ensalada", "Arepa con queso", "Tortilla de verduras y arepa"],
        ["Pan integral, aguacate y fruta", "Yogur", "Lentejas con papa y vegetales", "Banano", "Quesadilla de fríjoles y verduras"],
        ["Yogur con avena y banano", "Manzana", "Pasta con tomate y vegetales", "Pan integral con hummus", "Crema de verduras con tostadas"]
      ],
      rapida: [
        ["Yogur, fruta y granola", "Fruta", "Wrap de pollo y vegetales", "Arepa con queso", "Arepa con huevo y tomate"],
        ["Avena preparada desde la noche", "Yogur", "Ensalada de atún y papa", "Banano", "Tostadas con queso y vegetales"],
        ["Pan integral con queso y fruta", "Mandarina", "Arroz con huevo y vegetales", "Yogur", "Sándwich caliente y ensalada"]
      ]
    };
    const styleSelect = mealWidget.querySelector("[data-meal-style]");
    styleSelect.value = activeSettings.mealPreference || "equilibrada";
    const results = mealWidget.querySelector("[data-meal-results]");
    const status = mealWidget.querySelector("[data-meal-status]");
    let planIndex = 0;

    mealWidget.querySelector("[data-meal-generate]").addEventListener("click", () => {
      const selectedPlans = mealPlans[styleSelect.value] || mealPlans.equilibrada;
      const plan = selectedPlans[planIndex % selectedPlans.length];
      const mealNames = ["DESAYUNO", "MEDIA MAÑANA", "ALMUERZO", "ONCES", "CENA"];
      const cards = plan.map((meal, index) => {
        const article = document.createElement("article");
        const label = document.createElement("span");
        const description = document.createElement("p");
        label.textContent = mealNames[index];
        description.textContent = meal;
        article.append(label, description);
        return article;
      });
      results.replaceChildren(...cards);
      planIndex += 1;
      status.textContent = "Nueva propuesta lista. Puedes cambiarla o adaptarla a lo que tienes.";
    });
  }

  const foodBalanceWidget = document.querySelector("[data-food-balance]");
  if (foodBalanceWidget) {
    const fields = [...foodBalanceWidget.querySelectorAll("[data-food-group]")];
    const progress = document.querySelector("[data-food-balance-progress]");
    const status = document.querySelector("[data-food-balance-status]");
    const updateBalance = () => {
      const total = fields.reduce((sum, field) => sum + Math.max(0, Number(field.value) || 0), 0);
      progress.value = Math.min(total, 100);
      status.textContent = total === 100
        ? "Distribución completa: 100 %. Ajusta los valores según tus preferencias."
        : total < 100
          ? `Total: ${total} %. Quedan ${100 - total} % por distribuir.`
          : `Total: ${total} %. Reduce ${total - 100} % para completar el balance.`;
    };
    foodBalanceWidget.addEventListener("input", updateBalance);
    updateBalance();
  }

  const foodLogForm = document.querySelector("[data-food-log-form]");
  if (foodLogForm) {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const foodLogStorageKey = `gestiotu.food-log.${dateKey}`;
    const foodLogList = document.querySelector("[data-food-log-list]");
    const foodLogStatus = document.querySelector("[data-food-log-status]");
    let foodLog = [];

    try {
      const savedFoodLog = JSON.parse(localStorage.getItem(foodLogStorageKey));
      if (Array.isArray(savedFoodLog)) foodLog = savedFoodLog;
    } catch {
      store.removeItem(foodLogStorageKey);
    }

    const renderFoodLog = () => {
      const entries = foodLog.map((entry) => {
        const item = document.createElement("li");
        item.dataset.foodLogId = entry.id;
        const copy = document.createElement("span");
        copy.textContent = `${entry.meal} · ${entry.food} · ${entry.amount}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.dataset.foodLogRemove = "";
        remove.className = "schedule-remove";
        remove.textContent = "Quitar";
        item.append(copy, remove);
        return item;
      });
      foodLogList.replaceChildren(...entries);
    };

    foodLogForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!foodLogForm.reportValidity()) return;
      const formData = new FormData(foodLogForm);
      foodLog.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        meal: formData.get("meal"),
        food: formData.get("food").trim(),
        amount: formData.get("amount").trim()
      });
      store.setItem(foodLogStorageKey, JSON.stringify(foodLog));
      renderFoodLog();
      foodLogForm.elements.food.value = "";
      foodLogForm.elements.amount.value = "";
      foodLogStatus.textContent = "Registro guardado solo en este dispositivo.";
    });

    foodLogList.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-food-log-remove]");
      const item = event.target.closest("[data-food-log-id]");
      if (!removeButton || !item) return;
      foodLog = foodLog.filter((entry) => entry.id !== item.dataset.foodLogId);
      store.setItem(foodLogStorageKey, JSON.stringify(foodLog));
      renderFoodLog();
    });

    document.querySelector("[data-food-log-clear]").addEventListener("click", () => {
      foodLog = [];
      store.removeItem(foodLogStorageKey);
      renderFoodLog();
      foodLogStatus.textContent = "Registro de hoy eliminado.";
    });

    renderFoodLog();
  }

  const mealReminderForm = document.querySelector("[data-meal-reminder-form]");
  if (mealReminderForm) {
    mealReminderForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!mealReminderForm.reportValidity()) return;
      const formData = new FormData(mealReminderForm);
      const now = new Date();
      const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const time = String(formData.get("time")).replace(":", "");
      const title = String(formData.get("kind"));
      const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//GESTIOTU//Recordatorio de comida//ES",
        "BEGIN:VEVENT",
        `UID:${Date.now()}@gestiotu.local`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
        `DTSTART:${day}T${time}00`,
        `SUMMARY:${title}`,
        "RRULE:FREQ=DAILY",
        "BEGIN:VALARM",
        "TRIGGER:-PT10M",
        "ACTION:DISPLAY",
        `DESCRIPTION:Hora de ${title.toLocaleLowerCase("es-CO")}`,
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR"
      ].join("\r\n");
      const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `gestiotu-${title.toLocaleLowerCase("es-CO").replaceAll(" ", "-")}.ics`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      document.querySelector("[data-meal-reminder-status]").textContent = "Recordatorio diario descargado; impórtalo en tu calendario para activar la alarma.";
    });
  }

  const restaurantSearch = document.querySelector("[data-restaurant-search]");
  if (restaurantSearch) {
    restaurantSearch.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!restaurantSearch.reportValidity()) return;
      const formData = new FormData(restaurantSearch);
      const search = `${formData.get("kind")} cerca de ${formData.get("location").trim()}`;
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(search)}`, "_blank", "noopener,noreferrer");
    });
  }

  const bmiWidget = document.querySelector("[data-bmi-widget]");
  if (bmiWidget) {
    const ageField = bmiWidget.querySelector("[data-bmi-age]");
    const weightField = bmiWidget.querySelector("[data-bmi-weight]");
    const heightField = bmiWidget.querySelector("[data-bmi-height]");
    const result = bmiWidget.querySelector("[data-bmi-result]");
    const status = bmiWidget.querySelector("[data-bmi-status]");
    const numberFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

    const updateBmi = () => {
      const age = Number(ageField.value);
      const weight = Number(weightField.value);
      const height = Number(heightField.value) / 100;
      if (age < 18 || weight <= 0 || height <= 0) {
        result.textContent = "--";
        status.textContent = "Esta referencia es solo para adultos desde los 18 años.";
        return;
      }
      const bmi = weight / (height * height);
      result.textContent = numberFormat.format(bmi);
      status.textContent = bmi >= 30
        ? "El valor alcanza el umbral adulto de IMC 30. No es un diagnóstico; consulta a un profesional para interpretarlo."
        : bmi >= 25
          ? "El valor alcanza el umbral adulto de IMC 25. No es un diagnóstico; consulta a un profesional para interpretarlo."
          : "El valor está por debajo del umbral adulto de IMC 25. No es una evaluación completa de salud.";
    };

    [ageField, weightField, heightField].forEach((field) => field.addEventListener("input", updateBmi));
    updateBmi();
  }

  const exerciseRoutine = document.querySelector(".exercise-routine");
  if (exerciseRoutine) {
    const goal = exerciseRoutine.querySelector("[data-exercise-goal]");
    const routineList = exerciseRoutine.querySelector("[data-exercise-routine-list]");
    const status = exerciseRoutine.querySelector("[data-exercise-routine-status]");
    const routines = {
      general: ["Calentamiento suave · 3 minutos", "Caminata a ritmo cómodo · 10 minutos", "Vuelta a la calma · 3 minutos"],
      fuerza: ["Movilidad articular suave · 3 minutos", "Sentarse y ponerse de pie de una silla · 2 series de 8", "Flexiones contra la pared · 2 series de 8", "Descanso entre movimientos"],
      movilidad: ["Círculos lentos de hombros · 1 minuto", "Movilidad de tobillos sentado · 1 minuto por lado", "Estiramiento suave de piernas · 2 minutos", "Respiración tranquila · 2 minutos"]
    };
    goal.value = activeSettings.exerciseGoal || "general";
    exerciseRoutine.querySelector("[data-exercise-generate]").addEventListener("click", () => {
      const items = (routines[goal.value] || routines.general).map((activity) => {
        const item = document.createElement("li");
        item.textContent = activity;
        return item;
      });
      routineList.replaceChildren(...items);
      status.textContent = "Rutina inicial lista. Detente si sientes dolor o malestar.";
    });
  }

  const calorieWidget = document.querySelector(".calorie-widget");
  if (calorieWidget) {
    const weight = calorieWidget.querySelector("[data-exercise-weight]");
    const minutes = calorieWidget.querySelector("[data-exercise-minutes]");
    const intensity = calorieWidget.querySelector("[data-exercise-intensity]");
    const output = calorieWidget.querySelector("[data-exercise-calories]");
    const updateCalories = () => {
      const mass = Number(weight.value);
      const duration = Number(minutes.value);
      const met = Number(intensity.value);
      if (mass <= 0 || duration <= 0) {
        output.textContent = "-- kcal";
        return;
      }
      output.textContent = `${Math.round((met * 3.5 * mass / 200) * duration)} kcal`;
    };
    [weight, minutes, intensity].forEach((field) => field.addEventListener("input", updateCalories));
    [weight, minutes, intensity].forEach((field) => field.addEventListener("change", updateCalories));
    updateCalories();
  }

  const exerciseStreak = document.querySelector("[data-exercise-streak]");
  if (exerciseStreak) {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    const streakStorageKey = `gestiotu.exercise-week.${weekKey}`;
    const checks = [...exerciseStreak.querySelectorAll("[data-exercise-day]")];
    const count = exerciseStreak.querySelector("[data-exercise-count]");
    const message = exerciseStreak.querySelector("[data-exercise-message]");
    const progress = exerciseStreak.querySelector("[data-exercise-progress]");

    try {
      const savedDays = JSON.parse(localStorage.getItem(streakStorageKey));
      if (Array.isArray(savedDays)) {
        checks.forEach((check) => {
          check.checked = savedDays.includes(Number(check.dataset.exerciseDay));
        });
      }
    } catch {
      store.removeItem(streakStorageKey);
    }

    const updateStreak = () => {
      const activeDays = checks.filter((check) => check.checked).map((check) => Number(check.dataset.exerciseDay));
      count.textContent = `${activeDays.length} de 7 días`;
      progress.value = activeDays.length;
      message.textContent = activeDays.length === 7 ? "Semana completada; descansa y retoma a tu ritmo." : "La constancia no requiere entrenar todos los días.";
      store.setItem(streakStorageKey, JSON.stringify(activeDays));
    };
    checks.forEach((check) => check.addEventListener("change", updateStreak));
    exerciseStreak.querySelector("[data-exercise-clear]").addEventListener("click", () => {
      checks.forEach((check) => {
        check.checked = false;
      });
      updateStreak();
    });
    updateStreak();
  }

  const exerciseSchedule = document.querySelector("[data-exercise-schedule]");
  if (exerciseSchedule) {
    const scheduleStorageKey = "gestiotu.exercise-schedule.v1";
    const recommendations = {
      pecho: "Flexiones contra la pared o inclinadas, press ligero y extensión suave de tríceps.",
      espalda: "Remo con banda elástica o mochila ligera y curl de bíceps con poco peso.",
      piernas: "Sentadillas a una silla, puente de glúteos y elevación de talones.",
      hombros: "Círculos de hombros, elevaciones controladas y press ligero sin dolor.",
      core: "Bird-dog, dead bug y plancha apoyada en la pared.",
      completo: "Marcha en el sitio, sentadilla a silla y remo ligero, a ritmo cómodo.",
      movilidad: "Movilidad suave de cadera y hombros, estiramientos cómodos y caminata tranquila.",
      cardio: "Caminata cómoda o baile suave; termina con unos minutos de vuelta a la calma."
    };
    const cards = [...exerciseSchedule.querySelectorAll("[data-schedule-day]")];
    const status = exerciseSchedule.querySelector("[data-schedule-status]");

    try {
      const savedSchedule = JSON.parse(localStorage.getItem(scheduleStorageKey));
      if (savedSchedule && typeof savedSchedule === "object" && !Array.isArray(savedSchedule)) {
        cards.forEach((card) => {
          const savedDay = savedSchedule[card.dataset.scheduleDay];
          if (!savedDay || typeof savedDay !== "object") return;
          const time = card.querySelector("[data-schedule-time]");
          const focus = card.querySelector("[data-schedule-focus]");
          const exercises = card.querySelector("[data-schedule-exercises]");
          if ([...time.options].some((option) => option.value === savedDay.time)) time.value = savedDay.time;
          if ([...focus.options].some((option) => option.value === savedDay.focus)) focus.value = savedDay.focus;
          if (typeof savedDay.exercises === "string") exercises.value = savedDay.exercises.slice(0, 160);
        });
      }
    } catch (error) {
      status.textContent = `No fue posible leer el horario guardado. ${error.message}`;
    }

    const updateSchedule = (save = false) => {
      const schedule = {};
      cards.forEach((card) => {
        const focus = card.querySelector("[data-schedule-focus]");
        const customExercises = card.querySelector("[data-schedule-exercises]");
        const suggestion = card.querySelector("[data-schedule-suggestion]");
        const customCopy = card.querySelector("[data-schedule-custom-copy]");
        suggestion.textContent = `Sugerencia: ${recommendations[focus.value] || recommendations.completo}`;
        const customText = customExercises.value.trim();
        customCopy.textContent = customText ? `Mis ejercicios: ${customText}` : "";
        customCopy.hidden = !customText;
        schedule[card.dataset.scheduleDay] = {
          time: card.querySelector("[data-schedule-time]").value,
          focus: focus.value,
          exercises: customExercises.value.slice(0, 160)
        };
      });
      if (!save) return;
      try {
        store.setItem(scheduleStorageKey, JSON.stringify(schedule));
        status.textContent = "Horario guardado en este dispositivo.";
        return true;
      } catch (error) {
        status.textContent = `No se pudo guardar el horario en este dispositivo. ${error.message}`;
        return false;
      }
    };

    exerciseSchedule.addEventListener("input", () => updateSchedule(true));
    exerciseSchedule.addEventListener("change", () => updateSchedule(true));
    exerciseSchedule.querySelector("[data-schedule-print]").addEventListener("click", () => {
      const saved = updateSchedule(true);
      if (saved) {
        status.textContent = "En la ventana de impresión, elige «Guardar como PDF» para descargar tu horario.";
      } else {
        status.textContent += " Puedes continuar y elegir «Guardar como PDF» en la ventana de impresión.";
      }
      window.print();
    });
    updateSchedule();
  }

  const habitWidget = document.querySelector("[data-habit-widget]");
  if (habitWidget) {
    const habitStorageKey = "gestiotu.wellbeing-week.v1";
    const checks = [...habitWidget.querySelectorAll("[data-habit-day]")];
    const progress = habitWidget.querySelector("[data-habit-progress]");
    const count = habitWidget.querySelector("[data-habit-count]");
    const message = habitWidget.querySelector("[data-habit-message]");

    try {
      const savedDays = JSON.parse(localStorage.getItem(habitStorageKey));
      if (Array.isArray(savedDays)) {
        checks.forEach((check) => {
          check.checked = savedDays.includes(Number(check.dataset.habitDay));
        });
      }
    } catch {
      store.removeItem(habitStorageKey);
    }

    const updateHabitProgress = () => {
      const completedDays = checks.filter((check) => check.checked).length;
      count.textContent = `${completedDays} de 7 días`;
      progress.value = completedDays;
      message.textContent = completedDays === 7
        ? "Una semana llena de momentos para ti."
        : completedDays === 0
          ? "Todo empieza con un momento."
          : "Cada momento cuenta, a tu ritmo.";
      store.setItem(habitStorageKey, JSON.stringify(
        checks.filter((check) => check.checked).map((check) => Number(check.dataset.habitDay))
      ));
    };

    checks.forEach((check) => check.addEventListener("change", updateHabitProgress));
    habitWidget.querySelector("[data-habit-reset]").addEventListener("click", () => {
      checks.forEach((check) => {
        check.checked = false;
      });
      updateHabitProgress();
    });
    updateHabitProgress();
  }

  const calendarWidget = document.querySelector("[data-calendar-widget]");
  if (calendarWidget) {
    const reminderStorageKey = "gestiotu.time-reminders.v1";
    const calendarLabel = calendarWidget.querySelector("[data-calendar-label]");
    const calendarYear = calendarWidget.querySelector("[data-calendar-year]");
    const calendarDays = calendarWidget.querySelector("[data-calendar-days]");
    const reminderList = calendarWidget.querySelector("[data-reminder-list]");
    const reminderForm = calendarWidget.querySelector("[data-reminder-form]");
    const reminderStatus = calendarWidget.querySelector("[data-calendar-status]");
    const holidayStatus = calendarWidget.querySelector("[data-calendar-holiday-status]");
    const reminderDateInput = reminderForm.elements.date;
    const reminderTitleInput = reminderForm.elements.title;
    const monthNames = new Intl.DateTimeFormat("es-CO", { month: "long" });
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    let viewedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    let reminders = [];
    let publicHolidays = [];
    let holidayRequestId = 0;
    const holidayCache = new Map();

    try {
      const savedReminders = JSON.parse(localStorage.getItem(reminderStorageKey));
      if (Array.isArray(savedReminders)) reminders = savedReminders;
    } catch {
      store.removeItem(reminderStorageKey);
    }

    const saveReminders = () => store.setItem(reminderStorageKey, JSON.stringify(reminders));
    const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const escapeCalendarText = (value) => String(value).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");

    const loadNationalHolidays = async (year) => {
      if (holidayCache.has(year)) {
        publicHolidays = holidayCache.get(year);
        holidayStatus.textContent = `${publicHolidays.length} festivos nacionales cargados para ${year}.`;
        renderCalendar();
        renderReminderList();
        return;
      }

      const requestId = ++holidayRequestId;
      holidayStatus.textContent = `Consultando festivos de Colombia para ${year}…`;
      try {
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/CO`);
        if (!response.ok) throw new Error("No fue posible consultar el servicio de festivos.");
        const data = await response.json();
        const yearHolidays = data.filter((holiday) => holiday.global).map((holiday) => ({
          id: `co-${holiday.date}`,
          title: holiday.localName,
          date: `${holiday.date}T09:00`,
          kind: "festivo",
          publicHoliday: true
        }));
        holidayCache.set(year, yearHolidays);
        if (requestId !== holidayRequestId || viewedMonth.getFullYear() !== year) return;
        publicHolidays = yearHolidays;
        holidayStatus.textContent = `${publicHolidays.length} festivos nacionales cargados para ${year}.`;
        renderCalendar();
        renderReminderList();
      } catch {
        if (requestId === holidayRequestId) {
          holidayStatus.textContent = "No se pudieron cargar los festivos. El calendario y tus fechas guardadas siguen disponibles.";
        }
      }
    };

    const downloadCalendarEvent = (reminder) => {
      const start = new Date(reminder.date);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const toCalendarDate = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      const calendarFile = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//GESTIOTU//Agenda personal//ES",
        "BEGIN:VEVENT",
        `UID:${reminder.id}@gestiotu.local`,
        `DTSTAMP:${toCalendarDate(new Date())}`,
        `DTSTART:${toCalendarDate(start)}`,
        `DTEND:${toCalendarDate(end)}`,
        `SUMMARY:${escapeCalendarText(reminder.title)}`,
        `DESCRIPTION:${escapeCalendarText(reminder.kind === "importante" ? "Fecha importante" : "Recordatorio personal")}`,
        "END:VEVENT",
        "END:VCALENDAR"
      ].join("\r\n");
      const blob = new Blob([calendarFile], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${reminder.id}.ics`;
      link.click();
      URL.revokeObjectURL(url);
    };

    const renderReminderList = () => {
      const todayKey = localDateKey(new Date());
      const upcoming = [...reminders, ...publicHolidays]
        .filter((reminder) => reminder.date.slice(0, 10) >= todayKey)
        .sort((first, second) => first.date.localeCompare(second.date))
        .slice(0, 8);
      const items = upcoming.map((reminder) => {
        const item = document.createElement("li");
        item.className = reminder.publicHoliday ? "calendar-event-item calendar-holiday-item" : "calendar-event-item";
        if (!reminder.publicHoliday) item.dataset.reminderId = reminder.id;
        const copy = document.createElement("div");
        copy.className = "calendar-event-copy";
        const title = document.createElement("strong");
        const time = document.createElement("time");
        title.textContent = reminder.title;
        time.dateTime = reminder.date;
        const date = new Date(reminder.publicHoliday ? `${reminder.date.slice(0, 10)}T12:00` : reminder.date);
        time.textContent = reminder.publicHoliday
          ? `Festivo nacional · ${date.toLocaleDateString("es-CO", { dateStyle: "medium" })}`
          : `${reminder.kind === "importante" ? "Fecha importante" : "Recordatorio"} · ${date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}`;
        copy.append(title, time);
        item.append(copy);
        if (!reminder.publicHoliday) {
          const actions = document.createElement("div");
          actions.className = "calendar-event-actions";
          const exportButton = document.createElement("button");
          exportButton.type = "button";
          exportButton.dataset.reminderExport = "";
          exportButton.textContent = "Exportar .ics";
          const removeButton = document.createElement("button");
          removeButton.type = "button";
          removeButton.dataset.reminderRemove = "";
          removeButton.textContent = "Quitar";
          actions.append(exportButton, removeButton);
          item.append(actions);
        }
        return item;
      });
      reminderList.replaceChildren(...items);
    };

    const renderCalendar = () => {
      const year = viewedMonth.getFullYear();
      const month = viewedMonth.getMonth();
      calendarLabel.textContent = monthNames.format(viewedMonth);
      calendarYear.textContent = String(year);
      const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const todayKey = localDateKey(new Date());
      const cells = [];

      for (let blank = 0; blank < firstWeekday; blank += 1) {
        const emptyCell = document.createElement("span");
        emptyCell.className = "calendar-day-empty";
        emptyCell.setAttribute("aria-hidden", "true");
        cells.push(emptyCell);
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        const dateKey = localDateKey(date);
        const dayEvents = [...reminders, ...publicHolidays].filter((reminder) => reminder.date.startsWith(dateKey));
        const button = document.createElement("button");
        button.type = "button";
        button.className = "calendar-day";
        button.textContent = String(day);
        button.dataset.calendarDate = dateKey;
        button.setAttribute("role", "gridcell");
        button.setAttribute("aria-label", `${dayNames[date.getDay()]} ${day} de ${monthNames.format(date)}${dayEvents.length ? `, ${dayEvents.length} fechas guardadas` : ""}`);
        if (dateKey === todayKey) button.classList.add("is-today");
        if (dayEvents.length) button.classList.add("has-reminder");
        cells.push(button);
      }

      calendarDays.replaceChildren(...cells);
    };

    calendarWidget.querySelector("[data-calendar-prev]").addEventListener("click", () => {
      viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() - 1, 1);
      renderCalendar();
      loadNationalHolidays(viewedMonth.getFullYear());
    });
    calendarWidget.querySelector("[data-calendar-next]").addEventListener("click", () => {
      viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + 1, 1);
      renderCalendar();
      loadNationalHolidays(viewedMonth.getFullYear());
    });
    calendarDays.addEventListener("click", (event) => {
      const dayButton = event.target.closest("[data-calendar-date]");
      if (!dayButton) return;
      reminderDateInput.value = `${dayButton.dataset.calendarDate}T09:00`;
      reminderTitleInput.focus();
    });

    reminderForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!reminderForm.reportValidity()) return;
      const formData = new FormData(reminderForm);
      const reminder = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: formData.get("title").trim(),
        date: formData.get("date"),
        kind: formData.get("kind")
      };
      reminders.push(reminder);
      saveReminders();
      renderCalendar();
      renderReminderList();
      reminderForm.reset();
      reminderStatus.textContent = "Fecha guardada. Usa Exportar .ics para añadirla a tu calendario y recibir avisos con la página cerrada.";
    });

    reminderList.addEventListener("click", (event) => {
      const item = event.target.closest("[data-reminder-id]");
      if (!item) return;
      const reminder = reminders.find((entry) => entry.id === item.dataset.reminderId);
      if (event.target.closest("[data-reminder-export]")) {
        if (reminder) downloadCalendarEvent(reminder);
      } else if (event.target.closest("[data-reminder-remove]")) {
        reminders = reminders.filter((entry) => entry.id !== item.dataset.reminderId);
        saveReminders();
        renderCalendar();
        renderReminderList();
        reminderStatus.textContent = "Fecha eliminada.";
      }
    });

    calendarWidget.querySelector("[data-reminder-permission]").addEventListener("click", async () => {
      if (!("Notification" in window)) {
        reminderStatus.textContent = "Este navegador no admite avisos aquí. Exporta las fechas al calendario de tu dispositivo.";
        return;
      }
      const permission = await Notification.requestPermission();
      reminderStatus.textContent = permission === "granted"
        ? "Avisos activados mientras esta página permanezca abierta. Exporta las fechas para recordatorios externos."
        : "Avisos no autorizados. Puedes exportar las fechas al calendario de tu dispositivo.";
    });

    window.setInterval(() => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const now = Date.now();
      reminders.forEach((reminder) => {
        const reminderTime = new Date(reminder.date).getTime();
        const notificationKey = `gestiotu.notified.${reminder.id}`;
        if (reminderTime <= now && reminderTime > now - 60000 && !sessionStorage.getItem(notificationKey)) {
          new Notification(reminder.title, { body: "Recordatorio de GESTIOTU" });
          sessionStorage.setItem(notificationKey, "1");
        }
      });
    }, 30000);

    renderCalendar();
    renderReminderList();
    loadNationalHolidays(viewedMonth.getFullYear());
  }

  const scheduleWidget = document.querySelector("[data-schedule-widget]");
  if (scheduleWidget) {
    const scheduleStorageKey = "gestiotu.daily-schedule.v1";
    const scheduleForm = scheduleWidget.querySelector("[data-schedule-form]");
    const scheduleList = scheduleWidget.querySelector("[data-schedule-list]");
    const scheduleStatus = scheduleWidget.querySelector("[data-schedule-status]");
    const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    let schedule = [];

    try {
      const savedSchedule = JSON.parse(localStorage.getItem(scheduleStorageKey));
      if (Array.isArray(savedSchedule)) schedule = savedSchedule;
    } catch {
      store.removeItem(scheduleStorageKey);
    }

    const renderSchedule = () => {
      const ordered = [...schedule].sort((first, second) => first.day - second.day || first.start.localeCompare(second.start));
      const rows = ordered.map((entry) => {
        const item = document.createElement("li");
        item.dataset.scheduleId = entry.id;
        const copy = document.createElement("div");
        copy.className = "schedule-item-copy";
        const activity = document.createElement("strong");
        const time = document.createElement("span");
        activity.textContent = entry.activity;
        time.textContent = `${dayNames[entry.day]} · ${entry.start}–${entry.end}`;
        copy.append(activity, time);
        const remove = document.createElement("button");
        remove.className = "schedule-remove";
        remove.type = "button";
        remove.dataset.scheduleRemove = "";
        remove.textContent = "Quitar";
        item.append(copy, remove);
        return item;
      });
      scheduleList.replaceChildren(...rows);
    };

    scheduleForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!scheduleForm.reportValidity()) return;
      const formData = new FormData(scheduleForm);
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        activity: formData.get("activity").trim(),
        day: Number(formData.get("day")),
        start: formData.get("start"),
        end: formData.get("end")
      };
      if (entry.start >= entry.end) {
        scheduleStatus.textContent = "La hora de fin debe ser posterior a la hora de inicio.";
        return;
      }
      const overlaps = schedule.some((saved) => saved.day === entry.day && entry.start < saved.end && entry.end > saved.start);
      if (overlaps) {
        scheduleStatus.textContent = "Ese horario se cruza con otra actividad del mismo día.";
        return;
      }
      schedule.push(entry);
      store.setItem(scheduleStorageKey, JSON.stringify(schedule));
      renderSchedule();
      scheduleStatus.textContent = "Actividad añadida al horario de este dispositivo.";
      scheduleForm.elements.activity.value = "";
    });

    scheduleList.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-schedule-remove]");
      const item = event.target.closest("[data-schedule-id]");
      if (!removeButton || !item) return;
      schedule = schedule.filter((entry) => entry.id !== item.dataset.scheduleId);
      store.setItem(scheduleStorageKey, JSON.stringify(schedule));
      renderSchedule();
      scheduleStatus.textContent = "Actividad eliminada del horario.";
    });

    renderSchedule();
  }

  const healthTopicSearch = document.querySelector("[data-health-topic-search]");
  if (healthTopicSearch) {
    const topics = [
      {
        terms: ["diabetes"],
        label: "Diabetes",
        description: "La diabetes es una enfermedad crónica en la que el cuerpo no produce suficiente insulina o no la utiliza de manera eficaz, lo que puede elevar la glucosa en la sangre.",
        url: "https://www.who.int/es/health-topics/diabetes"
      },
      {
        terms: ["cancer", "cáncer"],
        label: "Cáncer",
        description: "El cáncer es un conjunto de enfermedades en las que algunas células crecen sin control y pueden extenderse a otras partes del cuerpo.",
        url: "https://www.who.int/es/health-topics/cancer"
      },
      {
        terms: ["depresion", "depresión", "salud mental"],
        label: "Depresión y salud mental",
        description: "La depresión es un trastorno del estado de ánimo que puede causar tristeza persistente y pérdida de interés, y afectar la vida cotidiana.",
        url: "https://www.who.int/es/health-topics/depression"
      },
      {
        terms: ["colera", "cólera"],
        label: "Cólera",
        description: "El cólera es una infección intestinal que se transmite principalmente por agua o alimentos contaminados y puede causar diarrea intensa.",
        url: "https://www.who.int/es/health-topics/cholera"
      },
      {
        terms: ["coronavirus", "covid"],
        label: "Coronavirus y COVID-19",
        description: "Los coronavirus son una familia de virus; algunos causan enfermedades respiratorias en las personas, entre ellas la COVID-19.",
        url: "https://www.who.int/es/health-topics/coronavirus"
      },
      {
        terms: ["alimentacion", "alimentación", "dieta"],
        label: "Alimentación saludable",
        description: "Una alimentación saludable aporta variedad y equilibrio de nutrientes y se adapta a las necesidades de cada persona y etapa de vida.",
        url: "https://www.who.int/es/health-topics/healthy-diet"
      },
      {
        terms: ["actividad fisica", "actividad física", "ejercicio"],
        label: "Actividad física",
        description: "La actividad física incluye los movimientos del cuerpo que requieren energía, como caminar, jugar, trabajar o practicar ejercicio.",
        url: "https://www.who.int/es/health-topics/physical-activity"
      }
    ];
    const queryField = healthTopicSearch.elements.topic;
    const results = document.querySelector("[data-health-topic-results]");
    const normalizeText = (value) => value.toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const makeExternalLink = (url, text) => {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = text;
      return link;
    };
    const makeGoogleSearchUrl = (searchQuery) => `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

    healthTopicSearch.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!healthTopicSearch.reportValidity()) return;
      const searchTerm = queryField.value.trim();
      const query = normalizeText(searchTerm);
      const matches = topics.filter((topic) => topic.terms.some((term) => normalizeText(term).includes(query) || query.includes(normalizeText(term))));
      const notice = document.createElement("p");
      notice.textContent = "GESTIOTU no interpreta síntomas ni identifica enfermedades. Los enlaces abren búsquedas externas y comparten el tema escrito con el sitio elegido. Consulta a un profesional para una valoración.";
      const items = matches.map((topic) => {
        const card = document.createElement("article");
        card.className = "health-topic-card";
        const heading = document.createElement("h3");
        heading.textContent = topic.label;
        const description = document.createElement("p");
        description.textContent = topic.description;
        const sources = document.createElement("div");
        sources.className = "health-topic-links";
        sources.append(
          makeExternalLink(topic.url, "Profundizar en la ficha temática de la OMS"),
          makeExternalLink(
            makeGoogleSearchUrl(`site:minsalud.gov.co ${searchTerm}`),
            "Buscar este tema en el Ministerio de Salud de Colombia"
          )
        );
        card.append(heading, description, sources);
        return card;
      });
      if (!items.length) {
        const card = document.createElement("article");
        card.className = "health-topic-card";
        const heading = document.createElement("h3");
        heading.textContent = `Información para explorar: ${searchTerm}`;
        const description = document.createElement("p");
        description.textContent = `Todavía no tenemos una explicación revisada para «${searchTerm}». Para darte una respuesta útil sin inventar información, puedes buscar este tema en sitios de salud oficiales o consultar resultados más amplios.`;
        const sources = document.createElement("div");
        sources.className = "health-topic-links";
        sources.append(
          makeExternalLink(
            makeGoogleSearchUrl(`site:who.int/es ${searchTerm}`),
            "Buscar este tema en el sitio de la OMS"
          ),
          makeExternalLink(
            makeGoogleSearchUrl(`site:minsalud.gov.co ${searchTerm}`),
            "Buscar este tema en el Ministerio de Salud de Colombia"
          ),
          makeExternalLink(makeGoogleSearchUrl(`${searchTerm} salud`), `Buscar «${searchTerm}» en Google`)
        );
        card.append(heading, description, sources);
        items.push(card);
      }
      results.replaceChildren(notice, ...items);
    });
  }

  const healthPlaceSearch = document.querySelector("[data-health-place-search]");
  if (healthPlaceSearch) {
    healthPlaceSearch.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!healthPlaceSearch.reportValidity()) return;
      const formData = new FormData(healthPlaceSearch);
      const query = `${formData.get("kind")} cerca de ${formData.get("location").trim()}`;
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
    });
  }

  const healthAppointmentForm = document.querySelector("[data-health-appointment]");
  if (healthAppointmentForm) {
    healthAppointmentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!healthAppointmentForm.reportValidity()) return;
      const formData = new FormData(healthAppointmentForm);
      const appointmentDate = new Date(formData.get("date"));
      const endDate = new Date(appointmentDate.getTime() + 60 * 60 * 1000);
      const toCalendarDate = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      const calendarData = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//GESTIOTU//Plan de consulta//ES",
        "BEGIN:VEVENT",
        `UID:${Date.now()}@gestiotu.local`,
        `DTSTAMP:${toCalendarDate(new Date())}`,
        `DTSTART:${toCalendarDate(appointmentDate)}`,
        `DTEND:${toCalendarDate(endDate)}`,
        `SUMMARY:Consulta de ${formData.get("type")}`,
        "END:VEVENT",
        "END:VCALENDAR"
      ].join("\r\n");
      const url = URL.createObjectURL(new Blob([calendarData], { type: "text/calendar;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "gestiotu-consulta.ics";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      document.querySelector("[data-appointment-status]").textContent = "Archivo de calendario descargado. La consulta no se reservó con una clínica.";
    });
  }
})();
