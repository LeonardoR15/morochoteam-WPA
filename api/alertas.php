<?php
/**
 * Panel de alertas administrativas para el entrenador.
 * Solo notificaciones internas: cuotas vencidas y saldos parciales.
 *
 * GET alertas.php
 */

require __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    api_error('Método no permitido.', 405);
}

require_trainer();

$stmt = db()->query(
    "SELECT id, nombre, email, telefono
     FROM usuarios
     WHERE rol = 'alumno' AND activo = 1
     ORDER BY nombre ASC"
);
$alumnos = $stmt->fetchAll();

$resumen = [
    'total_alumnos' => 0,
    'al_dia' => 0,
    'parcial' => 0,
    'vencido' => 0,
    'deuda_total' => 0.0,
    'con_alertas' => 0,
];

$alertas = [];

foreach ($alumnos as $alumno) {
    $id = (int) $alumno['id'];
    $cuenta = cuenta_alumno($id);

    $resumen['total_alumnos']++;
    $resumen[$cuenta['estado']]++;
    $resumen['deuda_total'] += $cuenta['deuda_total'];

    if ($cuenta['estado'] === 'al_dia' && $cuenta['deuda_total'] <= 0) {
        continue;
    }

    $periodosPendientes = array_values(array_filter(
        $cuenta['periodos'],
        static function (array $periodo) use ($cuenta): bool {
            return $periodo['saldo'] > 0 && $periodo['periodo'] <= $cuenta['periodo_actual'];
        }
    ));

    $resumen['con_alertas']++;

    if ($cuenta['estado'] === 'vencido') {
        $mensaje = $cuenta['periodos_pendientes'] > 1
            ? 'Registra saldo vencido en ' . $cuenta['periodos_pendientes'] . ' períodos.'
            : 'Registra una cuota vencida sin regularizar.';
    } else {
        $mensaje = 'Tiene un saldo pendiente en el período actual.';
    }

    $alertas[] = [
        'alumno_id' => $id,
        'nombre' => $alumno['nombre'],
        'email' => $alumno['email'],
        'telefono' => $alumno['telefono'],
        'estado' => $cuenta['estado'],
        'deuda_total' => $cuenta['deuda_total'],
        'saldo_mes' => $cuenta['saldo_mes'],
        'abonado_mes' => $cuenta['abonado_mes'],
        'tarifa_mensual' => $cuenta['tarifa_mensual'],
        'periodo_actual' => $cuenta['periodo_actual'],
        'vencimiento' => $cuenta['vencimiento'],
        'periodos_pendientes' => $cuenta['periodos_pendientes'],
        'detalle_periodos' => array_map(
            static fn(array $periodo): array => [
                'periodo' => $periodo['periodo'],
                'tarifa' => $periodo['tarifa'],
                'abonado' => $periodo['abonado'],
                'saldo' => $periodo['saldo'],
                'estado' => $periodo['estado'],
            ],
            $periodosPendientes
        ),
        'mensaje' => $mensaje,
        'prioridad' => $cuenta['estado'] === 'vencido' ? 2 : 1,
    ];
}

usort($alertas, static function (array $a, array $b): int {
    if ($a['prioridad'] !== $b['prioridad']) {
        return $b['prioridad'] <=> $a['prioridad'];
    }

    return $b['deuda_total'] <=> $a['deuda_total'];
});

$resumen['deuda_total'] = redondear($resumen['deuda_total']);

api_ok([
    'alertas' => $alertas,
    'resumen' => $resumen,
    'actualizado' => date('c'),
]);
