const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');
const verifyToken = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');

// Apply verifyToken + requireAdmin to ALL admin routes
router.use(verifyToken, requireAdmin);

/* =============================================================
   USER MANAGEMENT CRUD
   ============================================================= */

// GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.email, u.role, u.is_active, u.last_login, u.created_at, u.tenant_id, t.name as tenant_name
            FROM users u
            LEFT JOIN tenants t ON u.tenant_id = t.id
            ORDER BY u.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/users', async (req, res) => {
    const { email, password, role, tenant_id, is_active } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Email, password, dan role wajib diisi.' });
    }
    if (!['admin', 'operator', 'pembudidaya'].includes(role)) {
        return res.status(400).json({ message: 'Role tidak valid.' });
    }

    try {
        // Check for duplicate email
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ message: 'Email sudah terdaftar.' });
        }

        const crypto = require('crypto');
        const id = crypto.randomUUID();

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const result = await pool.query(
            'INSERT INTO users (id, email, password, role, tenant_id, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, role, created_at',
            [id, email, password_hash, role, tenant_id || null, is_active ?? true]
        );

        res.status(201).json({ message: 'Pengguna berhasil ditambahkan.', user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/admin/users/:id — update email, role, tenant, etc
router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { email, role, password, tenant_id, is_active } = req.body;

    try {
        const existing = await pool.query(
            'SELECT id FROM users WHERE id = $1',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                message: 'Pengguna tidak ditemukan.'
            });
        }

        if (email) {
            const duplicate = await pool.query(
                'SELECT id FROM users WHERE email = $1 AND id != $2',
                [email, id]
            );

            if (duplicate.rows.length > 0) {
                return res.status(409).json({
                    message: 'Email sudah digunakan pengguna lain.'
                });
            }
        }

        let password_hash = null;

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            password_hash = await bcrypt.hash(password, salt);
        }

        const result = await pool.query(
            `
            UPDATE users
            SET
                email = COALESCE($1, email),
                role = COALESCE($2, role),
                password = COALESCE($3, password),
                tenant_id = $4,
                is_active = COALESCE($5, is_active)
            WHERE id = $6
            RETURNING id, email, role, tenant_id, is_active, created_at
            `,
            [
                email || null,
                role || null,
                password_hash,
                tenant_id || null,
                is_active !== undefined ? is_active : null,
                id
            ]
        );

        res.json({
            message: 'Data pengguna berhasil diperbarui.',
            user: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err.message
        });
    }
});

// DELETE /api/admin/users/:id — remove a user
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ message: 'Tidak dapat menghapus akun Anda sendiri.' });
    }

    try {
        const result = await pool.query(
            'DELETE FROM users WHERE id = $1 RETURNING id, email', [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
        }
        res.json({ message: `Pengguna ${result.rows[0].email} berhasil dihapus.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* =============================================================
   BOX MANAGEMENT CRUD
   ============================================================= */

/* =========================
   GET ALL BOXES
========================= */
router.get('/boxes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                b.id,
                b.box_name,
                b.box_code,
                l.room_number,
                l.slot_number,
                b.status,
                b.tenant_id AS user_id,
                t.name AS user_email
            FROM boxes b
            LEFT JOIN box_locations l ON b.id = l.box_id AND l.end_at IS NULL
            LEFT JOIN tenants t
                ON b.tenant_id = t.id
            ORDER BY b.box_name ASC
        `);

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err.message
        });
    }
});

/* =========================
   CREATE BOX
========================= */
router.post('/boxes', async (req, res) => {
    const {
        box_name,
        box_code,
        room_number,
        slot_number,
        status,
        user_id
    } = req.body;

    if (!box_name) {
        return res.status(400).json({
            message: 'Nama box wajib diisi.'
        });
    }

    try {
        // cek tenant jika user_id ada
        if (user_id) {
            const tenantCheck = await pool.query(
                'SELECT id FROM tenants WHERE id = $1',
                [user_id]
            );

            if (tenantCheck.rows.length === 0) {
                return res.status(404).json({
                    message: 'Tenant pemilik tidak ditemukan.'
                });
            }
        }

        const crypto = require('crypto');
        const boxId = crypto.randomUUID();

        const result = await pool.query(`
            INSERT INTO boxes (
                id,
                box_name,
                box_code,
                status,
                tenant_id
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [
            boxId,
            box_name,
            box_code || null,
            status || 'active',
            user_id || null
        ]);

        await pool.query(`
            INSERT INTO box_locations (id, tenant_id, box_id, room_number, slot_number, start_at, created_by)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
        `, [crypto.randomUUID(), user_id || null, boxId, room_number || 1, slot_number || null, req.user.id || null]);

        res.status(201).json({
            message: 'Box berhasil ditambahkan.',
            box: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err.message
        });
    }
});

/* =========================
   UPDATE BOX
========================= */
router.put('/boxes/:id', async (req, res) => {
    const { id } = req.params;
    const {
        box_name,
        box_code,
        room_number,
        slot_number,
        status,
        user_id
    } = req.body;

    try {
        const existing = await pool.query(
            'SELECT * FROM boxes WHERE id = $1',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                message: 'Box tidak ditemukan.'
            });
        }

        // validasi tenant
        if (user_id) {
            const tenantCheck = await pool.query(
                'SELECT id FROM tenants WHERE id = $1',
                [user_id]
            );

            if (tenantCheck.rows.length === 0) {
                return res.status(404).json({
                    message: 'Tenant pemilik tidak ditemukan.'
                });
            }
        }

        const result = await pool.query(`
            UPDATE boxes
            SET
                box_name = COALESCE($1, box_name),
                box_code = COALESCE($2, box_code),
                status = COALESCE($3, status),
                tenant_id = $4
            WHERE id = $5
            RETURNING *
        `, [
            box_name || null,
            box_code || null,
            status || 'active',
            user_id || null,
            id
        ]);

        if (room_number) {
            await pool.query(`
                UPDATE box_locations
                SET end_at = CURRENT_TIMESTAMP
                WHERE box_id = $1 AND end_at IS NULL
            `, [id]);

            await pool.query(`
                INSERT INTO box_locations (id, tenant_id, box_id, room_number, slot_number, start_at, created_by)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
            `, [crypto.randomUUID(), user_id || null, id, room_number, slot_number || null, req.user.id || null]);
        }

        res.json({
            message: 'Box berhasil diperbarui.',
            box: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err.message
        });
    }
});

/* =========================
   DELETE BOX
========================= */
router.delete('/boxes/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM boxes WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Box tidak ditemukan.'
            });
        }

        res.json({
            message: `Box ${result.rows[0].name} berhasil dihapus.`
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err.message
        });
    }
});

module.exports = router;