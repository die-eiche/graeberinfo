import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataModel } from './datamodel';

const emptyRecord: DataModel = {
  grabStelle: '?',
  poAuftrag: '?',
  mieter: '?',
  strasse: '?',
  plz: '?',
  ort: '?'
};

@Injectable({
  providedIn: 'root'
})
export class DataService {

  private dataUrl = '/assets/demodata.json';

  constructor(private httpClient: HttpClient) {
  }

  public readData$(id: string): Observable<DataModel> {
    return this.httpClient.get<DataModel[]>(this.dataUrl)
      .pipe(
        map((records: DataModel[]) => {
          let data: DataModel = records.find((record: DataModel) => record.grabStelle === id) as DataModel;
          data = data || {...emptyRecord, grabStelle: id};
          return data;
        })
      );
  }
}
