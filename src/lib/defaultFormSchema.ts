export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'date' | 'tel' | 'radio' | 'image' | 'separator';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  section?: string;
  imageConfig?: {
    maxSizeMB?: number;
    acceptedFormats?: string[];
    maxWidth?: number;
    maxHeight?: number;
  };
}

export const defaultFormSchema: FormField[] = [
  {
    name: 'nisn',
    label: 'NISN',
    type: 'text',
    required: true,
    placeholder: 'Nomor Induk Siswa Nasional',
    validation: {
      minLength: 10,
      maxLength: 10,
      pattern: '^[0-9]{10}$',
    },
    section: 'Data Diri',
  },
  {
    name: 'nama_lengkap',
    label: 'Nama Lengkap',
    type: 'text',
    required: true,
    placeholder: 'Nama lengkap sesuai akta kelahiran',
    section: 'Data Diri',
  },
  {
    name: 'tempat_lahir',
    label: 'Tempat Lahir',
    type: 'text',
    required: true,
    placeholder: 'Kota/Kabupaten tempat lahir',
    section: 'Data Diri',
  },
  {
    name: 'tanggal_lahir',
    label: 'Tanggal Lahir',
    type: 'date',
    required: true,
    section: 'Data Diri',
  },
  {
    name: 'jenis_kelamin',
    label: 'Jenis Kelamin',
    type: 'radio',
    required: true,
    options: [
      { value: 'L', label: 'Laki-laki' },
      { value: 'P', label: 'Perempuan' },
    ],
    section: 'Data Diri',
  },
  {
    name: 'agama',
    label: 'Agama',
    type: 'select',
    required: true,
    options: [
      { value: '', label: 'Pilih Agama' },
      { value: 'Islam', label: 'Islam' },
      { value: 'Kristen', label: 'Kristen' },
      { value: 'Katolik', label: 'Katolik' },
      { value: 'Hindu', label: 'Hindu' },
      { value: 'Buddha', label: 'Buddha' },
      { value: 'Konghucu', label: 'Konghucu' },
    ],
    section: 'Data Diri',
  },
  {
    name: 'alamat',
    label: 'Alamat Lengkap',
    type: 'textarea',
    required: true,
    placeholder: 'Alamat lengkap tempat tinggal saat ini',
    section: 'Alamat',
  },
  {
    name: 'rt',
    label: 'RT',
    type: 'text',
    required: true,
    placeholder: 'RT',
    validation: {
      maxLength: 3,
    },
    section: 'Alamat',
  },
  {
    name: 'rw',
    label: 'RW',
    type: 'text',
    required: true,
    placeholder: 'RW',
    validation: {
      maxLength: 3,
    },
    section: 'Alamat',
  },
  {
    name: 'kelurahan',
    label: 'Kelurahan/Desa',
    type: 'text',
    required: true,
    section: 'Alamat',
  },
  {
    name: 'kecamatan',
    label: 'Kecamatan',
    type: 'text',
    required: true,
    section: 'Alamat',
  },
  {
    name: 'kota',
    label: 'Kota/Kabupaten',
    type: 'text',
    required: true,
    section: 'Alamat',
  },
  {
    name: 'provinsi',
    label: 'Provinsi',
    type: 'text',
    required: true,
    section: 'Alamat',
  },
  {
    name: 'kode_pos',
    label: 'Kode Pos',
    type: 'text',
    required: true,
    placeholder: '12345',
    validation: {
      pattern: '^[0-9]{5}$',
      minLength: 5,
      maxLength: 5,
    },
    section: 'Alamat',
  },
  {
    name: 'no_telepon',
    label: 'Nomor Telepon',
    type: 'tel',
    required: true,
    placeholder: '08123456789',
    validation: {
      pattern: '^[0-9]{10,13}$',
    },
    section: 'Kontak',
  },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    required: true,
    placeholder: 'email@example.com',
    section: 'Kontak',
  },
  {
    name: 'asal_sekolah',
    label: 'Asal Sekolah (SMP)',
    type: 'text',
    required: true,
    placeholder: 'Nama SMP asal',
    section: 'Data Pendidikan',
  },
  {
    name: 'npsn_asal_sekolah',
    label: 'NPSN Sekolah Asal',
    type: 'text',
    required: true,
    placeholder: 'Nomor Pokok Sekolah Nasional',
    validation: {
      pattern: '^[0-9]{8}$',
      minLength: 8,
      maxLength: 8,
    },
    section: 'Data Pendidikan',
  },
  {
    name: 'tahun_lulus',
    label: 'Tahun Lulus',
    type: 'number',
    required: true,
    placeholder: '2024',
    validation: {
      min: 2020,
      max: 2030,
    },
    section: 'Data Pendidikan',
  },
  {
    name: 'nama_ayah',
    label: 'Nama Ayah',
    type: 'text',
    required: true,
    section: 'Data Orang Tua',
  },
  {
    name: 'pekerjaan_ayah',
    label: 'Pekerjaan Ayah',
    type: 'text',
    required: true,
    section: 'Data Orang Tua',
  },
  {
    name: 'nama_ibu',
    label: 'Nama Ibu',
    type: 'text',
    required: true,
    section: 'Data Orang Tua',
  },
  {
    name: 'pekerjaan_ibu',
    label: 'Pekerjaan Ibu',
    type: 'text',
    required: true,
    section: 'Data Orang Tua',
  },
  {
    name: 'penghasilan_ortu',
    label: 'Penghasilan Orang Tua (Total)',
    type: 'select',
    required: true,
    options: [
      { value: '', label: 'Pilih Range Penghasilan' },
      { value: '< 1000000', label: 'Kurang dari Rp 1.000.000' },
      { value: '1000000-3000000', label: 'Rp 1.000.000 - Rp 3.000.000' },
      { value: '3000000-5000000', label: 'Rp 3.000.000 - Rp 5.000.000' },
      { value: '5000000-10000000', label: 'Rp 5.000.000 - Rp 10.000.000' },
      { value: '> 10000000', label: 'Lebih dari Rp 10.000.000' },
    ],
    section: 'Data Orang Tua',
  },
  {
    name: 'no_telepon_ortu',
    label: 'Nomor Telepon Orang Tua',
    type: 'tel',
    required: true,
    placeholder: '08123456789',
    validation: {
      pattern: '^[0-9]{10,13}$',
    },
    section: 'Data Orang Tua',
  },
];
