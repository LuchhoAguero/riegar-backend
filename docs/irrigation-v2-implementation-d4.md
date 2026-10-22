# R4F-D4 — INTEGRACIÓN HTTP V2

Fecha: 2026-10-20. Autorización: continuar D4 después del checkpoint D3. Alcance tomado de R4F-C §35: composición puente/final, POST V2 estricto, HISTORY/DETAIL mixtos y regresión HTTP local con DB simulada. Sin certificación ni operación en DB real.

## 1. Estado Git

Rama `feature/riego-surcos-v1`, HEAD `1f581dfc18f8e9ae18c3a88db1dd4c695a60d1ce`. Se preservan los cambios no commiteados de D1/D2/D3. Baseline D4: 70 archivos fuera de .git/node_modules; 64 idénticos por SHA-256 y seis modificados intencionalmente. Sin staging, commit ni push.

## 2. Archivos modificados

- `src/services/irrigation-simulations.service.js`: selección explícita del descriptor, writer/lectores versionados y consulta HISTORY ampliada.
- `src/routes/irrigation-simulations.http.js`: contrato de entrada por descriptor y proyección pública versionada.
- `src/routes/irrigation-simulations.routes.js`: composición predeterminada del puente usando la nueva factory.
- `src/services/irrigation-simulations.versions.js`: solo comentario actualizado; ACTIVE_DESCRIPTOR continúa siendo ACTIVE_V1.
- `test/irrigation.http.test.js`: un fixture de lectura válida usa pair/rule V1 soportados.
- `test/irrigation.persistence.test.js`: un fixture de service usa pair V1 soportado.

## 3. Archivos nuevos

- `src/routes/irrigation-simulations.router.js`: factory HTTP sin importar configuración DB viva.
- `test/irrigation.v2.http.test.js`: 19 casos nuevos sobre HTTP loopback, service/mappers/persistence reales y DB simulada.
- `docs/irrigation-v2-implementation-d4.md`: este checkpoint.

Persistence D2, mappers, helper snapshot, motores, fixture literal, migrations y documentos anteriores no se modificaron.

## 4. Composición puente

La ruta montada por app conserva su export Express y compone `createIrrigationSimulationRouter(knex)` con ACTIVE_V1 por defecto. POST acepta únicamente el contrato V1. HISTORY/DETAIL ya usan dispatch por fila y pueden leer V1/V2. Esto implementa la release puente de R4F-C §32; no se cambia silenciosamente el POST público a V2.

**Precondición de despliegue: schema ampliado aplicado y certificado.** La consulta HISTORY ahora incluye columnas V2 y model_metadata. Contra schema anterior fallará; no hay fallback silencioso ni autodetección de schema. La migration D3 no fue ejecutada en esta fase.

## 5. Composición final

La misma factory admite `{ descriptor: ACTIVE_V2 }` desde composición del servidor. Esta composición se ejecuta y valida localmente en los tests. El descriptor debe ser exactamente uno de los objetos registrados; copias, strings, null y descriptores inventados fallan al construir servicio/ruta, antes de consultas.

No hay flag público, endpoint alternativo, inferencia por campos ni selección desde body/query. El corte operativo del entrypoint a ACTIVE_V2 sigue pendiente de autorización y coordinación con el consumidor R5. No se modifica configuración de entorno para activarlo.

## 6. Descriptor compartido

La factory captura una única referencia validada y la entrega al service y a `postInput`. El service obtiene de ella el calculator por defecto y el writer; el facade comprueba que el resultado pertenezca a ese descriptor. Se conserva la inyección privada de calculator/reloj para pruebas; un calculator inyectado que devuelve otro contrato es rechazado antes del INSERT. Las peticiones no pueden proporcionar estas dependencias.

## 7. POST V2 estricto

Mismo endpoint `/api/fincas/:fincaId/irrigation-simulations`. En la composición V2 acepta spacing y count; widthM se rechaza con 400/INVALID_REQUEST y field `furrow.widthM`. Ausencia de spacing/count y tipos/rangos inválidos reciben 400/INVALID_IRRIGATION_INPUT con fields del motor. Count no admite coerción, fracciones, cero o valores superiores al entero seguro.

En puente, spacing/count se rechazan y widthM continúa válido. No se aceptan simultáneamente bodies V1 y V2.

## 8. Autoridad del servidor

