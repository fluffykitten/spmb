import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from './supabase';
import { downloadPdf } from './pdfGenerator';

export interface InterviewReportData {
    candidateName: string;
    registrationNumber: string;
    originSchool: string;
    birthDate: string | null;
    parentName: string;
    interviewerName: string;
    interviewDate: string;
    generalNotes: string;
    totalScore: number;
    weightedScore: number;
    finalRecommendation: string;
    scores: Array<{
        criteriaName: string;
        criteriaWeight: number;
        score: number;
        notes: string;
    }>;
    questionNotes: Array<{
        questionText: string;
        answerText: string;
    }>;
}

interface LetterheadData {
    school_name?: string;
    school_address?: string;
    school_phone?: string;
    school_email?: string;
    school_website?: string;
    foundation_name?: string;
    letterhead_image_url?: string;
    school_logo_url?: string;
    foundation_logo_url?: string;
}

const A4_WIDTH_PX = 794;
const A4_HEIGHT_MM = 297;
const A4_WIDTH_MM = 210;
const CANVAS_SCALE = 1.5;
const JPEG_QUALITY = 0.8;
const PDF_MARGIN_MM = 5;
const PDF_CONTENT_WIDTH_MM = A4_WIDTH_MM - PDF_MARGIN_MM * 2;
const PDF_CONTENT_HEIGHT_MM = A4_HEIGHT_MM - PDF_MARGIN_MM * 2;

const loadImageAsBase64 = async (bucket: string, path: string): Promise<string | null> => {
    if (!path) return null;
    try {
        const { data, error } = await supabase.storage.from(bucket).download(path);
        if (error || !data) return null;
        const arrayBuffer = await data.arrayBuffer();
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((acc, byte) => acc + String.fromCharCode(byte), ''));
        const mimeType = data.type || 'image/png';
        return `data:${mimeType};base64,${base64}`;
    } catch {
        return null;
    }
};

const fetchLetterheadConfig = async (): Promise<LetterheadData | null> => {
    try {
        const { data, error } = await supabase
            .from('letterhead_config')
            .select('*')
            .eq('is_active', true)
            .eq('config_key', 'global')
            .maybeSingle();
        if (error) return null;
        return data;
    } catch {
        return null;
    }
};

const buildLetterheadHTML = async (config: LetterheadData): Promise<string> => {
    if (config.letterhead_image_url) {
        const base64 = await loadImageAsBase64('letterhead-images', config.letterhead_image_url);
        if (base64) {
            return `
        <div style="margin-bottom: 8px; border-bottom: 3px double #333; padding-bottom: 8px; text-align: center;">
          <img src="${base64}" style="max-height: 100px; width: auto; max-width: 100%; display: inline-block;" />
        </div>
      `;
        }
    }

    let logoBase64: string | null = null;
    if (config.school_logo_url) {
        logoBase64 = await loadImageAsBase64('letterhead-images', config.school_logo_url);
    }

    let foundationLogoBase64: string | null = null;
    if (config.foundation_logo_url) {
        foundationLogoBase64 = await loadImageAsBase64('letterhead-images', config.foundation_logo_url);
    }

    const contactParts = [config.school_phone, config.school_email, config.school_website].filter(Boolean);

    return `
    <div style="display: flex; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 3px double #333;">
      ${logoBase64 ? `<img src="${logoBase64}" style="width: 55px; height: 55px; object-fit: contain; margin-right: 12px;" />` : ''}
      <div style="flex: 1; text-align: center;">
        ${config.foundation_name ? `<p style="margin: 0; font-size: 10pt;">${config.foundation_name}</p>` : ''}
        ${config.school_name ? `<h2 style="margin: 2px 0; font-size: 13pt; font-weight: bold; text-transform: uppercase;">${config.school_name}</h2>` : ''}
        ${config.school_address ? `<p style="margin: 1px 0; font-size: 8pt;">${config.school_address}</p>` : ''}
        ${contactParts.length > 0 ? `<p style="margin: 1px 0; font-size: 8pt;">${contactParts.join(' | ')}</p>` : ''}
      </div>
      ${foundationLogoBase64 ? `<img src="${foundationLogoBase64}" style="width: 55px; height: 55px; object-fit: contain; margin-left: 12px;" />` : ''}
    </div>
  `;
};

