// Only the scene backdrop follows UI theming. Authored assets, fog and lights
// retain their existing appearance; the renderer and controls stay alive.
export function bindWorkspaceTheme({ host, document, view }) {
  const apply = () => {
    const color = host
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--color-workspace')
      .trim();
    view.scene.background.set(color);
    view.invalidateScene();
  };
  apply();
  host.addEventListener('deskspacing:themechange', apply);
  return () => host.removeEventListener('deskspacing:themechange', apply);
}
