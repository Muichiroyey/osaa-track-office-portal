import { useCallback, useEffect, useState } from "react";
import { Rss, Send, EyeOff, Eye, Trash2, Loader2, MoreVertical, Pencil } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useLiveRefresh } from "../context/LiveUpdatesContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ProtectedImage from "../components/ui/ProtectedImage.jsx";
import PhotoLightbox from "../components/ui/PhotoLightbox.jsx";
import PhotoPicker from "../components/ui/PhotoPicker.jsx";
import AuthorAvatar from "../components/ui/AuthorAvatar.jsx";
import Modal from "../components/ui/Modal.jsx";
import FileDropzone from "../components/ui/FileDropzone.jsx";
import PostAttachments, { splitMedia } from "../components/ui/PostAttachments.jsx";
import OfficeFeedFilter, { authorKey } from "../components/ui/OfficeFeedFilter.jsx";
import { inputClass, labelClass, textareaClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";
import { formatDateTime } from "../utils/time.js";

function formatWhen(value) {
  return formatDateTime(value, "");
}

/**
 * Facebook-style photo grid, matching how the Admin Panel composes a post:
 * 1 full width, 2 side by side, 3 one large + two stacked, 4+ a 2x2 with a
 * "+N" overlay on the last tile.
 */
function PhotoGrid({ media, onOpen }) {
  if (!media || media.length === 0) return null;
  const count = media.length;
  const tile = (m, i, className, overlay) => (
    <button key={m.id} type="button" onClick={() => onOpen(i)} className={`relative overflow-hidden bg-slate-100 ${className}`}>
      <ProtectedImage file={m} alt="" className="size-full" />
      {overlay > 0 && (
        <span className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-2xl font-bold text-white">+{overlay}</span>
      )}
    </button>
  );

  if (count === 1) return <div className="mt-3 overflow-hidden rounded-xl">{tile(media[0], 0, "h-80 w-full", 0)}</div>;
  if (count === 2)
    return <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-xl">{media.map((m, i) => tile(m, i, "h-64 w-full", 0))}</div>;
  if (count === 3)
    return (
      <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-xl">
        {tile(media[0], 0, "row-span-2 h-[calc(16rem+0.25rem)] w-full", 0)}
        {tile(media[1], 1, "h-32 w-full", 0)}
        {tile(media[2], 2, "h-32 w-full", 0)}
      </div>
    );
  return (
    <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-xl">
      {media.slice(0, 4).map((m, i) => tile(m, i, "h-40 w-full", i === 3 ? count - 4 : 0))}
    </div>
  );
}

/**
 * The post form — used both to write a new post and to edit an existing one.
 * A post has a title, its content, and attachments (photos show as a picture
 * grid; documents show as downloadable files).
 */
function PostForm({ initial, submitting, submitLabel, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [photos, setPhotos] = useState(initial?.photos || []);
  const [docs, setDocs] = useState(initial?.docs || []);

  const valid = title.trim() && body.trim();

  function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      title: title.trim(),
      body: body.trim(),
      mediaFileIds: [...photos, ...docs].map((m) => m.id),
      reset: () => {
        setTitle("");
        setBody("");
        photos.forEach((m) => m.previewUrl && URL.revokeObjectURL(m.previewUrl));
        setPhotos([]);
        setDocs([]);
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Title</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give your post a title" maxLength={255} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Content</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share an update, activity, or announcement for the campus feed..."
          rows={4}
          className={textareaClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Photos</label>
        <PhotoPicker files={photos} onChange={setPhotos} label="Add photos" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Attachments (optional)</label>
        <FileDropzone files={docs} onChange={setDocs} multiple label="Drop files here or click to attach documents" />
      </div>
      <div className="flex justify-end gap-2.5 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={submitting || !valid} className={primaryButtonClass}>
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Composer({ office, onPosted }) {
  const { user, handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [submitting, setSubmitting] = useState(false);
  // Changing the key remounts the form, which clears it after a successful post.
  const [formKey, setFormKey] = useState(0);

  async function submit({ title, body, mediaFileIds }) {
    setSubmitting(true);
    try {
      await api.post("/api/office/campus-feed", { title, body, mediaFileIds });
      setFormKey((k) => k + 1);
      notify("Posted to the Campus Feed.", "success");
      onPosted();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not publish the post.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-5 rounded-xl2 border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-center gap-2.5">
        {/* Your office logo from Settings — exactly what students and other offices will see on the post. */}
        <AuthorAvatar logo={user?.avatarFileId ? { id: user.avatarFileId } : null} name={office?.name} isOffice className="size-9" />
        <p className="text-sm font-semibold text-slate-800">Post as {office?.name}</p>
      </div>
      <PostForm key={formKey} submitting={submitting} submitLabel="Post" onSubmit={submit} />
    </div>
  );
}

function EditPostModal({ post, onClose, onSaved }) {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);
  const { images, files } = splitMedia(post.media);

  async function submit({ title, body, mediaFileIds }) {
    setSaving(true);
    try {
      await api.put(`/api/office/campus-feed/${post.id}`, { title, body, mediaFileIds });
      notify("Post updated.", "success");
      onSaved();
      onClose();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not save your changes.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit post" maxWidth="max-w-xl">
      <PostForm
        initial={{ title: post.title, body: post.body, photos: images, docs: files }}
        submitting={saving}
        submitLabel="Save changes"
        onSubmit={submit}
        onCancel={onClose}
      />
    </Modal>
  );
}

function PostMenu({ post, onEdit, onHide, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative ml-auto shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-panel">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit(post);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
          >
            <Pencil size={14} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onHide(post);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
          >
            {post.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
            {post.hidden ? "Unhide" : "Hide"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete(post);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-status-danger hover:bg-red-50"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function CampusFeed() {
  const { office, handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [lightbox, setLightbox] = useState(null);
  const [showMine, setShowMine] = useState(false);
  const [editing, setEditing] = useState(null);
  const [officeFilter, setOfficeFilter] = useState("all");

  const load = useCallback(
    async (opts) => {
      setState((s) => (s === "ready" ? "ready" : "loading"));
      try {
        const path = showMine ? "/api/office/campus-feed/mine" : "/api/office/campus-feed";
        const data = await api.get(path);
        setItems(data.items);
        setState("ready");
      } catch (err) {
        if (handleSessionInvalidated(err)) return;
        setState((s) => (opts?.background && s === "ready" ? "ready" : "error"));
      }
    },
    [handleSessionInvalidated, showMine]
  );

  useEffect(() => {
    load();
  }, [load]);

  useLiveRefresh(["campus-feed"], load);

  async function handleHide(post) {
    try {
      await api.patch(`/api/office/campus-feed/${post.id}/hidden`, { hidden: !post.hidden });
      notify(post.hidden ? "Post unhidden." : "Post hidden.", "success");
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not update the post.", "error");
    }
  }

  async function handleDelete(post) {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try {
      await api.del(`/api/office/campus-feed/${post.id}`);
      notify("Post deleted.", "success");
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not delete the post.", "error");
    }
  }

  const visibleItems = showMine ? items : items.filter((p) => officeFilter === "all" || authorKey(p) === officeFilter);

  if (state === "loading") return <LoadingState label="Loading campus feed..." />;
  if (state === "error") return <ErrorState message="Couldn't load the campus feed." onRetry={load} />;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Campus Feed</h1>
          <p className="mt-1 text-sm text-slate-500">Post office updates, and view what other offices and SAA have shared.</p>
        </div>
        <div className="flex gap-1 rounded-full bg-slate-200/70 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setShowMine(false)}
            className={`rounded-full px-3.5 py-1.5 transition ${!showMine ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
          >
            All posts
          </button>
          <button
            type="button"
            onClick={() => setShowMine(true)}
            className={`rounded-full px-3.5 py-1.5 transition ${showMine ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
          >
            My posts
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        <Composer office={office} onPosted={load} />

        {items.length > 0 && !showMine && <OfficeFeedFilter items={items} value={officeFilter} onChange={setOfficeFilter} />}

        {items.length === 0 ? (
          <EmptyState icon={Rss} title="Nothing here yet" description="Posts will show up here." />
        ) : visibleItems.length === 0 ? (
          <EmptyState icon={Rss} title="No posts from this office" description="Choose another office or All offices." />
        ) : (
          <div className="space-y-4">
            {visibleItems.map((post) => {
              const { images, files } = splitMedia(post.media);
              const isMine = post.author_type === "office" && post.author_office_id === office?.id;
              return (
                <article
                  key={post.id}
                  className={`rounded-xl2 border bg-white p-4 shadow-card sm:p-5 ${post.hidden ? "border-dashed border-slate-300 opacity-70" : "border-slate-200"}`}
                >
                  <header className="flex items-center gap-3">
                    <AuthorAvatar post={post} />
                    <div className="min-w-0">
                      {/* Real author name + logo for every post: other offices, SAA, or this office. */}
                      <p className="text-sm font-semibold text-slate-800">{post.author_name}</p>
                      <p className="text-xs text-slate-400">
                        {formatWhen(post.created_at)}
                        {post.hidden && " · Hidden"}
                      </p>
                    </div>
                    {isMine && <PostMenu post={post} onEdit={setEditing} onHide={handleHide} onDelete={handleDelete} />}
                  </header>
                  {post.title && <h2 className="mt-3 font-heading text-base font-semibold text-slate-800">{post.title}</h2>}
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{post.body}</p>
                  <PhotoGrid media={images} onOpen={(index) => setLightbox({ media: images, index })} />
                  <PostAttachments files={files} />
                </article>
              );
            })}
          </div>
        )}
      </div>

      {editing && <EditPostModal post={editing} onClose={() => setEditing(null)} onSaved={load} />}

      {lightbox && (
        <PhotoLightbox
          media={lightbox.media}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(i) => setLightbox((prev) => ({ ...prev, index: i }))}
        />
      )}
    </>
  );
}
