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
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
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
        this._pomoRemaining = 25 * 60;
        this._pomoRunning = false;
        this._breakReminders = true;
        this._lastBreakNotification = 0;

        this._buildUI();
        this._startUpdating();
    }

    _buildUI() {
        // Panel label
        this._label = new St.Label({
            text: '☀️ Loading…',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'wellbeing-panel-label'
        });
        this.add_child(this._label);

        // Menu styling
        this.menu.box.style_class = 'wellbeing-menu';

        // Header section
        const headerItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: 'wellbeing-header'
        });
        const headerBox = new St.BoxLayout({vertical: true, style_class: 'wellbeing-header-box'});
        const titleLabel = new St.Label({
            text: '🌿 Wellbeing Center',
            style_class: 'wellbeing-title'
        });
        headerBox.add_child(titleLabel);
        headerItem.add_child(headerBox);
        this.menu.addMenuItem(headerItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Screen time display
        this._screenItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            style_class: 'wellbeing-stat-item'
        });
        const screenBox = new St.BoxLayout({vertical: false, style_class: 'wellbeing-stat-box'});
        this._screenLabel = new St.Label({
            text: '📊 Daily Screen Time: calculating…',
            style_class: 'wellbeing-stat-label'
        });
        screenBox.add_child(this._screenLabel);
        this._screenItem.add_child(screenBox);
        this.menu.addMenuItem(this._screenItem);

        // Pomodoro display
        this._pomoItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            style_class: 'wellbeing-stat-item'
        });
        const pomoBox = new St.BoxLayout({vertical: false, style_class: 'wellbeing-stat-box'});
        this._pomoLabel = new St.Label({
            text: '🍅 Pomodoro: Ready',
            style_class: 'wellbeing-stat-label'
        });
        pomoBox.add_child(this._pomoLabel);
        this._pomoItem.add_child(pomoBox);
        this.menu.addMenuItem(this._pomoItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Pomodoro controls
        this._startPomodoro = new PopupMenu.PopupMenuItem('▶ Start Pomodoro');
        this._pausePomodoro = new PopupMenu.PopupMenuItem('⏸ Pause');
        this._resetPomodoro = new PopupMenu.PopupMenuItem('🔁 Reset');

        this.menu.addMenuItem(this._startPomodoro);
        this.menu.addMenuItem(this._pausePomodoro);
        this.menu.addMenuItem(this._resetPomodoro);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Break reminder toggle
        this._breakToggle = new PopupMenu.PopupSwitchMenuItem('🔔 Break Reminders', this._breakReminders);
        this.menu.addMenuItem(this._breakToggle);

        // Connect signals
        this._startPomodoro.connect('activate', () => this._startPomo());
        this._pausePomodoro.connect('activate', () => this._pausePomo());
        this._resetPomodoro.connect('activate', () => this._resetPomo());
        this._breakToggle.connect('toggled', (_item, state) => {
            this._breakReminders = state;
        });
    }

    _startUpdating() {
        this._updateUI();
        this._updateTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            this._updateUI();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _updateUI() {
        const screenTime = this._getDailyScreenTime();
        const pomoStatus = this._getPomoStatus();

        this._label.text = `☀️ ${screenTime}h • ${pomoStatus.short}`;
        this._screenLabel.text = `📊 Daily Screen Time: ${screenTime} hours`;
        this._pomoLabel.text = `🍅 Pomodoro: ${pomoStatus.full}`;

        // Break reminder (every 30 minutes of screen time)
        if (this._breakReminders) {
            const currentTime = Math.floor(Date.now() / 1000);
            if (currentTime - this._lastBreakNotification > 1800) {
                Main.notify('🌿 Time for a break!', 'You\'ve been working for a while. Stand up, stretch, and rest your eyes.');
                this._lastBreakNotification = currentTime;
            }
        }
    }

    _getDailyScreenTime() {
        // Mock function - replace with real API later
        const now = new Date();
        const minutes = (now.getHours() * 30 + now.getMinutes() / 2);
        return (minutes / 60).toFixed(1);
    }

    _startPomo() {
        if (this._pomoRunning) return;
        this._pomoRunning = true;
        Main.notify('🍅 Pomodoro started', 'Focus time begins. Stay concentrated!');
        this._pomoTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._pomoRemaining--;
            this._updateUI();
            if (this._pomoRemaining <= 0) {
                Main.notify('🌿 Pomodoro complete!', 'Great work! Take a 5-minute break.');
                this._resetPomo();
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
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
        this._pomoRemaining = 25 * 60;
        this._updateUI();
    }

    _getPomoStatus() {
        const minutes = Math.floor(this._pomoRemaining / 60);
        const seconds = this._pomoRemaining % 60;
        const short = this._pomoRunning ? `⏱ ${minutes}:${seconds.toString().padStart(2, '0')}` : '⏸';
        const full = this._pomoRunning
            ? `Running (${minutes}:${seconds.toString().padStart(2, '0')})`
            : 'Paused / Ready';
        return { short, full };
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
