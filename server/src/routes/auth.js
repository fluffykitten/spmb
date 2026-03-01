import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('[LOGIN] Step 1: Got email/password', email);

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        console.log('[LOGIN] Step 2: Querying database...');
        const { rows: users } = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        console.log('[LOGIN] Step 3: Found', users.length, 'users');

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid login credentials' });
        }

        const user = users[0];
        console.log('[LOGIN] Step 4: Comparing password...');
        const validPassword = await bcrypt.compare(password, user.password_hash);
        console.log('[LOGIN] Step 5: Password valid:', validPassword);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid login credentials' });
        }

        // Get profile
        console.log('[LOGIN] Step 6: Getting profile...');
        const { rows: profiles } = await pool.query(
            'SELECT * FROM profiles WHERE user_id = $1',
            [user.id]
        );
        console.log('[LOGIN] Step 7: Got profile, generating token...');

        const profile = profiles[0] || null;

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log('[LOGIN] Step 8: Sending response...');
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                user_metadata: { full_name: user.full_name }
            },
            profile
        });
        console.log('[LOGIN] Done!');
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const client = await pool.connect();
    try {
        const { email, password, fullName, phoneNumber } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Check if user exists
        const { rows: existing } = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'User already registered' });
        }

        await client.query('BEGIN');

        const passwordHash = await bcrypt.hash(password, 10);

        const { rows: newUsers } = await client.query(
            'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING *',
            [email.toLowerCase(), passwordHash, fullName || '']
        );

        const newUser = newUsers[0];

        // Create profile as student
        const { rows: newProfiles } = await client.query(
            `INSERT INTO profiles (user_id, role, full_name, email, phone_number) 
       VALUES ($1, 'student', $2, $3, $4) RETURNING *`,
            [newUser.id, fullName || '', email.toLowerCase(), phoneNumber || null]
        );

        await client.query('COMMIT');

        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                user_metadata: { full_name: newUser.full_name }
            },
            profile: newProfiles[0]
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const { rows: users } = await pool.query(
            'SELECT id, email, full_name, created_at FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { rows: profiles } = await pool.query(
            'SELECT * FROM profiles WHERE user_id = $1',
            [req.user.userId]
        );

        res.json({
            user: {
                id: users[0].id,
                email: users[0].email,
                user_metadata: { full_name: users[0].full_name }
            },
            profile: profiles[0] || null
        });
    } catch (err) {
        console.error('Get me error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
