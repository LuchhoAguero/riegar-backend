# R4E — Backend MVP frozen: guía de integración R5

Fecha: 2026-10-13. **R4 cerrado técnicamente**. Modelo irrigation-estimation-v1; contrato irrigation-contract-v1; metadata irrigation-metadata-v1; diagnósticos irrigation-diagnostics-v1. No es validación agronómica. Contrato completo: [irrigation-api-contract.md](irrigation-api-contract.md), §§14–15. Evidencia real: [irrigation-r4d-certification.md](irrigation-r4d-certification.md).

## Endpoints y autenticación

Todas las llamadas usan Authorization: Bearer <token verificado>, sin userId/finca_id del cliente. Finca ajena/inexistente o simulación fuera de su finca→404 común. IDs decimales positivos sin formatos ambiguos, en rango INT UNSIGNED.

| Método | URL | Éxito |
| --- | --- | --- |
| POST | /api/fincas/:fincaId/irrigation-simulations | 201 snapshot completo tras commit |
| GET | /api/fincas/:fincaId/irrigation-simulations | 200 historial resumido paginado |
| GET | /api/fincas/:fincaId/irrigation-simulations/:simulationId | 200 snapshot histórico completo |

No PUT/PATCH/DELETE de simulaciones; esos métodos devuelven404. Recalcular crea fila nueva. Elegir finca usa el GET /api/fincas existente, sin nueva API de catálogo.

## POST: request y response

Content-Type application/json; objeto plano con name opcional y exactamente los grupos canónicos:

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

Name ausencia/null→null; string trim, no vacío, máximo255 puntos de código, inmutable. Textura descriptiva/nullable, sin autocompletar CC/PMP. Los 14 números se envían como JSON numbers en unidades del nombre; convertir explícitamente texto de formulario antes de enviar, sin interpretar ausencia como0. f=60 significa60%, slopePct=0.3 significa0.3%. Kc no es porcentaje. Campos desconocidos o output/metadata/diagnostics/versiones/hash/timestamps/IDs de autoridad→400; servidor calcula esos datos.

Respuesta POST201 y DETAIL200:

```text
{
  simulation: {id, name, fincaId, createdAt},
  model: {modelVersion, contractVersion, sourceHash},
  input: {crop, soil, furrow, irrigation},
  output: {waterNeed, soilWater, application, efficiency,
           diagnostics: {advanceRatioPct, maxNonErosiveFlowLps, items}},
  metadata: {metadataSchemaVersion, effectiveParameters, units, assumptions,
             evidenceState, referenceVersions, implementationReference,
             diagnosticRules, parameterProvenance}
}
```

createdAt ISO UTC con milisegundos; presentación local corresponde al frontend. Números conservan precisión del snapshot; redondear solo visualmente. items contiene id/ruleVersion/severity/fields/evidence/message; info/warning no invalidan éxito. P03/P05 pueden repetirse por punto: identidad (id,evidence.point), no deduplicar por id solamente. D01–D08/categorías automáticas de avance no existen. Mostrar infiltración/eficiencia estimadas y modelo not_validated; residual no identifica causa de pérdida.

## HISTORY y DETAIL

History query permitida: limit opcional decimal1..100, default20; cursor opcional opaco recibido en nextCursor. No query ownerID ni OFFSET.

```text
{
  items: [{simulation, model, summary: {
    targetDepthMm, appliedVolumeL, applicationEfficiencyPct,
    diagnostics: {count, severities}
  }}],
  pagination: {limit, hasMore, nextCursor: string|null}
}
```

Orden created_at DESC,id DESC. Cursor Base64URL v1 con createdAt/id, validado por backend; frontend lo conserva/transmite sin reconstruirlo. Es posición, no autenticación. Última página nextCursor=null. Reiniciar desde primera página tras nueva creación; no combinar páginas de fincas distintas. History no devuelve input/metadata completos: abrir DETAIL para esos datos.

DETAIL devuelve el mismo shape de POST a partir de columnas/JSON históricos, sin recalcular ni aplicar reglas actuales. No actualizar nombres/inputs/outputs del snapshot; un nuevo escenario requiere otro POST.

## Errores para R5

Formato: {error:string,code:string,field?:string,errors?:[{code,category,field,rule,expected,message}]}. Mensajes solo presentación; usar status/code/field/rule para lógica.

