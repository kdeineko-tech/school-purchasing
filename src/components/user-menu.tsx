"use client";

// Меню під аватаром у шапці: хто увійшов (ім'я, email, роль), «My profile» і «Sign out» (DESIGN.md, розділ 5).
// Вихід — та сама server action signOut, що й раніше; форма поза спливним меню, тож вона на сторінці й тоді,
// коли меню закрите.
import { ChevronDown, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { signOut } from "@/app/login/actions";
import { RoleBadge } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ViewerProfile } from "@/lib/org/viewer";

// Ініціали: перші літери двох перших слів імені, без імені — перша літера email.
export function initials(fullName: string | null, email: string | null): string {
  const words = (fullName ?? "").trim().split(/[\s-]+/).filter(Boolean);
  const letters = words.length > 0 ? words.slice(0, 2).map((w) => w[0]) : [(email ?? "?")[0]];
  return letters.join("").toUpperCase();
}

export function UserMenu({ viewer }: { viewer: Pick<ViewerProfile, "fullName" | "email" | "role"> }) {
  const signOutForm = useRef<HTMLFormElement>(null);
  const name = viewer.fullName ?? viewer.email ?? "";

  return (
    <>
      <form ref={signOutForm} action={signOut} hidden />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Account menu: ${name}`}
          className="flex h-10 items-center gap-1 rounded-full border border-border py-1 pr-2 pl-1 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
        >
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {initials(viewer.fullName, viewer.email)}
          </span>
          <ChevronDown className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-2">
          <div className="flex flex-col gap-1 px-1.5 py-1" data-testid="user-menu-identity">
            <span className="font-medium text-foreground">{name}</span>
            {viewer.fullName && viewer.email && (
              <span className="text-sm text-muted-foreground">{viewer.email}</span>
            )}
            <span className="mt-1">
              <RoleBadge role={viewer.role} />
            </span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="h-9" render={<Link href="/profile" />}>
              <User aria-hidden />
              My profile
            </DropdownMenuItem>
            <DropdownMenuItem className="h-9" onClick={() => signOutForm.current?.requestSubmit()}>
              <LogOut aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
