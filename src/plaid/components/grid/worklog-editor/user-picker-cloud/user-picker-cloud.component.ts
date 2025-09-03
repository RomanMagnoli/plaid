import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, switchMap, tap } from 'rxjs/operators';
import { UserApi, User } from '../../../../core/user/user.api';

/**
 * Presents a dropdown for selecting users with search functionality, avatars and names.
 */
@Component({
  selector: 'plaid-user-picker-cloud',
  templateUrl: './user-picker-cloud.component.html',
  styleUrls: ['./user-picker-cloud.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserPickerCloudComponent implements OnInit {
  private _open = false;
  searchInputSubject = new Subject<string>();
  searchResults: User[] = [];
  searching = false;

  @ViewChild('searchInput', {static: true})
  searchInput: ElementRef<HTMLInputElement>;

  @Input()
  set open(open: boolean) {
    this._open = open;
    if (open) {
      setTimeout(() => this.searchInput.nativeElement.focus());
    } else {
      this.searchInput.nativeElement.value = '';
      this.searchResults = [];
    }
  }
  get open(): boolean {
    return this._open;
  }

  @Output()
  openChange = new EventEmitter<boolean>();

  @Output()
  userChange = new EventEmitter<User | null>();

  /**
   * Current selected user (for showing clear button when appropriate)
   */
  @Input()
  selectedUser: User | null = null;

  /**
   * Whether keyboard navigation should be disabled due to modal or another cloud being open.
   */
  @Input()
  keysDisabled: boolean;

  constructor(private userApi: UserApi, private cdr: ChangeDetectorRef) {
  }

  ngOnInit() {
    this.searchInputSubject.pipe(
      debounceTime(250),
      tap(() => {
        this.searching = true;
        this.cdr.detectChanges();
      }),
      switchMap(s => this.userApi.searchUsers$(s))
    ).subscribe(res => {
      this.searching = false;
      if (this.searchInput.nativeElement.value) {
        this.searchResults = res;
      }
      this.cdr.detectChanges();
    });
  }

  inputSearch(query: string): void {
    if (query) {
      this.searchInputSubject.next(query);
    } else {
      this.searching = false;
      this.searchResults = [];
    }
  }

  userSelected(user: User | null): void {
    this._open = false;
    this.openChange.emit(false);
    this.userChange.emit(user);
    this.searchResults = [];
    this.searchInput.nativeElement.value = '';
  }

  clearSelection(): void {
    this.userSelected(null);
  }

  getAvatarUrl(user: User): string {
    if (user.avatarUrls) {
      return user.avatarUrls['24x24'] || user.avatarUrls['32x32'] || user.avatarUrls['48x48'] || '';
    }
    return '';
  }

  hasAvatar(user: User): boolean {
    return !!(user.avatarUrls && (user.avatarUrls['24x24'] || user.avatarUrls['32x32'] || user.avatarUrls['48x48']));
  }
}
