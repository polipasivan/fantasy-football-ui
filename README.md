# Fantasy Football Draft Board

A modern, interactive fantasy football draft board application built with Angular 18+. This application allows users to manage their fantasy football draft with intelligent player autocomplete, position-based color coding, and real-time draft tracking.

## Features

### 🏈 Draft Board (Dashboard Component)
- **Interactive Draft Grid**: 8 teams × 15 rounds draft board with sticky headers
- **Smart Player Autocomplete**:
  - Type-ahead search from CSV player database
  - Excludes already-drafted players automatically
  - Keyboard navigation (arrow keys, Enter, Escape)
  - Clear button to reset selection
  - Must select from suggestions - no manual entry
- **Position-Based Color Coding**: Players automatically color-coded by position
  - QB → Blue
  - RB → Red
  - WR → Green
  - TE → Orange
  - DEF → Purple
  - K → Yellow
- **Position Key Legend**: Visual reference showing all position colors
- **Player Management**:
  - Add players to any draft slot
  - Remove drafted players with one click
  - Edit selections before confirming
- **Data Persistence**: Draft data saved to localStorage
- **Sticky Headers**: Both row (Round) and column (Team) headers remain visible while scrolling

### 📊 Players List Component
- **Complete Player Database**: View all players from the CSV file
- **Advanced Filtering**:
  - Filter by team (dropdown with all NFL teams)
  - Filter by position (QB, RB, WR, TE, DEF, K)
  - Clear filters button
  - Real-time results count
- **Draft Status Tracking**:
  - Drafted players highlighted in red with reduced opacity
  - Dark red text for drafted player names and ranks
  - Instantly reflects draft board changes
- **Position-Based Row Styling**: Subtle gradient backgrounds matching position colors
- **Position Badges**: Color-coded position tags in table
- **Sticky Table Headers**: Headers remain visible while scrolling player list
- **Navigation**: Quick link back to draft board

## Components

### 1. App Component (`src/app/app.component.ts`)
- Root component with router outlet
- Handles routing between Dashboard and Players views

### 2. Dashboard Component (`src/app/dashboard/`)
- **Purpose**: Main draft board interface
- **Key Features**:
  - Draft grid with 8 teams and 15 rounds
  - Player autocomplete with CSV integration
  - Position-based color coding
  - LocalStorage persistence
  - Sticky headers for navigation
- **Files**:
  - `dashboard.component.ts`: Component logic with draft management
  - `dashboard.component.html`: Template with draft table and autocomplete
  - `dashboard.component.css`: Styling with position colors and sticky positioning

### 3. Players Component (`src/app/players/`)
- **Purpose**: Full player database view with filtering
- **Key Features**:
  - Display all players from CSV
  - Team and position filters
  - Draft status highlighting
  - Position-based row coloring
  - Sticky table headers
- **Files**:
  - `players.component.ts`: Component logic with filtering and draft tracking
  - `players.component.html`: Template with filters and player table
  - `players.component.css`: Styling with drafted player highlighting

### 4. Player Service (`src/app/services/player.service.ts`)
- **Purpose**: Centralized player data management
- **Responsibilities**:
  - Load and parse CSV player data
  - Provide player list to components
  - Track drafted players via localStorage
  - Share draft state across components

## Data Structure

### Player Interface
```typescript
interface Player {
  rank: string;        // Player overall rank
  tier: string;        // Tier classification
  name: string;        // Player full name
  team: string;        // NFL team abbreviation
  position: string;    // Position (e.g., "QB1", "RB2")
  bye: string;         // Bye week number
  sos: string;         // Strength of schedule
  ecrVsAdp: string;    // ECR vs ADP comparison
}
```

### Draft Data Storage
- Stored in localStorage under key `fantasyDraft`
- Format: `{ "Team_round_1": "Player Name", ... }`
- Automatically loaded on page refresh
- Shared between Dashboard and Players components

## UI/UX Highlights

### Color Scheme
- **Primary Gradient**: Pink to Red (`#ec4899` → `#ef4444`)
- **Position Colors**: Distinct gradients for each position
- **Drafted Players**: Red gradient with reduced opacity
- **Interactive States**: Hover effects on all clickable elements

### Responsive Design
- Horizontal and vertical scrolling with sticky headers
- Flexible layout adapts to different screen sizes
- Mobile-friendly with responsive breakpoints

### Accessibility
- Clear visual hierarchy
- High contrast text
- Keyboard navigation support
- Descriptive button labels

## Technical Details

### Technologies
- **Framework**: Angular 18+ (Standalone Components)
- **Language**: TypeScript
- **Styling**: Pure CSS with gradients and transitions
- **Data Storage**: Browser localStorage
- **Data Source**: CSV file loaded via HTTP

### Key Angular Features Used
- Standalone components
- Lazy-loaded routes
- Two-way data binding with `[(ngModel)]`
- RxJS observables for async data loading
- Dynamic CSS class binding with `[ngClass]`
- Template directives (`*ngFor`, `*ngIf`)

### Architecture Patterns
- Service-based data management
- Component communication via shared service
- LocalStorage for persistence
- CSV parsing with regex for quoted values
- Position extraction with pattern matching (`/^[A-Z]+/`)

## Project Structure

```
src/app/
├── app.component.ts          # Root component
├── app.config.ts             # Application configuration
├── app.routes.ts             # Route definitions
├── dashboard/                # Draft board component
│   ├── dashboard.component.ts
│   ├── dashboard.component.html
│   └── dashboard.component.css
├── players/                  # Player list component
│   ├── players.component.ts
│   ├── players.component.html
│   └── players.component.css
└── services/
    └── player.service.ts     # Player data service

public/
└── FantasyPros_2025_data.csv # Player database
```

## Development Workflow

### Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`.

### Building

To build the project run:

```bash
ng build
```

Build artifacts will be stored in the `dist/` directory.

## Usage Guide

### Starting a Draft
1. Navigate to the home page (Dashboard)
2. Click "Add Player" in any draft slot
3. Start typing a player name
4. Use arrow keys to navigate suggestions or click to select
5. Click "Add" to confirm the selection
6. Player card appears with position-based color

### Managing Draft Picks
- **Remove Player**: Click the X button on any player card
- **Edit Selection**: Remove and add a new player
- **View All Players**: Click "View All Players" button in header

### Viewing Available Players
1. Click "View All Players" from Dashboard
2. Use team dropdown to filter by NFL team
3. Use position dropdown to filter by position
4. Drafted players appear in red
5. Click "Back to Draft" to return to draft board

### Draft Status
- Drafted players are automatically marked in red on the Players page
- Draft data persists across page refreshes
- All changes saved to browser localStorage

## Key Implementation Details

### Position Color Extraction
```typescript
// Extract base position (e.g., "RB" from "RB2")
const position = player.position.match(/^[A-Z]+/)?.[0] || '';
```

### Draft State Synchronization
- PlayerService provides `getDraftedPlayers()` method
- Returns Set of drafted player names from localStorage
- Both components check against this set for consistent UI

### CSV Parsing
- Handles quoted values with regex: `/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g`
- Cleans quotes from parsed values
- Skips empty lines and validates data

## Future Enhancements
- Export draft results to CSV/PDF
- Import draft data from file
- Undo/redo functionality
- Draft timer and pick notifications
- Multiple draft board support
- Player statistics integration
- Draft analysis and recommendations

## Additional Resources

For more information on using the Angular CLI, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
