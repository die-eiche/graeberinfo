export interface ExcelDataResponse {
  source: 'dropbox' | 'demo';
  filePath?: string;
  sheetName: string;
  columns: string[];
  rows: Record<string, string | number>[];
  mappedRows: Record<string, string | number>[];
  rowCount: number;
  fetchedAt: string;
  error?: string;
  hint?: string;
}
