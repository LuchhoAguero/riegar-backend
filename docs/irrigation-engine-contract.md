# R3D — Contrato del modelo estimativo de riego por surcos

Análisis R1–R3C: 2026-10-12. Freeze R3D: 2026-10-13. R3A/R3B/R3C aprobados; R3D certifica técnicamente y congela el modelo estimativo v1 para integración futura. Se conservan sin cambios 14 fórmulas/outputs y comparaciones P01:P05. Sin validación agronómica, endpoint, adapter de persistencia ni consultas de DB.

Fuentes: [irrigation-model.md](irrigation-model.md), A01:A10, y [irrigation-data-model.md](irrigation-data-model.md), B01:B20 y certificación UTC R2C-3. Sus decisiones permanecen intactas. Ninguna aceptación de tipos/dominios certifica una fórmula agronómica.

## 1. Arquitectura y límites

Tres módulos CommonJS separados de Manning:

| Módulo | Responsabilidad |
| --- | --- |
| src/services/irrigation/irrigation-models.js | Versiones, hash, contratos declarativos, dominios/unidades/mapeo SQL y template de metadata, constantes profundamente congeladas |
| src/services/irrigation/irrigation-validation.js | Validación de input/output, relaciones aprobadas y estructura de diagnósticos; copia controlada |
| src/services/irrigation/irrigation-calculator.service.js | calculateIrrigationSimulation(input), cálculo estimativo, guard de resultados y diagnósticos comparativos |

No importan Express, Knex, mysql2, JWT, filesystem, environment, reloj, aleatoriedad ni catálogos. No conocen finca, usuario o DB. No se carga Manning desde el motor nuevo. No nuevas dependencias, carpetas de repositories/controllers ni clases de error innecesarias.

Las utilidades y el cálculo son sincrónicos y deterministas. Solo reciben datos; no hay llamadas de red, escritura de archivo, JSON stringify/reparse para calcular ni callbacks de proveedores. Se esperan objetos de datos, no clases, accesores o proxies con comportamiento personalizado. Accesores de objetos/arrays se rechazan sin invocarlos; una excepción inesperada del runtime se propaga.

## 2. Versiones inmutables

Definidas y exportadas únicamente desde irrigation-models.js:

| Constante | Valor | Significado |
| --- | --- | --- |
| MODEL_VERSION | irrigation-estimation-v1 | Identifica fórmulas, orden, parámetros y semántica estimativa; no significa calibración científica |
| CONTRACT_VERSION | irrigation-contract-v1 | Shape, campos, unidades y errores de este contrato |
| METADATA_SCHEMA_VERSION | irrigation-metadata-v1 | Estructura camelCase del objeto metadata |
| DIAGNOSTICS_RULE_VERSION | irrigation-diagnostics-v1 | Primera versión efectiva de comparaciones P01:P05, severidades y evidencia |

La versión skeleton histórica queda reemplazada por una versión de cálculo distinta. CONTRACT_VERSION y METADATA_SCHEMA_VERSION se conservan: no cambia ningún campo, unidad, error o envelope contractual; metadata completa los parámetros antes null y agrega descripción/evidencia dentro del objeto extensible previsto en R2/R3A. La estructura de diagnostics sigue igual; cambia ruleVersion porque ahora identifica reglas ejecutadas, no una reserva de contrato. No se renombra ninguna clave R3A de metadata.

El modelo y sus constantes son inmutables, centralizados y no seleccionables por cliente. Cambios posteriores en fórmulas, orden numérico relevante, parámetros, semántica o reglas exigirán una nueva versión. No registry dinámico, environment ni catálogo mutable.

## 3. Contrato de entrada y mapeo a R2

Input es un objeto con exactamente cuatro grupos obligatorios: crop, soil, furrow, irrigation. Sus campos numéricos son obligatorios. Única excepción: soil.texture, que puede ser null, undefined u omitida; el snapshot canónico la convierte a null.

| Campo del input | Unidad única | Dominio estructural | Columna irrigation_simulations |
| --- | --- | --- | --- |
| crop.etoMmPerDay | mm/día | ≥0 | eto_mm_per_day |
| crop.cropCoefficient | adimensional | ≥0, sin máximo inventado | crop_coefficient |
| crop.daysWithoutIrrigation | días | ≥0; política entero/fracción pendiente | days_without_irrigation |
| soil.texture | etiqueta sin unidad | null/ausente o texto no vacío, máximo 64 caracteres | texture |
| soil.fieldCapacityPct | % numérico | >PMP y ≤100 | field_capacity_pct |
| soil.wiltingPointPct | % numérico | ≥0 y <CC | wilting_point_pct |
| soil.bulkDensityGcm3 | g/cm3 | >0 | bulk_density_g_cm3 |
| soil.rootDepthM | m | >0 | root_depth_m |
| soil.depletionThresholdPct | % numérico | >0 y ≤100 | depletion_threshold_pct |
| furrow.widthM | m | >0; significado ancho/separación pendiente | width_m |
| furrow.lengthM | m | >0 | length_m |
| furrow.slopePct | % numérico | ≥0, sin máximo inventado | slope_pct |
| irrigation.flowLps | L/s | >0 | flow_lps |
| irrigation.durationMin | min | >0 | duration_min |
| irrigation.advanceTimeMin | min | ≥0 y ≤durationMin | advance_time_min |

Datos mínimos G01 en unidades canónicas:

```js
{
  crop: { etoMmPerDay: 5, cropCoefficient: 0.7, daysWithoutIrrigation: 20 },
  soil: {
    texture: "Franco", fieldCapacityPct: 20, wiltingPointPct: 10,
    bulkDensityGcm3: 1.3, rootDepthM: 0.7, depletionThresholdPct: 60
  },
  furrow: { widthM: 1.3, lengthM: 60, slopePct: 0 },
  irrigation: { flowLps: 0.9, durationMin: 60, advanceTimeMin: 4.8 }
}
```

No runoff, hectárea, surcos/ha, días adicionales, IDs, timestamps, nombre de simulación, versiones seleccionadas por cliente u outputs recibidos. Campos desconocidos se rechazan en raíz y grupos, no se ignoran. Horas, cm, fracciones alternativas y m³/s deben adaptarse fuera del motor antes de llamar. No heurísticas: f=0.6 en depletionThresholdPct significa 0.6 %, no se transforma automáticamente a 60 %. Unidades son parte del nombre/contrato, no un selector variable.

Textura se trimmea, sin case folding, alias de catálogo ni autocompletado. Los 64 caracteres corresponden a capacidad de persistencia, no una restricción agronómica. CC/PMP siempre son explícitos. Normalización construye nuevos objetos y conserva todos los Number sin redondeo; no modifica el input recibido.

Los validadores admiten Number fraccionarios de días y valores sin máximos adicionales porque no existe una restricción aprobada. Esta aceptación estructural no decide una política agronómica; en R3B se calcula el modelo estimativo con esos valores. No deducir base gravimétrica/volumétrica por los porcentajes.

