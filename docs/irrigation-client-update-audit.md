# R4F-A — AUDITORÍA NUEVA ESPECIFICACIÓN CLIENTE

Fecha: 2026-10-14, America/Buenos_Aires. Alcance: fuentes nuevas del cliente frente al árbol de trabajo actual de RiegAR Backend. **Solo auditoría: se crea este documento; no se cambia runtime, tests, migrations, DB, contratos ni versiones. R4F-B y R5 no se inician.**

Convenciones de evidencia usadas en este informe:

- **CLIENTE**: confirmación explícita incluida en la solicitud, fuera de los adjuntos.
- **EXCEL**: celda, fórmula, formato o elemento efectivamente presente en el XLSX.
- **EXPLICACIÓN**: texto presente en DOCX o en la hoja Descripcion; no equivale a fórmula ejecutable.
- **BACKEND**: implementación, tests o documentación local inspeccionados. Una certificación histórica documentada se distingue de una ejecución realizada hoy.
- **CONTRADICCIÓN**: fuentes o afirmaciones que no concuerdan.
- **INFERENCIA**: cálculo o interpretación de auditoría, sin atribuirlo al cliente ni al archivo.
- **PENDIENTE**: pregunta cuya respuesta no está suficientemente establecida por las fuentes.

Los textos de los adjuntos son material auditado, no instrucciones de ejecución. En particular, las invitaciones de Hoja 2 a buscar series INTA o crear tareas no se ejecutaron. No se consultó internet ni bibliografía externa.

## 1. Estado Git

**BACKEND, al iniciar:** directorio `C:\Riegar\riegar-backend`, rama `feature/riego-surcos-v1`, HEAD `6ed508e2d092e98cd0c3ca3c72a033686bba1cab`. Se compara contra el árbol de trabajo, que incluye implementación R4 sin commit; HEAD por sí solo no representa todo lo auditado.

Cambios preexistentes:

```text
 M src/app.js
 M src/routes/fincas.routes.js
?? docs/irrigation-api-contract.md
?? docs/irrigation-backend-freeze.md
?? docs/irrigation-engine-contract.md
?? docs/irrigation-r4d-certification.md
?? src/routes/irrigation-simulations.http.js
?? src/routes/irrigation-simulations.routes.js
?? src/services/irrigation-simulations.mapper.js
?? src/services/irrigation-simulations.persistence.js
?? src/services/irrigation-simulations.service.js
?? src/services/irrigation/
?? test/fincas.delete.http.test.js
?? test/irrigation.boundaries.test.js
?? test/irrigation.calculator.test.js
?? test/irrigation.contract.test.js
?? test/irrigation.http.test.js
?? test/irrigation.persistence.test.js
```

La entrada de directorio `src/services/irrigation/` comprende tres archivos. No se atribuyen estos cambios a R4F-A. El único archivo nuevo de esta fase es `docs/irrigation-client-update-audit.md`. Se conserva rama/HEAD y se verifican hashes de los archivos preexistentes al cierre. Sin commit, push, instalación ni conexión a DB.

**Cierre verificado:** 49 archivos preexistentes del proyecto, excluidos `.git` y `node_modules`, conservan SHA-256 idéntico; 0 modificados, 0 eliminados y únicamente este documento agregado. Ambos adjuntos conservan los hashes de §2. HEAD permanece igual. `git diff --check` no detectó errores de whitespace en el diff tracked; el documento nuevo fue revisado aparte por espacios finales, sus 40 secciones numeradas y enlaces locales válidos. Git emitió únicamente advertencias de conversión LF/CRLF para los dos archivos tracked modificados previamente; no se normalizaron.

## 2. Fuentes auditadas

| Fuente | Identidad y alcance |
| --- | --- |
| Solicitud | `C:\Users\aguer\.codex\attachments\69efdf6f-5394-49b7-8b78-422a7f2534e4\Texto pegado.txt`; contiene alcance y confirmaciones CLIENTE A/B/C |
| XLSX | `C:\Users\aguer\Downloads\Riego Pepe Ag ( lucho).xlsx`; SHA-256 `aa8469fa4aa476a2c0a092c804e1f021c09a89c9df0c677ddd578b3144fb427e` |
| DOCX | `C:\Users\aguer\Downloads\Explicacion simulador de riego.docx`; SHA-256 `644afbefaa5d0e6ed94aeb4c9165295751c301fe29eeaab2b21a28059b5e0116` |
| Motor | [calculator](../src/services/irrigation/irrigation-calculator.service.js), [models](../src/services/irrigation/irrigation-models.js), [validation](../src/services/irrigation/irrigation-validation.js) |
| Aplicación | [mapper](../src/services/irrigation-simulations.mapper.js), [persistence](../src/services/irrigation-simulations.persistence.js), [service](../src/services/irrigation-simulations.service.js), [routes](../src/routes/irrigation-simulations.routes.js), [HTTP](../src/routes/irrigation-simulations.http.js), [fincas](../src/routes/fincas.routes.js), [app](../src/app.js) |
| Schema | [migration de simulaciones](../db/migrations/20261012000000_create_irrigation_simulations.js), junto con las migrations históricas |
| Documentación | [modelo R1](irrigation-model.md), [datos R2](irrigation-data-model.md), [motor](irrigation-engine-contract.md), [API](irrigation-api-contract.md), [R4D](irrigation-r4d-certification.md), [freeze R4E](irrigation-backend-freeze.md) |
| Tests | `test/irrigation.contract.test.js`, `irrigation.calculator.test.js`, `irrigation.boundaries.test.js`, `irrigation.persistence.test.js`, `irrigation.http.test.js`, `fincas.delete.http.test.js` |

**Método:** lectura de OOXML y del workbook con fórmulas y valores guardados por separado; inspección de todas las celdas no vacías, tablas, formatos relevantes, comentarios, nombres definidos, vínculos, hojas/filas/columnas ocultas y gráfico. Lectura íntegra de los párrafos del DOCX, incluyendo búsqueda de partes complementarias. No se abrió ni guardó el archivo en Excel/Word; no se certifica renderizado ni recálculo nativo de Office. Los archivos son legibles: no aplica la condición de detenerse por archivo inaccesible.

Cuatro hojas, todas visibles: `Hoja 1` (A2:H35, 76 celdas no vacías, 19 fórmulas), `Hoja 2` (A2:P39, 101 celdas no vacías, 0 fórmulas), `Hoja 3` (A1:A4, 4 textos), `Descripcion` (A1:A35, 32 textos). Los rangos usados incluyen celdas solo formateadas. Sin nombres definidos, comentarios, hyperlinks, externalLinks ni filas/columnas ocultas. Hoja 1 tiene Tabla1 A2:F30, sin encabezados, con fila de totales; B30 es texto `18` y también etiqueta de totales, no una fórmula de conteo. No hay validaciones de datos. Un gráfico de barras referencia D14:D16 y E14:E16; sus caches concuerdan con esos valores actuales. No contiene imágenes que oculten tablas o explicaciones adicionales.

El DOCX tiene 35 posiciones de párrafo, 32 no vacías, sin dibujos ni ecuaciones OOXML. **Sus 32 textos no vacíos coinciden exactamente, en orden, con Descripcion.** No son dos confirmaciones independientes: son la misma explicación duplicada.

