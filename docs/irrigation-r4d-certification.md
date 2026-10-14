# R4D — Certificación real end-to-end

Fecha: 2026-10-13, America/Buenos_Aires. Ejecución completa iniciada 2026-10-13T23:36:13.010Z. Estado: **PASS**, HTTP local real conectado a Aiven de desarrollo; ninguna migration, cambio de schema, motor, configuración, frontend, commit o push. R4E no iniciado.

## 1. Recuperación y preflight de solo lectura

El intento anterior falló con ENOTFOUND antes de TLS. El usuario identificó el servicio Powered Off y lo encendió. La reanudación repitió preflight read-only antes de fixtures y comprobó conectividad/TLS; no se cambió configuración para resolverlo.

SELECT DATABASE()=defaultdb; SELECT VERSION()=8.4.11. Tablas exactas: users, fincas, calculos, irrigation_simulations, knex_migrations, knex_migrations_lock. Conteos previos de las cuatro tablas de producto: 0. knex_migrations tiene los cuatro nombres históricos/fecha nueva aprobados, ids1–4 y batches1–4; lock is_locked=0. Registro Knex comprobado íntegro después de cleanup, incluyendo migration_time, sin reinterpretar timestamps históricos.

TLSv1.3 / TLS_AES_256_GCM_SHA384, certificado verificado por configuración existente. mysql2/Knex timezone=Z; sesión SYSTEM y system_time_zone=UTC. No secretos, hostname, user DB o CA path en este documento.

## 2. Fixtures y alcance del stack

Dos usuarios técnicos creados por POST /api/register y autenticados por POST /api/login; contraseñas/tokens solo en memoria, nunca reportados. Correos técnicos example.invalid, sin personas reales. Fincas creadas por HTTP y cálculos Manning por su endpoint existente. Identificador común de ejecución: R4D_0b3cc86bbbb5. IDs técnicos de usuarios: 5, 6. IDs de fincas de la ejecución completa: 7, 8, 9, 10, 11, 12, 13; algunas eliminadas durante pruebas exitosas.

App Express real, middleware JWT real, router/service/mapper/persistencia congelados y MySQL real. HTTP en loopback con puerto efímero; ninguna publicación/deploy. Los controles de prueba fueron temporales en memoria y se restauraron al terminar el proceso.

La primera ejecución de prueba no certificó el rollback inducido: el interceptor inicial de instancia no alcanzaba el cliente transaccional creado por Knex. DELETE de fixture sin dependientes completó normalmente (200). Se limpiaron todos sus fixtures y se verificaron conteos cero antes de repetir **todo R4D**. Fue un defecto del arnés, no un cambio del código productivo. La segunda ejecución interceptó el prototipo de cliente utilizado por las transacciones y pasó completa.

## 3. POST G01, readback y DOUBLE

POST G01 real: 201, finca correcta y nombre técnico explícito. Versions: irrigation-estimation-v1, irrigation-contract-v1, irrigation-metadata-v1, irrigation-diagnostics-v1. sourceHash=42592487e6e07deb1b25a073d74086a09c1bb19cb38411aafc31d28ea64d2127.

Se compararon por igualdad numérica todos los 15 inputs y 14 outputs entre motor, columnas DB y respuesta HTTP. Metadata y diagnostics completos se compararon profundamente. Los 37 valores de inserción (más ID generado) se leyeron directamente de la fila DB, sin recálculo SQL. G01 conserva P02/P04 warning y su evidencia original.

Los golden R1/R3 usan tolerancia max(1e-8,1e-9*abs(expected)); los valores DB/HTTP igualan al motor. Muestra DOUBLE exigida:

| Campo | Esperado Number | DB/Node | Delta | Tolerancia | Estado |
| --- | ---: | ---: | ---: | ---: | --- |
| crop_coefficient | 0.7 | 0.7 | 0 | 1e-8 | PASS |
| bulk_density_g_cm3 | 1.3 | 1.3 | 0 | 1e-8 | PASS |
| flow_lps | 0.9 | 0.9 | 0 | 1e-8 | PASS |
| advance_time_min | 4.8 | 4.8 | 0 | 1e-8 | PASS |
| infiltrated_depth_start_mm | 34.856850115866756 | 34.856850115866756 | 0 | 3.485685011586676e-8 | PASS |
| infiltrated_depth_middle_mm | 34.15259872981849 | 34.15259872981849 | 0 | 3.4152598729818496e-8 | PASS |
| infiltrated_depth_end_mm | 33.433516117812076 | 33.433516117812076 | 0 | 3.343351611781208e-8 | PASS |
| application_efficiency_pct | 82.21921916437785 | 82.21921916437786 | 1.4210854715202004e-14 | 8.221921916437785e-8 | PASS |

El literal decimal 34.152598729818493 tiene la representación Number impresa 34.15259872981849. La eficiencia del motor es 82.21921916437786 frente al golden decimal 82.21921916437785, diferencia de último bit dentro de tolerancia; DB y HTTP conservaron exactamente el Number del motor. No se corrigieron ni redondearon valores.

## 4. JSON y UTC reales

JSON_TYPE(model_metadata)=OBJECT y JSON_TYPE(diagnostics)=ARRAY; deep equality con metadata/diagnostics del motor, incluidos Number/boolean/null. Sin JSON string anidado ni doble stringify.

HTTP createdAt: 2026-10-13T23:36:18.172Z. Node Date.toISOString(): 2026-10-13T23:36:18.172Z. DATETIME físico DATE_FORMAT: 2026-10-13 23:36:18.172000. Reloj UTC y milisegundos conservados, sin desplazamiento -03. No se establecieron offsets o SET GLOBAL.

## 5. HISTORY, cursor, DETAIL y snapshot histórico

Cuatro simulaciones para finca A, con fechas diferentes y dos fechas exactamente iguales. Para crear empate sin editar snapshots, se usó la dependencia now del servicio R4B dentro del proceso temporal de integración: Date de servidor controlada para esos fixtures. Ningún createdAt recibido por cliente ni UPDATE de filas históricas. Se restauró el reloj normal.

Orden real obtenido: 15, 14, 13, 11. Dos filas empatadas: 2026-10-13T23:36:19.172Z. Las páginas HTTP limit=2 usaron el nextCursor emitido por el servidor; concatenación de páginas igual a los cuatro IDs ordenados directamente en SQL, sin duplicados/omisiones. Primera página hasMore=true; final nextCursor=null. Default limit20 verificado, cursor inválido400. LIMIT+1 y desempate por ID efectivos contra DB.

DETAIL propio200 coincidió exactamente con la respuesta G01 después de crear las demás simulaciones. Fila DB G01 se mantuvo profundamente igual: metadata, diagnósticos, nombre, números y fecha sin cambios. Lecturas siguen los servicios de snapshot R4B; no se invoca cálculo desde history/detail ni se actualizan mensajes/versiones.

## 6. Aislamiento e inmutabilidad

Usuario A no pudo POST/HISTORY/DETAIL sobre finca B ni obtener la simulación B combinando su ID con finca A: todos404 RESOURCE_NOT_FOUND, sin filtrar existencia. Usuario B tuvo su propio POST válido.

PUT/PATCH/DELETE de simulation detail devolvieron404. Comparación DB posterior confirmó fila G01 intacta.

## 7. Errores HTTP y constraints DB

HTTP: avance61/duración60→400; G12 flow0.1→422; ETo=Number.MAX_VALUE (input finito JSON)→422 por overflow. Conteos antes/después idénticos; ninguna fila inválida insertada.

Inserciones negativas directas mediante Knex transaction sobre copia de fila base, serialización JSON correcta y rollback/no fila:

| Caso | Errno real | Estado |
| --- | ---: | --- |
| useful | 3819 | PASS |
| efficiency | 3819 | PASS |
| advance | 3819 | PASS |
| json | 3819 | PASS |
| finca_id inexistente | 1452 | PASS |

3819 para útil>aplicado, eficiencia>100, avance>duración y metadata ARRAY donde se exige OBJECT. JSON incorrecto significa tipo estructural incorrecto pero sintácticamente válido, permitiendo comprobar el CHECK específico. FK inexistente1452. Sin INSERT IGNORE, cambios de CHECK/FK o foreign_key_checks=0.

## 8. DELETE y rollback reales

Finca A con Manning+simulaciones: DELETE HTTP409 FARM_HAS_IRRIGATION_SIMULATIONS; consulta DB confirmó finca, cálculo y simulación presentes. Finca técnica sin simulaciones y con Manning: DELETE HTTP200; ambos registros ausentes después.

Rollback inducido sin editar producción: interceptor temporal del método query del prototipo de cliente Knex, compartido por su cliente transaccional. Dejó ejecutar contra MySQL el DELETE provisional de calculos de la finca técnica; después lanzó un error deliberado antes de emitir DELETE de fincas. Ruta retornó500 genérico. Tras rollback real, consultas independientes confirmaron el cálculo Manning y finca presentes. El interceptor se retiró, sin hooks persistidos, triggers, DDL o configuración modificada.

## 9. Locks reales y carreras HTTP

Las pruebas usaron dos conexiones MySQL independientes. El interceptor esperó **después** de que SELECT de la primera petición terminara en DB, por lo que el lock real ya estaba adquirido. La segunda petición emitió su consulta incompatible en otra conexión; permaneció sin completar durante al menos450ms antes de liberar la primera. Luego se verificaron respuestas y filas finales. No flags de aplicación sustituyendo locks ni conexión única para simular concurrencia.

| Ganador | Conexión T1 | Conexión T2 | T1 HTTP | T2 HTTP/code | Estado DB antes de cleanup |
| --- | ---: | ---: | --- | --- | --- |
| POST | 2169 | 2178 | 201 | 409 / FARM_HAS_IRRIGATION_SIMULATIONS | finca=1, Manning=1, simulaciones=1 |
| DELETE | 2178 | 2169 | 200 | 404 / RESOURCE_NOT_FOUND | finca=0, Manning=0, simulaciones=0 |

POST gana: T1 LOCK IN SHARE MODE → pausa con lock retenido; T2 DELETE/FOR UPDATE espera; T1 inserta y commit; T2 detecta simulación y409, sin pérdida Manning. DELETE gana: T1 FOR UPDATE → pausa; T2 POST/shared lock espera; T1 elimina Manning/finca y commit; T2 continúa, finca ausente404 sin INSERT/huérfano.

Tiempo desde iniciar segunda petición hasta respuestas finales: 3638ms / 2420ms. Incluye liberación, viajes de red y ejecución posterior: **no se interpreta como duración exacta del bloqueo ni benchmark**. Prueba negativa observada: segunda petición no resuelta durante450ms. Sin lock timeout/deadlock observado; sin cambiar límites globales/sesión ni añadir retry.

## 10. EXPLAIN real del historial

Consulta principal real de persistencia, finca/usuario y order fecha/id DESC, limit21. Sin FORCE INDEX o índices nuevos.

| Tabla/alias | type | possible_keys | key | rows | Extra |
| --- | --- | --- | --- | ---: | --- |
| f | const | PRIMARY,fincas_user_id_foreign | PRIMARY | 1 |  |
| s | ref | irrigation_simulations_finca_created_id_idx | irrigation_simulations_finca_created_id_idx | 4 | Backward index scan |

Índice compuesto usado con Backward index scan. Evidencia con pocos fixtures, no certificación de rendimiento productivo.

## 11. Error leakage

