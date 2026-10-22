# RiegAR — Freeze técnico del backend V2

Fecha: **2026-10-22**. Estado: **R4F-E cerrado técnicamente**, con las limitaciones de recuperación y modelo declaradas en este documento. Certificación sobre **riegar-mysql-dev / defaultdb, MySQL8.4.11**; no certifica otros ambientes ni habilita un despliegue público.

Autoridades: [especificación B](irrigation-v2-specification.md), [diseño C](irrigation-v2-technical-design.md), implementación D1–D5 y certificaciones E1–E5-R. La fuente XLSX oficial es exclusivamente **Riego Pepe Ag ( lucho) (2).xlsx**, interpretada junto con las confirmaciones más recientes del cliente registradas en B. Versiones anteriores son históricas.

## Identidad congelada

| Identificador | V2 |
| --- | --- |
| modelVersion | irrigation-estimation-v2 |
| contractVersion | irrigation-contract-v2 |
| metadataSchemaVersion | irrigation-metadata-v2 |
| diagnosticsRuleVersion | irrigation-diagnostics-v1 |
| sourceHash | `30b031d7bd3aa4365c65b6750a91a4004db4ef3452c99bf3924698b89f9dec3b` |

V2 conserva el contrato aprobado de16 entradas conceptuales y19 magnitudes de salida; separación entre surcos y cantidad son explícitas. Cantidad es entero seguro1–9007199254740991, sin coerción. Uso diario0 produce los dos indicadores de días en NULL, sin divisiones ficticias. Metadata versionada y reglas P01–P05 preservan la procedencia y sus límites de interpretación.

V1 permanece registrada como irrigation-estimation-v1 / irrigation-contract-v1 / irrigation-metadata-v1 / irrigation-diagnostics-v1, sourceHash `42592487e6e07deb1b25a073d74086a09c1bb19cb38411aafc31d28ea64d2127`. Snapshots históricos son inmutables: no recálculo, backfill inventado o fallback de versiones desconocidas.

## Estado de código y reproducción

Rama `feature/riego-surcos-v1`, HEAD base `1f581dfc18f8e9ae18c3a88db1dd4c695a60d1ce`. La implementación D está en el árbol de trabajo, **sin commit**; ese HEAD por sí solo no contiene todo el material certificado. E5-R no cambió código de aplicación, tests, migrations ni dependencias.

Manifest privado `20261022-e5-resume/attempt-2/freeze-manifest.json`, bajo el directorio privado de evidencia RiegAR: SHA256 del JSON compacto del array ordenado de `{file,sha256}` para todos los JavaScript de src/, las cinco migrations y package.json/package-lock.json (**34 archivos**):

`85d853a4af7ed5d954fb58d265c8d841f6305df109bab06dffa7faf05b372f75`

No incluye .env, certificados, credenciales ni dumps. Las verificaciones posteriores deben cotejar el contenido de trabajo y sus hashes, no solo el nombre de la rama. Runtime observado: Node24.16.0, Knex3.1.0, mysql2 3.24.4; no se certifican otras versiones por inferencia.

## Schema y migration

`irrigation_simulations`: **44 columnas /14 CHECK ENFORCED**, InnoDB, utf8mb4 / utf8mb4_0900_ai_ci, coincidente con E2 y confirmado también mediante INFORMATION_SCHEMA al cierre. PK id INT UNSIGNED AUTO_INCREMENT; finca_id INT UNSIGNED con FK RESTRICT; JSON nativo en metadata/diagnostics; created_at DATETIME(3), UTC; source_hash CHAR(64) ASCII/ascii_bin.

Índice visible BTREE `irrigation_simulations_finca_created_id_idx (finca_id,created_at,id)`. Las seis extensiones son furrow_count BIGINT UNSIGNED y cinco DOUBLE nullable sin defaults de negocio; V1 exige las seis NULL. CHECK binarios validan pares exactos V1/V2, extensiones y consistencia de días. width_m interpreta widthM en V1 y furrowSpacingM en V2 mediante dispatch explícito.

Migration ampliatoria instalada: **20261014000000_extend_irrigation_simulations_v2.js**, batch5, SHA256 de archivo `145df8c330791cbfcb5003cf515bbd48d4f5808d8e7f65537a972c75ca679932`. Tracking final:cinco migrations, una fila de lock desbloqueada. No tracking manual ni estado parcial.

Fingerprint de los seis SHOW CREATE normalizados, según método E5/E5-R: `4f1a3347d680d5c550335cb65b1a1b19e3512d47c5e8fa73c0cd4fd3031a47dc`. Schema, columnas, CHECK y tracking permanecieron iguales tras el rechazo oficial del down y el cleanup.

## API y transición

Endpoints de snapshots existentes:

- POST `/api/fincas/:fincaId/irrigation-simulations`.
- GET HISTORY en la misma colección, con limit/cursor.
- GET DETAIL `/api/fincas/:fincaId/irrigation-simulations/:simulationId`.

**Puente público actual: ACTIVE_DESCRIPTOR=ACTIVE_V1.** POST acepta exclusivamente el contrato activo V1 y no permite selección de versión por el cliente. La composición final interna con ACTIVE_V2 fue certificada: POST V2 estricto calcula en servidor, shared-lock de la finca propia, INSERT/readback en transacción y201 solo después del commit. Activarla públicamente requiere el corte coordinado con R5; este freeze no lo hace.