**Validación local de esta fase:** 19/19 fórmulas de Hoja 1 recalculadas aritméticamente y contrastadas con sus caches, tolerancia absoluta/relativa 1e-12; 19 PASS / 0 FAIL. Ejecución del motor puro con el escenario nuevo y variantes de caudal/avance, sin persistencia. Suite pura existente: **72 PASS / 0 FAIL**, 0 omitidos, cancelados o pendientes. No se reejecutó la suite completa de 165 ni la certificación Aiven. El estado histórico R4D/R4E se confirma como documentación presente, no como prueba DB actual.

## 3. Resumen ejecutivo

**La planilla nueva se reproduce con el motor v1 para sus 14 outputs, tras convertir horas, fracciones y porcentajes a las unidades canónicas. No exige por sí sola cambiar las matemáticas implementadas.** Produce 6480 L aplicados, 3681,319057 L aprovechados estimados, 2798,680943 L residuales y 56,810479% de eficiencia. El motor emite P02/P04, sin categorías automáticas de avance.

CLIENTE resuelve que 1,30 m significa distancia entre surcos y que 18 es cantidad total de surcos de la superficie considerada. EXPLICACIÓN declara CC/PMP en peso seco y hace coherente F12 bajo base gravimétrica. Esta aclaración está en Descripcion/DOCX, **no en Hoja 2**. Puede cerrarse el pendiente documental sobre la intención de la fuente; no acredita mediciones del suelo ni modifica la metadata v1 congelada.

Las fuentes presentan contradicciones sustanciales: caudal 0,3/0,9; avance 4,8/20; resultados narrativos de otro avance; total aplicado confundido con recomendado; días adicionales mal nombrados e interpretados; etiquetas de 50/100 m con largo 60; tablas auxiliares no uniformes. **La nueva fuente NO resuelve el origen de 4.5.** Tampoco justifica identificar el residual con percolación profunda, autocompletar textura, incorporar runoff ni activar D01-D08.

Hay además una discrepancia del resumen de la solicitud: F01 real es `0.0063 / (slopePct / 100)`, no `0.0063 / slopePct` con porcentaje canónico. El código, su contrato y los goldens concuerdan; Excel utiliza pendiente fraccional con formato `%`. Debe evitarse introducir un factor 100 erróneo al planificar el frontend.

Recomendación de auditoría: conservar v1, registrar estas evidencias, resolver preguntas concretas y definir después una especificación versionada para espaciamiento/conteo/totales. No implementar ni iniciar la siguiente subfase.

## 4. Nueva Hoja 1

**EXCEL: valores manuales e interpretación canónica**, sin asumir que todos sean inputs aprobados de una API futura:

| Celda | Etiqueta / valor guardado | Correspondencia v1 |
| --- | --- | --- |
| B3 | ETo = 5 mm/día | etoMmPerDay = 5 |
| B4 | Kc = 0,7 | cropCoefficient = 0.7 |
| B5 | días sin regar = 20 | daysWithoutIrrigation = 20 |
| B6 | «Ancho del surco» = 1,3 m | widthM = 1.3; CLIENTE aclara distancia |
| B7 | largo = 60 m | lengthM = 60 |
| B8 | pendiente = 0; formato 0.00% | slopePct = 0; pendiente no nula requiere conversión ×100 desde fracción Excel |
| B10 | avance = 20 min | advanceTimeMin = 20 |
| B12 | Escurrimiento / Cola = 0 L | fuera de v1 |
| B17 | caudal = 0,9 L/s | flowLps = 0.9 |
| B18 | duración = 2 horas | durationMin = 120 |
| B19 | textura = Franco | texture = Franco, descriptiva |
| B20 / B21 | CC = 20; PMP = 10 | fieldCapacityPct = 20; wiltingPointPct = 10 |
| B22 | Da = 1,3 g/cm³ | bulkDensityGcm3 = 1.3 |
| B23 | raíz = 0,7 m | rootDepthM = 0.7 |
| B26 | umbral = 0,6 | depletionThresholdPct = 60 |
| B30 | cantidad = texto «18» | fuera de v1; no copiar tipo string a un futuro integer |

**Inventario completo de fórmulas reales y valores guardados** (punto decimal en fórmulas/literales técnicos):

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
| E18 | `=E14 / (B17 * 3600)` | 2 |
| B24 | `=((B20 - B21) / 100) * B22 * B23 * 1000` | 91 |
| B25 | `=B24 * B6 * B7` | 7098 |
| B27 | `=B24 * B26` | 54.6 |
| B28 | `=B27 * B6 * B7` | 4258.8 |
| B31 | `=E14*B30` | 116640 |
| B32 | `=B31/1000` | 116.64 |

B11/E17 usan formato `0%`: se muestran redondeados aproximadamente como 17%/57%, aunque sus fracciones subyacentes son las anteriores. C14:C16 usan `0.0`; E15:E16 `0.00`; E18 `0`. El backend conserva precisión y devuelve porcentaje numérico, no fracción. No se encontraron caches de error ni diferencias aritméticas en las 19 fórmulas.

## 5. Nueva Hoja 2

**EXCEL:** hoja auxiliar íntegramente textual/manual; ninguna referencia desde las 19 fórmulas de Hoja 1. No hay lookup, selección automática, fórmula de defaults ni cálculo de infiltración por textura.

Tabla B6:E11, titulada «Tablas Estándar - Método Rápido»:

| Fila / textura | CC | PMP | Agua útil/disponible indicada |
| --- | --- | --- | --- |
| 7 Arenoso | 10%–15% | 4%–6% | ~6%–9% |
| 8 Franco-Arenoso | 15%–20% | 6%–10% | ~9%–11% |
| 9 Franco (Equilibrado) | 20%–28% | 10%–14% | ~10%–14% |
| 10 Franco-Arcilloso | 27%–35% | 13%–19% | ~14%–16% |
| 11 Arcilloso | 35%–45% | 20%–25% | ~15%–20% |

B4 permite usar rangos promedio si no se dispone de laboratorio. No declara base gravimétrica/volumétrica. Las columnas de agua útil son aproximaciones textuales, no intervalos calculados mediante todas las combinaciones extremas de CC/PMP; no automatizar su resta como si los rangos fueran independientes y correlacionados de forma conocida.

Tabla G22:J25, también manual:

| Fila / textura | CC | PMP | Agua disponible |
| --- | ---: | ---: | ---: |
| 23 Arcilloso | 30 | 15 | 15 |
| 24 Franco | 20 | 10 | 10 |
| 25 Arenoso | 10 | 5 | 5 |

**CONTRADICCIÓN/heterogeneidad:** Arcilloso 30/15 queda fuera de los rangos 35–45/20–25 de la primera tabla. Franco 20/10 y Arenoso 10/5 encajan, pero no existe prioridad declarada ni distinción de origen/población que explique Arcilloso. No puede convertirse ninguna de las dos tablas silenciosamente en catálogo autorizado.

Tabla A28:D31 de Da/almacenamiento:

| Fila / descripción | Da g/cm³ | mm por 10 cm de suelo | Texto de comportamiento |
| --- | --- | --- | --- |
| 29 Arenosos/Pedregosos; Valle de Uco/Luján | 1,50–1,65 | 6–10 | poca retención, pulsos cortos |
| 30 Francos / «Franco-Lim构造»; Maipú/Junín | 1,30–1,45 | 14–18 | retención óptima, riegos más distanciados |
| 31 Limosos/Franco-Arcillosos; Lavalle/este | 1,25–1,35 | 18–22 | alta retención, asfixia/drenaje |

