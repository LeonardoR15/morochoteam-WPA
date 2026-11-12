<?php
/**
 * Autenticación y sesión.
 *
 * GET  auth.php?action=me
 * POST auth.php?action=login   { email, password }
 * POST auth.php?action=logout
 */

require __DIR__ . '/config.php';

$action = strtolower(trim((string) ($_GET['action'] ?? '')));
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($action === 'me') {
    if ($method !== 'GET') {
        api_error('Método no permitido.', 405);
    }

    $user = auth_user();

    if (!$user) {
        api_error('No hay una sesión activa.', 401);
    }

    $data = [
        'user' => $user,
        'redirect' => $user['rol'] === 'trainer' ? 'trainer.html' : 'alumno.html',
    ];

    if ($user['rol'] === 'alumno') {
        $data['cuenta'] = cuenta_alumno($user['id']);
    }

    api_ok($data);
}

if ($method !== 'POST') {
    api_error('Método no permitido.', 405);
}

require_ajax();

if ($action === 'logout') {
    cerrar_sesion();
    api_ok(['message' => 'Sesión cerrada correctamente.']);
}

if ($action !== 'login') {
    api_error('Acción no válida.', 404);
}

$body = request_body();
$email = strtolower(trim((string) ($body['email'] ?? '')));
$password = (string) ($body['password'] ?? '');

if ($email === '' || $password === '') {
    api_error('Completá tu email y contraseña.', 422);
}

if (strlen($email) > 160 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    api_error('El email ingresado no es válido.', 422);
}

$stmt = db()->prepare(
    'SELECT id, nombre, email, password_hash, rol, activo
     FROM usuarios
     WHERE email = ?
     LIMIT 1'
);
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || (int) $user['activo'] !== 1 || !password_verify($password, (string) $user['password_hash'])) {
    // Mensaje genérico para no filtrar si el email existe.
    api_error('Email o contraseña incorrectos.', 401);
}

session_regenerate_id(true);
$_SESSION['usuario_id'] = (int) $user['id'];
$_SESSION['rol'] = $user['rol'];
$_SESSION['login_en'] = time();

$authenticated = auth_user(true);
$redirect = $authenticated['rol'] === 'trainer' ? 'trainer.html' : 'alumno.html';

$data = [
    'user' => $authenticated,
    'redirect' => $redirect,
];

if ($authenticated['rol'] === 'alumno') {
    $data['cuenta'] = cuenta_alumno($authenticated['id']);
}

api_ok($data);
