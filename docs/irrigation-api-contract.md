# R4 — Contrato HTTP y persistencia interna de simulaciones

Fecha: 2026-10-13. R4A/R4B/R4C/R4D aprobados; R4E congela el backend MVP (§15) tras certificación real Aiven. DELETE finca seguro preservado. Las secciones anteriores conservan su alcance histórico; HTTP implementado en §14, evidencia real en irrigation-r4d-certification.md y guía R5 en irrigation-backend-freeze.md. R4E solo cambia documentación, sin fixtures, motor, frontend o schema.

Fuentes: [irrigation-engine-contract.md](irrigation-engine-contract.md), freeze R3D; [irrigation-data-model.md](irrigation-data-model.md), R2/B01:B20/UTC; [irrigation-model.md](irrigation-model.md), A01:A10. Motor congelado: irrigation-estimation-v1, irrigation-contract-v1, irrigation-metadata-v1, irrigation-diagnostics-v1. No incompatibilidad que requiera modificarlo.

## 1. Auditoría inicial y convenciones reales

Backend CommonJS. src/app.js monta routers Express directamente; rutas completas /api/... declaradas en cada archivo. src/server.js valida configuración antes de iniciar. No controllers/repositories ni transacciones explícitas en las rutas inspeccionadas antes de R4A. Knex compartido en src/config/knex.js; conexión construida por src/config/database.js con timezone Z y TLS. Ningún acceso nuevo a configuración/env o DB durante este trabajo.

Auth existente: middleware JWT, req.user.userId como identidad; 401 sin token y 403 inválido/expirado. Fincas usan where({id,user_id}); cálculo individual Manning usa join a fincas con propietario. Finca ajena/inexistente comparte 404. Errores HTTP mantienen error como texto; Manning añade code/fields para fallos esperables y usa 400/422. Fallos inesperados producen 500 genérico. Parser JSON de app.js devuelve 400 invalid_input sin body/stack; no se modifica.

Tests usan node:test/assert, HTTP local con fetch y sustitución module-local de Knex antes de importar rutas. Auth/Express funcionan realmente; DB y SMTP son mocks. R4A reutiliza esa estrategia para el DELETE, con un doble transaccional que conserva estado de filas. Manning individual, historial y UTC tienen regresiones existentes preservadas.

## 2. R4-BLOCKER-DELETE-FINCA: correctivo implementado

Antes: ownership → DELETE calculos → DELETE fincas sin transacción. La FK RESTRICT de irrigation_simulations podía impedir el último paso después de perder Manning.

Ahora, en DELETE /api/fincas/:id:

1. Auth existente antes de cualquier transacción/consulta.
2. knex.transaction(callback); todas las consultas usan trx.
3. SELECT de finca con id y user_id autenticado, FOR UPDATE, first(). Bloquea el padre propio durante el precheck/borrados.
4. Si no existe/no pertenece: 404 existente, sin consultar simulaciones ni escribir. La transacción read-only termina sin cambios.
5. Comprobar existencia de una simulación por finca_id, SELECT id LIMIT 1; no contar ni devolver datos. El índice R2 empieza por finca_id.
6. Si existe: lanzar conflicto controlado; callback aborta, rollback, sin borrar ninguna tabla.
7. Si no existe: borrar calculos Manning de esa finca y borrar finca con id/user_id, dentro de la misma transacción.
8. Responder éxito histórico solo después de completar commit. Error en precheck, borrado o transacción: rollback gestionado por Knex; nunca responder éxito antes de resolver la transacción.

Política: no borrar simulaciones, cambiar FK, CASCADE, soft-delete o deshabilitar constraints. Una finca con simulaciones conservadas no se elimina; Manning permanece. Una finca sin simulaciones mantiene la eliminación histórica, ahora atómica.

| Situación | HTTP / code | Respuesta pública |
| --- | --- | --- |
| Simulación detectada antes de escribir | 409 / FARM_HAS_IRRIGATION_SIMULATIONS | error: La finca posee simulaciones de riego guardadas y no puede eliminarse. |
| FK impide borrar dependencias al final | 409 / FARM_DELETE_CONFLICT | error: La finca tiene registros asociados y no puede eliminarse. |
| Finca ajena/inexistente | 404, formato previo | error: Finca no encontrada o no tienes permiso. |
| Eliminación completa | 200, formato previo | message: Finca y sus cálculos eliminados correctamente. |
| Otro fallo | 500, formato previo | error: Error en el servidor. |

El segundo código es deliberadamente genérico: ER_ROW_IS_REFERENCED_2 / errno 1451 puede representar una dependencia final y no debe atribuirse sin evidencia a una simulación concreta. No se expone SQL, constraint, IDs, cantidad o contenido de dependientes. El precheck sí conoce la causa y utiliza el código específico.

### Concurrencia y límites de evidencia

En InnoDB, el bloqueo exclusivo del padre coordina DELETE con operaciones que necesitan el padre/FK. Una inserción de hijo concurrente debe esperar o completarse antes de que se obtenga el bloqueo; al insertar después de un borrado confirmado, la FK la rechaza. La FK sigue siendo defensa final, aunque el precheck pareciera indicar cero. Si el DELETE final falla, la transacción revierte también Manning.

Esto presupone los engines transaccionales certificados en R2 y las FK activas; R4A no vuelve a certificar el servidor. No se introducen reintentos automáticos, bloqueos de tablas ni cambios del aislamiento. Deadlock/timeout inesperado deja 500 genérico y transacción abortada; tratamiento adicional podrá revisarse con evidencia al integrar R4B. Fallos de comunicación durante COMMIT pueden dejar resultado incierto al cliente; no prometer resolución de incertidumbre distribuida ni reintentar escrituras a ciegas.

Tests simulan un dependiente que aparece después del precheck para forzar la defensa final; no afirman que un inserter real atraviese FOR UPDATE. Se demuestra rollback sobre estado de filas del doble, incluyendo eliminación Manning provisional, y se usa la API transaccional real de Knex en producción. No hubo prueba de rollback/locking contra MySQL real.

