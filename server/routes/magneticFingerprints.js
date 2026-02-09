import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// Helper to format fingerprint
function formatFingerprint(row) {
    if (!row) return null;
    return {
        id: row.id,
        anchorId: row.anchorId,
        createdAt: row.createdAt,
        magnitude: row.magnitude,
        vector: {
            x: row.vector_x,
            y: row.vector_y,
            z: row.vector_z
        },
        inclination: row.inclination,
        deviceOrientation: row.deviceOrientation ? JSON.parse(row.deviceOrientation) : null,
        sampleCount: row.sampleCount
    };
}

// GET /api/fingerprints - List all fingerprints
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT * FROM magnetic_fingerprints ORDER BY createdAt DESC').all();
        res.json(rows.map(formatFingerprint));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/fingerprints/:id - Get single fingerprint
router.get('/:id', (req, res) => {
    try {
        const db = getDb();
        const row = db.prepare('SELECT * FROM magnetic_fingerprints WHERE id = ?').get(req.params.id);
        if (!row) {
            return res.status(404).json({ error: 'Magnetic fingerprint not found' });
        }
        res.json(formatFingerprint(row));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/fingerprints/:id - Delete fingerprint
router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        const existing = db.prepare('SELECT id FROM magnetic_fingerprints WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Magnetic fingerprint not found' });
        }

        db.prepare('DELETE FROM magnetic_fingerprints WHERE id = ?').run(req.params.id);
        res.json({ message: 'Magnetic fingerprint deleted', id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
