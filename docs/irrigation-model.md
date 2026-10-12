# R1 — Especificación del simulador de riego por surcos

Estado: especificación documental para revisión. No autoriza implementación ni migraciones.
Fecha de análisis: 2026-10-12.

## 0. Fuente, alcance y reproducibilidad

Fuente oficial aprobada: `C:/Riegar/Docs/Riego Pepe Ag.xlsx`.
SHA-256: `42592487E6E07DEB1B25A073D74086A09C1BB19CB38411AAFC31D28EA64D2127`.

Se analizaron las tres hojas, todas las celdas con contenido, las 19 fórmulas, valores numéricos guardados, formatos, protección, tabla y gráfico. Hay 17 entradas y 17 resultados distintos al agrupar las tres repeticiones de la meta de riego. No hay nombres definidos, enlaces externos, macros, comentarios de celdas, validaciones de datos ni reglas de formato condicional en el archivo. Hoja 1 está protegida, con las entradas desbloqueadas; eso no valida tipos ni rangos.

Existe otra copia en `C:/Users/aguer/OneDrive/Documentos/Riego/actualizado/Riego Pepe Ag.xlsx`, SHA-256 `FB98C311B946DC572434EC63B80F72EE28BADED23D32083950F318873C31BE8F`. Sus celdas difieren en Hoja 1!B5 (30 en vez de 20 días) y B18 (2 en vez de 1 hora). Esa copia no es la fuente oficial. No se mezclan sus escenarios.

### Decisiones R1 aprobadas

Estas decisiones del usuario sustituyen las propuestas anteriores sobre los mismos puntos. No autorizan iniciar R2 ni implementar código.

| ID | Decisión aprobada | Efecto en la especificación |
| --- | --- | --- |
| A01 | Fuente oficial y SHA-256 indicados arriba | Caso base: 20 días sin regar y 1 h de riego; selección de fuente resuelta |
| A02 | Textura no autocompleta CC/PMP | CC y PMP se ingresan explícitamente; cambiar textura no los modifica |
| A03 | Escurrimiento/cola fuera del MVP | No forma parte de inputs, outputs ni persistencia del MVP |
| A04 | Totales por hectárea fuera del MVP hasta resolver cantidad/cobertura | N y totales por hectárea se conservan solo como evidencia del Excel; su resolución no bloquea el MVP por surco |
| A05 | «Días adicionales» eliminado | Sin campo ni resultado de producto; F11 se conserva solo para auditoría de la fuente |
| A06 | Infiltración como estimación del modelo | Resultados y mensajes la identifican como estimada, no medida |
| A07 | Eficiencia como estimada | Identificarla como eficiencia de aplicación estimada; no certifica exactitud agronómica |
| A08 | Resultados físicamente inconsistentes se reportan como error/inconsistencia | No normalizar ni recortar valores; no presentar la simulación como resultado físicamente válido |
| A09 | Precisión interna completa; redondeo solo de presentación | Sin redondeos intermedios ni persistencia de valores exclusivamente formateados |
| A10 | Guardar versión del modelo y datos necesarios para reproducir resultados | Conservar inputs efectivos, unidades, supuestos y parámetros/versiones que intervienen; diseño de tabla y política de snapshots pendientes |

Los inventarios, fórmulas y golden de reproducción mantienen evidencia de funciones excluidas. Su presencia documental no las reincorpora al contrato del MVP.

Clasificación de evidencia:

- **DEMOSTRADO**: fórmula, valor o texto presente en la fuente.
- **REPRODUCCIÓN LITERAL**: resultado aritmético de esa fórmula, sin corregir su significado.
- **PROPUESTA R1**: convención o validación futura; no existe como regla ejecutable del Excel.
- **APROBADO R1**: decisión de alcance o comportamiento del usuario, registrada en A01:A10; no equivale a validación de campo de las fórmulas.
- **PENDIENTE DE VALIDACIÓN**: interpretación, calibración o decisión que la planilla no demuestra de forma suficiente.

Las 19 fórmulas se recalcularon aritméticamente de manera independiente y se contrastaron con sus valores guardados. Los escenarios adicionales son evaluaciones aritméticas de las fórmulas extraídas; no son capturas de recálculo de Excel ni ensayos de campo. La planilla original no se modificó. No se consultaron fuentes agronómicas externas: los títulos «tablas estándar» y «estándar regional» no aportan una referencia verificable.

R0 es contexto aportado y certificado en la fase anterior: `defaultdb` vacía, MySQL 8.4.11, TLS 1.3. En R1 no se abrió ninguna conexión a DB. Manning y su persistencia histórica se preservan.

## 1. Inventario de hojas

| Hoja | Propósito | Entradas | Resultados | Tablas auxiliares | Notas |
| --- | --- | --- | --- | --- | --- |
| Hoja 1 | Simulador de riego por surcos; rango declarado A1:H35 | B3:B8, B10, B12, B17:B23, B26, B30 | B9, B11, B14:B16, C14:C16, E14:E18, B24:B25, B27:B28, B31:B32 | Tabla1, A2:F30, sin encabezado formal y con fila de totales; no es un catálogo relacional | 19 fórmulas. Gráfico «Balance de agua» situado a la derecha: categorías D14:D16, valores E14:E16. No agrega cálculos. Rótulos de posiciones incompatibles con B7=60 m. |
| Hoja 2 | Referencias e interpretación; rango B2:J26 | No tiene entradas de simulación enlazadas | Ningún resultado calculado | Texturas B6:E11; avance G8:I11; pendiente/caudal B18:D23; catálogo puntual G22:J25 | Todo es texto o valores fijos, sin fórmulas ni enlace a Hoja 1. Dos tablas de suelo discrepan. |
| Hoja 3 | Guía docente; contenido A1:A4 | Ninguna | Ninguno | Ninguna | Preguntas sobre pendiente 1,5 %, suelo arenoso, avance lento y déficit al fondo. No define reglas nuevas ni soluciones cuantitativas. Fuera del MVP. |

## 2. Inventario de inputs

Los rangos siguientes son **PROPUESTA R1** salvo indicación contraria: el Excel no impone rangos. Todos los números deben ser finitos y verdaderos números; no convertir silenciosamente texto, booleanos o ausencia a cero. «Obligatorio» significa necesario para los resultados indicados, no una restricción existente en Excel.

