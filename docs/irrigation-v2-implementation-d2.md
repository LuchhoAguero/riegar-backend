# R4F-D2 — VERSIONADO Y PERSISTENCIA

Fecha: 2026-10-20, America/Buenos_Aires. Autoridades: [especificación](irrigation-v2-specification.md), [diseño](irrigation-v2-technical-design.md), [D1](irrigation-v2-implementation-d1.md). Alcance: registry, mapping y queries preparadas, con mocks/validación offline. Sin activación HTTP ni DB real.

## 1. Estado Git

Rama `feature/riego-surcos-v1`, HEAD `1f581dfc18f8e9ae18c3a88db1dd4c695a60d1ce`, sin staging/commit/push. Al iniciar ya existían sin seguimiento los archivos D1 y documentos R4F-B/C/D1; se preservaron byte a byte. De los60 archivos preexistentes solo cambia persistence, autorizado en D2;59 conservan SHA-256 idéntico, cero eliminados.

## 2. Archivos creados/modificados

Nuevos:

- `src/services/irrigation-simulations.versions.js`
- `src/services/irrigation-simulations.v2-mapper.js`
- `src/services/irrigation-simulations.versioned-mapper.js`
- `src/services/irrigation-simulations.snapshot.js`
- `test/irrigation.versions.test.js`
- `test/irrigation.versioned-persistence.test.js`
- `docs/irrigation-v2-implementation-d2.md`

Modificado: `src/services/irrigation-simulations.persistence.js`. El cuarto módulo interno snapshot comparte error, copiado JSON y validación estructural/provenance sin dependencias circulares; es un detalle auxiliar dentro del alcance aprobado, sin modificar contratos. No se reescriben R4F-B/C/D1.

## 3. Registry V1/V2

CONTRACT_REGISTRY explícito, congelado, con dos keys exactas. Cada descriptor apunta a models, contracts, validators, calculator y mapper de su versión; incluye las14 propiedades requeridas, referencias de funciones y nueve claves públicas congeladas. V1 reutiliza módulos/mapper existentes. Sin discovery, plugins, filesystem, configuración DB ni selección desde request.

## 4. Compatibilidad de versiones

resolveStoredVersion verifica contract/model pair exacto, sourceHash, metadataSchemaVersion, referencia de modelo interna, ruleVersion de metadata y de cada item. Sin trim/lowercase/coerción/fallback. El error interno IrrigationSnapshotError tiene code INVALID_IRRIGATION_SNAPSHOT y reason diferenciado: UNSUPPORTED_CONTRACT, MODEL_MISMATCH, SOURCE_HASH_MISMATCH, METADATA_SCHEMA_MISMATCH, DIAGNOSTICS_RULE_MISMATCH o SNAPSHOT_SHAPE_INVALID. No hereda errores HTTP ni de input de aplicación.

La estructura anidada de metadata se valida contra el schema de la versión almacenada, **sin copiar valores de ese template al snapshot**. Parámetros/mensajes/evidence históricos se conservan; datos requeridos faltantes, tipos incompatibles o JSON inseguro se rechazan. No se filtran esos detalles mediante nuevas rutas en D2.

## 5. Active descriptor

ACTIVE_V1 y ACTIVE_V2 permiten composición explícita e inyección interna. ACTIVE_DESCRIPTOR por defecto sigue V1. La fachada write admite un descriptor registrado por identidad; no lo elige desde el resultado/payload. Un resultado V2 con el descriptor por defecto V1 se rechaza. El servicio/rutas/parser existentes no importan el registry y continúan V1.

## 6. Mapper V2 write

Mapea43 columnas de insert (más id generado posteriormente):16 inputs,19 outputs, identidad, versiones/hash, JSON y Date. `furrowSpacingM→width_m`, sin columna ni alias adicional. Resultado debe ser exitoso, completo y canónico; valida tipos, dominios y provenance sin calcular fórmulas ni redondear. Clona datos seguros y entrega metadata objeto/diagnostics array, sin stringify anticipado. Name/IDs se validan con las utilidades legacy; errores de input de identidad en write mantienen su tipo de aplicación.

## 7. Mapper V2 read

Reconstituye input V2/output19/metadata/diagnostics exactamente desde columnas/JSON. Sin calculator, factory de metadata ni regeneración de diagnostics. Mantiene precisión Number, params históricos y mensajes/evidence. Rechaza columnas faltantes o tipos inválidos. Name/Date/IDs conservan semántica existente; sus errores al leer storage se convierten en error interno de snapshot.

