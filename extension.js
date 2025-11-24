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
        this._isLoadingScreenTime = true; // Loading state for initial data fetch
        this._screenTimeError = null; // Error state

        // Statistics tracking
        this._statsView = 'weekly'; // 'weekly' or 'monthly'
        this._lastStatsSave = 0;
        this._statsSaveInterval = 60000; // Save stats every 60 seconds
        this._lastRecordedDate = new Date().toISOString().split('T')[0]; // Track day changes
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
        this._panelBox = new St.BoxLayout({
            style_class: 'wellbeing-panel-box'
        });

        this._icon = new St.Icon({
            icon_name: 'preferences-system-time-symbolic',
            style_class: 'system-status-icon wellbeing-panel-icon',
            accessible_name: 'Screen Time Tracker'
        });

        this._label = new St.Label({
            text: 'Summoning…',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'wellbeing-panel-label',
            accessible_name: 'Daily Screen Time'
        });

        this._panelBox.add_child(this._icon);
        this._panelBox.add_child(this._label);
        this.add_child(this._panelBox);

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
            text: 'Enchanting your insights…',
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

        // Row 1.5: Progress bar
        this._pomoProgressBar = new St.Widget({
            style_class: 'wellbeing-pomo-progress-container',
            x_expand: true
        });

        this._pomoProgressFill = new St.Widget({
            style_class: 'wellbeing-pomo-progress-fill',
            width: 0
        });

        this._pomoProgressBar.add_child(this._pomoProgressFill);

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
        focusMainBox.add_child(this._pomoProgressBar);
        focusMainBox.add_child(durationContainer);
        focusMainBox.add_child(controlsBox);
        focusSection.add_child(focusMainBox);
        this.menu.addMenuItem(focusSection);

        // Zen Music Player section
        const musicSection = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            style_class: 'wellbeing-music-section'
        });

        const musicMainBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'wellbeing-music-main-box'
        });

        // Top row: Title + Controls
        const musicTopRow = new St.BoxLayout({
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

        musicTopRow.add_child(musicTitleLabel);
        musicTopRow.add_child(musicControlsBox);

        // Bottom row: Now playing status
        this._musicStatusLabel = new St.Label({
            text: 'Select a stream to play',
            style_class: 'wellbeing-music-status-label'
        });

        musicMainBox.add_child(musicTopRow);
        musicMainBox.add_child(this._musicStatusLabel);
        musicSection.add_child(musicMainBox);
        this.menu.addMenuItem(musicSection);

        // Music state
        this._musicPlaying = false;
        this._musicProcess = null;
        this._musicCancellable = null;
        this._musicAnimationTimer = null;
        this._musicAnimationState = 0;
        this._currentStreamName = null;

        // Break reminder toggle with icon
        this._breakToggle = new PopupMenu.PopupSwitchMenuItem('Break Reminders', this._breakReminders);
        const breakIcon = new St.Icon({
            icon_name: 'preferences-system-notifications-symbolic',
            icon_size: 16,
            style_class: 'popup-menu-icon'
        });
        this._breakToggle.insert_child_at_index(breakIcon, 1);
        this.menu.addMenuItem(this._breakToggle);

        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings button
        const settingsItem = new PopupMenu.PopupBaseMenuItem({
            reactive: true,
            style_class: 'wellbeing-settings-item'
        });

        const settingsBox = new St.BoxLayout({
            vertical: false,
            style_class: 'wellbeing-settings-box',
            x_expand: true
        });

        const settingsIcon = new St.Icon({
            icon_name: 'preferences-system-symbolic',
            icon_size: 18,
            style_class: 'wellbeing-settings-icon'
        });

        const settingsLabel = new St.Label({
            text: 'Extension Settings',
            style_class: 'wellbeing-settings-label',
            x_expand: true
        });

        settingsBox.add_child(settingsIcon);
        settingsBox.add_child(settingsLabel);
        settingsItem.add_child(settingsBox);

        settingsItem.connect('activate', () => {
            this._extension.openPreferences();
            this.menu.close();
        });

        this.menu.addMenuItem(settingsItem);

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
            const emptyStateBox = new St.BoxLayout({
                vertical: true,
                style_class: 'wellbeing-stats-empty-state',
                x_align: Clutter.ActorAlign.CENTER
            });

            const emptyIcon = new St.Label({
                text: '📊',
                style_class: 'wellbeing-stats-empty-icon'
            });

            const emptyTitle = new St.Label({
                text: 'No Data Yet',
                style_class: 'wellbeing-stats-empty-title'
            });

            const emptyMessage = new St.Label({
                text: 'Start using your computer to see your wellbeing stats!',
                style_class: 'wellbeing-stats-empty-message'
            });

            emptyStateBox.add_child(emptyIcon);
            emptyStateBox.add_child(emptyTitle);
            emptyStateBox.add_child(emptyMessage);
            this._statsGraphBox.add_child(emptyStateBox);
            return;
        }

        // Create container that holds both tooltip and chart
        const graphWrapper = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true
        });

        // Create ONE shared tooltip for all bars (overlaid at top center)
        const sharedTooltip = new St.BoxLayout({
            vertical: true,
            style_class: 'wellbeing-stats-tooltip',
            visible: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START
        });

        const tooltipDate = new St.Label({
            text: '',
            style_class: 'wellbeing-stats-tooltip-date'
        });

        const tooltipTime = new St.Label({
            text: '',
            style_class: 'wellbeing-stats-tooltip-time'
        });

        const tooltipSessions = new St.Label({
            text: '',
            style_class: 'wellbeing-stats-tooltip-sessions'
        });

        sharedTooltip.add_child(tooltipDate);
        sharedTooltip.add_child(tooltipTime);
        sharedTooltip.add_child(tooltipSessions);

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

            // Calculate display values for hover
            const hours = Math.floor(day.screenTime / 3600);
            const minutes = Math.floor((day.screenTime % 3600) / 60);

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

            // Screen time bar with color coding
            const screenTimeHeight = Math.max((day.screenTime / maxScreenTime) * 80, 2);
            const hoursToday = day.screenTime / 3600;

            // Color code based on screen time: green (< 4h), yellow (4-6h), orange (6-8h), red (> 8h)
            let barColor = 'wellbeing-stats-bar-screen';
            if (hoursToday > 8) {
                barColor = 'wellbeing-stats-bar-screen-high';
            } else if (hoursToday > 6) {
                barColor = 'wellbeing-stats-bar-screen-medium-high';
            } else if (hoursToday > 4) {
                barColor = 'wellbeing-stats-bar-screen-medium';
            }

            const screenTimeBar = new St.Widget({
                style_class: barColor,
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

            // Prepare tooltip data for this bar
            const dateStr = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const timeStr = `${hours}h ${minutes}m`;
            const sessionsStr = `${day.pomodoros} session${day.pomodoros !== 1 ? 's' : ''}`;

            // Add hover effect - update shared tooltip content
            barContainer.connect('enter-event', () => {
                barContainer.add_style_class_name('wellbeing-stats-bar-hover');

                // Update tooltip content
                tooltipDate.text = dateStr;
                tooltipTime.text = timeStr;
                tooltipSessions.text = sessionsStr;

                // Show with animation (centered at top via alignment)
                sharedTooltip.visible = true;
                sharedTooltip.opacity = 0;
                sharedTooltip.ease({
                    opacity: 255,
                    duration: 200,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD
                });
            });

            barContainer.connect('leave-event', () => {
                barContainer.remove_style_class_name('wellbeing-stats-bar-hover');

                // Hide tooltip
                sharedTooltip.ease({
                    opacity: 0,
                    duration: 150,
                    mode: Clutter.AnimationMode.EASE_IN_QUAD,
                    onComplete: () => {
                        sharedTooltip.visible = false;
                    }
                });
            });

            chartBox.add_child(barContainer);
        });

        // Add chart and tooltip to wrapper using BinLayout (tooltip overlays on top)
        graphWrapper.add_child(chartBox);
        graphWrapper.add_child(sharedTooltip);

        this._statsGraphBox.add_child(graphWrapper);

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

            // Add subtle live indicator (only if not loading/error)
            const liveIndicator = (!this._isLoadingScreenTime && !this._screenTimeError) ? '●' : '';

            // Update panel box color based on screen time
            const screenTimeSeconds = this._getDailyScreenTimeSeconds();
            const hoursToday = screenTimeSeconds / 3600;

            // Remove old color classes
            this._panelBox.remove_style_class_name('wellbeing-panel-box-medium');
            this._panelBox.remove_style_class_name('wellbeing-panel-box-medium-high');
            this._panelBox.remove_style_class_name('wellbeing-panel-box-high');

            // Apply new color class based on usage
            if (hoursToday > 8) {
                this._panelBox.add_style_class_name('wellbeing-panel-box-high');
            } else if (hoursToday > 6) {
                this._panelBox.add_style_class_name('wellbeing-panel-box-medium-high');
            } else if (hoursToday > 4) {
                this._panelBox.add_style_class_name('wellbeing-panel-box-medium');
            }

            // Dynamic panel display with smooth width transitions
            // Skip label update if music animation is running (to prevent blinking)
            if (!this._musicPlaying || this._pomoRunning || this._pomoRemaining < this._pomoDuration) {
                if (this._pomoRunning) {
                    // Active timer: expand to show screen time + tomato + countdown
                    this._label.text = `${liveIndicator} ${screenTime}  🍅 ${pomoStatus.short}`.trim();
                    this._label.set_style('min-width: 160px; transition: all 0.3s ease;');
                } else if (this._pomoRemaining < this._pomoDuration) {
                    // Paused: expand to show screen time + paused time
                    this._label.text = `${liveIndicator} ${screenTime}  ⏸ ${pomoStatus.short}`.trim();
                    this._label.set_style('min-width: 160px; transition: all 0.3s ease;');
                } else {
                    // Reset/not started: compact - just screen time
                    this._label.text = `${liveIndicator} ${screenTime}`.trim();
                    this._label.set_style('min-width: 100px; transition: all 0.3s ease;');
                }
            }
            // If music is playing, the animation timer handles the label updates

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

            // Update Pomodoro progress bar
            if (this._pomoProgressFill && this._pomoProgressBar) {
                const progress = 1 - (this._pomoRemaining / this._pomoDuration);
                const containerWidth = this._pomoProgressBar.width;
                if (containerWidth > 0) {
                    this._pomoProgressFill.set_width(Math.floor(containerWidth * progress));
                }
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
            this._screenTimeError = `UI update error`;
            if (this._label) {
                this._label.text = '⚠️ UI Error';
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

    _calculateDayScreenTime(historyData, targetDate, currentTime = null) {
        // Helper to calculate screen time for a specific day
        const midnightStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
        const midnightEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1, 0, 0, 0);

        const dayStart = Math.floor(midnightStart.getTime() / 1000);
        const dayEnd = Math.floor(midnightEnd.getTime() / 1000);
        const isToday = currentTime !== null;

        let totalActiveSeconds = 0;
        let lastActiveStart = null;
        let lastStateBeforeDay = null;

        // Find the last state before this day
        for (const entry of historyData) {
            if (entry.wallTimeSecs < dayStart) {
                lastStateBeforeDay = entry.newState;
            } else {
                break;
            }
        }

        // If we were active at midnight, start counting from midnight
        if (lastStateBeforeDay === 1) {
            lastActiveStart = dayStart;
        }

        // Process this day's entries
        for (const entry of historyData) {
            if (entry.wallTimeSecs < dayStart) {
                continue;
            }
            if (entry.wallTimeSecs >= dayEnd) {
                break;
            }

            if (entry.newState === 1) {
                if (lastActiveStart === null) {
                    lastActiveStart = entry.wallTimeSecs;
                }
            } else if (entry.newState === 0) {
                if (lastActiveStart !== null) {
                    totalActiveSeconds += (entry.wallTimeSecs - lastActiveStart);
                    lastActiveStart = null;
                }
            }
        }

        // If still active at end of day (or now for today), close the session
        if (lastActiveStart !== null) {
            const endTime = isToday ? currentTime : dayEnd;
            totalActiveSeconds += (endTime - lastActiveStart);
        }

        return totalActiveSeconds;
    }

    _updateLiveScreenTime() {
        // Efficiently update only TODAY's screen time (runs every 5 seconds)
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const homeDir = GLib.get_home_dir();
        const historyPath = `${homeDir}/.local/share/gnome-shell/session-active-history.json`;
        const file = Gio.File.new_for_path(historyPath);

        // Detect midnight crossing - finalize yesterday's data
        if (todayStr !== this._lastRecordedDate) {
            log(`Wellbeing Widget: Day changed from ${this._lastRecordedDate} to ${todayStr} - finalizing previous day`);
            // Yesterday's data is already calculated and stored, just mark the transition
            this._lastRecordedDate = todayStr;
            this._cachedLiveSeconds = 0; // Reset today's cache
        }

        file.load_contents_async(null, (_file, res) => {
            try {
                const [success, contents] = file.load_contents_finish(res);

                if (success) {
                    const historyData = JSON.parse(new TextDecoder().decode(contents));
                    const currentTime = Math.floor(Date.now() / 1000);

                    // Calculate TODAY's screen time (updates live)
                    const todayScreenTime = this._calculateDayScreenTime(historyData, now, currentTime);
                    this._stats.daily[todayStr] = todayScreenTime;
                    this._cachedLiveSeconds = todayScreenTime;

                    // Calculate historical days ONLY if they don't exist yet (one-time calculation)
                    // This includes yesterday if we just crossed midnight
                    for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
                        const pastDate = new Date(now);
                        pastDate.setDate(pastDate.getDate() - daysAgo);
                        const pastDateStr = pastDate.toISOString().split('T')[0];

                        // Always recalculate yesterday when day changes to get final value
                        // Skip others if already calculated
                        if (!this._stats.daily[pastDateStr] || daysAgo === 1) {
                            const pastScreenTime = this._calculateDayScreenTime(historyData, pastDate, null);
                            this._stats.daily[pastDateStr] = pastScreenTime;
                        }
                    }

                    // Save stats (only when changed)
                    this._saveStats();
                    this._isLoadingScreenTime = false;
                    this._screenTimeError = null;
                } else {
                    this._screenTimeError = 'Cannot read screen time data';
                    this._isLoadingScreenTime = false;
                }
            } catch (e) {
                log(`Wellbeing Widget: Error calculating live screen time: ${e.message}`);
                this._screenTimeError = `Calculation error: ${e.message}`;
                this._isLoadingScreenTime = false;
            }
        });
    }

    _getDailyScreenTime() {
        // Show loading state on first load
        if (this._isLoadingScreenTime && !this._cachedScreenTime) {
            return '🔮 Summoning...';
        }

        // Show error state if we have one
        if (this._screenTimeError) {
            return '⚠️ Error';
        }

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
            this._isLoadingScreenTime = false; // Clear loading state
            this._screenTimeError = null; // Clear error state
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
                const soundPlayer = global.display.get_sound_player();
                soundPlayer.play_from_theme('complete', 'Focus Session Complete', null);
            } catch (e) {
                log(`Wellbeing Widget: Error playing sound: ${e.message}`);
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
                {name: 'Calm Radio - Meditation', url: 'https://streams.calmradio.com/api/39/128/stream'},
                {name: 'Zen Radio - Relaxing', url: 'http://stream.zenradio.com/radios/relaxing.mp3'},
                {name: 'Chillhop Live', url: 'https://chillhop.com/live'}
            ];

            const selectedStream = streams[0]; // Use first stream for now
            this._currentStreamName = selectedStream.name;

            // Create cancellable for proper process management
            this._musicCancellable = new Gio.Cancellable();

            // Use mpv with higher volume (80%) via Gio.Subprocess
            this._musicProcess = Gio.Subprocess.new(
                ['mpv', '--no-video', '--volume=80', selectedStream.url],
                Gio.SubprocessFlags.NONE
            );

            this._musicPlaying = true;
            this._startMusicAnimation();

            // Update status label
            if (this._musicStatusLabel) {
                this._musicStatusLabel.text = `♫ Now Playing: ${this._currentStreamName}`;
            }

            if (this._settings.get_boolean('visual-alerts')) {
                Main.notify('🎵 Zen Music', 'Relax and focus with calming sounds');
            }
        } catch (e) {
            log(`Wellbeing Widget: Could not play music: ${e.message}`);
            if (this._musicStatusLabel) {
                this._musicStatusLabel.text = '⚠️ Error: Please install mpv';
            }
            Main.notify('🎵 Zen Music', 'Please install mpv: sudo dnf install mpv');
        }
    }

    _stopZenMusic() {
        if (!this._musicPlaying) return;

        try {
            // Cancel and terminate the music process properly
            if (this._musicCancellable) {
                this._musicCancellable.cancel();
                this._musicCancellable = null;
            }

            if (this._musicProcess) {
                this._musicProcess.force_exit();
                this._musicProcess = null;
            }

            this._musicPlaying = false;
            this._currentStreamName = null;
            this._stopMusicAnimation();

            // Update status label
            if (this._musicStatusLabel) {
                this._musicStatusLabel.text = 'Music stopped';
            }
        } catch (e) {
            log(`Wellbeing Widget: Error stopping music: ${e.message}`);
            if (this._musicStatusLabel) {
                this._musicStatusLabel.text = '⚠️ Error stopping music';
            }
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
