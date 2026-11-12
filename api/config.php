<?php
/**
 * ============================================================================
 * MorochoTeam · Bootstrap de la API
 * - Configuración de base de datos por variables de entorno (con defaults XAMPP)
 * - Conexión PDO única con consultas preparadas reales
 * - Sesión PHP segura, helpers JSON, validaciones y cuenta corriente
 * ============================================================================
 */

declare(strict_types=1);

date_default_timezone_set('America/Argentina/Buenos_Aires');

/* --------------------------------------------------------------------------
   Configuración
   -------------------------------------------------------------------------- */
function mt_env(string $key, string $default = ''): string
{
    $value = getenv($key);
    return ($value === false || $value === '') ? $default : $value;
}

$serverName = $_SERVER['SERVER_NAME'] ?? '';
$isLocal = in_array($serverName, ['localhost', '127.0.0.1', '::1'], true)
    || in_array(PHP_SAPI, ['cli', 'cli-server'], true);

define('MT_DEBUG', filter_var(mt_env('MT_DEBUG', $isLocal ? '1' : '0'), FILTER_VALIDATE_BOOLEAN));
define('DB_HOST', mt_env('MT_DB_HOST', '127.0.0.1'));
define('DB_PORT', mt_env('MT_DB_PORT', '3306'));
define('DB_NAME', mt_env('MT_DB_NAME', 'morochoteam'));
define('DB_USER', mt_env('MT_DB_USER', 'root'));
define('DB_PASS', mt_env('MT_DB_PASS', ''));
define('DB_CHARSET', 'utf8mb4');

/** Día del mes en que se considera vencida la cuota. */
define('DIA_VENCIMIENTO', 10);

/* --------------------------------------------------------------------------
   Errores siempre en JSON
   -------------------------------------------------------------------------- */
set_exception_handler(static function (Throwable $error): void {
    error_log('[MorochoTeam] ' . $error->getMessage() . ' @ ' . $error->getFile() . ':' . $error->getLine());

    $payload = [
        'ok' => false,
        'error' => 'Ocurrió un error interno en el servidor.',
    ];

    if (MT_DEBUG) {
        $payload['debug'] = [
            'message' => $error->getMessage(),
            'file' => basename($error->getFile()),
            'line' => $error->getLine(),
        ];
    }

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }

    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
});

/* --------------------------------------------------------------------------
   Sesión
   -------------------------------------------------------------------------- */
if (session_status() !== PHP_SESSION_ACTIVE) {
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    session_name('MTSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: same-origin');
header('Permissions-Policy: geolocation=(), microphone=()');

/* --------------------------------------------------------------------------
   Base de datos
   -------------------------------------------------------------------------- */
function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', DB_HOST, DB_PORT, DB_NAME, DB_CHARSET);

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
    } catch (PDOException $error) {
        throw new RuntimeException(
            'No se pudo conectar con MySQL. Verificá que el servicio esté iniciado y que hayas importado database.sql.',
            0,
            $error
        );
    }

    return $pdo;
}

/* --------------------------------------------------------------------------
   Respuestas JSON
   -------------------------------------------------------------------------- */
function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function api_ok(mixed $data = null): never
{
    respond(['ok' => true, 'data' => $data]);
}

function api_error(string $message, int $status = 400, array $extra = []): never
{
    respond(array_merge(['ok' => false, 'error' => $message], $extra), $status);
}

/** Lee JSON (o form-data como fallback) del cuerpo de la petición. */
function request_body(): array
{
    static $body = null;

    if (is_array($body)) {
        return $body;
    }

    $raw = file_get_contents('php://input');

    if ($raw === false || trim($raw) === '') {
        $body = $_POST ?: [];
        return $body;
    }

    $decoded = json_decode($raw, true);

    if (!is_array($decoded)) {
        api_error('El cuerpo de la solicitud no es JSON válido.', 400);
    }

    $body = $decoded;
    return $body;
}

/** Protección básica para peticiones que modifican datos. */
function require_ajax(): void
{
    $requestedWith = strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? ''));
    $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));

    if ($requestedWith !== 'xmlhttprequest' && strpos($contentType, 'application/json') === false) {
        api_error('Solicitud no permitida. Utilizá la interfaz de MorochoTeam.', 400);
    }
}

/* --------------------------------------------------------------------------
   Autenticación
   -------------------------------------------------------------------------- */
function normalizar_usuario(array $user): array
{
    $user['id'] = (int) $user['id'];
    $user['tarifa_mensual'] = (float) $user['tarifa_mensual'];
    $user['activo'] = (int) $user['activo'] === 1;

    return $user;
}