El filtro HTTP sigue rechazando versiones, hashes, metadata, diagnostics, output, IDs/propietarios y campos derivados o excluidos. Un selector de contrato en query se rechaza antes de la transacción. Name sigue siendo opcional, nullable, con trim y capacidad de 255 puntos de código Unicode.

## 9. GV2-01

POST V2 devuelve 201 con comparación exacta contra el fixture literal aprobado: input completo, 19 magnitudes, metadata completa, sourceHash/model/contract y P02/P04. Writer genera 43 valores; spacing ocupa width_m y count ocupa furrow_count. JSON se serializa una vez en persistence, sin recalcular ni redondear resultados.

## 10. Consumo cero y MAX_SAFE

ETo cero o coeficiente de cultivo cero producen 201, daily=0 y ambos plazos explícitamente null en respuesta y almacenamiento simulado. No se inventa una nueva regla diagnóstica. MAX_SAFE count se prueba con retorno string canónico del driver simulado y se devuelve como Number exacto. Es evidencia del adapter, no roundtrip MySQL real.

## 11. Errores de modelo

Se conserva el mapeo 400 para input, 422 para inconsistencia/no finitud y 503 para modelo no implementado. V2 prueba relación inválida, balance imposible, overflow y underflow positivo. Los errores públicos conservan únicamente los campos string permitidos y no incluyen received, stack ni outputs parciales. No se cambian categorías P01–P05 ni se agregan D01–D08.

## 12. Transacción de creación

Permanece: transaction → finca propia con shared lock → cálculo una vez → writer → INSERT una vez → readback dentro de la misma trx → retorno del callback → commit → 201. DB simulada registra el orden y verifica que todas las consultas de creación usan trx. Ningún cálculo o INSERT se realiza cuando la finca no pertenece al usuario.

## 13. Fallos y commit incierto

Fallos simulados en INSERT, readback ausente, lectura, corrupción del readback y commit devuelven 500 genérico; las pruebas de rollback no dejan filas cuando el doble modela un fallo previo al commit.

Otro caso modela explícitamente una escritura persistida seguida de pérdida del acuse: POST devuelve 500 sin repetir cálculo/transacción/INSERT, y HISTORY/DETAIL permiten encontrar la fila. No se implementa retry, replay ni idempotencia. Este escenario no acredita comportamiento transaccional real ni garantiza rollback cuando el estado de commit es incierto.

## 14. HISTORY mixto

Service llama `listVersionedSnapshots`; conserva ownership por join, orden descendente fecha/id, cursor v1 y limit+1. Cada fila se despacha por su versión almacenada. Summary V1 conserva su shape y omite count/total nuevos; V2 agrega exactamente furrowCount y totalAppliedVolumeL. appliedVolumeL sigue siendo por surco. No se expone model_metadata, input o totalM3 en HISTORY.

El doble aplica realmente la proyección select para evitar que un test pase usando columnas no seleccionadas. D2 mantiene su prueba adicional de SQL Knex offline para esa proyección.

## 15. Paginación y ownership mixtos

Prueba empates de timestamp V1/V2 normal/V2 zero, dos páginas sin duplicados, exclusión de otras fincas y cursor Base64URL `{v:1,createdAt,id}`. El cursor sigue saliendo del último elemento devuelto y la página terminal entrega null. Sin OFFSET ni cambio al parser de cursor/limit. Los tests previos conservan sus matrices de cursores malformados y queries repetidas.

## 16. DETAIL mixto

Usa la query existente select s.* con ownership y dispatch del facade por fila. V1 mantiene widthM y sus 14 magnitudes; V2 conserva spacing/count, 19 magnitudes y días null legítimos. Pruebas sobre ambas composiciones preservan números históricos distintos de los actuales, parámetros históricos y mensajes almacenados sin cálculo ni mutación. No se fabrican extensiones V1.

## 17. Metadata pública

`publicSnapshot` delega a la proyección versionada de D2. Devuelve las cinco secciones del envelope y las nueve secciones superiores de metadata permitidas para la versión almacenada. Se conserva su contenido histórico; se elimina metadata superior privada. No se usa el template activo para reemplazar parámetros o mensajes.

## 18. Storage inválido

Un contrato desconocido, pair cruzado, hash/schema/rule incompatible, JSON inseguro, count ambiguo o total requerido ausente produce 500/INTERNAL_ERROR genérico en HISTORY y DETAIL. Se prueba tanto con puente como con composición final. Días incoherentes en DETAIL V2 y extensiones no NULL en DETAIL V1 también producen 500. No se transforma corrupción de storage en 400 de input ni se aplica fallback a la versión activa.

