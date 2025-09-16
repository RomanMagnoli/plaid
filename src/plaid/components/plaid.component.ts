import {Component, OnInit} from '@angular/core';
import {Worklog} from '../model/worklog';
import {DateRange} from '../model/date-range';
import {User} from '../model/user';
import {ConnectionIssueModalVisible} from './connection-issue-resolver/connection-issue-modal-visible';
import {AuthFacade} from '../core/auth/auth.facade';
import {WorklogFacade} from '../core/worklog/worklog.facade';
import {AppStateService} from '../core/app-state.service';
import {UserPreferencesService} from '../core/user-preferences.service';
import {Theme} from '../model/theme';
import {SystemPreferencesService} from '../core/system-preferences.service';

/**
 * Application container.
 */
@Component({
  selector: 'plaid-root',
  templateUrl: './plaid.component.html',
  styleUrls: ['./plaid.component.scss']
})
export class PlaidComponent implements OnInit {
  pixelsPerMinute: number;
  pixelsPerMinuteExponent = 0.75; // Only for synchronizing internal exponent value between two sets of zoom buttons
  worklogs: Worklog[];
  loading: boolean;
  visibleDateRange: DateRange;
  currentUser: User;
  connectionIssueModalVisible = false;
  workingHoursStartMinutes: number;
  workingHoursEndMinutes: number;
  workingDaysStart: number;
  workingDaysEnd: number;
  visibleDaysStart: number;
  visibleDaysEnd: number;
  hideWeekend: boolean;
  refreshIntervalMinutes: number;
  theme: Theme;
  showToday: boolean;
  
  // Quick Log configuration
  quickLogNextDayMessage: string;
  quickLogProblemsMessage: string;
  quickLogNextDayEnabled: boolean;
  quickLogProblemsEnabled: boolean;
  quickLogNextDayTaskCode: string;
  quickLogProblemsTaskCode: string;
  
  // Worklog configuration
  worklogDefaultTemplate: string;

  constructor(
    private systemPreferencesService: SystemPreferencesService, // Injected service early to run its constructor
    private authFacade: AuthFacade,
    private worklogFacade: WorklogFacade,
    private appStateService: AppStateService,
    private userPreferencesService: UserPreferencesService
  ) {}

  ngOnInit(): void {
    // Singleton component, no need to unsubscribe
    this.authFacade.getAuthenticatedUser$().subscribe(user => this.currentUser = user);
    this.worklogFacade.getWorklogs$().subscribe(worklogs => this.worklogs = worklogs);
    this.worklogFacade.getWorklogsFetching$().subscribe(loading => this.loading = loading);
    this.appStateService.getConnectionIssueModalVisible$()
      .subscribe(val => this.connectionIssueModalVisible = val !== ConnectionIssueModalVisible.NONE);
    this.appStateService.getVisibleDateRange$().subscribe(dateRange => this.visibleDateRange = dateRange);
    this.userPreferencesService.getWorkingHoursStartMinutes$().subscribe(value => this.workingHoursStartMinutes = value);
    this.userPreferencesService.getWorkingHoursEndMinutes$().subscribe(value => this.workingHoursEndMinutes = value);
    this.userPreferencesService.getWorkingDaysStart$().subscribe(value => this.workingDaysStart = value);
    this.userPreferencesService.getWorkingDaysEnd$().subscribe(value => this.workingDaysEnd = value);
    this.userPreferencesService.getVisibleDaysStart$().subscribe(value => this.visibleDaysStart = value);
    this.userPreferencesService.getVisibleDaysEnd$().subscribe(value => this.visibleDaysEnd = value);
    this.userPreferencesService.getHideWeekend$().subscribe(value => this.hideWeekend = value);
    this.userPreferencesService.getRefreshIntervalMinutes$().subscribe(value => this.refreshIntervalMinutes = value);
    this.userPreferencesService.getTheme$().subscribe(value => this.theme = value);
    this.userPreferencesService.getShowToday$().subscribe(value => this.showToday = value);
    
    // Quick Log configuration subscriptions
    this.userPreferencesService.getQuickLogNextDayMessage$().subscribe(value => this.quickLogNextDayMessage = value);
    this.userPreferencesService.getQuickLogProblemsMessage$().subscribe(value => this.quickLogProblemsMessage = value);
    this.userPreferencesService.getQuickLogNextDayEnabled$().subscribe(value => this.quickLogNextDayEnabled = value);
    this.userPreferencesService.getQuickLogProblemsEnabled$().subscribe(value => this.quickLogProblemsEnabled = value);
    this.userPreferencesService.getQuickLogNextDayTaskCode$().subscribe(value => this.quickLogNextDayTaskCode = value);
    this.userPreferencesService.getQuickLogProblemsTaskCode$().subscribe(value => this.quickLogProblemsTaskCode = value);
    
    // Worklog configuration subscriptions
    this.userPreferencesService.getWorklogDefaultTemplate$().subscribe(value => this.worklogDefaultTemplate = value);
  }

  setVisibleDateRange(dateRange: DateRange): void {
    this.appStateService.setVisibleDateRange(dateRange);
  }

  refresh(): void {
    if (this.currentUser) {
      this.worklogFacade.fetchWorklogsVerbose();
    }
  }

  changeCredentials(): void {
    this.appStateService.setConnectionIssueModalVisible(ConnectionIssueModalVisible.LOGIN);
  }

  forgetAccount(): void {
    this.authFacade.logout();
  }

  setWorkingHoursStartMinutes(value: number): void {
    this.userPreferencesService.setWorkingHoursStartMinutes(value);
  }

  setWorkingHoursEndMinutes(value: number): void {
    this.userPreferencesService.setWorkingHoursEndMinutes(value);
  }

  setShowToday(value: boolean): void {
    this.userPreferencesService.setShowToday(value);
  }

  setWorkingDaysStart(value: number): void {
    this.userPreferencesService.setWorkingDaysStart(value);
  }

  setWorkingDaysEnd(value: number): void {
    this.userPreferencesService.setWorkingDaysEnd(value);
  }

  setHideWeekend(value: boolean): void {
    this.userPreferencesService.setHideWeekend(value);
  }

  setRefreshIntervalMinutes(value: number): void {
    this.userPreferencesService.setRefreshIntervalMinutes(value);
  }

  setTheme(value: Theme): void {
    this.userPreferencesService.setTheme(value);
  }

  // Quick Log configuration setters
  setQuickLogNextDayMessage(value: string): void {
    this.userPreferencesService.setQuickLogNextDayMessage(value);
  }

  setQuickLogProblemsMessage(value: string): void {
    this.userPreferencesService.setQuickLogProblemsMessage(value);
  }

  setQuickLogNextDayEnabled(value: boolean): void {
    this.userPreferencesService.setQuickLogNextDayEnabled(value);
  }

  setQuickLogProblemsEnabled(value: boolean): void {
    this.userPreferencesService.setQuickLogProblemsEnabled(value);
  }

  setQuickLogNextDayTaskCode(value: string): void {
    this.userPreferencesService.setQuickLogNextDayTaskCode(value);
  }

  setQuickLogProblemsTaskCode(value: string): void {
    this.userPreferencesService.setQuickLogProblemsTaskCode(value);
  }

  // Worklog configuration setters
  setWorklogDefaultTemplate(value: string): void {
    this.userPreferencesService.setWorklogDefaultTemplate(value);
  }
}
