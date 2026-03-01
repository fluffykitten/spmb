import * as XLSX from 'xlsx';
import { FIELD_NAMES, getFieldValue } from './fieldConstants';

interface Applicant {
  id: string;
  user_id: string;
  status: string;
  registration_number: string | null;
  dynamic_data: Record<string, any>;
  created_at: string;
  updated_at: string;
  profiles?: {
    role: string;
    email: string;
    full_name: string;
  };
}

export interface ExportQualityReport {
  totalRecords: number;
  missingEmail: number;
  missingPhone: number;
  missingParentPhone: number;
  fieldsFound: {
    phoneStandard: number;
    phoneLegacy: number;
    parentPhoneStandard: number;
    parentPhoneLegacy: number;
  };
}

export const exportApplicantsToExcel = (
  applicants: Applicant[],
  filename: string = 'Data_Pendaftar'
): ExportQualityReport => {
  const qualityReport: ExportQualityReport = {
    totalRecords: applicants.length,
    missingEmail: 0,
    missingPhone: 0,
    missingParentPhone: 0,
    fieldsFound: {
      phoneStandard: 0,
      phoneLegacy: 0,
      parentPhoneStandard: 0,
      parentPhoneLegacy: 0,
    },
  };

  const allDynamicKeys = new Set<string>();
  applicants.forEach(applicant => {
    if (applicant.dynamic_data) {
      Object.keys(applicant.dynamic_data).forEach(key => allDynamicKeys.add(key));
    }
  });

  const formattedData = applicants.map((applicant, index) => {
    const dynamicData = applicant.dynamic_data || {};

    const email = applicant.profiles?.email || '-';

    if (!applicant.profiles?.email) {
      qualityReport.missingEmail++;
    }

    const phoneStandard = dynamicData[FIELD_NAMES.NO_TELEPON];
    const phoneLegacy = dynamicData.no_hp || dynamicData.telepon || dynamicData.phone_number;
    const phone = getFieldValue(dynamicData, FIELD_NAMES.NO_TELEPON) || '-';

    if (phoneStandard) qualityReport.fieldsFound.phoneStandard++;
    else if (phoneLegacy) qualityReport.fieldsFound.phoneLegacy++;
    else qualityReport.missingPhone++;

    const parentPhoneStandard = dynamicData[FIELD_NAMES.NO_TELEPON_ORTU];
    const parentPhoneLegacy = dynamicData.no_hp_ortu || dynamicData.orang_tua?.no_hp;
    const parentPhone = getFieldValue(dynamicData, FIELD_NAMES.NO_TELEPON_ORTU) ||
                        dynamicData.orang_tua?.no_hp || '-';

    if (parentPhoneStandard) qualityReport.fieldsFound.parentPhoneStandard++;
    else if (parentPhoneLegacy) qualityReport.fieldsFound.parentPhoneLegacy++;
    else qualityReport.missingParentPhone++;

    const row: Record<string, any> = {
      'No': index + 1,
      'No. Pendaftaran': applicant.registration_number || '-',
      'Email': email,
      'Status': applicant.status || '-',
      'Tanggal Daftar': formatDate(applicant.created_at),
      'Terakhir Update': formatDate(applicant.updated_at)
    };

    allDynamicKeys.forEach(key => {
      const value = dynamicData[key];

      if (value === null || value === undefined) {
        row[formatColumnName(key)] = '-';
      } else if (typeof value === 'object') {
        row[formatColumnName(key)] = JSON.stringify(value);
      } else if (typeof value === 'string' && value.startsWith('applicant-images/')) {
        row[formatColumnName(key)] = '[Image]';
      } else {
        row[formatColumnName(key)] = value;
      }
    });

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  const headers = formattedData.length > 0 ? Object.keys(formattedData[0]) : [];
  const columnWidths = headers.map(header => {
    if (header === 'No') return { wch: 5 };
    if (header === 'No. Pendaftaran') return { wch: 18 };
    if (header === 'Email') return { wch: 25 };
    if (header === 'Status') return { wch: 12 };
    if (header.includes('Tanggal') || header.includes('Date')) return { wch: 18 };
    if (header.includes('Alamat') || header.includes('Address')) return { wch: 40 };
    return { wch: 20 };
  });
  worksheet['!cols'] = columnWidths;

  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = XLSX.utils.encode_col(C) + '1';
    if (!worksheet[address]) continue;
    worksheet[address].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Pendaftar');

  const statsData = [
    { 'Keterangan': 'Total Pendaftar', 'Jumlah': applicants.length },
    { 'Keterangan': 'Draft', 'Jumlah': applicants.filter(a => a.status === 'draft').length },
    { 'Keterangan': 'Submitted', 'Jumlah': applicants.filter(a => a.status === 'submitted').length },
    { 'Keterangan': 'Review', 'Jumlah': applicants.filter(a => a.status === 'review').length },
    { 'Keterangan': 'Approved', 'Jumlah': applicants.filter(a => a.status === 'approved').length },
    { 'Keterangan': 'Rejected', 'Jumlah': applicants.filter(a => a.status === 'rejected').length }
  ];
  const statsWorksheet = XLSX.utils.json_to_sheet(statsData);
  statsWorksheet['!cols'] = [{ wch: 20 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, statsWorksheet, 'Statistik');

  const timestamp = new Date().toISOString().slice(0, 10);
  const finalFilename = `${filename}_${timestamp}.xlsx`;

  XLSX.writeFile(workbook, finalFilename);

  // Log quality report
  console.log('📊 Export Quality Report:', {
    totalRecords: qualityReport.totalRecords,
    dataQuality: {
      completeEmail: qualityReport.totalRecords - qualityReport.missingEmail,
      completePhone: qualityReport.totalRecords - qualityReport.missingPhone,
      completeParentPhone: qualityReport.totalRecords - qualityReport.missingParentPhone,
    },
    missingData: {
      email: qualityReport.missingEmail,
      phone: qualityReport.missingPhone,
      parentPhone: qualityReport.missingParentPhone,
    },
    fieldNameUsage: {
      phoneStandard: qualityReport.fieldsFound.phoneStandard,
      phoneLegacy: qualityReport.fieldsFound.phoneLegacy,
      parentPhoneStandard: qualityReport.fieldsFound.parentPhoneStandard,
      parentPhoneLegacy: qualityReport.fieldsFound.parentPhoneLegacy,
    },
  });

  return qualityReport;
};

export const exportAcceptedApplicantsToExcel = (applicants: Applicant[]): ExportQualityReport => {
  const acceptedApplicants = applicants.filter(
    a => a.status === 'approved' || a.status === 'accepted'
  );

  return exportApplicantsToExcel(acceptedApplicants, 'Pendaftar_Diterima');
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '-';

  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatColumnName = (fieldName: string): string => {
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
