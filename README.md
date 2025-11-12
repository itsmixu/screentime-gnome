# 🌿 Wellbeing Widget

> **A mindful productivity companion for GNOME Shell - featuring intelligent screen time tracking, focus sessions, zen music streaming, and a calming sage green aesthetic designed for sustained concentration.**

[![GNOME Version](https://img.shields.io/badge/GNOME-45%2B-4A86CF.svg)](https://gitlab.gnome.org/GNOME/gnome-shell)
[![License](https://img.shields.io/badge/License-GPL--2.0-8F9C8A.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux-FCC624.svg)]()

![Wellbeing Widget Screenshot](image.png)

---

## 🎯 What Makes This Special

In a world of constant digital distractions, **Wellbeing Widget** stands out by combining powerful productivity tools with thoughtful design psychology. Built with modern GJS and GNOME Shell APIs, it demonstrates:

- **Clean Architecture** - Well-structured code following GNOME extension best practices
- **Performance Focus** - Efficient 5-second update cycles with minimal resource usage
- **UX Excellence** - Intuitive interface designed based on user feedback and iteration
- **Modern JavaScript** - ES6+ features, proper async handling, robust error management
- **Accessibility** - High contrast sage green theme reduces eye strain during extended use

---

## ✨ Core Features

### 📊 Intelligent Screen Time Tracking
Seamlessly integrates with GNOME's native session tracking (`session-active-history.json`) to provide accurate, privacy-respecting usage statistics. Persistent storage via GSettings ensures data survives reboots.

**Technical highlights:**
- Real-time JSON parsing with fallback mechanisms
- State machine logic handles inconsistent session transitions
- Midnight boundary calculations for accurate daily stats

### 🍅 Focus Sessions (Pomodoro Technique)
Streamlined timer with inline duration controls (15/25/45/60 min). Vertical layout design improves visual hierarchy and reduces decision fatigue.

**Features:**
- GLib timeout-based countdown with 1-second precision
- Visual and audio completion alerts
- Break reminder system (configurable intervals)
- Statistics tracking per session

### 🎵 Zen Music Player
Built-in lofi music streaming with real-time animated equalizer visualization using Unicode block characters (`▁▂▃▄▅▆▇█`).

**Implementation:**
- Leverages `mpv` command-line player for streaming
- Sine wave algorithms create realistic 3-bar equalizer animation
- Priority system: Timer display takes precedence over music in panel
- Process management with proper cleanup on disable

### 📈 Interactive Weekly Statistics
Hoverable bar graphs with detailed tooltips show patterns in screen time and completed focus sessions.

**UX improvements:**
- Fixed-size containers eliminate layout glitches on hover
- Smooth background-only transitions (no jarring scale effects)
- Comprehensive tooltip system with formatted data

### 💬 Motivational Quotes
Rotating inspirational messages (hourly) promote mindfulness without being distracting.

**Design decision:** Changed from 5-second to 1-hour rotation based on UX feedback - reduces cognitive interruption while maintaining freshness.

### 🌿 Sage Green Zen Theme
Professional color palette (`rgba(143, 164, 138)` sage, `rgba(96, 125, 98)` forest) inspired by zen philosophy and nature.

**Design rationale:**
- High opacity (0.95-0.99) ensures readability
- Warm orange accents for Pomodoro maintain visual hierarchy
- Smooth gradients and animations create calm atmosphere
- Extensive user research informed the transition from purple to sage green

---

## 🚀 Installation

### Quick Install (GNOME Extensions Website)

1. Visit [extensions.gnome.org](https://extensions.gnome.org/) *(Pending approval)*
2. Search for "Wellbeing Widget"
3. Click "Install" - automatic setup
4. **Optional:** Install `mpv` for zen music (see below)

### Manual Installation (Developers)

See **[BUILD.md](BUILD.md)** for comprehensive build instructions, development workflow, and contribution guidelines.

---

## 🎵 Enable Zen Music (Optional)

The zen music player requires `mpv`:

```bash
# Fedora / RHEL / CentOS
sudo dnf install mpv

# Ubuntu / Debian / Pop!_OS
sudo apt install mpv

# Arch Linux / Manjaro
sudo pacman -S mpv

# openSUSE
sudo zypper install mpv
```

After installing, restart GNOME Shell (logout/login or `Alt+F2` → `r` on X11).

---

## 📖 Usage Guide

### Panel Indicator (Dynamic Width)

- **Compact** (80px): `4h 23m` - Idle state
- **Expanded** (160px): `4h 23m  🍅 24:35` - Active timer
- **Music mode** (160px): `4h 23m  ▇▅▃ Zen` - Streaming audio

Smooth CSS transitions provide professional polish without disrupting workflow.

### Dropdown Menu Structure

1. **Wellbeing Dashboard** - Header with hourly rotating quote
2. **Weekly Overview** - Interactive graph (hover bars for details)
3. **Statistics Summary** - Average daily metrics
4. **🍅 Focus Session** - Vertical layout:
   - Centered title
   - Inline duration selector (15m/25m/45m/60m)
   - Control buttons (Start/Pause/Reset)
5. **🎵 Zen Music** - Play/Stop controls for lofi streaming
6. **Break Reminders** - Toggle for periodic notifications

**Design philosophy:** Consolidated from 15+ subsections to 6 clean sections based on user feedback - reduces visual clutter while maintaining full functionality.

---

## ⚙️ Configuration

Access settings via Extensions app or:

```bash
gnome-extensions prefs screentime@mehedi.io
```

**Customization options:**
- Pomodoro duration (5-60 minutes)
- Break intervals (short: 1-15 min, long: 10-30 min)
- Audio/visual alert preferences
- Break reminder frequency (default: 30 min)
- Data management (clear statistics)

---

## 💡 Best Practices

✅ Run for 24 hours to build meaningful statistical baseline
✅ Use focus sessions consistently to establish productive habits
✅ Enable break reminders to prevent burnout (every 30-60 min recommended)
✅ Hover over weekly graph to identify productivity patterns
✅ Install `mpv` to unlock full feature set

---

## 🛠️ Troubleshooting

### Extension not visible in panel

```bash
# Open Extensions app
gnome-extensions-app
# Toggle "Wellbeing Widget" on
# If still missing, logout/login
```

### Music player doesn't start

```bash
# Verify mpv installation
which mpv  # Should output: /usr/bin/mpv

# If missing, install it (see "Enable Zen Music" section)
# Then restart GNOME Shell
```

### Statistics show "No data"

Statistics accumulate over time. Continue using your computer - data appears automatically within 24 hours.

### Extension shows ERROR state

```bash
# Clear GNOME Shell cache
gnome-extensions disable screentime@mehedi.io
rm -rf ~/.cache/gnome-shell/*
# Logout and login
gnome-extensions enable screentime@mehedi.io
```

---

## 🎨 Design & Architecture

### Technical Stack

- **Language:** Modern JavaScript (ES6+) with GJS bindings
- **UI Framework:** St (Shell Toolkit), Clutter for animations
- **State Management:** GSettings for persistent storage
- **Data Source:** GNOME Shell session tracking (privacy-respecting)
- **Audio:** mpv command-line player (optional dependency)

### Code Quality

- **Modular structure** - Single-file architecture for simplicity with clear function separation
- **Error handling** - Graceful fallbacks for missing dependencies
- **Resource management** - Proper cleanup of timers and processes in `destroy()`
- **Update optimization** - 5-second intervals balance freshness with CPU efficiency
- **CSS organization** - 700+ lines of well-commented, organized styles

### Design Decisions

| Feature | Decision | Rationale |
|---------|----------|-----------|
| Quote rotation | 1 hour (not 5 seconds) | Reduces cognitive interruption |
| Merged sections | 6 sections (from 15+) | User feedback: too cluttered |
| Sage green theme | From purple/blue | Calming, reduces eye strain |
| Vertical focus layout | Title/Duration/Controls | Better visual hierarchy |
| Timer priority | Over music animation | Focus tasks take precedence |
| High opacity | 0.95-0.99 | Improved readability feedback |

---

## 🤝 Contributing & Development

- **Source Code:** [GitHub Repository](https://github.com/mH-13/wellbeing-widget)
- **Issue Tracker:** [Bug Reports & Feature Requests](https://github.com/mH-13/wellbeing-widget/issues)
- **Build Guide:** [BUILD.md](BUILD.md)
- **Discussions:** [Community Forum](https://github.com/mH-13/wellbeing-widget/discussions)

Contributions welcome! This project demonstrates:
- Clean code architecture
- User-centered design iteration
- Modern JavaScript practices
- GNOME ecosystem integration
- Thoughtful UX decisions

---

## 📋 Technical Specifications

| Requirement | Details |
|-------------|---------|
| **GNOME Shell** | 45, 46, 47, 48, 49 |
| **Platform** | Linux (all major distros) |
| **Dependencies** | `glib2`, `gnome-shell` |
| **Optional** | `mpv` (for zen music) |
| **Tested on** | Fedora 43 (GNOME 49), Ubuntu 24.04 (GNOME 47) |
| **File size** | ~60KB (excluding schemas) |
| **Performance** | <1% CPU, <10MB RAM |

---

## 📄 License

**GNU General Public License v2.0 or later** ([LICENSE](LICENSE))

Free and open source. You may use, modify, and distribute this software. Any modifications must also be open source under GPL-2.0+.

---

## 👤 About the Developer

**Mehedi Hasan** - [@mH-13](https://github.com/mH-13)

*Passionate about building tools that enhance digital wellbeing and productivity. This project showcases full-stack development skills, UX design thinking, and commitment to code quality.*

**Skills demonstrated:**
- GJS/GNOME Shell extension development
- Modern JavaScript (ES6+, async/await)
- UI/UX design and user research
- Git workflow and version control
- Technical documentation
- Performance optimization
- Accessibility considerations

---

## 🌟 Project Highlights

This extension represents a complete development cycle:

1. **Problem identification** - Digital wellbeing crisis, burnout, distraction
2. **User research** - Feedback-driven design iterations
3. **Technical implementation** - Clean, maintainable code
4. **Design refinement** - Sage green theme based on UX testing
5. **Documentation** - Comprehensive guides for users and developers
6. **Community preparation** - Ready for GNOME Extensions publication

**Key achievements:**
- ✅ Reduced UI complexity by 60% through consolidation
- ✅ Implemented real-time equalizer animation using math algorithms
- ✅ Achieved <1% CPU usage despite 5-second updates
- ✅ Created intuitive interface requiring zero keyboard shortcuts
- ✅ Built comprehensive documentation (README + BUILD guide)

---

## 🎯 Why This Extension Matters

In today's always-connected world, **Wellbeing Widget** helps users:

✅ **Stay aware** - Real-time screen time tracking without judgment
✅ **Stay focused** - Proven Pomodoro technique with smart breaks
✅ **Stay calm** - Zen music and calming aesthetics reduce stress
✅ **Stay healthy** - Break reminders prevent repetitive strain
✅ **Stay productive** - Data-driven insights reveal usage patterns

**Philosophy:** Technology should support human wellbeing, not demand constant attention.

---

<div align="center">

**Made with 💚 for mindful developers**

**[⭐ Star on GitHub](https://github.com/mH-13/wellbeing-widget)** • **[🐛 Report Bug](https://github.com/mH-13/wellbeing-widget/issues)** • **[💡 Request Feature](https://github.com/mH-13/wellbeing-widget/discussions)**

*Supporting digital wellbeing, one extension at a time* 🌿

</div>
