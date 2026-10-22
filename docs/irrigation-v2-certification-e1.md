# R4F-E1 — PREFLIGHT DB REAL

Fecha: 2026-10-21. Ambiente autorizado: **riegar-mysql-dev / defaultdb**. Alcance: lectura real de destino/TLS/UTC/schema/tracking/inventarios, backup externo y reconciliación. **Sin migration, fixtures, DML/DDL de aplicación, cleanup, deploy, commit ni push. E2 no iniciado.**

Autoridades: R4F-B/C, checkpoints D1–D5 y código local. Este informe separa evidencia real actual, limitaciones y operaciones futuras. Ningún host, cuenta, contraseña, token, connection string o CA path se incluye en el reporte.

## 1. Destino

La configuración local identifica el servicio de desarrollo autorizado y database defaultdb; se validó su nombre antes de abrir conexión y se exigió CA/rejectUnauthorized=true, sin fallback insecure. Primera consulta de cada conexión propia: `SELECT DATABASE(), VERSION()`; resultado defaultdb/8.4.11. Identidad del endpoint respaldada además por el backup nativo con TLS VERIFY_IDENTITY. No se consultó ni modificó el control plane de Aiven.

Estado local: rama `feature/riego-surcos-v1`, HEAD `1f581dfc18f8e9ae18c3a88db1dd4c695a60d1ce`; cambios D1–D5 preservados. E1 añade solo este documento al repositorio. Los archivos de captura/backup quedan fuera de Git. Sin staging ni eliminaciones.

## 2. MySQL version

**8.4.11**, obtenido del servidor actual, coincide con lo esperado. Seis tablas de defaultdb, todas BASE TABLE/InnoDB: users, fincas, calculos, irrigation_simulations, knex_migrations y knex_migrations_lock. No views, triggers, routines o events encontrados en este schema.

## 3. TLS

Ejecutado el script existente `npm run check:db-tls`:

| Control | Resultado real |
| --- | --- |
| Database TLS | enabled |
| TLS version | TLSv1.3 |
| Cipher | TLS_AES_256_GCM_SHA384 |

Conexiones con CA y rejectUnauthorized=true. El dump nativo usó ssl-mode=VERIFY_IDENTITY y CA configurada. Sin errores DNS/TLS, cambio de configuración o aceptación de certificado inseguro.

## 4. UTC

Lectura real del servidor a 2026-10-21 12:51:07.330 UTC:

| Variable/comportamiento | Resultado |
| --- | --- |
| @@session.time_zone | SYSTEM |
| @@global.time_zone | SYSTEM |
| @@system_time_zone | UTC |
| NOW(3) | 2026-10-21 12:51:07.330 |
| UTC_TIMESTAMP(3) | 2026-10-21 12:51:07.330 |
| Diferencia observada | 0ms |
| Configuración driver de aplicación | timezone: Z |
| Tipo leído por driver normal | Date, serializado con Z |
| @@session.transaction_isolation | REPEATABLE-READ |

SYSTEM es coherente con UTC porque la zona del sistema observada es UTC; no se exige que la cadena sea literalmente +00:00. No se cambió la configuración de aplicación/global. El backup usó sus propias sesiones y política UTC del cliente; sus archivos no se ejecutaron contra el origen. DATETIME(3) y readback de snapshots con datos quedan para certificación posterior: hoy no hay filas de aplicación.

## 5. Migration tracking

Tracking real, ordenado por id; fechas UTC leídas por driver:

| id | Migration | batch | migration_time |
| --- | --- | --- | --- |
| 1 | 20251021033631_create_users_table.js | 1 | 2026-10-12T12:20:43.000Z |
| 2 | 20251112235501_create_fincas_table.js | 2 | 2026-10-12T12:21:00.000Z |
| 3 | 20251113003352_create_calculos_table.js | 3 | 2026-10-12T12:21:16.000Z |
| 4 | 20261012000000_create_irrigation_simulations.js | 4 | 2026-10-12T15:17:43.000Z |

