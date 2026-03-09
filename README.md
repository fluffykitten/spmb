# SPMB - Sistem Penerimaan Murid Baru

Aplikasi web modern untuk manajemen penerimaan siswa baru (PPDB/SPMB) dengan fitur lengkap mulai dari pendaftaran online, ujian seleksi, wawancara, hingga notifikasi WhatsApp otomatis.

**Tech Stack:** React + TypeScript (Vite) · Node.js + Express · PostgreSQL

---

## ✨ Fitur Utama

### 👨‍🎓 Portal Siswa
- **Pendaftaran Online** — Formulir dinamis yang dapat dikustomisasi oleh admin
- **Dashboard Siswa** — Status pendaftaran real-time, langkah-langkah pendaftaran, dan informasi penting
- **Ujian Online** — Portal ujian dengan token akses, timer otomatis, dan auto-submit
- **Penjadwalan Interview** — Siswa dapat mengajukan jadwal wawancara (offline/online)
- **Generate Dokumen** — Unduh dokumen pendaftaran dalam format DOCX
- **Surat Keputusan** — Akses surat penerimaan/penolakan

### 🛠️ Panel Admin
- **Dashboard Admin** — Statistik pendaftaran dan overview
- **Manajemen Siswa** — Kelola data pendaftar, ubah status, tambah komentar
- **Manajemen Interview** — Kelola jadwal dan status wawancara
- **Form Builder** — Buat dan edit formulir pendaftaran secara dinamis
- **Exam Builder** — Buat soal ujian (pilihan ganda, essay) dengan pengaturan skor
- **Token Ujian** — Generate dan kelola token akses ujian
- **Manajemen Institusi** — Kelola Tahun Ajaran Aktif
- **Manajemen Batch** — Kelola gelombang pendaftaran
- **Manajemen Pengguna** — Kelola akun admin dan siswa
- **Template Dokumen** — Upload dan kelola template DOCX
- **Template Surat** — Kelola template surat keputusan
- **Analitik** — Grafik dan statistik pendaftaran
- **Konfigurasi** — Pengaturan umum aplikasi
- **Backup Database** — Fitur backup data

### 📱 Notifikasi WhatsApp (Fonnte API)
- **Notifikasi Individual** — Kirim notifikasi otomatis ke siswa:
  - Pendaftaran berhasil
  - Perubahan status (disetujui, ditolak, perlu revisi)
  - Jadwal interview
  - Hasil ujian
  - Dokumen tersedia
- **Notifikasi Grup** — Broadcast otomatis ke grup WhatsApp:
  - Pendaftaran baru masuk
  - Status siswa berubah (disetujui/ditolak/revisi)
  - Interview dijadwalkan
- **Template Kustomisasi** — Edit semua template pesan dari panel admin
- **Riwayat & Analitik** — Log pengiriman pesan dan statistik keberhasilan

---

## 🚀 Deployment

### Prasyarat
- **Node.js** v18+
- **PostgreSQL** v14+
- **Git**

---

### 💻 Deploy Lokal (Windows/Mac)

1. **Clone repository**
```bash
git clone https://github.com/salmanm-bibs/spmb-new.git
cd spmb-new
```

2. **Install dependencies**
```bash
# Frontend
npm install

# Backend
cd server
npm install
cd ..
```

3. **Setup database**
- Buat database PostgreSQL bernama `spmb`
- Import file SQL skema database ke database `spmb`

4. **Konfigurasi environment**

Buat file `server/.env`:
```env
DATABASE_URL=postgresql://postgres:password_anda@127.0.0.1:5432/spmb
JWT_SECRET=rahasia-jwt-anda
PORT=3001
UPLOAD_DIR=./uploads
```

Buat file `.env` (root):
```env
VITE_API_URL=http://localhost:3001
```

5. **Jalankan aplikasi** (menggunakan satu terminal saja thanks to `concurrently`)

```bash
# Buka terminal di folder utama project (spmb-new)
npm run dev
```

Akses di `http://localhost:5173`

---

### 🌐 Deploy ke Server Linux (VPS/Ubuntu)

#### 1. Install dependensi server
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install nginx postgresql postgresql-contrib git curl -y

# Install Node.js v18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# Install PM2
sudo npm install -g pm2
```

#### 2. Setup database
```bash
sudo -u postgres psql
CREATE DATABASE spmb;
CREATE USER admin_spmb WITH ENCRYPTED PASSWORD 'PasswordKuat123';
GRANT ALL PRIVILEGES ON DATABASE spmb TO admin_spmb;
\q
```
Import SQL skema ke database.

#### 3. Clone dan setup
```bash
cd /var/www
sudo git clone https://github.com/salmanm-bibs/spmb-new.git
sudo chown -R $USER:$USER /var/www/spmb-new
cd spmb-new
```

#### 4. Setup backend
```bash
cd server
npm install
nano .env
```
```env
DATABASE_URL=postgresql://admin_spmb:PasswordKuat123@127.0.0.1:5432/spmb
JWT_SECRET=rahasia-production-key
PORT=3001
UPLOAD_DIR=./uploads
```
```bash
pm2 start src/index.js --name "spmb-backend"
pm2 save && pm2 startup
```

#### 5. Build frontend
```bash
cd /var/www/spmb-new
nano .env
# Isi: VITE_API_URL=https://domain-anda.com/api
npm install
npm run build
```

#### 6. Konfigurasi Nginx
```bash
sudo nano /etc/nginx/sites-available/spmb
```
```nginx
server {
    listen 80;
    server_name domain-anda.com;

    root /var/www/spmb-new/dist;
    index index.html;
    client_max_body_size 50M;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /uploads/ {
        alias /var/www/spmb-new/server/uploads/;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/spmb /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

#### 7. SSL (HTTPS)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d domain-anda.com
```

---

## 📝 Lisensi

MIT License