| Entrada | Nombre técnico sugerido | Unidad fuente → canónica | Tipo | Requisito | Rango/validación propuesta | Origen | Ejemplo fuente → canónico |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ETo | crop.etoMmPerDay | mm/día → mm/día | número | Obligatorio para demanda | ≥0; límite superior agronómico pendiente | Hoja 1!B3 | 5 → 5 |
| Kc | crop.cropCoefficient | adimensional | número | Obligatorio para demanda | ≥0; no limitar automáticamente a 1; catálogo por cultivo/etapa ausente | B4 | 0,7 → 0,7 |
| Días acumulados sin regar | crop.daysWithoutIrrigation | días | número | Obligatorio para demanda | ≥0; decidir si admite fracciones | B5 | 20 → 20 |
| Ancho del surco | furrow.widthM | m | número | Obligatorio para volúmenes de lámina | >0; confirmar si representa ancho mojado o separación | B6 | 1,3 → 1,3 |
| Largo del surco | furrow.lengthM | m | número | Obligatorio para volúmenes de lámina | >0 | B7 | 60 → 60 |
| Pendiente | furrow.slopePct | fracción con formato % → % | número | Obligatorio para Qmax | ≥0; cero tiene rama especial no calibrada | B8 | 0 → 0; para 1 % Excel guarda 0,01 y API propone 1 |
| Tiempo de avance Ta | irrigation.advanceTimeMin | min | número | Obligatorio para avance e infiltración | 0≤Ta≤60·T; igualdad permite infiltración final cero | B10 | 4,8 → 4,8 |
| Escurrimiento / cola | irrigation.runoffL (solo inventario Excel) | L | número | Fuera del MVP, A03 | Sin consumidor en Excel; no definir validación de API del MVP | B12 | 0 → 0 |
| Caudal por surco | irrigation.flowLps | L/s | número | Obligatorio para aplicación y eficiencia | >0; exceso sobre Qmax es diagnóstico, no rechazo automático | B17 | 0,9 → 0,9 |
| Tiempo total de riego | irrigation.durationMin | h → min | número | Obligatorio para aplicación, avance e infiltración | >0 | B18 | 1 → 60 |
| Textura | soil.texture | texto | cadena/catálogo | Opcional para aritmética; requerido para identificar perfil | Resolver etiquetas/alias; no autocompleta CC/PMP, A02 | B19 | Franco |
| Capacidad de campo | soil.fieldCapacityPct | % numérico → % | número | Obligatorio para agua útil | 0≤PMP<CC≤100; base gravimétrica pendiente | B20 | 20 → 20 (no 0,20) |
| Punto de marchitez | soil.wiltingPointPct | % numérico → % | número | Obligatorio para agua útil | 0≤PMP<CC≤100 | B21 | 10 → 10 |
| Densidad aparente | soil.bulkDensityGcm3 | g/cm³ | número | Obligatorio para agua útil | >0; rango agronómico pendiente | B22 | 1,3 → 1,3 |
| Profundidad radicular | soil.rootDepthM | m | número | Obligatorio para agua útil | >0; rango por cultivo pendiente | B23 | 0,7 → 0,7 |
| Umbral de agotamiento f | soil.depletionThresholdPct | fracción → % | número | Obligatorio para máximo recomendado | 0<f≤100 canónico; fuente 0<f≤1; extremo cero pendiente | B26 | 0,6 → 60 |
| Cantidad de surcos por hectárea | furrow.declaredFurrowsPerHa (solo inventario Excel) | cantidad | Texto en Excel; entero en fixture literal | Fuera del MVP, A04 | Cobertura pendiente; no derivado en Excel ni input del motor MVP | B30 | Texto "18" → entero 18 mediante adaptación explícita del fixture |

Todas las referencias sin hoja en este documento pertenecen a Hoja 1. De las 17 entradas, 15 son celdas numéricas y dos son texto: textura B19 y cantidad B30. Excel convierte el texto "18" a número al multiplicar en B31. La reproducción aritmética hace esa conversión explícitamente; el contrato futuro requiere un entero numérico, sin coerción silenciosa de entradas de API. ETo, Kc y días constantes suponen una demanda uniforme durante todo el período. No hay inputs de lluvia efectiva, humedad inicial, riego previo, fecha, cultivo, etapa fenológica, área real de parcela, recesión, caudal variable o número de surcos regados simultáneamente. No inventar esos datos para explicar la demanda.

## 3. Inventario de outputs

«Recalcular» es la clasificación por defecto. A10 exige guardar versión del modelo y datos necesarios para reproducir simulaciones. Se propone además un snapshot de resultados seleccionados, sin aceptar resultados calculados por un cliente como autoridad; su política y el diseño de persistencia quedan para una fase posterior. Este inventario incluye resultados históricos del Excel excluidos del producto.

| Resultado | Nombre técnico sugerido | Unidad canónica | Origen/fórmula | Dependencias primarias | Persistencia sugerida | Ejemplo literal |
| --- | --- | --- | --- | --- | --- | --- |
| Caudal máximo no erosivo | diagnostics.maxNonErosiveFlowLps | L/s | B9; F01 | pendiente | Recalcular; snapshot diagnóstico | 6,3 |
| Criterio de avance | diagnostics.advanceRatioPct | % | B11; F02 | Ta, T | Recalcular | 8 |
| Meta de riego, repetida por tramo | waterNeed.targetDepthMm | mm | B14:B16; F03 | ETo, Kc, días | Recalcular; snapshot | 70 |
| Infiltración estimada cabecera | application.infiltratedDepthStartMm | mm | C14; F04 | T, coeficiente fijo | Recalcular; snapshot condicionado | 34,856850116 |
| Infiltración estimada media | application.infiltratedDepthMiddleMm | mm | C15; F05 | T, Ta, coeficiente fijo | Recalcular; snapshot condicionado | 34,152598730 |
| Infiltración estimada final | application.infiltratedDepthEndMm | mm | C16; F06 | T, Ta, coeficiente fijo | Recalcular; snapshot condicionado | 33,433516118 |
| Volumen aplicado por surco | application.appliedVolumeL | L | E14; F07 | Q, T | Recalcular; snapshot | 3240 |
| Litros aprovechados, según Excel | application.estimatedUsefulVolumeL | L | E15; F08 | T, Ta, ancho, largo | Recalcular; significado pendiente | 2663,902700926 |
| Litros perdidos, residual | application.residualLossVolumeL | L | E16; F09 | Q, T, Ta, ancho, largo | Recalcular; significado pendiente | 576,097299074 |
| Eficiencia de aplicación estimada | efficiency.applicationEfficiencyPct | % | E17; F10 | volumen aplicado/aprovechado | Recalcular; snapshot condicionado | 82,219219164 |
| «Dias Adicionales», eliminado del producto | Sin campo de producto; E18 solo auditoría | h | E18; F11 | Q, T | No persistir, A05 | 1 h, no 1 día |
| Agua útil del suelo AU | soilWater.availableWaterMm | mm | B24; F12 | CC, PMP, Da, Pr | Recalcular; snapshot | 91 |
| Capacidad máxima del surco | soilWater.availableCapacityL | L | B25; F13 | CC, PMP, Da, Pr, ancho, largo | Recalcular | 7098 |
| Lámina máxima de riego | soilWater.maxRecommendedDepthMm | mm | B27; F14 | CC, PMP, Da, Pr, f | Recalcular; snapshot | 54,6 |
| Volumen máximo recomendado | soilWater.maxRecommendedVolumeL | L | B28; F15 | anteriores, ancho, largo | Recalcular | 4258,8 |
| Volumen total «por hectárea», fuera del MVP | application.declaredVolumeLPerHa (solo inventario Excel) | L/ha | B31; F16 | Q, T, cantidad declarada | No persistir en MVP, A04 | 58320 |
| Volumen total «por hectárea», m³, fuera del MVP | application.declaredVolumeM3PerHa (solo inventario Excel) | m³/ha | B32; F17 | anteriores | No persistir en MVP, A04 | 58,32 |

No hay salidas calculadas de déficit, exceso, uniformidad, riesgo de erosión, tiempo óptimo, días adicionales reales ni diagnóstico textual. El gráfico representa E14:E16, incluidos los problemas del volumen residual. La palabra «Real» en C13 es un rótulo: C14:C16 son estimaciones calculadas, no mediciones.

## 4. Fórmulas explícitas

Notación de reproducción literal: E=ETo (mm/día), K=Kc (1), D=días, W=ancho (m), L=largo (m), s=pendiente como fracción guardada en Excel, a=Ta (min), T=tiempo total (h), Q=caudal (L/s), CC/PMP=números porcentuales, Da=densidad (g/cm³), Pr=profundidad (m), f=fracción de agotamiento, N=cantidad declarada de surcos. `I(s=0)` vale 1 si la condición es verdadera y 0 si es falsa. Los nombres del motor usarían las unidades canónicas de §9.

### F01. Caudal máximo no erosivo

