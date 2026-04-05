import { useEffect, useMemo, useState } from "react";

import {
  createOrganizationRole,
  getOrganizationPermissions,
  listOrganizationMembers,
  listOrganizationRoles,
  removeOrganizationMember,
  updateOrganizationMember,
  type OrganizationMember,
  type OrganizationMembershipTransfer,
  type OrganizationRole,
  type PermissionCatalogEntry,
} from "../../services/api.service";
import {
  cacheOrganizationSummary,
  cacheResolvedAccount,
  getStoredResolvedAccount,
} from "../../services/auth.service";
import "./user-management-page.css";

const ROLE_TEMPLATES = [
  {
    key: "custom",
    label: "Custom",
    description: "Start from scratch and choose permissions manually.",
    permissions: [] as string[],
  },
  {
    key: "viewer",
    label: "Viewer",
    description: "Read-only access across organization, product, and inventory data.",
    permissions: [
      "organization:read",
      "organization:members:read",
      "category:read",
      "product:read",
      "inventory:read",
      "stockmovement:read",
      "auth:read",
    ],
  },
  {
    key: "operator",
    label: "Inventory Operator",
    description: "Operate stock movement workflows and view supporting data.",
    permissions: [
      "organization:read",
      "organization:members:read",
      "category:read",
      "product:read",
      "inventory:read",
      "inventory:update",
      "stockmovement:read",
      "stockmovement:create",
      "auth:read",
    ],
  },
  {
    key: "manager",
    label: "Inventory Manager",
    description: "Manage catalog, category, inventory, and alert workflows.",
    permissions: [
      "organization:read",
      "organization:update",
      "organization:members:read",
      "category:create",
      "category:read",
      "category:update",
      "category:delete",
      "product:create",
      "product:read",
      "product:update",
      "product:delete",
      "inventory:read",
      "inventory:update",
      "stockmovement:read",
      "stockmovement:create",
      "alert:manage",
      "auth:read",
      "auth:update",
    ],
  },
  {
    key: "admin",
    label: "Organization Admin",
    description: "Manage members, roles, settings, and organization administration.",
    permissions: [
      "organization:read",
      "organization:update",
      "organization:members:read",
      "organization:members:invite",
      "organization:members:manage",
      "organization:manage",
      "category:create",
      "category:read",
      "category:update",
      "category:delete",
      "product:create",
      "product:read",
      "product:update",
      "product:delete",
      "inventory:read",
      "inventory:update",
      "stockmovement:read",
      "stockmovement:create",
      "alert:manage",
      "auth:read",
      "auth:update",
      "auth:link",
      "auth:manage",
    ],
  },
] as const;

const OWNER_ROLE_NAME = "owner";

function formatRoleLabel(member: OrganizationMember): string {
  return member.roleName ?? "Unassigned";
}

