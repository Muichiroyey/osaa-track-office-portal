import { useCallback, useEffect, useRef, useState } from "react";
import { FolderKanban, Plus, Upload, Loader2, Trash2, FileText, Send, Inbox, ChevronRight, Eye, Download, Paperclip } from "lucide-react";
import { api, uploadFile, getToken, downloadFile, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useLiveRefresh } from "../context/LiveUpdatesContext.jsx";
import Modal from "../components/ui/Modal.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import FileDropzone from "../components/ui/FileDropzone.jsx";
import FileViewerModal from "../components/ui/FileViewerModal.jsx";
import SearchableSelect from "../components/ui/SearchableSelect.jsx";
import { inputClass, selectClass, textareaClass, labelClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";
import { formatDate } from "../utils/time.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function formatWhen(value) {
  return formatDate(value, "");
}

async function uploadToFolder(folderId, file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/office/document-repository/folders/${folderId}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Upload failed.");
  return data;
}

function FolderPanel({ folder, onDeleted }) {
  const { notify } = useToast();
  const { handleSessionInvalidated } = useAuth();
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [state, setState] = useState("loading");
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const d = await api.get(`/api/office/document-repository/folders/${folder.id}/files`);
      setFiles(d.items);
      setState("ready");
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setState("error");
    }
  }, [folder.id, handleSessionInvalidated]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFiles(fileList) {
    const list = Array.from(fileList || []);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const f of list) await uploadToFolder(folder.id, f);
      notify("File uploaded.");
      await load();
    } catch (err) {
      notify(err.message || "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile(id) {
    if (!window.confirm("Delete this file?")) return;
    try {
      await api.del(`/api/office/document-repository/files/${id}`);
      notify("File deleted.");
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not delete.", "error");
    }
  }

  async function deleteFolder() {
    if (!window.confirm(`Delete the "${folder.name}" folder and everything in it?`)) return;
    try {
      await api.del(`/api/office/document-repository/folders/${folder.id}`);
      notify("Folder deleted.");
      onDeleted();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not delete.", "error");
    }
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => !uploading && inputRef.current?.click()}
          disabled={uploading}
          className={secondaryButtonClass}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Upload file
        </button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        <button type="button" onClick={deleteFolder} className="flex items-center gap-1.5 text-xs font-semibold text-status-danger hover:underline">
          <Trash2 size={13} /> Delete folder
        </button>
      </div>

      {state === "loading" ? (
        <LoadingState label="Loading files..." />
      ) : state === "error" ? (
        <ErrorState message="Couldn't load files." onRetry={load} />
      ) : files.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">No files in this folder yet.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <FileText size={15} className="shrink-0 text-slate-400" />
              <button type="button" onClick={() => setViewing(f)} className="min-w-0 flex-1 truncate text-left text-slate-700 hover:text-brand-blue">
                {f.name}
              </button>
              <span className="shrink-0 text-[11px] text-slate-400">{formatWhen(f.uploaded_at)}</span>
              <button type="button" onClick={() => deleteFile(f.id)} className="shrink-0 text-slate-400 hover:text-status-danger">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <FileViewerModal
          open
          onClose={() => setViewing(null)}
          fileName={viewing.name}
          viewUrl={`/api/office/document-repository/files/${viewing.id}/view`}
          downloadUrl={`/api/office/document-repository/files/${viewing.id}/download`}
        />
      )}
    </div>
  );
}

function NewFolderModal({ open, onClose, onCreated }) {
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/office/document-repository/folders", { name: name.trim() });
      notify("Folder created.");
      onCreated();
      onClose();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not create folder.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New folder" maxWidth="max-w-sm">
      <div className="space-y-4">
        <input className={inputClass} placeholder="Folder name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving || !name.trim()} className={primaryButtonClass}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
}