## 4. Validadores y errores esperables

Funciones exportadas:

- validateIrrigationInput(input): `{ ok: true, input: copiaCanónica }` o `{ ok: false, errors }`.
- validateIrrigationOutput(output): `{ ok: true, output: copiaCanónica }` o `{ ok: false, errors }`.

El ok de un validador describe solamente aceptación del contrato; no es éxito de calculateIrrigationSimulation ni autorización de persistencia. No devuelve copias parciales cuando hay errores. Se acumulan errores en orden determinista de contrato; una relación entre números solo se comprueba si ambos son finitos.

Cada magnitud exige typeof number y Number.isFinite. No parseFloat, Number de texto, null/false/undefined a cero ni sanitización numérica. Arrays, fechas y objetos de clase no son grupos válidos. Objetos planos con prototype null se admiten como objetos de datos. Campos deben ser propios, sin leer datos numéricos heredados.

Error estructurado:

```js
{
  code: "INVALID_RELATIONSHIP",
  field: "input.irrigation.advanceTimeMin",
  rule: "advance_within_duration",
  expected: "<= irrigation.durationMin",
  message: "El avance no puede superar la duración del riego.",
  category: "validation",
  received: 61
}
```

| Code estable | Uso |
| --- | --- |
| INVALID_SHAPE | Raíz/grupo no es objeto de datos o contiene accesores |
| UNKNOWN_FIELD | Campo fuera del contrato; unidades alternativas e IDs incluidos |
| MISSING_FIELD | Magnitud numérica ausente/undefined |
| INVALID_TYPE | Magnitud no numérica o textura de tipo inválido |
| NON_FINITE_NUMBER | NaN o Infinity en input |
| OUT_OF_RANGE | Dominio de input o longitud de textura |
| INVALID_RELATIONSHIP | CC≤PMP o avance>duración |
| NON_FINITE_RESULT | Magnitud output no finita |
| MODEL_INCONSISTENCY | Output fuera de dominio o aprovechamiento>aplicación |
| INVALID_DIAGNOSTIC | Shape, identificador, severity, fields o evidencia inválidos |
| FATAL_DIAGNOSTIC | Error fatal colocado en una salida supuestamente persistible |
| MODEL_NOT_IMPLEMENTED | Código reservado del skeleton histórico; no emitido por el modelo R3B |

category: validation para input; consistency para outputs/diagnósticos. El código availability queda histórico y no se emite en R3B. Todos son errores fatales para una simulación exitosa. received solo incluye números finitos, booleanos o null, nunca texto arbitrario, objetos, secretos, BigInt o valores no JSON. No copiar payload, stack o error externo en el resultado.

Preferencia elegida: errores esperables son resultados discriminados; errores de programación se lanzan y el consumidor los trata aparte. No catch general para transformar un bug en cero, warning o éxito. No se define código de estado HTTP.

## 5. Contrato del resultado y orden efectivo

calculateIrrigationSimulation(input) es sincrónico. Orden ejecutado, sin redondeos:

1. Validar y copiar input; si falla, retornar solo ok:false/errors.
2. F03 necesidad acumulada simplificada.
3. F12 agua útil; F13 capacidad del área; F14 lámina del umbral; F15 volumen del umbral.
4. F07 volumen aplicado; F02 ratio de avance; F01 Qmax.
5. Oportunidades inicio/medio/final; F04:F06 infiltraciones estimadas.
6. F08 volumen útil literal; F09 residual; F10 eficiencia estimada.
7. Validar los 14 outputs con el guard contractual: finitud, dominios y útil≤aplicado. No construir evidencia con NaN/Infinity.
8. Solo si pasan: evaluar P01:P05; validar de nuevo el output completo, incluidos diagnostics.
9. Construir metadata efectiva independiente; devolver éxito.

La validación acumula errores de finitud/dominio por campo en orden contractual; no existe tolerancia física, clamp ni corrección de resultados. El primer guard usa items=[] internamente, nunca como salida parcial ante error.

Contrato real emitido:

```text
Success = {
  ok: true,
  modelVersion, contractVersion, sourceHash,
  input: snapshot canónico validado,
  output: contrato completo de sección 6,
  metadata: parámetros/semántica/versiones efectivas
}
Failure = { ok: false, errors: EngineError[] }
```

No IDs, fechas, secretos o acceso DB. Ningún failure devuelve input/output parciales ni metadata de éxito. G12 produce MODEL_INCONSISTENCY por residual<0, eficiencia>100 y útil>aplicado; received conserva los números finitos originales en cada error. Resultados no finitos producen NON_FINITE_RESULT, sin serializarlos como null. Underflow a cero en magnitudes contractualmente positivas es inconsistencia; nunca default a un número aceptable.

## 6. Output contract y protección de resultados

Cinco grupos obligatorios, exactamente estos campos:

| Campo output | Unidad | Dominio estructural | Columna R2 |
| --- | --- | --- | --- |
| waterNeed.targetDepthMm | mm | ≥0 | target_depth_mm |
| soilWater.availableWaterMm | mm | >0 | available_water_mm |
| soilWater.availableCapacityL | L | >0 | available_capacity_l |
| soilWater.maxRecommendedDepthMm | mm | >0 | max_recommended_depth_mm |
| soilWater.maxRecommendedVolumeL | L | >0 | max_recommended_volume_l |
| application.appliedVolumeL | L | >0 | applied_volume_l |
| application.infiltratedDepthStartMm | mm | ≥0 | infiltrated_depth_start_mm |
| application.infiltratedDepthMiddleMm | mm | ≥0 | infiltrated_depth_middle_mm |
| application.infiltratedDepthEndMm | mm | ≥0 | infiltrated_depth_end_mm |
| application.estimatedUsefulVolumeL | L | ≥0 y ≤appliedVolumeL | estimated_useful_volume_l |
| application.residualLossVolumeL | L | ≥0 | residual_loss_volume_l |
| efficiency.applicationEfficiencyPct | % | 0..100 | application_efficiency_pct |
| diagnostics.advanceRatioPct | % | 0..100 | advance_ratio_pct |
| diagnostics.maxNonErosiveFlowLps | L/s | >0 | max_non_erosive_flow_lps |
| diagnostics.items | Array de diagnóstico | Obligatorio; [] solo como conjunto explícito | diagnostics |

Números obligatorios y finitos; no salida nullable, NaN/Infinity ni reemplazo por cero. Se usan dominios de los CHECK aprobados de R2, sin cambiar DB. Valores negativos, ratios fuera de rango o volumen útil superior a aplicado son errores, no warnings. A08: no clamp, min(100), max(0) ni normalización.

No se incorporan identidad exacta de balance, integración espacial, cuantización, tolerancia física o reglas de déficit por inferencia. G12 se rechaza por sus outputs imposibles. G01 ahora se calcula y contrasta numéricamente; ello prueba reproducción matemática, no uniformidad ni exactitud agronómica.

## 7. Diagnósticos comparativos y errores

