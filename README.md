# VIKOTECH Grade Core - Plataforma de Evaluación 

![Status](https://img.shields.io/badge/Status-Beta-orange)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![Stack](https://img.shields.io/badge/Stack-FastAPI_%7C_React_%7C_SQLModel-green)

**VIKOTECH Grade Core** es un ecosistema integral para la gestión académica, diseñado para centralizar el control de calificaciones, la administración de cursos y el seguimiento del rendimiento estudiantil en entornos educativos modernos.

---

##  Funcionalidades Principales

###  Gestión de Roles (RBAC)
*   **Administrador**: Control total sobre usuarios (profesores/estudiantes), creación de cursos, grupos, grados académicos y periodos.
*   **Profesor**: Gestión de criterios de evaluación, registro de calificaciones para sus cursos asignados y generación de reportes.
*   **Estudiante**: Consulta de historial de calificaciones y progreso académico en tiempo real.

###  Sistema de Evaluación Inteligente
*   **Criterios Dinámicos**: Configuración de porcentajes y pesos por periodo (ej. 1° Parcial, 2° Parcial, Final).
*   **Cálculo Automático**: Algoritmos internos para determinar promedios basados en pesos de criterios y periodos.
*   **Importación Masiva**: Carga de estudiantes y datos mediante archivos CSV.
*   **Auditoría de Calificaciones**: Registro de cambios para garantizar la integridad de los datos.

###  Reportes y Analíticas
*   **Generación de PDFs**: Creación automática de boletas y reportes de rendimiento utilizando `reportlab`.
*   **Dashboard Visual**: Interfaz intuitiva con indicadores de progreso.

---

## 🛠️ Stack Tecnológico

### Backend
*   **FastAPI**: Framework de alto rendimiento para la API.
*   **SQLModel**: ORM moderno que combina SQLAlchemy y Pydantic.
*   **SQLite**: Base de datos relacional para persistencia local.
*   **ReportLab**: Motor de generación de documentos PDF.

### Frontend
*   **React + Vite**: Interfaz de usuario rápida y reactiva.
*   **TypeScript**: Tipado estático para un desarrollo robusto.
*   **Tailwind CSS**: Estilizado moderno y responsivo.
*   **Lucide Icons**: Set de iconos profesionales.

---

##  Estructura del Proyecto
```text
grade-platform/
├── backend/            # Lógica de servidor, modelos y base de datos
│   ├── main.py         # Punto de entrada de la API
│   ├── models.py       # Definición de esquemas SQLModel
│   └── database.py     # Configuración de la conexión DB
├── frontend/           # Aplicación cliente (React)
│   ├── src/components/ # Componentes de UI (Admin, Teacher, Student dashboards)
│   └── src/pages/      # Páginas principales (Login)
└── README.md
```

---

##  Instalación y Ejecución

### Backend
1. Navegar a `/backend`.
2. Crear un entorno virtual: `python -m venv venv`.
3. Instalar dependencias: `pip install -r requirements.txt`.
4. Ejecutar: `uvicorn main:app --reload`.

### Frontend
1. Navegar a `/frontend`.
2. Instalar dependencias: `npm install`.
3. Ejecutar: `npm run dev`.

---
**Desarrollado por:** Marcos Hernández
**Tecnología:** VIKOTECH Solutions
