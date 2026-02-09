import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// Helper to format approach vector
function formatVector(row) {
    if (!row) return null;
    return {
        id: row.id,
        anchorId: row.anchorId,
        createdAt: row.createdAt,
        waypoints: JSON.parse(row.waypoints),
        totalDistance: row.totalDistance,
        avgHeading: row.avgHeading
    };
}

// GET /api/vectors - List all vectors
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT * FROM approach_vectors ORDER BY createdAt DESC').all();
        res.json(rows.map(formatVector));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/vectors/:id - Get single vector
router.get('/:id', (req, res) => {
    try {
        const db = getDb();
        const row = db.prepare('SELECT * FROM approach_vectors WHERE id = ?').get(req.params.id);
        if (!row) {
            return res.status(404).json({ error: 'Approach vector not found' });
        }
        res.json(formatVector(row));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/vectors/:id - Delete vector
router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        const existing = db.prepare('SELECT id FROM approach_vectors WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Approach vector not found' });
        }

        db.prepare('DELETE FROM approach_vectors WHERE id = ?').run(req.params.id);
        res.json({ message: 'Approach vector deleted', id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
