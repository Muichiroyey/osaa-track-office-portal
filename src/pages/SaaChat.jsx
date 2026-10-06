import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, ImagePlus, Send, Loader2, Ban, Undo2, MessageCircle } from "lucide-react";
import { api, uploadFile, downloadFile, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLiveRefresh } from "../context/LiveUpdatesContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useSummary } from "../context/SummaryContext.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import saaSeal from "../assets/saa-seal.png";
import PhotoLightbox from "../components/ui/PhotoLightbox.jsx";
import { ChatImage, ChatFileChip, PendingAttachment, isImageFile, firstFileFrom } from "../components/ui/ChatAttachment.jsx";
import { formatMessageTime } from "../utils/time.js";

// Same polling cadence as the Admin Panel's chat — there's no WebSocket
// server anywhere in this stack, and a short poll is consistent with how
// every other screen refreshes.
const POLL_MS = 4000;

function formatTime(value) {
  return formatMessageTime(value);
}

function MessageBubble({ message, onUnsend, onOpenImage }) {
  const mine = message.sender_type === "user";
  const image = isImageFile(message.file);

  if (message.unsent_at) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className="flex max-w-[75%] items-center gap-1.5 rounded-2xl border border-dashed border-slate-200 px-3.5 py-2 text-xs italic text-slate-400">
          <Ban size={12} className="shrink-0" />
          {mine ? "You unsent a message" : "This message was unsent"}
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
      {mine && (
        <button
          type="button"
          onClick={() => onUnsend(message)}
          title="Unsend this message"
          className="shrink-0 text-slate-300 opacity-100 transition hover:text-status-danger sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Undo2 size={14} />
        </button>
      )}
      <div
        className={`max-w-[75%] rounded-2xl ${image ? "p-1.5" : "px-3.5 py-2.5"} ${
          mine ? "bg-brand-blue text-white" : "border border-slate-200 bg-white text-slate-700"
        }`}
      >
        {/* A photo shows right in the bubble (click to enlarge); any other file stays a download chip. */}
        {image && <ChatImage file={message.file} onOpen={onOpenImage} />}
        {message.body && <p className={`whitespace-pre-wrap break-words text-sm ${image ? "mt-1.5" : ""}`}>{message.body}</p>}
        {message.file && !image && (
          <ChatFileChip file={message.file} mine={mine} onDownload={(f) => downloadFile(f.id, f.original_name)} />
        )}
        <p className={`mt-1 text-[10px] ${image ? "px-1.5 pb-0.5" : ""} ${mine ? "text-white/60" : "text-slate-400"}`}>{formatTime(message.created_at)}</p>
      </div>
    </div>
  );
}

/**
 * An office has exactly one conversation — theirs with the SAA
 * office — so there's no conversation list or contact picker on this side.
 * The thread is found (or created) from the signed-in account itself.
 */
