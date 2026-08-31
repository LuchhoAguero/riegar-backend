# RiegAR backend

Backend de RiegAR basado en Node.js, Express, MySQL y Knex.

## Requisitos

- Node.js 18 o posterior
- Una base de datos MySQL ya migrada

## Configuración local

1. Instalar dependencias con `npm ci` (o `npm install`).
2. Copiar `.env.example` a `.env` y completar las variables requeridas.
3. Iniciar el servidor con `npm start`.

Se requieren `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`,
`JWT_SECRET`, `EMAIL_USER`, `EMAIL_PASS` y `CORS_ORIGIN`. Railway también
puede proporcionar la configuración de MySQL mediante `MYSQLHOST`, `MYSQLPORT`,
`MYSQLUSER`, `MYSQLPASSWORD` y `MYSQLDATABASE`.

El endpoint `GET /api/health` responde `{ "status": "ok" }` sin consultar la
base de datos.
