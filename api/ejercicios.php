<?php
/**
 * Biblioteca de ejercicios.
 *
 * GET ejercicios.php                 → todos
 * GET ejercicios.php?q=sentadilla    → búsqueda
 * GET ejercicios.php?grupo=Piernas   → filtro por grupo
 * GET ejercicios.php?id=1            → detalle técnico
 */

require __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    api_error('Método no permitido.', 405);
}

require_user();

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($id > 0) {
    $stmt = db()->prepare(
        'SELECT id, nombre, grupo_muscular, url_gif_o_video, instrucciones_tecnica
         FROM ejercicios_biblioteca
         WHERE id = ?
         LIMIT 1'
    );
    $stmt->execute([$id]);
    $ejercicio = $stmt->fetch();

    if (!$ejercicio) {
        api_error('Ejercicio no encontrado.', 404);
    }

    $ejercicio['id'] = (int) $ejercicio['id'];
    api_ok($ejercicio);
}

$q = trim((string) ($_GET['q'] ?? ''));
$grupo = trim((string) ($_GET['grupo'] ?? ''));

if (mb_strlen($q) > 80) {
    api_error('La búsqueda es demasiado larga.', 422);
}

$sql = 'SELECT id, nombre, grupo_muscular, url_gif_o_video, instrucciones_tecnica
        FROM ejercicios_biblioteca
        WHERE 1 = 1';
$params = [];

if ($q !== '') {
    $sql .= ' AND (nombre LIKE ? OR grupo_muscular LIKE ?)';
    $like = '%' . $q . '%';
    $params[] = $like;
    $params[] = $like;
}

if ($grupo !== '') {
    $sql .= ' AND grupo_muscular = ?';
    $params[] = $grupo;
}

$sql .= ' ORDER BY grupo_muscular ASC, nombre ASC';

$stmt = db()->prepare($sql);
$stmt->execute($params);
$ejercicios = $stmt->fetchAll();

$ejercicios = array_map(static function (array $ejercicio): array {
    $ejercicio['id'] = (int) $ejercicio['id'];
    return $ejercicio;
}, $ejercicios);

$grupos = array_values(array_unique(array_column($ejercicios, 'grupo_muscular')));
sort($grupos);

api_ok([
    'ejercicios' => $ejercicios,
    'grupos' => $grupos,
    'total' => count($ejercicios),
]);
