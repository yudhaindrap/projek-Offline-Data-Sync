const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyToken = require('../middleware/auth');


/* =========================================================
   GET BOXES
   =========================================================
   ADMIN:
   - melihat semua box

   OPERATOR:
   - hanya melihat box miliknya
========================================================= */
router.get('/', verifyToken, async (req, res) => {

    try {

        let result;

        // ADMIN → semua box
        if (req.user.role === 'admin') {

            result = await pool.query(`
                SELECT
                    b.id,
                    b.box_name as name,
                    l.room_number as floor_level,
                    b.status,
                    b.tenant_id AS user_id,
                    t.name AS user_email
                FROM boxes b
                LEFT JOIN box_locations l ON b.id = l.box_id AND l.end_at IS NULL
                LEFT JOIN tenants t ON b.tenant_id = t.id
                ORDER BY b.box_name ASC
            `);

        }

        // OPERATOR → hanya box miliknya
        else {

            result = await pool.query(`
                SELECT
                    b.id,
                    b.box_name as name,
                    l.room_number as floor_level,
                    b.status,
                    b.tenant_id AS user_id,
                    t.name AS user_email
                FROM boxes b
                LEFT JOIN box_locations l ON b.id = l.box_id AND l.end_at IS NULL
                LEFT JOIN tenants t ON b.tenant_id = t.id
                WHERE b.tenant_id = $1
                ORDER BY b.box_name ASC
            `, [req.user.tenant_id]);

        }

        res.json(result.rows);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


/* =========================================================
   UPDATE FLOOR
   =========================================================
   ADMIN:
   - bisa ubah semua

   OPERATOR:
   - hanya box miliknya
========================================================= */
router.put('/:id/relocate', verifyToken, async (req, res) => {

    const { id } = req.params;
    const { room_number, slot_number } = req.body;

    if (
        room_number === undefined ||
        room_number === null
    ) {
        return res.status(400).json({
            message: 'room_number wajib diisi.'
        });
    }

    const roomInt = parseInt(room_number);

    if (
        isNaN(roomInt) ||
        roomInt < 1 ||
        roomInt > 4
    ) {
        return res.status(400).json({
            message: 'room_number harus angka antara 1–4.'
        });
    }

    try {

        let existing;

        // ADMIN
        if (req.user.role === 'admin') {
            existing = await pool.query(
                'SELECT * FROM boxes WHERE id = $1',
                [id]
            );
        }
        // OPERATOR
        else {
            existing = await pool.query(
                `
                SELECT *
                FROM boxes
                WHERE id = $1
                AND tenant_id = $2
                `,
                [id, req.user.tenant_id]
            );
        }

        if (existing.rows.length === 0) {
            return res.status(404).json({
                message: 'Box tidak ditemukan atau tidak memiliki akses.'
            });
        }

        const box = existing.rows[0];

        // 1. Close current active location (end_at IS NULL)
        await pool.query(
            `
            UPDATE box_locations
            SET end_at = CURRENT_TIMESTAMP
            WHERE box_id = $1 AND end_at IS NULL
            `,
            [id]
        );

        // 2. Insert new location
        const crypto = require('crypto');
        await pool.query(
            `
            INSERT INTO box_locations (id, tenant_id, box_id, room_number, slot_number, start_at, created_by)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
            `,
            [crypto.randomUUID(), box.tenant_id, id, roomInt, slot_number || null, req.user.id || null]
        );

        res.json({
            message:
                `Box berhasil direlokasi ke Ruang ${roomInt}${slot_number ? ` (Slot: ${slot_number})` : ''}.`,
            box: { id, room_number: roomInt, slot_number }
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


module.exports = router;