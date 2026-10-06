import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  UploadCloud,
  Loader2,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCw,
  FileText,
  Building2,
  PenTool,
} from "lucide-react";
import { api, uploadFile, downloadFile, fetchProtectedFile, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLiveRefresh } from "../context/LiveUpdatesContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useSummary } from "../context/SummaryContext.jsx";
import Modal from "../components/ui/Modal.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import FileViewerModal from "../components/ui/FileViewerModal.jsx";
import { inputClass, textareaClass, labelClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";
import { formatDateTime, daysUntil } from "../utils/time.js";

const SignDocumentModal = lazy(() => import("../components/ui/SignDocumentModal.jsx"));

const TONE_BOX = {
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
};
const TONE_ICON = { warning: Clock, success: CheckCircle2, danger: AlertTriangle, info: Loader2, neutral: FileText };

function formatDate(value) {
  return formatDateTime(value, "—");
}

function daysLeft(deadline) {
  return daysUntil(deadline);
}

// ── Drop-or-browse control for a single soft copy ──────────────────────
function SingleFilePicker({ file, onPick, disabled }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handle(list) {
    const picked = list?.[0];
    if (!picked) return;
    setError(null);
    setBusy(true);
    try {
      onPick(await uploadFile(picked));
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handle(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-7 text-center transition ${
          dragOver ? "border-brand-blue bg-blue-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        {busy ? <Loader2 size={22} className="animate-spin text-brand-blue" /> : <UploadCloud size={22} className="text-slate-400" />}
        <p className="text-xs font-medium text-slate-600">
          {busy ? "Uploading..." : file ? file.original_name : "Drag and drop your file here, or click to browse"}
        </p>
        <p className="text-[11px] text-slate-400">PDF, Word, or image &middot; up to 15 MB</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
    </div>
  );
}

// ── File a new "Request from SAA" ───────────────────────────────────────
function SubmitModal({ open, onClose, onSubmitted }) {
  const { notify } = useToast();
  const [documentType, setDocumentType] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setDocumentType("");
      setDescription("");
      setFile(null);
      setError(null);
    }
  }, [open]);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const data = await api.post("/api/office/document-queue", {
        documentType: documentType.trim(),
        description: description.trim(),
        fileId: file?.id,
      });
      notify(`Submitted — your ticket number is ${data.ticketNo}.`);
      onSubmitted(data.item);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Request a document from SAA" maxWidth="max-w-xl">
      <div className="space-y-4">
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs leading-relaxed text-sky-800">
          Your request is reviewed as a <strong>soft copy first</strong>. Nothing is printed until SAA approves it.
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Document type</label>
          <input
            className={inputClass}
            placeholder="e.g. Endorsement Letter Template, Office Memo Format"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Description</label>
          <textarea
            rows={3}
            className={textareaClass}
            placeholder="Briefly explain what this is for."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Soft copy</label>
          <SingleFilePicker file={file} onPick={setFile} />
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{error}</div>}

        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving || !documentType.trim() || !file} className={primaryButtonClass}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Submit request
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── One ticket, expanded (My Requests tab) ─────────────────────────────
function TicketDetail({ ticketId, onChanged }) {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [viewing, setViewing] = useState(null);
  const [pickedFile, setPickedFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (opts) => {
    setState((s) => (s === "ready" ? "ready" : "loading"));
    try {
      setData(await api.get(`/api/office/document-queue/${ticketId}`));
      setState("ready");
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setState((s) => (opts?.background && s === "ready" ? "ready" : "error"));
    }
  }, [ticketId, handleSessionInvalidated]);

  useEffect(() => {
    load();
    setPickedFile(null);
  }, [load]);

  useLiveRefresh(["document-queue"], load);

  async function resubmit() {
    setBusy(true);
    try {
      await api.post(`/api/office/document-queue/${ticketId}/resubmit`, { fileId: pickedFile.id });
      notify("Corrected copy sent back to SAA under the same ticket number.");
      setPickedFile(null);
      await load();
      onChanged?.();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not resubmit.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function fulfill() {
    setBusy(true);
    try {
      await api.post(`/api/office/document-queue/${ticketId}/fulfill`, { fileId: pickedFile.id });
      notify("Document submitted to SAA.");
      setPickedFile(null);
      await load();
      onChanged?.();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not submit the document.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <LoadingState label="Loading ticket..." />;
  if (state === "error") return <ErrorState message="Couldn't load this ticket." onRetry={load} />;

  const ticket = data.item;
  const guidance = ticket.guidance;
  const GuidanceIcon = TONE_ICON[guidance.tone] || FileText;
  const remaining = daysLeft(ticket.revision_deadline);

  return (
    <div className="space-y-5">
      <div className={`flex items-start gap-3 rounded-xl2 border px-4 py-3.5 ${TONE_BOX[guidance.tone]}`}>
        <GuidanceIcon size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">{guidance.label}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed opacity-90">{guidance.detail}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl2 border border-slate-200 bg-white p-4 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Ticket number</dt>
          <dd className="font-semibold text-slate-800">{ticket.ticket_no}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Status</dt>
          <dd className="mt-0.5">
            <StatusBadge status={ticket.status} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Document type</dt>
          <dd className="text-slate-700">{ticket.document_type}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">{ticket.status === "awaiting_submission" ? "Requested" : "Submitted"}</dt>
          <dd className="text-slate-700">{formatDate(ticket.submitted_at)}</dd>
        </div>
        {ticket.description && (
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">Description</dt>
            <dd className="whitespace-pre-wrap text-slate-700">{ticket.description}</dd>
          </div>
        )}
      </dl>

      {ticket.remarks && (
        <div className="rounded-xl2 border border-slate-200 bg-white p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">SAA remarks</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.remarks}</p>
        </div>
      )}

      {/* "Submit to SAA" — SAA requested this document from your office */}
      {ticket.status === "awaiting_submission" && (
        <div className="rounded-xl2 border border-amber-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">Upload the requested document</p>
          <SingleFilePicker file={pickedFile} onPick={setPickedFile} />
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={fulfill} disabled={!pickedFile || busy} className={primaryButtonClass}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              Submit to SAA
            </button>
          </div>
        </div>
      )}

      {/* Revision loop — same ticket number, no printing */}
      {ticket.status === "revision_requested" && (
        <div className="rounded-xl2 border border-amber-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Upload your corrected copy</p>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
              {remaining} day{remaining === 1 ? "" : "s"} left &middot; due {formatDate(ticket.revision_deadline)}
            </span>
          </div>
          <SingleFilePicker file={pickedFile} onPick={setPickedFile} />
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={resubmit} disabled={!pickedFile || busy} className={primaryButtonClass}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
              Resubmit to ticket {ticket.ticket_no}
            </button>
          </div>
        </div>
      )}

      {/* E-signature routing progress */}
      {data.routes.length > 0 && (
        <div className="rounded-xl2 border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">E-signature routing</p>
          <ul className="space-y-2">
            {data.routes.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <Building2 size={15} className="shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{r.officeName}</span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    r.stage === "Signed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {r.stage}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Files */}
      <div className="rounded-xl2 border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Files</p>
        <ul className="space-y-2">
          {ticket.file && (
            <li className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
              <FileText size={15} className="shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-slate-700">{ticket.file.original_name}</span>
              <span className="shrink-0 text-[11px] text-slate-400">Your submission</span>
              <button type="button" onClick={() => setViewing(ticket.file)} className="shrink-0 text-slate-400 hover:text-brand-blue">
                <Eye size={15} />
              </button>
            </li>
          )}
          {ticket.signedFile ? (
            <li className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1 truncate font-medium text-emerald-800">{ticket.signedFile.original_name}</span>
              <span className="shrink-0 text-[11px] font-semibold text-emerald-700">Final signed copy</span>
              <button
                type="button"
                onClick={() => downloadFile(ticket.signedFile.id, ticket.signedFile.original_name)}
                className="shrink-0 text-emerald-600 hover:text-emerald-800"
              >
                <Download size={15} />
              </button>
            </li>
          ) : (
            ticket.status === "approved_for_esigning" && (
              <li className="rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-xs text-slate-400">
                The final signed copy appears here once every signature is confirmed.
              </li>
            )
          )}
        </ul>
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
    </div>
  );
}

// ── One e-signature request, expanded (E-Signature Requests tab) ───────
// Same underlying mechanism as the Admin Panel's own "sign on behalf of an
// office" action (esignature_routes / esignature_layers) — whichever side
// signs, both sides see the identical result.
function RouteDetail({ route, onChanged }) {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [viewing, setViewing] = useState(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signBase, setSignBase] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function prepareSigning() {
    const [{ file: latest }, layerInfo, chain] = await Promise.all([
      api.get(`/api/office/document-queue/routes/${route.id}/file`),
      api.get(`/api/office/document-queue/routes/${route.id}/layers`),
      import("../utils/signatureChain.js"),
    ]);
    const layers = layerInfo.layers;
    const signerKey = `route:${route.id}`;
    const othersHaveSigned = layers.some((l) => l.signerKey !== signerKey);
    const plan = chain.planSigningBase({ signerKey, alreadySigned: Boolean(route.signed_file_id), layers, othersHaveSigned });
    const original = layerInfo.original || latest;

    if (plan.mode === "original") return { file: original, loadSource: null };
    if (plan.mode === "latest") return { file: latest || original, loadSource: null };

    try {
      const kind = /\.pdf$/i.test(original.original_name) ? "pdf" : "docx";
      const originalBytes = await (await fetchProtectedFile(`/api/uploads/${original.id}/view`)).arrayBuffer();
      const bytes = await chain.composeWithout({
        kind,
        originalBytes,
        layers,
        excludeSignerKey: plan.excludeKey,
        loadSignaturePng: async (l) => new Uint8Array(await (await fetchProtectedFile(`/api/uploads/${l.signatureFile.id}/view`)).arrayBuffer()),
      });
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return { file: original, loadSource: async () => buffer };
    } catch (err) {
      if (handleSessionInvalidated(err)) throw err;
      notify("Couldn't rebuild the document without the old signature — signing on top of the latest copy instead.", "error");
      return { file: latest || original, loadSource: null };
    }
  }

  async function openSign() {
    if (preparing) return;
    setPreparing(true);
    try {
      setSignBase(await prepareSigning());
      setSignOpen(true);
    } catch (err) {
      if (!handleSessionInvalidated(err)) notify("Could not load the document to sign.", "error");
    } finally {
      setPreparing(false);
    }
  }

  async function confirm() {
    setConfirming(true);
    try {
      await api.post(`/api/office/document-queue/routes/${route.id}/confirm`);
      notify("Confirmed — SAA has been notified.");
      onChanged?.();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not confirm.", "error");
    } finally {
      setConfirming(false);
    }
  }

  const signed = Boolean(route.signed_file_id);
  const confirmed = Boolean(route.confirmed_at);

  return (
    <div className="space-y-5">
      <div
        className={`flex items-start gap-3 rounded-xl2 border px-4 py-3.5 ${
          confirmed ? TONE_BOX.success : signed ? TONE_BOX.info : TONE_BOX.warning
        }`}
      >
        {confirmed ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <PenTool size={18} className="mt-0.5 shrink-0" />}
        <div>
          <p className="text-sm font-semibold">
            {confirmed ? "Signed and confirmed" : signed ? "Signature added — confirm to finish" : "Your office's e-signature is requested"}
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed opacity-90">
            {confirmed
              ? "SAA can see your office's signature on this document."
              : signed
              ? "Review the placement, then confirm to notify SAA your office is done."
              : "Sign anywhere on any page of the document below, then confirm."}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl2 border border-slate-200 bg-white p-4 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Ticket number</dt>
          <dd className="font-semibold text-slate-800">{route.ticket_no}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Document type</dt>
          <dd className="text-slate-700">{route.document_type}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Requested by</dt>
          <dd className="text-slate-700">{route.requester_name}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Routed to your office</dt>
          <dd className="text-slate-700">{formatDate(route.created_at)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={() => setViewing(true)} className={secondaryButtonClass}>
          <Eye size={14} /> View document
        </button>
        <button type="button" onClick={openSign} disabled={preparing || confirmed} className={primaryButtonClass}>
          {preparing ? <Loader2 size={14} className="animate-spin" /> : <PenTool size={14} />}
          {signed ? "Re-sign" : "Sign document"}
        </button>
        {signed && !confirmed && (
          <button
            type="button"
            onClick={confirm}
            disabled={confirming}
            className="flex items-center gap-1.5 rounded-lg bg-status-success px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {confirming ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Confirm signature
          </button>
        )}
      </div>

      {viewing && (
        <FileViewerModalForRoute routeId={route.id} onClose={() => setViewing(false)} />
      )}

      {signOpen && signBase && (
        <Suspense fallback={null}>
          <SignDocumentModal
            open
            onClose={() => setSignOpen(false)}
            title="Add Your Office's E-Signature"
            signEndpoint={`/api/office/document-queue/routes/${route.id}/sign`}
            file={signBase.file}
            loadSource={signBase.loadSource || undefined}
            onSaved={() => {
              setSignOpen(false);
              notify("Signature saved.");
              onChanged?.();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

// The route's current signable copy (latest cumulative file) has no fixed
// upload id ahead of time, so this small wrapper resolves it first, then
// hands off to the shared FileViewerModal.
function FileViewerModalForRoute({ routeId, onClose }) {
  const { handleSessionInvalidated } = useAuth();
  const [file, setFile] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get(`/api/office/document-queue/routes/${routeId}/file`)
      .then((d) => setFile(d.file))
      .catch((err) => {
        if (handleSessionInvalidated(err)) return;
        setError(true);
      });
  }, [routeId, handleSessionInvalidated]);

  if (error) return null;
  if (!file) return null;
  return (
    <FileViewerModal
      open
      onClose={onClose}
      fileName={file.original_name}
      viewUrl={`/api/uploads/${file.id}/view`}
      downloadUrl={`/api/uploads/${file.id}/download`}
    />
  );
}

export default function DocumentQueue() {
  const { handleSessionInvalidated } = useAuth();
  const { refresh: refreshSummary } = useSummary();
  const [tab, setTab] = useState("requests"); // "requests" | "signatures"

  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [search, setSearch] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [openTicketId, setOpenTicketId] = useState(null);

  const [routes, setRoutes] = useState([]);
  const [routesState, setRoutesState] = useState("loading");
  const [openRouteId, setOpenRouteId] = useState(null);

  const loadRequests = useCallback(
    async (term = "", opts) => {
      setState((s) => (s === "ready" ? "ready" : "loading"));
      try {
        setData(await api.get(`/api/office/document-queue${term ? `?search=${encodeURIComponent(term)}` : ""}`));
        setState("ready");
      } catch (err) {
        if (handleSessionInvalidated(err)) return;
        setState((s) => (opts?.background && s === "ready" ? "ready" : "error"));
      }
    },
    [handleSessionInvalidated]
  );

  const loadRoutes = useCallback(
    async (opts) => {
      setRoutesState((s) => (s === "ready" ? "ready" : "loading"));
      try {
        const d = await api.get("/api/office/document-queue/routes/mine");
        setRoutes(d.items);
        setRoutesState("ready");
      } catch (err) {
        if (handleSessionInvalidated(err)) return;
        setRoutesState((s) => (opts?.background && s === "ready" ? "ready" : "error"));
      }
    },
    [handleSessionInvalidated]
  );

  useEffect(() => {
    const t = setTimeout(() => loadRequests(search), search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search, loadRequests]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  useLiveRefresh(["document-queue"], (o) => {
    loadRequests(search, o);
    loadRoutes(o);
  });

  const afterChange = () => {
    loadRequests(search);
    refreshSummary();
  };
  const afterRouteChange = () => {
    loadRoutes();
    refreshSummary();
  };

  const pendingSignatures = routes.filter((r) => !r.confirmed_at).length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Document Queue</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Request documents from SAA, respond to SAA's own requests, and handle e-signature requests routed to your
            office &mdash; all as soft copies, reviewed online before anything is printed.
          </p>
        </div>
        {tab === "requests" && (
          <button type="button" onClick={() => setSubmitOpen(true)} className={primaryButtonClass}>
            <Plus size={15} /> Request from SAA
          </button>
        )}
      </div>

      <div className="mb-5 flex gap-1 rounded-full bg-slate-200/70 p-1 text-xs font-semibold w-fit">
        <button
          type="button"
          onClick={() => setTab("requests")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition ${tab === "requests" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
        >
          <ClipboardList size={13} /> My Requests
        </button>
        <button
          type="button"
          onClick={() => setTab("signatures")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition ${tab === "signatures" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
        >
          <PenTool size={13} /> E-Signature Requests
          {pendingSignatures > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger px-1 text-[10px] text-white">
              {pendingSignatures}
            </span>
          )}
        </button>
      </div>

      {tab === "requests" ? (
        <>
          {data?.counts && (
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Pending SAA", value: data.counts.pending, cls: "text-status-warning" },
                { label: "Needs revision", value: data.counts.needsRevision, cls: "text-status-warning" },
                { label: "Approved", value: data.counts.approved, cls: "text-status-success" },
                { label: "Rejected / expired", value: data.counts.rejected + data.counts.expired, cls: "text-status-danger" },
              ].map((c) => (
                <div key={c.label} className="rounded-xl2 border border-slate-200 bg-white px-4 py-3 shadow-card">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{c.label}</p>
                  <p className={`mt-1 text-2xl font-bold tabular-nums ${c.cls}`}>{c.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="relative mb-4">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket number or document type"
              className={`${inputClass} pl-9`}
            />
          </div>

          {state === "loading" && !data ? (
            <LoadingState label="Loading your requests..." />
          ) : state === "error" ? (
            <ErrorState message="Couldn't load your document queue." onRetry={() => loadRequests(search)} />
          ) : data.items.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={search ? "No matching requests" : "No document requests yet"}
              description={search ? "Try a different ticket number or document type." : "Use \u201cRequest from SAA\u201d to send your first soft copy."}
            />
          ) : (
            <ul className="space-y-3">
              {data.items.map((t) => (
                <li key={t.id} className="overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
                  <button
                    type="button"
                    onClick={() => setOpenTicketId(openTicketId === t.id ? null : t.id)}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5"
                  >
                    <span className="font-mono text-sm font-bold text-slate-800">{t.ticket_no}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{t.document_type}</span>
                    <StatusBadge status={t.status} />
                    <span className="hidden text-xs text-slate-400 sm:inline">{formatDate(t.submitted_at)}</span>
                  </button>
                  {openTicketId === t.id && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
                      <TicketDetail ticketId={t.id} onChanged={afterChange} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <SubmitModal
            open={submitOpen}
            onClose={() => setSubmitOpen(false)}
            onSubmitted={(item) => {
              afterChange();
              setOpenTicketId(item.id);
            }}
          />
        </>
      ) : routesState === "loading" && routes.length === 0 ? (
        <LoadingState label="Loading e-signature requests..." />
      ) : routesState === "error" ? (
        <ErrorState message="Couldn't load your e-signature requests." onRetry={loadRoutes} />
      ) : routes.length === 0 ? (
        <EmptyState icon={PenTool} title="No e-signature requests" description="Requests routed to your office for a signature will show up here." />
      ) : (
        <ul className="space-y-3">
          {routes.map((r) => (
            <li key={r.id} className="overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
              <button
                type="button"
                onClick={() => setOpenRouteId(openRouteId === r.id ? null : r.id)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5"
              >
                <span className="font-mono text-sm font-bold text-slate-800">{r.ticket_no}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{r.document_type}</span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    r.confirmed_at ? "bg-emerald-100 text-emerald-700" : r.signed_file_id ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {r.confirmed_at ? "Signed" : r.signed_file_id ? "Ready to confirm" : "Awaiting your signature"}
                </span>
              </button>
              {openRouteId === r.id && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
                  <RouteDetail route={r} onChanged={afterRouteChange} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
