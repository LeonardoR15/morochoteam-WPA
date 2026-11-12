# 🏋️‍♂️ MorochoTeam — PWA de Gestión de Entrenamiento y Alumnos

**MorochoTeam** es una **Progressive Web App (PWA)** para digitalizar la gestión diaria de un personal trainer y sus alumnos: rutinas semanales, registro de pesos y repeticiones, biblioteca técnica de ejercicios, alertas de cuotas y cuenta corriente con entregas parciales.

Funciona en el celular como una app instalable y también en escritorio. El frontend es HTML/CSS/JS vanilla con Bootstrap 5.3; el backend es una API JSON en PHP 8 con PDO y MySQL/MariaDB.

---

## ✨ Características

### 👨‍🏫 Vista entrenador
- **Dashboard con alertas internas:** cuotas vencidas, saldos parciales y próximos vencimientos.
- **Listado de alumnos:** buscador por nombre, email o teléfono, filtro por estado de cuenta y semáforo visual.
- **Ficha del alumno en dos pestañas:**
  - **Cuenta corriente:** resumen de deuda, historial de pagos, alta de entregas parciales y eliminación de movimientos.
  - **Rutina semanal:** navegación por semanas, edición rápida de series/reps/peso/notas, reordenamiento y eliminación de ejercicios.
- **Clonar semana anterior:** copia completa de la rutina con opción de sobrescribir si la semana destino ya tiene datos.
- **Biblioteca de ejercicios:** búsqueda y filtro por grupo muscular, con modal de técnica.
- **Estados de cuenta:** Al día, Pago parcial y Vencido, calculados a partir de los períodos adeudados.

### 🏃 Vista alumno (mobile-first)
- **Rutina del día** con navegación por días y semanas y tarjetas de ejercicio colapsables: se abre el primer ejercicio pendiente y el flujo avanza solo al siguiente.
- **Registro de progreso:** peso y repeticiones con controles rápidos (±2,5 kg / ±1 rep), comentario y botón grande de completado con autoguardado vía Fetch.
- **Progreso dinámico** de la sesión y bloqueo de fechas futuras.
- **Ver técnica** en modal, con imagen de referencia y tips posturales.
- **Temporizador de descanso** de 30, 60, 90 y 120 segundos con alerta visual, vibración y beep.
- **Mi cuenta en modal:** acceso compacto desde el hero y la barra superior, con estado de cuota, saldos e historial de pagos plegable.
- **Modo offline del shell:** la interfaz queda cacheada; los datos de la API nunca se guardan en caché.

### 🎨 UX/UI y PWA
- Tema claro/oscuro automático (`prefers-color-scheme`) con selector manual persistente en `localStorage`.
- Tokens de marca en `variables.css`: acento `#CCFF00`, tipografías **Outfit** + **Inter**, colores semánticos.
- Manifest instalable, iconos normales y maskable, atajos de app, Service Worker y página `offline.html`.
- Accesibilidad básica: foco visible, etiquetas ARIA, mensajes de error y confirmaciones.

---

## 🛠️ Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | HTML5 semántico, CSS3 con Custom Properties, Bootstrap 5.3 (CDN), JavaScript vanilla ES6+ |
| Backend | PHP 8+, API JSON, PDO con consultas preparadas, sesiones PHP |
| Base de datos | MySQL 8 / MariaDB 10.4+ |
| PWA | Web App Manifest + Service Worker (cache-first para shell, network-only para API) |

**Requisitos:** PHP 8.0 o superior con `pdo_mysql` y `mbstring`; MySQL/MariaDB; Apache, Nginx o el servidor embebido de PHP.

---

## 📂 Estructura

```text
morochoteam-WPA/
├── index.html                  # Login por rol
├── trainer.html                # Panel del entrenador
├── alumno.html                 # Vista mobile-first del alumno
├── offline.html                # Fallback sin conexión
├── manifest.json               # Configuración PWA
├── sw.js                       # Service Worker
├── database.sql                # Esquema + datos demo
├── README.md
├── api/
│   ├── config.php              # Bootstrap, PDO, sesión, helpers y cuenta corriente
│   ├── auth.php                # login / logout / sesión actual
│   ├── alumnos.php             # listado, búsqueda y ficha del alumno
│   ├── alertas.php             # alertas de cuotas para el entrenador
│   ├── ejercicios.php          # biblioteca y detalle técnico
│   ├── rutinas.php             # CRUD semanal, reordenar y clonar
│   ├── registros.php           # upsert del progreso del alumno
│   ├── pagos.php               # entregas parciales y cuenta corriente
│   ├── rutina_hoy.php          # rutina del día del alumno autenticado
│   └── mi_cuenta.php           # estado de cuenta del alumno autenticado
└── assets/
    ├── css/
    │   ├── variables.css       # Tokens de marca y temas claro/oscuro
    │   └── styles.css          # Componentes, layout y responsive
    ├── js/
    │   ├── app.js              # API, formatos, toasts, PWA, utilidades
    │   ├── theme.js            # Control de tema y meta theme-color
    │   ├── login.js            # Login y redirección por rol
    │   ├── trainer.js          # Dashboard, alumnos, rutinas, pagos y biblioteca
    │   └── alumno.js           # Rutina, autoguardado, cuenta y temporizador
    └── img/
        ├── icon.svg
        ├── icon-192.png
        ├── icon-512.png
        ├── icon-maskable-512.png
        ├── apple-touch-icon.png
        ├── logo-morochoteam.png
        ├── logo-mark.png
        └── ejercicio-placeholder.svg
```

