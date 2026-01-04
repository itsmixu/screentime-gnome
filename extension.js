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
        super._init(0.5, 'Wellbeing Widget', false);

        this._extension = extension;
        this._settings = extension.getSettings();

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
        this._lastStatsUpdate = 0; // Track when stats view was last updated (for performance)
        this._statsSaveInterval = 60000; // Save stats every 60 seconds
        this._lastRecordedDate = new Date().toISOString().split('T')[0]; // Track day changes
        this._finalizedDays = new Set(); // Track which days are finalized (never recalculate)
        this._loadStats();

        this._buildUI();
        this._startUpdating();
    }

    _loadStats() {
        // Load or initialize statistics data
        const statsJson = this._settings.get_string('statistics-data');
        try {
            this._stats = statsJson ? JSON.parse(statsJson) : { daily: {} };
            // Ensure pomodoros key doesn't exist (cleanup old data structure)
            if (this._stats.pomodoros) {
                delete this._stats.pomodoros;
            }
        } catch (e) {
            this._stats = { daily: {} };
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

    _buildUI() {
        // Panel label (no icon - cleaner look)
        this._panelBox = new St.BoxLayout({
            style_class: 'wellbeing-panel-box'
        });

        this._label = new St.Label({
            text: 'Loading…',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'wellbeing-panel-label',
            accessible_name: 'Daily Screen Time'
        });

        this._panelBox.add_child(this._label);
        this.add_child(this._panelBox);

        // Menu styling
        this.menu.box.style_class = 'wellbeing-menu';

        // Statistics section (Weekly only) with average on the right
        const statsHeader = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        const statsHeaderBox = new St.BoxLayout({
            vertical: false,
            style_class: 'wellbeing-stats-header-box',
            x_expand: true
        });
        const statsTitle = new St.Label({
            text: 'Weekly Overview',
            style_class: 'wellbeing-section-header'
        });
        this._avgLabel = new St.Label({
            text: 'Loading…',
            style_class: 'wellbeing-stats-avg-header'
        });
        statsHeaderBox.add_child(statsTitle);
        statsHeaderBox.add_child(this._avgLabel);
        statsHeader.add_child(statsHeaderBox);
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

        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings button
        const settingsItem = new PopupMenu.PopupBaseMenuItem({
            reactive: true,
            style_class: 'wellbeing-settings-item'
        });

        const settingsLabel = new St.Label({
            text: 'Settings',
            style_class: 'wellbeing-settings-label',
            x_align: Clutter.ActorAlign.CENTER
        });

        settingsItem.add_child(settingsLabel);

        settingsItem.connect('activate', () => {
            this._extension.openPreferences();
            this.menu.close();
        });

        this.menu.addMenuItem(settingsItem);

        // Update stats when menu opens - deferred for instant opening
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open) {
                // Defer updates to next idle cycle for instant menu opening
                GLib.idle_add(GLib.PRIORITY_LOW, () => {
                    // Only update stats if they're stale (no cache invalidation for instant opening)
                    const now = Date.now();
                    const statsCacheTime = 10000; // Update stats only if menu was closed for 10+ seconds

                    if (now - this._lastStatsUpdate > statsCacheTime) {
                        this._updateStatsView();
                        this._lastStatsUpdate = now;
                    }

                    // Record current stats (lightweight operation)
                    const screenTimeSeconds = this._getDailyScreenTimeSeconds();
                    if (screenTimeSeconds > 0) {
                        this._recordDailyStats(new Date(), screenTimeSeconds);
                    }

                    return GLib.SOURCE_REMOVE;
                });
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

            data.push({
                date: date,
                dateStr: dateStr,
                screenTime: screenTime
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

        sharedTooltip.add_child(tooltipDate);
        sharedTooltip.add_child(tooltipTime);

        // Find max values for scaling
        const maxScreenTime = Math.max(...data.map(d => d.screenTime), 1);

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

            // Bar area container (fixed height) - bars grow from bottom
            const barAreaBox = new St.BoxLayout({
                vertical: true,
                style_class: 'wellbeing-stats-bar-area',
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL
            });

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

            // Add hover effect - update shared tooltip content
            barContainer.connect('enter-event', () => {
                barContainer.add_style_class_name('wellbeing-stats-bar-hover');

                // Update tooltip content
                tooltipDate.text = dateStr;
                tooltipTime.text = timeStr;

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

        // Legend removed
    }

    _updateStatsSummary(data) {
        const totalScreenTime = data.reduce((sum, d) => sum + d.screenTime, 0);
        const avgScreenTime = data.length > 0 ? totalScreenTime / data.length : 0;

        const hours = Math.floor(avgScreenTime / 3600);
        const minutes = Math.floor((avgScreenTime % 3600) / 60);

        // Update the average label in the header
        if (this._avgLabel) {
            this._avgLabel.text = `Avg ${hours}h ${minutes}m/day`;
        }
    }

    _updateUI() {
        try {
            // Update live screen time asynchronously in background
            this._updateLiveScreenTime();

            const screenTime = this._getDailyScreenTime();

            // Update panel label with screen time
            this._label.text = screenTime.trim();

            // Record daily statistics (periodically, or when menu is open)
            const now = Date.now();
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

        // Detect midnight crossing - yesterday becomes the old day but NOT finalized yet
        if (todayStr !== this._lastRecordedDate) {
            log(`Wellbeing Widget: Day changed from ${this._lastRecordedDate} to ${todayStr}`);

            // DON'T finalize yesterday immediately - it will be finalized when it becomes 2 days old
            // This allows yesterday to be recalculated if needed (e.g., session history updates)

            // Update to new day
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

                    // Calculate historical days with proper finalization logic
                    for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
                        const pastDate = new Date(now);
                        pastDate.setDate(pastDate.getDate() - daysAgo);
                        const pastDateStr = pastDate.toISOString().split('T')[0];

                        // NEVER recalculate finalized days (days that are 2+ days old)
                        if (this._finalizedDays.has(pastDateStr)) {
                            continue; // Skip finalized days
                        }

                        // For yesterday (daysAgo === 1), ALWAYS recalculate until it's finalized
                        // For older days, only calculate if we don't have data yet
                        if (daysAgo === 1 || !this._stats.daily[pastDateStr]) {
                            const pastScreenTime = this._calculateDayScreenTime(historyData, pastDate, null);
                            const previousValue = this._stats.daily[pastDateStr];
                            this._stats.daily[pastDateStr] = pastScreenTime;

                            // Log only if value changed significantly (to reduce log spam)
                            if (previousValue === undefined || Math.abs(previousValue - pastScreenTime) > 60) {
                                log(`Wellbeing Widget: Updated ${daysAgo === 1 ? 'yesterday' : 'historical'} data for ${pastDateStr}: ${pastScreenTime} seconds`);
                            }

                            // Finalize yesterday once the day after tomorrow starts (it becomes 2 days old)
                            if (daysAgo === 2 && !this._finalizedDays.has(pastDateStr)) {
                                this._finalizedDays.add(pastDateStr);
                                log(`Wellbeing Widget: Finalized ${pastDateStr} with ${pastScreenTime} seconds (now 2 days old)`);
                            }
                        }
                    }

                    // Save stats (only when changed)
                    this._saveStats();
                    this._isLoadingScreenTime = false;
                    this._screenTimeError = null;
                } else {
                    // File doesn't exist or can't be read - normal on first install
                    if (this._isLoadingScreenTime) {
                        log(`Wellbeing Widget: Session history file not found - waiting for GNOME to create it`);
                        // Don't show error on first install, just show 0h 0m
                        this._screenTimeError = null;
                    }
                    this._isLoadingScreenTime = false;
                    this._cachedLiveSeconds = 0;
                }
            } catch (e) {
                // Gracefully handle errors
                if (e.message && e.message.includes('JSON')) {
                    log(`Wellbeing Widget: Session history file is empty or corrupted - waiting for valid data`);
                    this._screenTimeError = null; // Don't show error for empty/corrupted file
                } else {
                    log(`Wellbeing Widget: Error calculating live screen time: ${e.message}`);
                    this._screenTimeError = 'Data Error';
                }
                this._isLoadingScreenTime = false;
                this._cachedLiveSeconds = 0;
            }
        });
    }

    _getDailyScreenTime() {
        // Show loading state on first load
        if (this._isLoadingScreenTime && !this._cachedScreenTime) {
            return 'Loading…';
        }


        // Show error state if we have one (only for real errors, not missing file)
        if (this._screenTimeError) {
            return '⚠️ ' + this._screenTimeError;
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

    destroy() {
        if (this._updateTimer) {
            GLib.source_remove(this._updateTimer);
            this._updateTimer = null;
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
