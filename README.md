# CalorieKnows Backend API 🥗⚡

Backend API untuk **CalorieKnows** yang dibangun menggunakan **Node.js (Express)**, basis data **PostgreSQL Supabase**, kecerdasan buatan **Google Gemini AI (Multimodal Vision)**, dan integrasi ekosistem kesehatan **Google Fit API**, serta dioptimalkan untuk deployment ke **Vercel Serverless**.

---

## 🌟 Daftar Fitur Utama Sesuai Spesifikasi

1. **Autentikasi Google Terintegrasi (Google OAuth via Supabase)**
   - Mendukung otentikasi satu klik berbasis Google OAuth melalui Supabase Auth.
   - Otomatis membuat dan memperbarui rekaman profil pengguna (`profiles`) di PostgreSQL Supabase saat login pertama kali via Database Trigger.
   - Verifikasi token JWT Bearer di setiap route handler dengan Supabase Auth.

2. **Sinkronisasi Data Kesehatan via Google Fit API (Google API Integration)**
   - Mengambil data metrik harian langsung dari Google Fit API:
     - Total langkah harian (`com.google.step_count.delta`)
     - Kalori aktif yang terbakar dari aktivitas fisik (`com.google.calories.expended`)
     - Jarak tempuh harian (`com.google.distance.delta`)
   - Otomatis mencatat (push) kalori dan makronutrisi dari makanan yang dikonsumsi kembali ke data stream Google Fit (`com.google.nutrition`).

3. **Pemindai Foto Makanan Cerdas (Snap & Log)**
   - Menggunakan model **Google Gemini Vision** (`gemini-1.5-flash`) untuk membedah foto hidangan secara otomatis.
   - Mengestimasi berat porsi (gram) per komponen makanan.
   - Menghitung nilai kalori total, protein, karbohidrat, lemak, serat, gula, dan natrium secara terstruktur dalam format JSON.

4. **Kolom Konteks Opsional (Context Hint)**
   - Kolom teks tambahan di samping foto hidangan untuk memberikan detail tak kasat mata kepada AI (contoh: potongan daging dada tanpa kulit, jenis minyak masak, tingkat gula pada minuman pendamping).
   - Gemini Vision memprioritaskan instruksi konteks ini dalam komputasi nutrisi akhir.

5. **Pemindai Label Informasi Nilai Gizi Kemasan (Nutrition Label Scanner)**
   - Memindai tabel nutrisi (*Nutrition Facts* / Informasi Nilai Gizi) pada kemasan makanan ringan atau minuman kaleng.
   - Mengekstrak takaran saji, jumlah sajian per kemasan, energi total, lemak total, lemak jenuh, gula, natrium, dan protein langsung dari foto kemasan.

6. **Rekomendasi Menu Penutup Target Harian (Smart Meal Recommender)**
   - Membandingkan total asupan makanan hari ini di Supabase dengan kalori aktif yang terbakar dari Google Fit API.
   - Menghitung sisa kuota kalori dan defisit makronutrisi harian pengguna.
   - Gemini AI merekomendasikan 3 menu lokal (kuliner Indonesia/sehat) yang presisi untuk menutup kebutuhan nutrisi malam hari.

7. **Konverter Aktivitas Pembakar Kalori (Burn It Off Converter)**
   - Menerjemahkan total kalori dari hidangan yang dicatat menjadi durasi aktivitas fisik riil berbasis standar ilmiah MET (*Metabolic Equivalent of Task*):
     - Jalan Santai (4 km/jam)
     - Jalan Cepat (5.5 km/jam)
     - Jogging (8 km/jam)
     - Lari Cepat (10 km/jam)
     - Bersepeda (16-19 km/jam)
     - Lompat Tali / Skipping
     - Berenang Bebas
   - Mengorelasikan progres pemenuhan pembakaran kalori tersebut secara langsung dengan data langkah dan kalori terbakar hari ini dari Google Fit.

8. **Generator Laporan Mingguan & Ekspor PDF (Weekly Nutrition Report)**
   - Mengagregasi data konsumsi makanan dan aktivitas fisik selama 7 hari terakhir dari Supabase.
   - Evaluasi tren gaya hidup dan pola makan oleh Gemini AI (Skor kesehatan, pencapaian, area perbaikan, dan rencana aksi minggu depan).
   - Menghasilkan dokumen PDF siap unduh secara instan menggunakan `PDFKit` (vector-based, sub-second generation, 100% kompatibel dengan batas memori Vercel Serverless).

