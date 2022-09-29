/*
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
 *
 * based on https://github.com/m-weigand/mw_pinenote_misc
 *      and https://github.com/lovasoa/gnome-keyboard-backlight-menu
*/
'use strict';
const { Gio, GLib, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Clutter = imports.gi.Clutter;
const ByteArray = imports.byteArray;

function init() {
    ExtensionUtils.initTranslations(Me.metadata.uuid);
    return new Extension();
}

class Extension {
    constructor() {
        this._driver = null;
        this._settings_indicator = null;
        this._refresh_indicator = null;
        this._m_warm_backlight_slider = null;
    }

    enable() {
        this._driver = new DriverProxy();

        this._add_warm_indicator_to_main_gnome_menu();

        this._add_driver_options_menu();
        this._add_driver_mode_toggle();
        this._add_bw_threshold_slider();
        this._add_bw_dither_invert_toggle();
        this._add_auto_refresh_toggle();
        this._add_autorefresh_threshold_slider();
        this._add_waveform_buttons();

        this._add_redraw_screen_indicator();
    }

    _add_warm_indicator_to_main_gnome_menu() {
        this._m_warm_backlight_slider = new PopupMenu.PopupBaseMenuItem({ activate: true });

        this._warm_backlight_slider = new Slider.Slider(this._driver.warm_brightness);
        this._sliderChangedId = this._warm_backlight_slider.connect('notify::value',
            this._warm_backlight_slider_changed.bind(this));
        this._warm_backlight_slider.accessible_name = _("Warm Backlight Brightness");

        const icon = new St.Icon({
            icon_name: 'weather-clear-night-symbolic',
            style_class: 'popup-menu-icon',
        });
        this._m_warm_backlight_slider.add(icon);
        this._m_warm_backlight_slider.add_child(this._warm_backlight_slider);
        this._m_warm_backlight_slider.connect('button-press-event', (actor, event) => {
            return this._warm_backlight_slider.startDragging(event);
        });
        this._m_warm_backlight_slider.connect('key-press-event', (actor, event) => {
            return this._warm_backlight_slider.emit('key-press-event', event);
        });
        this._m_warm_backlight_slider.connect('scroll-event', (actor, event) => {
            return this._warm_backlight_slider.emit('scroll-event', event);
        });

        Main.panel.statusArea.aggregateMenu.menu.addMenuItem(this._m_warm_backlight_slider, 2);
    }

    _warm_backlight_slider_changed() {
        this._driver.warm_brightness = this._warm_backlight_slider.value;
    }

    _add_driver_options_menu() {
        let indicatorName = `${Me.metadata.name} Indicator`;
        this._settings_indicator = new PanelMenu.Button(0.0, indicatorName, false);
        let icon = new St.Icon({
            gicon: new Gio.ThemedIcon({ name: 'pda-symbolic' }),
            style_class: 'system-status-icon'
        });
        this._settings_indicator.add_child(icon);
        Main.panel.addToStatusArea(indicatorName, this._settings_indicator);
    }

    _add_driver_mode_toggle() {
        this.mitem_bw_mode = new PopupMenu.PopupSwitchMenuItem(
            "Black & White Mode", this._driver.bw_mode
        );
        this.mitem_bw_mode.connect('activate', () => {
            this._driver.bw_mode = !this._driver.bw_mode;
            this.mitem_bw_mode.setToggleState(this._driver.bw_mode);
        });
        this._settings_indicator.menu.addMenuItem(this.mitem_bw_mode);
    }

    _add_bw_threshold_slider() {
        this.m_bw_slider = new PopupMenu.PopupBaseMenuItem({ activate: true });
        this._settings_indicator.menu.addMenuItem(this.m_bw_slider);

        this._bw_slider = new Slider.Slider(this._driver.bw_threshold);
        this._sliderChangedId = this._bw_slider.connect('notify::value',
            this._bw_slider_changed.bind(this));
        this._bw_slider.accessible_name = _("BW Threshold");

        const icon = new St.Icon({
            icon_name: 'folder-templates-symbolic',
            style_class: 'popup-menu-icon',
        });
        this.m_bw_slider.add(icon);
        this.m_bw_slider.add_child(this._bw_slider);
        this.m_bw_slider.connect('button-press-event', (actor, event) => {
            return this._bw_slider.startDragging(event);
        });
        this.m_bw_slider.connect('key-press-event', (actor, event) => {
            return this._bw_slider.emit('key-press-event', event);
        });
        this.m_bw_slider.connect('scroll-event', (actor, event) => {
            return this._bw_slider.emit('scroll-event', event);
        });
    }

    _bw_slider_changed() {
        this._driver.bw_threshold = this._bw_slider.value;
    }

    _add_bw_dither_invert_toggle() {
        this.mitem_bw_dither_invert = new PopupMenu.PopupSwitchMenuItem(
            "Invert BW", this._driver.bw_dither_invert
        );
        this.mitem_bw_dither_invert.connect('activate', () => {
            this._driver.bw_dither_invert = !this._driver.bw_dither_invert;
            this.mitem_bw_dither_invert.setToggleState(this._driver.bw_dither_invert);
        });
        this._settings_indicator.menu.addMenuItem(this.mitem_bw_dither_invert);
    }

    _add_auto_refresh_toggle() {
        this.auto_refresh = new PopupMenu.PopupSwitchMenuItem(
            "Auto Refresh", this._driver.auto_refresh
        );
        this.auto_refresh.connect('activate', () => {
            this._driver.auto_refresh = !this._driver.auto_refresh;
            this.auto_refresh.setToggleState(this._driver.auto_refresh);
        });
        this._settings_indicator.menu.addMenuItem(this.auto_refresh);
    }

    _add_autorefresh_threshold_slider() {
        this.m_refresh_threshold_slider = new PopupMenu.PopupBaseMenuItem({ activate: true });
        this._settings_indicator.menu.addMenuItem(this.m_refresh_threshold_slider);

        this._refresh_threshold_slider = new Slider.Slider(this._driver.refresh_threshold);
        this._sliderChangedId = this._refresh_threshold_slider.connect('notify::value',
            this.__refresh_threshold_slider_changed.bind(this));
        this._refresh_threshold_slider.accessible_name = _("Autorefresh Threshold");

        const icon = new St.Icon({
            icon_name: 'view-refresh-symbolic',
            style_class: 'popup-menu-icon',
        });
        this.m_refresh_threshold_slider.add(icon);
        this.m_refresh_threshold_slider.add_child(this._refresh_threshold_slider);
        this.m_refresh_threshold_slider.connect('button-press-event', (actor, event) => {
            return this._refresh_threshold_slider.startDragging(event);
        });
        this.m_refresh_threshold_slider.connect('key-press-event', (actor, event) => {
            return this._refresh_threshold_slider.emit('key-press-event', event);
        });
        this.m_refresh_threshold_slider.connect('scroll-event', (actor, event) => {
            return this._refresh_threshold_slider.emit('scroll-event', event);
        });
    }

    __refresh_threshold_slider_changed() {
        this._driver.refresh_threshold = this._refresh_threshold_slider.value;
    }

    _add_waveform_buttons() {
        let item;
        item = new PopupMenu.PopupMenuItem(_('A2 Waveform'));
        item.connect('activate', () => { this._driver.waveform = 1; });
        this._settings_indicator.menu.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_('DU Waveform'));
        item.connect('activate', () => { this._driver.waveform = 2; });
        this._settings_indicator.menu.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_('GC16 Waveform'));
        item.connect('activate', () => { this._driver.waveform = 4; });
        this._settings_indicator.menu.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_('DU4 Waveform'));
        item.connect('activate', () => { this._driver.waveform = 7; });
        this._settings_indicator.menu.addMenuItem(item);
    }

    _add_redraw_screen_indicator() {
        let name = `${Me.metadata.name} Refresh Indicator`;
        this._refresh_indicator = new PanelMenu.Button(0.0, name, false);
        let icon = new St.Icon({
            gicon: new Gio.ThemedIcon({ name: 'view-refresh-symbolic' }),
            style_class: 'system-status-icon'
        });
        this._refresh_indicator.add_child(icon);
        this._refresh_indicator.connect('event', (actor, event) => {
            if (
                event.type() == Clutter.EventType.TOUCH_END ||
                event.type() == Clutter.EventType.BUTTON_RELEASE
            )
                this._driver.redraw_screen();
        });
        Main.panel.addToStatusArea(name, this._refresh_indicator);
    }

    disable() {
        this._driver.destroy();
        this._driver = null;

        this._m_warm_backlight_slider.destroy();
        this._m_warm_backlight_slider = null;
        this._settings_indicator.destroy();
        this._settings_indicator = null;
        this._refresh_indicator.destroy();
        this._refresh_indicator = null;
    }
}

