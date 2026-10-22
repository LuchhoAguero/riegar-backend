# R4F-C — DISEÑO TÉCNICO V2

Fecha: 2026-10-14, America/Buenos_Aires. **Diseño únicamente.** Autoridad conceptual: [irrigation-v2-specification.md](irrigation-v2-specification.md), R4F-B. El presente documento decide la implementación futura sin modificar esa especificación.

## 1. Alcance

Se cierra el diseño de almacenamiento, migration futura, convivencia, motores, mappers, API, transición y certificación de V1/V2. No implementa código V2, no crea ni ejecuta migrations, no modifica tests productivos, no conecta a Aiven, no cambia DB/frontend/Manning, no instala dependencias ni realiza commit/push. Único archivo creado: `docs/irrigation-v2-technical-design.md`.

Las referencias a archivos nuevos, funciones, columnas, constraints y suites son **plan futuro**, no archivos ni funcionalidades existentes. Los bloques SQL describen constraints que deberá materializar R4F-D; no se ejecutaron contra un servidor. La compilación offline realizada se limita a columnas propuestas en un SchemaBuilder en memoria, sin importar ni invocar ninguna migration ni configuración de conexión del proyecto.

## 2. Estado actual y evidencia

Git inicial: rama `feature/riego-surcos-v1`; HEAD `1f581dfc18f8e9ae18c3a88db1dd4c695a60d1ce`; único cambio previo `?? docs/irrigation-v2-specification.md`. Se preserva íntegramente, sin staging. R4F-A es histórico; no se modifica.

Fuente Excel oficial ya auditada: `Riego Pepe Ag ( lucho) (2).xlsx`; SHA-256 verificado de nuevo: `30b031d7bd3aa4365c65b6750a91a4004db4ef3452c99bf3924698b89f9dec3b`. No se usan versiones anteriores como autoridad ni se vuelve a extraer toda la planilla para duplicar R4F-B.

Inspección real: cuatro migrations; tres módulos del motor; mapper/persistence/service; HTTP/routes; app; DELETE finca; suites de contrato/cálculo/bordes/persistencia/HTTP/schema y documentación R1/R2/R3/R4D/R4E/R4F-B. El schema se inventaría **desde la migration local**, no desde un SHOW CREATE TABLE actual. Certificación MySQL 8.4.11/TLSv1.3 y 165 PASS son antecedentes R4D/R4E, no resultados de esta fase.

Arquitectura actual: CommonJS/Express; Knex compartido; service recibe Knex y permite inyección para pruebas; POST calcula/persiste/readback dentro de transaction; HISTORY/DETAIL no calculan. Mapper importa contratos globales V1; HISTORY tiene lista fija de columnas; HTTP filtra nueve secciones superiores de metadata. No hay infraestructura de plugins/versiones ni motor V2. Se diseña sobre esos puntos reales.

## 3. Inventario DB actual

Autoridad: [20261012000000_create_irrigation_simulations.js](../db/migrations/20261012000000_create_irrigation_simulations.js). Tabla `irrigation_simulations`, InnoDB, charset utf8mb4. **38 columnas**; 37 valores de insert de aplicación más id generado. Sin defaults explícitos de negocio; nullable sin valor corresponde a NULL, nunca a cero fabricado. El auto-increment de id es comportamiento del schema, no default de un input.

| Columnas exactas | Tipo definido | Nullable / default | Compartición |
| --- | --- | --- | --- |
| id | INT UNSIGNED AUTO_INCREMENT, PK | NOT NULL; generado | identidad única V1/V2 |
| finca_id | INT UNSIGNED | NOT NULL; sin default | ambas |
| name | VARCHAR(255) | NULL; sin default de negocio | ambas |
| eto_mm_per_day, crop_coefficient, days_without_irrigation | DOUBLE cada una | NOT NULL; sin default | ambas, mismos significados |
| texture | VARCHAR(64) | NULL | ambas, descriptiva |
| field_capacity_pct, wilting_point_pct, bulk_density_g_cm3, root_depth_m, depletion_threshold_pct | DOUBLE cada una | NOT NULL; sin default | ambas, base V2 fijada en metadata |
| width_m | DOUBLE | NOT NULL; sin default | slot geométrico interpretado por versión (§6) |
| length_m, slope_pct | DOUBLE cada una | NOT NULL; sin default | ambas |
| flow_lps, duration_min, advance_time_min | DOUBLE cada una | NOT NULL; sin default | ambas |
| target_depth_mm, available_water_mm, available_capacity_l, max_recommended_depth_mm, max_recommended_volume_l | DOUBLE cada una | NOT NULL; sin default | cinco outputs por surco de ambas |
| applied_volume_l, infiltrated_depth_start_mm, infiltrated_depth_middle_mm, infiltrated_depth_end_mm, estimated_useful_volume_l, residual_loss_volume_l | DOUBLE cada una | NOT NULL; sin default | seis outputs por surco de ambas |
| application_efficiency_pct, advance_ratio_pct, max_non_erosive_flow_lps | DOUBLE cada una | NOT NULL; sin default | tres outputs de ambas |
| model_version | VARCHAR(64) | NOT NULL; sin default | por fila |
| source_hash | CHAR(64), charset ascii, collation ascii_bin | NOT NULL; sin default | por fila |
| contract_version | VARCHAR(32) | NOT NULL; sin default | por fila |
| model_metadata | JSON | NOT NULL; sin default JSON | schema/hipótesis versionados dentro del objeto |
| diagnostics | JSON | NOT NULL; sin default JSON | array de items históricos |
| created_at | DATETIME(3) | NOT NULL; servidor lo suministra en UTC | ambas; sin updated_at |

La migración no fija una collation binaria para model_version/contract_version; no asumir comparación case-sensitive en SQL sin hacerla explícita.

FK `irrigation_simulations_finca_id_foreign`: finca_id→fincas.id, ON DELETE RESTRICT / ON UPDATE RESTRICT. Índice `irrigation_simulations_finca_created_id_idx` sobre `(finca_id, created_at, id)`. PK id; sin índice por versión/count ni unicidad de nombre/intención.

Diez CHECK existentes, a conservar literalmente:

