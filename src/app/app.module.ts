import { APP_BASE_HREF, registerLocaleData } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import localeDe from '@angular/common/locales/de';
import localeDeExtra from '@angular/common/locales/extra/de';
import { DEFAULT_CURRENCY_CODE, LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { INGXLoggerConfig, LoggerModule, NgxLoggerLevel } from 'ngx-logger';
import { environment } from '../environments/environment';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { InfopanelComponent } from './components/infopanel/infopanel.component';
import { SlicedContentComponent } from './components/sliced-content/sliced-content.component';
import { DataService } from './services/data.service';
import { LoggingService } from './services/logging.service';
import { ApplicationLogComponent } from './components/application-log/application-log.component';

registerLocaleData(localeDe, 'de-DE', localeDeExtra);

const loggerConfig: INGXLoggerConfig = environment.production
  ? {level: NgxLoggerLevel.TRACE, disableConsoleLogging: true, disableFileDetails: true}
  : {level: NgxLoggerLevel.TRACE, disableConsoleLogging: false, disableFileDetails: true};

@NgModule({
  declarations: [
    AppComponent,
    SlicedContentComponent,
    InfopanelComponent,
    ApplicationLogComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    LoggerModule.forRoot(loggerConfig)
  ],
  providers: [
    DataService,
    LoggingService,
    {provide: LOCALE_ID, useValue: 'de-DE'},
    {provide: DEFAULT_CURRENCY_CODE, useValue: 'EUR'},
    {provide: APP_BASE_HREF, useValue: '/'}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
