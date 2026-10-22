# R4F-E5-R — REANUDACIÓN Y CIERRE

Fecha: 2026-10-22. Resultado: **PASS para los requisitos pendientes de E5**, complementando las carreras ya certificadas. Destino exclusivo: **riegar-mysql-dev / defaultdb**, MySQL **8.4.11**. No se repitieron carreras ni se modificó código de aplicación.

## 1. Estado inicial

Autoridad de las carreras: [checkpoint E5 original](irrigation-v2-certification-e5.md), conservado íntegramente como registro histórico. POST-first201/409 y DELETE-first200/404, locks reales y Manning concurrente ya estaban aprobados. El `UNKNOWN_WRITER_STOP` posterior no conservó IDs y **sigue sin poder atribuirse retrospectivamente a un writer externo o a un falso positivo**.

Se capturaron los SHA256 de los80 archivos preexistentes antes de esta reanudación. Rama `feature/riego-surcos-v1`, HEAD `1f581dfc18f8e9ae18c3a88db1dd4c695a60d1ce`; cambios D anteriores preservados. La nueva evidencia privada reside en `C:/Users/aguer/.codex/private-backups/riegar/20261022-e5-resume/`, con permisos para el usuario actual y SYSTEM.

## 2. Mejora del writer detector

Cambios exclusivos en la utilidad privada. Antes de lanzar stop guarda snapshots separados y sanitizados:

- PROCESSLIST: ID, COMMAND, TIME, STATE, pertenencia al harness y clasificación. La identificación exacta de event_scheduler se convierte en un booleano en la consulta; no se guarda USER.
- INNODB_TRX: trx_id, trx_mysql_thread_id, trx_state, trx_started, trx_wait_started, pertenencia y clasificación.
- performance_schema.threads: THREAD_ID, PROCESSLIST_ID, PROCESSLIST_COMMAND, PROCESSLIST_STATE, TYPE; después de investigar el primer stop de E5-R, también NAME, que identifica la instrumentación interna y permite evitar exclusiones por un ID numérico.

No host, usuario, SQL de sesiones, credenciales, JWT ni CA. Los snapshots completos se escriben en `writer-guards.json`; cada stop además produce `writer-stop-N.json`, antes de lanzar la excepción. No se ignora una conexión desconocida solo por estar en Sleep o tener cero transacciones.

Registro de conexiones propias: ID obtenido del objeto real mysql2, verificado contra DATABASE()/VERSION()/CONNECTION_ID() antes de que Knex entregue la conexión. Un registro separado de conexiones en proceso de alta permite reconocer C únicamente si el ID coincide con un objeto real creado por este pool.

Seis comprobaciones offline del detector dieron PASS: daemon interno exacto aceptado; mismo ID con nombre de conexión cliente rechazado; nombre interno con comando Sleep rechazado; transacción desconocida rechazada; conexión propia en registro reconocida como C; otro ID no obtiene ese reconocimiento. Los casos de rechazo verifican persistencia de evidencia antes del stop. Estas comprobaciones no sustituyen la ventana real.

## 3. Resultado de clasificación

| Clase | Regla | Resultado real de la tanda definitiva |
| --- | --- | --- |
| A | ID de conexión propia registrada y verificada | Observer253614 y pool253618 |
| B | event_scheduler exacto; threads BACKGROUND; daemon interno identificado por nombre y atributos | Internos MySQL identificados; sin excluir conexiones cliente por prefijos o usuarios |
| C | ID coincide con objeto mysql2 del pool cuyo registro aún está en curso | Ningún caso real observado; caso controlado offline aprobado |
| D | Sesión cliente desconocida, incluida una visible solo en el snapshot posterior de threads | 0 en los16 controles definitivos |
| E | Transacción con thread no propio ni interno identificado | 0 en los16 controles definitivos |