R4-BLOCKER-DELETE-FINCA queda corregido a nivel código y pruebas locales. Certificación real de concurrencia/rollback queda para una fase autorizada; no se habilitan guardados aún.

## 3. Rutas propuestas R4B

| Método | Ruta | Uso |
| --- | --- | --- |
| POST | /api/fincas/:fincaId/irrigation-simulations | Calcular y guardar un nuevo snapshot |
| GET | /api/fincas/:fincaId/irrigation-simulations | Historial paginado de finca propia |
| GET | /api/fincas/:fincaId/irrigation-simulations/:simulationId | Snapshot individual propio |

Sin prefijo adicional ni alteración de rutas Manning. No PUT/PATCH/DELETE de simulaciones en MVP inicial. Recalcular significa nuevo POST y nueva fila. No endpoint público o preview que guarde parcialmente.

## 4. POST request y adaptación

Propuesta: body objeto con exactamente name opcional y los cuatro grupos canónicos, sin envoltorio input adicional:

```json
{
  "name": "Surco norte",
  "crop": { "etoMmPerDay": 5, "cropCoefficient": 0.7, "daysWithoutIrrigation": 20 },
  "soil": {
    "texture": "Franco", "fieldCapacityPct": 20, "wiltingPointPct": 10,
    "bulkDensityGcm3": 1.3, "rootDepthM": 0.7, "depletionThresholdPct": 60
  },
  "furrow": { "widthM": 1.3, "lengthM": 60, "slopePct": 0 },
  "irrigation": { "flowLps": 0.9, "durationMin": 60, "advanceTimeMin": 4.8 }
}
```

Todos los 14 números deben ser Number finitos en sus unidades canónicas; no conversión de strings/bools/null ni horas/fracciones alternativas. Soil.texture mantiene la normalización R3A: texto trim no vacío hasta 64 caracteres o ausencia/null→null; nunca autocompleta CC/PMP. No defaults de suelo ni parámetros por textura.

Name propuesto: ausente o null→SQL NULL; si texto, trim, no vacío, máximo 255 caracteres Unicode por puntos de código, compatible con VARCHAR(255). Otro tipo o cadena vacía→400. No nombre por defecto. Se fija al crear y no se modifica. La aceptación de null es recomendación explícita R4A para ausencia opcional, a confirmar en R4B.

Raíz y grupos solo admiten campos permitidos. Rechazar, no ignorar ni copiar: output/outputs, diagnostics, modelVersion, contractVersion, sourceHash, metadata, created_at/createdAt, fincaId/finca_id, userId/user_id, finca.user_id, inputs excluidos o overrides de constantes. Separar name y pasar solo crop/soil/furrow/irrigation al motor; la validación de desconocidos debe ocurrir antes de construir esa selección para no esconder una inyección.

Propuesta para IDs de rutas nuevas: entero decimal positivo de INT UNSIGNED (1..4294967295), sin exponentes/fracciones/coerción parcial; validar antes de consulta para evitar conversión permisiva de MySQL. Fallo sintáctico→400 INVALID_ROUTE_PARAMETER. No se cambia en R4A la política histórica de parámetros del DELETE existente.

## 5. Ownership y flujo POST futuro

Auth → validar parámetros de ruta → verificar finca por fincaId y req.user.userId → adaptar body permitido/name → motor congelado → si ok:false, responder error sin fila → si ok:true, mapear e insertar snapshot → commit → respuesta 201.

Finca ajena o inexistente: mismo 404, antes de ejecutar motor o validar datos agronómicos/persistir. La validación sintáctica JSON sucede previamente en Express, igual que en rutas actuales. No confiar en user_id del body ni aceptar versiones/outputs del cliente como autoridad. No devolver información sobre simulaciones de otra finca.

## 6. Error mapping conceptual

Formato compatible: {error: texto seguro, code: código de aplicación, errors: errores estructurados cuando aplica}. Es propuesta HTTP, no modificación del contrato puro. Copiar solo campos permitidos de errores esperables; no stacks, SQL o payload completo. Los clientes pueden mostrar detalles por field/rule; el texto no es clave de negocio.

| Origen / código | HTTP propuesto | Política |
| --- | --- | --- |
| JSON malformado | 400 / invalid_input existente | Parser de app.js, sin stack/body |
| Body/root, name o campos HTTP inválidos | 400 / INVALID_REQUEST | Detalles seguros por campo; no defaults/coerción |
| ID/cursor/limit inválidos | 400 / INVALID_ROUTE_PARAMETER o INVALID_PAGINATION | Sin consulta SQL construida desde texto recibido |
| INVALID_SHAPE, UNKNOWN_FIELD, MISSING_FIELD, INVALID_TYPE, NON_FINITE_NUMBER, OUT_OF_RANGE, INVALID_RELATIONSHIP | 400 / INVALID_IRRIGATION_INPUT | errors conserva códigos/rules/fields del motor |
| MODEL_INCONSISTENCY, NON_FINITE_RESULT | 422 / IRRIGATION_MODEL_INCONSISTENCY | Error de estimación/dominio esperable; sin insertar ni output parcial |
| INVALID_DIAGNOSTIC, FATAL_DIAGNOSTIC del guard | 422 / IRRIGATION_MODEL_INCONSISTENCY | No admitir snapshot; registrar la anomalía del servidor de forma segura |
| MODEL_NOT_IMPLEMENTED reservado | 503 / IRRIGATION_MODEL_UNAVAILABLE | Defensa de integración; v1 no lo emite |
| Finca o snapshot ajeno/inexistente | 404 / RESOURCE_NOT_FOUND | Mismo mensaje genérico por recurso |
| Auth | 401/403 existentes | Conservar middleware actual |
| Fallo inesperado de aplicación/DB/parseo de snapshot guardado | 500 genérico | Sin stack/SQL al cliente; no reinterpretar corrupción como resultado |

Se acumulan errores del motor sin renombrarlos. Si una defensa detecta múltiples categorías, input→400; fallos del cálculo/output→422. No 500 para errores matemáticos esperables. Errores inesperados lanzados por el motor sí son 500 genérico.

## 7. POST success / GET detail

