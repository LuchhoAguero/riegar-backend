# R4F-B — ESPECIFICACIÓN DEFINITIVA V2

Fecha: 2026-10-14, America/Buenos_Aires. Documento de especificación para el diseño técnico R4F-C. No implementa V2 ni cambia el backend V1.

## 1. Estado y alcance

Se fija el contrato conceptual V2 a partir de las confirmaciones recientes del cliente y del Excel oficial `(2)`, auditado íntegramente. Esta especificación es la autoridad de diseño futura para ese alcance; [R4F-A](irrigation-client-update-audit.md) conserva carácter histórico y no se modifica. R5 permanece pausado según la solicitud. R4F-C no se inicia ni se implementa.

Git al iniciar: rama `feature/riego-surcos-v1`, HEAD `1f581dfc18f8e9ae18c3a88db1dd4c695a60d1ce`, árbol limpio, sin diff previo. Esto reemplaza como estado actual el Git registrado históricamente en R4F-A. Único archivo autorizado de esta fase: `docs/irrigation-v2-specification.md`. Sin cambios de runtime, tests, migrations, DB, frontend, Manning, dependencias, refs, commit ni push. No conexión a Aiven ni investigación externa.

Evidencia local inspeccionada: `src/services/irrigation/{irrigation-models.js,irrigation-calculator.service.js,irrigation-validation.js}`, mapper/service/persistence de simulaciones, adaptador HTTP, montaje en app, DELETE de fincas, migration de simulaciones y documentación de contratos/freeze. Las verificaciones del golden son llamadas al motor puro V1 y aritmética independiente en memoria; **no existe implementación V2 ejecutada**. Los 165 PASS y la certificación Aiven del cierre R4 son antecedentes documentados, no QA reejecutado en R4F-B.

## 2. Fuente XLSX oficial

Archivo confirmado por el usuario: **`C:\Users\aguer\Downloads\Riego Pepe Ag ( lucho) (2).xlsx`**, 37118 bytes. El espacio antes de `(2)` forma parte de su nombre real; es el archivo señalado como oficial aunque la solicitud lo escribe sin ese espacio. No se sustituyó por el Excel anterior.

Inspección de todas las celdas no vacías, fórmulas, caches, formatos, tablas, referencias, gráfico y contenido oculto:

| Hoja | Rango usado | Celdas no vacías | Fórmulas | Función |
| --- | --- | ---: | ---: | --- |
| Hoja 1 | A2:H35 | 78 | 20 | simulación y dos nuevos indicadores |
| Hoja 2 | A2:P39 | 101 | 0 | tablas y orientaciones manuales |
| Hoja 3 | A1:A4 | 4 | 0 | preguntas didácticas |
| Descripcion | A1:A35 | 32 | 0 | explicación histórica estática |

Todas visibles, sin filas/columnas ocultas, nombres definidos, vínculos externos, comentarios, hyperlinks ni validaciones de datos. Tabla1 en Hoja 1 A2:F30 conserva B30 como texto `18` y etiqueta de totales; V2 no heredará esa coerción. Un gráfico «Balance de agua» enlaza D14:D16/E14:E16 y sus caches coinciden con los valores actuales. Sin imágenes que contengan datos adicionales. No se guardó ni modificó el XLSX; no se certifica recálculo ni renderizado nativo de Excel.

Hoja 1 confirma ETo 5, Kc 0.7, días 20, separación 1.3 m, largo 60 m, pendiente 0, avance 20 min, caudal 0.9 L/s, duración 2 h, Franco, CC 20, PMP 10, Da 1.3, raíz 0.7 m, umbral 0.6 y cantidad 18. Las conversiones canónicas son duración 120 min y umbral 60%; la pendiente Excel es fracción con formato `%`, mientras la API recibe porcentaje numérico.

Fórmulas reales completas:

| Celda | Fórmula literal | Cache |
| --- | --- | ---: |
| B9 | `=0.0063/(B8+(B8=0)) + 6.2937*(B8=0)` | 6.300000000000001 |
| B11 | `=(B10 / 60) / B18` | 0.16666666666666666 |
| B14 | `=$B$3*$B$4*$B$5` | 70 |
| B15 | `=$B$3*$B$4*$B$5` | 70 |
| B16 | `=$B$3*$B$4*$B$5` | 70 |
| C14 | `=4.5 * ((B18 * 60) ^ 0.5)` | 49.29503017546495 |
| C15 | `=4.5 * (((B18 * 60) - (B10 / 2)) ^ 0.5)` | 47.19639816765682 |
| C16 | `=4.5 * (((B18 * 60) - B10) ^ 0.5)` | 45 |
| E14 | `=B17 * B18 * 3600` | 6480 |
| E15 | `=C15 * B6 * B7` | 3681.3190570772317 |
| E16 | `=E14 - E15` | 2798.6809429227683 |
| E17 | `=E15 / E14` | 0.5681047927588321 |
| E18 | `=(B3 * B4)` | 3.5 |
| E19 | `= B24 / (B3 * B4)` | 26 |
| B24 | `=((B20 - B21) / 100) * B22 * B23 * 1000` | 91 |
| B25 | `=B24 * B6 * B7` | 7098 |
| B27 | `=B24 * B26` | 54.6 |
| B28 | `=B27 * B6 * B7` | 4258.8 |
| B31 | `=E14*B30` | 116640 |
| B32 | `=B31/1000` | 116.64 |

**20 fórmulas recalculadas / 20 PASS / 0 FAIL**, contrastadas con caches a tolerancia absoluta/relativa 1e-12. E18 reemplaza el viejo cálculo de horas llamado días adicionales; E19 es nuevo. No existe fórmula de días hasta umbral: se incorpora a la especificación por confirmación explícita L del cliente. B12=0 sigue manual y desconectado; no hay total recomendado ni superficie calculada.

Hoja 2 mantiene dos tablas de textura no equivalentes (Arcilloso 35–45/20–25 frente a 30/15), tabla Qmax cuyo intervalo 0.10–0.15% dice 4.20–5.00 L/s, rangos orientativos de Da/almacenamiento, bandas ambiguas 25/30/50, narrativa Mendoza/INTA/FCA sin referencia formal y texto anómalo «Franco-Lim构造». Ninguna alimenta fórmulas. Hoja 3 conserva solo preguntas didácticas. Las invitaciones de Hoja 2 a buscar información o crear tareas son contenido del archivo, no instrucciones de trabajo.

Contenido histórico aún presente: A6 llama «Ancho» a separación; A14:A16 etiqueta 0m/50m/100m con largo 60; Descripcion A8/A9 conserva 0.3 L/s/4.8 min; A25/A29:A31 conserva resultados de ese avance anterior; A22 sigue hablando de dos días adicionales y F19, aunque el cálculo fue reemplazado; A35 confunde recomendado con aplicado y llama lámina a m³. Se reporta este drift editorial y se resuelve la autoridad por §4, sin pedir repetir decisiones ya confirmadas ni corregir los adjuntos.

## 3. SHA-256

SHA-256 oficial, calculado sobre los bytes completos del archivo `(2)`:

```text
30b031d7bd3aa4365c65b6750a91a4004db4ef3452c99bf3924698b89f9dec3b
```

Este será `sourceHash` de V2 al implementarse conforme a esta especificación; filename y fecha de auditoría quedan documentados aquí. El hash identifica la fuente, no el algoritmo ni una validación científica. Debe conservarse también la implementación versionada para reproducción. No se lee Excel en runtime ni se expone su ruta local en metadata pública.

V1 mantiene `42592487e6e07deb1b25a073d74086a09c1bb19cb38411aafc31d28ea64d2127`. Nunca reemplazarlo en filas históricas.

## 4. Jerarquía de fuentes

Orden normativo: confirmaciones explícitas más recientes del cliente; fórmulas/valores reales de Hoja 1 del `(2)`; Hoja 2 orientativa; Hoja 3 contextual; Descripcion/DOCX históricos. Las versiones anteriores del Excel y R4F-A sirven como historia, no como autoridad actual. Los textos históricos discrepantes no generan defaults, reglas ni bloqueos frente a las confirmaciones posteriores.

Se distingue en este documento: evidencia XLSX (§2), decisiones del cliente (§5), decisiones técnicas de contrato (validaciones/shape/zero-use/versiones) e hipótesis explícitas del modelo. Ninguna hipótesis se presenta como medición o bibliografía externa.

## 5. Decisiones confirmadas por cliente

Quedan incorporadas las confirmaciones A–L de la solicitud:

- 1.30 m es distancia entre surcos, utilizada como ancho de referencia tributario simplificado.
- El usuario ingresa cantidad de surcos; se calculan automáticamente aplicado total L/m³.
- Infiltración depende del tiempo efectivo de contacto inicio/mitad/final; etiquetas sin coordenadas fijas.
- Q, avance y duración son variables; GV2-01 usa 0.9 L/s, 20 min y 120 min. Las diferencias históricas eran cambios de escenario.
- Se conserva 4.5 como empírico heredado sin origen/calibración documentados.
- CC/PMP son porcentajes gravimétricos sobre peso seco; Da interviene en su conversión.
- Se conserva `residualLossVolumeL` y presentación «Pérdidas estimadas», con asociación a percolación solo bajo supuestos simplificados y sin afirmar identificación física.
- Se sustituyen los días adicionales por consumo diario y duración hasta agotar agua útil; se agrega duración hasta umbral como indicador distinto.

No es necesario volver a preguntar por estos puntos. Las tablas orientativas no se convierten en valores automáticos.

## 6. Diferencias V1 vs V2

| Dimensión | V1 congelado | V2 especificado |
| --- | --- | --- |
| Geometría | widthM, significado pendiente | furrowSpacingM, distancia y uso tributario explícitos |
| Cantidad | ausente | furrow.furrowCount obligatorio |
| Inputs | 15: 14 números + textura | 16: 15 números, uno entero, + textura |
| Outputs numéricos | 14 | 19: 17 siempre numéricos + 2 number/null |
| Tiempo de suelo | sin indicadores | consumo diario y dos plazos de referencia |
| Alcance | por surco | por surco más aplicado total |
| Base CC/PMP | pendiente en metadata | gravimetric_dry_weight |
| Infiltración | 4.5 fijo no calibrado | igual cálculo; origen heredado explícito |
| Diagnósticos | P01–P05 | mismos; D01–D08 excluidos |
| Históricos | mapper usa contratos globales V1 | lectura por versión obligatoria |

No cambia ninguna fórmula V1 ni se reinterpreta un snapshot suyo. La nueva especificación no declara validación agronómica del motor.

## 7. Versiones propuestas y decisión

| Eje | Decisión definitiva de especificación | Motivo |
| --- | --- | --- |
| modelVersion | `irrigation-estimation-v2` | cambia semántica explícita de espaciamiento, alcance y conjunto de resultados temporales/totales |
| contractVersion | `irrigation-contract-v2` | rename incompatible, nuevo input obligatorio y cinco outputs nuevos, dos nullable |
| metadataSchemaVersion | `irrigation-metadata-v2` | cambian mapas de unidades, desaparece widthMeaning y se añaden hipótesis/semánticas observables de spacing, count, días y procedencia |
| diagnosticsRuleVersion | **`irrigation-diagnostics-v1`** | P01–P05 conserva literalmente comparadores, campos, evidencia, severidades, mensajes y orden; no hay reglas nuevas |

No se aumentan todos los ejes por arrastre. Metadata V2 se justifica por shape y semántica, no solo por rellenar un campo pendiente. Ninguna constante de versión del runtime se modifica en esta fase.

## 8. Inputs V2 y output contract exacto

Input canónico del motor, ejemplo GV2-01:

```json
{
  "crop": { "etoMmPerDay": 5, "cropCoefficient": 0.7, "daysWithoutIrrigation": 20 },
  "soil": {
    "texture": "Franco", "fieldCapacityPct": 20, "wiltingPointPct": 10,
    "bulkDensityGcm3": 1.3, "rootDepthM": 0.7, "depletionThresholdPct": 60
  },
  "furrow": { "furrowSpacingM": 1.3, "lengthM": 60, "slopePct": 0, "furrowCount": 18 },
  "irrigation": { "flowLps": 0.9, "durationMin": 120, "advanceTimeMin": 20 }
}
```

Conteo exacto: crop 3 + soil 6 + furrow 4 + irrigation 3 = **16 campos conceptuales**, de los cuales 15 numéricos (14 magnitudes Number y 1 entero seguro) y 1 textura descriptiva. Todos los números obligatorios, sin defaults; textura puede faltar/null y se canoniza a null. El HTTP conserva `name` opcional, que es identidad de aplicación, no input del modelo: con name presente son 17 hojas de datos en el body. No aceptar `widthM`, `wettedWidthM` ni aliases en POST V2.

Shape de output para un éxito, con valores GV2-01:

```json
{
  "waterNeed": { "targetDepthMm": 70, "dailyCropWaterUseMmPerDay": 3.5 },
  "soilWater": {
    "availableWaterMm": 91, "availableCapacityL": 7098,
    "maxRecommendedDepthMm": 54.6, "maxRecommendedVolumeL": 4258.8,
    "daysUntilAvailableWaterExhaustion": 26, "daysUntilDepletionThreshold": 15.6
  },
  "application": {
    "appliedVolumeL": 6480,
    "infiltratedDepthStartMm": 49.29503017546495,
    "infiltratedDepthMiddleMm": 47.19639816765682,
    "infiltratedDepthEndMm": 45,
    "estimatedUsefulVolumeL": 3681.3190570772317,
    "residualLossVolumeL": 2798.6809429227683
  },
  "totals": { "totalAppliedVolumeL": 116640, "totalAppliedVolumeM3": 116.64 },
  "efficiency": { "applicationEfficiencyPct": 56.8104792758832 },
  "diagnostics": {
    "advanceRatioPct": 16.666666666666668, "maxNonErosiveFlowLps": 6.3,
    "items": [
      {
        "id": "P02", "ruleVersion": "irrigation-diagnostics-v1", "severity": "warning",
        "fields": ["application.infiltratedDepthEndMm", "waterNeed.targetDepthMm"],
        "evidence": {
          "infiltratedDepthEndMm": 45, "targetDepthMm": 70, "operator": "<", "unit": "mm",
          "source": "R1_comparison", "scientificValidation": "not_validated"
        },
        "message": "La lámina estimada al final es menor que la necesidad acumulada simplificada; no es un déficit medido."
      },
      {
        "id": "P04", "ruleVersion": "irrigation-diagnostics-v1", "severity": "warning",
        "fields": ["waterNeed.targetDepthMm", "soilWater.maxRecommendedDepthMm"],
        "evidence": {
          "targetDepthMm": 70, "maxRecommendedDepthMm": 54.6, "operator": ">", "unit": "mm",
          "source": "R1_comparison", "scientificValidation": "not_validated"
        },
        "message": "La necesidad acumulada simplificada supera la lámina máxima estimada según el umbral seleccionado."
      }
    ]
  }
}
```

