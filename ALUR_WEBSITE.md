# 🗺️ Alur Kerja Sistem & Desain Alur Website CalorieKnows

Dokumen ini menjelaskan alur kerja sistem menyeluruh (*end-to-end user workflow*), arsitektur komunikasi data antara Frontend, Backend, Supabase, Google Gemini AI, dan Google Fit API, serta panduan implementasi halaman antarmuka pengguna (UI/UX).

---

## 1. Diagram Alur Sistem (End-to-End Workflow)

```mermaid
flowchart TD
    Start([Pengguna Buka Website]) --> Auth{Sudah Login?}
    
    %% Alur Autentikasi
    Auth -- Belum --> Login[Halaman Login: Klik 'Sign in with Google']
    Login --> SupabaseAuth[Supabase Auth Exchange Token]
    SupabaseAuth --> SaveTokens[Simpan Google OAuth Token ke Backend]
    SaveTokens --> Dashboard
    Auth -- Sudah --> Dashboard[Halaman Dasbor Utama]

    %% Alur Dasbor
    Dashboard --> FetchDash[GET /api/dashboard/summary]
    FetchDash --> GoogleFitSync[Ambil Langkah & Kalori Terbakar dari Google Fit API]
    GoogleFitSync --> RenderRings[Tampilkan Cincin Progres Real-Time]

    %% Alur Pemindai Foto Makanan
    Dashboard --> Action{Pilih Aksi Pengguna}
    Action -- Snap & Log --> Camera[Buka Kamera / Unggah Foto Makanan]
    Camera --> ContextInput[Isi Catatan Konteks Opsional 'Context Hint']
    ContextInput --> SendFoodScan[POST /api/scanner/food]
    SendFoodScan --> GeminiVision[Google Gemini Vision Menganalisis Porsi & Makro]
    GeminiVision --> ModalPreview[Tampilkan Preview Hasil Analisis Nutrisi]
    ModalPreview --> ConfirmMeal[Klik 'Simpan ke Buku Harian']
    ConfirmMeal --> LogMeal[POST /api/scanner/log-meal]
    LogMeal --> PushFit[Otomatis Sync Nutrisi ke Google Fit com.google.nutrition]
    PushFit --> OpenBurnItOff[Buka Widget 'Burn It Off Converter']

    %% Alur Pemindai Label
    Action -- Pindai Label --> LabelCam[Foto Tabel Nilai Gizi Kemasan]
    LabelCam --> SendLabelScan[POST /api/scanner/label]
    SendLabelScan --> GeminiLabel[Gemini Ekstrak Takaran Saji, Gula, Natrium]
    GeminiLabel --> ShowLabelResult[Tampilkan Rincian Kemasan]

    %% Alur Rekomendasi Menu
    Action -- Rekomendasi Malam --> ReqClosing[GET /api/recommendations/daily-closing]
    ReqClosing --> CalcGap[Hitung Sisa Kuota Kalori & Makro Hari Ini]
    CalcGap --> GeminiRecom[Gemini Merekomendasikan 3 Menu Lokal Indonesia]
    GeminiRecom --> ShowMenus[Tampilkan Pilihan Makan Malam Sehat]

    %% Alur Laporan Mingguan
    Action -- Laporan Mingguan --> ViewReport[GET /api/reports/weekly]
    ViewReport --> GeminiWeekly[Gemini Evaluasi Tren 7 Hari & Beri Skor]
    GeminiWeekly --> ClickPDF[Klik 'Unduh PDF']
    ClickPDF --> DownloadPDF[GET /api/reports/weekly/pdf Stream PDF Resmi]
```

---

