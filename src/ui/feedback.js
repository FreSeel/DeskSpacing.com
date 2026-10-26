export function createFeedback(document) {
  const message = document.createElement('p');
  message.className = 'planner-feedback';
  message.setAttribute('role', 'alert');
  message.hidden = true;
  document.getElementById('rightSideContainer').append(message);
  const loading = document.createElement('p');
  loading.className = 'planner-loading';
  loading.setAttribute('role', 'status');
  loading.textContent = 'Loading your setup…';
  loading.hidden = true;
  document.getElementById('rightSideContainer').append(loading);
  const empty = document.createElement('p');
  empty.className = 'planner-empty';
  empty.textContent =
    'Your workspace is empty. Open Objects to add your first item.';
  empty.hidden = true;
  document.getElementById('rightSideContainer').append(empty);
  let isEmpty = false;
  let isLoading = false;
  return {
    empty(active) {
      isEmpty = active;
      empty.hidden = !isEmpty || isLoading;
    },
    loading(active) {
      isLoading = active;
      loading.hidden = !active;
      empty.hidden = !isEmpty || isLoading;
    },
    clear() {
      message.hidden = true;
      message.textContent = '';
    },
    error(error) {
      message.textContent =
        error.message || 'The setup could not be updated. Please try again.';
      message.hidden = false;
    },
    dispose() {
      message.remove();
      loading.remove();
      empty.remove();
    },
  };
}
