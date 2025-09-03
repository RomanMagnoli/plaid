import {Injectable} from '@angular/core';
import {Observable, of, zip} from 'rxjs';
import {Issue} from '../../model/issue';
import {IssueApi} from './issue.api';
import {map, switchMap, tap} from 'rxjs/operators';
import {IssueState} from './issue.state';
import {AuthFacade} from '../auth/auth.facade';
import {UserPreferencesService} from '../user-preferences.service';
import {FavoriteKeys} from '../../model/favorite-keys';

@Injectable({ providedIn: 'root' })
export class IssueFacade {
  private favoriteKeys: FavoriteKeys;
  private favorites: Issue[];
  private suggestions: Issue[];

  private static stripSpecialChars(s: string): string {
  // Replace a set of known special characters with space to create a safer search string
  const specials = '+.,;?|*/%^$#@[]"\'`';
  return s.split('').map(ch => specials.includes(ch) ? ' ' : ch).join('').trim();
  }

  private static canPotentiallyBeIssueKey(maybeKey: string): boolean {
  // Use \w and \d for concise character classes
  return /^[A-Za-z]\w*-[1-9]\d*$/.test(maybeKey);
  }

  private setFavoriteAttribute(issues: Issue[]): Issue[] {
    return issues.map(issue => {
      const keys: string[] = this.favoriteKeys[this.authFacade.getJiraURL()] || [];
  issue._favorite = !!issue.key && keys.includes(issue.key as string);
      return issue;
    });
  }

  private getSuggestionsFromApi$(assignee?: string): Observable<Issue[]> {
    if (assignee && assignee.trim() !== '') {
      // For a specific assignee, return issues assigned to that user (excluding Done/Closed)
      const jql = `assignee = "${assignee}" and status not in (Done, Closed) order by updatedDate desc`;
      console.debug('[IssueFacade] getSuggestionsFromApi$ - assignee:', assignee, 'jql:', jql);
      return this.issueApi
        .search$(jql).pipe(
          map(res => res.issues || [])
        );
    }

    // No assignee specified: suggestions based on current user activity
    const jqlCurrent = `(status changed by currentUser() OR creator = currentUser()) AND assignee = currentUser() and status not in (Done, Closed) order by updatedDate desc`;
    console.debug('[IssueFacade] getSuggestionsFromApi$ - current user jql:', jqlCurrent);
    return this.issueApi
      .search$(jqlCurrent).pipe(
        map(res => res.issues || [])
      );
  }

  private getFavoritesFromApi$(): Observable<Issue[]> {
    const keys: string[] = this.favoriteKeys[this.authFacade.getJiraURL()] || [];
    if (!keys || keys.length === 0) {
      console.debug('[IssueFacade] getFavoritesFromApi$ - no favorite keys, returning empty array');
      return of([]);
    }
    const removedKeysIndexes: number[] = [];
    return zip(...keys.map(key => this.issueApi.getIssue$(key))).pipe(
      map(issues => this.setFavoriteAttribute(issues.filter((issue: Issue | null, index: number) => {
        if (issue) {
          return true;
        } else {
          removedKeysIndexes.push(index);
          return false;
        }
      }) as Issue[])),
      tap(() => {
        this.favoriteKeys[this.authFacade.getJiraURL()] =
          keys.filter((key: string, index: number) => !removedKeysIndexes.includes(index));
        this.userPrefsService.setFavoriteKeys(this.favoriteKeys);
      })
    );
  }

