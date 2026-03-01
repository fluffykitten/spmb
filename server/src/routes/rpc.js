import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// POST /api/rpc/:functionName - Execute RPC-like functions
router.post('/:functionName', authenticateToken, async (req, res) => {
    const fn = req.params.functionName;
    const params = req.body;
    const userId = req.user.userId;

    try {
        let result;

        switch (fn) {
            case 'admin_get_all_profiles': {
                const { rows } = await pool.query(`
          SELECT p.user_id as id, p.user_id, p.role, p.full_name, p.email, 
                 p.phone, p.phone_number, p.is_active, p.created_at, p.updated_at
          FROM profiles p ORDER BY p.created_at DESC
        `);
                result = rows;
                break;
            }

            case 'admin_update_profile': {
                const { target_user_id, new_role, new_full_name, new_email, new_phone, new_is_active } = params;
                const updates = [];
                const vals = [];
                let idx = 1;

                if (new_role !== undefined) { updates.push(`role = $${idx++}`); vals.push(new_role); }
                if (new_full_name !== undefined) { updates.push(`full_name = $${idx++}`); vals.push(new_full_name); }
                if (new_email !== undefined) { updates.push(`email = $${idx++}`); vals.push(new_email); }
                if (new_phone !== undefined) { updates.push(`phone = $${idx++}`); vals.push(new_phone); }
                if (new_is_active !== undefined) { updates.push(`is_active = $${idx++}`); vals.push(new_is_active); }
                updates.push(`updated_at = NOW()`);
                vals.push(target_user_id);

                const { rows } = await pool.query(
                    `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $${idx} RETURNING *`,
                    vals
                );

                // Audit
                await pool.query(
                    'INSERT INTO audit_logs (user_id, action, target_user_id, details) VALUES ($1, $2, $3, $4)',
                    [userId, 'profile_update', target_user_id, JSON.stringify({ changes: params })]
                );

                result = rows[0];
                break;
            }

            case 'admin_delete_profile': {
                const { target_user_id } = params;
                if (target_user_id === userId) {
                    return res.status(400).json({ data: null, error: 'Cannot delete yourself' });
                }

                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    // Get email for audit
                    const { rows: userRows } = await client.query('SELECT email FROM users WHERE id = $1', [target_user_id]);
                    await client.query('DELETE FROM profiles WHERE user_id = $1', [target_user_id]);
                    await client.query('DELETE FROM users WHERE id = $1', [target_user_id]);
                    await client.query(
                        'INSERT INTO audit_logs (user_id, action, target_user_id, details) VALUES ($1, $2, $3, $4)',
                        [userId, 'user_delete', target_user_id, JSON.stringify({ email: userRows[0]?.email, deleted_at: new Date() })]
                    );
                    await client.query('COMMIT');
                    result = { success: true };
                } catch (e) {
                    await client.query('ROLLBACK');
                    throw e;
                } finally {
                    client.release();
                }
                break;
            }

            case 'admin_create_user': {
                const { p_email, p_password, p_full_name, p_role } = params;
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    const hash = await bcrypt.hash(p_password, 10);
                    const { rows: newUsers } = await client.query(
                        'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING *',
                        [p_email.toLowerCase(), hash, p_full_name || '']
                    );
                    await client.query(
                        `INSERT INTO profiles (user_id, role, full_name, email) VALUES ($1, $2, $3, $4)`,
                        [newUsers[0].id, p_role || 'student', p_full_name || '', p_email.toLowerCase()]
                    );
                    await client.query(
                        'INSERT INTO audit_logs (user_id, action, target_user_id, details) VALUES ($1, $2, $3, $4)',
                        [userId, 'user_create', newUsers[0].id, JSON.stringify({ email: p_email, role: p_role })]
                    );
                    await client.query('COMMIT');
                    result = { user_id: newUsers[0].id };
                } catch (e) {
                    await client.query('ROLLBACK');
                    throw e;
                } finally {
                    client.release();
                }
                break;
            }

            case 'admin_reset_user_password': {
                const { target_user_id } = params;
                const newPassword = crypto.randomBytes(6).toString('hex');
                const hash = await bcrypt.hash(newPassword, 10);
                await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, target_user_id]);
                result = { new_password: newPassword };
                break;
            }

            case 'admin_get_payment_history': {
                const { p_applicant_id } = params;
                const { rows } = await pool.query(
                    `SELECT ph.* FROM payment_history ph
           JOIN payment_records pr ON pr.id = ph.payment_record_id
           WHERE pr.applicant_id = $1 ORDER BY ph.created_at DESC`,
                    [p_applicant_id]
                );
                result = rows;
                break;
            }

            case 'admin_update_payment_status': {
                const { p_record_id, p_status, p_paid_amount, p_method, p_notes, p_date } = params;
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    await client.query(
                        `UPDATE payment_records SET payment_status = $1, paid_amount = $2, payment_method = $3,
             payment_notes = $4, payment_date = $5, updated_by = $6, updated_at = NOW()
             WHERE id = $7`,
                        [p_status, p_paid_amount, p_method, p_notes, p_date, userId, p_record_id]
                    );
                    if (p_paid_amount > 0) {
                        await client.query(
                            `INSERT INTO payment_history (payment_record_id, amount, payment_method, payment_date, notes, recorded_by)
               VALUES ($1, $2, $3, $4, $5, $6)`,
                            [p_record_id, p_paid_amount, p_method || 'cash', p_date || new Date(), p_notes, userId]
                        );
                    }
                    await client.query('COMMIT');
                    result = { success: true };
                } catch (e) {
                    await client.query('ROLLBACK');
                    throw e;
                } finally {
                    client.release();
                }
                break;
            }

            case 'admin_get_batch_statistics': {
                const { p_batch_id } = params;
                const { rows } = await pool.query(`
          SELECT 
            COUNT(*)::int as total_applicants,
            COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
            COUNT(*) FILTER (WHERE status = 'submitted')::int as submitted,
            COUNT(*) FILTER (WHERE status = 'draft')::int as draft,
            COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected
          FROM applicants WHERE registration_batch_id = $1
        `, [p_batch_id]);
                result = rows[0];
                break;
            }

            case 'admin_backfill_batch_assignments': {
                const { p_batch_id } = params;
                const { rowCount } = await pool.query(
                    'UPDATE applicants SET registration_batch_id = $1 WHERE registration_batch_id IS NULL',
                    [p_batch_id]
                );
                result = { updated: rowCount };
                break;
            }

            case 'admin_sync_batch_payments': {
                const { p_batch_id } = params;
                const { rows: batch } = await pool.query('SELECT * FROM registration_batches WHERE id = $1', [p_batch_id]);
                if (!batch[0]) return res.status(404).json({ data: null, error: 'Batch not found' });

                const { rows: applicants } = await pool.query(
                    'SELECT id FROM applicants WHERE registration_batch_id = $1',
                    [p_batch_id]
                );

                let synced = 0;
                for (const app of applicants) {
                    // Create payment records if they don't exist
                    const { rows: existing } = await pool.query(
                        'SELECT id FROM payment_records WHERE applicant_id = $1', [app.id]
                    );
                    if (existing.length === 0) {
                        await pool.query(
                            `INSERT INTO payment_records (applicant_id, payment_type, total_amount) VALUES ($1, 'entrance_fee', $2)`,
                            [app.id, batch[0].entrance_fee_amount]
                        );
                        await pool.query(
                            `INSERT INTO payment_records (applicant_id, payment_type, total_amount) VALUES ($1, 'administration_fee', $2)`,
                            [app.id, batch[0].administration_fee_amount]
                        );
                        synced++;
                    }
                }
                result = { synced };
                break;
            }

            case 'check_interview_time_conflict': {
                const { p_date, p_start_time, p_end_time, p_session_id } = params;
                let sql = `SELECT id FROM interview_sessions 
                    WHERE date = $1 AND status != 'cancelled'
                    AND ((start_time < $3 AND end_time > $2))`;
                const vals = [p_date, p_start_time, p_end_time];
                if (p_session_id) {
                    sql += ' AND id != $4';
                    vals.push(p_session_id);
                }
                const { rows } = await pool.query(sql, vals);
                result = rows.length > 0;
                break;
            }

            case 'generate_exam_token_code': {
                const code = crypto.randomBytes(4).toString('hex').toUpperCase();
                result = code;
                break;
            }

            case 'generate_exam_token_batch': {
                const { p_exam_id, p_count, p_token_type, p_valid_from, p_valid_until } = params;
                const tokens = [];
                for (let i = 0; i < (p_count || 1); i++) {
                    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
                    const { rows } = await pool.query(
                        `INSERT INTO exam_tokens (exam_id, token_code, token_type, valid_from, valid_until, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                        [p_exam_id, code, p_token_type || 'single_use', p_valid_from, p_valid_until, userId]
                    );
                    tokens.push(rows[0]);
                }
                result = tokens;
                break;
            }

            case 'redeem_exam_token': {
                const { p_token_code, p_applicant_id } = params;
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    const { rows: tokens } = await client.query(
                        'SELECT * FROM exam_tokens WHERE token_code = $1 AND is_active = true',
                        [p_token_code]
                    );
                    if (!tokens[0]) {
                        await client.query('ROLLBACK');
                        return res.json({ data: null, error: 'Invalid or expired token' });
                    }
                    const token = tokens[0];
                    if (token.current_uses >= token.max_uses) {
                        await client.query('ROLLBACK');
                        return res.json({ data: null, error: 'Token has reached maximum uses' });
                    }
                    // Check if already redeemed
                    const { rows: existingRedemptions } = await client.query(
                        'SELECT id FROM exam_token_redemptions WHERE token_id = $1 AND applicant_id = $2',
                        [token.id, p_applicant_id]
                    );
                    if (existingRedemptions.length > 0) {
                        await client.query('ROLLBACK');
                        return res.json({ data: { exam_id: token.exam_id, already_redeemed: true }, error: null });
                    }
                    await client.query(
                        'INSERT INTO exam_token_redemptions (token_id, applicant_id) VALUES ($1, $2)',
                        [token.id, p_applicant_id]
                    );
                    await client.query(
                        'UPDATE exam_tokens SET current_uses = current_uses + 1 WHERE id = $1',
                        [token.id]
                    );
                    await client.query('COMMIT');
                    result = { exam_id: token.exam_id, success: true };
                } catch (e) {
                    await client.query('ROLLBACK');
                    throw e;
                } finally {
                    client.release();
                }
                break;
            }

            case 'check_exam_token_access': {
                const { p_exam_id, p_applicant_id } = params;
                const { rows } = await pool.query(`
          SELECT et.exam_id FROM exam_token_redemptions etr
          JOIN exam_tokens et ON et.id = etr.token_id
          WHERE et.exam_id = $1 AND etr.applicant_id = $2
        `, [p_exam_id, p_applicant_id]);
                result = rows.length > 0;
                break;
            }

            case 'get_activated_exam_ids': {
                const { p_applicant_id } = params;
                const { rows } = await pool.query(`
          SELECT DISTINCT et.exam_id FROM exam_token_redemptions etr
          JOIN exam_tokens et ON et.id = etr.token_id
          WHERE etr.applicant_id = $1
        `, [p_applicant_id]);
                result = rows.map(r => r.exam_id);
                break;
            }

            case 'calculate_exam_result': {
                const { p_attempt_id } = params;
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');

                    // Auto-grade multiple choice and true/false
                    const { rows: answers } = await client.query(`
            SELECT ea.*, eq.question_type, eq.points,
                   eqo.is_correct as selected_is_correct
            FROM exam_answers ea
            JOIN exam_questions eq ON eq.id = ea.question_id
            LEFT JOIN exam_question_options eqo ON eqo.id = ea.selected_option_id
            WHERE ea.attempt_id = $1
          `, [p_attempt_id]);

                    let autoGraded = 0;
                    let manualGraded = 0;
                    let maxPoints = 0;

                    for (const ans of answers) {
                        maxPoints += Number(ans.points);
                        if (ans.question_type !== 'essay') {
                            const correct = ans.selected_is_correct === true;
                            const earned = correct ? Number(ans.points) : 0;
                            autoGraded += earned;
                            await client.query(
                                'UPDATE exam_answers SET is_correct = $1, points_earned = $2 WHERE id = $3',
                                [correct, earned, ans.id]
                            );
                        } else if (ans.points_earned !== null) {
                            manualGraded += Number(ans.points_earned);
                        }
                    }

                    const totalPoints = autoGraded + manualGraded;
                    const pct = maxPoints > 0 ? (totalPoints / maxPoints * 100) : 0;

                    // Get exam passing score
                    const { rows: attempts } = await client.query(
                        'SELECT exam_id FROM exam_attempts WHERE id = $1', [p_attempt_id]
                    );
                    const { rows: exams } = await client.query(
                        'SELECT passing_score FROM exams WHERE id = $1', [attempts[0]?.exam_id]
                    );
                    const passingScore = exams[0]?.passing_score || 70;
                    const passed = pct >= passingScore;

                    // Determine grading status
                    const hasEssay = answers.some(a => a.question_type === 'essay');
                    const allEssayGraded = answers.filter(a => a.question_type === 'essay').every(a => a.points_earned !== null);
                    const gradingStatus = !hasEssay || allEssayGraded ? 'completed' : 'partial';

                    // Upsert exam_results
                    await client.query(`
            INSERT INTO exam_results (attempt_id, total_points, max_points, percentage, passed, auto_graded_points, manual_graded_points, grading_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (attempt_id) DO UPDATE SET
              total_points = $2, max_points = $3, percentage = $4, passed = $5,
              auto_graded_points = $6, manual_graded_points = $7, grading_status = $8, updated_at = NOW()
          `, [p_attempt_id, totalPoints, maxPoints, pct, passed, autoGraded, manualGraded, gradingStatus]);

                    await client.query('COMMIT');
                    result = { total_points: totalPoints, max_points: maxPoints, percentage: pct, passed };
                } catch (e) {
                    await client.query('ROLLBACK');
                    throw e;
                } finally {
                    client.release();
                }
                break;
            }

            case 'track_letter_download': {
                const { p_template_id, p_applicant_id } = params;
                await pool.query(
                    'INSERT INTO document_generations (template_id, applicant_id, generated_by) VALUES ($1, $2, $3)',
                    [p_template_id, p_applicant_id, userId]
                );
                await pool.query(
                    'UPDATE letter_templates SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = $1',
                    [p_template_id]
                );
                result = { success: true };
                break;
            }

            case 'increment_generation_count': {
                const { p_template_id } = params;
                await pool.query(
                    'UPDATE letter_templates SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = $1',
                    [p_template_id]
                );
                result = { success: true };
                break;
            }

            case 'track_document_generation_download': {
                const { p_template_id, p_applicant_id } = params;
                await pool.query(
                    'INSERT INTO document_generations (template_id, applicant_id, generated_by) VALUES ($1, $2, $3)',
                    [p_template_id, p_applicant_id, userId]
                );
                result = { success: true };
                break;
            }

            case 'admin_get_document_download_details': {
                const { p_template_id } = params;
                const { rows } = await pool.query(`
          SELECT dg.*, p.full_name, p.email
          FROM document_generations dg
          LEFT JOIN profiles p ON p.user_id = dg.generated_by
          WHERE dg.template_id = $1
          ORDER BY dg.created_at DESC
        `, [p_template_id]);
                result = rows;
                break;
            }

            case 'get_user_tables_info': {
                const { rows } = await pool.query(`
          SELECT tablename as table_name, 
                 (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.tablename)::int as column_count
          FROM pg_tables t
          WHERE schemaname = 'public'
          ORDER BY tablename
        `);
                // Get row counts
                for (const row of rows) {
                    const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int as count FROM "${row.table_name}"`);
                    row.row_count = countRows[0].count;
                }
                result = rows;
                break;
            }

            default:
                return res.status(404).json({ data: null, error: `Unknown function: ${fn}` });
        }

        res.json({ data: result, error: null });
    } catch (err) {
        console.error(`RPC ${fn} error:`, err);
        res.status(500).json({ data: null, error: err.message });
    }
});

export default router;
