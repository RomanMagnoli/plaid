import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { WorklogFacade } from './worklog/worklog.facade';
import { AuthFacade } from './auth/auth.facade';
import { UserPreferencesService } from './user-preferences.service';
import { Worklog } from '../model/worklog';

export interface QuickLogConfig {
  nextDayTasksDefaultMessage: string;
  problemsDefaultMessage: string;
  nextDayTasksEnabled: boolean;
  problemsEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class QuickLogService {
  private readonly NEXT_DAY_TASKS_LOGGED_TODAY = 'NEXT_DAY_TASKS_LOGGED_TODAY';
  private readonly PROBLEMS_LOGGED_TODAY = 'PROBLEMS_LOGGED_TODAY';

  private nextDayTasksLoggedToday: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private problemsLoggedToday: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor(
    private worklogFacade: WorklogFacade,
    private authFacade: AuthFacade,
    private userPreferencesService: UserPreferencesService
  ) {
    this.checkTodayStatus();
  }

  getConfig$(): Observable<QuickLogConfig> {
    return new Observable(observer => {
      // Combinar todas las configuraciones desde UserPreferencesService
      let config: Partial<QuickLogConfig> = {};
      let completedSubscriptions = 0;
      const totalSubscriptions = 4;

      const checkComplete = () => {
        completedSubscriptions++;
        if (completedSubscriptions === totalSubscriptions) {
          observer.next(config as QuickLogConfig);
        }
      };

      this.userPreferencesService.getQuickLogNextDayMessage$().pipe(take(1)).subscribe(message => {
        config.nextDayTasksDefaultMessage = message;
        checkComplete();
      });

      this.userPreferencesService.getQuickLogProblemsMessage$().pipe(take(1)).subscribe(message => {
        config.problemsDefaultMessage = message;
        checkComplete();
      });

      this.userPreferencesService.getQuickLogNextDayEnabled$().pipe(take(1)).subscribe(enabled => {
        config.nextDayTasksEnabled = enabled;
        checkComplete();
      });

      this.userPreferencesService.getQuickLogProblemsEnabled$().pipe(take(1)).subscribe(enabled => {
        config.problemsEnabled = enabled;
        checkComplete();
      });
    });
  }

  getNextDayTasksLoggedToday$(): Observable<boolean> {
    return this.nextDayTasksLoggedToday.asObservable();
  }

  getProblemsLoggedToday$(): Observable<boolean> {
    return this.problemsLoggedToday.asObservable();
  }

  updateConfig(newConfig: Partial<QuickLogConfig>): void {
    if (newConfig.nextDayTasksDefaultMessage !== undefined) {
      this.userPreferencesService.setQuickLogNextDayMessage(newConfig.nextDayTasksDefaultMessage);
    }
    if (newConfig.problemsDefaultMessage !== undefined) {
      this.userPreferencesService.setQuickLogProblemsMessage(newConfig.problemsDefaultMessage);
    }
    if (newConfig.nextDayTasksEnabled !== undefined) {
      this.userPreferencesService.setQuickLogNextDayEnabled(newConfig.nextDayTasksEnabled);
    }
    if (newConfig.problemsEnabled !== undefined) {
      this.userPreferencesService.setQuickLogProblemsEnabled(newConfig.problemsEnabled);
    }
  }

  private checkTodayStatus(): void {
    const today = new Date().toDateString();
    const lastNextDayTasksDate = localStorage.getItem(this.NEXT_DAY_TASKS_LOGGED_TODAY);
    const lastProblemsDate = localStorage.getItem(this.PROBLEMS_LOGGED_TODAY);

    this.nextDayTasksLoggedToday.next(lastNextDayTasksDate === today);
    this.problemsLoggedToday.next(lastProblemsDate === today);
  }

  markNextDayTasksAsLogged(): void {
    const today = new Date().toDateString();
    localStorage.setItem(this.NEXT_DAY_TASKS_LOGGED_TODAY, today);
    this.nextDayTasksLoggedToday.next(true);
  }

  markProblemsAsLogged(): void {
    const today = new Date().toDateString();
    localStorage.setItem(this.PROBLEMS_LOGGED_TODAY, today);
    this.problemsLoggedToday.next(true);
  }

  createQuickLog(comment: string, type: 'next-day-tasks' | 'problems'): Observable<void> {
    return new Observable(observer => {
      this.authFacade.getAuthenticatedUser$().pipe(
        take(1)
      ).subscribe(currentUser => {
        if (!currentUser) {
          observer.error(new Error('User not authenticated'));
          return;
        }

        // Get task code configuration
        const taskCodeObservable = type === 'next-day-tasks' 
          ? this.userPreferencesService.getQuickLogNextDayTaskCode$()
          : this.userPreferencesService.getQuickLogProblemsTaskCode$();

        taskCodeObservable.pipe(take(1)).subscribe(taskCode => {
          const now = new Date();
          let worklog: Partial<Worklog>;

          if (taskCode && taskCode.trim()) {
            // Create 1-minute worklog in the configured task
            worklog = {
              comment: `[${type === 'next-day-tasks' ? 'NEXT DAY TASKS' : 'PROBLEMS'}] ${comment}`,
              started: now.toISOString(),
              timeSpentSeconds: 60, // 1 minute
              author: currentUser,
              issueId: taskCode.trim(),
              issue: {
                key: taskCode.trim(),
                fields: {
                  summary: type === 'next-day-tasks' ? 'Next day tasks tracking' : 'Problems tracking'
                }
              } as any
            };
          } else {
            // Fallback to generic quick log (original behavior)
            worklog = {
              comment: `[${type === 'next-day-tasks' ? 'NEXT DAY TASKS' : 'PROBLEMS'}] ${comment}`,
              started: now.toISOString(),
              timeSpentSeconds: 60, // 1 minute
              author: currentUser,
              issueId: 'QUICK-LOG', // Generic ID for quick logs
              issue: {
                key: type === 'next-day-tasks' ? 'QUICK-LOG-NEXT' : 'QUICK-LOG-PROBLEMS',
                fields: {
                  summary: type === 'next-day-tasks' ? 'Next day tasks' : 'Problems found'
                }
              } as any
            };
          }

          this.worklogFacade.addWorklog$(worklog as Worklog, now, 60, worklog.comment as string)
            .subscribe({
              next: () => {
                if (type === 'next-day-tasks') {
                  this.markNextDayTasksAsLogged();
                } else {
                  this.markProblemsAsLogged();
                }
                observer.next();
                observer.complete();
              },
              error: error => {
                console.error('Error creating quick log:', error);
                observer.error(error);
              }
            });
        });
      });
    });
  }
}
