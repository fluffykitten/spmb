import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from './supabase';
import { downloadPdf } from './pdfGenerator';

export interface ExamReportData {
  studentName: string;
  registrationNumber: string;
  examTitle: string;
  attemptNumber: number;
  submittedAt: string;
  passingScore: number;
  result: {
    total_points: number;
    max_points: number;
    percentage: number;
    passed: boolean | null;
    grading_status: string;
    graded_at?: string;
  };
  answers: Array<{
    question: {
      id: string;
      question_text: string;
      question_type: string;
      points: number;
    };
    selected_option_id?: string;
    essay_answer?: string;
    points_earned: number;
  }>;
  allOptions: Record<string, Array<{
    id: string;
    option_text: string;
    is_correct: boolean;
  }>>;
  proctoringLogs?: Array<{
    event_type: string;
    timestamp?: string;
    created_at?: string;
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
    console.log('[ExamReport] Loading image from', bucket, path);
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) {
      console.error('[ExamReport] Failed to load image:', error);
      return null;
    }
    const arrayBuffer = await data.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((acc, byte) => acc + String.fromCharCode(byte), '')
    );
    const mimeType = data.type || 'image/png';
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('[ExamReport] Error loading image:', error);
    return null;
  }
};

const fetchLetterheadConfig = async (): Promise<LetterheadData | null> => {
  try {
    console.log('[ExamReport] Fetching letterhead config');
    const { data, error } = await supabase
      .from('letterhead_config')
      .select('*')
      .eq('is_active', true)
      .eq('config_key', 'global')
      .maybeSingle();
    if (error) {
      console.error('[ExamReport] Error fetching letterhead:', error);
      return null;
    }
    console.log('[ExamReport] Letterhead config loaded:', data ? 'found' : 'not found');
    return data;
  } catch (error) {
    console.error('[ExamReport] Error fetching letterhead:', error);
    return null;
  }
};

