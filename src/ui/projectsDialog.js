import { element } from './dom.js';

export function bindProjectsDialog({ document, projects, state }) {
  const byId = (id) => document.getElementById(id);
  const modal = byId('projectsModal');
  const form = byId('projectForm');
  const name = byId('projectName');
  const list = byId('projectList');
  const empty = byId('projectEmpty');
  const error = byId('projectError');
  const status = byId('projectStatus');
  const confirmation = byId('projectConfirmation');
  const confirmationText = byId('projectConfirmationText');
  const confirm = byId('confirmProjectAction');
  const cancel = byId('cancelProjectAction');
  const cleanup = [];
  let names = [];
  let currentName = null;
  let pending = null;
  let busy = false;
  let disposed = false;
  let refreshGeneration = 0;
  let loaded = false;

  function listen(node, event, handler) {
    node.addEventListener(event, handler);
    cleanup.push(() => node.removeEventListener(event, handler));
  }

  function showError(cause) {
    error.textContent = cause?.message || 'Local projects are unavailable.';
    error.hidden = false;
    status.textContent = '';
  }

  function clearMessages() {
    error.hidden = true;
    error.textContent = '';
    status.textContent = '';
  }

  function setBusy(value, message = '') {
    busy = value;
    form.querySelector('button').disabled = value;
    if (!value && !loaded) form.querySelector('button').disabled = true;
    list.querySelectorAll('button').forEach((button) => {
      button.disabled = value;
    });
    confirm.disabled = value;
    cancel.disabled = value;
    name.disabled = value;
    modal.setAttribute('aria-busy', String(value));
    if (message) status.textContent = message;
  }

  function clearConfirmation(restoreFocus = false) {
    const source = pending?.source;
    pending = null;
    confirmation.hidden = true;
    if (restoreFocus && source?.isConnected) source.focus();
  }

  function ask(message, label, action, source) {
    clearMessages();
    pending = { action, source };
    confirmationText.textContent = message;
    confirm.textContent = label;
    confirmation.hidden = false;
    confirm.focus();
  }

  function render() {
    list.replaceChildren();
    empty.hidden = names.length > 0;
    for (const projectName of names) {
      const item = element(document, 'li', 'project-item');
      const label = element(document, 'span', 'project-item-name', projectName);
      const open = element(document, 'button', '', 'Open');
      const remove = element(document, 'button', 'button-danger', 'Delete');
      open.type = remove.type = 'button';
      open.setAttribute('aria-label', `Open ${projectName}`);
      remove.setAttribute('aria-label', `Delete ${projectName}`);
      open.disabled = remove.disabled = busy;
      open.addEventListener('click', () => {
        const run = () =>
          execute(async () => {
            const result = await projects.open(projectName);
            if (!result.restored) {
              status.textContent =
                'Opening was cancelled; the current setup is unchanged.';
              return;
            }
            currentName = projectName;
            name.value = projectName;
            status.textContent = result.missingAssets?.length
              ? `Opened ${projectName} with ${result.missingAssets.length} missing model${result.missingAssets.length === 1 ? '' : 's'}. Placeholder objects keep their positions.`
              : `Opened ${projectName}.`;
          }, `Opening ${projectName}…`);
        if (state.objects.length)
          ask(
            `Open ${projectName}? This will replace the current setup. Save it first if you want to keep it.`,
            'Open project',
            run,
            open,
          );
        else run();
      });
      remove.addEventListener('click', () =>
        ask(
          `Delete ${projectName} from this browser? This cannot be undone.`,
          'Delete project',
          () =>
            execute(async () => {
              await projects.delete(projectName);
              if (currentName === projectName) currentName = null;
              await refresh();
              status.textContent = `Deleted ${projectName}.`;
            }, `Deleting ${projectName}…`),
          remove,
        ),
      );
      item.append(label, open, remove);
      list.append(item);
    }
  }

  async function refresh() {
    const generation = ++refreshGeneration;
    loaded = false;
    form.querySelector('button').disabled = true;
    status.textContent = 'Loading local projects…';
    empty.hidden = true;
    try {
      const result = await projects.list();
      if (disposed || generation !== refreshGeneration) return;
      names = result.sort((a, b) => a.localeCompare(b));
      loaded = true;
      form.querySelector('button').disabled = busy;
      render();
      status.textContent = '';
    } catch (cause) {
      if (disposed || generation !== refreshGeneration) return;
      names = [];
      list.replaceChildren();
      empty.hidden = true;
      showError(cause);
    }
  }

  async function execute(action, message) {
    if (busy) return;
    if (!loaded) return;
    const returnFocus = pending?.source;
    clearMessages();
    if (returnFocus) modal.focus();
    clearConfirmation();
    setBusy(true, message);
    try {
      await action();
    } catch (cause) {
      if (!disposed) showError(cause);
    } finally {
      if (!disposed) {
        setBusy(false);
        if (returnFocus) (returnFocus.isConnected ? returnFocus : name).focus();
      }
    }
  }

  listen(modal, 'show.bs.modal', () => {
    clearMessages();
    clearConfirmation();
    name.value = currentName || '';
    refresh();
  });
  listen(modal, 'shown.bs.modal', () => name.focus());
  listen(modal, 'hide.bs.modal', (event) => {
    if (busy) event.preventDefault();
    else clearConfirmation();
  });
  listen(form, 'submit', async (event) => {
    event.preventDefault();
    if (busy || !loaded) return;
    const projectName = name.value.trim();
    if (!projectName || projectName.length > 200) {
      showError(new Error('Choose a project name of 1 to 200 characters.'));
      name.focus();
      return;
    }
    const run = () =>
      execute(async () => {
        await projects.save(projectName);
        currentName = projectName;
        await refresh();
        status.textContent = `Saved ${projectName} in this browser.`;
      }, `Saving ${projectName}…`);
    setBusy(true, 'Checking local projects…');
    try {
      names = (await projects.list()).sort((a, b) => a.localeCompare(b));
      if (disposed) return;
      render();
    } catch (cause) {
      if (!disposed) showError(cause);
      return;
    } finally {
      if (!disposed) setBusy(false);
    }
    if (names.includes(projectName))
      ask(
        `Overwrite ${projectName} with the current setup? The previous saved version will be replaced.`,
        'Overwrite project',
        run,
        form.querySelector('button'),
      );
    else run();
  });
  listen(confirm, 'click', () => pending?.action());
  listen(cancel, 'click', () => clearConfirmation(true));
  listen(modal, 'keydown', (event) => {
    if (event.key === 'Escape' && pending && !busy) {
      event.stopPropagation();
      event.preventDefault();
      clearConfirmation(true);
    }
  });
  return () => {
    disposed = true;
    refreshGeneration++;
    cleanup.forEach((remove) => remove());
  };
}