Propuesta 201 tras commit y 200 para detalle, con la misma representación histórica:

```text
{
  simulation: { id, name, fincaId, createdAt },
  model: { modelVersion, contractVersion, sourceHash },
  input: { crop, soil, furrow, irrigation },
  output: { waterNeed, soilWater, application, efficiency,
            diagnostics: { advanceRatioPct, maxNonErosiveFlowLps, items } },
  metadata: modelMetadata
}
```

CreatedAt ISO UTC con Z y milisegundos; id/fincaId como números seguros del rango INT UNSIGNED. Name string/null. Input/output reconstruidos del snapshot, sin recalcular usando la versión actual. Diagnostics reside solo en output.diagnostics.items para preservar el shape congelado y evitar duplicar arrays; los dos números diagnósticos mantienen sus campos. No envelope ambiguo de una ejecución que aún no se guardó.

Recomendación de metadata: exponer en POST/detail la metadata completa declarada del motor congelado, que ya contiene solo parámetros/unidades/supuestos/procedencia seguros y distingue not_validated. Usar una selección explícita de las secciones R3: metadataSchemaVersion, effectiveParameters, units, assumptions, evidenceState, referenceVersions, implementationReference, diagnosticRules, parameterProvenance. Sin incorporar campos internos nuevos de DB/debug automáticamente. Historial usa proyección resumida. Este criterio evita ocultar límites estimativos y no convierte al frontend en autoridad; queda para aprobación R4B.

Una inserción atómica no basta para certificar el adapter: R4B deberá probar JSON→objeto/array, DOUBLE sin redondeo y Date UTC. Para que POST y detalle coincidan, retornar el snapshot guardado dentro de la transacción o construir la respuesta de los valores efectivamente guardados bajo una serialización certificada. No marcar success antes del commit.

## 8. GET history y paginación

Ownership de la finca antes de leer historial; filtro finca_id siempre impuesto por servidor. Orden created_at DESC, id DESC, alineado con índice R2 (finca_id, created_at, id). No cursor por fecha solamente ni OFFSET ilimitado.

Propuesta MVP: limit por defecto 20, máximo 100; parámetro opcional entero decimal estricto 1..100. Cursor opcional base64url de JSON UTF-8 {createdAt: ISO UTC exacto con milisegundos, id: INT UNSIGNED positivo}; tamaño máximo 256 caracteres. Validar shape exacto/tipos/fecha real/canonicalización antes de usar. Cursor es posición, no credencial ni autoridad de finca. No necesita firma para aislamiento: ownership/filtro de finca no dependen de su contenido; manipularlo solo cambia la posición de búsqueda dentro de datos propios.

Página siguiente: created_at < cursor.createdAt OR (created_at = cursor.createdAt AND id < cursor.id), agrupado bajo finca_id. Todos los valores como bindings Knex; nunca interpolar SQL desde cursor. Solicitar limit+1, devolver como máximo limit; si sobra fila, hasMore=true y nextCursor desde la última fila devuelta, no desde la descartada. Sin total/count por defecto.

Respuesta 200 propuesta:

```text
{
  items: [{ simulation: {id,name,fincaId,createdAt}, model: {...},
            summary: {targetDepthMm,appliedVolumeL,applicationEfficiencyPct} }],
  pagination: { limit, hasMore, nextCursor: cursorOrNull }
}
```

Items vacíos son éxito si la finca es propia; nextCursor=null al finalizar. Summary conserva números del snapshot, sin redondeo. UI deberá identificar eficiencia estimada, no medida. No duplicar input/metadata/diagnósticos completos en todas las filas de historial: se obtienen en detalle. Paginación no promete una fotografía inmutable de todas las páginas si llegan nuevas filas entre lecturas; el cursor conserva orden/desempate estable.

## 9. GET detail e inmutabilidad

Usar relación/JOIN con fincas y filtrar simultáneamente simulation.id, simulation.finca_id, fincas.id y fincas.user_id autenticado. Nunca devolver SELECT por simulationId sin ownership. FincaId del path y de la fila deben coincidir. Ajeno/inexistente: 404 idéntico, sin filtrar existencia. No usar información histórica de otro usuario en mensajes.

Sin PUT/PATCH/DELETE de simulaciones durante MVP inicial. Nombre, inputs, outputs, versiones, metadata y diagnósticos son inmutables. Cambio de datos/recálculo crea una fila nueva. La prohibición es de aplicación; no hay nuevos triggers/permisos DB que impidan cambios administrativos. No borrar snapshots para facilitar DELETE finca.

## 10. Mapping motor → DB y transacción POST propuesta

Mapping R3D intacto: input→15 columnas; output→14 columnas; modelVersion→model_version; contractVersion→contract_version; sourceHash→source_hash; metadata→model_metadata; output.diagnostics.items→diagnostics. finca_id/name/created_at provienen de aplicación. ID autoincremental, sin updated_at, sin campos excluidos o conversiones duplicadas.

Timezone Z sigue en la factory compartida. Generar Date del servidor al guardar; no fecha local formateada, offset manual ni fecha del cliente. MySQL DATETIME(3) no incorpora zona; conservar las condiciones UTC certificadas en R2 y revalidarlas si cambia entorno.

Recomendación mínima R4B: una transacción corta con SELECT de finca propia FOR SHARE, adaptación/validación y cálculo puro rápido, una INSERT y commit. FOR SHARE coordina con FOR UPDATE del DELETE de finca y permite creaciones concurrentes que solo leen el mismo padre. Ownership antes de motor y bloqueo retenido hasta insertar/commit; sin trabajo externo dentro de la transacción. Fallo esperado aborta sin fila. FK protege existencia; filtro user_id y lock protegen ownership en ese flujo. No locks globales ni transacciones abiertas durante respuesta HTTP.

Si DELETE obtiene primero el lock y confirma, POST encuentra finca ausente y responde 404 sin cálculo/inserción. Si POST retiene primero el lock compartido, DELETE espera y después detecta la nueva simulación/rechaza el borrado. FK sigue como defensa final. Una sola INSERT es atómica por sí misma; la transacción/lock se justifica por coordinación ownership/DELETE, no por dividir el snapshot en varias tablas. R4B debe comprobar sintaxis real Knex/MySQL y comportamiento de bloqueo con tests apropiados antes de certificarlo en DB. No reintentos automáticos de POST tras incertidumbre de commit; idempotencia no está implementada ni prometida en R4A.