---

## 🚀 Instalación

### Opción A · XAMPP en Windows

1. Copiá el proyecto dentro de `C:\xampp\htdocs\morochoteam-WPA`.
2. Iniciá **Apache** y **MySQL** desde el Panel de Control de XAMPP.
3. Importá la base de datos:
   - **phpMyAdmin** → pestaña **Importar** → seleccioná `database.sql` → **Continuar**.
   - O por consola:
     ```powershell
     C:\xampp\mysql\bin\mysql.exe -u root < database.sql
     ```
4. Abrí `http://localhost/morochoteam-WPA/`.

### Opción B · Laragon

1. Copiá el proyecto en `C:\laragon\www\morochoteam-WPA`.
2. Iniciá Laragon y esperá a que MySQL esté en verde.
3. Importá `database.sql` desde phpMyAdmin, HeidiSQL o consola.
4. Abrí `http://morochoteam-wpa.test/` o `http://localhost/morochoteam-WPA/`.

### Opción C · Servidor embebido de PHP

Con MySQL ya iniciado:

```powershell
cd C:\ruta\al\proyecto
C:\xampp\php\php.exe -S localhost:8080
```

Abrí `http://localhost:8080/`. El servidor embebido sirve los archivos estáticos y la API; usalo solo para desarrollo.

### Configuración de base de datos

Los valores por defecto apuntan a XAMPP:

```text
host: 127.0.0.1
puerto: 3306
base: morochoteam
usuario: root
contraseña: (vacía)
```

Se pueden cambiar con variables de entorno leídas por `api/config.php`:

| Variable | Default | Descripción |
| --- | --- | --- |
| `MT_DB_HOST` | `127.0.0.1` | Host MySQL |
| `MT_DB_PORT` | `3306` | Puerto |
| `MT_DB_NAME` | `morochoteam` | Nombre de la base |
| `MT_DB_USER` | `root` | Usuario |
| `MT_DB_PASS` | *(vacío)* | Contraseña |
| `MT_DEBUG` | `1` en local / `0` en producción | `1` muestra detalle de errores (solo desarrollo) |

Ejemplo para una consola PowerShell antes de levantar el servidor:

```powershell
$env:MT_DB_USER = "morocho"
$env:MT_DB_PASS = "mi_clave_segura"
$env:MT_DB_NAME = "morochoteam"
C:\xampp\php\php.exe -S localhost:8080
```

En Apache/Laragon, definí las variables en el VirtualHost o en el entorno del servicio. Si usás la contraseña vacía de XAMPP no hace falta configurar nada.

> **Nota:** `database.sql` crea la base `morochoteam`, las tablas, la vista `vw_cuenta_corriente` y los datos demo. Podés volver a importarlo para reiniciar el entorno, pero elimina los datos existentes de esas tablas.

---

## 👤 Credenciales demo

Todos los usuarios usan la contraseña **`demo1234`**.

| Rol | Nombre | Email | Particularidad |
| --- | --- | --- | --- |
| Entrenador | Jorge Martinez | `trainer@morochoteam.com` | Acceso al panel completo |
| Alumno | Lucía Fernández | `lucia@demo.com` | Rutina completa de 7 días y registros de hoy |
| Alumno | Mateo Ramírez | `mateo@demo.com` | Solo semana anterior → probar **Clonar semana** |
| Alumno | Sofía Benítez | `sofia@demo.com` | Solo semana anterior → probar **Clonar semana** |
| Alumno | Tomás Aguirre | `tomas@demo.com` | Semana actual Lunes/Miércoles/Viernes |
| Alumno | Camila Ríos | `camila@demo.com` | Solo semana anterior → probar **Clonar semana** |
| Alumno | Joaquín Sosa | `joaquin@demo.com` | Solo semana anterior → probar **Clonar semana** |

### Recorrido sugerido

1. Entrá como **entrenador** y revisá el dashboard y las alertas de cuotas.
2. Abrí la ficha de **Mateo** → pestaña **Rutina semanal** → **Clonar semana anterior**.
3. En **Cuenta corriente**, registrá una entrega parcial y verificá el saldo y el semáforo.
4. Cerrá sesión y entrá como **Lucía** para probar la rutina del día, el autoguardado, el temporizador y la cuenta.
5. Instalá la PWA desde el botón de instalación del navegador y probá el modo offline.