Nombre: Caudal máximo no erosivo, B9.
Variables: s, I(s=0).
Unidades: s adimensional; resultado L/s; constantes con unidades implícitas.
Fórmula: Excel `=0.0063/(B8+(B8=0)) + 6.2937*(B8=0)`; Qmax=0,0063/[s+I(s=0)]+6,2937·I(s=0). Para s>0: Qmax=0,0063/s. Para s=0: Qmax=6,3.
Ejemplo: s=0.
Resultado: 6,300000000000001 L/s (6,3 matemático).
Validaciones: s finita y ≥0; no evaluar con s=-1, que vuelve cero el denominador sin activar la rama especial.
Observaciones: fórmula DEMOSTRADA; coeficientes, rama cero y alcance por textura PENDIENTE DE VALIDACIÓN. En % canónico positivo: Qmax=0,63/slopePct, conversión algebraica, no fórmula nueva. La tabla no respalda la singularidad cuando s tiende a cero.

### F02. Criterio de avance

Nombre: Criterio de avance, B11.
Variables: a, T.
Unidades: min, h; resultado fracción, visualizado como %.
Fórmula: Excel `=(B10 / 60) / B18`; r=a/(60·T); porcentaje=100·r.
Ejemplo: a=4,8; T=1.
Resultado: r=0,08; 8 %.
Validaciones: T>0; a≥0; propuesta a≤60·T para dominio completo.
Observaciones: con duración canónica en min, porcentaje=100·advanceTimeMin/durationMin. Excel presenta cero decimales de porcentaje. No contiene un IF de diagnóstico.

### F03. Meta de riego

Nombre: Meta de riego, B14, B15 y B16.
Variables: E, K, D.
Unidades: mm/día, adimensional, días; salida mm.
Fórmula: Excel `=$B$3*$B$4*$B$5` en las tres celdas; M=E·K·D.
Ejemplo: 5·0,7·20.
Resultado: 70 mm en cada tramo.
Validaciones: E,K,D finitos y ≥0, sin máximos demostrados.
Observaciones: la fórmula no resta lluvia ni usa humedad inicial; su identificación como déficit real es PENDIENTE DE VALIDACIÓN. No son tres demandas diferentes.

### F04. Infiltración de cabecera

Nombre: Agua infiltrada en cabecera, C14.
Variables: T, k=4,5, exponente b=0,5 fijos.
Unidades: tiempo de oportunidad en min; k debe tener mm/min^0,5 para salida mm.
Fórmula: Excel `=4.5 * ((B18 * 60) ^ 0.5)`; Z0=4,5·√(60·T).
Ejemplo: 4,5·√60.
Resultado: 34,856850115866756 mm.
Validaciones: radicando ≥0; duración >0 en motor propuesto.
Observaciones: forma empírica DEMOSTRADA; no hay nombre de método ni calibración del coeficiente. Aplicabilidad agronómica PENDIENTE DE VALIDACIÓN. No depende de suelo, pendiente ni caudal.

### F05. Infiltración media

Nombre: Agua infiltrada en tramo medio, C15.
Variables: T, a, k=4,5.
Unidades: h convertidas a min; a en min; salida mm.
Fórmula: Excel `=4.5 * (((B18 * 60) - (B10 / 2)) ^ 0.5)`; Zm=4,5·√(60·T−a/2).
Ejemplo: 4,5·√(60−2,4).
Resultado: 34,152598729818493 mm.
Validaciones: 60·T−a/2≥0; validar también dominio de F06.
Observaciones: supone tiempo de llegada medio a/2. No demuestra avance lineal en distancia ni mide llegada a 50 m; B7 no participa. Modelo espacial PENDIENTE DE VALIDACIÓN.

### F06. Infiltración final

Nombre: Agua infiltrada en final, C16.
Variables: T, a, k=4,5.
Unidades: tiempo en min; salida mm.
Fórmula: Excel `=4.5 * (((B18 * 60) - B10) ^ 0.5)`; Ze=4,5·√(60·T−a).
Ejemplo: 4,5·√(60−4,8).
Resultado: 33,433516117812076 mm.
Validaciones: a≤60·T; igualdad da 0; superar ese tiempo produce raíz de negativo.
Observaciones: no usa posición ni recesión; el rótulo «100m» es fijo. Agronomía y tratamiento de corte antes de llegada PENDIENTE DE VALIDACIÓN; no sustituir una raíz inválida por cero.

### F07. Volumen aplicado por surco

Nombre: Volumen aplicado, E14.
Variables: Q, T.
Unidades: L/s, h; 3600 s/h; salida L.
Fórmula: Excel `=B17 * B18 * 3600`; Va=Q·T·3600.
Ejemplo: 0,9·1·3600.
Resultado: 3240 L.
Validaciones: Q>0; T>0 para el conjunto completo de fórmulas.
Observaciones: caudal constante por surco durante todo el riego. No incorpora simultaneidad, reducción de caudal ni medición de cola. Canónico: Va=flowLps·durationMin·60.

### F08. Litros aprovechados estimados

Nombre: Litros aprovechados, E15.
Variables: Zm, W, L.
Unidades: mm·m²=L.
Fórmula: Excel `=C15 * B6 * B7`; Vu=Zm·W·L.
Ejemplo: 34,152598729818493·1,3·60.
Resultado: 2663,9027009258425 L.
Validaciones: W,L>0; F05 válida; comprobar Vu≤Va como control físico propuesto.
Observaciones: utiliza solo la lámina del punto medio como representativa de todo el surco. No integra Z0/Ze, no limita al agua disponible ni a demanda/almacenamiento. Identificación como agua aprovechada PENDIENTE DE VALIDACIÓN.

### F09. Litros perdidos residuales

Nombre: Litros perdidos, E16.
Variables: Va, Vu.
Unidades: L.
Fórmula: Excel `=E14 - E15`; Vp=Va−Vu.
Ejemplo: 3240−2663,9027009258425.
Resultado: 576,09729907415749 L.
Validaciones: Va,Vu válidos; Vp<0 indica inconsistencia, no una pérdida negativa aceptable.
Observaciones: B12 no interviene. No separa escurrimiento, evaporación o percolación profunda. No aplicar clamp ni atribuir el residual a una causa no demostrada.

### F10. Eficiencia de aplicación literal

Nombre: Eficiencia de aplicación, E17.
Variables: Vu, Va.
Unidades: fracción; salida canónica %.
Fórmula: Excel `=E15 / E14`; η=Vu/Va; ηPct=100·η.
Ejemplo: 2663,9027009258425/3240.
Resultado: 0,82219219164377855; 82,219219164377855 %.
Validaciones: Va>0; η fuera de [0,1] debe exponerse como inconsistencia.
Observaciones: Excel muestra 82 % por formato, sin redondear la fórmula. No hay bandas buena/mala. Eficiencia agronómica validada PENDIENTE DE VALIDACIÓN.

### F11. «Dias Adicionales»

Nombre: Resultado con rótulo «Dias Adicionales», E18.
Variables: Va, Q.
Unidades: L/(L/s·s/h)=h.
Fórmula: Excel `=E14 / (B17 * 3600)`; H=Va/(Q·3600)=T para Q≠0.
Ejemplo: 3240/(0,9·3600).
Resultado: 1 h, no días adicionales.
Validaciones: Q≠0; no habilitar planificación de días con este resultado.
Observaciones: identidad redundante DEMOSTRADA; A05 elimina «días adicionales» del producto. Esta fórmula se conserva solo para auditoría del Excel y no define una salida del motor. Una función futura de autonomía requeriría una especificación nueva validada.

### F12. Agua útil del suelo

Nombre: Agua útil AU, B24.
Variables: CC, PMP, Da, Pr.
Unidades: porcentajes divididos por 100, densidad g/cm³, profundidad m; conversión 1000 mm/m.
Fórmula: Excel `=((B20 - B21) / 100) * B22 * B23 * 1000`; AU=((CC−PMP)/100)·Da·Pr·1000.
Ejemplo: ((20−10)/100)·1,3·0,7·1000.
Resultado: 91 mm.
Validaciones: 0≤PMP<CC≤100; Da,Pr>0.
Observaciones: dimensionalmente requiere CC/PMP gravimétricos y la razón Da/densidad del agua (implícita 1 g/cm³). Si CC/PMP son volumétricos, multiplicar por Da sería incorrecto. La base de las tablas no está declarada: PENDIENTE DE VALIDACIÓN. No se mide humedad actual.

