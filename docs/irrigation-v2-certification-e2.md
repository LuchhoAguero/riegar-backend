# R4F-E2 — SCHEMA V2 REAL

Fecha: 2026-10-21. Entorno exclusivo: **riegar-mysql-dev / defaultdb**. E1 fue aprobado externamente y el usuario autorizó UP y una batería SQL mínima con rollback. La falta de restore en clon se acepta expresamente como limitación no bloqueante para este desarrollo vacío; **no se afirma restore probado**.

Resultado: migration oficial aplicada una vez, schema V2 real verificado, batería SQL final14/14 conforme, cero fixtures persistidos y251 tests locales PASS. No se inicia E3, HTTP real, puente público, frontend, deploy, down, commit o push. Ninguna modificación al código de aplicación/migrations para acomodar MySQL.

## 1. Writers

Se identificaron los procesos node.exe locales: únicamente tooling Codex/MCP, sin referencia a backend RiegAR/server/nodemon y sin conexiones TCP establecidas o de escucha en la observación. Ningún proceso backend que detener; no se mataron procesos no identificados. Se mantiene la declaración del usuario de que no existen otros writers externos conocidos y el acceso previsto es local.

PROCESSLIST real: solo conexiones propias de certificación y un Daemon identificado como event_scheduler. Cero sesiones desconocidas/de aplicación y cero transacciones ajenas. Se revalidó antes del UP, inmediatamente antes del llamado Knex, después del UP, antes de la batería y al reconciliar al cierre. La pool Knex registra sus thread IDs para distinguir conexiones propias, sin ignorar otros clientes por nombre ambiguo.

Evidencia de ventana: observación pre-UP a13:35:30.019Z y posterior a13:35:49.241Z sin writers ajenos; reconciliación final iniciada13:41:20.997Z, también sin sesiones ajenas/transacciones activas. No se arrancó el backend durante esta ventana. Es exclusión operativa del único acceso conocido más observaciones del servidor, no un lock global capaz de impedir que un administrador externo inicie una conexión futura.

## 2. Destino/TLS

Guardas de configuración exigen servicio de desarrollo autorizado, defaultdb, timezone Z, CA y rejectUnauthorized=true. En cada conexión nueva propia se verificó primero DATABASE()/VERSION(): **defaultdb /8.4.11**. No host, usuario, contraseña, connection string o CA path publicados.

TLS real antes y al cierre: **TLSv1.3 / TLS_AES_256_GCM_SHA384**, certificado verificado, sin fallback insecure. UTC renovado: session/global SYSTEM, system UTC y NOW−UTC_TIMESTAMP=0 segundos. Sin cambios de configuración global o de aplicación.

## 3. Tracking pre-UP

Cuatro migrations aplicadas y batches normales1–4:

| id/batch | Nombre |
| --- | --- |
| 1 | 20251021033631_create_users_table.js |
| 2 | 20251112235501_create_fincas_table.js |
| 3 | 20251113003352_create_calculos_table.js |
| 4 | 20261012000000_create_irrigation_simulations.js |

knex_migrations_lock: una fila, index1/is_locked0. Comparación de nombres locales contra tracking y luego `knex.migrate.list()`: **una única pendiente**, `20261014000000_extend_irrigation_simulations_v2.js`. Sin migrations desconocidas, duplicadas u otras pendientes. Sin edición manual de tracking.

## 4. Schema pre-UP

Revalidación real: **38 columnas,10 CHECK ENFORCED,0 extensiones y0 CHECK V2**. FK e índice esperados presentes; cuatro tablas de aplicación con counts0. Schema y fingerprints de filas de las seis tablas se compararon contra manifest E1: todos idénticos, incluyendo definiciones completas de tabla/constraints y tracking.

Esto renueva la evidencia E1 en lugar de asumir que seguía vigente. Ante drift, writer o datos no vacíos el harness hubiera detenido el paso antes de DDL.

## 5. Backup/fingerprint

Se reutilizó el backup E1 conforme a la autorización expresa para DB vacía bajo ventana sin writers. No se borró ni sobrescribió. Revalidados presencia, bytes y SHA-256 inmediatamente en el preflight de UP:

- Archivo externo: `C:/Users/aguer/.codex/private-backups/riegar/20261021-e1/defaultdb-mysqldump-pre-v2.sql`.
- Tamaño:9551 bytes.
- SHA-256: `b7f13068db8e5151c3d5c2a954144f0e08967506804ce4f8ce5b7e2643d605a6`.
- Captura original:2026-10-21T12:56:08.745Z, mysqldump single-transaction/TLS VERIFY_IDENTITY, exit0, sin warnings.

Fingerprint renovado pre-UP de irrigation_simulations: schema `58ef6588b6ed62d687ddc7f354bc6ba72a42e1cf877d8c40f21b55f3e639a37a`; filas vacías `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`. Coincide con E1. Las seis tablas coinciden con el backup lógico complementario/manifest E1. No se generó otro dump por no existir drift y estar expresamente permitido reutilizar el anterior.

Evidencia E2 y utilidades fuera de Git en `C:/Users/aguer/.codex/private-backups/riegar/20261021-e2/`, con ACL sin herencia para cuenta local/SYSTEM. No se adjuntan dumps/credenciales al repo. Restore en clon sigue pendiente y no fue probado.

## 6. Migration ejecutada

Únicamente **20261014000000_extend_irrigation_simulations_v2.js**, por API normal Knex del proyecto: `knex.migrate.up({ name: ... })` usando createKnexConfig. No ALTER equivalente manual, migrate:latest indiscriminado, down o cambios al archivo oficial.

| Evento | UTC |
| --- | --- |
| Inicio llamado UP | 2026-10-21T13:35:38.803Z |
| Fin retorno Knex | 2026-10-21T13:35:43.034Z |
| Fin verificación post-UP | 2026-10-21T13:35:49.242Z |

Resultado Knex: batch5, lista con ese único archivo, sin warnings/errores. Un marcador local de intento se escribió antes del llamado para impedir una segunda aplicación accidental tras resultado ambiguo. **Una ejecución, sin retry de migration ni reparación de tracking.** Se respeta config.transaction=false y el autocommit DDL de MySQL.

## 7. Tracking post-UP

**Cinco migrations**, las cuatro previas intactas más:

| id | Nombre | batch | migration_time UTC |
| --- | --- | --- | --- |
| 5 | 20261014000000_extend_irrigation_simulations_v2.js | 5 | 2026-10-21 13:35:43 |

Lock index1/is_locked0 al terminar y al cierre. Sin duplicados. El cambio de cuatro a cinco filas es el cambio autorizado normal de Knex; no una modificación manual. Fingerprint de filas knex_migrations post-UP/final: `a4451dbc7ce4baaa57393c502a5d269219f6307096fe09fa489a7941f9a3b0af`. Lock mantiene fingerprint `12da2219f9783addaea36d86a10bc324376b2b0d56c097cd57087f6200856c76`.

## 8. 44 columnas

Lectura real: **44 columnas**. Primeras38 definiciones completas idénticas a pre-UP. Exactamente estas seis nuevas, todas con IS_NULLABLE=YES, COLUMN_DEFAULT=NULL y sin extra/default de negocio:

| Columna | Tipo SQL real |
| --- | --- |
| furrow_count | bigint unsigned |
| daily_crop_water_use_mm_per_day | double |
| days_until_available_water_exhaustion | double |
| days_until_depletion_threshold | double |
| total_applied_volume_l | double |
| total_applied_volume_m3 | double |

No furrow_spacing_m, rename, columnas extra, escala decimal, backfill o defaults0/1/18.

## 9. 14 CHECK

**14 CHECK reales, todos ENFORCED=YES**. Los diez históricos conservan nombre/expresión/enforcement exactamente iguales a pre-UP. Se leyeron las cuatro expresiones nuevas completas de INFORMATION_SCHEMA y se compararon con las capturadas al compilar la migration D3.

Comparación mediante árboles booleanos: preserva precedencia AND/OR, aplana asociaciones equivalentes e ignora paréntesis redundantes, backticks, charset de literales y diferencias de presentación de CAST. MySQL8.4 renderiza `CAST(x AS BINARY)` como `cast(x as char charset binary)`; no se trata de una conversión a texto con collation case-insensitive. **Las cuatro comparaciones PASS**, registradas en check-comparison.json; expresiones completas reales en post-up.json fuera de Git.