## 11. Separación mínima propuesta para R4B

- src/routes/irrigation.routes.js: middleware auth, parsing de parámetros, contrato HTTP y respuesta.
- src/services/irrigation-simulations.service.js: coordinación ownership/transacción/name y llamada al motor.
- Acceso Knex mediante funciones pequeñas del servicio o helper específico si es necesario; no crear un framework ni repository genérico. Si el mapping/list/detail justifica separación, helper irrigation-simulations.persistence.js fuera del directorio puro, con dependencia explícita de Knex/trx.
- src/services/irrigation/: exclusivamente motor congelado; sin imports de HTTP/DB/application ni cambios de modelos.

La ubicación/extraer helper es una decisión de implementación futura, no archivos creados en R4A. No registrar routers de simulaciones ahora.

## 12. QA y decisiones pendientes R4B

Nuevo test/fincas.delete.http.test.js: nueve tests, incluyendo A–H del pedido, auth 401/403, aislamiento de otras fincas y fallos precheck/calculos/commit. HTTP/JWT/ruta reales sobre doble transaccional; rollback comprobado por filas conservadas después de borrados provisionales. Rechazo FK se simula con code y errno. No certificación de transacciones/locks reales Aiven.

Focalizados DELETE/Manning/HTTP existente/schema-startup: 66 PASS / 0 FAIL. Suite completa al cierre: 138 PASS / 0 FAIL. Todos los tests R3 intactos. Cambio runtime único: DELETE existente de finca. Motor, cuatro migrations, schema, UTC, auth/app/server, otras routes, dependencias y frontend sin cambios. Sin DB real, commit o push.

Para R4B revisar/aprobar: request plano y name null, nombres/categorías de errores HTTP, exposición de metadata, representación de detalle/history, limit 20/max 100, cursor y validación de IDs, transacción FOR SHARE, separación mínima y política de incertidumbre/reintentos. No habilitar inserciones reales por aprobación implícita del diseño.

R4A deja resuelto el blocker a nivel implementación local y preparado un contrato revisable. R4B requerirá mapping/JSON/UTC/DOUBLE, tests HTTP/ownership y ensayos de persistencia autorizados por separado. Pendientes agronómicos R3 permanecen; presentar siempre modelo estimativo. R4A termina aquí sin iniciar R4B.

## 13. R4B — Persistencia y coordinación interna implementadas

### 13.1. Arquitectura y API interna

Tres módulos CommonJS fuera del motor puro, coherentes con la separación propuesta en §11:

| Archivo src/services/ | Responsabilidad / exports principales |
| --- | --- |
| irrigation-simulations.mapper.js | mapCalculationToSnapshot, mapStoredDetail, mapHistorySummary, normalizeName, validId, validatePagination; funciones puras y errores de aplicación |
| irrigation-simulations.persistence.js | insertSnapshot, findOwnedFarm, listSnapshots, findSnapshot; Knex/trx aportado por caller |
| irrigation-simulations.service.js | createIrrigationSimulationService(knex, {calculate?,now?}); create/history/detail |

La factory pequeña recibe Knex explícito; no es framework de inyección ni repository genérico. No importa configuración real ni crea conexión al cargar el módulo. Los overrides calculate/now permiten tests deterministas; solo son dependencias internas del servidor, nunca valores del cliente. El directorio src/services/irrigation/ sigue exclusivamente puro e intacto. No router nuevo, cambios de app.js o registro HTTP.

create({userId,fincaId,name,canonicalInput}), history({userId,fincaId,limit?,cursor?}) y detail({userId,fincaId,simulationId}) usan IDs internos Number enteros positivos del rango INT UNSIGNED. R4C adaptará parámetros HTTP con parsing estricto. El body futuro no suministra userId ni timestamp/versiones/outputs. La capa HTTP deberá rechazar desconocidos antes de seleccionar canonicalInput.

### 13.2. Mapper y schema R2

mapCalculationToSnapshot({fincaId,name,calculationResult,createdAt}) admite únicamente ok===true, input/output completos bajo los validadores congelados, hash lowercase de 64 hex, metadata objeto JSON y diagnostics array. No calcula derivados ni reconstruye metadata. Mapeo por los descriptores sqlColumn del contrato congelado: exactamente 15 inputs y 14 outputs, más finca_id/name, tres claves de reproducción, dos JSON y created_at: **37 columnas de inserción**. El id autogenerado completa las 38 columnas de tabla; no se inventa ni envía id/updated_at.

Valores Number copiados exactamente desde el motor, sin defaults, clamp, redondeo o null para outputs. Se compara el golden con tolerancia R1 y la identidad mapper→motor con igualdad de Number. Una diferencia de último bit frente al decimal impreso no se corrige: en este runtime, G01 efficiency se conserva como 82.21921916437786. No altera las fórmulas/modelVersion.

Name undefined/null→null; texto trim, no vacío y máximo 255 puntos de código Unicode; sin truncar/nombre automático. Error tipado IrrigationApplicationError con code=INVALID_APPLICATION_INPUT y field. createdAt obligatorio como Date válido en rango DATETIME (años UTC 1000..9999), copia independiente. La coordinación genera new Date() por defecto; nunca timestamp del canonicalInput/cliente. Timezone Z existente permanece.

Objeto JSON copiado recursivamente sin stringify/reparse para clonar: solo datos JSON finitos/acíclicos, sin accesores, arrays sparse o objetos especiales. Metadata, diagnostics y Date no comparten referencias mutables con el cálculo/caller. Resultado fallido/incompleto o snapshot inseguro provoca TypeError interno, nunca fila parcial.

### 13.3. Serialización y consultas de persistencia