El ejemplo incluye exactamente P02/P04 completos de GV2-01, conforme a §24/§26. Los 19 campos de magnitud están siempre presentes en éxitos; exclusivamente los dos `soilWater.daysUntil...` admiten null bajo §13. `diagnostics.items` es un array adicional, no se cuenta como output numérico. Ningún campo output se recibe del frontend.

El resultado del motor conserva el envelope `ok, modelVersion, contractVersion, sourceHash, input, output, metadata`; fallos conservan `ok:false, errors` y no entregan éxito parcial. El envelope HTTP de snapshot se especifica en §30.

## 9. Unidades definitivas

| Grupo input | Campos / unidades |
| --- | --- |
| crop | etoMmPerDay: mm/día; cropCoefficient: adimensional; daysWithoutIrrigation: días |
| soil | texture: texto sin unidad; fieldCapacityPct/wiltingPointPct/depletionThresholdPct: % numérico; bulkDensityGcm3: g/cm3; rootDepthM: m |
| furrow | furrowSpacingM/lengthM: m; slopePct: % numérico; furrowCount: surcos |
| irrigation | flowLps: L/s; durationMin/advanceTimeMin: min |

| Grupo output | Campos / unidades |
| --- | --- |
| waterNeed | targetDepthMm: mm; dailyCropWaterUseMmPerDay: mm/día |
| soilWater | availableWaterMm/maxRecommendedDepthMm: mm; availableCapacityL/maxRecommendedVolumeL: L; ambos daysUntil: días |
| application | appliedVolumeL/estimatedUsefulVolumeL/residualLossVolumeL: L; las tres infiltratedDepth: mm |
| totals | totalAppliedVolumeL: L; totalAppliedVolumeM3: m3 |
| efficiency | applicationEfficiencyPct: % |
| diagnostics | advanceRatioPct: %; maxNonErosiveFlowLps: L/s; items sin unidad propia |

`60` significa 60% en umbral, `0.30` significa 0.30% en pendiente, Kc0.7 no es porcentaje. Excel B26=0.6 y B8 fracción necesitan ×100 al convertir, B18 horas ×60. B11/E17 son fracciones con formato porcentual, convertidas a % numérico en output. Conversión L→m³: /1000. Sin redondeos intermedios ni strings numéricos; redondear solo para presentación.

## 10. Validaciones

Todo objeto canónico debe ser plano, con grupos/propiedades de datos conocidas; rechazar arrays en lugar de objetos, campos desconocidos, getters/setters/símbolos en llamada pura, autoridad/outputs/metadata/versiones enviados por cliente. Todas las magnitudes deben ser `typeof number` finitas, sin coerción. No admitir null en números de input.

| Campo | Dominio estructural |
| --- | --- |
| etoMmPerDay, cropCoefficient, daysWithoutIrrigation | ≥0, sin máximo agronómico inventado; días input puede ser fraccionario |
| fieldCapacityPct | >0 y ≤100 |
| wiltingPointPct | ≥0 y <fieldCapacityPct |
| bulkDensityGcm3, rootDepthM | >0 |
| depletionThresholdPct | >0 y ≤100 |
| furrowSpacingM, lengthM | >0 |
| slopePct | ≥0, sin cap artificial |
| furrowCount | `Number.isSafeInteger`, 1..9007199254740991 |
| flowLps, durationMin | >0 |
| advanceTimeMin | ≥0 y ≤durationMin |
| texture | optional/null/string; misma normalización V1, trim, 1..64 puntos de código si es string; vacía o solo espacios se rechaza, no se convierte a null |

Límite de count: `Number.MAX_SAFE_INTEGER`, fundamento de representación exacta del input entero en JS, **no máximo agronómico**. R4F-C debe elegir almacenamiento que cubra este contrato sin pérdida; cualquier límite menor impuesto por schema requeriría revisión explícita de esta especificación, no un recorte silencioso. Aceptar count dentro de rango no garantiza éxito de los productos de volumen.

Guardar solo resultados consistentes: heredar dominios V1 de los 14 outputs, útil≤aplicado, residual≥0, eficiencia/avance0..100, AU/capacidades/máximos/aplicado/Qmax>0 e infiltraciones/meta≥0. Agregar daily≥0, totales>0 finitos y días>0 finitos cuando hay consumo positivo; null solo bajo política cero. No clamps, caps, defaults, resultados parciales ni conversión de Infinity a null.

Errores de input usan estructura/códigos V1 (`INVALID_SHAPE`, `UNKNOWN_FIELD`, `MISSING_FIELD`, `INVALID_TYPE`, `NON_FINITE_NUMBER`, `OUT_OF_RANGE`, `INVALID_RELATIONSHIP`). Dominio entero de count usa regla `positive_safe_integer` con `OUT_OF_RANGE` para number finito fuera del dominio; string usa INVALID_TYPE. Outputs no finitos usan NON_FINITE_RESULT; underflow a cero de magnitud matemáticamente positiva usa MODEL_INCONSISTENCY. `field` señala input/output completo. HTTP continúa400 para validación y422 para inconsistencias/no representabilidad, sin insertar fila. No se añade código nuevo por nullable legítimo.

## 11. Fórmulas heredadas

Notación: E=etoMmPerDay, K=cropCoefficient, D=daysWithoutIrrigation, CC/PMP porcentajes, Da=bulkDensityGcm3, Pr=rootDepthM, f=depletionThresholdPct, S=furrowSpacingM, L=lengthM, s=slopePct, Q=flowLps, t=durationMin, a=advanceTimeMin. Constantes: 100%/unidad,60s/min,1000mm/m,1000L/m³. Mantener orden operativo V1 para sus 14 resultados, sustituyendo solo el campo geométrico de V2.