## 2. Diagram Interaksi Komunikasi (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna (Browser / Ponsel)
    participant Client as Frontend (Next.js)
    participant Backend as Backend API (Express / Vercel)
    participant Supabase as Supabase (PostgreSQL & Auth)
    participant GFit as Google Fit REST API
    participant Gemini as Google Gemini AI (Vision)

    %% 1. Login
    Note over User,Supabase: 1. AUTENTIKASI & SINKRONISASI GOOGLE
    User->>Client: Klik "Sign in with Google"
    Client->>Supabase: signInWithOAuth({ provider: 'google', scopes: 'fitness...' })
    Supabase-->>Client: Return Session JWT & Google provider_token
    Client->>Backend: POST /api/auth/google-token (Bearer JWT + access_token)
    Backend->>Supabase: Simpan token ke tabel user_google_tokens

    %% 2. Dasbor
    Note over User,Backend: 2. REAL-TIME PROGRESS DASHBOARD
    Client->>Backend: GET /api/dashboard/summary (Bearer JWT)
    Backend->>Supabase: Ambil target profil & konsumsi makanan hari ini
    Backend->>GFit: Query dataset langkah & kalori aktif terbakar hari ini
    GFit-->>Backend: Return steps & calories_burned
    Backend-->>Client: JSON ringkasan cincin progres (intake vs burned vs target)

    %% 3. Snap & Log
    Note over User,Gemini: 3. SNAP & LOG (FOOD PHOTO SCANNER)
    User->>Client: Foto piring hidangan + tulis Context Hint (opsional)
    Client->>Backend: POST /api/scanner/food (Multipart Image + context_hint)
    Backend->>Gemini: Kirim foto hidangan & prompt klinis
    Gemini-->>Backend: JSON breakdown porsi (gram), kalori, protein, karbo, lemak
    Backend-->>Client: Tampilkan hasil kalkulasi nutrisi ke user

    %% 4. Simpan Makanan & Sync Google Fit
    User->>Client: Konfirmasi simpan hidangan
    Client->>Backend: POST /api/scanner/log-meal
    Backend->>Supabase: Simpan ke meal_logs & meal_items
    Backend->>GFit: Patch dataset com.google.nutrition (two-way sync)
    Backend-->>Client: Sukses tersimpan & terhubung ke Google Fit

    %% 5. Burn It Off
    Client->>Backend: POST /api/converter/burn-it-off (calories)
    Backend-->>Client: Durasi jalan, lari, sepeda + progres pemenuhan di Google Fit

    %% 6. Unduh Laporan Mingguan
    User->>Client: Klik "Unduh Laporan Mingguan"
    Client->>Backend: GET /api/reports/weekly/pdf
    Backend->>Supabase: Agregasi data 7 hari konsumsi & aktivitas
    Backend->>Gemini: Generate evaluasi klinis & rekomendasi aksi
    Backend-->>Client: Stream binary PDF document (Download langsung)
