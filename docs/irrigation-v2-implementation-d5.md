# R4F-D5 — CIERRE LOCAL V2

Fecha: 2026-10-21, America/Buenos_Aires. Resultado: cierre local aprobado dentro de la evidencia offline/mocks. **No es freeze final ni certificación MySQL/Aiven.** El pedido D5 vigente establece el cierre local como paso previo a R4F-E; prevalece sobre la denominación tentativa de D5 como certificación en el diseño y el checkpoint D4. Esos documentos conservan su contexto histórico.

## 1. Estado Git

Rama `feature/riego-surcos-v1`, HEAD `1f581dfc18f8e9ae18c3a88db1dd4c695a60d1ce`. Inspeccionados `git status`, `git diff --stat`, diff tracked completo, índice y archivos sin seguimiento. Sin staged, archivos eliminados ni cambios inesperados. No commit/push. El diff tracked acumulado sigue en seis archivos, 34 inserciones y 87 eliminaciones; esa estadística no incluye los archivos nuevos sin seguimiento.

Al inicio D5: seis tracked modificados, 23 archivos untracked y 73 archivos locales fuera de .git/node_modules. Al cierre: mismos seis tracked modificados y 25 untracked. **Los 73 archivos preexistentes conservan SHA-256; D5 agrega solo dos archivos.**

`git diff --check`: PASS. También se verifica whitespace de todos los JS/Markdown sin seguimiento. Los avisos LF/CRLF de Git indican una posible conversión futura, no una normalización hecha en D5.

## 2. Inventario de cambios

Inventario acumulado, con propiedad por fase:

| Fase | Archivos nuevos sin seguimiento |
| --- | --- |
| R4F-B/C | docs/irrigation-v2-specification.md; docs/irrigation-v2-technical-design.md |
| D1 | src/services/irrigation/v2/irrigation-models.js; irrigation-validation.js; irrigation-calculator.service.js, bajo el mismo directorio; test/fixtures/irrigation-v2-golden.js; test/irrigation.v2.contract.test.js; test/irrigation.v2.calculator.test.js; test/irrigation.v2.boundaries.test.js; docs/irrigation-v2-implementation-d1.md |
| D2 | src/services/irrigation-simulations.versions.js; src/services/irrigation-simulations.snapshot.js; src/services/irrigation-simulations.v2-mapper.js; src/services/irrigation-simulations.versioned-mapper.js; test/irrigation.versions.test.js; test/irrigation.versioned-persistence.test.js; docs/irrigation-v2-implementation-d2.md |
| D3 | db/migrations/20261014000000_extend_irrigation_simulations_v2.js; test/irrigation.v2.schema.test.js; docs/irrigation-v2-implementation-d3.md |
| D4 | src/routes/irrigation-simulations.router.js; test/irrigation.v2.http.test.js; docs/irrigation-v2-implementation-d4.md |
| D5 | test/irrigation.v2.integration-audit.test.js; docs/irrigation-v2-implementation-d5.md |

Los seis tracked modificados acumulados:

- D2: `src/services/irrigation-simulations.persistence.js`, extracción interna de query y nueva proyección opt-in.
- D4: `src/services/irrigation-simulations.service.js`, integración de dispatch/write/read/query versionados.
- D4: `src/routes/irrigation-simulations.http.js`, input por descriptor y metadata pública versionada.
- D4: `src/routes/irrigation-simulations.routes.js`, composición del puente; handlers trasladados a factory.
- D4: `test/irrigation.http.test.js`, fixture histórico válido con pair/rule registrados.
- D4: `test/irrigation.persistence.test.js`, fixture del service con pair registrado.

El registry nuevo de D2 recibió únicamente un comentario actualizado en D4. D5 no cambia ningún archivo de D1–D4, dependencias, configuración, middleware, routes, motores, migrations, Manning ni documentos anteriores. Los cambios de fixtures D4 corresponden a la transición expresamente anticipada en R4F-C; la prueba directa del mapper legacy con versiones sintéticas se conserva.

## 3. Autoridades verificadas