const formatDateId = (date: Date | string | null): string => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const getScoreLabel = (score: number): string => {
    if (score >= 4.5) return 'Sangat Baik';
    if (score >= 3.5) return 'Baik';
    if (score >= 2.5) return 'Cukup';
    if (score >= 1.5) return 'Kurang';
    return 'Sangat Kurang';
};

const getScoreColor = (score: number): string => {
    if (score >= 4) return '#047857';
    if (score >= 3) return '#0369a1';
    if (score >= 2) return '#b45309';
    return '#dc2626';
};

const buildReportHTML = (data: InterviewReportData): string => {
    let html = `
    <div style="text-align: center; margin: 10px 0 15px 0;">
      <h1 style="margin: 0; font-size: 14pt; font-weight: bold; letter-spacing: 2px;">LAPORAN HASIL WAWANCARA</h1>
      <p style="margin: 4px 0 0 0; font-size: 9pt; color: #6b7280;">Penerimaan Peserta Didik Baru</p>
      <div style="width: 100%; height: 2px; background: #333; margin: 6px auto 0 auto;"></div>
    </div>
  `;

    // Candidate Info
    html += `
    <table style="width: 100%; margin-bottom: 14px; font-size: 10pt; border-collapse: collapse;">
      <tr>
        <td style="width: 140px; padding: 2px 0;">Nama Lengkap</td>
        <td style="width: 12px; padding: 2px 0;">:</td>
        <td style="padding: 2px 0; font-weight: bold;">${data.candidateName || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0;">No. Pendaftaran</td>
        <td style="padding: 2px 0;">:</td>
        <td style="padding: 2px 0;">${data.registrationNumber || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0;">Asal Sekolah</td>
        <td style="padding: 2px 0;">:</td>
        <td style="padding: 2px 0;">${data.originSchool || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0;">Tempat, Tanggal Lahir</td>
        <td style="padding: 2px 0;">:</td>
        <td style="padding: 2px 0;">${data.birthDate ? formatDateId(data.birthDate) : '-'}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0;">Nama Orang Tua/Wali</td>
        <td style="padding: 2px 0;">:</td>
        <td style="padding: 2px 0;">${data.parentName || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0;">Pewawancara</td>
        <td style="padding: 2px 0;">:</td>
        <td style="padding: 2px 0;">${data.interviewerName || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0;">Tanggal Wawancara</td>
        <td style="padding: 2px 0;">:</td>
        <td style="padding: 2px 0;">${formatDateId(data.interviewDate)}</td>
      </tr>
    </table>
  `;

    // Score Summary Box
    const scoreColor = getScoreColor(data.weightedScore);
    const scoreLabel = getScoreLabel(data.weightedScore);
    html += `
    <div style="border: 2px solid ${scoreColor}; border-radius: 6px; padding: 12px; margin-bottom: 16px; background: ${scoreColor}11;">
      <table style="width: 100%; font-size: 10pt; border-collapse: collapse;">
        <tr>
          <td style="width: 60%; vertical-align: top;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 3px 0;">Skor Rata-rata</td>
                <td style="padding: 3px 0; font-weight: bold; text-align: right;">${Number(data.totalScore).toFixed(2)} / 5.00</td>
              </tr>
              <tr>
                <td style="padding: 3px 0;">Skor Tertimbang</td>
                <td style="padding: 3px 0; font-weight: bold; text-align: right;">${Number(data.weightedScore).toFixed(2)} / 5.00</td>
              </tr>
            </table>
          </td>
          <td style="width: 40%; vertical-align: middle; text-align: center;">
            <div style="font-size: 24pt; font-weight: bold; color: ${scoreColor};">${Number(data.weightedScore).toFixed(2)}</div>
            <div style="font-size: 10pt; color: ${scoreColor}; font-weight: bold;">${scoreLabel}</div>
          </td>
        </tr>
      </table>
    </div>
  `;

    // Score Table
    html += `
    <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 8px 0; border-bottom: 2px solid #333; padding-bottom: 4px;">
      PENILAIAN PER KRITERIA
    </h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10pt;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="border: 1px solid #d1d5db; padding: 6px 8px; text-align: left;">Kriteria</th>
          <th style="border: 1px solid #d1d5db; padding: 6px 8px; text-align: center; width: 60px;">Bobot</th>
          <th style="border: 1px solid #d1d5db; padding: 6px 8px; text-align: center; width: 60px;">Skor</th>
          <th style="border: 1px solid #d1d5db; padding: 6px 8px; text-align: left;">Catatan</th>
        </tr>
      </thead>
      <tbody>
  `;

    data.scores.forEach(s => {
        const sColor = getScoreColor(s.score);
        html += `
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 5px 8px; font-weight: 500;">${s.criteriaName}</td>
          <td style="border: 1px solid #d1d5db; padding: 5px 8px; text-align: center;">${s.criteriaWeight}</td>
          <td style="border: 1px solid #d1d5db; padding: 5px 8px; text-align: center; font-weight: bold; color: ${sColor};">${s.score}/5</td>
          <td style="border: 1px solid #d1d5db; padding: 5px 8px; font-size: 9pt; color: #475569;">${s.notes || '-'}</td>
        </tr>
    `;
    });

    html += `</tbody></table>`;

    // Question Notes
    if (data.questionNotes.length > 0) {
        html += `
      <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 8px 0; border-bottom: 2px solid #333; padding-bottom: 4px;">
        CATATAN JAWABAN
      </h3>
    `;

        data.questionNotes.forEach((qn, idx) => {
            html += `
        <div style="margin-bottom: 8px; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 4px; border-left: 4px solid #0ea5e9;">
          <p style="margin: 0 0 4px 0; font-size: 10pt; font-weight: bold;">Pertanyaan ${idx + 1}: ${qn.questionText}</p>
          <p style="margin: 0; font-size: 9pt; color: #475569;">Jawaban: ${qn.answerText || '-'}</p>
        </div>
      `;
        });
    }

    // General Notes
    if (data.generalNotes) {
        html += `
      <h3 style="font-size: 11pt; font-weight: bold; margin: 16px 0 8px 0; border-bottom: 2px solid #333; padding-bottom: 4px;">
        CATATAN UMUM
      </h3>
      <div style="padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10pt; background: #f8fafc;">
        ${data.generalNotes.replace(/\n/g, '<br>')}
      </div>
    `;
    }

    // Final recommendation
    if (data.finalRecommendation) {
        html += `
      <h3 style="font-size: 11pt; font-weight: bold; margin: 16px 0 8px 0; border-bottom: 2px solid #333; padding-bottom: 4px;">
        REKOMENDASI
      </h3>
      <div style="padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10pt; background: #f0fdf4;">
        ${data.finalRecommendation.replace(/\n/g, '<br>')}
      </div>
    `;
    }

    // Footer
    html += `
    <div style="margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="font-size: 8pt; color: #94a3b8; margin: 0;">
        Dokumen ini digenerate pada: ${formatDateId(new Date())}
      </p>
    </div>
  `;

    return html;
};

