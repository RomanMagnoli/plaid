import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface User {
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
  avatarUrls?: {
    '16x16'?: string;
    '24x24'?: string;
    '32x32'?: string;
    '48x48'?: string;
  };
  name?: string; // for older Jira versions
}

@Injectable({ providedIn: 'root' })
export class UserApi {
  private readonly searchUsersUrl = '/rest/api/3/user/search';

  constructor(private http: HttpClient) { }

  searchUsers$(query: string, maxResults: number = 20): Observable<User[]> {
    if (!query || query.trim().length < 2) {
      return of([]);
    }

    const params = {
      query: query.trim(),
      maxResults: maxResults.toString()
    };

    return this.http.get<User[]>(this.searchUsersUrl, { params }).pipe(
      catchError(() => of([]))
    );
  }

  getCurrentUser$(): Observable<User | null> {
    return this.http.get<User>('/rest/api/3/myself').pipe(
      catchError(() => of(null))
    );
  }
}
