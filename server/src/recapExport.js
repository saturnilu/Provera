import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export function slugify(text) {
  return (
    String(text || 'room')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'room'
  );
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function buildRecapWorkbook(room, recap) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Provera';
  wb.created = new Date();

  const summary = wb.addWorksheet('Ringkasan');
  summary.columns = [{ width: 26 }, { width: 24 }];
  summary.addRow(['Room', room.title]);
  summary.addRow(['Status', room.status]);
  summary.addRow([
    'Durasi',
    `${room.duration_minutes} menit${room.extended_minutes ? ` (+${room.extended_minutes} menit tambahan)` : ''}`,
  ]);
  summary.addRow([]);
  summary.addRow(['Total peserta', recap.stats.totalParticipants]);
  summary.addRow(['Selesai ujian', recap.stats.completedCount]);
  summary.addRow(['Rata-rata benar', `${recap.stats.averageCorrect.toFixed(2)} / ${recap.totalScorable}`]);
  summary.addRow(['Skor tertinggi', `${recap.stats.highestCorrect} / ${recap.totalScorable}`]);
  summary.addRow(['Skor terendah', `${recap.stats.lowestCorrect} / ${recap.totalScorable}`]);
  summary.getColumn(1).font = { bold: true };

  const sheet = wb.addWorksheet('Per Siswa');
  sheet.columns = [
    { header: 'Nama', key: 'name', width: 28 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Benar', key: 'correct', width: 10 },
    { header: 'Total Soal', key: 'total', width: 12 },
    { header: 'Pelanggaran', key: 'violations', width: 45 },
  ];
  sheet.getRow(1).font = { bold: true };
  recap.students.forEach((s) => {
    sheet.addRow({
      name: s.name,
      status: s.status,
      correct: s.correctCount,
      total: s.totalScorable,
      violations: s.violations.map((v) => `${v.type} x${v.count}`).join(', ') || '-',
    });
  });

  if (recap.questionStats.length > 0) {
    const qsheet = wb.addWorksheet('Per Soal');
    qsheet.columns = [
      { header: 'Soal', key: 'prompt', width: 55 },
      { header: 'Benar', key: 'correct', width: 10 },
      { header: 'Salah', key: 'wrong', width: 10 },
      { header: 'Tidak Dijawab', key: 'unanswered', width: 16 },
      { header: '% Benar', key: 'pct', width: 10 },
    ];
    qsheet.getRow(1).font = { bold: true };
    recap.questionStats.forEach((q) => {
      const total = q.correctCount + q.wrongCount + q.unansweredCount;
      qsheet.addRow({
        prompt: q.prompt,
        correct: q.correctCount,
        wrong: q.wrongCount,
        unanswered: q.unansweredCount,
        pct: `${pct(q.correctCount, total)}%`,
      });
    });
  }

  if (recap.essayQuestionCount > 0) {
    const esheet = wb.addWorksheet('Jawaban Essay');
    esheet.columns = [
      { header: 'Nama Siswa', key: 'name', width: 24 },
      { header: 'Soal', key: 'prompt', width: 40 },
      { header: 'Jawaban', key: 'answer', width: 55 },
      { header: 'Status Penilaian', key: 'graded', width: 16 },
    ];
    esheet.getRow(1).font = { bold: true };
    recap.students.forEach((s) => {
      s.essayAnswers.forEach((ea) => {
        esheet.addRow({
          name: s.name,
          prompt: ea.prompt,
          answer: ea.answer || '(tidak dijawab)',
          graded: !ea.answer ? '-' : ea.graded ? (ea.score > 0 ? 'Benar' : 'Salah') : 'Belum dinilai',
        });
      });
    });
  }

  return wb;
}

export function streamRecapPdf(room, recap, res) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#172554').text(`Rekap — ${room.title}`);
  doc.fontSize(10).font('Helvetica').fillColor('#475569').text(
    `Status: ${room.status} · Durasi: ${room.duration_minutes} menit${room.extended_minutes ? ` (+${room.extended_minutes} tambahan)` : ''}`
  );
  doc.moveDown(1);

  doc.fontSize(13).font('Helvetica-Bold').fillColor('#172554').text('Ringkasan Kelas');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor('#000000');
  doc.text(`Total peserta: ${recap.stats.totalParticipants}    Selesai ujian: ${recap.stats.completedCount}`);
  doc.text(
    `Rata-rata: ${recap.stats.averageCorrect.toFixed(2)}/${recap.totalScorable}    ` +
    `Tertinggi: ${recap.stats.highestCorrect}/${recap.totalScorable}    ` +
    `Terendah: ${recap.stats.lowestCorrect}/${recap.totalScorable}`
  );
  doc.moveDown(1);

  if (recap.questionStats.length > 0) {
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#172554').text('Soal Tersulit');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor('#000000');
    const hardest = [...recap.questionStats].sort(
      (a, b) => (b.wrongCount + b.unansweredCount) - (a.wrongCount + a.unansweredCount)
    );
    hardest.forEach((q, i) => {
      const total = q.correctCount + q.wrongCount + q.unansweredCount;
      doc.text(
        `${i + 1}. ${q.prompt} — ${pct(q.correctCount, total)}% benar ` +
        `(${q.correctCount} benar, ${q.wrongCount} salah, ${q.unansweredCount} tidak dijawab)`,
        { width: 515 }
      );
    });
    doc.moveDown(1);
  }

  doc.fontSize(13).font('Helvetica-Bold').fillColor('#172554').text('Per Siswa');
  doc.moveDown(0.4);

  const col = { name: 40, score: 280, status: 350, violations: 430 };
  function row(y, name, score, status, violations, bold) {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#000000');
    doc.text(name, col.name, y, { width: 230 });
    doc.text(score, col.score, y, { width: 60 });
    doc.text(status, col.status, y, { width: 70 });
    doc.text(violations, col.violations, y, { width: 125 });
  }

  row(doc.y, 'Nama', 'Skor', 'Status', 'Pelanggaran', true);
  doc.y += 16;
  doc.moveTo(40, doc.y - 4).lineTo(555, doc.y - 4).strokeColor('#E2E8F0').stroke();

  recap.students.forEach((s) => {
    if (doc.y > 760) {
      doc.addPage();
      doc.y = 40;
    }
    const violText = s.violations.map((v) => `${v.type} x${v.count}`).join(', ') || '-';
    row(doc.y, s.name, `${s.correctCount}/${s.totalScorable}`, s.status, violText, false);
    doc.y += 16;
  });

  if (recap.students.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor('#475569').text('Belum ada siswa yang ikut room ini.', col.name, doc.y);
  }

  doc.end();
}