function auth_user(bool $fresh = false): ?array
{
    static $cached = null;

    if ($cached !== null && !$fresh) {
        return $cached;
    }

    if (empty($_SESSION['usuario_id'])) {
        return null;
    }

    $stmt = db()->prepare(
        'SELECT id, nombre, email, rol, telefono, notas_medicas, estado_cuenta, activo, tarifa_mensual, fecha_alta
         FROM usuarios
         WHERE id = ?
         LIMIT 1'
    );
    $stmt->execute([(int) $_SESSION['usuario_id']]);
    $user = $stmt->fetch();

    if (!$user || (int) $user['activo'] !== 1) {
        $_SESSION = [];
        $cached = null;
        return null;
    }

    $cached = normalizar_usuario($user);
    return $cached;
}

function require_user(): array
{
    $user = auth_user();

    if (!$user) {
        api_error('Tu sesión expiró o no estás autenticado. Volvé a ingresar.', 401);
    }

    return $user;
}

function require_trainer(): array
{
    $user = require_user();

    if ($user['rol'] !== 'trainer') {
        api_error('No tenés permisos para realizar esta acción.', 403);
    }

    return $user;
}

function require_alumno(): array
{
    $user = require_user();

    if ($user['rol'] !== 'alumno') {
        api_error('Esta acción es exclusiva de alumnos.', 403);
    }

    return $user;
}

function cerrar_sesion(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'],
            'domain' => $params['domain'],
            'secure' => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Lax',
        ]);
    }

    session_destroy();
}

/* --------------------------------------------------------------------------
   Helpers de fechas / validación
   -------------------------------------------------------------------------- */
function dias_semana(): array
{
    return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
}

function fecha_valida(string $value): bool
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    return $date instanceof DateTimeImmutable && $date->format('Y-m-d') === $value;
}

function lunes_de(string $fecha): string
{
    $date = new DateTimeImmutable($fecha);
    $offset = (int) $date->format('N') - 1;
    return $date->modify('-' . $offset . ' days')->format('Y-m-d');
}

function nombre_dia(string $fecha): string
{
    $index = (int) (new DateTimeImmutable($fecha))->format('N') - 1;
    return dias_semana()[$index];
}

function periodo_valido(string $periodo): bool
{
    if (!preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $periodo, $matches)) {
        return false;
    }

    $year = (int) $matches[1];
    return $year >= 2000 && $year <= 2100;
}

function metodo_pago_valido(string $metodo): bool
{
    return array_key_exists($metodo, metodos_pago());
}

function metodos_pago(): array
{
    return [
        'efectivo' => 'Efectivo',
        'transferencia' => 'Transferencia',
        'debito' => 'Débito',
        'credito' => 'Crédito',
        'mercadopago' => 'Mercado Pago',
        'otro' => 'Otro',
    ];
}

function to_bool(mixed $value): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_int($value) || is_float($value)) {
        return (int) $value === 1;
    }

    $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    return $parsed ?? false;
}

function redondear(float $value): float
{
    return round($value, 2);
}

/* --------------------------------------------------------------------------
   Alumnos y cuenta corriente
   -------------------------------------------------------------------------- */
function obtener_alumno(int $alumnoId): ?array
{
    $stmt = db()->prepare(
        "SELECT id, nombre, email, telefono, notas_medicas, estado_cuenta, activo, tarifa_mensual, fecha_alta
         FROM usuarios
         WHERE id = ? AND rol = 'alumno'
         LIMIT 1"
    );
    $stmt->execute([$alumnoId]);
    $alumno = $stmt->fetch();

    if (!$alumno) {
        return null;
    }

    $alumno['id'] = (int) $alumno['id'];
    $alumno['tarifa_mensual'] = (float) $alumno['tarifa_mensual'];
    $alumno['activo'] = (int) $alumno['activo'] === 1;

    return $alumno;
}

function estado_desde_saldos(float $abonado, float $tarifa): string
{
    if ($tarifa <= 0 || $abonado >= $tarifa) {
        return 'al_dia';
    }

    return $abonado > 0 ? 'parcial' : 'vencido';
}

/**
 * Devuelve el estado de cuenta completo de un alumno:
 * períodos, entregas parciales, saldo por período y estado general.
 */
