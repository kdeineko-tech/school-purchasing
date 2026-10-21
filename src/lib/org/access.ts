// Доступ до сторінок адміністратора (AC-ORG-09). Те саме правило в базі тримають політики RLS
// з private.current_app_role() = 'admin' (роль лише активного профілю).

export type AppRole = "requester" | "approver" | "admin";

export type Viewer = {
  role: AppRole;
  isActive: boolean;
};

export function canOpenAdminPages(viewer: Viewer | null): boolean {
  return viewer !== null && viewer.isActive && viewer.role === "admin";
}
