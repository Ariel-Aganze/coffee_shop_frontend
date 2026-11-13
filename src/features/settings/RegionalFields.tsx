import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

import { SelectField } from '@/components/ui/SelectField'

import {
  DATE_FORMATS,
  datePreview,
  LANGUAGES,
  NUMBER_FORMATS,
  numberPreview,
  timezoneGroups,
  timezoneLabel,
} from './regional'

type FieldProps = Omit<ComponentProps<typeof SelectField>, 'label' | 'children'>

const GROUPS = timezoneGroups()

export function TimezoneField(props: FieldProps) {
  const { t } = useTranslation()
  return (
    <SelectField label={t('regional.timezone')} hint={t('regional.timezoneHint')} {...props}>
      <option value="UTC">UTC</option>
      {GROUPS.map((group) => (
        <optgroup key={group.region} label={group.region}>
          {group.zones.map((zone) => (
            <option key={zone} value={zone}>
              {timezoneLabel(zone)}
            </option>
          ))}
        </optgroup>
      ))}
    </SelectField>
  )
}

export function LanguageField(props: FieldProps) {
  const { t } = useTranslation()
  return (
    <SelectField label={t('regional.language')} hint={t('regional.languageHint')} {...props}>
      {LANGUAGES.map((language) => (
        <option key={language.value} value={language.value}>
          {language.available
            ? language.label
            : t('regional.comingSoon', { language: language.label })}
        </option>
      ))}
    </SelectField>
  )
}

/** Options show a live example, e.g. "04/03/2026", rather than an abstract pattern. */
export function DateFormatField(props: FieldProps) {
  const { t } = useTranslation()
  return (
    <SelectField label={t('regional.dateFormat')} {...props}>
      {DATE_FORMATS.map((format) => (
        <option key={format} value={format}>
          {datePreview(format)}
        </option>
      ))}
    </SelectField>
  )
}

export function NumberFormatField(props: FieldProps) {
  const { t } = useTranslation()
  return (
    <SelectField label={t('regional.numberFormat')} {...props}>
      {NUMBER_FORMATS.map((format) => (
        <option key={format} value={format}>
          {numberPreview(format)}
        </option>
      ))}
    </SelectField>
  )
}
