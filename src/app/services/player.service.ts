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
    return this.http.get('FantasyPros_2026_Draft_ALL_Rankings.csv', { responseType: 'text' })
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

  private parseCSV(csv: string): Player[] {
    const lines = csv.split('\n');
    const players: Player[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handling quoted values)
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      // Require at least the core columns (rank .. bye week)
      if (!matches || matches.length < 6) continue;

      const cleanValue = (val: string | undefined) =>
        (val ?? '').replace(/^"(.*)"$/, '$1').trim();

      // 2026 schema columns:
      // 0 RK | 1 TIERS | 2 PLAYER NAME | 3 TEAM | 4 POS | 5 BYE WEEK
      // 6 UPSIDE | 7 BUST | 8 SOS SEASON | 9 ECR VS. ADP
      players.push({
        rank: cleanValue(matches[0]),
        tier: cleanValue(matches[1]),
        name: cleanValue(matches[2]),
        team: cleanValue(matches[3]),
        position: cleanValue(matches[4]),
        bye: cleanValue(matches[5]),
        sos: cleanValue(matches[8]),
        ecrVsAdp: cleanValue(matches[9])
      });
    }

    return players;
  }
}
