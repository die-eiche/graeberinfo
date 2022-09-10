import { Injectable } from '@angular/core';
import { NGXLogger } from 'ngx-logger';

@Injectable({
  providedIn: 'root'
})
export class LoggingService {

  private loggedMessages: string[] = [];

  constructor(
    private logger: NGXLogger) { }

  public trace(message: string): void {
    this.loggedMessages.push(message);
    this.logger.trace(message);
  }

  public debug(message: string): void {
    this.loggedMessages.push(message);
    this.logger.debug(message);
  }

  public info(message: string): void {
    this.loggedMessages.push(message);
    this.logger.info(message);
  }

  public warn(message: string): void {
    this.loggedMessages.push(message);
    this.logger.warn(message);
  }

  public error(message: string): void {
    this.loggedMessages.push(message);
    this.logger.error(message);
  }

  public fatal(message: string): void {
    this.loggedMessages.push(message);
    this.logger.fatal(message);
  }

  public getApplicationLog(): string[] {
    return this.loggedMessages;
  }

  public resetApplicationLog(): void {
    this.loggedMessages = [];
  }
}