| HTTP | Manejo esperado |
| --- | --- |
| 400 | Mostrar validación de body/name/params/cursor; corregir antes de reenviar. INVALID_IRRIGATION_INPUT conserva códigos del motor en errors |
| 401/403 | Middleware auth existente: token ausente/inválido/expirado; no usar POST automático como recuperación |
| 404 | Recurso inexistente o sin permiso; no inferir existencia ajena |
| 409 | DELETE finca con simulaciones: FARM_HAS_IRRIGATION_SIMULATIONS; dependencia final: FARM_DELETE_CONFLICT. Finca/Manning se conservan ante rechazo |
| 422 | IRRIGATION_MODEL_INCONSISTENCY: revisar datos/modelo; no hay simulación válida persistida ni clamp |
| 500 | INTERNAL_ERROR genérico; en POST tratar estado potencialmente incierto antes de repetir |
| 413/415 | Cuerpo excesivo/tipo no JSON; respetar parser100kb y application/json |
| 503 | Defensa reservada IRRIGATION_MODEL_UNAVAILABLE; v1 no emite MODEL_NOT_IMPLEMENTED |

No SQL/errno/stack/host/secretos en respuestas de simulaciones. No cambiar globalmente otros contratos históricos del backend.

## Commit uncertainty: decisión aprobada MVP

**BACKLOG, no blocker.** No retry automático, idempotency key ni garantía exactly-once. Si POST pierde respuesta, conservar los datos de la intención, marcar resultado incierto y consultar HISTORY. Abrir DETAIL de candidatos para comparar nombre, inputs, modelo y ventana temporal antes de repetir. History por sí solo es resumen.

No hay identificador de intención: coincidencias pueden ser ambiguas o corresponder a ejecuciones legítimas idénticas. Reconciliación asistida no garantiza deduplicación; ante ambigüedad requiere decisión explícita del usuario y no reenvío automático. Si se introducen retries automáticos de POST en el futuro, **idempotencia es requisito previo obligatorio**, con autorización y certificación propias. No implementar en R5 por inferencia de este backlog.

## Garantías, evidencia y pendientes

Ownership, snapshots completos e inmutables mediante API, INSERT/DELETE atómicos y rollback, FK/CHECK, coordinación por locks POST/DELETE, cursor con desempate y UTC certificados en el entorno R4D. Inmutabilidad no es defensa frente a edición administrativa de DB; cursor no promete fotografía estática entre páginas.

R4D real: POST/readback, DOUBLE/JSON/UTC, constraints, rollback, dos conexiones, carreras201/409 y200/404, aislamiento, índice y cleanup0. R4E: 162 focalizados PASS, 165 completos PASS, TLSv1.3 PASS; lectura defaultdb8.4.11, migrations4/lock0, producto0. Sin fixtures R4E, código nuevo o dependencias.

No garantiza disponibilidad, producción bajo carga, calibración/exactitud de campo, exactly-once o retries. Pendientes: ancho/separación, CC/PMP, k4.5, útil/residual/eficiencia, Qmax extremos y bandas25/30/50. Lluvia/humedad inicial fuera del modelo. Conservar releases/versiones para reproducción futura; sin commit ni push autorizado en este cierre.

El frontend puede implementar selección de finca, creación, resultados/info/warning, historial/cursor, detalle, errores y reconciliación asistida con este backend. No se detectó contrato obligatorio faltante para ese alcance. Cambios incompatibles requieren revisión/versionado. **Listo para R5 tras autorización; R5 no iniciado.**

## Estado Git del cierre, sin commit/push

Se preservan los 20 archivos pendientes de seguimiento/modificación al cierre; git diff tracked conserva exclusivamente cambios anteriores de app y DELETE finca (34 inserciones/5 eliminaciones). R4E no cambia runtime/tests.

- Modificados tracked: src/app.js; src/routes/fincas.routes.js.
- Docs sin seguimiento: irrigation-api-contract.md, irrigation-backend-freeze.md, irrigation-engine-contract.md, irrigation-r4d-certification.md.
- src/routes/ sin seguimiento: irrigation-simulations.routes.js, irrigation-simulations.http.js.
- src/services/ sin seguimiento: irrigation-simulations.mapper.js, irrigation-simulations.persistence.js, irrigation-simulations.service.js.
- Motor sin seguimiento en src/services/irrigation/: irrigation-models.js, irrigation-validation.js, irrigation-calculator.service.js.
- test/ sin seguimiento: fincas.delete.http.test.js, irrigation.contract.test.js, irrigation.calculator.test.js, irrigation.boundaries.test.js, irrigation.persistence.test.js, irrigation.http.test.js.

No se omitió/eliminó trabajo previo, no se agregó a staging ni se crearon refs/releases. El freeze es técnico/contractual; la conservación mediante commit/release requerirá autorización posterior.