Contrastados los seis documentos de autoridad B/C/D1/D2/D3/D4 con el árbol actual, contratos exportados, implementación, SQL compilado y pruebas. R4F-B: 16 inputs (15 números y textura descriptiva), 19 outputs numéricos más array diagnóstico, metadata-v2, diagnostics-v1, spacing/count, hash V2 y días nullable. R4F-C: tabla única, width_m versionado, seis extensiones, cuatro CHECK, registry cerrado, dispatch por snapshot, puente/final y down protegido.

No reinterpretación del Excel o decisiones del cliente, nuevas fórmulas, endpoints o funcionalidades. Las afirmaciones históricas de cada checkpoint describen su fase; no se presentan como schema real aplicado hoy.

## 4. Version matrix

| Versión | Model | Contract | Metadata | Diagnostics |
| --- | --- | --- | --- | --- |
| V1 | irrigation-estimation-v1 | irrigation-contract-v1 | irrigation-metadata-v1 | irrigation-diagnostics-v1 |
| V2 | irrigation-estimation-v2 | irrigation-contract-v2 | irrigation-metadata-v2 | irrigation-diagnostics-v1 |

Búsqueda global en src/db/test/docs: runtime contiene únicamente esas siete cadenas de versión. En tests aparecen también prefijos interpolados para construir pairs y valores deliberadamente inválidos; no constituyen versiones registradas. Sin typo contradictorio ni fallback de storage desconocido hacia el descriptor activo.

## 5. Hashes/source hashes

| Versión | Source hash exacto |
| --- | --- |
| V1 | 42592487e6e07deb1b25a073d74086a09c1bb19cb38411aafc31d28ea64d2127 |
| V2 | 30b031d7bd3aa4365c65b6750a91a4004db4ef3452c99bf3924698b89f9dec3b |

Verificados desde modelos, registry, fixture y frontera de provenance. Writer recibe un resultado cuya procedencia debe coincidir con el descriptor del servidor; cliente no elige hash. Reader devuelve el hash almacenado después de validarlo contra su versión, sin regenerarlo o sustituirlo por el activo. Cruces de pair/hash se rechazan como storage inválido. Son identificadores de las fuentes aprobadas; D5 no reabre ni recalcula los hashes de archivos Excel históricos.

## 6. V1 freeze

SHA-256 actual y baseline iguales al freeze obligatorio:

| Archivo bajo src/services/irrigation/ | SHA-256 |
| --- | --- |
| irrigation-models.js | 6a1302569db4bd5902fb02d9ab08b6b131cd8bb155e510766dfff3937464afe8 |
| irrigation-validation.js | 7353589ce6810764085cbf9a1badb59e3458b8231e1a8acacae1ad1ed4b235a7 |
| irrigation-calculator.service.js | b2c785847f4962be991fb72a0986b9e5f2f8f1d8063e2a99cda2579f11ff1380 |

Los 72 tests puros V1 pasan; archivos/import paths/orden aritmético intactos.

## 7. Motor V2

Revisadas F01–F10/F12–F15/F18–F22. Qmax mantiene rama cero 6.3 y rama positiva `0.0063/(slopePct/100)`. Demanda conserva E*K*d sin reordenar; infiltración 4.5*sqrt(t), sqrt(t-a*0.5), sqrt(t-a). Volúmenes usan spacing*length. AU conserva orden `((CC-PMP)/100)*Da*Pr*1000`; umbral `AU*(f/100)`. Daily E*K; plazos AU/daily y maxDepth/daily; totalL applied*count y totalM3 totalL/1000. Sin descuento de tiempo transcurrido o agua aplicada a los plazos de referencia.

GV2-01 pasa contra fixture literal independiente con tolerancia `max(1e-8, 1e-9*abs(expected))`, y las pruebas de mapper/HTTP cotejan el snapshot literal completo. La equivalencia con los 14 outputs V1 es una prueba adicional de reproducción, no el único expected. Ningún cambio al orden IEEE-754.

## 8. Zero daily

Calculator evita ambas divisiones para E=0 o K=0; devuelve daily=0 y null/null explícitos. Output validator, writer, reader y HTTP preservan ambos campos; CHECK exige exactamente la misma política. Las suites cubren ambos factores cero, ausencia de campos y combinaciones inválidas. Underflow con E>0 y K>0 se rechaza; no se disfraza de cero legítimo. Días positivos que overflowan o underflowan tampoco se normalizan. No Infinity, null→0 ni omisión silenciosa.

