import { importLimits } from '../models/importLoader.js';
import { localModelSource, remoteModelSource } from '../models/importSource.js';

export function bindImportDialog({ document, modelImports, feedback, close }) {
  const byId = (id) => document.getElementById(id);
  const modal = byId('importModal');
  const form = byId('importForm');
  const inputs = byId('importInputs');
  const controls = inputs.querySelectorAll('input, button');
  const drop = byId('importDrop');
  const fileInput = byId('importFile');
  const url = byId('importUrl');
  const urlPanel = byId('importUrlPanel');
  const summary = byId('importFileSummary');
  const error = byId('importError');
  const progress = byId('importProgress');
  const submit = byId('submitImport');
  const cancel = byId('cancelImport');
  const cleanup = [];
  let file;
  let task;
  let succeeded = false;
  const fromFile = () => form.elements.importMethod.value === 'file';

  function listen(node, event, handler) {
    node.addEventListener(event, handler);
    cleanup.push(() => node.removeEventListener(event, handler));
  }

  function validate() {
    if (fromFile()) {
      if (!file) return '';
      try {
        localModelSource(file);
        if (!file.size) return 'This file is empty. Choose another model.';
        if (file.size > importLimits.maxBytes)
          return 'This file exceeds 32 MiB. Choose a smaller model.';
      } catch {
        return 'Choose a .glb or self-contained .gltf file.';
      }
    } else if (url.value.trim()) {
      try {
        remoteModelSource(url.value);
      } catch {
        return 'Enter a direct HTTP or HTTPS URL ending in .glb or .gltf.';
      }
    }
    return '';
  }

  function update(message = validate(), invalid = Boolean(message)) {
    const upload = fromFile();
    drop.inert = !upload;
    urlPanel.inert = upload;
    fileInput.setAttribute('aria-invalid', String(upload && invalid));
    url.setAttribute('aria-invalid', String(!upload && invalid));
    error.textContent = message;
    submit.disabled = Boolean(
      task || invalid || !(upload ? file : url.value.trim()),
    );
    byId('importFileDetails').hidden = !file;
    if (!file) {
      summary.textContent = '';
      return;
    }
    const units =
      file.size >= 1024 * 1024
        ? ['MiB', 1024 * 1024]
        : file.size >= 1024
          ? ['KiB', 1024]
          : ['B', 1];
    const [unit, divisor] = units;
    const size = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 1,
    }).format(file.size / divisor);
    const label = `${file.name} · ${size} ${unit}`;
    if (summary.textContent !== label) summary.textContent = label;
  }

  function selectFile(files) {
    if (files.length > 1) {
      file = undefined;
      fileInput.value = '';
      update('Choose one model at a time.');
      return;
    }
    file = files[0];
    update();
  }

  function stop() {
    if (task) modelImports.cancelImport(task);
    task = undefined;
    controls.forEach((control) => {
      control.disabled = false;
    });
    progress.replaceChildren();
    drop.removeAttribute('data-dragging');
  }

  listen(modal, 'keydown', (event) => {
    if (event.key !== 'Tab') return;
    const first = modal.querySelector('.modal-header button');
    const last = submit.disabled ? cancel : submit;
    if (event.shiftKey ? event.target !== first : event.target !== last) return;
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  });
  listen(modal, 'show.bs.modal', () => feedback.clear());
  listen(modal, 'shown.bs.modal', () => fileInput.focus());
  listen(modal, 'hide.bs.modal', stop);
  listen(modal, 'hidden.bs.modal', () => {
    if (succeeded) feedback.success('Model imported and selected.');
    succeeded = false;
    form.reset();
    file = undefined;
    update();
  });
  listen(inputs, 'change', (event) => {
    if (event.target === fileInput) selectFile(fileInput.files);
    else update();
  });
  listen(url, 'input', () => update());
  listen(byId('clearImportFile'), 'click', () => {
    file = undefined;
    fileInput.value = '';
    update();
    fileInput.focus();
  });
  listen(drop, 'dragover', (event) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    if (!task) drop.setAttribute('data-dragging', '');
  });
  listen(drop, 'dragleave', (event) => {
    if (!drop.contains(event.relatedTarget))
      drop.removeAttribute('data-dragging');
  });
  listen(drop, 'drop', (event) => {
    event.preventDefault();
    drop.removeAttribute('data-dragging');
    if (task || !event.dataTransfer.files.length) return;
    fileInput.value = '';
    selectFile(event.dataTransfer.files);
  });
  listen(form, 'submit', async (event) => {
    event.preventDefault();
    if (submit.disabled || task) return;
    let current;
    try {
      current = fromFile()
        ? modelImports.importModelFromFile(file)
        : modelImports.importModelFromUrl(url.value.trim());
      task = current;
      if (modelImports.getImportStatus(current).state === 'loading') {
        const spinner = document.createElement('span');
        spinner.className = 'spinner-border';
        spinner.setAttribute('aria-hidden', 'true');
        progress.replaceChildren(spinner, 'Importing model…');
      }
      controls.forEach((control) => {
        control.disabled = true;
      });
      update();
      cancel.focus();
      const object = await current.result;
      if (current !== task) return;
      if (object) {
        succeeded = true;
        task = undefined;
        close(modal);
      } else {
        stop();
        update('Import cancelled. You can try again.', false);
      }
    } catch (failure) {
      if (current && current !== task) return;
      const status = current && modelImports.getImportStatus(current);
      stop();
      update(status?.message || failure.message, false);
    }
  });
  update();
  return () => {
    stop();
    cleanup.forEach((remove) => remove());
  };
}