function NewTransmissionModal({ open, onClose, offices, onCreated }) {
  const { notify } = useToast();
  const [direction, setDirection] = useState("sent");
  const [officeId, setOfficeId] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDirection("sent");
      setOfficeId("");
      setDocumentName("");
      setNotes("");
      setFiles([]);
    }
  }, [open]);

  async function submit() {
    if (!officeId || !documentName.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/office/document-repository/transmissions", {
        direction,
        officeId,
        documentName: documentName.trim(),
        notes: notes.trim(),
        fileIds: direction === "sent" ? files.map((f) => f.id) : [],
      });
      notify(direction === "sent" ? "Document sent." : "Request sent.");
      onCreated();
      onClose();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not send this.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Inter-office transmission" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-xs font-semibold w-fit">
          <button type="button" onClick={() => setDirection("sent")} className={`rounded-full px-3.5 py-1.5 ${direction === "sent" ? "bg-white shadow-sm" : "text-slate-500"}`}>
            Send a document
          </button>
          <button type="button" onClick={() => setDirection("requested")} className={`rounded-full px-3.5 py-1.5 ${direction === "requested" ? "bg-white shadow-sm" : "text-slate-500"}`}>
            Request a document
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>{direction === "sent" ? "Send to" : "Request from"}</label>
          <SearchableSelect
            options={[{ value: "saa", label: "Office of Student and Alumni Affairs (SAA)" }, ...offices.map((o) => ({ value: o.id, label: o.name }))]}
            value={officeId}
            onChange={setOfficeId}
            placeholder="Search for an office..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Document name</label>
          <input className={inputClass} value={documentName} onChange={(e) => setDocumentName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Notes</label>
          <textarea rows={2} className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {direction === "sent" && (
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Attach files</label>
            <FileDropzone files={files} onChange={setFiles} multiple />
          </div>
        )}
        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving || !officeId || !documentName.trim()} className={primaryButtonClass}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {direction === "sent" ? "Send" : "Request"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Upload the file another office (or SAA) asked for and send it back to them.
function RespondModal({ transmission, onClose, onSent }) {
  const { notify } = useToast();
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (files.length === 0) return;
    setSaving(true);
    try {
      await api.post(`/api/office/document-repository/transmissions/${transmission.id}/respond`, { fileIds: files.map((f) => f.id) });
      notify("Document sent to the requester.");
      onSent();
      onClose();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not send the document.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Send requested document`} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3.5 py-3 text-sm">
          <p className="font-medium text-slate-700">{transmission.document_name}</p>
          <p className="text-xs text-slate-500">Requested by {transmission.from_office_name || "SAA"}</p>
          {transmission.notes && <p className="mt-1.5 text-xs text-slate-500">{transmission.notes}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Upload the requested file</label>
          <FileDropzone files={files} onChange={setFiles} multiple />
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving || files.length === 0} className={primaryButtonClass}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send to requester
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Every file on a transmission, each viewable and downloadable. Files the
// receiving office uploaded to answer a request are labelled as such.
function TransmissionFiles({ files, onView }) {
  if (!files || files.length === 0) return null;
  return (
    <ul className="mt-2.5 w-full space-y-1.5">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <Paperclip size={12} className="shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-slate-600">{f.original_name}</span>
          {f.kind === "response" && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Requested file</span>
          )}
          <button type="button" title="View" onClick={() => onView(f)} className="shrink-0 text-slate-400 hover:text-brand-blue">
            <Eye size={14} />
          </button>
          <button type="button" title="Download" onClick={() => downloadFile(f.id, f.original_name)} className="shrink-0 text-slate-400 hover:text-brand-blue">
            <Download size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function TransmissionsTab({ office }) {
  const { notify } = useToast();
  const { handleSessionInvalidated } = useAuth();
  const [items, setItems] = useState([]);
  const [offices, setOffices] = useState([]);
  const [state, setState] = useState("loading");
  const [modalOpen, setModalOpen] = useState(false);
  const [responding, setResponding] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setState((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const d = await api.get("/api/office/document-repository/transmissions");
      setItems(d.items);
      setState("ready");
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setState("error");
    }
  }, [handleSessionInvalidated]);

  useEffect(() => {
    load();
    api.get("/api/office/offices").then((d) => setOffices(d.items.filter((o) => o.id !== office?.id))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useLiveRefresh(["document-repository"], load);

  async function updateStatus(id, status) {
    try {
      await api.patch(`/api/office/document-repository/transmissions/${id}/status`, { status });
      notify("Status updated.");
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not update.", "error");
    }
  }

  if (state === "loading" && items.length === 0) return <LoadingState label="Loading transmissions..." />;
  if (state === "error") return <ErrorState message="Couldn't load transmissions." onRetry={load} />;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => setModalOpen(true)} className={primaryButtonClass}>
          <Plus size={15} /> New transmission
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Send} title="No transmissions yet" description="Documents sent to or requested from other offices show up here." />
      ) : (
        <ul className="space-y-2.5">
          {items.map((t) => {
            const outgoing = t.from_office_id === office?.id;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl2 border border-slate-200 bg-white px-4 py-3 shadow-card">
                {outgoing ? <Send size={15} className="shrink-0 text-sky-500" /> : <Inbox size={15} className="shrink-0 text-emerald-500" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{t.document_name}</p>
                  <p className="text-xs text-slate-400">
                    {outgoing ? "To" : "From"} {outgoing ? t.office_name : t.from_office_name || "SAA"} &middot; {t.direction} &middot; {formatWhen(t.created_at)}
                  </p>
                </div>
                <StatusBadge status={t.status} />
                {!outgoing && t.direction === "requested" && t.status !== "fulfilled" && (
                  <button
                    type="button"
                    onClick={() => setResponding(t)}
                    className="shrink-0 rounded-lg bg-brand-blue px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Upload &amp; send file
                  </button>
                )}
                {!outgoing && t.status === "pending" && t.direction === "requested" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(t.id, "acknowledged")}
                    className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Mark acknowledged
                  </button>
                )}
                {!outgoing && t.direction !== "requested" && t.status !== "fulfilled" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(t.id, t.status === "pending" ? "acknowledged" : "fulfilled")}
                    className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Mark {t.status === "pending" ? "acknowledged" : "fulfilled"}
                  </button>
                )}
                <TransmissionFiles files={t.files} onView={setViewing} />
              </li>
            );
          })}
        </ul>
      )}
      <NewTransmissionModal open={modalOpen} onClose={() => setModalOpen(false)} offices={offices} onCreated={load} />
      {responding && <RespondModal transmission={responding} onClose={() => setResponding(null)} onSent={load} />}
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

export default function DocumentRepository() {
  const { office, handleSessionInvalidated } = useAuth();
  const [folders, setFolders] = useState([]);
  const [state, setState] = useState("loading");
  const [openFolderId, setOpenFolderId] = useState(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [tab, setTab] = useState("repository"); // "repository" | "transmissions"

  const load = useCallback(async () => {
    setState((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const d = await api.get("/api/office/document-repository/folders");
      setFolders(d.items);
      setState("ready");
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setState("error");
    }
  }, [handleSessionInvalidated]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveRefresh(["document-repository"], load);

  return (
    <>
      <div className="mb-5">
        <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Document Repository</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Your office's own file storage, plus sending or requesting documents from other authorized offices.
        </p>
      </div>

      <div className="mb-5 flex gap-1 rounded-full bg-slate-200/70 p-1 text-xs font-semibold w-fit">
        <button type="button" onClick={() => setTab("repository")} className={`rounded-full px-4 py-1.5 transition ${tab === "repository" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
          My Repository
        </button>
        <button type="button" onClick={() => setTab("transmissions")} className={`rounded-full px-4 py-1.5 transition ${tab === "transmissions" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
          Inter-Office
        </button>
      </div>

      {tab === "repository" ? (
        <>
          <div className="mb-4 flex justify-end">
            <button type="button" onClick={() => setNewFolderOpen(true)} className={primaryButtonClass}>
              <Plus size={15} /> New folder
            </button>
          </div>
          {state === "loading" ? (
            <LoadingState label="Loading folders..." />
          ) : state === "error" ? (
            <ErrorState message="Couldn't load your repository." onRetry={load} />
          ) : folders.length === 0 ? (
            <EmptyState icon={FolderKanban} title="No folders yet" description="Create a folder to start organizing your office's documents." />
          ) : (
            <ul className="space-y-3">
              {folders.map((f) => (
                <li key={f.id} className="overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
                  <button
                    type="button"
                    onClick={() => setOpenFolderId(openFolderId === f.id ? null : f.id)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5"
                  >
                    <FolderKanban size={17} className="shrink-0 text-brand-blue" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{f.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">{f.file_count} file{f.file_count === 1 ? "" : "s"}</span>
                    <ChevronRight size={15} className={`shrink-0 text-slate-300 transition-transform ${openFolderId === f.id ? "rotate-90" : ""}`} />
                  </button>
                  {openFolderId === f.id && <FolderPanel folder={f} onDeleted={() => { setOpenFolderId(null); load(); }} />}
                </li>
              ))}
            </ul>
          )}
          <NewFolderModal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} onCreated={load} />
        </>
      ) : (
        <TransmissionsTab office={office} />
      )}
    </>
  );
}