Para describirlas, C1/C2 son aliases documentales de los pairs completos binarios V1/V1 y V2/V2, no columnas SQL:

| CHECK | Expresión lógica equivalente a la real |
| --- | --- |
| irr_sim_version_pair_ck | contract/model explícitamente noNULL y (C1 OR C2) |
| irr_sim_v1_extension_ck | C2 OR (C1 AND las seis extensiones IS NULL) |
| irr_sim_v2_extension_ck | C1 OR (C2 AND count presente1..9007199254740991 AND daily presente>=0 AND ambos totales presentes>0) |
| irr_sim_v2_days_ck | C1 OR (C2 AND daily presente AND ((daily=0 AND días NULL/NULL) OR (daily>0 AND dos días presentes>0))) |

Sin CHECK de igualdad DOUBLE, sourceHash por versión o JSON profundo. JSON/hash históricos intactos. No se deshabilitó constraint alguno.

## 10. Objetos V1 preservados

Comparados pre/post:38 columnas originales, PK id, atributo AUTO_INCREMENT, FK finca_id→fincas.id RESTRICT/RESTRICT, índice BTREE(finca_id,created_at,id), JSON metadata/diagnostics, DATETIME(3), source_hash CHAR(64) ascii/ascii_bin, engine InnoDB y utf8mb4_0900_ai_ci intactos. Diez CHECK originales idénticos. Usuarios/fincas/cálculos y tracking no recibieron ALTER de aplicación.

La comprobación inmediata post-UP también conservó el valor de próximo id observado. Los INSERT de prueba posteriores asignan IDs que **pueden consumir secuencia aunque haya rollback**: no se resetean contadores ni se promete ausencia de huecos. Preservar AUTO_INCREMENT aquí acredita atributo/comportamiento, no devolver la secuencia al punto previo a los tests.

## 11. CHECK enforcement real

Batería definitiva: **14/14 resultados esperados**, cuatro aceptados dentro de transacción y diez rechazados con ER_CHECK_CONSTRAINT_VIOLATED/errno3819. No se ejecuta HTTP; las filas base completas se construyen desde modelos/mappers locales coherentes y las mutaciones se envían directamente a SQL para probar dominios.

| Caso | Esperado/real | Primer CHECK reportado al rechazar |
| --- | --- | --- |
| 1. V1 válido, seis NULL | aceptado | — |
| 2. V1 count noNULL | rechazado3819 | irr_sim_v1_extension_ck |
| 3. V2 normal | aceptado | — |
| 4. V2 count NULL | rechazado3819 | irr_sim_v2_extension_ck |
| 5. V2 count0 | rechazado3819 | irr_sim_v2_extension_ck |
| 6. V2 count9007199254740992 | rechazado3819 | irr_sim_v2_extension_ck |
| 7. V2 daily0, días NULL/NULL | aceptado | — |
| 8. V2 daily0, un día numérico | rechazado3819 | irr_sim_v2_days_ck |
| 9. V2 dailypositivo, ambos días NULL | rechazado3819 | irr_sim_v2_days_ck |
| 10. V2 totalL0 | rechazado3819 | irr_sim_v2_extension_ck |
| 11. ContractV1/modelV2 | rechazado3819 | irr_sim_v1_extension_ck |
| 12. Pair con case alterado | rechazado3819 | irr_sim_v1_extension_ck |
| 13. V2 count MAX_SAFE válido | aceptado | — |
| 14. Pair con espacio final | rechazado3819 | irr_sim_v1_extension_ck |

Casos13/14 refuerzan el borde BIGINT y exactitud binaria con dos casos puntuales, sin iniciar la batería completa de E3. Cada caso usa su propio savepoint; rollback/release del savepoint siempre, y COUNT simulaciones=0 dentro de la transacción tras cada caso.

Incidencia del harness, preservada y resuelta sin cambiar implementación: la primera tanda aceptó V1 y se detuvo al clasificar el siguiente rechazo porque su regex de nombre CHECK omitía dígitos (`v1`). Se informó, hizo rollback completo y se inspeccionaron de nuevo schema44/checks14/tracking5/lock0/counts0. Se reprodujo el bug del patrón offline y se corrigió solo la utilidad privada a incluir0–9; luego se ejecutó explícitamente la tanda definitiva bajo nueva transacción. La evidencia incompleta original se conserva separada en enforcement.json; no se usa para acreditar casos faltantes. No hubo fallo/timeout ambiguo de UP, retry de migration o reenvío automático de un INSERT incierto.

