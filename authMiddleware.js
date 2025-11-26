// authMiddleware.js
const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  // 1. Obtener el token del encabezado 'Authorization'
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Formato "Bearer TOKEN"

  // 2. Si no hay token, rechazar la petición
  if (token == null) {
    return res
      .status(401)
      .json({ error: "Acceso denegado: No se proporcionó token." });
  }

  // 3. Verificar el token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido o expirado." });
    }

    // 4. Si el token es válido, guardamos los datos del usuario en req.user
    // y llamamos a next() para continuar con la ruta solicitada.
    req.user = user;
    next();
  });
}

module.exports = authMiddleware;
