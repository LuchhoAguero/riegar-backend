# R4F-E3 — PERSISTENCIA REAL V1/V2

Fecha: 2026-10-21. Entorno exclusivo autorizado: **riegar-mysql-dev / defaultdb**. Certificación con service, persistence, mappers, motores y Knex/mysql2 reales. **Sin fake DB y sin servidor HTTP público**: se verifica SUCCESS del service y la proyección pública del harness, no se atribuye un status HTTP observado.

Resultado: siete creaciones reales y un fallo controlado con rollback, roundtrip V1/V2 conforme, cleanup exclusivo de ledger, cero residuos, tracking intacto y251 tests locales PASS. E4 no iniciado; sin carreras, down, cambio del descriptor público, frontend, deploy, commit o push.

## 1. Preflight

Ejecución:2026-10-21T14:06:28.300Z–14:07:19.474Z. Nueva conexión con DATABASE()/VERSION() primero: **defaultdb /8.4.11**. Guardas locales de servicio de desarrollo, CA, rejectUnauthorized=true y timezone Z. TLS real **TLSv1.3 / TLS_AES_256_GCM_SHA384**. UTC: session/global SYSTEM, system UTC y diferencia NOW−UTC_TIMESTAMP0 segundos. Sin fallback insecure ni cambio de configuración global.

Counts iniciales0 en users/fincas/calculos/irrigation_simulations; tracking5 y lock0. Las44 definiciones de columnas y14 CHECK ENFORCED se compararon íntegramente con evidencia E2, y SHOW CREATE TABLE de las seis tablas coincidió salvo posibles valores de secuencia por fixtures anteriores. No drift. Procesos locales identificados como tooling Codex/MCP; sin backend RiegAR arrancado. PROCESSLIST/INNODB_TRX sin sesiones o transacciones ajenas; solo conexiones propias y event_scheduler interno claramente identificado. Control renovado antes de cada create y al cierre, con thread IDs propios registrados.

El restore en clon continúa pendiente bajo la limitación aceptada para este dev inicialmente vacío. No hubo nueva migration ni restauración.

## 2. Fixtures

Exactamente **un usuario y una finca**, con nombres prefijados R4F-E3, email sintético example.invalid y dato de password_hash de fixture SQL sin uso de login. No usuario/finca ajenos ni otra finca multiusuario. Parents creados solo para certificación y eliminados al finalizar.

Ledger privado: userId9, fincaId16; candidatos de simulación23–30. Siete filas confirmadas23–29; candidato30 pertenece al fallo controlado y nunca quedó persistido. Ledger actualizado al recibir cada insertId del driver antes de continuar, con marca de cleanup confirmado.

Evidencia fuera de Git: `C:/Users/aguer/.codex/private-backups/riegar/20261021-e3/`, ACL sin herencia para cuenta local/SYSTEM. Contiene harness, preflight.json, ledger.json, roundtrip-progress.json, evidence.json y binding-comparison.json. Guarda filas de simulaciones fixture, tipos, comparaciones y counts; sin credenciales, host, tokens o CA path. No se publican payloads de usuarios.

## 3. V1 bridge real

Service compuesto con ACTIVE_V1 y Knex real. Input clásico: widthM1.3/length60/slope0, ETo5/Kc0.7/días20, suelo aprobado y flow0.9/duration60/advance4.8. Resultado **SUCCESS**, fila23 comprometida y visible desde conexión independiente.

INSERT con **37 nombres/valores**; seis extensiones V2 NULL en SQL. Pair irrigation-estimation-v1/irrigation-contract-v1, metadata irrigation-metadata-v1 y diagnostics irrigation-diagnostics-v1. HashV1 conservado. Readback y DETAIL mantienen widthM y14 magnitudes, sin spacing/count/totals inventados. HISTORY conserva exactamente las cuatro claves del summary anterior, sin placeholders V2. created_at real conserva UTC/milisegundos.