Cada diagnóstico mantiene el contrato R3A: id y ruleVersion estables; severity; fields como rutas canónicas; evidence JSON acíclica con números finitos/unidades/operador/procedencia; message español opcional, solo presentación. Regla efectiva: irrigation-diagnostics-v1.

| ID | Condición estricta | Severidad | Interpretación permitida |
| --- | --- | --- | --- |
| P01 | flowLps > Qmax | warning | Caudal supera la estimación de la planilla; no prueba erosión |
| P02 | infiltración final < targetDepthMm | warning | Estimación al final menor que necesidad simplificada; no déficit medido |
| P03 | cada infiltración > targetDepthMm | info | Comparación por punto, sin afirmar pérdida profunda |
| P04 | targetDepthMm > maxRecommendedDepthMm | warning | Necesidad simplificada sobre umbral estimado |
| P05 | cada infiltración > maxRecommendedDepthMm | warning | Estimación por punto sobre umbral, sin afirmar percolación |

Orden: P01, P02, P03 inicio/medio/final, P04, P05 inicio/medio/final. Solo se agregan las condiciones verdaderas. Igualdad nunca activa una comparación estricta. P03/P05 conservan el ID de regla; evidence.point=start/middle/end y fields identifican la instancia. La pareja (id, point) distingue puntos; no deduplicar por id solamente.

Evidence conserva todas las magnitudes comparadas sin redondeo, operator, unidades y scientificValidation=not_validated. P01 agrega slopePct. G01: P02 y P04, ambos warning. Ausencia de avisos no significa certificación de campo. Los textos describen estimaciones y no son claves de negocio.

D01:D03 y bandas 25/30/50 no se evalúan; tampoco D04:D08 ni recomendaciones. advanceRatioPct se calcula sin convertirlo a Óptimo/Regular/Crítico. G08=60% no produce D03. P06/P07/P08 corresponden a errores fatales de balance/dominio/validación, nunca diagnostics persistibles. P09:P11 se conservan solo como auditoría R1, fuera del MVP.

El output solo admite info/warning; severity=error produce FATAL_DIAGNOSTIC. Arrays sparse, símbolos, accesores y evidencia no JSON se rechazan como en R3A. No stringify/reparse para ocultar errores.

## 8. Metadata efectiva reproducible

createIrrigationMetadata() copia el template profundamente congelado; no recibe overrides, no lee Excel/env/reloj/catálogo. Se conservan claves R3A y metadataSchemaVersion=irrigation-metadata-v1; los nuevos datos descriptivos caben en el objeto extensible aprobado.

| Sección | Estado efectivo R3B |
| --- | --- |
| effectiveParameters | infiltrationCoefficient=4.5; infiltrationExponent=0.5; middleArrivalFactor=0.5; qmaxCoefficient=0.0063; qmaxZeroSlopeValue=6.3; advanceRules=null |
| units | Mapa input/output y parámetros: k en mm/min^0.5; exponente/factor adimensional; Qmax en L/s usando pendiente fraccional |
| assumptions | ETo/Kc y caudal constantes; lluvia efectiva/humedad inicial no modeladas; infiltración empírica; textura sin efecto aritmético; ancho y base CC/PMP pending_validation; residual no identifica causa; eficiencia estimada |
| evidenceState | calculationImplemented/parametersSelected/diagnosticsEvaluated=true; modelKind=estimation; scientificValidation=not_validated; source=spreadsheet-derived; fieldCalibration=none |
| referenceVersions | catalogVersion/calibrationVersion=null: no se utilizan |
| implementationReference | modelVersion efectivo; stage=R3B_estimation; arithmetic=IEEE-754_Number, sin timestamp |
| diagnosticRules | ruleVersion efectivo; evaluated=[P01,P02,P03,P04,P05] |
| parameterProvenance | C14:C16/F04:F06; B9/F01; B24/F12; origen documental, no calibración |

qmaxCoefficient es la clave R3A preservada; su valor procede de la constante qmaxPositiveSlopeCoefficient, con slopePct/100 como operando. Una sola definición numérica. El exponente 0.5 queda fijo y se implementa con Math.sqrt; no se ofrece exponente configurable. Constantes vinculadas a MODEL_VERSION.

No calibración ficticia, parámetros por textura ni defaults de avance. Los supuestos sin lluvia/humedad inicial expresan exclusión, no funcionalidades activas. widthM se multiplica literalmente, sin resolver separación/ancho mojado. F12 conserva la multiplicación por densidad de Excel, sin afirmar base gravimétrica o volumétrica validada.

El hash documental no identifica por sí solo el algoritmo: la reproducción futura requiere conservar esta implementación inmutable y su orden/versión, además del snapshot. Archivado de releases deberá concretarse antes de una publicación; no se consulta Git/fs ni se hace commit aquí. modelVersion/contractVersion/sourceHash permanecen en envelope/columnas, salvo referencia a modelo en implementationReference. Metadata no copia el payload ni contiene ruta Excel/host/DB.

## 9. Hash, precisión e inmutabilidad

SOURCE_HASH oficial canónico lowercase:

`42592487e6e07deb1b25a073d74086a09c1bb19cb38411aafc31d28ea64d2127`

Equivale al SHA-256 aprobado en uppercase. Constante literal; no hash del archivo en runtime. Formato 64 dígitos hex verificado por test, compatible con CHAR(64) ascii_bin y futura persistencia lowercase.

JS Number y Number.isFinite para magnitudes; no toFixed, Math.round, coerción, JSON round-trip o biblioteca decimal en cálculo. El helper de tolerancia R1 solo existe en tests: max(1e-8,1e-9·abs(expected)). No se usa para permitir η>100, pérdidas negativas o alterar valores. Round-trip SQL certificado en R2 no transforma Number en decimal exacto.

Contratos, versiones exportadas, vocabulario y metadata base se congelan recursivamente. Input validado, output validado, diagnostics y metadata se copian sin referencias mutables compartidas. Copias devueltas pueden editarse sin alterar caller/constantes/otra ejecución; el motor no modifica objetos recibidos. No se necesita congelar todos los objetos del consumidor para cumplir esa garantía.

## 10. Persistencia y API futura, solo mapeo documental

Inputs/outputs: tablas completas de §§3/6; los contratos declarativos también contienen sqlColumn y unidad, pero no importan ni llaman Knex.

| Valor del motor | Destino futuro |
| --- | --- |
| modelVersion | model_version |
| contractVersion | contract_version |
| sourceHash | source_hash |
| metadata | model_metadata JSON |
| output.diagnostics.items | diagnostics JSON |
| nombre opcional, finca_id, created_at | Datos del servicio/API futuro, fuera del motor; created_at bajo política UTC R2C-3 |

El contrato R3A define camelCase dentro del JSON (ruleVersion, metadataSchemaVersion, etc.). R2 describe esas funciones conceptualmente también en snake_case; no hay columnas SQL para esas claves internas ni cambios de schema. El adapter futuro debe respetar el casing/versionado declarado, no renombrar silenciosamente snapshots antiguos. No se implementa un row mapper ni inserción en esta fase.