```

---

## 3. Rincian Halaman & Alur Pengguna (*Screen-by-Screen User Journey*)

### Halaman 1: Login & Registrasi (Google OAuth)
- **Tampilan**:
  - Logo CalorieKnows modern dengan *glassmorphism aesthetic*.
  - Tombol utama: **"Sign in with Google"**.
  - Deskripsi singkat integrasi Google Fit dan Gemini AI.
- **Alur Teknis**:
  1. Frontend memicu login OAuth via Supabase client:
     ```javascript
     const { data, error } = await supabase.auth.signInWithOAuth({
       provider: 'google',
       options: {
         scopes: 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.activity.write https://www.googleapis.com/auth/fitness.nutrition.read https://www.googleapis.com/auth/fitness.nutrition.write',
         redirectTo: window.location.origin + '/dashboard'
       }
     });
     ```
  2. Saat kembali dari Google, ambil `provider_token` dari sesi Supabase dan kirim ke backend:
     ```http
     POST /api/auth/google-token
     Authorization: Bearer <supabase_access_token>
     Body: { "access_token": session.provider_token, "refresh_token": session.provider_refresh_token }
     ```

---

### Halaman 2: Dasbor Utama (Main Dashboard)
- **Tampilan**:
  - **Cincin Progres Kalori Real-Time (Calorie Ring)**:
    - Kalori Masuk (dari makanan di Supabase)
    - Kalori Terbakar Aktif (live dari Google Fit API)
    - Target Kalori Harian
    - Sisa Kuota Kalori Hari Ini
  - **Cincin Makronutrisi**: Bar progres Protein, Karbohidrat, dan Lemak.
  - **Widget Langkah Kaki Google Fit**: Indikator langkah hari ini (misal: 7.420 / 10.000 langkah).
  - **Timeline Makanan Hari Ini**: Daftar kartu makanan sarapan, makan siang, makan malam, dan camilan.
  - **Banner Rekomendasi Menu Malam**: Otomatis muncul di sore/malam hari jika kuota kalori belum terpenuhi.
- **Endpoint yang Digunakan**:
  - `GET /api/dashboard/summary`

---

### Halaman 3: Pemindai Makanan Cerdas (Snap & Log)
- **Tampilan**:
  - Jendela pratinjau kamera ponsel / pengunggah foto.
  - **Kolom Input Opsional (Context Hint)**:
    - *Placeholder*: *"Contoh: Dada ayam tanpa kulit, dimasak dengan sedikit minyak zaitun, es teh manis tanpa gula."*
  - Tombol **"Analisis Makanan dengan Gemini AI"**.
  - **Pop-up Hasil Analisis**:
    - Nama Hidangan utama.
    - Total Kalori & Makronutrisi (Protein, Karbo, Lemak, Serat, Natrium).
    - Daftar rincian komponen (misal: Nasi putih 150g, Ayam bakar 150g, Sambal 20g).
    - Nilai keyakinan AI (*confidence score*).
  - Tombol **"Simpan & Catat Makanan"**.
- **Endpoints yang Digunakan**:
  - `POST /api/scanner/food` (Kirim foto + `context_hint`)
  - `POST /api/scanner/log-meal` (Simpan hidangan terverifikasi & sync Google Fit)

---

### Halaman 4: Pemindai Label Nilai Gizi Kemasan (Nutrition Label Scanner)
- **Tampilan**:
  - Mode pemindai khusus untuk memotret tabel Informasi Nilai Gizi di belakang kemasan biskuit, susu, atau minuman kaleng.
  - **Hasil Ekstraksi Gemini AI**:
    - Takaran Saji & Jumlah Sajian per Kemasan.
    - Kalori per sajian vs Kalori total satu kemasan penuh.
    - Kandungan gula, lemak jenuh, dan kadar natrium (disertai indikator warna: Hijau/Aman, Kuning/Waspada, Merah/Tinggi Gula atau Garam).
- **Endpoint yang Digunakan**:
  - `POST /api/scanner/label`

---

### Halaman 5: Widget Konverter Aktivitas (Burn It Off Converter)
- **Tampilan**:
  - Muncul langsung setelah pengguna mencatat makanan atau diakses melalui riwayat makanan.
  - Menjawab pertanyaan: *"Berapa lama olahraga yang saya butuhkan untuk membakar hidangan ini?"*
  - **Kartu Pilihan Aktivitas (Berdasarkan MET Ilmiah)**:
    - 🚶 Jalan Santai: `X menit`
    - 🏃 Jogging: `Y menit`
    - 🚴 Bersepeda: `Z menit`
    - 🪢 Lompat Tali: `N menit`
    - 🏊 Berenang: `M menit`
  - **Koneksi Google Fit**: Menampilkan berapa persen kalori makanan tersebut yang *sudah otomatis terbakar* oleh aktivitas fisik pengguna hari ini.
- **Endpoint yang Digunakan**:
  - `POST /api/converter/burn-it-off` (Kirim `meal_id` atau jumlah `calories`)

---

### Halaman 6: Rekomendasi Menu Penutup Target Harian (Smart Meal Recommender)
- **Tampilan**:
  - Tombol atau tab: **"Rekomendasi Menu Malam"**.
  - Menampilkan 3 kartu hidangan lokal nusantara/sehat pilihan Gemini AI yang disesuaikan secara presisi dengan sisa kalori dan protein yang belum terpenuhi.
  - Setiap kartu memuat:
    - Nama hidangan (contoh: Pepes Tahu Jamur + Sup Dada Ayam).
    - Total kalori dan makronutrisi.
    - Rincian bahan dan tips memasak sehat tanpa minyak berlebih.
- **Endpoint yang Digunakan**:
  - `GET /api/recommendations/daily-closing?meal_type=dinner`

---

### Halaman 7: Laporan Mingguan & Ekspor PDF (Weekly Nutrition Report)
- **Tampilan**:
  - Grafik tren konsumsi makanan vs kalori aktif terbakar selama 7 hari terakhir.
  - Kartu Evaluasi AI: Skor Kesehatan (Grade A/B/C) dan ringkasan klinis oleh Gemini.
  - Daftar pencapaian dan area perbaikan gizi.
  - Tombol **"Download Laporan PDF Resmi"**.
- **Alur Teknis Download PDF**:
  - Pengguna mengklik tombol unduh, frontend memanggil endpoint `GET /api/reports/weekly/pdf` dengan header `Authorization: Bearer <token>`.
  - Backend langsung men-*stream* binary PDF secara instan untuk langsung disimpan atau dicetak pengguna.
- **Endpoints yang Digunakan**:
  - `GET /api/reports/weekly` (Tampilan data di layar)
  - `GET /api/reports/weekly/pdf` (Unduh berkas PDF)
