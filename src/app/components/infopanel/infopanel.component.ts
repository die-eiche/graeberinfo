import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { DataService } from '../../services/data.service';
import { DataModel } from '../../services/datamodel';


@Component({
  selector: 'eis-infopanel',
  templateUrl: './infopanel.component.html',
  styleUrls: ['./infopanel.component.scss']
})
export class InfopanelComponent implements OnInit, OnDestroy {

  public info$: Observable<DataModel>;

  public isVisible$: Observable<boolean>;

  private isVisible: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  private shutdownSignal: Subject<void> = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private dataService: DataService) {

    this.info$ = this.route.paramMap
      .pipe(
        switchMap(params => {
          const id: string = params.get('id') || '';
          return this.dataService.readData$(id);
        })
      );

    this.info$
      .pipe(takeUntil(this.shutdownSignal))
      .subscribe((info: DataModel) => {
        if (info) {
          this.isVisible.next(true);
        }
      });

    this.isVisible$ = this.isVisible.asObservable();
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
