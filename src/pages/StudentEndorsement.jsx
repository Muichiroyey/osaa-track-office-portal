import { useCallback, useEffect, useState } from "react";
import { Users, Plus, Loader2, ArrowUpRight, ArrowDownLeft, Paperclip, UserPlus, Search } from "lucide-react";
import { api, uploadFile, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useLiveRefresh } from "../context/LiveUpdatesContext.jsx";
import { useSummary } from "../context/SummaryContext.jsx";
import Modal from "../components/ui/Modal.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import FileDropzone from "../components/ui/FileDropzone.jsx";
import FileViewerModal from "../components/ui/FileViewerModal.jsx";
import SearchableSelect from "../components/ui/SearchableSelect.jsx";
import { inputClass, textareaClass, selectClass, labelClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";
import { formatDateTime } from "../utils/time.js";

function formatWhen(value) {
  return formatDateTime(value, "");
}

// "Create + Send" (spec section 5, steps 1-6) — full student identity, a
// target office from the directory, and remarks, dispatched directly to
// that office's own inbox.
function CreateModal({ open, onClose, offices, onCreated, replyTo = null }) {
  const { notify } = useToast();
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [program, setProgram] = useState("");
  const [targetOfficeId, setTargetOfficeId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [background, setBackground] = useState("");
  const [justification, setJustification] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setStudentName("");
      setStudentId("");
      setProgram("");
      setTargetOfficeId("");
      setPurpose("");
      setBackground("");
      setJustification("");
      setFiles([]);
      setError(null);
    }
  }, [open]);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const item = await api.post("/api/office/endorsements", {
        studentName: studentName.trim(),
        studentId: studentId.trim(),
        program: program.trim(),
        targetOfficeId,
        purpose: purpose.trim(),
        background: background.trim(),
        justification: justification.trim(),
        fileIds: files.map((f) => f.id),
        ...(replyTo ? { replyToId: replyTo.id } : {}),
      });
      notify(replyTo ? "Referral sent to the office that asked." : "Endorsement sent to the recipient office.");
      onCreated(item.item);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send this endorsement.");
    } finally {
      setSaving(false);
    }
  }

  const valid = studentName.trim() && studentId.trim() && (replyTo || targetOfficeId);

  return (
    <Modal open={open} onClose={onClose} title="Refer a Student" maxWidth="max-w-xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Student full name</label>
            <input className={inputClass} value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Student ID number</label>
            <input className={inputClass} value={studentId} onChange={(e) => setStudentId(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Academic program</label>
          <input className={inputClass} value={program} onChange={(e) => setProgram(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Destination office</label>
          {replyTo ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              {replyTo.source_office_name} <span className="text-xs text-slate-400">(the office that is searching for a student)</span>
            </p>
          ) : (
            <select className={selectClass} value={targetOfficeId} onChange={(e) => setTargetOfficeId(e.target.value)}>
              <option value="">Select an office...</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Referral purpose</label>
          <input className={inputClass} placeholder="e.g. Guidance consultation" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Background notes</label>
          <textarea rows={2} className={textareaClass} value={background} onChange={(e) => setBackground(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Justification</label>
          <textarea rows={2} className={textareaClass} value={justification} onChange={(e) => setJustification(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Attachments (optional)</label>
          <FileDropzone files={files} onChange={setFiles} multiple />
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{error}</div>}

        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving || !valid} className={primaryButtonClass}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Send referral
          </button>
        </div>
      </div>
    </Modal>
  );
}

// "Search for Student": describe the kind of student this office needs and
// ask one office — or every office — to refer someone.
function SearchModal({ open, onClose, offices, onCreated }) {
  const { notify } = useToast();
  const [targetOfficeId, setTargetOfficeId] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setTargetOfficeId("");
      setNotes("");
      setFiles([]);
      setError(null);
    }
  }, [open]);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const res = await api.post("/api/office/endorsements/search", {
        targetOfficeId,
        notes: notes.trim(),
        fileIds: files.map((f) => f.id),
      });
      notify(res.count > 1 ? `Search sent to all ${res.count} offices.` : "Search request sent.");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send this search.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Search for Student" maxWidth="max-w-xl">
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Source office</label>
          <SearchableSelect
            options={[{ value: "all", label: "All offices" }, ...offices.map((o) => ({ value: o.id, label: o.name }))]}
            value={targetOfficeId}
            onChange={setTargetOfficeId}
            placeholder="Search for an office..."
          />
          <p className="text-xs text-slate-400">The office(s) you are asking to refer a student. Choose All offices to ask every office at once.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Notes</label>
          <textarea
            rows={4}
            className={textareaClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe the type of student you need (program, year level, skills, purpose...)"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Attachment (optional)</label>
          <FileDropzone files={files} onChange={setFiles} multiple />
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{error}</div>}

        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving || !targetOfficeId || !notes.trim()} className={primaryButtonClass}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Send search
          </button>
        </div>
      </div>
    </Modal>
  );
}

// The "New endorsement" chooser: the two things an office can start.
function NewEndorsementChooser({ open, onClose, onRefer, onSearch }) {
  return (
    <Modal open={open} onClose={onClose} title="New endorsement" maxWidth="max-w-md">
      <div className="grid gap-3">
        <button
          type="button"
          onClick={onRefer}
          className="flex items-start gap-3 rounded-xl2 border border-slate-200 p-4 text-left transition hover:border-brand-blue hover:bg-blue-50/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
            <UserPlus size={18} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-800">Refer a Student</span>
            <span className="mt-0.5 block text-xs text-slate-500">Send a specific student&rsquo;s details to another office.</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onSearch}
          className="flex items-start gap-3 rounded-xl2 border border-slate-200 p-4 text-left transition hover:border-brand-blue hover:bg-blue-50/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <Search size={18} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-800">Search for Student</span>
            <span className="mt-0.5 block text-xs text-slate-500">Describe the kind of student you need and ask offices to refer one.</span>
          </span>
        </button>
      </div>
    </Modal>
  );
}

