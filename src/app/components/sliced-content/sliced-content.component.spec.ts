import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SlicedContentComponent } from './sliced-content.component';

describe('SlicedContentComponent', () => {
  let component: SlicedContentComponent;
  let fixture: ComponentFixture<SlicedContentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SlicedContentComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SlicedContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
