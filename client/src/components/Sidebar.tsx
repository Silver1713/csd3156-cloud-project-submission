type SidebarItem =
  | "Dashboard"
  | "Products"
  | "Inventory Operations"
  | "Movement Logs"
  | "Inventory Adjustment"
  | "Metrics"
  | "Alerts"
  | "Organization"
  | "User Management"
  | "Profile"
  | "Settings";

type SidebarProps = {
  activeItem: SidebarItem;
  onSelect: (item: SidebarItem) => void;
  onSignOut?: () => void;
};

const primaryNavItems: Array<{ label: SidebarItem; icon: string }> = [
  { label: "Dashboard", icon: "dashboard" },
  { label: "Products", icon: "inventory_2" },
  { label: "Inventory Operations", icon: "inventory" },
  { label: "Movement Logs", icon: "swap_horiz" },
  { label: "Inventory Adjustment", icon: "edit_calendar" },
  { label: "Metrics", icon: "bar_chart" },
  { label: "Alerts", icon: "warning" },
];

const managementItems: Array<{ label: SidebarItem; icon: string }> = [
  { label: "Organization", icon: "corporate_fare" },
  { label: "User Management", icon: "group" },
];

export default function Sidebar({
  activeItem,
  onSelect,
  onSignOut,
}: SidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__logo">IL</div>
        <div>
          <h1>Indigo Ledger</h1>
          <p>Enterprise Inventory</p>
        </div>
      </div>

      <nav className="app-sidebar__nav">
        {primaryNavItems.map((item) => {
          const isActive = activeItem === item.label;

          return (
            <button
              key={item.label}
              type="button"
              className={`app-sidebar__link ${isActive ? "is-active" : ""}`}
              onClick={() => onSelect(item.label)}
            >
              <span className="app-sidebar__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="app-sidebar__section-label">Management</div>

        {managementItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`app-sidebar__link app-sidebar__link--aux ${
              activeItem === item.label ? "is-active" : ""
            }`}
            onClick={() => onSelect(item.label)}
          >
            <span className="app-sidebar__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        <button
          type="button"
          className={`app-sidebar__ghost ${activeItem === "Profile" ? "is-active" : ""}`}
          onClick={() => onSelect("Profile")}
        >
          <span className="app-sidebar__icon" aria-hidden="true">
            account_circle
          </span>
          <span>Profile</span>
        </button>
        <button
          type="button"
          className={`app-sidebar__ghost ${activeItem === "Settings" ? "is-active" : ""}`}
          onClick={() => onSelect("Settings")}
        >
          <span className="app-sidebar__icon" aria-hidden="true">
            settings
          </span>
          <span>Settings</span>
        </button>
        <button
          type="button"
          className="app-sidebar__ghost app-sidebar__ghost--danger"
          onClick={onSignOut}
        >
          <span className="app-sidebar__icon" aria-hidden="true">
            logout
          </span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
