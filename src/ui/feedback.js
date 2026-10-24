export function createFeedback(document) {
  const message = document.createElement('p');
  message.className = 'planner-feedback';
  message.setAttribute('role', 'alert');
  message.hidden = true;
  document.getElementById('rightSideContainer').append(message);
  return {
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
    },
  };
}
