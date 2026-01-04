import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WellbeingPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Main preferences page
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic'
        });

        // Data Management Group
        const dataGroup = new Adw.PreferencesGroup({
            title: 'Data Management',
            description: 'Manage your statistics data'
        });

        // Clear statistics button
        const clearStatsRow = new Adw.ActionRow({
            title: 'Clear Statistics',
            subtitle: 'Delete all recorded screen time data'
        });

        const clearButton = new Gtk.Button({
            label: 'Clear Data',
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action']
        });

        clearButton.connect('clicked', () => {
            const dialog = new Gtk.MessageDialog({
                transient_for: window,
                modal: true,
                buttons: Gtk.ButtonsType.YES_NO,
                message_type: Gtk.MessageType.WARNING,
                text: 'Clear All Statistics?',
                secondary_text: 'This will permanently delete all recorded screen time data. This action cannot be undone.'
            });

            dialog.connect('response', (dialog, response) => {
                if (response === Gtk.ResponseType.YES) {
                    settings.set_string('statistics-data', '');
                    // Show confirmation
                    const banner = new Adw.Toast({
                        title: 'Statistics cleared successfully',
                        timeout: 3
                    });
                    window.add_toast(banner);
                }
                dialog.destroy();
            });

            dialog.show();
        });

        clearStatsRow.add_suffix(clearButton);
        dataGroup.add(clearStatsRow);

        page.add(dataGroup);

        // About Group
        const aboutGroup = new Adw.PreferencesGroup({
            title: 'About',
            description: 'Screen Time Widget information'
        });

        const aboutRow = new Adw.ActionRow({
            title: 'Screen Time Widget',
            subtitle: 'A screen time tracker for GNOME'
        });

        const versionLabel = new Gtk.Label({
            label: 'v1.0',
            css_classes: ['dim-label'],
            valign: Gtk.Align.CENTER
        });

        aboutRow.add_suffix(versionLabel);
        aboutGroup.add(aboutRow);

        const githubForkRow = new Adw.ActionRow({
            title: 'This Fork (Screen Time Only)',
            subtitle: 'Simplified version - screen time tracking only'
        });

        const githubForkButton = new Gtk.LinkButton({
            label: 'View on GitHub',
            uri: 'https://github.com/itsmixu/screentime-gnome',
            valign: Gtk.Align.CENTER
        });

        githubForkRow.add_suffix(githubForkButton);
        aboutGroup.add(githubForkRow);

        const githubOriginalRow = new Adw.ActionRow({
            title: 'Original Repository',
            subtitle: 'Full version with pomodoro timer and music player'
        });

        const githubOriginalButton = new Gtk.LinkButton({
            label: 'View on GitHub',
            uri: 'https://github.com/mH-13/wellbeing-widget',
            valign: Gtk.Align.CENTER
        });

        githubOriginalRow.add_suffix(githubOriginalButton);
        aboutGroup.add(githubOriginalRow);

        page.add(aboutGroup);

        window.add(page);
    }
}