## 19. Auth, rutas y compatibilidad

Auth permanece antes de handlers; faltante/inválido conserva 401/403 antes de consultas. Finca ajena/inexistente y snapshot fuera de la finca conservan 404 indistinguible. IDs INT UNSIGNED estrictos, query vacía de POST/DETAIL, Content-Type 415 y métodos inmutables sin nuevas rutas. Parser JSON/límite/CORS/app no se modifican y sus regresiones existentes pasan. DELETE finca y Manning quedan intactos.

## 20. Ajustes de fixtures anteriores

R4F-C §30 anticipa que las versiones inventadas usadas en pruebas de lectura válida deben pasar a pairs soportados al integrar el registry. Se ajustan únicamente el test HTTP histórico y el test de history/detail del service; se conservan sus controles de mensajes/parámetros, no recálculo, paginación y metadata. El test directo del mapper legacy con versión inventada permanece intacto. La nueva suite comprueba desconocidos→500, sin ampliar el registry ni debilitar la frontera versionada.

## 21. Tests focalizados

`node --test test/irrigation.v2.http.test.js test/irrigation.http.test.js test/irrigation.persistence.test.js`: **46 PASS / 0 FAIL**. Desglose: 19 nuevos D4 +16 HTTP anteriores +11 persistence anteriores. Cero skipped/cancelled/todo. Solo HTTP local loopback, JWT sintético y DB en memoria; ningún correo o servicio externo.

## 22. Regresión total

`npm test`: **249 PASS / 0 FAIL**, cero skipped/cancelled/todo. Base D3 de 230 entradas +19 D4. Incluye D1 30 casos lógicos y una entrada de fixture, D2 26, D3 ocho y regresiones previas. Dos fixtures de suites existentes ajustados como §20; no se eliminan casos. Sin instalaciones o actualizaciones de dependencias.

## 23. Hash freeze V1

Tres hashes SHA-256 verificados contra el baseline y el freeze:

| Archivo bajo src/services/irrigation/ | SHA-256 |
| --- | --- |
| irrigation-models.js | 6a1302569db4bd5902fb02d9ab08b6b131cd8bb155e510766dfff3937464afe8 |
| irrigation-validation.js | 7353589ce6810764085cbf9a1badb59e3458b8231e1a8acacae1ad1ed4b235a7 |
| irrigation-calculator.service.js | b2c785847f4962be991fb72a0986b9e5f2f8f1d8063e2a99cda2579f11ff1380 |

## 24. Revisión y diff check

Revisión propia de composición, filtro HTTP, fronteras de storage/error, query de HISTORY y orden transaccional. `git diff --check` PASS; también se comprueba whitespace en los tres archivos nuevos y en el registry sin seguimiento. Los únicos seis archivos preexistentes cambiados son los de §2; los otros 64 conservan SHA-256. Los avisos Git sobre futura conversión LF/CRLF no normalizan archivos durante esta fase.

## 25. Riesgos y límites

**No ejecutar/desplegar este puente sobre el schema anterior.** La consulta ampliada necesita migration aplicada y certificada. No se ejecutó MySQL/Aiven/TLS, DDL, INSERT real, backup/restore ni pruebas de carreras/locks con conexiones reales. La simulación de shared lock/rollback/commit no sustituye D5. Un binario V1 original tampoco debe usarse como rollback después de almacenar V2; el puente es el piso lector definido por el diseño.

No se inicia frontend R5 ni el corte coordinado a POST V2. No claims agronómicos ni cambios a surface area, runoff, totales recomendados, calibración, reintentos o idempotencia. No hay blocker lógico detectado dentro de las pruebas locales; la preparación operativa depende de certificación posterior.

## 26. Estado técnico y siguiente fase

**D4 implementado y validado en alcance local/mocks.** Puente V1 predeterminado y composición final V2 disponibles; lecturas mixtas integradas y regresión global PASS. No significa HTTP V2 público activado ni persistencia V2 real certificada.

Listo para definir y autorizar la certificación posterior D5/R4F-E, respetando el ambiente y operaciones concretamente autorizados. **Detenerse: no se inicia esa fase, no se toca DB real ni se despliega, commitea o pushea.**
