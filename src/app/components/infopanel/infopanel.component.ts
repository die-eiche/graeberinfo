import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { of } from 'rxjs/internal/observable/of';
import { map, switchMap, takeUntil } from 'rxjs/operators';
import { DataService } from '../../services/data.service';
import { DataModel } from '../../services/datamodel';

class BurialPlotInfo {
  public orderNo: number = 0;
  public creditorNo: number = 0;
  public renter: string = '';
  public occupiedFrom: string = ''; // Date | null = null;
  public rentalUntil: string = ''; // Date | null = null;
  public recalculationDueDays: number = 0;
  public name: string = '';
  public dateOfBirth: string = ''; // Date | null = null;

  public static fromDataModel(model: DataModel): BurialPlotInfo {
    return {
      orderNo: model.orderNo,
      creditorNo: model.creditorNo,
      renter: model.renter,
      occupiedFrom: model.occupiedFrom,
      rentalUntil: model.rentalUntil,
      recalculationDueDays: model.recalculationDueDays,
      name: model.name,
      dateOfBirth: model.dateOfBirth
    } as BurialPlotInfo;
  }
}

class InfopanelData {
  public burialPlotCount: number = 0;
  public availableBurialPlotCount: number = 0;
  public grave: string = '';
  public remark: string = '';
  public itemNo: string = '';
  public price15: number = 0;
  public price5: number = 0;
  public price1: number = 0;
  public specialPrice: number = 0;
  public errorCode: string = '';
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
          availableBurialPlotCount: records.filter(r => !r.orderNo && !r.renter).length,
          grave: records[0].grave,
          remark: records[0].remark,
          itemNo: records[0].itemNo,
          price15: records[0].price15,
          price5: records[0].price5,
          price1: records[0].price1,
          specialPrice: records[0].specialPrice,
          errorCode: records[0].errorCode,
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
