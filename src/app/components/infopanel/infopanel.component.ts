import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { of } from 'rxjs/internal/observable/of';
import { map, switchMap, takeUntil } from 'rxjs/operators';
import { DataService } from '../../services/data.service';
import { DataModel } from '../../services/datamodel';

class BurialPlotInfo {
  public occupiedFrom: string = ''; // Date | null = null;
  public deceasedName: string = '';
  public dateOfBirth: string = ''; // Date | null = null;
  public dateOfDeath: string = 'tbd...'; // Date | null = null;

  public static fromDataModel(model: DataModel): BurialPlotInfo {
    return {
      occupiedFrom: model.occupiedFrom,
      rentalUntil: model.rentalUntil,
      deceasedName: model.deceasedName,
      dateOfBirth: model.dateOfBirth,
      dateOfDeath: model.dateOfDeath
    } as BurialPlotInfo;
  }
}

class InfopanelData {
  public burialPlotCount: number = 0;
  public availableBurialPlotCount: number = 0;
  public grave: string = '';
  public remark: string = '';
  public itemNo: string = '';
  public pricePerYear: number = 0;
  public specialPrice: number = 0;
  public orderNo: number = 0;
  public creditorNo: number = 0;
  public rentalFrom: string = '';
  public rentalUntil: string = '';
  public burialPlots: BurialPlotInfo[] = [];
}

@Component({
  selector: 'eis-infopanel',
  templateUrl: './infopanel.component.html',
  styleUrls: ['./infopanel.component.scss']
})
export class InfopanelComponent implements OnInit, OnDestroy {

  public info$: Observable<InfopanelData>;

  private shutdownSignal: Subject<void> = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private dataService: DataService) {

    this.info$ = this.route.paramMap
      .pipe(
        takeUntil(this.shutdownSignal),
        map(params => params.get('id') || ''),
        switchMap(id =>
          this.dataService.readData$().pipe(
            map((records: DataModel[]) => {
              console.log('id', id);
              const filteredRecords = records.filter(record => record.grave === id);
              console.log('no of filtered records', filteredRecords.length);
              return filteredRecords;
            })
          )),
        switchMap((records: DataModel[]) => of({
          burialPlotCount: records[0].burialPlotCount,
          availableBurialPlotCount: records.filter(r => !r.deceasedName).length,
          grave: records[0].grave,
          remark: records[0].remark,
          itemNo: records[0].itemNo,
          pricePerYear: records[0].pricePerYear,
          specialPrice: records[0].specialPrice,
          orderNo: records[0].orderNo,
          creditorNo: records[0].creditorNo,
          rentalFrom: records[0].rentalFrom,
          rentalUntil: records[0].rentalUntil,
          burialPlots: records.map(r => BurialPlotInfo.fromDataModel(r))
        } as InfopanelData))
      );
  }

  public ngOnInit(): void {
  }

  public ngOnDestroy() {
    this.shutdownSignal.next();
  }

  public hide(): void {
    this.router.navigateByUrl('/').then().catch();
  }
}