| Nombre | Expresión actual |
| --- | --- |
| irr_sim_crop_ck | `eto_mm_per_day >= 0 AND crop_coefficient >= 0 AND days_without_irrigation >= 0` |
| irr_sim_soil_pct_ck | `wilting_point_pct >= 0 AND field_capacity_pct > wilting_point_pct AND field_capacity_pct <= 100 AND depletion_threshold_pct > 0 AND depletion_threshold_pct <= 100` |
| irr_sim_soil_geometry_ck | `bulk_density_g_cm3 > 0 AND root_depth_m > 0` |
| irr_sim_furrow_ck | `width_m > 0 AND length_m > 0 AND slope_pct >= 0` |
| irr_sim_irrigation_ck | `flow_lps > 0 AND duration_min > 0 AND advance_time_min >= 0 AND advance_time_min <= duration_min` |
| irr_sim_output_depth_ck | `target_depth_mm >= 0 AND available_water_mm > 0 AND max_recommended_depth_mm > 0 AND infiltrated_depth_start_mm >= 0 AND infiltrated_depth_middle_mm >= 0 AND infiltrated_depth_end_mm >= 0` |
| irr_sim_output_volume_ck | `available_capacity_l > 0 AND max_recommended_volume_l > 0 AND applied_volume_l > 0 AND estimated_useful_volume_l >= 0 AND estimated_useful_volume_l <= applied_volume_l AND residual_loss_volume_l >= 0` |
| irr_sim_output_ratio_ck | `application_efficiency_pct >= 0 AND application_efficiency_pct <= 100 AND advance_ratio_pct >= 0 AND advance_ratio_pct <= 100 AND max_non_erosive_flow_lps > 0` |
| irr_sim_json_ck | `JSON_TYPE(model_metadata) = 'OBJECT' AND JSON_TYPE(diagnostics) = 'ARRAY'` |
| irr_sim_hash_ck | `CHAR_LENGTH(source_hash) = 64` |

Ninguna columna se elimina ni cambia de tipo/nullability/default. No hay que rebajar constraints V1 para alojar V2: los 14 outputs heredados y geometría siguen cumpliéndolos. La tabla ampliada tendrá44 columnas,43 valores de insert V2 más id; el writer V1 puede seguir enviando sus37 valores y dejar las seis extensiones en NULL.

## 4. Alternativas de storage

| Aspecto | A extender tabla | B tabla irrigation_simulations_v2 | C payload completo JSON versionado en tabla actual |
| --- | --- | --- | --- |
| Históricos | columnas V1 intactas; dispatch por fila | aislamiento físico, lector por tabla/versión | requiere duplicación o reemplazar columnas actuales |
| IDs/DETAIL | id único ya existente | IDs colisionan entre tablas si no se diseña asignación nueva; DETAIL actual insuficiente | id único, pero otro formato de almacenamiento |
| HISTORY/cursor | misma query/índice/posición | UNION/identidad global o tiebreaker adicional, adaptación de cursor | cursor igual, extracción JSON para magnitudes nuevas |
| Ownership/FK | misma FK y joins | dos FK y joins; más superficie de comprobación | igual FK, integridad de datos desplazada a JSON/app |
| DELETE/locks | mismo precheck sobre ambas versiones | precheck atómico de dos tablas y certificación ampliada | precheck igual |
| Constraints/nulls | seis nullable físicos con CHECK por versión | columnas V2 más sencillas; dos schemas por mantener | checks JSON frágiles o más débiles; outputs no quedan columnas consultables |
| Migration/rollback | aditiva, sin backfill; down bloqueado con V2 | nueva tabla; down también destruye V2 si no se bloquea | modifica representación y duplica autoridad con columnas |
| Complejidad/QA | extensión localizada; matriz de versiones obligatoria | aumenta consulta, identidad, delete y QA de carreras | parsing/duplicación/sincronización innecesarios |
| V3 futura | nuevo pair y extensión deliberada, sin prometer crecimiento ilimitado | otra tabla o rediseño común | flexibilidad de shape a cambio de garantías numéricas SQL |

C no mejora garantías y contradice la preferencia explícita de magnitudes contractuales en columnas; se descarta. B es viable con otro diseño de identidad/historial, pero añade problemas que no exige este alcance. No se decide por número de archivos: A mantiene las garantías existentes sin datos ficticios ni reinterpretación V1 bajo §6/§10/§16.

## 5. Decisión storage

**Elegida A: extender irrigation_simulations.** Un solo espacio id, índice/cursor, ownership/FK y lock de finca; seis columnas nuevas nullable físicas; checks que distinguen V1/V2. No se duplica width/spacing ni se modifica ningún valor existente.

El aislamiento semántico está en contratos/mappers inmutables y version pair, no en cambiar el nombre de toda la tabla. Es suficiente para dos versiones con14 magnitudes compartidas. Si V3 cambiara de manera sustancial unidades o estructura, requeriría otra evaluación; no se habilita un fallback genérico ni un contenedor sin schema.

## 6. width_m / furrowSpacingM

**Reusar width_m como slot físico versionado.** Mapping V1: `width_m→input.furrow.widthM`, significado pendiente conservado. Mapping V2: `width_m→input.furrow.furrowSpacingM`, distancia entre surcos usada como ancho tributario simplificado según metadata V2. Ambos >0 en m; se conserva el CHECK actual. El writer V2 asigna el único valor realmente suministrado como spacing; no fabrica un ancho mojado.

Agregar furrow_spacing_m exigiría hacer width_m nullable por versión o duplicar un valor V2 para satisfacer NOT NULL, con checks adicionales de autoridad. Renombrar físicamente width_m rompería lectores/writers V1 y no está permitido para el histórico. Se descartan ambas opciones. No exponer el nombre físico en API ni crear alias widthM en V2. Requisito de mantenimiento: los mappings deben declarar sqlColumn:width_m dentro de cada contrato y los tests probar significados por versión; no inferir semántica del nombre SQL fuera del registry.

## 7. Columnas V2 nuevas y mapping

| Path contractual exacto | Columna nueva | Uso |
| --- | --- | --- |
| input.furrow.furrowCount | furrow_count | conteo real del escenario |
| output.waterNeed.dailyCropWaterUseMmPerDay | daily_crop_water_use_mm_per_day | consumo diario |
| output.soilWater.daysUntilAvailableWaterExhaustion | days_until_available_water_exhaustion | plazo de referencia, nullable legítimo |
| output.soilWater.daysUntilDepletionThreshold | days_until_depletion_threshold | plazo de referencia, nullable legítimo |
| output.totals.totalAppliedVolumeL | total_applied_volume_l | aplicado total |
| output.totals.totalAppliedVolumeM3 | total_applied_volume_m3 | conversión del total |

Los otros15 inputs V2 se guardan en las columnas existentes, incluida textura y slot width_m. Los otros14 outputs también; no agregar surface_area, total_recommended_volume, runoff ni bandas. Nuevos outputs no van en JSON para evitar migration: deben persistirse explícitamente como snapshot, no recalcularse en GET.

## 8. Tipos SQL exactos

`furrow_count`: **BIGINT UNSIGNED NULL**, sin default de negocio, con dominio condicional1..9007199254740991. BIGINT signed también cubre el rango y sería correcto con CHECK; se elige UNSIGNED para expresar conteo no negativo a nivel de tipo y conservar convención de enteros positivos del schema, sin confundir su capacidad física mayor con el límite de API. No se elige INT UNSIGNED ni se reduce el contrato. `DECIMAL(16,0)` también cabe, pero no mejora exactitud del dominio entero y normalmente agrega retorno string del driver.

