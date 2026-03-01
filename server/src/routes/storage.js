import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const bucket = req.params.bucket || 'default';
        const dir = path.join(UPLOAD_DIR, bucket);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Use the path from request body or generate one
        const filePath = req.body.path || req.query.path || file.originalname;
        // Create subdirectories if path contains /
        const dir = path.join(UPLOAD_DIR, req.params.bucket || 'default', path.dirname(filePath));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, filePath);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// POST /api/storage/:bucket/upload - Upload file to bucket
router.post('/:bucket/upload', authenticateToken, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const bucket = req.params.bucket;
        const filePath = req.body.path || req.file.filename;
        const fullPath = path.join(bucket, filePath);

        res.json({
            data: { path: fullPath, fullPath: fullPath },
            error: null
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// GET /api/storage/:bucket/download/* - Download file
router.get('/:bucket/download/*', (req, res) => {
    try {
        const bucket = req.params.bucket;
        const filePath = req.params[0];
        const absolutePath = path.resolve(UPLOAD_DIR, bucket, filePath);

        // Security check
        if (!absolutePath.startsWith(path.resolve(UPLOAD_DIR))) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.sendFile(absolutePath);
    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/storage/:bucket/public/* - Get public URL for a file
router.get('/:bucket/public/*', (req, res) => {
    const bucket = req.params.bucket;
    const filePath = req.params[0];
    const absolutePath = path.resolve(UPLOAD_DIR, bucket, filePath);

    if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    const publicUrl = `/uploads/${bucket}/${filePath}`;
    res.json({ data: { publicUrl }, error: null });
});

// DELETE /api/storage/:bucket/delete - Delete file(s)
router.post('/:bucket/delete', authenticateToken, (req, res) => {
    try {
        const bucket = req.params.bucket;
        const { paths } = req.body;
        const filePaths = Array.isArray(paths) ? paths : [paths];

        for (const fp of filePaths) {
            const absolutePath = path.resolve(UPLOAD_DIR, bucket, fp);
            if (absolutePath.startsWith(path.resolve(UPLOAD_DIR)) && fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
            }
        }

        res.json({ data: { message: 'Deleted' }, error: null });
    } catch (err) {
        console.error('Delete storage error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// GET /api/storage/:bucket/list - List files in bucket
router.get('/:bucket/list', authenticateToken, (req, res) => {
    try {
        const bucket = req.params.bucket;
        const prefix = req.query.prefix || '';
        const dir = path.join(UPLOAD_DIR, bucket, prefix);

        if (!fs.existsSync(dir)) {
            return res.json({ data: [], error: null });
        }

        const files = fs.readdirSync(dir).map(name => ({
            name,
            id: name,
            metadata: fs.statSync(path.join(dir, name))
        }));

        res.json({ data: files, error: null });
    } catch (err) {
        res.status(500).json({ data: null, error: err.message });
    }
});

export default router;