## 9. furrowCount

Dominio de input/write: Number entero seguro positivo 1..9007199254740991, sin coerción. Reader: Number seguro o string decimal canónico convertido primero a BigInt, validado en rango y convertido después a Number. Rechaza signos, espacios, exponentes, ceros iniciales, decimales y newline final. SQL BIGINT UNSIGNED físicamente cubre el dominio y CHECK usa literal decimal exacto.

HISTORY/DETAIL conservan Number. La búsqueda de conversiones encontró únicamente Number(integer) después de validación y conversiones HTTP de ID/limit tras regex/rango; ningún parseInt ni Number directo inseguro para count. El roundtrip real del driver queda pendiente de E.

## 10. width/spacing

Búsqueda global contrastada: V1 API widthM→DB width_m; V2 API furrowSpacingM→DB width_m. POST V2 rechaza widthM; POST puente rechaza spacing/count. Reader V1 no inventa spacing y reader V2 no agrega widthM. `furrow_spacing_m` solo aparece en pruebas/documentación de prohibición, sin columna ni mapping físico creado. El motor V2 usa spacing como ancho tributario simplificado aprobado.

## 11. Mapper ↔ migration

Nueva prueba D5 compila ambas migrations con Knex/mysql2 sin conexión y compara **el conjunto de 43 nombres de INSERT**, no solo su cantidad, con las 44 columnas finales excluyendo id. Verifica las seis extensiones por nombre y sus valores literales distintos (count18/daily3.5/días26 y15.6/totales116640 y116.64), detectando swaps. Reconstruye input/output/metadata desde ese snapshot y los compara con el fixture, sin usar calculator para generar el expected.

No columna faltante/extra/typo, alias API persistido, day swapped o total swapped detectado. La proyección HISTORY referencia únicamente columnas presentes en el esquema compilado.

## 12. HISTORY

Proyección exacta de 14 columnas: id, finca_id, name, created_at, model_version, contract_version, source_hash, target_depth_mm, applied_volume_l, application_efficiency_pct, diagnostics, furrow_count, total_applied_volume_l, model_metadata. No select *. Datos suficientes para pair/hash/schema/rules y summaries sin traer los 16 inputs ni 19 outputs completos.

La segunda prueba D5 valida ese conjunto exacto con una fila independiente que contiene solo la proyección. V1 conserva summary anterior; V2 agrega únicamente furrowCount/totalAppliedVolumeL. No metadata, días, totalM3 o input en response. Ownership, limit+1, fechas empatadas, orden descendente y cursor v1 permanecen probados. V1 extension guard solo puede verificar extensiones presentes en esta proyección; los seis campos se comprueban en DETAIL y los CHECK reales deben proteger la tabla completa.

## 13. DETAIL

Dispatch por contract_version de cada fila; pair/hash/metadata/rules validados antes del lector. V1 mantiene widthM+14; V2 spacing/count+19 con días nullable. Mensajes, parámetros y magnitudes provienen de storage. No calcula, corrige, completa metadata ni sustituye versiones. Unknown/corrupt devuelve 500; tests de ambos routers lo comprueban.

## 14. Snapshot semantics

POST retorna el detalle obtenido de `findSnapshot(trx, ...)`, no el objeto calculator directamente. HISTORY/DETAIL no invocan calculator. Los tests almacenan magnitudes/parámetros/mensajes distintos de los actuales y verifican que GET no los regenere. La validación es estructural/provenance y de dominio V2, no una recalculación matemática ni ajuste a parámetros actuales. JSON se serializa una sola vez al INSERT.

## 15. Bridge/default

ACTIVE_DESCRIPTOR=ACTIVE_V1 es **deliberado y completo para la release puente**, no un olvido de activación. Permite preservar el contrato POST existente mientras se prepara/certifica el esquema y se coordina R5. No hubo cambio del default en D5.

**El puente actual ya consulta las columnas nuevas en HISTORY: no desplegarlo sobre schema V1 sin ampliar.** Mantener POST V1 no elimina esta dependencia. La secuencia sigue siendo schema compatible certificado → puente → corte posterior autorizado.

## 16. Final V2 composition