### F13. Capacidad máxima del surco

Nombre: Capacidad máxima surco, B25.
Variables: AU, W, L.
Unidades: mm·m²=L.
Fórmula: Excel `=B24 * B6 * B7`; C=AU·W·L.
Ejemplo: 91·1,3·60.
Resultado: 7098 L.
Validaciones: AU válido, W,L>0.
Observaciones: almacén de agua útil del área atribuida al surco, no capacidad hidráulica de una sección de canal. El significado de W condiciona el área.

### F14. Lámina máxima de riego

Nombre: Lámina máxima, B27.
Variables: AU, f.
Unidades: mm, fracción; salida mm.
Fórmula: Excel `=B24 * B26`; Mmax=AU·f.
Ejemplo: 91·0,6.
Resultado: 54,6 mm.
Validaciones: AU válido; propuesta 0<f≤1.
Observaciones: canónico Mmax=AU·depletionThresholdPct/100. Como dosis máxima efectiva necesita validación del estado hídrico inicial; no confundir con lámina bruta aplicada.

### F15. Volumen máximo recomendado

Nombre: Volumen máximo recomendado, B28.
Variables: Mmax, W, L.
Unidades: mm·m²=L.
Fórmula: Excel `=B27 * B6 * B7`; Vmax=Mmax·W·L.
Ejemplo: 54,6·1,3·60.
Resultado: 4258,8 L.
Validaciones: F14 válida, W,L>0.
Observaciones: no divide por eficiencia. No usar como caudal o volumen bruto de diseño sin aclarar lámina neta/bruta.

### F16. Volumen total declarado por hectárea

Nombre: Volumen total a aplicar, B31.
Variables: Va, N.
Unidades: L/surco·surcos/ha=L/ha solo si N realmente representa una hectárea.
Fórmula: Excel `=E14*B30`; Vha=Va·N.
Ejemplo: 3240·18.
Resultado: 58320 L/ha según rótulo.
Validaciones: N>0 entero propuesto; cobertura pendiente.
Observaciones: no usa W/L para determinar N. Aritmética DEMOSTRADA; interpretación por hectárea PENDIENTE DE VALIDACIÓN.

### F17. Conversión de volumen total a m³

Nombre: Volumen total en metros cúbicos, B32.
Variables: Vha.
Unidades: 1000 L/m³; resultado m³/ha condicionado a F16.
Fórmula: Excel `=B31/1000`; VhaM3=Vha/1000.
Ejemplo: 58320/1000.
Resultado: 58,32 m³/ha según rótulo.
Validaciones: F16 válido.
Observaciones: conversión exacta; no resuelve la cobertura de hectárea.

### Fórmulas ausentes

PENDIENTE DE VALIDACIÓN: dependencia de infiltración con textura/caudal/pendiente, integral espacial de infiltración, humedad inicial, déficit neto real, lluvia efectiva, agua realmente retenida en raíces, separación de pérdidas, días de autonomía, tiempo de riego recomendado, coeficientes específicos de suelo y recesión. No se proporciona una ecuación de producto para estas magnitudes porque no está demostrada en la fuente.

## 5. Reglas de diagnóstico

No hay reglas ejecutables de diagnóstico en Excel. La primera tabla transcribe reglas textuales de Hoja 2; la segunda propone controles e interpretaciones transparentes. Mensajes propuestos para el producto, salvo los nombres de categorías de la fuente. Una regla pendiente no debe presentarse como criterio agronómico certificado.

### 5.1. Reglas textuales extraídas

| ID / origen | Condición de la fuente | Diagnóstico | Mensaje propuesto / estado |
| --- | --- | --- | --- |
| D01 / Hoja 2!G9:I9 | «Menor o igual al 25 % - 30 %» | Óptimo / Parejo | «El avance ocupa una fracción pequeña del tiempo de riego». Umbral exacto 25 o 30 % PENDIENTE DE VALIDACIÓN. r≤25 % queda dentro de ambas interpretaciones; 25<r≤30 % es ambiguo. No certificar uniformidad medida. |
| D02 / G10:I10 | «Mayor al 30 % - 50 %» | Aceptable / Regular | «La llegada al final demora y aumenta la diferencia de tiempo de infiltración». Interpretación candidata 30<r≤50 %; inclusividad de 50 % pendiente. |
| D03 / G11:I11 | «Mayor al 50 %» | Crítico / Muy Desuniforme | «El avance consume más de la mitad del tiempo total de riego». Condición >50 % explícita; referencia textual a 100 m no generalizable sin revisión. |
| D04 / B19:D19 | Pendiente 0,10–0,15 % | Riesgo de encharcamiento en pendientes bajas | «La tabla aconseja control visual por posible encharcamiento». No convierte toda pendiente baja o cero en un diagnóstico automático. |
| D05 / B20:D20 | Pendiente 0,30 % | Referencia regional descriptiva | «Valor frecuente en zonas medias de los oasis mendocinos», texto sin regla de acción demostrada. |
| D06 / B21:D21 | Pendiente 0,50 % | Referencia descriptiva de piedemonte/transición | No implica por sí sola erosión. |
| D07 / B22:D22 | Pendiente 1,00 % | Pendiente alta; fraccionar caudal | «La tabla indica fraccionar estrictamente el caudal para preservar el surco». Alcance/certificación pendiente. |
| D08 / B23:D23 | Pendiente 2,00 % | Pendiente extrema | «La tabla sugiere evaluar riego presurizado o microsurcos». Recomendación textual para revisión, no decisión automática del MVP. |

No se interpolan bandas de pendiente, no se extienden estas filas a intervalos no definidos ni se agregan umbrales de eficiencia.

### 5.2. Controles e interpretaciones propuestos en R1

| ID | Condición → diagnóstico → mensaje | Evidencia / límite |
| --- | --- | --- |
| P01 | Q>Qmax → exceso respecto del límite calculado → «El caudal supera el máximo no erosivo estimado por la fórmula de la planilla». | Comparación propuesta de B17/B9; no IF existente; no demuestra erosión efectiva. Q=Qmax no es exceso. |
| P02 | Ze<M → déficit frente a meta en final → «La lámina estimada al final es menor que la meta acumulada». | Comparación propuesta C16/B16; no demuestra déficit hídrico real. Igualdad satisface la meta aritmética. |
| P03 | Z0,Zm o Ze>M → exceso frente a meta en ese punto → «La estimación supera la meta en el punto indicado». | No equivale automáticamente a pérdida profunda; no usar Va/área como infiltración. |
| P04 | M>Mmax → demanda supera umbral calculado → «La meta acumulada supera la lámina máxima calculada con el umbral de agotamiento». | Comparación propuesta B14/B27; requiere validar estado inicial y significado de f. |
| P05 | Zi>Mmax → infiltración estimada supera umbral en un punto → «La lámina estimada supera el umbral de almacenamiento seleccionado». | No demuestra percolación profunda; no confundir AU con AU·f. |
| P06 | Vu>Va o Vp<0 o η>100 % → error/inconsistencia de balance → «La estimación de aprovechamiento supera el agua aplicada; revisar el modelo». | Reporte sin normalización ni recorte aprobado por A08; no presentar como simulación físicamente válida. |
| P07 | a>duración total → dominio inválido → «El tiempo de avance supera el tiempo de riego; la fórmula final no admite estos datos». | F06 exige radicando ≥0. Propuesta de rechazo previo, sin output de simulación exitoso. |
| P08 | Tipo no numérico, no finito, denominador cero, CC≤PMP, dimensiones/densidad no positivas → input inválido → mensaje con campo y restricción. | Validaciones R1, ausentes en Excel. No devolver NaN/Infinity ni cero de reemplazo. |
| P09 | Etiquetas 0/50/100 incompatibles con largo → inconsistencia espacial → «Las posiciones de la planilla no corresponden al largo declarado». | En caso actual, final 100>60; punto medio de 60 sería 30, no 50. |
| P10 | N·W·L≠10000 m², si W es separación → cobertura por hectárea pendiente → «La cantidad declarada no representa una hectárea con esta geometría». | Control geométrico condicionado, no regla ejecutable ni sustitución automática de N. |
| P11 | Cola informada pero no usada → dato sin efecto → «El escurrimiento ingresado no interviene en las fórmulas extraídas». | Solo auditoría del Excel; fuera del motor MVP, A03. B12 no es precedente de ninguna fórmula. |