Se preserva el texto anómalo «Franco-Lim构造» como evidencia de calidad editorial. Estos rangos no alimentan B22/B24. Para el ejemplo 20/10/Da1,3, F12 equivale a 13 mm por 10 cm, por debajo del rango orientativo 14–18 de Francos: no es identidad matemática entre tablas ni justifica cambiar la fórmula; falta explicar alcance y supuestos.

G8:I11 contiene bandas de avance (véase §27); B16:D23 tabla pendiente/Qmax (§16). A26:A39 agrega narrativa de Mendoza, compactación, pie de arado Da>1,60 a 15–25 cm, piedra y una reducción sugerida del 50% de capacidad para 50% de piedra, más preguntas y una oferta de buscar series INTA. A33 menciona INTA/FCA sin título, autor, publicación, fecha ni referencia verificable. Ninguna de esas afirmaciones establece calibración del 4,5 ni se incorpora al motor.

Clasificación: **A datos que alimentan fórmulas actuales: ninguno desde Hoja 2. B orientación textual: todas sus tablas. C futuros defaults: candidatos sin selección aprobada. D recomendaciones: textos agronómicos sin regla ejecutable aprobada. E fuente formal identificada: no, pese a menciones regionales e institucionales.**

## 6. Hoja 3 / Descripcion

**Hoja 3 A1:A4:** propuesta de tres preguntas para una clase: pendiente 1,5% y Qmax; suelo arenoso/avance lento y barra de pérdidas; decisión ante déficit al fondo. No hay valores calculados, fórmulas, calibración ni respuestas. Bajo v1, cambiar solo textura no modifica infiltración: la pregunta didáctica no crea esa dependencia.

**Descripcion:** 32 textos estáticos A1:A35 con tres huecos (A10/A13/A32). DOCX párrafos P1:P35 conserva las mismas posiciones y los mismos textos no vacíos; por ello una referencia `P28 / A28` es trazable a ambas fuentes. Trata clima/geometría, suelo, infiltración, balance y totales. No se vincula a Hoja 1 por fórmula y puede quedar desactualizada aunque esta cambie.

EXPLICACIÓN P6/A6 llama a 1,3 m ancho y área mojada; CLIENTE lo corrige a distancia entre surcos. P8/A8 y P9/A9 conservan caudal/avance distintos de Hoja 1. P22/A22 cita «fila 19, columna F» para días adicionales: F19 está vacía; la celda real es E18. P35/A35 llama «lámina» a un volumen en m³ y relaciona indebidamente recomendado por surco con total aplicado.

## 7. Comparación Excel vs DOCX

| Elemento | Hoja 1 real | DOCX / Descripcion | Clasificación |
| --- | --- | --- | --- |
| ETo / Kc / días | 5 / 0,7 / 20 | P3:P5 iguales | Coincide |
| geometría | B6=1,3; B7=60; etiqueta ancho | P6 ancho/área mojada | Ambos contradicen nueva semántica CLIENTE |
| pendiente / Qmax | 0 / ~6,3 | P7:P8 iguales | Coincide en caso cero; seguridad física no demostrada |
| caudal | B17=0,9 | P8=0,3; P28 usa 0,3 para afirmar 6480 | Contradicción numérica e interna del texto |
| avance / criterio | B10=20 / B11=16,6667% | P9=4,8 / 4% | Drift de escenario |
| duración | B18=2 h | P24=2 h=120 min | Coincide |
| suelo / AU / umbral | Franco, 20/10, 1,3, 0,7; 91; 0,6; 54,6 | P14:P21 iguales; peso seco declarado | Aclara intención de base CC/PMP |
| infiltración inicio/medio/final | 49,2950 / 47,1964 / 45 mm | P25=49,3 / 48,8 / 48,3 | Medio/final corresponden a Ta4,8, no Ta20 |
| aplicado | E14=6480 L | P28=6480 L, multiplicación errónea | Valor coincide; explicación de caudal falla |
| aprovechado | E15=3681,3191 L | P29=3806,37 L | Corresponde a Ta4,8 |
| residual | E16=2798,6809 L | P30=2673,63 L; percolación profunda | Drift + atribución física no modelada |
| eficiencia | E17=56,8105% | P31=59% | Corresponde al redondeo de Ta4,8 con Q0,9 |
| días adicionales | E18=2 horas algebraicamente | P22=2 días de retraso/estrés | Error dimensional y conceptual |
| máximo recomendado | B28=4258,8 L | P34 igual, «para reponer» | Valor coincide; no equivale a meta70 mm |
| total | B31=116640 L; B32=116,64 m³ | P35 iguales pero derivación desde recomendado | Coincide aplicado; causalidad del texto incorrecta |

## 8. Contradicciones detectadas

| ID | Hallazgo | Evidencia / consecuencia |
| --- | --- | --- |
| C01 | Caudal narrado 0,3 vs Excel0,9 | P8/P28 vs B17; 0,3×7200=2160, no6480 |
| C02 | Avance narrado4,8 vs Excel20 | P9/P25 vs B10; altera ratio, medio/final, útil, residual y eficiencia |
| C03 | Texto conserva resultados de otro escenario | 3806,37/2673,63/59% reproducibles con Q0,9 y Ta4,8, no con sus dos inputs narrados |
| C04 | «Días» calculados como horas | E18; P22 atribuye estrés sin cálculo de ese fenómeno |
| C05 | Referencia inexistente a F19 | P22/A22 vs celda real E18 |
| C06 | Ancho mojado vs espaciamiento confirmado | P6/A6, etiqueta A6 vs CLIENTE A |
| C07 | Tramos50/100 con largo60 | A15 «50m - Tramo Medio», A16 «100m», Hoja2 I9/I11; las fórmulas operan mitad/final sin coordenadas |
| C08 | Aplicado confundido con recomendado | P34:P35; 4258,8×18=76658,4, no116640 |
| C09 | «Lámina» expresada en m³ | P35; m³ es volumen, mm sería lámina |
| C10 | Tablas Arcilloso discordantes | Hoja2 C11/D11 vs H23/I23 |
| C11 | Qmax tabla baja no reproduce todos los extremos | Hoja2 B19/C19: 4,2–5 vs fórmula6,3–4,2 |
| C12 | Bandas sin umbral inequívoco | Hoja2 G9:G11; 25–30 requiere selección |
| C13 | Residual atribuido íntegramente a percolación | P30 vs E16; B12 no participa, sin balance de perfil |
| C14 | F01 resumida en solicitud omite /100 | Código/contrato usan pendiente fraccional; si se copia el resumen se cambia Qmax por factor100 |

C03 es **inferencia de compatibilidad aritmética con otra configuración**, no prueba de la existencia, fecha o autor de una versión anterior. No se recibió un archivo anterior que permita certificar su procedencia. C10/C11 pueden corresponder a aproximaciones o alcances distintos, pero la fuente no lo explica.

## 9. Distancia entre surcos 1.30 m

**CLIENTE:** 1,30 m es distancia entre surcos, no ancho mojado. **BACKEND:** `widthM`, `width_m`, unidad m y `widthMeaning: pending_validation`; F08/F13/F15 multiplican width por largo. No hay un campo separado de ancho mojado.

**INFERENCIA dimensional:** `mm × m × m = L`, porque 1 mm sobre 1 m² equivale a 1 L. La operación sigue siendo dimensionalmente válida usando espaciamiento. Esto no demuestra que la lámina estimada sea representativa de toda la franja tributaria.