Secuencia API futura: autenticar y comprobar usuario→finca → adaptar/seleccionar estrictamente los campos canónicos → llamar motor → ok:false implica no guardar → ok:true de una versión implementada/autorizada implica persistir snapshot completo → responder. Outputs/hash/versiones no se aceptan como autoridad desde cliente. Ningún formato HTTP o endpoint nuevo definido aquí.

## 11. Fórmulas efectivas y constantes

Notación canónica: E=etoMmPerDay, K=cropCoefficient, D=daysWithoutIrrigation, CC/PMP en %, Da=g/cm3, Pr=m, f=depletionThresholdPct en %, W=widthM, L=lengthM, s=slopePct en %, Q=flowLps, t=durationMin, a=advanceTimeMin. Todas las operaciones son Number, en el orden de §5; no redondeos intermedios.

| ID | Output | Fórmula implementada | Unidad |
| --- | --- | --- | --- |
| F01 | maxNonErosiveFlowLps | s===0 ? 6.3 : 0.0063/(s/100) | L/s |
| F02 | advanceRatioPct | 100*a/t | % |
| F03 | targetDepthMm | E*K*D | mm |
| F04 | infiltratedDepthStartMm | 4.5*sqrt(t) | mm |
| F05 | infiltratedDepthMiddleMm | 4.5*sqrt(t-a*0.5) | mm |
| F06 | infiltratedDepthEndMm | 4.5*sqrt(t-a) | mm |
| F07 | appliedVolumeL | Q*t*60 | L |
| F08 | estimatedUsefulVolumeL | Zmedio*W*L | L |
| F09 | residualLossVolumeL | aplicado-útil | L |
| F10 | applicationEfficiencyPct | 100*útil/aplicado | % |
| F12 | availableWaterMm | ((CC-PMP)/100)*Da*Pr*1000 | mm |
| F13 | availableCapacityL | AU*W*L | L |
| F14 | maxRecommendedDepthMm | AU*(f/100) | mm |
| F15 | maxRecommendedVolumeL | lámina máxima*W*L | L |

Constantes EFFECTIVE_PARAMETERS congeladas: k=4.5 mm/min^0.5, exponente=0.5, llegada media=0.5, coeficiente Qmax positivo=0.0063 L/s con pendiente fraccional, rama cero=6.3 L/s. Conversiones exactas UNIT_CONVERSIONS congeladas: 100 %/unidad, 60 s/min, 1000 mm/m.

Decisión F01: usar la rama final canónica 6.3 aprobada. No conservar 6.2937 como otro parámetro activo: en Excel solo compensa 0.0063 para la rama cero. Excel guardó 6.300000000000001; la diferencia de último bit queda dentro de tolerancia R1. Para s>0 se conserva 0.0063/(s/100), no reordenar a 0.63/s para prometer identidad bit a bit. Sin cap/interpolación cerca de cero. Si s/100 underflowa a cero o Qmax overflowa, se reporta NON_FINITE_RESULT, no se usa la rama de pendiente cero.

F04:F06 emplean oportunidades temporales, sin 0/50/100 m ni efecto de longitud/textura/caudal. F08 es volumen útil estimado literal, no agua realmente almacenada. F13 es capacidad estimada del área, no hidráulica. F09 no reparte pérdidas por causa. F10 es estimada, no medida. F03 es necesidad simplificada, no déficit real.

Exclusiones: F11, F16, F17; runoff, conteo/ha, lluvia, humedad inicial, recesión, optimización, cultivo automático y coeficientes por textura. No hay campos activos ni conversiones redundantes para ellas.

## 12. Casos golden y bordes

Fixture común G01: §3. Vector completo abajo; una variante hereda todos los outputs no indicados. Tolerancia exclusiva de tests: max(1e-8,1e-9*abs(expected)), nunca usada en admisión física.

| Output G01 | Esperado |
| --- | --- |
| targetDepthMm | 70 |
| availableWaterMm | 91 |
| availableCapacityL | 7098 |
| maxRecommendedDepthMm | 54.6 |
| maxRecommendedVolumeL | 4258.8 |
| appliedVolumeL | 3240 |
| infiltratedDepthStartMm | 34.856850115866756 |
| infiltratedDepthMiddleMm | 34.152598729818493 |
| infiltratedDepthEndMm | 33.433516117812076 |
| estimatedUsefulVolumeL | 2663.9027009258425 |
| residualLossVolumeL | 576.0972990741575 |
| applicationEfficiencyPct | 82.21921916437785 |
| advanceRatioPct | 8 |
| maxNonErosiveFlowLps | 6.3 |

| Caso | ok | Cambio input respecto G01 | Resultado principal / outputs que cambian | Diagnósticos / error |
| --- | --- | --- | --- | --- |
| G01 | true | Sin cambios | Vector completo de 14 outputs anterior | P02,P04; sin error |
| G02 | true | s=0.30 | Qmax=2.1 | P02,P04 |
| G03 | true | s=1 | Qmax=0.63 | P01,P02,P04 |
| G04 | true | Arenoso, CC=10, PMP=5 | AU=45.5, capacidad=3549, maxDepth=27.3, maxVolume=2129.4 | P02,P04,P05 en los 3 puntos |
| G05 | true | Franco explícito | Igual G01 | P02,P04 |
| G06 | true | Arcilloso, CC=30, PMP=15 | AU=136.5, capacidad=10647, maxDepth=81.9, maxVolume=6388.2 | P02 |
| G07 | true | Q=7 | aplicado=25200, residual=22536.097299074157, eficiencia=10.571042463991438 | P01,P02,P04 |
| G08 | true | a=36 | ratio=60, medio=29.16333314283537, final=22.045407685048602, útil=2274.7399851411587, residual=965.2600148588413, eficiencia=70.20802423275181 | P02,P04; sin D03 |
| G09 | false | a=61,t=60 | Sin output | INVALID_RELATIONSHIP previo al cálculo |
| G10 | true | a=18 | ratio=30, medio=32.13642792844283, final=29.16333314283537, útil=2506.6413784185406, residual=733.3586215814594, eficiencia=77.36547464254755 | P02,P04; sin clasificación |
| G11 | true | a=30 | ratio=50, medio=30.186917696247164, final=24.647515087732476, útil=2354.579580307279, residual=885.4204196927212, eficiencia=72.67220926874317 | P02,P04; sin clasificación |
| G12 | false | Q=0.1 | Sin output exitoso; cálculo literal rechazado: aplicado=360, útil=2663.9027009258425, residual=-2303.9027009258425, eficiencia≈739.9729724794007 | MODEL_INCONSISTENCY; nunca clamp |