Propuesta de diagnóstico estructurado: identificador estable, severidad, condición, campos afectados, mensaje y estado de evidencia. No deducir «todo correcto» de ausencia de alertas. Separar errores de entrada, inconsistencias del modelo e interpretaciones agronómicas pendientes.

## 6. Tablas de referencia

Tipos: A=datos fijos en la fuente; B=rangos; C=entradas editables; D=pendientes de validación. Las categorías no son excluyentes: un rango fijo puede ser B+D. Ninguna tabla alimenta automáticamente Hoja 1.

### 6.1. Rangos por textura — Hoja 2!B6:E11 (B+D)

| Textura | CC (%) | PMP (%) | Agua útil/disponible (%) indicada |
| --- | --- | --- | --- |
| Arenoso | 10–15 | 4–6 | ~6–9 |
| Franco-Arenoso | 15–20 | 6–10 | ~9–11 |
| Franco (Equilibrado) | 20–28 | 10–14 | ~10–14 |
| Franco-Arcilloso | 27–35 | 13–19 | ~14–16 |
| Arcilloso | 35–45 | 20–25 | ~15–20 |

No calcular automáticamente CC/PMP como promedio de estos intervalos. Los rangos de agua útil no son el intervalo completo de restar dos valores independientes: por ejemplo Franco permitiría CC−PMP de 6 a 18, pero se imprime ~10–14. Se desconoce cómo se emparejan los extremos. Base gravimétrica/volumétrica, procedencia y representatividad regional pendientes.

### 6.2. Valores puntuales — Hoja 2!G22:J25 (A+D)

| Textura | CC (%) | PMP (%) | Agua disponible (%) |
| --- | --- | --- | --- |
| Arcilloso | 30 | 15 | 15 |
| Franco | 20 | 10 | 10 |
| Arenoso | 10 | 5 | 5 |

Son constantes escritas, no fórmulas, aunque agua disponible coincide con CC−PMP. Arcilloso 30/15 queda fuera de los intervalos 35–45/20–25 de la otra tabla; Arenoso disponible 5 queda fuera de ~6–9. No elegir una tabla como autoridad sin validación. «Franco» y «Franco (Equilibrado)» requieren un alias explícito si se adopta un catálogo.

### 6.3. Pendiente/caudal — Hoja 2!B18:D23 (A/B+D)

| Pendiente (%) | Qmax textual (L/s) | Resultado F01 con porcentaje correctamente convertido |
| --- | --- | --- |
| 0,10–0,15 | 4,20–5,00 | 6,30 a 0,10 %; 4,20 a 0,15 %. No reproduce todo el intervalo textual. |
| 0,30 | 2,10 | 2,10 |
| 0,50 | 1,26 | 1,26 |
| 1,00 | 0,63 | 0,63 |
| 2,00 | 0,31 | 0,315; no hay fórmula de redondeo que produzca 0,31 |

Texto de alcance: «texturas francas», «estándar regional». No hay cita, lookup, interpolación ni fórmula por textura. La rama pendiente cero de F01 no está en esta tabla.

### 6.4. Rangos de avance — Hoja 2!G8:I11 (B+D)

Tres filas: ≤25–30 % (Óptimo/Parejo), >30–50 % (Aceptable/Regular), >50 % (Crítico/Muy Desuniforme). Su literalidad y ambigüedades se conservan en D01:D03. No hay un catálogo numérico inequívoco listo para implementar.

### 6.5. Constantes y valores editables

| Datos | Clasificación | Uso / estado |
| --- | --- | --- |
| k=4,5; exponente=0,5; llegada media=a/2 | A+D | F04:F06; sin calibración por suelo |
| 0,0063; 6,2937; rama cero 6,3 | A+D | F01; unidades implícitas y validez pendientes |
| 60 min/h; 3600 s/h; 1000 L/m³; 1000 mm/m; 100 % por unidad | A | Conversiones exactas |
| 0m, 50m, 100m | A+D | Rótulos fijos, no entradas de posición |
| N=18 | C+D | Entrada independiente; no cantidad calculada por hectárea |
| CC=20; PMP=10; Da=1,3; Pr=0,7; f=0,6 | C | Valores de ejemplo de Hoja 1; no valores universales |

## 7. Inconsistencias y decisiones pendientes

| ID | Evidencia | Consecuencia | Tratamiento R1 |
| --- | --- | --- | --- |
| I01 | B7=60 m frente a A14=0m, A15=50m, A16=100m | El final rotulado queda fuera del surco y 50 m no es su mitad | Preservar reproducción; propuesta usar inicio/medio/final y posiciones 0/L/2/L, PENDIENTE DE VALIDACIÓN |
| I02 | C15 usa a/2; C16 usa a; ninguna usa longitud ni posiciones | La curva temporal presupone llegada media, no deriva avance espacial | No afirmar simulación hidráulica longitudinal; validar aproximación |
| I03 | B30=18 manual; W·L=78 m²; 18·78=1404 m² | Cobertura de 14,04 % de ha si W representa separación | N geométrico continuo sería 10000/78=128,205128… unidades de esa área. No es una fórmula de Excel ni una corrección autorizada; parcelas y redondeo pendientes |
| I04 | B31=Va·18; B32=B31/1000 | 58,32 m³ es total de 18 surcos; etiqueta /ha no demostrada | Separar total declarado de verdadero volumen normalizado. Condicional a cobertura completa: Va·10000/(W·L)=415384,615385 L/ha, 415,384615 m³/ha; solo comparación dimensional, no output aprobado |
| I05 | k=4,5, b=0,5 fijos; B19 no es precedente | Cambiar solo textura no cambia infiltración ni eficiencia | No inventar coeficientes arenoso/arcilloso; validarlos antes de R2 |
| I06 | F08 usa lámina media, sin integrar ni limitar por Va | Puede producir Vu>Va, pérdidas negativas y η>100 % | Caso G12 lo demuestra; exponer inconsistencia sin recortar valores |
| I07 | B12 no se usa | El escurrimiento informado no cambia pérdidas/eficiencia | Exclusión del MVP aprobada, A03; un balance futuro requiere validación |
| I08 | B8 tiene formato 0,00 %, valor Excel fraccional | Ingresar 0,30 como número bruto representa 30 %, no 0,30 %; F01 daría 0,021 en lugar de 2,1 L/s | Convención canónica slopePct=0,30; adaptar a s=0,003 |
| I09 | F01 tiene rama s=0 y 0,0063/s para s>0 | Qmax=6,3 en cero pero diverge cerca de cero; tabla de 0,10–0,15 % discrepa en extremo bajo | No añadir límite/cap/interpolación; calibración pendiente |
| I10 | Tabla arcillosa 30/15 vs rango 35–45/20–25; agua arenosa 5 vs ~6–9 | Catálogo contradictorio | Registrar ambas fuentes; no autoseleccionar ni promediar |
| I11 | F12 multiplica por Da sin declarar base de CC/PMP | Posible mezcla gravimétrica/volumétrica | Confirmar base antes de certificar AU como modelo agronómico |
| I12 | E18 rotulado días pero algebraicamente igual a horas de riego | No calcula días adicionales | Excluir del producto; mantener trazabilidad documental |
| I13 | M=70 mm y Mmax=54,6 mm en escenario actual | Meta acumulada supera umbral calculado; comparación no ejecutada en Excel | Exponer diagnóstico propuesto sin modificar meta ni umbral |
| I14 | A6 dice ancho, no separación | Área de suelo y cobertura por ha dependen del significado | Confirmar W antes de renombrar campo o normalizar superficie |
| I15 | C13 dice infiltración «Real» | Sugiere una medición que no existe | En motor propuesto usar «estimada» |
| I16 | No ROUND en las 19 fórmulas; C14:C16 muestran 1 decimal; E15:E16 2; B11/E17 % entero; E18 entero | Valores visuales no son valores usados por dependencias | Conservar precisión completa; presentación aparte. 34,2×78=2667,6 no reproduce 2663,902700926 |
| I17 | Hoja 2!I9 e I11 mencionan 100 m; Hoja 1!A16=100m | Referencias fijas al ejemplo espacial | Sustituir mensajes solo después de aprobar generalización. Ninguna fórmula contiene constante de distancia 100 m; los divisores 100 de F12 son porcentajes |
| I18 | ETo/Kc/días sin lluvia ni humedad inicial | Meta no es balance hídrico completo | Declarar supuesto; no presentarla como déficit medido |
| I19 | Ni validaciones de datos ni reglas condicionales; textos no conectados | Inputs inválidos generan errores o resultados engañosos | Validaciones propuestas necesitan aprobación explícita de semántica |
| I20 | La copia de OneDrive tiene otros días y duración | Dos escenarios distintos | Resuelto por A01: fuente oficial de §0; caso base 20 días/1 h |
| I21 | B30 contiene texto "18", también usado como etiqueta de totales de Tabla1 | B31 depende de coerción numérica de Excel, no de un input entero tipado | Adaptación explícita del fixture; rechazar cadenas en contrato canónico propuesto |