Cada uno de los cinco nuevos outputs: **DOUBLE NULL, sin escala decimal**, sin default de negocio. JS Number/DOUBLE conserva política R2 y representación binaria del cálculo; DECIMAL para mostrar15.6 o116.64 impondría otra precisión/redondeo. Los dos days deben conservar SQLNULL→JSnull→JSONnull, los otros tres nunca null en V2 válida. La configuración timezoneZ no cambia.

Compilación local offline con Knex instalado confirmó seis ADD con `bigint unsigned null` y cinco `double null`; no se ejecutó SQL ni se creó migration. No certifica coerción/enforcement/readback en MySQL real, que son gates de §31.

## 9. Nullability condicional

| Campo físico | Fila V1 | V2 daily=0 legítimo | V2 daily>0 |
| --- | --- | --- | --- |
| furrow_count | NULL | requerido, entero1..MAX_SAFE | requerido, entero1..MAX_SAFE |
| daily_crop_water_use_mm_per_day | NULL | exactamente0 | positivo finito |
| days_until_available_water_exhaustion | NULL | NULL | positivo finito, NOT NULL |
| days_until_depletion_threshold | NULL | NULL | positivo finito, NOT NULL |
| total_applied_volume_l | NULL | positivo finito, NOT NULL | positivo finito, NOT NULL |
| total_applied_volume_m3 | NULL | positivo finito, NOT NULL | positivo finito, NOT NULL |

Todas las seis son nullable físicamente para V1; sin defaults cero/1/18. V2 nullable solo para los dos plazos y solo por consumo cero real. El motor distingue underflow positivo de cero legítimo; SQL no puede recuperar el valor matemático previo a redondear. El reader usa versión y daily para diferenciar ausencia V1 de null semántico V2, sin transformar null en undefined/0/string.

## 10. CHECK strategy

Conservar los diez CHECK existentes. Agregar **cuatro** CHECK, cada uno con responsabilidad acotada. En las expresiones siguientes C1/C2 son abreviaturas documentales de comparación binaria exacta de contract_version contra irrigation-contract-v1/v2; no son columnas ni variables SQL a crear.

1. `irr_sim_version_pair_ck`: solamente los dos pairs model/contract de §11. Comparar `CAST(model_version AS BINARY)` y `CAST(contract_version AS BINARY)` contra los literales correspondientes, para no aceptar cambios de mayúsculas/trailing spaces según collation. Ambas columnas actuales son NOT NULL.
2. `irr_sim_v1_extension_ck`: `C2 OR (furrow_count IS NULL AND daily_crop_water_use_mm_per_day IS NULL AND days_until_available_water_exhaustion IS NULL AND days_until_depletion_threshold IS NULL AND total_applied_volume_l IS NULL AND total_applied_volume_m3 IS NULL)`.
3. `irr_sim_v2_extension_ck`: `C1 OR (furrow_count IS NOT NULL AND furrow_count >= 1 AND furrow_count <= 9007199254740991 AND daily_crop_water_use_mm_per_day IS NOT NULL AND daily_crop_water_use_mm_per_day >= 0 AND total_applied_volume_l IS NOT NULL AND total_applied_volume_l > 0 AND total_applied_volume_m3 IS NOT NULL AND total_applied_volume_m3 > 0)`.
4. `irr_sim_v2_days_ck`: `C1 OR (daily_crop_water_use_mm_per_day IS NOT NULL AND ((daily_crop_water_use_mm_per_day = 0 AND days_until_available_water_exhaustion IS NULL AND days_until_depletion_threshold IS NULL) OR (daily_crop_water_use_mm_per_day > 0 AND days_until_available_water_exhaustion IS NOT NULL AND days_until_depletion_threshold IS NOT NULL AND days_until_available_water_exhaustion > 0 AND days_until_depletion_threshold > 0)))`.

**No depender de UNKNOWN de SQL:** un CHECK puede admitir UNKNOWN, por lo que comparar solo days>0/count>=1 no obliga presencia. Los IS NOT NULL anteriores hacen falso el caso faltante. Las versiones NOT NULL y pair cerrado evitan rama desconocida permisiva. Los branches V1/V2 son excluyentes por comparación exacta. Las cuatro restricciones se prueban juntas y por defecto aislado en fixtures; no se relaja la protección V1.

No imponer identidades flotantes como `totalL=applied*count`, `totalM3=totalL/1000` o días=AU/daily en SQL: otra aritmética/orden puede alterar último bit y DB no es calculadora. Motor+mapper verifican contrato; writer persiste exactamente el resultado de su versión. SQL garantiza presencia, dominio y consistencia básica, no calibración ni autoría de la fila. Las conversiones numéricas de una escritura administrativa pueden ocurrir antes de CHECK —por ejemplo decimal→BIGINT—, por lo que la validación estricta de tipo del input sigue siendo de aplicación.

## 11. Version pair y matriz de compatibilidad

| contract_version | model_version | metadataSchemaVersion | diagnosticRules.ruleVersion e items | source_hash esperado |
| --- | --- | --- | --- | --- |
| irrigation-contract-v1 | irrigation-estimation-v1 | irrigation-metadata-v1 | irrigation-diagnostics-v1 | 42592487e6e07deb1b25a073d74086a09c1bb19cb38411aafc31d28ea64d2127 |
| irrigation-contract-v2 | irrigation-estimation-v2 | irrigation-metadata-v2 | irrigation-diagnostics-v1 | 30b031d7bd3aa4365c65b6750a91a4004db4ef3452c99bf3924698b89f9dec3b |
| cualquier otro pair/combinación | no soportado | no seleccionar actual por defecto | no regenerar | no sustituir |

SQL aplica los dos pares exactos model/contract, hashlength y JSONobject/array existentes; **aplicación** comprueba schemaVersion, referencia de modelo interna, diagnóstico ruleVersion y hash de esa versión. No añadir CHECK JSON profundo de9secciones o expresiones por item: es frágil, duplica schema y no reemplaza validación de lectura/escritura.

El registry valida strings case-sensitive sin trim/coerción. Antes de migration futura, inventariar pairs y metadata/hash de filas existentes mediante preflight autorizado. Si aparece una versión distinta o metadata incompatible: detener rollout y reportar; no borrar, backfillear ni reasignar V1 para satisfacer el nuevo CHECK. No hay evidencia de esas filas hoy; tampoco se presume DB vacía.

## 12. furrowCount: storage y roundtrip exacto

Evidencia local: Knex3.1.0 y mysql2 3.24.4 instalados. `src/config/database.js` usa client:mysql2/timezoneZ, sin supportBigNumbers/bigNumberStrings/decimalNumbers globales. `node_modules/mysql2/lib/connection_config.js:120` fija esos defaults false; `node_modules/knex/lib/dialects/mysql/index.js:127` usa connection.query con bindings; `node_modules/mysql2/lib/packets/packet.js:497` convierte BIGINT textual largo a Number cuando supportBigNumbers=false. **Todo el dominio contractual seguro, incluido9007199254740991, es exactamente representable**: no existe pérdida dentro de ese rango por convertir su decimal canónico a Number. El problema de precisión aparece fuera del dominio.