Pruebas adicionales: pendiente cero, positiva 1e-10 (Qmax≈6.3e9, sin cap), pendiente mínima positiva no representable tras conversión, avance cero y avance=duración (infiltración final=0), ETo/Kc/días cero admitidos, igualdad de comparaciones, overflow/underflow con inputs finitos. Guard detecta resultados fuera de dominio/no finitos. Cambiar solo textura no altera outputs/metadata; cambiar ancho/largo altera volúmenes y no infiltraciones. No tests de campo ni recálculo interactivo en Excel.

## 13. QA y compatibilidad transversal

Tests node:test: test/irrigation.contract.test.js conserva 37 checks R3A adaptando el antiguo skeleton al éxito y metadata efectiva. test/irrigation.calculator.test.js agrega 23 tests de fórmulas/golden/bordes/diagnósticos/aislamiento/mapeo. Los golden contrastan cada vector de 14 outputs; no se limitan a fórmulas replicadas en asserts.

Tests focalizados: 60 PASS / 0 FAIL. Suite completa al cierre: 117 PASS / 0 FAIL. Incluye Manning, HTTP histórico con DB mock, schema/startup y UTC. Ninguna conexión Aiven. Mapeo offline comprueba 14 campos numéricos calculados contra las columnas DOUBLE NN de la migration por lectura estática, sin importar Knex o ejecutar migration.

R1/R2, cuatro migrations, Manning, routes, configuración UTC y dependencias quedan intactos. Git inicial R3B: los cinco archivos R3A sin seguimiento. R3B modifica models/calculator/contract test/documento y agrega calculator test; validator permanece intacto. Sin archivos tracked modificados, commit, push, frontend, API o persistencia.

## 14. Limitaciones y próximo checkpoint

Implementación matemática verificada; no validación agronómica. Pendientes: ancho/separación, base CC/PMP, calibración k/Qmax y extremos, significado de útil/residual/eficiencia, bandas 25/30/50, estado inicial y límites agronómicos. No se resuelven por pasar tests.

El motor conserva precisión Number, no exactitud decimal; resultados extremos pueden overflowar o underflowar y se rechazan. Comparaciones físicas son estrictas, sin tolerancia inventada. Runtime distinto puede producir diferencias de último bit; reproducción se verifica con tolerancia R1 sin alterar el snapshot.

El cierre anterior de R3B habilitó su revisión; R3C está autorizado y documentado a continuación. Antes de activar persistencia deberán conservarse implementación/versiones y atenderse el borrado RESTRICT que hoy puede borrar Manning antes de fallar. Ninguna de estas fases habilita API o guardados por inferencia.

## 15. R3C — Auditoría previa y contrato congelado

Auditoría antes de editar: implementación, contratos, unidades, versiones, 15 inputs, 14 outputs, golden y dominios de R2 coinciden. No hay contradicción conocida entre un éxito del motor y los CHECK numéricos/JSON/hash. La evidencia R3B ya usa Number con nombres canónicos, operador, procedencia y unidades. Faltaba especificar formalmente sus variantes y comprobar igualdades P03/P05 por punto; los tests anteriores no afirmaban todas esas igualdades exactas.

R3C agrega pruebas y documentación, sin modificar los tres módulos de runtime, tests R3A/R3B, R1/R2 ni migrations. No cambia resultados, mensajes, orden, códigos ni metadata. Se conservan las cuatro versiones de §2: no se incrementan por agregar tests. implementationReference.stage sigue R3B_estimation porque identifica la implementación matemática, no la fase de QA.

### 15.1. Evidence contract definitivo P01:P05

Convención común preservada: magnitudes como Number finitos bajo nombres canónicos; operator ASCII; source=R1_comparison; scientificValidation=not_validated. El source identifica las comparaciones propuestas en R1 y autorizadas en R3B, derivadas de outputs de la planilla; no significa que Excel ejecute estas reglas.

| ID | Magnitudes evidence, sin formatear | Unidad declarada | fields exactos |
| --- | --- | --- | --- |
| P01 | flowLps, slopePct, maxNonErosiveFlowLps | units={flowLps:L/s, slopePct:%, maxNonErosiveFlowLps:L/s} | irrigation.flowLps, furrow.slopePct, diagnostics.maxNonErosiveFlowLps |
| P02 | infiltratedDepthEndMm, targetDepthMm | unit=mm | application.infiltratedDepthEndMm, waterNeed.targetDepthMm |
| P03 | point, infiltratedDepthMm, targetDepthMm | unit=mm | application.infiltratedDepth{Start/Middle/End}Mm, waterNeed.targetDepthMm |
| P04 | targetDepthMm, maxRecommendedDepthMm | unit=mm | waterNeed.targetDepthMm, soilWater.maxRecommendedDepthMm |
| P05 | point, infiltratedDepthMm, maxRecommendedDepthMm | unit=mm | application.infiltratedDepth{Start/Middle/End}Mm, soilWater.maxRecommendedDepthMm |

Se formaliza este esquema por regla sin reemplazarlo por values.actual/threshold: los nombres existentes aportan identidad del dato y preservan snapshots v1. unit=mm cubre todas las magnitudes de comparaciones homogéneas; units por campo cubre P01, que incluye pendiente además de caudal. Son variantes explícitas de una misma convención, no textos localizados como autoridad. Cambiar claves emitidas exigiría revisar versionado; R3C no lo hace. No se introducen dos autoridades para parámetros.

point solo admite start/middle/end en P03/P05. No posiciones, distancias fijas ni metadata 0/L/2/L. Cada item contiene exactamente id, ruleVersion, severity, fields, evidence y message; los tests verifican las claves y los valores de evidencia emitidos por el motor. El validador público sigue validando JSON/shape general; no se redefine como catálogo de reglas arbitrarias. Una integración futura debe consumir los diagnósticos generados por el motor, no payload de cliente.

Mensajes actuales, preservados como presentación:

- P01: «El caudal supera el máximo no erosivo estimado por la planilla; no demuestra erosión efectiva.»
- P02: «La lámina estimada al final es menor que la necesidad acumulada simplificada; no es un déficit medido.»
- P03: «La infiltración estimada supera la necesidad simplificada en este punto; no demuestra pérdida profunda.»
- P04: «La necesidad acumulada simplificada supera la lámina máxima estimada según el umbral seleccionado.»
- P05: «La infiltración estimada supera la lámina del umbral en este punto; no demuestra percolación profunda.»

Condiciones/severidades: §7. Todas estrictas, igualdad no dispara. P01/P02/P04/P05 warning, P03 info. Ninguna comparación agronómica es fatal, medida o científicamente certificada.

### 15.2. Fronteras, orden y duplicados

Fixture algebraicamente controlable de tests: durationMin=49, advanceTimeMin=48 produce oportunidades 49/25/1 min y láminas 31.5/22.5/4.5 mm. No se redondea para lograr igualdad. ETo con Kc=days=1 controla la meta; CC=100, PMP=0, Da=1 y f=100, con profundidad apropiada, controla el umbral. Los tests afirman igualdad exacta de los operandos antes de exigir ausencia de diagnóstico, y verifican cada lado de la frontera sin epsilon en reglas.