function formatRoleDisplay(role: OrganizationRole): string {
  return `${role.name} · L${role.level}`;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function UserManagementPage() {
  const currentAccountId = getStoredResolvedAccount()?.id ?? null;
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionCatalogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [draftRoles, setDraftRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleLevel, setRoleLevel] = useState("0");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("custom");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [creatingRole, setCreatingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<OrganizationRole | null>(null);
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUserManagement() {
      setLoading(true);
      setError(null);

      try {
        const [membersPayload, rolesPayload, permissionsPayload] = await Promise.all([
          listOrganizationMembers(),
          listOrganizationRoles(),
          getOrganizationPermissions(),
        ]);

        if (cancelled) {
          return;
        }

        setMembers(membersPayload.members);
        setRoles(rolesPayload.roles);
        setPermissions(permissionsPayload.permissions);
        setDraftRoles(
          Object.fromEntries(
            membersPayload.members.map((member) => [
              member.accountId,
              member.roleId ?? "",
            ]),
          ),
        );
        const currentRoleId = currentAccountId
          ? membersPayload.members.find((member) => member.accountId === currentAccountId)
              ?.roleId ?? null
          : null;
        const currentLevel = currentRoleId
          ? rolesPayload.roles.find((role) => role.id === currentRoleId)?.level ?? 0
          : 0;
        setRoleLevel(String(Math.max(currentLevel - 1, 0)));
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load user management data",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadUserManagement();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredMembers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return members;
    }

    return members.filter((member) =>
      [member.name, member.email, member.username, member.roleName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch)),
    );
  }, [members, searchTerm]);

  const selectedTemplate = useMemo(
    () =>
      ROLE_TEMPLATES.find((template) => template.key === selectedTemplateKey) ??
      ROLE_TEMPLATES[0],
    [selectedTemplateKey],
  );

  const rolesById = useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles],
  );

  const currentMember = useMemo(
    () =>
      currentAccountId
        ? members.find((member) => member.accountId === currentAccountId) ?? null
        : null,
    [currentAccountId, members],
  );

  const currentUserRole = useMemo(
    () => (currentMember?.roleId ? rolesById.get(currentMember.roleId) ?? null : null),
    [currentMember?.roleId, rolesById],
  );

  const currentUserRoleLevel = currentUserRole?.level ?? null;

  function getMemberRoleLevel(member: OrganizationMember): number | null {
    if (!member.roleId) {
      return null;
    }

    return rolesById.get(member.roleId)?.level ?? null;
  }

  function canManageMember(member: OrganizationMember): boolean {
    if (currentAccountId === member.accountId) {
      return false;
    }

    if (currentUserRoleLevel === null) {
      return false;
    }

    const memberRoleLevel = getMemberRoleLevel(member);

    return memberRoleLevel === null || memberRoleLevel < currentUserRoleLevel;
  }

  const assignableRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          role.name.trim().toLowerCase() !== OWNER_ROLE_NAME
          && (currentUserRoleLevel === null || role.level < currentUserRoleLevel),
      ),
    [currentUserRoleLevel, roles],
  );

  const maxCreatableRoleLevel =
    currentUserRoleLevel === null ? 0 : Math.max(currentUserRoleLevel - 1, 0);

  const selectedMemberIsSelf =
    selectedMember !== null && currentAccountId === selectedMember.accountId;
  const selectedMemberRoleLevel =
    selectedMember !== null ? getMemberRoleLevel(selectedMember) : null;
  const selectedMemberIsProtected =
    selectedMember !== null
    && (selectedMemberIsSelf
      || currentUserRoleLevel === null
      || (selectedMemberRoleLevel !== null
        && selectedMemberRoleLevel >= currentUserRoleLevel));
  const canLeaveSelectedMember =
    selectedMemberIsSelf && (currentUserRoleLevel === null || currentUserRoleLevel < 255);
  const leaveBlockedByOwnerRole =
    selectedMemberIsSelf && currentUserRoleLevel !== null && currentUserRoleLevel >= 255;
  const canRemoveSelectedMember =
    selectedMember !== null && !selectedMemberIsSelf && canManageMember(selectedMember);

  async function handleSaveRole(member: OrganizationMember): Promise<boolean> {
    const nextRoleId = draftRoles[member.accountId] || null;
    setSavingMemberId(member.accountId);
    setError(null);

    try {
      const payload = await updateOrganizationMember(member.accountId, {
        roleId: nextRoleId,
      });

      setMembers((current) =>
        current.map((entry) =>
          entry.accountId === member.accountId ? payload.member : entry,
        ),
      );
      return true;
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update member role",
      );
      return false;
    } finally {
      setSavingMemberId(null);
    }
  }

  async function handleRemoveMember(
    member: OrganizationMember,
  ): Promise<OrganizationMembershipTransfer | null> {
    setRemovingMemberId(member.accountId);
    setError(null);

    try {
      const payload = await removeOrganizationMember(member.accountId);

      if (payload.selfRemoved) {
        cacheResolvedAccount(payload.account);
        cacheOrganizationSummary(payload.organization);
      } else {
        setMembers((current) =>
          current.filter((entry) => entry.accountId !== member.accountId),
        );
      }

      return payload;
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Failed to remove organization member",
      );
      return null;
    } finally {
      setRemovingMemberId(null);
    }
  }

  function openMemberRoleModal(member: OrganizationMember) {
    setDraftRoles((current) => ({
      ...current,
      [member.accountId]: current[member.accountId] ?? member.roleId ?? "",
    }));
    setSelectedMember(member);
    setError(null);
  }

  async function handleCreateRole() {
    setCreatingRole(true);
    setRoleError(null);

    try {
      const payload = await createOrganizationRole({
        name: roleName.trim(),
        level: Number(roleLevel),
        permissions: selectedPermissions,
      });

      setRoles((current) =>
        [...current, payload.role].sort((left, right) =>
          right.level - left.level || left.name.localeCompare(right.name),
        ),
      );
      setRoleName("");
      setRoleLevel(String(maxCreatableRoleLevel));
      setSelectedTemplateKey("custom");
      setSelectedPermissions([]);
      setShowRoleModal(false);
    } catch (createError) {
      setRoleError(
        createError instanceof Error
          ? createError.message
          : "Failed to create role",
      );
    } finally {
      setCreatingRole(false);
    }
  }

  function togglePermission(permissionKey: string) {
    setSelectedPermissions((current) =>
      current.includes(permissionKey)
        ? current.filter((value) => value !== permissionKey)
        : [...current, permissionKey].sort(),
    );
    setSelectedTemplateKey("custom");
  }

  function applyRoleTemplate(templateKey: string) {
    setSelectedTemplateKey(templateKey);

    const template =
      ROLE_TEMPLATES.find((entry) => entry.key === templateKey) ?? ROLE_TEMPLATES[0];
    const availablePermissionKeys = new Set(permissions.map((entry) => entry.key));
    setSelectedPermissions(
      template.permissions.filter((permission) => availablePermissionKeys.has(permission)),
    );
  }

  return (
    <section className="page-panel user-management-page">
      <div className="page-panel__header">
        <div>
          <h2>User Management</h2>
          <p>Review organization members, assign roles, and define permission bundles.</p>
        </div>

        <div className="page-panel__actions">
          <input
            type="search"
            className="user-management-page__search"
            placeholder="Search members"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <button
            type="button"
            className="primary-btn"
            onClick={() => setShowRoleModal(true)}
          >
            Create Role
          </button>
        </div>
      </div>

      {error ? <p className="user-management-page__error">{error}</p> : null}

      <div className="user-management-page__summary-grid">
        <div className="user-management-page__summary-card">
          <span>Members</span>
          <strong>{members.length}</strong>
        </div>
        <div className="user-management-page__summary-card">
          <span>Roles</span>
          <strong>{roles.length}</strong>
        </div>
        <div className="user-management-page__summary-card">
          <span>Permissions</span>
          <strong>{permissions.length}</strong>
        </div>
      </div>

      <div className="product-table-wrapper">
        <table className="product-table user-management-page__table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Provider</th>
              <th>Updated</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td>Loading members...</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
              </tr>
            ) : filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const isProtected = !canManageMember(member);
                const memberRoleLevel = getMemberRoleLevel(member);

                return (
                  <tr key={member.accountId}>
                    <td>
                      <div className="product-info">
                        <div className="product-name-stack">
                          <span className="name">{member.name?.trim() || member.username}</span>
                          <span className="category-label">{member.email}</span>
                          <span className="category-label">@{member.username}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="user-management-page__role-cell">
                        <span className="product-sku">
                          {member.roleName
                            ? `${formatRoleLabel(member)}${memberRoleLevel !== null ? ` · L${memberRoleLevel}` : ""}`
                            : formatRoleLabel(member)}
                        </span>
                        {isProtected ? (
                          <span className="user-management-page__role-note">
                            {currentAccountId === member.accountId
                              ? "Your membership settings are view-only here."
                              : "This member has an equal or higher role level than your own."}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className="product-category">{member.authProvider}</span>
                    </td>
                    <td>
                      <span className="product-sku">{formatTimestamp(member.updatedAt)}</span>
                    </td>
                    <td>
                      <div className="user-management-page__actions">
                        <div className="action-btns-hidden user-management-page__role-actions">
                          <button
                            type="button"
                            className="btn-table-action"
                            aria-label={
                              isProtected
                                ? `View role details for ${member.email}`
                                : `Edit role for ${member.email}`
                            }
                            onClick={() => openMemberRoleModal(member)}
                          >
                            <span className="material-symbols-outlined">
                              {isProtected ? "info" : "edit"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="user-management-page__empty-cell">
                  No members match the current search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="product-table-wrapper">
        <table className="product-table user-management-page__roles-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Permissions</th>
              <th>Created</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.length > 0 ? (
              roles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <div className="product-name-stack">
                      <span className="name">{role.name}</span>
                      <span className="category-label">Level {role.level}</span>
                      <span className="category-label">{role.id}</span>
                    </div>
                  </td>
                  <td>
                    <span className="product-category">
                      {role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td>
                    <span className="product-sku">{formatTimestamp(role.createdAt)}</span>
                  </td>
                  <td>
                    <div className="action-btns-hidden user-management-page__role-actions">
                      <button
                        type="button"
                        className="btn-table-action"
                        aria-label={`View permissions for ${role.name}`}
                        onClick={() => setSelectedRole(role)}
                      >
                        <span className="material-symbols-outlined">info</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="user-management-page__empty-cell">
                  No roles are defined for this organization yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showRoleModal ? (
        <div
          className="dashboard-filter-backdrop"
          onClick={() => {
            if (!creatingRole) {
              setShowRoleModal(false);
            }
          }}
        >
          <div
            className="dashboard-filter-sheet user-management-page__modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dashboard-filter-sheet__header">
              <div>
                <h3>Create Role</h3>
                <p>Build a permission bundle for organization members.</p>
              </div>
              <button
                type="button"
                className="dashboard-filter-sheet__close"
                onClick={() => setShowRoleModal(false)}
                aria-label="Close role modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="dashboard-filter-sheet__body">
              <div className="dashboard-filter-group">
                <label htmlFor="role-template">Base Template</label>
                <select
                  id="role-template"
                  value={selectedTemplateKey}
                  onChange={(event) => applyRoleTemplate(event.target.value)}
                >
                  {ROLE_TEMPLATES.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.label}
                    </option>
                  ))}
                </select>
                <p className="user-management-page__helper">
                  {selectedTemplate.description}
                </p>
              </div>

              <div className="dashboard-filter-group">
                <label htmlFor="role-name">Role Name</label>
                <input
                  id="role-name"
                  type="text"
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  placeholder="e.g. warehouse_manager"
                />
              </div>

              <div className="dashboard-filter-group">
                <label htmlFor="role-level">Role Level</label>
                <input
                  id="role-level"
                  type="number"
                  min={0}
                  max={maxCreatableRoleLevel}
                  value={roleLevel}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);

                    if (Number.isNaN(nextValue)) {
                      setRoleLevel("0");
                      return;
                    }

                    const clamped = Math.min(
                      Math.max(nextValue, 0),
                      maxCreatableRoleLevel,
                    );
                    setRoleLevel(String(clamped));
                  }}
                />
                <p className="user-management-page__helper">
                  Higher levels can manage lower levels. Your current maximum creatable
                  level is {maxCreatableRoleLevel}.
                </p>
              </div>

              <div className="dashboard-filter-group">
                <label>Permissions</label>
                <div className="user-management-page__permission-picker user-management-page__permission-picker--scrollable">
                  {permissions.map((permission) => (
                    <label
                      key={permission.key}
                      className="user-management-page__permission-option"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(permission.key)}
                        onChange={() => togglePermission(permission.key)}
                      />
                      <span>{permission.key}</span>
                    </label>
                  ))}
                </div>
              </div>

              {roleError ? (
                <p className="user-management-page__error">{roleError}</p>
              ) : null}
            </div>

            <div className="dashboard-filter-sheet__footer">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowRoleModal(false)}
                disabled={creatingRole}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => void handleCreateRole()}
                disabled={
                  creatingRole
                  || roleName.trim().length === 0
                  || selectedPermissions.length === 0
                }
              >
                {creatingRole ? "Creating..." : "Create Role"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedMember ? (
        <div
          className="dashboard-filter-backdrop"
          onClick={() => {
            if (
              savingMemberId !== selectedMember.accountId
              && removingMemberId !== selectedMember.accountId
            ) {
              setSelectedMember(null);
            }
          }}
        >
          <div
            className="dashboard-filter-sheet user-management-page__modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dashboard-filter-sheet__header">
              <div>
                <h3>{selectedMemberIsProtected ? "Member Role Details" : "Edit Member Role"}</h3>
                <p>
                  {selectedMemberIsProtected
                    ? "This membership is view-only from the current account."
                    : "Update the organization role assigned to this member."}
                </p>
              </div>
              <button
                type="button"
                className="dashboard-filter-sheet__close"
                onClick={() => setSelectedMember(null)}
                aria-label="Close member role modal"
                disabled={
                  savingMemberId === selectedMember.accountId
                  || removingMemberId === selectedMember.accountId
                }
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="dashboard-filter-sheet__body">
              <div className="user-management-page__role-meta">
                <span>Member</span>
                <strong>{selectedMember.name?.trim() || selectedMember.username}</strong>
                <span>Email</span>
                <strong>{selectedMember.email}</strong>
                <span>Username</span>
                <strong>@{selectedMember.username}</strong>
                <span>Current role</span>
                <strong>
                  {selectedMember.roleName
                    ? `${formatRoleLabel(selectedMember)}${selectedMemberRoleLevel !== null ? ` · L${selectedMemberRoleLevel}` : ""}`
                    : formatRoleLabel(selectedMember)}
                </strong>
              </div>

              <div className="dashboard-filter-group">
                <label htmlFor="member-role-select">Assign role</label>
                <select
                  id="member-role-select"
                  value={draftRoles[selectedMember.accountId] ?? selectedMember.roleId ?? ""}
                  disabled={selectedMemberIsProtected}
                  onChange={(event) =>
                    setDraftRoles((current) => ({
                      ...current,
                      [selectedMember.accountId]: event.target.value,
                    }))
                  }
                >
                  {assignableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {formatRoleDisplay(role)}
                    </option>
                  ))}
                </select>
              </div>

              {leaveBlockedByOwnerRole ? (
                <p className="user-management-page__role-note">
                  Owners cannot leave the organization. Delete the organization from
                  the Organization page instead.
                </p>
              ) : null}
            </div>

            <div className="dashboard-filter-sheet__footer">
              {canRemoveSelectedMember ? (
                <button
                  type="button"
                  className="secondary-btn user-management-page__transfer-btn"
                  disabled={
                    removingMemberId === selectedMember.accountId
                    || savingMemberId === selectedMember.accountId
                  }
                  onClick={async () => {
                    const removed = await handleRemoveMember(selectedMember);
                    if (removed) {
                      setSelectedMember(null);
                    }
                  }}
                >
                  {removingMemberId === selectedMember.accountId
                    ? "Removing..."
                    : "Remove Member"}
                </button>
              ) : null}
              {canLeaveSelectedMember ? (
                <button
                  type="button"
                  className="secondary-btn user-management-page__transfer-btn"
                  disabled={
                    removingMemberId === selectedMember.accountId
                    || savingMemberId === selectedMember.accountId
                  }
                  onClick={async () => {
                    const removed = await handleRemoveMember(selectedMember);
                    if (removed?.selfRemoved) {
                      window.location.reload();
                    }
                  }}
                >
                  {removingMemberId === selectedMember.accountId
                    ? "Leaving..."
                    : "Leave Organization"}
                </button>
              ) : null}
              <button
                type="button"
                className="secondary-btn user-management-page__transfer-btn"
                disabled={
                  selectedMemberIsProtected ||
                  removingMemberId === selectedMember.accountId ||
                  savingMemberId === selectedMember.accountId
                }
                onClick={() =>
                  setError("Ownership transfer is not available yet.")
                }
              >
                Transfer Ownership
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setSelectedMember(null)}
                disabled={
                  savingMemberId === selectedMember.accountId
                  || removingMemberId === selectedMember.accountId
                }
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={
                  selectedMemberIsProtected ||
                  removingMemberId === selectedMember.accountId ||
                  savingMemberId === selectedMember.accountId ||
                  (draftRoles[selectedMember.accountId] ?? selectedMember.roleId ?? "") ===
                    (selectedMember.roleId ?? "")
                }
                onClick={async () => {
                  const saved = await handleSaveRole(selectedMember);
                  if (saved) {
                    setSelectedMember(null);
                  }
                }}
              >
                {savingMemberId === selectedMember.accountId ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedRole ? (
        <div
          className="dashboard-filter-backdrop"
          onClick={() => setSelectedRole(null)}
        >
          <div
            className="dashboard-filter-sheet user-management-page__modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dashboard-filter-sheet__header">
              <div>
                <h3>{selectedRole.name}</h3>
                <p>Permissions available to this role in the current organization.</p>
              </div>
              <button
                type="button"
                className="dashboard-filter-sheet__close"
                onClick={() => setSelectedRole(null)}
                aria-label="Close role details"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="dashboard-filter-sheet__body">
              <div className="user-management-page__role-meta">
                <span>Role ID</span>
                <strong>{selectedRole.id}</strong>
                <span>Role level</span>
                <strong>{selectedRole.level}</strong>
                <span>Created</span>
                <strong>{formatTimestamp(selectedRole.createdAt)}</strong>
              </div>

              <div className="dashboard-filter-group">
                <label>Permissions</label>
                <div className="user-management-page__permission-list">
                  {selectedRole.permissions.map((permission) => (
                    <span key={permission} className="dashboard-filter-pill">
                      {permission}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="dashboard-filter-sheet__footer">
              <button
                type="button"
                className="primary-btn"
                onClick={() => setSelectedRole(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