const buildLetterheadHTML = async (config: LetterheadData): Promise<string> => {
  if (config.letterhead_image_url) {
    const base64 = await loadImageAsBase64('letterhead-images', config.letterhead_image_url);
    if (base64) {
      console.log('[ExamReport] Using pre-composed letterhead image');
      return `
        <div style="margin-bottom: 8px; border-bottom: 3px double #333; padding-bottom: 8px; text-align: center;">
          <img src="${base64}" style="max-height: 100px; width: auto; max-width: 100%; display: inline-block;" />
        </div>
      `;
    }
  }

  console.log('[ExamReport] Building letterhead from components');
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

const formatDateTimeId = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getQuestionTypeLabel = (type: string): string => {
  switch (type) {
    case 'multiple_choice': return 'Pilihan Ganda';
    case 'true_false': return 'Benar/Salah';
    case 'essay': return 'Essay';
    default: return type;
  }
};

const getEventLabel = (eventType: string): string => {
  switch (eventType) {
    case 'tab_switch': return 'Pindah Tab';
    case 'fullscreen_exit': return 'Keluar Fullscreen';
    case 'copy_attempt': return 'Copy';
    case 'paste_attempt': return 'Paste';
    case 'right_click': return 'Right Click';
    case 'suspicious_activity': return 'Aktivitas Mencurigakan';
    default: return eventType;
  }
};

const sanitizeHtmlForPdf = (html: string): string => {
  if (!html) return '';
  const isPlainText = !html.includes('<') && !html.includes('>');
  if (isPlainText) {
    return html.replace(/\n/g, '<br>');
  }
  return html;
};

const buildReportContentHTML = (data: ExamReportData, includeProctoring: boolean): string => {
  const { result, answers, allOptions } = data;

  let html = `
    <style>
      .rich-content img { max-width: 100%; height: auto; margin: 4px 0; border-radius: 4px; }
      .rich-content table { border-collapse: collapse; width: 100%; margin: 4px 0; }
      .rich-content th, .rich-content td { border: 1px solid #d1d5db; padding: 4px 8px; text-align: left; font-size: 9pt; }
      .rich-content th { background-color: #f1f5f9; font-weight: bold; }
      .rich-content ul, .rich-content ol { padding-left: 18px; margin: 4px 0; }
      .rich-content li { margin: 2px 0; }
      .rich-content blockquote { border-left: 3px solid #d1d5db; padding-left: 8px; margin: 4px 0; color: #64748b; }
      .rich-content pre { background: #1e293b; color: #e2e8f0; padding: 6px 10px; border-radius: 4px; font-size: 8pt; overflow: auto; }
      .rich-content strong, .rich-content b { font-weight: bold; }
      .rich-content em, .rich-content i { font-style: italic; }
      .rich-content u { text-decoration: underline; }
      .rich-content s { text-decoration: line-through; }
      .rich-content p { margin: 2px 0; }
    </style>
    <div style="text-align: center; margin: 10px 0 15px 0;">
      <h1 style="margin: 0; font-size: 14pt; font-weight: bold; letter-spacing: 2px;">LAPORAN HASIL UJIAN</h1>
      <div style="width: 100%; height: 2px; background: #333; margin: 6px auto 0 auto;"></div>
    </div>
  `;

  html += `
    <table style="width: 100%; margin-bottom: 14px; font-size: 10pt; border-collapse: collapse;">
      <tr>
        <td style="width: 120px; padding: 2px 0;">Nama Lengkap</td>
        <td style="width: 12px; padding: 2px 0;">:</td>
        <td style="padding: 2px 0; font-weight: bold;">${data.studentName || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0;">No. Registrasi</td>
        <td style="padding: 2px 0;">:</td>
        <td style="padding: 2px 0;">${data.registrationNumber || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0;">Ujian</td>
        <td style="padding: 2px 0;">:</td>
        <td style="padding: 2px 0;">${data.examTitle}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0;">Percobaan</td>
        <td style="padding: 2px 0;">:</td>
        <td style="padding: 2px 0;">#${data.attemptNumber}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0;">Tanggal Ujian</td>
        <td style="padding: 2px 0;">:</td>
        <td style="padding: 2px 0;">${formatDateTimeId(data.submittedAt)}</td>
      </tr>
    </table>
  `;

  const passedText = result.passed === true ? 'LULUS' : result.passed === false ? 'TIDAK LULUS' : 'Belum Ditentukan';
  const passedColor = result.passed === true ? '#047857' : result.passed === false ? '#dc2626' : '#6b7280';
  const passedBg = result.passed === true ? '#ecfdf5' : result.passed === false ? '#fef2f2' : '#f9fafb';

  html += `
    <div style="border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; margin-bottom: 16px; background: ${passedBg};">
      <table style="width: 100%; font-size: 10pt; border-collapse: collapse;">
        <tr>
          <td style="width: 50%; vertical-align: top;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 3px 0;">Total Nilai</td>
                <td style="padding: 3px 0; font-weight: bold; text-align: right;">${result.total_points.toFixed(1)} / ${result.max_points.toFixed(1)}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0;">Persentase</td>
                <td style="padding: 3px 0; font-weight: bold; text-align: right;">${result.percentage.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style="padding: 3px 0;">KKM</td>
                <td style="padding: 3px 0; text-align: right;">${data.passingScore}%</td>
              </tr>
            </table>
          </td>
          <td style="width: 50%; vertical-align: middle; text-align: center;">
            <div style="font-size: 18pt; font-weight: bold; color: ${passedColor}; letter-spacing: 2px;">
              ${passedText}
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

  if (includeProctoring && data.proctoringLogs && data.proctoringLogs.length > 0) {
    const violationSummary: Record<string, number> = {};
    for (const log of data.proctoringLogs) {
      violationSummary[log.event_type] = (violationSummary[log.event_type] || 0) + 1;
    }

    html += `
      <div style="border: 1px solid #fecaca; border-radius: 6px; padding: 10px; margin-bottom: 16px; background: #fef2f2;">
        <h3 style="margin: 0 0 6px 0; font-size: 10pt; color: #991b1b;">Log Pengawasan (${data.proctoringLogs.length} pelanggaran)</h3>
        <p style="font-size: 9pt; margin: 0; color: #7f1d1d;">
          ${Object.entries(violationSummary).map(([type, count]) => `${getEventLabel(type)}: ${count}x`).join(' &nbsp;|&nbsp; ')}
        </p>
      </div>
    `;
  }

  html += `
    <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 10px 0; border-bottom: 2px solid #333; padding-bottom: 4px;">
      RINCIAN JAWABAN
    </h3>
  `;

  answers.forEach((answer, index) => {
    const question = answer.question;
    const questionOptions = allOptions[question.id] || [];
    const pointsEarned = answer.points_earned ?? 0;
    const isCorrectAnswer = pointsEarned > 0;
    const borderLeftColor = isCorrectAnswer ? '#10b981' : '#ef4444';

    html += `
      <div style="margin-bottom: 10px; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 4px; border-left: 4px solid ${borderLeftColor};">
        <div style="margin-bottom: 6px; display: flex; justify-content: space-between; align-items: baseline; line-height: 1.6;">
          <div>
            <span style="font-weight: bold; font-size: 10pt;">Soal ${index + 1}</span>
            <span style="font-size: 8pt; color: #6b7280; margin-left: 6px;">(${getQuestionTypeLabel(question.question_type)})</span>
          </div>
          <span style="font-size: 10pt; font-weight: bold; color: ${isCorrectAnswer ? '#047857' : '#dc2626'}; white-space: nowrap; margin-left: 8px;">
            ${pointsEarned.toFixed(1)} / ${Number(question.points).toFixed(1)}
          </span>
        </div>
        <div class="rich-content" style="margin: 0 0 8px 0; font-size: 10pt; word-break: break-word;">${sanitizeHtmlForPdf(question.question_text)}</div>
    `;

    if (question.question_type === 'essay') {
      html += `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; margin-top: 4px;">
          <p style="margin: 0 0 3px 0; font-size: 8pt; font-weight: bold; color: #475569;">Jawaban:</p>
          <div class="rich-content" style="margin: 0; font-size: 9pt; word-break: break-word;">${answer.essay_answer ? sanitizeHtmlForPdf(answer.essay_answer) : '-'}</div>
        </div>
      `;
    } else {
      questionOptions.forEach((opt: any) => {
        const isSelected = answer.selected_option_id === opt.id;
        const isCorrectOpt = opt.is_correct;

        let bgColor = '#ffffff';
        let borderColor = '#e2e8f0';
        let marker = '';

        if (isSelected && isCorrectOpt) {
          bgColor = '#ecfdf5';
          borderColor = '#10b981';
          marker = '<span style="color: #047857; font-weight: bold;">&#10003;</span> ';
        } else if (isSelected && !isCorrectOpt) {
          bgColor = '#fef2f2';
          borderColor = '#ef4444';
          marker = '<span style="color: #dc2626; font-weight: bold;">&#10007;</span> ';
        } else if (isCorrectOpt) {
          bgColor = '#f0fdf4';
          borderColor = '#86efac';
          marker = '<span style="color: #047857;">&#10003;</span> ';
        }

        html += `
          <div style="padding: 4px 8px; margin: 2px 0; border: 1px solid ${borderColor}; border-radius: 3px; background: ${bgColor}; font-size: 9pt; word-break: break-word;">
            ${marker}<span class="rich-content">${sanitizeHtmlForPdf(opt.option_text)}</span>
            ${isSelected ? '<span style="font-size: 7pt; color: #6b7280; margin-left: 6px;">(Dipilih)</span>' : ''}
            ${isCorrectOpt ? '<span style="font-size: 7pt; color: #047857; margin-left: 6px;">(Jawaban Benar)</span>' : ''}
          </div>
        `;
      });

      if (!answer.selected_option_id) {
        html += `<p style="font-size: 9pt; color: #dc2626; font-style: italic; margin: 4px 0 0 0;">Tidak dijawab</p>`;
      }
    }

    html += `</div>`;
  });

  html += `
    <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="font-size: 8pt; color: #94a3b8; margin: 0;">
        Dokumen ini digenerate pada: ${formatDateTimeId(new Date())}
      </p>
    </div>
  `;

  return html;
};

const renderExamReportToPDF = async (html: string): Promise<Blob> => {
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
  container.style.wordBreak = 'break-word';
  container.style.overflowWrap = 'break-word';
  document.body.appendChild(container);

  console.log('[ExamReport] Offscreen container created, width:', A4_WIDTH_PX, 'px, with padding 40px 60px');

  try {
    const canvas = await html2canvas(container, {
      scale: CANVAS_SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: A4_WIDTH_PX,
      windowWidth: A4_WIDTH_PX,
    });

    console.log('[ExamReport] Canvas rendered:', canvas.width, 'x', canvas.height, 'px');

    const imgData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    console.log('[ExamReport] JPEG data length:', Math.round(imgData.length / 1024), 'KB');

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgHeight = (canvas.height * PDF_CONTENT_WIDTH_MM) / canvas.width;
    const totalPages = Math.ceil(imgHeight / PDF_CONTENT_HEIGHT_MM);
    console.log('[ExamReport] Content height:', imgHeight.toFixed(1), 'mm, pages:', totalPages);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }
      const yOffset = PDF_MARGIN_MM - (page * PDF_CONTENT_HEIGHT_MM);
      pdf.addImage(imgData, 'JPEG', PDF_MARGIN_MM, yOffset, PDF_CONTENT_WIDTH_MM, imgHeight);
    }

    const blob = pdf.output('blob');
    console.log('[ExamReport] Final PDF size:', Math.round(blob.size / 1024), 'KB');
    return blob;
  } finally {
    document.body.removeChild(container);
    console.log('[ExamReport] Offscreen container removed');
  }
};

const generateExamReportPDF = async (
  data: ExamReportData,
  includeProctoring: boolean
): Promise<Blob> => {
  console.log('[ExamReport] Starting PDF generation, includeProctoring:', includeProctoring);

  const letterheadConfig = await fetchLetterheadConfig();
  let letterheadHTML = '';
  if (letterheadConfig) {
    console.log('[ExamReport] Building letterhead HTML');
    letterheadHTML = await buildLetterheadHTML(letterheadConfig);
  } else {
    console.log('[ExamReport] No letterhead config found, generating without letterhead');
  }

  console.log('[ExamReport] Building report content HTML');
  const reportContent = buildReportContentHTML(data, includeProctoring);

  const fullHTML = `${letterheadHTML}${reportContent}`;

  console.log('[ExamReport] HTML built, rendering to PDF via html2canvas (JPEG mode)');
  const pdfBlob = await renderExamReportToPDF(fullHTML);
  console.log('[ExamReport] PDF generated, size:', Math.round(pdfBlob.size / 1024), 'KB');
  return pdfBlob;
};

export const generateAdminExamReport = async (data: ExamReportData): Promise<void> => {
  console.log('[ExamReport] Generating admin report for:', data.studentName);
  const blob = await generateExamReportPDF(data, true);
  const filename = `Laporan_Ujian_${data.examTitle}_${data.studentName}.pdf`;
  downloadPdf(blob, filename);
  console.log('[ExamReport] Admin report downloaded:', filename);
};

export const generateStudentExamReport = async (data: ExamReportData): Promise<void> => {
  console.log('[ExamReport] Generating student report for:', data.studentName);
  const blob = await generateExamReportPDF(data, false);
  const filename = `Hasil_Ujian_${data.examTitle}_${data.studentName}.pdf`;
  downloadPdf(blob, filename);
  console.log('[ExamReport] Student report downloaded:', filename);
};
