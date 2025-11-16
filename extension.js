/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// Indicator Button Class
const WellbeingIndicator = GObject.registerClass(
class WellbeingIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Wellbeing Widget', false);

        this._extension = extension;
        this._settings = extension.getSettings();

        // Pomodoro state
        this._pomoTimer = null;
        this._pomoDuration = this._settings.get_int('pomodoro-duration') * 60;
        this._pomoRemaining = this._pomoDuration;
        this._pomoRunning = false;
        this._pomoCount = 0; // Track completed Pomodoros for long breaks
        this._breakReminders = true;
        this._lastBreakNotification = 0;

        // Quote rotation state (change every 1 hour)
        this._lastQuoteChange = Date.now();
        this._currentQuote = null;

        // Screen time caching (reduce file I/O)
        this._cachedScreenTime = null;
        this._cachedLiveSeconds = 0; // Async-updated live screen time
        this._lastScreenTimeUpdate = 0;
        this._screenTimeCacheDuration = 4000; // 4 seconds cache (slightly less than update interval)

        // Statistics tracking
        this._statsView = 'weekly'; // 'weekly' or 'monthly'
        this._lastStatsSave = 0;
        this._statsSaveInterval = 60000; // Save stats every 60 seconds
        this._loadStats();

        this._buildUI();
        this._startUpdating();
    }

    _loadStats() {
        // Load or initialize statistics data
        const statsJson = this._settings.get_string('statistics-data');
        try {
            this._stats = statsJson ? JSON.parse(statsJson) : { daily: {}, pomodoros: {} };
        } catch (e) {
            this._stats = { daily: {}, pomodoros: {} };
        }
    }

    _saveStats() {
        try {
            this._settings.set_string('statistics-data', JSON.stringify(this._stats));
        } catch (e) {
            log(`Wellbeing Widget: Error saving stats: ${e.message}`);
        }
    }

    _recordDailyStats(date, screenTimeSeconds) {
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        this._stats.daily[dateStr] = screenTimeSeconds;
        this._saveStats();
    }

    _recordPomodoro(date) {
        const dateStr = date.toISOString().split('T')[0];
        if (!this._stats.pomodoros[dateStr]) {
            this._stats.pomodoros[dateStr] = 0;
        }
        this._stats.pomodoros[dateStr]++;
        this._saveStats();
    }

    _buildUI() {
        // Panel label with icon
        const panelBox = new St.BoxLayout({
            style_class: 'wellbeing-panel-box'
        });

        this._icon = new St.Icon({
            icon_name: 'preferences-system-time-symbolic',
            style_class: 'system-status-icon wellbeing-panel-icon',
            accessible_name: 'Screen Time Tracker'
        });

        this._label = new St.Label({
            text: 'Loading…',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'wellbeing-panel-label',
            accessible_name: 'Daily Screen Time'
        });

        panelBox.add_child(this._icon);
        panelBox.add_child(this._label);
        this.add_child(panelBox);

        // Menu styling
        this.menu.box.style_class = 'wellbeing-menu';

        // Combined Header + Quote section
        const headerQuoteItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            style_class: 'wellbeing-header-quote-section'
        });
        const headerQuoteBox = new St.BoxLayout({
            vertical: true,
            style_class: 'wellbeing-header-quote-box'
        });

        // Top: Icon + Title
        const headerBox = new St.BoxLayout({
            vertical: false,
            style_class: 'wellbeing-header-title-box'
        });
        const headerIcon = new St.Icon({
            icon_name: 'weather-clear-symbolic',
            icon_size: 20,
            style_class: 'wellbeing-header-icon'
        });
        const titleLabel = new St.Label({
            text: 'Wellbeing Dashboard',
            style_class: 'wellbeing-title'
        });
        headerBox.add_child(headerIcon);
        headerBox.add_child(titleLabel);

        // Bottom: Quote
        this._quoteLabel = new St.Label({
            text: this._getMotivationalQuote(),
            style_class: 'wellbeing-quote-label-compact'
        });

        headerQuoteBox.add_child(headerBox);
        headerQuoteBox.add_child(this._quoteLabel);
        headerQuoteItem.add_child(headerQuoteBox);
        this.menu.addMenuItem(headerQuoteItem);

        // Statistics section (Weekly only)
        const statsHeader = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        const statsTitle = new St.Label({
            text: 'Weekly Overview',
            style_class: 'wellbeing-section-header'
        });
        statsHeader.add_child(statsTitle);
        this.menu.addMenuItem(statsHeader);

        // Mini graph visualization
        this._statsGraphItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            style_class: 'wellbeing-stats-graph-item'
        });
        this._statsGraphBox = new St.BoxLayout({
            vertical: true,
            style_class: 'wellbeing-stats-graph-box'
        });
        this._statsGraphItem.add_child(this._statsGraphBox);
        this.menu.addMenuItem(this._statsGraphItem);

        // Stats summary
        this._statsSummaryItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            style_class: 'wellbeing-stats-summary-item'
        });
        this._statsSummaryLabel = new St.Label({
            text: 'Loading statistics...',
            style_class: 'wellbeing-stats-summary-label'
        });
        this._statsSummaryItem.add_child(this._statsSummaryLabel);
        this.menu.addMenuItem(this._statsSummaryItem);

        // Combined Focus Session section (Duration + Controls) - Vertical layout
        const focusSection = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            style_class: 'wellbeing-focus-section'
        });

        const focusMainBox = new St.BoxLayout({
            vertical: true,
            style_class: 'wellbeing-focus-main-box'
        });

        // Row 1: Title
        const focusTitle = new St.Label({
            text: '🍅 Focus Session',
            style_class: 'wellbeing-focus-title',
            x_align: Clutter.ActorAlign.CENTER
        });

        // Row 2: Duration buttons
        const durationContainer = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style_class: 'wellbeing-duration-box-inline'
        });

        // Duration buttons
        const durations = [15, 25, 45, 60];
        this._durationButtons = [];

        for (const duration of durations) {
            const btn = new St.Button({
                label: `${duration}m`,
                style_class: 'wellbeing-duration-button-compact',
                x_expand: true
            });

            if (duration === this._settings.get_int('pomodoro-duration')) {
                btn.add_style_class_name('wellbeing-duration-active');
            }

            btn.connect('clicked', () => {
                this._settings.set_int('pomodoro-duration', duration);
                this._pomoDuration = duration * 60;
                this._pomoRemaining = this._pomoDuration;
                this._updateDurationButtons();
                this._updateUI();
            });

            this._durationButtons.push(btn);
            durationContainer.add_child(btn);
        }

        // Row 3: Control buttons
        const controlsBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style_class: 'wellbeing-focus-controls-box'
        });

        this._startPomodoro = new St.Button({
            label: '▶ Start',
            style_class: 'wellbeing-pomo-button wellbeing-pomo-button-start',
            x_expand: true
        });

        this._pausePomodoro = new St.Button({
            label: '⏸ Pause',
            style_class: 'wellbeing-pomo-button wellbeing-pomo-button-pause',
            x_expand: true
        });

        this._resetPomodoro = new St.Button({
            label: '↺ Reset',
            style_class: 'wellbeing-pomo-button wellbeing-pomo-button-reset',
            x_expand: true
        });

        controlsBox.add_child(this._startPomodoro);
        controlsBox.add_child(this._pausePomodoro);
        controlsBox.add_child(this._resetPomodoro);

        // Add all rows to main box
        focusMainBox.add_child(focusTitle);
        focusMainBox.add_child(durationContainer);
        focusMainBox.add_child(controlsBox);
        focusSection.add_child(focusMainBox);
        this.menu.addMenuItem(focusSection);

        // Zen Music Player section
        const musicSection = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            style_class: 'wellbeing-music-section'
        });

        const musicContainer = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style_class: 'wellbeing-music-container'
        });

        // Music label (emoji is part of text, no separate icon needed)
        const musicTitleLabel = new St.Label({
            text: '🎵 Zen Music',
            style_class: 'wellbeing-music-title-label'
        });

        // Music controls
        const musicControlsBox = new St.BoxLayout({
            vertical: false,
            style_class: 'wellbeing-music-controls-box'
        });

        this._playMusicBtn = new St.Button({
            label: '▶ Play',
            style_class: 'wellbeing-music-button'
        });

        this._stopMusicBtn = new St.Button({
            label: '⏹ Stop',
            style_class: 'wellbeing-music-button'
        });

        musicControlsBox.add_child(this._playMusicBtn);
        musicControlsBox.add_child(this._stopMusicBtn);

        musicContainer.add_child(musicTitleLabel);
        musicContainer.add_child(musicControlsBox);
        musicSection.add_child(musicContainer);
        this.menu.addMenuItem(musicSection);

        // Music state
        this._musicPlaying = false;
        this._musicProcess = null;
        this._musicAnimationTimer = null;
        this._musicAnimationState = 0;

        // Break reminder toggle with icon
        this._breakToggle = new PopupMenu.PopupSwitchMenuItem('Break Reminders', this._breakReminders);
        const breakIcon = new St.Icon({
            icon_name: 'preferences-system-notifications-symbolic',
            icon_size: 16,
            style_class: 'popup-menu-icon'
        });
        this._breakToggle.insert_child_at_index(breakIcon, 1);
        this.menu.addMenuItem(this._breakToggle);

        // Connect signals
        this._startPomodoro.connect('clicked', () => this._startPomo());
        this._pausePomodoro.connect('clicked', () => this._pausePomo());
        this._resetPomodoro.connect('clicked', () => this._resetPomo());
        this._playMusicBtn.connect('clicked', () => this._playZenMusic());
        this._stopMusicBtn.connect('clicked', () => this._stopZenMusic());
        this._breakToggle.connect('toggled', (_item, state) => {
            this._breakReminders = state;
        });

        // Update stats when menu opens
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open) {
                // Force cache invalidation and update when menu opens
                this._cachedScreenTime = null;
                this._lastScreenTimeUpdate = 0;

                const screenTimeSeconds = this._getDailyScreenTimeSeconds();
                if (screenTimeSeconds > 0) {
                    this._recordDailyStats(new Date(), screenTimeSeconds);
                }
                this._updateStatsView();
            }
        });
    }

    _startUpdating() {
        // Remove existing timer before creating new one
        if (this._updateTimer) {
            GLib.Source.remove(this._updateTimer);
            this._updateTimer = null;
        }

        this._updateUI();
        this._updateTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            this._updateUI();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _updateDurationButtons() {
        const currentDuration = this._settings.get_int('pomodoro-duration');
        const durations = [15, 25, 45, 60];

        this._durationButtons.forEach((btn, idx) => {
            if (durations[idx] === currentDuration) {
                btn.add_style_class_name('wellbeing-duration-active');
            } else {
                btn.remove_style_class_name('wellbeing-duration-active');
            }
        });
    }

    _updateStatsView() {
        // Always show weekly view
        const data = this._getStatsData('weekly');
        this._drawMiniGraph(data);
        this._updateStatsSummary(data);
    }

    _getStatsData(viewType) {
        const now = new Date();
        const days = viewType === 'weekly' ? 7 : 30;
        const data = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const screenTime = this._stats.daily[dateStr] || 0;
            const pomodoros = this._stats.pomodoros[dateStr] || 0;

            data.push({
                date: date,
                dateStr: dateStr,
                screenTime: screenTime,
                pomodoros: pomodoros
            });
        }

        return data;
    }

    _drawMiniGraph(data) {
        // Clear existing graph
        this._statsGraphBox.destroy_all_children();

        if (data.length === 0) {
            const noDataLabel = new St.Label({
                text: 'No data available yet',
                style_class: 'wellbeing-stats-no-data'
            });
            this._statsGraphBox.add_child(noDataLabel);
            return;
        }

        // Find max values for scaling
        const maxScreenTime = Math.max(...data.map(d => d.screenTime), 1);
        const maxPomodoros = Math.max(...data.map(d => d.pomodoros), 1);

        // Create bar chart
        const chartBox = new St.BoxLayout({
            vertical: false,
            style_class: 'wellbeing-stats-chart-box',
            x_expand: true
        });

        data.forEach((day) => {
            const barContainer = new St.BoxLayout({
                vertical: true,
                style_class: 'wellbeing-stats-bar-container',
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                reactive: true,
                track_hover: true
            });

            // Create tooltip with detailed info
            const hours = Math.floor(day.screenTime / 3600);
            const minutes = Math.floor((day.screenTime % 3600) / 60);
            const dateStr = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const tooltip = `${dateStr}\n${hours}h ${minutes}m screen time\n${day.pomodoros} focus session${day.pomodoros !== 1 ? 's' : ''}`;

            // Bar area container (fixed height)
            const barAreaBox = new St.BoxLayout({
                vertical: true,
                style_class: 'wellbeing-stats-bar-area',
                y_expand: true,
                y_align: Clutter.ActorAlign.END
            });

            // Pomodoro indicator (small dot overlay) - at top
            if (day.pomodoros > 0) {
                const pomodoroSize = Math.min((day.pomodoros / maxPomodoros) * 12 + 4, 16);
                const pomodoroIndicator = new St.Widget({
                    style_class: 'wellbeing-stats-pomo-indicator',
                    style: `width: ${pomodoroSize}px; height: ${pomodoroSize}px;`
                });
                barAreaBox.add_child(pomodoroIndicator);
            }

            // Screen time bar
            const screenTimeHeight = Math.max((day.screenTime / maxScreenTime) * 80, 2);
            const screenTimeBar = new St.Widget({
                style_class: 'wellbeing-stats-bar-screen',
                style: `height: ${screenTimeHeight}px; width: 100%;`,
                y_align: Clutter.ActorAlign.END
            });

            barAreaBox.add_child(screenTimeBar);
            barContainer.add_child(barAreaBox);

            // Day label (first letter for weekly) - always at bottom
            const dayLabel = new St.Label({
                text: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.date.getDay()],
                style_class: 'wellbeing-stats-day-label'
            });
            barContainer.add_child(dayLabel);

            // Add hover effect and tooltip
            let tooltipLabel = null;
            barContainer.connect('enter-event', () => {
                barContainer.add_style_class_name('wellbeing-stats-bar-hover');

                // Create and show tooltip
                tooltipLabel = new St.Label({
                    text: tooltip,
                    style_class: 'wellbeing-stats-tooltip',
                    style: 'text-align: center;'
                });
                barContainer.insert_child_at_index(tooltipLabel, 0);
            });

            barContainer.connect('leave-event', () => {
                barContainer.remove_style_class_name('wellbeing-stats-bar-hover');

                // Remove tooltip
                if (tooltipLabel) {
                    tooltipLabel.destroy();
                    tooltipLabel = null;
                }
            });

            chartBox.add_child(barContainer);
        });

        this._statsGraphBox.add_child(chartBox);

        // Legend
        const legendBox = new St.BoxLayout({
            vertical: false,
            style_class: 'wellbeing-stats-legend-box'
        });

        const screenLegend = new St.BoxLayout({ vertical: false, style_class: 'wellbeing-stats-legend-item' });
        screenLegend.add_child(new St.Widget({ style_class: 'wellbeing-stats-legend-color-screen' }));
        screenLegend.add_child(new St.Label({ text: 'Screen Time', style_class: 'wellbeing-stats-legend-label' }));

        const pomoLegend = new St.BoxLayout({ vertical: false, style_class: 'wellbeing-stats-legend-item' });
        pomoLegend.add_child(new St.Widget({ style_class: 'wellbeing-stats-legend-color-pomo' }));
        pomoLegend.add_child(new St.Label({ text: 'Pomodoros', style_class: 'wellbeing-stats-legend-label' }));

        legendBox.add_child(screenLegend);
        legendBox.add_child(pomoLegend);
        this._statsGraphBox.add_child(legendBox);
    }

    _updateStatsSummary(data) {
        const totalScreenTime = data.reduce((sum, d) => sum + d.screenTime, 0);
        const totalPomodoros = data.reduce((sum, d) => sum + d.pomodoros, 0);
        const avgScreenTime = data.length > 0 ? totalScreenTime / data.length : 0;

        const hours = Math.floor(avgScreenTime / 3600);
        const minutes = Math.floor((avgScreenTime % 3600) / 60);

        // Get today's data for detailed summary (last entry in array)
        const today = data.length > 0 ? data[data.length - 1] : null;

        let summaryText = `Avg: ${hours}h ${minutes}m/day • ${totalPomodoros} sessions this week`;

        if (today && today.screenTime > 0) {
            const tHours = Math.floor(today.screenTime / 3600);
            const tMinutes = Math.floor((today.screenTime % 3600) / 60);
            summaryText += `\nToday: ${tHours}h ${tMinutes}m • ${today.pomodoros} sessions`;
        }

        this._statsSummaryLabel.text = summaryText;
    }

    _getMotivationalQuote() {
        const quotes = [
            '💡 "Focus is the gateway to excellence"',
            '🌟 "Deep work produces deep results"',
            '🎯 "Distraction is the enemy of mastery"',
            '✨ "Small focused steps lead to big achievements"',
            '🌊 "Flow state is where magic happens"',
            '🚀 "Your future self will thank you for focusing now"',
            '🎨 "Creativity thrives in focused silence"',
            '⚡ "Energy follows attention"',
            '🧘 "Mindfulness begins with awareness"',
            '🌱 "Growth happens one focused session at a time"'
        ];
        return quotes[Math.floor(Math.random() * quotes.length)];
    }

    _updateUI() {
        try {
            // Update live screen time asynchronously in background
            this._updateLiveScreenTime();

            const screenTime = this._getDailyScreenTime();
            const pomoStatus = this._getPomoStatus();

            // Dynamic panel display with smooth width transitions
            if (this._pomoRunning) {
                // Active timer: expand to show screen time + tomato + countdown
                this._label.text = `${screenTime}  🍅 ${pomoStatus.short}`;
                this._label.set_style('min-width: 160px; transition: all 0.3s ease;');
            } else if (this._pomoRemaining < this._pomoDuration) {
                // Paused: expand to show screen time + paused time
                this._label.text = `${screenTime}  ⏸ ${pomoStatus.short}`;
                this._label.set_style('min-width: 160px; transition: all 0.3s ease;');
            } else {
                // Reset/not started: compact - just screen time
                this._label.text = screenTime;
                this._label.set_style('min-width: 80px; transition: all 0.3s ease;');
            }

            // Update motivational quote (only change every 1 hour)
            const now = Date.now();
            if (!this._currentQuote || (now - this._lastQuoteChange > 3600000)) { // 3600000ms = 1 hour
                this._currentQuote = this._getMotivationalQuote();
                this._lastQuoteChange = now;
            }
            if (this._quoteLabel) {
                this._quoteLabel.text = this._currentQuote;
            }

            // Record daily statistics (periodically, or when menu is open)
            const shouldSaveStats = this.menu.isOpen || (now - this._lastStatsSave > this._statsSaveInterval);

            if (shouldSaveStats) {
                const screenTimeSeconds = this._getDailyScreenTimeSeconds();
                if (screenTimeSeconds > 0) {
                    this._recordDailyStats(new Date(), screenTimeSeconds);
                    this._lastStatsSave = now;
                }
            }

            // Update statistics view (only when menu is visible)
            if (this.menu.isOpen) {
                this._updateStatsView();
            }

            // Break reminder (every 30 minutes)
            if (this._breakReminders) {
                const currentTime = Math.floor(Date.now() / 1000);
                if (currentTime - this._lastBreakNotification > 1800) {
                    Main.notify('Break Time', 'You\'ve been working for a while. Stand up, stretch, and rest your eyes.');
                    this._lastBreakNotification = currentTime;
                }
            }
        } catch (e) {
            // Graceful error handling - don't let exceptions break the timer
            log(`Wellbeing Widget: Error in _updateUI: ${e.message}`);
            if (this._label) {
                this._label.text = 'Error';
            }
        }
    }

    _getDailyScreenTimeSeconds() {
        // Helper method to get screen time in seconds (synchronous wrapper)
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];

        // Use cached live seconds if available (updated by async background task)
        if (this._cachedLiveSeconds !== undefined && this._cachedLiveSeconds > 0) {
            return this._cachedLiveSeconds;
        }

        // Fallback: check if we have stored data for today (survives reboots)
        if (this._stats.daily[dateStr]) {
            return this._stats.daily[dateStr];
        }

        return 0;
    }

    _updateLiveScreenTime() {
        // Async method to update live screen time in background
        const now = new Date();
        const homeDir = GLib.get_home_dir();
        const historyPath = `${homeDir}/.local/share/gnome-shell/session-active-history.json`;
        const file = Gio.File.new_for_path(historyPath);

        file.load_contents_async(null, (sourceObject, res) => {
            try {
                const [success, contents] = file.load_contents_finish(res);

                if (success) {
                    const historyData = JSON.parse(new TextDecoder().decode(contents));

                    const midnightToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                    const todayStart = Math.floor(midnightToday.getTime() / 1000);
                    const currentTime = Math.floor(Date.now() / 1000);

                    let totalActiveSeconds = 0;
                    let lastActiveStart = null;
                    let lastStateBeforeToday = null;

                    // First pass: find the last state before today
                    for (const entry of historyData) {
                        if (entry.wallTimeSecs < todayStart) {
                            lastStateBeforeToday = entry.newState;
                        } else {
                            break;
                        }
                    }

                    // If we were active at midnight, start counting from midnight
                    if (lastStateBeforeToday === 1) {
                        lastActiveStart = todayStart;
                    }

                    // Second pass: process today's entries
                    for (const entry of historyData) {
                        if (entry.wallTimeSecs < todayStart) {
                            continue;
                        }

                        if (entry.newState === 1) {
                            // Becoming active
                            if (lastActiveStart === null) {
                                lastActiveStart = entry.wallTimeSecs;
                            }
                        } else if (entry.newState === 0) {
                            // Becoming inactive
                            if (lastActiveStart !== null) {
                                totalActiveSeconds += (entry.wallTimeSecs - lastActiveStart);
                                lastActiveStart = null;
                            }
                        }
                    }

                    // If currently active, add time until now
                    if (lastActiveStart !== null) {
                        totalActiveSeconds += (currentTime - lastActiveStart);
                    }

                    // Update cached value
                    this._cachedLiveSeconds = totalActiveSeconds;
                }
            } catch (e) {
                log(`Wellbeing Widget: Error calculating live screen time: ${e.message}`);
            }
        });
    }

    _getDailyScreenTime() {
        // Use cached value if available and recent
        const now = Date.now();
        if (this._cachedScreenTime && (now - this._lastScreenTimeUpdate < this._screenTimeCacheDuration)) {
            return this._cachedScreenTime;
        }

        // Calculate fresh value
        const totalActiveSeconds = this._getDailyScreenTimeSeconds();
        let result;

        if (totalActiveSeconds > 0) {
            const hours = Math.floor(totalActiveSeconds / 3600);
            const minutes = Math.floor((totalActiveSeconds % 3600) / 60);
            result = `${hours}h ${minutes}m`;
        } else {
            result = this._getFallbackScreenTime();
        }

        // Update cache
        this._cachedScreenTime = result;
        this._lastScreenTimeUpdate = now;

        return result;
    }

    _getFallbackScreenTime() {
        // Fallback: Calculate session time from boot (async)
        try {
            const proc = Gio.Subprocess.new(
                ['bash', '-c', 'date -d "$(who -b | awk \'{print $3, $4}\')" +%s 2>/dev/null'],
                Gio.SubprocessFlags.STDOUT_PIPE
            );

            proc.communicate_utf8_async(null, null, (_proc, res) => {
                try {
                    const [, stdout] = proc.communicate_utf8_finish(res);
                    const bootEpoch = parseInt(stdout.trim());
                    if (!isNaN(bootEpoch)) {
                        const now = Math.floor(Date.now() / 1000);
                        const sessionSeconds = now - bootEpoch;
                        const hours = Math.floor(sessionSeconds / 3600);
                        const minutes = Math.floor((sessionSeconds % 3600) / 60);
                        // Update label asynchronously
                        if (this._label && this._getDailyScreenTimeSeconds() === 0) {
                            this._cachedScreenTime = `${hours}h ${minutes}m`;
                            this._label.text = this._cachedScreenTime;
                        }
                    }
                } catch (e) {
                    // Continue to next fallback
                }
            });
        } catch (e) {
            // Continue to next fallback
        }

        // System uptime fallback (async)
        const uptimeFile = Gio.File.new_for_path('/proc/uptime');
        uptimeFile.load_contents_async(null, (_sourceObject, res) => {
            try {
                const [success, contents] = uptimeFile.load_contents_finish(res);
                if (success) {
                    const uptimeStr = new TextDecoder().decode(contents);
                    const uptimeSeconds = parseFloat(uptimeStr.split(' ')[0]);
                    const hours = Math.floor(uptimeSeconds / 3600);
                    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
                    // Update label asynchronously
                    if (this._label && this._getDailyScreenTimeSeconds() === 0) {
                        this._cachedScreenTime = `${hours}h ${minutes}m`;
                        this._label.text = this._cachedScreenTime;
                    }
                }
            } catch (e) {
                // Silent fail
            }
        });

        // Absolute fallback - show minimal time immediately
        return '0h 0m';
    }

    _startPomo() {
        if (this._pomoRunning) return;
        this._pomoRunning = true;

        if (this._settings.get_boolean('visual-alerts')) {
            Main.notify('Focus Session Started', 'Stay concentrated! Timer is running.');
        }

        // Remove existing timer before creating new one
        if (this._pomoTimer) {
            GLib.Source.remove(this._pomoTimer);
            this._pomoTimer = null;
        }

        this._pomoTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._pomoRemaining--;
            this._updateUI();

            if (this._pomoRemaining <= 0) {
                this._pomoCompleted();
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _pomoCompleted() {
        this._pomoCount++;

        // Record Pomodoro in statistics
        this._recordPomodoro(new Date());

        // Play sound alert
        if (this._settings.get_boolean('sound-alerts')) {
            try {
                GLib.spawn_command_line_async('canberra-gtk-play -i complete');
            } catch (e) {
                // Fallback to bell sound
                try {
                    GLib.spawn_command_line_async('paplay /usr/share/sounds/freedesktop/stereo/complete.oga');
                } catch (e2) {
                    // Silent fail
                }
            }
        }

        // Visual alert
        if (this._settings.get_boolean('visual-alerts')) {
            const isLongBreak = (this._pomoCount % 4 === 0);
            const breakDuration = isLongBreak
                ? this._settings.get_int('long-break-duration')
                : this._settings.get_int('short-break-duration');

            const breakType = isLongBreak ? 'Long Break' : 'Short Break';
            Main.notify(
                '🎉 Focus Session Complete!',
                `Great work! Take a ${breakDuration}-minute ${breakType.toLowerCase()}.`
            );
        }

        this._resetPomo();
    }

    _pausePomo() {
        if (this._pomoTimer) {
            GLib.source_remove(this._pomoTimer);
            this._pomoTimer = null;
        }
        this._pomoRunning = false;
        this._updateUI();
    }

    _resetPomo() {
        this._pausePomo();
        this._pomoDuration = this._settings.get_int('pomodoro-duration') * 60;
        this._pomoRemaining = this._pomoDuration;
        this._updateUI();
    }

    _getPomoStatus() {
        const minutes = Math.floor(this._pomoRemaining / 60);
        const seconds = this._pomoRemaining % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        const short = timeStr;
        const full = this._pomoRunning
            ? `${timeStr}`
            : (this._pomoRemaining === this._pomoDuration ? 'Ready' : `${timeStr} (Paused)`);
        return { short, full };
    }

    _playZenMusic() {
        if (this._musicPlaying) return;

        try {
            // Free lofi/zen radio streams (no downloads needed)
            const streams = [
                'https://streams.calmradio.com/api/39/128/stream',  // Calm Radio - Meditation
                'http://stream.zenradio.com/radios/relaxing.mp3',   // Zen Radio
                'https://chillhop.com/live',                        // Chillhop Live
            ];

            const stream = streams[0]; // Use first stream for now

            // Use mpv with higher volume (80%)
            this._musicProcess = GLib.spawn_command_line_async(`mpv --no-video --volume=80 "${stream}"`);

            this._musicPlaying = true;
            this._startMusicAnimation();

            if (this._settings.get_boolean('visual-alerts')) {
                Main.notify('🎵 Zen Music', 'Relax and focus with calming sounds');
            }
        } catch (e) {
            log(`Wellbeing Widget: Could not play music: ${e.message}`);
            Main.notify('🎵 Zen Music', 'Please install mpv: sudo dnf install mpv');
        }
    }

    _stopZenMusic() {
        if (!this._musicPlaying) return;

        try {
            // Kill mpv process
            GLib.spawn_command_line_async('pkill -f "mpv.*stream"');
            this._musicPlaying = false;
            this._stopMusicAnimation();
        } catch (e) {
            log(`Wellbeing Widget: Error stopping music: ${e.message}`);
        }
    }

    _startMusicAnimation() {
        // Real equalizer animation (like music player)
        this._musicAnimationState = 0;

        // Remove existing timer before creating new one
        if (this._musicAnimationTimer) {
            GLib.Source.remove(this._musicAnimationTimer);
            this._musicAnimationTimer = null;
        }

        this._musicAnimationTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            if (!this._musicPlaying) {
                return GLib.SOURCE_REMOVE;
            }

            // Priority: Only show music if timer is NOT running
            if (this._pomoRunning || this._pomoRemaining < this._pomoDuration) {
                return GLib.SOURCE_CONTINUE; // Timer has priority, keep animation alive but don't show
            }

            // Animated equalizer bars (3 bars with different heights)
            const bars = [
                ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],  // Bar 1
                ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],  // Bar 2
                ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']   // Bar 3
            ];

            // Create realistic wave pattern
            const phase1 = Math.sin(this._musicAnimationState * 0.3) * 3.5 + 3.5;
            const phase2 = Math.sin(this._musicAnimationState * 0.4 + 1) * 3.5 + 3.5;
            const phase3 = Math.sin(this._musicAnimationState * 0.5 + 2) * 3.5 + 3.5;

            const bar1 = bars[0][Math.floor(phase1)];
            const bar2 = bars[1][Math.floor(phase2)];
            const bar3 = bars[2][Math.floor(phase3)];

            const screenTime = this._getDailyScreenTime();
            this._label.text = `${screenTime}  ${bar1}${bar2}${bar3} Zen`;
            this._label.set_style('min-width: 160px; transition: none;'); // No transition for smooth animation

            this._musicAnimationState++;
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopMusicAnimation() {
        if (this._musicAnimationTimer) {
            GLib.source_remove(this._musicAnimationTimer);
            this._musicAnimationTimer = null;
        }
        // Reset panel display
        this._updateUI();
    }

    destroy() {
        if (this._updateTimer) {
            GLib.source_remove(this._updateTimer);
            this._updateTimer = null;
        }
        if (this._pomoTimer) {
            GLib.source_remove(this._pomoTimer);
            this._pomoTimer = null;
        }
        if (this._musicAnimationTimer) {
            GLib.source_remove(this._musicAnimationTimer);
            this._musicAnimationTimer = null;
        }
        if (this._musicPlaying) {
            this._stopZenMusic();
        }
        super.destroy();
    }
});

// Main Extension Class
export default class WellbeingExtension extends Extension {
    enable() {
        this._indicator = new WellbeingIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