Insert: input de API ya debe ser Number entero seguro positivo; writer lo vuelve a validar y pasa Number como binding de BIGINT, sin multiplicarlo ni redondearlo. No cambiar conexión global, no forzar DECIMAL ni CAST adicional para cada consulta. insertId del INSERT sigue siendo el id INT de simulación, no count.

Adapter privado de readback en el mapper V2, sin aceptar estas coerciones en el POST:

- Si llega number: exigir Number.isSafeInteger y1..MAX_SAFE; devolver el mismo valor.
- Si llega string: exigir decimal canónico `/^[1-9][0-9]{0,15}$/`, convertir primero a BigInt, comparar1n..9007199254740991n, solo entonces Number y revalidar entero seguro. Rechazar espacios, signos, ceros iniciales, exponentes, puntos, fracciones o dígitos fuera de rango. Esto cubre un driver que devuelva texto sin tocar su configuración global.
- Si llega null/undefined/boolean/bigint/objeto en un campo V2 requerido: error interno de snapshot; no default. El bigint interno del adapter nunca se serializa ni se enlaza directamente a JSON.

Los tests de adapter se hacen a través del readback/mapper; no es una nueva capacidad de coerción del contrato de entrada. La certificación deberá insertar/leer1,18 yMAX_SAFE_INTEGER con conexión real y comparar identidad exacta en columna, mapper, HISTORY y DETAIL. Hasta entonces se trata de garantía de diseño fundamentada offline, no roundtrip DB certificado.

## 13. Motor V1/V2: layout y reutilización

Mantener **sin mover ni modificar** los tres archivos V1 actuales de `src/services/irrigation/`: irrigation-models.js, irrigation-validation.js e irrigation-calculator.service.js. Conservar hashes, import paths, orden aritmético, G01 y comportamiento puro. No refactorizar V1 dentro de este trabajo.

Agregar en R4F-D, no ahora:

```text
src/services/irrigation/v2/irrigation-models.js
src/services/irrigation/v2/irrigation-validation.js
src/services/irrigation/v2/irrigation-calculator.service.js
src/services/irrigation-simulations.versions.js
src/services/irrigation-simulations.v2-mapper.js
src/services/irrigation-simulations.versioned-mapper.js
```

V2 tiene definiciones/metadata propias,16 inputs/19 outputs y nullable específico; calculator preserva orden F01–F10/F12–F15 y agrega F18–F22. **No llama al calculator V1 mediante un alias spacing→width**, ni importa sus contratos/constantes mutables. Duplicación controlada de aritmética, validación estructural y buildDiagnostics P01–P05 es aceptable: comparar los14 resultados y objetos diagnósticos entre versiones, con fixtures equivalentes y checks de hashes, protege la equivalencia sin acoplar su evolución. No duplicar IO/transactions/auth/paginación dentro del motor.

En esta expansión no se extrae un nuevo paquete de utilidades matemáticas compartidas: hacerlo obligaría a modificar V1 o crear dependencia cruzada. Compartir solo infraestructura ya externa al motor, estable y ajena a las ecuaciones: identidad/name/Date de aplicación del mapper legacy, queries/transacciones, auth y cursor. No priorizar DRY sobre reproducción. V2 sigue sin IO/env/Excel/fechas/redondeo; tipos y guards de null, underflow y overflow se fijan por R4F-B.

## 14. Version registry

`irrigation-simulations.versions.js` será un registro pequeño e inmutable de **dos descriptors**, key exacta contractVersion. Cada descriptor incluye modelVersion, contractVersion, metadataSchemaVersion, diagnosticsRuleVersion, sourceHash; INPUT/OUTPUT_CONTRACT; validateInput/validateOutput; calculate; mapWrite/readDetail/readHistory; publicMetadataKeys.

Descriptor V1 apunta a los módulos y mapper legacy existentes; V2 a los nuevos. No imports de Express/Knex/config de DB; no descubrimiento dinámico, plugin system, filesystem ni selección desde body/query. Dependencias acíclicas: motores→sus definiciones; v2mapper→módulos V2 y utilidades de identidad legacy; registry→motores/mappers; facade versioned-mapper→registry; service/HTTP→registry/facade. Ni mapper V2 ni mapper legacy importan el facade.

Un selector `resolveStoredVersion` valida key exacta y pair, sin fallback. La versión activa de creación es un **descriptor de servidor constante**, inicialmente V1 en el build puente y V2 en el final; solo selección explícita al componer service/HTTP, no feature flag público ni parámetro del frontend. El mismo descriptor capturado al construir la ruta/service determina shape de POST, calculator y writer, evitando desajuste durante una petición.

## 15. Write dispatch

En backend final: body→postInput con INPUT_CONTRACT del descriptor activo V2→service→validate/calculate V2→guard completo→mapper write V2→insert/readback versionado→201 después del commit. Versiones/hash solo del descriptor/calculator, nunca del cliente. El reader del readback selecciona V2 desde la fila y comprueba compatibilidad antes de responder.

V1 write permanece disponible internamente para pruebas, build puente y rollback compatible; **no selector V1 en la API final**. Inyección de dependencias para tests/fallos se hace como bundle coherente o como calculator controlado cuyo resultado debe coincidir con el bundle; no permitir que mezcle validator V2 con resultado V1 silenciosamente.

## 16. Read dispatch

Fila DB→resolver contract_version→comprobar model pair→validar estructura/procedencia almacenada→reader de esa versión→envelope público. No calcular, actualizar ni usar las reglas activas. Versión desconocida o incompatible: lanzar error interno de almacenamiento que la ruta convierte en500genérico; no fallback aV1/V2actual ni400que culpe al cliente.

En lectura, preservar números/parámetros/mensajes/metadata efectivos guardados; **no comparar el contenido de parámetros históricos contra el template activo para sustituirlo**, ni volver a ejecutar ecuaciones. Validar tipos/shape, versiones/hash y finitud contractual, no recalibrar. Para V2 comprobar count/domino nullable/daily del snapshot; su ausencia o corrupción falla, no se convierte en un resultado nuevo.

En HISTORY usar la proyección necesaria para validar pair, metadata schema/referencia y diagnóstico ruleVersion, sin enviar metadata al cliente (§21). Fallar la página ante fila incompatible; no saltarla silenciosamente y crear huecos de cursor.

## 17. Mapper V1

Conservar `irrigation-simulations.mapper.js` como implementación legacy, incluidas las exports de identidad/name/paginación usadas por código actual. El facade nuevo resuelve/checkea versión antes de delegar a mapStoredDetail/mapHistorySummary/mapCalculationToSnapshot de V1. Puede verificar que las seis columnas nuevas sean NULL cuando existen en filas de tabla ampliada; nunca agregarlas a input/output V1 ni requerirlas para mocks históricos que todavía representan el schema original.