## 4. V2 GV2-01 real

Service final interno con ACTIVE_V2, sin cambiar ACTIVE_DESCRIPTOR público V1. Input del fixture literal aprobado: spacing1.3, count18, flow0.9, duración120/avance20 y demás campos canónicos. Resultado **SUCCESS**, fila24 comprometida, INSERT43 valores. Input/metadata/diagnostics completos cotejados;19 magnitudes contra fixture independiente, además del control del motor.

| Magnitud GV2-01 | Motor/SQL/readback/response conforme |
| --- | --- |
| targetDepthMm | 70 |
| dailyCropWaterUseMmPerDay | 3.5 |
| availableWaterMm | 91 |
| availableCapacityL | 7098 |
| maxRecommendedDepthMm | 54.6 |
| maxRecommendedVolumeL | 4258.8 |
| daysUntilAvailableWaterExhaustion | 26 |
| daysUntilDepletionThreshold | 15.6 |
| appliedVolumeL | 6480 |
| infiltratedDepthStartMm | 49.29503017546495 |
| infiltratedDepthMiddleMm | 47.19639816765682 |
| infiltratedDepthEndMm | 45 |
| estimatedUsefulVolumeL | 3681.3190570772317 |
| residualLossVolumeL | 2798.6809429227683 |
| totalAppliedVolumeL | 116640 |
| totalAppliedVolumeM3 | 116.64 |
| applicationEfficiencyPct | 56.8104792758832 |
| advanceRatioPct | 16.666666666666668 |
| maxNonErosiveFlowLps | 6.3 |

Reglas P02/P04, orden/mensajes/evidencias almacenados y ruleVersion-v1 conformes. Model irrigation-estimation-v2, contract irrigation-contract-v2, metadata irrigation-metadata-v2 y sourceHashV2.

## 5. Readback semantics

Instrumentación temporal en el **prototype de query del cliente Knex**, compartido por clientes de transacción. Observa llamadas reales y respuestas del driver; no reemplaza DB/persistence con mocks. Captura columnas/bindings del INSERT y fila real del SELECT de readback antes del mapper. Por cada éxito se acredita la secuencia BEGIN→INSERT→readback→COMMIT→resolución del service, usando una única conexión y cliente de transacción.

Después del SUCCESS se consulta la misma fila desde conexión mysql2 independiente: igualdad con la capturada dentro de trx y con el snapshot reconstruido por el mapper. Comparaciones de input/output/metadata contra motor y, para GV2-01, contra literal independiente. Comparación adicional de **295 valores enlazados al INSERT** (37+6×43) contra SQL; JSON parseado una vez para cotejo, count exacto y DOUBLE con tolerancia aprobada.

La respuesta sale de `findSnapshot(trx,...)` y del mapper de fila; no se usa calculator directo como respuesta. El COMMIT fue confirmado y la fila visible fuera de trx. Los cálculos de expected del harness son controles separados del contador de llamadas dentro de cada create.

## 6. Zero daily

Tres filas V2 reales:

| Caso | ETo | Kc | Fila fixture | Daily SQL | Días SQL/response |
| --- | --- | --- | --- | --- | --- |
| ZERO-ETO | 0 | 0.7 | 25 | 0 | NULL/NULL y null/null presentes |
| ZERO-KC | 5 | 0 | 26 | 0 | NULL/NULL y null/null presentes |
| ZERO-BOTH | 0 | 0 | 27 | 0 | NULL/NULL y null/null presentes |

Ambos campos se comprueban con hasOwn; no Infinity, cero sustituto ni omisión. JSON de proyección pública serializa/deserializa sin alterar el snapshot. Motor, columnas, mapper y DETAIL concuerdan; las otras reglas/dominios del modelo permanecen activos.

## 7. BIGINT roundtrip

Con la configuración real existente, sin supportBigNumbers/bigNumberStrings globales agregados:

| Input Number | Fila | SQL CAST(furrow_count AS CHAR) exacto | Tipo mysql2 efectivo | DETAIL/HISTORY |
| --- | --- | --- | --- | --- |
| 1 | 28 | 1 | number | Number1 exacto |
| 18 | 24 | 18 | number | Number18 exacto |
| 9007199254740991 | 29 | 9007199254740991 | number | NumberMAX_SAFE exacto |

El adapter acepta esos Number seguros y conserva identidad. El SQL decimal se comparó contra String(input) antes del cleanup; driver readback, mapper y responses mantienen el mismo count. Las otras filas V2 también devolvieron number. En V1 el campo es SQL NULL; typeof null en JavaScript es object y **no significa que count se haya convertido en objeto**.

Totales de COUNT-MAX siguen Number/DOUBLE finitos; se comparan con la aritmética del motor/tolerancia. No se exige precisión matemática de entero fuera de safe integer a totalL; el requisito de identidad exacta corresponde al count.

## 8. DOUBLE roundtrip

Los19 campos de magnitud GV2-01, incluidos start/middle/efficiency/residual/días/totales, se compararon en output de motor, bindings INSERT, fila SQL, mapper/readback y response. Tolerancia R1: `max(1e-8,1e-9*abs(expected))`. Sin redondeo decimal, casts a escala fija o normalización de resultados.

La evidencia registra las magnitudes reales indicadas en §4. No se extrapola esta muestra a toda combinación numérica posible ni a exactitud agronómica. Persistencia cumple el contrato Number/DOUBLE observado.

## 9. JSON roundtrip

SQL `JSON_TYPE(model_metadata)` devuelve OBJECT y `JSON_TYPE(diagnostics)` ARRAY en las siete filas. mysql2 efectivo devuelve metadata como objeto no array y diagnostics como array JavaScript (typeof array es object); no strings doblemente codificados.

Bindings del INSERT: una cadena JSON por columna, creada una vez por persistence. JSON.parse de esos bindings concuerda estructuralmente con los objetos/arrays leídos por el driver; mapper reconstruye objetos completos. Metadata mantiene **nueve secciones** y diagnostics mantiene array completo. MySQL puede ordenar las claves internas de JSON; se valida estructura/valores, no identidad byte a byte del texto original.

Proyección pública real del backend verificada desde el harness; se preservan input/output/model/simulation/metadata y no se filtran nombres físicos SQL. Sin acceso a endpoints HTTP reales en esta subfase.

## 10. UTC roundtrip

Se inyectó en los services un reloj de certificación fijo con milisegundos123 para comparar identidad y producir empates deliberados: **2026-10-21T14:06:35.123Z**. Sigue siendo un valor generado por composición del servidor de prueba, no un campo aceptado del cliente. No se cambió reloj del sistema ni timezone del servidor.

created_at permanece DATETIME(3). Driver devuelve Date; toISOString y simulation.createdAt concuerdan con ISO Z exacto. Lectura directa DATE_FORMAT produce `2026-10-21 14:06:35.123000`, coherente con los tres milisegundos almacenados. Se comparó DB↔readback↔mapper↔response en las siete creaciones. No timezone drift observado.

## 11. HISTORY mixto

Con siete filas reales coexistentes, se consultó HISTORY tanto desde bridge como desde service final. Mismo resultado por fila, independiente de descriptor activo. Las fechas empatadas se ordenan DESC created_at/id: **29,28,27,26,25,24,23**. Una página limit100, hasMore=false y cursor terminal null; sin offset o nueva semántica de cursor.

V1: summary exactamente targetDepthMm/appliedVolumeL/applicationEfficiencyPct/diagnostics. V2: agrega únicamente furrowCount/totalAppliedVolumeL, con count1/18/MAX_SAFE exactos. Sin days, totalM3, input completo o metadata en HISTORY. appliedVolumeL sigue por surco. Query real usa la proyección D2; SQL real ejecutado por Knex, no doble permisivo.

