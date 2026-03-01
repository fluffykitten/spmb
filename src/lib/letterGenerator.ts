import { supabase } from './supabase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface LetterTemplate {
  id: string;
  name: string;
  html_content: string;
  letterhead_config: any;
  typography_config: any;
  letter_number_config: any;
  signature_config: any;
  layout_config: any;
  variables: string[];
}

interface Applicant {
  id: string;
  user_id: string;
  dynamic_data: Record<string, any>;
  profiles?: {
    email: string;
    full_name: string;
  };
}

export const generateLetterNumber = async (
  templateId: string,
  config: any
): Promise<string> => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: counter, error: fetchError } = await supabase
    .from('letter_number_counters')
    .select('*')
    .eq('template_id', templateId)
    .eq('year', year)
    .eq('month', config.counter_reset === 'monthly' ? month : 0)
    .maybeSingle();

  let currentCounter = 1;

  if (counter) {
    currentCounter = counter.current_counter + 1;

    const { error: updateError } = await supabase
      .from('letter_number_counters')
      .update({
        current_counter: currentCounter,
        last_used_at: new Date().toISOString()
      })
      .eq('id', counter.id);

    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from('letter_number_counters')
      .insert({
        template_id: templateId,
        year,
        month: config.counter_reset === 'monthly' ? month : 0,
        current_counter: currentCounter,
        last_used_at: new Date().toISOString()
      });

    if (insertError) throw insertError;
  }

  const paddedCounter = String(currentCounter).padStart(3, '0');

  let letterNumber = config.format_pattern || '{counter}/{middle}/{suffix}';
  letterNumber = letterNumber
    .replace('{counter}', paddedCounter)
    .replace('{prefix}', config.prefix || '')
    .replace('{middle}', config.middle_code || 'PPDB')
    .replace('{suffix}', config.suffix || year.toString())
    .replace('{year}', year.toString())
    .replace('{month}', String(month).padStart(2, '0'))
    .replace('{YYYY}', year.toString())
    .replace('{MM}', String(month).padStart(2, '0'));

  return letterNumber;
};

export const replaceVariables = (
  html: string,
  applicantData: Applicant,
  letterNumber: string
): string => {
  const dynamicData = applicantData.dynamic_data || {};
  const profileData = applicantData.profiles || {};

  const variables: Record<string, any> = {
    nama_lengkap: dynamicData.nama_lengkap || profileData.full_name || '',
    nisn: dynamicData.nisn || '',
    email: profileData.email || '',
    no_hp: dynamicData.no_hp || dynamicData.telepon || '',
    tempat_lahir: dynamicData.tempat_lahir || '',
    tanggal_lahir: dynamicData.tanggal_lahir || '',
    jenis_kelamin: dynamicData.jenis_kelamin || '',
    agama: dynamicData.agama || '',
    alamat: dynamicData.alamat || dynamicData.alamat_lengkap || '',
    kelurahan: dynamicData.kelurahan || '',
    kecamatan: dynamicData.kecamatan || '',
    kabupaten: dynamicData.kabupaten || dynamicData.kota || '',
    provinsi: dynamicData.provinsi || '',
    kode_pos: dynamicData.kode_pos || '',
    asal_sekolah: dynamicData.asal_sekolah || '',
    nama_ayah: dynamicData.nama_ayah || dynamicData.orang_tua?.nama_ayah || '',
    nama_ibu: dynamicData.nama_ibu || dynamicData.orang_tua?.nama_ibu || '',
    pekerjaan_ayah: dynamicData.pekerjaan_ayah || dynamicData.orang_tua?.pekerjaan_ayah || '',
    pekerjaan_ibu: dynamicData.pekerjaan_ibu || dynamicData.orang_tua?.pekerjaan_ibu || '',
    no_hp_ortu: dynamicData.no_hp_ortu || dynamicData.orang_tua?.no_hp || '',
    nomor_surat: letterNumber,
    letter_number: letterNumber,
    tanggal: formatDate(new Date()),
    tanggal_sekarang: formatDate(new Date()),
    tahun: new Date().getFullYear(),
    bulan: formatMonth(new Date()),
    ...dynamicData
  };

  let processedHtml = html;

  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'gi');
    const value = variables[key] || '-';
    processedHtml = processedHtml.replace(regex, String(value));
  });

  processedHtml = processedHtml.replace(/{{([^}]+)}}/g, '-');

  return processedHtml;
};

export const buildLetterHead = (config: any): string => {
  if (!config || Object.keys(config).length === 0) return '';

  const logoSize = config.logo_size || 80;
  const alignment = config.logo_position === 'center' ? 'center' :
                    config.logo_position === 'right' ? 'flex-end' : 'flex-start';

  let letterhead = `
    <div style="display: flex; align-items: center; justify-content: ${alignment}; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #000;">
  `;

  if (config.letterhead_type === 'both' || config.letterhead_type === 'school') {
    if (config.school_logo_url) {
      letterhead += `
        <img src="${config.school_logo_url}" alt="Logo Sekolah" style="width: ${logoSize}px; height: ${logoSize}px; object-fit: contain; margin-right: 20px;" />
      `;
    }
  }

  letterhead += `
    <div style="text-align: ${config.logo_position === 'center' ? 'center' : 'left'}; flex: 1;">
      ${config.school_name ? `<h2 style="margin: 0; font-size: 18px; font-weight: bold;">${config.school_name}</h2>` : ''}
      ${config.foundation_name ? `<p style="margin: 5px 0; font-size: 14px;">${config.foundation_name}</p>` : ''}
      ${config.address ? `<p style="margin: 5px 0; font-size: 12px;">${config.address}</p>` : ''}
      ${config.phone || config.email ? `<p style="margin: 5px 0; font-size: 12px;">${[config.phone, config.email].filter(Boolean).join(' | ')}</p>` : ''}
      ${config.website ? `<p style="margin: 5px 0; font-size: 12px;">${config.website}</p>` : ''}
    </div>
  `;

  if (config.letterhead_type === 'both' && config.foundation_logo_url) {
    letterhead += `
      <img src="${config.foundation_logo_url}" alt="Logo Yayasan" style="width: ${logoSize}px; height: ${logoSize}px; object-fit: contain; margin-left: 20px;" />
    `;
  }

  letterhead += `</div>`;

  return letterhead;
};

