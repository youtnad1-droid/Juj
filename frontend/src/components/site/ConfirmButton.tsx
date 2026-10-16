import { useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";

type Props = {
  children: ReactNode;
  question: string;
  onConfirm: (note: string) => unknown;
  testId: string;
  withNote?: boolean;
  variant?: "outline" | "ghost" | "default" | "destructive";
  className?: string;
  disabled?: boolean;
};

export function ConfirmButton({ children, question, onConfirm, testId, withNote, variant = "ghost", className, disabled }: Props) {
  const { t } = useI18n();
  const [note, setNote] = useState("");
  return (
    <AlertDialog onOpenChange={(o) => o && setNote("")}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={variant} className={className} disabled={disabled} data-testid={testId}>{children}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid={`${testId}-dialog`}>
        <AlertDialogHeader>
          <AlertDialogTitle>{question}</AlertDialogTitle>
          <AlertDialogDescription>{t("Please confirm to continue.")}</AlertDialogDescription>
        </AlertDialogHeader>
        {withNote && <Input placeholder={t("Reason")} value={note} onChange={(e) => setNote(e.target.value)} data-testid={`${testId}-note`} />}
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={`${testId}-cancel`}>{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction data-testid={`${testId}-confirm`} onClick={() => onConfirm(note)}>{t("Confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
