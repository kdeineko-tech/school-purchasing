"use client";

// Кнопки рішення на сторінці заявки. «Approve» і «Return for revision» (автор виправить і подасть знову) подають форму
// одразу; «Reject» — незворотна дія, тож спершу діалог
// підтвердження (DESIGN.md, розділ 5: Dialog — лише підтвердження незворотної дії). Підтвердження подає ту саму
// форму (атрибут form), тож причину й перевірку «Provide a reason» (AC-APR-06) обробляє той самий server action.
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DecisionButtons({ formId }: { formId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="decision" value="approve">
        Approve
      </Button>
      <Button type="submit" name="decision" value="return" variant="secondary">
        Return for revision
      </Button>
      <Dialog>
        <DialogTrigger render={<Button type="button" variant="destructive" />}>Reject</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Reject this request?</DialogTitle>
            <DialogDescription>The author will see the reason next to the status.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" form={formId} name="decision" value="reject" variant="destructive">
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