Esta comprobación incluye V1, V2 normal, tres zero-daily y bordes count. La batería completa de paginación/ownership multiusuario y concurrencia no se adelanta a E4.

## 12. DETAIL mixto

Catorce lecturas DETAIL reales: siete filas desde bridge y las mismas siete desde final. Cada snapshot coincide con su respuesta de creación y metadata/diagnostics almacenados. V1 mantiene widthM y14 magnitudes; V2 mantiene spacing/count y19 definiciones de magnitud (dos plazos null en consumo cero).

Lecturas del servicio no invocaron calculate: contador de calculadores inyectados para GET=0 y flujo inspeccionado reader/validator sin ecuaciones. No regeneración de diagnostics ni reemplazo por template activo. La certificación observa snapshots intactos; no se modificaron outputs/metadata con UPDATE para fabricar historias diferentes.

## 13. Version/hash preservation

| Fila/tipo | Model/contract | Metadata/diagnostics | Source hash |
| --- | --- | --- | --- |
| V1 | irrigation-estimation-v1 / irrigation-contract-v1 | irrigation-metadata-v1 / irrigation-diagnostics-v1 | 42592487e6e07deb1b25a073d74086a09c1bb19cb38411aafc31d28ea64d2127 |
| V2 | irrigation-estimation-v2 / irrigation-contract-v2 | irrigation-metadata-v2 / irrigation-diagnostics-v1 | 30b031d7bd3aa4365c65b6750a91a4004db4ef3452c99bf3924698b89f9dec3b |

Comparados contra SQL/readback/DETAIL en ambas composiciones. No sustitución del hash/pair almacenado por descriptor activo. ACTIVE_DESCRIPTOR sigue ACTIVE_V1 y no se activó un servicio público.

## 14. No retry

Cada create exitoso: **un cálculo dentro del service, una transaction, un INSERT**, un readback y un COMMIT. Counts de simulaciones desde conexión independiente:0→1→2→3→4→5→6→7, incremento exactamente uno por invocación.

V1 INSERT37 valores; cada V2 INSERT43. Los eventos de cada create usan el mismo thread y cliente trx, con SUCCESS resuelto después de commit. Ningún replay/retry automático, idempotencia nueva o simulación de commit incierto. También el create fallido controlado tiene un único cálculo/transacción/INSERT y un ROLLBACK, sin segundo intento.

## 15. Rollback controlado

Sobre los siete éxitos ya comprometidos se llamó otro create V2. El harness interceptó **el cliente de transacción real** y lanzó E3_CONTROLLED_READBACK al intentar el SELECT de readback, después de recibir insertId30 del INSERT real y antes de COMMIT. No se simuló pérdida de red/acuse ni se sustituyó la DB.

Secuencia acreditada: BEGIN→INSERT→intento readback→ROLLBACK; mismo thread/trx y cálculo1. Error controlado esperado capturado; no hubo fallo de certificación. Desde conexión independiente: id30 ausente y counts antes/después sin cambios (siete simulaciones, un usuario y una finca). Prototype restaurado antes del cleanup. No se acepta como evidencia un override que afecte solo la instancia principal de Knex: el registro acredita la llegada al cliente trx.

## 16. Cleanup

DML directo autorizado exclusivamente sobre IDs del ledger. Antes de eliminar se leyeron las filas de la finca fixture y se comprobó que todas correspondían al ledger/prefijo R4F-E3. Limpieza en una transacción real: borrar individualmente simulaciones23–29 por id+finca_id; después finca16 por id+user_id+nombre fixture; después usuario9 por id+nombre fixture.

Afectadas exactamente **7 simulaciones,1 finca,1 usuario**; COMMIT confirmado. id30 no se elimina porque el rollback ya acreditó su ausencia. Sin DELETE amplio, tablas de migrations, datos ajenos, ALTER AUTO_INCREMENT o reset de secuencias. Huecos por los IDs de fixtures son aceptados por el alcance.

