/* ==========================================================================
   MorochoTeam · Panel entrenador
   Resumen, alumnos, cuenta corriente, rutinas semanales y biblioteca.
   ========================================================================== */
(function () {
  'use strict';

  var MT = window.MT;

  if (!MT) return;

  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var PLACEHOLDER = 'assets/img/ejercicio-placeholder.svg';

  var state = {
    user: null,
    view: 'dashboard',
    alumnos: [],
    resumen: null,
    alertas: [],
    alertasResumen: null,
    semanaActual: null,
    detalle: null,
    routine: null,
    week: null,
    day: null,
    tab: 'cuenta',
    ejercicios: null,
    grupos: [],
    filters: { q: '', estado: 'todos' }
  };

  var modals = {};
  var dashboardLoaded = false;

  /* ------------------------------------------------------------------------
     Helpers locales
     ------------------------------------------------------------------------ */
  function byId(id) {
    return document.getElementById(id);
  }

  function setText(selector, value) {
    var node = typeof selector === 'string' ? MT.$(selector) : selector;
    if (node) node.textContent = value;
  }

  function setHtml(selector, value) {
    var node = typeof selector === 'string' ? MT.$(selector) : selector;
    if (node) node.innerHTML = value;
  }

  function getModal(id) {
    if (!modals[id]) {
      var node = byId(id);
      if (node) modals[id] = new bootstrap.Modal(node);
    }
    return modals[id];
  }

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'entrenador';
  }

  function severity(estado) {
    return estado === 'vencido' ? 0 : estado === 'parcial' ? 1 : 2;
  }

  function sortByPriority(list) {
    return list.slice().sort(function (a, b) {
      var diff = severity(a.estado) - severity(b.estado);
      if (diff !== 0) return diff;
      return String(a.nombre).localeCompare(String(b.nombre), 'es');
    });
  }

  function emptyState(icon, title, text) {
    return '<div class="empty-state">' +
      '<span class="empty-icon"><i class="bi ' + icon + '"></i></span>' +
      '<h3>' + MT.escape(title) + '</h3>' +
      '<p>' + MT.escape(text) + '</p>' +
      '</div>';
  }

  function iconForEstado(estado) {
    return estado === 'vencido'
      ? 'bi-exclamation-triangle-fill'
      : estado === 'parcial'
        ? 'bi-hourglass-split'
        : 'bi-check2-circle';
  }

  function currentDayName() {
    var name = MT.getTodayName();
    return DIAS.indexOf(name) >= 0 ? name : 'Lunes';
  }

  /* ------------------------------------------------------------------------
     Navegación
     ------------------------------------------------------------------------ */
  var VIEW_META = {
    dashboard: { active: 'dashboard', eyebrow: 'Panel entrenador', title: 'Resumen' },
    alumnos: { active: 'alumnos', eyebrow: 'CRM del equipo', title: 'Alumnos' },
    alumno: { active: 'alumnos', eyebrow: 'Ficha del alumno', title: 'Detalle del alumno' },
    biblioteca: { active: 'biblioteca', eyebrow: 'Técnica y referencia', title: 'Biblioteca' }
  };

  function closeSidebar() {
    var sidebar = byId('appSidebar');
    var backdrop = byId('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');
  }

  function switchView(name, options) {
    var settings = options || {};
    var meta = VIEW_META[name] || VIEW_META.dashboard;

    state.view = name;

    MT.$$('.app-view').forEach(function (view) {
      view.classList.add('d-none');
    });

    var target = byId('view-' + name);

    if (target) {
      target.classList.remove('d-none');
    }

    MT.$$('.sidebar-link').forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('data-view') === meta.active);
    });

    setText('#pageEyebrow', meta.eyebrow);
    setText('#pageTitle', meta.title);

    closeSidebar();

    if (!settings.keepScroll) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    if (name === 'dashboard') {
      var alertsSection = byId('alertasList');
      if (settings.scrollToAlerts && alertsSection) {
        alertsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    if (name === 'alumnos' && !dashboardLoaded) {
      loadDashboard();
    }
  }

  function setSidebarUser(user) {
    var avatar = MT.initials(user.nombre);
    ['sidebarAvatar', 'topbarAvatar'].forEach(function (id) {
      setText(byId(id), avatar);
    });

    ['sidebarUserName', 'topbarUserName', 'dropdownUserName'].forEach(function (id) {
      setText(byId(id), user.nombre);
    });

    setText('#sidebarUserRole', user.rol === 'trainer' ? 'Entrenador' : 'Alumno');
    setText('#dropdownUserEmail', user.email);
  }

  /* ------------------------------------------------------------------------
     Dashboard / alertas / listado
     ------------------------------------------------------------------------ */
  function studentRow(alumno) {
    var meta = MT.estadoMeta(alumno.estado);
    var saldo = alumno.deuda_total > 0 ? alumno.deuda_total : alumno.saldo_mes;
    var rutinas = Number(alumno.rutinas_semana) || 0;

    return '<button type="button" class="student-row" data-action="ver-alumno" data-id="' + alumno.id + '">' +
      '<span class="avatar is-soft">' + MT.escape(MT.initials(alumno.nombre)) + '</span>' +
      '<span class="student-main">' +
        '<strong>' + MT.escape(alumno.nombre) + '</strong>' +
        '<span>' + MT.escape(alumno.email || 'Sin email') + ' · ' +
          rutinas + ' ' + MT.pluralize(rutinas, 'rutina', 'rutinas') + ' esta semana</span>' +
      '</span>' +
      '<span class="student-money">' +
        '<small>' + (saldo > 0 ? 'Saldo' : 'Cuota') + '</small>' +
        '<strong>' + (saldo > 0 ? MT.money(saldo) : 'Al día') + '</strong>' +
      '</span>' +
      MT.estadoBadge(alumno.estado) +
      '<i class="bi bi-chevron-right student-chevron"></i>' +
    '</button>';
  }

  function renderDashboard() {
    var resumen = state.resumen || { total: 0, al_dia: 0, parcial: 0, vencido: 0, deuda_total: 0 };
    var alertasResumen = state.alertasResumen || { con_alertas: 0 };

    setText('#statAlumnos', resumen.total);
    setText('#statAlDia', resumen.al_dia);
    setText('#statParcial', resumen.parcial);
    setText('#statVencido', resumen.vencido);
    setText('#statDeudaFoot', 'Deuda total: ' + MT.money(resumen.deuda_total));
    setText('#alumnosCount', resumen.total + ' activos');

    var pendientes = Number(alertasResumen.con_alertas) || 0;

    ['navAlertBadge', 'alertBadge'].forEach(function (id) {
      var badge = byId(id);
      if (!badge) return;
      badge.textContent = pendientes > 99 ? '99+' : String(pendientes);
      badge.classList.toggle('d-none', pendientes === 0);
    });

    setText('#alertasCount', pendientes + ' ' + MT.pluralize(pendientes, 'alerta', 'alertas'));

    var greeting = 'Hola, ' + firstName(state.user ? state.user.nombre : 'entrenador') + '.';
    setText('#heroGreeting', greeting + (pendientes > 0
      ? ' Tenés ' + pendientes + ' ' + MT.pluralize(pendientes, 'cuenta por revisar', 'cuentas por revisar') + '.'
      : ' Todo bajo control.'));

    renderAlertas();
    renderDashboardAlumnos();
    updateFilterCounts();
  }

  function renderAlertas() {
    var container = byId('alertasList');

    if (!container) return;

    if (!state.alertas.length) {
      container.innerHTML = emptyState(
        'bi-shield-check',
        'Sin alertas administrativas',
        'Todas las cuotas del equipo están al día. Buen trabajo.'
      );
      return;
    }

    container.innerHTML = state.alertas.map(function (alerta) {
      var danger = alerta.estado === 'vencido';
      var detalle = (alerta.detalle_periodos || []).map(function (periodo) {
        return MT.formatPeriodo(periodo.periodo) + ': ' + MT.money(periodo.saldo);
      }).join(' · ');

      return '<div class="alert-item ' + (danger ? 'is-danger' : 'is-warning') + '">' +
        '<span class="avatar avatar-sm ' + (danger ? '' : 'is-dark') + '">' +
          MT.escape(MT.initials(alerta.nombre)) +
        '</span>' +
        '<div class="alert-item-main">' +
          '<strong>' + MT.escape(alerta.nombre) + '</strong>' +
          '<p>' + MT.escape(alerta.mensaje) + (detalle ? ' ' + MT.escape(detalle) : '') + '</p>' +
        '</div>' +
        '<div class="alert-item-money">' +
          '<strong>' + MT.money(alerta.deuda_total) + '</strong>' +
          '<span>deuda</span>' +
        '</div>' +
        '<div class="alert-item-action">' +
          '<button type="button" class="btn btn-sm btn-outline-soft" data-action="ver-alumno" data-id="' + alerta.alumno_id + '">' +
            '<i class="bi ' + iconForEstado(alerta.estado) + '"></i> Ver cuenta' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderDashboardAlumnos() {
    var container = byId('dashboardAlumnos');

    if (!container) return;

    if (!state.alumnos.length) {
      container.innerHTML = emptyState(
        'bi-people',
        'Todavía no hay alumnos',
        'Cuando des de alta alumnos van a aparecer acá con su estado de cuenta.'
      );
      return;
    }

    container.innerHTML = sortByPriority(state.alumnos).slice(0, 6).map(studentRow).join('');
  }

  function updateFilterCounts() {
    var resumen = state.resumen || { total: 0, al_dia: 0, parcial: 0, vencido: 0 };

    setText('#countTodos', resumen.total);
    setText('#countAlDia', resumen.al_dia);
    setText('#countParcial', resumen.parcial);
    setText('#countVencido', resumen.vencido);
  }

  function renderAlumnosList() {
    var container = byId('alumnosList');

    if (!container) return;

    var q = normalize(state.filters.q);
    var estado = state.filters.estado;

    var list = state.alumnos.filter(function (alumno) {
      if (estado !== 'todos' && alumno.estado !== estado) return false;
      if (!q) return true;

      return normalize(alumno.nombre).indexOf(q) >= 0 ||
        normalize(alumno.email).indexOf(q) >= 0 ||
        normalize(alumno.telefono).indexOf(q) >= 0;
    });

    if (!list.length) {
      container.innerHTML = emptyState(
        'bi-search',
        'No encontramos alumnos',
        'Probá con otro nombre, email o teléfono, o cambiá el filtro de estado.'
      );
      return;
    }

    container.innerHTML = sortByPriority(list).map(studentRow).join('');
  }

  async function loadDashboard() {
    try {
      if (!state.semanaActual) {
        state.week = state.week || MT.mondayOf(MT.todayISO());
      }

      var results = await Promise.all([
        MT.api('api/alumnos.php'),
        MT.api('api/alertas.php')
      ]);

      state.alumnos = results[0].alumnos || [];
      state.resumen = results[0].resumen || null;
      state.semanaActual = results[0].semana_actual || MT.mondayOf(MT.todayISO());
      state.alertas = results[1].alertas || [];
      state.alertasResumen = results[1].resumen || null;
      dashboardLoaded = true;

      renderDashboard();
      renderAlumnosList();
    } catch (error) {
      MT.toast(error.message || 'No pudimos cargar el panel.', 'danger');

      var alertasList = byId('alertasList');
      var dashboardAlumnos = byId('dashboardAlumnos');

      if (alertasList) {
        alertasList.innerHTML = emptyState('bi-wifi-off', 'No se pudo cargar', 'Revisá la conexión con el servidor e intentá de nuevo.');
      }

      if (dashboardAlumnos) {
        dashboardAlumnos.innerHTML = emptyState('bi-wifi-off', 'No se pudo cargar', 'Revisá la conexión con el servidor e intentá de nuevo.');
      }
    }
  }

  async function refreshDashboardQuietly() {
    try {
      var results = await Promise.all([
        MT.api('api/alumnos.php'),
        MT.api('api/alertas.php')
      ]);

      state.alumnos = results[0].alumnos || [];
      state.resumen = results[0].resumen || null;
      state.alertas = results[1].alertas || [];
      state.alertasResumen = results[1].resumen || null;
      renderDashboard();
      renderAlumnosList();
    } catch (error) {
      /* Silencioso: no interrumpimos la tarea principal. */
    }
  }

  /* ------------------------------------------------------------------------
     Ficha del alumno
     ------------------------------------------------------------------------ */
  function loadingDetail() {
    setHtml('#detalleAlumnoContent',
      '<div class="surface surface-pad">' +
        '<div class="loading-block">' +
          '<div class="skeleton skeleton-line w-40"></div>' +
          '<div class="skeleton skeleton-line w-80"></div>' +
          '<div class="skeleton skeleton-line w-60"></div>' +
        '</div>' +
      '</div>');
  }

  async function openAlumno(id) {
    if (!id) return;

    switchView('alumno');
    state.detalle = null;
    state.routine = null;
    state.tab = 'cuenta';
    state.week = null;
    state.day = currentDayName();
    loadingDetail();

    var content = byId('detalleAlumnoContent');
    if (content) content.scrollTop = 0;

    try {
      var data = await MT.api('api/alumnos.php?id=' + encodeURIComponent(id));

      state.detalle = data;
      state.week = data.semana_actual || MT.mondayOf(MT.todayISO());

      setText('#pageTitle', data.alumno.nombre);
      setText('#pageEyebrow', 'Ficha del alumno');

      renderDetail();
      await loadRoutine(state.week, { resetDay: true, silent: true });
    } catch (error) {
      setHtml('#detalleAlumnoContent',
        '<div class="surface surface-pad">' +
          emptyState('bi-exclamation-triangle', 'No pudimos abrir la ficha', error.message || 'Intentá nuevamente.') +
        '</div>');
      MT.toast(error.message || 'No pudimos abrir la ficha del alumno.', 'danger');
    }
  }

  function profileCard() {
    var alumno = state.detalle.alumno;
    var cuenta = state.detalle.cuenta;
    var notas = alumno.notas_medicas
      ? '<div class="profile-notes"><i class="bi bi-heart-pulse-fill"></i><span>' + MT.escape(alumno.notas_medicas) + '</span></div>'
      : '';

    return '<div class="surface profile-card">' +
      '<span class="avatar avatar-lg">' + MT.escape(MT.initials(alumno.nombre)) + '</span>' +
      '<div class="profile-main">' +
        '<h2>' + MT.escape(alumno.nombre) + '</h2>' +
        '<div class="profile-meta">' +
          '<span><i class="bi bi-envelope"></i>' + MT.escape(alumno.email || 'Sin email') + '</span>' +
          (alumno.telefono ? '<span><i class="bi bi-telephone"></i>' + MT.escape(alumno.telefono) + '</span>' : '') +
          '<span><i class="bi bi-calendar3"></i>Alta ' + MT.formatDate(alumno.fecha_alta) + '</span>' +
          '<span><i class="bi bi-cash-stack"></i>Tarifa ' + MT.money(cuenta.tarifa_mensual) + '/mes</span>' +
        '</div>' +
        '<div class="profile-meta mt-2">' +
          '<span class="badge-soft neutral"><i class="bi bi-calendar-week"></i>Semana del ' +
            MT.formatWeekRange(state.detalle.semana_actual) + '</span>' +
          '<span class="badge-soft neutral"><i class="bi bi-clock-history"></i>Vencimiento día 10</span>' +
        '</div>' +
      '</div>' +
      '<div class="profile-aside">' +
        MT.estadoBadge(cuenta.estado) +
        '<button type="button" class="btn btn-primary" data-action="nuevo-pago" data-id="' + alumno.id + '">' +
          '<i class="bi bi-plus-lg"></i> Registrar pago' +
        '</button>' +
      '</div>' +
      notas +
    '</div>';
  }

  function cuentaPaneHtml() {
    var cuenta = state.detalle.cuenta;
    var periodos = cuenta.periodos || [];
    var actual = cuenta.periodo_actual;

    var summary = '<div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">' +
      '<div>' +
        '<span class="eyebrow">Cuenta corriente</span>' +
        '<h3 class="mb-0">Informe de ' + MT.escape(MT.formatPeriodo(actual)) + '</h3>' +
      '</div>' +
      '<div class="d-flex align-items-center gap-2">' +
        '<span class="badge-soft neutral"><i class="bi bi-calendar-check"></i>Vence ' + MT.formatDate(cuenta.vencimiento) + '</span>' +
        '<button type="button" class="btn btn-sm btn-outline-soft no-print" onclick="window.print()">' +
          '<i class="bi bi-printer"></i> Imprimir' +
        '</button>' +
      '</div>' +
    '</div>';

    summary += '<div class="account-summary">' +
      '<div class="money-tile">' +
        '<div class="money-label">Tarifa mensual</div>' +
        '<div class="money-value">' + MT.money(cuenta.tarifa_mensual) + '</div>' +
      '</div>' +
      '<div class="money-tile accent">' +
        '<div class="money-label">Abonado este mes</div>' +
        '<div class="money-value">' + MT.money(cuenta.abonado_mes) + '</div>' +
      '</div>' +
      '<div class="money-tile ' + (cuenta.deuda_total > 0 ? 'is-danger' : '') + '">' +
        '<div class="money-label">Deuda acumulada</div>' +
        '<div class="money-value">' + MT.money(cuenta.deuda_total) + '</div>' +
        '<div class="form-hint">' + cuenta.periodos_pendientes + ' ' +
          MT.pluralize(cuenta.periodos_pendientes, 'período pendiente', 'períodos pendientes') + '</div>' +
      '</div>' +
    '</div>';

    if (!periodos.length) {
      return summary + emptyState('bi-receipt', 'Sin movimientos', 'Registrá la primera entrega para iniciar la cuenta corriente.');
    }

    var list = periodos.map(function (periodo) {
      var pagos = (periodo.pagos || []).map(function (pago) {
        return '<div class="payment-row">' +
          '<span class="payment-date">' + MT.formatDate(pago.fecha_pago, { day: '2-digit', month: 'short' }) + '</span>' +
          '<span class="payment-method"><i class="bi bi-wallet2"></i>' + MT.escape(MT.metodoLabel(pago.metodo_pago)) + '</span>' +
          '<span class="payment-note">' + MT.escape(pago.observaciones || (pago.registrado_por_nombre ? 'Registró ' + pago.registrado_por_nombre : '—')) + '</span>' +
          '<span class="payment-amount">' + MT.money(pago.monto_abonado) + '</span>' +
          '<button type="button" class="btn btn-icon btn-danger-soft no-print" style="width:28px;height:28px;min-height:28px;border-radius:8px;font-size:.72rem" ' +
            'data-action="eliminar-pago" data-id="' + pago.id + '" data-periodo="' + MT.escapeAttr(periodo.periodo) + '" ' +
            'title="Eliminar entrega" aria-label="Eliminar entrega del ' + MT.escapeAttr(MT.formatDate(pago.fecha_pago)) + '">' +
            '<i class="bi bi-trash3"></i>' +
          '</button>' +
        '</div>';
      }).join('');

      var vencimientoPeriodo = periodo.periodo + '-10';

      return '<div class="period-card">' +
        '<div class="period-head">' +
          '<div class="period-title">' +
            '<strong>' + MT.escape(MT.formatPeriodo(periodo.periodo)) + (periodo.periodo === actual ? ' · Actual' : '') + '</strong>' +
            '<span>' + (periodo.periodo >= actual
              ? 'Vence ' + MT.formatDate(vencimientoPeriodo)
              : 'Período cerrado') + '</span>' +
          '</div>' +
          '<div class="period-figures">' +
            '<span>Tarifa <b>' + MT.money(periodo.tarifa) + '</b></span>' +
            '<span>Abonado <b>' + MT.money(periodo.abonado) + '</b></span>' +
            '<span>Saldo <b>' + MT.money(periodo.saldo) + '</b></span>' +
          '</div>' +
          MT.estadoBadge(periodo.estado) +
        '</div>' +
        '<div class="period-payments">' +
          (pagos || '<div class="payment-empty">Sin entregas registradas en este período.</div>') +
        '</div>' +
      '</div>';
    }).join('');

    return summary + '<div class="period-list">' + list + '</div>';
  }

  function routinePaneHtml() {
    var data = state.routine;
    var week = state.week || (state.detalle && state.detalle.semana_actual) || MT.mondayOf(MT.todayISO());
    var currentWeek = state.detalle ? state.detalle.semana_actual : null;
    var weekLabel = MT.formatWeekRange(week);
    var isCurrent = currentWeek === week;

    var toolbar = '<div class="routine-toolbar mb-2">' +
      '<div class="week-picker">' +
        '<button type="button" class="btn btn-icon" data-action="semana-prev" title="Semana anterior" aria-label="Semana anterior">' +
          '<i class="bi bi-chevron-left"></i>' +
        '</button>' +
        '<input type="date" id="rutinaSemana" value="' + MT.escapeAttr(week) +
          '" aria-label="Elegir semana de la rutina">' +
        '<button type="button" class="btn btn-icon" data-action="semana-next" title="Semana siguiente" aria-label="Semana siguiente">' +
          '<i class="bi bi-chevron-right"></i>' +
        '</button>' +
      '</div>' +
      '<span class="week-label">' +
        (isCurrent ? '<span class="badge-soft lime"><i class="bi bi-lightning-charge-fill"></i>Semana actual</span> ' : '') +
        weekLabel +
      '</span>' +
      '<div class="ms-auto d-flex flex-wrap gap-2">' +
        '<button type="button" class="btn btn-sm btn-outline-soft" data-action="semana-hoy">' +
          '<i class="bi bi-calendar-event"></i> Hoy' +
        '</button>' +
        '<button type="button" class="btn btn-sm btn-outline-soft" data-action="clonar-semana">' +
          '<i class="bi bi-copy"></i> Clonar anterior' +
        '</button>' +
        '<button type="button" class="btn btn-sm btn-primary" data-action="agregar-ejercicio">' +
          '<i class="bi bi-plus-lg"></i> Agregar ejercicio' +
        '</button>' +
      '</div>' +
    '</div>';

    if (!data) {
      return toolbar +
        '<div class="loading-block">' +
          '<div class="skeleton skeleton-line w-80"></div>' +
          '<div class="skeleton skeleton-line w-60"></div>' +
          '<div class="skeleton skeleton-line w-40"></div>' +
        '</div>';
    }

    var dayCounts = {};
    DIAS.forEach(function (dia) {
      dayCounts[dia] = (data.dias && data.dias[dia] ? data.dias[dia].length : 0);
    });

    var tabs = '<div class="day-tabs mb-2" role="tablist" aria-label="Días de la rutina">' +
      DIAS.map(function (dia) {
        return '<button type="button" class="day-tab ' + (state.day === dia ? 'active' : '') + '" ' +
          'data-action="dia" data-dia="' + MT.escapeAttr(dia) + '" role="tab" aria-selected="' + (state.day === dia) + '">' +
          MT.escape(dia) +
          (dayCounts[dia] > 0 ? '<span class="day-count">' + dayCounts[dia] + '</span>' : '') +
        '</button>';
      }).join('') +
    '</div>';

    var items = (data.dias && data.dias[state.day]) ? data.dias[state.day].slice() : [];
    items.sort(function (a, b) { return a.orden - b.orden; });

    var list;

    if (!items.length) {
      list = emptyState(
        'bi-clipboard2-plus',
        'Sin ejercicios para ' + state.day,
        'Agregá el primer ejercicio de la biblioteca para armar el entrenamiento.'
      ) +
      '<div class="text-center pb-2">' +
        '<button type="button" class="btn btn-primary btn-sm" data-action="agregar-ejercicio">' +
          '<i class="bi bi-plus-lg"></i> Agregar ejercicio' +
        '</button>' +
      '</div>';
    } else {
      list = '<div class="routine-list">' +
        items.map(function (item, index) {
          var peso = item.peso_objetivo === null || item.peso_objetivo === undefined ? '' : item.peso_objetivo;

          return '<div class="routine-item" data-routine-id="' + item.id + '">' +
            '<div class="routine-item-head">' +
              '<span class="routine-index">' + (index + 1) + '</span>' +
              '<div class="routine-item-title">' +
                '<strong>' + MT.escape(item.ejercicio) + '</strong>' +
                '<span>' + MT.escape(item.grupo_muscular || 'General') +
                  (item.notas ? ' · ' + MT.escape(item.notas) : '') + '</span>' +
              '</div>' +
              '<button type="button" class="technique-btn" data-action="tecnica" data-id="' + item.id + '">' +
                '<i class="bi bi-play-circle"></i> Ver técnica' +
              '</button>' +
            '</div>' +
            '<div class="routine-fields">' +
              '<div class="field-mini">' +
                '<label>Series</label>' +
                '<input type="number" class="form-control" min="1" max="50" step="1" value="' + MT.escapeAttr(item.series_objetivo) + '" data-field="series_objetivo" inputmode="numeric">' +
              '</div>' +
              '<div class="field-mini">' +
                '<label>Reps</label>' +
                '<input type="text" class="form-control" maxlength="20" value="' + MT.escapeAttr(item.reps_objetivo) + '" data-field="reps_objetivo">' +
              '</div>' +
              '<div class="field-mini">' +
                '<label>Peso (kg)</label>' +
                '<input type="number" class="form-control" min="0" max="1000" step="0.5" value="' + MT.escapeAttr(peso) + '" placeholder="—" data-field="peso_objetivo" inputmode="decimal">' +
              '</div>' +
              '<div class="field-mini">' +
                '<label>Nota</label>' +
                '<input type="text" class="form-control" maxlength="255" value="' + MT.escapeAttr(item.notas || '') + '" placeholder="Opcional" data-field="notas">' +
              '</div>' +
              '<div class="routine-actions">' +
                '<button type="button" class="btn btn-icon" data-action="mover-arriba" data-id="' + item.id + '" title="Subir" aria-label="Subir ejercicio"' + (index === 0 ? ' disabled' : '') + '>' +
                  '<i class="bi bi-arrow-up"></i>' +
                '</button>' +
                '<button type="button" class="btn btn-icon" data-action="mover-abajo" data-id="' + item.id + '" title="Bajar" aria-label="Bajar ejercicio"' + (index === items.length - 1 ? ' disabled' : '') + '>' +
                  '<i class="bi bi-arrow-down"></i>' +
                '</button>' +
                '<button type="button" class="btn btn-icon btn-save" data-action="guardar-rutina" data-id="' + item.id + '" title="Guardar cambios" aria-label="Guardar cambios">' +
                  '<i class="bi bi-check-lg"></i>' +
                '</button>' +
                '<button type="button" class="btn btn-icon btn-danger-soft" data-action="eliminar-rutina" data-id="' + item.id + '" title="Quitar de la rutina" aria-label="Quitar de la rutina">' +
                  '<i class="bi bi-trash3"></i>' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    var total = data.total || 0;

    return toolbar + tabs +
      '<div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">' +
        '<div class="routine-note"><i class="bi bi-info-circle"></i> Editá series, reps, peso o nota y guardá cada ejercicio.</div>' +
        '<span class="badge-soft neutral">' + total + ' ' + MT.pluralize(total, 'ejercicio', 'ejercicios') + ' en la semana</span>' +
      '</div>' +
      list;
  }

  function setTab(tab) {
    state.tab = tab === 'rutina' ? 'rutina' : 'cuenta';

    MT.$$('.tabbar-btn').forEach(function (button) {
      var active = button.getAttribute('data-tab') === state.tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    var cuentaPane = byId('detalleCuentaPane');
    var rutinaPane = byId('detalleRutinaPane');

    if (cuentaPane) cuentaPane.classList.toggle('d-none', state.tab !== 'cuenta');
    if (rutinaPane) rutinaPane.classList.toggle('d-none', state.tab !== 'rutina');

    if (state.tab === 'rutina' && !state.routine) {
      loadRoutine(state.week, { resetDay: true, silent: true });
    }
  }

  function renderDetail() {
    if (!state.detalle) return;

    setHtml('#detalleAlumnoContent',
      profileCard() +
      '<div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 mb-2">' +
        '<div class="tabbar" role="tablist" aria-label="Secciones de la ficha">' +
          '<button type="button" class="tabbar-btn ' + (state.tab === 'cuenta' ? 'active' : '') + '" data-tab="cuenta" role="tab" aria-selected="' + (state.tab === 'cuenta') + '">' +
            '<i class="bi bi-receipt"></i> Cuenta corriente' +
          '</button>' +
          '<button type="button" class="tabbar-btn ' + (state.tab === 'rutina' ? 'active' : '') + '" data-tab="rutina" role="tab" aria-selected="' + (state.tab === 'rutina') + '">' +
            '<i class="bi bi-calendar-week"></i> Rutina semanal' +
          '</button>' +
        '</div>' +
        '<span class="badge-soft neutral no-print"><i class="bi bi-shield-check"></i>Seguimiento interno</span>' +
      '</div>' +
      '<div class="surface surface-pad ' + (state.tab === 'cuenta' ? '' : 'd-none') + '" id="detalleCuentaPane">' +
        cuentaPaneHtml() +
      '</div>' +
      '<div class="surface surface-pad ' + (state.tab === 'rutina' ? '' : 'd-none') + '" id="detalleRutinaPane">' +
        routinePaneHtml() +
      '</div>');
  }

  function renderRoutinePane() {
    var pane = byId('detalleRutinaPane');

    if (pane) {
      pane.innerHTML = routinePaneHtml();
    }
  }

  function defaultDayFor(data) {
    if (!data) return currentDayName();

    if (data.semana === state.detalle.semana_actual) {
      var today = currentDayName();
      if (data.dias && data.dias[today] && data.dias[today].length) {
        return today;
      }
    }

    var firstWithItems = DIAS.find(function (dia) {
      return data.dias && data.dias[dia] && data.dias[dia].length;
    });

    return firstWithItems || currentDayName();
  }

  async function loadRoutine(week, options) {
    var settings = options || {};

    if (!state.detalle) return;

    var targetWeek = MT.mondayOf(week || state.week || state.detalle.semana_actual);
    state.week = targetWeek;

    if (!settings.silent) {
      var pane = byId('detalleRutinaPane');
      if (pane) {
        pane.innerHTML = '<div class="loading-block">' +
          '<div class="skeleton skeleton-line w-80"></div>' +
          '<div class="skeleton skeleton-line w-60"></div>' +
          '<div class="skeleton skeleton-line w-40"></div>' +
        '</div>';
      }
    }

    try {
      var data = await MT.api(
        'api/rutinas.php?alumno_id=' + encodeURIComponent(state.detalle.alumno.id) +
        '&semana=' + encodeURIComponent(targetWeek)
      );

      state.routine = data;

      if (settings.resetDay || !state.day || DIAS.indexOf(state.day) < 0) {
        state.day = defaultDayFor(data);
      }

      if (settings.silent) {
        renderRoutinePane();
      } else {
        renderRoutinePane();
      }
    } catch (error) {
      MT.toast(error.message || 'No pudimos cargar la rutina.', 'danger');
      var target = byId('detalleRutinaPane');
      if (target) {
        target.innerHTML = emptyState('bi-exclamation-triangle', 'No se pudo cargar la rutina', error.message || 'Intentá nuevamente.');
      }
    }
  }

  /* ------------------------------------------------------------------------
     Pagos
     ------------------------------------------------------------------------ */
  function findPeriodo(periodo) {
    if (!state.detalle) return null;

    return (state.detalle.cuenta.periodos || []).find(function (item) {
      return item.periodo === periodo;
    }) || null;
  }

  function updatePagoPreview() {
    var preview = byId('pagoPreview');

    if (!preview || !state.detalle) return;

    var periodoInput = byId('pagoPeriodo');
    var montoInput = byId('pagoMonto');
    var periodo = periodoInput ? periodoInput.value : '';
    var row = findPeriodo(periodo);

    if (!periodo || !row) {
      preview.textContent = 'Seleccioná un período para ver el detalle.';
      return;
    }

    var monto = Number(montoInput && montoInput.value) || 0;
    var restante = Math.max(0, row.saldo - monto);
    var aFavor = Math.max(0, monto - row.saldo);

    preview.innerHTML =
      '<div class="summary-row"><span>Tarifa del período</span><strong>' + MT.money(row.tarifa) + '</strong></div>' +
      '<div class="summary-row"><span>Ya abonado</span><strong>' + MT.money(row.abonado) + '</strong></div>' +
      '<div class="summary-row"><span>Saldo actual</span><strong>' + MT.money(row.saldo) + '</strong></div>' +
      '<div class="summary-row"><span>Esta entrega</span><strong>' + MT.money(monto) + '</strong></div>' +
      '<div class="summary-row"><span>Saldo restante</span><strong>' + MT.money(restante) + '</strong></div>' +
      (aFavor > 0
        ? '<div class="form-hint">La entrega supera el saldo por ' + MT.money(aFavor) + '. Quedará registrada a favor.</div>'
        : '');
  }

  function openPago() {
    if (!state.detalle) return;

    var alumno = state.detalle.alumno;
    var cuenta = state.detalle.cuenta;

    setText('#pagoAlumnoNombre', alumno.nombre);
    byId('pagoAlumnoId').value = alumno.id;

    var periodoInput = byId('pagoPeriodo');
    var montoInput = byId('pagoMonto');
    var fechaInput = byId('pagoFecha');
    var obsInput = byId('pagoObs');
    var form = byId('formPago');

    if (form) form.classList.remove('was-validated');

    periodoInput.value = cuenta.periodo_actual;
    fechaInput.value = MT.todayISO();
    fechaInput.max = MT.todayISO();
    obsInput.value = '';
    montoInput.value = Math.round(cuenta.cuota_actual && cuenta.cuota_actual.saldo > 0
      ? cuenta.cuota_actual.saldo
      : cuenta.tarifa_mensual);

    updatePagoPreview();
    getModal('modalPago').show();
  }

  async function submitPago(event) {
    event.preventDefault();

    var form = event.currentTarget;

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    var button = byId('pagoSubmit');
    var body = {
      alumno_id: Number(byId('pagoAlumnoId').value),
      periodo_mes: byId('pagoPeriodo').value,
      monto_abonado: Number(byId('pagoMonto').value),
      fecha_pago: byId('pagoFecha').value,
      metodo_pago: byId('pagoMetodo').value,
      observaciones: byId('pagoObs').value.trim()
    };

    MT.setBusy(button, true, 'Registrando…');

    try {
      var data = await MT.api('api/pagos.php', { method: 'POST', body: body });

      if (state.detalle && state.detalle.alumno.id === body.alumno_id) {
        state.detalle.cuenta = data.cuenta;
        renderDetail();
      }

      getModal('modalPago').hide();
      MT.toast(data.message || 'Pago registrado correctamente.', 'success');
      refreshDashboardQuietly();
    } catch (error) {
      MT.toast(error.message || 'No pudimos registrar el pago.', 'danger');
    } finally {
      MT.setBusy(button, false);
    }
  }

  async function eliminarPago(id, periodo) {
    if (!id) return;

    var confirmado = await MT.confirm({
      title: 'Eliminar entrega',
      message: '¿Querés eliminar esta entrega de ' + MT.formatPeriodo(periodo) + '? La cuenta se recalcula automáticamente.',
      confirmLabel: 'Eliminar',
      danger: true
    });

    if (!confirmado) return;

    try {
      var data = await MT.api('api/pagos.php?id=' + encodeURIComponent(id), { method: 'DELETE' });

      if (state.detalle) {
        state.detalle.cuenta = data.cuenta;
        renderDetail();
      }

      MT.toast(data.message || 'Entrega eliminada.', 'success');
      refreshDashboardQuietly();
    } catch (error) {
      MT.toast(error.message || 'No pudimos eliminar la entrega.', 'danger');
    }
  }

  /* ------------------------------------------------------------------------
     Rutinas
     ------------------------------------------------------------------------ */
  function findRoutine(id) {
    if (!state.routine) return null;

    var found = null;

    (state.routine.rutinas || []).some(function (item) {
      if (item.id === id) {
        found = item;
        return true;
      }
      return false;
    });

    return found;
  }

  async function guardarRutina(id, button) {
    var item = document.querySelector('.routine-item[data-routine-id="' + id + '"]');

    if (!item) return;

    var seriesInput = item.querySelector('[data-field="series_objetivo"]');
    var repsInput = item.querySelector('[data-field="reps_objetivo"]');
    var pesoInput = item.querySelector('[data-field="peso_objetivo"]');
    var notasInput = item.querySelector('[data-field="notas"]');

    var series = Number(seriesInput.value);

    if (!series || series < 1 || series > 50) {
      MT.toast('Las series deben estar entre 1 y 50.', 'warning');
      seriesInput.focus();
      return;
    }

    if (!repsInput.value.trim()) {
      MT.toast('Indicá las repeticiones objetivo.', 'warning');
      repsInput.focus();
      return;
    }

    MT.setBusy(button, true);

    try {
      var data = await MT.api('api/rutinas.php?action=actualizar', {
        method: 'POST',
        body: {
          id: id,
          series_objetivo: series,
          reps_objetivo: repsInput.value.trim(),
          peso_objetivo: pesoInput.value === '' ? null : Number(pesoInput.value),
          notas: notasInput.value.trim()
        }
      });

      if (data.rutina) {
        (state.routine.rutinas || []).forEach(function (row) {
          if (row.id === id) Object.assign(row, data.rutina);
        });

        Object.keys(state.routine.dias || {}).forEach(function (dia) {
          state.routine.dias[dia] = state.routine.dias[dia].map(function (row) {
            return row.id === id ? Object.assign({}, row, data.rutina) : row;
          });
        });
      }

      item.classList.remove('is-dirty');
      MT.setBusy(button, false);
      MT.toast('Cambios guardados.', 'success');
    } catch (error) {
      MT.setBusy(button, false);
      MT.toast(error.message || 'No pudimos guardar los cambios.', 'danger');
    }
  }

  async function eliminarRutina(id) {
    var row = findRoutine(id);

    var confirmado = await MT.confirm({
      title: 'Quitar ejercicio',
      message: '¿Querés quitar "' + (row ? row.ejercicio : 'este ejercicio') + '" de la rutina?',
      confirmLabel: 'Quitar',
      danger: true
    });

    if (!confirmado) return;

    try {
      await MT.api('api/rutinas.php?action=eliminar', { method: 'POST', body: { id: id } });
      MT.toast('Ejercicio quitado de la rutina.', 'success');
      await loadRoutine(state.week, { silent: true });
      refreshDashboardQuietly();
    } catch (error) {
      MT.toast(error.message || 'No pudimos quitar el ejercicio.', 'danger');
    }
  }

  async function moverRutina(id, direccion) {
    if (!state.routine || !state.detalle) return;

    var items = (state.routine.dias[state.day] || []).slice().sort(function (a, b) {
      return a.orden - b.orden;
    });

    var index = items.findIndex(function (item) { return item.id === id; });
    var target = index + direccion;

    if (index < 0 || target < 0 || target >= items.length) return;

    var moved = items[index];
    items[index] = items[target];
    items[target] = moved;

    try {
      await MT.api('api/rutinas.php?action=reordenar', {
        method: 'POST',
        body: {
          alumno_id: state.detalle.alumno.id,
          ids: items.map(function (item) { return item.id; })
        }
      });

      await loadRoutine(state.week, { silent: true });
      MT.toast('Orden actualizado.', 'info');
    } catch (error) {
      MT.toast(error.message || 'No pudimos reordenar la rutina.', 'danger');
    }
  }

  /* ------------------------------------------------------------------------
     Biblioteca / técnica
     ------------------------------------------------------------------------ */
  async function loadEjercicios(force) {
    if (state.ejercicios && !force) return state.ejercicios;

    try {
      var data = await MT.api('api/ejercicios.php');
      state.ejercicios = data.ejercicios || [];
      state.grupos = data.grupos || [];
      populateGrupos();
      renderBiblioteca();
      return state.ejercicios;
    } catch (error) {
      MT.toast(error.message || 'No pudimos cargar la biblioteca.', 'danger');
      var grid = byId('bibliotecaGrid');
      if (grid) {
        grid.innerHTML = emptyState('bi-exclamation-triangle', 'No se pudo cargar', error.message || 'Intentá nuevamente.');
      }
      return [];
    }
  }

  function populateGrupos() {
    var select = byId('filtroGrupo');

    if (!select) return;

    var current = select.value;

    select.innerHTML = '<option value="">Todos los grupos</option>' +
      state.grupos.map(function (grupo) {
        return '<option value="' + MT.escapeAttr(grupo) + '">' + MT.escape(grupo) + '</option>';
      }).join('');

    if (state.grupos.indexOf(current) >= 0) select.value = current;
  }

  function renderBiblioteca() {
    var grid = byId('bibliotecaGrid');

    if (!grid) return;

    var search = byId('searchBiblioteca');
    var group = byId('filtroGrupo');
    var q = normalize(search ? search.value : '');
    var grupo = group ? group.value : '';

    var list = (state.ejercicios || []).filter(function (ejercicio) {
      if (grupo && ejercicio.grupo_muscular !== grupo) return false;
      if (!q) return true;
      return normalize(ejercicio.nombre).indexOf(q) >= 0 ||
        normalize(ejercicio.grupo_muscular).indexOf(q) >= 0;
    });

    setText('#bibliotecaCount', list.length + ' ejercicios');

    if (!list.length) {
      grid.innerHTML = emptyState(
        'bi-search',
        'No encontramos ejercicios',
        'Probá con otra búsqueda o elegí otro grupo muscular.'
      );
      return;
    }

    grid.innerHTML = list.map(function (ejercicio) {
      var image = ejercicio.url_gif_o_video || PLACEHOLDER;
      var description = String(ejercicio.instrucciones_tecnica || '')
        .replace(/\s+/g, ' ')
        .trim();

      return '<article class="library-card">' +
        '<div class="library-thumb">' +
          '<img src="' + MT.escapeAttr(image) + '" alt="' + MT.escapeAttr('Demostración de ' + ejercicio.nombre) + '" ' +
            'loading="lazy" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\';">' +
          '<span class="badge-soft lime">' + MT.escape(ejercicio.grupo_muscular) + '</span>' +
        '</div>' +
        '<div class="library-body">' +
          '<h3>' + MT.escape(ejercicio.nombre) + '</h3>' +
          '<p>' + MT.escape(MT.truncate(description || 'Sin instrucciones cargadas.', 130)) + '</p>' +
          '<button type="button" class="btn btn-sm btn-outline-soft" data-action="tecnica" data-ejercicio="' + ejercicio.id + '">' +
            '<i class="bi bi-play-circle"></i> Ver técnica' +
          '</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function openTecnica(exercise) {
    if (!exercise) return;

    var image = byId('tecImagen');

    image.onerror = function () {
      image.onerror = null;
      image.src = PLACEHOLDER;
    };
    image.src = exercise.url_gif_o_video || PLACEHOLDER;
    image.alt = 'Demostración de ' + (exercise.ejercicio || exercise.nombre || 'ejercicio');

    setText('#tecTitulo', exercise.ejercicio || exercise.nombre || 'Ejercicio');
    setText('#tecGrupo', exercise.grupo_muscular || 'General');
    setText('#tecInstrucciones', exercise.instrucciones_tecnica || 'Sin instrucciones técnicas cargadas.');

    getModal('modalTecnica').show();
  }

  function openTecnicaFromRoutine(id) {
    openTecnica(findRoutine(id));
  }

  async function openTecnicaFromLibrary(id) {
    var exercise = (state.ejercicios || []).find(function (item) {
      return String(item.id) === String(id);
    });

    if (!exercise) {
      var list = await loadEjercicios(true);
      exercise = list.find(function (item) {
        return String(item.id) === String(id);
      });
    }

    openTecnica(exercise);
  }

  /* ------------------------------------------------------------------------
     Modales de rutina
     ------------------------------------------------------------------------ */
  async function openEjercicio() {
    if (!state.detalle) return;

    await loadEjercicios();

    var alumno = state.detalle.alumno;
    var form = byId('formEjercicio');
    var select = byId('ejEjercicio');

    if (form) form.classList.remove('was-validated');

    byId('ejAlumnoId').value = alumno.id;
    byId('ejSemana').value = state.week;
    byId('ejDia').value = state.day;

    setText('#ejAlumnoNombre', alumno.nombre);
    setText('#ejDiaLabel', state.day);
    setText('#ejSemanaLabel', MT.formatWeekRange(state.week));

    var groups = {};

    (state.ejercicios || []).forEach(function (ejercicio) {
      if (!groups[ejercicio.grupo_muscular]) groups[ejercicio.grupo_muscular] = [];
      groups[ejercicio.grupo_muscular].push(ejercicio);
    });

    select.innerHTML = '<option value="">Elegí un ejercicio de la biblioteca…</option>' +
      Object.keys(groups).sort(function (a, b) { return a.localeCompare(b, 'es'); }).map(function (grupo) {
        return '<optgroup label="' + MT.escapeAttr(grupo) + '">' +
          groups[grupo].map(function (ejercicio) {
            return '<option value="' + ejercicio.id + '">' + MT.escape(ejercicio.nombre) + '</option>';
          }).join('') +
        '</optgroup>';
      }).join('');

    byId('ejSeries').value = 3;
    byId('ejReps').value = '10';
    byId('ejPeso').value = '';
    byId('ejNotas').value = '';

    getModal('modalEjercicio').show();
  }

  async function submitEjercicio(event) {
    event.preventDefault();

    var form = event.currentTarget;

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    var button = byId('ejSubmit');
    var body = {
      alumno_id: Number(byId('ejAlumnoId').value),
      semana: byId('ejSemana').value,
      dia_semana: byId('ejDia').value,
      ejercicio_id: Number(byId('ejEjercicio').value),
      series_objetivo: Number(byId('ejSeries').value),
      reps_objetivo: byId('ejReps').value.trim(),
      peso_objetivo: byId('ejPeso').value === '' ? null : Number(byId('ejPeso').value),
      notas: byId('ejNotas').value.trim()
    };

    MT.setBusy(button, true, 'Agregando…');

    try {
      var data = await MT.api('api/rutinas.php?action=crear', { method: 'POST', body: body });
      getModal('modalEjercicio').hide();
      MT.toast(data.message || 'Ejercicio agregado a la rutina.', 'success');
      await loadRoutine(state.week, { silent: true });
      refreshDashboardQuietly();
    } catch (error) {
      MT.toast(error.message || 'No pudimos agregar el ejercicio.', 'danger');
    } finally {
      MT.setBusy(button, false);
    }
  }

  function openClonar() {
    if (!state.detalle) return;

    var form = byId('formClonar');
    var overwrite = byId('clonarSobrescribirWrap');
    var checkbox = byId('clonarSobrescribir');
    var total = state.routine ? Number(state.routine.total) || 0 : 0;

    if (form) form.classList.remove('was-validated');

    byId('clonarAlumnoId').value = state.detalle.alumno.id;
    byId('clonarSemana').value = state.week;
    byId('clonarIncremento').value = '0';
    checkbox.checked = false;
    overwrite.classList.toggle('d-none', total === 0);

    setText('#clonarSemanaTexto', MT.formatWeekRange(state.week));
    setText('#clonarOrigenTexto', MT.formatWeekRange(MT.addDays(state.week, -7)));
    setText('#clonarAlumnoNombre', state.detalle.alumno.nombre);

    getModal('modalClonar').show();
  }

  async function submitClonar(event) {
    event.preventDefault();

    var form = event.currentTarget;

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    var button = byId('clonarSubmit');
    var body = {
      alumno_id: Number(byId('clonarAlumnoId').value),
      semana: byId('clonarSemana').value,
      incremento_kg: Number(byId('clonarIncremento').value) || 0,
      sobrescribir: byId('clonarSobrescribir').checked
    };

    MT.setBusy(button, true, 'Clonando…');

    try {
      var data = await MT.api('api/rutinas.php?action=clonar', { method: 'POST', body: body });
      getModal('modalClonar').hide();
      MT.toast(data.message || 'Semana clonada correctamente.', 'success');
      await loadRoutine(state.week, { silent: true, resetDay: true });
      refreshDashboardQuietly();
    } catch (error) {
      if (error.status === 409) {
        var wrap = byId('clonarSobrescribirWrap');
        wrap.classList.remove('d-none');
        wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        byId('clonarSobrescribir').focus();
        MT.toast('La semana ya tiene rutina. Marcá la casilla para reemplazarla.', 'warning');
      } else {
        MT.toast(error.message || 'No pudimos clonar la semana.', 'danger');
      }
    } finally {
      MT.setBusy(button, false);
    }
  }

  /* ------------------------------------------------------------------------
     Acciones
     ------------------------------------------------------------------------ */
  function handleAction(action, element) {
    var id = Number(element.getAttribute('data-id')) || 0;

    switch (action) {
      case 'ver-alumno':
        openAlumno(id);
        break;
      case 'nuevo-pago':
        openPago();
        break;
      case 'eliminar-pago':
        eliminarPago(id, element.getAttribute('data-periodo') || '');
        break;
      case 'semana-prev':
        loadRoutine(MT.addDays(state.week, -7), { resetDay: true });
        break;
      case 'semana-next':
        loadRoutine(MT.addDays(state.week, 7), { resetDay: true });
        break;
      case 'semana-hoy':
        if (state.detalle) loadRoutine(state.detalle.semana_actual, { resetDay: true });
        break;
      case 'dia':
        state.day = element.getAttribute('data-dia') || state.day;
        renderRoutinePane();
        break;
      case 'agregar-ejercicio':
        openEjercicio();
        break;
      case 'guardar-rutina':
        guardarRutina(id, element);
        break;
      case 'eliminar-rutina':
        eliminarRutina(id);
        break;
      case 'mover-arriba':
        moverRutina(id, -1);
        break;
      case 'mover-abajo':
        moverRutina(id, 1);
        break;
      case 'clonar-semana':
        openClonar();
        break;
      case 'tecnica':
        if (element.getAttribute('data-ejercicio')) {
          openTecnicaFromLibrary(element.getAttribute('data-ejercicio'));
        } else {
          openTecnicaFromRoutine(id);
        }
        break;
      default:
        break;
    }
  }

  async function logout() {
    try {
      await MT.api('api/auth.php?action=logout', { method: 'POST' });
    } catch (error) {
      /* La sesión puede estar vencida igual. */
    }

    window.location.href = 'index.html?logout=1';
  }

  /* ------------------------------------------------------------------------
     Eventos
     ------------------------------------------------------------------------ */
  function bindEvents() {
    document.addEventListener('click', function (event) {
      var logoutButton = event.target.closest('[data-logout]');
      if (logoutButton) {
        event.preventDefault();
        logout();
        return;
      }

      var actionElement = event.target.closest('[data-action]');
      if (actionElement) {
        event.preventDefault();
        handleAction(actionElement.getAttribute('data-action'), actionElement);
        return;
      }

      var tabButton = event.target.closest('[data-tab]');
      if (tabButton) {
        event.preventDefault();
        setTab(tabButton.getAttribute('data-tab'));
        return;
      }

      var viewButton = event.target.closest('[data-view]');
      if (viewButton) {
        event.preventDefault();
        var view = viewButton.getAttribute('data-view');
        switchView(view, { scrollToAlerts: view === 'dashboard' && state.view === 'dashboard' });
      }
    });

    document.addEventListener('input', function (event) {
      var field = event.target.closest('[data-field]');

      if (!field) return;

      var item = field.closest('.routine-item');

      if (item) item.classList.add('is-dirty');
    });

    document.addEventListener('change', function (event) {
      if (event.target && event.target.id === 'rutinaSemana') {
        var value = event.target.value;

        if (value) {
          loadRoutine(MT.mondayOf(value), { resetDay: true });
        }
      }

      if (event.target && event.target.id === 'pagoPeriodo') {
        updatePagoPreview();
      }
    });

    var searchAlumnos = byId('searchAlumnos');

    if (searchAlumnos) {
      searchAlumnos.addEventListener('input', MT.debounce(function () {
        state.filters.q = searchAlumnos.value;
        renderAlumnosList();
      }, 220));
    }

    MT.$$('.filter-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        MT.$$('.filter-chip').forEach(function (other) {
          other.classList.toggle('active', other === chip);
        });

        state.filters.estado = chip.getAttribute('data-estado') || 'todos';
        renderAlumnosList();
      });
    });

    var searchBiblioteca = byId('searchBiblioteca');

    if (searchBiblioteca) {
      searchBiblioteca.addEventListener('input', MT.debounce(renderBiblioteca, 200));
    }

    var filtroGrupo = byId('filtroGrupo');

    if (filtroGrupo) {
      filtroGrupo.addEventListener('change', renderBiblioteca);
    }

    var pagoMonto = byId('pagoMonto');

    if (pagoMonto) {
      pagoMonto.addEventListener('input', updatePagoPreview);
    }

    var formPago = byId('formPago');
    if (formPago) formPago.addEventListener('submit', submitPago);

    var formEjercicio = byId('formEjercicio');
    if (formEjercicio) formEjercicio.addEventListener('submit', submitEjercicio);

    var formClonar = byId('formClonar');
    if (formClonar) formClonar.addEventListener('submit', submitClonar);

    var sidebarToggle = byId('sidebarToggle');
    var sidebarBackdrop = byId('sidebarBackdrop');

    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', function () {
        var sidebar = byId('appSidebar');
        var backdrop = byId('sidebarBackdrop');
        if (!sidebar) return;
        sidebar.classList.toggle('is-open');
        if (backdrop) backdrop.classList.toggle('is-open', sidebar.classList.contains('is-open'));
      });
    }

    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

    var btnRefreshDashboard = byId('btnRefreshDashboard');
    if (btnRefreshDashboard) {
      btnRefreshDashboard.addEventListener('click', function () {
        MT.setBusy(btnRefreshDashboard, true, 'Actualizando…');
        loadDashboard().finally(function () {
          MT.setBusy(btnRefreshDashboard, false);
        });
      });
    }

    var btnRefreshAlertas = byId('btnRefreshAlertas');
    if (btnRefreshAlertas) {
      btnRefreshAlertas.addEventListener('click', function () {
        MT.setBusy(btnRefreshAlertas, true);
        loadDashboard().finally(function () {
          MT.setBusy(btnRefreshAlertas, false);
        });
      });
    }

    var btnVolverAlumnos = byId('btnVolverAlumnos');
    if (btnVolverAlumnos) {
      btnVolverAlumnos.addEventListener('click', function () {
        switchView('alumnos');
      });
    }

    var modalPago = byId('modalPago');
    if (modalPago) {
      modalPago.addEventListener('hidden.bs.modal', function () {
        var form = byId('formPago');
        if (form) form.classList.remove('was-validated');
      });
    }

    var modalEjercicio = byId('modalEjercicio');
    if (modalEjercicio) {
      modalEjercicio.addEventListener('hidden.bs.modal', function () {
        var form = byId('formEjercicio');
        if (form) form.classList.remove('was-validated');
      });
    }

    var modalTecnica = byId('modalTecnica');
    if (modalTecnica) {
      modalTecnica.addEventListener('hidden.bs.modal', function () {
        var image = byId('tecImagen');
        if (image) image.src = PLACEHOLDER;
      });
    }
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  function setStaticContent() {
    setText('#heroDate', MT.formatLongDate(MT.todayISO()));
    setText('#sidebarWeek', MT.formatWeekRange(MT.mondayOf(MT.todayISO())));
    state.week = MT.mondayOf(MT.todayISO());
    state.day = currentDayName();
  }

  async function init() {
    setStaticContent();

    try {
      var data = await MT.api('api/auth.php?action=me');

      if (!data.user || data.user.rol !== 'trainer') {
        window.location.replace('alumno.html');
        return;
      }

      state.user = data.user;
      state.semanaActual = MT.mondayOf(MT.todayISO());
      setSidebarUser(data.user);
      bindEvents();

      await loadDashboard();
      loadEjercicios().catch(function () { /* ya se informa en el catch */ });
    } catch (error) {
      if (error.status !== 401) {
        MT.toast(error.message || 'No pudimos iniciar el panel.', 'danger');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