  constructor(
    private issueApi: IssueApi,
    private issueState: IssueState,
    private authFacade: AuthFacade,
    private userPrefsService: UserPreferencesService
  ) {
    this.userPrefsService.getFavoriteKeys$().subscribe(keys => this.favoriteKeys = keys);
    this.issueState.getFavorites$().subscribe(favorites => this.favorites = favorites);
    this.issueState.getSuggestions$().subscribe(suggestions => this.suggestions = suggestions);
    // Prefetch favorites and suggestions after login and reset suggestions and favorites after logout
    this.authFacade.getAuthenticatedUser$().pipe(switchMap(user => user ? this.getSuggestionsFromApi$() : of([])))
      .subscribe(suggestions => this.issueState.setSuggestions(suggestions));
    this.authFacade.getAuthenticatedUser$().pipe(switchMap(user => user ? this.getFavoritesFromApi$() : of([])))
      .subscribe(favorites => this.issueState.setFavorites(favorites));
  }

  quickSearch$(query: string, assignee?: string): Observable<Issue[]> {
    if (IssueFacade.stripSpecialChars(query)) {
      if (IssueFacade.canPotentiallyBeIssueKey(query)) {
        return zip(
          this.issueApi.getIssue$(query),
          this.issueApi.search$('text ~ "' + IssueFacade.stripSpecialChars(query) + '"' + (assignee ? ' AND assignee = "' + assignee + '"' : ''))
        ).pipe(
          map(([issue, searchResults]) =>
            this.setFavoriteAttribute((issue ? [issue] : []).concat(searchResults.issues || [])))
        );
      } else {
        const jqlQuery = 'text ~ "' + IssueFacade.stripSpecialChars(query) + '"' + (assignee ? ' AND assignee = "' + assignee + '"' : '');
        return this.issueApi.search$(jqlQuery).pipe(
          map(res => this.setFavoriteAttribute(res.issues || []))
        );
      }
    } else {
      return of([]);
    }
  }

  fetchFavoritesAndSuggestions(assignee?: string): void {
    // Fetch favorites first so UI can show them immediately, then suggestions
    console.debug('[IssueFacade] fetchFavoritesAndSuggestions - assignee:', assignee);
    this.getFavoritesFromApi$().subscribe(favorites => {
      console.debug('[IssueFacade] fetched favorites count =', (favorites || []).length);
      this.issueState.setFavorites(favorites);
      // Now fetch suggestions
      this.getSuggestionsFromApi$(assignee).subscribe(suggestions => {
        console.debug('[IssueFacade] fetched suggestions count =', (suggestions || []).length);
        this.issueState.setSuggestions(suggestions);
      });
    });
  }

  getFavorites$(): Observable<Issue[]> {
    return this.issueState.getFavorites$();
  }

  getSuggestions$(): Observable<Issue[]> {
    return this.issueState.getSuggestions$().pipe(map(issues => this.setFavoriteAttribute(issues)));
  }

  addFavorite(issue: Issue): void {
    const keys: string[] = this.favoriteKeys[this.authFacade.getJiraURL()] || [];
    const key = issue.key;
    if (!key) {
      return;
    }
    if (!keys.includes(key)) {
      keys.push(key);
      this.favoriteKeys[this.authFacade.getJiraURL()] = keys;
      this.userPrefsService.setFavoriteKeys(this.favoriteKeys);
    }
    if (!this.favorites.find(favorite => favorite.key === issue.key)) {
      this.favorites.push(issue);
      this.issueState.setFavorites(this.favorites);
      this.issueState.setSuggestions(this.setFavoriteAttribute(this.suggestions));
    }
  }

  removeFavorite(issue: Issue): void {
    let keys: string[] = this.favoriteKeys[this.authFacade.getJiraURL()] || [];
    const key = issue.key;
    if (!key) {
      return;
    }
    if (keys.includes(key)) {
      keys = keys.filter(k => k !== key);
      this.favoriteKeys[this.authFacade.getJiraURL()] = keys;
      this.userPrefsService.setFavoriteKeys(this.favoriteKeys);
    }
    if (this.favorites.find(favorite => favorite.key === issue.key)) {
      this.favorites = this.favorites.filter(favorite => favorite.key !== issue.key);
      this.issueState.setFavorites(this.favorites);
    }
  }
}