P01: Q=Qmax sin alerta. P02: final=meta sin alerta. P04: meta=umbral sin alerta. P03/P05: cada uno de start/middle/end igual al comparador sin alerta de ese punto, independientemente de alertas en otros puntos.

Orden intencional: P01, P02, P03-start, P03-middle, P03-end, P04, P05-start, P05-middle, P05-end. El array de una ejecución es la subsecuencia de condiciones verdaderas. Máximo una instancia P01/P02/P04 y una por punto P03/P05: máximo nueve; condiciones pueden impedir que todas coexistan. Se prueba orden y unicidad con escenarios complementarios, sin sort accidental del resultado ni deduplicación por id que elimine puntos.

Avance=0: las tres láminas coinciden. Avance=duración: final=0 y medio=4.5*sqrt(duración/2). Ratios 25/30/50/60 siguen sin D01:D08 ni categorías Óptimo/Regular/Crítico. No se interpretan bandas pendientes.

Demanda cero por ETo, Kc o días: es válida. P02 no se activa porque final≥0; P03 sí se activa donde infiltración>0, consecuencia literal de la regla. Si avance=duración, P03 solo start/middle, nunca end=0. No se cambia esta semántica por una interpretación agronómica nueva.

### 15.3. Errores, finitud y alcance de las invariantes

Se acumulan todos los errores detectables en una pasada del guard; no se detiene al primer campo. Orden: dominios/finitud por orden de OUTPUT_CONTRACT, después relación útil≤aplicado. G12 acumula residual negativo, eficiencia>100 y útil>aplicado, sin output parcial. Las condiciones útil>aplicado, residual<0, eficiencia>100 y eficiencia<0 se comprueban por separado en el validador puro; no se inventa un input válido que produzca eficiencia negativa cuando las fórmulas no lo permiten.

Un no finito produce NON_FINITE_RESULT, field=output.<grupo>.<magnitud>, rule=finite_number, category=consistency y mensaje. field identifica la etapa: targetDepthMm/F03, availableWaterMm/F12, appliedVolumeL/F07 o maxNonErosiveFlowLps/F01. received se omite cuando no es finito, no se serializa como null. Si otros campos finitos infringen dominios se acumulan sus errores. No se construyen diagnósticos después de un guard fallido. Códigos, categorías y mensajes del runtime no cambian; excepciones de programación siguen propagándose.

Cobertura de overflow: demanda, AU, volumen y Qmax con inputs finitos. Para duración finita no negativa, sqrt(duración)*4.5 permanece finita incluso en Number.MAX_VALUE; no se fabrica un test de overflow de infiltración imposible bajo este modelo. Productos posteriores y ratios sí pueden overflowar. Underflow a cero en magnitudes positivas produce MODEL_INCONSISTENCY; no todo underflow equivale a NON_FINITE_RESULT. Si un cociente posterior se vuelve NaN/Infinity se reporta también no finitud. No se añaden límites artificiales.

Pendiente=0 usa 6.3. Pendiente pequeña positiva, por ejemplo 1e-10 %, conserva Qmax≈6.3e9 L/s. Number.MIN_VALUE % no conserva un denominador positivo representable al dividir por 100: falla con NON_FINITE_RESULT, nunca vuelve a la rama cero. Sigue pendiente la validez de la singularidad; sin cap, mínimo o interpolación.

Invariantes verificadas en matriz finita representativa de 24 escenarios válidos: aplicado=Q*t*60; residual=aplicado-útil; eficiencia=100*útil/aplicado; capacidad=AU*W*L; volumen máximo=lámina máxima*W*L; inicio≥medio≥final; avance∈[0,100]. Relaciones numéricas se comparan con tolerancia R1 cuando corresponde. No se convierten en tolerancia física para admitir resultados rechazados.

Tests metamórficos en escenarios consistentes: duplicar Q duplica aplicado y reduce eficiencia a la mitad sin alterar infiltración/útil; duplicar W duplica capacidad/útil/volumen máximo sin alterar AU/infiltración; textura no cambia outputs; pendiente solo modifica Qmax y comparaciones dependientes; ETo solo modifica meta y comparaciones dependientes. No se agregan dependencias entre fórmulas.

### 15.4. Snapshots, R2 y reproducibilidad

El snapshot tiene 15 campos MVP: 14 números y textura. Trim y ausencia→null siguen R3A, sin defaults de suelo ni campos desconocidos. Se verifica aislamiento en ambas direcciones entre caller y result.input; metadata y diagnostics también se copian por llamada. Parametrización efectiva: 4.5/0.5/0.5/0.0063/6.3 con unidades y evidencia not_validated/spreadsheet-derived/none, sin cambios. El orden de propiedades de un objeto externo no altera el resultado canónico.

implementationReference={modelVersion:irrigation-estimation-v1, stage:R3B_estimation, arithmetic:IEEE-754_Number} es referencia estable, no digest ni garantía de archivado. No fecha, ruta, host o commit inventado. La publicación futura deberá conservar implementación versionada; SOURCE_HASH identifica Excel, no código. Los tests comprueban el SHA-256 exacto lowercase de §9 y ausencia de lecturas Excel en runtime.

Compatibilidad offline: mapeo explícito de 15 inputs/14 outputs contrastado con contratos y migration existente. Un parser de comparaciones restringidas en tests evalúa las diez expresiones CHECK reales leídas como texto sobre 27 muestras válidas. No SQL, Knex, import de migration ni conexión a DB. El parser falla si aparece sintaxis no soportada; no ignora constraints. Cubre inputs, dominios de outputs, útil≤aplicado, residual≥0, eficiencia/avance∈[0,100], Qmax>0, metadata objeto, diagnostics array y hash de 64 caracteres.

Justificación general: validateIrrigationInput impone los mismos dominios numéricos de los CHECK de input; validateIrrigationOutput impone dominios de los CHECK de output y la relación útil≤aplicado antes de éxito. Metadata se construye como objeto, items como array y hash fijo válido. Las muestras corroboran esa correspondencia, no constituyen certificación real de persistencia, ownership, created_at o JSON de un adapter futuro. Sin divergencia conocida que exija alterar R2.

### 15.5. QA y puerta de R3D

Nuevo test/irrigation.boundaries.test.js: 12 tests focalizados útiles; sin cambios de runtime o tests anteriores. Suite completa al cierre: 129 PASS / 0 FAIL; conserva todos los golden de R3B, Manning, startup/schema y UTC. Verificación de hashes de archivos previos, incluidos los tres módulos del motor y cuatro migrations; R1/R2, routes, dependencies y package-lock intactos. Sin IO en el motor, nuevas fórmulas, campos, redondeos o funciones excluidas.

Stress manual local puro: 10.000 llamadas G01 comparadas profundamente, mutando después las copias de input/metadata/evidence devueltas; input original congelado. Ninguna diferencia ni contaminación observable, incluida llamada final. No benchmark, SLA, prueba de crecimiento de memoria o certificación de ausencia de fugas; no se agrega ese loop como test permanente.

