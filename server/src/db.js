import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Set maximum number of active connections in the pool
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 5000, // Return an error if a connection cannot be established within 5 seconds
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

export default pool;
