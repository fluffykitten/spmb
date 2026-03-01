import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import PizZip from 'pizzip';

interface ApplicantData {
  id: string;
  user_id: string;
  status: string;
  dynamic_data: Record<string, any>;
  registration_number?: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name?: string;
  };
}

export interface MappedVariables {
  [key: string]: string;
}

export const mapApplicantDataToVariables = (
  applicant: ApplicantData
): MappedVariables => {
  const dynamicData = applicant.dynamic_data || {};
  const profile = applicant.profiles || {};

  const today = new Date();

  const variables: MappedVariables = {
    nama_lengkap: dynamicData.nama_lengkap || profile.full_name || '',
    nisn: dynamicData.nisn || '',
    nik: dynamicData.nik || '',
    email: profile.email || dynamicData.email || '',
    no_telepon: dynamicData.no_telepon || dynamicData.no_hp || dynamicData.telepon || dynamicData.phone_number || '',
    no_hp: dynamicData.no_telepon || dynamicData.no_hp || dynamicData.telepon || dynamicData.phone_number || '',

    tempat_lahir: dynamicData.tempat_lahir || '',
    tanggal_lahir: formatDate(dynamicData.tanggal_lahir),
    jenis_kelamin: dynamicData.jenis_kelamin || '',
    agama: dynamicData.agama || '',

    alamat: dynamicData.alamat || dynamicData.alamat_lengkap || '',
    rt: dynamicData.rt || '',
    rw: dynamicData.rw || '',
    kelurahan: dynamicData.kelurahan || dynamicData.desa || '',
    kecamatan: dynamicData.kecamatan || '',
    kota: dynamicData.kota || dynamicData.kabupaten || '',
    kabupaten: dynamicData.kabupaten || dynamicData.kota || '',
    provinsi: dynamicData.provinsi || '',
    kode_pos: dynamicData.kode_pos || '',

    alamat_lengkap: buildFullAddress(dynamicData),

    asal_sekolah: dynamicData.asal_sekolah || '',
    npsn_asal_sekolah: dynamicData.npsn_asal_sekolah || '',
    tahun_lulus: dynamicData.tahun_lulus || '',

    nama_ayah: dynamicData.nama_ayah || '',
    pekerjaan_ayah: dynamicData.pekerjaan_ayah || '',
    penghasilan_ayah: dynamicData.penghasilan_ayah || '',

    nama_ibu: dynamicData.nama_ibu || '',
    pekerjaan_ibu: dynamicData.pekerjaan_ibu || '',
    penghasilan_ibu: dynamicData.penghasilan_ibu || '',

    penghasilan_ortu: dynamicData.penghasilan_ortu || '',

    nama_wali: dynamicData.nama_wali || '',
    pekerjaan_wali: dynamicData.pekerjaan_wali || '',
    no_telepon_ortu: dynamicData.no_telepon_ortu || dynamicData.no_hp_ortu || dynamicData.phone_ortu || dynamicData.telepon_ortu || '',
    no_hp_ortu: dynamicData.no_telepon_ortu || dynamicData.no_hp_ortu || dynamicData.phone_ortu || dynamicData.telepon_ortu || '',

    nomor_registrasi: applicant.registration_number || '',
    status_pendaftaran: translateStatus(applicant.status),

    tanggal: formatDate(today),
    tanggal_lengkap: formatDateLong(today),
    hari: formatDay(today),
    bulan: formatMonth(today),
    tahun: today.getFullYear().toString(),
    tahun_ajaran: generateAcademicYear(today),
  };

  Object.keys(dynamicData).forEach(key => {
    if (!variables[key]) {
      const value = dynamicData[key];
      if (typeof value === 'string') {
        variables[key] = value;
      } else if (value !== null && value !== undefined) {
        variables[key] = String(value);
      }
    }
  });

  return variables;
};

const formatDate = (dateValue: any): string => {
  if (!dateValue) return '';

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';

    return format(date, 'dd-MM-yyyy');
  } catch {
    return '';
  }
};

const formatDateLong = (date: Date): string => {
  try {
    return format(date, 'dd MMMM yyyy', { locale: localeId });
  } catch {
    return '';
  }
};

const formatDay = (date: Date): string => {
  try {
    return format(date, 'EEEE', { locale: localeId });
  } catch {
    return '';
  }
};

const formatMonth = (date: Date): string => {
  try {
    return format(date, 'MMMM', { locale: localeId });
  } catch {
    return '';
  }
};

const buildFullAddress = (data: Record<string, any>): string => {
  const parts = [];

  if (data.alamat || data.alamat_lengkap) {
    parts.push(data.alamat || data.alamat_lengkap);
  }

  if (data.rt && data.rw) {
    parts.push(`RT ${data.rt}/RW ${data.rw}`);
  } else if (data.rt) {
    parts.push(`RT ${data.rt}`);
  } else if (data.rw) {
    parts.push(`RW ${data.rw}`);
  }

  if (data.kelurahan || data.desa) {
    parts.push(`Kel. ${data.kelurahan || data.desa}`);
  }

  if (data.kecamatan) {
    parts.push(`Kec. ${data.kecamatan}`);
  }

  if (data.kabupaten || data.kota) {
    parts.push(data.kabupaten || data.kota);
  }

  if (data.provinsi) {
    parts.push(data.provinsi);
  }

  if (data.kode_pos) {
    parts.push(data.kode_pos);
  }

  return parts.join(', ');
};

const translateStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Terkirim',
    approved: 'Diterima',
    rejected: 'Ditolak',
    verified: 'Terverifikasi',
    pending: 'Menunggu'
  };

  return statusMap[status] || status;
};

const generateAcademicYear = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (month >= 6) {
    return `${year}/${year + 1}`;
  } else {
    return `${year - 1}/${year}`;
  }
};

export const detectVariablesInDocx = (content: string): string[] => {
  const variablePattern = /\{([^}]+)\}/g;
  const matches = content.matchAll(variablePattern);
  const variables = new Set<string>();

  for (const match of matches) {
    const varName = match[1].trim();
    if (varName && !varName.includes(' ') && varName.length < 100) {
      variables.add(varName);
    }
  }

  return Array.from(variables).sort();
};

export const extractVariablesFromDocxFile = async (file: File): Promise<string[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = new PizZip(arrayBuffer);

    const documentXml = zip.file('word/document.xml');
    if (!documentXml) {
      throw new Error('Invalid DOCX file: word/document.xml not found');
    }

    const xmlContent = documentXml.asText();

    return detectVariablesInDocx(xmlContent);
  } catch (error) {
    console.error('Error extracting variables from DOCX:', error);
    throw new Error('Failed to parse DOCX file. Please ensure the file is a valid DOCX document.');
  }
};

export const validateRequiredVariables = (
  availableData: MappedVariables,
  requiredVariables: string[]
): { valid: boolean; missingVariables: string[] } => {
  const missingVariables: string[] = [];

  for (const varName of requiredVariables) {
    if (!availableData[varName] || availableData[varName].trim() === '') {
      missingVariables.push(varName);
    }
  }

  return {
    valid: missingVariables.length === 0,
    missingVariables
  };
};

export const formatVariableForDisplay = (varName: string): string => {
  return varName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};
