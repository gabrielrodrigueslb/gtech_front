'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type LogoutConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void> | void
  isLoading?: boolean
}

export default function LogoutConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: LogoutConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !isLoading && onOpenChange(nextOpen)}>
      <AlertDialogContent className="max-w-md rounded-3xl border-white/10 bg-[#10131a] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="text-xl text-white">Sair da conta?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-6 text-white/60">
            Você precisará fazer login novamente para voltar ao sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:justify-end">
          <AlertDialogCancel
            disabled={isLoading}
            className="cursor-pointer rounded-2xl border-white/10 bg-white/4 text-white/80 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isLoading}
            onClick={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
            className="cursor-pointer rounded-2xl bg-rose-500 text-white hover:bg-rose-400 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Saindo...' : 'Sair'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
