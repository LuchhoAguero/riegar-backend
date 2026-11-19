# Ensayo académico V2: una sola escritura

El servidor académico conserva ACTIVE_V1 como descriptor original. La composición V2 se usa solo con RIEGAR_DEMO_ENABLE_V2=true y estos controles:

- RIEGAR_DEMO_V2_USER_ID: cuenta sintética autorizada, actualmente propuesta 2 y revalidada antes del ensayo.
- RIEGAR_DEMO_V2_FARM_ID: finca autorizada, actualmente propuesta 2, propiedad de esa cuenta.
- RIEGAR_DEMO_V2_TRIAL_ID: identificador fijo del ensayo; no se cambia para reintentar.
- RIEGAR_DEMO_V2_PUBLIC_KEY: clave pública Ed25519 SPKI/DER en base64url canónico, de una sola línea. La clave privada permanece exclusivamente en el equipo del operador.

Sin configuración válida no se habilita el escritor. Durante cada arranque se genera un nonce aleatorio nuevo y una ventana de diez minutos. La capacidad autenticada entrega el desafío solo a la cuenta autorizada. No firma permisos ni rearma el presupuesto.

El operador usa scripts/issue-staging-trial-permit.cjs para emitir un único permiso dirigido al desafío. Un ledger local privado, fijo por trialId, se crea con apertura exclusiva y fsync antes de devolver el permiso. Un archivo existente, incompleto o de otro arranque impide emitir otra firma. No se borra ni se cambia de directorio o trialId para reintentar.

El permiso se añade exclusivamente al POST del ensayo como X-Riegar-Trial-Permit. No se incluye en URLs, Git, logs, capturas, almacenamiento del navegador ni el bundle del frontend. La herramienta de navegador del operador solo modifica esa cabecera; no reemplaza respuestas ni datos del backend.

El backend verifica JWT, cuenta, finca, Origin, firma, desafío y ventana. Consume el permiso de forma síncrona antes de next()/SQL. El presupuesto no se restituye tras errores, rollback o respuesta incierta. Un segundo envío se rechaza antes del cálculo o inserción. Otro proceso/arranque genera un nonce diferente, por lo que el permiso anterior no sirve; el ledger del operador impide firmar uno nuevo automáticamente.

La garantía acotada es como máximo una admisión al servicio de creación, cuyo flujo existente ejecuta un solo INSERT y no hace retry. Puede terminar en cero filas si falla. No se promete ejecución exactamente una vez ni que un logout cancele un commit.

Antes de activar se verifica identidad TLS/schema/permisos, se respalda el esquema académico y se revisa el ledger vacío. Ante un fallo se detiene el ensayo y se desactiva la bandera. Al finalizar se desactiva también, preservando el snapshot. Reabrir la ventana o liberar más usuarios requiere nueva autorización.

No se requieren nuevas tablas, migrations, cuentas SQL ni privilegios adicionales al GRANT de tabla aprobado. Los lectores V1/V2, fincas, auth y Manning permanecen operativos. La comprobación independiente de filas, HISTORY y DETAIL sigue siendo obligatoria después del 201.
