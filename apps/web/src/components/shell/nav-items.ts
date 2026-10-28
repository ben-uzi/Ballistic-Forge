/**
 * The site's information architecture in one place.
 *
 * `ready` is flipped on as each phase lands, so the nav never links to a route
 * that does not exist yet and never pretends a pillar is finished. A disabled
 * item is shown greyed with "soon" — honest about what the pilot can do today.
 */
export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly ready: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/calc', label: 'The Lab', ready: true },
  { href: '/range', label: 'Range', ready: true },
  { href: '/suppressors', label: 'The Can', ready: true },
  { href: '/field', label: 'The Field', ready: false },
  { href: '/library', label: 'Library', ready: false },
  { href: '/rifles', label: 'Rifles', ready: true },
];