## 17. Counts finales

Verificados desde conexión independiente tras cleanup:

| Tabla | Inicial | Tras siete éxitos | Tras fallo controlado | Final |
| --- | --- | --- | --- | --- |
| users | 0 | 1 | 1 | 0 |
| fincas | 0 | 1 | 1 | 0 |
| calculos | 0 | 0 | 0 | 0 |
| irrigation_simulations | 0 | 7 | 7 | 0 |

Sin residuos. SHOW CREATE TABLE de las seis tablas coincide con el preflight; el fingerprint de schema de riego sigue `b6f98b19e04dacc2d1e537582d2fe0c519b54e38a91aec04a41c2c7539857bd9`. Esa huella no promete recuperar valores numéricos internos de secuencia consumidos. Cero sesiones de aplicación desconocidas y transacciones ajenas al cerrar la evidencia; no procesos de backend dejados corriendo.

## 18. Tracking

Antes/después de creaciones, fallo y cleanup: mismas cinco migrations y batches1–5; última `20261014000000_extend_irrigation_simulations_v2.js`, batch5. Lock index1/is_locked0. Comparación exacta de id/name/batch y lock, sin edición manual. No migration, down ni DDL ejecutados en E3.

## 19. npm test

Después de cleanup: **251 PASS /0 FAIL**, cero skipped/cancelled/todo; duración2375.9128ms. Una corrida. Sin tests nuevos en runner; harness privado explícito separado de las suites locales DB/SMTP mocks. No confundir esta regresión local con la evidencia de consultas/conexiones reales de E3.

Sin modificaciones de código, contratos, dependencias, config o fixtures del repo. Los77 archivos preexistentes se conservan byte por byte; solo se agrega este checkpoint. V1 mantiene los tres SHA-256 del freeze; git diff --check y whitespace del documento PASS. Sin staging, commit ni push.

## 20. Riesgos

La certificación usa services/proyección del backend con Knex real; **no acredita todavía un status HTTP real, auth/endpoints reales completos o batería multiusuario**. E4 conserva ownership exhaustivo y carreras POST/DELETE; E3 solo opera sobre su usuario/finca propios. No se inyectaron fallos ambiguos de red/commit, no down, despliegue ni frontend.

Restore de backup en clon permanece sin probar, aceptado como limitación para este entorno dev vacío. No se extrapola la excepción a producción ni se afirma recuperación ensayada. AUTO_INCREMENT puede tener huecos por fixtures y rollback; no se resetea. Las observaciones sin writers no son un bloqueo global permanente después de cerrar la ventana.

Number/DOUBLE se valida con tolerancia aprobada, no exactitud matemática fuera del rango entero seguro de totales ni validez agronómica. JSON estructural puede tener otro orden de claves al salir de MySQL. La configuración real devolvió count como number; el adapter de string sigue cubierto localmente, sin fingir que fue el tipo observado en este entorno.

## 21. GO / NO-GO E4

**GO técnico para autorizar E4.**

| Requisito | Estado |
| --- | --- |
| Bridge V1 write/read real | PASS |
| V2 GV2-01,19 magnitudes y P02/P04 | PASS |
| Zero daily A/B/C | PASS |
| Count1/18/MAX_SAFE, SQL/driver/mapper/HISTORY/DETAIL | PASS |
| DOUBLE/JSON/UTC | PASS |
| Readback real dentro de trx y visibilidad tras commit | PASS |
| HISTORY/DETAIL mixtos sin cálculo | PASS |
| Rollback controlado desde cliente trx real | PASS |
| Cleanup exclusivo ledger, counts0 | PASS |
| Tracking5/lock0 y schema intactos | PASS |
| npm test | 251/251 PASS |

Este GO no ejecuta la siguiente fase. **Detenerse: E4 no iniciado, sin carreras POST/DELETE, down, POST V2 público, deploy, frontend, commit ni push.**
