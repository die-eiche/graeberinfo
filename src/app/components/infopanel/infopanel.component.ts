import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { DataService } from '../../services/data.service';
import { DataModel } from '../../services/datamodel';

@Component({
  selector: 'eis-infopanel',
  templateUrl: './infopanel.component.html',
  styleUrls: ['./infopanel.component.scss']
})
export class InfopanelComponent implements OnInit, OnDestroy {

  public info: DataModel = {} as DataModel;

  private shutdownSignal: Subject<void> = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private dataService: DataService) {

    this.route.paramMap
      .pipe(
        takeUntil(this.shutdownSignal),
        switchMap(params => {
          const id: string = params.get('id') || '';
          return this.dataService.readData$(id);
        })
      )
      .subscribe((data: DataModel) => this.info = data);
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