function EndorsementCard({ item, isMine, onStatusChange, onRefer }) {
  const isSearch = item.kind === "search";
  const [viewing, setViewing] = useState(null);
  const [updating, setUpdating] = useState(false);

  async function setStatus(status) {
    setUpdating(true);
    try {
      await onStatusChange(item.id, status);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <li className="rounded-xl2 border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${isMine ? "bg-sky-100 text-sky-600" : "bg-emerald-100 text-emerald-600"}`}>
            {isMine ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">{isSearch ? "Search for a student" : item.student_name || "General referral"}</p>
            {!isSearch && (
              <p className="text-xs text-slate-500">
                {item.student_id ? `${item.student_id} · ` : ""}
                {item.program || ""}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <dt className="text-slate-400">{isMine ? "To" : "From"}</dt>
          <dd className="text-slate-700">{isMine ? item.office_name : item.source_office_name || "SAA"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Date</dt>
          <dd className="text-slate-700">{formatWhen(item.created_at)}</dd>
        </div>
        {item.purpose && !isSearch && (
          <div className="col-span-2">
            <dt className="text-slate-400">Purpose</dt>
            <dd className="text-slate-700">{item.purpose}</dd>
          </div>
        )}
        {item.background && (
          <div className="col-span-2">
            <dt className="text-slate-400">{isSearch ? "Notes" : "Background"}</dt>
            <dd className="whitespace-pre-wrap text-slate-700">{item.background}</dd>
          </div>
        )}
        {item.justification && (
          <div className="col-span-2">
            <dt className="text-slate-400">Remarks</dt>
            <dd className="whitespace-pre-wrap text-slate-700">{item.justification}</dd>
          </div>
        )}
      </dl>

      {item.files?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.files.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setViewing(f)}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              <Paperclip size={12} /> {f.original_name}
            </button>
          ))}
        </div>
      )}

      {!isMine && item.status !== "resolved" && !isSearch && (
        <div className="mt-3.5 flex justify-end gap-2">
          {item.status === "pending" && (
            <button type="button" disabled={updating} onClick={() => setStatus("acknowledged")} className={secondaryButtonClass}>
              Acknowledge
            </button>
          )}
          <button type="button" disabled={updating} onClick={() => setStatus("resolved")} className={primaryButtonClass}>
            {updating && <Loader2 size={13} className="animate-spin" />}
            Mark resolved
          </button>
        </div>
      )}

      {/* A search for a student: the receiving office either acknowledges it or answers it with a referral. */}
      {!isMine && isSearch && item.status !== "resolved" && (
        <div className="mt-3.5 flex justify-end gap-2">
          {item.status === "pending" && (
            <button type="button" disabled={updating} onClick={() => setStatus("acknowledged")} className={secondaryButtonClass}>
              Acknowledge
            </button>
          )}
          <button type="button" onClick={() => onRefer(item)} className={primaryButtonClass}>
            <UserPlus size={14} /> Refer a Student
          </button>
        </div>
      )}

      {viewing && (
        <FileViewerModal
          open
          onClose={() => setViewing(null)}
          fileName={viewing.original_name}
          viewUrl={`/api/uploads/${viewing.id}/view`}
          downloadUrl={`/api/uploads/${viewing.id}/download`}
        />
      )}
    </li>
  );
}

