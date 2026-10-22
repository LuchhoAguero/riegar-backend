# R4F-E5 — CERTIFICACIÓN FINAL BACKEND V2

Fecha: 2026-10-22. Destino autorizado: **riegar-mysql-dev / defaultdb**, MySQL **8.4.11**. Estado: **PARCIAL / DETENIDO**, sin freeze final.

Las dos carreras reales dieron PASS. Inmediatamente después, la renovación del control de writers lanzó `UNKNOWN_WRITER_STOP`. Se detuvieron las pruebas restantes, se cerraron las requests/transacciones/listener y se limpiaron exclusivamente las fixtures del ledger. No se reinició la tanda ni se reintentaron operaciones. El control posterior resultó limpio, pero no identifica retrospectivamente el origen de la alerta. Se aplica la instrucción expresa de E5: «Si drift/writer desconocido: DETENER».

Evidencia privada: `C:/Users/aguer/.codex/private-backups/riegar/20261022-e5/`, con permisos limitados al usuario actual y SYSTEM. Contiene utilidad, preflight, ledger, progreso y evidencia final; no credenciales, JWT, host completo ni CA. El resultado global de la utilidad es `pass: false`, aunque ambas carreras terminaron conforme al contrato.

## 1. Preflight

PASS al inicio. Primera consulta de observación: DATABASE()/VERSION()/CONNECTION_ID(); configuración restringida al destino dev, CA presente, `rejectUnauthorized: true`, timezone `Z`, sin fallback inseguro. TLS real **TLSv1.3 / TLS_AES_256_GCM_SHA384**. Zona session/global SYSTEM, sistema UTC y diferencia NOW−UTC_TIMESTAMP de **0 segundos**.

Cuatro tablas de aplicación vacías; cinco migrations; una fila de lock con `is_locked=0`; **44 columnas y 14 CHECK ENFORCED**. Columnas y expresiones CHECK cotejadas con E2; SHOW CREATE de las seis tablas coincide con E2, normalizando únicamente el valor numérico de AUTO_INCREMENT cuando exista. Permisos de lectura de `performance_schema.data_lock_waits`, `data_locks` y `threads` comprobados antes de crear fixtures.

PROCESSLIST/INNODB_TRX iniciales: cero sesiones o transacciones desconocidas. Solo se excluye el daemon interno `event_scheduler`; las conexiones propias se reconocen por sus thread IDs. La guarda se renueva antes de cada carrera.

La renovación posterior a las carreras detectó una sesión **o** transacción fuera del conjunto propio. Limitación de la utilidad: en esa excepción conserva el código de detención, pero no el ID ni cuál de las dos consultas disparó la condición. Por eso no puede atribuirse con evidencia a un backend externo, a una sesión administrativa o a una clasificación incorrecta. No se interpreta su desaparición posterior como resolución de la causa.

## 2. Fixtures

Un usuario SQL temporal **14**; dos fincas **21 (POST_FIRST)** y **22 (DELETE_FIRST)**, ambas del mismo usuario; cálculos Manning **10→21** y **11→22**. Una simulación V2 **44→21**, creada mediante POST real. Ledger privado actualizado con cada ID antes de continuar; ningún dato ajeno.

Manning rectangular calculado por el engine existente, sin modificarlo: b=2, h=1, n=0.03, S=0.001; la fila persistida conserva A=2, P=4 y Q_m3s=1.328073. Email sintético example.invalid y password_hash de fixture sin uso de login.

Express solo en 127.0.0.1, puerto efímero. Router DELETE de fincas y router de simulaciones, auth, service, mappers y persistence reales. Ambos usan el mismo Knex real; la composición privada inyecta ese Knex al módulo de fincas mediante su caché de importación, sin cambios de código del repositorio. JWT efímero firmado solo en memoria del proceso hijo. V2 se selecciona únicamente en la composición interna de prueba.

## 3. Race POST-first

**PASS: POST 201 / DELETE 409 FARM_HAS_IRRIGATION_SIMULATIONS.**

POST thread **253387** comienza su transacción y completa el shared lock de finca21 a **14:35:13.807Z**. La barrera se mantiene después de la consulta ejecutada realmente en MySQL. DELETE thread **253390** comienza otra transacción e intenta FOR UPDATE a **14:35:15.346Z**.

