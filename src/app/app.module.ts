import { APP_BASE_HREF } from '@angular/common';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SlicedContentComponent } from './components/sliced-content/sliced-content.component';
import { InfopanelComponent } from './components/infopanel/infopanel.component';
import { DataService } from './services/data.service';

@NgModule({
  declarations: [
    AppComponent,
    SlicedContentComponent,
    InfopanelComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule
  ],
  providers: [
    DataService,
    {provide: APP_BASE_HREF, useValue: '/'}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
