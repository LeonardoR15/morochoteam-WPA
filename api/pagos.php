<?php
/**
 * Cuenta corriente y registro de pagos / entregas parciales.
 *
 * GET    pagos.php?alumno_id=2
 * POST   pagos.php              { alumno_id, periodo_mes, monto_abonado, fecha_pago, metodo_pago, observaciones }
 * DELETE pagos.php?id=5         (corrige una entrega cargada por error)
 */

require __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$user = require_user();

$metodos = [];
foreach (metodos_pago() as $value => $label) {
    $metodos[] = ['value' => $value, 'label' => $label];
}

/* ==========================================================================
   GET · cuenta corriente
   ========================================================================== */
if ($method === 'GET') {
    $alumnoId = isset($_GET['alumno_id']) ? (int) $_GET['alumno_id'] : 0;

    if ($user['rol'] === 'alumno') {
        if ($alumnoId > 0 && $alumnoId !== $user['id']) {
            api_error('No podés consultar la cuenta de otro alumno.', 403);
        }
        $alumnoId = $user['id'];
    }

    if ($alumnoId <= 0) {
        api_error('Indicá el alumno cuya cuenta querés consultar.', 422);
    }

    $alumno = obtener_alumno($alumnoId);

    if (!$alumno) {
        api_error('Alumno no encontrado.', 404);
    }

    api_ok([
        'alumno' => $alumno,
        'cuenta' => cuenta_alumno($alumnoId),
        'metodos_pago' => $metodos,
    ]);
}

require_ajax();

/* ==========================================================================
   POST · nueva entrega
   ========================================================================== */
if ($method === 'POST') {
    require_trainer();

    $body = request_body();

    $alumnoId = (int) ($body['alumno_id'] ?? 0);
    $alumno = obtener_alumno($alumnoId);

    if (!$alumno) {
        api_error('Alumno no encontrado.', 404);
    }

    $periodo = trim((string) ($body['periodo_mes'] ?? ''));

    if (!periodo_valido($periodo)) {
        api_error('El período debe tener el formato AAAA-MM.', 422);
    }

    $monto = $body['monto_abonado'] ?? null;

    if (!is_numeric($monto)) {
        api_error('Ingresá un monto válido.', 422);
    }

    $monto = round((float) $monto, 2);

    if ($monto <= 0) {
        api_error('El monto abonado debe ser mayor a cero.', 422);
    }

    if ($monto > 10000000) {
        api_error('El monto ingresado es demasiado alto.', 422);
    }

    $fechaPago = trim((string) ($body['fecha_pago'] ?? date('Y-m-d')));

    if (!fecha_valida($fechaPago)) {
        api_error('La fecha de pago no es válida.', 422);
    }

    if ($fechaPago > date('Y-m-d')) {
        api_error('La fecha de pago no puede ser futura.', 422);
    }

    $metodo = strtolower(trim((string) ($body['metodo_pago'] ?? 'efectivo')));

    if (!metodo_pago_valido($metodo)) {
        api_error('El método de pago seleccionado no es válido.', 422);
    }

    $observaciones = trim((string) ($body['observaciones'] ?? ''));

    if (mb_strlen($observaciones) > 255) {
        api_error('Las observaciones no pueden superar los 255 caracteres.', 422);
    }

    $stmt = db()->prepare(
        'INSERT INTO pagos
            (alumno_id, periodo_mes, monto_total_tarifa, monto_abonado, fecha_pago,
             metodo_pago, observaciones, registrado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $alumnoId,
        $periodo,
        (float) $alumno['tarifa_mensual'],
        $monto,
        $fechaPago,
        $metodo,
        $observaciones !== '' ? $observaciones : null,
        $user['id'],
    ]);

    $pagoId = (int) db()->lastInsertId();

    $cuenta = cuenta_alumno($alumnoId);

    $stmt = db()->prepare("UPDATE usuarios SET estado_cuenta = ? WHERE id = ? AND rol = 'alumno'");
    $stmt->execute([$cuenta['estado'], $alumnoId]);

    $stmt = db()->prepare(
        'SELECT p.id, p.periodo_mes, p.monto_total_tarifa, p.monto_abonado, p.fecha_pago,
                p.metodo_pago, p.observaciones, p.creado_en, u.nombre AS registrado_por_nombre
         FROM pagos p
         LEFT JOIN usuarios u ON u.id = p.registrado_por
         WHERE p.id = ?'
    );
    $stmt->execute([$pagoId]);
    $pago = $stmt->fetch();

    $pago['id'] = (int) $pago['id'];
    $pago['monto_total_tarifa'] = (float) $pago['monto_total_tarifa'];
    $pago['monto_abonado'] = (float) $pago['monto_abonado'];

    api_ok([
        'pago' => $pago,
        'cuenta' => $cuenta,
        'metodos_pago' => $metodos,
        'message' => 'Pago registrado correctamente.',
    ]);
}

/* ==========================================================================
   DELETE · corregir una entrega
   ========================================================================== */
if ($method === 'DELETE') {
    require_trainer();

    $pagoId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

    if ($pagoId <= 0) {
        api_error('Indicá el pago que querés eliminar.', 422);
    }

    $stmt = db()->prepare('SELECT id, alumno_id FROM pagos WHERE id = ? LIMIT 1');
    $stmt->execute([$pagoId]);
    $pago = $stmt->fetch();

    if (!$pago) {
        api_error('Pago no encontrado.', 404);
    }

    $alumnoId = (int) $pago['alumno_id'];

    $stmt = db()->prepare('DELETE FROM pagos WHERE id = ?');
    $stmt->execute([$pagoId]);

    $cuenta = cuenta_alumno($alumnoId);

    $stmt = db()->prepare("UPDATE usuarios SET estado_cuenta = ? WHERE id = ? AND rol = 'alumno'");
    $stmt->execute([$cuenta['estado'], $alumnoId]);

    api_ok([
        'id' => $pagoId,
        'alumno_id' => $alumnoId,
        'cuenta' => $cuenta,
        'message' => 'Pago eliminado. La cuenta fue recalculada.',
    ]);
}

api_error('Método no permitido.', 405);