Error inesperado de persistencia inducido antes de INSERT de un fixture mediante el mismo interceptor temporal. HTTP500 exacto: error=Ocurrió un error en el servidor., code=INTERNAL_ERROR. Sin SQL, errno, host, usuario DB, stack o CA path; consulta real posterior confirmó cero simulaciones para esa finca. No se rompió DB para lograrlo. Logs del arnés suprimieron detalles técnicos/sensibles; hooks retirados.

## 12. Cleanup, tracking y freeze

Solo fixtures identificados por los usuarios/fincas técnicos de la ejecución. Limpieza dentro de transacción en orden irrigation_simulations → calculos → fincas → users. No DROP, reset AUTO_INCREMENT, rollback migration ni eliminación de registros ajenos. Auto-increments pueden avanzar por fixtures/inserts rechazados: se preservan, no se reinician.

Conteos finales: users=0, fincas=0, calculos=0, irrigation_simulations=0, idénticos al preflight. knex_migrations sigue4 con mismos ids/nombres/batches/migration_time; contenido verificado profundamente. Lock libre certificado al cierre. Los siete hashes antes/después (cuatro migrations y tres módulos congelados) son iguales:

| Archivo | SHA-256 |
| --- | --- |
| db/migrations/20251021033631_create_users_table.js | 5C9C3C3E112E48D1B3EDE6BD2040BD398D6429C162E83AB4CFD5893760C5A874 |
| db/migrations/20251112235501_create_fincas_table.js | 61B90C1924AEF74665D852FE05D531927781B5B5B0D2D8DFAB6E706B239079F6 |
| db/migrations/20251113003352_create_calculos_table.js | 12797313C34F5D04DB1EB5985EBFA4C6BFED88C93F06273296E2B3E01C00F07C |
| db/migrations/20261012000000_create_irrigation_simulations.js | 9A9040719B8644D19840EDA9E63D54C82A8FFDB24D37E00F01D37AB289F9AD73 |
| src/services/irrigation/irrigation-models.js | 6A1302569DB4BD5902FB02D9AB08B6B131CD8BB155E510766DFFF3937464AFE8 |
| src/services/irrigation/irrigation-validation.js | 7353589CE6810764085CBF9A1BADB59E3458B8231E1A8ACACAE1AD1ED4B235A7 |
| src/services/irrigation/irrigation-calculator.service.js | B2C785847F4962BE991FB72A0986B9E5F2F8F1D8063E2A99CDA2579F11FF1380 |

QA final: npm test165 PASS /0 FAIL sin omisiones; npm run check:db-tls PASS TLSv1.3/TLS_AES_256_GCM_SHA384; git diff --check sin incidencias de espacios. Cambios previos R3/R4A/R4B/R4C conservados, sin cambios productivos en R4D. Única edición en repositorio de esta fase: este documento. Arnés y resultados técnicos fuera del repositorio; no secretos en documentación ni commit/push.

## 13. Riesgos y puerta R4E

R4D certifica los casos realizados en defaultdb/MySQL8.4.11 de desarrollo. No cambios respecto a fórmulas/contrato R4C, salvo evidencia real ahora disponible. No prueba de carga/productividad ni garantía de todos los interleavings posibles.

Commit uncertainty sigue sin simular caída de infraestructura: conexión perdida después de commit puede dejar creación incierta. **Recomendación explícita para revisión R4E:** backlog de idempotencia para MVP controlado, con reconciliación manual mediante historial antes de reintentar y sin retry automático. Si el producto exige reintentos automáticos o ausencia garantizada de duplicados, debe tratarse como blocker antes de habilitar ese uso. La clasificación de producto requiere decisión del usuario; no se adopta silenciosamente ni se implementa aquí.

Pendientes agronómicos R3 siguen no resueltos. Modelo estimativo, no calibrado/validado científicamente. Publicación/archivado de implementación y procedimientos operativos deben revisarse en R4E.

**Listo técnicamente para revisión y autorización de R4E**, con decisión explícita de commit uncertainty pendiente. R4E no iniciado.
