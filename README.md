# RiegAR Backend

API de RiegAR con Node.js, Express, Knex y MySQL. La base de datos activa usa Aiven MySQL.

## Requisitos

- Node.js 20 o posterior (Nodemailer 10 requiere Node.js 20 o posterior) y npm.
- Acceso a una base MySQL con las tres migraciones existentes aplicadas.
- Para Aiven, el certificado CA descargado del servicio y disponible como archivo local.

## Instalación y configuración

```bash
npm ci
```

Copiar `.env.example` a `.env` y completar los valores según el entorno. `.env` y los certificados son locales y no se versionan.

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto HTTP; si falta, usa `4000`. |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión MySQL. |
| `DB_SSL` | `true` para Aiven con TLS; `false` para MySQL local sin TLS. |
| `DB_SSL_CA_PATH` | Ruta al archivo CA de Aiven; obligatoria cuando `DB_SSL=true`. |
| `JWT_SECRET` | Clave de firma de JWT. |
| `EMAIL_USER`, `EMAIL_PASS` | Cuenta Gmail utilizada por `POST /api/contact`. |
| `CORS_ORIGIN` | Orígenes permitidos separados por comas, por ejemplo `http://localhost:5173,http://127.0.0.1:5173`. |

La conexión activa es a **Aiven MySQL**. Configurar sus datos en `DB_*`, poner `DB_SSL=true` y apuntar `DB_SSL_CA_PATH` al CA descargado de Aiven. El backend lee ese archivo y valida el certificado del servidor con `rejectUnauthorized: true`. El CA no debe estar en Git ni en `.env.example`. `DB_SSL=false` permite desarrollo con MySQL local sin TLS. Las variables `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD` y `MYSQLDATABASE` siguen disponibles como alternativa histórica de Railway.

## Ejecución y comprobaciones

```bash
npm start
```

`GET /api/health` devuelve `{ "status": "ok" }` sin consultar MySQL.

Con la configuración de Aiven cargada, verificar la sesión MySQL:

```bash
npm run check:db-tls
```

El comando muestra si TLS está activo, su versión y el cifrado, y falla si `DB_SSL=true` pero la sesión no usa TLS. No imprime credenciales ni el contenido del CA.

## Migraciones Knex

```bash
npx knex migrate:status --env development
npx knex migrate:latest --env development
```

`knexfile.js` usa la misma configuración de conexión para `development` y `production`. Seleccionar el entorno correcto antes de ejecutar comandos Knex. **No ejecutar migraciones destructivas ni rollbacks sobre datos importantes sin un backup verificado.**
