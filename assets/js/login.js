/* ==========================================================================
   MorochoTeam · Login
   ========================================================================== */
(function () {
  'use strict';

  var MT = window.MT;
  var form = MT.$('#loginForm');
  var emailInput = MT.$('#loginEmail');
  var passwordInput = MT.$('#loginPassword');
  var submitButton = MT.$('#loginSubmit');
  var errorBox = MT.$('#loginError');
  var errorText = MT.$('#loginErrorText');
  var togglePassword = MT.$('#togglePassword');

  var DEMO_ACCOUNTS = {
    trainer: { email: 'trainer@morochoteam.com', password: 'demo1234' },
    alumno: { email: 'lucia@demo.com', password: 'demo1234' }
  };

  function showError(message) {
    if (!errorBox || !errorText) return;
    errorText.textContent = message;
    errorBox.classList.add('show');
  }

  function hideError() {
    if (!errorBox) return;
    errorBox.classList.remove('show');
  }

  function fillDemo(role) {
    var account = DEMO_ACCOUNTS[role];
    if (!account) return;

    emailInput.value = account.email;
    passwordInput.value = account.password;
    hideError();
    passwordInput.focus();

    MT.toast(
      role === 'trainer' ? 'Credenciales del entrenador cargadas.' : 'Credenciales de la alumna demo cargadas.',
      'info'
    );
  }

  async function checkSession() {
    try {
      var data = await MT.api('api/auth.php?action=me', { redirectOn401: false });

      if (data && data.redirect) {
        window.location.replace(data.redirect);
      }
    } catch (error) {
      /* Sin sesión activa: no hacemos nada. */
    }
  }

  if (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      hideError();

      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
      }

      var email = emailInput.value.trim();
      var password = passwordInput.value;

      if (!email || !password) {
        showError('Ingresá tu email y contraseña para continuar.');
        return;
      }

      MT.setBusy(submitButton, true, 'Ingresando…');

      try {
        var data = await MT.api('api/auth.php?action=login', {
          method: 'POST',
          body: { email: email, password: password },
          redirectOn401: false
        });

        MT.toast('¡Bienvenido/a, ' + (data.user && data.user.nombre ? data.user.nombre.split(' ')[0] : '') + '!', 'success');

        window.setTimeout(function () {
          window.location.href = data.redirect;
        }, 280);
      } catch (error) {
        showError(error.message || 'No pudimos iniciar sesión.');
        MT.setBusy(submitButton, false);
        passwordInput.focus();
        passwordInput.select();
      }
    });
  }

  if (togglePassword) {
    togglePassword.addEventListener('click', function () {
      var isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      togglePassword.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
      togglePassword.innerHTML = isPassword
        ? '<i class="bi bi-eye-slash"></i>'
        : '<i class="bi bi-eye"></i>';
    });
  }

  MT.$$('[data-demo]').forEach(function (button) {
    button.addEventListener('click', function () {
      fillDemo(button.getAttribute('data-demo'));
    });
  });

  var params = new URLSearchParams(window.location.search);

  if (params.get('expired') === '1') {
    showError('Tu sesión expiró. Volvé a ingresar para continuar.');
  }

  if (params.get('logout') === '1') {
    MT.toast('Sesión cerrada correctamente.', 'info');
  }

  checkSession();
})();
