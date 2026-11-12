<?php
/**
 * Alumnos del entrenador.
 *
 * GET alumnos.php                 → listado + búsqueda + resumen
 * GET alumnos.php?id=2            → ficha completa + cuenta corriente
 */

require __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    api_error('Método no permitido.', 405);
}

require_trainer();

$alumnoId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

/* --------------------------------------------------------------------------
   Ficha individual
   -------------------------------------------------------------------------- */
if ($alumnoId > 0) {
    $alumno = obtener_alumno($alumnoId);

    if (!$alumno) {
        api_error('Alumno no encontrado.', 404);
    }

    $cuenta = cuenta_alumno($alumnoId);

    $stmt = db()->prepare(
        'SELECT DISTINCT fecha_inicio_semana
         FROM rutinas_semanales
         WHERE alumno_id = ?
         ORDER BY fecha_inicio_semana DESC
         LIMIT 16'
    );
    $stmt->execute([$alumnoId]);
    $semanas = array_map(
        static fn(array $row): string => $row['fecha_inicio_semana'],
        $stmt->fetchAll()
    );

    api_ok([
        'alumno' => $alumno,
        'cuenta' => $cuenta,
        'semanas_rutina' => $semanas,
        'semana_actual' => date('Y-m-d', strtotime(lunes_de(date('Y-m-d')))),
    ]);
}

/* --------------------------------------------------------------------------
   Listado
   -------------------------------------------------------------------------- */
$q = trim((string) ($_GET['q'] ?? ''));
$filtroEstado = strtolower(trim((string) ($_GET['estado'] ?? 'todos')));

if (mb_strlen($q) > 80) {
    api_error('La búsqueda es demasiado larga.', 422);
}

if (!in_array($filtroEstado, ['todos', 'al_dia', 'parcial', 'vencido'], true)) {
    $filtroEstado = 'todos';
}

$sql = "SELECT id, nombre, email, telefono, notas_medicas, estado_cuenta, activo, tarifa_mensual, fecha_alta
        FROM usuarios
        WHERE rol = 'alumno' AND activo = 1";

$params = [];

if ($q !== '') {
    $sql .= ' AND (nombre LIKE ? OR email LIKE ? OR telefono LIKE ?)';
    $like = '%' . $q . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$sql .= ' ORDER BY nombre ASC';

$stmt = db()->prepare($sql);
$stmt->execute($params);
$alumnos = $stmt->fetchAll();

$semanaActual = lunes_de(date('Y-m-d'));

$stmt = db()->prepare(
    'SELECT alumno_id, COUNT(*) AS total
     FROM rutinas_semanales
     WHERE fecha_inicio_semana = ?
     GROUP BY alumno_id'
);
$stmt->execute([$semanaActual]);
$rutinasPorAlumno = [];

foreach ($stmt->fetchAll() as $row) {
    $rutinasPorAlumno[(int) $row['alumno_id']] = (int) $row['total'];
}

$resumen = [
    'total' => 0,
    'al_dia' => 0,
    'parcial' => 0,
    'vencido' => 0,
    'deuda_total' => 0.0,
];

$resultado = [];

foreach ($alumnos as $alumno) {
    $id = (int) $alumno['id'];
    $cuenta = cuenta_alumno($id);
    $estado = $cuenta['estado'];

    $resumen['total']++;
    $resumen[$estado]++;
    $resumen['deuda_total'] += $cuenta['deuda_total'];

    if ($filtroEstado !== 'todos' && $estado !== $filtroEstado) {
        continue;
    }

    $resultado[] = [
        'id' => $id,
        'nombre' => $alumno['nombre'],
        'email' => $alumno['email'],
        'telefono' => $alumno['telefono'],
        'notas_medicas' => $alumno['notas_medicas'],
        'tarifa_mensual' => (float) $alumno['tarifa_mensual'],
        'fecha_alta' => $alumno['fecha_alta'],
        'activo' => (int) $alumno['activo'] === 1,
        'estado' => $estado,
        'saldo_mes' => $cuenta['saldo_mes'],
        'abonado_mes' => $cuenta['abonado_mes'],
        'deuda_total' => $cuenta['deuda_total'],
        'periodo_actual' => $cuenta['periodo_actual'],
        'vencimiento' => $cuenta['vencimiento'],
        'periodos_pendientes' => $cuenta['periodos_pendientes'],
        'rutinas_semana' => $rutinasPorAlumno[$id] ?? 0,
    ];
}

$resumen['deuda_total'] = redondear($resumen['deuda_total']);

api_ok([
    'alumnos' => $resultado,
    'resumen' => $resumen,
    'semana_actual' => $semanaActual,
    'filtros' => [
        'q' => $q,
        'estado' => $filtroEstado,
    ],
]);