## 12. Pair binary enforcement

Tabla con collation textual utf8mb4_0900_ai_ci; expresiones reales de pairs usan CAST binario. Además de las14 pruebas, el servidor evaluó **la expresión real de irr_sim_version_pair_ck** sobre cinco probes: V1/V1→1, V2/V2→1, cruzado→0, uppercase→0 y espacio final→0.

Los INSERT de pairs inválidos fueron rechazados realmente con3819. MySQL reportó primero irr_sim_v1_extension_ck porque las restricciones de extensión también repiten el pair cerrado. Por tanto, no se atribuye falsamente ese error al CHECK de pair ni se afirma haberlo aislado físicamente: se acredita rechazo binario del conjunto, definición/enforcement del CHECK de pair y evaluación real de su predicado. No se deshabilitaron los CHECK redundantes para forzar otro nombre de error.

## 13. BIGINT schema boundary

Tipo real BIGINT UNSIGNED, máximo contractual literal9007199254740991 en CHECK. MAX_SAFE se aceptó;9007199254740992,0 yNULL se rechazaron en el CHECK de extensión V2. El caso superior al contrato está dentro de capacidad física BIGINT, por lo que su error3819 evidencia el límite contractual y no overflow de un INT.

No prueba del contrato HTTP, coerciones estrictas del cliente ni roundtrip completo BIGINT Number/string en HISTORY/DETAIL; quedan para E3. No se modificó la configuración global mysql2.

## 14. Null-days enforcement

Consumo cero legítimo con input ETo0 y output diario0/díasNULL se aceptó. Un plazo numérico con daily0 y dos plazosNULL con dailypositivo se rechazaron expresamente por irr_sim_v2_days_ck. No UNKNOWN permisivo para estos faltantes. La matriz SQL mínima no sustituye la matriz local completa de todos los campos/nulls ni certifica todavía el readback HTTP real de ambos días.

## 15. Rollback fixtures

Parents dentro de una transacción principal; simulaciones dentro de savepoints. foreign_key_checks=1 y sql_mode estricto se leyeron y mantuvieron; sin desactivar FK, CHECK o sql_mode. No padres permanentes ni cleanup por DELETE.

Ledger privado: primera tanda user7/finca14/simulación aceptada18; tanda definitiva user8/finca15/simulaciones aceptadas19–22. Ambos parents y todos los candidatos se revirtieron. Transacciones terminadas con rollback confirmado; **conexiones independientes** verificaron posteriormente0 filas en las cuatro tablas de aplicación. El primer stop del harness no dejó residuos ni se ocultó con cleanup manual.

Como comprobación final se preservaron las huellas de filas vacías. Los IDs asignados durante pruebas pueden dejar huecos irreversibles en AUTO_INCREMENT; no se ejecutó ALTER/reset para ocultarlos. Ningún down exitoso fue ejecutado.

## 16. Counts finales

| Tabla | Antes | Post-UP | Después de rollback |
| --- | --- | --- | --- |
| users | 0 | 0 | 0 |
| fincas | 0 | 0 | 0 |
| calculos | 0 | 0 | 0 |
| irrigation_simulations | 0 | 0 | 0 |
| knex_migrations | 4 | 5 | 5 |
| knex_migrations_lock | 1 | 1 | 1 |

Lock=0, cero sesiones de aplicación desconocidas y cero transacciones activas al cierre. No fixtures residuales. Fingerprints de filas después de rollback coinciden con los de post-UP en las seis tablas.

Incidencia de lectura final: el cliente usado para preservar enteros devuelve COUNT agregado como string. Un guard estricto comparó inicialmente `"44"` con44 y marcó stop local pese a los datos correctos. Se inspeccionó el JSON ya capturado y se validó offline con BigInt exacto44/14; **no se repitió DML/DDL**, no se cambió configuración del backend ni se convirtió un resultado incorrecto en PASS. final-verification.json registra esa comprobación y todas las invariantes.

