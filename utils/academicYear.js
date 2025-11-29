function getAcademicYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  // Asumsi tahun ajaran Juli-Juni
  if (month >= 7) {
    return `${year}/${year + 1}`;
  } else {
    return `${year - 1}/${year}`;
  }
}

function getSemesterFromDate(date = new Date()) {
  const month = date.getMonth() + 1;

  // Semester ganjil: Juli-Desember (7-12), genap: Januari-Juni (1-6)
  if (month >= 7) {
    return 'ganjil';
  } else {
    return 'genap';
  }
}

module.exports = { getAcademicYear, getSemesterFromDate };