Factory router/service acepta ACTIVE_V2 explícito solo desde composición interna del servidor. La misma referencia determina filtro de campos, calculator y writer. Los 19 tests HTTP D4 construyen puente y final, validan POST GV2-01/zero/invalid, HISTORY/DETAIL mixtos y errores/ownership/commit. Copies, strings y descriptores desconocidos se rechazan antes de DB. No selector del cliente ni endpoint V2 paralelo.

## 17. Migration audit

UP: preflight de cardinalidad/presencia, seis columnas nullable sin defaults de negocio y cuatro CHECK. Sin DML, backfill, rename, cambio a originales ni alteración de tracking. Resultado declarado/compilado: 44 columnas y 14 CHECK, no observado en DB real. PK/AUTO_INCREMENT/FK RESTRICT/índice/JSON/DATETIME(3)/charset permanecen declarados por la migration original intacta.

DOWN: preflight de esquema ampliado; rechaza cualquier fila que no sea pair V1 exacto y seis NULL antes del primer DDL. Luego elimina solo cuatro CHECK y seis columnas. No borra/reescribe datos. `transaction:false` reconoce autocommit DDL; estados parciales se reportan, sin reparación automática. Preflight comprueba cardinalidad y nombres nuevos, **no la definición completa de objetos originales**; E debe inspeccionarlos realmente. Mantenimiento/sin writers es precondición externa, no lock atómico del precheck.

## 18. CHECK audit

| CHECK | Invariante |
| --- | --- |
| irr_sim_version_pair_ck | pairs V1/V1 o V2/V2 exactos mediante CAST AS BINARY |
| irr_sim_v1_extension_ck | V1 con seis NULL; V2 no exige NULL |
| irr_sim_v2_extension_ck | V2 con count seguro, daily>=0 y dos totales>0 explícitamente presentes |
| irr_sim_v2_days_ck | V2 daily=0/null-null o daily>0/dos días presentes>0 |

Comparación con diseño: migration repite pair completo en las ramas además del CHECK cerrado; no altera el dominio admitido. Pruebas interpretan expresiones capturadas con lógica SQL de tres valores y consideran UNKNOWN permisivo para detectar ausencia de IS NOT NULL. Cobertura de caso normal, cero, faltantes, límites, negativos, cruzados/case/trailing, down y 68 estados de prefijos no admisibles. No igualdad float, hash por versión o JSON profundo nuevo. Esa interpretación no certifica el servidor MySQL.

## 19. Transactions

Revisado: transaction→owned finca/forShare→cálculo→map→INSERT→readback con trx→return callback→commit→respuesta. Todas las consultas de creación usan la misma trx. Tests verifican orden, una ejecución y fallos. El 500 ante acuse incierto no implica que se haya deshecho la escritura; se conserva reconciliación manual HISTORY/DETAIL sin retry/replay/idempotencia.

## 20. DELETE finca

Sin cambios. DELETE usa transaction y FOR UPDATE sobre finca propia; consulta cualquier irrigation_simulation por finca_id sin filtrar versión, bloquea con 409 y mantiene FK RESTRICT. Solo cuando no hay simulaciones elimina Manning y finca en la misma trx. Nueve tests relacionados PASS; incluyen rollback, dependencia tardía simulada, permisos y preservación de Manning. Locks/carreras reales requieren conexiones independientes en E.

## 21. Error mapping

| Situación | HTTP | Evidencia |
| --- | --- | --- |
| Input/IDs/query/name | 400 | HTTP V1/V2 + validators |
| Auth faltante/inválida | 401/403 | HTTP y DELETE |
| Ownership/not found | 404 | HTTP y DELETE |
| Dependencia de finca/FK | 409 | DELETE con mocks |
| Body demasiado grande | 413 | app/HTTP V1, parser compartido intacto |
| Content-Type incorrecto | 415 | HTTP V1/V2 |
| Modelo no finito/inconsistente | 422 | HTTP V1/V2 |
| Storage/DB/commit/internal | 500 | HTTP V1/V2 + frontera de snapshot |
| MODEL_NOT_IMPLEMENTED | 503 | rama heredada explícita; motores actuales no la producen en éxito |

IrrigationSnapshotError no hereda errores de input y mantiene 500. `snapshotBoundary` transforma los errores de identidad/shape de storage; solo el camino WRITE conserva los errores de input de aplicación. No se clasifican snapshots corruptos como400/422.