---

## 🏗️ Struktur Proyek

```
backendcalorie/
├── api/
│   └── index.js              # Entrypoint Vercel Serverless Functions
├── src/
│   ├── app.js                # Konfigurasi Express, CORS, routing & middleware
│   ├── server.js             # Entrypoint server lokal (Node.js)
│   ├── config/
│   │   ├── env.js            # Validasi variabel lingkungan (Environment variables)
│   │   └── supabase.js       # Client Supabase (Anon, Admin & User-scoped)
│   ├── middleware/
│   │   ├── auth.js           # Supabase Auth JWT verification middleware
│   │   └── errorHandler.js   # Global error & 404 handler
│   ├── services/
│   │   ├── geminiService.js  # Google Gemini Vision, Prompting & JSON extraction
│   │   ├── googleFitService.js # OAuth2 & Google Fitness REST API client
│   │   ├── activityCalculator.js # Rumus komputasi MET Burn It Off
│   │   └── pdfService.js     # Generator PDF Laporan Mingguan (PDFKit)
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── scannerController.js
│   │   ├── googleFitController.js
│   │   ├── recommendationController.js
│   │   ├── converterController.js
│   │   ├── reportController.js
│   │   └── dashboardController.js
│   └── routes/
│       ├── authRoutes.js
│       ├── scannerRoutes.js
│       ├── googleFitRoutes.js
│       ├── recommendationRoutes.js
│       ├── converterRoutes.js
│       ├── reportRoutes.js
│       └── dashboardRoutes.js
├── supabase/
│   └── schema.sql            # Script DDL PostgreSQL Supabase (Tables, RLS, Triggers)
├── test/
│   ├── unitTest.js           # Unit test Burn It Off & PDF generator
│   └── apiTest.js            # Test integrasi endpoint Express
├── .env.example              # Template variabel lingkungan
├── package.json
└── vercel.json               # Konfigurasi deploy Vercel
```

---

## 🚀 Panduan Instalasi & Menjalankan Lokal