Ancho mojado es la extensión transversal efectivamente mojada; espaciamiento es la distancia entre surcos; ancho tributario es el ancho de superficie asignado a un surco para contabilizar volumen. Espaciamiento podría actuar como ancho tributario en un diseño uniforme, con reglas de bordes y asignación de área adecuadas. Las fuentes no establecen esas reglas ni la integración transversal del agua infiltrada. Por tanto, no afirmar que son físicamente intercambiables.

Nombre propuesto, sin renombrar: `furrowSpacingM`. Si se necesita otra magnitud futura, distinguirla de `wettedWidthM`/`tributaryWidthM`. Unidad seguiría siendo m. Cambiar solo etiqueta futura puede no alterar números; renombrar payload/columnas afecta contratos, mapper, tests y lectura de históricos. El frontend deberá decir distancia entre surcos en la especificación aprobada, sin reinterpretar snapshots v1 con ancho pendiente.

## 10. Cantidad de surcos = 18

**CLIENTE:** cantidad total para la superficie considerada, no «surcos por hectárea». **EXCEL:** B30 almacena texto `18`; B31 lo usa en multiplicación. No cuenta surcos mediante área ni vincula esa cantidad a una hectárea.

**Propuesta:** `furrowCount`, número JSON entero positivo, con límites estructurales y rango SQL por definir; no admitir decimales, cero ni strings mediante coerción silenciosa. No elegir INT UNSIGNED ni un máximo agronómico definitivo en esta auditoría. No completar retrospectivamente count=1/18 por defecto para filas v1.

La multiplicación asume que volumen por surco es representativo de los 18 surcos. Preguntar si tienen igual largo, separación, caudal, duración y avance. Count no altera por sí solo las fórmulas por surco; cambia el alcance de los totales.

## 11. Superficie

**EXCEL:** A29 dice «Superficie Regada», pero debajo solo calcula cantidad y volúmenes. En todas las hojas/fórmulas no hay output de superficie en m²/ha ni fórmula `spacing × length × count`. No aparece 1404 ni una hectárea derivada.

**INFERENCIA:** `1.3 × 60 × 18 = 1404 m²`, si cada surco representa una franja de 1,3×60 m. Este valor **NO aparece en la fuente**. Tampoco prueba el área geométrica real del lote: bordes, número de espacios entre ejes y asignación tributaria requieren definición. No convertir 18 en densidad de surcos por ha.

`surfaceAreaM2` puede ser un output derivado útil para trazabilidad, condicionado a esas hipótesis, o contexto explicativo. No fue pedido inequívocamente como campo por el cliente; no implementarlo ni decidir su incorporación aún.

## 12. CC/PMP

**EXPLICACIÓN P15/P16 y Descripcion A15/A16:** CC20% y PMP10% «en peso seco». P17/A17 explica que Da convierte agua medida en peso a volumen usable. **Hoja 2 no declara esta base.** La remisión CLIENTE a Hoja2/«Cuadrito» no debe citarse como si ese contenido estuviera allí.

**INFERENCIA:** para contenido gravimétrico, `(CC-PMP)/100` es masa de agua por masa seca; multiplicar por Da/densidad del agua permite contenido volumétrico. F12 incorpora numéricamente el supuesto de densidad del agua 1 g/cm³ y convierte Pr m a mm. Con 20/10/1,3/0,7 produce91 mm. Es coherente con la intención gravimétrica declarada; si CC/PMP fueran volumétricos, multiplicar otra vez por Da cambiaría el significado.

El pendiente «gravimétrico vs volumétrico» puede cerrarse **para la intención de estas fuentes** como gravimétrico en peso seco, dejando trazabilidad precisa. No prueba base de datos de laboratorio anteriores ni de todas las tablas auxiliares. Metadata v1 continúa `soilWaterContentBasis: pending_validation` y su procedencia F12 pendiente: no se modifica ni se reescribe históricamente en R4F-A.

## 13. Densidad aparente

**EXCEL:** B22=1,3 g/cm³, manual. Hoja2 B29:B31 da rangos textuales. **BACKEND:** Da participa únicamente en AU y derivados de AU; no modifica coeficiente de infiltración, avance ni Qmax. El valor narrativo coincide y la conversión gravimétrica es coherente bajo los supuestos de §12.

**Límite:** afirmar a partir de Da1,3 que no hay compactación severa, o reducir automáticamente capacidad por piedra, es interpretación de la explicación, no una medición/modelo incorporado. No transformar tablas regionales en recomendaciones ejecutables ni introducir porcentaje de piedras.

## 14. Textura

**BACKEND:** campo descriptivo nullable/optional, máximo64 caracteres; no es catálogo ni modifica CC/PMP/Da/infiltración. Migration y test de cambio exclusivo de textura lo fijan. **EXCEL:** B19 manual; no enlaza tablas de Hoja2 a B20:B22.

Recomendación: mantener los valores manuales como autoridad. Las tablas podrían ofrecer sugerencias futuras explícitas, con origen, rango, aceptación del usuario y provenance; requieren resolver duplicados, unidades, base y alcance. No justifican autocompletado silencioso. Sus riesgos incluyen sobrescribir laboratorio, introducir valores distintos entre tablas, dar apariencia de calibración y cambiar resultados al editar una etiqueta descriptiva.

## 15. 4.5*sqrt(t)

**EXCEL:** 4,5 aparece como constante literal en C14:C16; exponente0,5, duración en minutos y llegada media Ta/2. Se revisaron todas las hojas y los 32 textos del DOCX. No hay origen del coeficiente, autor, bibliografía, ensayo, calibración, tabla de k por textura ni explicación suficiente de sus unidades. No se menciona Kostiakov en esos contenidos. INTA/FCA/Mendoza aparecen en narrativa sobre densidad y suelo, sin vincularse al coeficiente.

**La nueva fuente NO resuelve el origen de 4.5.** No atribuirlo a una ecuación científica específica ni validarlo por semejanza. **INFERENCIA dimensional:** para resultado mm con t min, k tendría unidades mm/min^0,5. El backend ya declara esas unidades y `infiltrationCalibration: none`, `scientificValidation: not_validated`, `textureEffectOnInfiltration: none`; esas declaraciones no prueban su origen ni su validez de campo.

No ampliar el modelo por textura ni iniciar investigación externa en esta fase.

## 16. Qmax

**BACKEND real:** `slopePct === 0 ? 6.3 : 0.0063 / (slopePct / 100)`, calculator líneas70–71 y contrato del motor §11. **EXCEL:** B8 tiene formato porcentual y B9 divide directamente por B8. Para representar0,30% en Excel se utiliza fracción0,003; la API utiliza0,30. Son compatibles con conversión correcta.

| Pendiente canónica % | Fracción Excel | Qmax motor/fórmula L/s | Hoja2 |
| --- | ---: | ---: | --- |
| 0 | 0 | 6,3 | Hoja1 ~6,3 |
| 0,10 | 0,001 | 6,3 | fila19 rango4,20–5,00 |
| 0,15 | 0,0015 | 4,2 | fila19 rango4,20–5,00 |
| 0,30 | 0,003 | 2,1 | fila20 2,10 |
| 0,50 | 0,005 | 1,26 | fila21 1,26 |
| 1,00 | 0,01 | 0,63 | fila22 0,63 |
| 2,00 | 0,02 | 0,315 | fila23 0,31 aproximado |

