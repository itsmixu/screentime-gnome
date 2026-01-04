# Screen Time Widget

A clean and minimal screen time tracker for GNOME Shell. Displays your daily screen time in the top bar with a weekly statistics overview.

> **Note:** This is a simplified fork of the [original Wellbeing Widget](https://github.com/mH-13/wellbeing-widget). The original project includes many additional features like pomodoro timer, zen music player, motivational quotes, and more.

[![GNOME Version](https://img.shields.io/badge/GNOME-45%2B-4A86CF.svg)](https://gitlab.gnome.org/GNOME/gnome-shell)
[![License](https://img.shields.io/badge/License-GPL--2.0-8F9C8A.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux-FCC624.svg)]()

## Features

- Real-time screen time tracking (updates every 5 seconds)
- Weekly statistics with interactive bar graph
- System theme integration (light/dark mode support)
- Privacy-respecting (uses GNOME's native session tracking)

## Installation

1. Clone this repository:
```bash
git clone https://github.com/itsmixu/screentime-gnome.git
cd screentime-gnome
```

2. Run the installation script:
```bash
chmod +x install.sh
./install.sh
```

3. Enable the extension:
```bash
gnome-extensions enable screentime-simple@local
```

4. Restart GNOME Shell (logout/login or `Alt+F2` → `r` on X11)

## Usage

The extension displays your daily screen time in the top bar (e.g., `4h 23m`). Click it to view:
- Weekly overview with interactive bar graph
- Average screen time statistics
- Settings

## Configuration

Access settings via Extensions app or:
```bash
gnome-extensions prefs screentime-simple@local
```

## Requirements

- GNOME Shell 45+
- Linux (all major distributions)

## Contributing

- **Source Code:** [This Fork](https://github.com/itsmixu/screentime-gnome)
- **Original Project:** [Wellbeing Widget](https://github.com/mH-13/wellbeing-widget)

## License

**GNU General Public License v2.0 or later** ([LICENSE](LICENSE))

## About

This is a simplified fork of the [Wellbeing Widget](https://github.com/mH-13/wellbeing-widget) by [Mehedi Hasan](https://github.com/mH-13).

The original project includes many additional features like pomodoro timer, zen music player, motivational quotes, and vibrant styling. This fork focuses solely on screen time tracking with a clean, minimal design.

---

<div align="center">

**[Star This Fork](https://github.com/itsmixu/screentime-gnome)** • **[Original Project](https://github.com/mH-13/wellbeing-widget)** • **[Report Bug](https://github.com/itsmixu/screentime-gnome/issues)**

*Simple screen time tracking for GNOME*

</div>