## 22. Security/leaks

Rutas de simulaciones retornan error genérico para errores inesperados, sin serializar Error, SQL, errno, stack, host, CA path ni rutas locales. El log de esa ruta es un mensaje constante. La proyección admite las nueve secciones públicas y elimina metadata superior privada. Filtro de errores del modelo omite received. Pruebas insertan marcadores privados/SQL/errores de lectura y comparan respuesta genérica.

No se añadieron rutas de archivos de Excel a metadata; provenance usa referencias aprobadas de hoja/fórmula, no paths locales. No se imprimió configuración DB, credenciales, tokens reales o CA; JWT y datos DB de las suites son sintéticos. La validación conserva contenido histórico dentro de las secciones públicas, no pretende ser un filtro universal de texto arbitrario inyectado administrativamente. Logs históricos de otros endpoints no se reescriben en D5.

## 23. HTTP surface

Solo POST colección, GET colección y GET detalle de simulaciones. Sin PUT/PATCH/DELETE simulation, debug/migration endpoints, selector público ni cambio a auth/CORS/parser. Los métodos inmutables continúan 404. La nueva factory es una función interna y no una superficie HTTP.

## 24. Manning

Motor/servicio/rutas/tabla históricos sin modificaciones. Regresión completa incluye 32 tests puros Manning y 22 tests HTTP de cálculos/contacto/superficies existentes. DELETE conserva la eliminación transaccional de Manning solo cuando es admisible borrar la finca. No retiro de tablas ni servicios históricos.

## 25. Test quality

Revisadas suites D1–D4: fixture GV2-01 es literal, sin importar calculator; expected numéricos/metadata/diagnósticos no se generan con el motor bajo prueba. Comparaciones V1↔V2 y relaciones metamórficas usan resultados calculados como controles de equivalencia, además del golden independiente. Los mocks HTTP D4 aplican ownership, orden/cursor, proyección y staging; los tests SQL compilan Knex real sin connection.

Los dobles no emulan enforcement CHECK, locks ni commit del servidor; esto es límite explícito para E, no prueba real. El intérprete CHECK prueba lógica/expresiones, no coerciones/collations MySQL. Los asserts de arrays potencialmente vacíos se acompañan de fixtures concretos, pruebas de counts/golden y casos negativos. No assertion vacía, catch que transforme fallo en PASS o promesa de test sin await detectados; los catch relevantes propagan y finally restaura recursos. No test.only/skip/todo. La nueva prueba D5 reduce el riesgo de que contrato y mapper compartan un typo que las pruebas internas no detecten.

## 26. Code hygiene

Búsqueda TODO/FIXME/HACK/XXX/debugger/.only/.skip/.todo en src/db/test/scripts: sin hallazgos pendientes. Console.log únicamente en arranque (`src/server.js`) y script TLS existente, para estado operativo; no debug nuevo ni payload. Script TLS **no ejecutado**. Comentarios históricos conservados.

Checks estáticos: `node --check` sobre **53 archivos JavaScript**, todos PASS, sin cargar módulos ni DB. package.json no declara lint/check/build; no se inventan scripts. Los tres tests existentes schema/startup pasan en cada corrida completa con configuración sintética/UTC, sin consultas reales. No se ejecuta npm start con entorno real.

## 27. Dependencies

package.json/package-lock.json sin diff ni cambios D5. Sin instalación, update o audit de red. Scripts reales: test, start y check:db-tls; únicamente test ejecutado como script npm. Runtime local Node v24.16.0; Knex3.1.0/mysql2 3.24.4 instalados. Esto describe el ambiente local, no certifica otra versión de Node o servidor.

SHA-256 package.json: `162457dd24964ba8a697578b434535558c93c3bf2ce22b6cb50817407569a385`.

SHA-256 package-lock.json: `748191713c5aa5b0e254b043460be665fb595746a79827b6548310e0d4734d2c`.

## 28. Tests focalizados

Primero se ejecutaron juntos los 14 archivos relevantes: tres suites puras V1, tres V2, registry, persistence versionada/legacy, schema, HTTP V1/V2, DELETE finca y audit D5. **193 PASS / 0 FAIL**, cero skipped/cancelled/todo.

