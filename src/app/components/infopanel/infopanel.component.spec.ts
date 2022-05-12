import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfopanelComponent } from './infopanel.component';

describe('InfopanelComponent', () => {
  let component: InfopanelComponent;
  let fixture: ComponentFixture<InfopanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InfopanelComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InfopanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