Los textos de Hoja 3 son didácticos: no explican cuantitativamente cómo cambiar suelo o caudal corrige un déficit. Manning no provee automáticamente estos vínculos y no se reutiliza su pendiente/fricción sin un contrato nuevo autorizado.

## 8. Casos golden

### 8.1. Alcance y fixture común

Estos casos fijan **reproducción literal**, no exactitud agronómica. Los diagnósticos son los de §5 y se identifican como textuales, propuestos o aprobados. Las variantes no añaden coeficientes ni cambian fórmulas. Un caso hereda todos los inputs y outputs de G01 salvo los cambios enumerados: esto define el vector completo sin repetirlo. Los valores decimales usan punto para poder reproducirse sin ambigüedad. Cola, N, totales por hectárea y E18 permanecen únicamente como evidencia de reproducción del Excel; se excluyen de fixtures/outputs del motor MVP por A03:A05. En G12 el comportamiento aprobado es reportar error/inconsistencia, sin recortar ni normalizar los valores literales.

Fixture G01 canónico:

| Grupo | Inputs |
| --- | --- |
| crop | etoMmPerDay=5; cropCoefficient=0.7; daysWithoutIrrigation=20 |
| soil | texture=Franco; fieldCapacityPct=20; wiltingPointPct=10; bulkDensityGcm3=1.3; rootDepthM=0.7; depletionThresholdPct=60 |
| furrow | widthM=1.3; lengthM=60; slopePct=0; declaredFurrowsPerHa=18 |
| irrigation | flowLps=0.9; durationMin=60; advanceTimeMin=4.8; runoffL=0 |

Outputs G01 completos, antes de formato visual:

| Resultado | Esperado |
| --- | --- |
| Qmax | 6.3 L/s |
| Criterio de avance | 8 % |
| Meta (los tres tramos) | 70 mm |
| Infiltración inicio/medio/final | 34.856850115867 / 34.152598729818 / 33.433516117812 mm |
| Volumen aplicado | 3240 L |
| Aprovechado estimado | 2663.902700925843 L |
| Pérdidas residuales | 576.097299074157 L |
| Eficiencia literal | 82.219219164378 % |
| Resultado E18 | 1 h |
| AU | 91 mm |
| Capacidad máxima | 7098 L |
| Lámina máxima | 54.6 mm |
| Volumen máximo | 4258.8 L |
| Total declarado | 58320 L / 58.32 m³; etiqueta por hectárea pendiente |

### 8.2. Matriz de escenarios

| Caso | Inputs respecto de G01 | Outputs esperados que cambian | Diagnóstico esperado |
| --- | --- | --- | --- |
| G01 Actual de la planilla | Sin cambios | Vector completo anterior | D01 Óptimo/Parejo bajo ambas lecturas 25/30; P02 déficit frente a meta en final; P04 meta>umbral. Sin P01. I01/I03/I09/I11/I12 y otras limitaciones siguen pendientes. |
| G02 Pendiente baja | slopePct=0.30; s Excel=0.003 | Qmax=2.1 L/s; todos los demás outputs iguales | Sin P01 (0.9<2.1); D05 referencia descriptiva. No activar alerta de encharcamiento D04, que corresponde a 0.10–0.15 %. D01/P02/P04 como G01. |
| G03 Pendiente alta | slopePct=1; s Excel=0.01 | Qmax=0.63 L/s; restantes iguales | P01 (0.9>0.63), D07 pendiente alta; D01/P02/P04. No cambia infiltración por pendiente. |
| G04 Suelo arenoso | texture=Arenoso; CC=10; PMP=5, catálogo puntual | AU=45.5 mm; capacidad=3549 L; lámina máxima=27.3 mm; volumen máximo=2129.4 L | D01/P02/P04; P05 en los tres puntos (todos >27.3). No certificar pérdidas profundas. Infiltración/eficiencia no cambian. |
| G05 Suelo franco | texture=Franco; CC=20; PMP=10 | Igual a G01 | Igual a G01; este caso confirma perfil franco explícito. |
| G06 Suelo arcilloso | texture=Arcilloso; CC=30; PMP=15, catálogo puntual | AU=136.5 mm; capacidad=10647 L; lámina máxima=81.9 mm; volumen máximo=6388.2 L | D01/P02; sin P04 ni P05; I10 catálogo arcilloso contradictorio. Infiltración/eficiencia no cambian. |
| G07 Caudal excesivo | flowLps=7 | Va=25200 L; Vu=2663.902700925843 L sin cambio; Vp=22536.097299074157 L; η=10.571042463991 %; total=453600 L /453.6 m³; E18=1 h | P01 (7>6.3); D01/P02/P04. No existe banda de «eficiencia baja» demostrada ni regla automática Va>Vmax para pérdida. |
| G08 Tiempo de avance crítico | advanceTimeMin=36 | avance=60 %; Z0=34.856850115867; Zm=29.163333142835; Ze=22.045407685049 mm; Vu=2274.739985141159 L; Vp=965.260014858841 L; η=70.208024232752 % | D03 Crítico/Muy Desuniforme; P02/P04; sin P01. |
| G09 Input inválido | advanceTimeMin=61, durationMin=60 | F06 radicando=-1: sin resultado real, Excel produciría #NUM! al recalcular; B11=101.666666666667 %. Motor propuesto rechaza el caso completo | P07: tiempo de avance supera tiempo total. No devolver simulación válida aunque E15/E17 todavía sean evaluables. |
| G10 Frontera 30 % | advanceTimeMin=18 | avance=30 %; Zm=32.136427928443; Ze=29.163333142835 mm; Vu=2506.641378418541 L; Vp=733.358621581459 L; η=77.365474642548 % | D01/D02 PENDIENTE DE VALIDACIÓN en frontera por redacción 25–30; P02/P04. No resolver silenciosamente. |
| G11 Frontera 50 % | advanceTimeMin=30 | avance=50 %; Zm=30.186917696247; Ze=24.647515087732 mm; Vu=2354.579580307279 L; Vp=885.420419692721 L; η=72.672209268743 % | D03 no aplica (>50). D02 si se confirma inclusión de 50; P02/P04. |
| G12 Balance físicamente imposible | flowLps=0.1 | Va=360 L; Vu=2663.902700925843 L sin cambio; Vp=-2303.902700925843 L; η=739.972972479401 %; total=6480 L /6.48 m³ | P06 balance inconsistente; D01/P02/P04. No recortar η a 100 ni pérdidas a cero. |

