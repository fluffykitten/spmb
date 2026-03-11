import pool from './db.js';

async function verify() {
    try {
        console.log('=== Verifying Academic Year Implementation ===\n');

        // 1. Check academic_years table
        console.log('1. Academic Years table:');
        const { rows: years } = await pool.query('SELECT * FROM academic_years');
        console.table(years);

        // 2. Check if all applicants have academic_year_id
        const { rows: appCheck } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(academic_year_id) as with_year,
                COUNT(*) - COUNT(academic_year_id) as without_year
            FROM applicants
        `);
        console.log('\n2. Applicants academic_year_id coverage:');
        console.table(appCheck);

        // 3. Check if all registration_batches have academic_year_id
        const { rows: batchCheck } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(academic_year_id) as with_year,
                COUNT(*) - COUNT(academic_year_id) as without_year
            FROM registration_batches
        `);
        console.log('\n3. Registration Batches academic_year_id coverage:');
        console.table(batchCheck);

        // 4. Check if all exams have academic_year_id
        const { rows: examCheck } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(academic_year_id) as with_year,
                COUNT(*) - COUNT(academic_year_id) as without_year
            FROM exams
        `);
        console.log('\n4. Exams academic_year_id coverage:');
        console.table(examCheck);

        // 5. Check if all interview_sessions have academic_year_id
        const { rows: isCheck } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(academic_year_id) as with_year,
                COUNT(*) - COUNT(academic_year_id) as without_year
            FROM interview_sessions
        `);
        console.log('\n5. Interview Sessions academic_year_id coverage:');
        console.table(isCheck);

        // 6. Check if all wawancara_interviews have academic_year_id
        const { rows: wiCheck } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(academic_year_id) as with_year,
                COUNT(*) - COUNT(academic_year_id) as without_year
            FROM wawancara_interviews
        `);
        console.log('\n6. Wawancara Interviews academic_year_id coverage:');
        console.table(wiCheck);

        // 7. Check FK constraints actually work
        console.log('\n7. Testing FK constraint integrity...');
        const { rows: fkTest } = await pool.query(`
            SELECT a.id, a.academic_year_id, ay.name as year_name
            FROM applicants a
            LEFT JOIN academic_years ay ON a.academic_year_id = ay.id
            WHERE a.academic_year_id IS NOT NULL AND ay.id IS NULL
        `);
        if (fkTest.length === 0) {
            console.log('   ✅ All applicant academic_year_id values point to valid academic_years records');
        } else {
            console.log('   ❌ ORPHANED applicant records found:', fkTest.length);
            console.table(fkTest);
        }

        // 8. Check registration_batches FK
        const { rows: batchFkTest } = await pool.query(`
            SELECT rb.id, rb.name, rb.academic_year_id, ay.name as year_name
            FROM registration_batches rb
            LEFT JOIN academic_years ay ON rb.academic_year_id = ay.id
            WHERE rb.academic_year_id IS NOT NULL AND ay.id IS NULL
        `);
        if (batchFkTest.length === 0) {
            console.log('   ✅ All batch academic_year_id values point to valid academic_years records');
        } else {
            console.log('   ❌ ORPHANED batch records found:', batchFkTest.length);
        }

        // 9. Sample data check - show some applicants with their year
        console.log('\n8. Sample applicants with academic year:');
        const { rows: sampleApp } = await pool.query(`
            SELECT a.id, a.registration_number, a.status, ay.name as academic_year
            FROM applicants a
            LEFT JOIN academic_years ay ON a.academic_year_id = ay.id
            LIMIT 5
        `);
        console.table(sampleApp);

        // 10. Check indexes exist
        console.log('\n9. Checking indexes:');
        const { rows: indexes } = await pool.query(`
            SELECT indexname, tablename
            FROM pg_indexes
            WHERE indexname LIKE 'idx_%_year'
            ORDER BY tablename
        `);
        console.table(indexes);

        // 11. Verify that exactly one year is active
        const { rows: activeCount } = await pool.query(`
            SELECT COUNT(*) as active_count FROM academic_years WHERE is_active = true
        `);
        console.log('\n10. Active academic years count:', activeCount[0].active_count);
        if (parseInt(activeCount[0].active_count) === 1) {
            console.log('   ✅ Exactly one active academic year');
        } else if (parseInt(activeCount[0].active_count) === 0) {
            console.log('   ⚠️ WARNING: No active academic year! Frontend will not work correctly.');
        } else {
            console.log('   ⚠️ WARNING: Multiple active academic years detected!');
        }

        // 12. Check if any records were NOT backfilled (NULL academic_year_id)
        console.log('\n11. Records with NULL academic_year_id (should be 0 after migration):');
        const { rows: nullCheck } = await pool.query(`
            SELECT 'applicants' as table_name, COUNT(*) as null_count FROM applicants WHERE academic_year_id IS NULL
            UNION ALL
            SELECT 'registration_batches', COUNT(*) FROM registration_batches WHERE academic_year_id IS NULL
            UNION ALL
            SELECT 'exams', COUNT(*) FROM exams WHERE academic_year_id IS NULL
            UNION ALL
            SELECT 'interview_sessions', COUNT(*) FROM interview_sessions WHERE academic_year_id IS NULL
            UNION ALL
            SELECT 'wawancara_interviews', COUNT(*) FROM wawancara_interviews WHERE academic_year_id IS NULL
        `);
        console.table(nullCheck);

        const hasNulls = nullCheck.some(r => parseInt(r.null_count) > 0);
        if (hasNulls) {
            console.log('   ⚠️ WARNING: Some records have NULL academic_year_id! These should be backfilled.');
        } else {
            console.log('   ✅ All records have been properly backfilled with academic_year_id');
        }

        console.log('\n=== Verification Complete ===');
    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        pool.end();
    }
}

verify();