La tabla respalda los puntos0,30/0,50/1 y aproxima2; el rango bajo no cubre el extremo6,3 de0,10. No inferir un cap de5 L/s. No hay interpolación ni calibración identificada. El caso de pendiente cero no discrimina qué unidad quiso usar el autor; los formatos y los otros puntos son la evidencia adicional.

La rama Excel cero guarda6.300000000000001; v1 fija6.3, diferencia de último bit ya documentada. No cambiar ni esa rama ni el comportamiento cerca de cero. **CONTRADICCIÓN del prompt:** copiar `0.0063/slopePct` con pendiente canónica0,30 produciría0,021, cien veces menos que2,1.

## 17. Tiempo/criterio de avance

**EXCEL:** B10=20min; B18=2h; B11=(20/60)/2=1/6, visualizado porcentualmente. **BACKEND:** advanceRatioPct=100×20/120=16,666666666666668. EXPLICACIÓN P9=4,8min/4%, consistente entre sí para120min, pero distinto de Hoja1.

Ta modifica infiltración media/final, útil, residual, eficiencia y comparaciones P02/P03/P05 dependientes de los puntos. No modifica inicio, aplicado, AU, meta, Qmax ni P04. En las dos variantes concretas Ta20/Ta4,8 siguen P02/P04. No convertir ratio a categoría automática.

## 18. Caudal

**EXCEL B17:**0,9L/s. **EXPLICACIÓN P8/P28:**0,3L/s. La operación0,9×7200=6480L reproduce E14;0,3×7200=2160L contradice el volumen narrado. No se selecciona una configuración final por intuición: se describe la efectiva en Excel y se solicita confirmar el ejemplo autorizado.

El caudal afecta aplicado, residual, eficiencia, total aplicado y P01; no altera las infiltraciones ni útil en este modelo. Con Q0,3 y Ta20, los cálculos literales darían útil3681,319L>2160L, residual−1521,319L y eficiencia170,4314%. El motor rechaza con MODEL_INCONSISTENCY, sin output exitoso ni persistencia. Con Q0,3 y Ta4,8 también falla: útil3806,368L, residual−1646,368L, eficiencia176,2207%. No aplicar clamp para hacer coherente el relato.

## 19. Infiltración

| Escenario analítico | Inicio mm | Medio mm | Final mm |
| --- | ---: | ---: | ---: |
| Excel / t120, Ta20 | 49.29503017546495 | 47.19639816765682 | 45 |
| Cambiar solo Ta a4,8 | 49.29503017546495 | 48.799590162213455 | 48.299068313995456 |
| G01 congelado / t60, Ta4,8 | 34.856850115866756 | 34.152598729818493 | 33.433516117812076 |

P25 redondea la segunda fila. Esto explica el drift numérico; no autoriza cambiar Ta. El backend reproduce la primera fila con los inputs nuevos, sin modificar fórmula. Las etiquetas «Real» en Excel/narrativa no convierten una estimación empírica en medición. A15/A16 dicen50/100m, pese a largo60: si se habla de mitad/final de ese largo serían30/60m como inferencia, no corrección del archivo.

## 20. Volumen aplicado

F07 vigente `Q × durationMin × 60` equivale a E14 `Q × durationHours × 3600`:6480L para0,9 y120min. No depende de espaciamiento, count, textura ni Ta. Duration120min es un nuevo escenario válido, no un cambio de modelo; G01 usa60min y aplicado3240L. El motor no tiene un valor fijo de duración por defecto.

## 21. Volumen aprovechado

E15/F08=`middleDepth × width/spacing × length`=47,19639816765682×1,3×60=3681,3190570772317L. El texto3806,37 corresponde a Ta4,8. La operación usa una lámina del punto medio como representante del área; no integra todo el perfil longitudinal/transversal ni aplica un balance de almacenamiento inicial. No certifica «retenido en raíces y usable» como hecho medido. Mantener `estimatedUsefulVolumeL` y presentación estimada, con limitación de §9.

## 22. Residual/percolación

E16/F09=`applied−estimatedUseful`=2798,6809429227683L. P30 afirma que todo residual es percolación porque cola=0. **Ese mecanismo no está calculado:** B12 no participa; no hay flujo por debajo de raíces, distribución vertical, humedad inicial, medición de cola ni términos completos de balance. Aun suponiendo runoff cero, la resta de una estimación espacial simplificada no identifica por sí sola la causa física del remanente.

Recomendación A/B: conservar `residualLossVolumeL` y mostrar «pérdida residual estimada», explicando que no discrimina causa. Rechazar por falta de evidencia la propuesta C `deepPercolationVolumeL`. P03/P05 del backend ya dicen que superar una lámina no demuestra percolación profunda.

## 23. Eficiencia

E17 guarda0,5681047927588321; F10 devuelve56,8104792758832%. La diferencia de operación `100*útil/aplicado` frente a `100*(útil/aplicado)` puede producir último bit distinto sin cambio de modelo. Con Ta4,8 y Q0,9 da58,74024741747916%, redondeado59% por el relato. El cache actual se muestra57% a cero decimales.

No validar como «aceptable», promedio40–50% o eficiencia medida: son afirmaciones de P31 sin evidencia formal adicional. Conservar estimación y validación estructural0..100; no añadir recomendaciones automáticas de reducir duración.

## 24. Días adicionales

**Confirmado:** E18=`E14/(B17*3600)` y E14=`B17*B18*3600`; para caudal no cero, E18=B18=2. Unidades `L / ((L/s)×(s/h)) = h`. No son días. No depende de ETo, Kc, días sin regar, CC/PMP, raíz ni umbral, por lo que no puede calcular retraso/estrés derivado de70 frente a54,6mm.

No hay otra fórmula asociada que produzca días adicionales: se inspeccionaron todas las hojas y solo existen las19 fórmulas listadas. F19 está vacía. EXPLICACIÓN P22/A22 interpreta erróneamente el2 como días y apunta a celda equivocada. Clasificación: **error dimensional de etiqueta/fórmula respecto al concepto narrado, más interpretación sin soporte**. F11 queda excluida de v1; no diseñar una fórmula alternativa por inferencia.

## 25. Escurrimiento/cola

**EXCEL B12:** número manual0, sin fórmula ni referencia desde ninguna otra fórmula. Puede ser un dato editable en la planilla, pero no está incorporado al balance. Tampoco se calcula a partir de pendiente0. El texto P7 relaciona pendiente plana con cola0; no constituye ley implementada ni medición acreditada.

**BACKEND:** runoff fuera del MVP; no input, output, columna ni diagnóstico activo. La presencia de un cero desconectado no justifica incorporarlo. Una futura extensión exigiría definición, medición/unidad/alcance por surco, fórmula de balance y reglas cuando faltan datos. No implementarla.

## 26. Totales por superficie

**EXCEL confirmado:** B31=E14×B30=6480×18=116640L; B32=B31/1000=116,64m³. Es aplicado real calculado, no máximo recomendado. No hay fórmula de total recomendado en el archivo.

| Magnitud | Por surco | ×18 | Estado |
| --- | ---: | ---: | --- |
| aplicado | 6480L | 116640L /116,64m³ | presente en Excel |
| máximo recomendado | 4258,8L | 76658,4L /76,6584m³ | cálculo de auditoría, no output de la fuente |

