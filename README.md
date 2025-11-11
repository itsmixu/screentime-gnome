# 🌿 Wellbeing Widget for GNOME Shell

A beautiful, zen-style screen time tracker and Pomodoro timer for GNOME 49+. Stay mindful of your screen time and maintain healthy work habits with gentle break reminders and focus sessions.

![GNOME Version](https://img.shields.io/badge/GNOME-49+-blue.svg)
![License](https://img.shields.io/badge/license-GPL--2.0-green.svg)

## ✨ Features

### 📊 Screen Time Tracking
- **Live screen time display** in the top panel
- Real-time updates every 5 seconds
- Daily usage statistics
- Beautiful pastel/zen UI with soft gradients

### 🍅 Built-in Pomodoro Timer
- 25-minute focus sessions
- Start, pause, and reset controls
- Visual countdown in panel
- Completion notifications
- Customizable duration (coming soon)

### 🔔 Wellbeing Reminders
- Automatic break reminders every 30 minutes
- Toggle reminders on/off
- Gentle notifications to rest your eyes
- Encourages healthy work habits

### 🎨 Beautiful Design
- Clean Adwaita-style interface
- Soft pastel color scheme (mint green & sky blue)
- Smooth animations and transitions
- Minimalist, distraction-free UI

### ⚙️ Customizable Settings
- Configure break reminder intervals
- Adjust Pomodoro duration
- Toggle panel visibility
- GSettings schema support

## 📸 Screenshots

*(Screenshots will be added here)*

## 🚀 Installation

### Method 1: Manual Installation (Current)

1. **Ensure the extension files are in place:**
   ```bash
   cd ~/.local/share/gnome-shell/extensions/screentime@mehedi.io/
   ls -la
   ```

2. **Compile the GSettings schema:**
   ```bash
   cd ~/.local/share/gnome-shell/extensions/screentime@mehedi.io/
   glib-compile-schemas schemas/
   ```

3. **Clear GNOME Shell cache:**
   ```bash
   rm -rf ~/.cache/gnome-shell/*
   ```

4. **Log out and log back in** (or restart GNOME Shell)
   - On **X11**: Press `Alt+F2`, type `r`, and press Enter
   - On **Wayland**: You need to log out and log back in

5. **Enable the extension:**
   ```bash
   gnome-extensions enable screentime@mehedi.io
   ```

6. **Verify it's working:**
   ```bash
   gnome-extensions info screentime@mehedi.io
   ```
   - State should show: `ENABLED` (not ERROR)

### Method 2: From GitHub

```bash
# Clone the repository
git clone https://github.com/mH-13/wellbeing-widget.git

# Navigate to the extension directory
cd wellbeing-widget

# Run the installation script
./install.sh

# Log out and log back in
# Then enable the extension
gnome-extensions enable screentime@mehedi.io
```

## 🎯 Usage

### Panel Indicator
The extension adds a colorful indicator to your GNOME top panel showing:
- ☀️ Current screen time (e.g., "5.2h")
- ⏱ Pomodoro status (⏸ when paused, countdown when running)

### Dropdown Menu
Click the panel indicator to open the wellbeing center with:

1. **🌿 Wellbeing Center** - Header
2. **📊 Daily Screen Time** - Your total screen usage today
3. **🍅 Pomodoro** - Current timer status
4. **Control Buttons:**
   - ▶ Start Pomodoro
   - ⏸ Pause
   - 🔁 Reset
5. **🔔 Break Reminders** - Toggle switch for automatic reminders

### Keyboard Shortcuts
*(Coming soon - custom keybindings for quick access)*

## 🔧 Configuration

### Using GSettings (Command Line)

```bash
# Enable/disable break reminders
gsettings set org.gnome.shell.extensions.wellbeing break-reminders true

# Set Pomodoro duration (minutes)
gsettings set org.gnome.shell.extensions.wellbeing pomodoro-duration 25

# Set break reminder interval (minutes)
gsettings set org.gnome.shell.extensions.wellbeing break-interval 30

# Show/hide panel icon
gsettings set org.gnome.shell.extensions.wellbeing show-panel-icon true
```

### Using GNOME Extensions App
*(Settings UI coming in future version)*

## 🛠️ Development

### Project Structure
```
screentime@mehedi.io/
├── extension.js              # Main extension logic
├── metadata.json             # Extension metadata
├── stylesheet.css            # Custom styling
├── schemas/                  # GSettings schemas
│   ├── org.gnome.shell.extensions.wellbeing.gschema.xml
│   └── gschemas.compiled
└── README.md                 # This file
```

### Building from Source

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mH-13/wellbeing-widget.git
   cd wellbeing-widget
   ```

2. **Install to local extensions directory:**
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions/screentime@mehedi.io/
   cp -r * ~/.local/share/gnome-shell/extensions/screentime@mehedi.io/
   ```

3. **Compile schemas:**
   ```bash
   cd ~/.local/share/gnome-shell/extensions/screentime@mehedi.io/
   glib-compile-schemas schemas/
   ```

4. **Reload GNOME Shell** and enable the extension

### Debugging

View extension logs:
```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -i "wellbeing\|screentime"
```

Check extension status:
```bash
gnome-extensions info screentime@mehedi.io
```

## 🐛 Troubleshooting

### Extension shows ERROR state

**Problem:** Extension is enabled but shows ERROR state

**Solution:**
```bash
# 1. Disable the extension
gnome-extensions disable screentime@mehedi.io

# 2. Clear all GNOME Shell caches
rm -rf ~/.cache/gnome-shell/*

# 3. Log out and log back in (required for Wayland)
# Or restart GNOME Shell on X11: Alt+F2, type 'r', press Enter

# 4. Re-enable the extension
gnome-extensions enable screentime@mehedi.io
```

### Extension doesn't appear in panel

**Check if it's enabled:**
```bash
gnome-extensions list --enabled | grep screentime
```

**If not listed, enable it:**
```bash
gnome-extensions enable screentime@mehedi.io
```

### Notifications not showing

- Check if break reminders are enabled in the dropdown menu
- Verify GNOME notifications are not in Do Not Disturb mode
- Check notification permissions in GNOME Settings

### Schema compilation errors

```bash
cd ~/.local/share/gnome-shell/extensions/screentime@mehedi.io/
glib-compile-schemas schemas/
```

If errors persist, check the schema XML syntax in `schemas/org.gnome.shell.extensions.wellbeing.gschema.xml`

## 📋 Roadmap

- [ ] **v1.1** - Real screen time tracking (integrate with system APIs)
- [ ] **v1.2** - Custom Pomodoro durations
- [ ] **v1.3** - Statistics graph and weekly reports
- [ ] **v1.4** - Application usage breakdown
- [ ] **v1.5** - Focus mode (block distracting apps)
- [ ] **v2.0** - Preferences UI (GTK4 settings dialog)
- [ ] Integration with GNOME's native wellbeing features
- [ ] Export usage data to CSV/JSON
- [ ] Dark mode auto-detection
- [ ] Multiple timer presets

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow GNOME Shell extension best practices
- Use GObject.registerClass for all GObject subclasses
- Clean up resources in `destroy()` methods
- Test on GNOME 49+ before submitting
- Update README.md if adding new features

## 📄 License

This project is licensed under the GNU General Public License v2.0 or later - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Mehedi Hasan**
- GitHub: [@mH-13](https://github.com/mH-13)
- Extension UUID: `screentime@mehedi.io`

## 🙏 Acknowledgments

- GNOME Shell team for the excellent extension API
- The GNOME community for inspiration and support
- All contributors who help improve this extension

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/mH-13/wellbeing-widget/issues)
- **Discussions:** [GitHub Discussions](https://github.com/mH-13/wellbeing-widget/discussions)

## 📚 Resources

- [GNOME Shell Extensions Documentation](https://gjs.guide/extensions/)
- [GJS Documentation](https://gjs-docs.gnome.org/)
- [GNOME HIG (Human Interface Guidelines)](https://developer.gnome.org/hig/)

---

**Made with 💚 for GNOME 49 on Fedora Wayland**

*Stay mindful. Stay productive. Stay healthy.* 🌿