Desglose: V1 engine72 + V2 engine30 + registry9 + versioned persistence17 + persistence11 + schema8 + HTTP V1 16 + HTTP V2 19 + DELETE9 + audit D5 2. Nuevas pruebas en `test/irrigation.v2.integration-audit.test.js`; no helpers descubiertos como tests adicionales.

## 29. npm test corrida 1

**251 PASS / 0 FAIL**, cero cancelled/skipped/todo; duración reportada por runner 2046.5593ms. Incluye startup/config sintético, UTC, SQL offline, HTTP loopback y mocks DB/SMTP. No conexión real.

Conteo: baseline249 + dos casos D5. La entrada conocida del módulo fixture continúa contando una vez como PASS, no como skip.

## 30. npm test corrida 2

**251 PASS / 0 FAIL**, cero cancelled/skipped/todo; duración2189.2865ms. Mismo código y conjunto de casos; sin diferencias funcionales ni flakiness observada en estas dos corridas. Dos corridas no garantizan ausencia universal de flakiness.

## 31. Correcciones realizadas

**Ningún bug funcional local confirmado; ningún cambio de implementación o refactor.** Solo se agregan dos pruebas transversales y este cierre. Durante la construcción del test nuevo, la primera ejecución dio1 PASS/1 FAIL por asumir un espacio en `check (`: Knex ALTER emite `check(`. Se corrigió únicamente el reconocimiento de whitespace del test a `check\s*\(`, sin alterar migration o dominios. Después pasaron focalizados y ambas suites completas. No se alteró una expectativa de negocio para acomodar código.

## 32. Riesgos pendientes

Sin blocker funcional local detectado dentro del alcance inspeccionado. **No aprobado para despliegue o uso sobre schema real V1.** Pendientes privilegios/compatibilidad/enforcement MySQL, datos históricos reales, TLS/UTC efectivos, BIGINT/DOUBLE/JSON/null roundtrip, locks/carreras/rollback, backup recuperable y tracking real. Unknown pairs/metadata presentes en DB podrían impedir la transición; no se presume DB vacía ni compatible.

DDL puede quedar parcial por autocommit; no hay recuperación automática. DOWN requiere mantenimiento/sin writers y no es admisible con V2. Tras existir V2 el piso de rollback de aplicación es el puente lector, manteniendo schema ampliado; no el binario V1 original. Corte público V2 debe coordinarse con consumidor compatible/R5 y autorización específica. Sin claims científicos/calibración del modelo.

## 33. Checklist R4F-E

**Plan pendiente; ninguna casilla ejecutada en D5.** Antes de operar se debe autorizar por separado ambiente, acceso, backup/restauración, DDL, fixtures/DML/cleanup y alcance de carreras. Preferir ambiente aislado; no asumir permiso para usar DB compartida o datos de clientes. Preparar ledger de IDs y evidencia sanitizada. Cada paso necesita resultado verificable y criterio de parada; fallo/timeout ambiguo nunca autoriza retry automático.

