<?php
/**
 * Rutinas semanales.
 *
 * GET  rutinas.php?alumno_id=2&semana=2026-11-09
 * POST rutinas.php?action=crear
 * POST rutinas.php?action=actualizar
 * POST rutinas.php?action=eliminar
 * POST rutinas.php?action=reordenar
 * POST rutinas.php?action=clonar
 */

require __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* ==========================================================================
   Helpers locales
   ========================================================================== */
function rutina_formatear(array $row): array
{
    $row['id'] = (int) $row['id'];
    $row['alumno_id'] = (int) $row['alumno_id'];
    $row['orden'] = (int) $row['orden'];
    $row['ejercicio_id'] = (int) $row['ejercicio_id'];
    $row['series_objetivo'] = (int) $row['series_objetivo'];
    $row['peso_objetivo'] = $row['peso_objetivo'] !== null ? (float) $row['peso_objetivo'] : null;

    return $row;
}

function rutina_obtener(int $id): ?array
{
    $stmt = db()->prepare(
        'SELECT r.*, e.nombre AS ejercicio, e.grupo_muscular, e.url_gif_o_video, e.instrucciones_tecnica
         FROM rutinas_semanales r
         INNER JOIN ejercicios_biblioteca e ON e.id = r.ejercicio_id
         WHERE r.id = ?
         LIMIT 1'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    return $row ? rutina_formatear($row) : null;
}

function rutina_validar_dia(mixed $dia): string
{
    $valor = trim((string) $dia);

    if (!in_array($valor, dias_semana(), true)) {
        api_error('El día de la semana no es válido.', 422);
    }

    return $valor;
}

function rutina_validar_reps(mixed $reps): string
{
    $valor = trim((string) $reps);

    if ($valor === '' || mb_strlen($valor) > 20 || !preg_match('/^[\p{L}\p{N}\s\-–]{1,20}$/u', $valor)) {
        api_error('Las repeticiones objetivo no son válidas (ej: 10, 8-12, 45s).', 422);
    }

    return $valor;
}

function rutina_validar_peso(mixed $peso): ?float
{
    if ($peso === null || $peso === '') {
        return null;
    }

    if (!is_numeric($peso)) {
        api_error('El peso objetivo debe ser numérico.', 422);
    }

    $valor = (float) $peso;

    if ($valor < 0 || $valor > 1000) {
        api_error('El peso objetivo debe estar entre 0 y 1000 kg.', 422);
    }

    return round($valor, 2);
}

function rutina_normalizar_semana(mixed $semana): string
{
    $valor = trim((string) $semana);

    if ($valor === '') {
        return lunes_de(date('Y-m-d'));
    }

    if (!fecha_valida($valor)) {
        api_error('La fecha de la semana no es válida.', 422);
    }

    return lunes_de($valor);
}

/* ==========================================================================
   GET · lectura de la semana
   ========================================================================== */
if ($method === 'GET') {
    $user = require_user();

    $alumnoId = isset($_GET['alumno_id']) ? (int) $_GET['alumno_id'] : 0;

    if ($user['rol'] === 'alumno') {
        if ($alumnoId > 0 && $alumnoId !== $user['id']) {
            api_error('No podés consultar la rutina de otro alumno.', 403);
        }
        $alumnoId = $user['id'];
    }

    if ($alumnoId <= 0) {
        api_error('Indicá el alumno cuya rutina querés consultar.', 422);
    }

    $alumno = obtener_alumno($alumnoId);

    if (!$alumno) {
        api_error('Alumno no encontrado.', 404);
    }

    $semana = rutina_normalizar_semana($_GET['semana'] ?? '');
    $semanaAnterior = date('Y-m-d', strtotime($semana . ' -7 days'));

    $stmt = db()->prepare(
        'SELECT r.*, e.nombre AS ejercicio, e.grupo_muscular, e.url_gif_o_video, e.instrucciones_tecnica
         FROM rutinas_semanales r
         INNER JOIN ejercicios_biblioteca e ON e.id = r.ejercicio_id
         WHERE r.alumno_id = ? AND r.fecha_inicio_semana = ?
         ORDER BY r.dia_semana ASC, r.orden ASC, r.id ASC'
    );
    $stmt->execute([$alumnoId, $semana]);
    $rutinas = array_map('rutina_formatear', $stmt->fetchAll());

    $dias = [];
    foreach (dias_semana() as $dia) {
        $dias[$dia] = [];
    }

    foreach ($rutinas as $rutina) {
        $dias[$rutina['dia_semana']][] = $rutina;
    }

    $stmt = db()->prepare(
        'SELECT COUNT(*) AS total
         FROM rutinas_semanales
         WHERE alumno_id = ? AND fecha_inicio_semana = ?'
    );
    $stmt->execute([$alumnoId, $semanaAnterior]);
    $totalAnterior = (int) $stmt->fetchColumn();

    $stmt = db()->prepare(
        'SELECT DISTINCT fecha_inicio_semana
         FROM rutinas_semanales
         WHERE alumno_id = ?
         ORDER BY fecha_inicio_semana DESC
         LIMIT 20'
    );
    $stmt->execute([$alumnoId]);
    $semanasConRutina = array_map(
        static fn(array $row): string => $row['fecha_inicio_semana'],
        $stmt->fetchAll()
    );

    api_ok([
        'alumno' => [
            'id' => $alumno['id'],
            'nombre' => $alumno['nombre'],
            'email' => $alumno['email'],
        ],
        'semana' => $semana,
        'semana_anterior' => $semanaAnterior,
        'semana_actual' => lunes_de(date('Y-m-d')),
        'es_semana_actual' => $semana === lunes_de(date('Y-m-d')),
        'tiene_semana_anterior' => $totalAnterior > 0,
        'total_semana_anterior' => $totalAnterior,
        'semanas_con_rutina' => $semanasConRutina,
        'rutinas' => $rutinas,
        'dias' => $dias,
        'dias_con_rutina' => array_keys(array_filter($dias)),
        'total' => count($rutinas),
    ]);
}

if ($method !== 'POST') {
    api_error('Método no permitido.', 405);
}

/* ==========================================================================
   POST · escritura (solo entrenador)
   ========================================================================== */
$user = require_trainer();
require_ajax();

$body = request_body();
$action = strtolower(trim((string) ($_GET['action'] ?? $body['action'] ?? 'crear')));

switch ($action) {
    /* ----------------------------------------------------------------------
       Crear ejercicio dentro de un día
       ---------------------------------------------------------------------- */
    case 'crear':
        $alumnoId = (int) ($body['alumno_id'] ?? 0);
        $alumno = obtener_alumno($alumnoId);

        if (!$alumno) {
            api_error('Alumno no encontrado.', 404);
        }

        $semana = rutina_normalizar_semana($body['semana'] ?? '');
        $dia = rutina_validar_dia($body['dia_semana'] ?? '');
        $ejercicioId = (int) ($body['ejercicio_id'] ?? 0);

        if ($ejercicioId <= 0) {
            api_error('Seleccioná un ejercicio de la biblioteca.', 422);
        }

        $stmt = db()->prepare('SELECT id FROM ejercicios_biblioteca WHERE id = ? LIMIT 1');
        $stmt->execute([$ejercicioId]);

        if (!$stmt->fetchColumn()) {
            api_error('El ejercicio seleccionado no existe.', 404);
        }

        $series = (int) ($body['series_objetivo'] ?? 3);
        if ($series < 1 || $series > 50) {
            api_error('Las series deben estar entre 1 y 50.', 422);
        }

        $reps = rutina_validar_reps($body['reps_objetivo'] ?? '10');
        $peso = rutina_validar_peso($body['peso_objetivo'] ?? null);

        $notas = trim((string) ($body['notas'] ?? ''));
        if (mb_strlen($notas) > 255) {
            api_error('Las notas no pueden superar los 255 caracteres.', 422);
        }

        $orden = isset($body['orden']) ? (int) $body['orden'] : 0;

        if ($orden <= 0) {
            $stmt = db()->prepare(
                'SELECT COALESCE(MAX(orden), 0) + 1
                 FROM rutinas_semanales
                 WHERE alumno_id = ? AND fecha_inicio_semana = ? AND dia_semana = ?'
            );
            $stmt->execute([$alumnoId, $semana, $dia]);
            $orden = (int) $stmt->fetchColumn();
        }

        $stmt = db()->prepare(
            'INSERT INTO rutinas_semanales
                (alumno_id, fecha_inicio_semana, dia_semana, orden, ejercicio_id,
                 series_objetivo, reps_objetivo, peso_objetivo, notas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $alumnoId,
            $semana,
            $dia,
            $orden,
            $ejercicioId,
            $series,
            $reps,
            $peso,
            $notas !== '' ? $notas : null,
        ]);

        $id = (int) db()->lastInsertId();
        $creado = rutina_obtener($id);

        api_ok([
            'rutina' => $creado,
            'semana' => $semana,
            'dia_semana' => $dia,
            'message' => 'Ejercicio agregado a la rutina.',
        ]);

    /* ----------------------------------------------------------------------
       Actualizar campos de una fila
       ---------------------------------------------------------------------- */
    case 'actualizar':
        $id = (int) ($body['id'] ?? 0);

        if ($id <= 0) {
            api_error('Indicá la rutina a actualizar.', 422);
        }

        $actual = rutina_obtener($id);

        if (!$actual) {
            api_error('Registro de rutina no encontrado.', 404);
        }

        $sets = [];
        $params = [];

        if (array_key_exists('dia_semana', $body)) {
            $sets[] = 'dia_semana = ?';
            $params[] = rutina_validar_dia($body['dia_semana']);
        }

        if (array_key_exists('orden', $body)) {
            $orden = (int) $body['orden'];
            if ($orden < 1 || $orden > 999) {
                api_error('El orden debe estar entre 1 y 999.', 422);
            }
            $sets[] = 'orden = ?';
            $params[] = $orden;
        }

        if (array_key_exists('series_objetivo', $body)) {
            $series = (int) $body['series_objetivo'];
            if ($series < 1 || $series > 50) {
                api_error('Las series deben estar entre 1 y 50.', 422);
            }
            $sets[] = 'series_objetivo = ?';
            $params[] = $series;
        }

        if (array_key_exists('reps_objetivo', $body)) {
            $sets[] = 'reps_objetivo = ?';
            $params[] = rutina_validar_reps($body['reps_objetivo']);
        }

        if (array_key_exists('peso_objetivo', $body)) {
            $sets[] = 'peso_objetivo = ?';
            $params[] = rutina_validar_peso($body['peso_objetivo']);
        }

        if (array_key_exists('notas', $body)) {
            $notas = trim((string) $body['notas']);
            if (mb_strlen($notas) > 255) {
                api_error('Las notas no pueden superar los 255 caracteres.', 422);
            }
            $sets[] = 'notas = ?';
            $params[] = $notas !== '' ? $notas : null;
        }

        if (!$sets) {
            api_error('No enviaste ningún campo para actualizar.', 422);
        }

        $params[] = $id;
        $stmt = db()->prepare('UPDATE rutinas_semanales SET ' . implode(', ', $sets) . ' WHERE id = ?');
        $stmt->execute($params);

        api_ok([
            'rutina' => rutina_obtener($id),
            'message' => 'Rutina actualizada.',
        ]);

    /* ----------------------------------------------------------------------
       Eliminar una fila
       ---------------------------------------------------------------------- */
    case 'eliminar':
        $id = (int) ($body['id'] ?? 0);

        if ($id <= 0) {
            api_error('Indicá la rutina a eliminar.', 422);
        }

        $stmt = db()->prepare('DELETE FROM rutinas_semanales WHERE id = ?');
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            api_error('Registro de rutina no encontrado.', 404);
        }

        api_ok([
            'id' => $id,
            'message' => 'Ejercicio eliminado de la rutina.',
        ]);

    /* ----------------------------------------------------------------------
       Reordenar un día completo
       ---------------------------------------------------------------------- */
    case 'reordenar':
        $alumnoId = (int) ($body['alumno_id'] ?? 0);
        $rawIds = $body['ids'] ?? [];

        if (!obtener_alumno($alumnoId)) {
            api_error('Alumno no encontrado.', 404);
        }

        if (!is_array($rawIds) || count($rawIds) === 0 || count($rawIds) > 200) {
            api_error('El orden enviado no es válido.', 422);
        }

        $ids = [];
        foreach ($rawIds as $rawId) {
            $id = (int) $rawId;
            if ($id <= 0) {
                api_error('El orden enviado contiene un identificador inválido.', 422);
            }
            $ids[] = $id;
        }

        if (count(array_unique($ids)) !== count($ids)) {
            api_error('El orden enviado contiene ejercicios duplicados.', 422);
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = db()->prepare(
            "SELECT id, dia_semana
             FROM rutinas_semanales
             WHERE alumno_id = ? AND id IN ($placeholders)"
        );
        $stmt->execute(array_merge([$alumnoId], $ids));
        $encontradas = $stmt->fetchAll();

        if (count($encontradas) !== count($ids)) {
            api_error('Alguno de los ejercicios no pertenece al alumno indicado.', 403);
        }

        $dias = array_unique(array_column($encontradas, 'dia_semana'));
        if (count($dias) > 1) {
            api_error('Todos los ejercicios deben pertenecer al mismo día.', 422);
        }

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $update = $pdo->prepare('UPDATE rutinas_semanales SET orden = ? WHERE id = ? AND alumno_id = ?');
            foreach ($ids as $index => $id) {
                $update->execute([$index + 1, $id, $alumnoId]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }

        api_ok([
            'ids' => $ids,
            'dia_semana' => reset($dias),
            'message' => 'Orden actualizado.',
        ]);

    /* ----------------------------------------------------------------------
       Clonar la semana anterior
       ---------------------------------------------------------------------- */
    case 'clonar':
        $alumnoId = (int) ($body['alumno_id'] ?? 0);
        $alumno = obtener_alumno($alumnoId);

        if (!$alumno) {
            api_error('Alumno no encontrado.', 404);
        }

        $semana = rutina_normalizar_semana($body['semana'] ?? '');
        $origen = date('Y-m-d', strtotime($semana . ' -7 days'));
        $sobrescribir = to_bool($body['sobrescribir'] ?? false);

        $incremento = 0.0;
        if (isset($body['incremento_kg']) && $body['incremento_kg'] !== '') {
            if (!is_numeric($body['incremento_kg'])) {
                api_error('El incremento de peso debe ser numérico.', 422);
            }
            $incremento = (float) $body['incremento_kg'];
            if ($incremento < -50 || $incremento > 50) {
                api_error('El incremento de peso debe estar entre -50 y 50 kg.', 422);
            }
        }

        $stmt = db()->prepare(
            'SELECT COUNT(*)
             FROM rutinas_semanales
             WHERE alumno_id = ? AND fecha_inicio_semana = ?'
        );
        $stmt->execute([$alumnoId, $origen]);
        $totalOrigen = (int) $stmt->fetchColumn();

        if ($totalOrigen === 0) {
            api_error('La semana anterior no tiene rutina cargada para este alumno.', 422);
        }

        $stmt->execute([$alumnoId, $semana]);
        $totalDestino = (int) $stmt->fetchColumn();

        if ($totalDestino > 0 && !$sobrescribir) {
            api_error(
                'La semana seleccionada ya tiene una rutina. Confirmá si querés reemplazarla.',
                409,
                ['code' => 'SEMANA_CON_RUTINA', 'total_destino' => $totalDestino]
            );
        }

        $pdo = db();
        $pdo->beginTransaction();

        try {
            if ($totalDestino > 0) {
                $stmt = $pdo->prepare(
                    'DELETE FROM rutinas_semanales WHERE alumno_id = ? AND fecha_inicio_semana = ?'
                );
                $stmt->execute([$alumnoId, $semana]);
            }

            $stmt = $pdo->prepare(
                'INSERT INTO rutinas_semanales
                    (alumno_id, fecha_inicio_semana, dia_semana, orden, ejercicio_id,
                     series_objetivo, reps_objetivo, peso_objetivo, notas)
                 SELECT alumno_id, ?, dia_semana, orden, ejercicio_id,
                        series_objetivo, reps_objetivo,
                        CASE
                            WHEN peso_objetivo IS NULL THEN NULL
                            ELSE GREATEST(0, ROUND(peso_objetivo + ?, 2))
                        END,
                        notas
                 FROM rutinas_semanales
                 WHERE alumno_id = ? AND fecha_inicio_semana = ?
                 ORDER BY dia_semana ASC, orden ASC'
            );
            $stmt->execute([$semana, $incremento, $alumnoId, $origen]);
            $copiados = $stmt->rowCount();

            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }

        api_ok([
            'semana' => $semana,
            'origen' => $origen,
            'copiados' => $copiados,
            'incremento_kg' => $incremento,
            'message' => 'Semana clonada correctamente.',
        ]);

    default:
        api_error('Acción de rutina no válida.', 404);
}