## 17. Fingerprint post-UP

SHA-256 de SHOW CREATE TABLE irrigation_simulations inmediato post-UP y al cierre:

`b6f98b19e04dacc2d1e537582d2fe0c519b54e38a91aec04a41c2c7539857bd9`

SHA-256 de filas de cada tabla de aplicación vacía:

`4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`

Reconciliación de definiciones respecto del post-UP: todas las seis tablas coinciden; se admite únicamente una eventual diferencia del valor de secuencia AUTO_INCREMENT por los INSERT con rollback, nunca de su atributo ni otra definición. En SHOW CREATE TABLE capturado el fingerprint final fue idéntico. No se considera ese hash una garantía del valor numérico interno de secuencia.

Evidencia privada: pre-up.json, migration-attempt.json, migration-result.json, post-up.json, check-comparison.json, enforcement.json (tanda interrumpida), enforcement-verified.json (14 casos), final-reconciliation.json y final-verification.json. Sin credenciales/hosts/CA paths en esos resultados; scripts usan configuración local sin imprimirla. No se editan manifests E1.

## 18. Regresión npm test

Después de certificación SQL: **251 PASS /0 FAIL**, cero skipped/cancelled/todo; duración2066.0596ms. No tests E2 añadidos al runner: utilidades de certificación viven fuera del repo y se ejecutaron explícitamente. La suite local usa DB/SMTP mocks y HTTP loopback; no activa un servidor público contra el origen.

Sin cambios de código, contratos, dependencias, ACTIVE_DESCRIPTOR o migrations. Freeze V1 conserva los tres SHA-256 obligatorios:

- irrigation-models.js: `6a1302569db4bd5902fb02d9ab08b6b131cd8bb155e510766dfff3937464afe8`.
- irrigation-validation.js: `7353589ce6810764085cbf9a1badb59e3458b8231e1a8acacae1ad1ed4b235a7`.
- irrigation-calculator.service.js: `b2c785847f4962be991fb72a0986b9e5f2f8f1d8063e2a99cda2579f11ff1380`.

Los76 archivos preexistentes del workspace se preservan byte por byte; únicamente se agrega este checkpoint. git diff --check y whitespace del documento PASS. Sin staging, commit o push.

## 19. Riesgos

Restore sigue pendiente, excepción explícitamente aceptada para este desarrollo vacío: no se extiende a producción, otro ambiente o un despliegue con datos. No backup del servicio completo ni recuperación ensayada. SQL directo no sustituye validación HTTP y MySQL puede coercionar tipos antes del CHECK.

E2 certifica schema/objetos y enforcement mínimo; no certifica aún persistencia HTTP V1/V2, roundtrip completo, UTC/JSON/DOUBLE/BIGINT/null a través de endpoints, ownership real, carreras POST/DELETE, rollback de service con conexiones reales o performance/cursor. No se creó la batería completa de fixtures, no se hizo down, no se inició puente público ni POST V2.

Los dos defectos diagnosticados fueron de utilidades privadas de certificación; no revelaron incompatibilidad en la implementación y quedan registrados, con evidencia original preservada. DDL de UP no se repitió. Si aparecieran writers/schema drift después de esta ventana, el GO debe renovarse con preflight; no se mantiene una exclusión global de escritura tras cerrar conexiones.

## 20. GO / NO-GO E3

**GO técnico para autorizar E3**, dentro de este entorno y con la limitación de restore expresamente aceptada:

| Criterio | Resultado |
| --- | --- |
| Ventana operativa sin writers conocidos y verificaciones de sesiones/trx | PASS |
| Única migration oficial, una ejecución/batch5 | PASS |
| 44 columnas exactas | PASS |
| 14 CHECK correctos/ENFORCED, comparación contra D3 | PASS |
| Objetos V1 preservados | PASS |
| Batería SQL mínima final | 14/14 conforme |
| Rollback y ausencia de fixtures residuales | PASS |
| Tracking5, sin duplicados, lock0 | PASS |
| Regresión local | 251/251 PASS |

Este GO acredita preparación para la siguiente certificación, no la ejecuta ni activa el servicio. **Detenerse: E3 no iniciado, POST V2 no activado, sin frontend/deploy/commit/push.**
