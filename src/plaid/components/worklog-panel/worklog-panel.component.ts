import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {Worklog} from '../../models/worklog';
import {PlaidFacade} from '../../plaid.facade';
import {Subscription} from 'rxjs';

@Component({
  selector: 'plaid-worklog-panel',
  templateUrl: './worklog-panel.component.html',
  styleUrls: ['./worklog-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorklogPanelComponent implements OnInit, OnDestroy {
  jiraURL: string;
  _worklog: Worklog;
  _pixelsPerMinute: number;
  undersized = false;
  tooLow = false;
  subscriptions: Subscription[] = [];
  viewDestroyed = false;

  @Input()
  set worklog(worklog: Worklog) {
    this._worklog = worklog;
    if (this.pixelsPerMinute) {
      setTimeout(() => this.checkSizeAndPosition());
    }
  }
  get worklog(): Worklog {
    return this._worklog;
  }
  @Input()
  set pixelsPerMinute(pixelsPerMinute: number) {
    this._pixelsPerMinute = pixelsPerMinute;
    if (this.worklog) {
      setTimeout(() => this.checkSizeAndPosition());
    }
  }
  get pixelsPerMinute(): number {
    return this._pixelsPerMinute;
  }

  @ViewChild('panelInner', { static: true })
  panelInner: ElementRef;

  constructor(private facade: PlaidFacade, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.subscriptions.push(this.facade.getJiraURL$().subscribe(url => this.jiraURL = url));
    this.subscriptions.push(this.facade.windowResize$().subscribe(() => this.checkSizeAndPosition()));
  }

  ngOnDestroy(): void {
    this.viewDestroyed = true;
    while (this.subscriptions.length > 0) {
      this.subscriptions.pop().unsubscribe();
    }
  }

  get date(): Date {
    return new Date(this.worklog.started);
  }

  get panelWidth(): number {
    return 1 / this.worklog._columns;
  }

  get panelHeight(): number {
    return Math.min(this.worklog.timeSpentSeconds / 60 * this.pixelsPerMinute, this.maxHeight);
  }

  get maxHeight(): number {
    return 1440 * this.pixelsPerMinute - this.panelOffsetTop;
  }

  get panelOffsetTop(): number {
    return (this.date.getHours() * 60 + this.date.getMinutes()) * this.pixelsPerMinute;
  }

  get panelOffsetLeft(): number {
    return this.worklog._column * this.panelWidth;
  }

  get panelHue(): number {
    const num = Number(this.worklog.issue.fields.parent ? this.worklog.issue.fields.parent.id : this.worklog.issue.id);
    return Math.round((num * 360 / 1.61803)) % 360;
  }

  get components(): string {
    return this.worklog.issue.fields.components ? this.worklog.issue.fields.components.map(c => c.name).join(', ') : null;
  }

  get timeRange(): string {
    const startTime = new Date(this.worklog.started);
    const endTime = new Date(startTime);
    endTime.setTime(endTime.getTime() + this.worklog.timeSpentSeconds * 1000);

    if (
      startTime.getFullYear() === endTime.getFullYear() &&
      startTime.getMonth() === endTime.getMonth() &&
      startTime.getDate() === endTime.getDate()
    ) {
      return startTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + ' - ' +
        endTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } else {
      let sumOfSeconds = this.worklog.timeSpentSeconds;
      const hours: number = Math.floor(sumOfSeconds / 3600);
      sumOfSeconds -= hours * 3600;
      const minutes: number = Math.floor(sumOfSeconds / 60);
      sumOfSeconds -= minutes * 60;
      const seconds: number = sumOfSeconds;
      return 'Since ' + startTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) +
        ' for ' + (hours ? hours + 'h ' : '') + (minutes ? minutes + 'm ' : '') + (seconds ? seconds + 's' : '');
    }
  }

  checkSizeAndPosition(): void {
    if (!this.viewDestroyed) {
      this.undersized = this.panelInner.nativeElement.scrollHeight > this.panelHeight;
      this.tooLow = this.panelInner.nativeElement.scrollHeight + 1 > this.maxHeight;
      this.cdr.detectChanges();
    }
  }
}