La inspección del Knex/mysql2 instalado confirma consultas MySQL text-protocol vía connection.query(sql, bindings), sin inferir tipos de columnas del schema para bindings JSON. insertSnapshot(trx,snapshot) serializa **exactamente una vez** model_metadata y diagnostics con JSON.stringify, después de recibir objeto/array validados del mapper; rechaza serialización previa. Mantiene Date y Number como bindings nativos y no altera snapshot. No JSON string anidado ni defaults. La equivalencia estructural se verifica parseando únicamente las cadenas destinadas a DB en tests, no recalculando.

insertSnapshot hace una sola INSERT y devuelve el ID. No abre transacción propia ni conexión global. Errores del driver se propagan. No reintenta, cambia finca, ignora constraints ni altera metadata.

SQL de propiedad compilado offline con Knex 3.1.0/mysql2:

```sql
select * from `fincas` where `id` = ? and `user_id` = ? limit ? lock in share mode
```

forShare() emite LOCK IN SHARE MODE, bloqueo compartido válido para MySQL 8.4. Se mantiene hasta terminar la transacción. Compatible con FOR UPDATE del DELETE R4A; FK sigue como defensa final. No declaración de locking real certificado: compilación no es ejecución MySQL.

listSnapshots filtra siempre s.finca_id y f.user_id mediante JOIN adicional a fincas, incluso después del ownership inicial. detail también filtra simulationId/fincaId/userId en la misma consulta JOIN; nunca simulation ID aislado como autorización. Esta defensa evita filtrar snapshots por una carrera entre verificación y lectura.

```sql
select /* columnas de resumen */ ...
from `irrigation_simulations` as `s`
inner join `fincas` as `f` on `s`.`finca_id` = `f`.`id`
where `s`.`finca_id` = ? and `f`.`user_id` = ?
  and (`s`.`created_at` < ? or (`s`.`created_at` = ? and `s`.`id` < ?))
order by `s`.`created_at` desc, `s`.`id` desc limit ?
```

La línea select anterior es abreviatura documental; el test inspecciona SQL real y bindings, incluidos ambos timestamps, id y limit+1. No OFFSET ni interpolación de cursor en SQL.

### 13.4. Transacción de creación y resultados del servicio

create valida IDs internos → BEGIN → SELECT finca propia FOR SHARE → si falta, FARM_NOT_FOUND sin motor → normaliza name → motor síncrono congelado → si ok:false, MODEL_ERROR sin INSERT → mapper con now() de aplicación → una INSERT → recuperar fila por ID/finca/usuario dentro de trx → mapStoredDetail → COMMIT → SUCCESS con snapshot recuperado.

El cálculo es rápido y sin IO, por lo que retener un lock compartido mientras calcula mantiene corta la transacción sin abrir carrera ownership/INSERT. No llamada externa ni respuesta HTTP dentro del callback. La factory retorna la promesa transaccional; SUCCESS solo llega al caller después de commit. FARM_NOT_FOUND/MODEL_ERROR terminan como transacciones de lectura sin escrituras. Name inválido, error inesperado del motor, INSERT/FK, readback o mapper histórico fallido rechazan y revierten la transacción; no retornan éxito parcial.

Resultados internos: {kind:SUCCESS,snapshot}, {kind:FARM_NOT_FOUND}, {kind:MODEL_ERROR,errors}; detail añade {kind:SIMULATION_NOT_FOUND}; history usa {kind:SUCCESS,items,pagination}. Sin status HTTP. Fallos de persistencia inesperados se **lanzan** al caller, en vez de devolver PERSISTENCE_ERROR con detalles del driver; R4C los traducirá a 500 genérico. IrrigationApplicationError es fallo de aplicación esperable para su futuro mapping 400. Excepciones de programación no se convierten en resultados matemáticos.

Si DELETE gana primero, propiedad deja de existir y no se calcula/inserta. Si create gana el lock compartido e inserta/commit, DELETE espera y después detecta simulación/rechaza. FK mantiene protección final ante referencias inválidas; un error de INSERT revierte todo y se propaga sin retry. Estos efectos de concurrencia siguen pendientes de prueba real autorizada. Incertidumbre de comunicación en commit no se oculta ni se reintenta automáticamente.

### 13.5. Historial, detalle y paginación

history valida IDs/paginación, verifica propiedad primero y después consulta persistencia con filtro doble de finca/usuario. Motor nunca se llama para lecturas. Proyección SQL mínima: id,finca_id,name,created_at,model_version,contract_version,source_hash,target_depth_mm,applied_volume_l,application_efficiency_pct,diagnostics. No metadata ni todos los inputs en listado.

mapHistorySummary devuelve simulation y model según §7; summary con targetDepthMm/appliedVolumeL/applicationEfficiencyPct y diagnostics={count,severities}. Severities es conjunto único en el orden histórico de aparición, no una evaluación de reglas actuales. Se lee el JSON original para ese resumen; ningún mensaje se reescribe. Detail mantiene toda la información.

Paginación interna: limit Number entero default20/max100. Cursor canónico {createdAt:ISO UTC YYYY-MM-DDTHH:mm:ss.sssZ,id:Number}, sin claves extra y con fecha real verificada. validatePagination convierte fecha una vez a Date UTC para bindings. La codificación base64url queda para R4C; R4B no recibe cadenas de cursor HTTP ni tiene router.

Persistencia solicita limit+1, servicio descarta la fila extra y usa la última **devuelta** para nextCursor, con fecha ISO UTC e id. Sin fila extra: nextCursor=null. Test con timestamps iguales y dos páginas verifica IDs 3/2 y luego1, sin repetición ni pérdida. Cursor no altera ownership; solo posición dentro de finca propia.

detail verifica finca propia antes de consultar simulationId condicionado por finca/usuario. Ausencia/ajeno no revela snapshot; R4C mapeará FARM_NOT_FOUND y SIMULATION_NOT_FOUND a 404 seguro. No SQL de actualización/borrado de snapshots.

### 13.6. Mapper inverso y snapshot histórico

mapStoredDetail reconstruye simulation/model/input/output/metadata desde columnas y JSON persistidos, sin ejecutar motor, validar reglas agronómicas actuales o sustituir versiones históricas. Conserva coeficientes, evidencia, messages/ruleVersion y todos los números históricos. Metadata/diagnostics aceptan valores JS del driver o texto JSON parseado una sola vez; tipo incorrecto, JSON inválido/doble serializado, números no finitos o campos estructurales ausentes fallan, no se reemplazan por defaults.

