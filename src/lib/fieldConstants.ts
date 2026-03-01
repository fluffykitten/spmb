/**
 * Field Name Constants
 *
 * This file defines the standard field names used throughout the application.
 * These names match the field names defined in defaultFormSchema.ts and should
 * be used consistently across all modules.
 *
 * IMPORTANT: When accessing dynamic_data fields, always use these constants
 * as the primary field name, with fallbacks to legacy field names for
 * backward compatibility with existing data.
 */

export const FIELD_NAMES = {
  // Personal Information
  NISN: 'nisn',
  NIK: 'nik',
  NAMA_LENGKAP: 'nama_lengkap',
  TEMPAT_LAHIR: 'tempat_lahir',
  TANGGAL_LAHIR: 'tanggal_lahir',
  JENIS_KELAMIN: 'jenis_kelamin',
  AGAMA: 'agama',

  // Contact Information
  NO_TELEPON: 'no_telepon',        // Standard field name for student phone
  EMAIL: 'email',                   // Standard field name for student email

  // Address Information
  ALAMAT: 'alamat',
  RT: 'rt',
  RW: 'rw',
  KELURAHAN: 'kelurahan',
  KECAMATAN: 'kecamatan',
  KOTA: 'kota',                     // Standard field name for city/district
  PROVINSI: 'provinsi',
  KODE_POS: 'kode_pos',

  // Education Information
  ASAL_SEKOLAH: 'asal_sekolah',
  NPSN_ASAL_SEKOLAH: 'npsn_asal_sekolah',
  TAHUN_LULUS: 'tahun_lulus',

  // Parent Information
  NAMA_AYAH: 'nama_ayah',
  PEKERJAAN_AYAH: 'pekerjaan_ayah',
  NAMA_IBU: 'nama_ibu',
  PEKERJAAN_IBU: 'pekerjaan_ibu',
  PENGHASILAN_ORTU: 'penghasilan_ortu',
  NO_TELEPON_ORTU: 'no_telepon_ortu', // Standard field name for parent phone
} as const;

/**
 * Legacy field name mappings for backward compatibility
 * Maps legacy field names to their standard equivalents
 */
export const LEGACY_FIELD_MAPPINGS = {
  // Phone number variations
  phone_number: FIELD_NAMES.NO_TELEPON,
  telepon: FIELD_NAMES.NO_TELEPON,
  no_hp: FIELD_NAMES.NO_TELEPON,
  hp: FIELD_NAMES.NO_TELEPON,

  // Parent phone variations
  no_hp_ortu: FIELD_NAMES.NO_TELEPON_ORTU,
  phone_ortu: FIELD_NAMES.NO_TELEPON_ORTU,
  telepon_ortu: FIELD_NAMES.NO_TELEPON_ORTU,

  // City variations
  kabupaten: FIELD_NAMES.KOTA,
} as const;

/**
 * Get field value with fallback to legacy field names
 * @param data - The dynamic_data object
 * @param fieldName - The standard field name
 * @returns The field value or undefined
 */
export function getFieldValue(data: Record<string, any> | null | undefined, fieldName: string): any {
  if (!data) return undefined;

  // Try standard field name first
  if (data[fieldName] !== undefined && data[fieldName] !== null && data[fieldName] !== '') {
    return data[fieldName];
  }

  // Try legacy field names
  const legacyNames = Object.entries(LEGACY_FIELD_MAPPINGS)
    .filter(([_, standard]) => standard === fieldName)
    .map(([legacy]) => legacy);

  for (const legacyName of legacyNames) {
    if (data[legacyName] !== undefined && data[legacyName] !== null && data[legacyName] !== '') {
      return data[legacyName];
    }
  }

  return undefined;
}

/**
 * Get all possible field names (standard + legacy) for a given field
 * @param fieldName - The standard field name
 * @returns Array of all possible field names
 */
export function getAllFieldNameVariations(fieldName: string): string[] {
  const variations = [fieldName];

  // Add legacy variations
  Object.entries(LEGACY_FIELD_MAPPINGS).forEach(([legacy, standard]) => {
    if (standard === fieldName) {
      variations.push(legacy);
    }
  });

  return variations;
}
