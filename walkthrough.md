# Panduan Deployment SPMB-NEW (Local & Production Server)

Panduan ini berisi langkah-langkah lengkap untuk menjalankan dan mendeploy aplikasi pendaftaran siswa (SPMB) yang menggunakan Node.js (Express), React (Vite), PostgreSQL, dan Supabase lokal di mesin Anda maupun di Production Server (Linux Ubuntu/Debian).

---

## üíª 1. Menjalankan di Local Environment (Windows/Mac)

### Prasyarat:
- **Node.js** v18+ 
- **PostgreSQL** versi 14+ atau yang terbaru
- Git

### Langkah Instalasi
1. Clone Repository Anda
\`\`\`bash
git clone https://github.com/username-anda/spmb-new.git
cd spmb-new
\`\`\`

2. Install Dependencies Frontend & Backend
\`\`\`bash
# Di folder utama (Frontend)
npm install

# Di folder backend
cd server
npm install
cd ..
\`\`\`

3. Konfigurasi Database Lokal
- Buka PgAdmin atau command line PostgreSQL, buat database bernama \`spmb\`.
- Buka folder \`server\` di project dan copy \`src/database_schema.sql\` atau file SQL migrasi yang Anda punya, lalu jalankan ke dalam database \`spmb\`.
- Buat file bernama \`.env\` di dalam folder \`server/\` dan isi:
\`\`\`env
DATABASE_URL=postgresql://postgres:admin@127.0.0.1:5432/spmb
JWT_SECRET=rahasia-jangan-disebar-2026
PORT=3001
UPLOAD_DIR=./uploads
\`\`\`
*(Catatan: Sesuaikan \`postgres:admin\` dengan username dan password PostgreSQL Anda).*

4. Jalankan Aplikasi
Buka **dua** terminal secara terpisah:

**Terminal 1 (Backend):**
\`\`\`bash
cd server
node src/index.js
\`\`\`

**Terminal 2 (Frontend):**
\`\`\`bash
npm run dev
\`\`\`
Aplikasi akan bisa diakses dari \`http://localhost:5173\`.

---

## üåê 2. Deployment ke Production Server (Linux / VPS)
*Berikut adalah cara untuk menghosting aplikasi agar bisa diakses public di server Ubuntu.*

### Prasyarat Server (VPS):
- Ubuntu 20.04 / 22.04 LTS
- Sudah punya koneksi SSH ke server
- Domain (misal: pendaftaran.sekolah.com) yang sudah diarahkan (A-Record) ke IP VPS.

### Langkah 1: Install Alat yang Dibutuhkan
Login ke server via SSH:
\`\`\`bash
sudo apt update && sudo apt upgrade -y
# Install Nginx dan PostgreSQL
sudo apt install nginx postgresql postgresql-contrib git curl -y

# Install Node.js v18 (Atau versi 20)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# Install PM2 (Untuk menjaga backend tetap nyala)
sudo npm install -g pm2
\`\`\`

### Langkah 2: Setup Database di Server 
Buat pengguna dan database untuk aplikasi:
\`\`\`bash
sudo -u postgres psql

# Di dalam prompt postgres (tanda =#):
CREATE DATABASE spmb;
CREATE USER admin_spmb WITH ENCRYPTED PASSWORD 'PasswordSuperKuat123';
GRANT ALL PRIVILEGES ON DATABASE spmb TO admin_spmb;
\q
\`\`\`
*(Setelah ini, restore file SQL Skema database yang digunakan ke VPS Anda).*

### Langkah 3: Clone Code Server
Masuk ke `/var/www/` dan pull aplikasi Anda:
\`\`\`bash
cd /var/www
sudo git clone https://github.com/username-anda/spmb-new.git
sudo chown -R $USER:$USER /var/www/spmb-new
cd spmb-new
\`\`\`

### Langkah 4: Setup Backend (Express API)
\`\`\`bash
cd server
npm install

# Buat file .env production
nano .env 
\`\`\`
Isi `server/.env` dengan:
\`\`\`env
DATABASE_URL=postgresql://admin_spmb:PasswordSuperKuat123@127.0.0.1:5432/spmb
JWT_SECRET=rahasia-production-key-xxx
PORT=3001
UPLOAD_DIR=./uploads
\`\`\`

**Jalankan dengan PM2:**
\`\`\`bash
pm2 start src/index.js --name "spmb-backend"
pm2 save
pm2 startup
\`\`\`
Backend Anda sekarang sudah jalan selamanya di port `3001`.

### Langkah 5: Setup Frontend (React/Vite)
Kompilasi Frontend menjadi HTML statis untuk di hosting Nginx:
\`\`\`bash
cd /var/www/spmb-new

# Ubah url backend di env frontend bila perlu
nano .env
# Isi: VITE_API_URL=https://pendaftaran.sekolah.com/api

npm install
npm run build
\`\`\`
Aplikasi siap untuk disajikan dari folder `dist/`.

### Langkah 6: Konfigurasi Nginx & Domain
Buat file konfigurasi Nginx untuk domain Anda:
\`\`\`bash
sudo nano /etc/nginx/sites-available/spmb
\`\`\`

Isi dengan konfigurasi Reverse-Proxy ini:
\`\`\`nginx
server {
    listen 80;
    server_name pendaftaran.sekolah.com; # Ganti Domain Anda

    root /var/www/spmb-new/dist;
    index index.html index.htm;
    client_max_body_size 50M;

    # Frontend Routing (React)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend / API Proxy (Node.js)
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

    # Uploaded Files Proxy
    location /uploads/ {
        alias /var/www/spmb-new/server/uploads/;
        access_log off;
    }
}
\`\`\`

Simpan lalu aktifkan:
\`\`\`bash
sudo ln -s /etc/nginx/sites-available/spmb /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
\`\`\`

### üõ°ÅEÅELangkah Terakhir: Install SSL (HTTPS) Gratis
Agar aman dan API tidak diblokir browser, jalankan certbot:
\`\`\`bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d pendaftaran.sekolah.com
\`\`\`

Selesai! Aplikasi Anda kini sudah online, bisa melayani pendaftaran dari siswa, mengirim notifikasi WhatsApp, dan berjalan dengan aman!