knex_migrations_lock contiene una fila: index=1, is_locked=0. Sin migration V2 aplicada, entradas inesperadas o lock activo. No se ejecutó herramienta de migrations ni se editaron filas de tracking.

## 6. Schema actual

**38 columnas exactas**. Los nombres, tipos, nullability y extra se compararon automáticamente, en orden, con el SQL compilado de la migration histórica. Sin drift. Todas las columnas tienen COLUMN_DEFAULT NULL; en NOT NULL eso no implica un default NULL admisible de negocio. Únicas nullable: name y texture. id tiene AUTO_INCREMENT.

| Columna | Tipo SQL real | Nullable |
| --- | --- | --- |
| id | int unsigned | NO |
| finca_id | int unsigned | NO |
| name | varchar(255) | YES |
| eto_mm_per_day | double | NO |
| crop_coefficient | double | NO |
| days_without_irrigation | double | NO |
| texture | varchar(64) | YES |
| field_capacity_pct | double | NO |
| wilting_point_pct | double | NO |
| bulk_density_g_cm3 | double | NO |
| root_depth_m | double | NO |
| depletion_threshold_pct | double | NO |
| width_m | double | NO |
| length_m | double | NO |
| slope_pct | double | NO |
| flow_lps | double | NO |
| duration_min | double | NO |
| advance_time_min | double | NO |
| target_depth_mm | double | NO |
| available_water_mm | double | NO |
| available_capacity_l | double | NO |
| max_recommended_depth_mm | double | NO |
| max_recommended_volume_l | double | NO |
| applied_volume_l | double | NO |
| infiltrated_depth_start_mm | double | NO |
| infiltrated_depth_middle_mm | double | NO |
| infiltrated_depth_end_mm | double | NO |
| estimated_useful_volume_l | double | NO |
| residual_loss_volume_l | double | NO |
| application_efficiency_pct | double | NO |
| advance_ratio_pct | double | NO |
| max_non_erosive_flow_lps | double | NO |
| model_version | varchar(64) | NO |
| source_hash | char(64) | NO |
| contract_version | varchar(32) | NO |
| model_metadata | json | NO |
| diagnostics | json | NO |
| created_at | datetime(3) | NO |

PK: id, único, BTREE. Índice `irrigation_simulations_finca_created_id_idx`: no único, BTREE, columnas exactas finca_id/created_at/id en ese orden. FK `irrigation_simulations_finca_id_foreign`: finca_id→fincas.id, UPDATE RESTRICT y DELETE RESTRICT. No se modifica ningún objeto.

Engine InnoDB; charset utf8mb4, collation utf8mb4_0900_ai_ci. name/texture/model_version/contract_version usan esa collation. **source_hash usa ascii/ascii_bin**. created_at tiene precisión3; metadata/diagnostics son JSON reales. SHOW CREATE TABLE íntegro y AUTO_INCREMENT/definiciones originales están conservados en backup externo y fingerprint de schema.

## 7. CHECKs actuales

**10 CHECK, todos ENFORCED=YES**. Se leyeron expresiones completas de INFORMATION_SCHEMA y se compararon por nombre con las expresiones capturadas de `table.check` de la migration original. Se normalizaron únicamente presentación del servidor: paréntesis redundantes en estas conjunciones AND, backticks, whitespace/case y charset/escapes de literales JSON. Sin drift. Expresiones equivalentes normalizadas:

