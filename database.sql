-- ============================================================================
--  MorochoTeam · Gestión de Entrenamiento y Alumnos
--  Esquema MySQL / MariaDB + datos de prueba
--
--  Importación rápida (XAMPP / Laragon):
--    mysql -u root -p < database.sql
--  o desde phpMyAdmin: Importar > database.sql
--
--  Todos los usuarios demo usan la contraseña: demo1234
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '-03:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS morochoteam
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE morochoteam;

DROP VIEW IF EXISTS vw_cuenta_corriente;
DROP TABLE IF EXISTS registros_alumno;
DROP TABLE IF EXISTS pagos;
DROP TABLE IF EXISTS rutinas_semanales;
DROP TABLE IF EXISTS ejercicios_biblioteca;
DROP TABLE IF EXISTS usuarios;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. USUARIOS (entrenador y alumnos)
-- ----------------------------------------------------------------------------
CREATE TABLE usuarios (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(120) NOT NULL,
  email           VARCHAR(160) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  rol             ENUM('trainer','alumno') NOT NULL DEFAULT 'alumno',
  telefono        VARCHAR(40) DEFAULT NULL,
  notas_medicas   TEXT DEFAULT NULL,
  estado_cuenta   ENUM('al_dia','parcial','vencido') NOT NULL DEFAULT 'al_dia',
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  tarifa_mensual  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  fecha_alta      DATE NOT NULL,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email),
  KEY idx_usuarios_rol (rol, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. BIBLIOTECA DE EJERCICIOS
-- ----------------------------------------------------------------------------
CREATE TABLE ejercicios_biblioteca (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre               VARCHAR(140) NOT NULL,
  grupo_muscular       VARCHAR(60) NOT NULL,
  url_gif_o_video      VARCHAR(500) DEFAULT NULL,
  instrucciones_tecnica TEXT DEFAULT NULL,
  creado_en            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ejercicios_grupo (grupo_muscular),
  KEY idx_ejercicios_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. RUTINAS SEMANALES
--    fecha_inicio_semana siempre es el lunes de la semana (YYYY-MM-DD)
-- ----------------------------------------------------------------------------
CREATE TABLE rutinas_semanales (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  alumno_id           INT UNSIGNED NOT NULL,
  fecha_inicio_semana DATE NOT NULL,
  dia_semana          ENUM('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo') NOT NULL,
  orden               SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  ejercicio_id        INT UNSIGNED NOT NULL,
  series_objetivo     TINYINT UNSIGNED NOT NULL DEFAULT 3,
  reps_objetivo       VARCHAR(20) NOT NULL DEFAULT '10',
  peso_objetivo       DECIMAL(6,2) DEFAULT NULL,
  notas               VARCHAR(255) DEFAULT NULL,
  creado_en           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rutinas_semana (alumno_id, fecha_inicio_semana, dia_semana, orden),
  KEY idx_rutinas_ejercicio (ejercicio_id),
  CONSTRAINT fk_rutinas_alumno
    FOREIGN KEY (alumno_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_rutinas_ejercicio
    FOREIGN KEY (ejercicio_id) REFERENCES ejercicios_biblioteca (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. REGISTROS DE EJECUCIÓN DEL ALUMNO
--    Un registro por rutina y fecha (permite reanudar el entrenamiento).
-- ----------------------------------------------------------------------------
CREATE TABLE registros_alumno (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rutina_id            INT UNSIGNED NOT NULL,
  fecha_ejecucion      DATE NOT NULL,
  peso_real_levantado  DECIMAL(6,2) DEFAULT NULL,
  reps_reales          VARCHAR(20) DEFAULT NULL,
  completado           TINYINT(1) NOT NULL DEFAULT 0,
  comentario_alumno    VARCHAR(500) DEFAULT NULL,
  actualizado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_registro_dia (rutina_id, fecha_ejecucion),
  CONSTRAINT fk_registros_rutina
    FOREIGN KEY (rutina_id) REFERENCES rutinas_semanales (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. PAGOS / CUENTA CORRIENTE
--    Se permiten múltiples entregas parciales para el mismo periodo_mes.
-- ----------------------------------------------------------------------------
CREATE TABLE pagos (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  alumno_id          INT UNSIGNED NOT NULL,
  periodo_mes        CHAR(7) NOT NULL COMMENT 'Formato YYYY-MM',
  monto_total_tarifa DECIMAL(10,2) NOT NULL,
  monto_abonado      DECIMAL(10,2) NOT NULL,
  fecha_pago         DATE NOT NULL,
  metodo_pago        VARCHAR(40) NOT NULL DEFAULT 'efectivo',
  observaciones      VARCHAR(255) DEFAULT NULL,
  registrado_por     INT UNSIGNED DEFAULT NULL,
  creado_en          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pagos_periodo (alumno_id, periodo_mes),
  KEY idx_pagos_fecha (fecha_pago),
  CONSTRAINT fk_pagos_alumno
    FOREIGN KEY (alumno_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_pagos_registrador
    FOREIGN KEY (registrado_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
--  DATOS DE PRUEBA
-- ============================================================================

-- Contraseña para TODOS los usuarios demo: demo1234
-- Hash bcrypt generado con password_hash('demo1234', PASSWORD_BCRYPT)
INSERT INTO usuarios
  (id, nombre, email, password_hash, rol, telefono, notas_medicas, estado_cuenta, activo, tarifa_mensual, fecha_alta)
VALUES
  (1, 'Jorge Martinez', 'trainer@morochoteam.com',
   '$2y$10$Q4rYw5t1seWQKzlp8cWo5ee0OnzAUOy4Q0GIYdJtfLZmkJKmEA35a',
   'trainer', '+54 9 11 5555-0001', NULL, 'al_dia', 1, 0.00, DATE_SUB(CURDATE(), INTERVAL 730 DAY)),

  (2, 'Lucía Fernández', 'lucia@demo.com',
   '$2y$10$Q4rYw5t1seWQKzlp8cWo5ee0OnzAUOy4Q0GIYdJtfLZmkJKmEA35a',
   'alumno', '+54 9 11 5555-0102',
   'Molestia leve en rodilla derecha. Evitar máxima profundidad en sentadilla y avisar si aparece dolor.',
   'al_dia', 1, 35000.00, DATE_SUB(CURDATE(), INTERVAL 240 DAY)),

  (3, 'Mateo Ramírez', 'mateo@demo.com',
   '$2y$10$Q4rYw5t1seWQKzlp8cWo5ee0OnzAUOy4Q0GIYdJtfLZmkJKmEA35a',
   'alumno', '+54 9 11 5555-0103',
   'Sin lesiones declaradas. Objetivo: hipertrofia y fuerza en tren superior.',
   'parcial', 1, 32000.00, DATE_SUB(CURDATE(), INTERVAL 180 DAY)),

  (4, 'Sofía Benítez', 'sofia@demo.com',
   '$2y$10$Q4rYw5t1seWQKzlp8cWo5ee0OnzAUOy4Q0GIYdJtfLZmkJKmEA35a',
   'alumno', '+54 9 11 5555-0104',
   'Esguince de tobillo recuperado. Usar calzado estable para tren inferior.',
   'vencido', 1, 30000.00, DATE_SUB(CURDATE(), INTERVAL 150 DAY)),

  (5, 'Tomás Aguirre', 'tomas@demo.com',
   '$2y$10$Q4rYw5t1seWQKzlp8cWo5ee0OnzAUOy4Q0GIYdJtfLZmkJKmEA35a',
   'alumno', '+54 9 11 5555-0105',
   NULL, 'al_dia', 1, 35000.00, DATE_SUB(CURDATE(), INTERVAL 300 DAY)),

  (6, 'Camila Ríos', 'camila@demo.com',
   '$2y$10$Q4rYw5t1seWQKzlp8cWo5ee0OnzAUOy4Q0GIYdJtfLZmkJKmEA35a',
   'alumno', '+54 9 11 5555-0106',
   'Dolor lumbar ocasional. Priorizar técnica y evitar peso muerto con cargas máximas.',
   'parcial', 1, 30000.00, DATE_SUB(CURDATE(), INTERVAL 90 DAY)),

  (7, 'Joaquín Sosa', 'joaquin@demo.com',
   '$2y$10$Q4rYw5t1seWQKzlp8cWo5ee0OnzAUOy4Q0GIYdJtfLZmkJKmEA35a',
   'alumno', '+54 9 11 5555-0107',
   'Hipertensión controlada. Evitar apneas prolongadas y trabajar con respiración fluida.',
   'vencido', 1, 32000.00, DATE_SUB(CURDATE(), INTERVAL 120 DAY));

-- ----------------------------------------------------------------------------
-- BIBLIOTECA DE EJERCICIOS
-- Imágenes de referencia: free-exercise-db (dominio público / uso libre)
-- ----------------------------------------------------------------------------
INSERT INTO ejercicios_biblioteca (id, nombre, grupo_muscular, url_gif_o_video, instrucciones_tecnica) VALUES
(1, 'Sentadilla trasera con barra', 'Piernas',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg',
 'Apoyá la barra sobre los trapecios, no sobre el cuello.\n• Pies al ancho de hombros, puntas levemente hacia afuera.\n• Inspirá, bajá con el torso firme y las rodillas alineadas con los pies.\n• Empujá el piso para subir sin perder la curvatura lumbar.\n• Mantené el core activo durante todo el recorrido.'),
(2, 'Prensa de piernas 45°', 'Piernas',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg',
 'Apoyá toda la espalda en el respaldo y regulá el asiento.\n• Pies al ancho de hombros sobre la plataforma.\n• Bajá hasta que las rodillas formen unos 90° sin despegar la cadera.\n• Empujá sin bloquear las rodillas de golpe.\n• Exhalá en la fase de empuje.'),
(3, 'Peso muerto rumano', 'Piernas',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/0.jpg',
 'Barra pegada a las piernas, rodillas levemente flexionadas.\n• Llevá la cadera hacia atrás manteniendo la espalda neutra.\n• Sentí el estiramiento en isquiotibiales sin redondear la columna.\n• Subí empujando la cadera hacia adelante.\n• La barra nunca se aleja del cuerpo.'),
(4, 'Zancadas con mancuernas', 'Piernas',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Lunges/0.jpg',
 'Mancuernas a los costados, mirada al frente.\n• Da un paso amplio y bajá la rodilla trasera hacia el piso.\n• La rodilla delantera queda alineada con el pie.\n• Empujá con la pierna delantera para volver.\n• Alterná piernas y mantené el torso vertical.'),
(5, 'Elevación de gemelos de pie', 'Piernas',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Calf_Raises/0.jpg',
 'Puntas de pies sobre el borde de la plataforma.\n• Bajá los talones controlando el estiramiento.\n• Elevá lo máximo posible y hacé una pausa arriba.\n• Evitá rebotar o usar impulso de rodillas.\n• Movimiento lento y rango completo.'),
(6, 'Press de banca plano', 'Pecho',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
 'Escápulas retraídas y glúteos apoyados en el banco.\n• Agarre un poco más ancho que los hombros.\n• Bajá la barra al esternón con codos a unos 45°.\n• Empujá sin rebotar y exhalá al subir.\n• Mantené muñecas firmes y alineadas.'),
(7, 'Press inclinado con mancuernas', 'Pecho',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/0.jpg',
 'Banco inclinado entre 30° y 45°.\n• Mancuernas a la altura del pecho, codos debajo de las muñecas.\n• Empujá hacia arriba y ligeramente hacia adentro.\n• Bajá controlando el estiramiento del pectoral.\n• No choques las mancuernas arriba.'),
(8, 'Aperturas con mancuernas', 'Pecho',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Flyes/0.jpg',
 'Codos semiflexionados y fijos durante todo el movimiento.\n• Abrí los brazos en arco hasta sentir el estiramiento.\n• Volvé cerrando el pecho, sin convertirlo en press.\n• Usá un peso moderado y priorizá la técnica.\n• No bajes más allá de la línea del banco.'),
(9, 'Remo con barra', 'Espalda',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Barbell_Row/0.jpg',
 'Cadera hacia atrás, espalda neutra y rodillas semiflexionadas.\n• Llevá la barra hacia el abdomen bajo.\n• Juntá las escápulas sin encoger el cuello.\n• Bajá controlando el movimiento.\n• Evitá balancear el torso para levantar el peso.'),
(10, 'Dominadas', 'Espalda',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pullups/0.jpg',
 'Agarre prono un poco más ancho que los hombros.\n• Iniciá deprimiendo las escápulas.\n• Subí hasta que el mentón pase la barra.\n• Bajá con control hasta extender los brazos.\n• Evitá balancearte; si hace falta, usá banda asistida.'),
(11, 'Jalón al pecho', 'Espalda',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/0.jpg',
 'Rodillas aseguradas y torso ligeramente inclinado hacia atrás.\n• Llevá la barra al pecho guiando con los codos.\n• No tires detrás de la nuca.\n• Controlá la subida hasta estirar bien los dorsales.\n• Evitá encoger los hombros.'),
(12, 'Press militar de pie', 'Hombros',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Military_Press/0.jpg',
 'Pies al ancho de hombros y core activo.\n• Barra a la altura de las clavículas.\n• Empujá hacia arriba sin arquear la espalda baja.\n• La cabeza pasa ligeramente hacia adelante al final.\n• Bajá controlando hasta el mentón.'),
(13, 'Elevaciones laterales', 'Hombros',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Side_Lateral_Raise/0.jpg',
 'Codos levemente flexionados y hombros abajo.\n• Elevá los brazos hasta la línea de los hombros.\n• Guiá el movimiento con los codos, no con las manos.\n• Evitá usar impulso o encoger el cuello.\n• Bajá lento y con control.'),
(14, 'Curl con barra', 'Bíceps',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg',
 'Codos pegados al torso y muñecas neutras.\n• Subí la barra sin mover los codos hacia adelante.\n• Apretá el bíceps arriba y bajá controlando.\n• No balancees la espalda para completar la repetición.\n• Rango completo sin bloquear la respiración.'),
(15, 'Curl martillo', 'Bíceps',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hammer_Curls/0.jpg',
 'Mancuernas con agarre neutro (pulgares arriba).\n• Codos fijos a los costados.\n• Subí hasta cerca de los hombros.\n• Bajá lento resistiendo la gravedad.\n• Trabajá ambas piernas por igual, sin rotar el torso.'),
(16, 'Extensión de tríceps en polea', 'Tríceps',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown/0.jpg',
 'Codos pegados al torso y espalda estable.\n• Empujá la cuerda o barra hasta extender los codos.\n• Separá la cuerda al final si usás cuerda.\n• Volvé controlando sin abrir los codos.\n• Evitá inclinarte y usar el peso del cuerpo.'),
(17, 'Fondos en paralelas', 'Tríceps',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dips_-_Triceps_Version/0.jpg',
 'Brazos extendidos y hombros lejos de las orejas.\n• Bajá flexionando los codos hacia atrás.\n• Mantené el torso relativamente vertical para tríceps.\n• Subí sin rebotar.\n• Si molesta el hombro, reducí el rango.'),
(18, 'Plancha abdominal', 'Core',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg',
 'Codos debajo de los hombros y cuerpo en línea recta.\n• Activá glúteos y abdomen para evitar que la cadera caiga.\n• Mirada al piso, cuello relajado.\n• Respirá de forma fluida durante todo el tiempo.\n• Terminá la serie cuando pierdas la postura, no cuando aparezca dolor.'),
(19, 'Peso muerto convencional', 'Piernas',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg',
 'Barra sobre el medio del pie y espalda neutra.\n• Agarre firme, brazos rectos y core activado.\n• Empujá el piso y extendé cadera y rodillas a la vez.\n• La barra sube pegada a las piernas.\n• Bajá con control, flexionando primero la cadera.'),
(20, 'Crunch en polea', 'Core',
 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crunch/0.jpg',
 'Arrodillado frente a la polea, cuerda junto a la cabeza.\n• Flexioná el abdomen acercando costillas a la pelvis.\n• No tires con los brazos ni flexiones la cadera.\n• Volvé controlando la carga.\n• Exhalá en la contracción y evitá arquear la lumbar.');

-- ----------------------------------------------------------------------------
-- RUTINAS · Semana actual y anterior
-- ----------------------------------------------------------------------------
SET @lunes     = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY);
SET @lunes_ant = DATE_SUB(@lunes, INTERVAL 7 DAY);
SET @hoy_nombre = ELT(WEEKDAY(CURDATE()) + 1,
                      'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo');

-- Lucía Fernández (id 2) · semana actual completa (7 días)
INSERT INTO rutinas_semanales
  (alumno_id, fecha_inicio_semana, dia_semana, orden, ejercicio_id, series_objetivo, reps_objetivo, peso_objetivo, notas)
VALUES
  -- Lunes
  (2, @lunes, 'Lunes', 1, 1, 4, '8',  40.00, 'Tempo controlado, 2 segundos de bajada'),
  (2, @lunes, 'Lunes', 2, 2, 3, '12', 80.00, NULL),
  (2, @lunes, 'Lunes', 3, 3, 3, '10', 35.00, 'Sentir isquiotibiales'),
  (2, @lunes, 'Lunes', 4, 5, 4, '15', 20.00, NULL),
  -- Martes
  (2, @lunes, 'Martes', 1, 6, 4, '8',  35.00, 'Escápulas retraídas'),
  (2, @lunes, 'Martes', 2, 9, 4, '10', 30.00, NULL),
  (2, @lunes, 'Martes', 3, 13, 3, '12', 8.00, NULL),
  (2, @lunes, 'Martes', 4, 14, 3, '12', 15.00, NULL),
  (2, @lunes, 'Martes', 5, 16, 3, '12', 15.00, NULL),
  -- Miércoles
  (2, @lunes, 'Miércoles', 1, 19, 4, '6',  60.00, 'Técnica prioritaria'),
  (2, @lunes, 'Miércoles', 2, 10, 3, '8',  NULL, 'Asistida con banda si hace falta'),
  (2, @lunes, 'Miércoles', 3, 11, 3, '12', 40.00, NULL),
  (2, @lunes, 'Miércoles', 4, 4, 3, '10', 12.00, NULL),
  (2, @lunes, 'Miércoles', 5, 5, 3, '15', 20.00, NULL),
  -- Jueves (día demo con registros cargados)
  (2, @lunes, 'Jueves', 1, 12, 4, '8',  25.00, NULL),
  (2, @lunes, 'Jueves', 2, 10, 3, '8',  NULL, NULL),
  (2, @lunes, 'Jueves', 3, 7, 3, '10', 22.00, 'Codos a 45°'),
  (2, @lunes, 'Jueves', 4, 9, 3, '10', 30.00, NULL),
  (2, @lunes, 'Jueves', 5, 18, 3, '45s', NULL, 'Mantener cadera alineada'),
  -- Viernes
  (2, @lunes, 'Viernes', 1, 1, 4, '6',  45.00, NULL),
  (2, @lunes, 'Viernes', 2, 2, 3, '10', 90.00, NULL),
  (2, @lunes, 'Viernes', 3, 3, 3, '10', 40.00, NULL),
  (2, @lunes, 'Viernes', 4, 15, 3, '12', 10.00, NULL),
  (2, @lunes, 'Viernes', 5, 16, 3, '15', 15.00, NULL),
  -- Sábado
  (2, @lunes, 'Sábado', 1, 6, 4, '8',  37.50, NULL),
  (2, @lunes, 'Sábado', 2, 11, 3, '12', 40.00, NULL),
  (2, @lunes, 'Sábado', 3, 8, 3, '12', 10.00, 'Peso moderado'),
  (2, @lunes, 'Sábado', 4, 13, 3, '15', 8.00, NULL),
  (2, @lunes, 'Sábado', 5, 20, 3, '15', 15.00, NULL),
  -- Domingo (recuperación activa)
  (2, @lunes, 'Domingo', 1, 4, 2, '12', 10.00, 'Sin buscar fallo'),
  (2, @lunes, 'Domingo', 2, 18, 2, '30s', NULL, NULL),
  (2, @lunes, 'Domingo', 3, 5, 2, '20', 15.00, NULL);

-- Tomás Aguirre (id 5) · semana actual (Lunes / Miércoles / Viernes)
INSERT INTO rutinas_semanales
  (alumno_id, fecha_inicio_semana, dia_semana, orden, ejercicio_id, series_objetivo, reps_objetivo, peso_objetivo, notas)
VALUES
  (5, @lunes, 'Lunes',     1, 6,  4, '10', 30.00, NULL),
  (5, @lunes, 'Lunes',     2, 9,  4, '10', 25.00, NULL),
  (5, @lunes, 'Lunes',     3, 13, 3, '15', 6.00, NULL),
  (5, @lunes, 'Lunes',     4, 16, 3, '12', 12.00, NULL),
  (5, @lunes, 'Miércoles', 1, 1,  4, '10', 30.00, NULL),
  (5, @lunes, 'Miércoles', 2, 2,  3, '12', 60.00, NULL),
  (5, @lunes, 'Miércoles', 3, 3,  3, '10', 25.00, NULL),
  (5, @lunes, 'Miércoles', 4, 18, 3, '40s', NULL, NULL),
  (5, @lunes, 'Viernes',   1, 12, 4, '10', 20.00, NULL),
  (5, @lunes, 'Viernes',   2, 11, 3, '12', 35.00, NULL),
  (5, @lunes, 'Viernes',   3, 14, 3, '12', 12.00, NULL),
  (5, @lunes, 'Viernes',   4, 20, 3, '15', 10.00, NULL);

-- Semana anterior · Tomás
INSERT INTO rutinas_semanales
  (alumno_id, fecha_inicio_semana, dia_semana, orden, ejercicio_id, series_objetivo, reps_objetivo, peso_objetivo, notas)
VALUES
  (5, @lunes_ant, 'Lunes',     1, 6,  4, '10', 27.50, NULL),
  (5, @lunes_ant, 'Lunes',     2, 9,  4, '10', 22.50, NULL),
  (5, @lunes_ant, 'Lunes',     3, 13, 3, '15', 6.00, NULL),
  (5, @lunes_ant, 'Lunes',     4, 16, 3, '12', 10.00, NULL),
  (5, @lunes_ant, 'Miércoles', 1, 1,  4, '10', 27.50, NULL),
  (5, @lunes_ant, 'Miércoles', 2, 2,  3, '12', 55.00, NULL),
  (5, @lunes_ant, 'Miércoles', 3, 3,  3, '10', 22.50, NULL),
  (5, @lunes_ant, 'Miércoles', 4, 18, 3, '40s', NULL, NULL),
  (5, @lunes_ant, 'Viernes',   1, 12, 4, '10', 17.50, NULL),
  (5, @lunes_ant, 'Viernes',   2, 11, 3, '12', 32.50, NULL),
  (5, @lunes_ant, 'Viernes',   3, 14, 3, '12', 10.00, NULL),
  (5, @lunes_ant, 'Viernes',   4, 20, 3, '15', 10.00, NULL);

-- Mateo Ramírez (id 3) · SOLO semana anterior → permite probar "Clonar semana"
INSERT INTO rutinas_semanales
  (alumno_id, fecha_inicio_semana, dia_semana, orden, ejercicio_id, series_objetivo, reps_objetivo, peso_objetivo, notas)
VALUES
  (3, @lunes_ant, 'Lunes',     1, 6,  4, '8',  40.00, NULL),
  (3, @lunes_ant, 'Lunes',     2, 9,  4, '10', 35.00, NULL),
  (3, @lunes_ant, 'Lunes',     3, 13, 3, '12', 10.00, NULL),
  (3, @lunes_ant, 'Lunes',     4, 16, 3, '12', 20.00, NULL),
  (3, @lunes_ant, 'Miércoles', 1, 19, 3, '5',  70.00, 'Cuidar técnica'),
  (3, @lunes_ant, 'Miércoles', 2, 11, 3, '10', 45.00, NULL),
  (3, @lunes_ant, 'Miércoles', 3, 7,  3, '10', 24.00, NULL),
  (3, @lunes_ant, 'Miércoles', 4, 18, 3, '45s', NULL, NULL),
  (3, @lunes_ant, 'Viernes',   1, 1,  4, '8',  50.00, NULL),
  (3, @lunes_ant, 'Viernes',   2, 2,  3, '12', 100.00, NULL),
  (3, @lunes_ant, 'Viernes',   3, 3,  3, '10', 45.00, NULL),
  (3, @lunes_ant, 'Viernes',   4, 15, 3, '12', 12.00, NULL);

-- Sofía Benítez (id 4) · solo semana anterior
INSERT INTO rutinas_semanales
  (alumno_id, fecha_inicio_semana, dia_semana, orden, ejercicio_id, series_objetivo, reps_objetivo, peso_objetivo, notas)
VALUES
  (4, @lunes_ant, 'Martes', 1, 1, 4, '10', 25.00, NULL),
  (4, @lunes_ant, 'Martes', 2, 4, 3, '12', 8.00, NULL),
  (4, @lunes_ant, 'Martes', 3, 5, 3, '20', 10.00, NULL),
  (4, @lunes_ant, 'Martes', 4, 18, 3, '30s', NULL, NULL),
  (4, @lunes_ant, 'Jueves', 1, 6, 3, '10', 20.00, NULL),
  (4, @lunes_ant, 'Jueves', 2, 11, 3, '12', 30.00, NULL),
  (4, @lunes_ant, 'Jueves', 3, 14, 3, '12', 8.00, NULL),
  (4, @lunes_ant, 'Jueves', 4, 16, 3, '12', 10.00, NULL),
  (4, @lunes_ant, 'Sábado', 1, 19, 3, '6', 45.00, NULL),
  (4, @lunes_ant, 'Sábado', 2, 2, 3, '12', 70.00, NULL),
  (4, @lunes_ant, 'Sábado', 3, 13, 3, '15', 5.00, NULL),
  (4, @lunes_ant, 'Sábado', 4, 20, 3, '15', 10.00, NULL);

-- Camila Ríos (id 6) · solo semana anterior
INSERT INTO rutinas_semanales
  (alumno_id, fecha_inicio_semana, dia_semana, orden, ejercicio_id, series_objetivo, reps_objetivo, peso_objetivo, notas)
VALUES
  (6, @lunes_ant, 'Lunes',     1, 2, 4, '12', 70.00, NULL),
  (6, @lunes_ant, 'Lunes',     2, 4, 3, '12', 10.00, NULL),
  (6, @lunes_ant, 'Lunes',     3, 5, 4, '15', 15.00, NULL),
  (6, @lunes_ant, 'Lunes',     4, 18, 3, '40s', NULL, NULL),
  (6, @lunes_ant, 'Miércoles', 1, 6, 3, '10', 22.50, NULL),
  (6, @lunes_ant, 'Miércoles', 2, 9, 3, '10', 20.00, NULL),
  (6, @lunes_ant, 'Miércoles', 3, 8, 3, '12', 6.00, NULL),
  (6, @lunes_ant, 'Miércoles', 4, 16, 3, '12', 10.00, NULL),
  (6, @lunes_ant, 'Viernes',   1, 1, 3, '10', 30.00, NULL),
  (6, @lunes_ant, 'Viernes',   2, 3, 3, '10', 25.00, NULL),
  (6, @lunes_ant, 'Viernes',   3, 11, 3, '12', 30.00, NULL),
  (6, @lunes_ant, 'Viernes',   4, 20, 3, '15', 10.00, NULL);

-- Joaquín Sosa (id 7) · solo semana anterior
INSERT INTO rutinas_semanales
  (alumno_id, fecha_inicio_semana, dia_semana, orden, ejercicio_id, series_objetivo, reps_objetivo, peso_objetivo, notas)
VALUES
  (7, @lunes_ant, 'Martes', 1, 6,  4, '8',  45.00, NULL),
  (7, @lunes_ant, 'Martes', 2, 7,  3, '10', 26.00, NULL),
  (7, @lunes_ant, 'Martes', 3, 14, 3, '12', 18.00, NULL),
  (7, @lunes_ant, 'Martes', 4, 17, 3, '10', NULL, 'Lastre moderado'),
  (7, @lunes_ant, 'Jueves', 1, 19, 4, '5',  90.00, 'Respirar, sin apneas'),
  (7, @lunes_ant, 'Jueves', 2, 10, 3, '6',  NULL, NULL),
  (7, @lunes_ant, 'Jueves', 3, 9,  3, '10', 40.00, NULL),
  (7, @lunes_ant, 'Jueves', 4, 18, 3, '50s', NULL, NULL),
  (7, @lunes_ant, 'Sábado', 1, 1,  4, '8',  60.00, NULL),
  (7, @lunes_ant, 'Sábado', 2, 2,  3, '12', 110.00, NULL),
  (7, @lunes_ant, 'Sábado', 3, 13, 3, '15', 10.00, NULL),
  (7, @lunes_ant, 'Sábado', 4, 16, 3, '15', 22.50, NULL);

-- ----------------------------------------------------------------------------
-- REGISTROS DEMO · Lucía, entrenamiento del día actual
-- Las 2 primeras series quedan completadas y la 3ª iniciada.
-- ----------------------------------------------------------------------------
INSERT INTO registros_alumno
  (rutina_id, fecha_ejecucion, peso_real_levantado, reps_reales, completado, comentario_alumno)
SELECT r.id, CURDATE(),
       CASE WHEN r.peso_objetivo IS NULL THEN NULL ELSE r.peso_objetivo + 2.50 END,
       r.reps_objetivo,
       1,
       'Serie completada con buena técnica.'
FROM rutinas_semanales r
WHERE r.alumno_id = 2
  AND r.fecha_inicio_semana = @lunes
  AND r.dia_semana = @hoy_nombre
  AND r.orden <= 2
ORDER BY r.orden;

INSERT INTO registros_alumno
  (rutina_id, fecha_ejecucion, peso_real_levantado, reps_reales, completado, comentario_alumno)
SELECT r.id, CURDATE(),
       r.peso_objetivo,
       '8',
       0,
       'Arranqué la serie, me faltó cerrar las últimas reps.'
FROM rutinas_semanales r
WHERE r.alumno_id = 2
  AND r.fecha_inicio_semana = @lunes
  AND r.dia_semana = @hoy_nombre
  AND r.orden = 3
LIMIT 1;

-- ----------------------------------------------------------------------------
-- PAGOS DEMO · período actual y anteriores
-- ----------------------------------------------------------------------------
SET @periodo     = DATE_FORMAT(CURDATE(), '%Y-%m');
SET @periodo_ant = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m');
SET @periodo_ant2 = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 2 MONTH), '%Y-%m');

INSERT INTO pagos
  (alumno_id, periodo_mes, monto_total_tarifa, monto_abonado, fecha_pago, metodo_pago, observaciones, registrado_por)
VALUES
  -- Lucía · al día
  (2, @periodo,     35000.00, 35000.00, CURDATE(), 'transferencia', 'Cuota completa', 1),
  (2, @periodo_ant, 35000.00, 35000.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'transferencia', NULL, 1),

  -- Mateo · parcial (dos entregas en el mes)
  (3, @periodo,     32000.00, 12000.00, CURDATE(), 'efectivo', 'Primera entrega del mes', 1),
  (3, @periodo,     32000.00,  8000.00, CURDATE(), 'mercadopago', 'Segunda entrega', 1),
  (3, @periodo_ant, 32000.00, 32000.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'transferencia', NULL, 1),

  -- Sofía · vencida (mes anterior impago)
  (4, @periodo_ant2, 30000.00, 30000.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'transferencia', NULL, 1),

  -- Tomás · al día
  (5, @periodo,     35000.00, 35000.00, CURDATE(), 'debito', 'Débito automático', 1),
  (5, @periodo_ant, 35000.00, 35000.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'debito', NULL, 1),

  -- Camila · parcial
  (6, @periodo,     30000.00, 10000.00, CURDATE(), 'efectivo', 'Entrega parcial', 1),
  (6, @periodo_ant, 30000.00, 30000.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'transferencia', NULL, 1),

  -- Joaquín · mes anterior con dos entregas parciales, mes actual impago
  (7, @periodo_ant, 32000.00, 15000.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'transferencia', 'Primera parte', 1),
  (7, @periodo_ant, 32000.00, 17000.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'efectivo', 'Saldo restante', 1),
  (7, @periodo_ant2, 32000.00, 32000.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'transferencia', NULL, 1);

-- ============================================================================
--  VISTA DE APOYO · Cuenta corriente resumida por período
-- ============================================================================
CREATE OR REPLACE VIEW vw_cuenta_corriente AS
SELECT
  u.id                         AS alumno_id,
  u.nombre                     AS alumno,
  p.periodo_mes,
  MAX(p.monto_total_tarifa)    AS tarifa,
  SUM(p.monto_abonado)         AS abonado,
  GREATEST(MAX(p.monto_total_tarifa) - SUM(p.monto_abonado), 0) AS saldo,
  COUNT(*)                     AS entregas,
  MAX(p.fecha_pago)            AS ultimo_pago
FROM usuarios u
INNER JOIN pagos p ON p.alumno_id = u.id
WHERE u.rol = 'alumno'
GROUP BY u.id, u.nombre, p.periodo_mes;

-- ============================================================================
--  CONSULTAS DE CONTROL RÁPIDAS
-- ============================================================================
-- SELECT u.nombre, u.estado_cuenta, u.tarifa_mensual FROM usuarios u WHERE u.rol='alumno';
-- SELECT * FROM rutinas_semanales WHERE fecha_inicio_semana = @lunes ORDER BY alumno_id, dia_semana, orden;
-- SELECT * FROM vw_cuenta_corriente ORDER BY alumno, periodo_mes DESC;
-- ============================================================================
