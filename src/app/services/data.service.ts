import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { of } from 'rxjs/internal/observable/of';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { DataModel } from './datamodel';
import { LoggingService } from './logging.service';

const emptyRecord: DataModel = {
  burialPlotCount: 0,
  grave: '?',
  remark: '?',
  itemNo: '?',
  pricePerYear: 0,
  specialPrice: 0,
  orderNo: 0,
  creditorNo: 0,
  rentalFrom: '?',
  occupiedFrom: '?',
  rentalUntil: '?',
  deceasedName: '?',
  dateOfBirth: '?',
  dateOfDeath: '?'
} as DataModel;

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private dataUrl = '/api/info-data';

  private cachedRecords: DataModel[] = [];

  constructor(
    private httpClient: HttpClient,
    private logger: LoggingService) {
  }

  public readData$(): Observable<DataModel[]> {
    this.logger.trace('starting DataService.readData$().');
    const authCodeQuery = environment.authCode
      ? `code=${environment.authCode}&`
      : '';

    const uri = environment.dataServerBaseAddress + this.dataUrl + `?${authCodeQuery}` + new Date().getTime();
    this.logger.trace(`generated uri: ${uri}.`);

    if (this.cachedRecords.length) {
      this.logger.debug(`using ${this.cachedRecords.length} cached records as data source.`);
    } else {
      this.logger.debug('using http request as data source.');
    }

    let source$ = this.cachedRecords.length
      ? of(this.cachedRecords)
      : this.httpClient.get<DataModel[]>(uri);

    return source$
      .pipe(
        map((records: DataModel[]) => {
          if (records.length > 0) {
            this.logger.debug(`found ${records.length} records`);
            return records;
          }

          this.logger.warn('no records found in data source.');
          return [emptyRecord];
        }),
        tap((records: DataModel[]) => this.cachedRecords = records)
      );
  }
}
