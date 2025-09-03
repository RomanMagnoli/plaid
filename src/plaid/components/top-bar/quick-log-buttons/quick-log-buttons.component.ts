import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { QuickLogService, QuickLogConfig } from '../../../core/quick-log.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'plaid-quick-log-buttons',
  templateUrl: './quick-log-buttons.component.html',
  styleUrls: ['./quick-log-buttons.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickLogButtonsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  config: QuickLogConfig = {
    nextDayTasksDefaultMessage: '',
    problemsDefaultMessage: '',
    nextDayTasksEnabled: true,
    problemsEnabled: true
  };
  
  nextDayTasksLogged = false;
  problemsLogged = false;
  
  // Modal states
  showNextDayTasksModal = false;
  showProblemsModal = false;

  constructor(
    private quickLogService: QuickLogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to configuration
    this.quickLogService.getConfig$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(config => {
        this.config = config;
        this.cdr.detectChanges();
      });

    // Subscribe to next day tasks logging status
    this.quickLogService.getNextDayTasksLoggedToday$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(logged => {
        this.nextDayTasksLogged = logged;
        this.cdr.detectChanges();
      });

    // Subscribe to problems logging status
    this.quickLogService.getProblemsLoggedToday$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(logged => {
        this.problemsLogged = logged;
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openNextDayTasksModal(): void {
    if (this.config.nextDayTasksEnabled) {
      this.showNextDayTasksModal = true;
    }
  }

  openProblemsModal(): void {
    if (this.config.problemsEnabled) {
      this.showProblemsModal = true;
    }
  }

  closeNextDayTasksModal(): void {
    console.log('Closing next day tasks modal');
    this.showNextDayTasksModal = false;
    this.cdr.detectChanges();
  }

  closeProblemsModal(): void {
    console.log('Closing problems modal');
    this.showProblemsModal = false;
    this.cdr.detectChanges();
  }

  onNextDayTasksSubmit(message: string): void {
    console.log('Next day tasks submit:', message);
    this.quickLogService.createQuickLog(message, 'next-day-tasks').subscribe({
      next: () => {
        console.log('Next day tasks logged successfully');
        this.closeNextDayTasksModal();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error logging next day tasks:', error);
        alert('Error logging next day tasks. Please try again.');
      }
    });
  }

  onProblemsSubmit(message: string): void {
    console.log('Problems submit:', message);
    this.quickLogService.createQuickLog(message, 'problems').subscribe({
      next: () => {
        console.log('Problems logged successfully');
        this.closeProblemsModal();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error logging problems:', error);
        alert('Error logging problems found. Please try again.');
      }
    });
  }
}
