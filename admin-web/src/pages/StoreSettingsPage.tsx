import { useMemo } from 'react'
import { toast } from 'sonner'
import { ErrorState, LoadingRows, PageHeader } from '@/components/common'
import { SettingsForm } from '@/components/SettingsForm'
import { apiErrorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useSaveSettings, useSettings } from '@/lib/queries'
import { toSettingsForm, toSettingsRequest } from '@/lib/schemas'
import { usePageTitle } from '@/lib/usePageTitle'

export default function StoreSettingsPage() {
  usePageTitle('Store settings')
  const { data, isLoading, error, refetch } = useSettings()
  const save = useSaveSettings()
  const initial = useMemo(() => (data ? toSettingsForm(data) : null), [data])

  return (
    <>
      <PageHeader
        title="Store settings"
        description={data ? `Last updated ${formatDateTime(data.updatedAt)}${data.updatedBy ? ` by ${data.updatedBy}` : ''}. The app picks up changes on its next refresh.` : undefined}
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
                onSuccess: () => toast.success('Settings saved'),
                onError: (e) => toast.error(apiErrorMessage(e)),
              })
            }
          />
        </div>
      )}
    </>
  )
}