| ID heredado | Resultado | Expresión canónica |
| --- | --- | --- |
| F01 | maxNonErosiveFlowLps | `s === 0 ? 6.3 : 0.0063 / (s / 100)` |
| F02 | advanceRatioPct | `100 * a / t` |
| F03 | targetDepthMm | `E * K * D` |
| F04 | infiltratedDepthStartMm | `4.5 * sqrt(t)` |
| F05 | infiltratedDepthMiddleMm | `4.5 * sqrt(t - a * 0.5)` |
| F06 | infiltratedDepthEndMm | `4.5 * sqrt(t - a)` |
| F07 | appliedVolumeL | `Q * t * 60` |
| F08 | estimatedUsefulVolumeL | `middle * S * L` |
| F09 | residualLossVolumeL | `applied - useful` |
| F10 | applicationEfficiencyPct | `100 * useful / applied` |
| F12 | availableWaterMm | `((CC-PMP)/100) * Da * Pr * 1000` |
| F13 | availableCapacityL | `AU * S * L` |
| F14 | maxRecommendedDepthMm | `AU * (f / 100)` |
| F15 | maxRecommendedVolumeL | `maxDepth * S * L` |

F11/F16/F17 históricos continúan excluidos y no se reutilizan. No reordenar F01 a 0.63/s ni F14 aAU*f/100 para prometer identidad IEEE-754. Pendiente cero canónica6.3 frente a cache6.300000000000001, diferencia ya tolerada en R1. Pendiente positiva cuya conversión /100 underflowa no pasa a rama cero. No añadir cap de5 por tabla orientativa: a 0.10% la fórmula da6.3; a 0.15%,4.2. No cambia calibración de Qmax.

## 12. Fórmulas nuevas

IDs **F18–F22, namespace del modelo irrigation-estimation-v2**, dejando intactos los históricos excluidos:

| ID | Path exacto | Operación | Autoridad |
| --- | --- | --- | --- |
| F18 | waterNeed.dailyCropWaterUseMmPerDay | `E * K` | Excel E18 + confirmación K |
| F19 | soilWater.daysUntilAvailableWaterExhaustion | `AU / daily` si daily>0; null si cero legítimo | Excel E19 + K; política técnica §13 |
| F20 | soilWater.daysUntilDepletionThreshold | `maxDepth / daily` si daily>0; null si cero legítimo | confirmación L, no fórmula Excel |
| F21 | totals.totalAppliedVolumeL | `applied * furrowCount` | Excel B31 + B |
| F22 | totals.totalAppliedVolumeM3 | `totalL / 1000` | Excel B32 + B |

Daily se calcula una vez para F19/F20 sin convertir F03 en otra operación distinta. Orden de cálculo futuro: validar input; resultados heredados con orden V1; daily; plazos según política; totalL; totalM3; validar todos los resultados; construir P01–P05; validar/copiar snapshot completo. Si algo falla, no persistir. No dependencias automáticas por textura ni descuento de lluvia/días pasados.

## 13. Zero daily-use policy

**Decisión cerrada: ambos campos de días permanecen presentes y valen null cuando E=0 o K=0**, daily=0 legítimo. Significado de null: `not_applicable_zero_daily_use`, horizonte finito no definido bajo consumo diario nulo. No representa 0 días, agotamiento actual, dato perdido ni autorización de esperar indefinidamente en campo. No evaluar las dos divisiones en esta rama.

Justificación: ETo/Kc cero son inputs admitidos; con consumo nulo no hay un tiempo finito de consumo de una reserva positiva dentro de este modelo. Error de dominio rechazaría un caso válido; omitir campos haría incierto el shape; usar0 afirmaría agotamiento inmediato; Infinity no es JSON. Null permite conservar esta distinción sin una nueva regla diagnóstica. Metadata registra la política y el motivo es derivable de daily=0.

**Cero numérico por underflow no equivale a consumo nulo:** si E>0 y K>0 y E*K redondea a0, fallar MODEL_INCONSISTENCY en daily, nunca devolver días null. Si producto overflowa, NON_FINITE_RESULT. Si daily>0 muy pequeño hace un cociente Infinity, NON_FINITE_RESULT del plazo; si un plazo matemáticamente positivo underflowa a0, MODEL_INCONSISTENCY. No umbral epsilon ni redondeo para elegir la rama.

Esta política no garantiza éxito ante otras inconsistencias del balance heredado. Los dos campos nullable se guardan como ausencia semántica explícita del plazo en V2; no usar la misma ausencia para inventar nuevos outputs en filas V1.

## 14. Semántica final de días

- `daysWithoutIrrigation`: tiempo acumulado de input desde último riego, solo para F03 bajo ETo/Kc constantes.
- `daysUntilDepletionThreshold`: duración teórica de referencia para consumir la fracción f del AU con daily actual constante.
- `daysUntilAvailableWaterExhaustion`: duración teórica de referencia para consumir 100% del AU entre CC/PMP con daily constante. **No es el momento recomendado para regar.**

Los dos cocientes usan reserva de referencia completa, **no humedad remanente medida hoy**. Se interpretan como proyección desde un perfil de referencia a capacidad de campo, sin lluvia, cambios de consumo ni otros aportes. Es una hipótesis necesaria y explícita para dar sentido físico al numerador, no un nuevo input ni afirmación de que la finca se encuentra a CC.

No descontar daysWithoutIrrigation, no restar targetDepth ni aplicado, no clamp a0 ni convertir plazos en fecha de riego. Para GV2-01,15.6 y26 no significan que desde hoy quedan esos días tras 20 días sin regar. El modelo carece de humedad inicial y evolución del perfil; si se necesitan días restantes reales, es otra especificación. Se mantiene el nombre solicitado `daysUntil...` con esta definición y metadata `daysReferenceState: field_capacity_reference`, sin prometer scheduling ni diagnóstico de estrés.

## 15. Infiltración

Conservar tres outputs existentes y presentar **Inicio del surco / Mitad del surco / Final del surco**. No almacenar etiquetas 0/50/100m ni derivar posiciones en este contrato. Tiempo de oportunidad t, t−a/2 y t−a, respectivamente; factor de llegada media 0.5 es hipótesis heredada. a=0 iguala las tres; a=t da final 0, ambos casos admitidos si balance consistente. El resultado es lámina estimada, pese a «Real» en Excel. No mide almacenamiento radicular ni uniformidad de campo.

## 16. Coeficiente 4.5 empírico

Se conserva 4.5 mm/min^0.5 y exponente 0.5 fijo, implementable con sqrt. Origen `undocumented_legacy_spreadsheet`; calibration `none`; scientificValidation `not_validated`; texture effect `none`. El cliente confirma función operacional, no origen científico. El XLSX no documenta ensayo, coeficiente por suelo ni calibración; menciones INTA/FCA/Mendoza no se atribuyen a 4.5. No Kostiakov/bibliografía externa inventados ni claims soil_specific/field_calibrated/scientifically_validated.

## 17. CC/PMP

`soilWaterContentBasis: gravimetric_dry_weight`. Inputs en puntos porcentuales sobre peso seco. La diferencia gravimétrica ×Da convierte al equivalente volumétrico bajo densidad del agua de referencia1g/cm³; Pr×1000 convierte m a mm. AU 91 mm queda reproducible. Esta semántica se fija por confirmación I y no se extiende a la procedencia de todas las tablas orientativas. V1 conserva su base pendiente en sus propios snapshots.

