# R4F-D1 — MOTOR V2

Fecha: 2026-10-20, America/Buenos_Aires. Autoridades: [R4F-B](irrigation-v2-specification.md) y [R4F-C](irrigation-v2-technical-design.md). Implementación exclusivamente pura; sin integración DB/API.

## 1. Estado Git

Rama `feature/riego-surcos-v1`, HEAD `1f581dfc18f8e9ae18c3a88db1dd4c695a60d1ce`. Al iniciar ya estaban sin seguimiento los documentos de especificación y diseño V2. Se conservaron intactos. Sin staging, commit ni push. Ningún archivo preexistente modificado o eliminado.

## 2. Archivos creados

Ocho archivos nuevos de D1:

- `src/services/irrigation/v2/irrigation-models.js`
- `src/services/irrigation/v2/irrigation-validation.js`
- `src/services/irrigation/v2/irrigation-calculator.service.js`
- `test/fixtures/irrigation-v2-golden.js`
- `test/irrigation.v2.contract.test.js`
- `test/irrigation.v2.calculator.test.js`
- `test/irrigation.v2.boundaries.test.js`
- `docs/irrigation-v2-implementation-d1.md`

## 3. Archivos V1 preservados

Los tres módulos originales no se movieron, editaron ni refactorizaron. Tampoco se cambiaron tests, G01, imports existentes, migrations, Manning, configuración, package.json o package-lock.json. Se compararon por SHA-256 los **52 archivos preexistentes**, incluidos los documentos R4F-A/B/C: todos idénticos, cero eliminados.

## 4. Versiones V2

Modelo `irrigation-estimation-v2`; contrato `irrigation-contract-v2`; metadata `irrigation-metadata-v2`; diagnósticos **`irrigation-diagnostics-v1`**. SourceHash `30b031d7bd3aa4365c65b6750a91a4004db4ef3452c99bf3924698b89f9dec3b`, constante de modelo, sin leer Excel en runtime.

## 5. Input contract

16 campos conceptuales en crop/soil/furrow/irrigation: 15 numéricos y textura descriptiva. `furrowSpacingM` obligatorio, sin aliases widthM/wettedWidthM. `furrowCount` Number entero seguro positivo, hasta MAX_SAFE_INTEGER; no limitarlo a INT UNSIGNED ni imponer máximo agronómico.

## 6. Output contract

19 magnitudes, más diagnostics.items: 17 Number requeridos y dos plazos Number|null. Grupos y nombres exactos de R4F-B. Totales separados de valores por surco; sin superficie, volumen recomendado total ni runoff.

## 7. Validaciones

Sin coerción; Number finito, objetos planos y propiedades de datos conocidas. Rechaza missing/null/string/boolean/NaN/Infinity en números; count además rechaza fracciones y enteros fuera del rango seguro. Mantiene dominios/relaciones equivalentes V1, textura optional/null o string trim de 1..64 puntos de código, sin autocompletar suelo. Getters se rechazan sin invocarlos.

## 8. Fórmulas heredadas

F01–F10/F12–F15 conservan orden aritmético V1, usando spacing en las tres multiplicaciones por área. Qmax usa `0.0063 / (slopePct / 100)` o 6.3 para cero; F14 conserva `AU * (f / 100)`. No reordenar, redondear, interpolar ni aplicar caps. Calculator V2 propio, sin llamar ni importar calculator V1.

## 9. Fórmulas nuevas

F18 daily=ETo*Kc; F19 exhaustion=AU/daily; F20 threshold=maxDepth/daily; F21 totalL=applied*count; F22 totalM3=totalL/1000. Las divisiones se evalúan solo si daily>0. No descontar días pasados ni usar estos plazos como humedad restante actual o scheduling.

## 10. Zero daily-use

ETo=0 o Kc=0 legítimo produce daily=0 y ambos plazos explícitamente null. Si ambos factores son positivos y el producto underflowa a cero, falla con MODEL_INCONSISTENCY sobre daily, sin éxito parcial. El guard contextual está en calculator, que conoce los inputs; el validador de output verifica la correspondencia daily/plazos sin inferir datos de entrada ausentes.

## 11. Guards

NON_FINITE_RESULT para productos/cocientes no finitos; MODEL_INCONSISTENCY para magnitudes positivas que underflowan a cero. Conserva útil≤aplicado, residual≥0, eficiencia/avance 0..100 y dominios estructurales. Totales requieren positivos finitos. Sin clamps, epsilon, normalización física, Infinity JSON ni éxito parcial. Se validan resultados antes de construir diagnostics y antes de devolver ok:true.

## 12. Metadata V2

Las nueve secciones y su contenido coinciden por igualdad profunda con R4F-B §25. Constantes y mapas de unidades proceden de las definiciones V2; templates/contratos congelados y snapshots nuevos en cada llamada. Base gravimétrica, spacing tributario, count representativo, días desde referencia CC, consumo cero y origen empírico 4.5 explícitos. Sin claims de calibración/validación científica.

## 13. Diagnostics

