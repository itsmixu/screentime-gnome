# Screen Time Widget

A simplified fork of the Wellbeing Widget focused exclusively on screen time tracking for GNOME Shell. This version removes the pomodoro timer, music player, and motivational quotes, providing a clean and minimal screen time tracking experience with system theme styling.

> **Note:** This is a fork of the [original Wellbeing Widget](https://github.com/mH-13/wellbeing-widget). The original includes additional features like pomodoro timer, zen music player, and more. This fork simplifies the extension to focus solely on screen time tracking.

## What This Fork Changes

- ✅ **Simplified to screen time only** - Removed pomodoro timer, music player, and motivational quotes
- ✅ **System theme styling** - Uses GNOME's native theme colors instead of custom vibrant styling
- ✅ **Cleaner UI** - Simplified menu with just screen time statistics and weekly overview
- ✅ **New extension UUID** - Uses `screentime-simple@local` to avoid conflicts with the original

[![GNOME Version](https://img.shields.io/badge/GNOME-45%2B-4A86CF.svg)](https://gitlab.gnome.org/GNOME/gnome-shell)
[![License](https://img.shields.io/badge/License-GPL--2.0-8F9C8A.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux-FCC624.svg)]()

![Wellbeing Widget Screenshot](image.png)


## Features

### Screen Time Tracking
Integrates with GNOME's native session tracking to provide accurate, privacy-respecting usage statistics. Data persists across reboots through GSettings storage.

- Real-time tracking with 5-second update intervals
- Color-coded weekly history (green to red based on usage)
- Efficient calculation: only updates current day, historical data cached
- Automatic midnight transitions

### Focus Sessions (Pomodoro Timer)
Streamlined timer with inline duration controls (15/25/45/60 minutes). Visual progress bar and audio alerts help maintain focus.

- One-second precision countdown
- Visual and audio completion notifications
- Break reminder system (configurable)
- Session statistics tracking

### Zen Music Player
Built-in lofi music streaming with animated equalizer visualization. Requires `mpv` player (optional dependency).

- Real-time 3-bar equalizer animation
- Process management with proper cleanup
- Priority system: timer display takes precedence in panel

### Interactive Statistics
Hoverable bar graphs display weekly patterns with detailed tooltips showing date, time, and completed sessions.

- Smooth fade animations
- Color-coded bars by usage level
- No layout glitches or jarring transitions

### Vibrant Sage Theme
Professional color palette with energetic yellow/orange gradients and calming sage green accents, designed for visual clarity and motivation.

- High contrast for readability
- Dynamic color-coded status indicators (yellow to red based on usage)
- Smooth gradients and animations with GPU acceleration


## Installation

### Manual Installation

1. Clone or download this repository:
```bash
git clone https://github.com/itsmixu/screentime-gnome.git
cd screentime-gnome
```

2. Run the installation script:
```bash
chmod +x install.sh
./install.sh
```

3. Restart GNOME Shell:
   - **X11:** Press `Alt+F2`, type `r`, press Enter
   - **Wayland:** Log out and log back in

4. Enable the extension:
```bash
gnome-extensions enable screentime-simple@local
```

See [BUILD.md](BUILD.md) for development setup and build instructions.


## Usage

### Panel Indicator

The extension displays your daily screen time in the top bar:
- Format: `Xh Ym` (e.g., `4h 23m`)
- Updates every 5 seconds
- Shows current day's screen time

### Dropdown Menu

Click the screen time indicator to open the menu:

1. **Weekly Overview** - Header showing "Weekly Overview" and average screen time
2. **Interactive Graph** - Bar chart showing screen time for the past 7 days
   - Hover over bars to see detailed information
   - Bars use grayscale colors (white = high usage, darker = less usage)
3. **Settings** - Access extension preferences

## Configuration

Access settings via Extensions app or:

```bash
gnome-extensions prefs screentime-simple@local
```

**Available options:**
- Data management (clear statistics)

## Troubleshooting

### Extension not visible in panel

```bash
gnome-extensions-app  # Toggle "Screen Time Widget" on
# If still missing, logout/login
```

### Statistics show "No data"

Statistics accumulate over time. Continue using your computer - data appears automatically within 24 hours.

### Extension shows ERROR state

```bash
gnome-extensions disable screentime-simple@local
rm -rf ~/.cache/gnome-shell/*
# Logout and login
gnome-extensions enable screentime-simple@local
```

## Technical Details

### Stack

- **Language:** Modern JavaScript (ES6+) with GJS bindings
- **UI Framework:** St (Shell Toolkit), Clutter for animations
- **State Management:** GSettings for persistent storage
- **Data Source:** GNOME Shell session tracking (privacy-respecting)

### Architecture

- Modular single-file structure with clear function separation
- Graceful error handling with fallbacks for missing dependencies
- Proper resource cleanup in `destroy()` method
- 5-second update intervals balance freshness with CPU efficiency
- 100% async file operations (no shell blocking)

### Performance

| Metric | Value |
|--------|-------|
| **CPU Usage** | <1% |
| **Memory** | <10MB |
| **Update Interval** | 5 seconds |
| **File Size** | ~60KB |
| **Historical Data** | 85% faster calculation |


## Requirements

| Requirement | Details |
|-------------|---------|
| **GNOME Shell** | 45, 46, 47, 48, 49 |
| **Platform** | Linux (all major distributions) |
| **Dependencies** | `glib2`, `gnome-shell` |
| **Tested on** | Fedora 43 (GNOME 49), Ubuntu 24.04 (GNOME 47) |


## Contributing

- **Source Code:** [This Fork](https://github.com/itsmixu/screentime-gnome)
- **Original Project:** [Wellbeing Widget](https://github.com/mH-13/wellbeing-widget) (includes pomodoro timer, music player, and more features)
- **Issue Tracker:** [Bug Reports & Feature Requests](https://github.com/itsmixu/screentime-gnome/issues)
- **Build Guide:** [BUILD.md](BUILD.md)

Contributions welcome! This fork focuses on simplicity and minimal design.


## License

**GNU General Public License v2.0 or later** ([LICENSE](LICENSE))

Free and open source. You may use, modify, and distribute this software. Any modifications must also be open source under GPL-2.0+.


## About

This is a simplified fork of the [Wellbeing Widget](https://github.com/mH-13/wellbeing-widget) by [Mehedi Hasan](https://github.com/mH-13). 

The original project includes many additional features like pomodoro timer, zen music player, motivational quotes, and vibrant styling. This fork strips those features to focus solely on screen time tracking with a clean, minimal design that integrates seamlessly with GNOME's system theme.

---

<div align="center">

**[Star This Fork](https://github.com/itsmixu/screentime-gnome)** • **[Original Project](https://github.com/mH-13/wellbeing-widget)** • **[Report Bug](https://github.com/itsmixu/screentime-gnome/issues)**

*Simple screen time tracking for GNOME*

</div>