## 18. Distancia entre surcos

Campo definitivo `furrow.furrowSpacingM`, unidad m, >0. Meaning `distance_between_furrows`; usage `simplified_tributary_width`. Hipótesis textual: «En el modelo simplificado, la distancia entre surcos se utiliza como ancho de referencia por surco para convertir láminas en volumen».

Dimensión mm×m×m=L. No significa ancho realmente mojado ni área real medida del lote. Bordes, espaciamiento irregular e integración transversal no se modelan. Este uso es la hipótesis de diseño aprobada para el modelo simplificado, no un pendiente que impida describir V2. No rename de widthM al leer históricos V1.

## 19. Cantidad de surcos

`furrow.furrowCount`, entero seguro positivo ingresado por usuario, sin coerción. Meaning `number_of_furrows_irrigated`, no densidad por ha ni número calculado desde superficie. La multiplicación total supone que el resultado por surco es representativo de todos los surcos contados; registrar `furrowRepresentativeness: uniform_per_furrow_scenario`. No agrega cronograma, simultaneidad ni caudal global del lote. No inventar count 1/18 en V1.

## 20. Totales

Grupo definitivo `output.totals`, exclusivamente `totalAppliedVolumeL` y `totalAppliedVolumeM3`, siempre positivos y finitos en éxito. Alcance `per_furrow_applied_volume_times_furrow_count`. No son máximo recomendado. Excel 6480×18=116640L/116.64m³. La explicación histórica que los deriva de4258.8L recomendado no es normativa. No agregar totalRecommendedVolumeL/M3 ni surfaceAreaM2. Count no cambia ninguno de los14 outputs por surco ni P01–P05.

## 21. Pérdidas

Mantener `application.residualLossVolumeL = appliedVolumeL - estimatedUsefulVolumeL`, sin identificador deepPercolationVolumeL. Presentación **«Pérdidas estimadas»**. Nota aprobada: «Bajo los supuestos simplificados de este modelo y sin escurrimiento considerado, pueden asociarse principalmente a infiltración/percolación profunda». Agregar explicación de límite: **el cálculo es residual, no identifica ni cuantifica independientemente esa causa física**. «Sin escurrimiento considerado» significa fuera del modelo, no cola cero medida. Esta presentación condicional respeta intención J sin transformar el residual en medición o validación científica.

## 22. Textura

Opcional/descriptiva, normalización V1. No modifica CC/PMP/Da/4.5, no selecciona defaults ni catálogos. Hoja2 puede ser referencia visual en otra fase; sugerencias requieren aceptación explícita. No decide autoridad entre tablas discordantes. Mantener independencia de outputs/metadata al cambiar solo etiqueta texture.

## 23. Runoff / cola

Oficial Hoja1 B12=0 es manual, ninguna de las20 fórmulas lo referencia. Sigue fuera de V2: sin input/output/columna/regla nueva. No inferirlo de pendiente ni restarlo de aplicado. Una extensión futura exigiría definición y evidencia propias; no se aprueba por la sola presencia de la celda.

## 24. Diagnósticos

P01–P05 se mantiene **literalmente según buildDiagnostics V1**, pues ninguna regla referencia widthM: cambia metadata/contrato geométrico, pero sus field paths y comparadores no cambian. Count/daily/plazos/totales no participan en estas reglas. Conserva source de evidencia `R1_comparison` como procedencia histórica de las reglas, no como identificación del XLSX V2; la fuente de snapshot es sourceHash/metadata V2.

| Regla | Condición | Severidad |
| --- | --- | --- |
| P01 | flowLps>maxNonErosiveFlowLps | warning |
| P02 | infiltratedDepthEndMm<targetDepthMm | warning |
| P03 por punto | infiltratedDepthMm>targetDepthMm | info |
| P04 | targetDepthMm>maxRecommendedDepthMm | warning |
| P05 por punto | infiltratedDepthMm>maxRecommendedDepthMm | warning |

Orden: P01,P02,P03 start/middle/end,P04,P05 start/middle/end. Igualdades no emiten aviso. Cada item conserva `id,ruleVersion,severity,fields,evidence,message`, unidades, operandos originales, operator, `scientificValidation:not_validated` y mensajes prudentes presentes en el código. GV2-01 P02/P04 warning. No crear aviso por zero daily-use, que es nullable semántico, ni confundir errores fatales del guard con diagnósticos persistibles.

D01–D08 fuera. Ratio numérico sin óptimo/regular/crítico. Hoja2 aún no define inequívocamente el corte25/30 ni intervalos; excluir esas reglas permite cerrar V2 sin resolverlas. No subir diagnosticsRuleVersion por documentación general.

## 25. Metadata V2

Shape conceptual cerrado: conservar nueve claves públicas superiores V1 (`metadataSchemaVersion`, `effectiveParameters`, `units`, `assumptions`, `evidenceState`, `referenceVersions`, `implementationReference`, `diagnosticRules`, `parameterProvenance`) y versionar sus nuevos mapas/hipótesis. Objeto JSON, sin secretos, rutas locales, host, payload duplicado ni timestamps/IDs elegidos por cliente.

