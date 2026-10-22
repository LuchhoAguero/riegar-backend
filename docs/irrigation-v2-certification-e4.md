# R4F-E4 — OWNERSHIP/ERRORES/ROLLBACK REAL

Fecha:2026-10-22. Entorno exclusivo: **riegar-mysql-dev / defaultdb**. Certificación HTTP loopback con routers/auth/service/mappers/persistence reales y Knex/mysql2 contra MySQL real. Tanda definitiva: **70 requests conformes**, cuatro puntos de rollback y commit confirmado con respuesta fallida/reconciliada. Cleanup verificado y251 tests locales PASS.

No carreras POST/DELETE, down, migration, ALTER, frontend, deploy, commit o push. No se cambia ACTIVE_DESCRIPTOR ni se deja un servidor público o loopback corriendo. Restore aislado sigue pendiente bajo la limitación aceptada para el dev vacío.

## 1. Preflight

Primera consulta de cada conexión de auditoría verifica DATABASE()/VERSION(): **defaultdb/8.4.11**. Configuración exige destino de desarrollo autorizado, CA y rejectUnauthorized=true, timezone Z. TLS real **TLSv1.3/TLS_AES_256_GCM_SHA384**; UTC session/global SYSTEM con system UTC y NOW−UTC_TIMESTAMP=0. Sin fallback insecure.

Revalidados counts0 en las cuatro tablas de aplicación, tracking5/lock0,44 columnas y14 CHECK ENFORCED. Columnas/expresiones completas comparadas con E2; SHOW CREATE TABLE de las seis tablas coincide con la referencia, admitiendo solo posibles diferencias numéricas de secuencia por fixtures previos. Sin drift.

Procesos locales identificados como tooling Codex/MCP, no backend RiegAR activo. PROCESSLIST/INNODB_TRX solo conexiones propias registradas por thread ID y event_scheduler interno; cero sesiones/transacciones desconocidas. Se renueva la guarda antes de crear simulaciones y antes de los fallos controlados, más reconciliación final. La ventana operativa se apoya en el acceso local conocido y observaciones reales, no en un bloqueo global permanente a cualquier administrador externo.

## 2. Fixtures multiusuario

En la tanda definitiva: userA12/userB13; fincaA19→userA12 y fincaB20→userB13. Nombres R4F-E4 userA/userB y fincaA/fincaB; emails sintéticos example.invalid y dato password_hash de fixture SQL sin uso de login. No datos ajenos.

FincaA recibe V1, V2 normal, V2 zero y tres V2 con clocks controlados; fincaB recibe V1/V2. Ocho creaciones iniciales201. IDs32–39; candidatos de rollback40–42 y commit con respuesta fallida43. Todo registrado antes de continuar en ledger privado, con finca/nombre de cada simulación.

Incidencia inicial de la utilidad: el primer intento creó un par A/B y obtuvo201 para V1(id31), pero el contador local de transaction quedó0 porque `knex.transaction` es una propiedad no escribible. El trace de queries ya mostraba BEGIN/INSERT/readback/COMMIT reales. Se detuvo el harness, cerró ambos listeners y eliminó id31 y sus dos fincas/usuarios por ledger, verificando counts0/schema/tracking intactos. Se informó el defecto, se inspeccionó el descriptor configurable y se instrumentó con defineProperty, restaurándolo al terminar. No cambio a backend ni acomodación de un comportamiento MySQL inesperado.

La tanda definitiva comenzó con nuevos fixtures después de ese cleanup confirmado; no es un replay de una operación incierta. Evidencia inicial preservada separadamente. Por tanto, hubo **dos pares transitorios A/B en intentos sucesivos**, no coexistentes ni datos permanentes: un par de la tanda interrumpida y otro de la certificación completa. El cleanup total E4 acredita ambos ledgers.

## 3. HTTP local real

Dos instancias Express con JSON parser y `createIrrigationSimulationRouter` real: composición bridge ACTIVE_V1 y final interna ACTIVE_V2. Listeners en **127.0.0.1**, puertos0/efímeros; ninguna escucha externa. Knex real, sin fake DB. No se importa/arranca el servidor público, ni otras rutas de la app como login/contacto/fincas DELETE.

