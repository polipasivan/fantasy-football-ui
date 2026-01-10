import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Player {
  rank: string;
  tier: string;
  name: string;
  team: string;
  position: string;
  bye: string;
  sos: string;
  ecrVsAdp: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlayerService {
  private players: Player[] = [];

  constructor(private http: HttpClient) { }

  loadPlayers(): Observable<Player[]> {
    return this.http.get('FantasyPros_2025_data.csv', { responseType: 'text' })
      .pipe(
        map(csv => {
          this.players = this.parseCSV(csv);
          return this.players;
        })
      );
  }

  getPlayers(): Player[] {
    return this.players;
  }

  getDraftedPlayers(): Set<string> {
    const stored = localStorage.getItem('fantasyDraft');
    if (!stored) return new Set();

    const draftData = JSON.parse(stored);
    return new Set(Object.values(draftData));
  }

  private parseCSV(csv: string): Player[] {
    const lines = csv.split('\n');
    const players: Player[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handling quoted values)
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!matches || matches.length < 8) continue;

      const cleanValue = (val: string) => val.replace(/^"(.*)"$/, '$1').trim();

      players.push({
        rank: cleanValue(matches[0]),
        tier: cleanValue(matches[1]),
        name: cleanValue(matches[2]),
        team: cleanValue(matches[3]),
        position: cleanValue(matches[4]),
        bye: cleanValue(matches[5]),
        sos: cleanValue(matches[6]),
        ecrVsAdp: cleanValue(matches[7])
      });
    }

    return players;
  }
}