GET despacha según la versión persistida V1/V2, valida procedencia/metadata y devuelve el snapshot guardado sin calcular de nuevo. HISTORY usa ownership join, cursor compuesto `(created_at,id)`, orden descendente y limit+1. Pares/hashes/metadata desconocidos o incompatibles no caen al contrato activo. No API nueva para editar o borrar snapshots.

DELETE de finca conserva su comportamiento histórico: lock exclusivo del parent; con simulaciones→409 FARM_HAS_IRRIGATION_SIMULATIONS sin perder Manning; sin simulaciones→elimina Manning y finca en una transacción. La FK protege el parent ante acceso directo. Ownership ajeno/inexistente no revela existencia y responde404.

Después de persistir V2, el piso de rollback de aplicación es el **puente lector versionado sobre schema ampliado**; no el binario V1 original. MySQL DDL puede autocommit. No down automático ni retries ante estado incierto; preservar schema y reconciliar antes de decidir recuperación.

## Evidencia de certificación

| Fase | Evidencia / resultado |
| --- | --- |
| [E1](irrigation-v2-certification-e1.md) | Preflight real, TLS/UTC, inventario y backup lógico. Restore aislado pendiente; restricción operativa tratada en la autorización E2 para dev vacío, no convertida en prueba de recuperación. |
| [E2](irrigation-v2-certification-e2.md) | UP oficial una vez;44 columnas/14 CHECK; batería SQL mínima14/14; tracking5/lock0, sin drift. Excepción de restore aceptada solo para este dev. |
| [E3](irrigation-v2-certification-e3.md) | Roundtrip bridge V1/V2, golden, zero daily, count1/18/MAX_SAFE, DOUBLE/JSON/UTC, historial mixto y rollback reales. |
| [E4](irrigation-v2-certification-e4.md) | Tanda definitiva70/70 requests conformes; auth/ownership/errores, cuatro puntos de rollback y commit confirmado con respuesta fallida reconciliada sin replay; ambos ledgers limpiados. |
| [E5](irrigation-v2-certification-e5.md) | POST-first201/409 y DELETE-first200/404; esperas reales S/X en performance_schema e INNODB_TRX; Manning concurrente correcto. Stop posterior preservado, sin atribución retrospectiva. |
| [E5-R](irrigation-v2-certification-e5-resume.md) | Detector con captura previa al stop y clasificación de interno demostrada;16 guardas limpias; FK1451/rollback y readback independiente; DELETE409/404/404; EXPLAIN usa índice compuesto, sin filesort; down oficial rechaza V2 tras dos SELECT y antes de DDL; cleanup/reconciliación completos. |

**E5 se completó en dos tandas de requisitos**, sin repetir carreras. La alerta antigua sin IDs no se reclasifica por intuición; la reanudación acredita una ventana nueva y conserva el registro del primer stop. En E5-R hubo además un preflight detenido sin DML, cuyo thread interno sí pudo identificarse y cuya clasificación se corrigió solo en la utilidad privada.

Cierre E5-R: users0/fincas0/calculos0/irrigation_simulations0; huérfanos0; migrations5/lock0;44 columnas/14 CHECK; D/E0; TLSv1.3 y UTC comprobados. Listeners y conexiones privadas cerrados. Ninguna fixture permanente.

Regresión final: **251 PASS /0 FAIL**, sin skipped/cancelled/todo. git diff --check PASS. Los80 archivos preexistentes a E5-R conservan sus contenidos; solo se agregan el checkpoint de reanudación y este freeze.

Hashes congelados V1, verificados nuevamente:

| Archivo en src/services/irrigation/ | SHA256 |
| --- | --- |
| irrigation-models.js | `6a1302569db4bd5902fb02d9ab08b6b131cd8bb155e510766dfff3937464afe8` |
| irrigation-validation.js | `7353589ce6810764085cbf9a1badb59e3458b8231e1a8acacae1ad1ed4b235a7` |
| irrigation-calculator.service.js | `b2c785847f4962be991fb72a0986b9e5f2f8f1d8063e2a99cda2579f11ff1380` |

## Limitaciones conocidas y siguiente fase

- **Restore en ambiente aislado no probado**, sin clon autorizado. El backup E1 existe y mantiene su checksum; eso no demuestra restaurabilidad. No extender la excepción del dev vacío a producción.
- **Down exitoso destructivo real no probado ni ejecutado**. Se certificó el rechazo seguro con V2 y se mantiene cobertura offline del camino permitido; son alcances distintos.
- Coeficiente4.5 empírico/no calibrado y diagnósticos no validados científicamente. La certificación es técnica, no agronómica.
- No idempotency/exactly-once. Un commit incierto exige reconciliación; no retry automático. No garantía de rendimiento a escala, disponibilidad permanente o ausencia futura de escritores.
- **Sin frontend R5 ni cutover público V2**. ACTIVE_DESCRIPTOR default V1 permanece; coordinación de consumidor, activación y despliegue queda para una fase posterior.

Backend V2 certificado dentro de este alcance y **GO técnico para preparar/iniciar R5 cuando se indique su fase**. Este cierre se detiene aquí: no se inicia R5, no deploy, no commit ni push.
