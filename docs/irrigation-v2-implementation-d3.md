# R4F-D3 — MIGRATION Y SCHEMA V2

Fecha: 2026-10-20. Alcance exclusivamente offline. Autoridades: especificación R4F-B, diseño R4F-C, implementaciones D1/D2 y código actual. No se reinterpreta el Excel ni se cambia el contrato aprobado.

## 1. Estado Git

Rama `feature/riego-surcos-v1`, HEAD `1f581dfc18f8e9ae18c3a88db1dd4c695a60d1ce`. El árbol ya contenía D1/D2 y sus documentos sin commit; persistence era el único archivo tracked modificado. Se preservaron los 67 archivos preexistentes byte por byte mediante SHA-256. Sin staging, commit ni push.

## 2. Archivos creados/modificados

Tres archivos nuevos D3:

- `db/migrations/20261014000000_extend_irrigation_simulations_v2.js`.
- `test/irrigation.v2.schema.test.js`.
- `docs/irrigation-v2-implementation-d3.md`.

Ningún archivo preexistente modificado o eliminado en D3. Sin cambios a dependencias, configuración, service, rutas, parser, mappers, registry o frontend.

## 3. Migration creada

Migration CommonJS aditiva sobre `irrigation_simulations`, con `up`, `down` y `config.transaction = false`. Usa SchemaBuilder y `table.check(expr, [], name)` como la migration original. Las lecturas de preflight usan SQL constante y bindings del nombre fijo de tabla. No se modifica ninguna migration anterior ni el tracking Knex.

## 4. Columnas nuevas

| Columna | Tipo | Nullability |
| --- | --- | --- |
| furrow_count | BIGINT UNSIGNED | NULL |
| daily_crop_water_use_mm_per_day | DOUBLE | NULL |
| days_until_available_water_exhaustion | DOUBLE | NULL |
| days_until_depletion_threshold | DOUBLE | NULL |
| total_applied_volume_l | DOUBLE | NULL |
| total_applied_volume_m3 | DOUBLE | NULL |

38 columnas originales más seis = 44. No se agrega `furrow_spacing_m`; `width_m` conserva su slot físico y el significado se resuelve por versión en los mappers aprobados.

## 5. Tipos SQL

Compilación offline con Knex instalado y dialecto mysql2, sin conexión configurada. Primer statement generado:

```sql
alter table `irrigation_simulations` add `furrow_count` bigint unsigned null, add `daily_crop_water_use_mm_per_day` double null, add `days_until_available_water_exhaustion` double null, add `days_until_depletion_threshold` double null, add `total_applied_volume_l` double null, add `total_applied_volume_m3` double null
```

Luego se generan cuatro statements `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)`, uno por CHECK. No DECIMAL, INT, escala, precisión fija, default explícito, UPDATE, INSERT ni backfill. SQL compilado no equivale a aceptación por un servidor real.

## 6. Nullability

Las seis columnas son físicamente nullable para preservar V1 sin inventar datos. El insert V1 de 37 valores continúa siendo compatible; omitir las extensiones nullable permite NULL. En V2 los CHECK exigen presencia de count, daily y totales; solo ambos plazos pueden ser NULL, exclusivamente con daily cero. No se agrega default de negocio.

## 7. version_pair CHECK

`irr_sim_version_pair_ck`: únicamente contract/model V1/V1 o V2/V2. Ambos lados de cada igualdad textual usan `CAST(... AS BINARY)` sin longitud fija, para comparar bytes y conservar diferencias de mayúsculas o espacios finales. Incluye `contract_version IS NOT NULL` y `model_version IS NOT NULL`, aunque esas columnas ya son NOT NULL. No se confía en la collation textual existente.

## 8. V1 extension CHECK

`irr_sim_v1_extension_ck`: permite pair V2 o pair V1 con las seis extensiones `IS NULL`. Cada extensión no NULL en V1 se rechaza. Las ramas utilizan los mismos pairs binarios exactos; no se atribuye semántica a una versión desconocida.

## 9. V2 extension CHECK

`irr_sim_v2_extension_ck`: permite V1 o V2 con count explícitamente no NULL en 1..9007199254740991, daily explícitamente no NULL y >=0, ambos totales explícitamente no NULL y >0. La integridad de enteros corresponde también al tipo BIGINT; el mapper preserva el contrato de entero seguro. No se introducen identidades float, hashes por versión ni checks JSON profundos.

## 10. V2 days CHECK