Date del driver se copia y se emite ISO UTC con milisegundos. Este comportamiento se prueba localmente; recuperación real depende de timezone Z y sesión UTC certificadas en R2. No se corrige timezone con offsets manuales. El nombre histórico no se vuelve a trim/truncar; normalización ocurre solamente al crear. Lecturas devuelven copias independientes.

### 13.7. QA R4B y límites

test/irrigation.persistence.test.js: 11 tests con matrices de casos. Mapper: G01/38 columnas conceptuales, 15 inputs/14 outputs, reproducción/JSON, name/Date, errores y no mutación. Persistencia: trx recibido, serialización única, SQL real compilado offline de lock/JOIN/cursor/order/limit, bindings y errores propagados. Servicio: ownership antes de motor, cálculo/INSERT únicos, readback/commit, modelo fallido sin fila, rollback simulado ante INSERT y readback fallidos, historial/detail sin motor, snapshots/versiones históricos y cursor con timestamps empatados.

QA focalizada nueva: 11 PASS / 0 FAIL. Suite completa: 149 PASS / 0 FAIL, sin omisiones; incluye DELETE R4A, Manning, UTC y todo R3. No se modifican rutas/app/config/dependencias/migrations ni los tres archivos congelados. Hashes antes/después intactos. Ningún endpoint productivo registrado, conexión Aiven, fixture real, commit o push.

Pruebas reales pendientes R4D/R4E, con autorización separada: INSERT y lectura exacta de 37 campos; metadata objeto/diagnostics array y serialización simple; DOUBLE round-trip; Date/ISO/DATETIME(3) UTC; FK/CHECK; shared/exclusive locks y carrera POST/DELETE con conexiones separadas; cursor/índice/EXPLAIN con fechas empatadas; rollback y tratamiento de fallo de commit. Mocks y compilación SQL no certifican MySQL ni una carrera real.

R4B queda listo para revisión y autorización de R4C. R4C deberá adaptar el contrato HTTP, validar campos desconocidos y auth, codificar cursores y mapear errores seguros. No se implementa en esta fase. Persistencia real/idempotencia y pendientes agronómicos no se resuelven por esta capa interna.

## 14. R4C — Endpoints HTTP implementados

### 14.1. Router y registro

src/routes/irrigation-simulations.routes.js declara exactamente tres handlers y se monta con app.use, siguiendo el patrón de rutas completas del backend:

- POST /api/fincas/:fincaId/irrigation-simulations → 201 snapshot persistido.
- GET /api/fincas/:fincaId/irrigation-simulations → 200 historial resumido.
- GET /api/fincas/:fincaId/irrigation-simulations/:simulationId → 200 detalle histórico.

Router recibe HTTP, adapta parámetros/body/query, llama service R4B y traduce resultados. No contiene cálculo o consultas Knex; solo aporta la instancia compartida a la factory del servicio. src/routes/irrigation-simulations.http.js reúne helpers de adaptación/cursor y proyección pública. No cambios de middleware JWT ni otras rutas, dependencia Swagger/OpenAPI, schema o motor.

Auth obligatorio: userId solo req.user.userId del token verificado. Se preservan 401 sin token y 403 inválido/expirado. La sintaxis JSON se procesa globalmente antes del middleware de ruta como en el backend existente. No body/query owner ID. Ownership transaccional o de lectura permanece en R4B; para finca ajena/inexistente el motor no se ejecuta y snapshots no se consultan.

### 14.2. Parámetros, request y Content-Type

IDs estrictos: texto decimal [1-9][0-9]*, hasta 10 dígitos y máximo 4294967295. Sin cero, signo, ceros iniciales, espacios, exponentes, fracciones o parseInt parcial. Única conversión Number tras verificar el formato/rango HTTP; nunca coerción de los 14 números de body. Parámetro inválido: 400 INVALID_ROUTE_PARAMETER con field fincaId/simulationId, sin consultas.

POST body de §4 implementado: objeto JSON con name opcional y crop/soil/furrow/irrigation. Adaptador rechaza campos desconocidos en raíz y grupos antes de invocar servicio: 400 INVALID_REQUEST con field. No se permite input como envoltorio alternativo. Grupos ausentes/null/arrays se pasan sin defaults al validador congelado; este conserva INVALID_SHAPE. Strings/bools/null/arrays/objetos en números mantienen INVALID_TYPE, sin coerción. Name usa normalización R4B: null/ausencia, trim, no vacío y máximo 255 caracteres Unicode.

POST/DETAIL no admiten query parameters; HISTORY solo limit/cursor. Desconocidos o parámetros repetidos ambiguos se rechazan. userId/user_id/finca_id/metadata/output/diagnostics/versiones/hash/createdAt/id del body no son autoridad y producen 400. Payload permitido pero agronómicamente inválido en finca ajena termina en 404 antes de motor; shape HTTP desconocido se rechaza previamente con 400, sin revelar datos de ownership.

POST requiere Content-Type application/json (parámetros como charset aceptados). Otro tipo: 415 INVALID_CONTENT_TYPE. Se conserva express.json() global sin opciones/parser adicional y su límite por defecto 100kb. JSON malformado conserva 400 invalid_input del handler existente, sin body/stack. Cuerpo excesivo de las rutas nuevas: 413 PAYLOAD_TOO_LARGE con mensaje genérico mediante rama acotada del error handler; no cambia límite ni comportamiento de otros recursos. No se redefine globalmente política de tamaño o auth.

### 14.3. Respuestas y errores efectivos

POST 201 después de commit y DETAIL 200 devuelven exactamente simulation/model/input/output/metadata de §7. Identidad camelCase: id, name, fincaId, createdAt ISO UTC con milisegundos. Sin filas snake_case ni detalles DB. Diagnostics conserva output.diagnostics.items, sin array duplicado a nivel raíz. Lectura usa snapshot persistido, nunca versión actual para recalcular.