## 8. furrowCount adapter

Write acepta solo Number entero seguro positivo. Read permite Number seguro o string decimal canónico con regex aprobada, BigInt para comprobar1..9007199254740991 y conversión posterior a Number. Rechaza espacios, signos, ceros iniciales, exponentes, fracciones, valores no seguros y tipos alternativos.

Se agrega comprobación `integer.toString() === value`: el ancla `$` de JavaScript puede coincidir antes de un salto final de línea. Esto impide aceptar `"18\n"` sin ampliar/cambiar el dominio canónico aprobado. No cambia la configuración mysql2 ni la validación HTTP.

## 9. Null days

Daily0 exige ambos plazos null explícitos; daily>0 exige Number finito positivo en ambos. No se convierte undefined→null,0→null,string→Number ni se omite campo. La relación de consumo nulo con inputs canónicos se verifica sin recalcular productos. Se prueban los tres casos ETo/Kc cero y combinaciones de almacenamiento inválidas.

## 10. Facade versionado

mapStoredDetailVersioned/mapHistorySummaryVersioned resuelven la fila y delegan al reader correspondiente. mapCalculationToSnapshotVersioned usa el descriptor explícito/default de servidor y comprueba coincidencia del resultado antes de delegar al writer. publicSnapshotVersioned proyecta snapshots por descriptor. Fallos de lectura/versionado son internos, sin fallback ni campos fabricados.

## 11. Mapper V1 preservado

Archivo legacy intacto. Write V1 conserva exactamente37 columnas: las seis extensiones se omiten y en el schema futuro corresponderán aNULL, sin defaults inventados. Lectura acepta fixtures/schema viejo sin esas columnas o tabla ampliada con ellasNULL; si una extensión V1 presente no esNULL, la fachada la rechaza.

DETAIL V1 conserva widthM/14outputs/metadata-v1. HISTORY V1 conserva el summary original y omite count/total adicional, sin placeholders. Las pruebas existentes de mapper/HTTP legacy con versiones sintéticas no se modificaron; la nueva frontera estricta se prueba aparte y aún no está integrada en HTTP.

## 12. Persistence

Cambio mínimo: query builder interno compartido; listSnapshots e HISTORY_COLUMNS conservan la lista y SQL anteriores. **listVersionedSnapshots y VERSIONED_HISTORY_COLUMNS son optativos**, agregando furrow_count,total_applied_volume_l,model_metadata. Ningún caller activo cambió para pedirlos. Así D2 no exige columnas todavía inexistentes en DB.

findOwnedFarm/findSnapshot, transacciones/ownership/cursor/orden y serialización de INSERT no cambian. JSON se serializa exactamente una vez en persistence; los mappers no usan stringify/parse para clonar. Compilación offline nueva limitada a verificar SELECT/column lists, sin conexión ni ejecución SQL.

## 13. HISTORY mixto

Filas V1/V2 normal/V2 zero mantienen orden suministrado. V2 agrega solo furrowCount y totalAppliedVolumeL; aplicado sigue por surco. V1 no incluye esos campos; nadie agrega days,totalM3 o metadata al summary. Unknown/corrupt row lanza error: no se salta ni abre huecos artificiales en cursor. Query ampliada conserva join ownership, condición agrupada de cursor, created_at/id DESC y limit+1.

## 14. DETAIL mixto

Envelope simulation/model/input/output/metadata sin homogeneizar: widthM/14 para V1; spacing+count/19 para V2. Zero-use V2 conserva ambos null presentes. Se contrastó lectura de objetos y texto JSON de DB, independencia de copias y preservación de valores históricos distintos de los que produciría un cálculo actual.

## 15. Metadata pública

Ambos descriptors declaran las nueve claves superiores. La nueva proyección conserva todo el contenido almacenado dentro de esas secciones y elimina campos superiores privados como internalDebug. No completa datos usando el template activo ni cambia parámetros históricos. El sanitizer HTTP actual no se modificó; su integración versionada será D4.

## 16. Diagnostics históricos

Ambas versiones exigen irrigation-diagnostics-v1 en metadata/items. Se valida shape/JSON finito/severidad e IDsP01–P05; se preservan mensaje/evidence/orden. No se ejecuta buildDiagnostics en lectores ni se deduce metadata por compartir ruleVersion. Sin reglas nuevas ni avisos por count/daily.

## 17. Tests registry