`irr_sim_v2_days_ck`: permite V1 o V2 con daily no NULL y una rama exclusiva: daily=0 y ambos días NULL; o daily>0 y ambos días explícitamente no NULL y >0. Rechaza un solo plazo NULL, plazos cero/negativos, daily negativo y daily ausente.

## 11. NULL/UNKNOWN verification

El test interpreta las expresiones reales capturadas de `table.check`, con precedencia AND/OR, paréntesis, NOT, comparaciones, CAST binario e IS NULL/IS NOT NULL. Conserva tres valores: true, false y null=UNKNOWN. Simula la aceptación de CHECK como resultado distinto de false, para detectar precisamente un UNKNOWN permisivo.

Control del intérprete: `x > 0` con x NULL da UNKNOWN; `x IS NOT NULL AND x > 0` da false. Los defectos de presencia requeridos se rechazan al evaluar conjuntamente los cuatro CHECK, y se comprueban rechazos aislados en V1 extension, V2 extension y V2 days. Es verificación lógica offline; no es ejecución SQL ni emulación completa de MySQL/collations.

## 12. Up migration

Primero lee INFORMATION_SCHEMA.COLUMNS y TABLE_CONSTRAINTS, limitado a DATABASE() y a la tabla exacta; requiere 38 columnas, 10 CHECK y ninguna extensión/CHECK nuevo. Luego agrega las seis columnas y después los cuatro CHECK. Se esperan tres eventos de alto nivel: lectura, DDL columnas, DDL checks; este último compila cuatro statements.

No modifica valores, versiones, hash ni JSON. PK, FK RESTRICT, índice, AUTO_INCREMENT, timestamps, charset/collation y los diez CHECK originales no reciben ningún ALTER. Se compila además la migration original en los tests para comprobar su estructura base, DATETIME(3), JSON y FK.

## 13. Down protegido

Antes de cualquier ALTER/DROP, exige esquema ampliado completo (44 columnas, 14 CHECK, las seis extensiones y cuatro nombres nuevos). Luego consulta si existe alguna fila con versiones NULL, pair distinto del V1 exacto o cualquier extensión no NULL. Con una sola fila bloqueante rechaza todo el down. Una tabla vacía o con V1 exactos y seis NULL permite continuar.

Primero elimina los cuatro CHECK nuevos; después las seis columnas nuevas. SQL compilado: un `ALTER TABLE ... DROP CONSTRAINT` con los cuatro nombres y otro `ALTER TABLE ... DROP` con las seis columnas. Ningún DELETE, UPDATE, conversión V2→V1 ni modificación de otro objeto.

**El precheck no es un lock atómico contra writers. El down requiere mantenimiento y ausencia de writers, coordinados externamente por el operador.** La migration no garantiza esa exclusión ni seguridad frente a DDL concurrente por sí misma.

## 14. Partial DDL behavior

MySQL DDL puede hacer autocommit. `transaction:false` evita declarar una protección transaccional ficticia. Si un statement falla, se propaga el error y no se intenta reparar, completar o revertir automáticamente. Un fallo entre columnas y CHECK, entre CHECK individuales o durante down puede dejar DDL parcial que debe inspeccionarse antes de decidir la recuperación y reconciliar el tracking mediante un procedimiento autorizado.

Los preflights rechazan tablas ausentes, estados parciales y estados ya aplicados/invertidos; no hay IF NOT EXISTS ni manipulación manual de tracking. Verifican cardinalidad y presencia de las extensiones/CHECK nuevos; **no auditan las definiciones de todos los objetos originales** ni sustituyen un preflight real de certificación. No previenen drift o escrituras concurrentes después de la lectura.

## 15. Schema tests

`node --test test/irrigation.v2.schema.test.js`: **8 PASS / 0 FAIL**; sin skipped/cancelled/todo. Compila UP/DOWN con un Knex mysql2 sin connection. Captura exclusivamente SQL; el adapter de pruebas resuelve lecturas con metadata/filas sintéticas y no ejecuta ningún statement.

Prueba tipos/null/defaults, nombres y orden de operaciones, pairs binarios, MAX_SAFE decimal, ausencia de DML/renames/identidades float/JSON profundo, protección down, errores de lecturas/DDL y cada prefijo de cantidades de columnas y CHECK parciales. Se verifican 68 estados no admisibles en la matriz de prefijos (34 para cada dirección), además de los casos explícitos de esquema ausente/parcial/opuesto. Los errores interrumpen la secuencia, incluida la segunda operación DDL de down.

## 16. CHECK matrix tests

