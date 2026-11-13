import { PageLoader } from '@/components/feedback/Loader'
import { useBusiness } from '@/features/business/useBusiness'

import { BusinessProfileCard } from './BusinessProfileCard'
import { CurrencyCard } from './CurrencyCard'
import { PosCard, RegionalCard } from './PreferencesCards'

/** Business settings (SRS 5.14.1): profile, region, point of sale, currency. */
export function SettingsPage() {
  const { business, settings } = useBusiness()
  if (!business || !settings) return <PageLoader />

  return (
    <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
      <div className="flex flex-col gap-4 sm:gap-6">
        <BusinessProfileCard business={business} />
        <PosCard settings={settings} />
      </div>
      <div className="flex flex-col gap-4 sm:gap-6">
        <CurrencyCard settings={settings} />
        <RegionalCard settings={settings} />
      </div>
    </div>
  )
}
