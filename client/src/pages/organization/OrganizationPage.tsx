import { useEffect, useState } from "react";
import GlassDialog from "../../components/GlassDialog";
import type { BackendAuthAccount } from "../../services/auth.service";

import {
  deleteOrganization,
  joinOrganization,
  regenerateOrganizationJoinKey,
  updateOrganization,
  type OrganizationSummary,
} from "../../services/api.service";
import "./organization-page.css";

type OrganizationPageProps = {
  organization: OrganizationSummary | null;
  onOrganizationUpdate?: (organization: OrganizationSummary) => void;
  onOrganizationDelete?: () => void;
  onAccountUpdate?: (account: BackendAuthAccount) => void;
};

export default function OrganizationPage({
  organization,
  onOrganizationUpdate,
  onOrganizationDelete,
  onAccountUpdate,
}: OrganizationPageProps) {
  const [name, setName] = useState("");
  const [criticalStockThreshold, setCriticalStockThreshold] = useState(10);
  const [lowStockThreshold, setLowStockThreshold] = useState(25);
  const [saving, setSaving] = useState(false);
  const [regeneratingJoinKey, setRegeneratingJoinKey] = useState(false);
  const [deletingOrganization, setDeletingOrganization] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [joinKeyInput, setJoinKeyInput] = useState("");
  const [joiningOrganization, setJoiningOrganization] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  useEffect(() => {
    setName(organization?.name ?? "");
    setCriticalStockThreshold(organization?.criticalStockThreshold ?? 10);
    setLowStockThreshold(organization?.lowStockThreshold ?? 25);
  }, [organization]);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timeoutId = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [success]);

  useEffect(() => {
    if (!copySuccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopySuccess(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [copySuccess]);

  const handleCopyJoinKey = async () => {
    if (!organization?.joinKey) {
      return;
    }

    await navigator.clipboard.writeText(organization.joinKey);
    setCopySuccess("Join key copied.");
  };

  const handleRegenerateJoinKey = async () => {
    if (!organization || !organization.capabilities.canRegenerateJoinKey) {
      return;
    }

    setRegeneratingJoinKey(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await regenerateOrganizationJoinKey();
      onOrganizationUpdate?.(result.organization);
      setCopySuccess(null);
      setSuccess("Organization join key regenerated.");
      setShowRegenerateDialog(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to regenerate organization join key.",
      );
    } finally {
      setRegeneratingJoinKey(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!organization || !organization.capabilities.canDeleteOrganization) {
      return;
    }

    setDeletingOrganization(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteOrganization(organization.id);
      onOrganizationDelete?.();
      setSuccess("Organization deleted.");
      setShowDeleteDialog(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to delete organization.",
      );
    } finally {
      setDeletingOrganization(false);
    }
  };

  const handleJoinOrganization = async () => {
    if (!joinKeyInput.trim()) {
      setError("Join key is required.");
      return;
    }

    setJoiningOrganization(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await joinOrganization(joinKeyInput.trim());
      onAccountUpdate?.(result.account);
      onOrganizationUpdate?.(result.organization);
      setJoinKeyInput("");
      setShowJoinDialog(false);
      setSuccess("Organization joined.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to join organization.",
      );
    } finally {
      setJoiningOrganization(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!organization) {
      setError("Organization settings are unavailable right now.");
      return;
    }

    if (!name.trim()) {
      setError("Organization name is required.");
      return;
    }

    if (criticalStockThreshold < 0) {
      setError("Critical stock threshold must be at least 0.");
      return;
    }

    if (lowStockThreshold < criticalStockThreshold) {
      setError(
        "Low stock threshold must be greater than or equal to critical stock threshold.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateOrganization(organization.id, {
        name: name.trim(),
        criticalStockThreshold,
        lowStockThreshold,
      });

      onOrganizationUpdate?.(result.organization);
      setSuccess("Organization settings updated.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to update organization settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-panel organization-page">
      <div className="page-panel__header">
        <div>
          <h2>Organization</h2>
          <p>Manage your organization name and org-wide stock thresholds.</p>
        </div>
      </div>

      <div className="organization-page__grid">
        <form className="organization-page__card" onSubmit={handleSubmit}>
          <div className="organization-page__card-header">
            <h3>Workspace Settings</h3>
            <p>
              These values define how the dashboard and product catalog classify
              stock health for this organization.
            </p>
          </div>

          <label className="organization-page__field">
            <span>Organization Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Organization name"
            />
          </label>

          {organization?.joinKey ? (
            <div className="organization-page__field">
              <span>Organization Join Key</span>
              <div className="organization-page__join-key-row">
                <input type="text" value={organization.joinKey} readOnly />
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => void handleCopyJoinKey()}
                >
                  Copy
                </button>
                {organization.capabilities.canRegenerateJoinKey ? (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setShowRegenerateDialog(true)}
                    disabled={regeneratingJoinKey}
                  >
                    {regeneratingJoinKey ? "Regenerating..." : "Regenerate"}
                  </button>
                ) : null}
              </div>
              <small>
                Share this 8-character key with a teammate to let them join this
                organization during registration.
              </small>
            </div>
          ) : (
            <div className="organization-page__field">
              <span>Organization Join Key</span>
              <small>
                You do not have permission to view or share this organization&apos;s
                join key.
              </small>
            </div>
          )}

          <div className="organization-page__field-grid">
            <label className="organization-page__field">
              <span>Critical Stock Threshold</span>
              <input
                type="number"
                min={0}
                value={criticalStockThreshold}
                onChange={(event) =>
                  setCriticalStockThreshold(Number(event.target.value))
                }
              />
              <small>Stock at or below this quantity is marked critical.</small>
            </label>

            <label className="organization-page__field">
              <span>Low Stock Threshold</span>
              <input
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(event) => setLowStockThreshold(Number(event.target.value))}
              />
              <small>
                Stock above critical and at or below this quantity is marked low.
              </small>
            </label>
          </div>

          {error ? (
            <p className="organization-page__message organization-page__message--error">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="organization-page__message organization-page__message--success">
              {success}
            </p>
          ) : null}

          {copySuccess ? (
            <p className="organization-page__message organization-page__message--success">
              {copySuccess}
            </p>
          ) : null}

          <div className="organization-page__actions">
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? "Saving..." : "Save Organization Settings"}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setShowJoinDialog(true)}
            >
              Join Another Organization
            </button>
          </div>

          {organization?.capabilities.canDeleteOrganization ? (
            <div className="organization-page__danger-zone">
              <div>
                <strong>Delete Organization</strong>
                <p>
                  Owners and organization managers can attempt organization deletion
                  from here. The backend will block deletion if dependent members or
                  inventory data still exist.
                </p>
              </div>
              <button
                type="button"
                className="danger-btn"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deletingOrganization}
              >
                {deletingOrganization ? "Deleting..." : "Delete Organization"}
              </button>
            </div>
          ) : null}
        </form>

        <aside className="organization-page__card organization-page__card--aside">
          <div className="organization-page__card-header">
            <h3>How Thresholds Work</h3>
            <p>Use stable defaults so every stock view behaves consistently.</p>
          </div>

          <div className="organization-page__guidance">
            <div>
              <strong>Critical</strong>
              <p>
                Urgent replenishment threshold. Items at or below this number need
                immediate attention.
              </p>
            </div>
            <div>
              <strong>Low</strong>
              <p>
                Early warning threshold. This should stay above critical to keep
                inventory health states meaningful.
              </p>
            </div>
            <div>
              <strong>Current Summary</strong>
              <p>
                Critical at <b>{criticalStockThreshold}</b>, low at{" "}
                <b>{lowStockThreshold}</b>.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <GlassDialog
        open={showJoinDialog}
        title="Join Another Organization"
        message="Enter an 8-character join key. This uses the same membership transfer flow as leaving your current organization and joining the new one."
        confirmLabel={joiningOrganization ? "Joining..." : "Join Organization"}
        busy={joiningOrganization}
        onConfirm={() => void handleJoinOrganization()}
        onCancel={() => {
          if (!joiningOrganization) {
            setShowJoinDialog(false);
          }
        }}
      >
        <label className="organization-page__field organization-page__dialog-field">
          <span>Join Key</span>
          <input
            type="text"
            value={joinKeyInput}
            onChange={(event) => setJoinKeyInput(event.target.value.toUpperCase())}
            placeholder="AB12CD34"
            maxLength={8}
          />
          <small>
            Owners cannot use this flow. They must delete the current organization instead.
          </small>
        </label>
      </GlassDialog>

      <GlassDialog
        open={showRegenerateDialog}
        title="Regenerate Join Key"
        message="Regenerate the organization join key? The previous key will stop working for new registrations."
        confirmLabel={regeneratingJoinKey ? "Regenerating..." : "Regenerate"}
        busy={regeneratingJoinKey}
        onConfirm={() => void handleRegenerateJoinKey()}
        onCancel={() => {
          if (!regeneratingJoinKey) {
            setShowRegenerateDialog(false);
          }
        }}
      />

      <GlassDialog
        open={showDeleteDialog}
        title="Delete Organization"
        message="Delete this organization? This action is blocked if dependent members or data still exist."
        confirmLabel={deletingOrganization ? "Deleting..." : "Delete Organization"}
        tone="danger"
        busy={deletingOrganization}
        onConfirm={() => void handleDeleteOrganization()}
        onCancel={() => {
          if (!deletingOrganization) {
            setShowDeleteDialog(false);
          }
        }}
      />
    </section>
  );
}