V1 reader conserva widthM/14outputs/metadata-v1/diagnósticos históricos. No transformar metadata pendiente en confirmada, no cambiar hash ni parámetros. Los tests unitarios legacy que llaman directamente al mapper pueden seguir comprobando preservación textual sin que ese mapper adquiera responsabilidad de registry; las rutas nuevas pasan obligatoriamente por la frontera versionada.

## 18. Mapper V2

Nuevo `irrigation-simulations.v2-mapper.js`: mapping explícito bidireccional a la tabla ampliada. Reutiliza identidad/name/Date públicos legacy; mantiene su propio copiado JSON finito y acíclico con null, sin exportar ni modificar helpers privados V1. El contrato V2 declara sqlColumn `width_m` para spacing y las seis columnas de §7. No llamar al writer V1 con un payload renombrado para después parchear columnas o metadata.

Write exige resultado exitoso completo de su versión: 16 inputs canónicos, 19 outputs, schema/hash/model pair correctos, diagnostics de regla V1 y metadata segura. Guarda exactamente los valores calculados: count Number seguro; daily finito ≥0; días null solo para cero legítimo confirmado por input/motor; totales positivos finitos. Persistence serializa JSON una vez, como ahora. No reemplazar null por 0 ni stringify anticipadamente.

Read exige todos los campos físicos V2. Count pasa por el adapter de §12; las magnitudes conservan Number finito y ambos plazos conservan null cuando daily=0. Reconstituye el shape V2 exacto, sin compartir referencias. No calcula count/plazos/totales a partir de otros datos ni adapta la fila a V1.

## 19. Metadata dispatch y proyección pública

Conservar snapshots metadata-v1 y metadata-v2. `publicSnapshot` resolverá el descriptor de la fila y proyectará las **nueve claves superiores de R4F-B §25**, copiando íntegro el contenido admitido de cada schema. Hoy ambas versiones tienen las mismas nueve keys; el descriptor hace explícita la compatibilidad. No borrar nuevas hipótesis, unidades o provenance V2 ni devolver internalDebug/top-level extras administrativos.

La proyección no reconstruye: nunca regenerar desde createIrrigationMetadata ni completar huecos. Escritura valida metadata completa de su versión; lectura valida estructura/versiones y JSON sin reemplazar parámetros guardados por los del template actual. DETAIL V1 mantiene su significado pendiente; DETAIL V2 conserva basis gravimétrica, spacing, count/totales, días de referencia y origen empírico. No exponer paths/hosts/secretos.

## 20. Diagnostics

Ambos descriptors seleccionan `irrigation-diagnostics-v1`. Los items pertenecen a su snapshot, no al modelo activo. Writer valida ruleVersion de metadata y cada item, shape/severidad/JSON finito; reader verifica y conserva mensajes, evidence y orden. GET jamás llama buildDiagnostics.

P01–P05 no referencia widthM; sus field paths no cambian. Mantener source `R1_comparison` como linaje de reglas, no como identificador del Excel V2. No agregar D01–D08, aviso por daily=0 ni una interpretación física nueva del residual. RuleVersion igual no implica metadata igual: cada fila conserva su schema y sus hipótesis.

## 21. HISTORY mixto

Seguir usando una sola tabla y el join de propiedad `s.finca_id=f.id`, `f.user_id=userId`. Conservar filtro agrupado `(created_at<cursorTime OR (created_at=cursorTime AND id<cursorId))`, ORDER BY created_at DESC, id DESC, limit+1, sin OFFSET. Cursor opaco actual v1 queda intacto porque identidad y posición no cambian.

Proyección interna futura: HISTORY_COLUMNS actual **más `furrow_count`, `total_applied_volume_l` y `model_metadata`**. Se selecciona metadata para comprobar schemaVersion/implementationReference/diagnosticRuleVersion por fila; no se responde al cliente. No hace falta incluir days, totalM3 ni input completo. Es una query, sin consultas adicionales por fila. La proyección agrega costo JSON en hasta 101 filas por llamada; la medición futura de §31 deberá comprobarlo, sin afirmar rendimiento productivo.

Resolver cada fila a su reader summary. V1 emite exactamente el summary actual; V2 agrega **furrowCount y totalAppliedVolumeL**, números requeridos. En V1 se omiten, no null; appliedVolumeL sigue siendo por surco. Recortar la fila extra y computar nextCursor del último item devuelto como ahora. No ordenar en aplicación, saltar versiones desconocidas ni recalcular. No se promete fotografía estática entre páginas.

## 22. DETAIL mixto

La query actual select s.* con id/finca/ownership sirve para ambas versiones. Despachar por la fila, no por POST activo. Envelope sin cambios: simulation, model, input, output, metadata. V1 devuelve widthM y 14 magnitudes; V2 devuelve spacing+count y 19 magnitudes. Ambos plazos nullable V2 aparecen como null real.

Versiones, hash, diagnostics y parámetros históricos permanecen intactos. CreatedAt conserva ISO UTC con milisegundos. Sin PUT/PATCH/DELETE de simulaciones ni homogeneización artificial. Mantener el 404 común para recurso inexistente, ajeno o combinado con finca incorrecta.

## 23. POST V2 y API versioning

Mismo POST `/api/fincas/:fincaId/irrigation-simulations`, sin endpoint paralelo, selector de versión ni aliases. `postInput` en `irrigation-simulations.http.js` tomará el contrato activo de servidor en lugar del import estático INPUT_CONTRACT V1; la composición compartida con service garantiza la misma selección. Conservar name opcional, normalización, tipo JSON, query vacía, IDs estrictos y auth previa.

Request V1 con widthM recibe 400 claro: el adaptador actual usa INVALID_REQUEST y field furrow.widthM para campos desconocidos; si se delega al motor, UNKNOWN_FIELD/MISSING_FIELD via INVALID_IRRIGATION_INPUT. Falta spacing/count produce 400 con fields correctos. No exigir un código público literal UNKNOWN_FIELD si el filtro HTTP ya lo traduce a INVALID_REQUEST. Probar código/field/shape sin depender del mensaje humano. ModelVersion/contractVersion/sourceHash del cliente siguen rechazados.

La activación de POST V2 es el corte incompatible deliberado de R4F-B; GET conserva V1. No inferir versión por campos ni aceptar ambos bodies simultáneamente. Orden operativo cerrado en §32.

## 24. API / error mapping

