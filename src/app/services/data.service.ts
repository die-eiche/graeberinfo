import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { NgxCsvParser } from 'ngx-csv-parser';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataModel } from './datamodel';

const emptyRecord: DataModel = {
  grabStelle: '?',
  poAuftrag: '?',
  mieteJahr: 0,
  miete15Jahre: 0
} as DataModel;

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private dataUrl = '/assets/Export.csv';

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
              return textArray && (textArray.length === 3) && (textArray[0] === id);
            })
            .map(textArray => {
              console.log(textArray);
              return {
                grabStelle: textArray[0],
                poAuftrag: textArray[1],
                mieteJahr: +textArray[2],
                miete15Jahre: +textArray[2] * 15
              } as DataModel;
            });

          if (records.length === 1) {
            return records[0];
          }

          return emptyRecord;
        })
      );
  }
}