P01–P05 conserva mensajes, severidades, fields, evidence y orden. Igualdades no emiten avisos. Comparación metamórfica con V1 equivalente verifica objetos completos y los 14 resultados heredados en nueve escenarios. Sin D01–D08 ni avisos por count o daily=0. La implementación no depende de módulos V1 para construirlos.

## 14. GV2-01

Fixture literal independiente transcrito de los JSON aprobados de R4F-B; no importa calculator ni documentación en ejecución. Se verificó de nuevo que input/output/metadata coinciden exactamente con esa fuente. Ejemplo: aplicado6480 L, útil3681.3190570772317 L, residual2798.6809429227683 L, eficiencia56.8104792758832%, daily3.5 mm/día, plazos26/15.6 días, total116640 L/116.64 m³; P02/P04 completos en orden.

Los19 valores se contrastan con tolerancia R1 `max(1e-8,1e-9*abs(expected))`; versiones/metadata/count/null/shape/diagnostics exigen igualdad exacta. G01 V1 no cambió.

## 15. Contract tests

**10 PASS / 0 FAIL:** shape exacto de16 inputs/19 outputs; tipos, campos extra y autoridad; objetos/getters; relaciones; textura Unicode; nullable condicional; versiones/hash/metadata congelados y copiados; diagnostics con JSON inválido, ciclos, arrays dispersos o severidad fatal.

## 16. Calculator tests

**7 PASS / 0 FAIL:** golden completo,100 repeticiones con input congelado y mutación de copias devueltas, equivalencia V1 de14 resultados/diagnostics, tres casos legítimos de cero, independencia de textura/count, semántica de días y escalamiento geométrico. La comparación con V1 es adicional, nunca fuente del expected golden.

## 17. Boundary tests

**13 PASS / 0 FAIL:** count1/18/MAX_SAFE y rechazos; underflow/overflow daily; cocientes infinitos; plazos positivos que redondean a cero; totalL overflow con aplicado todavía finito; totalM3 underflow con totalL todavía positivo; avance0/duración y bandas excluidas; pendiente0/positiva/mínima; balance imposible; guards independientes; igualdades/orden de diagnostics; aislamiento de dependencias puras.

## 18. Regresión V1

Los **165 tests previos pasan sin cambios**, incluidos72 de los tres suites puros V1, G01, Manning, HTTP/persistencia con mocks y UTC/startup. V2 no está importado desde rutas o servicios existentes; POST actual continúa V1. Los módulos V2 solo requieren sus propios models/validation locales, sin IO/env/Date/random/red.

## 19. npm test

Focalizados V2: **30 PASS / 0 FAIL**, cero skipped/cancelled/todo. Suite completa `npm test`: **196 PASS / 0 FAIL**, cero skipped/cancelled/todo. Desglose:165 previos +30 nuevos casos V2 +1 entrada de Node por descubrimiento del módulo de datos `test/fixtures/irrigation-v2-golden.js`. Esta última no es un caso adicional de lógica del motor.

Los tests existentes usan HTTP local, mocks DB/SMTP, compilación SQL offline y procesos con configuración sintética; no se ejecutó check:db-tls ni se conectó voluntariamente a Aiven/MySQL. No se crearon suites de registry, mapper, HTTP V2 ni migrations.

## 20. Hashes V1 antes/después

Iguales byte a byte en inicio y cierre:

| Archivo dentro de src/services/irrigation/ | SHA-256 antes = después |
| --- | --- |
| irrigation-models.js | 6a1302569db4bd5902fb02d9ab08b6b131cd8bb155e510766dfff3937464afe8 |
| irrigation-validation.js | 7353589ce6810764085cbf9a1badb59e3458b8231e1a8acacae1ad1ed4b235a7 |
| irrigation-calculator.service.js | b2c785847f4962be991fb72a0986b9e5f2f8f1d8063e2a99cda2579f11ff1380 |

## 21. git diff --check

PASS en diff tracked; nuevos archivos sin seguimiento revisados aparte por espacios finales. Sin cambios tracked, staging ni dependencias. Los dos documentos previos continúan sin seguimiento como al iniciar. Los nuevos archivos D1 son los ocho de §2.

## 22. Riesgos / hallazgos / diferencias

Sin divergencias funcionales respecto de R4F-B/C ni blockers D1 detectados. MAX_SAFE count puede producir total finito sin que ese total tenga representación entera exacta: es Number, como especificado. Node descubre el fixture como entrada del runner; conteo transparentado en §19. Las validaciones y pruebas locales no acreditan calibración agronómica ni persistencia/roundtrip de V2; eso sigue fuera de D1.

## 23. ¿R4F-D1 aprobado técnicamente?

**Sí, para el alcance puro autorizado:** golden, contratos, metadata, casos extremos, regresión e integridad de archivos preservados. V2 permanece desacoplado del backend activo y no constituye activación API.

## 24. ¿Listo para R4F-D2?

**Sí, para revisión/autorización del siguiente alcance. D2 no iniciado.** No registry, mapper, persistence/service/routes/HTTP V2, migration, DB, Aiven, frontend, commit ni push. Detenerse en este checkpoint.
