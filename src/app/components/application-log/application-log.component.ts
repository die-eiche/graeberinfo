import { Component, OnInit } from '@angular/core';
import { LoggingService } from '../../services/logging.service';

@Component({
  selector: 'eis-application-log',
  templateUrl: './application-log.component.html',
  styleUrls: ['./application-log.component.scss']
})
export class ApplicationLogComponent implements OnInit {

  public log = '';

  constructor(private logger: LoggingService) {
  }

  ngOnInit(): void {
  }

  public showLog(): void {
    const messages = this.logger.getApplicationLog();
    this.log = '';
    messages.forEach(m => this.log += `${m}\r\n`);
  }

  public hideLog(): void {
    this.log = '';
  }

  public resetLog(): void {
    this.logger.resetApplicationLog();
    this.hideLog();
  }
}