Tanda definitiva:2026-10-22T13:13:50.594Z–13:16:45.681Z. Distribución de status HTTP realmente observados:

| HTTP | Requests |
| --- | --- |
| 200 | 14 |
| 201 | 8 |
| 400 | 22 |
| 401 | 3 |
| 403 | 6 |
| 404 | 9 |
| 415 | 1 |
| 422 | 2 |
| 500 | 5 |

**70/70 conformes** al status/count esperado. Ambos listeners cerrados antes de cleanup final. No se atribuyen a E4 status de rutas no montadas ni características de CORS/login del root app.

## 4. Auth

Middleware JWT real. Tokens del harness firmados para IDs fixture, con secreto aleatorio **solo en el proceso hijo**, nunca impreso o guardado; variable previa restaurada. Esto prueba auth del router, no el flujo de login/emisión de tokens de producción.

POST colección, GET HISTORY y GET DETAIL: sin token→401; token inválido→403; token expirado→403. Nueve pruebas y **cero queries del backend**, cálculos o INSERT en esas requests. Counts sin cambio. Respuestas conservan el contrato actual de mensajes seguros.

## 5. POST ownership

Ocho POST propios201 confirman escritura con usuario/finca correctos en ambas versiones. userA POST fincaB→404/RESOURCE_NOT_FOUND, misma respuesta pública que recurso ausente. En el intento ajeno no se invoca calculator ni INSERT; count permanece8. La transacción puede terminar normalmente tras comprobar finca no propia, sin escritura.

Cada request incluye comprobación de count antes/después por conexión independiente. No se infiere ownership únicamente del JWT o del ledger: lo ejecuta la query real de finca propia.

## 6. HISTORY ownership

userA/fincaA y userB/fincaB→200 con sus filas propias. userA/fincaB, userB/fincaA y finca inexistente→404. No filas ajenas ni indicación pública de existencia. Query real conserva join a fincas y user_id, además del scope finca_id.

Todas las respuestas404 de ownership/not found se cotejan exactamente con `{ error: "Recurso no encontrado o no tienes permiso.", code: "RESOURCE_NOT_FOUND" }`.

## 7. DETAIL ownership

Ocho detalles propios→200 y coinciden con las respuestas de creación. Casos404 reales: A consultando fincaB, B consultando fincaA, id de B bajo fincaA propia de A, id de A bajo fincaB propia de B e id inexistente. Misma forma pública para todos.

La prueba del id cruzado bajo una finca propia recorre la query real de snapshot con id/finca/ownership; no se limita al rechazo temprano de una finca ajena. Sin modificación de filas o counts.

## 8. HISTORY multipágina

Limit2, seis filas en fincaA y dos en fincaB. Secuencia real de A:

| Página | IDs | hasMore | nextCursor |
| --- | --- | --- | --- |
| 1 | 36,35 | true | string Base64URL v1 |
| 2 | 34,33 | true | string Base64URL v1 |
| 3 | 32,37 | false | null |

Exactamente los seis IDs esperados, sin duplicados ni huecos. B devuelve39,38 en una página hasMore=false/cursor null y no recibe filas A. Se inspeccionan queries reales capturadas: una query HISTORY por página, orden compuesto y **sin OFFSET**. No sustitución del repositorio con un mock que ordene por fuera de SQL.

## 9. Cursor/empates

Clock inyectado al service, sin UPDATE de timestamps. Grupos deliberados:

- IDs36/35:2026-10-22T13:14:50.123Z.
- IDs34/33/32:2026-10-22T13:13:50.123Z.
- ID37:2026-10-22T13:12:50.123Z.

ORDER BY created_at DESC,id DESC observado; mayor id gana en cada empate. Cursors codificados por el router real, solo caracteres Base64URL, JSON decodificado exacto `{v:1,createdAt,id}` tomado del último item de cada página. Cursor1 apunta a35/13:14:50.123Z y cursor2 a33/13:13:50.123Z. Las páginas siguientes atraviesan empates sin perder id32. El clock controlado no cambia reloj/UTC de sistema o servidor.