```json
{
  "metadataSchemaVersion": "irrigation-metadata-v2",
  "effectiveParameters": {
    "infiltrationCoefficient": 4.5, "infiltrationExponent": 0.5,
    "middleArrivalFactor": 0.5, "qmaxCoefficient": 0.0063,
    "qmaxZeroSlopeValue": 6.3, "advanceRules": null
  },
  "units": {
    "input": {
      "crop": { "etoMmPerDay": "mm/día", "cropCoefficient": "adimensional", "daysWithoutIrrigation": "días" },
      "soil": { "fieldCapacityPct": "%", "wiltingPointPct": "%", "bulkDensityGcm3": "g/cm3", "rootDepthM": "m", "depletionThresholdPct": "%" },
      "furrow": { "furrowSpacingM": "m", "lengthM": "m", "slopePct": "%", "furrowCount": "surcos" },
      "irrigation": { "flowLps": "L/s", "durationMin": "min", "advanceTimeMin": "min" }
    },
    "output": {
      "waterNeed": { "targetDepthMm": "mm", "dailyCropWaterUseMmPerDay": "mm/día" },
      "soilWater": { "availableWaterMm": "mm", "availableCapacityL": "L", "maxRecommendedDepthMm": "mm", "maxRecommendedVolumeL": "L", "daysUntilAvailableWaterExhaustion": "días", "daysUntilDepletionThreshold": "días" },
      "application": { "appliedVolumeL": "L", "infiltratedDepthStartMm": "mm", "infiltratedDepthMiddleMm": "mm", "infiltratedDepthEndMm": "mm", "estimatedUsefulVolumeL": "L", "residualLossVolumeL": "L" },
      "totals": { "totalAppliedVolumeL": "L", "totalAppliedVolumeM3": "m3" },
      "efficiency": { "applicationEfficiencyPct": "%" },
      "diagnostics": { "advanceRatioPct": "%", "maxNonErosiveFlowLps": "L/s" }
    },
    "effectiveParameters": {
      "infiltrationCoefficient": "mm/min^0.5", "infiltrationExponent": "adimensional",
      "middleArrivalFactor": "adimensional", "qmaxCoefficient": "L/s (slope fraction operand)", "qmaxZeroSlopeValue": "L/s"
    }
  },
  "assumptions": {
    "soilWaterContentBasis": "gravimetric_dry_weight",
    "furrowSpacingMeaning": "distance_between_furrows",
    "furrowSpacingUsage": "simplified_tributary_width",
    "furrowCountMeaning": "number_of_furrows_irrigated",
    "furrowRepresentativeness": "uniform_per_furrow_scenario",
    "totalAppliedVolumeScope": "per_furrow_applied_volume_times_furrow_count",
    "infiltrationCoefficientOrigin": "undocumented_legacy_spreadsheet",
    "infiltrationCalibration": "none", "advanceBands": "not_selected",
    "etoAndKc": "constant_during_period", "effectiveRain": "not_modeled",
    "initialMoisture": "not_modeled", "flow": "constant",
    "infiltration": "spreadsheet_empirical_estimate", "textureEffectOnInfiltration": "none",
    "residualMeaning": "does_not_identify_loss_cause", "efficiencyMeaning": "estimated_not_measured",
    "daysReferenceState": "field_capacity_reference",
    "daysMeaning": "reference_reserve_duration_not_remaining_days_from_now",
    "zeroDailyUsePolicy": "null_days_not_applicable_zero_daily_use"
  },
  "evidenceState": {
    "calculationImplemented": true, "scientificValidation": "not_validated",
    "parametersSelected": true, "diagnosticsEvaluated": true, "modelKind": "estimation",
    "source": "spreadsheet-derived", "fieldCalibration": "none"
  },
  "referenceVersions": { "catalogVersion": null, "calibrationVersion": null },
  "implementationReference": {
    "modelVersion": "irrigation-estimation-v2", "stage": "R4F_v2_estimation", "arithmetic": "IEEE-754_Number"
  },
  "diagnosticRules": { "ruleVersion": "irrigation-diagnostics-v1", "evaluated": ["P01", "P02", "P03", "P04", "P05"] },
  "parameterProvenance": {
    "infiltration": "Hoja 1!C14:C16; F04:F06; undocumented legacy coefficient; not calibrated",
    "qmax": "Hoja 1!B9; F01; canonical zero 6.3; not scientifically validated",
    "soilWater": "Hoja 1!B24; F12; latest client confirmation: gravimetric dry weight",
    "spacing": "latest client confirmation; simplified tributary width assumption",
    "dailyUse": "Hoja 1!E18; F18",
    "exhaustionDays": "Hoja 1!E19; F19; reference reserve assumption",
    "thresholdDays": "latest client confirmation L; F20; absent from XLSX formulas",
    "totalApplied": "Hoja 1!B30:B32; F21:F22; representative per-furrow scenario"
  }
}
```

Este JSON define metadata de **un futuro resultado exitoso calculado**: `calculationImplemented:true` no declara implementación V2 actual. En esta fase solo hay especificación. No añadir widthMeaning a V2; conservarlo intacto en V1. Units omite textura/items como en V1; contiene exactamente15 inputs numéricos y19 outputs de magnitud, incluidos días nullable. No duplicar sourceHash en metadata; se conserva en envelope/fila. Stage identifica la familia de implementación futura, no autorización para comenzar ahora.

## 26. Golden GV2-01

Fixture nuevo e independiente: input de §8, versiones de §7, hash de §3, metadata de §25. No reemplazar G01 V1 ni sus60min/4.8min de avance. Outputs esperados:

| Campo | Esperado Number |
| --- | ---: |
| targetDepthMm | 70 |
| availableWaterMm | 91 |
| availableCapacityL | 7098 |
| maxRecommendedDepthMm | 54.6 |
| maxRecommendedVolumeL | 4258.8 |
| appliedVolumeL | 6480 |
| infiltratedDepthStartMm | 49.29503017546495 |
| infiltratedDepthMiddleMm | 47.19639816765682 |
| infiltratedDepthEndMm | 45 |
| estimatedUsefulVolumeL | 3681.3190570772317 |
| residualLossVolumeL | 2798.6809429227683 |
| applicationEfficiencyPct | 56.8104792758832 |
| advanceRatioPct | 16.666666666666668 |
| maxNonErosiveFlowLps | 6.3 |
| dailyCropWaterUseMmPerDay | 3.5 |
| daysUntilAvailableWaterExhaustion | 26 |
| daysUntilDepletionThreshold | 15.6 |
| totalAppliedVolumeL | 116640 |
| totalAppliedVolumeM3 | 116.64 |

Verificación realizada: el motor puro V1 con widthM 1.3 y demás inputs del fixture reproduce los14 resultados heredados; las cinco operaciones adicionales fueron verificadas independientemente en memoria, sin motor V2/persistencia. JS imprime `54.6/3.5` como15.6 y con 17 dígitos significativos `15.600000000000000`; no redondear dentro del motor. Como todo Number es binario, se conserva tolerancia R1 `max(1e-8,1e-9*abs(expected))` exclusivamente para pruebas, nunca para aceptar balance imposible.

Diagnostics exactos: dos items, P02 seguido por P04; ambos ruleVersion `irrigation-diagnostics-v1`, severity warning. P02 fields/evidence/message son los de V1 para 45<70 mm; P04 los de V1 para 70>54.6 mm. Evidence conserva operator, unit mm, source R1_comparison y scientificValidation not_validated. Ningún P01/P03/P05 ni D01–D08. Comparar objetos completos con buildDiagnostics V1 congelado, no solo IDs. Metadata/versiones/cadenas/count/null se comparan exactamente; outputs numéricos con tolerancia indicada.

## 27. Edge cases y pruebas futuras

Estas son obligaciones para implementación posterior; no se escriben ni modifican tests ahora.

