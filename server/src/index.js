import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import rpcRoutes from './routes/rpc.js';
import storageRoutes from './routes/storage.js';
import whatsappRoutes from './routes/whatsapp.js';
import applicantsRoutes from './routes/applicants.js';
import wawancaraRoutes from './routes/wawancara.js';
import academicYearsRoutes from './routes/academic-years.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// API Routes
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.body ? JSON.stringify(req.body).slice(0, 100) : '');
    next();
});
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/rpc', rpcRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/applicants', applicantsRoutes);
app.use('/api/wawancara', wawancaraRoutes);
app.use('/api/academic-years', academicYearsRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`SPMB Server running on http://localhost:${PORT}`);
});
