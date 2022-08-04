import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { NgxCsvParser } from 'ngx-csv-parser';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
  private dataUrl = 'http://localhost:3000/info';

  constructor(
    private httpClient: HttpClient,
    private csvParser: NgxCsvParser) {
  }

  public readData$(id: string): Observable<DataModel> {
    console.log(id);
    const options = {
      responseType: 'text' as 'json'
    };

    return this.httpClient.get<string>(this.dataUrl, options)
      .pipe(
        map((csvText) => {
          // csvText is an array of arrays => csvText[rows][columns]
          const records = this.csvParser.csvStringToArray(csvText, ';')
            .filter(textArray => {
              return textArray && (textArray.length === 17) && (textArray[1] === id);
            })
            .map(textArray => {
              console.log(textArray);
              return {
                burialPlotCount: +textArray[0],
                grave: textArray[1],
                remark: textArray[2],
                itemNo: textArray[3],
                price15: +textArray[4],
                price5: +textArray[5],
                price1: +textArray[6],
                specialPrice: +textArray[7],
                errorCode: textArray[8],
                orderNo: +textArray[9],
                creditorNo: +textArray[10],
                renter: textArray[11],
                occupiedFrom: textArray[12],
                rentalUntil: textArray[13],
                recalculationDueDays: +textArray[14],
                name: textArray[15],
                dateOfBirth: textArray[16]
              } as DataModel;
            });

          if (records.length > 0) {
            console.log('records:', records);
            return records[0];
          }

          return emptyRecord;
        })
      );
  }
}