- [ ] **A. Preflight Aiven/TLS/UTC.** Confirmar destino autorizado sin publicar host/credenciales; versión MySQL, TLS verificado contra CA, cifrado y UTC en runtime/CLI/sesión. DNS fallido no prueba fallo TLS. Detener ante destino/TLS/UTC inesperado; no usar conexiones inseguras de fallback.
- [ ] **B. Backup.** Coordinar ventana sin writers; obtener backup consistente de datos/schema/tracking por mecanismo autorizado, registrar integridad y recuperación prevista. Probar restore solo en destino explícitamente autorizado y aislado, nunca sobre origen. No iniciar DDL si no hay recuperación acreditada; no adjuntar dumps ni secretos al repo.
- [ ] **C. Estado migrations.** Leer migrations y lock; identificar pendientes y verificar que el archivo D3 es el esperado. Sin lock activo, migrations parciales/desconocidas ni otras pendientes que se aplicarían accidentalmente. No liberar locks o editar tracking manualmente para avanzar.
- [ ] **D. Schema V1 actual.** Inspeccionar definiciones reales:38 columnas/10 CHECK, tipos/null/defaults, PK/AUTO_INCREMENT, FK RESTRICT, índice finca/created/id, JSON, DATETIME(3), engine/charset/collation y source_hash ascii_bin. No equiparar conteo correcto a definiciones correctas. Detener ante drift o extensiones ya parciales.
- [ ] **E. Inventario filas/versiones.** Registrar counts por pair y evidencia verificable de procedencia/metadata/rules/JSON de todas las filas existentes; inventariar también fincas y Manning. Crear referencias/fingerprints de preservación con representación estable y material resguardado. Si hay versiones desconocidas o metadata incompatible, detener: no borrar, backfillear, renombrar hashes ni deshabilitar CHECK para pasar.
- [ ] **F. Migration UP.** Confirmar backup y ausencia de writers/DDL concurrente; aplicar únicamente la migration prevista con herramienta autorizada. Registrar statements/errores sanitizados. Ante DDL parcial detener, inspeccionar schema+tracking y preparar recuperación específica; no repetir ni reparar silenciosamente.
- [ ] **G. 44 columnas/14 CHECK.** Leer definiciones del schema ampliado: originales intactos, seis nullable sin defaults de negocio, BIGINT UNSIGNED y cinco DOUBLE, cuatro nombres/expresiones exactas y enforcement habilitado. Verificar comparación binaria efectiva de pairs, IS NULL/IS NOT NULL y límite decimal MAX_SAFE. No confundir compilación offline con aceptación real.
- [ ] **H. Preservación V1.** Comparar filas originales con inventario E: identidad/fecha/nombre/inputs/outputs/hash/metadata/diagnostics sin cambios, seis extensiones NULL. Counts sin pérdida; JSON comparado semánticamente donde la representación del servidor pueda variar. Conservar evidencia de todos los históricos, no solo una muestra golden.
- [ ] **I. Puente V1 write/read.** Sobre finca/usuario fixture autorizados, componer puente y probar POST V1 (37 valores), readback, HISTORY/DETAIL y metadata/UTC; V2 body rechazado. Confirmar solo un cálculo/INSERT y respuesta después del commit. No publicar este build antes de validar el schema.
- [ ] **J. V2 GV2-01 real.** Componer final V2 en harness/servicio autorizado, sin cambiar el default público. POST golden→201; consultar fila43 valores, envelope/input/output19/metadata/hash/reglas completos y comparación literal/tolerancia aprobada. Validar que response sale del readback real, no del calculator directo.
- [ ] **K. Zero daily real.** E=0, K=0 y ambos0: daily=0, días NULL/NULL en SQL/mapper/JSON presentes. Verificar no0/Infinity/omisión y reglas P01–P05. El caso positivo underflow mantiene422 sin INSERT.
- [ ] **L. BIGINT 1/18/MAX_SAFE.** Escribir/leer con configuración mysql2 real aprobada; comparar decimal exacto de columna, tipo del driver, adapter y respuesta Number en HISTORY/DETAIL. No modificar configuración global para encubrir pérdida de precisión; totales finitos sin exigir enteros exactos fuera de rango seguro de magnitudes.
- [ ] **M. INSERT inválidos/CHECK.** En fixture aislado autorizado, ensayar V1 extensión noNULL; count NULL/0/>MAX_SAFE, daily NULL/negativo, totales NULL/0/negativo; daily0 con días numéricos; dailypositivo con ambos/uno NULL o días0/negativos; pairs cruzados/desconocidos/case altered/trailing. Confirmar rechazo del CHECK esperado y ausencia de filas; comprobar también CHECK históricos representativos. Separar coerciones previas del servidor (p.ej. decimal→BIGINT) del tipo estricto de HTTP; no exigir a SQL una validación de tipo que no promete. No inventar CHECK de hash/JSON profundo ni desactivar constraints productivos para crear corrupción.
- [ ] **N. HISTORY/DETAIL mixtos.** V1/V2 normal/V2 zero, fechas empatadas y más de una página; order/cursor v1/limit+1, sin duplicados/huecos y terminal null. Summary V1 intacto, V2 solo count/totalL; detalle19/14 y metadata/messages históricos sin cálculo. Unknown/corrupt→500 solo mediante dobles o fixture aislado permitido, nunca debilitando constraints de DB compartida.
- [ ] **O. Ownership/auth.** Usuarios/fincas propios y ajenos autorizados; 401/403 sin DB, 404 indistinguible en POST/HISTORY/DETAIL y snapshot de otra finca, sin datos ni INSERT ajenos. IDs/query/content-type/limits siguen contrato. No exponer tokens de prueba en logs/evidencia.
- [ ] **P. Rollback transaction.** Fallos controlados en etapas de creación, lectura y commit por infraestructura autorizada. Con conexión independiente verificar filas, fincas y Manning; demostrar rollback real cuando se conoce que ocurrió. Estado de commit incierto se reconcilia antes de decidir cualquier repetición; no asumir rollback por un500. No inyectar fallos en datos ajenos.
- [ ] **Q. Carreras POST/DELETE.** Dos conexiones independientes y sincronización acreditada sobre finca fixture: POST toma shared lock primero→201 y DELETE409; DELETE toma FOR UPDATE primero→200 y POST404. Validar espera, commits, ausencia de huérfanos y preservación/rollback de Manning en ambos órdenes. Timeouts/deadlocks se informan sin retry automático; mocks D4 no son evidencia suficiente.
- [ ] **R. FK RESTRICT.** Dentro del entorno autorizado verificar constraint real y rechazo de borrado de padre con simulaciones, sin pérdida de Manning/finca. Comprobar datos desde otra conexión después de rollback. Sin alterar FK ni deshabilitar foreign_key_checks para forzar escenarios.
- [ ] **S. EXPLAIN cursor/index.** Consultas reales con ownership y cursor compuesto, bindings sanitizados; revisar índice finca/created/id y plan/order/rows. Distinguir índice disponible de índice elegido por optimizador en tabla pequeña; documentar volumen y plan sin prometer rendimiento a otra escala ni agregar índices no autorizados.
- [ ] **T. DOWN rechazo con V2.** En entorno autorizado comprobar rechazo antes de DDL y que schema/rows/tracking siguen intactos. Extensiones V1 noNULL/pairs inválidos están bloqueados por CHECK en schema sano: mantener sus pruebas con mocks, no deshabilitar CHECK para fabricarlos. Un down exitoso solo se ensaya en clon/ambiente separado expresamente autorizado, vacío o solo V1 exacto/seisNULL y sin writers; jamás borrar V2 real para habilitarlo.
- [ ] **U. Cleanup.** Limpiar únicamente IDs de fixtures asentados en ledger y con autorización de DML directo (API de simulaciones es inmutable). Orden respetando FK, sin borrar históricos/Manning/fincas previos. Confirmar cada resultado y detener ante estado incierto; no usar DELETE amplio ni convertir datos. Con V2 existente conservar schema ampliado.
- [ ] **V. Migration tracking.** Reconciliar nombre/batch/lock esperado con schema observado y operación realmente ejecutada. Una migration más respecto al inventario inicial, sin entradas fantasma ni borrado/edición manual. Si se ensayó down en clon, reportarlo separadamente del destino principal.
- [ ] **W. Reconciliación final.** Volver a verificar TLS/UTC/schema/enforcement y comparar inventario inicial+ledger−cleanup; originales intactos, cero huérfanos/fixtures residuales no explicados, Manning conservado. Guardar evidencia sanitizada, pendientes y resultado de cada A–W. Solo después emitir certificación/freeze R4F-E si todos los requisitos autorizados están acreditados. Deploy/corte público V2 sigue requiriendo autorización y consumidor compatible.

## 34. ¿D5 aprobado?

**Sí, como cierre integral local y precertificación V2.** Auditoría D1–D4 sin bug funcional confirmado, coherencia schema/mapping/proyección reforzada,193 focalizados y251 completos en dos corridas PASS,53 archivos con sintaxis válida y hashes V1 intactos. La evidencia está delimitada a código, SQL compilado, HTTP loopback y mocks.

## 35. ¿Backend listo para certificación DB real R4F-E?

**Sí, para solicitar la autorización concreta de R4F-E y ejecutar su checklist en el ambiente que se apruebe. No está certificado ni listo para desplegar sobre schema anterior.** Sin evidencia DB actual y sin presumir permisos de escritura, backup, restore o DDL.

Detenerse: **R4F-E no iniciado. Sin Aiven/MySQL real, migrations reales, deploy, frontend, commit ni push.**
