import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DropboxExcelService } from '../../services/dropbox-excel.service';
import { ExcelDataResponse } from '../../services/excel-data.model';

@Component({
  selector: 'eis-excel-table',
  templateUrl: './excel-table.component.html',
  styleUrls: ['./excel-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExcelTableComponent implements OnInit {
  public data$: Observable<ExcelDataResponse>;
  public isRefreshing = false;

  constructor(private dropboxExcelService: DropboxExcelService) {
    this.data$ = this.dropboxExcelService.loadExcelData$();
  }

  public ngOnInit(): void {
  }

  public refresh(): void {
    this.isRefreshing = true;
    this.dropboxExcelService.clearCache();
    this.data$ = this.dropboxExcelService.loadExcelData$(true).pipe(
      map(response => {
        this.isRefreshing = false;
        return response;
      })
    );
  }

  public displayValue(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return String(value);
  }
}