Metadata: se devuelve completa para las nueve secciones declaradas de R3: metadataSchemaVersion, effectiveParameters, units, assumptions, evidenceState, referenceVersions, implementationReference, diagnosticRules, parameterProvenance. Se seleccionan explícitamente, sin añadir secciones desconocidas de debug/DB. Parámetros/unidades/estados/mensajes históricos dentro de esas secciones se preservan; no se reescriben. Es la metadata completa autorizada v1, no exposición automática de futuras claves internas. HISTORY no carga metadata completa.

Formato de error mantiene error string y code al nivel raíz. Fallos HTTP/aplicación pueden añadir field. Fallos del motor añaden errors como array de objetos con code/category/field/rule/expected/message, solo strings de esos campos permitidos; no received arbitrario ni stack/SQL/payload completo. Code externo distingue input/modelo, mientras errors conserva códigos específicos originales.

| Caso | HTTP | Code externo |
| --- | --- | --- |
| IDs malformados | 400 | INVALID_ROUTE_PARAMETER |
| Shape/desconocidos HTTP | 400 | INVALID_REQUEST |
| Name/entrada de aplicación inválida | 400 | INVALID_APPLICATION_INPUT |
| Limit/cursor inválido | 400 | INVALID_PAGINATION |
| JSON malformado | 400 | invalid_input existente |
| Grupo/tipo/dominio/relación de input rechazado por motor | 400 | INVALID_IRRIGATION_INPUT |
| MODEL_INCONSISTENCY/NON_FINITE_RESULT y defensas INVALID_DIAGNOSTIC/FATAL_DIAGNOSTIC | 422 | IRRIGATION_MODEL_INCONSISTENCY |
| MODEL_NOT_IMPLEMENTED reservado | 503 | IRRIGATION_MODEL_UNAVAILABLE; v1 no lo emite |
| Finca o simulación ajena/inexistente/bajo otra finca | 404 | RESOURCE_NOT_FOUND |
| POST sin tipo JSON | 415 | INVALID_CONTENT_TYPE |
| Cuerpo excesivo de rutas nuevas | 413 | PAYLOAD_TOO_LARGE |
| Error inesperado/Knex/FK/CHECK/conexión/timeout/commit/lectura | 500 | INTERNAL_ERROR |

404 común: {error:Recurso no encontrado o no tienes permiso.,code:RESOURCE_NOT_FOUND}, sin distinguir existencia ajena. 500 común: {error:Ocurrió un error en el servidor.,code:INTERNAL_ERROR}. No errno/sqlMessage/sql/stack/conexión al cliente. No se redefine el 409 del DELETE finca R4A. Fallos de modelo no tienen snapshot parcial y no insertan. Fallos de INSERT/commit en tests no devuelven 201.

### 14.4. HISTORY y cursor HTTP

GET admite limit decimal estricto 1..100, default20. Rechaza ceros iniciales, decimales, exponentes, vacíos, NaN-like, texto parcial y valores repetidos. La conversión Number es parsing explícito de query, no adaptación permisiva de body. Paginación interna R4B permanece igual.

Cursor externo: Base64URL sin padding del JSON UTF-8 exacto {v:1,createdAt:ISO UTC con milisegundos,id:INT positivo}. Máximo 256 caracteres. Decode valida alfabeto/representación Base64URL canónica, UTF-8 sin reemplazos, JSON objeto con exactamente tres claves, versión numérica 1, fecha real/ISO UTC e ID Number válido usando validatePagination R4B. No userId/fincaId o información sensible. Cursor inválido/repetido: 400 INVALID_PAGINATION antes de consultas. No firma: Base64URL es transporte, no autenticación; ownership/filtro JOIN no dependen del cursor.

Respuesta: {items:[proyección R4B],pagination:{limit,hasMore,nextCursor:string|null}}. Conserva hasMore aprobado en R4A/R4B. Cada item tiene simulation/model/summary; summary incluye targetDepthMm/appliedVolumeL/applicationEfficiencyPct y diagnostics count/severities. Orden created_at DESC,id DESC y limit+1 de R4B. nextCursor se genera desde la última fila devuelta; última página/vacío usa null. Tests con fechas empatadas devuelven 3/2 y luego1, sin recalcular o duplicar. No OFFSET ni total ilimitado.

### 14.5. DETAIL e inmutabilidad HTTP

Service garantiza finca/usuario/simulationId en la consulta. Simulation de otra finca, inexistente o bajo finca ajena retorna el mismo 404. Snapshot completo, JSON y mensajes/versiones antiguos preservados; motor no llamado para lecturas.

No handlers PUT/PATCH/DELETE sobre simulaciones. Express devuelve 404 para esos métodos; tests confirman ninguna consulta/escritura. Sin rename. OPTIONS/CORS y HEAD implícito de Express conservan comportamiento del framework, sin crear acciones de modificación. Auth y rutas previas siguen montadas.

### 14.6. QA y evidencia pendiente R4D

test/irrigation.http.test.js: 16 tests HTTP con matrices de casos; app real, auth JWT controlada, router/helpers, servicio/mapper/persistencia reales y motor congelado. Solo Knex y reloj/contador del motor se controlan mediante dobles. Sin cargar DB real o enviar correo.

Cobertura POST: 201 G01, name null/trim/límites, desconocidos/authority fields, grupos/tipos, ownership, relación400, balance/overflow422, DB/commit500 genérico, respuesta camelCase y metadata segura. HISTORY: límites/default/max/ambigüedades, cursor versión/UTF-8/estructura/fecha/ID/tamaño, orden y empate/página final. DETAIL: histórico intacto, ausencia/otra finca/ownership, sin cálculo, fallo de lectura. Auth401/403, IDs, métodos no registrados y Content-Type/JSON/tamaño cubiertos.

Focalizados HTTP nuevo + persistencia R4B + DELETE R4A: 36 PASS / 0 FAIL. Suite completa: 165 PASS / 0 FAIL, sin omisiones. Motor/R4B/R4A, Manning, UTC, migrations, auth y dependencias intactos; solo app.js registra router y agrega manejo seguro acotado de413. Sin frontend/schema/Aiven/commit/push.

