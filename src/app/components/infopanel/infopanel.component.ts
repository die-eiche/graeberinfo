import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NGXLogger } from 'ngx-logger';
import { Subject } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { of } from 'rxjs/internal/observable/of';
import { catchError, map, switchMap, takeUntil, tap } from 'rxjs/operators';
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
  public errorMessage: string = '';
}

@Component({
  selector: 'eis-infopanel',
  templateUrl: './infopanel.component.html',
  styleUrls: ['./infopanel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfopanelComponent implements OnInit, OnDestroy {

  public info$: Observable<InfopanelData>;

  public error$: Observable<string>;

  private shutdownSignal: Subject<void> = new Subject<void>();

  private errorSignal: Subject<string> = new Subject<string>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private dataService: DataService,
    private logger: NGXLogger) {

    this.error$ = this.errorSignal.asObservable();

    this.info$ = this.route.paramMap
      .pipe(
        takeUntil(this.shutdownSignal),
        map(params => params.get('id') || ''),
        tap(id => this.logger.debug(`found '${id}' as route param.`)),
        tap(id => {
          if (!id) {
            throw Error('Es konnte kein gültiges Grab aus der Url ausgelesen werden.');
          } else {
            this.errorSignal.next('');
          }
        }),
        switchMap(id =>
          this.dataService.readData$().pipe(
            map((records: DataModel[]) => records.filter(record => record.grave === id)),
            tap(filteredRecords => this.logger.debug(`filtered data to ${filteredRecords.length} records.`)),
            tap(filteredRecords => {
              if (!filteredRecords.length) {
                throw Error(`Es wurden keine Daten für das Grab '${id}' gefunden.`);
              } else {
                this.errorSignal.next('');
              }
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
        } as InfopanelData)),
        catchError((errorMessage) => {
          this.errorSignal.next(errorMessage.toString());
          return of({ errorMessage } as InfopanelData);
        })
      );
  }

  public ngOnInit(): void {
  }

  public ngOnDestroy() {
    this.logger.trace('shutting down infopanel.');
    this.shutdownSignal.next();
  }

  public hide(): void {
    this.logger.trace('hiding infopanel.');
    this.router.navigateByUrl('/').then().catch();
  }
}
