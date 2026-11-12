<?php
/**
 * Rutina del día para el alumno autenticado.
 *
 * GET rutina_hoy.php?fecha=2026-11-12
 * Devuelve ejercicios, registro previo del día, progreso y estado de cuenta.
 */

require __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    api_error('Método no permitido.', 405);
}

$user = require_alumno();

$fecha = trim((string) ($_GET['fecha'] ?? date('Y-m-d')));

if (!fecha_valida($fecha)) {
    api_error('La fecha indicada no es válida.', 422);
}

$semanaSolicitada = lunes_de($fecha);
$semanaActual = lunes_de(date('Y-m-d'));
$dia = nombre_dia($fecha);

$stmt = db()->prepare(
    'SELECT COUNT(*) FROM rutinas_semanales WHERE alumno_id = ? AND fecha_inicio_semana = ?'
);
$stmt->execute([$user['id'], $semanaSolicitada]);
$tieneSemanaSolicitada = (int) $stmt->fetchColumn() > 0;

$semana = $semanaSolicitada;
$usadoFallback = false;

if (!$tieneSemanaSolicitada) {
    $stmt = db()->prepare(
        'SELECT MAX(fecha_inicio_semana)
         FROM rutinas_semanales
         WHERE alumno_id = ? AND fecha_inicio_semana <= ?'
    );
    $stmt->execute([$user['id'], $semanaSolicitada]);
    $ultimaSemana = $stmt->fetchColumn();

    if ($ultimaSemana) {
        $semana = $ultimaSemana;
        $usadoFallback = true;
    }
}

$stmt = db()->prepare(
    'SELECT r.id, r.alumno_id, r.fecha_inicio_semana, r.dia_semana, r.orden,
            r.ejercicio_id, r.series_objetivo, r.reps_objetivo, r.peso_objetivo, r.notas,
            e.nombre AS ejercicio, e.grupo_muscular, e.url_gif_o_video, e.instrucciones_tecnica,
            reg.id AS registro_id, reg.peso_real_levantado, reg.reps_reales,
            reg.completado, reg.comentario_alumno, reg.actualizado_en
     FROM rutinas_semanales r
     INNER JOIN ejercicios_biblioteca e ON e.id = r.ejercicio_id
     LEFT JOIN registros_alumno reg
        ON reg.rutina_id = r.id AND reg.fecha_ejecucion = ?
     WHERE r.alumno_id = ? AND r.fecha_inicio_semana = ? AND r.dia_semana = ?
     ORDER BY r.orden ASC, r.id ASC'
);
$stmt->execute([$fecha, $user['id'], $semana, $dia]);
$rows = $stmt->fetchAll();

$rutinas = [];
$completados = 0;

foreach ($rows as $row) {
    $registro = null;

    if ($row['registro_id'] !== null) {
        $registro = [
            'id' => (int) $row['registro_id'],
            'peso_real_levantado' => $row['peso_real_levantado'] !== null
                ? (float) $row['peso_real_levantado']
                : null,
            'reps_reales' => $row['reps_reales'],
            'completado' => (int) $row['completado'] === 1,
            'comentario_alumno' => $row['comentario_alumno'],
            'actualizado_en' => $row['actualizado_en'],
        ];

        if ($registro['completado']) {
            $completados++;
        }
    }

    $rutinas[] = [
        'id' => (int) $row['id'],
        'alumno_id' => (int) $row['alumno_id'],
        'semana' => $row['fecha_inicio_semana'],
        'dia_semana' => $row['dia_semana'],
        'orden' => (int) $row['orden'],
        'ejercicio_id' => (int) $row['ejercicio_id'],
        'ejercicio' => $row['ejercicio'],
        'grupo_muscular' => $row['grupo_muscular'],
        'url_gif_o_video' => $row['url_gif_o_video'],
        'instrucciones_tecnica' => $row['instrucciones_tecnica'],
        'series_objetivo' => (int) $row['series_objetivo'],
        'reps_objetivo' => $row['reps_objetivo'],
        'peso_objetivo' => $row['peso_objetivo'] !== null ? (float) $row['peso_objetivo'] : null,
        'notas' => $row['notas'],
        'registro' => $registro,
    ];
}

$stmt = db()->prepare(
    'SELECT dia_semana, COUNT(*) AS total
     FROM rutinas_semanales
     WHERE alumno_id = ? AND fecha_inicio_semana = ?
     GROUP BY dia_semana'
);
$stmt->execute([$user['id'], $semana]);
$diasConRutina = [];

foreach ($stmt->fetchAll() as $row) {
    $diasConRutina[$row['dia_semana']] = (int) $row['total'];
}

$cuenta = cuenta_alumno($user['id']);

api_ok([
    'usuario' => $user,
    'fecha' => $fecha,
    'hoy' => date('Y-m-d'),
    'dia_semana' => $dia,
    'dias_semana' => dias_semana(),
    'semana' => $semana,
    'semana_solicitada' => $semanaSolicitada,
    'semana_actual' => $semanaActual,
    'es_semana_actual' => $semana === $semanaActual,
    'usado_fallback' => $usadoFallback,
    'dias_con_rutina' => $diasConRutina,
    'rutinas' => $rutinas,
    'total_rutinas' => count($rutinas),
    'completados' => $completados,
    'progreso' => count($rutinas) > 0 ? (int) round(($completados / count($rutinas)) * 100) : 0,
    'cuenta' => $cuenta,
]);
