import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DropboxExcelService } from '../../services/dropbox-excel.service';
import { ExcelTableComponent } from './excel-table.component';

describe('ExcelTableComponent', () => {
  let component: ExcelTableComponent;
  let fixture: ComponentFixture<ExcelTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExcelTableComponent],
      providers: [
        {
          provide: DropboxExcelService,
          useValue: {
            loadExcelData$: () => of({
              source: 'demo',
              sheetName: 'Test',
              columns: ['Grab'],
              rows: [{ Grab: 'A-1' }],
              mappedRows: [],
              rowCount: 1,
              fetchedAt: new Date().toISOString()
            }),
            clearCache: () => undefined
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExcelTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
