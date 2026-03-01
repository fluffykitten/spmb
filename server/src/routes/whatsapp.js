import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

function formatPhoneNumber(phone, countryCode) {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
        cleaned = countryCode + cleaned.substring(1);
    } else if (!cleaned.startsWith(countryCode)) {
        cleaned = countryCode + cleaned;
    }
    return cleaned;
}

// POST /api/whatsapp/send
router.post('/send', authenticateToken, async (req, res) => {
    try {
        const { phone, templateKey, variables, applicantId } = req.body;

        if (!phone || !templateKey) {
            return res.status(400).json({ error: "Missing required fields: phone, templateKey" });
        }

        // Get config
        const { rows: config } = await pool.query(
            "SELECT key, value FROM app_config WHERE key IN ('fonnte_api_token', 'fonnte_country_code', 'fonnte_enabled')"
        );

        const configMap = new Map(config.map(c => [c.key, c.value]));
        const fonnte_enabled = configMap.get("fonnte_enabled") === 'true' || configMap.get("fonnte_enabled") === true;
        const fonnte_api_token = configMap.get("fonnte_api_token");
        const fonnte_country_code = configMap.get("fonnte_country_code") || "62";

        if (!fonnte_enabled) {
            console.log("WhatsApp notifications are disabled");
            return res.json({ success: false, message: "WhatsApp notifications are disabled" });
        }

        if (!fonnte_api_token) {
            console.error("Fonnte API token not configured");
            return res.status(500).json({ error: "WhatsApp API not configured" });
        }

        // Get template
        const { rows: templates } = await pool.query(
            "SELECT * FROM whatsapp_templates WHERE template_key = $1 AND is_active = true",
            [templateKey]
        );

        if (templates.length === 0) {
            return res.status(404).json({ error: `Template '${templateKey}' not found or inactive` });
        }

        const template = templates[0];
        let messageBody = template.message_body;

        for (const [key, value] of Object.entries(variables || {})) {
            const placeholder = `{{${key}}}`;
            messageBody = messageBody.replace(new RegExp(placeholder, "g"), String(value || ""));
        }

        const formattedPhone = formatPhoneNumber(phone, String(fonnte_country_code));
        const logId = crypto.randomUUID();

        // Check if user has a profile to satisfy foreign key constraint
        let validSentBy = null;
        if (req.user && req.user.id) {
            const { rows: profiles } = await pool.query('SELECT id FROM profiles WHERE id = $1', [req.user.id]);
            if (profiles.length > 0) {
                validSentBy = req.user.id;
            }
        }

        // Insert log
        await pool.query(
            `INSERT INTO whatsapp_logs 
             (id, recipient_phone, recipient_name, message_type, message_body, status, applicant_id, sent_by, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
                logId,
                formattedPhone,
                variables?.nama_lengkap || variables?.full_name || "Unknown",
                templateKey,
                messageBody,
                "pending",
                applicantId || null,
                validSentBy
            ]
        );

        // Send via Fonnte
        try {
            const fonnte_response = await fetch("https://api.fonnte.com/send", {
                method: "POST",
                headers: {
                    "Authorization": String(fonnte_api_token),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    target: formattedPhone,
                    message: messageBody,
                    countryCode: String(fonnte_country_code),
                }),
            });

            const fonnte_result = await fonnte_response.json();

            if (fonnte_response.ok && fonnte_result.status !== false) {
                await pool.query(
                    "UPDATE whatsapp_logs SET status = 'sent', sent_at = NOW() WHERE id = $1",
                    [logId]
                );
                return res.json({ success: true, message: "WhatsApp notification sent successfully" });
            } else {
                const errorMessage = fonnte_result.reason || fonnte_result.message || "Unknown error from Fonnte API";
                await pool.query(
                    "UPDATE whatsapp_logs SET status = 'failed', error_message = $1 WHERE id = $2",
                    [errorMessage, logId]
                );
                return res.status(500).json({ success: false, error: errorMessage });
            }
        } catch (apiError) {
            const errorMsg = apiError instanceof Error ? apiError.message : "Failed to send WhatsApp message";
            await pool.query(
                "UPDATE whatsapp_logs SET status = 'failed', error_message = $1 WHERE id = $2",
                [errorMsg, logId]
            );
            return res.status(500).json({ success: false, error: errorMsg });
        }
    } catch (error) {
        console.error("Error in send-whatsapp-notification:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
    }
});

// POST /api/whatsapp/send-group
router.post('/send-group', authenticateToken, async (req, res) => {
    try {
        const { templateKey, variables, message } = req.body;

        // Get config
        const { rows: config } = await pool.query(
            "SELECT key, value FROM app_config WHERE key IN ('fonnte_api_token', 'fonnte_group_id', 'fonnte_group_enabled', 'fonnte_enabled')"
        );

        const configMap = new Map(config.map(c => [c.key, c.value]));
        const fonnte_enabled = configMap.get("fonnte_enabled") === 'true' || configMap.get("fonnte_enabled") === true;
        const fonnte_group_enabled = configMap.get("fonnte_group_enabled") === 'true' || configMap.get("fonnte_group_enabled") === true;
        const fonnte_api_token = configMap.get("fonnte_api_token");
        const fonnte_group_id = configMap.get("fonnte_group_id");

        if (!fonnte_enabled || !fonnte_group_enabled) {
            return res.json({ success: false, message: "Group notifications are disabled" });
        }

        if (!fonnte_api_token) {
            return res.status(500).json({ error: "WhatsApp API not configured" });
        }

        if (!fonnte_group_id) {
            return res.status(500).json({ error: "WhatsApp group ID not configured" });
        }

        // Determine message body
        let messageBody = message || '';

        if (templateKey && !message) {
            const { rows: templates } = await pool.query(
                "SELECT * FROM whatsapp_templates WHERE template_key = $1 AND is_active = true",
                [templateKey]
            );

            if (templates.length === 0) {
                return res.status(404).json({ error: `Template '${templateKey}' not found or inactive` });
            }

            messageBody = templates[0].message_body;
            for (const [key, value] of Object.entries(variables || {})) {
                const placeholder = `{{${key}}}`;
                messageBody = messageBody.replace(new RegExp(placeholder, "g"), String(value || ""));
            }
        }

        if (!messageBody) {
            return res.status(400).json({ error: "No message content provided" });
        }

        const logId = crypto.randomUUID();

        // Check user profile for foreign key
        let validSentBy = null;
        if (req.user && req.user.id) {
            const { rows: profiles } = await pool.query('SELECT id FROM profiles WHERE id = $1', [req.user.id]);
            if (profiles.length > 0) {
                validSentBy = req.user.id;
            }
        }

        // Insert log
        await pool.query(
            `INSERT INTO whatsapp_logs 
             (id, recipient_phone, recipient_name, message_type, message_body, status, applicant_id, sent_by, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
                logId,
                fonnte_group_id,
                "GROUP",
                templateKey || "group_message",
                messageBody,
                "pending",
                null,
                validSentBy
            ]
        );

        // Send via Fonnte using FormData (required for group messages)
        try {
            const formData = new URLSearchParams();
            formData.append('target', fonnte_group_id);
            formData.append('message', messageBody);

            const fonnte_response = await fetch("https://api.fonnte.com/send", {
                method: "POST",
                headers: {
                    "Authorization": String(fonnte_api_token),
                },
                body: formData,
            });

            const fonnte_result = await fonnte_response.json();

            if (fonnte_response.ok && fonnte_result.status !== false) {
                await pool.query(
                    "UPDATE whatsapp_logs SET status = 'sent', sent_at = NOW() WHERE id = $1",
                    [logId]
                );
                return res.json({ success: true, message: "Group notification sent successfully" });
            } else {
                const errorMessage = fonnte_result.reason || fonnte_result.message || "Unknown error from Fonnte API";
                await pool.query(
                    "UPDATE whatsapp_logs SET status = 'failed', error_message = $1 WHERE id = $2",
                    [errorMessage, logId]
                );
                return res.status(500).json({ success: false, error: errorMessage });
            }
        } catch (apiError) {
            const errorMsg = apiError instanceof Error ? apiError.message : "Failed to send group message";
            await pool.query(
                "UPDATE whatsapp_logs SET status = 'failed', error_message = $1 WHERE id = $2",
                [errorMsg, logId]
            );
            return res.status(500).json({ success: false, error: errorMsg });
        }
    } catch (error) {
        console.error("Error in send-group-notification:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
    }
});

export default router;