Espera real observada a **14:35:16.047Z**. Solo después se libera POST, a **14:35:16.505Z**. INSERT de simulación44 completado a **14:35:16.741Z**, readback completado a **14:35:16.973Z**, COMMIT iniciado a **14:35:16.974Z** y confirmado al cliente a **14:35:17.214Z**. MySQL libera el bloqueo durante el commit; DELETE completa su consulta bloqueada a **14:35:17.211Z**, comprueba la dependencia y confirma ROLLBACK a **14:35:17.647Z**.

Respuestas: POST a **14:35:17.219Z**, DELETE409 a **14:35:17.648Z**. Readback independiente comprueba finca y Manning idénticos a sus filas iniciales, y una simulación persistida. Sin retry.

## 4. Race DELETE-first

**PASS: DELETE 200 / POST 404.**

DELETE thread **253390** completa FOR UPDATE de finca22 a **14:35:19.213Z** y se detiene en barrera. POST thread **253387** intenta shared lock a **14:35:19.445Z** y queda esperando realmente. Observación del servidor a **14:35:20.104Z**; liberación de DELETE a **14:35:20.553Z**.

DELETE encuentra cero simulaciones, elimina Manning11 y finca22 dentro de la misma transacción y confirma COMMIT a **14:35:21.426Z**, con HTTP200. POST completa la lectura bloqueada a **14:35:21.430Z**, ya sin finca; termina su transacción sin escritura y responde404 a **14:35:21.661Z**. Contadores: **0 cálculos y 0 intentos de INSERT** para ese POST. Readback: finca22, Manning11 y simulaciones de finca22 ausentes. Sin huérfanos ni retry.

## 5. Locks observados

Evidencia de `performance_schema.data_lock_waits` unida con `threads` y `data_locks`, corroborada por INNODB_TRX y PROCESSLIST. Dos conexiones independientes, con los mismos IDs intercambiando funciones:

| Carrera | Solicitante | Bloqueante | Objeto/índice/registro | Solicitado | Concedido al bloqueante |
| --- | --- | --- | --- | --- | --- |
| POST-first | 253390 DELETE | 253387 POST | fincas / PRIMARY / 21 | X,REC_NOT_GAP — WAITING | S,REC_NOT_GAP — GRANTED |
| DELETE-first | 253387 POST | 253390 DELETE | fincas / PRIMARY / 22 | S,REC_NOT_GAP — WAITING | X,REC_NOT_GAP — GRANTED |

En ambos casos INNODB_TRX muestra **LOCK WAIT** para el solicitante y **RUNNING** para el bloqueante. PROCESSLIST muestra el solicitante ejecutando Query y el bloqueante en Sleep mientras la barrera mantiene abierta su transacción. La liberación depende de observar la relación real de espera, no de un delay supuesto.

Pool máximo3; timeout de lock **12 segundos solo en las conexiones privadas del harness**; barreras y finalización acotadas a15 segundos, más cierre acotado de requests. No se cambia aislamiento ni configuración global. No hubo deadlock, timeout de lock ni commit ambiguo en las carreras. La detención posterior corresponde a la guarda de writers.

## 6. FK RESTRICT

**PENDIENTE.** El intento directo de DELETE del parent dentro de transacción no se ejecutó: la guarda detuvo la utilidad antes de BEGIN de esta prueba. No se atribuye a E5 evidencia de error1451 ni rollback de Manning por FK. La existencia estructural de la FK sí se preserva en el cotejo del schema.

## 7. DELETE route

PASS real en las carreras: con simulación recién comprometida→409 `FARM_HAS_IRRIGATION_SIMULATIONS`; sin simulación→200 con eliminación transaccional de finca y Manning. Son requests al router real existente.

Pendientes en esta tanda E5: comprobaciones adicionales de ownership ajeno/inexistente y conflicto sobre simulación previamente existente fuera de la carrera. Los tests locales existentes siguen aprobados; no sustituyen estas observaciones reales pendientes.

## 8. Manning preservation