| Caso | Resultado exigido |
| --- | --- |
| count 1 /18 | mismo resultado por surco; totales×1/×18 |
| count 9007199254740991 con productos representables | input válido, count roundtrip exacto, totales finitos |
| count 0, −1, 1.5,>MAX_SAFE_INTEGER | OUT_OF_RANGE /positive_safe_integer, sin snapshot |
| count "18", null, ausente, NaN, Infinity | error de tipo/presencia/finitud según §10, sin coerción |
| E=0 o K=0, balance válido | daily 0, ambos días null presentes, sin división; meta 0 |
| daily positivo normal | ambos días numéricos positivos; f100 iguala los plazos |
| E>0/K>0 pero producto underflow0 | MODEL_INCONSISTENCY, nunca rama nullable |
| daily overflow | NON_FINITE_RESULT señalado en daily; sin null reparador |
| daily muy pequeño positivo, cociente finito | número conservado sin epsilon ni cap |
| daily muy pequeño, cociente Infinity | NON_FINITE_RESULT del plazo correspondiente |
| plazo positivo que underflowa a0 | MODEL_INCONSISTENCY |
| aplicado finito, producto count overflow | NON_FINITE_RESULT totalL, ningún resultado parcial persistible |
| totalL/1000 underflow0 | MODEL_INCONSISTENCY totalM3 |
| widthM en request V2 o spacing/count en V1 | UNKNOWN_FIELD/HTTP estricto de la versión; no alias silencioso |
| avance0 /duración | infiltración igual /final 0; conservar guards de balance |
| pendiente0 /positiva pequeña /underflow en s/100 | rama 6.3 /literal finito /NON_FINITE_RESULT, sin cap |
| textura cambia sola | outputs y metadata efectivos no cambian |
| duplicar spacing o largo, escenario consistente | escala útil/capacidad/máximo por surco; no cambia infiltración/aplicado |
| variar count | no cambia daily/plazos/por surco y diagnósticos |
| v1/v2 mezclados | shapes/versiones/procedencia propios, paginación sin pérdida |
| versión desconocida o combinación inválida | error controlado; no fallback a contrato activo ni coerción |
| null de días en DB V2 /ausencia de campos V2 en DB V1 | semánticas distintas, readback fiel |

También conservar rechazo de Q0.3/t120/Ta20 cuando útil>aplicado: cambiar escenario no autoriza clamp. Pruebas de schema/ownership/locks/rollback/UTC/JSON/DOUBLE y carrera POST/DELETE pertenecen a implementación/certificación autorizadas; no conexión actual a Aiven.

## 28. Compatibilidad histórica

V1 se mantiene congelado con contratos, mapper/lectura, metadata, diagnostics y sourceHash propios. En DETAIL V1 sigue `furrow.widthM` y sus14 outputs; no aparecen spacing/count/daily/días/totales nuevos por adaptación. No asignar count 1/18, no reinterpretar significado pendiente, no reconstruir totales, no mejorar evidencia ni recalcular a partir de fórmulas V2. La ausencia de nuevos datos V1 es parte de su contrato histórico, no un null calculado V2.

Los nuevos snapshots V2 conservan input efectivo y output completo, incluido count y días null legítimos. La lectura usa versiones almacenadas, no versión activa de creación. Recalcular crea fila nueva y no edita la vieja. DB vacía histórica no elimina el requisito de convivencia; no se consultó su estado actual.

## 29. Persistencia requerida

Persistir para V2 sus16 inputs efectivos,19 outputs (dos días nullable), versiones model/contract, nuevo sourceHash, metadata completa, diagnostics completos, identidad/name/finca y timestamp UTC de servidor. No volver a calcular daily/plazos/totales en GET; snapshot de resultados efectivos, con Number sin redondeo decimal arbitrario. Count exige almacenamiento/driver exactos dentro de su rango. Guardar null para ambos plazos solo en la política cero; distinguir ausencia de columnas V2 en filas V1.

La tabla actual usa width_m y números NOT NULL; no tiene count ni outputs nuevos. También posee FK RESTRICT, CHECK de dominios, JSONmetadata/diagnostics, DOUBLE y created_at DATETIME(3). **R4F-C decide la estrategia física**, evaluando:

- Columnas nuevas nullable para convivencia, CHECK condicionados/versionados y forma de seguir satisfaciendo columnas V1 NOT NULL al insertar V2.
- Reusar width_m solo con mapping explícito por versión y significado almacenado; nunca rename global ni reinterpretación de filas V1.
- Tabla separada/versionada cuando la coexistencia de constraints/semánticas lo justifique, preservando orden y consulta histórica.
- Dispatch contractual en todas las lecturas/escrituras, cualquiera sea la tabla elegida.

No se prescribe una migration definitiva ni se elige tipo SQL por comodidad. Cambios de schema mediante nueva migration, nunca edición de la aplicada. Considerar nullable por versión, integer exacto, constraints/model pair y los dos campos de días legítimamente null. Conservar ownership, atomicidad, rollback, locking padre/DELETE seguro, FK, índice/cursor y UTC. No inferir que el código actual ya soporta esta persistencia.

## 30. API conceptual

**Decisión conceptual:** conservar rutas actuales; al activar V2 en una implementación autorizada, POST crea exclusivamente la versión activa de servidor V2, con body de §8 y name opcional. Cliente no elige modelVersion/contractVersion/sourceHash ni envía resultados/metadata. Sin endpoint adicional ni envelope `input` en POST. El cambio de POST es incompatible: debe desplegarse con coordinación explícita del frontend y documentación, sin romper silenciosamente un consumidor V1 activo; plan operativo de transición corresponde a R4F-C.

GET DETAIL conserva envelope `{simulation,model,input,output,metadata}`. `simulation:{id,name,fincaId,createdAt}`; `model:{modelVersion,contractVersion,sourceHash}`; input/output según la versión de la fila; metadata schema de esa fila. CreatedAtISO UTC con milisegundos. POST 201 devuelve ese mismo envelope solo después del commit. HISTORY 200 se define en§32. La versión activa de creación no manda sobre lectura histórica.

Se consideran y descartan para este alcance endpoint paralelo/request con selección de modelo: frontend nuevo solo necesita crear V2 y la autoridad del servidor ya es convención existente. No admitir un selector arbitrario por cliente. Mantener JWT/ownership y errores404 comunes; 400 validación,422 guard,500 genérico; límite JSON/Content-Type y códigos existentes sin ampliar otros contratos. Sin PUT/PATCH/DELETE de simulación. No retry automático ni idempotencia nueva.

## 31. Mapper/version dispatch requirement

Requisito obligatorio para R4F-C: seleccionar mapper/contrato de lectura por **contract_version almacenada**, comprobar model_version y metadata schema compatibles y conservar diagnósticos de la fila. V1→mapping V1; V2→mapping V2. Versiones desconocidas/incompatibles deben fallar de forma controlada sin fallback a la activa; tratamiento público genérico existente, sin filtrar DB internals.

Hoy `mapStoredDetail` importa INPUT_CONTRACT/OUTPUT_CONTRACT globales V1; el adaptador POST también importa INPUT_CONTRACT y HISTORY usa selección de columnas fija. Reemplazarlos globalmente rompería o reinterpretaría filas V1. Mantener definiciones inmutables por versión, no un contrato mutable único. Mapper de escritura valida resultado de su versión; lectura no aplica fórmulas/reglas actuales a snapshots viejos. Conserva sourceHash, nullable, unidades, evidencia y precisión originales. Evitar que publicSnapshot descarte nuevos datos:§25 mantiene claves superiores conocidas, pero su contenido debe viajar como snapshot versionado.

## 32. HISTORY/DETAIL

DETAIL devuelve sin cálculo cada contrato histórico. V1 conserva su shape; V2 usa§8/§25. HISTORY conserva `items:[{simulation,model,summary}],pagination:{limit,hasMore,nextCursor}` y summary común meta/aplicado por surco/eficiencia/diagnosticscount,severities.

