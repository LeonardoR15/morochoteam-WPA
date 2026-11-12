<?php
/**
 * Registro de ejecución del alumno (upsert por rutina + fecha).
 *
 * POST registros.php
 * {
 *   rutina_id, fecha_ejecucion, peso_real_levantado,
 *   reps_reales, completado, comentario_alumno
 * }
 */

require __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    api_error('Método no permitido.', 405);
}

$user = require_alumno();
require_ajax();

$body = request_body();

$rutinaId = (int) ($body['rutina_id'] ?? 0);

if ($rutinaId <= 0) {
    api_error('Indicá el ejercicio de rutina que querés registrar.', 422);
}

$stmt = db()->prepare(
    'SELECT r.id, r.alumno_id, r.dia_semana, r.peso_objetivo, r.reps_objetivo
     FROM rutinas_semanales r
     WHERE r.id = ?
     LIMIT 1'
);
$stmt->execute([$rutinaId]);
$rutina = $stmt->fetch();

if (!$rutina) {
    api_error('El ejercicio de rutina no existe.', 404);
}

if ((int) $rutina['alumno_id'] !== $user['id']) {
    api_error('No podés registrar progreso sobre la rutina de otro alumno.', 403);
}

$fecha = trim((string) ($body['fecha_ejecucion'] ?? date('Y-m-d')));

if (!fecha_valida($fecha)) {
    api_error('La fecha de ejecución no es válida.', 422);
}

if ($fecha > date('Y-m-d')) {
    api_error('No podés registrar una ejecución en una fecha futura.', 422);
}

if (nombre_dia($fecha) !== $rutina['dia_semana']) {
    api_error('La fecha indicada no corresponde al día de esta rutina.', 422);
}

$peso = $body['peso_real_levantado'] ?? null;
if ($peso === '' || $peso === null) {
    $peso = null;
} else {
    if (!is_numeric($peso)) {
        api_error('El peso real debe ser numérico.', 422);
    }
    $peso = (float) $peso;
    if ($peso < 0 || $peso > 1000) {
        api_error('El peso real debe estar entre 0 y 1000 kg.', 422);
    }
    $peso = round($peso, 2);
}

$reps = $body['reps_reales'] ?? null;
if ($reps === '' || $reps === null) {
    $reps = null;
} else {
    $reps = trim((string) $reps);
    if (mb_strlen($reps) > 20 || !preg_match('/^[\p{L}\p{N}\s\-–]{1,20}$/u', $reps)) {
        api_error('Las repeticiones reales no son válidas.', 422);
    }
}

$completado = to_bool($body['completado'] ?? false);
$comentario = trim((string) ($body['comentario_alumno'] ?? ''));

if (mb_strlen($comentario) > 500) {
    api_error('El comentario no puede superar los 500 caracteres.', 422);
}

$stmt = db()->prepare(
    'INSERT INTO registros_alumno
        (rutina_id, fecha_ejecucion, peso_real_levantado, reps_reales, completado, comentario_alumno)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
        peso_real_levantado = VALUES(peso_real_levantado),
        reps_reales = VALUES(reps_reales),
        completado = VALUES(completado),
        comentario_alumno = VALUES(comentario_alumno)'
);
$stmt->execute([
    $rutinaId,
    $fecha,
    $peso,
    $reps,
    $completado ? 1 : 0,
    $comentario !== '' ? $comentario : null,
]);

$stmt = db()->prepare(
    'SELECT id, rutina_id, fecha_ejecucion, peso_real_levantado, reps_reales, completado, comentario_alumno, actualizado_en
     FROM registros_alumno
     WHERE rutina_id = ? AND fecha_ejecucion = ?
     LIMIT 1'
);
$stmt->execute([$rutinaId, $fecha]);
$registro = $stmt->fetch();

$registro['id'] = (int) $registro['id'];
$registro['rutina_id'] = (int) $registro['rutina_id'];
$registro['peso_real_levantado'] = $registro['peso_real_levantado'] !== null
    ? (float) $registro['peso_real_levantado']
    : null;
$registro['completado'] = (int) $registro['completado'] === 1;

api_ok([
    'registro' => $registro,
    'message' => 'Progreso guardado.',
]);