Diagnósticos transversales: P09 aplica a todos los casos válidos que heredan L=60; P10 es comprobación condicionada al significado de W; P11 advierte que runoffL no tiene efecto. Estos avisos no cambian outputs. No afirmar que suelo más arenoso altera infiltración con esta planilla: G04 demuestra que no existe ese vínculo.

### 8.3. Comparación y pruebas pendientes para R2

PROPUESTA R1: tolerancia numérica por resultado `max(1e-8, 1e-9·abs(esperado))`, en su unidad canónica; diagnósticos e identificadores se comparan exactamente. No redondear pasos intermedios. Unidades, condiciones pendientes y fuente/versionado deben compararse además de los números.

Cobertura futura adicional: duración=0, Q=0, valores vacíos/textuales/no finitos, CC=PMP y CC<PMP, densidad/profundidad/ancho/largo≤0, f fuera de rango, pendiente negativa, a=0, a=Tmin y a>Tmin, r=25 % y vecinos de 25/30/50 %, pendiente cercana a cero, Q=Qmax, cambios solo de textura y cola (sin efecto en reproducción), largo=100 m y variación de longitud sin cambio de láminas. No se creó una suite ni un motor en R1.

## 9. Unidades canónicas del backend propuesto

| Magnitud | Convención única | Conversiones explícitas |
| --- | --- | --- |
| Láminas y agua útil | mm | 1 m=1000 mm; 1 mm sobre 1 m²=1 L |
| Longitud, ancho, profundidad, posiciones | m | No mezclar cm en entradas |
| Pendiente, CC, PMP, agotamiento, avance, eficiencia | % numérico, 0–100 para proporciones acotadas | slopeFraction=slopePct/100; depletionFraction=depletionThresholdPct/100. En Excel solo pendiente está almacenada como porcentaje fraccional; CC/PMP son 20/10, f=0.6, avance/eficiencia son fracciones calculadas |
| Caudal por surco | L/s | Qm3s=Qlps/1000; Manning conserva su contrato previo, sin cambio |
| Tiempos de simulación | min | durationMin=durationHours·60; segundos=min·60; horas=min/60 |
| Horas | h, solo conversión/presentación | 1 h=60 min=3600 s; E18 reproduce horas |
| Volúmenes base | L | Vm3=VL/1000; VL=Vm3·1000 |
| Volúmenes de presentación | m³ | No usar como campo base duplicado si es solo conversión |
| Totales normalizados | L/ha, m³/ha | 1 ha=10000 m²; 1 mm/ha=10000 L/ha=10 m³/ha; requieren cobertura real |
| ETo | mm/día | Unidad compuesta necesaria; no es lámina acumulada |
| Período sin riego | días | No convertir E18 a días ni confundir período con duración del evento |
| Densidad aparente | g/cm³ | Excepción necesaria por definición de F12; 1 g/cm³=1000 kg/m³. Si se adopta kg/m³ después, adaptar explícitamente razón con densidad del agua |
| Kc, coeficiente empírico, cantidad | adimensional; k en mm/min^0.5 | Kc no es porcentaje; N es cantidad. f se recibe como porcentaje canónico y se convierte una vez |

No se puede describir todo el modelo exclusivamente con mm/m/%/L/s/min/h/L/m³: días, mm/día, g/cm³, área y cantidad también son necesarios. El contrato debe incluir esas excepciones, no borrar sus dimensiones. Representación numérica completa para cálculos; redondeo solo en visualización. Precisiones propuestas de presentación: mm y volúmenes 2 decimales, porcentajes 2, sin fijar precisión de almacenamiento DB en R1.

## 10. MVP

### MVP obligatorio propuesto, sujeto a resolver bloqueantes

- Motor puro separado del módulo Manning, con inputs explícitos y unidades canónicas.
- Demanda acumulada simplificada ETo·Kc·días y supuesto visible de ausencia de balance completo.
- Agua útil y umbral con base de CC/PMP validada.
- Volumen aplicado por surco para caudal y duración constantes.
- Avance y estimaciones inicio/medio/final únicamente cuando se apruebe la aproximación y calibración de infiltración.
- Estimación de aprovechamiento/eficiencia solo con interpretación aprobada y control de consistencia, sin convertir el residual en una pérdida medida.
- Diagnósticos trazables de entrada inválida, dominio, exceso de caudal respecto al límite validado y comparaciones frente a meta/umbral; umbrales de avance definidos sin ambigüedad.
- Versión del modelo y datos necesarios para reproducir simulaciones guardadas, obligatorio por A10; casos golden de reproducción y casos del modelo aprobado diferenciados.
- Resultados por surco. Totales por hectárea y cantidad/cobertura fuera del MVP hasta resolver su definición, A04.
- Textura no autocompleta CC/PMP, A02. Escurrimiento/cola no forma parte del contrato MVP, A03. «Días adicionales» eliminado del producto, A05.
- Infiltración y eficiencia identificadas como estimadas, A06:A07. Resultados físicamente inconsistentes se reportan como error/inconsistencia, sin normalización ni recorte, A08. Precisión interna completa y redondeo solo de presentación, A09.

### Futuro

- Curvas de infiltración calibradas por suelo; datos de campo y recesión.
- Caudal variable, cutback, medición de cola y balance de pérdidas por componente.
- Lluvia efectiva, humedad inicial y balance temporal completo.
- Catálogos por cultivo/etapa y perfiles de suelo con fuente validada.
- Optimización de dosis/tiempo, parcela real, turnos y simultaneidad.
- Totales por hectárea, previa resolución de cantidad y cobertura.
- Comparación de escenarios e informes exportables después de validar núcleo.

Fuera del producto inicial: preguntas de clase de Hoja 3, estructura Tabla1 del Excel, colores del gráfico, «días adicionales» erróneos y textos regionales convertidos en recomendaciones universales. No eliminar Manning para incorporar este MVP.

## 11. Modelo conceptual del motor

Firma propuesta, solo especificación: `calculateIrrigationSimulation(input)`.

| Grupo de input | Campos | Responsabilidad |
| --- | --- | --- |
| crop | etoMmPerDay, cropCoefficient, daysWithoutIrrigation | Demanda simplificada |
| soil | texture, fieldCapacityPct, wiltingPointPct, bulkDensityGcm3, rootDepthM, depletionThresholdPct | Perfil y almacenamiento; textura no autoselecciona parámetros |
| furrow | widthM, lengthM, slopePct | Geometría y límite de caudal; significado de ancho pendiente; sin cantidad por hectárea en MVP |
| irrigation | flowLps, durationMin, advanceTimeMin | Evento de riego constante; sin escurrimiento/cola en MVP |

