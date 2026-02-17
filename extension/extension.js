import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

let _timeouts = [];
let _windowCreatedSignalId = null;
let _bootstrapped = false;

function logInfo(msg) {
  log(`[CustomWorkspaces] ${msg}`);
}

function readFile(path) {
  try {
    const file = Gio.File.new_for_path(path);
    const [ok, contents] = file.load_contents(null);
    if (!ok) return null;
    return new TextDecoder('utf-8').decode(contents);
  } catch (e) {
    logInfo(`readFile failed: ${e}`);
    return null;
  }
}

function expandTilde(s) {
  if (!s) return s;
  if (s.startsWith('~/')) return `${GLib.get_home_dir()}/${s.slice(2)}`;
  return s;
}

function parseCommand(cmd) {
  const expanded = expandTilde(cmd);
  try {
    return GLib.shell_parse_argv(expanded)[1];
  } catch (e) {
    logInfo(`shell_parse_argv failed for "${cmd}": ${e}`);
    return null;
  }
}

function spawn(cmd) {
  const argv = parseCommand(cmd);
  if (!argv) return;

  try {
    GLib.spawn_async(
      null,
      argv,
      null,
      GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
      null
    );
    logInfo(`spawn: ${cmd}`);
  } catch (e) {
    logInfo(`spawn failed for "${cmd}": ${e}`);
  }
}

function setWorkspaceCount(count) {
  try {
    // Désactive les workspaces dynamiques
    const mutter = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
    mutter.set_boolean('dynamic-workspaces', false);

    // Définit un nombre fixe de workspaces
    const wm = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.preferences' });
    wm.set_uint('num-workspaces', count);

    logInfo(`set static workspaces = ${count}`);
  } catch (e) {
    logInfo(`setWorkspaceCount failed: ${e}`);
  }
}

function activateWorkspace(index) {
  try {
    const ws = global.workspace_manager.get_workspace_by_index(index);
    if (ws) ws.activate(global.get_current_time());
  } catch (e) {
    logInfo(`activateWorkspace(${index}) failed: ${e}`);
  }
}

function moveWindowToWorkspace(win, index) {
  try {
    const ws = global.workspace_manager.get_workspace_by_index(index);
    if (!ws) return;
    win.change_workspace(ws);
  } catch (e) {
    logInfo(`moveWindowToWorkspace failed: ${e}`);
  }
}

function getWindowAppId(win) {
  try {
    const app = win.get_app?.();
    if (app) {
      const id = app.get_id?.();
      if (id) return id.replace(/\.desktop$/, '');
    }
  } catch (_) {}

  try {
    const wmClass = win.get_wm_class?.();
    if (wmClass) return wmClass;
  } catch (_) {}

  return null;
}

function windowTitle(win) {
  try {
    return win.get_title?.() ?? '';
  } catch (_) {
    return '';
  }
}

function compileRegex(pattern) {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, 'i');
  } catch (e) {
    logInfo(`Invalid regex "${pattern}": ${e}`);
    return null;
  }
}

function matchesRule(win, rule) {
  const match = rule.match ?? {};
  const targetAppId = match.appId ?? null;
  const titleRegex = match.titleRegex ?? null;

  const appId = getWindowAppId(win);
  if (targetAppId) {
    if (!appId || appId !== targetAppId) return false;
  }

  if (titleRegex) {
    const re = compileRegex(titleRegex);
    if (!re) return false;
    if (!re.test(windowTitle(win))) return false;
  }

  return true;
}

function schedule(ms, fn) {
  const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    try { fn(); } catch (e) { logInfo(`scheduled fn failed: ${e}`); }
    return GLib.SOURCE_REMOVE;
  });
  _timeouts.push(id);
  return id;
}

function clearSchedules() {
  for (const id of _timeouts) {
    try { GLib.source_remove(id); } catch (_) {}
  }
  _timeouts = [];
}

function loadConfig() {
  const uuid = 'custom-workspaces@maximelego.local';
  const extDir = `${GLib.get_home_dir()}/.local/share/gnome-shell/extensions/${uuid}`;
  const path = `${extDir}/config.json`;

  const raw = readFile(path);
  if (!raw) {
    logInfo(`No config found at ${path}`);
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    logInfo(`Invalid config JSON: ${e}`);
    return null;
  }
}

function bootstrap(config) {
  const wsCount = config.workspaceCount ?? 6;
  const startupDelayMs = config.startupDelayMs ?? 7000;
  const stepDelayMs = config.stepDelayMs ?? 900;
  const focusAfter = config.focusWorkspaceIndexAfter ?? 0;

  setWorkspaceCount(wsCount);

  schedule(startupDelayMs, () => {
    const groups = config.workspaces ?? [];
    let t = 0;

    for (const group of groups) {
      const idx = group.index ?? 0;
      const commands = group.commands ?? [];

      schedule(t, () => activateWorkspace(idx));
      t += stepDelayMs;

      for (const cmd of commands) {
        schedule(t, () => spawn(cmd));
        t += stepDelayMs;
      }
    }

    schedule(t + stepDelayMs, () => activateWorkspace(focusAfter));
  });
}

function enableDynamicRules(config) {
  const enabled = config.dynamicRulesEnabled ?? false;
  if (!enabled) return;

  const rules = config.dynamicRules ?? [];
  if (!rules.length) return;

  _windowCreatedSignalId = global.display.connect('window-created', (_display, win) => {
    schedule(250, () => {
      for (const rule of rules) {
        if (matchesRule(win, rule)) {
          moveWindowToWorkspace(win, rule.workspaceIndex ?? 0);
          break;
        }
      }
    });
  });

  logInfo(`Dynamic rules enabled (${rules.length} rules).`);
}

function disableDynamicRules() {
  if (_windowCreatedSignalId) {
    try { global.display.disconnect(_windowCreatedSignalId); } catch (_) {}
    _windowCreatedSignalId = null;
  }
}

export default class CustomWorkspacesExtension {
  enable() {
    logInfo('Enabling...');

    if (_bootstrapped) {
      logInfo('Already bootstrapped, skipping.');
      return;
    }

    const config = loadConfig();
    if (!config) {
      logInfo('No config; nothing to do.');
      return;
    }

    enableDynamicRules(config);
    bootstrap(config);

    _bootstrapped = true;

    logInfo('Enabled.');
  }

  disable() {
    logInfo('Disabling...');
    disableDynamicRules();
    clearSchedules();
  }
}
