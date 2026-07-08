import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { NGXLogger } from 'ngx-logger';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ExcelDataResponse } from './excel-data.model';

@Injectable({
  providedIn: 'root'
})
export class DropboxExcelService {
  private cachedResponse: ExcelDataResponse | null = null;

  constructor(
    private httpClient: HttpClient,
    private logger: NGXLogger
  ) {
  }

  public loadExcelData$(forceRefresh = false): Observable<ExcelDataResponse> {
    if (this.cachedResponse && !forceRefresh) {
      this.logger.debug('Verwende zwischengespeicherte Excel-Daten.');
      return of(this.cachedResponse);
    }

    if (environment.useDemoData) {
      this.logger.debug('Lade Demo-Excel-Daten aus assets.');
      return this.httpClient.get<ExcelDataResponse>('/assets/sample-excel-data.json').pipe(
        tap(response => this.cachedResponse = response)
      );
    }

    const uri = `${environment.dropboxExcelApiUrl}?t=${Date.now()}`;
    this.logger.debug(`Lade Excel-Daten von ${uri}`);

    return this.httpClient.get<ExcelDataResponse>(uri).pipe(
      tap(response => this.cachedResponse = response),
      catchError(error => {
        const message = error?.error?.error || error?.message || 'Excel-Daten konnten nicht geladen werden.';
        this.logger.error(message, error);
        return of({
          source: 'dropbox',
          sheetName: '',
          columns: [],
          rows: [],
          mappedRows: [],
          rowCount: 0,
          fetchedAt: new Date().toISOString(),
          error: message,
          hint: error?.error?.hint
        } as ExcelDataResponse);
      })
    );
  }

  public clearCache(): void {
    this.cachedResponse = null;
  }
}