**PASS en ambas carreras.** Tras el conflicto de finca21, Manning10 coincide íntegramente con el readback inicial, incluidos timestamps y valores DECIMAL. Tras DELETE exitoso de finca22, Manning11 está ausente, según el comportamiento histórico.

La prueba adicional de preservación frente al rechazo FK directo está pendiente. Ninguna modificación del engine Manning.

## 9. EXPLAIN HISTORY

**PENDIENTE.** No se crearon las siete simulaciones adicionales previstas ni se ejecutó EXPLAIN. Sigue pendiente observar ownership join, cursor compuesto, ORDER DESC, LIMIT n+1, índices posibles/elegidos, estimaciones, filesort y orden de join en MySQL real.

No se agregaron ni forzaron índices. La presencia estructural del índice existente se conserva en SHOW CREATE, pero no se presenta como un plan EXPLAIN observado.

## 10. Down rejection con V2

**PENDIENTE.** No se llamó al down oficial ni al migration runner. La simulación44 permaneció hasta el cleanup normal, pero no llegó a usarse para probar el rechazo. No hubo DDL, down exitoso ni eliminación para hacer pasar un down.

El diseño previsto era ejecutar únicamente la función oficial `down` con sus dos lecturas reales y un interceptor que impediría alcanzar ALTER; tampoco se ejecutó ese diseño después de la detención.

## 11. Tracking tras rechazo

No hubo rechazo de down ejecutado. **Tracking final intacto respecto del preflight**, con comparación completa de filas, incluidos migration_time: cinco migrations, batches1–5; una fila de lock (`index=1`, `is_locked=0`). No se ejecutó una operación del runner que alterara tracking o lock.

Última migration instalada: `20261014000000_extend_irrigation_simulations_v2.js`. La comprobación específica pre/post down sigue pendiente.

## 12. Schema tras rechazo

No hubo ejecución de down; se verificó **schema pre/post tanda**, sin drift:44 columnas,14 CHECK ENFORCED, expresiones completas y SHOW CREATE de las seis tablas idénticos. Se conservan PK, FK, índice, JSON, DATETIME(3), source_hash ASCII/ascii_bin, InnoDB y charset/collation del baseline E2.

SHA256 del objeto JSON con los seis SHOW CREATE normalizados, en orden users/fincas/calculos/irrigation_simulations/knex_migrations/knex_migrations_lock: `4f1a3347d680d5c550335cb65b1a1b19e3512d47c5e8fa73c0cd4fd3031a47dc`, idéntico al preflight. Es un fingerprint de DDL, no de datos ni una afirmación sobre contadores AUTO_INCREMENT. No se reiniciaron secuencias.

## 13. Cleanup

PASS. Antes de limpiar, ambas carreras estaban terminadas, sin requests pendientes; listener loopback cerrado y barreras liberadas. Transacciones de carrera ya habían confirmado COMMIT/ROLLBACK. Se restauraron las instrumentaciones del proceso privado.

La guarda de writers volvió a resultar limpia antes del cleanup. Una transacción eliminó exclusivamente objetos del ledger en orden: simulación44; Manning10; finca21; usuario14. Se comprobó que Manning11 y finca22 ya habían sido eliminados por DELETE exitoso y no se intentó borrarlos otra vez. Cada objeto presente exigió exactamente una fila eliminada. Commit de cleanup confirmado y `cleanupCommitted: true` en ledger.

No DELETE amplio, foreign_key_checks=0, reset de AUTO_INCREMENT ni fixture fuera de ledger. Conexiones privadas cerradas después del readback final. La causa de la alerta anterior sigue sin resolver aunque la guarda de cleanup y cierre resulte limpia.

## 14. Counts finales

| Tabla | Filas finales |
| --- | ---: |
| users | 0 |
| fincas | 0 |
| calculos | 0 |
| irrigation_simulations | 0 |
| knex_migrations | 5 |
| knex_migrations_lock | 1; is_locked=0 |

Huérfanos simulaciones→fincas:0; Manning→fincas:0, tras carreras y al cierre. Guarda final:0 sesiones desconocidas y0 transacciones ajenas. Una inspección independiente de lectura posterior volvió a mostrar únicamente su propia sesión y event_scheduler, con INNODB_TRX vacío. Esa lectura posterior no reconstruye la alerta transitoria.