| Grupo de output | Contenido propuesto |
| --- | --- |
| waterNeed | targetDepthMm y supuestos de demanda |
| soilWater | availableWaterMm, availableCapacityL, maxRecommendedDepthMm, maxRecommendedVolumeL |
| application | appliedVolumeL; infiltratedDepthStart/Middle/EndMm como estimaciones; estimatedUsefulVolumeL; residualLossVolumeL; sin totales por hectárea ni E18 |
| efficiency | applicationEfficiencyPct como estimación y estado de consistencia |
| diagnostics | advanceRatioPct, maxNonErosiveFlowLps, lista de diagnósticos con evidencia y campos afectados |
| metadata, reproducibilidad obligatoria por A10 | modelVersion y datos efectivos necesarios para reproducir resultados; referencia/hash de fuente, parámetros y versiones usados, unidades y supuestos; estructura concreta pendiente |

Flujo propuesto: validar tipos y unidades → convertir unidades una vez → demanda y agua de suelo → aplicación y oportunidades temporales → infiltración estimada → balance → diagnósticos → presentación. Error de dominio o entrada impide un resultado exitoso. Por A08, una inconsistencia física se reporta como error/inconsistencia sin normalizar ni recortar. La representación técnica del error y de evidencia parcial queda para R2; nunca presentar o persistir esa evidencia como simulación físicamente válida. Por A09, conservar precisión completa y redondear solo para presentación.

No hay dependencias de Express, Knex, DB o frontend en el cálculo conceptual. No se define endpoint, tabla final, migración, librería, clase ni integración con Manning en esta fase. Las 17 salidas literales son una referencia de compatibilidad documental, no todas son salidas definitivas del producto.

## 12. Persistencia sugerida, sin diseño de tabla

Categorías: **persistir input**, **persistir output** (snapshot condicionado), **recalcular**, **catálogo**, **derivado**. Un dato puede tener clasificación operativa y un snapshot para historia; no duplicar conversiones por defecto.

| Datos | Clasificación | Criterio |
| --- | --- | --- |
| ETo, Kc, días | Persistir input | Conservar valores efectivos de cada simulación, no solo referencia mutable |
| Ancho, largo, pendiente | Persistir input | Unidades y significado explícitos; no sobrescribir datos Manning |
| Caudal, duración, avance | Persistir input | Evento que reproduce aplicación e infiltración |
| CC, PMP, Da, profundidad, f | Persistir input | Guardar valores usados y base hídrica aprobada, incluso si provienen de catálogo |
| Textura | Catálogo + persistir input seleccionado | Versión e identidad del perfil; no reemplaza parámetros numéricos |
| Cola | Fuera de persistencia MVP, A03 | Fuente de medición futura, con balance nuevo validado |
| N declarado | Fuera de persistencia MVP, A04 | Cantidad/cobertura pendientes para totales por hectárea futuros |
| Meta, AU, lámina máxima | Recalcular + persistir output seleccionado | Snapshot para informes históricos si cambian fórmula/catalogo |
| Volumen aplicado | Recalcular + persistir output seleccionado | Resultado simple, útil en reporte histórico |
| Láminas inicio/medio/final, volumen útil/residual, eficiencia | Recalcular; persistir output solo de modelo aprobado | No conservar como resultados agronómicos certificados la reproducción contradictoria |
| Qmax, avance y diagnósticos | Recalcular + snapshot versionado de output | Reglas pueden cambiar; guardar IDs, parámetros y versión, no solo mensaje |
| Capacidad y volumen máximo | Derivado / recalcular | Snapshot solo si forma parte del informe reproducible |
| Total N·Va | Fuera de persistencia MVP, A04 | Identificar área representada y normalización antes de incorporarlo en futuro |
| m³ a partir de L, horas a partir de min, fracciones a partir de % | Derivado | No persistir copias redundantes por conversión |
| E18 «días adicionales» | Eliminado del producto y persistencia, A05 | Es duración en horas; conservar solo auditoría documental |
| Texturas, rangos, límites y coeficientes | Catálogo versionado, pendiente de aprobación | No migrar tablas contradictorias automáticamente |
| Posiciones | Derivado futuro 0/L/2/L, pendiente | No persistir 100 m por defecto |
| Versión del modelo, inputs efectivos y parámetros/supuestos/unidades necesarios | Persistir obligatoriamente, A10 | Reproducción de cada simulación guardada, incluidos parámetros o referencias inmutables de la versión usada |
| Fuente/hash/catalogVersion/calibración | Metadatos de procedencia propuestos | Guardar versiones efectivamente usadas; no contienen credenciales ni conexión DB |
| Hoja 3, colores y estructura Tabla1 | No persistir | Auxiliares didácticos/presentación |

No se define una tabla final ni se eligen DECIMAL/DOUBLE, columnas, FK, índices o migraciones. Un snapshot no sustituye inputs, versión de reglas y catálogo necesarios para reproducir un resultado. Los cálculos Manning conservan su contrato y ciclo de vida actuales.

## 13. Dudas pendientes y puerta de R2

Bloqueantes para implementar un simulador agronómicamente validado:

1. Confirmar si W es separación o ancho mojado; decidir posiciones y significado de avance para largo variable.
2. Validar k=4,5, b=0,5, llegada media a/2, dependencia con textura y necesidad de recesión. A06 aprueba presentarla como estimación, sin certificar su calibración.
3. Validar si lámina media representa volumen útil; definir conservación de masa y significado de eficiencia/residual. A07:A08 fijan presentación estimada y reporte de inconsistencia, sin resolver la fórmula.
4. Confirmar CC/PMP gravimétricos o volumétricos. A02 exige inputs explícitos y prohíbe autocompletarlos; autoridad de catálogos pendiente para cualquier uso futuro.
5. Definir caudal máximo para pendiente cero/cercana a cero, extremos de tabla y alcance por textura; aportar fuente regional.
6. Resolver umbrales de avance 25/30/50 % e inclusividad sin ambigüedad.
7. Confirmar demanda acumulada sin lluvia/humedad inicial y relación de f con la dosis neta/bruta.

Resuelto por A01:A10: fuente oficial/caso base; textura sin autocompletado; cola fuera del MVP; hectárea fuera del MVP; eliminación de días adicionales; infiltración/eficiencia estimadas; reporte de inconsistencia sin recortes; precisión completa; reproducibilidad versionada obligatoria.

Pendientes de futuro, sin bloquear el MVP por surco: N, superficie real, normalización por hectárea y redondeo de cantidad de surcos; eventual uso de cola con balance nuevo. Decisiones técnicas posteriores: días fraccionarios, límites superiores de inputs, catálogo editable, representación de error/evidencia parcial, política de snapshots y precisión de almacenamiento compatible con A09:A10. La planilla no las resuelve.

**¿Está listo para R2?** La extracción y reproducción literal están documentadas. **No está listo para implementar un modelo validado sin resolver los bloqueantes.** R2 puede comenzar con decisiones formales sobre estas dudas, tras autorización del usuario. No ejecutar migraciones ni implementar motor/frontend/DB por inferencia de este documento.

## 14. Verificación de R1

- Tres hojas analizadas; 17 entradas; 19 celdas con fórmulas que corresponden a 17 fórmulas/resultados distintos.
- Reproducción aritmética independiente: 19/19 celdas coinciden con valores guardados, diferencia absoluta máxima 0 en esta comprobación, con conversión explícita de B30 de texto a número y sin redondeo intermedio; tolerancia futura definida en §8.3.
- Doce casos golden documentados, con herencia explícita de fixture, cambios de outputs y diagnóstico/evidencia.
- Lectura de fórmulas, formatos, metadatos, tabla y gráfico; sin modificar ni guardar el Excel.
- No recálculo nativo de Excel, ensayo de campo o validación agronómica externa. Esas evidencias siguen pendientes.
- Único archivo de producto de R1: `docs/irrigation-model.md`. Sin implementación, cambios de migrations, tablas, datos, frontend, Manning, commit o push.
