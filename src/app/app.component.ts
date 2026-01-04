import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface DraftData {
  [key: string]: string;
}

interface ExportEntry {
  team: string;
  round: number;
  player: string;
  timestamp: string;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})


export class AppComponent implements OnInit {
  teams: string[] = [
    'Team Alpha', 'Team Bravo', 'Team Charlie', 'Team Delta',
    'Team Echo', 'Team Foxtrot', 'Team Golf', 'Team Hotel'
  ];
  
  rounds: number = 15;
  roundNumbers: number[] = [];
  draftData: DraftData = {};
  editingCell: string | null = null;
  playerName: string = '';

  ngOnInit(): void {
    console.log("IM ALIVE!")
    this.roundNumbers = Array.from({ length: this.rounds }, (_, i) => i + 1);
    this.loadData();
  }

  getCellKey(team: string, round: number): string {
    console.log(`${team}_round_${round}`)
    return `${team}_round_${round}`;
  }

  getPlayer(team: string, round: number): string | undefined {
    return this.draftData[this.getCellKey(team, round)];
  }

  isEditing(team: string, round: number): boolean {
    return this.editingCell === this.getCellKey(team, round);
  }

  startEditing(team: string, round: number): void {
    this.editingCell = this.getCellKey(team, round);
    this.playerName = '';
  }

  addPlayer(team: string, round: number): void {
    if (this.playerName.trim()) {
      const key = this.getCellKey(team, round);
      this.draftData[key] = this.playerName.trim();
      this.playerName = '';
      this.editingCell = null;
      this.saveData();
    }
  }

  removePlayer(team: string, round: number): void {
    const key = this.getCellKey(team, round);
    delete this.draftData[key];
    this.saveData();
  }

  cancelEditing(): void {
    this.editingCell = null;
    this.playerName = '';
  }

  onKeyPress(event: KeyboardEvent, team: string, round: number): void {
    if (event.key === 'Enter') {
      this.addPlayer(team, round);
    }
  }

  exportData(): void {
    const exports: { [key: string]: ExportEntry } = {};
    
    this.teams.forEach(team => {
      for (let round = 1; round <= this.rounds; round++) {
        const key = this.getCellKey(team, round);
        if (this.draftData[key]) {
          exports[key] = {
            team,
            round,
            player: this.draftData[key],
            timestamp: new Date().toISOString()
          };
        }
      }
    });
    
    const blob = new Blob([JSON.stringify(exports, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fantasy-draft-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          const newData: DraftData = {};
          
          Object.values(imported).forEach((entry: any) => {
            const key = this.getCellKey(entry.team, entry.round);
            newData[key] = entry.player;
          });
          
          this.draftData = newData;
          this.saveData();
        } catch (error) {
          alert('Error importing file');
        }
      };
      reader.readAsText(file);
    }
    
    // Reset input
    input.value = '';
  }

  private saveData(): void {
    localStorage.setItem('fantasyDraft', JSON.stringify(this.draftData));
  }

  private loadData(): void {
    const stored = localStorage.getItem('fantasyDraft');
    if (stored) {
      this.draftData = JSON.parse(stored);
    }
  }
}