Listo técnicamente para revisión de R3C y definición/autorización de R3D. Pendientes agronómicos y archivado de implementación siguen explícitos; riesgo del borrado RESTRICT no se corrige aquí. R3C termina sin API, repository, DB, frontend, commit o push. No iniciar R3D.

## 16. R3D — Freeze irrigation-estimation-v1

Fecha de cierre documental: 2026-10-13, America/Buenos_Aires. R3C aprobado y R3D autorizado. Las prohibiciones de iniciar R3D en los checkpoints anteriores describen sus límites históricos; este freeze no autoriza iniciar R4.

### 16.1. Definición congelada y auditoría de drift

Versiones congeladas: irrigation-estimation-v1, irrigation-contract-v1, irrigation-metadata-v1 e irrigation-diagnostics-v1. Runtime: los tres módulos CommonJS de §1. Evidencia ejecutable: test/irrigation.contract.test.js (37 tests), irrigation.calculator.test.js (23), irrigation.boundaries.test.js (12). Documentos fuente: R1/A01:A10 y R2/B01:B20, preservados.

Sin drift respecto del alcance aprobado en inputs, outputs, unidades, fórmulas, versiones, diagnósticos, metadata o exclusiones. Las diferencias deliberadas respecto del inventario histórico completo de Excel están autorizadas y documentadas: no F11/F16/F17; no cola/ha/conteo; no D01:D08; inicio/medio/final sin distancias fijas; rama cero canónica Qmax=6.3. No son correcciones silenciosas ni validación agronómica.

Se congelan F01:F10 y F12:F15 en las expresiones y el orden numérico de §§5/11. Constantes: infiltrationCoefficient=4.5, infiltrationExponent=0.5 (Math.sqrt), middleArrivalFactor=0.5, qmaxPositiveSlopeCoefficient=0.0063 y qmaxZeroSlopeValue=6.3. Una sola autoridad numérica en EFFECTIVE_PARAMETERS, congelada; metadata.qmaxCoefficient refiere al coeficiente positivo, no lo redefine. Conversiones exactas, contratos y template también congelados. Overrides de parámetros en input se rechazan por UNKNOWN_FIELD. Sin selección desde entorno, DB o catálogo.

Política de cambio: cualquier modificación futura de fórmula, constante, semántica, orden operativo relevante, output, regla/severidad/evidencia diagnóstica o metadata necesaria para reproducción debe evaluar una nueva versión y conservar la implementación anterior. Cambiar comportamiento bajo los mismos identificadores está fuera del freeze. Tests adicionales que solo verifican el mismo comportamiento no requieren incremento. Si cambian estructura/unidades del contrato, esquema de metadata o reglas, revisar también sus versiones específicas. Snapshots antiguos no se reinterpretan con versiones nuevas.

### 16.2. Certificación golden y G01

Matriz final G01:G12: §12, con cambios respecto de G01, resultado principal, ok, diagnósticos y errores. Los vectores completos positivos están en los fixtures/tests R3B, heredando únicamente los campos no modificados; no se duplica otro catálogo. G01 certifica sus 14 outputs con tolerancia max(1e-8,1e-9*abs(expected)), versiones, hash exacto, schema de metadata y parámetros/evidencia efectivos.

Diagnósticos completos G01: exactamente P02 y P04, ambos warning, ruleVersion=irrigation-diagnostics-v1. Evidence P02: infiltratedDepthEndMm=33.433516117812076, targetDepthMm=70, operator=<, unit=mm. Evidence P04: targetDepthMm=70, maxRecommendedDepthMm=54.6, operator=>, unit=mm. Ambos source=R1_comparison y scientificValidation=not_validated, fields y mensajes exactos de §15.1. Certificación local adicional compara profundamente ambos objetos emitidos, no solo IDs; metadata coincide con el template efectivo y los parámetros aprobados.

G09: INVALID_RELATIONSHIP en input.irrigation.advanceTimeMin. G12: MODEL_INCONSISTENCY en residual, eficiencia y útil; tres errores acumulados. Overflow finito de demanda/AU/volumen/Qmax: NON_FINITE_RESULT. Ninguno retorna éxito parcial ni metadata/diagnósticos de simulación válida. Sin clamp o redondeo. No se agregan tests permanentes nuevos: la cobertura existente y la comprobación local de freeze cubren el alcance.

### 16.3. Error contract público congelado

Todos los errores esperables tienen code, category, field, rule, expected y message; received solo si es un dato seguro finito/booleano/null según §4. field es una ruta canónica (no hay propiedad fields en este error contract). Se acumulan en orden determinista. Mensaje español fijo por regla como explicación; consumidores usan code/rule/field, nunca el texto como clave. Sin stack, payload completo, secretos o valores no finitos serializados a null. Excepciones inesperadas de programación se propagan.

| Code existente | Category / ámbito | field | rule real / política de mensaje |
| --- | --- | --- | --- |
| INVALID_SHAPE | validation input; consistency guard público de output | raíz/grupo/campo afectado | plain_object o data_properties_only; objeto de datos requerido, sin accesores |
| UNKNOWN_FIELD | validation input; consistency guard de output | ruta desconocida | known_fields_only; fuera del contrato canónico |
| MISSING_FIELD | validation input; consistency guard de output | magnitud ausente | finite_number; número finito requerido sin coerción |
| INVALID_TYPE | validation input; consistency guard de output | magnitud o input.soil.texture | finite_number u optional_texture; tipo explícito requerido |
| NON_FINITE_NUMBER | validation | magnitud input | finite_number; valor no representable como finito |
| OUT_OF_RANGE | validation | magnitud input o textura | structural_domain o texture_length; rango explícito, sin normalizar |
| INVALID_RELATIONSHIP | validation | input.soil.fieldCapacityPct o input.irrigation.advanceTimeMin | CC_greater_than_PMP o advance_within_duration; relación obligatoria |
| NON_FINITE_RESULT | consistency | magnitud output | finite_number; valor no representable como finito |
| MODEL_INCONSISTENCY | consistency | magnitud output | structural_domain o useful_not_above_applied; no recortar dominio/balance imposible |
| INVALID_DIAGNOSTIC | consistency; guard público | output.diagnostics.items y subrutas | diagnostic_array, nonempty_identifier, diagnostic_severity, field_paths, evidence_object, optional_text, finite_acyclic_json o data_properties_only; estructura/evidencia segura requerida |
| FATAL_DIAGNOSTIC | consistency; guard público | output.diagnostics.items[i].severity | no_fatal_diagnostic_in_success; error fatal no acompaña snapshot válido |
| MODEL_NOT_IMPLEMENTED | reservado histórico, no emitido en v1 | sin ruta activa en runtime actual | sin rule/category activa; pertenecía al skeleton y permanece como código exportado |

