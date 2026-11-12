/* ==========================================================================
   MorochoTeam · Gestor de tema (dark / light)
   - Detecta prefers-color-scheme en la primera visita.
   - Guarda la elección manual en localStorage.
   - Expone window.MTTheme para integraciones.
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'mt-theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function systemTheme() {
    return media && media.matches ? 'dark' : 'light';
  }

  function readStored() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch (error) {
      return null;
    }
  }

  function store(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      /* El navegador puede bloquear localStorage (modo privado estricto). */
    }
  }

  function updateMeta(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0A0B08' : '#F4F5F0');
    }
  }

  function updateButtons(theme) {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    var nextLabel = theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

    buttons.forEach(function (button) {
      button.setAttribute('aria-label', nextLabel);
      button.setAttribute('title', nextLabel);
      button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');

      var icon = button.querySelector('[data-theme-icon]');
      if (icon) {
        icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
      }
    });
  }

  function apply(theme, persist) {
    var normalized = theme === 'dark' ? 'dark' : 'light';

    root.setAttribute('data-theme', normalized);
    root.setAttribute('data-bs-theme', normalized);
    root.style.colorScheme = normalized;

    if (persist) store(normalized);

    updateMeta(normalized);
    updateButtons(normalized);

    window.dispatchEvent(new CustomEvent('mt:themechange', {
      detail: { theme: normalized }
    }));
  }

  function toggle() {
    apply(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
  }

  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      /* noop */
    }
    apply(systemTheme(), false);
  }

  function bindButtons() {
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-theme-toggle]');
      if (!button) return;
      event.preventDefault();
      toggle();
    });

    updateButtons(root.getAttribute('data-theme') || systemTheme());
  }

  /* 1) Aplicar antes del primer paint para evitar parpadeos. */
  apply(readStored() || systemTheme(), false);

  /* 2) Seguir el cambio del sistema solo si el usuario no eligió manualmente. */
  if (media) {
    var onSystemChange = function () {
      if (!readStored()) apply(systemTheme(), false);
    };
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onSystemChange);
    } else if (typeof media.addListener === 'function') {
      media.addListener(onSystemChange);
    }
  }

  /* 3) Sincronizar entre pestañas. */
  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    apply(event.newValue === 'dark' ? 'dark' : event.newValue === 'light' ? 'light' : systemTheme(), false);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButtons);
  } else {
    bindButtons();
  }

  window.MTTheme = {
    apply: apply,
    toggle: toggle,
    reset: reset,
    get current() {
      return root.getAttribute('data-theme') || 'light';
    },
    get stored() {
      return readStored();
    }
  };
})();
