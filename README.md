# 🌿 Wellbeing Widget

> **A mindful productivity companion for GNOME Shell that helps you stay focused, track screen time, and maintain healthy work habits with a beautiful zen-inspired interface.**

[![GNOME Version](https://img.shields.io/badge/GNOME-45%2B-4A86CF.svg)](https://gitlab.gnome.org/GNOME/gnome-shell)
[![License](https://img.shields.io/badge/License-GPL--2.0-8F9C8A.svg)](LICENSE)

![Wellbeing Widget Screenshot](image.png)

---

## ✨ Features at a Glance

🌿 **Smart Screen Time Tracking** - Accurate daily usage stats integrated with GNOME session
🍅 **Focus Sessions** - Customizable Pomodoro timer (15/25/45/60 min)
🎵 **Zen Music Player** - Built-in lofi streaming with animated equalizer
📈 **Interactive Statistics** - Weekly overview with hoverable graphs
💬 **Mindful Quotes** - Hourly rotating motivational messages
🎨 **Sage Green Theme** - Calming design inspired by zen philosophy

---

## 🚀 Installation

### From GNOME Extensions Website (Recommended)

1. Visit [extensions.gnome.org](https://extensions.gnome.org/) *(Coming soon)*
2. Search for "Wellbeing Widget"
3. Click "Install" - the extension will download and install automatically
4. Enable it from the Extensions app
5. **Optional**: Install `mpv` for zen music feature (see below)

### For Developers/Contributors

Want to build from source or contribute? See **[BUILD.md](BUILD.md)** for detailed instructions.

---

## 🎵 Enable Zen Music (Optional)

The zen music feature requires the `mpv` media player. Install it using your package manager:

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

After installing `mpv`, restart GNOME Shell (logout/login or `Alt+F2` → type `r` on X11), and the zen music feature will work automatically.

---

## 📖 How to Use

### Panel Indicator

The widget appears in your top panel:

- **Default**: Shows screen time (e.g., `4h 23m`)
- **Focus mode**: Shows timer status (e.g., `4h 23m  🍅 24:35`)
- **Music playing**: Shows animated equalizer (e.g., `4h 23m  ▇▅▃ Zen`)

### Dropdown Menu

Click the panel indicator to open the menu:

1. **Wellbeing Dashboard** - Motivational quote (changes hourly)
2. **Weekly Overview** - Interactive bar graph (hover for details)
3. **Average Summary** - Your weekly statistics
4. **🍅 Focus Session** - Select duration → Start/Pause/Reset timer
5. **🎵 Zen Music** - Play/Stop lofi radio for concentration
6. **Break Reminders** - Toggle periodic break notifications

---

## ⚙️ Settings

Right-click the extension in GNOME Extensions app → click "Settings" icon, or run:

```bash
gnome-extensions prefs screentime@mehedi.io
```

**Available Options:**
- Pomodoro duration (5-60 minutes)
- Short break (1-15 min) / Long break (10-30 min)
- Sound and visual alerts
- Break reminder interval
- Clear statistics data

---

## 💡 Tips for Best Experience

✅ Let the extension run for 24 hours to see meaningful statistics
✅ Use focus sessions regularly to build productive habits
✅ Enable break reminders to avoid burnout
✅ Hover over weekly graph bars to see detailed daily stats
✅ Install `mpv` to unlock the zen music feature

---

## 🛠️ Troubleshooting

### Extension doesn't appear in panel

1. Open **Extensions** app (or run `gnome-extensions-app`)
2. Find "Wellbeing Widget" and toggle it on
3. If still not visible, logout and login again

### Music doesn't work

- Check if `mpv` is installed: run `which mpv` in terminal
- If not installed, install it using your package manager (see [Enable Zen Music](#-enable-zen-music-optional))
- Restart GNOME Shell after installing `mpv`

### Statistics showing "No data"

Statistics build up over time. Use your computer throughout the day and the data will appear automatically.

### Extension shows ERROR

```bash
# Clear cache and restart
gnome-extensions disable screentime@mehedi.io
rm -rf ~/.cache/gnome-shell/*
# Logout and login
gnome-extensions enable screentime@mehedi.io
```

---

## 🎨 Design Philosophy

Wellbeing Widget follows principles of calm technology:

- **Sage Green Palette**: Natural colors reduce eye strain
- **Minimal Distractions**: Clean, consolidated interface
- **Smooth Animations**: Subtle, non-intrusive movements
- **High Readability**: Excellent contrast for extended use

The goal is to support your wellbeing, not demand your attention.

---

## 🤝 Contributing & Support

- **Bug Reports**: [GitHub Issues](https://github.com/mH-13/wellbeing-widget/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/mH-13/wellbeing-widget/discussions)
- **Source Code**: [GitHub Repository](https://github.com/mH-13/wellbeing-widget)
- **Build Instructions**: [BUILD.md](BUILD.md)

Contributions welcome! See [BUILD.md](BUILD.md) for development setup.

---

## 📋 System Requirements

- **GNOME Shell**: Version 45 or higher
- **Operating System**: Linux (Fedora, Ubuntu, Arch, etc.)
- **Optional**: `mpv` player (for zen music feature)
- **Tested on**: Fedora 43 (GNOME 49), Ubuntu 24.04 (GNOME 47)

---

## 📄 License

GNU General Public License v2.0 or later ([LICENSE](LICENSE))

Free to use, modify, and distribute. Modifications must also be open source.

---

## 👤 Author

**Mehedi Hasan** - [@mH-13](https://github.com/mH-13)

*Building tools for mindful productivity and digital wellbeing.*

---

## 🌟 Why This Extension?

In an always-connected world, **Wellbeing Widget** helps you:

✅ Stay aware of screen time patterns
✅ Structure work with proven focus techniques
✅ Take regular breaks for better health
✅ Create a calmer computing experience
✅ Track and improve productivity over time

**Stay mindful. Stay productive. Stay healthy.** 🌿

---

<div align="center">

Made with 💚 for mindful developers

**[Report Bug](https://github.com/mH-13/wellbeing-widget/issues)** • **[Request Feature](https://github.com/mH-13/wellbeing-widget/discussions)** • **[View Source](https://github.com/mH-13/wellbeing-widget)**

</div>