---

## 🔌 API

Todas las respuestas son JSON. La API usa sesión PHP; el frontend envía `X-Requested-With: XMLHttpRequest` y, en POST, `Content-Type: application/json`. Los endpoints de entrenador exigen rol `entrenador`; los del alumno exigen sesión de alumno.

| Método | Endpoint | Descripción |
| --- | --- | --- |
| `GET` | `api/auth.php?action=me` | Sesión actual |
| `POST` | `api/auth.php?action=login` | `{ email, password }` |
| `POST` | `api/auth.php?action=logout` | Cerrar sesión |
| `GET` | `api/alumnos.php` | Listado con búsqueda (`q`) y filtro (`estado`) |
| `GET` | `api/alumnos.php?id=2` | Ficha completa + cuenta corriente |
| `GET` | `api/alertas.php` | Alertas de cuotas del entrenador |
| `GET` | `api/ejercicios.php` | Biblioteca; filtros `q`, `grupo`, `id` |
| `GET` | `api/rutinas.php?alumno_id=2&semana=YYYY-MM-DD` | Rutina semanal (normaliza al lunes) |
| `POST` | `api/rutinas.php?action=crear` | Agregar ejercicio a la rutina |
| `POST` | `api/rutinas.php?action=actualizar` | Editar ejercicio |
| `POST` | `api/rutinas.php?action=eliminar` | Eliminar ejercicio |
| `POST` | `api/rutinas.php?action=reordenar` | Reordenar ejercicios |
| `POST` | `api/rutinas.php?action=clonar` | Clonar semana (`409` si ya existe) |
| `GET` | `api/rutina_hoy.php?fecha=YYYY-MM-DD` | Rutina del día + registros + cuota |
| `POST` | `api/registros.php` | Upsert de peso, reps, completado y comentario |
| `GET` | `api/pagos.php?alumno_id=2` | Cuenta corriente e historial |
| `POST` | `api/pagos.php` | Registrar entrega parcial |
| `DELETE` | `api/pagos.php?id=5` | Eliminar una entrega |
| `GET` | `api/mi_cuenta.php` | Cuenta del alumno autenticado |

Ejemplo de login con `curl`:

```bash
curl -i -c cookies.txt -X POST "http://localhost:8080/api/auth.php?action=login" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"email":"trainer@morochoteam.com","password":"demo1234"}'
```

---

## 🧪 Pruebas y diagnóstico

Validar sintaxis PHP:

```powershell
Get-ChildItem api\*.php | ForEach-Object { & C:\xampp\php\php.exe -l $_.FullName }
```

Validar JavaScript con Node.js:

```powershell
node --check assets\js\app.js
node --check assets\js\theme.js
node --check assets\js\login.js
node --check assets\js\trainer.js
node --check assets\js\alumno.js
```

Comprobar la conexión a MySQL:

```powershell
C:\xampp\mysql\bin\mysql.exe -u root -e "USE morochoteam; SHOW TABLES;"
```

Si la API devuelve error de conexión, revisá que MySQL esté iniciado y que las credenciales coincidan con `api/config.php` / variables de entorno. Para ver el detalle del error en desarrollo, definí `MT_DEBUG=1`.

### Notas sobre la PWA

- El Service Worker requiere `http://localhost`, `http://127.0.0.1` o HTTPS; no funciona abriendo los HTML con `file://`.
- La primera visita guarda el shell. Las respuestas de `api/*` son **network-only** y nunca se cachean.
- Si cambiás CSS o JS y no ves los cambios, recargá con `Ctrl + F5` o desregistrá el Service Worker desde DevTools → Application.
- El manifest usa rutas relativas, por lo que la app funciona tanto en la raíz del dominio como en subcarpetas.

---

## 🔒 Consideraciones para producción

Este proyecto está pensado como entrega funcional/demostrativa. Antes de publicarlo:

- Cambiá las contraseñas demo y eliminá los usuarios de prueba.
- Usá un usuario MySQL con permisos mínimos (no `root`) y una contraseña fuerte.
- Serví siempre por **HTTPS** y configurá cookies de sesión `Secure` si el hosting lo permite.
- Desactivá `MT_DEBUG` y los mensajes de error detallados.
- Revisá la política de retención de datos de alumnos y pagos.
- Ajustá el `Content-Security-Policy` si el hosting lo requiere (Bootstrap y fuentes se cargan por CDN).

---

## 📄 Créditos

- Imágenes de ejercicios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) con fallback local.
- Tipografías: [Outfit](https://fonts.google.com/specimen/Outfit) e [Inter](https://fonts.google.com/specimen/Inter) vía Google Fonts.
- Iconografía: [Bootstrap Icons](https://icons.getbootstrap.com/).

**MorochoTeam** · Entrenamiento, progreso y cuentas en orden.
