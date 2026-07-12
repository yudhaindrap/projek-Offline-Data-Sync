const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyToken = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const crypto = require('crypto');

// Terapkan middleware keamanan ke semua rute tenant (hanya admin yang dapat mengakses)
router.use(verifyToken, requireAdmin);

/* =============================================================
   TENANT MANAGEMENT CRUD
   ============================================================= */

// GET /api/admin/tenants — list all tenants
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM tenants ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/tenants — create a new tenant
router.post('/', async (req, res) => {
    const { name, tenant_code, contact_person, phone, address, is_active } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Nama tenant wajib diisi.' });
    }

    try {
        // Cek duplikasi tenant_code jika diberikan
        if (tenant_code) {
            const existing = await pool.query('SELECT id FROM tenants WHERE tenant_code = $1', [tenant_code]);
            if (existing.rows.length > 0) {
                return res.status(409).json({ message: 'Kode tenant sudah digunakan.' });
            }
        }

        const id = crypto.randomUUID();

        const result = await pool.query(
            `INSERT INTO tenants (id, name, tenant_code, contact_person, phone, address, is_active) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [id, name, tenant_code || null, contact_person || null, phone || null, address || null, is_active ?? true]
        );

        res.status(201).json({ message: 'Tenant berhasil ditambahkan.', tenant: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/admin/tenants/:id — update tenant details
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, tenant_code, contact_person, phone, address, is_active } = req.body;

    try {
        const existing = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ message: 'Tenant tidak ditemukan.' });
        }

        if (tenant_code) {
            const duplicate = await pool.query(
                'SELECT id FROM tenants WHERE tenant_code = $1 AND id != $2',
                [tenant_code, id]
            );
            if (duplicate.rows.length > 0) {
                return res.status(409).json({ message: 'Kode tenant sudah digunakan tenant lain.' });
            }
        }

        const result = await pool.query(
            `UPDATE tenants
             SET name = COALESCE($1, name),
                 tenant_code = COALESCE($2, tenant_code),
                 contact_person = COALESCE($3, contact_person),
                 phone = COALESCE($4, phone),
                 address = COALESCE($5, address),
                 is_active = COALESCE($6, is_active)
             WHERE id = $7
             RETURNING *`,
            [name || null, tenant_code || null, contact_person || null, phone || null, address || null, is_active, id]
        );

        res.json({ message: 'Tenant berhasil diperbarui.', tenant: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