export default function SaaChat() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const { refresh: refreshSummary } = useSummary();

  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [state, setState] = useState("loading");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unsendTarget, setUnsendTarget] = useState(null);
  const [lightboxId, setLightboxId] = useState(null);

  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const photoRef = useRef(null);
  const lastCountRef = useRef(0);

  const open = useCallback(async () => {
    try {
      const data = await api.get("/api/office/chat/conversation");
      setConversationId(data.conversation.id);
      setState("ready");
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setState("error");
    }
  }, [handleSessionInvalidated]);

  useEffect(() => {
    open();
  }, [open]);

  // Full refetch each tick rather than an incremental afterId, so an
  // unsend made from the other side (which edits an existing row instead
  // of adding one) shows up too.
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await api.get(`/api/office/chat/conversations/${conversationId}/messages`);
      setMessages(data.items);
    } catch (err) {
      handleSessionInvalidated(err);
    }
  }, [conversationId, handleSessionInvalidated]);

  useEffect(() => {
    if (!conversationId) return;
    loadMessages();
    // Kept as a safety net; messages normally arrive instantly through the live stream below.
    const t = setInterval(loadMessages, POLL_MS);
    return () => clearInterval(t);
  }, [conversationId, loadMessages]);

  // A reply from the SAA (or a message unsent on their side) appears the moment it happens.
  useLiveRefresh(["chat"], loadMessages);

  // Only auto-scroll when the thread actually grew, so reading back
  // through history isn't yanked to the bottom every poll.
  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Every photo in the thread, so the viewer can step through them.
  const images = useMemo(
    () => messages.filter((m) => !m.unsent_at && isImageFile(m.file)).map((m) => m.file),
    [messages]
  );
  const lightboxIndex = lightboxId == null ? -1 : images.findIndex((f) => f.id === lightboxId);

  async function pickFile(list) {
    const file = list?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file);
      // Keep a local preview so a photo shows as a thumbnail before it is sent.
      setAttachment({
        ...uploaded,
        mime_type: uploaded.mime_type || file.type,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      });
    } catch (err) {
      notify(err.message || "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    if (!draft.trim() && !attachment) return;
    setSending(true);
    try {
      await api.post(`/api/office/chat/conversations/${conversationId}/messages`, {
        body: draft.trim(),
        fileId: attachment?.id,
      });
      setDraft("");
      setAttachment(null); // PendingAttachment frees its own preview URL
      await loadMessages();
      refreshSummary();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not send your message.", "error");
    } finally {
      setSending(false);
    }
  }

  async function confirmUnsend() {
    try {
      await api.post(`/api/office/chat/conversations/${conversationId}/messages/${unsendTarget.id}/unsend`);
      setUnsendTarget(null);
      await loadMessages();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not unsend that message.", "error");
    }
  }

  if (state === "loading") return <LoadingState label="Opening SAA Chat..." />;
  if (state === "error") return <ErrorState message="Couldn't open SAA Chat." onRetry={open} />;

  return (
    <>
      <div className="mb-5">
        <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">SAA Chat</h1>
        <p className="mt-1 text-sm text-slate-500">
          Message the Office of Student and Alumni Affairs directly. Messages are kept permanently.
        </p>
      </div>

      <div className="flex h-[calc(100vh-280px)] min-h-[420px] flex-col overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
        <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <img src={saaSeal} alt="" className="size-10 rounded-full border border-slate-100 object-cover" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Office of Student and Alumni Affairs</p>
            <p className="text-xs text-slate-400">PSU Lingayen Campus</p>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-400">
              <MessageCircle size={26} />
              <p className="text-sm">No messages yet.</p>
              <p className="max-w-xs text-xs">
                Send your question below and the SAA office will reply in this same thread.
              </p>
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} onUnsend={setUnsendTarget} onOpenImage={(f) => setLightboxId(f.id)} />)
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-slate-100 px-3 py-3">
          <PendingAttachment attachment={attachment} onRemove={() => setAttachment(null)} />
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || Boolean(attachment)}
              title={attachment ? "One attachment per message" : "Attach a file"}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            >
              {uploading ? <Loader2 size={17} className="animate-spin" /> : <Paperclip size={17} />}
            </button>
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              disabled={uploading || Boolean(attachment)}
              title={attachment ? "One attachment per message" : "Send a photo"}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-blue disabled:opacity-40"
            >
              <ImagePlus size={17} />
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files);
                e.target.value = "";
              }}
            />
            <textarea
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              onPaste={(e) => {
                // Paste a screenshot / copied picture straight into the chat, like Messenger.
                const pasted = firstFileFrom(e.clipboardData);
                if (pasted && !attachment && !uploading) {
                  e.preventDefault();
                  pickFile([pasted]);
                }
              }}
              placeholder="Type your message..."
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || (!draft.trim() && !attachment)}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>

      {lightboxIndex >= 0 && (
        <PhotoLightbox
          media={images}
          index={lightboxIndex}
          onClose={() => setLightboxId(null)}
          onNavigate={(i) => setLightboxId(images[i]?.id ?? null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(unsendTarget)}
        onClose={() => setUnsendTarget(null)}
        onConfirm={confirmUnsend}
        title="Unsend this message?"
        description="Its text and any attached file are removed permanently. The conversation will show that a message was unsent."
        confirmLabel="Unsend"
      />
    </>
  );
}
