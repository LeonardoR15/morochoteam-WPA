# 🏋️‍♂️ MorochoTeam — PWA de Gestión de Entrenamiento y Alumnos

**MorochoTeam** es una **Progressive Web App (PWA)** diseñada para digitalizar y optimizar la gestión diaria de un personal trainer y sus alumnos, reemplazando el tradicional cuaderno de entrenamiento por una plataforma ágil, multiplataforma y accesible tanto desde dispositivos móviles como desde computadora.

---

## 🚀 Características Principales

### 👨‍🏫 Vista Entrenador (Admin — Escritorio y Móvil)
* **Panel de Alertas Administrativas:** Notificaciones internas dentro de la aplicación sobre cuotas próximas a vencer, vencidas o con saldos parciales pendientes.
* **Gestión de Alumnos (CRM):** Alta/baja de alumnos, notas médicas o lesiones, objetivos y buscador rápido.
* **Constructor de Rutinas Semanales:** Organización de ejercicios por días de la semana con series, repeticiones y pesos objetivo. Incluye función para **clonar la semana anterior** y aplicar sobrecarga progresiva en segundos.
* **Control Financiero y Cuenta Corriente:**
  * Estado visual por semáforo: **Al día** (Verde), **Pago Parcial** (Amarillo) y **Vencido** (Rojo).
  * **Informe Detallado de Pagos:** Registro de entregas parciales por período, historial de movimientos, métodos de pago y cálculo automático de saldo restante.

### 🏃‍♂️ Vista Alumno (Mobile-First)
* **Acceso Directo a la Rutina del Día:** Interfaz limpia pensada para usar con una mano en el gimnasio.
* **Registro de Progreso en Tiempo Real:** Carga de pesos reales levantados, repeticiones ejecutadas, notas de sensaciones/molestias y marcado de ejercicios completados.
* **Biblioteca Visual de Ejercicios (Bajo Demanda):** Botón discreto **"Ver técnica"** junto a cada ejercicio para visualizar la ejecución correcta (GIF/video ligero) y tips posturales clave.
* **Temporizador de Descanso Integrado:** Cronómetro rápido (30s, 60s, 90s, 120s) con alerta visual y vibración al finalizar.
* **Estado de Cuenta Transparente:** Indicador sobrio en el perfil/cabecera con la fecha de vencimiento de la cuota o el detalle de saldo pendiente.

### 🎨 Experiencia de Usuario (UX/UI) & PWA
* **Dark Mode & Light Mode:** Detección automática de la preferencia del sistema (`prefers-color-scheme`) con selector manual persistente (`localStorage`).
* **Sistema de Diseño Modular:** Paleta de colores (con acento amarillo resaltador `#CCFF00`) y tipografías (`Outfit` + `Inter`) centralizadas en variables CSS (`variables.css`) para personalización instantánea.
* **Instalable y con Soporte Offline:** Configurada con `manifest.json` y `Service Worker` (`sw.js`) para instalarse en la pantalla de inicio del celular y operar en gimnasios con baja conectividad.

---

## 🛠️ Stack Tecnológico

* **Frontend:** HTML5, CSS3 (Custom Properties), JavaScript Vanilla (ES6+), Bootstrap 5.3.
* **PWA:** Web App Manifest (`manifest.json`) + Service Worker (`sw.js`).
* **Backend:** PHP 8+ (API REST en formato JSON, PDO con consultas preparadas).
* **Base de Datos:** MySQL / MariaDB.

---

## 📂 Estructura del Proyecto

```text
morochoteam-pwa/
├── index.html                  # Pantalla de inicio / Login por rol
├── trainer.html                # Panel de gestión del Personal Trainer
├── alumno.html                 # Vista Mobile-First de entrenamiento del Alumno
├── manifest.json               # Configuración de instalación PWA
├── sw.js                       # Service Worker (caché y soporte offline)
├── database.sql                # Esquema de base de datos y datos de prueba
├── api/
│   ├── config.php              # Conexión PDO a MySQL
│   ├── auth.php                # Autenticación y manejo de sesión
│   ├── alumnos.php             # CRUD de alumnos y estados
│   ├── rutinas.php             # Gestión y clonación de rutinas semanales
│   ├── registros.php           # Carga de pesos reales y ejercicios completados
│   ├── ejercicios.php          # Catálogo y guía técnica de ejercicios
│   └── pagos.php               # Registro de cuotas, entregas parciales e informes
└── assets/
    ├── css/
    │   ├── variables.css       # Variables de marca, tipografías y temas Dark/Light
    │   └── styles.css          # Estilos personalizados y componentes UI
    ├── js/
    │   ├── app.js              # Registro de Service Worker y utilidades globales
    │   ├── theme.js            # Controlador de Dark Mode / Light Mode
    │   ├── trainer.js          # Lógica del panel del entrenador
    │   └── alumno.js           # Lógica de rutina, cronómetro y carga de pesos
    └── img/
        └── logo-morochoteam.png