## 15. TLS/UTC final

PASS al cierre: TLSv1.3 / TLS_AES_256_GCM_SHA384, certificado verificado; session/global SYSTEM, system UTC, diferencia NOW−UTC_TIMESTAMP=0. Driver configurado con timezone Z. Sin cambios persistentes en configuración de DB.

Tanda privada: **2026-10-22T14:35:00.741Z–2026-10-22T14:35:32.756Z**. Son tiempos de evidencia, no una garantía de ausencia permanente de writers externos.

## 16. npm test

Ejecutado después del cleanup: **251 PASS / 0 FAIL**,0 cancelados,0 omitidos; duración reportada2228.8751ms. Son pruebas locales, incluidas las verificaciones offline del schema; no completan los puntos reales pendientes de E5.

`git diff --check`: sin errores de whitespace; Git avisa de conversión futura LF→CRLF en los seis archivos modificados preexistentes. Rama `feature/riego-surcos-v1`, HEAD `1f581dfc18f8e9ae18c3a88db1dd4c695a60d1ce`, sin commit/push. Los79 archivos preexistentes cotejados conservan sus SHA256; esta fase agrega únicamente este documento al repositorio.

## 17. Hashes V1

PASS, calculados nuevamente después de la tanda:

| Archivo en src/services/irrigation/ | SHA256 |
| --- | --- |
| irrigation-models.js | `6a1302569db4bd5902fb02d9ab08b6b131cd8bb155e510766dfff3937464afe8` |
| irrigation-validation.js | `7353589ce6810764085cbf9a1badb59e3458b8231e1a8acacae1ad1ed4b235a7` |
| irrigation-calculator.service.js | `b2c785847f4962be991fb72a0986b9e5f2f8f1d8063e2a99cda2579f11ff1380` |

## 18. Riesgos/limitaciones

- **Bloqueante de cierre:** alerta transitoria de sesión/transacción desconocida sin ID conservado. Antes de reanudar las escrituras de certificación hace falta esclarecer o controlar esa ventana y mejorar la captura del detector para conservar IDs/estados sanitizados y distinguir sesiones de transacciones. No se presume que hubo un writer externo confirmado ni que fue un falso positivo.
- Pendientes reales: FK directo y su rollback/preservación, ownership DELETE adicional, EXPLAIN y rechazo oficial de down con V2. No ejecutados tras la alerta.
- Restauración en clon aislado no probada; no existe ambiente aislado autorizado. Down destructivo exitoso real tampoco probado; cobertura offline no equivale a certificación real.
- Factor4.5 empírico, sin calibración ni validación científica/agronómica. No garantía de disponibilidad/rendimiento por estas dos carreras.
- Sin idempotency/exactly-once. Un commit incierto exige reconciliación manual; no retry automático. Esta tanda no produjo commit incierto.
- Sin frontend R5, corte público V2 ni deploy. El default público sigue V1.

## 19. Freeze V2

**NO EMITIDO.** No se crea `irrigation-v2-backend-freeze.md` porque la condición «todo E1–E5 PASS» no se cumple. Las dos carreras aprobadas y el cleanup quedan preservados como evidencia parcial. E1–E4 conservan sus documentos y alcance anteriores.

## 20. ¿Backend V2 certificado?

**Todavía no para el cierre E5.** Protocolo de locks y comportamiento concurrente certificados en ambos órdenes sobre MySQL real, junto con la preservación/eliminación esperada de Manning. Faltan los puntos explícitos enumerados y resolver la alerta del control de writers.

## 21. ¿R4F-E cerrado?

**No.** E5 queda detenido, con DB limpia, schema/tracking intactos y evidencia privada preservada. No se transforma un resultado parcial en certificación final.

## 22. ¿Puede comenzar R5 frontend?

**No bajo este checkpoint.** No se inicia R5. ACTIVE_DESCRIPTOR público permanece V1; no frontend, deploy, commit ni push. La siguiente intervención corresponde a esclarecer la alerta y reanudar únicamente los controles E5 pendientes en una ventana controlada.
