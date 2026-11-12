/* ==========================================================================
   MorochoTeam · Utilidades globales
   API fetch, formato, toasts, confirmaciones, PWA e helpers de fecha.
   ========================================================================== */
(function () {
  'use strict';

  var MT = {};

  var DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  var ESTADOS = {
    al_dia: {
      label: 'Al día',
      short: 'Al día',
      className: 'is-success',
      icon: 'bi-check-circle-fill'
    },
    parcial: {
      label: 'Pago parcial',
      short: 'Saldo pendiente',
      className: 'is-warning',
      icon: 'bi-exclamation-circle-fill'
    },
    vencido: {
      label: 'Vencido',
      short: 'Vencido',
      className: 'is-danger',
      icon: 'bi-exclamation-triangle-fill'
    }
  };

  var METODOS = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    debito: 'Débito',
    credito: 'Crédito',
    mercadopago: 'Mercado Pago',
    otro: 'Otro'
  };

  /* ------------------------------------------------------------------------
     DOM
     ------------------------------------------------------------------------ */
  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function delegate(root, eventName, selector, handler) {
    root.addEventListener(eventName, function (event) {
      var target = event.target.closest(selector);
      if (target && root.contains(target)) handler(event, target);
    });
  }

  /* ------------------------------------------------------------------------
     Seguridad / texto
     ------------------------------------------------------------------------ */
  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function capitalize(value) {
    var text = String(value || '');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function truncate(value, length) {
    var text = String(value || '');
    return text.length > length ? text.slice(0, length - 1).trim() + '…' : text;
  }

  /* ------------------------------------------------------------------------
     Fetch API
     ------------------------------------------------------------------------ */
  async function api(path, options) {
    var opts = options || {};
    var redirectOn401 = opts.redirectOn401 !== false;
    var fetchOptions = Object.assign({}, opts);
    delete fetchOptions.redirectOn401;

    var headers = new Headers(fetchOptions.headers || {});
    headers.set('Accept', 'application/json');
    headers.set('X-Requested-With', 'XMLHttpRequest');

    var body = fetchOptions.body;

    if (body && typeof body !== 'string' && !(body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }

    var response;

    try {
      response = await fetch(path, Object.assign({}, fetchOptions, {
        body: body,
        headers: headers,
        credentials: 'same-origin'
      }));
    } catch (networkError) {
      var offlineError = new Error('No pudimos conectar con el servidor. Revisá tu conexión o que Apache/PHP esté iniciado.');
      offlineError.cause = networkError;
      offlineError.isNetworkError = true;
      throw offlineError;
    }

    var raw = await response.text();
    var payload = null;

    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch (parseError) {
        var invalidError = new Error(
          response.status === 404
            ? 'No se encontró el recurso solicitado. Verificá la ruta de la API.'
            : 'El servidor devolvió una respuesta no válida. Revisá el log de PHP.'
        );
        invalidError.status = response.status;
        throw invalidError;
      }
    }

    if (!response.ok || (payload && payload.ok === false)) {
      if (response.status === 401 && redirectOn401) {
        window.location.href = 'index.html?expired=1';
      }

      var error = new Error((payload && payload.error) || 'Error ' + response.status + ' al procesar la solicitud.');
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    if (!payload || payload.ok !== true) {
      throw new Error('La respuesta del servidor no tiene el formato esperado.');
    }

    return payload.data;
  }

  /* ------------------------------------------------------------------------
     Formato
     ------------------------------------------------------------------------ */
  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function parseDate(value) {
    if (!value) return null;

    var match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    var parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value, options) {
    var date = parseDate(value);
    if (!date) return '—';

    var settings = Object.assign({
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }, options || {});

    var formatted = new Intl.DateTimeFormat('es-AR', settings).format(date);
    return capitalize(formatted.replace(/\./g, ''));
  }

  function formatLongDate(value) {
    return formatDate(value, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function formatDateTime(value) {
    var date = parseDate(value);
    if (!date) return '—';

    return formatDate(value) + ' · ' +
      new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(date) + ' hs';
  }

  function formatPeriodo(periodo) {
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) return periodo || '—';

    var parts = periodo.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);

    return capitalize(new Intl.DateTimeFormat('es-AR', {
      month: 'long',
      year: 'numeric'
    }).format(date));
  }

  function formatWeekRange(mondayIso) {
    var start = parseDate(mondayIso);
    if (!start) return '—';

    var end = new Date(start.getTime());
    end.setDate(end.getDate() + 6);

    var sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

    if (sameMonth) {
      return start.getDate() + ' al ' + end.getDate() + ' ' + MONTHS_SHORT[end.getMonth()] + ' ' + end.getFullYear();
    }

    return start.getDate() + ' ' + MONTHS_SHORT[start.getMonth()] + ' al ' +
      end.getDate() + ' ' + MONTHS_SHORT[end.getMonth()] + ' ' + end.getFullYear();
  }

  function money(value) {
    var number = Number(value);

    if (!Number.isFinite(number)) number = 0;

    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number);
  }

  function todayISO() {
    var now = new Date();
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  }

  function addDays(iso, days) {
    var date = parseDate(iso) || new Date();
    date.setDate(date.getDate() + days);

    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function mondayOf(iso) {
    var date = parseDate(iso) || new Date();
    var day = date.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    return addDays(date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()), diff);
  }

  function dayName(iso) {
    var date = parseDate(iso);
    return date ? DAYS[date.getDay()] : '';
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) return 'MT';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function pluralize(count, singular, plural) {
    return count === 1 ? singular : (plural || singular + 's');
  }

  /* ------------------------------------------------------------------------
     Estados / métodos de pago
     ------------------------------------------------------------------------ */
  function estadoMeta(estado) {
    return ESTADOS[estado] || ESTADOS.parcial;
  }

  function estadoBadge(estado, extraClass) {
    var meta = estadoMeta(estado);

    return '<span class="status-badge ' + meta.className + ' ' + (extraClass || '') + '">' +
      '<span class="status-dot"></span>' + escapeHtml(meta.label) +
      '</span>';
  }

  function metodoLabel(metodo) {
    return METODOS[metodo] || capitalize(String(metodo || 'Otro').replace(/_/g, ' '));
  }

  /* ------------------------------------------------------------------------
     Toasts
     ------------------------------------------------------------------------ */
  function ensureToastStack() {
    var stack = $('#toastStack');

    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'toastStack';
      stack.className = 'toast-stack';
      stack.setAttribute('aria-live', 'polite');
      stack.setAttribute('aria-atomic', 'true');
      document.body.appendChild(stack);
    }

    return stack;
  }

  function toast(message, type) {
    var kind = type || 'success';
    var icons = {
      success: 'bi-check-circle-fill',
      danger: 'bi-exclamation-octagon-fill',
      warning: 'bi-exclamation-triangle-fill',
      info: 'bi-info-circle-fill'
    };

    if (!window.bootstrap || !window.bootstrap.Toast) {
      console.log('[MorochoTeam]', message);
      return;
    }

    var stack = ensureToastStack();
    var element = document.createElement('div');

    element.className = 'toast is-' + kind;
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.setAttribute('aria-atomic', 'true');
    element.innerHTML =
      '<div class="toast-body">' +
        '<i class="bi ' + (icons[kind] || icons.info) + '"></i>' +
        '<div data-toast-message></div>' +
      '</div>';

    element.querySelector('[data-toast-message]').textContent = message;
    stack.appendChild(element);

    var instance = new bootstrap.Toast(element, { delay: 4300, autohide: true });

    element.addEventListener('hidden.bs.toast', function () {
      element.remove();
    });

    instance.show();
  }

  /* ------------------------------------------------------------------------
     Botones con estado de carga
     ------------------------------------------------------------------------ */
  function setBusy(button, busy, busyText) {
    if (!button) return;

    if (busy) {
      if (!button.dataset.mtOriginalHtml) {
        button.dataset.mtOriginalHtml = button.innerHTML;
      }

      button.disabled = true;
      button.classList.add('disabled');
      button.innerHTML =
        '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>' +
        (busyText ? '<span>' + escapeHtml(busyText) + '</span>' : '');
    } else {
      if (button.dataset.mtOriginalHtml) {
        button.innerHTML = button.dataset.mtOriginalHtml;
        delete button.dataset.mtOriginalHtml;
      }

      button.disabled = false;
      button.classList.remove('disabled');
    }
  }

  /* ------------------------------------------------------------------------
     Confirmación accesible con Bootstrap
     ------------------------------------------------------------------------ */
  function confirmAction(options) {
    var settings = Object.assign({
      title: 'Confirmar acción',
      message: '¿Querés continuar?',
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      danger: false
    }, options || {});

    if (!window.bootstrap || !window.bootstrap.Modal) {
      return Promise.resolve(window.confirm(settings.message));
    }

    return new Promise(function (resolve) {
      var wrapper = document.createElement('div');

      wrapper.className = 'modal fade';
      wrapper.tabIndex = -1;
      wrapper.setAttribute('aria-hidden', 'true');
      wrapper.innerHTML =
        '<div class="modal-dialog modal-dialog-centered modal-sm">' +
          '<div class="modal-content">' +
            '<div class="modal-header">' +
              '<h5 class="modal-title" data-confirm-title></h5>' +
              '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>' +
            '</div>' +
            '<div class="modal-body"><p class="mb-0 text-soft" data-confirm-message></p></div>' +
            '<div class="modal-footer">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-bs-dismiss="modal" data-confirm-cancel></button>' +
              '<button type="button" class="btn ' + (settings.danger ? 'btn-danger' : 'btn-primary') + ' btn-sm" data-confirm-ok></button>' +
            '</div>' +
          '</div>' +
        '</div>';

      wrapper.querySelector('[data-confirm-title]').textContent = settings.title;
      wrapper.querySelector('[data-confirm-message]').textContent = settings.message;
      wrapper.querySelector('[data-confirm-cancel]').textContent = settings.cancelLabel;
      wrapper.querySelector('[data-confirm-ok]').textContent = settings.confirmLabel;

      document.body.appendChild(wrapper);

      var modal = new bootstrap.Modal(wrapper);
      var resolved = false;

      wrapper.querySelector('[data-confirm-ok]').addEventListener('click', function () {
        resolved = true;
        modal.hide();
        resolve(true);
      });

      wrapper.addEventListener('hidden.bs.modal', function () {
        wrapper.remove();
        if (!resolved) resolve(false);
      });

      modal.show();
    });
  }

  /* ------------------------------------------------------------------------
     Varios
     ------------------------------------------------------------------------ */
  function debounce(fn, wait) {
    var timer = null;

    return function () {
      var args = arguments;
      var context = this;

      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, wait);
    };
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern || 120);
      } catch (error) {
        /* noop */
      }
    }
  }

  function getTodayName() {
    return DAYS[new Date().getDay()];
  }

  function safeImage(url, fallback) {
    return escapeAttr(url || fallback || 'assets/img/ejercicio-placeholder.svg');
  }

  /* ------------------------------------------------------------------------
     PWA
     ------------------------------------------------------------------------ */
  var deferredInstallPrompt = null;

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function (error) {
        console.warn('[MorochoTeam] No se pudo registrar el Service Worker:', error);
      });
    });
  }

  function setupInstallPrompt() {
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) return;

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;

      $$('[data-install]').forEach(function (button) {
        button.classList.remove('d-none');
      });
    });

    document.addEventListener('click', async function (event) {
      var button = event.target.closest('[data-install]');
      if (!button || !deferredInstallPrompt) return;

      deferredInstallPrompt.prompt();

      try {
        await deferredInstallPrompt.userChoice;
      } catch (error) {
        /* noop */
      }

      deferredInstallPrompt = null;
      $$('[data-install]').forEach(function (item) {
        item.classList.add('d-none');
      });
    });

    window.addEventListener('appinstalled', function () {
      deferredInstallPrompt = null;
      $$('[data-install]').forEach(function (button) {
        button.classList.add('d-none');
      });
    });
  }

  registerServiceWorker();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupInstallPrompt);
  } else {
    setupInstallPrompt();
  }

  /* ------------------------------------------------------------------------
     Export
     ------------------------------------------------------------------------ */
  MT.$ = $;
  MT.$$ = $$;
  MT.delegate = delegate;
  MT.api = api;
  MT.escape = escapeHtml;
  MT.escapeAttr = escapeAttr;
  MT.capitalize = capitalize;
  MT.truncate = truncate;
  MT.formatDate = formatDate;
  MT.formatLongDate = formatLongDate;
  MT.formatDateTime = formatDateTime;
  MT.formatPeriodo = formatPeriodo;
  MT.formatWeekRange = formatWeekRange;
  MT.money = money;
  MT.todayISO = todayISO;
  MT.addDays = addDays;
  MT.mondayOf = mondayOf;
  MT.dayName = dayName;
  MT.initials = initials;
  MT.pluralize = pluralize;
  MT.estadoMeta = estadoMeta;
  MT.estadoBadge = estadoBadge;
  MT.metodoLabel = metodoLabel;
  MT.Estados = ESTADOS;
  MT.Metodos = METODOS;
  MT.toast = toast;
  MT.setBusy = setBusy;
  MT.confirm = confirmAction;
  MT.debounce = debounce;
  MT.vibrate = vibrate;
  MT.getTodayName = getTodayName;
  MT.safeImage = safeImage;
  MT.DAYS = DAYS;

  window.MT = MT;
})();