| Situación | HTTP / código público | Conducta |
| --- | --- | --- |
| shape/tipo/dominio de input, count inválido o body V1 en POST V2 | 400, INVALID_REQUEST o INVALID_IRRIGATION_INPUT | sin insert; field/rule explícitos |
| overflow/nonfinite, underflow positivo, balance imposible | 422, IRRIGATION_MODEL_INCONSISTENCY; errors NON_FINITE_RESULT/MODEL_INCONSISTENCY | sin éxito parcial ni clamp |
| finca/simulación ajena o inexistente | 404, RESOURCE_NOT_FOUND | no filtrar existencia |
| DELETE finca con cualquier simulación | 409, FARM_HAS_IRRIGATION_SIMULATIONS; FK final FARM_DELETE_CONFLICT | rollback; Manning/finca intactos |
| versión/pair/schema/hash desconocido o storage inválido al leer | 500, INTERNAL_ERROR | error interno, nunca culpa del usuario |
| DB/commit/readback inesperado | 500, INTERNAL_ERROR | sin SQL/errno/stack/host |
| auth/tipo/parser/límite de body | 401/403, 415, 400 y 413 existentes | sin ampliar contratos ajenos |

No se necesita código público nuevo. El facade usa un error interno propio, **no hereda IrrigationApplicationError ni HttpInputError**: failure actual convierte esas clases a 400. Storage inválido tampoco se devuelve como MODEL_ERROR de input. Un 500 tras POST puede dejar incertidumbre de commit; mantener reconciliación manual, sin retries ni idempotencia nueva.

## 25. DELETE finca

Con tabla única basta el precheck actual de `src/routes/fincas.routes.js`: bloqueo de finca propia FOR UPDATE; SELECT id en irrigation_simulations por finca_id, sin filtrar versión; 409 si encuentra cualquiera. Si no hay dependientes, borrar Manning y finca en la misma transaction. FK RESTRICT sigue como defensa final.

No tocar esa ruta, FK ni tabla calculos por V2; ampliar pruebas futuras con filas V2 y mixtas. La alternativa de tablas separadas habría exigido comprobar dos conjuntos de dependientes de manera atómica, uno de los motivos de descarte.

## 26. Transactions / locks

POST V2 mantiene `service.create`: transaction(trx) → findOwnedFarm con lock=true/forShare() → cálculo puro → writer → INSERT → readback con trx → retorno → commit → 201. No sacar INSERT/readback fuera de trx ni adquirir el lock mediante otra conexión. Conservar normalización de nombre y ocultamiento de finca ajena.

DELETE usa FOR UPDATE sobre el mismo padre. Shared/exclusive coordina los dos caminos y la FK impide huérfanos. Tabla única y seis columnas nuevas no cambian este protocolo; la garantía R4D deberá recertificarse. Si POST gana, 201 y DELETE 409; si DELETE gana, 200 y POST 404 por finca ya eliminada. Comprobar ambos órdenes con conexiones reales, rollback, timeout/deadlock genéricos, sin retry ni cambio global de aislamiento.

## 27. Plan de migration futura

Nombre conceptual: **`20261014000000_extend_irrigation_simulations_v2.js`**, posterior a la migration de 20261012; no se crea aquí. No editar las cuatro migrations previas. Orden obligatorio de futura ejecución:

1. Con autorización de DB, backup fuera de Git y restauración comprobada; preflight de versión/engine/schema/CHECK/FK/índice, tracking Knex/lock, pairs y metadata/hash de todas las filas. Si hay versiones incompatibles, detener y reportar; no backfill ni borrado.
2. Ventana de mantenimiento sin escrituras ni DDL concurrentes. Detener writers, incluida administración; el lock de migrations Knex no bloquea writes de aplicación. No presuponer ALTER INSTANT/LOCK NONE ni DDL transaccional.
3. Agregar las seis columnas nullable sin default de negocio. Filas V1 quedan NULL sin UPDATE. Mantener los 38 campos, constraints, FK e índice existentes.
4. Agregar cuatro CHECK: pair cerrado, ausencia de extensión V1, dominio V2, días V2. La implementación podrá agrupar ADD COLUMN/ADD CONSTRAINT en un ALTER solo si compilador y servidor lo certifican; la política de recuperación contempla ejecución parcial si hay varias sentencias.
5. Inspeccionar schema/enforcement final; comparar filas V1 antes/después, seis NULL, tracking y lock libre. Verificar write/read V1 sobre schema ampliado en entorno aislado antes de activar V2.

MySQL DDL puede hacer commit implícito: no prometer que knex.transaction revierte seis ADD y cuatro CHECK como DML. Si falla parcialmente, bloquear rollout, inspeccionar qué operaciones se aplicaron y preparar recuperación aprobada. **No rerun/rollback ciego ni editar tracking Knex a mano.** La migration deberá fallar ante schema parcial inesperado, no usar IF NOT EXISTS para ocultarlo. No modificar datos para satisfacer constraints.

## 28. Down policy

**Down protegido:** únicamente con mantenimiento efectivo, sin writers, sin ninguna fila V2, con todas las filas restantes V1 soportadas y las seis columnas NULL. Si hay V2 o cualquier dato de extensión, rechazar **antes del primer DDL**. No borrar datos ni convertir V2 a V1 para superar el precheck.

Cumplidas precondiciones y backup: retirar cuatro CHECK nuevos, eliminar seis columnas, comprobar schema V1 original de 38 columnas/10 CHECK/FK/índice, tracking y filas intactas. No resetear AUTO_INCREMENT ni timestamps. Es down de la nueva migration, sin modificar el down histórico que droppea la tabla original.

Precheck y DDL no son un bloqueo atómico frente a otro writer; mantenimiento es requisito obligatorio. Con V2 existente, rollback del backend es hacia build compatible de lectura V1/V2 (§32), conservando schema ampliado. No volver al binario original, que interpretaría width_m como ancho V1 incluso en filas V2. Restaurar desde backup es otro procedimiento autorizado, nunca automático dentro de down.

## 29. Índices / tamaño / JSON

Conservar PK y `(finca_id, created_at, id)`. No agregar índices por versión/count/daily sin query que los use. HISTORY y DELETE empiezan por finca_id; DETAIL usa id/ownership. Verificar EXPLAIN con filas mixtas. El preflight de versiones es puntual y no justifica un índice permanente.

BIGINT y cinco DOUBLE agregan 48 bytes de payload numérico cuando están presentes, más bitmap NULL y overhead InnoDB; no es una predicción exacta de disco. Metadata V2 crece en JSON por hipótesis/unidades; diagnostics sigue JSON array. No cambiar JSON a TEXT ni mover magnitudes a JSON. Medir el costo de metadata interna en HISTORY; sin caches u optimización prematura.

## 30. Golden / suites futuras

Fixture independiente propuesto: **`test/fixtures/irrigation-v2-golden.js`**, módulo de datos sin tests autoejecutables. Contiene GV2-01 de R4F-B §26: 16 inputs, 19 outputs, metadata completa, hashes/versiones y P02/P04 completos. Usarlo en contrato/cálculo/mapper/HTTP/certificación; expected no debe obtenerse llamando al calculator bajo prueba. G01 legacy permanece intacto, con duración60/avance4.8.