| Nombre | Expresión |
| --- | --- |
| irr_sim_crop_ck | eto_mm_per_day >= 0 AND crop_coefficient >= 0 AND days_without_irrigation >= 0 |
| irr_sim_soil_pct_ck | wilting_point_pct >= 0 AND field_capacity_pct > wilting_point_pct AND field_capacity_pct <= 100 AND depletion_threshold_pct > 0 AND depletion_threshold_pct <= 100 |
| irr_sim_soil_geometry_ck | bulk_density_g_cm3 > 0 AND root_depth_m > 0 |
| irr_sim_furrow_ck | width_m > 0 AND length_m > 0 AND slope_pct >= 0 |
| irr_sim_irrigation_ck | flow_lps > 0 AND duration_min > 0 AND advance_time_min >= 0 AND advance_time_min <= duration_min |
| irr_sim_output_depth_ck | target_depth_mm >= 0 AND available_water_mm > 0 AND max_recommended_depth_mm > 0 AND infiltrated_depth_start_mm >= 0 AND infiltrated_depth_middle_mm >= 0 AND infiltrated_depth_end_mm >= 0 |
| irr_sim_output_volume_ck | available_capacity_l > 0 AND max_recommended_volume_l > 0 AND applied_volume_l > 0 AND estimated_useful_volume_l >= 0 AND estimated_useful_volume_l <= applied_volume_l AND residual_loss_volume_l >= 0 |
| irr_sim_output_ratio_ck | application_efficiency_pct >= 0 AND application_efficiency_pct <= 100 AND advance_ratio_pct >= 0 AND advance_ratio_pct <= 100 AND max_non_erosive_flow_lps > 0 |
| irr_sim_json_ck | JSON_TYPE(model_metadata) = 'OBJECT' AND JSON_TYPE(diagnostics) = 'ARRAY' |
| irr_sim_hash_ck | CHAR_LENGTH(source_hash) = 64 |

Esto acredita definición/enforcement declarados actuales. E1 no intenta INSERT inválido para demostrar rechazo del servidor.

## 8. Extensiones V2 ausentes/presentes

**Cero extensiones V2 presentes**: furrow_count, daily_crop_water_use_mm_per_day, days_until_available_water_exhaustion, days_until_depletion_threshold, total_applied_volume_l y total_applied_volume_m3 ausentes.

**Cero CHECK V2 presentes**: irr_sim_version_pair_ck, irr_sim_v1_extension_ck, irr_sim_v2_extension_ck, irr_sim_v2_days_ck ausentes. Sin schema parcial detectado.

## 9. Inventario V1

COUNT irrigation_simulations=**0**. GROUP BY contract_version/model_version/source_hash devuelve cero grupos. No IDs ni created_at de snapshots que registrar. No se presume vacío por el antecedente R4D: se volvió a leer en esta fase y se reconciliaron counts al cierre.

## 10. Version/hash/metadata audit

Se seleccionaron únicamente id/fecha/versiones/source_hash/model_metadata/diagnostics para auditar provenance de todas las filas con el registry local, exigiendo ACTIVE_V1. Resultado: **0 revisadas, 0 mismatches** porque la tabla está vacía. El resultado no acredita un roundtrip de metadata, JSON o snapshots históricos con datos reales.

Expectativa auditada: irrigation-contract-v1 / irrigation-estimation-v1 / irrigation-metadata-v1 / irrigation-diagnostics-v1 / sourceHash `42592487e6e07deb1b25a073d74086a09c1bb19cb38411aafc31d28ea64d2127`. No corrección, backfill, borrado o reasignación de versiones. Cualquier fila incompatible en un preflight posterior obliga detenerse.

## 11. Fincas/Manning baseline

| Tabla | Filas iniciales | Filas reconciliadas |
| --- | --- | --- |
| users | 0 | 0 |
| fincas | 0 | 0 |
| calculos | 0 | 0 |
| irrigation_simulations | 0 | 0 |
| knex_migrations | 4 | 4 |
| knex_migrations_lock | 1 | 1 |

No payloads de usuarios/fincas/cálculos publicados. La reconciliación final a **2026-10-21 12:57:04.755 UTC** comprobó igualdad de schema y fingerprints de filas en las seis tablas respecto de la captura de backup. Sin cambios observados de datos o tracking.

## 12. Fingerprint pre-migration

Captura consistente READ ONLY/REPEATABLE-READ a **2026-10-21 12:54:10.358 UTC**. Para cada tabla se guardan nombres de columnas, rowCount, hash SHA-256 de SHOW CREATE TABLE y hash de filas ordenadas por PK. JSON de fingerprint con keys de objetos ordenadas recursivamente, UTF-8, fechas como strings con driver timezone Z; manifest conserva algoritmo y claves/fingerprints individuales. IDs de simulaciones: `[]`.