Propuestas: `totalAppliedVolumeL`, `totalAppliedVolumeM3` asociados a `furrowCount`. `totalRecommendedVolumeL/M3` son opciones, no requerimiento confirmado. Definir si un resumen histórico deberá mostrar totales y cómo distinguirlos de aplicado por surco. Homogeneidad de surcos pendiente; total no informa simultaneidad, caudal global de alimentación ni tiempo total de operación del lote.

## 27. Bandas 25/30/50

**EXCEL, transcripción literal de G9:G11** (incluye barras invertidas del texto original):

```text
Menor o igual al 25\\% - 30\\% → Óptimo / Parejo
Mayor al 30\\% - 50\\% → Aceptable / Regular
Mayor al 50\\% → ⚠️ Crítico / Muy Desuniforme
```

La primera no define si el corte es25 o30. Si óptimo≤25 y regular>30 hasta50, queda hueco(25,30]; si óptimo≤30 y regular(30,50], no hay hueco. Si se interpreta regular>30 sin techo, solapa con crítico>50. Es redacción informal, sin operador superior explícito ni selección de umbral; no una partición ejecutable inequívoca. No afirmar que hay necesariamente hueco/solapamiento: depende de interpretación.

**BACKEND:** D01-D03 diferidos, `advanceRules:null`, `advanceBands:not_selected`; tests de25/30/50/60 no generan D01-D08. Preguntar cortes, inclusividad, nombres y alcance de la afirmación de uniformidad. Los textos de Hoja2 mencionan100m aunque el ejemplo tiene60m. No activar reglas ni inferir exactitud agronómica de las categorías.

## 28. Matriz v1 vs nueva especificación

Leyenda: «si se adopta» indica impacto hipotético, no modificación autorizada. «Test» describe cobertura que sería necesaria en implementación posterior, no nuevos tests de esta auditoría. Se divide la matriz para mantener las dimensiones solicitadas legibles; ambas partes usan los mismos elementos.

| Elemento | V1 actual | Nueva fuente | Compatible / semántica | Input | Output | Pregunta humana |
| --- | --- | --- | --- | --- | --- | --- |
| widthM / spacing | significado pendiente | CLIENTE distancia1,3 | números compatibles; significado aclarado, área tributaria pendiente | rename propuesto | mismos volúmenes, si misma área | Sí, asignación de área/bordes |
| furrowCount | ausente | cantidad18, texto en B30 | extensión | nuevo entero | habilita totales | Sí, alcance/homogeneidad |
| total volumes | por surco | B31/B32 aplicado total | extensión, no recomendado | depende count | nuevos L/m³; recomendado opcional | Sí, cuáles mostrar |
| CC/PMP basis | metadata pendiente | Descripcion/DOCX peso seco | F12 coherente, aclaración documental | mismos números | iguales | intención resuelta; base de tablas/laboratorio pendiente |
| texture | descriptiva | tablas sin lookup | compatible manual; no defaults aprobados | igual | igual salvo automatización futura | Sí para sugerencias/defaults |
| coeficiente4,5 | fijo no calibrado | literal sin origen | compatible, pendiente científico | ninguno nuevo acreditado | iguales | Sí |
| bandas avance | D01-D03 diferidos | textos25–30/30–50/>50 | no regla inequívoca | igual | nuevos diagnósticos si aprobados | Sí |
| runoff | excluido | B12 manual0 desconectado | fuente no justifica balance nuevo | hipotético | hipotético | Sí |
| residual/percolación | residual sin causa | explicación dice percolación | cálculo compatible; interpretación incompatible | igual | conservar residual | Sí si pide causa física |
| días adicionales | F11 excluida | horas mal llamadas días | no incorporar | no definido | no definido | Sí |
| Qmax | 0.0063/(s/100), cero6,3 | fórmula con fracción; tabla aproximada | fórmula compatible; resumen prompt erróneo | convertir unidad Excel | igual, sin cap | Sí para rango bajo/calibración |
| flow | variable, G01=0,9 | Excel0,9/texto0,3 | input ya soportado; contradicción de ejemplo | mismo campo | aplicado/residual/eficiencia dependen | Sí, ejemplo final |
| advance time | variable, G01=4,8 | Excel20/texto4,8 | input ya soportado; drift | mismo campo | medio/final y derivados | Sí, ejemplo final |
| duration | min, G01=60 | 2h=120min | compatible con conversión | mismo campo | cambia escenario | no para conversión; sí para fixture final |
| infiltration values | fórmula fija | Excel49,295/47,196/45 vs texto49,3/48,8/48,3 | Excel reproducible; texto otro avance | iguales | no output nuevo | Sí, fuente narrativa a corregir |

| Elemento | DB si se adopta | API si se adopta | Tests si se adopta |
| --- | --- | --- | --- |
| widthM / spacing | conservar width_m; columna nueva opcional según estrategia | rename incompatible; adapter por versión | unidades, mapper, históricos, área y goldens |
| furrowCount | columna v2 nullable para v1, sin backfill inventado | nuevo input estricto/versionado | entero/tipo/límites, HTTP, roundtrip |
| total volumes | columnas snapshot o derivación histórica versionada por definir | nuevos outputs; summary opcional requiere decisión | aplicado vs recomendado, L/m³, overflow |
| CC/PMP basis | metadata futura; no reescribir v1 | shape puede seguir igual; evidencia/versionado por decidir | valores y provenance por versión |
| texture | ninguna por mantener manual | ninguna por mantener descriptiva | conservar independencia; consentimiento si sugerencias |
| coeficiente4,5 | ninguna sin cambio; parámetros/versiones si cambia | modelo nuevo si matemática cambia | goldens y calibración externa separada |
| bandas avance | diagnostics JSON/metadata por fila, sin editar v1 | nuevas reglas/versión diagnóstica | cortes/inclusividad/orden/históricos |
| runoff | campo/snapshot nuevo si se define | contrato de balance nuevo | medición ausente, dominios, balance |
| residual/percolación | ninguna al conservar residual | texto estimado; rename físico no acreditado | conservar mensajes prudentes y dominio |
| días adicionales | ninguna al mantener excluido | no agregar output defectuoso | solo tras definición independiente aprobada |
| Qmax | ninguna al preservar cálculo | porcentaje canónico actual | conversión, cero, positivos, singularidad |
| flow | ninguna por dato del escenario | campo actual | fixture nuevo y rechazo de balance0,3 |
| advance time | ninguna por dato del escenario | campo actual | escenario nuevo y dependencias |
| duration | ninguna por dato del escenario | min ya canónicos | conversión120, no reemplazar G01 |
| infiltration values | snapshot actual lo soporta | shape actual | fixture adicional, precisión/presentación |

## 29. Impacto en motor

Los15 inputs canónicos (14 números y textura) y14 outputs numéricos más `diagnostics.items` se confirman en INPUT_CONTRACT/OUTPUT_CONTRACT. F02-F10/F12-F15 implementadas coinciden con fórmulas nuevas al convertir horas/fracciones; F01 se aclara en§16. F11/F16/F17 siguen excluidas.

No hace falta cambiar el motor para ejecutar Q0,9/t120/Ta20. Un rename de spacing o count/totales necesita contrato/validación y posiblemente nueva organización del resultado; no obliga por sí solo a cambiar la ecuación de infiltración. Si se cambia ancho tributario, coeficiente, balance, textura, bandas o días, se modifica semántica/matemática/reglas y requiere especificación explícita. No reutilizar v1 para emitir resultados con significado nuevo sin trazabilidad.