| Suite futura / existente | Responsabilidad |
| --- | --- |
| test/irrigation.v2.contract.test.js | 16 inputs/19 outputs, shape/unidades, nullable, texture, autoridad, tipos/count |
| test/irrigation.v2.calculator.test.js | GV2-01 completo; equivalencia de 14 resultados heredados/diagnósticos; determinismo y aislamiento |
| test/irrigation.v2.boundaries.test.js | count válido/inválido, totales overflow, consumo/plazos underflow/overflow |
| test/irrigation.versions.test.js | registry/pair/hash/schema/case, unknown sin fallback, active bundle coherente |
| test/irrigation.versioned-persistence.test.js | writer/reader V1/V2, adapter number/string, seis NULL V1, null semántico V2 |
| test/irrigation.v2.http.test.js | POST V2, body V1 rechazado, zero-use201/null,422,ownership/error/commit |
| test/irrigation.mixed-history.test.js | V1/V2normal/V2zero, empates/limit/cursor, V1 sin extras y V2 con exactamente dos |
| test/irrigation.mixed-detail.test.js | shape por fila, width/spacing, 14/19, null, metadata pública, no recálculo, storage corrupto500 |
| test/irrigation.v2.schema.test.js | compilación offline y matriz de lógica SQL de tres valores; no prueba enforcement MySQL |
| suites V1 y fincas.delete.http.test.js | conservar regresiones puras/G01/Manning/UTC; agregar dependencias V2/mixtas de DELETE |
| certificación MySQL autorizada, fuera del test por defecto | schema/BIGINT/DOUBLE/null/JSON/UTC/locks/rollback/carreras y cleanup |

Count: 1,18,MAX_SAFE; rechazar0,−1,1.5,string,null,missing,>MAX_SAFE,NaN,Infinity. MAX_SAFE con GV2-01 produce total finito aunque grande: count exige comparación exacta y outputs tolerancia R1. Otra muestra debe mantener aplicado finito y forzar overflow solo al multiplicar count, sin un error anterior que oculte esa etapa.

Cero daily: E=0/K>0, E>0/K=0, ambos0 → daily0 y ambos días null. Ambos inputs positivos con underflow a0 → MODEL_INCONSISTENCY. Cocientes no finitos → NON_FINITE_RESULT; plazo positivo que underflowa a0 → MODEL_INCONSISTENCY. No epsilon ni clamp.

**Tests existentes:** `irrigation.persistence.test.js:70`, `:216` y `irrigation.http.test.js:233` usan modelos inventados para probar preservación. El mapper legacy directo puede conservar sus tests; la nueva frontera registry debe rechazar desconocidos. En el test HTTP de lectura válida futura, cambiar puntualmente el fixture al pair V1 soportado, manteniendo controles de parámetros/mensajes históricos sin recálculo, y agregar caso desconocido→500. Es consecuencia explícita de R4F-B, no permiso para aceptar versiones inventadas ni debilitar regresiones. Ningún test se modifica ahora; los conteos PASS finales se reportarán después de implementación.

## 31. Certificación MySQL futura

Plan de R4F-D, con autorización propia y sin ejecutarlo ahora:

1. Preflight read-only/TLS/UTC, schema y tracking; backup/restauración aislada. No omitir muestras V1 porque R4E reportó cero filas.
2. Poblar V1 antes de la expansión en entorno aislado; comparar después. Verificar BIGINT UNSIGNED, cinco DOUBLE nullable,14 CHECK,FK RESTRICT,índice y pair binario.
3. Inserciones negativas en transactions con rollback: pair cruzado/desconocido/case distinto; extensión no NULL en V1; count/daily/total ausente; count0/>MAX_SAFE; daily negativo; días NULL con daily>0, positivos con daily0, mixtos o≤0; totales≤0. Probar CHECK reales, sin tomar UNKNOWN como rechazo.
4. Roundtrip count1/18/MAX_SAFE en columna, mapper, HISTORY y DETAIL, con tipo efectivo number/string documentado. No cambiar configuración global. Probar SQL fuera de rango mediante string decimal exacto, no Number ya redondeado.
5. GV2-01: 16 inputs/19 outputs, metadata/diagnostics/hash completos, DOUBLE sin redondeo, JSON object/array,UTC/milisegundos. Zero daily conserva null en ambos plazos. Metadata V1 pendiente permanece intacta.
6. HISTORY mixto/cursor/empates/ownership y DETAIL sin calcular; POST ajeno404/sin insert; unknown storage500 genérico mediante doble o entorno aislado, sin deshabilitar constraints productivos.
7. Rollback por fallos antes de INSERT/readback/commit reportado; locks con dos conexiones y carreras POST V2/DELETE en ambos órdenes. Verificar ausencia de pérdida de Manning. Mocks no sustituyen conexiones reales.
8. Down rechazado con V2 sin DDL aplicado; down admisible con solo V1 en mantenimiento; rollback compatible con schema ampliado. Recuperación de DDL parcial se ensaya en DB aislada, no mediante fallos deliberados en Aiven compartido.
9. Cleanup solo de fixtures identificados, orden hijos→padres, conteos antes/después, tracking/lock y hashes. No resetear auto-increments; secretos/tokens/host/CA path fuera de Git y reportes.

Esto certificará implementación e integridad del entorno usado, no exactitud agronómica, exactly-once, disponibilidad bajo carga ni todos los interleavings.

## 32. Deploy / transición / rollback operativo

**Secuencia elegida:** schema compatible → build puente lector V1/V2 con POST V1 → corte controlado a POST V2 coordinado con R5. Sin flags públicos ni endpoint paralelo. No asumir que no existe consumidor V1 por estar fuera del repo backend.

1. Implementar y certificar R4F-D local/dev, sin publicar automáticamente. Preparar dos builds: **puente** con creación activa V1 y **final** con creación activa V2; ambos leen V1/V2. La selección es constante del servidor en composición, no un flag por request ni un framework configurable.
2. Con autorización operativa, respaldar/inventariar y aplicar migration aditiva. El backend previo sigue compatible con filas V1 y extensión NULL. Validar V1 antes de seguir; no crear filas V2 donde solo exista un lector original.
3. Desplegar puente y validar lectura/POST V1; conservar ese release como piso de rollback capaz de leer V2. No usar fixtures de producción como sustituto de certificación aislada.
4. Si R5 V2 aún no está listo, mantener puente POST V1 para usuarios actuales. V2 puede estar certificado en local/dev sin estar activo públicamente. Preparar R5 requiere autorización separada.
5. Cuando caller/frontend V2 esté listo y el corte autorizado: **ventana con servicio detenido**, sin depender de proxy/flags no acreditados. Impedir nuevas peticiones/escrituras, drenar o cancelar controladamente transactions en curso, desplegar backend final y frontend compatible, verificar versiones y no reabrir consumidores V1 contra POST V2. GET puede quedar temporalmente indisponible; zero downtime sería otro alcance.
6. Si falla tras existir filas V2, volver al puente y mantener schema ampliado. Coordinar consumidor para POST V1 o suspender escritura mientras se recupera. No volver al binario V1 original ni ejecutar down con V2. Si no hay V2 y se cumplen §28, rollback completo es posible en mantenimiento. No reenvío automático de POST.