**Decisión:** agregar a summary de filas V2 exactamente `furrowCount` y `totalAppliedVolumeL`, obligatorios y numéricos; no agregar totalM3 ni plazos a HISTORY por ahora. En filas V1 estos dos campos **se omiten**, conservando su shape previo; no null de sustitución ni count inventado. Cada item ya aporta model/contract para discriminar. `summary.appliedVolumeL` siempre por surco, inclusoV2. Detalle es la autoridad para input/output/metadata completos.

Mantener limit 1..100/default 20, cursor opaco y posición created_atDESC,idDESC, aislamiento por finca propia y mismos criterios de desempate. Cursor sigue versión1 de paginación si codificación/semántica no cambia: es otro eje independiente. Tabla separada eventualmente debe mantener orden/identidad estable; resolución técnica en R4F-C. Read-path no añade escrituras.

## 33. Impacto frontend futuro

Contrato consumible: ingresar Distancia entre surcos/Cantidad de surcos, mantener unidades explícitas y envíos numéricos; mostrar consumo diario, ambos plazos con definición de referencia, aplicado por surco, aplicado total L/m³, inicio/mitad/final, Pérdidas estimadas y eficiencia estimada. Plazos null deben presentarse como no aplicables con consumo diario nulo, nunca0 ni fecha futura infinita. Identificar versión histórica y respetar sus campos; no convertir widthM antiguo en spacing por UI.

No enseñar díasUntil como «faltan desde hoy» ni «riego recomendado al agotamiento total». Mantener metadata/not_validated y notas de pérdidas coherentes con§21. No diseñar componentes, posiciones aproximadas ni UX de scheduling aquí. R5 solo después de contrato implementado/certificado y autorización.

## 34. Riesgos

| Riesgo | Requisito de control |
| --- | --- |
| narrativa vieja gana a confirmación actual | jerarquía§4 y provenance por fórmula |
| omitir /100 en Qmax o confundir horas/% | expresión/orden/unidades§9/§11 |
| días interpretados desde hoy con humedad desconocida | referenciaCC explícita, sin restas ni scheduling |
| cero por underflow tratado como consumo nulo | detectar ambos inputs positivos, error en lugar de null |
| decimal/string/entero no seguro de count | validación estructural sin coerción |
| overflow de totales/plazos o underflow positivo | guard sin clamp/cap/InfinityJSON |
| count pierde exactitud en SQL/driver | storage cubre contrato seguro y roundtrip verificado |
| convertir residual en percolación medida | output prudente y nota condicional con límite explícito |
| nuevo contrato global rompe lecturas | dispatch por fila y pair versions validado |
| total vs aplicado por surco confundidos | grupo totals y summary sin redefinir aplicado |
| nuevos NOT NULL rompen filas/insertsV1 | diseño de convivencia y migration nueva |
| uniformidad de escenario asumida como campo real | hipótesis representativeness explícita |
| POST activoV2 sorprende consumidor V1 | transición coordinada y errores de shape, sin aliases |
| perder metadata en filtro público | conservar snapshot schema, mapas/unidades completos |
| creer QA histórica pruebaV2 | validación actual solo aritmética/motorV1, certificación futura separada |

## 35. Decisiones diferidas y exclusiones

No quedan decisiones imprescindibles abiertas para el **contrato conceptual** aquí fijado. Sí corresponde a R4F-C decidir columnas/tipos/tablas/migration, handlers/dispatch concreto, plan de transición operativa de POST, almacenamiento exacto de count y consultas mixtas. Son diseño técnico autorizado posteriormente, no razones para alterar V1 ahora.

Fuera de V2: D01–D08/bandas, runoff, autocompletado texture, calibración científica, total recomendado, surfaceAreaM2, idempotencia/retries, frontend, weather/lluvia, humedad inicial, optimización y scheduling. No aparecen fórmulas nuevas oficiales que obliguen a incluirlos. Ambigüedades de tablas/origen4.5/bandas quedan registradas como límites de evidencia y no bloquean el alcance empírico aprobado. No hay investigación externa ni corrección de archivos históricos.

## 36. Criterios de aceptación R4F-C y checkpoint

**¿V2 suficientemente cerrada para diseño técnico? Sí:** se fijaron16 inputs,19 outputs/paths/unidades, nullable de días y underflow, fórmulas/IDs, cuatro versiones independientes, hash, metadata, golden, excluidos, persistencia conceptual, POST activo del servidor y shapes históricos. Es especificación aprobada para diseñar dentro del alcance solicitado, no certificación del comportamiento V2 implementado.

**¿Lista para R4F-C? Sí, con autorización de inicio posterior. Esta fase no lo inicia.** El diseño técnico debe cumplir:

1. Preservar inmutables motor, contratos, G01 y snapshots V1, junto con Manning.
2. Mapear todos los 16 inputs y 19 outputs V2, días null legítimos, metadata y diagnósticos completos.
3. Soportar dispatch de lectura/escritura por versión, rechazo controlado de desconocidas y lecturas mixtas sin recalcular.
4. Elegir almacenamiento que conserve count entero seguro y precisión Number, nullable por versión y constraints coherentes; documentar decisión entre alternativas antes de una migration nueva.
5. Conservar autoridad del servidor y ownership, respuesta 201 tras commit, atomicidad, rollback, locks sobre la finca, DELETE seguro, FK RESTRICT y UTC; mantener cursor y orden.
6. Definir transición de POST V2 con consumidores y validar HISTORY V1 sin campos adicionales, HISTORY V2 con count/totalL y DETAIL propio de cada versión.
7. Preparar plan de pruebas §27, GV2-01 con tolerancia R1 y metadatos/diagnósticos completos, junto a G01 intacto; certificación DB solamente en fase autorizada.
8. Mantener evidencia empírica no validada y explicitar referencia CC de plazos, sin promesas de percolación medida ni scheduling.

QA de R4F-B: cuatro hojas oficiales auditadas; 20/20 fórmulas y caches coherentes; 14 resultados heredados contrastados con motor puro V1; cinco nuevos valores aritméticos confirmados y precisión JS de 54.6/3.5 revisada; casos ETo=0/Kc=0 observados como admisibles en V1; underflow/overflow comprobados aritméticamente. No se ejecutaron tests productivos ni suite V2, no se escribió motor V2 ni se accedió a Aiven. Los checks de preservación Git/hashes del cierre se registran al final de este documento.

Verificación de cierre: los 50 archivos preexistentes del proyecto, excluidos `.git` y `node_modules`, conservan SHA-256 idéntico; 0 modificados, 0 eliminados, únicamente este documento agregado. El XLSX oficial conserva SHA-256 de §3, rama/HEAD permanecen iguales y no hay cambios staged. `git diff --check` sin errores; el documento nuevo se comprobó aparte: 36 secciones numeradas, enlaces locales válidos y sin espacios finales. Sus tres bloques JSON son válidos; conteos y mapas de unidades completos; 14 valores heredados, cinco adicionales y diagnósticos completos del golden coinciden con los controles descritos. Esto valida la especificación escrita, no un motor V2 implementado.

**DETENERSE. NO IMPLEMENTAR R4F-C. NO MODIFICAR RUNTIME.**