Primer intento **E5-R**, anterior a toda fixture: la nueva observación conservó THREAD_ID40 / PROCESSLIST_ID7, FOREGROUND, Daemon, Suspending, ausente de PROCESSLIST y sin transacción externa observada. La clasificación conservadora inicial lo trató como D y detuvo la utilidad. La inspección posterior, solo de lectura, identificó **el mismo thread40/ID7** como `thread/sql/compress_gtid_table`.

Es un thread interno de compresión GTID; MySQL documenta que puede figurar como FOREGROUND/Daemon. Fuentes primarias: [manual MySQL, almacenamiento GTID](https://dev.mysql.com/doc/refman/8.4/en/replication-gtids-concepts.html) y [registro oficial sobre su clasificación FOREGROUND](https://bugs.mysql.com/77273). La regla se corrigió solo para la combinación exacta NAME=`thread/sql/compress_gtid_table`, TYPE=FOREGROUND y COMMAND=Daemon, además de las categorías internas ya identificadas. No se permite cualquier Daemon ni se fija una whitelist de ID7.

La evidencia de este primer intento E5-R permanece en el directorio raíz privado; `internal-thread-inspection.json` conserva la identificación. No hubo BEGIN de fixtures ni DML, y el ledger quedó vacío. `cleanupCommitted=false` indica que no había objetos para limpiar. El campo `cleanupFailure=UNKNOWN_WRITER_STOP` de esa utilidad corresponde a su comprobación final de writers dentro del bloque de cierre, no a un DELETE de cleanup fallido.

Después de esa identificación se inició una nueva ventana completa en `attempt-2/`. Esto corrige una clasificación demostrada en **E5-R**; no prueba la causa del stop anterior de **E5**, cuya evidencia carecía de IDs. No hubo retry de una escritura fallida o incierta.

## 4. Ventana limpia

Preflight definitivo: DATABASE defaultdb / versión8.4.11; TLSv1.3 / TLS_AES_256_GCM_SHA384 con CA y `rejectUnauthorized=true`; timezone del driver Z, servidor UTC; tracking5/lock0;44 columnas/14 CHECK ENFORCED; cuatro tablas de aplicación en0. Columnas, CHECK y DDL completo de las seis tablas cotejados con E2. Sin drift.

Dos guardas antes del DML a **14:46:12.009Z** y **14:46:14.337Z**, con intervalo explícito de1 segundo más el tiempo de consultas: D=0/E=0. Tercera guarda después de registrar el pool y antes de crear fixtures: **14:46:17.033Z**, también limpia.

En total **16 guardas reales limpias**, incluidas antes de POST inicial, FK, DELETE adicionales, cada POST de HISTORY, down, cleanup y cierre. La tanda definitiva transcurrió de **14:46:06.085Z a14:47:01.403Z**. Estas observaciones controlan esa ventana; no constituyen un bloqueo permanente a administradores o futuros writers.

## 5. Evidencia E5 preservada

El informe y los archivos privados del primer E5 no se modificaron. Las carreras conservan sus resultados y thread IDs originales253387/253390; no se ejecutó otro POST-first ni DELETE-first. La utilidad de E5-R excluye las funciones que orquestaban esas carreras.

El cierre integra **dos tandas de requisitos**: E5 para carreras/locks/Manning concurrente; E5-R para detector, FK, DELETE pendiente, EXPLAIN, down y reconciliación. El primer preflight detenido de E5-R no creó otra tanda de datos.

## 6. FK RESTRICT

Fixtures nuevas y exclusivas E5-R: usuario15, finca23, Manning12 y simulación V2 inicial45 comprometida por POST201 real. Ledger privado actualizado tras cada ID. JWT solo en memoria; auth, routers, service, mappers y Knex/mysql2 reales en listener loopback efímero.

En la conexión observer **253614** se abre transacción real. Se elimina provisionalmente **solo Manning12/finca23** dentro de esa transacción, para que su propia FK no enmascare la FK que se certifica. Después se intenta DELETE directo de finca23/user15: **ER_ROW_IS_REFERENCED_2, errno1451**, identificando `irrigation_simulations_finca_id_foreign`.

ROLLBACK confirmado, sin deshabilitar foreign_key_checks. Readback mediante conexión independiente **253618** confirma finca23, simulación45 y Manning12 presentes e idénticos al estado anterior, incluidos timestamps y valores persistidos. Fingerprint de ese estado completo: `c011bc7de131df0bcd75f04512dc126301a7c11ca08fd1d9b63c1b4a39caaed2`. La eliminación provisional de Manning quedó revertida, nunca comprometida.

## 7. DELETE ownership

Solo se ejecutaron los casos pendientes contra el router real:

| Caso | Resultado |
| --- | --- |
| Propietario15 / finca23 con simulación45 previamente comprometida | 409 FARM_HAS_IRRIGATION_SIMULATIONS |
| JWT de otro userId, sin crear un usuario adicional / finca23 | 404 |
| Propietario15 / finca inexistente4294967295 | 404 |

Ajena e inexistente devuelven exactamente `{ "error": "Finca no encontrada o no tienes permiso." }`. Tras los tres casos, readback independiente mantiene idénticos finca, Manning y simulación. No se repite DELETE exitoso: su atomicidad ya está acreditada en E5.

## 8. EXPLAIN HISTORY

Se crearon siete snapshots V2 adicionales por POST201: **ocho filas en total, IDs45–52**, con fechas UTC controladas y empates. No es una prueba de volumen. Se compiló el querybuilder real `listVersionedSnapshots`, sin sustituir su proyección, join o filtros, y se ejecutaron EXPLAIN tradicional, EXPLAIN FORMAT=JSON y SELECT real con los mismos bindings.

Cursor: created_at **2026-10-22T14:46:09.086Z**, id51; finca23, user15, limit2→SQL LIMIT3. Predicado y orden reales:

```sql
FROM irrigation_simulations AS s
INNER JOIN fincas AS f ON s.finca_id = f.id
WHERE s.finca_id = ? AND f.user_id = ?
  AND (s.created_at < ? OR (s.created_at = ? AND s.id < ?))
ORDER BY s.created_at DESC, s.id DESC
LIMIT ?
```

| Orden / alias | access type | possible_keys | key elegido | key_len | rows | filtered | Extra |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 1 / f | const | PRIMARY, fincas_user_id_foreign | PRIMARY | 4 | 1 | 100% | NULL |
| 2 / s | range | PRIMARY, irrigation_simulations_finca_created_id_idx | irrigation_simulations_finca_created_id_idx | 15 | 6 | 100% | Using index condition; Backward index scan |

JSON: `using_filesort=false`, `backward_index_scan=true`, used_key_parts=`finca_id,created_at,id`; coste estimado3.21. SHOW INDEX confirma PRIMARY y el índice BTREE visible de tres columnas en ese orden. El SELECT devuelve **50,49,48**, exactamente la porción esperada después del cursor. **PASS: índice coherente y utilizado realmente**, sin FORCE INDEX, índices nuevos, cambio del query productivo ni ANALYZE TABLE. Las estimaciones pertenecen a esta tabla pequeña, no garantizan rendimiento a escala.

## 9. Down rejection V2

Se mantuvieron las ocho filas V2 comprometidas. Se llamó **la función oficial `down(k)` con Knex real** de `20261014000000_extend_irrigation_simulations_v2.js`, sin invocar el migration runner. El interceptor privado registra verbos y resultados de consultas y bloquearía cualquier DDL antes de enviarlo al servidor; no intercepta las lecturas ni fabrica su resultado.

Ejecución real en thread253618:

1. SELECT de preflight:44 columnas+14 CHECK,58 filas; completado **14:46:45.970Z**.
2. SELECT oficial de incompatibilidad: devuelve **una fila `blocked=1`** por la presencia de V2; completado **14:46:46.205Z**.
3. Error oficial: `R4F-D3: down refused; requires only exact V1 pairs and six NULL extensions`.

**0 intentos DDL,0 ALTER y0 DROP ejecutados.** El error provino de la condición oficial, no de la protección adicional. Las ocho filas permanecieron intactas hasta su cleanup normal posterior; no se borraron para hacer pasar un down.

## 10. Tracking post-down

Comparación completa pre/post rechazo y contra preflight: **cinco migrations**, mismos IDs, nombres, batches y migration_time; una fila de lock con `index=1,is_locked=0`. Ningún DML de tracking, runner, desbloqueo manual ni estado parcial.

SHA256 del objeto JSON de tracking completo, igual antes/después: `3c7004f1242a4e5683f1a5dac484b2a08b06009aaa327394b8fa8c26949b228b`.

## 11. Schema post-down

**44 columnas /14 CHECK ENFORCED**, con igualdad de definiciones y expresiones antes/después del rechazo y al cierre. SHOW CREATE de las seis tablas y metadatos de columnas conservan FK RESTRICT, PK, índice, JSON, DATETIME(3) y source_hash CHAR(64) ASCII/ascii_bin. Una lectura adicional de INFORMATION_SCHEMA a **14:52:09.646Z**, guardada en `table-options-final.json`, confirmó **InnoDB / utf8mb4_0900_ai_ci** y reglas FK UPDATE/DELETE RESTRICT idénticas a E2; volvió a verificar los cuatro counts en0. No se depende de que SHOW CREATE incluya opciones de tabla bajo el SQL_MODE del servidor.

SHA256 de los seis DDL normalizados, con el mismo método y orden del checkpoint E5: `4f1a3347d680d5c550335cb65b1a1b19e3512d47c5e8fa73c0cd4fd3031a47dc`. Igual al preflight, post-rechazo y cierre; normalización limitada al valor numérico de AUTO_INCREMENT.

Fingerprint JSON de las ocho filas V2, igual antes/después del rechazo: `fce768aa89ee9501e6e0c50f94abc2a25dc3b083b110632b52cabc7d395f46b9`. No se confunden cardinalidades estimadas del optimizador con el schema físico ni con counts reales.

## 12. Cleanup

PASS. Sin carreras ni transacciones pendientes; listener loopback cerrado antes de cleanup y guardas limpias. Una transacción elimina exclusivamente IDs del ledger E5-R en orden: simulaciones45–52, Manning12, finca23/user15, usuario15. Cada DELETE presente exige exactamente una fila afectada. COMMIT confirmado; ledger `cleanupCommitted=true`.

No se tocaron IDs del primer E5. No DELETE amplio, reset AUTO_INCREMENT, cambios de constraints o foreign_key_checks. Instrumentación, caché de inyección y JWT efímero restaurados; conexiones privadas cerradas después del readback final.

## 13. Counts finales

| Tabla / comprobación | Resultado final |
| --- | --- |
| users | 0 |
| fincas | 0 |
| calculos | 0 |
| irrigation_simulations | 0 |
| knex_migrations | 5 |
| knex_migrations_lock | 1 fila; is_locked=0 |
| Columnas / CHECK ENFORCED | 44 /14 |
| Huérfanos simulaciones / Manning | 0 /0 |
| Sesiones externas / transacciones desconocidas | 0 /0 |

Última guarda a **14:47:01.400Z**. La cuenta de clasificaciones A en la evidencia incluye apariciones del mismo ID en PROCESSLIST y threads; no representa conexiones adicionales. No se afirma ausencia de threads internos ni ausencia permanente de futuros accesos.

## 14. TLS/UTC

Inicio y cierre PASS: **TLSv1.3 / TLS_AES_256_GCM_SHA384**, certificado verificado, sin fallback inseguro; session/global SYSTEM, system UTC, NOW−UTC_TIMESTAMP=0 segundos; driver timezone Z.

Runtime local Node24.16.0, Knex3.1.0, mysql2 3.24.4. No instalación, update o cambio de configuración persistente. Timeout de locks12s únicamente en conexiones del harness, sin cambio global o de aislamiento.

## 15. npm test

Después del cleanup: **251 PASS /0 FAIL**,0 cancelados,0 skipped,0 todo; duración reportada **2164.5564ms**. Los seis checks adicionales del detector son privados y se reportan aparte, no inflan el total251 del repositorio.

`git diff --check` PASS; avisos históricos de conversión LF→CRLF en seis archivos previos, sin errores de whitespace. No se modifica ningún archivo preexistente; solo se agregan este checkpoint y el freeze. Sin stage, commit ni push.

## 16. Hashes V1

Verificados nuevamente tras cleanup:

| Archivo en src/services/irrigation/ | SHA256 |
| --- | --- |
| irrigation-models.js | `6a1302569db4bd5902fb02d9ab08b6b131cd8bb155e510766dfff3937464afe8` |
| irrigation-validation.js | `7353589ce6810764085cbf9a1badb59e3458b8231e1a8acacae1ad1ed4b235a7` |
| irrigation-calculator.service.js | `b2c785847f4962be991fb72a0986b9e5f2f8f1d8063e2a99cda2579f11ff1380` |

## 17. Limitaciones

- La alerta del primer E5 sigue sin atribución retrospectiva. Se preserva esa incertidumbre; E5-R acredita una nueva ventana observada, detector corregido para un interno identificado y captura suficiente ante un nuevo D/E. No se afirma un writer externo confirmado ni un falso positivo del primer E5.
- Restore aislado **no probado**, sin clon autorizado. El backup lógico E1 sigue presente:9551bytes, SHA256 `b7f13068db8e5151c3d5c2a954144f0e08967506804ce4f8ce5b7e2643d605a6`, comprobados nuevamente; integridad del artefacto no equivale a recuperabilidad probada. Se conserva la excepción aceptada para dev vacío, sin extenderla a producción.
- Down destructivo exitoso real **no probado ni ejecutado**; cobertura offline y rechazo seguro con V2 son evidencias distintas. No se creó otro ambiente.
- Coeficiente4.5 empírico/no calibrado; certificación técnica no implica validación científica/agronómica.
- Sin idempotency/exactly-once; commit incierto requiere reconciliación y no autoriza retry automático. Sin claims de benchmark, aislamiento de máquina o exclusión global de writers.
- Sin frontend R5, deploy o cutover público V2. ACTIVE_DESCRIPTOR sigue V1.

## 18. Freeze V2

Se emite [irrigation-v2-backend-freeze.md](irrigation-v2-backend-freeze.md), integrando E1–E4, E5 previo y E5-R. Los requisitos funcionales/técnicos solicitados quedan PASS dentro del entorno y las limitaciones declaradas. No se transforma restore o down exitoso no probado en un PASS.

## 19. ¿Backend V2 certificado?

**Sí, para el alcance técnico de R4F-E sobre el dev autorizado**, con las limitaciones explícitas anteriores. Motor, almacenamiento versionado, contratos HTTP internos, transacciones, rollback, locks en ambos órdenes, FK, cursor/EXPLAIN, down protegido y reconciliación cuentan con las evidencias locales/reales distinguidas en E1–E5-R. No es certificación de frontend, deploy público ni calibración agronómica.

## 20. ¿R4F-E cerrado?

**Sí, cierre técnico con limitaciones conocidas.** La detención anterior queda trazada, no borrada. No blocker funcional pendiente dentro de los controles pedidos; restore aislado y down destructivo real siguen como límites de evidencia y no se ejecutan en este cierre.

## 21. ¿Puede iniciar R5?

**GO técnico para la siguiente fase R5**, sujeto a su alcance e instrucción propios. **R5 no se inicia aquí**. El default público continúa V1; corte público y despliegue requieren coordinación posterior. Sin frontend, deploy, commit ni push en E5-R.
