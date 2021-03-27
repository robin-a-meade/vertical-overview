const __DEBUG__ = true;

const Gi = imports._gi;
const { Gio, Meta, Shell, Clutter, GObject} = imports.gi;
const WindowManager = imports.ui.windowManager;
const WorkspacesView = imports.ui.workspacesView;
const OverviewControls = imports.ui.overviewControls;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const Main = imports.ui.main;
const Overview = imports.ui.overview;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const OverviewControlsOverrides = Self.imports.overviewControls;
const WorkspacesViewOverrides = Self.imports.workspacesView;
const WorkspaceThumbnailOverrides = Self.imports.workspaceThumbnail;
const SwipeTracker = Self.imports.swipeTracker;


const USE_3_FINGER_SWIPES = false;

function init() {
    global.vertical_overview = {};
    global.vertical_overview.GSFunctions = {};
}


function replaceSwipeTracker() {
    if(USE_3_FINGER_SWIPES) {
        global.vertical_overview.swipeTracker = Main.overview._swipeTracker;
        global.vertical_overview.swipeTracker.enabled = false;

        const swipeTracker = new SwipeTracker.SwipeTracker(global.stage,
            Clutter.Orientation.VERTICAL,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            { allowDrag: false, allowScroll: false });
        swipeTracker.connect('begin', Main.overview._gestureBegin.bind(Main.overview));
        swipeTracker.connect('update', Main.overview._gestureUpdate.bind(Main.overview));
        swipeTracker.connect('end', Main.overview._gestureEnd.bind(Main.overview));
        Main.overview._swipeTracker = swipeTracker;
    } else {
        let workspacesDisplay = Main.overview._overview._controls._workspacesDisplay;
        global.vertical_overview.swipeTracker = workspacesDisplay._swipeTracker;
        global.vertical_overview.swipeTracker.enabled = false;

        const swipeTracker = new SwipeTracker.SwipeTracker(
            Main.layoutManager.overviewGroup,
            Clutter.Orientation.VERTICAL,
            Shell.ActionMode.OVERVIEW,
            { allowDrag: false });
        swipeTracker.allowLongSwipes = true;
        swipeTracker.connect('begin', workspacesDisplay._switchWorkspaceBegin.bind(workspacesDisplay));
        swipeTracker.connect('update', workspacesDisplay._switchWorkspaceUpdate.bind(workspacesDisplay));
        swipeTracker.connect('end', workspacesDisplay._switchWorkspaceEnd.bind(workspacesDisplay));
        workspacesDisplay._swipeTracker = swipeTracker;


        let workspaceAnimation = Main.wm._workspaceAnimation;
        global.vertical_overview.animationSwipeTracker = workspaceAnimation._swipeTracker;
        global.vertical_overview.animationSwipeTracker.enabled = false;

        const swipeTrackerAnimation = new SwipeTracker.SwipeTracker(global.stage,
            Clutter.Orientation.VERTICAL,
            Shell.ActionMode.NORMAL,
            { allowDrag: false });
        swipeTrackerAnimation.connect('begin', workspaceAnimation._switchWorkspaceBegin.bind(workspaceAnimation));
        swipeTrackerAnimation.connect('update', workspaceAnimation._switchWorkspaceUpdate.bind(workspaceAnimation));
        swipeTrackerAnimation.connect('end', workspaceAnimation._switchWorkspaceEnd.bind(workspaceAnimation));
        workspaceAnimation._swipeTracker = swipeTrackerAnimation;

        global.display.bind_property('compositor-modifiers',
            workspaceAnimation._swipeTracker, 'scroll-modifiers',
            GObject.BindingFlags.SYNC_CREATE);

    }
}

