/* ==========================================================================
   MorochoTeam · Vista alumno
   Rutina del día, registro con autoguardado, técnica, temporizador y cuenta.
   ========================================================================== */
(function () {
  'use strict';

  var MT = window.MT;

  if (!MT) return;

  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  var PLACEHOLDER = 'assets/img/ejercicio-placeholder.svg';

  var state = {
    user: null,
    fecha: MT.todayISO(),
    data: null,
    saveTimers: {},
    timer: {
      duracion: 60,
      restante: 60,
      corriendo: false,
      intervalo: null,
      fin: 0,
      ejercicio: ''
    }
  };

  var tecnicaModal = null;
  var cuentaModal = null;

  /* ------------------------------------------------------------------------
     Helpers
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

  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || '';
  }

  function emptyState(icon, title, text) {
    return '<div class="empty-state">' +
      '<span class="empty-icon"><i class="bi ' + icon + '"></i></span>' +
      '<h3>' + MT.escape(title) + '</h3>' +
      '<p>' + MT.escape(text) + '</p>' +
      '</div>';
  }

  function applyEstadoBadge(node, estado) {
    if (!node) return;

    var meta = MT.estadoMeta(estado);
    node.className = 'status-badge ' + meta.className;
    node.innerHTML = '<span class="status-dot"></span>' + MT.escape(meta.label);
  }

  function findRoutine(id) {
    if (!state.data) return null;

    return (state.data.rutinas || []).find(function (rutina) {
      return String(rutina.id) === String(id);
    }) || null;
  }

  /* ------------------------------------------------------------------------
     Carga del día
     ------------------------------------------------------------------------ */
  function showLoading() {
    setHtml('#exerciseList',
      '<div class="surface surface-pad">' +
        '<div class="loading-block">' +
          '<div class="skeleton skeleton-line w-80"></div>' +
          '<div class="skeleton skeleton-line w-60"></div>' +
          '<div class="skeleton skeleton-line w-40"></div>' +
        '</div>' +
      '</div>');
  }

  async function loadDay(fecha) {
    var target = fecha || state.fecha || MT.todayISO();

    state.fecha = target;
    showLoading();

    try {
      var data = await MT.api('api/rutina_hoy.php?fecha=' + encodeURIComponent(target));
      state.data = data;
      state.fecha = data.fecha;
      state.user = data.usuario;
      renderAll();
    } catch (error) {
      setHtml('#exerciseList',
        '<div class="surface surface-pad">' +
          emptyState('bi-exclamation-triangle', 'No pudimos cargar tu rutina', error.message || 'Revisá la conexión e intentá de nuevo.') +
        '</div>');

      if (!state.data) {
        setHtml('#cuentaModalBody',
          '<div class="payment-empty">No pudimos cargar tu cuenta. Revisá tu conexión e intentá de nuevo.</div>');
      }

      MT.toast(error.message || 'No pudimos cargar la rutina.', 'danger');
    }
  }

  function renderAll() {
    renderHero();
    renderDayStrip();
    renderRoutine();
    renderCuenta();
    updateProgress();
  }

  /* ------------------------------------------------------------------------
     Hero / semana / progreso
     ------------------------------------------------------------------------ */
  function renderHero() {
    var data = state.data;
    var debtText = data.cuenta.deuda_total > 0
      ? 'Deuda: ' + MT.money(data.cuenta.deuda_total)
      : 'Estás al día';

    setText('#studentGreeting', 'Hola, ' + firstName(data.usuario.nombre));
    setText('#studentDate', MT.formatLongDate(data.fecha));
    setText('#weekLabel', MT.formatWeekRange(data.semana));
    applyEstadoBadge(byId('heroCuotaBadge'), data.cuenta.estado);

    MT.$$('[data-open-cuenta]').forEach(function (button) {
      button.title = 'Mi cuenta · ' + debtText;
    });

    var topbarCuenta = byId('cuentaTopbarButton');
    if (topbarCuenta) {
      topbarCuenta.classList.toggle('has-alert', data.cuenta.estado !== 'al_dia');
      topbarCuenta.setAttribute('aria-label', 'Mi cuenta · ' + debtText);
    }

    var future = data.fecha > data.hoy;
    var futureNote = byId('futureNote');
    if (futureNote) futureNote.classList.toggle('d-none', !future);

    if (data.usado_fallback) {
      var note = byId('fallbackNote');
      if (note) {
        note.classList.remove('d-none');
        setText('#fallbackText',
          'No encontramos rutina para esta semana. Te mostramos la última semana cargada: ' +
          MT.formatWeekRange(data.semana) + '.');
      }
    } else {
      var fallback = byId('fallbackNote');
      if (fallback) fallback.classList.add('d-none');
    }
  }

  function renderDayStrip() {
    var container = byId('dayStrip');

    if (!container || !state.data) return;

    var data = state.data;
    var week = data.semana;
    var activeName = data.dia_semana;

    container.innerHTML = DIAS.map(function (dia, index) {
      var iso = MT.addDays(week, index);
      var date = new Date(iso + 'T00:00:00');
      var total = data.dias_con_rutina && data.dias_con_rutina[dia] ? data.dias_con_rutina[dia] : 0;
      var active = dia === activeName && (data.usado_fallback || iso === state.fecha);

      return '<button type="button" class="day-chip ' + (active ? 'active' : '') +
        (total > 0 ? ' has-routine' : '') + '" data-day-date="' + iso + '" ' +
        'aria-pressed="' + active + '" title="' + MT.escapeAttr(dia + ' ' + date.getDate()) + '">' +
        '<strong>' + date.getDate() + '</strong>' +
        '<span>' + DIAS_CORTOS[index] + '</span>' +
      '</button>';
    }).join('');
  }

  function updateProgress() {
    if (!state.data) return;

    var routines = state.data.rutinas || [];
    var total = routines.length;
    var done = routines.filter(function (rutina) {
      return rutina.registro && rutina.registro.completado;
    }).length;
    var percent = total > 0 ? Math.round((done / total) * 100) : 0;

    setText('#progressLabel', total > 0
      ? done + ' de ' + total + ' ' + MT.pluralize(total, 'ejercicio', 'ejercicios')
      : 'Sin ejercicios para hoy');

    var bar = byId('progressBar');
    var fill = byId('progressFill');

    if (bar) bar.setAttribute('aria-valuenow', String(percent));
    if (fill) fill.style.width = percent + '%';

    state.data.completados = done;
    state.data.progreso = percent;

    setText('#routineCount', total + ' ' + MT.pluralize(total, 'ejercicio', 'ejercicios'));
  }

  /* ------------------------------------------------------------------------
     Rutina
     ------------------------------------------------------------------------ */
  function recordDetail(registro) {
    var parts = [];

    if (registro && registro.peso_real_levantado !== null && registro.peso_real_levantado !== undefined) {
      parts.push(MT.escape(String(registro.peso_real_levantado)) + ' kg');
    }

    if (registro && registro.reps_reales) {
      parts.push(MT.escape(String(registro.reps_reales)) + ' reps');
    }

    return parts.join(' · ');
  }

  function routineSummary(rutina, future) {
    var registro = rutina.registro || null;

    if (future) {
      return 'Se habilita el ' + rutina.dia_semana.toLowerCase();
    }

    if (registro && registro.completado) {
      var completed = recordDetail(registro);
      return completed ? 'Completado · ' + completed : 'Completado';
    }

    if (registro) {
      var partial = recordDetail(registro);
      return partial ? 'Guardado · ' + partial : 'Guardado parcial';
    }

    return 'Sin registrar';
  }

  function renderRoutine() {
    var container = byId('exerciseList');

    if (!container || !state.data) return;

    var data = state.data;
    var routines = (data.rutinas || []).slice().sort(function (a, b) {
      return a.orden - b.orden;
    });

    setText('#routineTitle', 'Rutina del ' + data.dia_semana.toLowerCase());

    if (!routines.length) {
      container.innerHTML = '<div class="surface surface-pad">' +
        emptyState(
          'bi-cup-hot',
          'Día de descanso',
          data.usado_fallback
            ? 'No hay ejercicios cargados para este día en la semana mostrada.'
            : 'Hoy no tenés ejercicios asignados. Aprovechá para recuperarte.'
        ) +
      '</div>';
      return;
    }

    var future = data.fecha > data.hoy;
    var firstPending = future ? null : routines.find(function (rutina) {
      return !(rutina.registro && rutina.registro.completado);
    });

    container.innerHTML = routines.map(function (rutina, index) {
      return exerciseCard(
        rutina,
        index,
        future,
        Boolean(firstPending && firstPending.id === rutina.id)
      );
    }).join('');
  }

  function exerciseCard(rutina, index, future, open) {
    var registro = rutina.registro || null;
    var complete = Boolean(registro && registro.completado);
    var disabled = future ? ' disabled' : '';
    var bodyId = 'exercise-body-' + rutina.id;
    var pesoReal = registro && registro.peso_real_levantado !== null && registro.peso_real_levantado !== undefined
      ? registro.peso_real_levantado
      : '';
    var repsReales = registro && registro.reps_reales ? registro.reps_reales : '';
    var comentario = registro && registro.comentario_alumno ? registro.comentario_alumno : '';

    var saveLabel = future
      ? 'Se habilita el ' + rutina.dia_semana.toLowerCase()
      : (registro ? 'Guardado' : 'Sin guardar');
    var saveIcon = future ? 'bi-lock' : (registro ? 'bi-cloud-check' : 'bi-cloud');
    var saveClass = future ? '' : (registro ? 'is-saved' : '');

    var weightTarget = rutina.peso_objetivo !== null && rutina.peso_objetivo !== undefined
      ? MT.escape(String(rutina.peso_objetivo)) + ' kg'
      : 'Peso libre';
    var summary = routineSummary(rutina, future);
    var summaryClass = complete ? ' is-complete' : '';
    var safeName = MT.escapeAttr(rutina.ejercicio);

    return '<article class="exercise-card ' + (complete ? 'is-complete ' : '') + (open ? 'is-open' : '') + '" ' +
        'data-rutina-id="' + rutina.id + '" data-exercise-number="' + (index + 1) + '" data-complete="' + (complete ? '1' : '0') + '">' +
      '<div class="exercise-head">' +
        '<button type="button" class="exercise-toggle" data-action="toggle-exercise" ' +
          'aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="' + bodyId + '">' +
          '<span class="exercise-index" data-exercise-index>' +
            (complete ? '<i class="bi bi-check-lg"></i>' : (index + 1)) +
          '</span>' +
          '<span class="exercise-title">' +
            '<span class="exercise-name">' + MT.escape(rutina.ejercicio) + '</span>' +
            '<span class="exercise-target">' +
              '<span><b>' + rutina.series_objetivo + '</b> series</span>' +
              '<span class="sep" aria-hidden="true">·</span>' +
              '<span><b>' + MT.escape(String(rutina.reps_objetivo)) + '</b> reps</span>' +
              '<span class="sep" aria-hidden="true">·</span>' +
              '<span>' + weightTarget + '</span>' +
            '</span>' +
            '<span class="exercise-summary' + summaryClass + '" data-summary-note>' + summary + '</span>' +
          '</span>' +
          '<span class="exercise-chevron" aria-hidden="true"><i class="bi bi-chevron-down"></i></span>' +
        '</button>' +
        '<button type="button" class="technique-btn" data-action="tecnica" data-id="' + rutina.id + '" ' +
          'title="Ver técnica" aria-label="Ver técnica de ' + safeName + '">' +
          '<i class="bi bi-play-fill"></i><span>Técnica</span>' +
        '</button>' +
      '</div>' +
      '<div class="exercise-body" id="' + bodyId + '"' + (open ? '' : ' hidden') + '>' +
        (rutina.notas
          ? '<div class="exercise-coach-note">' +
              '<i class="bi bi-chat-left-text"></i>' +
              '<div><strong>Indicación del profe</strong><span>' + MT.escape(rutina.notas) + '</span></div>' +
            '</div>'
          : '') +
        '<div class="log-grid">' +
          '<div class="log-field">' +
            '<label for="peso-' + rutina.id + '">Peso <span>kg</span></label>' +
            '<div class="input-stepper">' +
              '<button type="button" class="step-btn" data-action="adjust" data-target="peso-' + rutina.id + '" ' +
                'data-delta="-2.5" aria-label="Restar 2,5 kilos"' + disabled + '>' +
                '<i class="bi bi-dash-lg"></i>' +
              '</button>' +
              '<input type="number" class="form-control" id="peso-' + rutina.id + '" min="0" max="1000" step="0.5" ' +
                'inputmode="decimal" placeholder="' + MT.escapeAttr(rutina.peso_objetivo !== null ? rutina.peso_objetivo : '—') + '" ' +
                'value="' + MT.escapeAttr(pesoReal) + '" data-log="peso"' + disabled + '>' +
              '<button type="button" class="step-btn" data-action="adjust" data-target="peso-' + rutina.id + '" ' +
                'data-delta="2.5" aria-label="Sumar 2,5 kilos"' + disabled + '>' +
                '<i class="bi bi-plus-lg"></i>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="log-field">' +
            '<label for="reps-' + rutina.id + '">Reps <span>reales</span></label>' +
            '<div class="input-stepper">' +
              '<button type="button" class="step-btn" data-action="adjust" data-target="reps-' + rutina.id + '" ' +
                'data-delta="-1" aria-label="Restar una repetición"' + disabled + '>' +
                '<i class="bi bi-dash-lg"></i>' +
              '</button>' +
              '<input type="text" class="form-control" id="reps-' + rutina.id + '" maxlength="20" inputmode="numeric" ' +
                'placeholder="' + MT.escapeAttr(rutina.reps_objetivo) + '" ' +
                'value="' + MT.escapeAttr(repsReales) + '" data-log="reps"' + disabled + '>' +
              '<button type="button" class="step-btn" data-action="adjust" data-target="reps-' + rutina.id + '" ' +
                'data-delta="1" aria-label="Sumar una repetición"' + disabled + '>' +
                '<i class="bi bi-plus-lg"></i>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="complete-toggle' + (complete ? ' is-complete' : '') + '" ' +
            'data-action="toggle-complete" aria-pressed="' + complete + '"' + disabled + '>' +
            '<span class="complete-check"><i class="bi ' + (complete ? 'bi-check-lg' : 'bi-check2') + '"></i></span>' +
            '<span class="complete-text">' +
              '<strong data-complete-label>' + (complete ? 'Ejercicio completado' : 'Marcar como completado') + '</strong>' +
              '<small data-complete-hint>' + (complete ? 'Tocá para deshacer' : 'Se guarda automáticamente') + '</small>' +
            '</span>' +
          '</button>' +
        '</div>' +
        '<details class="note-details">' +
          '<summary><i class="bi bi-chat-square-text"></i> Comentario para tu entrenador</summary>' +
          '<textarea class="form-control" rows="2" maxlength="500" data-log="comentario" ' +
            'placeholder="¿Cómo te sentiste? ¿Ajustaste el peso?"' + disabled + '>' + MT.escape(comentario) + '</textarea>' +
        '</details>' +
        '<div class="exercise-footer">' +
          '<span class="save-state ' + saveClass + '" data-save-state>' +
            '<i class="bi ' + saveIcon + '"></i><span data-save-text>' + MT.escape(saveLabel) + '</span>' +
          '</span>' +
          '<button type="button" class="rest-trigger" data-action="rest" data-ejercicio="' + MT.escapeAttr(rutina.ejercicio) + '">' +
            '<i class="bi bi-stopwatch"></i> Descanso' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function setCardOpen(card, open) {
    if (!card) return;

    var toggle = card.querySelector('[data-action="toggle-exercise"]');
    var body = card.querySelector('.exercise-body');

    card.classList.toggle('is-open', open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (body) body.hidden = !open;
  }

  function refreshCardSummary(card) {
    var note = card && card.querySelector('[data-summary-note]');

    if (!note) return;

    var complete = card.dataset.complete === '1';
    var peso = card.querySelector('[data-log="peso"]');
    var reps = card.querySelector('[data-log="reps"]');
    var parts = [];

    if (peso && peso.value.trim() !== '') parts.push(peso.value.trim() + ' kg');
    if (reps && reps.value.trim() !== '') parts.push(reps.value.trim() + ' reps');

    note.textContent = (complete ? 'Completado' : (parts.length ? 'Guardado' : 'Sin registrar')) +
      (parts.length ? ' · ' + parts.join(' · ') : '');
    note.classList.toggle('is-complete', complete);
    note.classList.remove('is-error');
  }

  function setCardComplete(card, complete) {
    if (!card) return;

    card.dataset.complete = complete ? '1' : '0';
    card.classList.toggle('is-complete', complete);

    var button = card.querySelector('[data-action="toggle-complete"]');

    if (button) {
      button.classList.toggle('is-complete', complete);
      button.setAttribute('aria-pressed', complete ? 'true' : 'false');

      var label = button.querySelector('[data-complete-label]');
      var hint = button.querySelector('[data-complete-hint]');
      var icon = button.querySelector('.complete-check i');

      if (label) label.textContent = complete ? 'Ejercicio completado' : 'Marcar como completado';
      if (hint) hint.textContent = complete ? 'Tocá para deshacer' : 'Se guarda automáticamente';
      if (icon) icon.className = 'bi ' + (complete ? 'bi-check-lg' : 'bi-check2');
    }

    var indexNode = card.querySelector('[data-exercise-index]');

    if (indexNode) {
      indexNode.innerHTML = complete
        ? '<i class="bi bi-check-lg"></i>'
        : MT.escape(card.getAttribute('data-exercise-number') || '');
    }

    refreshCardSummary(card);
  }

  function openNextExercise(card) {
    var next = card ? card.nextElementSibling : null;

    while (next) {
      if (next.classList && next.classList.contains('exercise-card') && next.dataset.complete !== '1') {
        setCardOpen(next, true);
        next.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      next = next.nextElementSibling;
    }
  }

  function adjustField(button) {
    var input = byId(button.getAttribute('data-target'));

    if (!input || input.disabled) return;

    var delta = Number(button.getAttribute('data-delta')) || 0;

    if (String(input.value).trim() === '') {
      if (delta <= 0) return;

      input.value = String(delta);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    var current = parseFloat(String(input.value).replace(',', '.'));

    if (!Number.isFinite(current)) current = 0;

    var next = Math.max(0, Math.round((current + delta) * 10) / 10);

    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ------------------------------------------------------------------------
     Autoguardado de registros
     ------------------------------------------------------------------------ */
  function setSaveState(card, kind, text) {
    var node = card.querySelector('[data-save-state]');

    if (!node) return;

    var icons = {
      saving: 'bi-arrow-repeat',
      saved: 'bi-cloud-check',
      error: 'bi-exclamation-triangle',
      idle: 'bi-cloud'
    };

    var classes = {
      saving: 'save-state is-saving',
      saved: 'save-state is-saved',
      error: 'save-state is-error',
      idle: 'save-state'
    };

    node.className = classes[kind] || classes.idle;
    node.innerHTML = '<i class="bi ' + (icons[kind] || icons.idle) + '"></i>' +
      '<span data-save-text>' + MT.escape(text) + '</span>';

    if (kind === 'saving') {
      node.innerHTML = '<span class="spinner-border" aria-hidden="true"></span>' +
        '<span data-save-text>' + MT.escape(text) + '</span>';
    }
  }

  function scheduleSave(card, delay) {
    if (!card) return;

    var id = card.getAttribute('data-rutina-id');

    if (state.saveTimers[id]) {
      window.clearTimeout(state.saveTimers[id]);
    }

    state.saveTimers[id] = window.setTimeout(function () {
      delete state.saveTimers[id];
      saveExercise(card);
    }, typeof delay === 'number' ? delay : 900);
  }

  async function saveExercise(card) {
    if (!card || !state.data) return;

    if (state.data.fecha > state.data.hoy) {
      setSaveState(card, 'idle', 'Se habilita el ' + state.data.dia_semana.toLowerCase());
      return;
    }

    var id = Number(card.getAttribute('data-rutina-id'));
    var pesoInput = card.querySelector('[data-log="peso"]');
    var repsInput = card.querySelector('[data-log="reps"]');
    var commentInput = card.querySelector('[data-log="comentario"]');

    var seq = String((Number(card.dataset.saveSeq) || 0) + 1);
    card.dataset.saveSeq = seq;

    setSaveState(card, 'saving', 'Guardando…');

    try {
      var data = await MT.api('api/registros.php', {
        method: 'POST',
        body: {
          rutina_id: id,
          fecha_ejecucion: state.data.fecha,
          peso_real_levantado: pesoInput && pesoInput.value !== '' ? Number(pesoInput.value) : null,
          reps_reales: repsInput && repsInput.value.trim() !== '' ? repsInput.value.trim() : null,
          completado: card.dataset.complete === '1',
          comentario_alumno: commentInput ? commentInput.value.trim() : ''
        }
      });

      if (card.dataset.saveSeq !== seq) return;

      var rutina = findRoutine(id);

      if (rutina) {
        rutina.registro = data.registro;
        rutina.registro.completado = Boolean(data.registro.completado);
      }

      var complete = Boolean(data.registro.completado);
      setCardComplete(card, complete);
      setSaveState(card, 'saved', 'Guardado');
      updateProgress();

      if (complete && card.dataset.autoCollapse === '1') {
        card.dataset.autoCollapse = '0';
        var hasComment = commentInput && commentInput.value.trim() !== '';

        if (!hasComment) {
          window.setTimeout(function () {
            if (card.dataset.complete !== '1') return;
            setCardOpen(card, false);
            openNextExercise(card);
          }, 850);
        }
      }
    } catch (error) {
      if (card.dataset.saveSeq !== seq) return;

      card.dataset.autoCollapse = '0';
      setSaveState(card, 'error', 'No se guardó');

      var summary = card.querySelector('[data-summary-note]');
      if (summary) {
        summary.textContent = 'No se guardó';
        summary.classList.remove('is-complete');
        summary.classList.add('is-error');
      }

      MT.toast(error.message || 'No pudimos guardar el registro.', 'danger');
    }
  }

  /* ------------------------------------------------------------------------
     Cuenta
     ------------------------------------------------------------------------ */
  function renderCuenta() {
    var container = byId('cuentaModalBody');

    if (!container || !state.data) return;

    var cuenta = state.data.cuenta;
    var periodos = (cuenta.periodos || []).slice();

    var mensajes = {
      al_dia: 'Estás al día. Podés entrenar tranquilo/a.',
      parcial: 'Tenés un saldo pendiente de ' + MT.money(cuenta.saldo_mes) + ' en la cuota actual.',
      vencido: 'Tu cuota está vencida. Deuda acumulada: ' + MT.money(cuenta.deuda_total) + '.'
    };

    var titulos = {
      al_dia: 'Cuenta al día',
      parcial: 'Saldo pendiente',
      vencido: 'Cuota vencida'
    };

    var html = '<div class="student-account-status">' +
      MT.estadoBadge(cuenta.estado) +
      '<div class="account-status-copy">' +
        '<strong>' + MT.escape(titulos[cuenta.estado] || 'Estado de cuenta') + '</strong>' +
        '<p>' + MT.escape(mensajes[cuenta.estado] || '') + '</p>' +
        '<span class="account-due">Cuota de ' + MT.escape(MT.formatPeriodo(cuenta.periodo_actual)) +
          ' · vence ' + MT.formatDate(cuenta.vencimiento) + '</span>' +
      '</div>' +
    '</div>';

    html += '<div class="account-lines">' +
      '<div class="account-line">' +
        '<span>Tarifa mensual</span>' +
        '<strong>' + MT.money(cuenta.tarifa_mensual) + '</strong>' +
      '</div>' +
      '<div class="account-line">' +
        '<span>Abonado este mes</span>' +
        '<strong class="is-success">' + MT.money(cuenta.abonado_mes) + '</strong>' +
      '</div>' +
      '<div class="account-line">' +
        '<span>Deuda acumulada</span>' +
        '<strong class="' + (cuenta.deuda_total > 0 ? 'is-danger' : '') + '">' + MT.money(cuenta.deuda_total) + '</strong>' +
      '</div>' +
    '</div>';

    if (!periodos.length) {
      html += '<div class="payment-empty">Todavía no hay movimientos registrados en tu cuenta.</div>';
    } else {
      var periodsHtml = periodos.map(function (periodo) {
        var pagos = (periodo.pagos || []).map(function (pago) {
          return '<div class="payment-row">' +
            '<span class="payment-date">' + MT.formatDate(pago.fecha_pago, { day: '2-digit', month: 'short' }) + '</span>' +
            '<span class="payment-method"><i class="bi bi-wallet2"></i>' + MT.escape(MT.metodoLabel(pago.metodo_pago)) + '</span>' +
            '<span class="payment-note">' + MT.escape(pago.observaciones || 'Entrega registrada') + '</span>' +
            '<span class="payment-amount">' + MT.money(pago.monto_abonado) + '</span>' +
          '</div>';
        }).join('');

        return '<div class="period-card">' +
          '<div class="period-head">' +
            '<div class="period-title">' +
              '<strong>' + MT.escape(MT.formatPeriodo(periodo.periodo)) + '</strong>' +
              '<span>Tarifa ' + MT.money(periodo.tarifa) + '</span>' +
            '</div>' +
            '<div class="period-figures">' +
              '<span>Abonado <b>' + MT.money(periodo.abonado) + '</b></span>' +
              '<span>Saldo <b>' + MT.money(periodo.saldo) + '</b></span>' +
            '</div>' +
            MT.estadoBadge(periodo.estado) +
          '</div>' +
          '<div class="period-payments">' +
            (pagos || '<div class="payment-empty">Sin entregas en este período.</div>') +
          '</div>' +
        '</div>';
      }).join('');

      html += '<details class="account-history">' +
        '<summary>' +
          '<span><i class="bi bi-receipt"></i> Historial de pagos</span>' +
          '<span class="account-history-count">' + periodos.length + ' ' +
            MT.pluralize(periodos.length, 'período', 'períodos') + '</span>' +
        '</summary>' +
        '<div class="period-list">' + periodsHtml + '</div>' +
      '</details>';
    }

    container.innerHTML = html;
  }

  /* ------------------------------------------------------------------------
     Técnica
     ------------------------------------------------------------------------ */
  function getTecnicaModal() {
    if (!tecnicaModal) {
      tecnicaModal = new bootstrap.Modal(byId('modalTecnica'));
    }
    return tecnicaModal;
  }

  function getCuentaModal() {
    if (!cuentaModal) {
      cuentaModal = new bootstrap.Modal(byId('modalCuenta'));
    }
    return cuentaModal;
  }

  function openTecnica(rutina) {
    if (!rutina) return;

    var image = byId('tecImagen');
    image.onerror = function () {
      image.onerror = null;
      image.src = PLACEHOLDER;
    };
    image.src = rutina.url_gif_o_video || PLACEHOLDER;
    image.alt = 'Demostración de ' + rutina.ejercicio;

    setText('#tecTitulo', rutina.ejercicio);
    setText('#tecGrupo', rutina.grupo_muscular || 'General');
    setText('#tecObjetivo',
      rutina.series_objetivo + ' × ' + rutina.reps_objetivo +
      (rutina.peso_objetivo !== null && rutina.peso_objetivo !== undefined ? ' · ' + rutina.peso_objetivo + ' kg' : ''));
    setText('#tecInstrucciones', rutina.instrucciones_tecnica || 'Sin instrucciones técnicas cargadas.');

    getTecnicaModal().show();
  }

  /* ------------------------------------------------------------------------
     Temporizador
     ------------------------------------------------------------------------ */
  function formatClock(seconds) {
    var value = Math.max(0, Math.ceil(seconds));
    var minutes = Math.floor(value / 60);
    var rest = value % 60;
    return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0');
  }

  function updateTimerUI() {
    var timer = state.timer;
    var dock = byId('restDock');
    var time = byId('restTime');
    var fill = byId('restProgress');
    var start = byId('restStart');

    if (time) time.textContent = formatClock(timer.restante);
    if (fill) {
      var percent = timer.duracion > 0
        ? Math.min(100, Math.max(0, ((timer.duracion - timer.restante) / timer.duracion) * 100))
        : 0;
      fill.style.width = percent + '%';
    }

    if (dock) dock.classList.toggle('is-running', timer.corriendo);
    if (time) time.classList.toggle('is-alert', !timer.corriendo && timer.restante === 0);

    if (start) {
      start.innerHTML = '<i class="bi ' + (timer.corriendo ? 'bi-pause-fill' : 'bi-play-fill') + '"></i>';
      start.setAttribute('aria-label', timer.corriendo ? 'Pausar descanso' : 'Iniciar descanso');
      start.title = timer.corriendo ? 'Pausar descanso' : 'Iniciar descanso';
    }
  }

  function clearTimerInterval() {
    if (state.timer.intervalo) {
      window.clearInterval(state.timer.intervalo);
      state.timer.intervalo = null;
    }
  }

  function stopTimer() {
    clearTimerInterval();
    state.timer.corriendo = false;
  }

  function setPreset(seconds) {
    stopTimer();
    state.timer.duracion = seconds;
    state.timer.restante = seconds;
    state.timer.fin = 0;

    MT.$$('.rest-preset').forEach(function (button) {
      button.classList.toggle('active', Number(button.getAttribute('data-rest')) === seconds);
    });

    var dock = byId('restDock');
    if (dock) dock.classList.remove('is-done');

    updateTimerUI();
  }

  function startTimer() {
    var timer = state.timer;

    if (timer.corriendo) {
      pauseTimer();
      return;
    }

    if (timer.restante <= 0) {
      timer.restante = timer.duracion;
    }

    timer.corriendo = true;
    timer.fin = Date.now() + timer.restante * 1000;

    var dock = byId('restDock');
    if (dock) dock.classList.remove('is-done');

    clearTimerInterval();
    timer.intervalo = window.setInterval(tickTimer, 250);
    updateTimerUI();
  }

  function pauseTimer() {
    var timer = state.timer;

    if (timer.fin) {
      timer.restante = Math.max(0, Math.ceil((timer.fin - Date.now()) / 1000));
    }

    stopTimer();
    updateTimerUI();
  }

  function playBeep() {
    try {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      var context = new AudioContext();
      var oscillator = context.createOscillator();
      var gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.08;

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);

      window.setTimeout(function () {
        context.close().catch(function () {});
      }, 500);
    } catch (error) {
      /* Sin audio: queda la vibración y la alerta visual. */
    }
  }

  function finishTimer() {
    stopTimer();
    state.timer.restante = 0;

    var dock = byId('restDock');
    if (dock) dock.classList.add('is-done');

    updateTimerUI();
    MT.vibrate([220, 110, 220]);
    playBeep();
    MT.toast('¡Descanso terminado! A la siguiente serie.', 'success');

    window.setTimeout(function () {
      var node = byId('restDock');
      if (node) node.classList.remove('is-done');
    }, 4200);
  }

  function tickTimer() {
    var timer = state.timer;

    if (!timer.corriendo) return;

    var remaining = Math.max(0, Math.ceil((timer.fin - Date.now()) / 1000));
    timer.restante = remaining;

    if (remaining <= 0) {
      finishTimer();
      return;
    }

    updateTimerUI();
  }

  function resetTimer() {
    stopTimer();
    state.timer.restante = state.timer.duracion;
    state.timer.fin = 0;

    var dock = byId('restDock');
    if (dock) dock.classList.remove('is-done');

    updateTimerUI();
  }

  function setRestExercise(name) {
    state.timer.ejercicio = name || '';

    var label = byId('restExercise');

    if (label) {
      label.innerHTML = name
        ? 'Descanso · <strong>' + MT.escape(name) + '</strong>'
        : 'Descanso entre series';
    }
  }

  function startRestFor(element) {
    setRestExercise(element.getAttribute('data-ejercicio') || '');
    resetTimer();
    startTimer();

    var dock = byId('restDock');
    if (dock) dock.classList.add('is-open');

    var expand = byId('restExpand');
    if (expand) {
      expand.setAttribute('aria-expanded', 'true');
      expand.innerHTML = '<i class="bi bi-chevron-down"></i>';
    }
  }

  /* ------------------------------------------------------------------------
     Eventos
     ------------------------------------------------------------------------ */
  function bindEvents() {
    document.addEventListener('click', function (event) {
      if (event.target.closest('[data-logout]')) {
        event.preventDefault();
        logout();
        return;
      }

      if (event.target.closest('[data-open-cuenta]')) {
        event.preventDefault();
        getCuentaModal().show();
        return;
      }

      var dayChip = event.target.closest('[data-day-date]');

      if (dayChip) {
        event.preventDefault();
        loadDay(dayChip.getAttribute('data-day-date'));
        return;
      }

      var actionElement = event.target.closest('[data-action]');

      if (actionElement) {
        event.preventDefault();
        var action = actionElement.getAttribute('data-action');

        if (action === 'tecnica') {
          openTecnica(findRoutine(actionElement.getAttribute('data-id')));
        } else if (action === 'rest') {
          startRestFor(actionElement);
        } else if (action === 'toggle-exercise') {
          var cardNode = actionElement.closest('.exercise-card');
          if (cardNode) setCardOpen(cardNode, !cardNode.classList.contains('is-open'));
        } else if (action === 'toggle-complete') {
          var completeCard = actionElement.closest('.exercise-card');
          if (!completeCard) return;

          var complete = completeCard.dataset.complete !== '1';

          completeCard.dataset.autoCollapse = complete ? '1' : '0';
          setCardComplete(completeCard, complete);

          if (complete) MT.vibrate(35);
          saveExercise(completeCard);
        } else if (action === 'adjust') {
          adjustField(actionElement);
        }
      }
    });

    document.addEventListener('input', function (event) {
      var field = event.target.closest('[data-log]');

      if (!field) return;

      var card = field.closest('.exercise-card');

      if (!card) return;

      var summary = card.querySelector('[data-summary-note]');

      if (summary) {
        summary.textContent = 'Editando…';
        summary.classList.remove('is-complete', 'is-error');
      }

      setSaveState(card, 'idle', 'Cambios sin guardar…');
      scheduleSave(card, 900);
    });

    var weekPrev = byId('weekPrev');
    if (weekPrev) {
      weekPrev.addEventListener('click', function () {
        loadDay(MT.addDays(state.fecha, -7));
      });
    }

    var weekNext = byId('weekNext');
    if (weekNext) {
      weekNext.addEventListener('click', function () {
        loadDay(MT.addDays(state.fecha, 7));
      });
    }

    var weekToday = byId('weekToday');
    if (weekToday) {
      weekToday.addEventListener('click', function () {
        loadDay(MT.todayISO());
      });
    }

    MT.$$('.rest-preset').forEach(function (button) {
      button.addEventListener('click', function () {
        setPreset(Number(button.getAttribute('data-rest')) || 60);
      });
    });

    var restStart = byId('restStart');
    if (restStart) restStart.addEventListener('click', startTimer);

    var restReset = byId('restReset');
    if (restReset) {
      restReset.addEventListener('click', function () {
        resetTimer();
        setRestExercise('');
      });
    }

    var restExpand = byId('restExpand');
    if (restExpand) {
      restExpand.addEventListener('click', function () {
        var dock = byId('restDock');
        if (!dock) return;
        var open = dock.classList.toggle('is-open');
        restExpand.setAttribute('aria-expanded', open ? 'true' : 'false');
        restExpand.innerHTML = '<i class="bi ' + (open ? 'bi-chevron-down' : 'bi-chevron-up') + '"></i>';
      });
    }

    var modalTecnica = byId('modalTecnica');
    if (modalTecnica) {
      modalTecnica.addEventListener('hidden.bs.modal', function () {
        var image = byId('tecImagen');
        if (image) image.src = PLACEHOLDER;
      });
    }

    window.addEventListener('online', updateConnectionState);
    window.addEventListener('offline', updateConnectionState);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && state.timer.corriendo) {
        tickTimer();
      }
    });
  }

  function updateConnectionState() {
    var banner = byId('offlineBanner');

    if (banner) banner.classList.toggle('d-none', navigator.onLine);
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
     Init
     ------------------------------------------------------------------------ */
  async function init() {
    bindEvents();
    updateConnectionState();
    setPreset(60);

    try {
      var data = await MT.api('api/auth.php?action=me');

      if (!data.user || data.user.rol !== 'alumno') {
        window.location.replace('trainer.html');
        return;
      }

      state.user = data.user;
      await loadDay(MT.todayISO());
    } catch (error) {
      if (error.status !== 401) {
        MT.toast(error.message || 'No pudimos iniciar la vista de alumno.', 'danger');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
