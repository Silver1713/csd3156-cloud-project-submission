import { useEffect, useMemo, useState } from "react";
import GlassDialog from "../../components/GlassDialog";
import {
  changePasswordWithCognito,
  type BackendAuthAccount,
} from "../../services/auth.service";
import {
  createProfileImageUploadPresign,
  deleteMyAccount,
  updateMyProfile,
} from "../../services/api.service";

type ProfilePageProps = {
  account?: BackendAuthAccount | null;
  userEmail?: string;
  onAccountUpdate?: (account: BackendAuthAccount) => void;
  onSignOut?: () => void;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "IL";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hasUppercaseCharacter(value: string): boolean {
  return /[A-Z]/.test(value);
}

function hasSpecialCharacter(value: string): boolean {
  return /[^A-Za-z0-9]/.test(value);
}

export default function ProfilePage({
  account = null,
  userEmail = "",
  onAccountUpdate,
  onSignOut,
}: ProfilePageProps) {
  const [profileNameInput, setProfileNameInput] = useState(account?.name || "");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<string | null>(
    null,
  );
  const [profileImageRemoved, setProfileImageRemoved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const profileName = account?.name?.trim() || account?.username || "Authenticated user";
  const profileEmail = userEmail || account?.email || "No email available";
  const profileInitials = getInitials(profileName);
  const displayedProfileImage =
    profileImagePreviewUrl ??
    (profileImageRemoved ? null : (account?.profileUrl ?? null));
  const hasValidEmail = isValidEmail(profileEmail);
  const isCognitoAccount = account?.authProvider === "cognito";
  const displayUsername = useMemo(
    () => (account?.username ? `@${account.username}` : "Unavailable"),
    [account?.username],
  );
  const trimmedProfileName = profileNameInput.trim();
  const canSaveName =
    !isSaving &&
    (
      (trimmedProfileName.length > 0 &&
        trimmedProfileName !== (account?.name ?? "")) ||
      profileImageFile !== null ||
      profileImageRemoved
    );

  useEffect(() => {
    setProfileNameInput(account?.name || "");
  }, [account?.name]);

  useEffect(() => {
    return () => {
      if (profileImagePreviewUrl) {
        URL.revokeObjectURL(profileImagePreviewUrl);
      }
    };
  }, [profileImagePreviewUrl]);

  const canChangePassword =
    isCognitoAccount &&
    !isChangingPassword &&
    currentPassword.trim().length > 0 &&
    newPassword.trim().length >= 8 &&
    confirmPassword.trim().length > 0;
  const passwordChecks = [
    {
      label: "Minimum 8 characters",
      satisfied: newPassword.length >= 8,
    },
    {
      label: "At least one special character",
      satisfied: hasSpecialCharacter(newPassword),
    },
    {
      label: "At least one uppercase letter",
      satisfied: hasUppercaseCharacter(newPassword),
    },
  ];

  async function handleSaveProfile(): Promise<void> {
    if (!canSaveName) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      let profileImageObjectKey: string | null | undefined;

      if (profileImageFile) {
        const presignedUpload = await createProfileImageUploadPresign({
          filename: profileImageFile.name,
          contentType: profileImageFile.type,
        });

        const uploadResponse = await fetch(presignedUpload.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": profileImageFile.type,
          },
          body: profileImageFile,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload profile image");
        }

        profileImageObjectKey = presignedUpload.objectKey;
      } else if (profileImageRemoved) {
        profileImageObjectKey = null;
      }

      const result = await updateMyProfile({
        name:
          trimmedProfileName.length > 0 &&
          trimmedProfileName !== (account?.name ?? "")
            ? trimmedProfileName
            : undefined,
        profileImageObjectKey,
      });

      onAccountUpdate?.({
        id: result.user.id,
        orgId: result.user.orgId,
        profileUrl: result.user.profileUrl,
        name: result.user.name,
        username: result.user.username,
        email: result.user.email,
        authProvider: result.user.authProvider,
        cognitoSub: result.user.cognitoSub,
        roleId: result.user.roleId,
      });

      setProfileNameInput(result.user.name ?? "");
      setProfileImageFile(null);
      if (profileImagePreviewUrl) {
        URL.revokeObjectURL(profileImagePreviewUrl);
      }
      setProfileImagePreviewUrl(null);
      setProfileImageRemoved(false);
      setSaveMessage("Profile name updated.");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to update profile name",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangePassword(): Promise<void> {
    if (!isCognitoAccount || !canChangePassword) {
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      setPasswordMessage(null);
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError("New password must be different from the current password.");
      setPasswordMessage(null);
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);

    try {
      await changePasswordWithCognito({
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated.");
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : "Failed to update password",
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleDeleteAccount(): Promise<void> {
    if (isDeletingAccount) {
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      await deleteMyAccount();
      onSignOut?.();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete account",
      );
    } finally {
      setIsDeletingAccount(false);
    }
  }

  return (
    <section className="page-panel">
      <div className="profile-management__intro">
        <h2>Account Management</h2>
        <p>
          Manage your profile, security settings, and account access.
        </p>
      </div>

      <div className="profile-management__grid">
        <section className="profile-section profile-section--wide">
          <div className="profile-section__header">
            <div>
              <h3>
                <span className="app-sidebar__icon" aria-hidden="true">
                  person
                </span>
                Profile Details
              </h3>
              <p>Update your personal information and public profile.</p>
            </div>
          </div>

          <div className="profile-identity">
            <div className="profile-identity__avatar-wrap">
              <div className="profile-identity__avatar" aria-hidden="true">
                {displayedProfileImage ? (
                  <img
                    src={displayedProfileImage}
                    alt={profileName}
                    className="profile-identity__avatar-image"
                  />
                ) : (
                  profileInitials
                )}
              </div>
              <label
                className="profile-identity__avatar-action profile-identity__avatar-action--interactive"
                aria-label="Upload profile photo"
              >
                <span className="app-sidebar__icon" aria-hidden="true">
                  photo_camera
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="profile-identity__file-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setProfileImageFile(file);
                    setProfileImageRemoved(false);

                    if (profileImagePreviewUrl) {
                      URL.revokeObjectURL(profileImagePreviewUrl);
                    }

                    if (file) {
                      setProfileImagePreviewUrl(URL.createObjectURL(file));
                    } else {
                      setProfileImagePreviewUrl(null);
                    }
                  }}
                />
              </label>
            </div>

            <div className="profile-identity__meta">
              <h4>Profile Photo</h4>
              <p>Upload an image to S3 and save it to your current profile.</p>

              <div className="profile-identity__actions">
                <label className="profile-chip-btn profile-chip-btn--interactive">
                  Upload New
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="profile-identity__file-input"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setProfileImageFile(file);
                      setProfileImageRemoved(false);

                      if (profileImagePreviewUrl) {
                        URL.revokeObjectURL(profileImagePreviewUrl);
                      }

                      if (file) {
                        setProfileImagePreviewUrl(URL.createObjectURL(file));
                      } else {
                        setProfileImagePreviewUrl(null);
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="profile-text-btn"
                  disabled={!displayedProfileImage}
                  onClick={() => {
                    setProfileImageFile(null);
                    if (profileImagePreviewUrl) {
                      URL.revokeObjectURL(profileImagePreviewUrl);
                    }
                    setProfileImagePreviewUrl(null);
                    setProfileImageRemoved(Boolean(account?.profileUrl));
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div className="profile-form-grid">
            <label className="profile-field profile-field--full">
              <span>Display Name</span>
              <input
                type="text"
                value={profileNameInput}
                onChange={(event) => setProfileNameInput(event.target.value)}
                placeholder="Add your display name"
              />
            </label>

            <label className="profile-field profile-field--full">
              <span>Username</span>
              <input type="text" value={displayUsername} readOnly />
            </label>

            <label className="profile-field profile-field--full">
              <span>Email Address</span>
              <div className="profile-field__input-wrap">
                <input type="email" value={profileEmail} readOnly />
                {hasValidEmail ? (
                  <span className="profile-field__verified" aria-hidden="true">
                    <span className="app-sidebar__icon">verified</span>
                  </span>
                ) : null}
              </div>
            </label>

            <label className="profile-field">
              <span>Auth Provider</span>
              <input type="text" value={account?.authProvider ?? "Unavailable"} readOnly />
            </label>

            <label className="profile-field">
              <span>Role ID</span>
              <input type="text" value={account?.roleId ?? "Unavailable"} readOnly />
            </label>

            <label className="profile-field profile-field--full">
              <span>Organization ID</span>
              <input type="text" value={account?.orgId ?? "Unavailable"} readOnly />
            </label>
          </div>

          <div className="profile-section__footer">
            <div>
              <p className="profile-section__note">
                Display name updates are saved through the current user profile API.
              </p>
              {saveMessage ? <p className="profile-section__note">{saveMessage}</p> : null}
              {saveError ? <p className="profile-section__note">{saveError}</p> : null}
            </div>
            <button
              type="button"
              className="primary-btn"
              onClick={() => void handleSaveProfile()}
              disabled={!canSaveName}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </section>

        <section className="profile-section profile-section--wide">
          <div className="profile-section__header">
            <div>
              <h3>
                <span className="app-sidebar__icon" aria-hidden="true">
                  security
                </span>
                Security Settings
              </h3>
              <p>Keep your account secure with password and session controls.</p>
            </div>
          </div>

          <div className="security-grid">
            <div className="security-grid__form">
              <label className="profile-field">
                <span>Current Password</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder={isCognitoAccount ? "Current password" : "Unavailable"}
                  readOnly={!isCognitoAccount}
                />
              </label>

              <label className="profile-field">
                <span>New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Min 8 characters"
                  readOnly={!isCognitoAccount}
                />
              </label>

              <label className="profile-field">
                <span>Confirm New Password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat new password"
                  readOnly={!isCognitoAccount}
                />
              </label>
            </div>

            <aside className="security-requirements">
              <p className="security-requirements__eyebrow">
                Password Strength Requirements
              </p>
              <ul>
                {passwordChecks.map((requirement) => (
                  <li key={requirement.label}>
                    <span className="app-sidebar__icon" aria-hidden="true">
                      {requirement.satisfied ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    {requirement.label}
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          <div className="profile-section__footer">
            <div>
              <p className="profile-section__note">
                {isCognitoAccount
                  ? "Password changes are applied through your Cognito account."
                  : "Password changes are only available for Cognito-backed accounts right now."}
              </p>
              {passwordMessage ? (
                <p className="profile-section__note">{passwordMessage}</p>
              ) : null}
              {passwordError ? (
                <p className="profile-section__note">{passwordError}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => void handleChangePassword()}
              disabled={!canChangePassword}
            >
              {isChangingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        </section>

        <section className="profile-section profile-section--danger">
          <div className="profile-section__header">
            <div>
              <h3>
                <span className="app-sidebar__icon" aria-hidden="true">
                  dangerous
                </span>
                Danger Zone
              </h3>
              <p>Destructive account actions should stay explicit and hard to trigger.</p>
            </div>
          </div>

          <div className="danger-zone__callout">
            <p>
              Deleting your account is permanent. If you are the only member,
              the organization is deleted too. Owners in multi-member organizations
              must delete the organization first.
            </p>
          </div>

          {deleteError ? <p className="profile-section__note">{deleteError}</p> : null}

          <button
            type="button"
            className="danger-zone__button"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeletingAccount}
          >
            <span className="app-sidebar__icon" aria-hidden="true">
              delete
            </span>
            {isDeletingAccount ? "Deleting Account..." : "Delete Account"}
          </button>
        </section>
      </div>

      <GlassDialog
        open={showDeleteDialog}
        title="Delete Account"
        message="Delete your account? This action is permanent. If you are the only member, the organization will be deleted too."
        confirmLabel={isDeletingAccount ? "Deleting Account..." : "Delete Account"}
        tone="danger"
        busy={isDeletingAccount}
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => {
          if (!isDeletingAccount) {
            setShowDeleteDialog(false);
          }
        }}
      />
    </section>
  );
}
