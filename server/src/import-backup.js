import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PASSWORD = 'changeme123';

async function importBackup() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        const backupPath = path.resolve(__dirname, '../../backup.json');
        if (!fs.existsSync(backupPath)) {
            console.error('backup.json not found at:', backupPath);
            process.exit(1);
        }

        console.log('Reading backup.json...');
        const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
        const tables = backup.tables;

        console.log('Tables found:', Object.keys(tables).join(', '));
        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        // 1. Create users from profiles
        if (tables.profiles) {
            console.log(`\nImporting ${tables.profiles.length} users/profiles...`);
            for (const profile of tables.profiles) {
                try {
                    // Create user
                    await pool.query(`
            INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
          `, [
                        profile.user_id,
                        profile.email || `user_${profile.user_id.slice(0, 8)}@local`,
                        passwordHash,
                        profile.full_name || '',
                        profile.created_at,
                        profile.updated_at
                    ]);

                    // Create profile
                    await pool.query(`
            INSERT INTO profiles (id, user_id, role, full_name, email, phone, phone_number, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (user_id) DO NOTHING
          `, [
                        profile.id, profile.user_id, profile.role,
                        profile.full_name, profile.email, profile.phone,
                        profile.phone_number, profile.is_active,
                        profile.created_at, profile.updated_at
                    ]);
                } catch (err) {
                    console.error(`  Error importing profile ${profile.email}:`, err.message);
                }
            }
            console.log('  Users/profiles imported.');
        }

        // 2. Registration batches
        if (tables.registration_batches) {
            console.log(`\nImporting ${tables.registration_batches.length} registration batches...`);
            for (const batch of tables.registration_batches) {
                try {
                    await pool.query(`
            INSERT INTO registration_batches (id, name, description, start_date, end_date, entrance_fee_amount, administration_fee_amount, is_active, display_order, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO NOTHING
          `, [
                        batch.id, batch.name, batch.description, batch.start_date, batch.end_date,
                        batch.entrance_fee_amount, batch.administration_fee_amount, batch.is_active,
                        batch.display_order, batch.created_at, batch.updated_at
                    ]);
                } catch (err) {
                    console.error(`  Error importing batch ${batch.name}:`, err.message);
                }
            }
            console.log('  Registration batches imported.');
        }

        // 3. Applicants
        if (tables.applicants) {
            console.log(`\nImporting ${tables.applicants.length} applicants...`);
            for (const app of tables.applicants) {
                try {
                    await pool.query(`
            INSERT INTO applicants (id, user_id, status, dynamic_data, registration_number, admin_comments, commented_by, commented_at, interview_status, interview_score, exam_status, exam_score, final_score, registration_batch_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (id) DO NOTHING
          `, [
                        app.id, app.user_id, app.status, JSON.stringify(app.dynamic_data),
                        app.registration_number, app.admin_comments, app.commented_by,
                        app.commented_at, app.interview_status, app.interview_score,
                        app.exam_status, app.exam_score, app.final_score,
                        app.registration_batch_id, app.created_at, app.updated_at
                    ]);
                } catch (err) {
                    console.error(`  Error importing applicant ${app.id}:`, err.message);
                }
            }
            console.log('  Applicants imported.');
        }

        // 4. Payment records
        if (tables.payment_records) {
            console.log(`\nImporting ${tables.payment_records.length} payment records...`);
            for (const rec of tables.payment_records) {
                try {
                    await pool.query(`
            INSERT INTO payment_records (id, applicant_id, payment_type, payment_status, total_amount, paid_amount, payment_method, payment_notes, payment_date, updated_by, updated_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO NOTHING
          `, [
                        rec.id, rec.applicant_id, rec.payment_type, rec.payment_status,
                        rec.total_amount, rec.paid_amount, rec.payment_method, rec.payment_notes,
                        rec.payment_date, rec.updated_by, rec.updated_at, rec.created_at
                    ]);
                } catch (err) {
                    console.error(`  Error importing payment ${rec.id}:`, err.message);
                }
            }
            console.log('  Payment records imported.');
        }

        // 5. Payment history
        if (tables.payment_history) {
            console.log(`\nImporting ${tables.payment_history.length} payment history entries...`);
            for (const hist of tables.payment_history) {
                try {
                    await pool.query(`
            INSERT INTO payment_history (id, payment_record_id, amount, payment_method, payment_date, notes, recorded_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING
          `, [
                        hist.id, hist.payment_record_id, hist.amount, hist.payment_method,
                        hist.payment_date, hist.notes, hist.recorded_by, hist.created_at
                    ]);
                } catch (err) {
                    console.error(`  Error importing payment history ${hist.id}:`, err.message);
                }
            }
            console.log('  Payment history imported.');
        }

        // 6. Letter templates
        if (tables.letter_templates) {
            console.log(`\nImporting ${tables.letter_templates.length} letter templates...`);
            for (const tpl of tables.letter_templates) {
                try {
                    await pool.query(`
            INSERT INTO letter_templates (id, name, html_content, description, variables, template_type, letterhead_config, typography_config, letter_number_config, signature_config, layout_config, pdf_source_url, usage_count, is_active, access_rule, is_available_for_students, template_format, docx_template_url, docx_variables, docx_layout_config, required_status, is_self_service, generation_limit, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
            ON CONFLICT (id) DO NOTHING
          `, [
                        tpl.id, tpl.name, tpl.html_content, tpl.description,
                        JSON.stringify(tpl.variables), tpl.template_type,
                        JSON.stringify(tpl.letterhead_config), JSON.stringify(tpl.typography_config),
                        JSON.stringify(tpl.letter_number_config), JSON.stringify(tpl.signature_config),
                        JSON.stringify(tpl.layout_config), tpl.pdf_source_url, tpl.usage_count,
                        tpl.is_active, tpl.access_rule, tpl.is_available_for_students,
                        tpl.template_format, tpl.docx_template_url, tpl.docx_variables,
                        JSON.stringify(tpl.docx_layout_config), tpl.required_status,
                        tpl.is_self_service, tpl.generation_limit, tpl.created_at, tpl.updated_at
                    ]);
                } catch (err) {
                    console.error(`  Error importing template ${tpl.name}:`, err.message);
                }
            }
            console.log('  Letter templates imported.');
        }

        // 7. App config
        if (tables.app_config) {
            console.log(`\nImporting ${tables.app_config.length} app configs...`);
            for (const cfg of tables.app_config) {
                try {
                    await pool.query(`
            INSERT INTO app_config (key, value, created_at, updated_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (key) DO NOTHING
          `, [cfg.key, JSON.stringify(cfg.value), cfg.created_at, cfg.updated_at]);
                } catch (err) {
                    console.error(`  Error importing config ${cfg.key}:`, err.message);
                }
            }
            console.log('  App config imported.');
        }

        // 8. Generic import for remaining tables
        const remainingTables = [
            'interviewers', 'interview_sessions', 'interview_slots', 'interview_bookings',
            'interview_evaluations', 'interview_criteria', 'exams', 'exam_questions',
            'exam_question_options', 'exam_attempts', 'exam_answers', 'exam_results',
            'exam_proctoring_logs', 'exam_tokens', 'exam_token_redemptions',
            'audit_logs', 'whatsapp_notification_logs', 'document_generations', 'form_schemas'
        ];

        for (const tableName of remainingTables) {
            if (tables[tableName] && tables[tableName].length > 0) {
                console.log(`\nImporting ${tables[tableName].length} ${tableName}...`);
                for (const row of tables[tableName]) {
                    try {
                        const keys = Object.keys(row);
                        const values = keys.map(k => {
                            const v = row[k];
                            if (v !== null && typeof v === 'object') return JSON.stringify(v);
                            return v;
                        });
                        const placeholders = keys.map((_, i) => `$${i + 1}`);
                        await pool.query(
                            `INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders.join(',')}) ON CONFLICT DO NOTHING`,
                            values
                        );
                    } catch (err) {
                        // Skip errors for individual rows
                    }
                }
                console.log(`  ${tableName} imported.`);
            }
        }

        // Summary
        console.log('\n=== Import Summary ===');
        const summaryTables = ['users', 'profiles', 'applicants', 'registration_batches', 'payment_records', 'letter_templates', 'app_config'];
        for (const t of summaryTables) {
            const { rows } = await pool.query(`SELECT COUNT(*)::int as count FROM ${t}`);
            console.log(`  ${t}: ${rows[0].count} rows`);
        }

        console.log(`\nAll existing users have been given the default password: "${DEFAULT_PASSWORD}"`);
        console.log('Users should change their password after first login.');
        console.log('\nBackup import completed!');
    } catch (err) {
        console.error('Import error:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

importBackup();