Acepta V1 con seis NULL, V2 normal (18/3.5/26/15.6/totales positivos), V2 daily cero con dos NULL y MAX_SAFE count. Rechaza cada extensión V1 no NULL; count NULL/0/negativo/>MAX_SAFE; daily NULL/negativo; cada total NULL/0/negativo; daily cero con uno o ambos plazos numéricos; daily positivo con uno o ambos NULL; cada plazo cero/negativo; pairs cruzados/desconocidos/case altered/trailing spaces y versiones NULL. Se comprueba también que totales positivos sin identidad matemática exacta pasan el dominio SQL deliberadamente.

DOWN usa su predicado real contra filas sintéticas: rechaza V2, pairs desconocidos/cruzados/case altered/trailing spaces/NULL, y cualquiera de las seis extensiones con cero (además del dominio normal); jamás alcanza DDL en esos rechazos.

## 17. furrowCount SQL

`BIGINT UNSIGNED` tiene capacidad física para 9007199254740991. El CHECK usa ese literal decimal exacto, sin notación científica, y el intérprete lo representa como BigInt para evitar perder precisión en el caso superior. No se reduce a INT. El roundtrip mysql2 Number/string y la coerción del servidor todavía requieren certificación real; D2 conserva sus pruebas de adapter.

## 18. Regresión D1

Los 30 casos lógicos D1 PASS sin modificaciones a sus suites, motor, metadata ni fixture. El módulo de datos sigue contado como una entrada adicional por el runner, igual que en la base anterior.

## 19. Regresión D2

Los 26 tests D2 PASS sin modificaciones: nueve de registry y 17 de persistence versionada. No se activa `listVersionedSnapshots` desde service/rutas; la API permanece V1. No incompatibilidad conceptual detectada que requiera modificar R4F-B/C.

## 20. Regresión V1

Los 165 tests anteriores a D1 PASS, sin cambios. Incluyen 72 puros del motor de riego y 27 de persistence/HTTP V1, además de Manning, fincas, arranque/configuración y demás regresión existente. No se altera el mapper legacy ni el servicio activo.

## 21. npm test

**230 PASS / 0 FAIL**, cero skipped/cancelled/todo. Desglose: 222 entradas previas (165 legacy +30 casos D1 +1 fixture +26 D2) +8 D3. Primero pasó la suite focalizada y luego la regresión total. HTTP local de suites preexistentes con mocks DB/SMTP; ningún MySQL, Aiven, TLS, DB efímera, INSERT real o migration real ejecutado. No instalación de dependencias.

## 22. Hashes V1

Verificados antes/después, idénticos al freeze:

| Archivo bajo src/services/irrigation/ | SHA-256 |
| --- | --- |
| irrigation-models.js | 6a1302569db4bd5902fb02d9ab08b6b131cd8bb155e510766dfff3937464afe8 |
| irrigation-validation.js | 7353589ce6810764085cbf9a1badb59e3458b8231e1a8acacae1ad1ed4b235a7 |
| irrigation-calculator.service.js | b2c785847f4962be991fb72a0986b9e5f2f8f1d8063e2a99cda2579f11ff1380 |

## 23. git diff --check

PASS. Los tres archivos nuevos se verifican también por separado al no estar tracked; sin whitespace final ni líneas vacías de cierre adicionales. Los 67 archivos preexistentes conservan SHA-256. Git advierte futura conversión LF/CRLF en persistence, que ya estaba modificado por D2; no se normalizaron archivos.

## 24. Riesgos/blockers

Sin blocker lógico offline detectado. Pendiente certificación MySQL real: sintaxis y ejecución DDL, privilegios, enforcement CHECK, collation binaria efectiva, preflight de datos/esquema, compatibilidad operativa/locks y roundtrip driver. No hay evidencia de schema V2 aplicado. El rollback necesita mantenimiento; DDL parcial no es transaccional ni se repara automáticamente. Estas limitaciones impiden llamar a este resultado certificación DB o activación de API V2.

## 25. ¿D3 aprobado técnicamente?

**Sí, dentro del alcance autorizado offline:** migration aditiva, dominios/CHECK y down protegido implementados, SQL compilado y regresión completa PASS. No equivale a una aprobación de ejecución real en DB compartida.

## 26. ¿Está listo para D4?

**Sí, para su autorización y alcance específico. D4 no iniciado.** Detenerse aquí: sin HTTP V2, frontend, Aiven, ejecución de migration, commit ni push. La certificación real requiere autorización posterior explícita.
