import { Paperclip, Download } from "lucide-react";
import { downloadFile } from "../../api/client.js";

/** Photos go in the picture grid; everything else on a post is a downloadable attachment. */
export function splitMedia(media) {
  const list = media || [];
  const images = list.filter((m) => String(m.mime_type || "").toLowerCase().startsWith("image/"));
  const files = list.filter((m) => !String(m.mime_type || "").toLowerCase().startsWith("image/"));
  return { images, files };
}

/** The non-photo attachments of a Campus Feed post, each with a download button. */
export default function PostAttachments({ files }) {
  if (!files || files.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <Paperclip size={14} className="shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-slate-700">{f.original_name}</span>
          <button
            type="button"
            onClick={() => downloadFile(f.id, f.original_name)}
            title="Download"
            className="shrink-0 text-slate-400 hover:text-brand-blue"
          >
            <Download size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}
