import {
  Home,
  Bell,
  Rss,
  ClipboardList,
  Users,
  FolderKanban,
  Network,
  MessageCircle,
  Settings,
} from "lucide-react";

/**
 * A single navigation set — unlike the Student & Alumni Portal, every
 * signed-in account here is the same type ('offices'), so there's no
 * per-type branching. Order follows the spec's own module list (Dashboard,
 * Announcements, Campus Feed, Document Queue, Student Endorsement,
 * Document Repository, Student Leader Directory, FAQ, SAA Chat, Settings).
 * (The Notifications module was removed — each module's own red count replaces it.)
 */
const OFFICE_NAV = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", to: "/", icon: Home, end: true },
      { label: "Announcements", to: "/announcements", icon: Bell, badgeKey: "announcements" },
      { label: "Campus Feed", to: "/campus-feed", icon: Rss, badgeKey: "campusFeed" },
    ],
  },
  {
    label: "Documents",
    items: [
      { label: "Document Queue", to: "/document-queue", icon: ClipboardList, badgeKey: "documentQueue" },
      { label: "Document Repository", to: "/document-repository", icon: FolderKanban, badgeKey: "documentRepository" },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Student Endorsement", to: "/student-endorsement", icon: Users, badgeKey: "endorsements" },
      { label: "Student Leaders Directory", to: "/student-leaders", icon: Network, badgeKey: "studentLeaders" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "SAA Chat", to: "/saa-chat", icon: MessageCircle, badgeKey: "saaChat" },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];

export function navGroupsFor() {
  return OFFICE_NAV;
}
