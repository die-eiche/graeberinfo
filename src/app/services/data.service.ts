import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { of } from 'rxjs/internal/observable/of';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { DataModel } from './datamodel';

const emptyRecord: DataModel = {
  burialPlotCount: 0,
  grave: '?',
  remark: '?',
  itemNo: '?',
  price15: 0,
  price5: 0,
  price1: 0,
  specialPrice: 0,
  errorCode: '?',
  orderNo: 0,
  creditorNo: 0,
  renter: '?',
  occupiedFrom: '?',
  rentalUntil: '?',
  recalculationDueDays: 0,
  name: '?',
  dateOfBirth: '?'
} as DataModel;

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private dataUrl = '/api/info-data';

  private cachedRecords: DataModel[] = [];

  constructor(
    private httpClient: HttpClient) {
  }

  public readData$(): Observable<DataModel[]> {
    const uri = environment.dataServerBaseAddress + this.dataUrl + `?code=89TXFKZJCU7Qm2HWjsgP7wuKtp4T3jBp_x-Bi4bjQSqsAzFucMS3-A==&` + new Date().getTime();
    let source$ = this.cachedRecords.length
      ? of(this.cachedRecords)
      : this.httpClient.get<DataModel[]>(uri);

    return source$
      .pipe(
        map((records: DataModel[]) => {
          if (records.length > 0) {
            console.log('records found:', records.length, records);
            return records;
          }

          console.warn('No records found at ' + uri);
          return [emptyRecord];
        }),
        tap((records: DataModel[]) => this.cachedRecords = records)
      );
  }
}