class DriverProxy {
    constructor() { }

    redraw_screen() {
        try {
            let proc = Gio.Subprocess.new(
                ['/usr/local/bin/refresh_screen'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (e) {
            logError(e);
        }
    }

    get bw_mode() {
        return this._read_from_sysfs(DriverProxy.bw_mode_file).replace(/[\n\r]/g, '') == "Y";
    }
    /** Equivalent of the original method. I dont particularly like that this method changes other
    params without informing their UI elements. My driver/UI separation also seems to make this
    harder (needs callbacks now). For myself, I therefore only changed the BW mode and no other
    params. At some point the driver should handle outside changes too (e.g. D-Bus)

    ```js
    set bw_mode(is_bw) {
        let new_value;
        let new_wf;
        let refresh_threshold;
        if (is_bw) {
            // fast mode
            new_value = 1;
            new_wf = 1;
            // now that we have dithering, dont't update that often anymore
            // refresh_threshold = 2
            refresh_threshold = 6;
        }
        else {
            // standard mode
            new_value = 0;
            new_wf = 4;
            refresh_threshold = 20;
        }
        this._write_to_sysfs(DriverProxy.refresh_threshold_file, refresh_threshold);
        this._write_to_sysfs(DriverProxy.bw_mode_file, new_value);
        this._write_to_sysfs(DriverProxy.default_waveform_file, new_wf);
    }
    ```
    */
    set bw_mode(is_bw) {
        this._write_to_sysfs(DriverProxy.bw_mode_file, is_bw ? "Y" : "N");
    }

    get bw_threshold() { return (this._read_from_sysfs(DriverProxy.bw_threshold_file) - 4) / 9; }
    set bw_threshold(threshold) {
        // original comment:
        // > transform to thresholds 1 to 7 in roughly similar-sized bins
        // i dont fully understand. This transforms slider space (0-1) to 4-13
        this._write_to_sysfs(DriverProxy.bw_threshold_file,
            4 + Math.floor(threshold * 9));
    }

    get bw_dither_invert() { return this._read_from_sysfs(DriverProxy.bw_dither_invert_file) == 1; }
    set bw_dither_invert(is_on) { this._write_to_sysfs(DriverProxy.bw_dither_invert_file, is_on ? 1 : 0); }

    // get waveform() { //TODO: untested
    //     let wf = this._read_from_sysfs(DriverProxy.default_waveform_file);
    //     try {
    //         return parseInt(wf, 10);
    //     } catch (error) {
    //         return 1;
    //     }
    // }
    set waveform(wf) { this._write_to_sysfs(DriverProxy.default_waveform_file, wf); }

    get auto_refresh() {
        return this._read_from_sysfs(DriverProxy.auto_refresh_file).replace(/[\n\r]/g, '') == "Y";
    }
    set auto_refresh(do_refresh) {
        this._write_to_sysfs(DriverProxy.auto_refresh_file, do_refresh ? "Y" : "N");
    }

    get refresh_threshold() {
        return (this._read_from_sysfs(DriverProxy.refresh_threshold_file) - 30) / 60;
    }
    set refresh_threshold(threshold) {
        // Transforms slider space (0-1) to 30-90
        this._write_to_sysfs(DriverProxy.refresh_threshold_file,
            30 + Math.floor(threshold * 60));
    }

    get warm_brightness() {
        return this._read_from_sysfs(DriverProxy.warm_backlight_brightness_file) /
            this._read_from_sysfs(DriverProxy.warm_backlight_max_brightness_file);
    }
    set warm_brightness(value) {
        const brightness = Math.round(value * this._read_from_sysfs(DriverProxy.warm_backlight_max_brightness_file));
        this._write_to_sysfs(DriverProxy.warm_backlight_brightness_file, brightness);
    }

    // _read_from_sysfs(filename) {
    //     const file = Gio.File.new_for_path(filename);
    //     const [, contents, etag] = file.load_contents(null);
    //     const ByteArray = imports.byteArray;
    //     const contentsString = ByteArray.toString(contents);
    //     return contentsString[0];
    // }

    _read_from_sysfs(filename) {
        // TODO: revert to original read
        try {
            let [, stdout, stderr, status] = GLib.spawn_command_line_sync('cat ' + filename);
            if (status !== 0) {
                if (stderr instanceof Uint8Array)
                    stderr = ByteArray.toString(stderr);

                throw new Error(stderr);
            }
            if (stdout instanceof Uint8Array)
                stdout = ByteArray.toString(stdout);
            return stdout;
        } catch (e) {
            logError(e);
        }
    }

    _write_to_sysfs(filename, value) {
        try {
            let proc = Gio.Subprocess.new(
                ['/bin/sh', '-c', `echo ${value} > ` + filename],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (e) {
            logError(e);
        }
    }
}

DriverProxy.bw_mode_file = '/sys/module/rockchip_ebc/parameters/bw_mode';
DriverProxy.bw_threshold_file = '/sys/module/rockchip_ebc/parameters/bw_threshold';
DriverProxy.bw_dither_invert_file = '/sys/module/rockchip_ebc/parameters/bw_dither_invert';
DriverProxy.default_waveform_file = '/sys/module/rockchip_ebc/parameters/default_waveform';
DriverProxy.warm_backlight_brightness_file = "/sys/class/backlight/backlight_warm/brightness";
DriverProxy.warm_backlight_max_brightness_file = "/sys/class/backlight/backlight_warm/max_brightness";
DriverProxy.auto_refresh_file = '/sys/module/rockchip_ebc/parameters/auto_refresh';
DriverProxy.refresh_threshold_file = '/sys/module/rockchip_ebc/parameters/refresh_threshold';
