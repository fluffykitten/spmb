# Panduan Menjalankan Aplikasi SPMB (Sistem Penerimaan Murid Baru)

Selamat datang! Panduan ini dibuat khusus untuk pemula agar Anda bisa menjalankan aplikasi ini di komputer/laptop Anda sendiri (Windows atau Mac) tanpa perlu keahlian teknis tingkat lanjut. 

Ikuti panduan ini langkah demi langkah dengan perlahan.

---

## Tahap 1: Persiapan Aplikasi yang Dibutuhkan Terlebih Dahulu

Sebelum kita mulai, pastikan komputer Anda sudah memiliki 3 aplikasi wajib ini. Jika belum ada, silakan download dan instal dulu:

1. **Node.js (Versi 18 atau lebih baru)**
   * **Fungsi:** Aplikasi ini butuh Node.js untuk bisa berjalan.
   * **Cara Instal:** Buka website [nodejs.org](https://nodejs.org/), download versi "LTS" (Recommended for Most Users), lalu *next-next* saja sampai selesai seperti menginstal aplikasi biasa.
2. **PostgreSQL (Versi 14 atau lebih baru)**
   * **Fungsi:** Ini adalah aplikasi "database" untuk menyimpan semua data (akun pendaftar, nilai ujian, pengaturan, dll).
   * **Cara Instal:** Buka website [postgresql.org/download](https://www.postgresql.org/download/), pilih sistem operasi Anda (Windows/Mac).
   * **笞・・SANGAT PENTING SAAT INSTALASI PostgreSQL:** Nanti Anda akan diminta membuat password untuk user bernama `postgres`. **Ingat baik-baik password ini!** Jangan sampai lupa, misalnya buat password `admin` atau `rahasia123` yang mudah Anda ingat.
3. **Git**
   * **Fungsi:** Untuk mengambil kode (meng-clone) aplikasi ini dari internet ke komputer Anda.
   * **Cara Instal:** Buka [git-scm.com/downloads](https://git-scm.com/downloads) dan instal.

---

## Tahap 2: Mengambil Kode Aplikasi (Clone)

Sekarang kita akan mengambil aplikasinya.

1. Buka aplikasi **Terminal** (di Mac) atau **Command Prompt / PowerShell** (di Windows).
2. Ketik perintah ini persis seperti di bawah, lalu tekan Enter:
   ```bash
   git clone https://github.com/fluffykitten/spmb.git spmb-new
   ```
   *(Ini akan mendownload folder aplikasi bernama "spmb-new" ke komputer Anda)*
3. Masuk ke dalam folder aplikasi tersebut dengan perintah:
   ```bash
   cd spmb-new
   ```

---

## Tahap 3: Mengunduh Isi/Komponen Aplikasi (Install Dependencies)

Aplikasi ini ibarat rumah yang butuh banyak perabotan. Kita harus mendownload "perabotan" tersebut.

1. Pastikan Anda masih berada di dalam folder `spmb-new` di Terminal.
2. Ketik perintah ini dan tekan Enter:
   ```bash
   npm install
   ```
   *(Biarkan proses berjalan sampai selesai, biasanya memakan waktu beberapa menit. Akan ada banyak tampilan loading, itu normal).*
3. Setelah selesai, sekarang kita masuk ke ruang mesin (folder aplikasi backend/server) dengan mengetik:
   ```bash
   cd server
   ```
4. Di dalam folder `server` ini, ketik lagi perintah yang sama untuk mendownload sisa "perabotan" mesin:
   ```bash
   npm install
   ```
   *(Biarkan proses selesai lagi).*

---

## Tahap 4: Menyiapkan Kamar Kosong untuk Database Anda

Aplikasi butuh **wadah database kosong** di PostgreSQL Anda sebelum dia bisa mulai menyimpan data siswa/pendaftar.

1. Buka aplikasi **pgAdmin 4** (Biasanya akan otomatis terinstal saat Anda menginstal PostgreSQL).
2. Aplikasi pgAdmin akan meminta password. Masukkan password PostgreSQL Anda yang tadi Anda ingat-ingat.
3. Di menu sebelah kiri, cari menu **Databases**.
4. Klik Kanan pada tulisan **Databases**, lalu pilih **Create -> Database...**
5. Di kolom *Database*, ketik persis seperti ini: `spmb` (tulisan huruf kecil semua).
6. Simpan (Save). 
*Tutup pgAdmin, persiapan wadah penyimpan data sudah selesai! Jangan diisi apa-apa dulu, biarkan aplikasi yang akan mengisinya secara otomatis.*

---

## Tahap 5: Menyambungkan Aplikasi dengan Database (Konfigurasi .env)

Aplikasi harus tahu **apa** password database Anda (yang dibuat di Tahap 1) dan **di mana** database Anda agar mereka bisa terhubung.

1. Buka folder `spmb-new` yang sudah Anda download, lalu buka file `server/.env`.
2. Jika file `.env` belum ada, buat sebuah file baru bernama **persis** `.env` (Ingat, ada titik di depannya. Tidak bernama ".env.txt").
3. Isi file `.env` tersebut dengan teks ini:
   ```env
   DATABASE_URL=postgresql://postgres:MASUKKAN_PASSWORD_ANDA_DISINI@127.0.0.1:5432/spmb
   JWT_SECRET=rahasia-jangan-disebar-2026
   PORT=3001
   UPLOAD_DIR=./uploads
   ```
   **笞・・PENTING!** Coba perhatikan tulisan `MASUKKAN_PASSWORD_ANDA_DISINI`. Hapus tulisan tersebut, lalu **ganti dengan password PostgreSQL Anda yang asli (dari Tahap 1)**.
   *(Contoh: Jika password Anda adalah "admin", maka pastikan URL-nya menjadi `postgresql://postgres:admin@127...`)*
   Simpan file tersebut!
4. Berikutnya, kembali ke folder utama `spmb-new` (mundur satu folder dari `server`). 
5. Di sana, buka (atau buat jika belum ada) file `.env` satu lagi. Isi file `.env` ini cukup satu baris saja:
   ```env
   VITE_API_URL=http://localhost:3001
   ```
   Simpan!

---

## Tahap 6: Membuat Tabel Pengguna Otomatis (Init Database)

Kita sudah punya database `spmb` yang *kosong*, sekarang aplikasi akan otomatis membangun semua laci/tabel untuknya.

1. Di aplikasi Terminal / Command Prompt Anda, masuk ke dalam folder `server` dengan perintah:
   ```bash
   cd server
   ```
2. Jalankan perintah ajaib ini:
   ```bash
   npm run init-db
   ```
3. Jika berhasil, akan ada pesan *Database schema created successfully* di layar Anda.

---

## Tahap Terakhir: Menyalakan Aplikasinya! 脂

Sekarang semua sudah siap dan Anda tinggal menikmati hasilnya.

1. Di aplikasi Terminal / Command Prompt Anda, kembali ke **folder utama** project (`spmb-new`). Coba ketik `cd ..` untuk mundur dari folder server.
2. Ketika Anda yakin sudah di folder `spmb-new`, jalankan satu perintah terakhir ini:
   ```bash
   npm run dev
   ```
3. Selesai! Aplikasi perlahan-lahan menyala...
4. Buka Browser Anda (Google Chrome / Mozilla Firefox / Safari).
5. Ketik alamat ini di tab baru:
   **`http://localhost:5173`**

Selamat! Halaman pendaftaran dan Admin aplikasi Anda sudah terbuka dan siap digunakan secara lokal! Jika nanti Anda sudah selesai dan ingin mematikan aplikasinya, cukup tekan tombol `Ctrl + C` di jendela Terminal tadi.

