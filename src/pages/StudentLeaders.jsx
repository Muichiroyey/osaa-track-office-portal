import { useCallback, useEffect, useState } from "react";
import { Network, Search, ArrowLeft, FileText, Download, Eye, EyeOff, Users, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { api, downloadFile, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useLiveRefresh } from "../context/LiveUpdatesContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ProtectedImage from "../components/ui/ProtectedImage.jsx";
import psuSeal from "../assets/psu-seal.png";
import HierarchyChart from "../components/ui/HierarchyChart.jsx";
import FileViewerModal from "../components/ui/FileViewerModal.jsx";
import Modal from "../components/ui/Modal.jsx";
import FileDropzone from "../components/ui/FileDropzone.jsx";
import LogoUploadSquare from "../components/ui/LogoUploadSquare.jsx";
import { categoryToneClasses } from "../components/ui/categoryTone.js";
import { inputClass, selectClass, textareaClass, labelClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";
import { formatDate } from "../utils/time.js";

function LogoRow({ organization }) {
  const logos = [
    // No PSU logo uploaded → the standard PSU seal, same as the admin panel.
    { file: organization.psu_logo, label: organization.psu_name, seal: true },
    { file: organization.college_logo, label: organization.college_name },
    { file: organization.org_logo, label: organization.name },
  ].filter((l) => l.file || l.label);

  return (
    <div className="flex flex-wrap items-center justify-center gap-6 border-b border-slate-100 pb-5">
      {logos.map((l, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <ProtectedImage
            file={l.file}
            alt={l.label || ""}
            className="size-16 rounded-full border border-slate-200"
            fallback={
              l.seal ? (
                <img src={psuSeal} alt={l.label || ""} className="size-16 rounded-full border border-slate-200 object-cover" />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-300"><Users size={20} /></div>
              )
            }
          />
          {l.label && <p className="max-w-[140px] text-center text-[11px] text-slate-500">{l.label}</p>}
        </div>
      ))}
    </div>
  );
}

// View-only directory: students use it to find the right officer to
// contact. No edit handlers are passed to HierarchyChart, so it renders
// without the admin's edit/delete affordances.
function OrganizationDetail({ id, onBack }) {
  const { handleSessionInvalidated } = useAuth();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async (opts) => {
    setState((s) => (s === "ready" ? "ready" : "loading"));
    try {
      setData(await api.get(`/api/office/student-leaders/organizations/${id}`));
      setState("ready");
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setState((s) => (opts?.background && s === "ready" ? "ready" : "error"));
    }
  }, [id, handleSessionInvalidated]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveRefresh(["student-leaders"], load);

  if (state === "loading") return <LoadingState label="Loading organization..." />;
  if (state === "error") return <ErrorState message="Couldn't load this organization." onRetry={load} />;

  const { organization, officers, documents } = data;

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
      >
        <ArrowLeft size={15} /> All organizations
      </button>

      <div className="rounded-xl2 border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <LogoRow organization={organization} />
        <h1 className="mt-5 text-center font-heading text-lg font-bold text-slate-800 sm:text-xl">{organization.name}</h1>

        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Organizational chart</p>
          {officers.length === 0 ? (
            <EmptyState icon={Users} title="No officers listed yet" />
          ) : (
            <HierarchyChart officers={officers} />
          )}
        </div>
      </div>

      {officers.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">
            Officers
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Position</th>
                  <th className="px-4 py-2.5 font-semibold">Category</th>
                  <th className="px-4 py-2.5 font-semibold">Reports to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {officers.map((o) => {
                  // Up to two positions above — listed together when there are two.
                  const above = [o.parent_officer_id, o.second_parent_officer_id]
                    .filter(Boolean)
                    .map((id) => officers.find((p) => p.id === id)?.position)
                    .filter(Boolean);
                  return (
                    <tr key={o.id}>
                      <td className="px-4 py-2.5 font-medium text-slate-700 sm:px-5">{o.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{o.position}</td>
                      <td className="px-4 py-2.5">
                        {o.category && (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${categoryToneClasses(o.category)}`}>
                            {o.category}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{above.length > 0 ? above.join(" & ") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
        <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">
          Organization documents
        </p>
        {documents.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400 sm:px-5">No documents uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-2.5 px-4 py-3 text-sm sm:px-5">
                <FileText size={15} className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-700">{d.title || d.file?.original_name || d.doc_type}</p>
                  {d.description && <p className="text-xs text-slate-500">{d.description}</p>}
                  <p className="text-xs text-slate-400">{d.doc_type}</p>
                </div>
                {d.file && (
                  <>
                    <button type="button" onClick={() => setViewing(d.file)} className="shrink-0 text-slate-400 hover:text-brand-blue">
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadFile(d.file.id, d.file.original_name)}
                      className="shrink-0 text-slate-400 hover:text-brand-blue"
                    >
                      <Download size={15} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {viewing && (
        <FileViewerModal
          open
          onClose={() => setViewing(null)}
          fileName={viewing.original_name}
          viewUrl={`/api/uploads/${viewing.id}/view`}
          downloadUrl={`/api/uploads/${viewing.id}/download`}
        />
      )}
    </>
  );
}

function OfficerFormModal({ open, onClose, organizationId, officers, editing, onSaved }) {
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [category, setCategory] = useState("");
  const [parentOfficerId, setParentOfficerId] = useState("");
  const [secondParentOfficerId, setSecondParentOfficerId] = useState("");
  const [connectedIds, setConnectedIds] = useState([]);
  const [photo, setPhoto] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name || "");
    setPosition(editing?.position || "");
    setCategory(editing?.category || "");
    setParentOfficerId(editing?.parent_officer_id ? String(editing.parent_officer_id) : "");
    setSecondParentOfficerId(editing?.second_parent_officer_id ? String(editing.second_parent_officer_id) : "");
    setConnectedIds((editing?.connected_officer_ids || []).map(String));
    setPhoto(editing?.photo ? [editing.photo] : []);
    setError(null);
  }, [open, editing]);

  async function submit() {
    setError(null);
    if (!name.trim() || !position.trim()) {
      setError("Name and position are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        position: position.trim(),
        category: category.trim(),
        photoFileId: photo[0]?.id || null,
        parentOfficerId: parentOfficerId || null,
        secondParentOfficerId: secondParentOfficerId || null,
        connectedOfficerIds: connectedIds,
      };
      if (editing) {
        await api.put(`/api/office/student-leaders/officers/${editing.id}`, payload);
        notify("Officer updated.");
      } else {
        await api.post("/api/office/student-leaders/mine/officers", payload);
        notify("Officer added.");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this officer.");
    } finally {
      setSaving(false);
    }
  }

  const others = officers.filter((o) => o.id !== editing?.id);

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit officer" : "Add officer"} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Name</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Position</label>
            <input className={inputClass} value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Category (free text, e.g. "Executive", "Committee")</label>
          <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Position above</label>
            <select className={selectClass} value={parentOfficerId} onChange={(e) => setParentOfficerId(e.target.value)}>
              <option value="">None (top level)</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {o.position}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Second position above</label>
            <select className={selectClass} value={secondParentOfficerId} onChange={(e) => setSecondParentOfficerId(e.target.value)}>
              <option value="">None</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {o.position}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Photo</label>
          <FileDropzone files={photo} onChange={setPhoto} multiple={false} label="Upload a photo" />
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{error}</div>}

        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving} className={primaryButtonClass}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

const DEFAULT_PSU_NAME = "Pangasinan State University";

function emptyBranding() {
  return { name: "", collegeName: "", psuName: DEFAULT_PSU_NAME, orgLogoFile: null, collegeLogoFile: null, psuLogoFile: null };
}

function brandingFromOrg(org) {
  return {
    name: org.name || "",
    collegeName: org.college_name || "",
    psuName: org.psu_name || DEFAULT_PSU_NAME,
    orgLogoFile: org.org_logo || null,
    collegeLogoFile: org.college_logo || null,
    psuLogoFile: org.psu_logo || null,
  };
}

// What the server wants for the three logos + three names. A cleared logo is
// sent as an explicit null so it is actually removed.
function brandingPayload(form) {
  return {
    name: form.name.trim(),
    collegeName: form.collegeName.trim() || null,
    psuName: form.psuName.trim() || DEFAULT_PSU_NAME,
    orgLogoFileId: form.orgLogoFile?.id || null,
    collegeLogoFileId: form.collegeLogoFile?.id || null,
    psuLogoFileId: form.psuLogoFile?.id || null,
  };
}

// The same branding fields the admin sees: Org / College / PSU logos plus
// the three names. Used both to register the office's organization and to
// edit its branding later.
function BrandingFields({ form, setForm }) {
  return (
    <>
      <div className="flex justify-center gap-4 rounded-xl bg-slate-50/60 py-5 sm:gap-6">
        <LogoUploadSquare label="Org Logo" value={form.orgLogoFile} onChange={(file) => setForm((f) => ({ ...f, orgLogoFile: file }))} />
        <LogoUploadSquare label="College Logo" value={form.collegeLogoFile} onChange={(file) => setForm((f) => ({ ...f, collegeLogoFile: file }))} />
        <LogoUploadSquare label="PSU Logo" value={form.psuLogoFile} onChange={(file) => setForm((f) => ({ ...f, psuLogoFile: file }))} />
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        <label className={labelClass}>Name of the Organization</label>
        <input className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Society of Future IT Innovators (SFIT)" required />
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <label className={labelClass}>Name of the College</label>
        <input className={inputClass} value={form.collegeName} onChange={(e) => setForm((f) => ({ ...f, collegeName: e.target.value }))} placeholder="e.g. College of Computing Sciences" />
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <label className={labelClass}>Name of the University</label>
        <input className={inputClass} value={form.psuName} onChange={(e) => setForm((f) => ({ ...f, psuName: e.target.value }))} />
        <p className="text-xs text-slate-400">Leave the PSU logo blank to use the standard PSU seal.</p>
      </div>
    </>
  );
}

function RegisterOrgForm({ onRegistered }) {
  const { notify } = useToast();
  const [form, setForm] = useState(emptyBranding);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await api.post("/api/office/student-leaders/mine", brandingPayload(form));
      notify("Organization registered.");
      onRegistered();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not register this organization.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl rounded-xl2 border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <Network size={22} className="mx-auto text-brand-blue" />
      <h2 className="mt-2 text-center font-heading text-base font-semibold text-slate-800">Register your organization</h2>
      <p className="mt-1 text-center text-xs text-slate-500">
        Each office can have one organization. If it is already on file (matched by name), this links to it automatically;
        otherwise a new record is created. You can add the organization, college and university logos now or later.
      </p>
      <div className="mt-4">
        <BrandingFields form={form} setForm={setForm} />
      </div>
      {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{error}</div>}
      <button type="submit" disabled={saving || !form.name.trim()} className={`${primaryButtonClass} mt-4 w-full justify-center`}>
        {saving && <Loader2 size={14} className="animate-spin" />}
        Register
      </button>
    </form>
  );
}

// Edit the office's own organization's logos and names after registering.
function EditBrandingModal({ open, org, onClose, onSaved }) {
  const { notify } = useToast();
  const [form, setForm] = useState(() => brandingFromOrg(org));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(brandingFromOrg(org));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await api.put("/api/office/student-leaders/mine", brandingPayload(form));
      notify("Branding updated.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Branding" maxWidth="max-w-xl">
      <form onSubmit={submit}>
        <BrandingFields form={form} setForm={setForm} />
        {error && <p className="mt-3 text-xs font-medium text-status-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button type="submit" disabled={saving || !form.name.trim()} className={primaryButtonClass}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Upload / edit one public document (title + description are required).
function DocumentFormModal({ open, editing, onClose, onSaved }) {
  const { notify } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [docType, setDocType] = useState("Other");
  const [file, setFile] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title || "");
    setDescription(editing?.description || "");
    setDocType(editing?.doc_type || "Other");
    setFile(editing?.file ? [editing.file] : []);
    setError(null);
  }, [open, editing]);

  const ready = title.trim() && description.trim() && file.length > 0;

  async function submit(e) {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    setSaving(true);
    try {
      const payload = { title: title.trim(), description: description.trim(), docType, fileId: file[0].id };
      if (editing) {
        await api.put(`/api/office/student-leaders/mine/documents/${editing.id}`, payload);
        notify("Document updated.");
      } else {
        await api.post("/api/office/student-leaders/mine/documents", payload);
        notify("Document posted.");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this document.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit document" : "Upload a public document"} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Title</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 2026 Constitution & By-Laws" maxLength={255} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Description</label>
          <textarea rows={3} className={textareaClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this document, and who is it for?" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Type</label>
          <select className={selectClass} value={docType} onChange={(e) => setDocType(e.target.value)}>
            {["Constitution & By-Laws", "Resolution", "Order", "Other"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>File</label>
          <FileDropzone files={file} onChange={setFile} multiple={false} label="Drop the file here or click to browse" />
        </div>
        {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
        <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !ready} className={primaryButtonClass}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {editing ? "Save changes" : "Post document"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// The office's own public documents: students and other offices can view and
// download whatever isn't hidden. Here the owner can edit, hide and delete.
function MyDocuments() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    try {
      setItems((await api.get("/api/office/student-leaders/mine/documents")).items);
    } catch (err) {
      handleSessionInvalidated(err);
    }
  }, [handleSessionInvalidated]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleHidden(doc) {
    try {
      await api.patch(`/api/office/student-leaders/mine/documents/${doc.id}/hidden`, { hidden: !doc.hidden });
      notify(doc.hidden ? "Document is public again." : "Document hidden from public view.");
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not update this document.", "error");
    }
  }

  async function remove(doc) {
    if (!window.confirm(`Delete "${doc.title || doc.file?.original_name}"? This can't be undone.`)) return;
    try {
      await api.del(`/api/office/student-leaders/mine/documents/${doc.id}`);
      notify("Document deleted.");
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not delete this document.", "error");
    }
  }

  return (
    <div className="mt-5 overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Public documents</p>
          <p className="text-xs text-slate-400">Students and other offices can view and download these.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className={secondaryButtonClass}
        >
          <Plus size={14} /> Upload
        </button>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400 sm:px-5">No documents posted yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((d) => (
            <li key={d.id} className={`flex items-start gap-2.5 px-4 py-3 text-sm sm:px-5 ${d.hidden ? "bg-slate-50/70" : ""}`}>
              <FileText size={15} className="mt-0.5 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium text-slate-700">
                  <span className="truncate">{d.title || d.file?.original_name || d.doc_type}</span>
                  {d.hidden && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Hidden</span>
                  )}
                </p>
                {d.description && <p className="text-xs text-slate-500">{d.description}</p>}
                <p className="text-xs text-slate-400">
                  {d.doc_type} · {formatDate(d.created_at, "")}
                </p>
              </div>
              {d.file && (
                <>
                  <button type="button" title="View" onClick={() => setViewing(d.file)} className="shrink-0 text-slate-400 hover:text-brand-blue">
                    <Eye size={15} />
                  </button>
                  <button type="button" title="Download" onClick={() => downloadFile(d.file.id, d.file.original_name)} className="shrink-0 text-slate-400 hover:text-brand-blue">
                    <Download size={15} />
                  </button>
                </>
              )}
              <button
                type="button"
                title="Edit"
                onClick={() => {
                  setEditing(d);
                  setFormOpen(true);
                }}
                className="shrink-0 text-slate-400 hover:text-brand-blue"
              >
                <Pencil size={15} />
              </button>
              <button type="button" title={d.hidden ? "Make public" : "Hide from public view"} onClick={() => toggleHidden(d)} className="shrink-0 text-slate-400 hover:text-brand-blue">
                {d.hidden ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button type="button" title="Delete" onClick={() => remove(d)} className="shrink-0 text-slate-400 hover:text-status-danger">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <DocumentFormModal open={formOpen} editing={editing} onClose={() => setFormOpen(false)} onSaved={load} />
      {viewing && (
        <FileViewerModal
          open
          onClose={() => setViewing(null)}
          fileName={viewing.original_name}
          viewUrl={`/api/uploads/${viewing.id}/view`}
          downloadUrl={`/api/uploads/${viewing.id}/download`}
        />
      )}
    </div>
  );
}

function MyOrganization() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [org, setOrg] = useState(undefined); // undefined = loading, null = none yet
  const [officers, setOfficers] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState(null);
  const [brandingOpen, setBrandingOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/api/office/student-leaders/mine");
      setOrg(d.item);
      if (d.item) {
        const o = await api.get("/api/office/student-leaders/mine/officers");
        setOfficers(o.items);
      }
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
    }
  }, [handleSessionInvalidated]);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteOfficer(officer) {
    if (!window.confirm(`Remove ${officer.name}?`)) return;
    try {
      await api.del(`/api/office/student-leaders/officers/${officer.id}`);
      notify("Officer removed.");
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not remove this officer.", "error");
    }
  }

  if (org === undefined) return <LoadingState label="Loading your organization..." />;
  if (org === null) return <RegisterOrgForm onRegistered={load} />;

  return (
    <div>
      <div className="rounded-xl2 border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <LogoRow organization={org} />
        <h1 className="mt-5 text-center font-heading text-lg font-bold text-slate-800 sm:text-xl">{org.name}</h1>
        <div className="mt-2 flex justify-center">
          <button type="button" onClick={() => setBrandingOpen(true)} className={secondaryButtonClass}>
            <Pencil size={13} /> Edit branding
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Organizational chart</p>
          <button
            type="button"
            onClick={() => {
              setEditingOfficer(null);
              setFormOpen(true);
            }}
            className={secondaryButtonClass}
          >
            <Plus size={14} /> Add officer
          </button>
        </div>
        <div className="mt-3">
          {officers.length === 0 ? (
            <EmptyState icon={Users} title="No officers yet" description="Add your organization's officers to build the chart." />
          ) : (
            <HierarchyChart
              officers={officers}
              onEdit={(o) => {
                setEditingOfficer(o);
                setFormOpen(true);
              }}
              onDelete={deleteOfficer}
            />
          )}
        </div>
      </div>

      <MyDocuments />

      <EditBrandingModal open={brandingOpen} org={org} onClose={() => setBrandingOpen(false)} onSaved={load} />

      <OfficerFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        organizationId={org.id}
        officers={officers}
        editing={editingOfficer}
        onSaved={load}
      />
    </div>
  );
}

export default function StudentLeaders() {
  const { handleSessionInvalidated } = useAuth();
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("directory"); // "directory" | "mine"

  const load = useCallback(async (opts) => {
    setState((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const data = await api.get("/api/office/student-leaders/organizations");
      setItems(data.items);
      setState("ready");
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setState((s) => (opts?.background && s === "ready" ? "ready" : "error"));
    }
  }, [handleSessionInvalidated]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveRefresh(["student-leaders"], load);

  if (selected) return <OrganizationDetail id={selected} onBack={() => setSelected(null)} />;
  if (state === "loading") return <LoadingState label="Loading organizations..." />;
  if (state === "error") return <ErrorState message="Couldn't load the directory." onRetry={load} />;

  const term = search.trim().toLowerCase();
  const shown = term ? items.filter((o) => o.name.toLowerCase().includes(term)) : items;

  return (
    <>
      <div className="mb-5">
        <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Student Leaders Directory</h1>
        <p className="mt-1 text-sm text-slate-500">
          Recognized campus organizations, their officers, and their governing documents. Register your own office's
          organization, or find the right officer for an inquiry or collaboration.
        </p>
      </div>

      <div className="mb-5 flex gap-1 rounded-full bg-slate-200/70 p-1 text-xs font-semibold w-fit">
        <button
          type="button"
          onClick={() => setTab("directory")}
          className={`rounded-full px-4 py-1.5 transition ${tab === "directory" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
        >
          All Organizations
        </button>
        <button
          type="button"
          onClick={() => setTab("mine")}
          className={`rounded-full px-4 py-1.5 transition ${tab === "mine" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
        >
          My Organization
        </button>
      </div>

      {tab === "mine" ? (
        <MyOrganization />
      ) : (
        <>
          <div className="relative mb-4">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizations"
              className={`${inputClass} pl-9`}
            />
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={Network} title={term ? "No matching organizations" : "No organizations listed yet"} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelected(o.id)}
                  className="flex items-center gap-3.5 rounded-xl2 border border-slate-200 bg-white p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <ProtectedImage
                    file={o.org_logo}
                    alt=""
                    className="size-12 shrink-0 rounded-full border border-slate-100"
                    fallback={
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-status-indigo/10 text-status-indigo">
                        <Network size={18} />
                      </div>
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate font-heading text-sm font-semibold text-slate-800">{o.name}</p>
                    {o.college_name && <p className="truncate text-xs text-slate-500">{o.college_name}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