Fingerprint de filas irrigation_simulations, SHA-256 de `[]`:

`4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`

Fingerprint SHOW CREATE TABLE irrigation_simulations:

`58ef6588b6ed62d687ddc7f354bc6ba72a42e1cf877d8c40f21b55f3e639a37a`

Fingerprints de tracking:

- knex_migrations filas: `b438f6371ee20c40109fb36e765b1e2a7e7bf2dd36921b2fb234f9018984f304`.
- knex_migrations_lock filas: `12da2219f9783addaea36d86a10bc324376b2b0d56c097cd57087f6200856c76`.

Manifest completo y utilidades reproducibles quedan junto al backup fuera del repo. Los seis schema/row fingerprints se volvieron a calcular en otra conexión y coincidieron. Las capturas detectan diferencias observadas, no garantizan ausencia de writers/DDL futuros ni constituyen un lock global.

## 13. Backup

Backup autorizado obtenido por lectura del origen y escritura a archivos locales externos. Directorio: `C:/Users/aguer/.codex/private-backups/riegar/20261021-e1/`, fuera del workspace/Git. ACL Windows sin herencia, acceso explícito solo a la cuenta actual y SYSTEM. No se agregó dump a Git ni se publicaron datos/credenciales.

**Backup principal estándar**:

| Propiedad | Evidencia |
| --- | --- |
| Archivo | defaultdb-mysqldump-pre-v2.sql |
| Método | mysqldump Community8.0.46 Windows, servidor8.4.11 |
| Consistencia | single-transaction, sin locks de tablas del origen |
| TLS | VERIFY_IDENTITY + CA configurada |
| Alcance | seis tablas, datos y tracking; opciones routines/events/triggers incluidas (inventario=0) |
| Otras opciones | no-tablespaces, set-gtid-purged=OFF, column-statistics=0, hex-blob |
| Finalización | 2026-10-21T12:56:08.745Z |
| Resultado | exit0, sin advertencias |
| Tamaño | 9551 bytes |
| SHA-256 | b7f13068db8e5151c3d5c2a954144f0e08967506804ce4f8ce5b7e2643d605a6 |

Verificación offline posterior: lectura completa/checksum coincidente, seis CREATE TABLE, INSERT únicamente de knex_migrations y knex_migrations_lock, sin USE del schema origen ni asignaciones de credenciales/host/CA en el dump. Archivo temporal de opciones del cliente dentro del directorio protegido eliminado en finally; no contraseña en línea de comandos ni archivo temporal remanente. El dump puede incluir DDL de restauración estándar: **nunca ejecutarlo sobre el origen**.

**Captura lógica adicional/fingerprints**: defaultdb-pre-v2.sql,6399 bytes, SHA-256 `4ed11c80e24ee91ecb96b8db485dc056982126e57b2dac1bc6c2121f03aa106a`. Generada por utilidad local de lectura, con SHOW CREATE TABLE y SELECT ordenado de las seis tablas dentro de transacción READ ONLY/consistent snapshot. Verifica DDL al inicio/final de captura y conserva filas de tracking. No se ejecuta el SQL generado. manifest.json describe algoritmo, row/schema hashes y orden de tablas; native-backup-manifest.json acredita dump estándar.

Es backup lógico de defaultdb, no backup del servicio Aiven completo, cuentas/grants globales, configuración de infraestructura ni una prueba de restore. La lectura consistente InnoDB no bloquea writers externos ni protege por sí sola contra DDL concurrente; los fingerprints/ausencia de drift observados delimitan la evidencia.

## 14. Restore evidence

**Restore NO ejecutado. El usuario confirmó que actualmente no existe un clon o ambiente aislado autorizado para probarlo y pidió dejarlo pendiente.** Ninguna restauración sobre origen ni creación de DB/clon. Esta confirmación identifica la limitación; no acredita recuperabilidad ni autoriza un destino nuevo.

