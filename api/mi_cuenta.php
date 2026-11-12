<?php
/**
 * Estado de cuenta del alumno autenticado.
 *
 * GET mi_cuenta.php
 */

require __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    api_error('Método no permitido.', 405);
}

$user = require_alumno();

api_ok([
    'alumno' => [
        'id' => $user['id'],
        'nombre' => $user['nombre'],
        'email' => $user['email'],
        'telefono' => $user['telefono'],
        'tarifa_mensual' => $user['tarifa_mensual'],
    ],
    'cuenta' => cuenta_alumno($user['id']),
]);