## 10. Invalid input

Cinco POST V2 reales400: bodyV1 con widthM, falta spacing, falta count, count string y advance>duration. El filtro HTTP o validator real devuelve error de input, sin INSERT. Counts antes/después iguales en todos los casos.

Controles adicionales: Content-Type text/plain→415; query no admitida en POST y DETAIL→400; fincaId y simulationId0/negativo/decimal/no numérico/overflow4294967296→400. Para IDs de finca se cubren GET y POST; para simulationId, DETAIL. Quince requests de IDs, sin escritura. No se inventa una versión elegida por cliente ni se relajan los campos del contrato.

## 11. Model 422

Dos bodies JSON válidos: caudal0.1 con balance imposible y ETo=Number.MAX_VALUE como número JSON finito que produce overflow derivado. Ambos→**422/IRRIGATION_MODEL_INCONSISTENCY**, sin INSERT y sin output parcial.

No se usó NaN/Infinity en JSON para fingir una inconsistencia. Calculator y su clasificador de errores se ejecutan dentro del flujo real de service/HTTP; counts permanecen iguales después del error.

## 12. Rollback puntos

Instrumentación temporal del **prototype query compartido por clientes Knex de transacción**, más wrapper privado del callback. No toca archivos de aplicación ni reemplaza la DB. En los cuatro puntos, el caller recibe500 genérico, el trace muestra ROLLBACK real y la conexión independiente confirma count sin cambio.

| Punto | Intervención controlada | INSERT ejecutado | ID | Verificación |
| --- | --- | --- | --- | --- |
| A antes de INSERT | excepción antes de enviar la query al driver | 0 | — | ninguna fila nueva |
| B después de INSERT/antes de readback | excepción tras resultado real del INSERT | 1 | 40 | id ausente |
| C durante readback | SELECT real ejecutado; excepción al entregar su resultado | 1 | 41 | id ausente |
| D antes de retorno del callback | snapshot SUCCESS ya construido; wrapper lanza antes de retornar al manejador trx | 1 | 42 | id ausente |

Cada request: cálculo1/transaction1/máximo un intento de INSERT. No COMMIT en estos traces. Estado base previo a los cuatro: ocho simulaciones, dos fincas y dos usuarios; permanece igual después de cada rollback. PuntoA registra intento de query, pero no se cuenta como INSERT ejecutado.

## 13. Commit incierto

Prueba controlada y determinista: el wrapper privado **espera que la transaction original termine con commit confirmado** y recién entonces lanza una excepción al caller, antes de que la ruta responda201. No rompe red, no simula un rollback ni hace que Knex interprete un COMMIT no ejecutado como exitoso.

HTTP observado: **500/INTERNAL_ERROR**. Fila43 realmente comprometida; count8→9. Un cálculo, una transaction, un intento/ejecución de INSERT y COMMIT confirmado; **cero intento de ROLLBACK**. Se modela pérdida de respuesta después de commit, no se afirma haber provocado una falla de red/driver real o demostrado todas sus variantes.

El control se configura solo en la closure del harness, no desde un campo, header o endpoint nuevo de la API. No se cambia la política del backend ante errores de commit.

## 14. Reconciliación

Tras el500 posterior a commit, GET HISTORY propio encuentra exactamente una vez el id43, y GET DETAIL devuelve su nombre fixture/resultado almacenado. Counts no vuelven a aumentar; no segundo POST. La recuperación se hace por consultas de lectura dentro del ledger.

Esto acredita la distinción requerida: **respuesta fallida no implica escritura revertida**. Un caller debe reconciliar antes de decidir repetir una operación; no se introduce replay automático, idempotencia o garantía exactly-once.

## 15. No retry

Instrumentación por request de calculator, entrada a transaction, intentos de query INSERT y ejecuciones efectivas. Las70 requests cumplen máximo1 en cada categoría; los GET tienen **cero cálculos**. Totales de la tanda definitiva:

| Métrica | Total |
| --- | --- |
| Entradas transaction de requests | 20 |
| Cálculos dentro de requests | 19 |
| Intentos de query INSERT simulation | 13 |
| INSERT simulation efectivamente ejecutados | 12 |