Distinción de alcance: calculateIrrigationSimulation acepta input, no output/diagnósticos de cliente. INVALID_DIAGNOSTIC/FATAL_DIAGNOSTIC y fallos estructurales de output son defensas del validador público; no eventos esperados de fórmulas correctas con input canónico. No se elimina ni renombra ningún código. El código reservado MODEL_NOT_IMPLEMENTED no implica que esta implementación carezca de cálculo.

### 16.4. Diagnostics, metadata y procedencia congelados

Contrato definitivo P01:P05: §§7/15.1/15.2. IDs, versión, severity, fields, evidence, operador, point, orden y unicidad sin cambios. Se certifican igualdades estrictas y ausencia de D01:D08 en runtime. Sin nuevas alertas/recomendaciones. P03/P05 conservan instancia por punto start/middle/end; no posiciones ni categorías de avance.

Metadata congelada: metadataSchemaVersion, effectiveParameters, units, assumptions, evidenceState, referenceVersions, implementationReference, diagnosticRules y parameterProvenance. ModelKind=estimation, scientificValidation=not_validated, source=spreadsheet-derived, fieldCalibration=none. Parámetros/unidades y semántica en §8; identificadores de implementación en §15.4. No timestamp, ruta local, hostname, entorno o secreto. Conserva las exclusiones de lluvia/humedad inicial como supuestos, no funcionalidades.

SOURCE_HASH exacto: 42592487e6e07deb1b25a073d74086a09c1bb19cb38411aafc31d28ea64d2127. Constante lowercase de 64 hex, sin leer/recalcular Excel en runtime. Identifica fuente documental; no es hash del código. Referencia estable de implementación no reemplaza su archivado. El freeze técnico local no crea un release ni un commit y no garantiza recuperación futura sin conservar estos archivos/versiones.

### 16.5. Pureza, inmutabilidad y determinismo

Imports reales: irrigation-models.js ninguno; irrigation-validation.js solo ./irrigation-models; irrigation-calculator.service.js solo ./irrigation-models y ./irrigation-validation. Sin Express, Knex, mysql2, fs, path, JWT, routes, configuración DB, process.env, reloj, random o caché mutable. fs/path se usan únicamente en tests para inspección estática, no en runtime.

Input no mutado; snapshots y arrays de outputs/metadata/diagnósticos nuevos por llamada; constantes/template congelados recursivamente. Auditoría local adicional: G01 repetido 100 veces con deep equality del envelope completo e input original congelado. Se preservan pruebas de mutación y el stress R3C de 10.000 llamadas como evidencia histórica, sin convertirlo en benchmark ni promesa de ausencia de fugas.

### 16.6. Mapping R2 y payload conceptual R4

Mapeo estable: 15 inputs en §3 y 14 outputs en §6. modelVersion→model_version; contractVersion→contract_version; sourceHash→source_hash; metadata→model_metadata; output.diagnostics.items→diagnostics. No persistir todo output.diagnostics en la columna JSON: sus dos magnitudes ya tienen columnas propias.

Guard de éxito impone dominios de los CHECK R2: inputs canónicos finitos, relación CC>PMP, avance≤duración; outputs completos/finitos y dominios positivos/no negativos; útil≤aplicado, residual≥0, eficiencia/avance∈[0,100], Qmax>0. Metadata objeto, diagnostics array, hash válido. Compatibilidad conceptual y muestras offline certificadas en §15.4; no certificación nueva de DB/driver o inserción real. finca_id/name/created_at y ownership son responsabilidad de aplicación futura.

Draft exclusivamente documental, después de autorización/ownership y solo para result.ok===true:

```js
{
  finca_id: authorizedFincaId,
  name: normalizedOptionalName, // null o nombre validado; inmutable
  ...inputColumns,             // exactamente las 15 columnas de §3
  ...outputColumns,            // exactamente las 14 columnas de §6
  model_version: result.modelVersion,
  source_hash: result.sourceHash,
  contract_version: result.contractVersion,
  model_metadata: result.metadata,
  diagnostics: result.output.diagnostics.items,
  created_at: serverUtcDate
}
```

No es código de adapter implementado. Son 37 propiedades de inserción; id se autogenera como columna 38. No updated_at ni campos excluidos. inputColumns/outputColumns representan únicamente el mapeo explícito de valores efectivos del motor, sin copiar req.body ni conversiones redundantes. No name por defecto inventado: ausencia es null. created_at es Date del servidor, fuera del motor, bajo timezone Z y sesión efectiva UTC de R2. La futura serialización JSON deberá conservar objeto/array, Number finitos y precisión; no defaults {} ni [] para ocultar evaluación/fallos. El mecanismo de driver se certificará al implementar R4.

Responsabilidades R4: HTTP autentica, verifica ownership y adapta/parses campos canónicos sin coerción silenciosa; motor valida, calcula y construye diagnósticos/metadata; persistencia mapea, inserta un snapshot completo consistente y consulta historial bajo ownership. Si ok:false, no insertar. Versiones/hash/outputs/metadata no son autoridad del cliente. El payload conceptual no autoriza escribir datos.

### 16.7. R4-BLOCKER-DELETE-FINCA y pendientes

R4-BLOCKER-DELETE-FINCA: src/routes/fincas.routes.js elimina primero calculos Manning y después fincas, sin transacción. Con simulaciones existentes, la segunda eliminación puede fallar por RESTRICT y dejar Manning eliminado. R4 debe resolver este flujo ANTES de habilitar creación real de simulaciones, preservando Manning ante rechazo/carrera y la política RESTRICT aprobada. No corregido ni ejecutado en R3D.

Pendientes no resueltos: widthM ancho/separación; CC/PMP gravimétricos/volumétricos; calibración k=4.5; significado de útil/residual/eficiencia; Qmax en extremos; bandas 25/30/50; ausencia de lluvia/humedad inicial. No bloquean el freeze técnico del modelo estimativo, pero impiden presentarlo como validado agronómicamente. Conservar implementación/versiones antes de publicación para reproducibilidad histórica.

### 16.8. QA final y puerta de R4

Suites explícitas: node --test test/irrigation.contract.test.js test/irrigation.calculator.test.js test/irrigation.boundaries.test.js: 72 PASS / 0 FAIL, sin omisiones. Regresión npm test: 129 PASS / 0 FAIL, sin omisiones. Sin nuevos tests ni dependencias, al no existir gap que justifique agregarlos. Solo se actualiza este documento; no manifest separado que duplique el contrato.

Hashes de archivos previos, incluidos cuatro migrations, runtime y tests irrigation, R1/R2, configuración UTC, Manning, routes, package.json/package-lock.json, permanecen intactos. Git diff tracked vacío; documento R3 ya estaba sin seguimiento y sigue así. git diff --check y revisión de espacios del documento sin incidencias. No commit, push, DB/Aiven, API, repository, frontend, rollback o ejecución de migrations.

irrigation-estimation-v1 queda congelado técnicamente como motor estimativo estable para integración futura. R4 puede definirse/revisarse tras autorización expresa; la creación real exige resolver R4-BLOCKER-DELETE-FINCA. R3D termina aquí y no inicia R4.
