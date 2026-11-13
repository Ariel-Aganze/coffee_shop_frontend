import { ArrowLeft, Hammer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

/** Placeholder for signed-out screens of later steps (e.g. password reset, step 3). */
export function PublicComingSoonPage({ step }: { step: number }) {
  const { t } = useTranslation()
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo className="h-16" />
        </div>
        <Card>
          <EmptyState
            icon={Hammer}
            title={t('comingSoon.title', { step })}
            description={t('comingSoon.body', { step })}
            action={
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {t('auth.signIn')}
              </Link>
            }
          />
        </Card>
      </div>
    </main>
  )
}