R4D requiere autorización separada para verificar POST real e INSERT/readback JSON/DOUBLE/UTC, FK/CHECK, error/rollback y carrera POST/DELETE con locks reales; HISTORY cursor/índice y DETAIL por usuarios reales. Los tests locales usan filas simuladas y no certifican MySQL, red ni persistencia Aiven. Sin retries/idempotencia automática; incertidumbre de commit permanece documentada. R4C termina aquí sin iniciar R4D.

## 15. R4E — Backend MVP frozen

Estado: R4 cerrado técnicamente, sin funcionalidades añadidas. Fuente del contrato efectivo: §14 y código auditado; evidencia real aprobada: [irrigation-r4d-certification.md](irrigation-r4d-certification.md). Guía breve de integración R5: [irrigation-backend-freeze.md](irrigation-backend-freeze.md). Los apartados de aprobación pendiente/pruebas futuras de R4A–R4C son checkpoints históricos, no blockers actuales.

Se congelan los tres endpoints POST/HISTORY/DETAIL, request plano name+cuatro grupos, response simulation/model/input/output/metadata, proyección de historial, errores, ownership, límites20/100, orden fecha/id, cursor Base64URL v1, metadata autorizada y snapshot inmutable. No PUT/PATCH/DELETE de simulaciones. IDs/query se adaptan estrictamente; ningún número de input se coacciona. Campos de autoridad/desconocidos→400. Cualquier cambio incompatible en shape, unidades, reglas de aceptación, códigos/status, significado de snapshot o cursor exige revisión/versionado contractual antes de integrarlo; no se inventa prefijo/version HTTP nuevo en R4E.

Persistencia congelada: 15 inputs, 14 outputs y campos de reproducción/aplicación R2; 37 valores INSERT más id autogenerado. Mapper no recalcula y no usa defaults numéricos/clamp. JSON serializado una vez, Date/DOUBLE sin redondeo de aplicación, UTC bajo factory Z. Snapshot guarda versiones/hash/metadata/diagnósticos y no se reevalúa con modelo actual. Recalcular crea otra fila.

DELETE finca: con simulaciones→409 FARM_HAS_IRRIGATION_SIMULATIONS sin borrar finca/Manning; sin simulaciones→Manning+finca en una transacción. FK RESTRICT como defensa final, sin CASCADE. Rechazo final por dependencias→409 FARM_DELETE_CONFLICT. R4D verificó rollback real y locks: POST/shared padre vs DELETE/FOR UPDATE; POST gana201/DELETE409 y DELETE gana200/POST404, sin huérfanos. No reintentos automáticos.

### 15.1. Commit uncertainty — decisión aprobada

Clasificación aprobada por el usuario: **BACKLOG, no blocker del MVP**. No retries automáticos, idempotency key ni promesa exactly-once. Si el cliente pierde la respuesta después de commit, debe consultar HISTORY y, para comparar inputs completos, DETAIL antes de repetir POST. No reenviar automáticamente por timeout/500/pérdida de conexión.

HISTORY/DETAIL permiten reconciliación asistida, no identificación infalible de una intención: no hay request ID/idempotency key y pueden existir simulaciones legítimas idénticas. Si la evidencia no permite decidir, mostrar estado incierto y pedir decisión explícita del usuario; no asumir fracaso/éxito ni duplicar silenciosamente. Esa limitación es compatible con la decisión MVP y no se resuelve agregando un endpoint ahora.

Regla futura obligatoria: antes de introducir retries automáticos de POST simulation, implementar y certificar idempotencia. La propuesta pendiente al cierre R4D queda resuelta por esta decisión R4E; no se altera la evidencia de aquel ensayo ni se implementa mecanismo nuevo.

### 15.2. Garantías y límites congelados

Garantías del flujo implementado: auth/ownership en creación/lecturas; snapshot completo con INSERT transaccional; rollback ante errores previos a commit; integridad FK/CHECK; coordinación POST/DELETE mediante locks; desempate estable de cursor por fecha/id; datos UTC bajo configuración certificada; conservación de números/versiones/metadata/diagnósticos. Se aplican al esquema/entorno y vías de aplicación certificados, no a escrituras administrativas externas.

Inmutabilidad es política de endpoints, no trigger que impida a un administrador editar DB. Cursor garantiza orden/desempate y filtros de ownership, no fotografía global inmutable entre páginas cuando llegan filas nuevas. R4D cubre los escenarios reales ejecutados, no todos los interleavings ni producción bajo carga.

No garantiza: exactitud agronómica/calibración científica, idempotencia, exactly-once, retry automático, disponibilidad de infraestructura, rendimiento productivo ni recuperación automática de una respuesta perdida. Modelo estimativo permanece con widthM/base CC-PMP/calibración/significado de útil-residual-eficiencia/Qmax extremos/bandas25-30-50 pendientes; lluvia/humedad inicial no modeladas.

### 15.3. Cierre QA y readiness R5

R4E: auditoría de rutas/adaptador/mapper/persistencia/servicio/app/DELETE y contratos; no drift observado. 162 tests focalizados PASS; npm test165 PASS/0 FAIL/0 omitidos. TLSv1.3/TLS_AES_256_GCM_SHA384 PASS. Solo lectura de DB: defaultdb8.4.11, migrations4, lock0, users/fincas/calculos/irrigation_simulations0. Sin fixtures ni nuevas escrituras. Siete hashes de motor/migrations coinciden con freeze y certificación R4D. Dependencias, auth, UTC, Manning, R4A/R4B/R4C y schema intactos. git diff --check y documentos nuevos revisados sin incidencias.

Frontend puede desarrollarse con el contrato existente para elegir finca, crear/mostrar estimación, representar warning/info, listar/paginar historial y abrir detalle; debe gestionar auth/errores y commit uncertainty según §15.1. No falta endpoint obligatorio para ese alcance. R5 debe etiquetar estimación/no validación y no usar mensajes como claves de negocio. R4 formalmente cerrado; listo para R5 tras autorización. **R5 no iniciado**. Sin commit, push, cambios de runtime o nuevas dependencies.