### 1. Prasyarat
- Node.js versi 18.0.0 atau lebih baru
- Akun Supabase (PostgreSQL)
- Google Cloud Console Project (Fitness API diaktifkan)
- Gemini API Key dari [Google AI Studio](https://aistudio.google.com/)

### 2. Salin Repositori & Instal Dependensi
```bash
cd backendcalorie
npm install
```

### 3. Konfigurasi Variabel Lingkungan
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Lalu lengkapi nilai variabel berikut:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Supabase
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Gemini AI
GEMINI_API_KEY=<your-gemini-api-key>

# Google Cloud OAuth (Google Fit API)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

### 4. Eksekusi Skema Basis Data di Supabase
1. Buka dashboard Supabase Anda.
2. Masuk ke menu **SQL Editor**.
3. Buka file `supabase/schema.sql` di proyek ini, salin seluruh isinya, lalu klik tombol **Run**.
4. Semua tabel (`profiles`, `user_google_tokens`, `meal_logs`, `meal_items`, `activity_logs`, `weekly_reports`), Row Level Security (RLS) policies, dan Trigger `on_auth_user_created` akan dibuat secara otomatis.

### 5. Jalankan Server Lokal
```bash
# Mode development (auto-reload dengan nodemon):
npm run dev

# Atau mode production:
npm start
```
Aplikasi akan berjalan di `http://localhost:5000`. Cek status kesehatan di `http://localhost:5000/api/health`.

---

## 🌐 Panduan Deployment ke Vercel

Proyek ini telah dikonfigurasi menggunakan file `vercel.json` dan `api/index.js` agar langsung kompatibel dengan Vercel Serverless Functions.

### Opsi 1: Menggunakan Vercel CLI
1. Instal Vercel CLI jika belum terpasang:
   ```bash
   npm i -g vercel
   ```
2. Jalankan perintah deploy dari folder `backendcalorie`:
   ```bash
   vercel
   ```
3. Tambahkan environment variables di Vercel Dashboard (atau via CLI `vercel env add`):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `CLIENT_URL` (URL frontend Next.js Anda di Vercel)
4. Deploy ke production:
   ```bash
   vercel --prod
   ```

### Opsi 2: Menggunakan GitHub Repository
1. Push folder `backendcalorie` ke repositori GitHub Anda.
2. Buka dashboard [Vercel](https://vercel.com) > **Add New Project** > **Import Git Repository**.
3. Di bagian **Root Directory**, pilih folder `backendcalorie` (jika monorepo) atau root.
4. Masukkan **Environment Variables** yang ada di file `.env`.
5. Klik **Deploy**.

---

## 📡 Dokumentasi Endpoint API

Semua endpoint dilindungi oleh header autentikasi Supabase JWT Bearer:
```http
Authorization: Bearer <supabase_access_token>
```

### 1. Autentikasi & Profil
| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/auth/profile` | Mengambil profil pengguna & status integrasi Google Fit |
| `PUT` | `/api/auth/profile` | Memperbarui profil, target kalori, dan target makronutrisi |
| `POST` | `/api/auth/google-token` | Menyimpan Google OAuth token untuk akses Google Fit |
| `GET` | `/api/auth/google-status` | Memeriksa status konektivitas Google Fit |

### 2. Pemindai Makanan (Gemini Vision)
| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/api/scanner/food` | **Snap & Log**: Memindai foto hidangan (multipart field `image` atau JSON `image_base64`) + kolom opsional `context_hint` |
| `POST` | `/api/scanner/label` | **Nutrition Label Scanner**: Memindai tabel Informasi Nilai Gizi pada kemasan produk |
| `POST` | `/api/scanner/log-meal` | Menyimpan hidangan ke basis data Supabase & otomatis sync ke Google Fit |
| `GET` | `/api/scanner/meals` | Mengambil riwayat makanan (`?date=YYYY-MM-DD`) |
| `DELETE` | `/api/scanner/meals/:id` | Menghapus log makanan |

### 3. Google Fit Sync
| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/google-fit/daily-summary` | Mengambil live langkah, kalori terbakar aktif, dan jarak tempuh hari ini |
| `POST` | `/api/google-fit/sync-meal` | Sinkronisasi ulang rekaman makanan tertentu ke dataset nutrisi Google Fit |

### 4. Rekomendasi Menu (Smart Meal Recommender)
| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/recommendations/daily-closing` | Rekomendasi 3 hidangan lokal bergizi untuk menutup sisa target kalori harian (`?meal_type=dinner&preference=halal`) |

### 5. Konverter Aktivitas (Burn It Off)
| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/api/converter/burn-it-off` | Menghitung durasi aktivitas fisik (jalan, lari, sepeda, skipping) setara kalori makanan & progres di Google Fit |

### 6. Laporan Mingguan & Ekspor PDF
| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/reports/weekly` | Data agregasi 7 hari konsumsi & aktivitas serta ulasan Gemini AI (JSON) |
| `GET` | `/api/reports/weekly/pdf` | **Download PDF Laporan Mingguan** resmi yang rapi dan profesional |

### 7. Dasbor Real-Time
| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/dashboard/summary` | Data ringkasan lengkap untuk progress rings (kalori masuk, kalori terbakar Google Fit, sisa kuota, langkah, makronutrisi) |

---

## 🔒 Setup Google Fit OAuth di Google Cloud Console

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat proyek baru atau pilih proyek yang ada.
3. Masuk ke **APIs & Services** > **Library**, cari **Fitness API**, lalu klik **Enable**.
4. Masuk ke **OAuth Consent Screen**:
   - Pilih User Type: External.
   - Masukkan Scopes yang dibutuhkan:
     - `https://www.googleapis.com/auth/fitness.activity.read`
     - `https://www.googleapis.com/auth/fitness.activity.write`
     - `https://www.googleapis.com/auth/fitness.body.read`
     - `https://www.googleapis.com/auth/fitness.nutrition.read`
     - `https://www.googleapis.com/auth/fitness.nutrition.write`
5. Masuk ke **Credentials** > **Create Credentials** > **OAuth client ID**:
   - Application Type: Web application.
   - Authorized redirect URIs: masukkan domain frontend dan backend callback.
6. Salin `Client ID` dan `Client Secret` ke file `.env`.