Los12 INSERT son ocho éxitos iniciales, tres filas luego revertidas en B/C/D y una fila de commit con respuesta fallida. PuntoA añade un intento sin ejecución. Los errores de input/modelo y POST ajeno pueden iniciar una trx sin insertar; se distinguen de reintentos. Transacciones de preparación/cleanup de parents no se incluyen en estos totales de requests.

La primera tanda interrumpida tuvo su propio único POST201 confirmado y cleanup completo; se conserva aparte, sin mezclarlo con las70 verificaciones ni con el caso de acuse perdido.

## 16. Error leaks

Los cinco500 se compararon exactamente con `{ error: "Ocurrió un error en el servidor.", code: "INTERNAL_ERROR" }`. Ninguna respuesta serializa SQL, errno, stack, host, CA path, credenciales, filesystem o razón interna de snapshot. Marcadores privados de excepciones inyectadas no aparecen en responses. Se escanean además valores sensibles de configuración sin imprimirlos.

Los cinco logs inesperados de la ruta son únicamente su mensaje constante, sin objeto Error/SQL. Tokens JWT y secreto efímero no se guardan en evidencia. No se deshabilitaron CHECK/FK, sql_mode o TLS para probar errores.

**Storage corrupto no se fabricó en DB compartida:** sin UPDATE de snapshots válidos ni versiones/hash/schema desconocidos insertados para este fin. Sus500 siguen cubiertos por registry/mappers/dobles de suites locales; E4 real no los presenta como un escenario SQL ejecutado. Los500 reales aquí recorren errores controlados de infraestructura y respuesta post-commit.

## 17. Shapes V1/V2

HISTORY V1 conserva las cuatro claves del summary histórico; V2 añade exactamente furrowCount/totalAppliedVolumeL. Sin días, totalM3, metadata o input completo en items. DETAIL V1 conserva widthM y14 magnitudes; DETAIL V2 spacing/count y19 definiciones de magnitud. Zero-daily conserva ambos plazos null presentes.

Ocho responses201 y sus ocho detalles propios se compararon completos. Default público continúa ACTIVE_V1; composición V2 explícita solo en el router local de certificación. No endpoint paralelo ni selección pública por versión.

## 18. Metadata/diagnostics

Consultas directas por id+finca de los ocho fixtures iniciales cotejan model_metadata y diagnostics reales con response GET: metadata completa de **nueve secciones**, diagnóstico persistido, pair/sourceHash de la fila sin sustituirlos por descriptor activo.

GET no recalcula: contadores0 y flujo de readers/validación, sin regenerar ecuaciones/reglas. No se modificaron parámetros/mensajes históricos vía UPDATE para crear corrupción. Se mantiene la evidencia de roundtrip JSON/DOUBLE/UTC de E3 y la lectura real E4 en contexto multiusuario.

## 19. Cleanup

Antes de cleanup se cerraron ambos listeners y se restauraron prototype query, descriptor transaction, logger y secreto de proceso. Lectura acotada de las dos fincas fixture comprueba que toda fila presente pertenece a IDs/finca/nombre del ledger.

Una transaction de cleanup borra individualmente simulaciones32–39 y43 por id+finca_id; luego finca19/20 por id+user_id+nombre fixture y usuarios12/13 por id+nombre fixture. Afectadas exactamente **9 simulaciones,2 fincas y2 usuarios**, COMMIT confirmado. IDs40–42 estaban ausentes por rollback y no se ocultan con DELETE adicional.

El intento inicial ya había borrado id31 y su par A/B mediante su ledger y había verificado counts0. En total, ambos intentos quedaron reconciliados. Ningún DELETE amplio, histórico ajeno, tabla de tracking o reset AUTO_INCREMENT. Huecos de secuencia aceptados por fixtures/rollback.

## 20. Counts finales