const renderToPDF = async (html: string): Promise<Blob> => {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = `${A4_WIDTH_PX}px`;
    container.style.boxSizing = 'border-box';
    container.style.padding = '40px 60px';
    container.style.fontFamily = "'Times New Roman', 'Serif', serif";
    container.style.fontSize = '11pt';
    container.style.lineHeight = '1.35';
    container.style.color = '#1e293b';
    container.style.background = '#ffffff';
    document.body.appendChild(container);

    try {
        const canvas = await html2canvas(container, {
            scale: CANVAS_SCALE,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: A4_WIDTH_PX,
            windowWidth: A4_WIDTH_PX,
        });

        const imgData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const imgHeight = (canvas.height * PDF_CONTENT_WIDTH_MM) / canvas.width;
        const totalPages = Math.ceil(imgHeight / PDF_CONTENT_HEIGHT_MM);

        for (let page = 0; page < totalPages; page++) {
            if (page > 0) pdf.addPage();
            const yOffset = PDF_MARGIN_MM - (page * PDF_CONTENT_HEIGHT_MM);
            pdf.addImage(imgData, 'JPEG', PDF_MARGIN_MM, yOffset, PDF_CONTENT_WIDTH_MM, imgHeight);
        }

        return pdf.output('blob');
    } finally {
        document.body.removeChild(container);
    }
};

export const generateInterviewReportPDF = async (data: InterviewReportData): Promise<void> => {
    const letterheadConfig = await fetchLetterheadConfig();
    let letterheadHTML = '';
    if (letterheadConfig) {
        letterheadHTML = await buildLetterheadHTML(letterheadConfig);
    }

    const reportHTML = buildReportHTML(data);
    const fullHTML = `${letterheadHTML}${reportHTML}`;
    const pdfBlob = await renderToPDF(fullHTML);

    const filename = `Laporan_Wawancara_${data.candidateName || 'Kandidat'}.pdf`;
    downloadPdf(pdfBlob, filename);
};