Evidencia disponible: dump estándar con exit0/sin warnings, checksum de readback, seis tablas esperadas, filas de tracking y captura alternativa/fingerprints. Es evidencia de archivo legible y contenido previsto, **no de restauración probada** ni garantía completa de compatibilidad cliente8.0/servidor8.4 al restaurar.

Procedimiento previsto, pendiente de autorización concreta:

1. Identificar un destino aislado, vacío, compatible con MySQL8.4, con TLS y permisos aprobados. Verificar separadamente identidad del destino y que no sea el origen; no usar credenciales del origen por inercia.
2. Verificar SHA-256 del dump antes de usarlo. Preparar cliente UTC/utf8mb4 y registrar usuario/destino de forma sanitizada. No publicar dump o secretos.
3. Restaurar allí el SQL completo con cliente autorizado, capturando status/errores sanitizados; nada de replay/overwrite automático ante error parcial.
4. Validar las seis tablas,38 columnas/10 CHECK del riego, FK/índices/charset/precision y AUTO_INCREMENT según backup; comparar counts y fingerprints de datos con manifest (metadata de schema normalizada solo cuando haya diferencia de presentación del servidor).
5. Verificar cuatro migrations, batches/orden y lock=0, y documentar resultado real. No llamar restore PASS con solo contar tablas. La eliminación del clon es una operación posterior que también necesita autorización.

Recuperabilidad real queda pendiente de esa ejecución y evidencia. No se relaja la precondición de recuperación del diseño C para la futura migration.

## 15. Writers

Cuenta con visibilidad PROCESS. Dos observaciones reales muestran solo un thread Daemon distinto de la conexión de auditoría; cero sesiones de aplicación visibles. INNODB_TRX=0 en la observación correspondiente. No se leyeron/publicaron textos SQL, hosts o usuarios de otros procesos.

Inventario local de procesos node.exe: cuatro procesos sin referencia explícita a riegar-backend o server.js en sus comandos. Esto **no identifica todos los posibles writers externos ni demuestra inactividad permanente**. No se detuvo ningún proceso o servicio.

Confirmación posterior del usuario: **no hay otro backend, job o servicio externo conocido escribiendo en riegar-mysql-dev; el acceso previsto es desde el backend local de RiegAR.** Para E2 se detendrá el backend/proceso que pueda escribir y se verificará que no existan sesiones activas de aplicación antes de aplicar la migration.

**Inventario declarado y plan de control de writers documentados; ventana todavía no ejecutada ni verificada.** Cuando E2 se autorice, identificar el proceso local concreto, realizar su detención dentro de ese alcance, drenar transacciones, verificar conexiones/INNODB_TRX y mantener la exclusión durante preflight/backup final/DDL/reconciliación. Revalidar que no apareció otro consumidor. Un is_locked=0 de Knex o una consulta PROCESSLIST vacía no garantiza por sí sola toda la ventana. No se detiene ningún proceso como consecuencia de esta respuesta ni se inicia E2.

## 16. Permisos

SHOW GRANTS de la cuenta autorizada, inspeccionado sin publicar cuenta/grants textuales. Para ámbito global/defaultdb se identificaron SELECT, ALTER, CREATE, DROP y PROCESS: todos disponibles. No se ejerció ningún permiso DDL/DML.

Para agregar/eliminar CHECK mediante ALTER TABLE aplica privilegio ALTER; no existe un grant separado CREATE CONSTRAINT/DROP CONSTRAINT que sea necesario inventar. Los permisos declarados son suficientes para las operaciones de schema previstas, sujetos a condiciones reales de servidor/locks que se validarán en fase autorizada. Backup estándar se completó con los permisos actuales.

## 17. Migration preflight

Se ejecutó exclusivamente la lectura del preflight real de `20261014000000_extend_irrigation_simulations_v2.js` usando adapter que permite su SELECT y sustituye schema.alterTable por un interceptor que lanza una excepción controlada **antes de construir o enviar DDL**. Resultado: lectura PASS, primer intento de DDL interceptado, **DDL ejecutado=false**. No se llamó Knex migration runner ni se actualizó tracking.

