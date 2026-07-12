const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ message: "Token tidak ada" });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: "Token tidak valid" });
        req.user = decoded;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Akses ditolak. Hanya Admin yang diizinkan." });
    }
    next();
}

function requireTenant(req, res, next) {
    if (!req.user || (!req.user.tenant_id && req.user.role !== 'admin')) {
        return res.status(403).json({ message: "Akses ditolak. Pengguna tidak terasosiasi dengan tenant." });
    }
    next();
}

module.exports = verifyToken;
module.exports.requireAdmin = requireAdmin;
module.exports.requireTenant = requireTenant;