| Tabla | Inicial tanda definitiva | Ocho éxitos | Tras cuatro rollbacks | Tras commit/500 | Final |
| --- | --- | --- | --- | --- | --- |
| users | 0 | 2 | 2 | 2 | 0 |
| fincas | 0 | 2 | 2 | 2 | 0 |
| calculos | 0 | 0 | 0 | 0 | 0 |
| irrigation_simulations | 0 | 8 | 8 | 9 | 0 |

Verificados por conexión independiente después de cada request y al cierre. Los400/404/422 y rollback500 no cambian counts; el500 post-commit aumenta exactamente uno, reconciliado y luego limpiado. Sin residuos, listeners cerrados y cero sesiones/transacciones ajenas observadas al finalizar.

## 21. Tracking/schema

Cinco migrations intactas, id/batch1–5; última `20261014000000_extend_irrigation_simulations_v2.js` batch5. Lock index1/is_locked0, comparación exacta pre/final. Ninguna migration o ALTER ejecutado en E4.

44 columnas/14 CHECK ENFORCED sin cambios; definiciones de las seis tablas comparadas pre/final. Fingerprint de SHOW CREATE TABLE irrigation_simulations: `b6f98b19e04dacc2d1e537582d2fe0c519b54e38a91aec04a41c2c7539857bd9`. Secuencias pueden consumir IDs; no se garantiza identidad del contador interno a partir de ese hash ni se lo resetea. Manning no recibió filas ni cambios.

Evidencia privada en `C:/Users/aguer/.codex/private-backups/riegar/20261022-e4/`: primer intento con ledger/evidence/cleanup; subdirectorio attempt-2 con preflight.json, ledger.json, progress.json, evidence.json y summary.json definitivos. ACL protegida fuera de Git. SQL/bindings capturados pertenecen únicamente a queries/fixtures autorizados, sin tokens, host, credenciales o CA path.

## 22. npm test

Después de cleanup: **251 PASS/0 FAIL**, cero skipped/cancelled/todo; duración2314.8745ms. Sin nuevos tests del runner ni cambios de dependencias. Las suites locales conservan sus mocks/loopback; se distinguen de las70 requests de E4 contra DB real.

Sin cambio a código/migrations/config/contratos del repo. Los78 archivos preexistentes conservan SHA-256; solo se agrega este checkpoint. Freeze V1 intacto. git diff --check y whitespace del documento PASS. Sin staging, commit o push.

## 23. Riesgos

No se probaron carreras POST/DELETE, locks de exclusión entre caminos concurrentes, down o restore aislado; no inferirlos de una certificación secuencial. No se desplegó root app completo o frontend ni se certificó login/CORS/TLS público. Todo HTTP fue local y efímero; TLS observado corresponde a la conexión MySQL.

El caso de commit incierto acredita commit real exitoso y error al caller controlado después; no rompe red ni reproduce todos los fallos ambiguos de transporte. Nunca debe etiquetarse como rollback. Restore sigue pendiente bajo la excepción aceptada para dev vacío. No se extiende esa excepción a producción.

La falla de instrumentación inicial se corrigió solo en el harness, se preservó la evidencia interrumpida y se reconciliaron fixtures antes de la nueva tanda. La certificación final no depende de esa métrica incorrecta: el wrapper configurable registra transactions reales y las consultas llegan al cliente trx real. Nuevos writers/drift fuera de la ventana requieren renovar preflight.

## 24. GO / NO-GO E5

**GO técnico para autorizar E5**:

| Criterio | Resultado |
| --- | --- |
| Ownership A/B POST/HISTORY/DETAIL | PASS |
| HTTP local status reales | 70/70 conformes |
| Auth401/403 sin queries | PASS |
| HISTORY multipágina/cursor/empates | PASS |
| Invalid input400 y modelo422 sin INSERT | PASS |
| Cuatro puntos de rollback real | PASS |
| Commit confirmado/respuesta500 y reconciliación sin replay | PASS |
| Máximo un intento por request | PASS |
| Cleanup de ambos ledgers/counts0 | PASS |
| Schema/tracking intactos, lock0 | PASS |
| Regresión local | 251/251 PASS |

El GO acredita preparación y no ejecuta la siguiente fase. **Detenerse: E5 no iniciado, sin carreras POST/DELETE, down, deploy, frontend, commit o push.**