Precondiciones satisfechas en la observación:38 columnas,10 CHECK,0 extensiones,0 CHECK V2. Además, auditoría E1 amplía ese control mínimo comparando las38 definiciones y10 expresiones, FK/índices/charset/JSON/fecha. El preflight no bloquea writers ni acredita backup/restore; no debe usarse como permiso implícito de UP.

## 18. Regresión local

Una sola corrida al cierre: **npm test:251 PASS /0 FAIL**, cero cancelled/skipped/todo; duración1935.1534ms. Sin tests E1 nuevos ni cambios de código/dependencias. La suite usa mocks/loopback; la evidencia DB real anterior es separada.

Freeze SHA-256 V1 comprobado otra vez:

| Archivo bajo src/services/irrigation/ | SHA-256 |
| --- | --- |
| irrigation-models.js | 6a1302569db4bd5902fb02d9ab08b6b131cd8bb155e510766dfff3937464afe8 |
| irrigation-validation.js | 7353589ce6810764085cbf9a1badb59e3458b8231e1a8acacae1ad1ed4b235a7 |
| irrigation-calculator.service.js | b2c785847f4962be991fb72a0986b9e5f2f8f1d8063e2a99cda2579f11ff1380 |

Los75 archivos preexistentes conservan su contenido; solo se agrega este informe al workspace. git diff --check PASS; whitespace del nuevo documento revisado aparte.

## 19. Riesgos

- Writers: usuario declara solo acceso local conocido y define detención/verificación para E2; falta ejecutar y acreditar la ventana efectiva, aunque las observaciones previas no muestren sesiones de aplicación.
- Restore aislado sin ejecutar; backup acreditado como artefacto lógico, recuperabilidad real todavía no probada.
- Tabla de riego vacía: no evidencia E1 de roundtrip con snapshots reales, V1/V2 mixtos, count MAX_SAFE o null days. No se crearon fixtures para llenar ese vacío.
- Preflight y backups describen instantes; revalidar destino/TLS/UTC/tracking/schema/filas/backup/writers antes de E2. DDL MySQL puede autocommit y una interrupción puede dejar schema parcial.
- No desplegar puente D4 sobre schema actual V1: HISTORY ya requiere columnas V2. No activar composición final públicamente ni coordinar corte R5 desde E1.
- Sin INSERT de prueba ni ALTER; permisos/enforcement declarados y SQL offline no sustituyen la futura certificación efectiva de constraints, tipos, locks o rollback.

## 20. GO / NO-GO para E2

**NO-GO operativo para aplicar migration en este cierre.**

| Criterio | Estado |
| --- | --- |
| Destino correcto | PASS |
| MySQL/TLS/UTC | PASS |
| Tracking/lock | PASS |
| Schema V1 y10 CHECK completos | PASS |
| Ausencia de schema parcial V2 | PASS |
| Filas soportadas | PASS vacío:0 filas, no roundtrip |
| Backup obtenido y checksum | PASS |
| Permisos suficientes por grants | PASS |
| Writers controlables/ventana garantizada | Plan confirmado por usuario; detención y verificación efectiva pendientes para E2 |
| Restore aislado/recuperabilidad real | PENDIENTE: usuario confirma que no existe ambiente aislado autorizado |

Preflight técnico conforme, sin drift detectado. La respuesta del usuario cierra la identificación declarada de writers y su plan, sin convertirlo en una ventana ya ejecutada. Para reconsiderar GO se necesita acreditar el control efectivo y completar la evidencia de recuperación requerida antes de DDL; luego renovar preflight/backup según ventana. La ausencia confirmada de clon deja restore pendiente. E1 y estas aclaraciones no autorizan por sí mismos E2.

**Detenerse: no aplicar migration, insertar fixtures, modificar datos, iniciar E2, desplegar, hacer commit o push.**