## 30. Impacto en DB

Migration existente: inputs/outputs en DOUBLE sin escala; textura/name nullable, números y versiones no nulos; metadata/diagnostics JSON; created_at UTC DATETIME(3); CHECK de dominios/relaciones; FK finca RESTRICT e índice finca/fecha/id. No tiene count, spacing separado, área ni totales de superficie.

Opciones a estudiar posteriormente, sin migration definitiva: conservar columnas v1 y agregar columnas para campos exclusivos v2; o separar almacenamiento por versión con lectura unificada explícita. Si se usa la tabla existente, campos v2 ausentes en v1 normalmente necesitan nullable, no NOT NULL con count/spacing inventados. Los CHECK nuevos deberán distinguir filas/versiones o admitir ausencia histórica de forma deliberada. Nuevas columnas deben permitir las inserciones v1 durante convivencia, y las columnas v1 NOT NULL deben poder satisfacerse en v2 mediante estrategia definida, no duplicación silenciosa de significado.

Una nueva migration sería el lugar de cambios de schema; no editar la ya aplicada. No asumir DB vacía hoy: el documento histórico reporta cleanup0, pero en esta auditoría no se consulta DB. Incluso si estuviera vacía, hay contrato/reproducción v1 que preservar. La opción concreta y tipos quedan pendientes.

## 31. Impacto en API

API actual: POST/HISTORY/DETAIL bajo `/api/fincas/:fincaId/irrigation-simulations`, JWT/ownership y autoridad del servidor para versiones, resultados, IDs, timestamps y metadata. POST admite name opcional y grupos exactos; campos desconocidos se rechazan. Por tanto, enviar `furrowSpacingM`, `furrowCount`, totales o una versión elegida por cliente sin diseño aprobado no es compatible con el POST actual.

Rename exige contrato nuevo o adapter explícito, sin aceptar simultáneamente width/spacing con valores contradictorios por intuición. Nuevos outputs podrían ser aditivos para algunos consumidores, pero no se garantiza compatibilidad con consumidores de shape estricto. Definir selección de versión por endpoint/envelope/payload según propuesta posterior; no crear rutas ni políticas ahora. HISTORY hoy resume meta, aplicado por surco, eficiencia y severidades; incorporar totales no debe hacer que `appliedVolumeL` cambie silenciosamente de alcance. Mantener minutos, porcentajes numéricos y L como unidades canónicas; redondeo solo de presentación.

## 32. Impacto en persistencia

Service calcula al crear y persiste dentro de transacción; HISTORY/DETAIL leen snapshots sin recalcular. Mapper copia versiones/hash/metadata históricos. **Riesgo concreto:** `mapStoredDetail` usa INPUT_CONTRACT/OUTPUT_CONTRACT importados actualmente para interpretar todas las filas; no despacha mapper según model/contract version. Cambiar esos contratos globalmente reinterpretaría filas v1 o exigiría columnas inexistentes.

Una convivencia v1/v2 requiere lectura por versión y mappings conservados, más write-path de la versión correspondiente. `modelVersion` por fila ya existe, pero no alcanza por sí solo sin dispatch y soporte de contratos/columnas históricos. No recalcular viejos totales ni completar count/spacing al leer sin evidencia almacenada. Metadata/hash/diagnósticos deben continuar perteneciendo al snapshot original. El nuevo SHA del cliente es evidencia adicional, no reemplazo del sourceHash v1.

POST lockea finca propia; DELETE finca lockea y rechaza409 si tiene simulaciones, conserva Manning y finca ante rechazo; FK RESTRICT permanece. Cualquier diseño nuevo deberá conservar ownership, atomicidad, rollback y coordinación, sin tocar estas garantías durante auditoría.

## 33. Impacto en tests/goldens

G01 congelado usa0,9L/s,60min,4,8min de avance; produce3240L aplicado,2663,9027009258425L útil,82,21921916437785% esperado y ratio8%. **No sustituirlo por el ejemplo nuevo:** diferencia de fixture no demuestra defecto del motor. Añadir escenario nuevo solo en una fase autorizada; hoy se verificó temporalmente en memoria.

G02/G03 fijan Qmax0,30/1%; G04/G06 suelo; G07 caudal; G08/G10/G11 avance; G09 relación inválida; G12 balance imposible. Tests de ancho/largo comprueban escalamiento de volúmenes sin cambiar infiltraciones; textura comprueba independencia; boundaries fija ausencia D01-D08 a25/30/50/60. Metadata/versiones/sourceHash también están fijados. Un rename/cambio semántico debe tener nuevos fixtures por versión, no alterar expectativas históricas para ocultar ruptura.

Para implementación futura se necesitarían validación count/spacing, derivación L/m³/área, precisión/overflow, aplicado vs recomendado, DB roundtrip v1/v2, lecturas mixtas/cursor, HTTP estricto y garantías de ownership/locks. La suite pura ejecutada hoy72/72 no certifica esas extensiones. Los165 PASS del freeze y Aiven8.4.11/TLS1.3 son evidencia histórica leída, no reejecutada.

## 34. ¿Requiere model v2?

**No por cambiar los inputs de un ejemplo ya admitido ni por registrar estas aclaraciones en un documento.** El motor v1 reproduce la nueva Hoja1; no hay nueva matemática acreditada.

**Sí es razonable una revisión de modelo v2 si se adopta nueva semántica efectiva de área/snapshot, count/totales como parte del resultado versionado, cambios de parámetros/balance o reglas diagnósticas.** Aunque count solo escale totales, el producto pasa a estimar otro alcance y debería quedar identificado. No presentar esta recomendación como obligación matemática de cambiar4,5. Aclaración de metadata para nuevos cálculos necesita política de revisión, pues v1 está congelado; no mutar su evidencia bajo el mismo identificador sin decisión formal. No cambiar versiones aquí.

## 35. ¿Requiere contract v2?

Un rename `widthM→furrowSpacingM`, nuevo input count, cambio de unidad/alcance o reglas de validación es cambio contractual; recomendar `irrigation-contract-v2` si se adopta ese paquete. Outputs nuevos también requieren revisión y política explícita de compatibilidad. Una aclaración documental conservando shape/unidades/números no obliga por sí sola a contract-v2. Model, contract, metadata schema y diagnostics rule son ejes distintos; no aumentar todos automáticamente ni prometer que uno cubre los otros.

| Clase solicitada | Ejemplo | Efecto de versión a evaluar |
| --- | --- | --- |
| A aclaración sin resultado nuevo | peso seco en informe; horas→min para escenario | puede ser solo documentación |
| B rename incompatible | widthM→furrowSpacingM | contrato/mapping versionados |
| C input nuevo | furrowCount | contrato y snapshot nuevos |
| D output nuevo | totalAppliedVolumeL/M3 | contrato/modelo de alcance a revisar |
| E matemática nueva | k calibrado, balance runoff, ancho efectivo distinto | model nuevo; contrato si cambian magnitudes |
| F regla nueva | bandas D01-D03 | diagnostics rule nuevo; metadata/model policy a definir |

## 36. Qué puede cambiarse sin pregunta al cliente

