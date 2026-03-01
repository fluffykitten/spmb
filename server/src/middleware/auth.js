import jwt from 'jsonwebtoken';
import pool from '../db.js';

export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

export function requireRole(...roles) {
    return async (req, res, next) => {
        try {
            const { rows } = await pool.query(
                'SELECT role FROM profiles WHERE user_id = $1',
                [req.user.userId]
            );

            if (rows.length === 0) {
                return res.status(403).json({ error: 'Profile not found' });
            }

            if (!roles.includes(rows[0].role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            req.userRole = rows[0].role;
            next();
        } catch (err) {
            return res.status(500).json({ error: 'Authorization error' });
        }
    };
}
