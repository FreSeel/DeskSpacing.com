import { describeObject } from './objectPresentation.js';

// A flat view of store membership. Buttons keep object identity in this adapter;
// live Three.js objects remain the only source for selection and transforms.
export function bindSceneObjectList({ document, state, selection }) {
  const list = document.getElementById('sceneObjectList');
  const clear = document.getElementById('clearSceneSelection');
  let objects = [];
  function updateSelection() {
    for (const [index, button] of [
      ...list.querySelectorAll('button'),
    ].entries())
      button.setAttribute(
        'aria-pressed',
        String(objects[index] === selection.pickedObject),
      );
    clear.disabled = !selection.pickedObject;
  }
  function updateObjects() {
    const focused = list.contains(document.activeElement)
      ? Number(document.activeElement.dataset.index)
      : -1;
    objects = state.objects;
    list.replaceChildren(
      ...objects.map((object, index) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.index = String(index);
        const name = describeObject(object).name;
        button.textContent = `${name} (${object.name})`;
        button.setAttribute('aria-label', `Select ${name}, ${object.name}`);
        item.append(button);
        return item;
      }),
    );
    if (!objects.length) {
      const empty = document.createElement('li');
      empty.textContent = 'No objects in setup.';
      list.append(empty);
    }
    updateSelection();
    if (focused >= 0) {
      const buttons = list.querySelectorAll('button');
      buttons[Math.min(focused, objects.length - 1)]?.focus({
        preventScroll: true,
      });
    }
  }
  function choose(event) {
    const button = event.target.closest('button[data-index]');
    if (!button || !list.contains(button)) return;
    const object = objects[Number(button.dataset.index)];
    if (object && state.has(object)) selection.pick(object);
  }
  const deselect = () => selection.unselectPickedObject();
  list.addEventListener('click', choose);
  clear.addEventListener('click', deselect);
  const unsubscribeState = state.subscribe(updateObjects);
  const unsubscribeSelection = selection.subscribe(updateSelection);
  updateObjects();
  return () => {
    unsubscribeState();
    unsubscribeSelection();
    list.removeEventListener('click', choose);
    clear.removeEventListener('click', deselect);
  };
}
