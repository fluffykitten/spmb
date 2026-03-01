export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateIndonesianPhone = (phone: string): ValidationResult => {
  if (!phone) {
    return { isValid: false, error: 'Nomor telepon wajib diisi' };
  }

  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  const patterns = [
    /^08\d{8,11}$/,
    /^628\d{8,11}$/,
    /^\+628\d{8,11}$/,
    /^02\d{7,10}$/,
  ];

  const isValid = patterns.some(pattern => pattern.test(cleaned));

  if (!isValid) {
    return {
      isValid: false,
      error: 'Format nomor telepon tidak valid. Gunakan format: 08xx, 628xx, atau +628xx'
    };
  }

  return { isValid: true };
};

export const validateNISN = (nisn: string): ValidationResult => {
  if (!nisn) {
    return { isValid: false, error: 'NISN wajib diisi' };
  }

  const cleaned = nisn.replace(/\s/g, '');

  if (!/^\d{10}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'NISN harus 10 digit angka'
    };
  }

  return { isValid: true };
};

export const validateNIK = (nik: string): ValidationResult => {
  if (!nik) {
    return { isValid: false, error: 'NIK wajib diisi' };
  }

  const cleaned = nik.replace(/\s/g, '');

  if (!/^\d{16}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'NIK harus 16 digit angka'
    };
  }

  return { isValid: true };
};

export const validatePostalCode = (postalCode: string): ValidationResult => {
  if (!postalCode) {
    return { isValid: false, error: 'Kode pos wajib diisi' };
  }

  const cleaned = postalCode.replace(/\s/g, '');

  if (!/^\d{5}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Kode pos harus 5 digit angka'
    };
  }

  return { isValid: true };
};

export const validateAge = (dateOfBirth: string, minAge: number = 15, maxAge: number = 20): ValidationResult => {
  if (!dateOfBirth) {
    return { isValid: false, error: 'Tanggal lahir wajib diisi' };
  }

  const dob = new Date(dateOfBirth);
  const today = new Date();

  if (isNaN(dob.getTime())) {
    return { isValid: false, error: 'Format tanggal tidak valid' };
  }

  if (dob > today) {
    return { isValid: false, error: 'Tanggal lahir tidak boleh di masa depan' };
  }

  const age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  const dayDiff = today.getDate() - dob.getDate();

  let actualAge = age;
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    actualAge--;
  }

  if (actualAge < minAge || actualAge > maxAge) {
    return {
      isValid: false,
      error: `Usia harus antara ${minAge} dan ${maxAge} tahun`
    };
  }

  return { isValid: true };
};

export const validateEmail = (email: string): ValidationResult => {
  if (!email) {
    return { isValid: false, error: 'Email wajib diisi' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: 'Format email tidak valid'
    };
  }

  return { isValid: true };
};

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('08')) {
    return `+62${cleaned.substring(1)}`;
  } else if (cleaned.startsWith('628')) {
    return `+${cleaned}`;
  } else if (cleaned.startsWith('+628')) {
    return cleaned;
  }

  return phone;
};

export const formatNISN = (nisn: string): string => {
  const cleaned = nisn.replace(/\s/g, '');
  return cleaned;
};

export const formatNIK = (nik: string): string => {
  const cleaned = nik.replace(/\s/g, '');
  return cleaned;
};

export const validatePasswordStrength = (password: string): {
  score: number;
  feedback: string[];
  isStrong: boolean;
} => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 8) {
    feedback.push('Minimal 8 karakter');
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('Harus ada huruf kecil');
  } else {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('Harus ada huruf besar');
  } else {
    score += 1;
  }

  if (!/[0-9]/.test(password)) {
    feedback.push('Harus ada angka');
  } else {
    score += 1;
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('Harus ada karakter khusus (!@#$%^&*)');
  } else {
    score += 1;
  }

  return {
    score,
    feedback,
    isStrong: score >= 4
  };
};