**9 PASS /0 FAIL:** descriptors exactos e inmutables; pares válidos; contratos desconocidos/case/espacios/prototipos; model/hash mismatch; schemas/rules; JSON incompleto/inseguro; getters sin invocar; estructura metadata sin reemplazo de parámetros; default/inyección de bundle sin inferencia del payload.

## 18. Tests persistence versionada

**17 PASS /0 FAIL:** mapping37/43 columnas; nombre/Unicode/IDs/Date; rechazos write; DETAIL object/text; V1/extensionsNULL; count Number/string/MAX_SAFE y rechazo de strings ambiguos; días null; preservación sin cálculo; metadata pública; mixtos; corrupción; serialización una vez y SELECT ampliado offline. No modificar expectativas ni archivos de tests anteriores.

## 19. Tests HISTORY/DETAIL

Los casos mixtos están dentro de la suite versioned-persistence, sin archivos opcionales ni nuevas entradas auxiliares del runner. Se prueban V1/V2 normal/V2 zero, shapes14/19, ausencia de placeholders, orden, summary exacto y error ante fila desconocida. La paginación HTTP actual queda cubierta por regresión V1; la integración HTTP mixta real corresponde a D4.

## 20. Regresión D1

**30 casos lógicos D1 PASS**, sin cambios a los tres módulos V2 puros, fixture GV2-01 o sus tres suites. El módulo fixture sigue contado una vez por el runner completo, igual que en D1; no se agrega otro fixture auxiliar descubierto automáticamente.

## 21. Regresión V1

**165 tests previos a D1 PASS** sin cambios, incluidos72 puros de motor y27 de persistence/HTTP V1. Los tests focalizados combinados de V1 engine/persistence/HTTP +D1+D2: **155 PASS /0 FAIL**. Mapper legacy, service, rutas, parser, status mapping, app, DELETE finca, Manning, UTC y migrations permanecen intactos. Las únicas líneas existentes modificadas son la extracción interna de HISTORY y exports/lista nueva de persistence.

## 22. npm test

**222 PASS /0 FAIL**, cero skipped/cancelled/todo. Desglose:196 entradas anteriores (165 legacy +30 lógicas D1 +1 módulo de datos) +26 casos D2. No DB/Aiven/MySQL real/TLS; HTTP local de suites existentes usa mocks DB/SMTP. No instalación o actualización de dependencias.

## 23. Hashes V1

Antes=después, idénticos a D1:

| src/services/irrigation/ | SHA-256 |
| --- | --- |
| irrigation-models.js | 6a1302569db4bd5902fb02d9ab08b6b131cd8bb155e510766dfff3937464afe8 |
| irrigation-validation.js | 7353589ce6810764085cbf9a1badb59e3458b8231e1a8acacae1ad1ed4b235a7 |
| irrigation-calculator.service.js | b2c785847f4962be991fb72a0986b9e5f2f8f1d8063e2a99cda2579f11ff1380 |

## 24. git diff --check

PASS. Nuevos archivos sin seguimiento comprobados aparte por whitespace.59 de60 archivos originales conservan SHA-256; solo persistence cambió como indica§12; ningún eliminado. Siete archivos nuevos D2 de§2. Git advierte futura conversión LF/CRLF en persistence; no se normalizaron otros archivos ni se hizo staging.

## 25. Riesgos / blockers

Sin blocker lógico D2 detectado. Los mappings son para tabla futura ampliada; **no usar listVersionedSnapshots ni insertar V2 en DB hasta D3/certificación**. El roundtrip con Number/string se prueba con mocks; no es certificación BIGINT/MySQL real. Activación de POST y uso de fachadas/proyección por HTTP siguen pendientes de D4.

Se añadió un helper interno de snapshots para evitar ciclos y duplicación de errores/copias; no hay cambio conceptual respecto R4F-B/C. No migration creada, schema modificado, retry/idempotencia, runoff, calibración o frontend. No conectar una consulta ampliada automáticamente para aprovechar el registry nuevo.

## 26. ¿R4F-D2 aprobado técnicamente?

**Sí, en el alcance autorizado offline/mocks:** registry, provenance, mappings y consulta preparada validados; V1/D1 y API activa preservados. No significa persistencia V2 real ni HTTP V2 activo.

## 27. ¿Listo para R4F-D3?

**Sí, para autorización de la siguiente subfase. D3 no iniciado.** Detenerse: no crear migration, tocar DB/Aiven, modificar rutas/parser/servicio activo, frontend, commit ni push.
