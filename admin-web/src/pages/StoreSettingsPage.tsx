import { useMemo } from 'react'
import { toast } from 'sonner'
import { ErrorState, LoadingRows, PageHeader } from '@/components/common'
import { SettingsForm } from '@/components/SettingsForm'
import { apiErrorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useSaveSettings, useSettings } from '@/lib/queries'
import { toSettingsForm, toSettingsRequest } from '@/lib/schemas'
import { usePageTitle } from '@/lib/usePageTitle'
import { t as tNow, useT } from '@/i18n'

export default function StoreSettingsPage() {
  const t = useT()
  usePageTitle(t('settings.title'))
  const { data, isLoading, error, refetch } = useSettings()
  const save = useSaveSettings()
  const initial = useMemo(() => (data ? toSettingsForm(data) : null), [data])

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        description={
          data
            ? `${data.updatedBy ? t('settings.lastUpdatedBy', { time: formatDateTime(data.updatedAt), who: data.updatedBy }) : t('settings.lastUpdated', { time: formatDateTime(data.updatedAt) })}. ${t('settings.refreshNote')}`
            : undefined
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !initial ? (
        <LoadingRows rows={8} />
      ) : (
        <div className="max-w-3xl">
          <SettingsForm
            initial={initial}
            saving={save.isPending}
            onSubmit={(values) =>
              save.mutate(toSettingsRequest(values), {
                onSuccess: () => toast.success(tNow('settings.saved')),
                onError: (e) => toast.error(apiErrorMessage(e)),
              })
            }
          />
        </div>
      )}
    </>
  )
}
