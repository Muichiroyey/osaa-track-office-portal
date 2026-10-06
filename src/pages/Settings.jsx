import { useRef, useState } from "react";
import { Loader2, Save, KeyRound, Camera, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { api, uploadFile, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import ProtectedImage from "../components/ui/ProtectedImage.jsx";
import { inputClass, labelClass, primaryButtonClass } from "../components/ui/formStyles.js";

function initials(name) {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name || "?").slice(0, 2).toUpperCase();
}

function PasswordField({ label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} pr-10`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, updateUser, applyNewToken } = useAuth();
  const { notify } = useToast();
  const fileRef = useRef(null);

  const [name, setName] = useState(user?.name || "");
  const [avatarFileId, setAvatarFileId] = useState(user?.avatarFileId || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  async function pickAvatar(list) {
    const file = list?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setProfileError(null);
    try {
      const uploaded = await uploadFile(file);
      setAvatarFileId(uploaded.id);
    } catch (err) {
      setProfileError(err.message || "Could not upload that image.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfile() {
    setProfileError(null);
    setSavingProfile(true);
    try {
      // avatarFileId null + a logo on file = the office removed it.
      const removeAvatar = !avatarFileId && Boolean(user?.avatarFileId);
      const data = await api.put("/api/office/auth/profile", { name: name.trim(), avatarFileId, removeAvatar });
      updateUser(data.user);
      notify("Profile updated.");
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Could not save your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    setPasswordError(null);
    setSavingPassword(true);
    try {
      const data = await api.put("/api/office/auth/password", passwords);
      // The server reissues this device's token (every other session for
      // the account is dropped), so it has to be stored before the next
      // request goes out — otherwise the very next call would 401.
      applyNewToken(data.token);
      updateUser(data.user);
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      notify("Password updated. You're still signed in on this device.");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Could not update your password.");
    } finally {
      setSavingPassword(false);
    }
  }

  const passwordReady =
    passwords.currentPassword && passwords.newPassword.length >= 8 && passwords.newPassword === passwords.confirmPassword;

  return (
    <>
      <div className="mb-5">
        <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your profile and password.</p>
      </div>

      <div className="mx-auto max-w-2xl space-y-5">
        {/* ── Profile ── */}
        <section className="rounded-xl2 border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="font-heading text-base font-semibold text-slate-800">Profile</h2>
          <p className="mt-0.5 text-sm text-slate-500">Your office logo and display name. The logo appears beside every Campus Feed post your office publishes, so students and other offices can recognise you.</p>

          <div className="mt-5 flex flex-wrap items-center gap-5">
            <div className="relative">
              {avatarFileId ? (
                <ProtectedImage
                  file={{ id: avatarFileId }}
                  alt={name}
                  className="size-20 rounded-full border border-slate-200"
                />
              ) : (
                <div
                  className="flex size-20 items-center justify-center rounded-full text-xl font-bold text-white"
                  style={{ backgroundImage: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                >
                  {initials(name)}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title="Change office logo"
                className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-card transition hover:text-brand-blue"
              >
                {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  pickAvatar(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {avatarFileId && (
              <button
                type="button"
                onClick={() => setAvatarFileId(null)}
                className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-status-danger hover:underline"
              >
                Remove logo
              </button>
            )}

            <div className="min-w-[200px] flex-1">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Full name</label>
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Email address (your username)</dt>
              <dd className="truncate text-slate-700">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Account type</dt>
              <dd className="capitalize text-slate-700">{user?.type}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-slate-400">
            Your email and account type are set by the SAA office and can&rsquo;t be changed here.
          </p>

          {profileError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{profileError}</div>
          )}

          <div className="mt-4 flex justify-end">
            <button type="button" onClick={saveProfile} disabled={savingProfile || !name.trim()} className={primaryButtonClass}>
              {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save changes
            </button>
          </div>
        </section>

        {/* ── Password ── */}
        <section className="rounded-xl2 border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-slate-800">
            <KeyRound size={17} className="text-brand-blue" />
            Change password
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {user?.usingIssuedPassword
              ? "You're still using the password the SAA office issued. Set your own below."
              : "Choose a new password for your account."}
          </p>

          <div className="mt-5 space-y-4">
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(v) => setPasswords((p) => ({ ...p, currentPassword: v }))}
            />
            <PasswordField
              label="New password"
              autoComplete="new-password"
              value={passwords.newPassword}
              onChange={(v) => setPasswords((p) => ({ ...p, newPassword: v }))}
            />
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              value={passwords.confirmPassword}
              onChange={(v) => setPasswords((p) => ({ ...p, confirmPassword: v }))}
            />

            <ul className="space-y-1 text-xs">
              <li className={passwords.newPassword.length >= 8 ? "text-status-success" : "text-slate-400"}>
                <CheckCircle2 size={11} className="mr-1 inline" />
                At least 8 characters
              </li>
              <li
                className={
                  passwords.confirmPassword && passwords.newPassword === passwords.confirmPassword
                    ? "text-status-success"
                    : "text-slate-400"
                }
              >
                <CheckCircle2 size={11} className="mr-1 inline" />
                Both new password fields match
              </li>
            </ul>

            {passwordError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{passwordError}</div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                You&rsquo;ll stay signed in here; any other device using this account is signed out.
              </p>
              <button type="button" onClick={savePassword} disabled={!passwordReady || savingPassword} className={primaryButtonClass}>
                {savingPassword && <Loader2 size={14} className="animate-spin" />}
                Update password
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