export const buildSignature = (config: any): string => {
  if (!config || Object.keys(config).length === 0) return '';

  const position = config.signature_position === 'center' ? 'center' :
                   config.signature_position === 'left' ? 'flex-start' : 'flex-end';

  let signature = `
    <div style="margin-top: 40px; display: flex; justify-content: ${position};">
      <div style="text-align: center; min-width: 200px;">
  `;

  if (config.show_date && config.signature_city) {
    signature += `
      <p style="margin-bottom: 10px;">${config.signature_city}, ${formatDate(new Date())}</p>
    `;
  }

  if (config.signer_title) {
    signature += `<p style="margin-bottom: 60px;">${config.signer_title}</p>`;
  }

  if (config.show_signature_image && config.signature_image_url) {
    signature += `
      <div style="margin: -50px 0 10px 0;">
        <img src="${config.signature_image_url}" alt="Tanda Tangan" style="width: 120px; height: auto;" />
      </div>
    `;
  }

  if (config.show_stamp && config.stamp_image_url) {
    signature += `
      <div style="margin-top: -40px; margin-bottom: 10px;">
        <img src="${config.stamp_image_url}" alt="Stempel" style="width: 80px; height: auto; opacity: 0.8;" />
      </div>
    `;
  }

  if (config.signer_name) {
    signature += `<p style="font-weight: bold; text-decoration: underline; margin: 0;">${config.signer_name}</p>`;
  }

  if (config.signer_nip) {
    signature += `<p style="margin: 5px 0 0 0; font-size: 12px;">NIP. ${config.signer_nip}</p>`;
  }

  signature += `
      </div>
    </div>
  `;

  return signature;
};

export const applyTypography = (html: string, config: any): string => {
  if (!config || Object.keys(config).length === 0) return html;

  const fontFamily = config.font_family || 'Times New Roman';
  const fontSize = config.body_font_size || 12;
  const lineHeight = config.line_height || 1.5;
  const textAlign = config.text_align || 'justify';

  const styledHtml = `
    <div style="font-family: '${fontFamily}', serif; font-size: ${fontSize}pt; line-height: ${lineHeight}; text-align: ${textAlign};">
      ${html}
    </div>
  `;

  return styledHtml;
};

export const generateCompleteHTML = (
  template: LetterTemplate,
  applicant: Applicant,
  letterNumber: string
): string => {
  let processedContent = replaceVariables(template.html_content, applicant, letterNumber);

  const letterhead = buildLetterHead(template.letterhead_config);
  const signature = buildSignature(template.signature_config);

  const fullHTML = `
    ${letterhead}
    ${processedContent}
    ${signature}
  `;

  const styledHTML = applyTypography(fullHTML, template.typography_config);

  const layoutConfig = template.layout_config || {};
  const marginTop = (layoutConfig.margin_top || 2.5) * 37.8;
  const marginBottom = (layoutConfig.margin_bottom || 2.5) * 37.8;
  const marginLeft = (layoutConfig.margin_left || 3) * 37.8;
  const marginRight = (layoutConfig.margin_right || 3) * 37.8;

  const completeHTML = `
    <div style="padding: ${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px; font-family: 'Times New Roman', serif; box-sizing: border-box; word-break: break-word; overflow-wrap: break-word;">
      ${styledHTML}
    </div>
  `;

  return completeHTML;
};

export const convertHTMLToPDF = async (
  html: string,
  filename: string
): Promise<Blob> => {
  const PDF_MARGIN = 5;
  const CONTENT_WIDTH = 210 - PDF_MARGIN * 2;
  const CONTENT_HEIGHT = 297 - PDF_MARGIN * 2;

  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '210mm';
  container.style.boxSizing = 'border-box';
  container.style.background = '#ffffff';
  document.body.appendChild(container);

  console.log('[LetterGen] Offscreen container created for PDF rendering');

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    console.log('[LetterGen] Canvas rendered:', canvas.width, 'x', canvas.height, 'px');

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgHeight = (canvas.height * CONTENT_WIDTH) / canvas.width;
    const totalPages = Math.ceil(imgHeight / CONTENT_HEIGHT);
    console.log('[LetterGen] Content height:', imgHeight.toFixed(1), 'mm, pages:', totalPages);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }
      const yOffset = PDF_MARGIN - (page * CONTENT_HEIGHT);
      pdf.addImage(imgData, 'PNG', PDF_MARGIN, yOffset, CONTENT_WIDTH, imgHeight);
    }

    console.log('[LetterGen] PDF generated successfully');
    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const formatMonth = (date: Date): string => {
  return date.toLocaleDateString('id-ID', {
    month: 'long'
  });
};
