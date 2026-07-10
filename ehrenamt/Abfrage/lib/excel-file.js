const fs = require('fs');

const DEFAULT_EXCEL_PATH = '/data/excel/EA Dienste 2026.xlsx';

function getExcelFilePath() {
  return process.env.EXCEL_FILE_PATH || DEFAULT_EXCEL_PATH;
}

function readExcelFile() {
  const filePath = getExcelFilePath();

  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel-Datei nicht gefunden: ${filePath}`);
  }

  return fs.readFileSync(filePath);
}

module.exports = {
  getExcelFilePath,
  readExcelFile
};