export default function StudentEndorsement() {
  const { office, handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const { refresh: refreshSummary } = useSummary();
  const [items, setItems] = useState([]);
  const [offices, setOffices] = useState([]);
  const [state, setState] = useState("loading");
  const [tab, setTab] = useState("all"); // "all" | "received" | "sent"
  const [chooserOpen, setChooserOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const load = useCallback(
    async (opts) => {
      setState((s) => (s === "ready" ? "ready" : "loading"));
      try {
        const data = await api.get("/api/office/endorsements");
        setItems(data.items);
        setState("ready");
      } catch (err) {
        if (handleSessionInvalidated(err)) return;
        setState((s) => (opts?.background && s === "ready" ? "ready" : "error"));
      }
    },
    [handleSessionInvalidated]
  );

  useEffect(() => {
    load();
    api.get("/api/office/offices").then((d) => setOffices(d.items.filter((o) => o.id !== office?.id))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useLiveRefresh(["student-endorsement"], load);

  async function handleStatusChange(id, status) {
    try {
      await api.patch(`/api/office/endorsements/${id}/status`, { status });
      notify(status === "resolved" ? "Marked resolved." : "Acknowledged.");
      await load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not update status.", "error");
    }
  }

  if (state === "loading" && items.length === 0) return <LoadingState label="Loading endorsements..." />;
  if (state === "error") return <ErrorState message="Couldn't load endorsements." onRetry={load} />;

  const received = items.filter((e) => e.office_id === office?.id);
  const sent = items.filter((e) => e.source_office_id === office?.id);
  const visible = tab === "received" ? received : tab === "sent" ? sent : items;
  const pendingReceived = received.filter((e) => e.status === "pending").length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Student Endorsement</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Refer a student to another authorized office, or search for a student you need, and track what your office has received.
          </p>
        </div>
        <button type="button" onClick={() => setChooserOpen(true)} className={primaryButtonClass}>
          <Plus size={15} /> New endorsement
        </button>
      </div>

      <div className="mb-5 flex gap-1 rounded-full bg-slate-200/70 p-1 text-xs font-semibold w-fit">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`rounded-full px-4 py-1.5 transition ${tab === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setTab("received")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition ${tab === "received" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
        >
          Received
          {pendingReceived > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger px-1 text-[10px] text-white">{pendingReceived}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("sent")}
          className={`rounded-full px-4 py-1.5 transition ${tab === "sent" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
        >
          Sent
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tab === "received" ? "No endorsements received" : tab === "sent" ? "No endorsements sent yet" : "No endorsements yet"}
          description={tab === "received" ? "Referrals and student searches other offices send to yours will show up here." : "Use \u201cNew endorsement\u201d to refer a student or search for one."}
        />
      ) : (
        <ul className="mx-auto max-w-2xl space-y-3">
          {visible.map((item) => (
            <EndorsementCard
              key={item.id}
              item={item}
              isMine={item.source_office_id === office?.id}
              onStatusChange={handleStatusChange}
              onRefer={(search) => {
                setReplyTo(search);
                setCreateOpen(true);
              }}
            />
          ))}
        </ul>
      )}

      <NewEndorsementChooser
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onRefer={() => {
          setChooserOpen(false);
          setReplyTo(null);
          setCreateOpen(true);
        }}
        onSearch={() => {
          setChooserOpen(false);
          setSearchOpen(true);
        }}
      />
      <CreateModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setReplyTo(null);
        }}
        offices={offices}
        replyTo={replyTo}
        onCreated={() => {
          load();
          refreshSummary();
        }}
      />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} offices={offices} onCreated={load} />
    </>
  );
}
