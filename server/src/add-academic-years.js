import pool from './db.js';

async function addAcademicYears() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('=== Adding Academic Years Support ===');

        // 1. Create academic_years table
        console.log('1. Creating academic_years table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS academic_years (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                start_date DATE,
                end_date DATE,
                is_active BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // 2. Insert default academic year 2025/2026
        console.log('2. Inserting default academic year 2025/2026...');
        const { rows: existingYears } = await client.query(
            "SELECT id FROM academic_years WHERE code = '2526'"
        );

        let defaultYearId;
        if (existingYears.length === 0) {
            const { rows } = await client.query(`
                INSERT INTO academic_years (name, code, start_date, end_date, is_active)
                VALUES ('2025/2026', '2526', '2025-07-01', '2026-06-30', true)
                RETURNING id
            `);
            defaultYearId = rows[0].id;
            console.log('   Created default year with ID:', defaultYearId);
        } else {
            defaultYearId = existingYears[0].id;
            console.log('   Default year already exists with ID:', defaultYearId);
        }

        // 3. Add academic_year_id to registration_batches
        console.log('3. Adding academic_year_id to registration_batches...');
        const { rows: rbCols } = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'registration_batches' AND column_name = 'academic_year_id'
        `);
        if (rbCols.length === 0) {
            await client.query(`
                ALTER TABLE registration_batches 
                ADD COLUMN academic_year_id UUID REFERENCES academic_years(id)
            `);
            await client.query(`
                UPDATE registration_batches SET academic_year_id = $1 WHERE academic_year_id IS NULL
            `, [defaultYearId]);
            console.log('   Column added and backfilled.');
        } else {
            console.log('   Column already exists.');
        }

        // 4. Add academic_year_id to applicants
        console.log('4. Adding academic_year_id to applicants...');
        const { rows: appCols } = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'applicants' AND column_name = 'academic_year_id'
        `);
        if (appCols.length === 0) {
            await client.query(`
                ALTER TABLE applicants 
                ADD COLUMN academic_year_id UUID REFERENCES academic_years(id)
            `);
            await client.query(`
                UPDATE applicants SET academic_year_id = $1 WHERE academic_year_id IS NULL
            `, [defaultYearId]);
            console.log('   Column added and backfilled.');
        } else {
            console.log('   Column already exists.');
        }

        // 5. Add academic_year_id to exams
        console.log('5. Adding academic_year_id to exams...');
        const { rows: examCols } = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'exams' AND column_name = 'academic_year_id'
        `);
        if (examCols.length === 0) {
            await client.query(`
                ALTER TABLE exams 
                ADD COLUMN academic_year_id UUID REFERENCES academic_years(id)
            `);
            await client.query(`
                UPDATE exams SET academic_year_id = $1 WHERE academic_year_id IS NULL
            `, [defaultYearId]);
            console.log('   Column added and backfilled.');
        } else {
            console.log('   Column already exists.');
        }

        // 6. Add academic_year_id to interview_sessions
        console.log('6. Adding academic_year_id to interview_sessions...');
        const { rows: isCols } = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'interview_sessions' AND column_name = 'academic_year_id'
        `);
        if (isCols.length === 0) {
            await client.query(`
                ALTER TABLE interview_sessions 
                ADD COLUMN academic_year_id UUID REFERENCES academic_years(id)
            `);
            await client.query(`
                UPDATE interview_sessions SET academic_year_id = $1 WHERE academic_year_id IS NULL
            `, [defaultYearId]);
            console.log('   Column added and backfilled.');
        } else {
            console.log('   Column already exists.');
        }

        // 7. Add academic_year_id to wawancara_interviews
        console.log('7. Adding academic_year_id to wawancara_interviews...');
        const { rows: wiCols } = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'wawancara_interviews' AND column_name = 'academic_year_id'
        `);
        if (wiCols.length === 0) {
            await client.query(`
                ALTER TABLE wawancara_interviews 
                ADD COLUMN academic_year_id UUID REFERENCES academic_years(id)
            `);
            await client.query(`
                UPDATE wawancara_interviews SET academic_year_id = $1 WHERE academic_year_id IS NULL
            `, [defaultYearId]);
            console.log('   Column added and backfilled.');
        } else {
            console.log('   Column already exists.');
        }

        // 8. Create indexes
        console.log('8. Creating indexes...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_registration_batches_year ON registration_batches(academic_year_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_applicants_year ON applicants(academic_year_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_exams_year ON exams(academic_year_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_interview_sessions_year ON interview_sessions(academic_year_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_wawancara_interviews_year ON wawancara_interviews(academic_year_id)`);

        await client.query('COMMIT');
        console.log('\n=== Migration completed successfully! ===');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

addAcademicYears();
