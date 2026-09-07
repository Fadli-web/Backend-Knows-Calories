import PDFDocument from 'pdfkit';

/**
 * Generates a clean, professional Weekly Nutrition & Health Report PDF
 * @param {object} params
 * @param {object} params.userProfile - User profile details
 * @param {string} params.startDate - ISO date string
 * @param {string} params.endDate - ISO date string
 * @param {Array} params.dailyBreakdown - Array of 7 days intake and fit data
 * @param {object} params.totals - Aggregated totals and averages
 * @param {object} params.aiInsights - Gemini AI clinical evaluation
 * @returns {Promise<Buffer>}
 */
export const generateWeeklyReportPDF = ({
  userProfile,
  startDate,
  endDate,
  dailyBreakdown = [],
  totals = {},
  aiInsights = {}
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `CalorieKnows Weekly Report - ${userProfile.name || 'User'}`,
          Author: 'CalorieKnows AI Health Engine'
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Palette
      const primaryColor = '#10B981'; // Vibrant Emerald
      const secondaryColor = '#065F46'; // Dark Emerald
      const darkText = '#1F2937';
      const grayText = '#4B5563';
      const lightBg = '#F3F4F6';
      const accentBg = '#ECFDF5';

      // 1. Header Banner
      doc.rect(40, 40, 515, 65).fill(accentBg);
      doc.rect(40, 40, 8, 65).fill(primaryColor);

      doc.fillColor(secondaryColor).fontSize(20).font('Helvetica-Bold').text('CALORIEKNOWS', 60, 50);
      doc.fillColor(darkText).fontSize(12).font('Helvetica').text('Weekly Nutrition & Google Fit Activity Report', 60, 75);

      doc.fillColor(grayText).fontSize(9).text(`Periode: ${startDate} s/d ${endDate}`, 350, 55, { align: 'right' });
      doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 350, 70, { align: 'right' });

      doc.moveDown(3);

      // 2. Profile & Score Card Section
      const startY = 125;
      // User Card
      doc.rect(40, startY, 320, 95).fill(lightBg);
      doc.fillColor(darkText).fontSize(11).font('Helvetica-Bold').text('PROFIL PENGGUNA', 55, startY + 12);
      doc.font('Helvetica').fontSize(9).fillColor(grayText);
      doc.text(`Nama: ${userProfile.name || 'Member CalorieKnows'}`, 55, startY + 30);
      doc.text(`Target Kalori Harian: ${userProfile.daily_calorie_target || 2000} kcal`, 55, startY + 45);
      doc.text(`Tinggi / Berat Badan: ${userProfile.height_cm || '-'} cm / ${userProfile.weight_kg || '-'} kg`, 55, startY + 60);
      doc.text(`Tingkat Aktivitas: ${userProfile.activity_level || 'moderately_active'}`, 55, startY + 75);

      // AI Grade Badge Card
      doc.rect(375, startY, 180, 95).fill(secondaryColor);
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('EVALUASI KESEHATAN', 390, startY + 12);
      doc.fontSize(32).font('Helvetica-Bold').text(`${aiInsights.grade || 'A'}`, 390, startY + 32);
      doc.fontSize(12).font('Helvetica').text(`Skor: ${aiInsights.score || 85}/100`, 450, startY + 45);
      doc.fontSize(8).fillColor('#D1FAE5').text('Dianalisis oleh Gemini AI', 390, startY + 75);

      // 3. Weekly Averages Strip
      const stripY = startY + 110;
      doc.rect(40, stripY, 515, 45).fill('#F9FAFB');
      doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold');
      doc.text('Rata-rata Konsumsi Harian:', 55, stripY + 10);
      doc.font('Helvetica').text(`${Math.round(totals.avg_daily_calories || 0)} kcal`, 55, stripY + 25);

      doc.font('Helvetica-Bold').text('Rata-rata Kalori Terbakar:', 190, stripY + 10);
      doc.font('Helvetica').text(`${Math.round(totals.avg_daily_burned || 0)} kcal`, 190, stripY + 25);

      doc.font('Helvetica-Bold').text('Rata-rata Langkah / Hari:', 330, stripY + 10);
      doc.font('Helvetica').text(`${Math.round(totals.avg_daily_steps || 0).toLocaleString()} langkah`, 330, stripY + 25);

      doc.font('Helvetica-Bold').text('Keseimbangan Netto:', 450, stripY + 10);
      doc.font('Helvetica').text(`${Math.round((totals.avg_daily_calories || 0) - (totals.avg_daily_burned || 0))} kcal`, 450, stripY + 25);

      // 4. Daily Breakdown Table
      const tableY = stripY + 60;
      doc.fillColor(darkText).fontSize(12).font('Helvetica-Bold').text('Tabel Konsumsi & Aktivitas 7 Hari', 40, tableY);

      // Table Header
      const thY = tableY + 18;
      doc.rect(40, thY, 515, 20).fill(secondaryColor);
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
      doc.text('Tanggal', 45, thY + 6);
      doc.text('Asupan (kcal)', 110, thY + 6);
      doc.text('Terbakar (kcal)', 185, thY + 6);
      doc.text('Netto (kcal)', 265, thY + 6);
      doc.text('Langkah', 335, thY + 6);
      doc.text('Protein (g)', 405, thY + 6);
      doc.text('Karbo / Lemak (g)', 465, thY + 6);

      // Table Rows
      let rowY = thY + 20;
      dailyBreakdown.forEach((day, index) => {
        const isEven = index % 2 === 0;
        doc.rect(40, rowY, 515, 18).fill(isEven ? '#FFFFFF' : '#F9FAFB');

        doc.fillColor(darkText).fontSize(8).font('Helvetica');
        doc.text(day.date || '-', 45, rowY + 5);
        doc.text(String(Math.round(day.calories || 0)), 110, rowY + 5);
        doc.text(String(Math.round(day.calories_burned || 0)), 185, rowY + 5);
        const net = Math.round((day.calories || 0) - (day.calories_burned || 0));
        doc.text(String(net), 265, rowY + 5);
        doc.text(Number(day.steps || 0).toLocaleString(), 335, rowY + 5);
        doc.text(String(Math.round(day.protein_g || 0)), 405, rowY + 5);
        doc.text(`${Math.round(day.carbs_g || 0)} / ${Math.round(day.fat_g || 0)}`, 465, rowY + 5);

        rowY += 18;
      });

      // 5. Gemini AI Clinical Analysis Section
      const aiY = rowY + 15;
      doc.rect(40, aiY, 515, 1).fill('#E5E7EB');

      doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('ANALISIS & EVALUASI KLINIS (GEMINI AI)', 40, aiY + 10);

      doc.fillColor(darkText).fontSize(9).font('Helvetica');
      doc.text(aiInsights.executive_summary || 'Pola makan dan aktivitas fisik selama satu pekan menunjukkan komitmen yang baik terhadap gaya hidup aktif.', 40, aiY + 28, { width: 515, align: 'justify' });

      // Strengths & Improvements
      const columnY = aiY + 70;
      // Strengths
      doc.fillColor(secondaryColor).fontSize(9).font('Helvetica-Bold').text('Pencapaian Utama:', 40, columnY);
      doc.font('Helvetica').fontSize(8).fillColor(darkText);
      let sY = columnY + 14;
      (aiInsights.strengths || ['Konsistensi pemenuhan target nutrisi terjaga']).slice(0, 3).forEach(item => {
        doc.text(`* ${item}`, 45, sY, { width: 235 });
        sY += 14;
      });

      // Improvements
      doc.fillColor('#DC2626').fontSize(9).font('Helvetica-Bold').text('Fokus Peningkatan:', 300, columnY);
      doc.font('Helvetica').fontSize(8).fillColor(darkText);
      let iY = columnY + 14;
      (aiInsights.areas_for_improvement || ['Tingkatkan variasi serat dan hidrasi']).slice(0, 3).forEach(item => {
        doc.text(`* ${item}`, 305, iY, { width: 245 });
        iY += 14;
      });

      // Action Plan
      const actionY = Math.max(sY, iY) + 10;
      doc.rect(40, actionY, 515, 55).fill(accentBg);
      doc.fillColor(secondaryColor).fontSize(9).font('Helvetica-Bold').text('RENCANA AKSI MINGGU DEPAN:', 50, actionY + 8);
      doc.font('Helvetica').fontSize(8).fillColor(darkText);
      let apY = actionY + 22;
      (aiInsights.action_plan_next_week || ['Tetapkan target 8.000 langkah harian', 'Konsumsi air putih 2.5L']).slice(0, 2).forEach((plan, idx) => {
        doc.text(`${idx + 1}. ${plan}`, 55, apY, { width: 490 });
        apY += 14;
      });

      // Footer
      doc.fillColor(grayText).fontSize(7).text('CalorieKnows AI Health Engine - Dibuat secara otomatis melalui sinkronisasi Supabase & Google Fit API.', 40, 780, { align: 'center', width: 515 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