function cuenta_alumno(int $alumnoId): array
{
    $alumno = obtener_alumno($alumnoId);

    if (!$alumno) {
        api_error('Alumno no encontrado.', 404);
    }

    $tarifaActual = (float) $alumno['tarifa_mensual'];
    $periodoActual = date('Y-m');
    $hoy = date('Y-m-d');
    $vencimiento = date('Y-m-') . str_pad((string) DIA_VENCIMIENTO, 2, '0', STR_PAD_LEFT);

    $stmt = db()->prepare(
        'SELECT periodo_mes,
                SUM(monto_abonado) AS abonado,
                MAX(monto_total_tarifa) AS tarifa_referencia,
                COUNT(*) AS movimientos,
                MAX(fecha_pago) AS ultimo_pago
         FROM pagos
         WHERE alumno_id = ?
         GROUP BY periodo_mes
         ORDER BY periodo_mes DESC'
    );
    $stmt->execute([$alumnoId]);
    $resumenPeriodos = $stmt->fetchAll();

    $stmt = db()->prepare(
        'SELECT p.id, p.periodo_mes, p.monto_total_tarifa, p.monto_abonado, p.fecha_pago,
                p.metodo_pago, p.observaciones, p.creado_en, u.nombre AS registrado_por_nombre
         FROM pagos p
         LEFT JOIN usuarios u ON u.id = p.registrado_por
         WHERE p.alumno_id = ?
         ORDER BY p.fecha_pago DESC, p.id DESC'
    );
    $stmt->execute([$alumnoId]);
    $pagos = $stmt->fetchAll();

    $pagos = array_map(static function (array $pago): array {
        $pago['id'] = (int) $pago['id'];
        $pago['monto_total_tarifa'] = (float) $pago['monto_total_tarifa'];
        $pago['monto_abonado'] = (float) $pago['monto_abonado'];
        return $pago;
    }, $pagos);

    $pagosPorPeriodo = [];
    foreach ($pagos as $pago) {
        $pagosPorPeriodo[$pago['periodo_mes']][] = $pago;
    }

    $periodos = [];

    foreach ($resumenPeriodos as $row) {
        $periodo = $row['periodo_mes'];
        $tarifaPeriodo = (float) $row['tarifa_referencia'];
        if ($tarifaPeriodo <= 0) {
            $tarifaPeriodo = $tarifaActual;
        }

        $abonado = (float) $row['abonado'];
        $saldo = max(0, redondear($tarifaPeriodo - $abonado));

        $periodos[$periodo] = [
            'periodo' => $periodo,
            'tarifa' => redondear($tarifaPeriodo),
            'abonado' => redondear($abonado),
            'saldo' => $saldo,
            'movimientos' => (int) $row['movimientos'],
            'ultimo_pago' => $row['ultimo_pago'],
            'estado' => 'al_dia',
            'pagos' => $pagosPorPeriodo[$periodo] ?? [],
        ];
    }

    if (!isset($periodos[$periodoActual])) {
        $periodos[$periodoActual] = [
            'periodo' => $periodoActual,
            'tarifa' => redondear($tarifaActual),
            'abonado' => 0.0,
            'saldo' => redondear($tarifaActual),
            'movimientos' => 0,
            'ultimo_pago' => null,
            'estado' => 'parcial',
            'pagos' => [],
        ];
    }

    krsort($periodos);

    $estadoGeneral = 'al_dia';
    $deudaTotal = 0.0;
    $periodosPendientes = 0;

    foreach ($periodos as &$periodo) {
        if ($periodo['saldo'] <= 0) {
            $periodo['estado'] = 'al_dia';
            continue;
        }

        if ($periodo['periodo'] < $periodoActual) {
            $periodo['estado'] = 'vencido';
        } elseif ($periodo['periodo'] === $periodoActual) {
            $periodo['estado'] = $hoy > $vencimiento ? 'vencido' : 'parcial';
        } else {
            $periodo['estado'] = 'parcial';
        }

        if ($periodo['periodo'] <= $periodoActual) {
            $deudaTotal += $periodo['saldo'];
            $periodosPendientes++;

            if ($periodo['estado'] === 'vencido') {
                $estadoGeneral = 'vencido';
            } elseif ($estadoGeneral !== 'vencido') {
                $estadoGeneral = 'parcial';
            }
        }
    }
    unset($periodo);

    $cuotaActual = $periodos[$periodoActual];

    return [
        'tarifa_mensual' => redondear($tarifaActual),
        'periodo_actual' => $periodoActual,
        'vencimiento' => $vencimiento,
        'estado' => $estadoGeneral,
        'abonado_mes' => $cuotaActual['abonado'],
        'saldo_mes' => $cuotaActual['saldo'],
        'deuda_total' => redondear($deudaTotal),
        'periodos_pendientes' => $periodosPendientes,
        'cuota_actual' => $cuotaActual,
        'periodos' => array_values($periodos),
        'pagos' => $pagos,
    ];
}

/** Mantiene sincronizado el campo cacheado usuarios.estado_cuenta. */
function sincronizar_estado_cuenta(int $alumnoId): string
{
    $cuenta = cuenta_alumno($alumnoId);

    $stmt = db()->prepare("UPDATE usuarios SET estado_cuenta = ? WHERE id = ? AND rol = 'alumno'");
    $stmt->execute([$cuenta['estado'], $alumnoId]);

    return $cuenta['estado'];
}
