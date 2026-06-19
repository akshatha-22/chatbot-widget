export type WidgetPosition = 'bottom-right' | 'bottom-left'

/** Desktop panel anchor (compact, auth, loading placeholders). */
export function desktopPanelClasses(position: WidgetPosition): string {
  const corner =
    position === 'bottom-left'
      ? 'md:left-[20px] md:right-auto md:origin-bottom-left'
      : 'md:right-[20px] md:left-auto md:origin-bottom-right'
  return `md:bottom-[100px] ${corner}`
}

/** Floating launcher button anchor. */
export function launcherAnchorClasses(position: WidgetPosition): string {
  return position === 'bottom-left'
    ? 'bottom-[20px] left-[20px] right-auto'
    : 'bottom-[20px] right-[20px] left-auto'
}