El puente no contradice POST activo V2 final de R4F-B: es una release intermedia explícita, sin aliases ni selección del modelo por cliente. Activación pública y R5 no comienzan en R4F-C; backup/restore/deploy se autorizan cuando se soliciten.

## 33. Impacto frontend futuro

R5 crea escenarios V2 y distingue HISTORY/DETAIL por versiones. Ingresará Distancia entre surcos/Cantidad de surcos; mostrará consumo diario, plazos de referencia, aplicado por surco/total L/m³, inicio/mitad/final, pérdidas estimadas y eficiencia. Null de días no significa0,Infinity ni dato faltante; tampoco los valores numéricos significan días restantes desde hoy.

No reinterpretar widthM histórico ni completar totales V1. HISTORY V2 añade dos campos; DETAIL contiene resultados/metadata completos. Sin UI, cambios de componentes ni ajustes Manning ahora. Transición opera según §32, sin intentar reparar la incompatibilidad mediante retries.

## 34. Riesgos y controles

| Riesgo | Control elegido |
| --- | --- |
| nombre físico width_m ambiguo | mapping por versión y sin alias ni rename histórico |
| CHECK admite NULL por UNKNOWN | IS NOT NULL explícito y pruebas negativas de enforcement |
| pair case-insensitive | CAST AS BINARY y strings exactos en registry |
| count fuera de rango/retorno string | BIGINT UNSIGNED + CHECK seguro + adapter local estricto |
| metadata/hash corrupto | validación de aplicación;500 genérico sin regenerar |
| DDL parcial/down con writer concurrente | mantenimiento,backup,inspección,down rechazado con V2 |
| rollback original interpreta V2 como V1 | puente compatible como piso de rollback |
| corte POST sorprende consumidor V1 | puente hasta frontend/caller listo y mantenimiento coordinado |
| duplicación aritmética deriva | equivalencia de14 outputs/diagnostics y hashes congelados V1 |
| template activo borra historia | lectores sin cálculo ni regeneración de metadata |
| HISTORY más pesado por JSON | límite≤101,EXPLAIN/medición futura,sin query por fila |
| tests con versiones inventadas | fixture válido en caso exitoso y caso explícito unknown500 |
| QA pasada confundida con V2 certificado | separar evidencia offline y certificación futura |

## 35. Fases de implementación propuestas

No se inicia ninguno de estos bloques:

1. **D1 motor/contratos:** tres módulos V2,fixture GV2-01,guards/nullable/metadata/hash/reglas;V1 intacto;pruebas puras.
2. **D2 persistencia/versiones:** registry/facade/mappers,adapter count,queries mixtas y proyección metadata;tests offline/mocks;DELETE/Manning conservados.
3. **D3 migration:** archivo nuevo con seis columnas/cuatro CHECK/down protegido;compilación offline y DB aislada autorizada;roundtrip MAX_SAFE y DDL parcial.
4. **D4 HTTP:** composición puente/final,POST V2 estricto,HISTORY/DETAIL mixtos,zero daily/422/500/ownership/commit;regresión global con conteos exactos.
5. **D5 certificación/freeze:** MySQL/Aiven autorizado,locks/carreras/rollback/TLS/UTC/JSON/DOUBLE/BIGINT/null,cleanup y documentación. Sin claims científicos.
6. **D6 operación posterior:** despliegue/corte de §32 solo con autorización y consumidor V2 preparado. Cierre de implementación no equivale a activación pública.

El orden permite aplicar schema antes de activar POST V2. Implementación/certificación pueden ocurrir en checkout/DB aislados antes del rollout. No reescribir todas las pruebas V1 ni publicar cada bloque por separado.

## 36. Acceptance criteria y checkpoint

**¿Cumple íntegramente R4F-B? Sí, como diseño.** Tabla única y slot versionado conservan semántica API;16 inputs/19 outputs se almacenan;safe integer no se reduce;días nullable/referencia CC y4.5 empírico intactos;model/contract/metadata V2 y diagnostics V1;POST final activo V2 sin selector;HISTORY V1 sin extras y V2 con count/totalL;DETAIL por fila sin cálculo.

**¿Listo para R4F-D? Sí, tras autorización de implementación.** No se detectó incompatibilidad conceptual que obligue a modificar R4F-B. La nueva frontera sobre versiones inventadas en fixtures se explica en §30. Un preflight real futuro podría detectar datos incompatibles y bloquear rollout; no se corrigen silenciosamente.

Criterios obligatorios:

- Preservar38 columnas/10 CHECK/FK/índice/UTC y motor V1;44 columnas/14 CHECK tras expansión;no editar migrations previas.
- BIGINT UNSIGNED≤MAX_SAFE con roundtrip exacto y adapter number/string;DOUBLE y null con shapes contractuales.
- SQL impide pair cruzado,datos de extensión en V1,null requerido V2 y días incoherentes;app añade finitud,underflow y tipos.
- Registry/mappers/proyección por versión,motores independientes,G01 intacto/GV2-01 completo,sin GET que calcule ni fallback.
- HISTORY/cursor actual/DETAIL por fila/POST V2 y400/422/404/409/500 seguros;ownership/locks/rollback/Manning intactos.
- Down bloqueado con V2,rollback compatible,migration parcial visible,transición sin reinterpretar body V1 como V2.
- Reportar pruebas offline/locales y MySQL autorizado con conteos exactos,hashes,cleanup y diff;no llamar enforcement a la compilación.

QA R4F-C actual: inspección local de código/schema; compilación offline de seis columnas y cuatro sentencias CHECK, sin conexión; verificación Number de 1/18/MAX_SAFE y rechazo del siguiente; hash del Excel oficial confirmado. La matriz de las ramas documentadas de CHECK pasó **24 PASS / 0 FAIL** con lógica de tres valores, incluyendo NULL/UNKNOWN. No es ejecución SQL ni certificación de enforcement. El inventario local comprobó 38 columnas y diez CHECK existentes. No se creó ni ejecutó migration, no se accedió a DB/Aiven ni se implementó motor V2 o tests productivos.

Verificación de preservación: los **51 archivos preexistentes** del proyecto (excluidos `.git` y `node_modules`) conservan SHA-256 idéntico; cero modificados/eliminados y únicamente este documento agregado. R4F-B sigue sin seguimiento como al iniciar y su contenido no cambió. Rama/HEAD permanecen iguales, sin staging/commit/push. `git diff --check` sin errores; el documento nuevo se verificó aparte: 36 secciones numeradas, enlaces locales existentes y sin espacios finales. Los artefactos de SQL se mantuvieron en memoria, sin archivos auxiliares en el repositorio.

**DETENERSE. NO INICIAR R4F-D.**