function undoReplaceSwipeTracker() {

    if(USE_3_FINGER_SWIPES) {
        var swipeTracker = Main.overview._swipeTracker;
        Main.overview._swipeTracker = global.vertical_overview.swipeTracker;
        swipeTracker.destroy();
        delete swipeTracker;
        Main.overview._swipeTracker.enabled = true;
    } else {
        let workspacesDisplay = Main.overview._overview._controls._workspacesDisplay;
        var swipeTracker = workspacesDisplay._swipeTracker;
        workspacesDisplay._swipeTracker = global.vertical_overview.swipeTracker;
        swipeTracker.destroy();
        delete swipeTracker;

        let workspaceAnimation = Main.wm._workspaceAnimation;
        let animationSwipeTracker = workspaceAnimation._swipeTracker;
        animationSwipeTracker.destroy();
        delete animationSwipeTracker;

        workspaceAnimation._swipeTracker = global.vertical_overview.animationSwipeTracker;
        workspaceAnimation._swipeTracker.enabled = true;
    }

}

function enable() {
    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] starting overrides");

    global.vertical_overview.GSFunctions['ControlsManagerLayout'] = overrideProto(OverviewControls.ControlsManagerLayout.prototype, OverviewControlsOverrides.ControlsManagerLayout);
    global.vertical_overview.GSFunctions['ControlsManager'] = overrideProto(OverviewControls.ControlsManager.prototype, OverviewControlsOverrides.ControlsManager);
    global.vertical_overview.GSFunctions['WorkspacesView'] = overrideProto(WorkspacesView.WorkspacesView.prototype, WorkspacesViewOverrides.WorkspacesView);
    global.vertical_overview.GSFunctions['ThumbnailsBox'] = overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, WorkspaceThumbnailOverrides.ThumbnailsBox);

    Main.overview._overview._controls._workspacesDisplay.set_clip_to_allocation(true);
    Main.overview._overview._controls.dash.hide();

    //rebind keys because apparently bound functions don't always update if the prototype for that function is changed
    rebind_keys(Main.overview._overview._controls);

    //fixing gestures
    replaceSwipeTracker();

    //this is the magic function that switches the internal layout to vertical
    global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, true, -1, 1);

    if (__DEBUG__) global.log("[VERTICAL_OVERVIEW] enabled");
}

function disable() {
    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] resetting overrides");
    overrideProto(OverviewControls.ControlsManagerLayout.prototype, global.vertical_overview.GSFunctions['ControlsManagerLayout']);
    overrideProto(OverviewControls.ControlsManager.prototype, global.vertical_overview.GSFunctions['ControlsManager']);
    overrideProto(WorkspacesView.WorkspacesView.prototype, global.vertical_overview.GSFunctions['WorkspacesView']);
    overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, global.vertical_overview.GSFunctions['ThumbnailsBox']);

    Main.overview._overview._controls._workspacesDisplay.set_clip_to_allocation(false);
    Main.overview._overview._controls.dash.show();
    rebind_keys(Main.overview._overview._controls);

    undoReplaceSwipeTracker();
    global.workspaceManager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, 1, -1);

    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] disabled");
}

function hookVfunc(proto, symbol, func) {
    proto[Gi.hook_up_vfunc_symbol](symbol, func);
}

function overrideProto(proto, overrides)  {
    backup = {}
    for (var symbol in overrides) {
        backup[symbol] = proto[symbol];
        if(symbol.startsWith('vfunc')){
            hookVfunc(proto, symbol.substr(6), overrides[symbol]);
        } else {
            proto[symbol] = overrides[symbol];
        }
    }
    return backup;
}

function rebind_keys(self) {
    Main.wm.removeKeybinding('toggle-application-view');
    Main.wm.removeKeybinding('shift-overview-up');
    Main.wm.removeKeybinding('shift-overview-down')
    Main.wm.addKeybinding(
        'toggle-application-view',
        new Gio.Settings({ schema_id: WindowManager.SHELL_KEYBINDINGS_SCHEMA }),
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        self._toggleAppsPage.bind(self));

    Main.wm.addKeybinding('shift-overview-up',
        new Gio.Settings({ schema_id: WindowManager.SHELL_KEYBINDINGS_SCHEMA }),
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        () => self._shiftState(Meta.MotionDirection.UP));

    Main.wm.addKeybinding('shift-overview-down',
        new Gio.Settings({ schema_id: WindowManager.SHELL_KEYBINDINGS_SCHEMA }),
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        () => self._shiftState(Meta.MotionDirection.DOWN))
}