const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const crypto = require('crypto');

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ message: "User tidak ditemukan" });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Password salah" });

        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email,
                role: user.role,
                tenant_id: user.tenant_id,
                username: user.username
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({ 
            token, 
            role: user.role, 
            email: user.email,
            tenant_id: user.tenant_id,
            username: user.username
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/register', async (req, res) => {
    const { email, password, username, role, tenant_id } = req.body;
    try {
        const existing = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
        if (existing.rows.length > 0) return res.status(400).json({ message: "Email sudah terdaftar" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const userId = crypto.randomUUID();

        const result = await pool.query(`
            INSERT INTO users (id, tenant_id, username, email, password, role)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [userId, tenant_id || null, username, email, hashedPassword, role || 'pembudidaya']);

        res.status(201).json({ message: "User berhasil didaftarkan", user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;