En **esta fase**, solo este documento de auditoría. Dentro de él pueden registrarse sin nueva pregunta: conversiones explícitas2h→120min y0,6→60%; las19 fórmulas reales; el error de días; la distinción aplicado/recomendado; la unidad correcta de pendiente en el backend; la ubicación real de «peso seco»; la conservación de residual como estimación y la falta de origen de4,5.

Estas conclusiones permiten proponer una futura corrección documental o de etiquetas basada en evidencia, pero no autorizar editar otros docs/metadata/tests/código durante R4F-A. No convertir «sin pregunta al cliente» en «implementación aprobada».

## 37. Qué NO puede decidirse sin cliente

El ejemplo definitivo de caudal/avance; la asignación de ancho tributario y bordes; homogeneidad de los18 surcos y alcance del total; qué outputs quiere ver; base/procedencia/prioridad de tablas orientativas; umbrales de avance; origen/calibración de4,5; qué significa realmente días adicionales; si hay medición de runoff; y cualquier intención de representar percolación física.

Las decisiones de versionado, schema y convivencia son también decisiones técnicas del proyecto que requieren una fase autorizada; el cliente puede resolver dominio, pero no debe recibir como pregunta agronómica la elección de tipo SQL o mecanismo de dispatch.

## 38. Lista exacta de preguntas para el cliente

1. ¿El ejemplo final que debemos usar es0,9L/s,20min de avance y2h de riego, tal como Hoja1, o hay que corregir alguno? El texto describe0,3L/s y4,8min y mezcla resultados incompatibles.
2. Confirmada la distancia1,30m, ¿cada surco representa para estos volúmenes una franja de1,30m×60m? ¿Cómo se asigna la superficie de los surcos de borde?
3. ¿Los18 surcos tienen igual separación, largo, caudal, duración y avance, y el caudal indicado es individual por surco? ¿Se riegan simultáneamente o en grupos, solo para contextualizar el total?
4. ¿Se deben mostrar total aplicado L/m³, total máximo recomendado L/m³, ambos, y/o superficie derivada m²? Son magnitudes distintas:116640L aplicados frente a76658,4L máximo recomendado total para estos datos.
5. Descripcion/DOCX declara CC/PMP sobre peso seco: ¿esa misma base aplica a las dos tablas de Hoja2 y a los valores de laboratorio que se ingresarán?
6. ¿Cuál es la fuente y cuál tabla de CC/PMP debe tener prioridad? Arcilloso figura35–45/20–25 en una y30/15 en otra. ¿Deben ser solo orientación o sugerencias que el usuario acepte explícitamente?
7. ¿De dónde proviene k=4,5, con qué unidad de tiempo/lámina, textura o ensayo fue obtenido, y hay una referencia o calibración documentada? La nueva fuente no lo explica.
8. ¿El corte de avance óptimo es25% o30%? Definir los tres intervalos exactos e inclusión de25,30 y50, y si quiere esas categorías como orientación o diagnóstico validado.
9. ¿La tabla Qmax0,10–0,15%→4,20–5,00L/s es un redondeo, un límite práctico distinto o un error? La fórmula da6,3L/s a0,10% y4,2 a0,15%. ¿Cuál es su referencia?
10. ¿Qué concepto se quiso calcular con «Días Adicionales»? La fórmula actual devuelve horas de duración y no mide días de retraso. ¿Debe retirarse esa interpretación o definirse un cálculo independiente?
11. ¿Escurrimiento/Cola=0 es medición de campo, supuesto del ejemplo o dato a ingresar? ¿Se espera incorporarlo a algún balance concreto? Actualmente no interviene en fórmulas.
12. ¿Se acepta presentar el remanente como «pérdida residual estimada», sin atribuirlo a percolación profunda? Si se necesita esa causa física, ¿qué evidencia/medición/modelo la sustentará?
13. ¿Se actualizarán las etiquetas50/100m al ejemplo de largo60m y el texto narrativo para evitar enseñar resultados de otro escenario? Confirmar si son etiquetas genéricas heredadas.

Estas preguntas quedan documentadas; no se envían mensajes a terceros ni se inicia una nueva tarea para responderlas.

## 39. Propuesta R4F-B/R4F-C/R4F-D

- **R4F-B, solo tras autorización:** resolver preguntas de dominio, elegir ejemplo de referencia y fuente normativa; especificar alcance, nombres, unidades, hipótesis tributarias, totales y política de evidencia. Mantener4,5 no validado si no aparece soporte. Criterio de cierre: contradicciones resueltas o excluidas expresamente, sin decisiones tácitas.
- **R4F-C, solo tras autorización:** diseño técnico de versiones, API, lectura histórica y persistencia/migration nueva, con matriz de compatibilidad y plan de verificación. Determinar campos obligatorios/opcionales, columnas y dispatch. Sin derivar schema definitivo de esta auditoría.
- **R4F-D, solo tras aprobación del diseño:** implementación acotada y certificación local/integración autorizada, goldens nuevos junto a v1, DB/TLS/JSON/DOUBLE/UTC, ownership/locks/rollback, cleanup y documentación de freeze. R5 se autoriza después del contrato que se decida integrar.

La investigación científica externa de infiltración/Qmax/percolación, si se solicita, debe tener alcance separado; no se promete que estas subfases la sustituyan. No se inicia ninguna de ellas ahora.

## 40. Riesgos

| Riesgo | Efecto | Control propuesto, sin implementación |
| --- | --- | --- |
| copiar Qmax del resumen sin /100 | error factor100 | preservar unidad canónica y evidencia del código/formato Excel |
| confundir fracción/porcentaje u horas/minutos | resultados alterados | conversiones explícitas, nunca valores visuales redondeados |
| usar relato desactualizado como golden | escenarios inconsistentes | referencia nueva confirmada, G01 v1 conservado |
| reinterpretar width histórico | cambia significado sin cambiar números | contratos/mappers por versión y evidencia por fila |
| asumir count=18/1 para v1 | totales históricos inventados | ausencia explícita para filas sin count |
| hacer total del recomendado con aplicado | decisión operativa equivocada | nombres y unidades separados |
| autocompletar desde tablas discordantes | sobreescribe datos reales | ingreso manual y sugerencias consentidas si aprobadas |
| llamar físico/real a empírico | falsa confianza | mantener estimado/not_validated y causa de residual indeterminada |
| activar bandas informales | hueco/solapamiento y diagnóstico injustificado | confirmar operadores y versión de reglas |
| aceptar Q0,3 sin guard | útil>aplicado/eficiencia>100 | conservar rechazo estructural, sin clamp |
| nuevo contrato global en mapper | rompe DETAIL v1 | dispatch/lectura histórica explícitos |
| migration histórica editada o NOT NULL nuevo | deriva schema/rompe filas e inserts v1 | migration nueva, convivencia y nullability planificadas |
| multiplicar por18 sin homogeneidad | total no representativo | confirmar alcance y representación por surco |
| asumir DB vacía hoy | decisiones de migración sin inventario | evidencia histórica marcada; inventario solo en fase autorizada |
| árbol R4 sin commit | HEAD no reproduce implementación auditada | conservar archivos y revisar estado/hashes, sin commit autorizado |

**Checkpoint:** R4F-A concluye en este documento. Se preservan runtime, tests, migrations, contratos, versiones y fuentes. Las verificaciones nuevas son locales/puras y aritméticas; no validación agronómica, nueva certificación DB ni aprobación de v2. **DETENERSE: NO IMPLEMENTAR, NO INICIAR R4F-B NI R5.**
